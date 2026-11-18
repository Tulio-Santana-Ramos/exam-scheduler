import { Appointment, type AppointmentStatus } from '../../domain/appointment.js';
import { SlotUnavailableError } from '../../domain/errors.js';
import type { ReportStatus } from '../../domain/report.js';
import type {
  AppointmentSearch,
  ClinicAppointmentView,
  PatientAppointmentView,
} from '../../ports/read-models.js';
import type { AppointmentRepository } from '../../ports/repositories.js';
import { isUniqueViolation, type Queryable } from './queryable.js';

interface AppointmentRow {
  id: string;
  patient_id: string;
  exam_type_id: string;
  slot_start: Date;
  status: AppointmentStatus;
  created_at: Date;
  cancelled_at: Date | null;
}

interface ClinicViewRow {
  id: string;
  slot_start: Date;
  status: AppointmentStatus;
  cancelled_at: Date | null;
  patient_id: string;
  patient_name: string;
  exam_type_id: string;
  exam_type_code: string;
  exam_type_name: string;
  report_id: string | null;
  report_status: ReportStatus | null;
}

interface PatientViewRow {
  id: string;
  slot_start: Date;
  status: AppointmentStatus;
  exam_type_id: string;
  exam_type_code: string;
  exam_type_name: string;
  report_id: string | null;
  report_published_at: Date | null;
}

const APPOINTMENT_COLUMNS =
  'id, patient_id, exam_type_id, slot_start, status, created_at, cancelled_at';

const toAppointment = (row: AppointmentRow): Appointment =>
  Appointment.rehydrate({
    id: row.id,
    patientId: row.patient_id,
    examTypeId: row.exam_type_id,
    slotStart: row.slot_start,
    status: row.status,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at,
  });

export class PgAppointmentRepository implements AppointmentRepository {
  constructor(private readonly db: Queryable) {}

  async insert(appointment: Appointment): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO appointments (${APPOINTMENT_COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          appointment.id,
          appointment.patientId,
          appointment.examTypeId,
          appointment.slotStart,
          appointment.status,
          appointment.createdAt,
          appointment.cancelledAt,
        ],
      );
    } catch (error) {
      if (error instanceof Error && isUniqueViolation(error, 'appointments_active_slot_key')) {
        throw new SlotUnavailableError();
      }
      throw error;
    }
  }

  async findById(id: string): Promise<Appointment | null> {
    const { rows } = await this.db.query<AppointmentRow>(
      `SELECT ${APPOINTMENT_COLUMNS} FROM appointments WHERE id = $1`,
      [id],
    );
    return rows[0] ? toAppointment(rows[0]) : null;
  }

  async findByIdForUpdate(id: string): Promise<Appointment | null> {
    const { rows } = await this.db.query<AppointmentRow>(
      `SELECT ${APPOINTMENT_COLUMNS} FROM appointments WHERE id = $1 FOR UPDATE`,
      [id],
    );
    return rows[0] ? toAppointment(rows[0]) : null;
  }

  async update(appointment: Appointment): Promise<void> {
    await this.db.query('UPDATE appointments SET status = $2, cancelled_at = $3 WHERE id = $1', [
      appointment.id,
      appointment.status,
      appointment.cancelledAt,
    ]);
  }

  async findActiveSlotStarts(from: Date, to: Date): Promise<Date[]> {
    const { rows } = await this.db.query<{ slot_start: Date }>(
      `SELECT slot_start FROM appointments
        WHERE status = 'SCHEDULED' AND slot_start >= $1 AND slot_start < $2
        ORDER BY slot_start`,
      [from, to],
    );
    return rows.map((row) => row.slot_start);
  }

  async searchForClinic(search: AppointmentSearch): Promise<ClinicAppointmentView[]> {
    const { rows } = await this.db.query<ClinicViewRow>(
      `SELECT a.id, a.slot_start, a.status, a.cancelled_at,
              p.id AS patient_id, u.full_name AS patient_name,
              et.id AS exam_type_id, et.code AS exam_type_code, et.name AS exam_type_name,
              r.id AS report_id, r.status AS report_status
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
         JOIN users u ON u.id = p.user_id
         JOIN exam_types et ON et.id = a.exam_type_id
         LEFT JOIN reports r ON r.appointment_id = a.id
        WHERE ($1::timestamptz IS NULL OR a.slot_start >= $1)
          AND ($2::timestamptz IS NULL OR a.slot_start < $2)
          AND ($3::uuid IS NULL OR a.patient_id = $3)
          AND ($5::uuid IS NULL OR a.id = $5)
        ORDER BY a.slot_start, a.id
        LIMIT $4`,
      [
        search.from ?? null,
        search.to ?? null,
        search.patientId ?? null,
        search.limit,
        search.appointmentId ?? null,
      ],
    );
    return rows.map((row) => ({
      id: row.id,
      patient: { id: row.patient_id, fullName: row.patient_name },
      examType: { id: row.exam_type_id, code: row.exam_type_code, name: row.exam_type_name },
      slotStart: row.slot_start,
      status: row.status,
      cancelledAt: row.cancelled_at,
      report:
        row.report_id && row.report_status
          ? { id: row.report_id, status: row.report_status }
          : null,
    }));
  }

  async searchForPatient(
    patientId: string,
    search: Pick<AppointmentSearch, 'from' | 'to' | 'limit'>,
  ): Promise<PatientAppointmentView[]> {
    const { rows } = await this.db.query<PatientViewRow>(
      `SELECT a.id, a.slot_start, a.status,
              et.id AS exam_type_id, et.code AS exam_type_code, et.name AS exam_type_name,
              r.id AS report_id, r.published_at AS report_published_at
         FROM appointments a
         JOIN exam_types et ON et.id = a.exam_type_id
         LEFT JOIN reports r ON r.appointment_id = a.id AND r.status = 'PUBLISHED'
        WHERE a.patient_id = $1
          AND ($2::timestamptz IS NULL OR a.slot_start >= $2)
          AND ($3::timestamptz IS NULL OR a.slot_start < $3)
        ORDER BY a.slot_start, a.id
        LIMIT $4`,
      [patientId, search.from ?? null, search.to ?? null, search.limit],
    );
    return rows.map((row) => ({
      id: row.id,
      examType: { id: row.exam_type_id, code: row.exam_type_code, name: row.exam_type_name },
      slotStart: row.slot_start,
      status: row.status,
      publishedReport:
        row.report_id && row.report_published_at
          ? { id: row.report_id, publishedAt: row.report_published_at }
          : null,
    }));
  }
}

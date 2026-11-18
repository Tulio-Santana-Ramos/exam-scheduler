import { ReportAlreadyPublishedError } from '../../domain/errors.js';
import { Report, type ReportStatus } from '../../domain/report.js';
import { ReportContent } from '../../domain/report-content.js';
import type { PatientReportView } from '../../ports/read-models.js';
import type { ReportRepository } from '../../ports/repositories.js';
import type { Queryable } from './queryable.js';

interface ReportRow {
  id: string;
  appointment_id: string;
  title: string;
  body: string;
  professional_name: string;
  status: ReportStatus;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface PatientReportRow {
  id: string;
  appointment_id: string;
  title: string;
  body: string;
  professional_name: string;
  published_at: Date;
  slot_start: Date;
  exam_type_id: string;
  exam_type_code: string;
  exam_type_name: string;
}

const toReport = (row: ReportRow): Report =>
  Report.rehydrate({
    id: row.id,
    appointmentId: row.appointment_id,
    content: ReportContent.create({
      title: row.title,
      body: row.body,
      professionalName: row.professional_name,
    }),
    status: row.status,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

export class PgReportRepository implements ReportRepository {
  constructor(private readonly db: Queryable) {}

  async insert(report: Report): Promise<void> {
    await this.db.query(
      `INSERT INTO reports (id, appointment_id, title, body, professional_name, status,
                            published_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        report.id,
        report.appointmentId,
        report.content.title,
        report.content.body,
        report.content.professionalName,
        report.status,
        report.publishedAt,
        report.createdAt,
        report.updatedAt,
      ],
    );
  }

  async update(report: Report): Promise<void> {
    const result = await this.db.query(
      `UPDATE reports
          SET title = $2, body = $3, professional_name = $4, status = $5,
              published_at = $6, updated_at = $7
        WHERE id = $1 AND status = 'DRAFT'`,
      [
        report.id,
        report.content.title,
        report.content.body,
        report.content.professionalName,
        report.status,
        report.publishedAt,
        report.updatedAt,
      ],
    );
    if (result.rowCount === 0) throw new ReportAlreadyPublishedError();
  }

  async findByAppointmentId(appointmentId: string): Promise<Report | null> {
    const { rows } = await this.db.query<ReportRow>(
      `SELECT id, appointment_id, title, body, professional_name, status,
              published_at, created_at, updated_at
         FROM reports WHERE appointment_id = $1`,
      [appointmentId],
    );
    return rows[0] ? toReport(rows[0]) : null;
  }

  async findPublishedForPatient(
    reportId: string,
    patientId: string,
  ): Promise<PatientReportView | null> {
    const { rows } = await this.db.query<PatientReportRow>(
      `SELECT r.id, r.appointment_id, r.title, r.body, r.professional_name, r.published_at,
              a.slot_start,
              et.id AS exam_type_id, et.code AS exam_type_code, et.name AS exam_type_name
         FROM reports r
         JOIN appointments a ON a.id = r.appointment_id
         JOIN exam_types et ON et.id = a.exam_type_id
        WHERE r.id = $1 AND r.status = 'PUBLISHED' AND a.patient_id = $2`,
      [reportId, patientId],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      appointmentId: row.appointment_id,
      title: row.title,
      body: row.body,
      professionalName: row.professional_name,
      publishedAt: row.published_at,
      examType: { id: row.exam_type_id, code: row.exam_type_code, name: row.exam_type_name },
      slotStart: row.slot_start,
    };
  }
}

import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useClinicConfig } from '../../auth/clinic-config';
import { ErrorMessage, PageHeader, QueryState } from '../../components/ui';
import { useAvailability, useBookAppointment, useExamTypes, usePatients } from '../../hooks/clinic';
import { formatDay, formatTime, todayIn } from '../../lib/time';

export function NewAppointmentPage() {
  const { timeZone } = useClinicConfig();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') ?? todayIn(timeZone);
  const [slotStart, setSlotStart] = useState('');

  const patients = usePatients();
  const examTypes = useExamTypes();
  const availability = useAvailability(date);
  const book = useBookAppointment();

  const slots = availability.data ?? [];
  const chosen = slots.find((slot) => slot.slotStart === slotStart && slot.state === 'AVAILABLE');
  const hasFreeSlot = slots.some((slot) => slot.state === 'AVAILABLE');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chosen) return;
    const form = new FormData(event.currentTarget);
    book.mutate(
      {
        patientId: String(form.get('patientId') ?? ''),
        examTypeId: String(form.get('examTypeId') ?? ''),
        slotStart: chosen.slotStart,
      },
      { onSuccess: () => navigate(`/appointments?date=${date}&booked=1`) },
    );
  }

  return (
    <>
      <Link className="back" to="/appointments">← Agendamentos</Link>
      <PageHeader title="Novo agendamento" subtitle="Escolha o paciente, o exame e um horário livre." />
      <form onSubmit={handleSubmit} className="card form-card stack">
        <label>
          Paciente
          <select name="patientId" required defaultValue="">
            <option value="" disabled>Selecione…</option>
            {patients.data?.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
          </select>
        </label>
        <label>
          Tipo de exame
          <select name="examTypeId" required defaultValue="">
            <option value="" disabled>Selecione…</option>
            {examTypes.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label>
          Data
          <input
            type="date"
            value={date}
            min={todayIn(timeZone)}
            onChange={(e) => setParams({ date: e.target.value }, { replace: true })}
            required
          />
        </label>

        <fieldset>
          <legend>Horário ({formatDay(date)})</legend>
          <QueryState isPending={availability.isPending} error={availability.error}>
            {!hasFreeSlot && <p className="notice warning">Não há horários livres nesta data. Escolha outro dia.</p>}
            <div className="slots">
              {slots.map((slot) => (
                <label key={slot.slotStart} className={`slot ${slot.state.toLowerCase()}`}>
                  <input
                    type="radio"
                    name="slotStart"
                    value={slot.slotStart}
                    checked={slot.slotStart === chosen?.slotStart}
                    disabled={slot.state !== 'AVAILABLE'}
                    onChange={() => setSlotStart(slot.slotStart)}
                  />
                  <span>{formatTime(slot.slotStart, timeZone)}</span>
                </label>
              ))}
            </div>
            <div className="legend" aria-hidden="true">
              <span className="l-available">Livre</span>
              <span className="l-taken">Ocupado</span>
              <span className="l-past">Já passou</span>
            </div>
          </QueryState>
        </fieldset>

        {chosen && <p className="summary" role="status">Horário escolhido: {formatTime(chosen.slotStart, timeZone)}, {formatDay(date)}.</p>}
        <ErrorMessage error={book.error} />
        <div className="form-actions">
          <button type="submit" disabled={book.isPending || !chosen}>
            {book.isPending ? 'Agendando…' : 'Agendar'}
          </button>
          <Link className="button ghost" to="/appointments">Cancelar</Link>
        </div>
      </form>
    </>
  );
}

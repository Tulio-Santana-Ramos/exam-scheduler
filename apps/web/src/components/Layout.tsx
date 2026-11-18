import { NavLink, Outlet } from 'react-router-dom';
import { useClinicConfig } from '../auth/clinic-config';
import { useSession } from '../auth/session';
import { utcOffsetLabel } from '../lib/time';
import { BrandMark } from './ui';

export function Layout() {
  const { session, signOut } = useSession();
  const { timeZone, openHour, closeHour, slotMinutes } = useClinicConfig();
  const isClinic = session?.user.role === 'CLINIC';
  const hours = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

  return (
    <>
      <header className="topbar">
        <div className="container topbar-inner">
          <span className="brand">
            <BrandMark />
            Clínica · Exames e laudos
          </span>
          <nav aria-label="Principal">
            {isClinic ? (
              <>
                <NavLink to="/appointments" end>Agendamentos</NavLink>
                <NavLink to="/appointments/new">Novo agendamento</NavLink>
              </>
            ) : (
              <NavLink to="/my/appointments">Meus exames</NavLink>
            )}
          </nav>
          <div className="user">
            <span className="chip">{isClinic ? 'Equipe da clínica' : 'Paciente'}</span>
            <button type="button" className="ghost small" onClick={signOut}>Sair</button>
          </div>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
      <footer className="container muted small">
        <p>
          Horários exibidos em {timeZone} ({utcOffsetLabel(timeZone)}). Funcionamento das {hours(openHour)} às{' '}
          {hours(closeHour)}, em horários de {slotMinutes} minutos.
        </p>
      </footer>
    </>
  );
}

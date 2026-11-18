import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '../auth/session';
import type { Role } from '../api/types';

export function RequireRole({ role }: { role: Role }) {
  const { session } = useSession();
  if (!session) return <Navigate to="/login" replace />;
  if (session.user.role !== role) return <Navigate to="/" replace />;
  return <Outlet />;
}

export function HomeRedirect() {
  const { session } = useSession();
  if (!session) return <Navigate to="/login" replace />;
  return <Navigate to={session.user.role === 'CLINIC' ? '/appointments' : '/my/appointments'} replace />;
}

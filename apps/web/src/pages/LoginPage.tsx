import type { FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from '../auth/session';
import { useLogin } from '../hooks/auth';
import { BrandMark, ErrorMessage } from '../components/ui';

const DEMO_PASSWORD = 'demo1234';
const DEMO_ACCOUNTS = [
  { label: 'Entrar como equipe da clínica', email: 'clinica@demo.test' },
  { label: 'Entrar como paciente (Ana Souza)', email: 'paciente1@demo.test' },
  { label: 'Entrar como paciente (Bruno Lima)', email: 'paciente2@demo.test' },
];
const SHOW_DEMO = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === 'true';

export function LoginPage() {
  const { session } = useSession();
  const login = useLogin();

  if (session) return <Navigate to="/" replace />;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    login.mutate({ email: String(form.get('email') ?? ''), password: String(form.get('password') ?? '') });
  }

  return (
    <main className="auth">
      <div className="auth-card">
        <span className="brand">
          <BrandMark />
          Clínica · Exames e laudos
        </span>
        <section className="card">
          <h1>Entrar</h1>
          <p className="muted">Acesse com a sua conta da clínica ou de paciente.</p>
          <form onSubmit={handleSubmit} className="stack">
            <label>
              E-mail
              <input name="email" type="email" autoComplete="username" required />
            </label>
            <label>
              Senha
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            <ErrorMessage error={login.error} />
            <button type="submit" className="full" disabled={login.isPending}>
              {login.isPending ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </section>
        {SHOW_DEMO && (
          <section className="card demo">
            <h2>Contas de demonstração</h2>
            <p className="muted small">Dados fictícios. A senha de todas é <code>{DEMO_PASSWORD}</code>.</p>
            <div className="row">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  className="secondary"
                  disabled={login.isPending}
                  onClick={() => login.mutate({ email: account.email, password: DEMO_PASSWORD })}
                >
                  {account.label}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

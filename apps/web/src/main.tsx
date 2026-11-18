import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ApiError } from './api/http';
import { ClinicConfigProvider } from './auth/clinic-config';
import { SessionProvider, useSession } from './auth/session';
import './styles.css';

/** Any 401 from a query or mutation means the token is no longer valid: drop the session. */
function QueryProvider({ children }: { children: ReactNode }) {
  const { signOut } = useSession();
  const [client] = useState(() => {
    const dropSessionOn401 = (error: Error) => {
      if (error instanceof ApiError && error.status === 401) signOut();
    };
    return new QueryClient({
      queryCache: new QueryCache({ onError: dropSessionOn401 }),
      mutationCache: new MutationCache({ onError: dropSessionOn401 }),
      defaultOptions: {
        queries: {
          retry: (count, error) =>
            !(error instanceof ApiError && error.status < 500 && error.status !== 0) && count < 2,
          refetchOnWindowFocus: false,
        },
      },
    });
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

createRoot(root).render(
  <StrictMode>
    <SessionProvider>
      <QueryProvider>
        <ClinicConfigProvider>
          <App />
        </ClinicConfigProvider>
      </QueryProvider>
    </SessionProvider>
  </StrictMode>,
);

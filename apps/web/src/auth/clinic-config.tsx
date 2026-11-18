import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, type ReactNode } from 'react';
import { apiRequest } from '../api/http';
import type { ClinicConfig } from '../api/types';
import { messageFor } from '../lib/messages';

const ClinicConfigContext = createContext<ClinicConfig | null>(null);

/** Blocks rendering until the clinic timezone and hours are known: every date shown depends on them. */
export function ClinicConfigProvider({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: ['config'],
    queryFn: () => apiRequest<ClinicConfig>('/config'),
    staleTime: Infinity,
  });

  if (query.isPending) return <p className="muted center">Carregando…</p>;
  if (query.isError) return <p role="alert" className="error center">{messageFor(query.error)}</p>;
  return <ClinicConfigContext.Provider value={query.data}>{children}</ClinicConfigContext.Provider>;
}

export function useClinicConfig(): ClinicConfig {
  const config = useContext(ClinicConfigContext);
  if (!config) throw new Error('useClinicConfig must be used inside ClinicConfigProvider');
  return config;
}

const BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface ErrorEnvelope {
  error?: { code?: string; message?: string };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT';
  body?: object;
  token?: string | null;
  query?: Record<string, string | number | undefined>;
}

function buildUrl(path: string, query: RequestOptions['query']): string {
  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Não foi possível conectar ao servidor.');
  }

  if (!response.ok) {
    const envelope: ErrorEnvelope = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      envelope.error?.code ?? 'UNKNOWN',
      envelope.error?.message ?? 'Erro inesperado.',
    );
  }
  return response.json();
}

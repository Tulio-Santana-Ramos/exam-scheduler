import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '../api/http';
import type { LoginResponse } from '../api/types';
import { useSession } from '../auth/session';

export function useLogin() {
  const { signIn } = useSession();
  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      apiRequest<LoginResponse>('/auth/login', { method: 'POST', body: credentials }),
    onSuccess: (response) => signIn(response),
  });
}

import { useState } from 'react';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  tone: 'primary' | 'danger';
  onConfirm: () => void;
}

/** Holds the one pending confirmation; ConfirmDialog renders it. */
export function useConfirm() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  return { request, ask: setRequest, close: () => setRequest(null) };
}

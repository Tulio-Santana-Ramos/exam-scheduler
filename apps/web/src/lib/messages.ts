import { ApiError } from '../api/http';

const MESSAGES: Record<string, string> = {
  NETWORK: 'Não foi possível conectar ao servidor. Tente novamente.',
  INVALID_CREDENTIALS: 'E-mail ou senha inválidos.',
  UNAUTHENTICATED: 'Sua sessão expirou. Entre novamente.',
  RATE_LIMITED: 'Muitas tentativas. Aguarde um minuto e tente novamente.',
  FORBIDDEN: 'Você não tem permissão para essa ação.',
  INVALID_INPUT: 'Dados inválidos. Revise o formulário.',
  SLOT_UNAVAILABLE: 'Esse horário acabou de ser ocupado. Escolha outro.',
  SLOT_IN_PAST: 'Não é possível agendar no passado.',
  SLOT_MISALIGNED: 'Horário fora da grade de 30 minutos.',
  SLOT_OUTSIDE_OPENING_HOURS: 'Horário fora do funcionamento da clínica.',
  APPOINTMENT_IN_PAST: 'Agendamentos que já começaram não podem ser cancelados.',
  APPOINTMENT_ALREADY_CANCELLED: 'Este agendamento já está cancelado.',
  APPOINTMENT_HAS_PUBLISHED_REPORT: 'Agendamentos com laudo publicado não podem ser cancelados.',
  APPOINTMENT_CANCELLED: 'Agendamentos cancelados não podem receber laudos.',
  APPOINTMENT_NOT_FOUND: 'Agendamento não encontrado.',
  PATIENT_NOT_FOUND: 'Paciente não encontrado.',
  EXAM_TYPE_NOT_FOUND: 'Tipo de exame não encontrado.',
  REPORT_NOT_FOUND: 'Laudo não encontrado.',
  REPORT_ALREADY_PUBLISHED: 'Laudos publicados não podem ser editados.',
};

export function messageFor(error: Error | null): string | null {
  if (!error) return null;
  if (error instanceof ApiError) {
    if (error.code === 'INVALID_INPUT') return `${MESSAGES['INVALID_INPUT']} ${error.message}`;
    return MESSAGES[error.code] ?? error.message;
  }
  return 'Erro inesperado.';
}

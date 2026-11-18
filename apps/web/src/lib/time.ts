/** All instants arrive as UTC ISO strings and are always displayed in the clinic's timezone. */
export function formatDateTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone, timeStyle: 'short' }).format(new Date(iso));
}

/** A calendar day (YYYY-MM-DD) spelled out, such as "sexta-feira, 18 de novembro de 2026". */
export function formatDay(day: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));
}

/** Today's calendar day (YYYY-MM-DD) as seen on the clinic wall clock. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function utcOffsetLabel(timeZone: string, now: Date = new Date()): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
    .formatToParts(now)
    .find((p) => p.type === 'timeZoneName');
  return part?.value.replace('GMT', 'UTC') ?? '';
}

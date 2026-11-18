export const DEFAULT_LIST_LIMIT = 100;
export const MAX_LIST_LIMIT = 200;

export function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isInteger(limit) || limit < 1) return DEFAULT_LIST_LIMIT;
  return Math.min(limit, MAX_LIST_LIMIT);
}

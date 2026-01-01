const UNIT_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 24 * 60 * 60,
  w: 7 * 24 * 60 * 60,
};

export function parseDurationString(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  const match = /^(\d+)([smhdw])$/.exec(trimmed);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const unit = match[2];
  const seconds = amount * UNIT_SECONDS[unit];
  return seconds * 1000;
}

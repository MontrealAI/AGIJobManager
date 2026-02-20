const UNIT_TO_SECONDS = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
  w: 604800,
};

function parseDurationSeconds(value, label = 'duration') {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer.`);
    return value;
  }
  const raw = String(value).trim().toLowerCase();
  if (/^\d+$/.test(raw)) return Number(raw);
  const match = raw.match(/^(\d+)\s*([smhdw])$/);
  if (!match) throw new Error(`${label} must be seconds or use suffix s/m/h/d/w (received: ${value}).`);
  return Number(match[1]) * UNIT_TO_SECONDS[match[2]];
}

module.exports = {
  parseDurationSeconds,
};

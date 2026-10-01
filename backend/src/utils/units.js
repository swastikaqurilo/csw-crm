// backend/src/utils/units.js

const MASS_UNITS = ['Ton', 'Kg'];
const COUNT_UNITS = ['Box', 'Piece', 'Coil', 'Meter'];
const ALLOWED_UNITS = [...MASS_UNITS, ...COUNT_UNITS];

const isMassUnit = (u) => MASS_UNITS.includes(u);

/** Returns Kg, or null if the unit is not a mass unit. */
const toKg = (quantity, unit) => {
  const q = Number(quantity) || 0;
  if (unit === 'Ton') return q * 1000;
  if (unit === 'Kg') return q;
  return null;
};

const fromKg = (kg, unit) => {
  const k = Number(kg) || 0;
  if (unit === 'Ton') return k / 1000;
  if (unit === 'Kg') return k;
  return null;
};

/** Convert quantity between two units. Returns null if incompatible. */
const convert = (qty, from, to) => {
  if (from === to) return Number(qty) || 0;
  const kg = toKg(qty, from);
  if (kg == null) return null;
  return fromKg(kg, to);
};

module.exports = {
  MASS_UNITS,
  COUNT_UNITS,
  ALLOWED_UNITS,
  isMassUnit,
  toKg,
  fromKg,
  convert,
};
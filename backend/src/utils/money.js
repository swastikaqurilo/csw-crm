"use strict";

/**
 * Round a numeric value to 2 decimal places (paise / cents).
 *
 * Handles float edge cases correctly:
 *   roundMoney(1.005)  → 1.01   (Math.round(1.005 * 100) / 100 gives 1.00)
 *   roundMoney(2.675)  → 2.68   ((2.675).toFixed(2) gives "2.67")
 *   roundMoney(-1.005) → -1.01  (round-half-away-from-zero, accounting standard)
 *
 * Non-finite inputs (NaN, Infinity, null, undefined) return 0.
 *
 * @param {number|string} value
 * @returns {number}
 */
const roundMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;

  const scaled = n * 100;
  const nudge = Math.abs(scaled) * Number.EPSILON + Number.EPSILON;

  return Math.round(scaled + Math.sign(n) * nudge) / 100;
};

module.exports = { roundMoney };
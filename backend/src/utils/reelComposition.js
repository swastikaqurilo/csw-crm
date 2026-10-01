const REEL_COMPOSITION = {
  "2kg":  { spoolKg: 0.2, steelKg: 1.8 },
  "5kg":  { spoolKg: 0.6, steelKg: 4.4 },
  "8kg":  { spoolKg: 0.7, steelKg: 7.3 },
  "10kg": { spoolKg: 0.7, steelKg: 9.3 },
};

const computeConsumption = (qtys = {}) => {
  let steelNeeded = 0;
  const reelsBySize = {};   // ✅ keyed by "2kg" | "5kg" | "8kg" | "10kg"

  for (const size of ["2kg", "5kg", "8kg", "10kg"]) {
    const qty = Number(qtys[`qty${size}`]) || 0;
    if (qty <= 0) continue;
    const comp = REEL_COMPOSITION[size];
    steelNeeded += qty * comp.steelKg;
    reelsBySize[size] = (reelsBySize[size] || 0) + qty;
  }

  steelNeeded = Math.round(steelNeeded * 1000) / 1000;
  return { steelNeeded, reelsBySize };
};

module.exports = { REEL_COMPOSITION, computeConsumption };
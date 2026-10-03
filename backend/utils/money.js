/**
 * Rounds a number to 2 decimal places (avoids floating point artefacts
 * such as 0.1 + 0.2 = 0.30000000000000004).
 * Non-numeric input is returned unchanged so Mongoose validators can reject it.
 */
const round2 = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  return Math.round((number + Number.EPSILON) * 100) / 100;
};

module.exports = { round2 };
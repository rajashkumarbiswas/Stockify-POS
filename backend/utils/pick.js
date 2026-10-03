/** Returns a new object containing only the listed keys (protects against mass assignment). */
const pick = (source, keys) => {
  const result = {};
  if (!source) return result;
  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      result[key] = source[key];
    }
  });
  return result;
};

module.exports = pick;
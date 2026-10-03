/** Escapes regex special characters so user input is searched literally ("a.b*" is not a pattern). */
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Case-insensitive "contains" search across several fields.
 * buildSearchFilter('iphone', ['name', 'sku']) -> { $or: [{ name: /iphone/i }, { sku: /iphone/i }] }
 * Returns null when there is nothing to search for.
 */
const buildSearchFilter = (search, fields = []) => {
  const term = String(search ?? '').trim();
  if (!term || fields.length === 0) return null;

  const regex = new RegExp(escapeRegex(term), 'i');
  return { $or: fields.map((field) => ({ [field]: regex })) };
};

/** Combines filter fragments with $and and ignores empty ones. */
const combineFilters = (...filters) => {
  const active = filters.filter((f) => f && Object.keys(f).length > 0);
  if (active.length === 0) return {};
  if (active.length === 1) return active[0];
  return { $and: active };
};

module.exports = { escapeRegex, buildSearchFilter, combineFilters };
/**
 * Removes keys that start with "$" or contain "." from req.body, req.query and req.params.
 * This stops NoSQL operator injection such as { "email": { "$gt": "" } }.
 * (Joi validation on each route is the second layer of defence.)
 */
const sanitizeValue = (value) => {
  if (Array.isArray(value)) {
    value.forEach(sanitizeValue);
  } else if (value && typeof value === 'object') {
    Object.keys(value).forEach((key) => {
      if (key.startsWith('$') || key.includes('.')) {
        delete value[key];
      } else {
        sanitizeValue(value[key]);
      }
    });
  }
  return value;
};

const sanitize = (req, res, next) => {
  sanitizeValue(req.body);
  sanitizeValue(req.query);
  sanitizeValue(req.params);
  next();
};

module.exports = sanitize;
module.exports.sanitizeValue = sanitizeValue;
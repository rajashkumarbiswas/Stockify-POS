const ApiError = require('../utils/ApiError');

/**
 * validate(schema, 'body' | 'query' | 'params')
 * Replaces the request part with the validated + converted value.
 * Unknown fields are REJECTED (e.g. a client sending "role" in a profile update).
 */
const validate =
  (schema, source = 'body') =>
  (req, res, next) => {
    const { value, error } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: false,
      convert: true,
      errors: { wrap: { label: false } },
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));
      return next(ApiError.badRequest(errors[0].message, errors));
    }

    req[source] = value;
    return next();
  };

module.exports = validate;
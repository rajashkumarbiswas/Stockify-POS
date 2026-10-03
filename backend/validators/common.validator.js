const Joi = require('joi');
const { RANGE_NAMES } = require('../utils/dateRange');

/** 24-character hex MongoDB id */
const objectId = Joi.string()
  .hex()
  .length(24)
  .messages({
    'string.hex': '{{#label}} must be a valid id',
    'string.length': '{{#label}} must be a valid id',
  });

/** Route params: /something/:id */
const idParamSchema = Joi.object({
  id: objectId.required().label('id'),
});

/** Shared list-query keys: ?page=&limit=&search=&sortBy=&sortOrder= */
const paginationKeys = {
  page: Joi.number().integer().min(1).default(1).label('page'),
  limit: Joi.number().integer().min(1).max(100).default(20).label('limit'),
  search: Joi.string().trim().max(100).allow('').label('search'),
  sortBy: Joi.string().trim().max(40).label('sortBy'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc').label('sortOrder'),
};

const dateString = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .messages({ 'string.pattern.base': '{{#label}} must be in YYYY-MM-DD format' });

/** ?range=today|yesterday|this_week|this_month|custom&from=YYYY-MM-DD&to=YYYY-MM-DD */
const dateRangeKeys = {
  range: Joi.string().valid(...RANGE_NAMES).label('range'),
  from: dateString.when('range', { is: 'custom', then: Joi.required() }).label('from'),
  to: dateString.when('range', { is: 'custom', then: Joi.required() }).label('to'),
};

/**
 * Builds a query schema for a list endpoint:
 *   listQuerySchema({ category: objectId, status: Joi.string().valid('ACTIVE', 'INACTIVE') })
 */
const listQuerySchema = (extraKeys = {}) => Joi.object({ ...paginationKeys, ...extraKeys });

module.exports = {
  objectId,
  idParamSchema,
  paginationKeys,
  dateRangeKeys,
  listQuerySchema,
};
const Joi = require('joi');
const { MOVEMENT_TYPES, RECORD_STATUS, STOCK_STATUS } = require('../config/constants');
const { objectId, listQuerySchema, dateRangeKeys } = require('./common.validator');

// Only these three can be done by hand. SALE / PURCHASE / RETURN movements are created by their own modules.
const MANUAL_TYPES = [
  MOVEMENT_TYPES.MANUAL_INCREASE,
  MOVEMENT_TYPES.MANUAL_DECREASE,
  MOVEMENT_TYPES.ADJUSTMENT,
];

/**
 * quantity means:
 *   MANUAL_INCREASE / MANUAL_DECREASE -> how many units to add/remove (at least 1)
 *   ADJUSTMENT                        -> the COUNTED stock (0 or more); the server works out the difference
 */
const adjustStockSchema = Joi.object({
  productId: objectId.required().label('Product'),
  type: Joi.string()
    .valid(...MANUAL_TYPES)
    .required()
    .label('Type'),
  quantity: Joi.number()
    .integer()
    .max(10000000)
    .required()
    .label('Quantity')
    .when('type', {
      is: MOVEMENT_TYPES.ADJUSTMENT,
      then: Joi.number().min(0),
      otherwise: Joi.number().min(1),
    }),
  reason: Joi.string().trim().min(3).max(300).required().label('Reason'),
});

const stockListQuerySchema = listQuerySchema({
  category: objectId.label('category'),
  status: Joi.string()
    .valid(...Object.values(RECORD_STATUS))
    .label('status'),
  stockStatus: Joi.string()
    .valid(...Object.values(STOCK_STATUS))
    .label('stockStatus'),
});

const movementListQuerySchema = listQuerySchema({
  product: objectId.label('product'),
  type: Joi.string()
    .valid(...Object.values(MOVEMENT_TYPES))
    .label('type'),
  ...dateRangeKeys,
});

module.exports = { adjustStockSchema, stockListQuerySchema, movementListQuerySchema };
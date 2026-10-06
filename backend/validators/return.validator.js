const Joi = require('joi');
const { PAYMENT_METHODS } = require('../config/constants');
const { objectId, listQuerySchema, dateRangeKeys } = require('./common.validator');

/**
 * The client sends ONLY: which sale, which products and how many, how the money goes back,
 * and an optional reason. The refund amount is NOT accepted (unknown keys -> 400):
 * the server calculates it from the original sale.
 */
const itemSchema = Joi.object({
  productId: objectId.required().label('Product'),
  quantity: Joi.number().integer().min(1).max(1000000).required().label('Quantity'),
});

const createReturnSchema = Joi.object({
  saleId: objectId.required().label('Sale'),
  items: Joi.array().items(itemSchema).min(1).max(200).required().label('Items'),
  refundMethod: Joi.string()
    .valid(...Object.values(PAYMENT_METHODS))
    .label('Refund method'),
  reason: Joi.string().trim().max(300).allow('', null).label('Reason'),
});

const returnListQuerySchema = listQuerySchema({
  sale: objectId.label('sale'),
  ...dateRangeKeys,
});

module.exports = { createReturnSchema, returnListQuerySchema };
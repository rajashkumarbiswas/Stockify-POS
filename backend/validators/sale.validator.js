const Joi = require('joi');
const { PAYMENT_METHODS, SALE_STATUS, DISCOUNT_TYPES } = require('../config/constants');
const { objectId, listQuerySchema, dateRangeKeys } = require('./common.validator');

/**
 * The client sends ONLY: customer (optional), items (product + quantity), discount,
 * payment method and notes. Prices, line totals, tax, grand total, paid amount and
 * the cashier are NOT accepted (unknown keys -> 400): the server works them out.
 */
const itemSchema = Joi.object({
  productId: objectId.required().label('Product'),
  quantity: Joi.number().integer().min(1).max(1000000).required().label('Quantity'),
});

const createSaleSchema = Joi.object({
  customerId: objectId.allow('', null).label('Customer'),
  items: Joi.array().items(itemSchema).min(1).max(200).required().label('Items'),
  discount: Joi.object({
    type: Joi.string()
      .valid(...Object.values(DISCOUNT_TYPES))
      .default(DISCOUNT_TYPES.FIXED)
      .label('Discount type'),
    value: Joi.number().min(0).max(99999999).precision(2).required().label('Discount'),
  }).label('Discount'),
  paymentMethod: Joi.string()
    .valid(...Object.values(PAYMENT_METHODS))
    .required()
    .label('Payment method'),
  notes: Joi.string().trim().max(500).allow('', null).label('Notes'),
});

const saleListQuerySchema = listQuerySchema({
  customer: objectId.label('customer'),
  cashier: objectId.label('cashier'),
  paymentMethod: Joi.string()
    .valid(...Object.values(PAYMENT_METHODS))
    .label('paymentMethod'),
  status: Joi.string()
    .valid(...Object.values(SALE_STATUS))
    .label('status'),
  ...dateRangeKeys,
});

module.exports = { createSaleSchema, saleListQuerySchema };
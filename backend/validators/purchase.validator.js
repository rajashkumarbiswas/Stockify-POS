const Joi = require('joi');
const { PURCHASE_STATUS, PAYMENT_STATUS, PAYMENT_METHODS } = require('../config/constants');
const { objectId, listQuerySchema, dateRangeKeys } = require('./common.validator');

const money = (label) => Joi.number().min(0).max(99999999).precision(2).label(label);

/**
 * The client sends ONLY: product, quantity, unit price, discount, tax, payment and notes.
 * subtotal / lineTotal / grandTotal / stock are NOT accepted (unknown keys -> 400):
 * the server calculates them.
 */
const itemSchema = Joi.object({
  productId: objectId.required().label('Product'),
  quantity: Joi.number().integer().min(1).max(1000000).required().label('Quantity'),
  purchasePrice: money('Purchase price').required(),
});

const paymentFields = {
  amount: Joi.number().greater(0).max(99999999).precision(2).required().label('Amount'),
  method: Joi.string()
    .valid(...Object.values(PAYMENT_METHODS))
    .default(PAYMENT_METHODS.CASH)
    .label('Payment method'),
  note: Joi.string().trim().max(200).allow('', null).label('Note'),
};

const createPurchaseSchema = Joi.object({
  supplierId: objectId.required().label('Supplier'),
  purchaseDate: Joi.date().iso().label('Purchase date'),
  status: Joi.string()
    .valid(PURCHASE_STATUS.PENDING, PURCHASE_STATUS.RECEIVED)
    .default(PURCHASE_STATUS.RECEIVED)
    .label('Status'),
  items: Joi.array().items(itemSchema).min(1).max(200).required().label('Items'),
  discount: money('Discount').default(0),
  tax: money('Tax').default(0),
  payment: Joi.object(paymentFields).label('Payment'),
  notes: Joi.string().trim().max(500).allow('', null).label('Notes'),
});

const paymentBodySchema = Joi.object(paymentFields);

const purchaseListQuerySchema = listQuerySchema({
  supplier: objectId.label('supplier'),
  status: Joi.string()
    .valid(...Object.values(PURCHASE_STATUS))
    .label('status'),
  paymentStatus: Joi.string()
    .valid(...Object.values(PAYMENT_STATUS))
    .label('paymentStatus'),
  ...dateRangeKeys,
});

module.exports = { createPurchaseSchema, paymentBodySchema, purchaseListQuerySchema };
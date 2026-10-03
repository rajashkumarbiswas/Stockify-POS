const Joi = require('joi');
const { RECORD_STATUS, STOCK_STATUS, PRODUCT_UNITS } = require('../config/constants');
const { objectId, listQuerySchema } = require('./common.validator');

const money = (label) =>
  Joi.number().min(0).max(99999999).precision(2).label(label);

/**
 * NOTE: "currentStock" is intentionally NOT a field here. Joi rejects unknown keys,
 * so any request that tries to set stock directly fails with 400.
 * Stock changes only through the inventory / purchase / sale / return services.
 * (Only "openingStock" on CREATE is allowed, and it also goes through the inventory service.)
 */
const fields = {
  name: Joi.string().trim().min(2).max(150).label('Product name'),
  sku: Joi.string()
    .trim()
    .uppercase()
    .max(50)
    .pattern(/^[A-Z0-9][A-Z0-9._\-/]*$/)
    .label('SKU')
    .messages({
      'string.pattern.base': 'SKU may contain only letters, numbers and . _ - /',
    }),
  barcode: Joi.string()
    .trim()
    .max(50)
    .pattern(/^[A-Za-z0-9._-]+$/)
    .allow('', null)
    .label('Barcode')
    .messages({
      'string.pattern.base': 'Barcode may contain only letters, numbers and . _ -',
    }),
  category: objectId.label('Category'),
  brand: objectId.allow('', null).label('Brand'),
  purchasePrice: money('Purchase price'),
  sellingPrice: money('Selling price'),
  minStockLevel: Joi.number().integer().min(0).max(1000000).label('Minimum stock level'),
  unit: Joi.string()
    .valid(...PRODUCT_UNITS)
    .label('Unit'),
  image: Joi.string()
    .trim()
    .uri({ scheme: ['http', 'https'] })
    .max(500)
    .allow('', null)
    .label('Image URL'),
  description: Joi.string().trim().max(1000).allow('', null).label('Description'),
  status: Joi.string()
    .valid(...Object.values(RECORD_STATUS))
    .label('Status'),
};

const createProductSchema = Joi.object({
  ...fields,
  name: fields.name.required(),
  sku: fields.sku.required(),
  category: fields.category.required(),
  purchasePrice: fields.purchasePrice.required(),
  sellingPrice: fields.sellingPrice.required(),
  openingStock: Joi.number().integer().min(0).max(10000000).label('Opening stock'),
});

const updateProductSchema = Joi.object(fields)
  .min(1)
  .messages({ 'object.min': 'Provide at least one field to update' });

const statusBodySchema = Joi.object({
  status: fields.status.required(),
});

const productListQuerySchema = listQuerySchema({
  category: objectId.label('category'),
  brand: objectId.label('brand'),
  status: fields.status,
  stockStatus: Joi.string()
    .valid(...Object.values(STOCK_STATUS))
    .label('stockStatus'),
});

const lookupQuerySchema = Joi.object({
  code: Joi.string().trim().min(1).max(50).required().label('code'),
});

module.exports = {
  createProductSchema,
  updateProductSchema,
  statusBodySchema,
  productListQuerySchema,
  lookupQuerySchema,
};
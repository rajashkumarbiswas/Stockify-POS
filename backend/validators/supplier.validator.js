const Joi = require('joi');
const { RECORD_STATUS } = require('../config/constants');
const { listQuerySchema } = require('./common.validator');

/**
 * "dueAmount" and "totalPurchases" are intentionally NOT fields here:
 * they are calculated by the purchase service from real purchases and payments.
 * Joi rejects unknown keys, so sending them returns 400.
 */
const fields = {
  name: Joi.string().trim().min(2).max(100).label('Name'),
  company: Joi.string().trim().max(120).allow('', null).label('Company'),
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9+()\-\s]{6,20}$/)
    .allow('', null)
    .label('Phone')
    .messages({ 'string.pattern.base': 'Phone may contain only digits, spaces and + ( ) -' }),
  email: Joi.string()
    .trim()
    .lowercase()
    .max(254)
    .email({ tlds: { allow: false } })
    .allow('', null)
    .label('Email'),
  address: Joi.string().trim().max(300).allow('', null).label('Address'),
  status: Joi.string()
    .valid(...Object.values(RECORD_STATUS))
    .label('Status'),
};

const createSupplierSchema = Joi.object({
  ...fields,
  name: fields.name.required(),
});

const updateSupplierSchema = Joi.object(fields)
  .min(1)
  .messages({ 'object.min': 'Provide at least one field to update' });

const supplierListQuerySchema = listQuerySchema({ status: fields.status });

module.exports = { createSupplierSchema, updateSupplierSchema, supplierListQuerySchema };
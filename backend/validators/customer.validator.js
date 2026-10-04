const Joi = require('joi');
const { listQuerySchema } = require('./common.validator');

/**
 * totalPurchases / totalSpent / dueAmount are NOT fields here: Joi rejects unknown keys (400),
 * so the client can never set them. Only the sale service maintains them.
 */
const fields = {
  name: Joi.string().trim().min(2).max(100).label('Name'),
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9+\-\s()]{6,20}$/)
    .allow('', null)
    .label('Phone')
    .messages({ 'string.pattern.base': 'Phone may contain only digits, spaces and + - ( )' }),
  email: Joi.string().trim().email({ tlds: { allow: false } }).max(100).allow('', null).label('Email'),
  address: Joi.string().trim().max(300).allow('', null).label('Address'),
};

const createCustomerSchema = Joi.object({ ...fields, name: fields.name.required() });

const updateCustomerSchema = Joi.object(fields)
  .min(1)
  .messages({ 'object.min': 'Provide at least one field to update' });

const customerListQuerySchema = listQuerySchema({});

module.exports = { createCustomerSchema, updateCustomerSchema, customerListQuerySchema };
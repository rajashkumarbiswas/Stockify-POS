const Joi = require('joi');
const { RECORD_STATUS } = require('../config/constants');
const { listQuerySchema } = require('./common.validator');

// Shared by Categories and Brands (they have the same shape)
const name = Joi.string().trim().min(2).max(60).label('Name');
const description = Joi.string().trim().max(300).allow('').label('Description');
const status = Joi.string()
  .valid(...Object.values(RECORD_STATUS))
  .label('Status');

const createCatalogSchema = Joi.object({
  name: name.required(),
  description,
  status,
});

const updateCatalogSchema = Joi.object({ name, description, status })
  .min(1)
  .messages({ 'object.min': 'Provide at least one field to update' });

const catalogListQuerySchema = listQuerySchema({ status });

module.exports = { createCatalogSchema, updateCatalogSchema, catalogListQuerySchema };
const Joi = require('joi');

const text = (max, label) => Joi.string().trim().max(max).allow('', null).label(label);

/** Only these fields can be changed from the Settings page; unknown keys are rejected (400). */
const updateSettingsSchema = Joi.object({
  businessName: Joi.string().trim().min(2).max(120).label('Business name'),
  address: text(300, 'Address'),
  phone: text(30, 'Phone'),
  email: Joi.string().trim().email({ tlds: { allow: false } }).max(120).allow('', null).label('Email'),
  taxId: text(50, 'Tax ID'),
  taxRate: Joi.number().min(0).max(100).precision(2).label('Tax rate'),
  invoiceFooter: text(200, 'Invoice footer'),
})
  .min(1)
  .messages({ 'object.min': 'Provide at least one field to update' });

module.exports = { updateSettingsSchema };
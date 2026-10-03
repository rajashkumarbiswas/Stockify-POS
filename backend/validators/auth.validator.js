const Joi = require('joi');

const email = Joi.string()
  .trim()
  .lowercase()
  .max(254)
  .email({ tlds: { allow: false } })
  .label('Email');

const strongPassword = (label) =>
  Joi.string()
    .min(8)
    .max(72)
    .pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/)
    .label(label)
    .messages({
      'string.pattern.base': `${label} must contain at least one letter and one number`,
    });

const loginSchema = Joi.object({
  email: email.required(),
  password: Joi.string().max(72).required().label('Password'),
});

const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).label('Name'),
  email,
})
  .min(1)
  .messages({ 'object.min': 'Provide at least one field to update' });

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().max(72).required().label('Current password'),
  newPassword: strongPassword('New password')
    .required()
    .invalid(Joi.ref('currentPassword'))
    .messages({ 'any.invalid': 'New password must be different from the current password' }),
  confirmPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .label('Confirm password')
    .messages({ 'any.only': 'Passwords do not match' }),
});

module.exports = { loginSchema, updateProfileSchema, changePasswordSchema };
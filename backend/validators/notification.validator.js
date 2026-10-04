const Joi = require('joi');
const { NOTIFICATION_TYPES } = require('../config/constants');
const { listQuerySchema } = require('./common.validator');

const notificationListQuerySchema = listQuerySchema({
  unread: Joi.boolean().label('unread'),
  type: Joi.string()
    .valid(...Object.values(NOTIFICATION_TYPES))
    .label('type'),
});

module.exports = { notificationListQuerySchema };
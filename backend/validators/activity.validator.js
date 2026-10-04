const Joi = require('joi');
const { ENTITIES } = require('../config/constants');
const { objectId, listQuerySchema, dateRangeKeys } = require('./common.validator');

const activityListQuerySchema = listQuerySchema({
  entity: Joi.string()
    .valid(...Object.values(ENTITIES))
    .label('entity'),
  user: objectId.label('user'),
  ...dateRangeKeys,
});

module.exports = { activityListQuerySchema };
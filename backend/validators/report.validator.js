const Joi = require('joi');
const { dateRangeKeys } = require('./common.validator');

// ?range=today|yesterday|this_week|this_month|custom&from=YYYY-MM-DD&to=YYYY-MM-DD
const reportQuerySchema = Joi.object({ ...dateRangeKeys });

module.exports = { reportQuerySchema };
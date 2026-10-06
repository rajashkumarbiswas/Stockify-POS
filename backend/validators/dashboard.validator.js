const Joi = require('joi');

const salesChartQuerySchema = Joi.object({
  period: Joi.string().valid('daily', 'weekly', 'monthly').default('daily').label('period'),
});

module.exports = { salesChartQuerySchema };
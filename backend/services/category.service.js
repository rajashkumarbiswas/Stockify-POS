const { Category } = require('../models');
const createNamedEntityService = require('./namedEntity.service');
const { ENTITIES } = require('../config/constants');

module.exports = createNamedEntityService({
  Model: Category,
  label: 'Category',
  entity: ENTITIES.CATEGORY,
  productField: 'category',
});
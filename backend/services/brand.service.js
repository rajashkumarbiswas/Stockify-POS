const { Brand } = require('../models');
const createNamedEntityService = require('./namedEntity.service');
const { ENTITIES } = require('../config/constants');

module.exports = createNamedEntityService({
  Model: Brand,
  label: 'Brand',
  entity: ENTITIES.BRAND,
  productField: 'brand',
});
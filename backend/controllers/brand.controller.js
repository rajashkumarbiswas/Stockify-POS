const createNamedEntityController = require('./namedEntity.controller');
const brandService = require('../services/brand.service');

module.exports = createNamedEntityController(brandService, 'Brand');
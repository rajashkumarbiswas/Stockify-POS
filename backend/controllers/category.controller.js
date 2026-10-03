const createNamedEntityController = require('./namedEntity.controller');
const categoryService = require('../services/category.service');

module.exports = createNamedEntityController(categoryService, 'Category');
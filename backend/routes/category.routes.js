const createNamedEntityRouter = require('./namedEntity.router');
const controller = require('../controllers/category.controller');
const { PERMISSIONS: P } = require('../config/permissions');

module.exports = createNamedEntityRouter({
  controller,
  permissions: {
    read: P.CATEGORIES_READ,
    create: P.CATEGORIES_CREATE,
    update: P.CATEGORIES_UPDATE,
    delete: P.CATEGORIES_DELETE,
  },
});
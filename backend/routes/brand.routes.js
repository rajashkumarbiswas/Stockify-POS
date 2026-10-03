const createNamedEntityRouter = require('./namedEntity.router');
const controller = require('../controllers/brand.controller');
const { PERMISSIONS: P } = require('../config/permissions');

module.exports = createNamedEntityRouter({
  controller,
  permissions: {
    read: P.BRANDS_READ,
    create: P.BRANDS_CREATE,
    update: P.BRANDS_UPDATE,
    delete: P.BRANDS_DELETE,
  },
});
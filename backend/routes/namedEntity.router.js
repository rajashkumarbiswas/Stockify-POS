const express = require('express');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { idParamSchema } = require('../validators/common.validator');
const {
  createCatalogSchema,
  updateCatalogSchema,
  catalogListQuerySchema,
} = require('../validators/catalog.validator');

/**
 * Router for Category / Brand.
 * permissions = { read, create, update, delete } (permission strings from config/permissions.js)
 */
const createNamedEntityRouter = ({ controller, permissions }) => {
  const router = express.Router();

  router.use(protect);

  // "/options" must be declared before "/:id"
  router.get('/options', authorize(permissions.read), controller.options);
  router.get('/', authorize(permissions.read), validate(catalogListQuerySchema, 'query'), controller.list);
  router.post('/', authorize(permissions.create), validate(createCatalogSchema), controller.create);

  router.get('/:id', authorize(permissions.read), validate(idParamSchema, 'params'), controller.getById);
  router.patch(
    '/:id',
    authorize(permissions.update),
    validate(idParamSchema, 'params'),
    validate(updateCatalogSchema),
    controller.update
  );
  router.delete(
    '/:id',
    authorize(permissions.delete),
    validate(idParamSchema, 'params'),
    controller.remove
  );

  return router;
};

module.exports = createNamedEntityRouter;
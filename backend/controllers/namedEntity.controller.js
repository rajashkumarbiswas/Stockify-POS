const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated, sendPaginated } = require('../utils/apiResponse');

/** Builds the controller for Category / Brand from their service. */
const createNamedEntityController = (service, label) => ({
  list: asyncHandler(async (req, res) => {
    const { items, pagination } = await service.list(req.query);
    sendPaginated(res, { items, pagination });
  }),

  options: asyncHandler(async (req, res) => {
    sendSuccess(res, { data: await service.options() });
  }),

  getById: asyncHandler(async (req, res) => {
    sendSuccess(res, { data: await service.getById(req.params.id) });
  }),

  create: asyncHandler(async (req, res) => {
    const data = await service.create(req.body, req.user);
    sendCreated(res, { data, message: `${label} created` });
  }),

  update: asyncHandler(async (req, res) => {
    const data = await service.update(req.params.id, req.body, req.user);
    sendSuccess(res, { data, message: `${label} updated` });
  }),

  remove: asyncHandler(async (req, res) => {
    await service.remove(req.params.id, req.user);
    sendSuccess(res, { message: `${label} deleted` });
  }),
});

module.exports = createNamedEntityController;
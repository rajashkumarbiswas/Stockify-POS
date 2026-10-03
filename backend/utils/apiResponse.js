/**
 * Consistent success response:
 * { success: true, message, data, meta? }
 */
const sendSuccess = (
  res,
  { data = null, message = 'Success', statusCode = 200, meta } = {}
) => {
  const body = { success: true, message, data };
  if (meta !== undefined) body.meta = meta;
  return res.status(statusCode).json(body);
};

/** 201 Created */
const sendCreated = (res, options = {}) => sendSuccess(res, { message: 'Created', ...options, statusCode: 201 });

/**
 * List response with pagination metadata:
 * { success, message, data: [ ...items ], meta: { pagination: { currentPage, totalPages, ... } } }
 */
const sendPaginated = (res, { items, pagination, message = 'Success' }) =>
  sendSuccess(res, { data: items, message, meta: { pagination } });

module.exports = { sendSuccess, sendCreated, sendPaginated };
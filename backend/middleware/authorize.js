const ApiError = require('../utils/ApiError');
const { getPermissions } = require('../config/permissions');

/**
 * authorize('products:create')            -> user needs that permission
 * authorize('products:read', 'x:y')       -> user needs ALL listed permissions
 * Must run after protect().
 */
const authorize =
  (...required) =>
  (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());

    const granted = getPermissions(req.user.role);
    const allowed = required.every((permission) => granted.includes(permission));

    return allowed ? next() : next(ApiError.forbidden());
  };

/** authorizeAny('sales:read_all', 'sales:read_own') -> at least ONE permission is enough */
const authorizeAny =
  (...options) =>
  (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());

    const granted = getPermissions(req.user.role);
    const allowed = options.some((permission) => granted.includes(permission));

    return allowed ? next() : next(ApiError.forbidden());
  };

module.exports = { authorize, authorizeAny };
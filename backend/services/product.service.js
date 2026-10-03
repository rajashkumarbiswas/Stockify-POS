const { Product, Category, Brand, Sale, Purchase, StockMovement } = require('../models');
const ApiError = require('../utils/ApiError');
const pick = require('../utils/pick');
const { paginate } = require('../utils/paginate');
const { buildSearchFilter, combineFilters } = require('../utils/search');
const { buildStockStatusFilter } = require('../utils/stock');
const { withTransaction } = require('../utils/transaction');
const activityService = require('./activity.service');
const inventoryService = require('./inventory.service');
const { hasPermission, PERMISSIONS } = require('../config/permissions');
const { ENTITIES, RECORD_STATUS, MOVEMENT_TYPES } = require('../config/constants');

const POPULATE = [
  { path: 'category', select: 'name' },
  { path: 'brand', select: 'name' },
];

// currentStock is deliberately missing: it can never be set through this service
const EDITABLE_FIELDS = [
  'name',
  'sku',
  'barcode',
  'category',
  'brand',
  'purchasePrice',
  'sellingPrice',
  'minStockLevel',
  'unit',
  'image',
  'description',
  'status',
];
const OPTIONAL_FIELDS = ['barcode', 'brand', 'image', 'description'];

const SORT_FIELDS = ['name', 'sku', 'sellingPrice', 'currentStock', 'createdAt', 'updatedAt'];
const COLLATION = { locale: 'en', strength: 2 };

const canViewCost = (user) => hasPermission(user.role, PERMISSIONS.PRODUCTS_VIEW_COST);
const canManage = (user) => hasPermission(user.role, PERMISSIONS.PRODUCTS_UPDATE);

/** Sales staff only ever see ACTIVE products. */
const visibilityFilter = (user) => (canManage(user) ? null : { status: RECORD_STATUS.ACTIVE });

/** The cost price is removed from the response for users without the permission. */
const toDto = (doc, user) => {
  const dto = doc.toJSON();
  if (!canViewCost(user)) delete dto.purchasePrice;
  return dto;
};

/** '' and null mean "clear this optional field". Returns explicit undefined so Mongoose unsets it. */
const buildChanges = (data) => {
  const changes = pick(data, EDITABLE_FIELDS);
  OPTIONAL_FIELDS.forEach((key) => {
    if (key in changes && (changes[key] === '' || changes[key] === null)) {
      changes[key] = undefined;
    }
  });
  return changes;
};

const assertReference = async (Model, id, label) => {
  const doc = await Model.findById(id).select('status');
  if (!doc) {
    throw ApiError.badRequest(`${label} not found`, [
      { field: label.toLowerCase(), message: `${label} not found` },
    ]);
  }
  if (doc.status !== RECORD_STATUS.ACTIVE) {
    throw ApiError.badRequest(`${label} is inactive. Choose an active ${label.toLowerCase()}.`, [
      { field: label.toLowerCase(), message: `${label} is inactive` },
    ]);
  }
};

const translateDuplicate = (error) => {
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || error.keyValue || {})[0];
    const value = error.keyValue ? error.keyValue[field] : '';
    if (field === 'sku') {
      return ApiError.conflict(`SKU "${value}" is already used by another product`, [
        { field: 'sku', message: 'This SKU is already in use' },
      ]);
    }
    if (field === 'barcode') {
      return ApiError.conflict(`Barcode "${value}" is already used by another product`, [
        { field: 'barcode', message: 'This barcode is already in use' },
      ]);
    }
  }
  return error;
};

const findVisibleOrFail = async (id, user) => {
  const product = await Product.findOne({ _id: id, ...visibilityFilter(user) }).populate(POPULATE);
  if (!product) throw ApiError.notFound('Product not found');
  return product;
};

const list = async (query, user) => {
  const filter = combineFilters(
    buildSearchFilter(query.search, ['name', 'sku', 'barcode']),
    query.category ? { category: query.category } : null,
    query.brand ? { brand: query.brand } : null,
    query.status && canManage(user) ? { status: query.status } : null,
    buildStockStatusFilter(query.stockStatus),
    visibilityFilter(user)
  );

  const allowedSort = canViewCost(user) ? [...SORT_FIELDS, 'purchasePrice'] : SORT_FIELDS;

  const { items, pagination } = await paginate(Product, filter, {
    query,
    allowedSort,
    defaultSort: { name: 1 },
    populate: POPULATE,
    collation: COLLATION,
  });

  return { items: items.map((doc) => toDto(doc, user)), pagination };
};

/** Exact SKU or barcode match, used by the POS scanner / quick search. */
const lookup = async (code, user) => {
  const term = String(code).trim();
  const product = await Product.findOne({
    $or: [{ sku: term.toUpperCase() }, { barcode: term }],
    ...visibilityFilter(user),
  }).populate(POPULATE);

  if (!product) throw ApiError.notFound('No product found for this SKU or barcode');
  return toDto(product, user);
};

const getById = async (id, user) => toDto(await findVisibleOrFail(id, user), user);

const create = async (data, user) => {
  const openingStock = data.openingStock || 0;
  if (openingStock > 0 && !hasPermission(user.role, PERMISSIONS.INVENTORY_ADJUST)) {
    throw ApiError.forbidden('You do not have permission to set opening stock');
  }

  await assertReference(Category, data.category, 'Category');
  if (data.brand) await assertReference(Brand, data.brand, 'Brand');

  let created;
  try {
    // Product + opening stock movement are saved together or not at all
    created = await withTransaction(async (session) => {
      const [product] = await Product.create([buildChanges(data)], { session }); // starts at 0 stock

      if (openingStock > 0) {
        await inventoryService.adjustStock(
          {
            productId: product._id,
            type: MOVEMENT_TYPES.MANUAL_INCREASE,
            quantity: openingStock,
            reason: 'Opening stock',
            user,
          },
          session
        );
      }
      return product;
    });
  } catch (error) {
    throw translateDuplicate(error);
  }

  await activityService.log({
    user: user._id,
    action: 'PRODUCT_CREATED',
    entity: ENTITIES.PRODUCT,
    entityId: created._id,
    description:
      `${user.name} created product "${created.name}" (${created.sku})` +
      (openingStock > 0 ? ` with opening stock ${openingStock}` : ''),
  });

  // Reload so the response shows the real stock written by the inventory service
  const product = await Product.findById(created._id).populate(POPULATE);
  return toDto(product, user);
};

const update = async (id, data, user) => {
  const product = await Product.findById(id);
  if (!product) throw ApiError.notFound('Product not found');

  if (data.category && String(data.category) !== String(product.category)) {
    await assertReference(Category, data.category, 'Category');
  }
  if (data.brand && String(data.brand) !== String(product.brand)) {
    await assertReference(Brand, data.brand, 'Brand');
  }

  const before = {
    purchasePrice: product.purchasePrice,
    sellingPrice: product.sellingPrice,
    status: product.status,
  };

  product.set(buildChanges(data));

  try {
    await product.save();
  } catch (error) {
    throw translateDuplicate(error);
  }

  await activityService.log({
    user: user._id,
    action: 'PRODUCT_UPDATED',
    entity: ENTITIES.PRODUCT,
    entityId: product._id,
    description: `${user.name} updated product "${product.name}"`,
  });

  const priceChanges = [];
  if (product.purchasePrice !== before.purchasePrice) {
    priceChanges.push(`cost ${before.purchasePrice} -> ${product.purchasePrice}`);
  }
  if (product.sellingPrice !== before.sellingPrice) {
    priceChanges.push(`selling ${before.sellingPrice} -> ${product.sellingPrice}`);
  }
  if (priceChanges.length > 0) {
    await activityService.log({
      user: user._id,
      action: 'PRODUCT_PRICE_CHANGED',
      entity: ENTITIES.PRODUCT,
      entityId: product._id,
      description: `${user.name} changed price of "${product.name}": ${priceChanges.join(', ')}`,
      metadata: {
        before: { purchasePrice: before.purchasePrice, sellingPrice: before.sellingPrice },
        after: { purchasePrice: product.purchasePrice, sellingPrice: product.sellingPrice },
      },
    });
  }

  if (product.status !== before.status) {
    await activityService.log({
      user: user._id,
      action: 'PRODUCT_STATUS_CHANGED',
      entity: ENTITIES.PRODUCT,
      entityId: product._id,
      description: `${user.name} set product "${product.name}" to ${product.status}`,
    });
  }

  await product.populate(POPULATE);
  return toDto(product, user);
};

const setStatus = (id, status, user) => update(id, { status }, user);

const remove = async (id, user) => {
  const product = await Product.findById(id);
  if (!product) throw ApiError.notFound('Product not found');

  const [sold, purchased, moved] = await Promise.all([
    Sale.exists({ 'items.product': product._id }),
    Purchase.exists({ 'items.product': product._id }),
    StockMovement.exists({ product: product._id }),
  ]);

  if (sold || purchased || moved) {
    throw ApiError.conflict(
      'This product has sales, purchase or stock history and cannot be deleted. ' +
        'Set it to inactive instead to hide it from the POS.'
    );
  }

  await product.deleteOne();

  await activityService.log({
    user: user._id,
    action: 'PRODUCT_DELETED',
    entity: ENTITIES.PRODUCT,
    entityId: product._id,
    description: `${user.name} deleted product "${product.name}" (${product.sku})`,
  });
};

module.exports = { list, lookup, getById, create, update, setStatus, remove };
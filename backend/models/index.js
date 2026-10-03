// Central export so services can write: const { Product, Sale } = require('../models');
module.exports = {
  User: require('./User'),
  Category: require('./Category'),
  Brand: require('./Brand'),
  Product: require('./Product'),
  Customer: require('./Customer'),
  Supplier: require('./Supplier'),
  Sale: require('./Sale'),
  Purchase: require('./Purchase'),
  Return: require('./Return'),
  StockMovement: require('./StockMovement'),
  Notification: require('./Notification'),
  Activity: require('./Activity'),
  Counter: require('./Counter'),
  Setting: require('./Setting'),
};
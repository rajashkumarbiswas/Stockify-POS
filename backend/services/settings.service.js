const { Setting } = require('../models');
const activityService = require('./activity.service');
const { ENTITIES } = require('../config/constants');

const get = async () => {
  const setting = await Setting.getSingleton();
  return setting.toJSON();
};

const update = async (data, user) => {
  const changes = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value === null ? '' : value]));

  const setting = await Setting.getSingleton();
  const changedKeys = Object.keys(changes).filter((key) => String(setting[key] ?? '') !== String(changes[key]));

  setting.set(changes);
  await setting.save();

  if (changedKeys.length > 0) {
    await activityService.log({
      user: user._id,
      action: 'SETTINGS_UPDATED',
      entity: ENTITIES.SETTINGS,
      entityId: setting._id,
      description: `${user.name} updated business settings (${changedKeys.join(', ')})`,
    });
  }

  return setting.toJSON();
};

module.exports = { get, update };
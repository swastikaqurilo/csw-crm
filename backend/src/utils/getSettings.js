const Settings = require('../models/Settings');

let cache = null;
let cacheTime = 0;
const TTL = 60 * 1000; // 1 minute

const getGlobalSettings = async (force = false) => {
  if (!force && cache && Date.now() - cacheTime < TTL) return cache;
  cache = await Settings.findOne({ key: 'global' }).lean();
  cacheTime = Date.now();
  return cache;
};

const invalidateSettingsCache = () => {
  cache = null;
  cacheTime = 0;
};

module.exports = { getGlobalSettings, invalidateSettingsCache };
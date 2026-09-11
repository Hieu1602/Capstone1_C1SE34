const { getDefaultConfig } = require('expo/metro-config');
const { FileStore } = require('metro-cache');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.cacheStores = [
  new FileStore({
    root: path.join('D:', 'tmp', 'metro-cache'),
  }),
];

module.exports = config;

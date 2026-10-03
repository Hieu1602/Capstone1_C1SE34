const { getDefaultConfig } = require('expo/metro-config');
const { FileStore } = require('metro-cache');
const path = require('path');
const { load } = require('@expo/env');

// Nạp file .env duy nhất từ thư mục gốc smart-elderly-care-ai
try {
  load(path.resolve(__dirname, '..'));
} catch (e) {
  // Bỏ qua nếu môi trường không cần
}

const config = getDefaultConfig(__dirname);

config.cacheStores = [
  new FileStore({
    root: path.join('D:', 'tmp', 'metro-cache'),
  }),
];

module.exports = config;

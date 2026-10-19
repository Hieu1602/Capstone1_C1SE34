const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const { load } = require('@expo/env');

// Nạp file .env duy nhất từ thư mục gốc smart-elderly-care-ai
try {
  load(path.resolve(__dirname, '..'));
} catch (e) {
  // Bỏ qua nếu môi trường không cần
}

const config = getDefaultConfig(__dirname);

module.exports = config;

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

// Mock native-only packages on web so Metro can bundle cleanly without runtime crashes
const emptyMockPath = path.resolve(__dirname, 'src/services/emptyMock.js');
const nativeOnlyModules = [
  'react-native-ble-plx',
  'react-native-health',
  '@mbdayo/react-native-health-kits',
];

const originalResolveRequest = config.resolver?.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && nativeOnlyModules.includes(moduleName)) {
    return {
      filePath: emptyMockPath,
      type: 'sourceFile',
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

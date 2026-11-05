// Empty mock for native-only modules when bundling on Web
class MockBleManager {
  startDeviceScan() {}
  stopDeviceScan() {}
  destroy() {}
}

module.exports = {
  BleManager: MockBleManager,
  initHealthKit: (_opts, cb) => cb && cb(null),
  isAvailable: (_opts, cb) => cb && cb(null, false),
  default: {
    BleManager: MockBleManager,
  },
};


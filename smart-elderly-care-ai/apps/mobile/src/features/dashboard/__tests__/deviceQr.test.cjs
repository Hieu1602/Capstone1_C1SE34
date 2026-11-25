const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = ts.transpileModule(
  readFileSync(join(__dirname, '../utils/deviceQr.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } }
).outputText;
const moduleExports = {};
vm.runInNewContext(source, { exports: moduleExports });

test('parses supported camera and smartband QR identifiers', () => {
  const cam = moduleExports.parseDeviceQr(' seca_001 ');
  assert.equal(cam.deviceId, 'SECA_001');
  assert.equal(cam.type, 'camera');

  const watch = moduleExports.parseDeviceQr('BLE_BAND_01');
  assert.equal(watch.deviceId, 'BLE_BAND_01');
  assert.equal(watch.type, 'watch');
});

test('parses the Tapo S/N Code 128 barcode but not the MAC barcode', () => {
  const tapo = moduleExports.parseDeviceQr('22550A3009164', 'code128');
  assert.equal(tapo.deviceId, 'CAM_SN_22550A3009164');
  assert.equal(tapo.type, 'camera');
  assert.equal(tapo.sn, '22550A3009164');
  assert.equal(moduleExports.parseDeviceQr('0CEF151580C5', 'code128'), null);
});

test('rejects unrelated, unsafe and oversized QR contents', () => {
  assert.equal(moduleExports.parseDeviceQr('https://example.com'), null);
  assert.equal(moduleExports.parseDeviceQr('UNKNOWN_001'), null);
  assert.equal(moduleExports.parseDeviceQr(`SECA_${'A'.repeat(96)}`), null);
});

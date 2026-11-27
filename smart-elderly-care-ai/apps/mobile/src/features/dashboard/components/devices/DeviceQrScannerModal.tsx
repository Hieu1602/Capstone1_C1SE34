import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Linking,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedAlert, LocalizedText } from '../../../../i18n/LocalizedComponents';
import { parseDeviceQr, ScannedDevice } from '../../utils/deviceQr';

// Dynamic safe load expo-camera to prevent bundler crash when module is uninstalled or on web
let CameraView: any = View;
let useCameraPermissions: any = () => [null, () => { }];
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cam = require('expo-camera');
  if (cam) {
    CameraView = cam.CameraView || View;
    useCameraPermissions = cam.useCameraPermissions || (() => [null, () => { }]);
  }
} catch {
  // expo-camera not available
}

type BarcodeScanningResult = {
  data: string;
  type: string;
  bounds?: {
    origin: { x: number; y: number };
    size: { width: number; height: number };
  };
  cornerPoints?: Array<{ x: number; y: number }>;
};

interface DeviceQrScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (type: 'camera' | 'watch', deviceId: string, metadata?: ScannedDevice) => void;
}

export const DeviceQrScannerModal: React.FC<DeviceQrScannerModalProps> = ({
  visible,
  onClose,
  onScan,
}) => {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'ios' ? 48 : (StatusBar.currentHeight || 20));
  const bottomInset = Math.max(insets.bottom, 20);

  const [isFlashOn, setIsFlashOn] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const laserAnim = useRef(new Animated.Value(0)).current;
  const viewfinderRef = useRef<any>(null);
  const [viewfinderLayout, setViewfinderLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const onMeasureViewfinder = () => {
    requestAnimationFrame(() => {
      viewfinderRef.current?.measureInWindow?.((x: number, y: number, width: number, height: number) => {
        if (width > 0 && height > 0) {
          setViewfinderLayout({ x, y, width, height });
        }
      });
    });
  };

  useEffect(() => {
    if (visible) {
      setScanned(false);
      setManualCode('');
      setManualError('');
      setShowManual(false);
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: 106,
            duration: 1600,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(laserAnim, {
            toValue: 0,
            duration: 1600,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      setIsFlashOn(false);
      laserAnim.setValue(0);
    }
  }, [laserAnim, visible]);

  useEffect(() => {
    if (visible && (!permission || (!permission.granted && permission.canAskAgain))) {
      requestPermission();
    }
  }, [visible, permission]);

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    const { data, type, bounds, cornerPoints } = result;

    if (viewfinderLayout) {
      let barcodeCenterX: number | null = null;
      let barcodeCenterY: number | null = null;

      if (bounds?.size?.width && bounds?.size?.height) {
        barcodeCenterX = bounds.origin.x + bounds.size.width / 2;
        barcodeCenterY = bounds.origin.y + bounds.size.height / 2;
      } else if (cornerPoints && cornerPoints.length > 0) {
        const sumX = cornerPoints.reduce((acc: number, pt: { x: number; y: number }) => acc + pt.x, 0);
        const sumY = cornerPoints.reduce((acc: number, pt: { x: number; y: number }) => acc + pt.y, 0);
        barcodeCenterX = sumX / cornerPoints.length;
        barcodeCenterY = sumY / cornerPoints.length;
      }

      if (barcodeCenterX !== null && barcodeCenterY !== null) {
        const toleranceX = 35;
        const toleranceY = 25;
        const minX = viewfinderLayout.x - toleranceX;
        const maxX = viewfinderLayout.x + viewfinderLayout.width + toleranceX;
        const minY = viewfinderLayout.y - toleranceY;
        const maxY = viewfinderLayout.y + viewfinderLayout.height + toleranceY;

        if (
          barcodeCenterX < minX ||
          barcodeCenterX > maxX ||
          barcodeCenterY < minY ||
          barcodeCenterY > maxY
        ) {
          return;
        }
      }
    }

    const device = parseDeviceQr(data, type);
    if (!device) {
      // Bỏ qua mã MAC hoặc mã không khớp để camera tiếp tục quét liên tục, không bật alert gây phiền
      return;
    }

    setScanned(true);
    onScan(device.type, device.deviceId, device);
  };

  const handleManualSubmit = () => {
    const trimmed = manualCode.trim();
    if (!trimmed) {
      const msg = 'Vui lòng nhập mã vạch S/N ở đáy camera.';
      setManualError(msg);
      Alert.alert('Chưa nhập mã camera', msg);
      return;
    }

    const clean = trimmed.toUpperCase().replace(/^(S\/N|SN|MAC)[:\s-]+/, '').replace(/[:-]/g, '');
    if (/^[0-9A-F]{12}$/.test(clean)) {
      const msg = 'Đây là mã MAC. Vui lòng nhập mã vạch S/N (Serial Number) ở đáy camera.';
      setManualError(msg);
      Alert.alert('Vui lòng dùng mã S/N', msg);
      return;
    }

    const device = parseDeviceQr(trimmed);
    if (device) {
      setManualError('');
      onScan(device.type, device.deviceId, device);
      onClose();
      return;
    }

    const errorMsg = 'Hãy kiểm tra lại mã S/N ở đáy camera (VD: 22550A3009164).';
    setManualError(errorMsg);
    Alert.alert('Mã camera không hợp lệ', errorMsg);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.qrModalContainer}>
        {permission?.granted && (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={isFlashOn}
            barcodeScannerSettings={{
              barcodeTypes: [
                'qr',
                'code128',
                'code39',
                'code93',
                'ean13',
                'ean8',
                'upc_a',
                'upc_e',
                'itf14',
                'codabar',
                'datamatrix',
              ],
            }}
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          />
        )}

        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header Scanner an toàn dưới tai thỏ */}
          <View style={[styles.qrHeader, { paddingTop: topInset + 8 }]}>
            <TouchableOpacity
              style={styles.qrCloseBtn}
              onPress={onClose}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <LocalizedText style={styles.qrHeaderTitle}>Quét mã vạch camera</LocalizedText>
            <TouchableOpacity
              style={styles.qrFlashBtn}
              onPress={() => setIsFlashOn(!isFlashOn)}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons
                name={isFlashOn ? 'flash' : 'flash-off'}
                size={20}
                color={isFlashOn ? '#FBBF24' : '#FFF'}
              />
            </TouchableOpacity>
          </View>

          {/* Mask Top */}
          <View style={styles.maskTop} />

          {/* Middle Row with Cutout */}
          <View style={styles.middleRow}>
            <View style={styles.maskSide} />
            <View
              ref={viewfinderRef}
              style={styles.qrViewfinder}
              onLayout={onMeasureViewfinder}
            >
              {!permission?.granted && (
                <View style={styles.permissionMessage}>
                  <Ionicons name="camera-outline" size={38} color="#94A3B8" />
                  <LocalizedText style={styles.permissionText}>
                    Cần quyền camera để quét mã thiết bị
                  </LocalizedText>
                  {permission && (
                    <TouchableOpacity
                      style={styles.permissionButton}
                      onPress={permission.canAskAgain ? requestPermission : Linking.openSettings}
                    >
                      <LocalizedText style={styles.permissionButtonText}>
                        {permission.canAskAgain ? 'Cho phép camera' : 'Mở cài đặt'}
                      </LocalizedText>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* 4 Góc khung quét */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />

              {/* Tia laser chạy lên xuống */}
              <Animated.View
                style={[
                  styles.qrLaserLine,
                  {
                    transform: [{ translateY: laserAnim }],
                  },
                ]}
              />
            </View>
            <View style={styles.maskSide} />
          </View>

          {/* Mask Bottom */}
          <View style={[styles.maskBottom, { paddingBottom: bottomInset + 12 }]}>
            <LocalizedText style={styles.qrGuideText}>
              Căn chỉnh mã vạch{' '}
              <LocalizedText style={{ fontWeight: 'bold', color: '#38BDF8' }}>S/N (Serial Number) ở đáy Camera</LocalizedText> vào khung.
            </LocalizedText>

            {/* Nhập mã thủ công */}
            <TouchableOpacity
              style={styles.toggleManualBtn}
              onPress={() => setShowManual(!showManual)}
              activeOpacity={0.8}
            >
              <Ionicons name={showManual ? 'chevron-up' : 'keypad-outline'} size={16} color="#38BDF8" style={{ marginRight: 6 }} />
              <LocalizedText style={styles.toggleManualText}>
                {showManual ? 'Ẩn nhập thủ công' : 'Hoặc nhập mã thủ công'}
              </LocalizedText>
            </TouchableOpacity>

            {showManual && (
              <View style={styles.manualContainer}>
                <View style={styles.manualInputRow}>
                  <TextInput
                    value={manualCode}
                    onChangeText={(text) => {
                      setManualCode(text);
                      if (manualError) setManualError('');
                    }}
                    placeholder="VD: 22550A3009164 (Mã S/N)..."
                    placeholderTextColor="#94A3B8"
                    style={[styles.input, manualError ? styles.inputError : null]}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={handleManualSubmit} style={styles.submitBtn} activeOpacity={0.8}>
                    <LocalizedText style={styles.submitBtnText}>Xác nhận</LocalizedText>
                  </TouchableOpacity>
                </View>
                {manualError ? (
                  <LocalizedText style={styles.manualErrorText}>{manualError}</LocalizedText>
                ) : null}
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  qrModalContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  qrModalSafeArea: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  qrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
  },
  qrCloseBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrHeaderTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  qrFlashBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  maskTop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  middleRow: {
    flexDirection: 'row',
    height: 110,
    alignItems: 'center',
  },
  maskSide: {
    flex: 1,
    height: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  qrViewfinder: {
    width: 280,
    height: 110,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: '#38BDF8',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  qrLaserLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 3,
    backgroundColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  maskBottom: {
    flex: 1.5,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    paddingTop: 18,
    paddingHorizontal: 20,
  },
  permissionMessage: {
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  permissionText: {
    color: '#CBD5E1',
    fontSize: 12,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: '#0284C7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  permissionButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  qrGuideText: {
    color: '#CBD5E1',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  toggleManualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  toggleManualText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#38BDF8',
  },
  manualContainer: {
    width: '100%',
    marginTop: 12,
  },
  manualInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#F8FAFC',
  },
  submitBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  manualErrorText: {
    color: '#F87171',
    fontSize: 12,
    marginTop: 6,
    paddingHorizontal: 4,
  },
});

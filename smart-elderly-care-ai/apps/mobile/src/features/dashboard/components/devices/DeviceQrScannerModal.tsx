import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Animated, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedAlert, LocalizedText } from '../../../../i18n/LocalizedComponents';
import { parseDeviceQr, ScannedDevice } from '../../utils/deviceQr';

// Dynamic safe load expo-camera to prevent bundler crash when module is uninstalled or on web
let CameraView: any = View;
let useCameraPermissions: any = () => [null, () => {}];
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cam = require('expo-camera');
  if (cam) {
    CameraView = cam.CameraView || View;
    useCameraPermissions = cam.useCameraPermissions || (() => [null, () => {}]);
  }
} catch {
  // expo-camera not available
}

type BarcodeScanningResult = { data: string; type: string };

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
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const laserAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setScanned(false);
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: 180,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(laserAnim, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
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

  const handleBarcodeScanned = ({ data, type }: BarcodeScanningResult) => {
    setScanned(true);
    const device = parseDeviceQr(data, type);
    if (device) {
      onScan(device.type, device.deviceId, device);
      return;
    }

    LocalizedAlert.alert(
      'Mã thiết bị không hợp lệ',
      'Hãy quét mã vạch S/N hoặc MAC trên tem đáy Tapo hoặc mã QR thiết bị.',
      [{ text: 'Quét lại', onPress: () => setScanned(false) }]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
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

        <SafeAreaView style={styles.qrModalSafeArea}>
          {/* Header Scanner */}
          <View style={styles.qrHeader}>
            <TouchableOpacity
              style={styles.qrCloseBtn}
              onPress={onClose}
            >
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <LocalizedText style={styles.qrHeaderTitle}>Quét Mã Vạch / QR Thiết Bị</LocalizedText>
            <TouchableOpacity
              style={styles.qrFlashBtn}
              onPress={() => setIsFlashOn(!isFlashOn)}
            >
              <Ionicons
                name={isFlashOn ? 'flash' : 'flash-off'}
                size={20}
                color={isFlashOn ? '#FBBF24' : '#FFF'}
              />
            </TouchableOpacity>
          </View>

          {/* Viewfinder Khung quét */}
          <View style={styles.qrViewfinderWrapper}>
            <View style={styles.qrViewfinder}>
              {!permission?.granted && (
                <View style={styles.permissionMessage}>
                  <Ionicons name="camera-outline" size={42} color="#94A3B8" />
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

            <LocalizedText style={styles.qrGuideText}>
              Căn chỉnh mã vạch{' '}
              <LocalizedText style={{ fontWeight: 'bold', color: '#38BDF8' }}>S/N hoặc MAC ở đáy Camera</LocalizedText> vào khung; hoặc quét mã mặt sau{' '}
              <LocalizedText style={{ fontWeight: 'bold', color: '#34D399' }}>Vòng đeo tay BLE</LocalizedText>.
            </LocalizedText>
          </View>
        </SafeAreaView>
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
    justifyContent: 'space-between',
  },
  qrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  qrCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrHeaderTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  qrFlashBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrViewfinderWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  qrViewfinder: {
    width: 290,
    height: 180,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'rgba(15, 23, 42, 0.2)',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
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
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
});

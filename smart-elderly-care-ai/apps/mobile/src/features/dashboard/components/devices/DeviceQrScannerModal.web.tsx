import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedAlert, LocalizedText } from '../../../../i18n/LocalizedComponents';
import { parseDeviceQr, ScannedDevice } from '../../utils/deviceQr';

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
  const topInset = Math.max(insets?.top || 0, 16);
  const bottomInset = Math.max(insets?.bottom || 0, 20);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState('');
  const [showManual, setShowManual] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<any>(null);
  const laserAnim = useRef(new Animated.Value(0)).current;

  // Khởi động Camera Webcam trên trình duyệt
  const startCamera = async () => {
    try {
      setCameraError(null);
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setHasPermission(false);
        setCameraError('Trình duyệt không hỗ trợ mở camera trực tiếp.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      setHasPermission(false);
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setCameraError('Quyền Camera bị chặn. Vui lòng cho phép quyền Camera trên trình duyệt.');
      } else {
        setCameraError('Không thể mở Camera webcam hoặc thiết bị đang được ứng dụng khác sử dụng.');
      }
    }
  };

  const stopCamera = () => {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const toggleFlash = async () => {
    const nextState = !isFlashOn;
    setIsFlashOn(nextState);
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        try {
          const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
          if (capabilities?.torch) {
            await (track as any).applyConstraints({
              advanced: [{ torch: nextState }],
            });
          }
        } catch {
          // torch not supported on this browser/hardware
        }
      }
    }
  };

  const handleClose = () => {
    setIsFlashOn(false);
    stopCamera();
    onClose();
  };

  // Laser animation & Start/Stop camera theo visibility
  useEffect(() => {
    if (visible) {
      setScanned(false);
      setManualCode('');
      setManualError('');
      setShowManual(false);
      startCamera();

      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: 176,
            duration: 1800,
            useNativeDriver: false,
          }),
          Animated.timing(laserAnim, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: false,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      setIsFlashOn(false);
      stopCamera();
      laserAnim.setValue(0);
    }
  }, [visible, laserAnim]);

  // Quét thời gian thực qua BarcodeDetector API (Chrome, Edge, Opera, Safari trên iOS/Android)
  useEffect(() => {
    if (!visible || !hasPermission || scanned) return;

    let detector: any = null;
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        detector = new (window as any).BarcodeDetector({
          formats: ['code_128', 'code_39', 'code_93', 'qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf'],
        });
      } catch (e) {
        // Fallback or formats not fully supported
      }
    }

    const interval = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2 || scanned) return;

      if (detector) {
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const raw = barcodes[0].rawValue;
            if (raw) {
              const device = parseDeviceQr(raw, barcodes[0].format);
              if (device) {
                setScanned(true);
                stopCamera();
                onScan(device.type, device.deviceId, device);
                onClose();
              }
            }
          }
        } catch {
          // ignore scan frame exception
        }
      }
    }, 280);

    scanTimerRef.current = interval;
    return () => clearInterval(interval);
  }, [visible, hasPermission, scanned]);

  const handleManualSubmit = () => {
    const trimmed = manualCode.trim();
    if (!trimmed) {
      const msg = 'Vui lòng nhập mã vạch S/N hoặc địa chỉ MAC ở đáy camera.';
      setManualError(msg);
      LocalizedAlert.alert('Chưa nhập mã camera', msg);
      return;
    }

    const device = parseDeviceQr(trimmed);
    if (device) {
      setManualError('');
      stopCamera();
      onScan(device.type, device.deviceId, device);
      onClose();
      return;
    }

    const errorMsg = 'Hãy kiểm tra lại S/N hoặc địa chỉ MAC ở đáy camera (VD: 0C-EF-15-15-80-C5).';
    setManualError(errorMsg);
    LocalizedAlert.alert('Mã camera không hợp lệ', errorMsg);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.qrModalContainer}>
        {/* Fullscreen Video Element */}
        {React.createElement('video', {
          ref: (el: HTMLVideoElement | null) => {
            videoRef.current = el;
            if (el && streamRef.current && el.srcObject !== streamRef.current) {
              el.srcObject = streamRef.current;
              el.play().catch(() => {});
            }
          },
          autoPlay: true,
          playsInline: true,
          muted: true,
          style: {
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 0,
            display: hasPermission ? 'block' : 'none',
          },
        })}

        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header Scanner an toàn dưới tai thỏ */}
          <View style={[styles.qrHeader, { paddingTop: topInset + 8 }]}>
            <TouchableOpacity
              style={styles.qrCloseBtn}
              onPress={handleClose}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <LocalizedText style={styles.qrHeaderTitle}>Quét mã vạch camera</LocalizedText>
            <TouchableOpacity
              style={styles.qrFlashBtn}
              onPress={toggleFlash}
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
            <View style={styles.qrViewfinder}>
              {!hasPermission && (
                <View style={styles.permissionMessage}>
                  <Ionicons name="camera-outline" size={38} color="#94A3B8" />
                  <LocalizedText style={styles.permissionText}>
                    {cameraError || 'Cần quyền camera để quét mã thiết bị'}
                  </LocalizedText>
                  <TouchableOpacity
                    style={styles.permissionButton}
                    onPress={startCamera}
                    activeOpacity={0.8}
                  >
                    <LocalizedText style={styles.permissionButtonText}>
                      Cho phép camera
                    </LocalizedText>
                  </TouchableOpacity>
                </View>
              )}

              {/* 4 Góc khung quét */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />

              {/* Tia laser chạy lên xuống */}
              {hasPermission && (
                <Animated.View
                  style={[
                    styles.qrLaserLine,
                    {
                      transform: [{ translateY: laserAnim }],
                    },
                  ]}
                />
              )}
            </View>
            <View style={styles.maskSide} />
          </View>

          {/* Mask Bottom */}
          <View style={[styles.maskBottom, { paddingBottom: bottomInset + 12 }]}>
            <LocalizedText style={styles.qrGuideText}>
              Căn chỉnh mã vạch{' '}
              <LocalizedText style={{ fontWeight: 'bold', color: '#38BDF8' }}>S/N hoặc MAC ở đáy Camera</LocalizedText> vào khung.
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
                    placeholder="VD: 0C-EF-15-15-80-C5 hoặc S/N..."
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
    height: 180,
    alignItems: 'center',
  },
  maskSide: {
    flex: 1,
    height: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  qrViewfinder: {
    width: 300,
    height: 180,
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

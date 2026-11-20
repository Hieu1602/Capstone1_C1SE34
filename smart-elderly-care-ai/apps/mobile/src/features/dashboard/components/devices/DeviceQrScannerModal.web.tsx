import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, TextInput, Animated } from 'react-native';
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
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState('');
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

  // Laser animation & Start/Stop camera theo visibility
  useEffect(() => {
    if (visible) {
      setScanned(false);
      startCamera();

      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: 230,
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
      anim.start();
      return () => anim.stop();
    } else {
      stopCamera();
      laserAnim.setValue(0);
    }
  }, [visible, laserAnim]);

  // Quét thời gian thực qua BarcodeDetector API (Chrome, Edge, Opera, v.v.)
  useEffect(() => {
    if (!visible || !hasPermission || scanned) return;

    let detector: any = null;
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        detector = new (window as any).BarcodeDetector({
          formats: ['code_128', 'code_39', 'qr_code', 'ean_13', 'ean_8', 'upc_a'],
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
      LocalizedAlert.alert(
        'Chưa nhập mã camera',
        'Vui lòng nhập mã vạch S/N hoặc địa chỉ MAC ở đáy camera.'
      );
      return;
    }
    const device = parseDeviceQr(trimmed);
    if (device) {
      stopCamera();
      onScan(device.type, device.deviceId, device);
      onClose();
      return;
    }
    LocalizedAlert.alert(
      'Mã camera không hợp lệ',
      'Hãy kiểm tra lại S/N hoặc địa chỉ MAC ở đáy camera (VD: 0C-EF-15-15-80-C5).'
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => {
        stopCamera();
        onClose();
      }}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="barcode-outline" size={20} color="#0284C7" style={{ marginRight: 6 }} />
              <LocalizedText style={styles.headerTitle}>Quét mã vạch camera</LocalizedText>
            </View>
            <TouchableOpacity
              onPress={() => {
                stopCamera();
                onClose();
              }}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Viewfinder Khung quét qua Camera */}
          <View style={styles.viewfinderWrapper}>
            <View style={styles.viewfinder}>
              {/* HTML5 Video element stream */}
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
                  borderRadius: 16,
                  display: hasPermission ? 'block' : 'none',
                },
              })}

              {/* Thông báo nếu chưa có quyền hoặc lỗi Camera */}
              {!hasPermission && (
                <View style={styles.permissionBox}>
                  <Ionicons name="camera-outline" size={44} color="#94A3B8" />
                  <LocalizedText style={styles.permissionTitle}>
                    Cần cấp quyền truy cập Camera
                  </LocalizedText>
                  <LocalizedText style={styles.permissionDesc}>
                    {cameraError || 'Trình duyệt cần quyền truy cập webcam để quét mã vạch đáy camera.'}
                  </LocalizedText>
                  <TouchableOpacity style={styles.grantBtn} onPress={startCamera} activeOpacity={0.8}>
                    <Ionicons name="videocam" size={16} color="#FFF" style={{ marginRight: 6 }} />
                    <LocalizedText style={styles.grantBtnText}>Cấp quyền Camera</LocalizedText>
                  </TouchableOpacity>
                </View>
              )}

              {/* 4 Góc khung ngắm */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />

              {/* Tia Laser quét */}
              {hasPermission && (
                <Animated.View
                  style={[
                    styles.laserLine,
                    {
                      transform: [{ translateY: laserAnim }],
                    },
                  ]}
                />
              )}
            </View>
          </View>

          <LocalizedText style={styles.guideText}>
            Hướng Camera vào mã vạch{' '}
            <LocalizedText style={{ fontWeight: '700', color: '#0284C7' }}>S/N hoặc MAC ở đáy Camera</LocalizedText>{' '}
            để tự động nhận diện thiết bị.
          </LocalizedText>

          {/* Fallback Nhập mã hoặc test nhanh */}
          <View style={styles.footerControls}>
            <TouchableOpacity
              style={styles.toggleManualBtn}
              onPress={() => setShowManual(!showManual)}
              activeOpacity={0.7}
            >
              <Ionicons name={showManual ? 'chevron-up' : 'keypad-outline'} size={16} color="#0284C7" />
              <LocalizedText style={styles.toggleManualText}>
                {showManual ? 'Ẩn nhập thủ công' : 'Hoặc nhập mã thủ công'}
              </LocalizedText>
            </TouchableOpacity>

            {showManual && (
              <View style={styles.manualContainer}>
                <View style={styles.manualInputRow}>
                  <TextInput
                    value={manualCode}
                    onChangeText={setManualCode}
                    placeholder="VD: 0C-EF-15-15-80-C5 hoặc S/N..."
                    placeholderTextColor="#94A3B8"
                    style={styles.input}
                  />
                  <TouchableOpacity onPress={handleManualSubmit} style={styles.submitBtn}>
                    <LocalizedText style={styles.submitBtnText}>Xác nhận</LocalizedText>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 440,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
  },
  viewfinderWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  viewfinder: {
    width: 280,
    height: 250,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  permissionBox: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  permissionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 8,
    textAlign: 'center',
  },
  permissionDesc: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 16,
  },
  grantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  grantBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#38BDF8',
    borderWidth: 3,
    zIndex: 10,
  },
  cornerTL: {
    top: 10,
    left: 10,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 10,
    right: 10,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 10,
    left: 10,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 10,
    right: 10,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomRightRadius: 8,
  },
  laserLine: {
    position: 'absolute',
    top: 10,
    left: 16,
    right: 16,
    height: 3,
    backgroundColor: '#38BDF8',
    borderRadius: 2,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    zIndex: 10,
  },
  guideText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  footerControls: {
    marginTop: 4,
  },
  toggleManualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  toggleManualText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0284C7',
  },
  manualContainer: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  manualInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  submitBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});

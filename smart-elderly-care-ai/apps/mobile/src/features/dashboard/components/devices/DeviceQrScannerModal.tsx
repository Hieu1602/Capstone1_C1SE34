import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText } from '../../../../i18n/LocalizedComponents';

interface DeviceQrScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onSimulateScan: (type: 'camera' | 'watch') => void;
}

export const DeviceQrScannerModal: React.FC<DeviceQrScannerModalProps> = ({
  visible,
  onClose,
  onSimulateScan,
}) => {
  const [isFlashOn, setIsFlashOn] = useState(false);
  const laserAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: 220,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(laserAnim, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      laserAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.qrModalContainer}>
        <SafeAreaView style={styles.qrModalSafeArea}>
          {/* Header Scanner */}
          <View style={styles.qrHeader}>
            <TouchableOpacity
              style={styles.qrCloseBtn}
              onPress={onClose}
            >
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <LocalizedText style={styles.qrHeaderTitle}>Quét Mã QR Thiết Bị</LocalizedText>
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

              <Ionicons name="scan-outline" size={80} color="rgba(255,255,255,0.2)" />
            </View>

            <LocalizedText style={styles.qrGuideText}>
              Căn chỉnh mã QR ở mặt đáy Camera{' '}
              <LocalizedText style={{ fontWeight: 'bold', color: '#38BDF8' }}>SECA_001</LocalizedText> hoặc mặt sau{' '}
              <LocalizedText style={{ fontWeight: 'bold', color: '#34D399' }}>Vòng đeo tay BLE</LocalizedText> vào trong khung hình.
            </LocalizedText>
          </View>

          {/* Các nút bấm mô phỏng kiểm thử nhanh */}
          <View style={styles.qrBottomBar}>
            <LocalizedText style={styles.qrSimLabel}>Hoặc chọn mô phỏng quét thực tế:</LocalizedText>
            <View style={styles.qrSimRow}>
              <TouchableOpacity
                style={[styles.qrSimBtn, { backgroundColor: '#EA580C' }]}
                onPress={() => onSimulateScan('camera')}
              >
                <Ionicons name="videocam" size={18} color="#FFF" />
                <LocalizedText style={styles.qrSimBtnText}>Quét Camera SECA_001</LocalizedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.qrSimBtn, { backgroundColor: '#059669' }]}
                onPress={() => onSimulateScan('watch')}
              >
                <Ionicons name="watch" size={18} color="#FFF" />
                <LocalizedText style={styles.qrSimBtnText}>Quét Vòng Tay BLE</LocalizedText>
              </TouchableOpacity>
            </View>
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
    width: 240,
    height: 240,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
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
  qrGuideText: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  qrBottomBar: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  qrSimLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  qrSimRow: {
    flexDirection: 'row',
    gap: 10,
  },
  qrSimBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  qrSimBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
});

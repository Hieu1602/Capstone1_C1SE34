import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedAlert, LocalizedText } from '../../../../i18n/LocalizedComponents';
import { parseDeviceQr } from '../../utils/deviceQr';

interface DeviceQrScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (type: 'camera' | 'watch', deviceId: string) => void;
}

export const DeviceQrScannerModal: React.FC<DeviceQrScannerModalProps> = ({
  visible,
  onClose,
  onScan,
}) => {
  const [manualCode, setManualCode] = useState('');

  const handleManualSubmit = () => {
    if (!manualCode.trim()) return;
    const device = parseDeviceQr(manualCode.trim());
    if (device) {
      onScan(device.type, device.deviceId);
      onClose();
      return;
    }
    LocalizedAlert.alert(
      'Mã thiết bị không hợp lệ',
      'Hãy nhập mã S/N trên tem Tapo hoặc mã thiết bị SECA/BLE.'
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <LocalizedText style={styles.headerTitle}>Quét mã thiết bị</LocalizedText>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>
          <View style={styles.body}>
            <Ionicons name="qr-code-outline" size={64} color="#0284C7" style={{ alignSelf: 'center', marginVertical: 16 }} />
            <LocalizedText style={styles.desc}>
              Trình quét camera trực tiếp hoạt động trên thiết bị di động (iOS / Android). Trên máy tính, bạn có thể nhập trực tiếp mã QR/Serial Number thiết bị:
            </LocalizedText>
            <TextInput
              value={manualCode}
              onChangeText={setManualCode}
              placeholder="Nhập mã thiết bị (S/N hoặc mã QR)..."
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />
            <TouchableOpacity onPress={handleManualSubmit} style={styles.submitBtn}>
              <LocalizedText style={styles.submitBtnText}>Xác nhận mã thiết bị</LocalizedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 420,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    paddingVertical: 8,
  },
  desc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

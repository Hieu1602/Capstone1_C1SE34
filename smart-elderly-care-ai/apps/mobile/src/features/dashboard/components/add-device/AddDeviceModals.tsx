import React from 'react';
import { View, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText } from '../../../../i18n/LocalizedComponents';

interface AddDeviceModalsProps {
  styles: any;
  showPermRequestModal: boolean;
  setShowPermRequestModal: (v: boolean) => void;
  onGrantBlePermission: () => void;
  showBleErrorDialog: boolean;
  setShowBleErrorDialog: (v: boolean) => void;
  bleErrorMessage: string;
  onBackToScanFromError: () => void;
}

export const AddDeviceModals: React.FC<AddDeviceModalsProps> = ({
  styles,
  showPermRequestModal,
  setShowPermRequestModal,
  onGrantBlePermission,
  showBleErrorDialog,
  setShowBleErrorDialog,
  bleErrorMessage,
  onBackToScanFromError,
}) => {
  return (
    <>
      {/* MODAL: RequestPerm (Hiển thị Popup xin quyền BLE) */}
      <Modal
        visible={showPermRequestModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPermRequestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconBox}>
              <Ionicons name="shield-checkmark" size={36} color="#2563EB" />
            </View>
            <LocalizedText style={styles.modalTitle}>Cấp Quyền Hệ Thống</LocalizedText>
            <LocalizedText style={styles.modalMessage}>
              Để phát hiện và đồng bộ dữ liệu nhịp tim, SpO₂ từ đồng hồ thông minh, hệ thống cần quyền{' '}
              <LocalizedText style={{ fontWeight: 'bold' }}>Bluetooth</LocalizedText>.
            </LocalizedText>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowPermRequestModal(false)}
              >
                <LocalizedText style={styles.modalCancelText}>Từ chối</LocalizedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={onGrantBlePermission}
              >
                <LocalizedText style={styles.modalConfirmText}>Cho phép</LocalizedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: DialogBLE (Báo lỗi ghép nối BLE / Thiết bị) */}
      <Modal
        visible={showBleErrorDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBleErrorDialog(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIconBox, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="close-circle" size={36} color="#DC2626" />
            </View>
            <LocalizedText style={[styles.modalTitle, { color: '#B91C1C' }]}>Lỗi Kết Nối Thiết Bị!</LocalizedText>
            <LocalizedText style={styles.modalMessage}>
              {bleErrorMessage || 'Không thể kết nối với thiết bị. Vui lòng đảm bảo thiết bị ở gần, pin còn đủ và thử lại.'}
            </LocalizedText>

            <TouchableOpacity
              style={[styles.modalConfirmBtn, { backgroundColor: '#DC2626', width: '100%' }]}
              onPress={onBackToScanFromError}
            >
              <LocalizedText style={styles.modalConfirmText}>Quay Lại Màn Hình Radar Quét</LocalizedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

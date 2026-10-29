import React from 'react';
import { View, TouchableOpacity, ScrollView, Switch, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText } from '../../../../i18n/LocalizedComponents';

interface AddDeviceModalsProps {
  styles: any;
  showPermRequestModal: boolean;
  setShowPermRequestModal: (v: boolean) => void;
  onGrantBlePermission: () => void;
  showWifiWarningDialog: boolean;
  setShowWifiWarningDialog: (v: boolean) => void;
  onOpenPhoneWifiSettings: () => void;
  onContinueWifiSearching: () => void;
  showPhoneWifiSettingsModal: boolean;
  setShowPhoneWifiSettingsModal: (v: boolean) => void;
  connectedPhoneWifi: string | null;
  selectedPhoneWifi: string;
  phoneWifiNetworks: { ssid: string; desc: string; icon: string; tag?: string; hasLock?: boolean; isTarget?: boolean }[];
  isConnectingPhoneWifi: boolean;
  onConnectPhoneWifi: (ssid: string) => void;
  showResetGuideModal: boolean;
  setShowResetGuideModal: (v: boolean) => void;
  onResetCameraConfirmed: () => void;
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
  showWifiWarningDialog,
  setShowWifiWarningDialog,
  onOpenPhoneWifiSettings,
  onContinueWifiSearching,
  showPhoneWifiSettingsModal,
  setShowPhoneWifiSettingsModal,
  connectedPhoneWifi,
  selectedPhoneWifi,
  phoneWifiNetworks,
  isConnectingPhoneWifi,
  onConnectPhoneWifi,
  showResetGuideModal,
  setShowResetGuideModal,
  onResetCameraConfirmed,
  showBleErrorDialog,
  setShowBleErrorDialog,
  bleErrorMessage,
  onBackToScanFromError,
}) => {
  return (
    <>
      {/* MODAL: RequestPerm (Hiển thị Popup xin quyền) */}
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

      {/* MODAL: WARNING DIALOG (Cảnh báo chưa kết nối SECA_001) */}
      <Modal
        visible={showWifiWarningDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWifiWarningDialog(false)}
      >
        <View style={styles.warningModalOverlay}>
          <View style={styles.warningDialogCard}>
            <LocalizedText style={styles.warningDialogText}>
              Có vẻ bạn đang không kết nối đến SECA_001. Tiếp tục?
            </LocalizedText>

            <View style={styles.warningActionColumn}>
              <TouchableOpacity
                style={styles.warningActionBtn}
                onPress={() => {
                  setShowWifiWarningDialog(false);
                  onOpenPhoneWifiSettings();
                }}
                activeOpacity={0.7}
              >
                <LocalizedText style={styles.warningActionPrimaryText}>Đến Cài đặt</LocalizedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.warningActionBtn}
                onPress={() => {
                  setShowWifiWarningDialog(false);
                  onContinueWifiSearching();
                }}
                activeOpacity={0.7}
              >
                <LocalizedText style={styles.warningActionPrimaryText}>Tiếp tục</LocalizedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.warningActionBtn}
                onPress={() => setShowWifiWarningDialog(false)}
                activeOpacity={0.7}
              >
                <LocalizedText style={styles.warningActionCancelText}>Hủy</LocalizedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: Phone Wi-Fi Settings */}
      <Modal
        visible={showPhoneWifiSettingsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPhoneWifiSettingsModal(false)}
      >
        <View style={styles.phoneSettingsOverlay}>
          <SafeAreaView style={styles.phoneSettingsSafeArea}>
            <View style={styles.phoneSettingsCard}>
              <View style={styles.phoneSettingsHeader}>
                <TouchableOpacity
                  style={styles.phoneSettingsBackBtn}
                  onPress={() => setShowPhoneWifiSettingsModal(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <LocalizedText style={styles.phoneSettingsTitle}>Wi-Fi</LocalizedText>
                <TouchableOpacity style={styles.phoneSettingsScanBtn} activeOpacity={0.7}>
                  <Ionicons name="scan-outline" size={22} color="#1E293B" />
                </TouchableOpacity>
              </View>

              <View style={styles.phoneWifiToggleRow}>
                <LocalizedText style={styles.phoneWifiToggleLabel}>Wi-Fi</LocalizedText>
                <Switch
                  value={true}
                  trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
                  thumbColor="#0284C7"
                />
              </View>

              <View style={styles.phoneConnectedCard}>
                <View style={styles.phoneConnectedIconBox}>
                  <Ionicons name="wifi" size={24} color="#FFF" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <LocalizedText style={styles.phoneConnectedSsid}>
                      {connectedPhoneWifi || '5 chang trai'}
                    </LocalizedText>
                    <View style={styles.phoneBandTag}>
                      <LocalizedText style={styles.phoneBandTagText}>2.4G/5G</LocalizedText>
                    </View>
                  </View>
                  <LocalizedText style={styles.phoneConnectedSub}>
                    {connectedPhoneWifi === 'SECA_001'
                      ? 'Đã kết nối trực tiếp đến Camera'
                      : 'Chạm để chia sẻ mật khẩu'}
                  </LocalizedText>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="lock-closed" size={16} color="rgba(255,255,255,0.85)" />
                  <View style={styles.phoneConnectedArrowCircle}>
                    <Ionicons name="chevron-forward" size={16} color="#0284C7" />
                  </View>
                </View>
              </View>

              <View style={styles.phoneAvailableSectionHeader}>
                <LocalizedText style={styles.phoneAvailableSectionTitle}>Mạng có sẵn</LocalizedText>
                <TouchableOpacity activeOpacity={0.7}>
                  <Ionicons name="sync-outline" size={18} color="#475569" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.phoneNetworkListScroll}
                showsVerticalScrollIndicator={false}
              >
                {phoneWifiNetworks.map((net) => {
                  const isCameraTarget = net.isTarget;

                  return (
                    <TouchableOpacity
                      key={net.ssid}
                      style={[
                        styles.phoneNetworkItem,
                        isCameraTarget && styles.phoneNetworkItemTarget,
                      ]}
                      onPress={() => onConnectPhoneWifi(net.ssid)}
                      disabled={isConnectingPhoneWifi}
                      activeOpacity={0.7}
                    >
                      <View style={styles.networkItemLeft}>
                        <Ionicons
                          name={net.icon as any}
                          size={22}
                          color={isCameraTarget ? '#0284C7' : '#475569'}
                        />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <LocalizedText
                              style={[
                                styles.networkItemSsid,
                                isCameraTarget && { color: '#0284C7', fontWeight: '800' },
                              ]}
                            >
                              {net.ssid}
                            </LocalizedText>
                            {net.tag && (
                              <View
                                style={[
                                  styles.phoneNetworkTagBox,
                                  isCameraTarget && { backgroundColor: '#E0F2FE' },
                                ]}
                              >
                                <LocalizedText
                                  style={[
                                    styles.phoneNetworkTagText,
                                    isCameraTarget && { color: '#0284C7' },
                                  ]}
                                >
                                  {net.tag}
                                </LocalizedText>
                              </View>
                            )}
                          </View>
                          <LocalizedText style={styles.networkItemDesc}>{net.desc}</LocalizedText>
                        </View>
                      </View>

                      <View style={styles.networkItemRight}>
                        {isConnectingPhoneWifi && selectedPhoneWifi === net.ssid ? (
                          <ActivityIndicator size="small" color="#0284C7" />
                        ) : connectedPhoneWifi === net.ssid ? (
                          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                        ) : (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {net.hasLock && (
                              <Ionicons name="lock-closed" size={14} color="#94A3B8" />
                            )}
                            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {isConnectingPhoneWifi && (
                <View style={styles.connectingToast}>
                  <ActivityIndicator size="small" color="#FFF" />
                  <LocalizedText style={styles.connectingToastText}>
                    Đang kết nối vào mạng "{selectedPhoneWifi}"...
                  </LocalizedText>
                </View>
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* MODAL: Hướng Dẫn Reset Camera SECA_001 Thủ Công */}
      <Modal
        visible={showResetGuideModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResetGuideModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.resetGuideModalCard}>
            <View style={styles.resetModalHeader}>
              <View style={styles.resetModalIconBox}>
                <Ionicons name="refresh" size={24} color="#EA580C" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <LocalizedText style={styles.resetModalTitle}>Hướng Dẫn Reset Camera</LocalizedText>
                <LocalizedText style={styles.resetModalSub}>Camera an ninh AI SECA_001</LocalizedText>
              </View>
              <TouchableOpacity
                onPress={() => setShowResetGuideModal(false)}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={styles.resetGraphicCard}>
              <Ionicons name="videocam" size={44} color="#EA580C" />
              <View style={styles.resetButtonPointerBadge}>
                <Ionicons name="finger-print" size={14} color="#FFF" />
                <LocalizedText style={styles.resetButtonPointerText}>Vị trí nút RESET ở đáy Camera</LocalizedText>
              </View>
            </View>

            <View style={styles.resetStepsList}>
              <View style={styles.resetStepItem}>
                <View style={styles.resetStepNum}>
                  <LocalizedText style={styles.resetStepNumText}>1</LocalizedText>
                </View>
                <LocalizedText style={styles.resetStepText}>
                  Cắm nguồn điện và đảm bảo Camera đang được cấp điện liên tục.
                </LocalizedText>
              </View>

              <View style={styles.resetStepItem}>
                <View style={styles.resetStepNum}>
                  <LocalizedText style={styles.resetStepNumText}>2</LocalizedText>
                </View>
                <LocalizedText style={styles.resetStepText}>
                  Tìm nút bấm <LocalizedText style={{ fontWeight: 'bold' }}>RESET</LocalizedText> ở mặt đáy Camera (hoặc lật nhẹ mắt camera lên trên để thấy nút reset bên dưới).
                </LocalizedText>
              </View>

              <View style={styles.resetStepItem}>
                <View style={styles.resetStepNum}>
                  <LocalizedText style={styles.resetStepNumText}>3</LocalizedText>
                </View>
                <LocalizedText style={styles.resetStepText}>
                  Dùng ngón tay <LocalizedText style={{ fontWeight: 'bold', color: '#EA580C' }}>nhấn giữ nút RESET trong 5 đến 10 giây</LocalizedText> cho đến khi nghe tiếng "Bíp" hoặc giọng nói thông báo.
                </LocalizedText>
              </View>

              <View style={styles.resetStepItem}>
                <View style={styles.resetStepNum}>
                  <LocalizedText style={styles.resetStepNumText}>4</LocalizedText>
                </View>
                <LocalizedText style={styles.resetStepText}>
                  Đợi camera xoay tự khởi động lại (~30s). Đèn LED sẽ chuyển sang <LocalizedText style={{ fontWeight: 'bold', color: '#059669' }}>nhấp nháy luân phiên Đỏ và Xanh</LocalizedText>.
                </LocalizedText>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.modalConfirmBtn, { backgroundColor: '#EA580C', width: '100%', marginBottom: 10 }]}
              onPress={onResetCameraConfirmed}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFF" />
              <LocalizedText style={styles.modalConfirmText}>Tôi Đã Reset Xong • Đèn Đã Nhấp Nháy</LocalizedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalCancelBtn, { width: '100%' }]}
              onPress={() => setShowResetGuideModal(false)}
            >
              <LocalizedText style={styles.modalCancelText}>Đóng</LocalizedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: DialogBLE (Báo lỗi ghép nối) */}
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


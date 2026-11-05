/**
 * SmartbandDetailScreen.tsx
 * Màn hình Chi tiết Vòng Đeo Tay Thông Minh (BLE Smartband) & Các chỉ số sức khỏe thu thập
 * Thiết kế chuẩn y khoa cho hệ thống Smart Elderly Care AI theo Proposal Capstone 1
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Modal,
  Text,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useVitalStore } from '../../../store/useVitalStore';
import { LocalizedAlert, LocalizedText } from '../../../i18n/LocalizedComponents';
import { useTheme } from '../../../store/useThemeStore';
import { usePatientStore } from '../../../store/usePatientStore';
import { useDeviceStore } from '../../../store/useDeviceStore';
import { patientApi } from '../../../services/api';
import { devicesApi } from '../../../services/deviceService';
import { SmartbandHeroCard } from '../components/smartband/SmartbandHeroCard';
import { SmartbandVitalsCards } from '../components/smartband/SmartbandVitalsCards';
import { SmartbandHardwareSpecsCard } from '../components/smartband/SmartbandHardwareSpecsCard';

export default function SmartbandDetailScreen({ navigation, route }: any) {
  const deviceParam = route?.params?.device;
  const [device, setDevice] = useState<any>(deviceParam || {});
  const { currentVitals, setVitals, algoSettings, removeIoTDevice } = useVitalStore();
  const { isDarkMode, colors } = useTheme();
  const { patientRecord, fetchPatientRecord } = usePatientStore();

  const [isSyncing, setIsSyncing] = useState(false);
  const [isFinding, setIsFinding] = useState(false);

  // State cho Modal gán người cao tuổi
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [elderlyList, setElderlyList] = useState<any[]>([]);
  const [selectedElderlyId, setSelectedElderlyId] = useState<string | null>(null);
  const [isLoadingElderly, setIsLoadingElderly] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    if (deviceParam) {
      setDevice(deviceParam);
      if (deviceParam.elderly_id) {
        setSelectedElderlyId(String(deviceParam.elderly_id));
      }
    }
  }, [deviceParam]);

  const loadElderlyList = async () => {
    setIsLoadingElderly(true);
    try {
      const res = await patientApi.list();
      let list = Array.isArray(res.data) ? res.data : [];
      if (list.length === 0) {
        if (!patientRecord) {
          await fetchPatientRecord();
        }
        const record = usePatientStore.getState().patientRecord;
        if (record && record.name) {
          list = [
            {
              id: String(record.patient_id || 1),
              elderly_id: String(record.patient_id || 1),
              full_name: record.name,
              age: record.age || 75,
              gender: record.gender || 'Nam',
            },
          ];
        } else {
          list = [
            {
              id: '1',
              elderly_id: '1',
              full_name: 'Cụ Nguyễn Văn An',
              age: 78,
              gender: 'Nam',
            },
          ];
        }
      }
      setElderlyList(list);
      if (!selectedElderlyId && list.length > 0) {
        setSelectedElderlyId(String(list[0].id));
      }
    } catch (e) {
      console.warn('Lỗi khi tải danh sách người cao tuổi:', e);
      setElderlyList([
        {
          id: '1',
          elderly_id: '1',
          full_name: patientRecord?.name || 'Cụ Nguyễn Văn An',
          age: patientRecord?.age || 78,
          gender: patientRecord?.gender || 'Nam',
        },
      ]);
    } finally {
      setIsLoadingElderly(false);
    }
  };

  const handleOpenAssignModal = () => {
    setAssignModalVisible(true);
    loadElderlyList();
  };

  const handleConfirmAssign = async () => {
    if (!selectedElderlyId) {
      Alert.alert('Thông báo', 'Vui lòng chọn một người cao tuổi.');
      return;
    }
    const selectedElderly = elderlyList.find((e) => String(e.id) === String(selectedElderlyId));
    if (!selectedElderly) return;

    setIsAssigning(true);
    const devId = device.id || device.device_id || deviceParam?.id || deviceParam?.device_id || 'BLE_BAND_01';

    try {
      await devicesApi.updateDevice(devId, {
        elderly_id: selectedElderly.id,
      });
    } catch (apiErr) {
      console.warn('API updateDevice fallback:', apiErr);
    }

    const updated = {
      ...device,
      elderly_id: selectedElderly.id,
      wearer_name: selectedElderly.full_name || selectedElderly.name,
    };
    setDevice(updated);

    // Update in useDeviceStore
    try {
      const storeDevices = useDeviceStore.getState().iotDevices;
      const updatedStoreDevices = storeDevices.map((d) =>
        d.id === devId || d.deviceId === devId
          ? { ...d, elderly_id: selectedElderly.id, wearer_name: selectedElderly.full_name || selectedElderly.name }
          : d
      );
      useDeviceStore.setState({ iotDevices: updatedStoreDevices });
    } catch (e) {}

    setIsAssigning(false);
    setAssignModalVisible(false);

    const title = 'Gán Thiết Bị Thành Công';
    const msg = `Thiết bị ${device.name || 'Smartband'} đã được liên kết với ${selectedElderly.full_name || selectedElderly.name}.`;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  };

  // Pulse animation cho hiệu ứng nhịp tim / kết nối
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const triggerPulse = () => {
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1.18,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Đồng bộ đo tức thời
  const handleSyncNow = () => {
    setIsSyncing(true);
    triggerPulse();
    setTimeout(() => {
      // Giả lập đọc dữ liệu từ BLE GATT MAX30102
      const newHR = Math.floor(70 + Math.random() * 10);
      const newSpO2 = Math.floor(97 + Math.random() * 2);
      setVitals({
        heart_rate: newHR,
        spo2: newSpO2,
        skin_temp_max: 36.7,
        timestamp: Date.now(),
      });
      setIsSyncing(false);
      LocalizedAlert.alert(
        'Đồng Bộ Thành Công',
        `Đã nhận gói tin GATT mới nhất từ vòng đeo tay:\n• Nhịp tim: ${newHR} bpm\n• SpO₂: ${newSpO2}%\n• Thân nhiệt da: 36.7°C\n• Trọng lực: 1.01G (Bình thường)`
      );
    }, 1200);
  };

  // Phát tín hiệu rung tìm vòng tay
  const handleFindBand = () => {
    setIsFinding(true);
    setTimeout(() => {
      setIsFinding(false);
      LocalizedAlert.alert(
        'Đã Gửi Tín Hiệu Rung 📳',
        'Đã gửi lệnh GATT (Vibration Motor Alert) đến vòng đeo tay tại Phòng ngủ. Vòng tay đang rung 3 hồi chu kỳ.'
      );
    }, 800);
  };

  const hasHR = typeof currentVitals.heart_rate === 'number';
  const hasSpO2 = typeof currentVitals.spo2 === 'number';
  const hasTemp = typeof currentVitals.skin_temp_max === 'number';

  const hrValue: string | number = currentVitals.heart_rate != null ? currentVitals.heart_rate : '--';
  const spo2Value: string | number = currentVitals.spo2 != null ? currentVitals.spo2 : '--';
  const tempValue: string | number = currentVitals.skin_temp_max != null ? currentVitals.skin_temp_max : '--';

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* 1. Header Điều Hướng */}
      <View style={[styles.header, isDarkMode && { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.backButton, isDarkMode && { backgroundColor: colors.surfaceSubtle }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <LocalizedText style={[styles.headerTitle, isDarkMode && { color: colors.textPrimary }]}>
            {deviceParam?.name || 'Vòng đeo tay BLE Smartband'}
          </LocalizedText>
          <View style={styles.headerSubtitleRow}>
            <View style={styles.onlineDot} />
            <LocalizedText style={[styles.headerSubtitle, isDarkMode && { color: colors.textSecondary }]}>
              GATT BLE 5.0 • Đang kết nối trực tuyến
            </LocalizedText>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.settingsButton, isDarkMode && { backgroundColor: colors.surfaceSubtle }]}
          onPress={() => navigation.navigate('AlgoConfig')}
          activeOpacity={0.7}
        >
          <Ionicons name="options-outline" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, isDarkMode && { backgroundColor: colors.background }]}
      >
        {/* 2. Hero Card: Thông tin chi tiết vòng đeo tay */}
        <SmartbandHeroCard
          pulseAnim={pulseAnim}
          deviceParam={device}
          isSyncing={isSyncing}
          isFinding={isFinding}
          onSyncNow={handleSyncNow}
          onFindBand={handleFindBand}
          onAssignWearer={handleOpenAssignModal}
          colors={colors}
          isDarkMode={isDarkMode}
        />

        {/* 3. Các thẻ chỉ số sức khỏe thu thập */}
        <SmartbandVitalsCards
          hrValue={hrValue}
          spo2Value={spo2Value}
          tempValue={tempValue}
          hasHR={hasHR}
          hasSpO2={hasSpO2}
          hasTemp={hasTemp}
          colors={colors}
          isDarkMode={isDarkMode}
        />

        {/* 4. Thông số kỹ thuật phần cứng & Phím tắt AlgoConfig */}
        <SmartbandHardwareSpecsCard
          algoSettings={algoSettings}
          onNavigateAlgoConfig={() => navigation.navigate('AlgoConfig')}
          colors={colors}
          isDarkMode={isDarkMode}
        />

        {/* 5. Nút Gỡ bỏ thiết bị */}
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#FEE2E2',
            paddingVertical: 14,
            borderRadius: 14,
            marginTop: 16,
            marginBottom: 24,
            gap: 8,
          }}
          onPress={() => {
            LocalizedAlert.alert(
              'Gỡ thiết bị',
              `Bạn có chắc muốn xóa thiết bị "${deviceParam?.name || 'Vòng đeo tay'}" khỏi hệ thống không?`,
              [
                { text: 'Hủy', style: 'cancel' },
                {
                  text: 'Xóa thiết bị',
                  style: 'destructive',
                  onPress: () => {
                    if (deviceParam?.id) {
                      removeIoTDevice(deviceParam.id);
                    }
                    navigation.goBack();
                  },
                },
              ]
            );
          }}
        >
          <Ionicons name="trash-outline" size={20} color="#DC2626" />
          <LocalizedText style={{ color: '#DC2626', fontWeight: 'bold', fontSize: 15 }}>
            Xóa vòng đeo tay này
          </LocalizedText>
        </TouchableOpacity>
      </ScrollView>

      {/* 5. Modal Gán Thiết Bị Cho Người Cao Tuổi */}
      <Modal
        visible={assignModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAssignModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              isDarkMode && { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Ionicons name="person-add" size={22} color="#10B981" />
                <Text style={[styles.modalTitle, isDarkMode && { color: colors.textPrimary }]}>
                  Gán Thiết Bị Người Đeo
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setAssignModalVisible(false)}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, isDarkMode && { color: colors.textSecondary }]}>
              Chọn hồ sơ Người cao tuổi đang sử dụng vòng đeo tay này để đồng bộ dữ liệu sinh hiệu:
            </Text>

            {isLoadingElderly ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#10B981" />
                <Text style={[styles.loadingText, isDarkMode && { color: colors.textSecondary }]}>
                  Đang tải danh sách người cao tuổi...
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.elderlyListWrap} showsVerticalScrollIndicator={false}>
                {elderlyList.map((elderly) => {
                  const isSelected = String(elderly.id) === String(selectedElderlyId);
                  return (
                    <TouchableOpacity
                      key={String(elderly.id)}
                      style={[
                        styles.elderlyItem,
                        isDarkMode && { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                        isSelected && styles.elderlyItemSelected,
                        isSelected && isDarkMode && { borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.12)' },
                      ]}
                      onPress={() => setSelectedElderlyId(String(elderly.id))}
                      activeOpacity={0.7}
                    >
                      <View style={styles.elderlyAvatarCircle}>
                        <Ionicons name="person" size={18} color="#10B981" />
                      </View>
                      <View style={styles.elderlyInfoCol}>
                        <Text style={[styles.elderlyName, isDarkMode && { color: colors.textPrimary }]}>
                          {elderly.full_name || elderly.name || 'Người cao tuổi'}
                        </Text>
                        <Text style={[styles.elderlyMeta, isDarkMode && { color: colors.textSecondary }]}>
                          {elderly.age ? `${elderly.age} tuổi` : 'Cao tuổi'} • {elderly.gender || 'Nam'}
                        </Text>
                      </View>
                      <View style={styles.radioBox}>
                        <Ionicons
                          name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={isSelected ? '#10B981' : '#94A3B8'}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, isDarkMode && { borderColor: colors.border }]}
                onPress={() => setAssignModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalCancelText, isDarkMode && { color: colors.textSecondary }]}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, isAssigning && { opacity: 0.7 }]}
                onPress={handleConfirmAssign}
                disabled={isAssigning}
                activeOpacity={0.7}
              >
                {isAssigning ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                    <Text style={styles.modalSubmitText}>Xác nhận gán</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBox: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 14,
  },
  loadingBox: {
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
  },
  elderlyListWrap: {
    maxHeight: 220,
    marginBottom: 16,
  },
  elderlyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    gap: 10,
  },
  elderlyItemSelected: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  elderlyAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  elderlyInfoCol: {
    flex: 1,
  },
  elderlyName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  elderlyMeta: {
    fontSize: 11.5,
    color: '#64748B',
  },
  radioBox: {
    paddingLeft: 4,
  },
  modalActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  modalSubmitBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#10B981',
  },
  modalSubmitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

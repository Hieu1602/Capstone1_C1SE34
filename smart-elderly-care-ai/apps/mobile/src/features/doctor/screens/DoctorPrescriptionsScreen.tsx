// DoctorPrescriptionsScreen.tsx
// Quản lý toàn bộ đơn thuốc, danh mục điều trị và đồng bộ lịch phát loa thông minh Edge Hub

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Switch,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../../theme/colors';
import { useTheme } from '../../../store/useThemeStore';
import { doctorApi } from '../../../services/api';

interface PrescriptionItem {
  id: string;
  patient_id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  schedule_times: string[];
  instructions: string;
  doctor_name: string;
  enable_speaker_reminder: boolean;
  created_at?: string;
}

export default function DoctorPrescriptionsScreen() {
  const insets = useSafeAreaInsets();
  const { isDarkMode, colors } = useTheme();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);

  // Modal Kê đơn / Sửa đơn
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRxId, setEditingRxId] = useState<string | null>(null);
  const [medName, setMedName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('Hàng ngày');
  const [scheduleTimes, setScheduleTimes] = useState('08:00, 19:30');
  const [instructions, setInstructions] = useState('');
  const [enableSpeaker, setEnableSpeaker] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const patientId = 'e0000000-b4e1-4b08-b2d3-d949a0eb075c';

  const fetchRx = useCallback(async () => {
    try {
      setLoading(true);
      const res = await doctorApi.getPrescriptions(patientId);
      if (res.data && Array.isArray(res.data)) {
        setPrescriptions(res.data);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchRx();
  }, [fetchRx]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRx();
  };

  const handleOpenCreateModal = () => {
    setEditingRxId(null);
    setMedName('');
    setDosage('');
    setFrequency('Hàng ngày vào buổi sáng');
    setScheduleTimes('08:00');
    setInstructions('Uống sau khi ăn sáng 15 phút với nước ấm.');
    setEnableSpeaker(true);
    setModalVisible(true);
  };

  const handleOpenEditModal = (rx: PrescriptionItem) => {
    setEditingRxId(rx.id);
    setMedName(rx.medication_name);
    setDosage(rx.dosage);
    setFrequency(rx.frequency);
    setScheduleTimes((rx.schedule_times || ['08:00']).join(', '));
    setInstructions(rx.instructions);
    setEnableSpeaker(rx.enable_speaker_reminder);
    setModalVisible(true);
  };

  const handleSaveRx = async () => {
    if (!medName.trim() || !dosage.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên thuốc và liều lượng.');
      return;
    }

    try {
      setIsSubmitting(true);
      const parsedTimes = scheduleTimes
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const payload = {
        medication_name: medName.trim(),
        dosage: dosage.trim(),
        frequency: frequency.trim() || 'Hàng ngày',
        schedule_times: parsedTimes.length > 0 ? parsedTimes : ['08:00'],
        instructions: instructions.trim() || 'Uống sau ăn với nước ấm.',
        enable_speaker_reminder: enableSpeaker,
      };

      if (editingRxId) {
        const res = await doctorApi.updatePrescription(patientId, editingRxId, payload);
        if (res.data) {
          setPrescriptions((prev) =>
            prev.map((r) => (r.id === editingRxId ? res.data : r))
          );
        }
        setModalVisible(false);
        Alert.alert('Thành công', `Đã cập nhật đơn thuốc "${payload.medication_name}".`);
      } else {
        const res = await doctorApi.createPrescription(patientId, payload);
        if (res.data) {
          setPrescriptions([res.data, ...prescriptions]);
        }
        setModalVisible(false);
        Alert.alert(
          'Đã lưu đơn thuốc',
          `Đã kê đơn "${payload.medication_name}". Hub Orange Pi 5 sẽ tự động phát loa tiếng Việt nhắc bệnh nhân uống đúng giờ!`
        );
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể kết nối lưu đơn thuốc.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRx = (rxId: string, name: string) => {
    const doDelete = async () => {
      try {
        await doctorApi.deletePrescription(patientId, rxId);
        setPrescriptions((prev) => prev.filter((r) => r.id !== rxId));
        if (Platform.OS === 'web') {
          window.alert(`Đã loại bỏ "${name}" khỏi phác đồ.`);
        } else {
          Alert.alert('Đã ngừng thuốc', `Đã loại bỏ "${name}" khỏi phác đồ.`);
        }
      } catch {
        if (Platform.OS === 'web') {
          window.alert('Lỗi: Không thể ngừng thuốc.');
        } else {
          Alert.alert('Lỗi', 'Không thể ngừng thuốc.');
        }
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Ngừng dùng thuốc: Bác sĩ có chắc chắn muốn ngừng kê đơn thuốc "${name}"?`)) {
        void doDelete();
      }
      return;
    }

    Alert.alert('Ngừng dùng thuốc', `Bác sĩ có chắc chắn muốn ngừng kê đơn thuốc "${name}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Ngừng thuốc',
        style: 'destructive',
        onPress: doDelete,
      },
    ]);
  };

  const handleToggleSpeaker = async (rxId: string) => {
    try {
      const res = await doctorApi.togglePrescriptionReminder(patientId, rxId);
      if (res.data) {
        setPrescriptions((prev) =>
          prev.map((r) => (r.id === rxId ? { ...r, enable_speaker_reminder: res.data.enable_speaker_reminder } : r))
        );
      }
    } catch {
      setPrescriptions((prev) =>
        prev.map((r) => (r.id === rxId ? { ...r, enable_speaker_reminder: !r.enable_speaker_reminder } : r))
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* TOP HEADER */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Quản Lý Đơn Thuốc</Text>
            <Text style={[styles.headerSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Phác đồ điều trị & Lịch nhắc nhở y tế tự động qua Loa Hub
            </Text>
          </View>
          <TouchableOpacity style={styles.btnAddHeader} onPress={handleOpenCreateModal}>
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* THẺ TỔNG HỢP NHANH */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: isDarkMode ? '#334155' : '#EFF6FF' }]}>
            <Text style={[styles.statNumber, { color: '#2563EB' }]}>{prescriptions.length}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>Đang kê đơn</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: isDarkMode ? '#334155' : '#ECFDF5' }]}>
            <Text style={[styles.statNumber, { color: '#059669' }]}>
              {prescriptions.filter((r) => r.enable_speaker_reminder).length}
            </Text>
            <Text style={styles.statLabel} numberOfLines={1}>Phát loa Hub</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: isDarkMode ? '#334155' : '#FFFBEB' }]}>
            <Text style={[styles.statNumber, { color: '#D97706' }]}>1</Text>
            <Text style={styles.statLabel} numberOfLines={1}>Bệnh nhân</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {loading && !refreshing && (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 20 }} />
        )}

        {prescriptions.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="medkit-outline" size={48} color="#94A3B8" />
            <Text style={[styles.emptyText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Chưa có đơn thuốc nào được kê.
            </Text>
          </View>
        ) : (
          prescriptions.map((rx) => (
            <View
              key={rx.id}
              style={[
                styles.rxCard,
                { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border },
              ]}
            >
              <View style={styles.rxHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rxMedName, { color: colors.textPrimary }]}>
                    💊 {rx.medication_name}
                  </Text>
                  <Text style={[styles.rxDosage, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                    Liều lượng: {rx.dosage} • {rx.frequency}
                  </Text>
                </View>

                {/* BẬT / TẮT NHANH LOA THÔNG MINH */}
                <TouchableOpacity
                  style={[
                    styles.speakerToggleBtn,
                    rx.enable_speaker_reminder
                      ? { backgroundColor: '#ECFDF5', borderColor: '#10B981' }
                      : { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9', borderColor: '#94A3B8' },
                  ]}
                  onPress={() => handleToggleSpeaker(rx.id)}
                >
                  <Ionicons
                    name={rx.enable_speaker_reminder ? 'volume-high' : 'volume-mute'}
                    size={14}
                    color={rx.enable_speaker_reminder ? '#059669' : '#94A3B8'}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.speakerToggleBtnText,
                      { color: rx.enable_speaker_reminder ? '#059669' : '#64748B' },
                    ]}
                  >
                    {rx.enable_speaker_reminder ? 'Loa Hub: BẬT' : 'Loa Hub: TẮT'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* LỊCH GIỜ UỐNG */}
              <View style={styles.scheduleRow}>
                <Text style={[styles.scheduleLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  Giờ nhắc uống:
                </Text>
                {(rx.schedule_times || ['08:00']).map((t: string, idx: number) => (
                  <View key={idx} style={styles.timeBadge}>
                    <Ionicons name="time-outline" size={12} color="#0284C7" style={{ marginRight: 2 }} />
                    <Text style={styles.timeBadgeText}>{t}</Text>
                  </View>
                ))}
              </View>

              {/* HƯỚNG DẪN BÁC SĨ */}
              <Text style={[styles.instructionsText, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>
                📝 Dặn dò: {rx.instructions}
              </Text>

              {/* FOOTER & NÚT SỬA / XÓA */}
              <View style={styles.rxFooter}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.footerText, { color: isDarkMode ? '#64748B' : '#94A3B8' }]} numberOfLines={1}>
                    Cụ Nguyễn Văn An (Nhà của tôi)
                  </Text>
                  <Text style={[styles.footerDoctor, { color: isDarkMode ? '#64748B' : '#94A3B8' }]} numberOfLines={1}>
                    BS: {rx.doctor_name || 'BS. Trần Văn Minh'}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={styles.rxEditBtn}
                    onPress={() => handleOpenEditModal(rx)}
                  >
                    <Ionicons name="pencil" size={13} color="#0284C7" style={{ marginRight: 4 }} />
                    <Text style={styles.rxEditBtnText}>Sửa</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.rxDeleteBtn}
                    onPress={() => handleDeleteRx(rx.id, rx.medication_name)}
                  >
                    <Ionicons name="trash-outline" size={13} color="#EF4444" style={{ marginRight: 4 }} />
                    <Text style={styles.rxDeleteBtnText}>Ngừng thuốc</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* ================================================================= */}
      {/* MODAL KÊ ĐƠN MỚI / CHỈNH SỬA ĐƠN THUỐC                            */}
      {/* ================================================================= */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {editingRxId ? 'Chỉnh Sửa Đơn Thuốc' : 'Kê Đơn Thuốc Mới'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Bệnh nhân tiếp nhận</Text>
            <View style={[styles.patientSelector, { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6' }]}>
              <Text style={[styles.patientSelectorText, { color: colors.textPrimary }]}>
                👤 Cụ Nguyễn Văn An (78 tuổi - 123 Hải Phòng, Đà Nẵng)
              </Text>
            </View>

            <Text style={styles.fieldLabel}>Tên thuốc y khoa (*)</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="VD: Vastarel 20mg, Amlodipine 5mg..."
              placeholderTextColor="#94A3B8"
              value={medName}
              onChangeText={setMedName}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Liều dùng (*)</Text>
                <TextInput
                  style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                  placeholder="VD: 1 viên"
                  placeholderTextColor="#94A3B8"
                  value={dosage}
                  onChangeText={setDosage}
                />
              </View>
              <View style={{ flex: 1.3 }}>
                <Text style={styles.fieldLabel}>Tần suất</Text>
                <TextInput
                  style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                  placeholder="VD: Ngày 2 lần (Sáng / Tối)"
                  placeholderTextColor="#94A3B8"
                  value={frequency}
                  onChangeText={setFrequency}
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Giờ nhắc uống thuốc (cách nhau bởi dấu phẩy)</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="VD: 08:00, 19:30"
              placeholderTextColor="#94A3B8"
              value={scheduleTimes}
              onChangeText={setScheduleTimes}
            />

            <Text style={styles.fieldLabel}>Hướng dẫn chi tiết của Bác sĩ</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="VD: Uống sau ăn no, uống nhiều nước ấm..."
              placeholderTextColor="#94A3B8"
              value={instructions}
              onChangeText={setInstructions}
            />

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.switchTitle, { color: colors.textPrimary }]}>
                  Phát loa tiếng Việt trên Hub Orange Pi 5
                </Text>
                <Text style={styles.switchSub}>Tự động phát lời nhắc bằng giọng nói tiếng Việt đến cụ</Text>
              </View>
              <Switch
                value={enableSpeaker}
                onValueChange={setEnableSpeaker}
                trackColor={{ false: '#94A3B8', true: Colors.primary }}
              />
            </View>

            <TouchableOpacity
              style={[styles.modalSubmitBtn, isSubmitting && { opacity: 0.7 }]}
              onPress={handleSaveRx}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>
                  {editingRxId ? 'Cập Nhật Đơn Thuốc' : 'Lưu Đơn Thuốc & Đồng Bộ Hub'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  headerSub: { fontSize: 12, marginTop: 2 },
  btnAddHeader: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  statBox: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  statNumber: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 10, color: '#64748B', marginTop: 2, textAlign: 'center' },

  scrollContent: { padding: 16, paddingBottom: 95 },
  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 14, marginTop: 10 },

  rxCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  rxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rxMedName: { fontSize: 16, fontWeight: '800' },
  rxDosage: { fontSize: 13, marginTop: 2 },

  speakerToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  speakerToggleBtnText: { fontSize: 10, fontWeight: '700' },

  scheduleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, flexWrap: 'wrap', gap: 6 },
  scheduleLabel: { fontSize: 12 },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  timeBadgeText: { fontSize: 11, color: '#2563EB', fontWeight: '700' },

  instructionsText: { fontSize: 13, marginTop: 8, fontStyle: 'italic', lineHeight: 18 },

  rxFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  footerText: { fontSize: 11, fontWeight: '600' },
  footerDoctor: { fontSize: 10, marginTop: 2 },

  rxEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  rxEditBtnText: { fontSize: 11, color: '#0284C7', fontWeight: '700' },
  rxDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  rxDeleteBtnText: { fontSize: 11, color: '#EF4444', fontWeight: '700' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalBox: {
    borderRadius: 18,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', marginTop: 10, marginBottom: 5 },
  inputField: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  patientSelector: { padding: 10, borderRadius: 8, marginBottom: 4 },
  patientSelectorText: { fontSize: 13, fontWeight: '600' },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 6,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  switchTitle: { fontSize: 13, fontWeight: '700' },
  switchSub: { fontSize: 11, color: '#94A3B8', marginTop: 2 },

  modalSubmitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  modalSubmitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});

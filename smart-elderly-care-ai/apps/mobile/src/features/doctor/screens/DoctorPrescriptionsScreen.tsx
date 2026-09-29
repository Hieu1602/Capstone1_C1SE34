// DoctorPrescriptionsScreen.tsx
// Quản lý toàn bộ đơn thuốc và lịch nhắc nhở y tế của các bệnh nhân phụ trách

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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../../theme/colors';
import { useTheme } from '../../../store/useThemeStore';
import { doctorApi } from '../../../services/api';

export default function DoctorPrescriptionsScreen() {
  const insets = useSafeAreaInsets();
  const { isDarkMode, colors } = useTheme();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);

  // Modal Kê đơn
  const [modalVisible, setModalVisible] = useState(false);
  const [medName, setMedName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('Hàng ngày');
  const [instructions, setInstructions] = useState('');
  const [enableSpeaker, setEnableSpeaker] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRx = useCallback(async () => {
    try {
      setLoading(true);
      const res = await doctorApi.getPrescriptions('e0000000-b4e1-4b08-b2d3-d949a0eb075c');
      if (res.data && Array.isArray(res.data)) {
        setPrescriptions(res.data);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRx();
  }, [fetchRx]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRx();
  };

  const handleCreateRx = async () => {
    if (!medName.trim() || !dosage.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên thuốc và liều lượng.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        medication_name: medName.trim(),
        dosage: dosage.trim(),
        frequency,
        schedule_times: ['08:00', '19:30'],
        instructions: instructions.trim() || 'Uống sau ăn 15 phút với nước ấm.',
        enable_speaker_reminder: enableSpeaker,
      };

      const res = await doctorApi.createPrescription('e0000000-b4e1-4b08-b2d3-d949a0eb075c', payload);
      if (res.data) {
        setPrescriptions([res.data, ...prescriptions]);
        setModalVisible(false);
        setMedName('');
        setDosage('');
        setInstructions('');
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

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Header */}
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
            <Text style={[styles.headerSubtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Phác đồ điều trị & Lịch nhắc
            </Text>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Đơn Thuốc Y Khoa</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Info Banner */}
        <View style={styles.hubSyncBanner}>
          <Ionicons name="volume-high" size={18} color="#059669" />
          <Text style={styles.hubSyncText}>
            Tự động đồng bộ lịch nhắc xuống Loa thông minh Hub Orange Pi 5 (Tiếng Việt)
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {loading && !refreshing && (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 20 }} />
        )}

        {prescriptions.map((rx) => (
          <View
            key={rx.id}
            style={[
              styles.rxCard,
              { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border },
            ]}
          >
            <View style={styles.rxHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.rxMedName, { color: colors.textPrimary }]}>
                    💊 {rx.medication_name}
                  </Text>
                </View>
                <Text style={[styles.rxDosage, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  {rx.dosage} • {rx.frequency}
                </Text>
              </View>

              {rx.enable_speaker_reminder && (
                <View style={styles.speakerTag}>
                  <Ionicons name="mic-outline" size={12} color="#059669" />
                  <Text style={styles.speakerTagText}>Loa Hub</Text>
                </View>
              )}
            </View>

            <View style={styles.scheduleRow}>
              <Text style={[styles.scheduleLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                Giờ nhắc uống:
              </Text>
              {(rx.schedule_times || ['08:00']).map((t: string, idx: number) => (
                <View key={idx} style={styles.timeBadge}>
                  <Ionicons name="time-outline" size={12} color="#2563EB" style={{ marginRight: 2 }} />
                  <Text style={styles.timeBadgeText}>{t}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.instructionsText, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>
              📝 Dặn dò: {rx.instructions}
            </Text>

            <View style={styles.rxFooter}>
              <Text style={[styles.footerText, { color: isDarkMode ? '#64748B' : '#94A3B8' }]}>
                Bệnh nhân: Cụ Nguyễn Văn An
              </Text>
              <Text style={[styles.footerText, { color: isDarkMode ? '#64748B' : '#94A3B8' }]}>
                {rx.created_at?.split(' ')[0]}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* MODAL KÊ ĐƠN MỚI */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Kê Đơn Thuốc Mới</Text>
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

            <Text style={styles.fieldLabel}>Liều dùng (*)</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="VD: 1 viên sau ăn sáng..."
              placeholderTextColor="#94A3B8"
              value={dosage}
              onChangeText={setDosage}
            />

            <Text style={styles.fieldLabel}>Tần suất</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="VD: Ngày 2 lần (Sáng / Tối)"
              placeholderTextColor="#94A3B8"
              value={frequency}
              onChangeText={setFrequency}
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
                <Text style={styles.switchSub}>Đến giờ hẹn, loa tại nhà cụ sẽ tự động phát giọng nói nhắc nhở</Text>
              </View>
              <Switch
                value={enableSpeaker}
                onValueChange={setEnableSpeaker}
                trackColor={{ false: '#94A3B8', true: Colors.primary }}
              />
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleCreateRx} disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Lưu Đơn Thuốc & Kích Hoạt Nhắc Nhở</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerSubtitle: { fontSize: 12, fontWeight: '500' },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hubSyncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  hubSyncText: { fontSize: 11, color: '#065F46', fontWeight: '600', flex: 1 },
  listContent: { padding: 16, paddingBottom: 80 },
  rxCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  rxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rxMedName: { fontSize: 16, fontWeight: '700' },
  rxDosage: { fontSize: 12, marginTop: 2 },
  speakerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  speakerTagText: { fontSize: 10, fontWeight: '700', color: '#059669' },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 },
  scheduleLabel: { fontSize: 12 },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  timeBadgeText: { fontSize: 11, fontWeight: '700', color: '#1D4ED8' },
  instructionsText: { fontSize: 12, marginTop: 8, lineHeight: 18 },
  rxFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F044',
  },
  footerText: { fontSize: 11 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#64748B', marginTop: 10, marginBottom: 4 },
  patientSelector: { padding: 10, borderRadius: 8 },
  patientSelectorText: { fontSize: 12, fontWeight: '600' },
  inputField: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 10,
  },
  switchTitle: { fontSize: 13, fontWeight: '600' },
  switchSub: { fontSize: 11, color: '#94A3B8' },
  submitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 14,
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});

// DoctorPrescriptionsScreen.tsx
// Quản lý toàn bộ đơn thuốc, danh mục điều trị và đồng bộ lịch phát loa thông minh Hub AI

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../../theme/colors';
import { useTheme } from '../../../store/useThemeStore';
import { doctorApi } from '../../../services/api';
import {
  PrescriptionItem,
  PrescriptionHeaderStats,
  PrescriptionCardItem,
  PrescriptionFormModal,
} from '../components';

export type { PrescriptionItem };

export default function DoctorPrescriptionsScreen() {
  const insets = useSafeAreaInsets();
  const { isDarkMode, colors } = useTheme();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);

  // Modal Kê đơn / Sửa đơn
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRxId, setEditingRxId] = useState<string | null>(null);
  const [medName, setMedName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [scheduleTimes, setScheduleTimes] = useState('');
  const [instructions, setInstructions] = useState('');
  const [enableSpeaker, setEnableSpeaker] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRx = useCallback(async () => {
    try {
      setLoading(true);
      const patRes = await doctorApi.getPatients();
      if (patRes.data && Array.isArray(patRes.data)) {
        setPatients(patRes.data);
        const curPat = selectedPatient || patRes.data[0];
        if (curPat) {
          setSelectedPatient(curPat);
          const rxRes = await doctorApi.getPrescriptions(curPat.id);
          setPrescriptions(rxRes.data && Array.isArray(rxRes.data) ? rxRes.data : []);
        }
      }
    } catch {
      // Giữ dữ liệu hiện tại
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPatient]);

  useEffect(() => {
    fetchRx();
  }, [fetchRx]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRx();
  };

  const handleSelectPatient = async (pat: any) => {
    setSelectedPatient(pat);
    try {
      setLoading(true);
      const res = await doctorApi.getPrescriptions(pat.id);
      setPrescriptions(res.data && Array.isArray(res.data) ? res.data : []);
    } catch {
      setPrescriptions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingRxId(null);
    setMedName('');
    setDosage('');
    setFrequency('');
    setScheduleTimes('');
    setInstructions('');
    setEnableSpeaker(true);
    setModalVisible(true);
  };

  const handleOpenEditModal = (rx: PrescriptionItem) => {
    setEditingRxId(rx.id);
    setMedName(rx.medication_name);
    setDosage(rx.dosage);
    setFrequency(rx.frequency);
    setScheduleTimes((rx.schedule_times || []).join(', '));
    setInstructions(rx.instructions);
    setEnableSpeaker(rx.enable_speaker_reminder);
    setModalVisible(true);
  };

  const handleSaveRx = async () => {
    if (!medName.trim() || !dosage.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên thuốc và liều lượng.');
      return;
    }

    const curPatId = selectedPatient?.id || patients[0]?.id;
    if (!curPatId) {
      Alert.alert('Thiếu thông tin', 'Chưa có thông tin bệnh nhân để kê đơn.');
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
        instructions: instructions.trim() || '',
        enable_speaker_reminder: enableSpeaker,
      };

      if (editingRxId) {
        const res = await doctorApi.updatePrescription(curPatId, editingRxId, payload);
        if (res.data) {
          setPrescriptions((prev) =>
            prev.map((r) => (r.id === editingRxId ? res.data : r))
          );
        }
        setModalVisible(false);
        Alert.alert('Thành công', `Đã cập nhật đơn thuốc "${payload.medication_name}".`);
      } else {
        const res = await doctorApi.createPrescription(curPatId, payload);
        if (res.data) {
          setPrescriptions([res.data, ...prescriptions]);
        }
        setModalVisible(false);
        Alert.alert(
          'Đã lưu đơn thuốc',
          `Đã kê đơn "${payload.medication_name}". Hub AI sẽ tự động phát loa nhắc bệnh nhân uống đúng giờ.`
        );
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể kết nối lưu đơn thuốc.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRx = (rxId: string, name: string) => {
    const curPatId = selectedPatient?.id || patients[0]?.id;
    if (!curPatId) return;

    const doDelete = async () => {
      try {
        await doctorApi.deletePrescription(curPatId, rxId);
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
      { text: 'Ngừng thuốc', style: 'destructive', onPress: doDelete },
    ]);
  };

  const handleToggleSpeaker = async (rxId: string) => {
    const curPatId = selectedPatient?.id || patients[0]?.id;
    if (!curPatId) return;

    try {
      const res = await doctorApi.togglePrescriptionReminder(curPatId, rxId);
      if (res.data) {
        setPrescriptions((prev) =>
          prev.map((r) => (r.id === rxId ? { ...r, enable_speaker_reminder: res.data.enable_speaker_reminder } : r))
        );
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể cập nhật trạng thái nhắc loa.');
    }
  };

  const patientLabel = selectedPatient
    ? `${selectedPatient.name}${selectedPatient.age ? ` (${selectedPatient.age} tuổi)` : ''}`
    : 'Chưa chọn bệnh nhân';

  const patientFooterText = selectedPatient?.name
    ? `${selectedPatient.name}${selectedPatient.house_name ? ` (${selectedPatient.house_name})` : ''}`
    : '';

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* HEADER & QUICK STATS */}
      <PrescriptionHeaderStats
        prescriptionsCount={prescriptions.length}
        speakerCount={prescriptions.filter((r) => r.enable_speaker_reminder).length}
        patientsCount={patients.length}
        patients={patients}
        selectedPatient={selectedPatient}
        onSelectPatient={handleSelectPatient}
        onAddPress={handleOpenCreateModal}
        insetsTop={insets.top}
        isDarkMode={isDarkMode}
        colors={colors}
      />

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
              Chưa có đơn thuốc nào được kê cho bệnh nhân này.
            </Text>
          </View>
        ) : (
          prescriptions.map((rx) => (
            <PrescriptionCardItem
              key={rx.id}
              prescription={rx}
              patientName={patientFooterText}
              onToggleSpeaker={handleToggleSpeaker}
              onEdit={handleOpenEditModal}
              onDelete={handleDeleteRx}
              isDarkMode={isDarkMode}
              colors={colors}
            />
          ))
        )}
      </ScrollView>

      {/* MODAL KÊ ĐƠN / SỬA ĐƠN */}
      <PrescriptionFormModal
        visible={modalVisible}
        isEditing={Boolean(editingRxId)}
        medName={medName}
        dosage={dosage}
        frequency={frequency}
        scheduleTimes={scheduleTimes}
        instructions={instructions}
        enableSpeaker={enableSpeaker}
        onChangeMedName={setMedName}
        onChangeDosage={setDosage}
        onChangeFrequency={setFrequency}
        onChangeScheduleTimes={setScheduleTimes}
        onChangeInstructions={setInstructions}
        onToggleEnableSpeaker={setEnableSpeaker}
        isSubmitting={isSubmitting}
        onSave={handleSaveRx}
        onClose={() => setModalVisible(false)}
        isDarkMode={isDarkMode}
        colors={colors}
        patientName={patientLabel}
        customTitle={editingRxId ? 'Chỉnh Sửa Đơn Thuốc' : 'Kê Đơn Thuốc Mới'}
        customSubmitText={editingRxId ? 'Cập Nhật Đơn Thuốc' : 'Lưu Đơn Thuốc & Đồng Bộ Hub'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 95 },
  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 14, marginTop: 10 },
});

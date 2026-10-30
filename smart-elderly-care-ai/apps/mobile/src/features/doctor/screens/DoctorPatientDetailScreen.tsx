// DoctorPatientDetailScreen.tsx
// Chi tiết hồ sơ bệnh nhân, quản lý phác đồ điều trị, danh mục bệnh lý, dị ứng, dinh dưỡng & kê đơn thuốc cho Bác sĩ

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Colors } from '../../../theme/colors';
import { useTheme } from '../../../store/useThemeStore';
import { doctorApi } from '../../../services/api';

import {
  ConditionItem,
  PrescriptionItem,
  MedicationFormItem,
  PatientDetail,
  SeverityType,
  PatientHeroCard,
  PatientRecordTab,
  PatientPrescriptionsTab,
  PatientVitalsTab,
  DoctorNotesModal,
  ConditionFormModal,
  AllergiesDietModal,
  PrescriptionFormModal,
  ThresholdsConfigModal,
} from '../components';

export default function DoctorPatientDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDarkMode, colors } = useTheme();

  const patientId = route.params?.patientId || '';

  const [activeTab, setActiveTab] = useState<'RECORD' | 'PRESCRIPTIONS' | 'VITALS'>('RECORD');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<PatientDetail | null>(null);
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);

  // 1. Modal ghi chú bác sĩ & lịch tái khám
  const [modalNotesVisible, setModalNotesVisible] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editNextAppt, setEditNextAppt] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // 2. Modal bệnh lý nền
  const [modalConditionVisible, setModalConditionVisible] = useState(false);
  const [editingConditionId, setEditingConditionId] = useState<string | null>(null);
  const [condName, setCondName] = useState('');
  const [condSeverity, setCondSeverity] = useState<SeverityType>('warning');
  const [condNote, setCondNote] = useState('');
  const [isSavingCondition, setIsSavingCondition] = useState(false);

  // 3. Modal dị ứng & dinh dưỡng
  const [modalAllergiesDietVisible, setModalAllergiesDietVisible] = useState(false);
  const [editDrugAllergies, setEditDrugAllergies] = useState('');
  const [editFoodAllergies, setEditFoodAllergies] = useState('');
  const [editDietaryNotes, setEditDietaryNotes] = useState('');
  const [isSavingAllergies, setIsSavingAllergies] = useState(false);

  // 4. Modal đơn thuốc (hỗ trợ nhiều loại thuốc & số lượng)
  const [modalPrescribeVisible, setModalPrescribeVisible] = useState(false);
  const [editingRxId, setEditingRxId] = useState<string | null>(null);
  const [medName, setMedName] = useState('');
  const [rxQuantity, setRxQuantity] = useState('30 viên');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('Hàng ngày');
  const [scheduleTimes, setScheduleTimes] = useState('08:00');
  const [instructions, setInstructions] = useState('');
  const [enableSpeaker, setEnableSpeaker] = useState(true);
  const [isSubmittingRx, setIsSubmittingRx] = useState(false);

  // Kê đơn đa loại thuốc cùng lúc
  const [rxDiagnosis, setRxDiagnosis] = useState('Đơn thuốc điều trị');
  const [rxGeneralNotes, setRxGeneralNotes] = useState('');
  const [batchMedications, setBatchMedications] = useState<MedicationFormItem[]>([
    {
      medication_name: '',
      quantity: '30 viên',
      dosage: '1 viên/lần',
      frequency: 'Hàng ngày',
      schedule_times: '08:00',
      instructions: 'Uống sau ăn 15 phút',
    },
  ]);

  // 5. Modal ngưỡng y tế
  const [modalThresholdVisible, setModalThresholdVisible] = useState(false);
  const [hrHigh, setHrHigh] = useState('120');
  const [hrLow, setHrLow] = useState('50');
  const [spo2Low, setSpo2Low] = useState('90');

  // Tải chi tiết bệnh nhân & đơn thuốc
  const fetchDetail = useCallback(async () => {
    if (!patientId) return;
    try {
      setLoading(true);
      const [resDetail, resRx] = await Promise.all([
        doctorApi.getPatientDetail(patientId),
        doctorApi.getPrescriptions(patientId),
      ]);
      if (resDetail.data) {
        setDetail(resDetail.data);
        setEditNotes(resDetail.data.doctor_notes || '');
        setEditNextAppt(resDetail.data.next_appointment || '');
        setEditDrugAllergies(resDetail.data.drug_allergies || '');
        setEditFoodAllergies(resDetail.data.food_allergies || '');
        setEditDietaryNotes(resDetail.data.dietary_notes || '');
      }
      if (resRx.data && Array.isArray(resRx.data)) {
        setPrescriptions(resRx.data);
      }
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDetail();
  };

  // Lưu ghi chú & lịch tái khám
  const handleOpenNotesModal = () => {
    setEditNotes(detail?.doctor_notes || '');
    setEditNextAppt(detail?.next_appointment || '');
    setModalNotesVisible(true);
  };

  const handleSaveNotes = async () => {
    try {
      setIsSavingNotes(true);
      const res = await doctorApi.updateMedicalRecord(patientId, {
        doctor_notes: editNotes.trim(),
        next_appointment: editNextAppt.trim(),
      });
      if (res.data) setDetail(res.data);
      setModalNotesVisible(false);
      Alert.alert('Thành công', 'Đã cập nhật ghi chú y khoa và lịch hẹn tái khám.');
    } catch {
      Alert.alert('Lỗi', 'Không thể kết nối lưu ghi chú.');
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Thêm / Sửa / Xóa bệnh lý nền
  const handleOpenAddCondition = () => {
    setEditingConditionId(null);
    setCondName('');
    setCondSeverity('warning');
    setCondNote('');
    setModalConditionVisible(true);
  };

  const handleOpenEditCondition = (c: ConditionItem) => {
    setEditingConditionId(c.id);
    setCondName(c.name);
    setCondSeverity(c.severity);
    setCondNote(c.note);
    setModalConditionVisible(true);
  };

  const handleSaveCondition = async () => {
    if (!condName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên bệnh lý hoặc chẩn đoán.');
      return;
    }

    try {
      setIsSavingCondition(true);
      const current: ConditionItem[] = detail?.conditions ? [...detail.conditions] : [];
      const updatedConditions = editingConditionId
        ? current.map((item) =>
            item.id === editingConditionId
              ? { ...item, name: condName.trim(), severity: condSeverity, note: condNote.trim() }
              : item
          )
        : [{ id: `c-${Date.now()}`, name: condName.trim(), severity: condSeverity, note: condNote.trim() }, ...current];

      const res = await doctorApi.updateMedicalRecord(patientId, { conditions: updatedConditions });
      if (res.data) setDetail(res.data);
      setModalConditionVisible(false);
      Alert.alert('Thành công', editingConditionId ? 'Đã cập nhật chẩn đoán.' : 'Đã thêm bệnh lý mới.');
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu danh mục bệnh lý.');
    } finally {
      setIsSavingCondition(false);
    }
  };

  const handleDeleteCondition = (condId: string, name: string) => {
    const doDelete = async () => {
      try {
        const current: ConditionItem[] = detail?.conditions ? [...detail.conditions] : [];
        const updated = current.filter((c) => c.id !== condId);
        const res = await doctorApi.updateMedicalRecord(patientId, { conditions: updated });
        if (res.data) setDetail(res.data);
      } catch {
        Alert.alert('Lỗi', 'Không thể xóa chẩn đoán.');
      }
    };

    Alert.alert('Xác nhận xóa', `Bác sĩ có chắc chắn muốn xóa "${name}"?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: doDelete },
    ]);
  };

  // Lưu dị ứng & dinh dưỡng
  const handleOpenAllergiesDietModal = () => {
    setEditDrugAllergies(detail?.drug_allergies || '');
    setEditFoodAllergies(detail?.food_allergies || '');
    setEditDietaryNotes(detail?.dietary_notes || '');
    setModalAllergiesDietVisible(true);
  };

  const handleSaveAllergiesDiet = async () => {
    try {
      setIsSavingAllergies(true);
      const res = await doctorApi.updateMedicalRecord(patientId, {
        drug_allergies: editDrugAllergies.trim(),
        food_allergies: editFoodAllergies.trim(),
        dietary_notes: editDietaryNotes.trim(),
      });
      if (res.data) setDetail(res.data);
      setModalAllergiesDietVisible(false);
      Alert.alert('Thành công', 'Đã cập nhật dị ứng và dinh dưỡng.');
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu dị ứng & dinh dưỡng.');
    } finally {
      setIsSavingAllergies(false);
    }
  };

  // Kê đơn / Sửa / Xóa / Loa đơn thuốc
  const handleOpenCreatePrescription = () => {
    setEditingRxId(null);
    setRxDiagnosis('Đơn thuốc điều trị');
    setRxGeneralNotes('');
    setBatchMedications([
      {
        medication_name: '',
        quantity: '30 viên',
        dosage: '1 viên/lần',
        frequency: 'Hàng ngày',
        schedule_times: '08:00',
        instructions: 'Uống sau ăn 15 phút',
      },
    ]);
    setEnableSpeaker(true);
    setModalPrescribeVisible(true);
  };

  const handleOpenEditPrescription = (rx: PrescriptionItem) => {
    setEditingRxId(rx.id);
    setMedName(rx.medication_name);
    setRxQuantity(rx.quantity || '30 viên');
    setDosage(rx.dosage);
    setFrequency(rx.frequency || 'Hàng ngày');
    setScheduleTimes((rx.schedule_times || ['08:00']).join(', '));
    setInstructions(rx.instructions || '');
    setEnableSpeaker(rx.enable_speaker_reminder);
    setModalPrescribeVisible(true);
  };

  const handleAddMedicationRow = () => {
    setBatchMedications((prev) => [
      ...prev,
      {
        medication_name: '',
        quantity: '30 viên',
        dosage: '1 viên/lần',
        frequency: 'Hàng ngày',
        schedule_times: '08:00',
        instructions: 'Uống sau ăn 15 phút',
      },
    ]);
  };

  const handleRemoveMedicationRow = (index: number) => {
    if (batchMedications.length <= 1) return;
    setBatchMedications((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateMedicationRow = (index: number, field: keyof MedicationFormItem, value: string) => {
    setBatchMedications((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const handleSavePrescription = async () => {
    if (editingRxId) {
      if (!medName.trim() || !dosage.trim()) {
        Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên thuốc và liều lượng.');
        return;
      }

      try {
        setIsSubmittingRx(true);
        const parsedTimes = scheduleTimes.split(',').map((t) => t.trim()).filter(Boolean);
        const payload = {
          medication_name: medName.trim(),
          quantity: rxQuantity.trim() || undefined,
          dosage: dosage.trim(),
          frequency: frequency.trim() || 'Hàng ngày',
          schedule_times: parsedTimes.length > 0 ? parsedTimes : ['08:00'],
          instructions: instructions.trim(),
          enable_speaker_reminder: enableSpeaker,
        };

        const res = await doctorApi.updatePrescription(patientId, editingRxId, payload);
        if (res.data) {
          setPrescriptions((prev) => prev.map((rx) => (rx.id === editingRxId ? res.data : rx)));
        }
        setModalPrescribeVisible(false);
        Alert.alert('Thành công', `Đã cập nhật đơn thuốc "${payload.medication_name}".`);
      } catch {
        Alert.alert('Lỗi', 'Không thể lưu đơn thuốc.');
      } finally {
        setIsSubmittingRx(false);
      }
    } else {
      for (let i = 0; i < batchMedications.length; i++) {
        const m = batchMedications[i];
        if (!m.medication_name.trim() || !m.dosage.trim()) {
          Alert.alert('Thiếu thông tin', `Vui lòng nhập tên và liều dùng cho thuốc #${i + 1}.`);
          return;
        }
      }

      try {
        setIsSubmittingRx(true);
        const batchPayload = {
          diagnosis: rxDiagnosis.trim() || 'Đơn thuốc điều trị',
          general_notes: rxGeneralNotes.trim() || undefined,
          enable_speaker_reminder: enableSpeaker,
          medications: batchMedications.map((m) => {
            const parsedTimes = m.schedule_times.split(',').map((t) => t.trim()).filter(Boolean);
            return {
              medication_name: m.medication_name.trim(),
              quantity: m.quantity.trim() || undefined,
              dosage: m.dosage.trim(),
              frequency: m.frequency.trim() || 'Hàng ngày',
              schedule_times: parsedTimes.length > 0 ? parsedTimes : ['08:00'],
              instructions: m.instructions.trim() || undefined,
            };
          }),
        };

        const res = await doctorApi.createBatchPrescriptions(patientId, batchPayload);
        if (res.data && Array.isArray(res.data)) {
          setPrescriptions((prev) => [...res.data, ...prev]);
        }
        setModalPrescribeVisible(false);
        Alert.alert(
          'Kê đơn thành công',
          `Đã lưu đơn thuốc gồm ${batchPayload.medications.length} loại thuốc. Lịch nhắc đã đồng bộ qua Hub AI!`
        );
      } catch {
        Alert.alert('Lỗi', 'Không thể lưu đơn thuốc.');
      } finally {
        setIsSubmittingRx(false);
      }
    }
  };

  const handleDeletePrescription = (rxId: string, name: string) => {
    const doDelete = async () => {
      try {
        await doctorApi.deletePrescription(patientId, rxId);
        setPrescriptions((prev) => prev.filter((r) => r.id !== rxId));
        Alert.alert('Đã ngừng thuốc', `Đã loại bỏ "${name}" khỏi phác đồ.`);
      } catch {
        Alert.alert('Lỗi', 'Không thể ngừng thuốc.');
      }
    };

    Alert.alert('Ngừng dùng thuốc', `Bác sĩ có chắc chắn muốn ngừng kê đơn thuốc "${name}"?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Ngừng thuốc', style: 'destructive', onPress: doDelete },
    ]);
  };

  const handleToggleSpeakerReminder = async (rxId: string) => {
    try {
      const res = await doctorApi.togglePrescriptionReminder(patientId, rxId);
      if (res.data) {
        setPrescriptions((prev) =>
          prev.map((r) => (r.id === rxId ? { ...r, enable_speaker_reminder: res.data.enable_speaker_reminder } : r))
        );
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể thay đổi cài đặt loa.');
    }
  };

  const handleSaveThresholds = async () => {
    try {
      await doctorApi.updateThresholds(patientId, {
        hr_threshold_high: parseInt(hrHigh, 10),
        hr_threshold_low: parseInt(hrLow, 10),
        spo2_threshold_low: parseInt(spo2Low, 10),
      });
      setModalThresholdVisible(false);
      Alert.alert('Cập nhật thành công', 'Đã lưu ngưỡng an toàn y tế và đồng bộ xuống Hub AI.');
    } catch {
      Alert.alert('Lỗi', 'Không thể cập nhật ngưỡng.');
    }
  };

  const handleNavigateAnalytics = () => {
    navigation.navigate('DoctorAnalytics', {
      patientId,
      patient: detail
        ? {
            id: String(detail.id || patientId),
            name: detail.name || 'Bệnh nhân',
            age: detail.age ?? 0,
            gender: detail.gender ?? '',
            condition: detail.conditions?.map((c) => c.name).join(', ') || '',
            deviceId: '',
            houseName: detail.house_name ? `${detail.house_name}${detail.house_address ? ` • ${detail.house_address}` : ''}` : undefined,
            bloodPressure: detail.blood_pressure,
            heartRate: detail.heart_rate,
            spo2: detail.spo2,
            healthStatus: 'NORMAL',
          }
        : undefined,
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Top Header */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + 8,
            backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.textPrimary }]}>Hồ sơ Bệnh nhân Y tế</Text>
        <TouchableOpacity style={styles.moreBtn} onPress={() => setModalThresholdVisible(true)}>
          <Ionicons name="options-outline" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {loading && !refreshing && (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 10 }} />
        )}

        {/* Hero Card */}
        <PatientHeroCard
          detail={detail}
          isDarkMode={isDarkMode}
          colors={colors}
          onViewAnalytics={handleNavigateAnalytics}
        />

        {/* 3 Tab chức năng */}
        <View style={[styles.segmentContainer, { backgroundColor: isDarkMode ? '#1E293B' : '#EEF2F6' }]}>
          {[
            { key: 'RECORD', label: 'Bệnh án' },
            { key: 'PRESCRIPTIONS', label: `Đơn thuốc (${prescriptions.length})` },
            { key: 'VITALS', label: 'Sinh hiệu & Ngưỡng' },
          ].map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.segmentBtn, active && [styles.segmentBtnActive, { backgroundColor: isDarkMode ? '#334155' : '#FFFFFF' }]]}
                onPress={() => setActiveTab(tab.key as any)}
                activeOpacity={0.8}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.segmentText,
                    active
                      ? { color: Colors.primary, fontWeight: '700' }
                      : { color: isDarkMode ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* TAB 1: BỆNH ÁN & TIỀN SỬ Y KHOA */}
        {activeTab === 'RECORD' && (
          <PatientRecordTab
            detail={detail}
            isDarkMode={isDarkMode}
            colors={colors}
            onOpenNotesModal={handleOpenNotesModal}
            onOpenAddCondition={handleOpenAddCondition}
            onOpenEditCondition={handleOpenEditCondition}
            onDeleteCondition={handleDeleteCondition}
            onOpenAllergiesDietModal={handleOpenAllergiesDietModal}
          />
        )}

        {/* TAB 2: ĐƠN THUỐC */}
        {activeTab === 'PRESCRIPTIONS' && (
          <PatientPrescriptionsTab
            prescriptions={prescriptions}
            isDarkMode={isDarkMode}
            colors={colors}
            onOpenCreatePrescription={handleOpenCreatePrescription}
            onOpenEditPrescription={handleOpenEditPrescription}
            onDeletePrescription={handleDeletePrescription}
            onToggleSpeakerReminder={handleToggleSpeakerReminder}
          />
        )}

        {/* TAB 3: NGƯỠNG AN TOÀN Y TẾ */}
        {activeTab === 'VITALS' && (
          <PatientVitalsTab
            hrHigh={hrHigh}
            hrLow={hrLow}
            spo2Low={spo2Low}
            isDarkMode={isDarkMode}
            colors={colors}
            onOpenThresholdModal={() => setModalThresholdVisible(true)}
            onViewAnalytics={handleNavigateAnalytics}
          />
        )}
      </ScrollView>

      {/* Modals */}
      <DoctorNotesModal
        visible={modalNotesVisible}
        notes={editNotes}
        nextAppt={editNextAppt}
        onChangeNotes={setEditNotes}
        onChangeNextAppt={setEditNextAppt}
        isSaving={isSavingNotes}
        onSave={handleSaveNotes}
        onClose={() => setModalNotesVisible(false)}
        isDarkMode={isDarkMode}
        colors={colors}
      />

      <ConditionFormModal
        visible={modalConditionVisible}
        isEditing={!!editingConditionId}
        name={condName}
        severity={condSeverity}
        note={condNote}
        onChangeName={setCondName}
        onChangeSeverity={setCondSeverity}
        onChangeNote={setCondNote}
        isSaving={isSavingCondition}
        onSave={handleSaveCondition}
        onClose={() => setModalConditionVisible(false)}
        isDarkMode={isDarkMode}
        colors={colors}
      />

      <AllergiesDietModal
        visible={modalAllergiesDietVisible}
        drugAllergies={editDrugAllergies}
        foodAllergies={editFoodAllergies}
        dietaryNotes={editDietaryNotes}
        onChangeDrugAllergies={setEditDrugAllergies}
        onChangeFoodAllergies={setEditFoodAllergies}
        onChangeDietaryNotes={setEditDietaryNotes}
        isSaving={isSavingAllergies}
        onSave={handleSaveAllergiesDiet}
        onClose={() => setModalAllergiesDietVisible(false)}
        isDarkMode={isDarkMode}
        colors={colors}
      />

      <PrescriptionFormModal
        visible={modalPrescribeVisible}
        isEditing={!!editingRxId}
        patientName={detail?.name}
        diagnosis={rxDiagnosis}
        onChangeDiagnosis={setRxDiagnosis}
        generalNotes={rxGeneralNotes}
        onChangeGeneralNotes={setRxGeneralNotes}
        medications={batchMedications}
        onAddMedication={handleAddMedicationRow}
        onRemoveMedication={handleRemoveMedicationRow}
        onUpdateMedication={handleUpdateMedicationRow}
        medName={medName}
        quantity={rxQuantity}
        dosage={dosage}
        frequency={frequency}
        scheduleTimes={scheduleTimes}
        instructions={instructions}
        onChangeMedName={setMedName}
        onChangeQuantity={setRxQuantity}
        onChangeDosage={setDosage}
        onChangeFrequency={setFrequency}
        onChangeScheduleTimes={setScheduleTimes}
        onChangeInstructions={setInstructions}
        enableSpeaker={enableSpeaker}
        onToggleEnableSpeaker={setEnableSpeaker}
        isSubmitting={isSubmittingRx}
        onSave={handleSavePrescription}
        onClose={() => setModalPrescribeVisible(false)}
        isDarkMode={isDarkMode}
        colors={colors}
      />

      <ThresholdsConfigModal
        visible={modalThresholdVisible}
        hrHigh={hrHigh}
        hrLow={hrLow}
        spo2Low={spo2Low}
        onChangeHrHigh={setHrHigh}
        onChangeHrLow={setHrLow}
        onChangeSpo2Low={setSpo2Low}
        onSave={handleSaveThresholds}
        onClose={() => setModalThresholdVisible(false)}
        isDarkMode={isDarkMode}
        colors={colors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  topTitle: { fontSize: 17, fontWeight: '700' },
  moreBtn: { padding: 4 },
  scrollContent: { padding: 16, paddingBottom: 90 },

  segmentContainer: { flexDirection: 'row', borderRadius: 10, padding: 3, marginBottom: 14 },
  segmentBtn: { flex: 1, paddingVertical: 8, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  segmentBtnActive: { backgroundColor: '#FFFFFF', elevation: 1 },
  segmentText: { fontSize: 11.5, fontWeight: '600', textAlign: 'center' },
});

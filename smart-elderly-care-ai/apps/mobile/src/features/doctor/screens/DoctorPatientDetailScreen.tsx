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
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { alertsWS } from '../../../services/websocket';

import { Colors } from '../../../theme/colors';
import { useTheme } from '../../../store/useThemeStore';
import { useDoctorPatientsStore } from '../../../store/useDoctorPatientsStore';
import { doctorApi } from '../../../services/api';

const withTimeout = <T,>(promise: Promise<T>, ms = 8000): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('API Timeout')), ms)),
  ]);

const buildOptimisticDetail = (p: any, fallbackId: string): PatientDetail | null => {
  if (!p) return null;
  return {
    id: String(p.id || fallbackId),
    name: p.name || p.full_name || 'Bệnh nhân',
    age: p.age,
    gender: p.gender,
    blood_type: p.blood_type,
    avatar_url: p.avatar_url,
    house_name: p.house_name,
    house_address: p.house_address,
    heart_rate: p.is_online ? p.heart_rate : null,
    spo2: p.is_online ? p.spo2 : null,
    blood_pressure: p.is_online ? p.blood_pressure : null,
    skin_temp_max: p.is_online ? p.skin_temp_max : null,
  };
};

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

const DEFAULT_MED_ROW: MedicationFormItem = {
  medication_name: '',
  quantity: '30 viên',
  dosage: '1 viên/lần',
  frequency: 'Hàng ngày',
  schedule_times: '08:00',
  instructions: 'Uống sau ăn 15 phút',
};

const showPlatformAlert = (title: string, msg: string, onOk?: () => void) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${msg}`);
    onOk?.();
  } else {
    Alert.alert(title, msg, onOk ? [{ text: 'Đồng ý', onPress: onOk }] : undefined);
  }
};

export default function DoctorPatientDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDarkMode, colors } = useTheme();
  const patientId = String(route.params?.patientId || '');
  const initialPatientParam = route.params?.initialPatient;
  const {
    patients: storePatients,
    patientDetailsCache,
    prescriptionsCache,
    setPatientDetailCache,
    setPrescriptionsCache,
  } = useDoctorPatientsStore();

  const cachedDetail = patientId ? patientDetailsCache[patientId] : undefined;
  const cachedRx = patientId ? prescriptionsCache[patientId] : undefined;
  const storeBasicPatient = storePatients.find((p) => String(p.id) === patientId);
  const initialDetail = cachedDetail || buildOptimisticDetail(initialPatientParam || storeBasicPatient, patientId);

  const [activeTab, setActiveTab] = useState<'RECORD' | 'PRESCRIPTIONS' | 'VITALS'>('RECORD');
  const [loading, setLoading] = useState(!initialDetail);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [detail, setDetail] = useState<PatientDetail | null>(initialDetail);
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>(cachedRx || []);
  const [rxLoaded, setRxLoaded] = useState<boolean>(Boolean(cachedRx));
  const [rxLoading, setRxLoading] = useState(false);

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

  // 4. Modal đơn thuốc
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
  const [rxDiagnosis, setRxDiagnosis] = useState('Đơn thuốc điều trị');
  const [rxGeneralNotes, setRxGeneralNotes] = useState('');
  const [batchMedications, setBatchMedications] = useState<MedicationFormItem[]>([{ ...DEFAULT_MED_ROW }]);

  // 5. Modal ngưỡng y tế
  const [modalThresholdVisible, setModalThresholdVisible] = useState(false);
  const [isSavingThreshold, setIsSavingThreshold] = useState(false);
  const [hrHigh, setHrHigh] = useState('120');
  const [hrLow, setHrLow] = useState('50');
  const [spo2Low, setSpo2Low] = useState('90');

  const fetchDetail = useCallback(async (opts?: { includePrescriptions?: boolean; forceRefresh?: boolean }) => {
    if (!patientId) return;
    const shouldFetchRx = Boolean(opts?.includePrescriptions || activeTab === 'PRESCRIPTIONS');
    try {
      setFetchError(null);
      if (!detail && !opts?.forceRefresh) setLoading(true);
      if (shouldFetchRx && !rxLoaded) setRxLoading(true);

      const tasks: Promise<any>[] = [withTimeout(doctorApi.getPatientDetail(patientId), 8000)];
      if (shouldFetchRx) {
        tasks.push(withTimeout(doctorApi.getPrescriptions(patientId), 8000));
      }

      const results = await Promise.allSettled(tasks);
      const resDetail = results[0];
      const resRx = shouldFetchRx ? results[1] : null;

      if (resDetail.status === 'fulfilled' && resDetail.value?.data) {
        const d = resDetail.value.data;
        setDetail(d);
        setPatientDetailCache(patientId, d);
        setEditNotes(d.doctor_notes || '');
        setEditNextAppt(d.next_appointment || '');
        setEditDrugAllergies(d.drug_allergies || '');
        setEditFoodAllergies(d.food_allergies || '');
        setEditDietaryNotes(d.dietary_notes || '');
        if (d.hr_threshold_low) setHrLow(String(d.hr_threshold_low));
        if (d.hr_threshold_high) setHrHigh(String(d.hr_threshold_high));
        if (d.spo2_threshold_low) setSpo2Low(String(d.spo2_threshold_low));
      } else if (resDetail.status === 'rejected') {
        setFetchError('Không thể tải đầy đủ hồ sơ y tế (kết nối chậm hoặc lỗi máy chủ).');
      }

      if (resRx && resRx.status === 'fulfilled' && Array.isArray(resRx.value?.data)) {
        setPrescriptions(resRx.value.data);
        setPrescriptionsCache(patientId, resRx.value.data);
        setRxLoaded(true);
      }
    } catch {
      setFetchError('Không thể tải dữ liệu hồ sơ bệnh nhân.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setRxLoading(false);
    }
  }, [patientId, activeTab, rxLoaded, detail, setPatientDetailCache, setPrescriptionsCache]);

  const fetchPrescriptionsOnly = useCallback(async () => {
    if (!patientId) return;
    try {
      setRxLoading(true);
      const resRx = await withTimeout(doctorApi.getPrescriptions(patientId), 8000);
      if (Array.isArray(resRx?.data)) {
        setPrescriptions(resRx.data);
        setPrescriptionsCache(patientId, resRx.data);
        setRxLoaded(true);
      }
    } catch {
      // Giữ nguyên dữ liệu đơn thuốc đã cache nếu có
    } finally {
      setRxLoading(false);
    }
  }, [patientId, setPrescriptionsCache]);

  useEffect(() => {
    alertsWS.connect();
    const unsub = alertsWS.subscribe((event: any) => {
      const evtLower = String(event?.type || '').toLowerCase();
      if (evtLower === 'vital_update' || evtLower === 'vitals_update') {
        const pid = event?.patient_id || event?.elderly_id;
        const devId = event?.device_id;
        const devUuid = event?.device_uuid;
        const storePatient = useDoctorPatientsStore.getState().patients.find((p) => String(p.id) === patientId);
        const targetDevId = storePatient?.device_id;
        const matched =
          (pid && String(pid) === patientId) ||
          (targetDevId && (devId === targetDevId || devUuid === targetDevId));

        if (matched) {
          const liveHr = event?.heart_rate != null ? Number(event.heart_rate) : undefined;
          const liveSpo2 = event?.spo2 != null ? Number(event.spo2) : undefined;
          const liveTemp = event?.skin_temp_max != null ? Number(event.skin_temp_max) : undefined;
          setDetail((prev) => {
            if (!prev) return prev;
            const next: PatientDetail = {
              ...prev,
              heart_rate: liveHr !== undefined && liveHr > 0 ? liveHr : prev.heart_rate,
              spo2: liveSpo2 !== undefined && liveSpo2 > 0 ? liveSpo2 : prev.spo2,
              skin_temp_max: liveTemp !== undefined && liveTemp > 0 ? liveTemp : prev.skin_temp_max,
            };
            setPatientDetailCache(patientId, next);
            return next;
          });
        }
        return;
      }

      const aType = event?.alert_type || event?.data?.alert_type;
      if (event?.type === 'ALERT_NEW' && (aType === 'MEDICAL_RECORD_UPDATED' || aType === 'DEVICE_CONFIG_UPDATED')) {
        fetchDetail({ forceRefresh: true });
      }
    });
    return () => unsub();
  }, [fetchDetail, patientId, setPatientDetailCache]);

  useFocusEffect(
    useCallback(() => {
      fetchDetail();
      const timer = setInterval(() => {
        fetchDetail();
      }, 15000);
      return () => clearInterval(timer);
    }, [fetchDetail])
  );

  // Lazy load Đơn thuốc chỉ khi người dùng chuyển sang tab PRESCRIPTIONS
  useEffect(() => {
    if (activeTab === 'PRESCRIPTIONS' && !rxLoaded) {
      fetchPrescriptionsOnly();
    }
  }, [activeTab, rxLoaded, fetchPrescriptionsOnly]);

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
        ? current.map((item) => (item.id === editingConditionId ? { ...item, name: condName.trim(), severity: condSeverity, note: condNote.trim() } : item))
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
    Alert.alert('Xác nhận xóa', `Bác sĩ có chắc chắn muốn xóa "${name}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            const updated = (detail?.conditions || []).filter((c) => c.id !== condId);
            const res = await doctorApi.updateMedicalRecord(patientId, { conditions: updated });
            if (res.data) setDetail(res.data);
          } catch {
            Alert.alert('Lỗi', 'Không thể xóa chẩn đoán.');
          }
        },
      },
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
    setBatchMedications([{ ...DEFAULT_MED_ROW }]);
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
        if (res.data) setPrescriptions((prev) => prev.map((rx) => (rx.id === editingRxId ? res.data : rx)));
        setModalPrescribeVisible(false);
        Alert.alert('Thành công', `Đã cập nhật đơn thuốc "${payload.medication_name}".`);
      } catch {
        Alert.alert('Lỗi', 'Không thể lưu đơn thuốc.');
      } finally {
        setIsSubmittingRx(false);
      }
    } else {
      for (let i = 0; i < batchMedications.length; i++) {
        if (!batchMedications[i].medication_name.trim() || !batchMedications[i].dosage.trim()) {
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
        if (Array.isArray(res.data)) setPrescriptions((prev) => [...res.data, ...prev]);
        setModalPrescribeVisible(false);
        Alert.alert('Kê đơn thành công', `Đã lưu đơn thuốc gồm ${batchPayload.medications.length} loại thuốc. Lịch nhắc đã đồng bộ qua Hub AI!`);
      } catch {
        Alert.alert('Lỗi', 'Không thể lưu đơn thuốc.');
      } finally {
        setIsSubmittingRx(false);
      }
    }
  };

  const handleDeletePrescription = (rxId: string, name: string) => {
    Alert.alert('Ngừng dùng thuốc', `Bác sĩ có chắc chắn muốn ngừng kê đơn thuốc "${name}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Ngừng thuốc',
        style: 'destructive',
        onPress: async () => {
          try {
            await doctorApi.deletePrescription(patientId, rxId);
            setPrescriptions((prev) => prev.filter((r) => r.id !== rxId));
            Alert.alert('Đã ngừng thuốc', `Đã loại bỏ "${name}" khỏi phác đồ.`);
          } catch {
            Alert.alert('Lỗi', 'Không thể ngừng thuốc.');
          }
        },
      },
    ]);
  };

  const handleToggleSpeakerReminder = async (rxId: string) => {
    try {
      const res = await doctorApi.togglePrescriptionReminder(patientId, rxId);
      if (res.data) {
        setPrescriptions((prev) => prev.map((r) => (r.id === rxId ? { ...r, enable_speaker_reminder: res.data.enable_speaker_reminder } : r)));
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể thay đổi cài đặt loa.');
    }
  };

  const handleSaveThresholds = async () => {
    const high = parseInt(hrHigh, 10);
    const low = parseInt(hrLow, 10);
    const spo2 = parseInt(spo2Low, 10);

    if (isNaN(high) || high < 60 || high > 220) return showPlatformAlert('Giá trị không hợp lệ', 'Nhịp tim tối đa phải nằm trong khoảng từ 60 đến 220 bpm.');
    if (isNaN(low) || low < 30 || low >= high) return showPlatformAlert('Giá trị không hợp lệ', 'Nhịp tim tối thiểu phải từ 30 bpm và nhỏ hơn nhịp tim tối đa.');
    if (isNaN(spo2) || spo2 < 70 || spo2 > 100) return showPlatformAlert('Giá trị không hợp lệ', 'Ngưỡng SpO₂ tối thiểu phải từ 70% đến 100%.');

    setIsSavingThreshold(true);
    try {
      await doctorApi.updateThresholds(patientId, { hr_threshold_high: high, hr_threshold_low: low, spo2_threshold_low: spo2 });
      setDetail((prev) => (prev ? { ...prev, hr_threshold_high: high, hr_threshold_low: low, spo2_threshold_low: spo2 } : null));
      fetchDetail();
      showPlatformAlert(
        'Cập nhật ngưỡng thành công',
        `Đã lưu ngưỡng an toàn y tế:\n• Nhịp tim: ${low} - ${high} bpm\n• SpO₂ tối thiểu: ${spo2}%\nDữ liệu đã đồng bộ tức thì xuống Hub AI.`,
        () => setModalThresholdVisible(false)
      );
    } catch {
      showPlatformAlert('Lỗi', 'Không thể cập nhật ngưỡng an toàn y tế.');
    } finally {
      setIsSavingThreshold(false);
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

      <View style={[styles.topBar, { paddingTop: insets.top + 8, backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderBottomColor: colors.border }]}>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDetail({ includePrescriptions: activeTab === 'PRESCRIPTIONS', forceRefresh: true }); }} colors={[Colors.primary]} />}
      >
        {loading && !refreshing && !detail && <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 10 }} />}
        {fetchError && (
          <View style={{ backgroundColor: isDarkMode ? '#450A0A' : '#FEF2F2', borderColor: '#FCA5A5', borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="warning-outline" size={16} color="#DC2626" />
            <Text style={{ flex: 1, fontSize: 12, color: isDarkMode ? '#FCA5A5' : '#991B1B' }}>{fetchError}</Text>
          </View>
        )}

        <PatientHeroCard detail={detail} isDarkMode={isDarkMode} colors={colors} onViewAnalytics={handleNavigateAnalytics} />

        <View style={[styles.segmentContainer, { backgroundColor: isDarkMode ? '#1E293B' : '#EEF2F6' }]}>
          {[
            { key: 'RECORD', label: 'Bệnh án' },
            { key: 'PRESCRIPTIONS', label: rxLoaded ? `Đơn thuốc (${prescriptions.length})` : 'Đơn thuốc' },
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
                <Text numberOfLines={1} style={[styles.segmentText, active ? { color: Colors.primary, fontWeight: '700' } : { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

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

        {activeTab === 'PRESCRIPTIONS' && (
          rxLoading && prescriptions.length === 0 ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 24 }} />
          ) : (
            <PatientPrescriptionsTab
              prescriptions={prescriptions}
              isDarkMode={isDarkMode}
              colors={colors}
              onOpenCreatePrescription={handleOpenCreatePrescription}
              onOpenEditPrescription={handleOpenEditPrescription}
              onDeletePrescription={handleDeletePrescription}
              onToggleSpeakerReminder={handleToggleSpeakerReminder}
            />
          )
        )}

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
        onAddMedication={() => setBatchMedications((prev) => [...prev, { ...DEFAULT_MED_ROW }])}
        onRemoveMedication={(idx) => batchMedications.length > 1 && setBatchMedications((prev) => prev.filter((_, i) => i !== idx))}
        onUpdateMedication={(idx, field, val) => setBatchMedications((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item)))}
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
        isSaving={isSavingThreshold}
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
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { padding: 4 },
  topTitle: { fontSize: 17, fontWeight: '700' },
  moreBtn: { padding: 4 },
  scrollContent: { padding: 16, paddingBottom: 90 },
  segmentContainer: { flexDirection: 'row', borderRadius: 10, padding: 3, marginBottom: 14 },
  segmentBtn: { flex: 1, paddingVertical: 8, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  segmentBtnActive: { backgroundColor: '#FFFFFF', elevation: 1 },
  segmentText: { fontSize: 11.5, fontWeight: '600', textAlign: 'center' },
});

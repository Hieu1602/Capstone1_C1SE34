// DoctorPatientDetailScreen.tsx
// Chi tiết hồ sơ bệnh nhân, quản lý phác đồ điều trị, danh mục bệnh lý, dị ứng, dinh dưỡng & kê đơn thuốc cho Bác sĩ
// Thiết kế chuẩn chỉnh giao diện y tế cao cấp, không bể layout, hỗ trợ chỉnh sửa toàn diện mọi mục

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
import { useNavigation, useRoute } from '@react-navigation/native';

import { Colors } from '../../../theme/colors';
import { useTheme } from '../../../store/useThemeStore';
import { doctorApi } from '../../../services/api';

interface ConditionItem {
  id: string;
  name: string;
  severity: 'danger' | 'warning' | 'info';
  note: string;
}

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

export default function DoctorPatientDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDarkMode, colors } = useTheme();

  const patientId = route.params?.patientId || 'e0000000-b4e1-4b08-b2d3-d949a0eb075c';

  const [activeTab, setActiveTab] = useState<'RECORD' | 'PRESCRIPTIONS' | 'VITALS'>('RECORD');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);

  // ---------------------------------------------------------------------------
  // 1. MODAL: SỬA GHI CHÚ BÁC SĨ & LỊCH TÁI KHÁM
  // ---------------------------------------------------------------------------
  const [modalNotesVisible, setModalNotesVisible] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editNextAppt, setEditNextAppt] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // ---------------------------------------------------------------------------
  // 2. MODAL: THÊM / SỬA BỆNH LÝ NỀN (CHẨN ĐOÁN)
  // ---------------------------------------------------------------------------
  const [modalConditionVisible, setModalConditionVisible] = useState(false);
  const [editingConditionId, setEditingConditionId] = useState<string | null>(null);
  const [condName, setCondName] = useState('');
  const [condSeverity, setCondSeverity] = useState<'danger' | 'warning' | 'info'>('warning');
  const [condNote, setCondNote] = useState('');
  const [isSavingCondition, setIsSavingCondition] = useState(false);

  // ---------------------------------------------------------------------------
  // 3. MODAL: CHỈNH SỬA DỊ ỨNG & DINH DƯỠNG KHUYẾN NGHỊ
  // ---------------------------------------------------------------------------
  const [modalAllergiesDietVisible, setModalAllergiesDietVisible] = useState(false);
  const [editDrugAllergies, setEditDrugAllergies] = useState('');
  const [editFoodAllergies, setEditFoodAllergies] = useState('');
  const [editDietaryNotes, setEditDietaryNotes] = useState('');
  const [isSavingAllergies, setIsSavingAllergies] = useState(false);

  // ---------------------------------------------------------------------------
  // 4. MODAL: KÊ ĐƠN THUỐC / SỬA ĐƠN THUỐC
  // ---------------------------------------------------------------------------
  const [modalPrescribeVisible, setModalPrescribeVisible] = useState(false);
  const [editingRxId, setEditingRxId] = useState<string | null>(null);
  const [medName, setMedName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('Hàng ngày');
  const [scheduleTimes, setScheduleTimes] = useState('08:00, 19:30');
  const [instructions, setInstructions] = useState('');
  const [enableSpeaker, setEnableSpeaker] = useState(true);
  const [isSubmittingRx, setIsSubmittingRx] = useState(false);

  // ---------------------------------------------------------------------------
  // 5. MODAL: CẤU HÌNH NGƯỠNG Y TẾ
  // ---------------------------------------------------------------------------
  const [modalThresholdVisible, setModalThresholdVisible] = useState(false);
  const [hrHigh, setHrHigh] = useState('120');
  const [hrLow, setHrLow] = useState('50');
  const [spo2Low, setSpo2Low] = useState('90');

  // Load dữ liệu bệnh nhân từ Backend
  const fetchDetail = useCallback(async () => {
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
    } catch (err) {
      console.warn('[DoctorDetail] Fetch fallback:', err);
    } finally {
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

  // ---------------------------------------------------------------------------
  // XỬ LÝ 1: LƯU GHI CHÚ BÁC SĨ & LỊCH TÁI KHÁM
  // ---------------------------------------------------------------------------
  const handleOpenNotesModal = () => {
    setEditNotes(detail?.doctor_notes || '');
    setEditNextAppt(detail?.next_appointment || '15/10/2026 - 08:30');
    setModalNotesVisible(true);
  };

  const handleSaveNotes = async () => {
    try {
      setIsSavingNotes(true);
      const res = await doctorApi.updateMedicalRecord(patientId, {
        doctor_notes: editNotes.trim(),
        next_appointment: editNextAppt.trim(),
      });
      if (res.data) {
        setDetail(res.data);
      } else {
        setDetail((prev: any) => ({
          ...prev,
          doctor_notes: editNotes.trim(),
          next_appointment: editNextAppt.trim(),
        }));
      }
      setModalNotesVisible(false);
      Alert.alert('Thành công', 'Đã cập nhật ghi chú y khoa và lịch hẹn tái khám.');
    } catch {
      Alert.alert('Lỗi', 'Không thể kết nối lưu ghi chú.');
    } finally {
      setIsSavingNotes(false);
    }
  };

  // ---------------------------------------------------------------------------
  // XỬ LÝ 2: THÊM / SỬA / XÓA BỆNH LÝ NỀN
  // ---------------------------------------------------------------------------
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
      const currentConditions: ConditionItem[] = detail?.conditions ? [...detail.conditions] : [];

      let updatedConditions: ConditionItem[];
      if (editingConditionId) {
        updatedConditions = currentConditions.map((item) =>
          item.id === editingConditionId
            ? { ...item, name: condName.trim(), severity: condSeverity, note: condNote.trim() }
            : item
        );
      } else {
        const newCondition: ConditionItem = {
          id: `c-${Date.now()}`,
          name: condName.trim(),
          severity: condSeverity,
          note: condNote.trim(),
        };
        updatedConditions = [newCondition, ...currentConditions];
      }

      const res = await doctorApi.updateMedicalRecord(patientId, {
        conditions: updatedConditions,
      });

      if (res.data) {
        setDetail(res.data);
      } else {
        setDetail((prev: any) => ({
          ...prev,
          conditions: updatedConditions,
        }));
      }

      setModalConditionVisible(false);
      Alert.alert(
        'Thành công',
        editingConditionId ? 'Đã cập nhật chẩn đoán bệnh lý.' : 'Đã thêm bệnh lý nền mới vào hồ sơ.'
      );
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu danh mục bệnh lý.');
    } finally {
      setIsSavingCondition(false);
    }
  };

  const handleDeleteCondition = (condId: string, name: string) => {
    Alert.alert('Xác nhận xóa', `Bác sĩ có chắc chắn muốn xóa chẩn đoán "${name}" khỏi danh mục bệnh nền?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            const currentConditions: ConditionItem[] = detail?.conditions ? [...detail.conditions] : [];
            const updated = currentConditions.filter((c) => c.id !== condId);
            const res = await doctorApi.updateMedicalRecord(patientId, { conditions: updated });
            if (res.data) {
              setDetail(res.data);
            } else {
              setDetail((prev: any) => ({ ...prev, conditions: updated }));
            }
          } catch {
            Alert.alert('Lỗi', 'Không thể xóa chẩn đoán.');
          }
        },
      },
    ]);
  };

  // ---------------------------------------------------------------------------
  // XỬ LÝ 3: SỬA DỊ ỨNG & DINH DƯỠNG KHUYẾN NGHỊ
  // ---------------------------------------------------------------------------
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
      if (res.data) {
        setDetail(res.data);
      } else {
        setDetail((prev: any) => ({
          ...prev,
          drug_allergies: editDrugAllergies.trim(),
          food_allergies: editFoodAllergies.trim(),
          dietary_notes: editDietaryNotes.trim(),
        }));
      }
      setModalAllergiesDietVisible(false);
      Alert.alert('Thành công', 'Đã cập nhật thông tin dị ứng và chế độ dinh dưỡng khuyến nghị.');
    } catch {
      Alert.alert('Lỗi', 'Không thể kết nối lưu dị ứng & dinh dưỡng.');
    } finally {
      setIsSavingAllergies(false);
    }
  };

  // ---------------------------------------------------------------------------
  // XỬ LÝ 4: KÊ ĐƠN / SỬA / XÓA / BẬT TẮT LOA ĐƠN THUỐC
  // ---------------------------------------------------------------------------
  const handleOpenCreatePrescription = () => {
    setEditingRxId(null);
    setMedName('');
    setDosage('');
    setFrequency('Hàng ngày vào buổi sáng');
    setScheduleTimes('08:00');
    setInstructions('Uống sau khi ăn sáng 15 phút với nước ấm.');
    setEnableSpeaker(true);
    setModalPrescribeVisible(true);
  };

  const handleOpenEditPrescription = (rx: PrescriptionItem) => {
    setEditingRxId(rx.id);
    setMedName(rx.medication_name);
    setDosage(rx.dosage);
    setFrequency(rx.frequency);
    setScheduleTimes((rx.schedule_times || ['08:00']).join(', '));
    setInstructions(rx.instructions);
    setEnableSpeaker(rx.enable_speaker_reminder);
    setModalPrescribeVisible(true);
  };

  const handleSavePrescription = async () => {
    if (!medName.trim() || !dosage.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên thuốc và liều lượng.');
      return;
    }

    try {
      setIsSubmittingRx(true);
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
            prev.map((rx) => (rx.id === editingRxId ? res.data : rx))
          );
        }
        setModalPrescribeVisible(false);
        Alert.alert('Thành công', `Đã cập nhật đơn thuốc "${payload.medication_name}".`);
      } else {
        const res = await doctorApi.createPrescription(patientId, payload);
        if (res.data) {
          setPrescriptions([res.data, ...prescriptions]);
        }
        setModalPrescribeVisible(false);
        Alert.alert(
          'Kê đơn thành công',
          `Đã lưu đơn thuốc "${payload.medication_name}". Lịch nhắc uống thuốc đã được đồng bộ xuống loa thông minh Edge Hub Orange Pi 5!`
        );
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu đơn thuốc.');
    } finally {
      setIsSubmittingRx(false);
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
            Alert.alert('Đã ngừng thuốc', `Đã loại bỏ "${name}" khỏi phác đồ điều trị.`);
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

  // ---------------------------------------------------------------------------
  // XỬ LÝ 5: LƯU NGƯỠNG AN TOÀN Y TẾ
  // ---------------------------------------------------------------------------
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

  // Trích xuất chữ cái đại diện chuẩn cho Avatar (Tên gọi chính của cụ: "Cụ Nguyễn Văn An" -> "A")
  const patientName = detail?.name || 'Cụ Nguyễn Văn An';
  const nameParts = patientName.trim().split(/\s+/);
  const initialLetter = nameParts[nameParts.length - 1]?.[0]?.toUpperCase() || 'A';

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* TOP HEADER */}
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
        <TouchableOpacity
          style={styles.moreBtn}
          onPress={() => setModalThresholdVisible(true)}
        >
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

        {/* HERO CARD BỆNH NHÂN */}
        <View
          style={[
            styles.heroCard,
            { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border },
          ]}
        >
          <View style={styles.heroRow}>
            <View style={styles.avatarBig}>
              <Text style={styles.avatarBigText}>{initialLetter}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={styles.heroNameRow}>
                <Text style={[styles.heroName, { color: colors.textPrimary }]} numberOfLines={1}>
                  {patientName}
                </Text>
                <View style={styles.badgeAge}>
                  <Text style={styles.badgeAgeText}>{detail?.age || 78} tuổi</Text>
                </View>
              </View>
              <Text style={[styles.heroSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
                Giới tính: {detail?.gender || 'Nam'} • Nhóm máu: {detail?.blood_type || 'O+'} • BMI: {detail?.bmi || 22.8}
              </Text>
              <Text style={[styles.heroAddress, { color: isDarkMode ? '#CBD5E1' : '#475569' }]} numberOfLines={1}>
                📍 {detail?.house_name || 'Nhà của tôi'} • {detail?.house_address || '123 Hải Phòng, Đà Nẵng'}
              </Text>
            </View>
          </View>

          {/* DẢI 4 SINH HIỆU TỨC THỜI */}
          <View style={styles.metricsBar}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: '#EF4444' }]}>{detail?.heart_rate || 76} <Text style={styles.metricUnit}>bpm</Text></Text>
              <Text style={styles.metricLabel}>Nhịp tim</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: '#0284C7' }]}>{detail?.spo2 || 98}<Text style={styles.metricUnit}>%</Text></Text>
              <Text style={styles.metricLabel}>SpO₂</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: '#10B981' }]}>120/80</Text>
              <Text style={styles.metricLabel}>Huyết áp</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: '#F59E0B' }]}>{detail?.skin_temp_max || 36.6}<Text style={styles.metricUnit}>°C</Text></Text>
              <Text style={styles.metricLabel}>Nhiệt độ</Text>
            </View>
          </View>

          {/* NÚT XEM BÁO CÁO Y KHOA TRỰC TIẾP */}
          <TouchableOpacity
            style={[styles.heroReportBtn, { backgroundColor: isDarkMode ? '#0284C722' : '#E0F2FE' }]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('DoctorAnalytics', { patientId })}
          >
            <Ionicons name="bar-chart" size={15} color="#0284C7" style={{ marginRight: 6 }} />
            <Text style={styles.heroReportBtnText}>Xem Báo Cáo & Phân Tích Sinh Hiệu</Text>
            <Ionicons name="chevron-forward" size={14} color="#0284C7" />
          </TouchableOpacity>
        </View>

        {/* THANH 3 TAB CHỨC NĂNG (CHUẨN CHỈNH, KHÔNG BỂ CHỮ TRÊN MỌI MÀN HÌNH) */}
        <View style={[styles.segmentContainer, { backgroundColor: isDarkMode ? '#1E293B' : '#EEF2F6' }]}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'RECORD' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('RECORD')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'RECORD'
                  ? { color: Colors.primary, fontWeight: '700' }
                  : { color: isDarkMode ? '#94A3B8' : '#64748B' },
              ]}
              numberOfLines={1}
            >
              Bệnh án
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'PRESCRIPTIONS' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('PRESCRIPTIONS')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'PRESCRIPTIONS'
                  ? { color: Colors.primary, fontWeight: '700' }
                  : { color: isDarkMode ? '#94A3B8' : '#64748B' },
              ]}
              numberOfLines={1}
            >
              Đơn thuốc ({prescriptions.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'VITALS' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('VITALS')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'VITALS'
                  ? { color: Colors.primary, fontWeight: '700' }
                  : { color: isDarkMode ? '#94A3B8' : '#64748B' },
              ]}
              numberOfLines={1}
            >
              Sinh hiệu & Ngưỡng
            </Text>
          </TouchableOpacity>
        </View>

        {/* ================================================================= */}
        {/* TAB 1: BỆNH ÁN & TIỀN SỬ Y KHOA                                   */}
        {/* ================================================================= */}
        {activeTab === 'RECORD' && (
          <View>
            {/* PHẦN 1: GHI CHÚ & DẶN DÒ BÁC SĨ (CÓ NÚT CHỈNH SỬA) */}
            <View
              style={[
                styles.sectionBox,
                { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: '#3B82F644' },
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="chatbox-ellipses" size={18} color={Colors.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Ghi chú & Dặn dò Bác sĩ</Text>
                </View>
                <TouchableOpacity
                  style={styles.btnActionSmall}
                  onPress={handleOpenNotesModal}
                >
                  <Ionicons name="create-outline" size={14} color={Colors.primary} style={{ marginRight: 3 }} />
                  <Text style={styles.btnActionSmallText}>Chỉnh sửa</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.notesQuoteBox, { borderLeftColor: Colors.primary }]}>
                <Text style={[styles.notesBody, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>
                  "{detail?.doctor_notes || 'Bệnh nhân ổn định, đáp ứng tốt với thuốc huyết áp. Cần duy trì uống thuốc đúng giờ.'}"
                </Text>
              </View>

              <View style={styles.appointmentBadge}>
                <Ionicons name="calendar-outline" size={15} color="#0284C7" />
                <Text style={styles.appointmentText}>
                  Tái khám định kỳ: {detail?.next_appointment || '15/10/2026 - 08:30'}
                </Text>
              </View>
            </View>

            {/* PHẦN 2: DANH MỤC BỆNH LÝ NỀN (CHẨN ĐOÁN CHUẨN + CÓ THỂ THÊM/SỬA/XÓA) */}
            <View
              style={[
                styles.sectionBox,
                { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border },
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Ionicons name="fitness" size={18} color="#EF4444" style={{ marginRight: 6 }} />
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    Danh mục Bệnh lý nền (Chẩn đoán)
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.btnActionSmall, { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' }]}
                  onPress={handleOpenAddCondition}
                >
                  <Ionicons name="add" size={14} color="#2563EB" style={{ marginRight: 2 }} />
                  <Text style={[styles.btnActionSmallText, { color: '#2563EB' }]}>Thêm bệnh</Text>
                </TouchableOpacity>
              </View>

              {(!detail?.conditions || detail.conditions.length === 0) ? (
                <Text style={[styles.emptyHintText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  Chưa có danh mục bệnh nền. Chạm "Thêm bệnh" để bổ sung.
                </Text>
              ) : (
                detail.conditions.map((c: ConditionItem) => {
                  const isDanger = c.severity === 'danger';
                  const isWarn = c.severity === 'warning';
                  const badgeBg = isDanger ? '#FEE2E2' : isWarn ? '#FEF3C7' : '#E0F2FE';
                  const badgeTextColor = isDanger ? '#DC2626' : isWarn ? '#D97706' : '#0369A1';
                  const badgeLabel = isDanger ? 'Nguy cơ cao' : isWarn ? 'Cần theo dõi' : 'Ổn định';
                  const borderColor = isDanger ? '#EF444444' : isWarn ? '#F59E0B44' : '#0284C744';

                  return (
                    <View
                      key={c.id}
                      style={[
                        styles.conditionCardItem,
                        {
                          backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                          borderColor: isDarkMode ? '#334155' : borderColor,
                        },
                      ]}
                    >
                      {/* Dòng trên: Huy hiệu mức độ & Nút Sửa / Xóa */}
                      <View style={styles.conditionCardTop}>
                        <View style={[styles.severityPill, { backgroundColor: badgeBg }]}>
                          <Text style={[styles.severityPillText, { color: badgeTextColor }]}>{badgeLabel}</Text>
                        </View>
                        <View style={styles.conditionActionRow}>
                          <TouchableOpacity
                            style={styles.iconActionBtn}
                            onPress={() => handleOpenEditCondition(c)}
                          >
                            <Ionicons name="pencil" size={14} color="#0284C7" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.iconActionBtn, { marginLeft: 6 }]}
                            onPress={() => handleDeleteCondition(c.id, c.name)}
                          >
                            <Ionicons name="trash-outline" size={14} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Tiêu đề chẩn đoán */}
                      <Text style={[styles.conditionName, { color: colors.textPrimary }]}>{c.name}</Text>

                      {/* Lời dặn / Ghi chú lâm sàng */}
                      {c.note ? (
                        <Text style={[styles.conditionNote, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                          {c.note}
                        </Text>
                      ) : null}
                    </View>
                  );
                })
              )}
            </View>

            {/* PHẦN 3: DỊ ỨNG & DINH DƯỠNG KHUYẾN NGHỊ (THẺ ĐỘC LẬP TOÀN CHIỀU RỘNG, KHÔNG SƠ BÉ) */}
            <View
              style={[
                styles.sectionBox,
                { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border },
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="nutrition" size={18} color="#16A34A" style={{ marginRight: 6 }} />
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    Dị ứng & Dinh dưỡng khuyến nghị
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.btnActionSmall}
                  onPress={handleOpenAllergiesDietModal}
                >
                  <Ionicons name="create-outline" size={14} color={Colors.primary} style={{ marginRight: 3 }} />
                  <Text style={styles.btnActionSmallText}>Chỉnh sửa</Text>
                </TouchableOpacity>
              </View>

              {/* Thẻ Dị ứng thuốc */}
              <View style={[styles.dietSubCard, { backgroundColor: isDarkMode ? '#450A0A33' : '#FEF2F2', borderColor: '#FCA5A5' }]}>
                <View style={styles.dietSubHeader}>
                  <Ionicons name="warning" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                  <Text style={[styles.dietSubTitle, { color: '#DC2626' }]}>Dị ứng thuốc y tế</Text>
                </View>
                <Text style={[styles.dietSubContent, { color: isDarkMode ? '#FCA5A5' : '#991B1B' }]}>
                  {detail?.drug_allergies || 'Không có dị ứng thuốc đã ghi nhận.'}
                </Text>
              </View>

              {/* Thẻ Dị ứng đồ ăn */}
              <View style={[styles.dietSubCard, { backgroundColor: isDarkMode ? '#451A0333' : '#FFFBEB', borderColor: '#FCD34D', marginTop: 10 }]}>
                <View style={styles.dietSubHeader}>
                  <Ionicons name="restaurant" size={16} color="#D97706" style={{ marginRight: 6 }} />
                  <Text style={[styles.dietSubTitle, { color: '#D97706' }]}>Dị ứng thực phẩm / đồ ăn</Text>
                </View>
                <Text style={[styles.dietSubContent, { color: isDarkMode ? '#FDE68A' : '#92400E' }]}>
                  {detail?.food_allergies || 'Không có dị ứng thực phẩm ghi nhận.'}
                </Text>
              </View>

              {/* Thẻ Chế độ ăn uống */}
              <View style={[styles.dietSubCard, { backgroundColor: isDarkMode ? '#064E3B33' : '#ECFDF5', borderColor: '#6EE7B7', marginTop: 10 }]}>
                <View style={styles.dietSubHeader}>
                  <Ionicons name="leaf" size={16} color="#059669" style={{ marginRight: 6 }} />
                  <Text style={[styles.dietSubTitle, { color: '#059669' }]}>Chế độ ăn khuyến nghị</Text>
                </View>
                <Text style={[styles.dietSubContent, { color: isDarkMode ? '#A7F3D0' : '#065F46' }]}>
                  {detail?.dietary_notes || 'Ăn uống bình thường, đảm bảo dinh dưỡng đầy đủ.'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ================================================================= */}
        {/* TAB 2: ĐƠN THUỐC & KÊ ĐƠN (CÓ THỂ THÊM/SỬA/XÓA/BẬT TẮT LOA HUB)    */}
        {/* ================================================================= */}
        {activeTab === 'PRESCRIPTIONS' && (
          <View>
            <TouchableOpacity
              style={styles.btnPrescribeNew}
              activeOpacity={0.88}
              onPress={handleOpenCreatePrescription}
            >
              <Ionicons name="add-circle" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.btnPrescribeNewText}>Kê đơn thuốc mới cho Bệnh nhân</Text>
            </TouchableOpacity>

            {prescriptions.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="medkit-outline" size={48} color="#94A3B8" />
                <Text style={[styles.emptyHintText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  Chưa có đơn thuốc nào. Chạm nút phía trên để kê đơn mới.
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
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.rxMedName, { color: colors.textPrimary }]}>
                        💊 {rx.medication_name}
                      </Text>
                      <Text style={[styles.rxDosage, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                        {rx.dosage} • {rx.frequency}
                      </Text>
                    </View>

                    {/* Nút bật/tắt phát loa Orange Pi 5 trực tiếp */}
                    <TouchableOpacity
                      style={[
                        styles.speakerToggleBtn,
                        rx.enable_speaker_reminder
                          ? { backgroundColor: '#ECFDF5', borderColor: '#10B981' }
                          : { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9', borderColor: '#94A3B8' },
                      ]}
                      onPress={() => handleToggleSpeakerReminder(rx.id)}
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
                        {rx.enable_speaker_reminder ? 'Loa: BẬT' : 'Loa: TẮT'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Giờ uống thuốc */}
                  <View style={styles.rxScheduleRow}>
                    <Text style={[styles.rxScheduleLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                      Giờ uống:
                    </Text>
                    {(rx.schedule_times || ['08:00']).map((t: string, idx: number) => (
                      <View key={idx} style={styles.timeTag}>
                        <Ionicons name="time-outline" size={11} color="#0284C7" style={{ marginRight: 3 }} />
                        <Text style={styles.timeTagText}>{t}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Lời dặn uống thuốc */}
                  <Text style={[styles.rxInstructions, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>
                    📝 {rx.instructions}
                  </Text>

                  {/* Hàng nút hành động: Chỉnh sửa & Xóa */}
                  <View style={styles.rxActionRow}>
                    <Text style={[styles.rxDoctorCredit, { color: isDarkMode ? '#64748B' : '#94A3B8' }]}>
                      BS: {rx.doctor_name || 'BS. Trần Văn Minh'}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        style={styles.rxEditBtn}
                        onPress={() => handleOpenEditPrescription(rx)}
                      >
                        <Ionicons name="pencil" size={13} color="#0284C7" style={{ marginRight: 4 }} />
                        <Text style={styles.rxEditBtnText}>Sửa</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.rxDeleteBtn}
                        onPress={() => handleDeletePrescription(rx.id, rx.medication_name)}
                      >
                        <Ionicons name="trash-outline" size={13} color="#EF4444" style={{ marginRight: 4 }} />
                        <Text style={styles.rxDeleteBtnText}>Ngừng thuốc</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ================================================================= */}
        {/* TAB 3: NGƯỠNG AN TOÀN Y TẾ & PHÂN TÍCH                            */}
        {/* ================================================================= */}
        {activeTab === 'VITALS' && (
          <View>
            <View
              style={[
                styles.sectionBox,
                { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border },
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Ngưỡng An Toàn Lâm Sàng</Text>
                <TouchableOpacity
                  style={styles.btnActionSmall}
                  onPress={() => setModalThresholdVisible(true)}
                >
                  <Ionicons name="settings-outline" size={14} color={Colors.primary} style={{ marginRight: 3 }} />
                  <Text style={styles.btnActionSmallText}>Cấu hình lại</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.thresholdRow}>
                <Text style={styles.thresholdLabel}>Nhịp tim tối đa cảnh báo:</Text>
                <Text style={[styles.thresholdVal, { color: '#EF4444' }]}>{hrHigh} bpm</Text>
              </View>
              <View style={styles.thresholdRow}>
                <Text style={styles.thresholdLabel}>Nhịp tim tối thiểu cảnh báo:</Text>
                <Text style={[styles.thresholdVal, { color: '#EF4444' }]}>{hrLow} bpm</Text>
              </View>
              <View style={styles.thresholdRow}>
                <Text style={styles.thresholdLabel}>Ngưỡng SpO₂ nguy hiểm:</Text>
                <Text style={[styles.thresholdVal, { color: '#0284C7' }]}>&lt; {spo2Low}%</Text>
              </View>
              <View style={styles.thresholdRow}>
                <Text style={styles.thresholdLabel}>Cảnh báo bất động / té ngã:</Text>
                <Text style={[styles.thresholdVal, { color: '#F59E0B' }]}>&gt; 60 giây</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.btnOpenAnalytics}
              activeOpacity={0.88}
              onPress={() => navigation.navigate('DoctorAnalytics', { patientId })}
            >
              <Ionicons name="bar-chart" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.btnOpenAnalyticsText}>Xem Phân tích Đồ thị 7-30 ngày & Xuất Báo cáo</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ================================================================= */}
      {/* 1. MODAL CHỈNH SỬA GHI CHÚ BÁC SĨ & LỊCH TÁI KHÁM                */}
      {/* ================================================================= */}
      <Modal visible={modalNotesVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Ghi Chú & Lịch Tái Khám</Text>
              <TouchableOpacity onPress={() => setModalNotesVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Lời dặn dò y khoa / tiến triển bệnh (*)</Text>
            <TextInput
              style={[
                styles.inputField,
                { height: 90, textAlignVertical: 'top', color: colors.textPrimary, borderColor: colors.border },
              ]}
              multiline
              placeholder="VD: Bệnh nhân ổn định, nhắc người nhà đo SpO2 mỗi sáng..."
              placeholderTextColor="#94A3B8"
              value={editNotes}
              onChangeText={setEditNotes}
            />

            <Text style={styles.fieldLabel}>Lịch hẹn tái khám tiếp theo</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="VD: 15/10/2026 - 08:30"
              placeholderTextColor="#94A3B8"
              value={editNextAppt}
              onChangeText={setEditNextAppt}
            />

            <TouchableOpacity
              style={[styles.modalSubmitBtn, isSavingNotes && { opacity: 0.7 }]}
              onPress={handleSaveNotes}
              disabled={isSavingNotes}
            >
              {isSavingNotes ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Lưu Thay Đổi</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================================================================= */}
      {/* 2. MODAL THÊM / SỬA BỆNH LÝ NỀN (CHẨN ĐOÁN)                      */}
      {/* ================================================================= */}
      <Modal visible={modalConditionVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {editingConditionId ? 'Sửa Chẩn Đoán Bệnh Lý' : 'Thêm Bệnh Lý Nền Mới'}
              </Text>
              <TouchableOpacity onPress={() => setModalConditionVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Tên bệnh lý / chẩn đoán (*)</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="VD: Tăng huyết áp (Độ 2), Loãng xương..."
              placeholderTextColor="#94A3B8"
              value={condName}
              onChangeText={setCondName}
            />

            <Text style={styles.fieldLabel}>Mức độ nghiêm trọng</Text>
            <View style={styles.severityPickerRow}>
              {[
                { key: 'danger', label: 'Nguy cơ cao', color: '#EF4444', bg: '#FEE2E2' },
                { key: 'warning', label: 'Cần theo dõi', color: '#F59E0B', bg: '#FEF3C7' },
                { key: 'info', label: 'Ổn định', color: '#0284C7', bg: '#E0F2FE' },
              ].map((s) => {
                const isSelected = condSeverity === s.key;
                return (
                  <TouchableOpacity
                    key={s.key}
                    style={[
                      styles.severityOptionBtn,
                      isSelected ? { borderColor: s.color, backgroundColor: s.bg } : { borderColor: colors.border },
                    ]}
                    onPress={() => setCondSeverity(s.key as any)}
                  >
                    <View style={[styles.conditionDot, { backgroundColor: s.color }]} />
                    <Text
                      style={[
                        styles.severityOptionText,
                        { color: isSelected ? s.color : isDarkMode ? '#CBD5E1' : '#64748B' },
                      ]}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Ghi chú lâm sàng / Dặn dò cụ thể</Text>
            <TextInput
              style={[
                styles.inputField,
                { height: 75, textAlignVertical: 'top', color: colors.textPrimary, borderColor: colors.border },
              ]}
              multiline
              placeholder="VD: Huyết áp mục tiêu < 140/90, chú ý khi thay đổi tư thế..."
              placeholderTextColor="#94A3B8"
              value={condNote}
              onChangeText={setCondNote}
            />

            <TouchableOpacity
              style={[styles.modalSubmitBtn, isSavingCondition && { opacity: 0.7 }]}
              onPress={handleSaveCondition}
              disabled={isSavingCondition}
            >
              {isSavingCondition ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>
                  {editingConditionId ? 'Cập Nhật Bệnh Lý' : 'Lưu Vào Hồ Sơ Bệnh Án'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================================================================= */}
      {/* 3. MODAL CHỈNH SỬA DỊ ỨNG & DINH DƯỠNG KHUYẾN NGHỊ                */}
      {/* ================================================================= */}
      <Modal visible={modalAllergiesDietVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Dị Ứng & Dinh Dưỡng</Text>
              <TouchableOpacity onPress={() => setModalAllergiesDietVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Dị ứng thuốc y tế</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="VD: Penicillin, Aspirin, NSAIDs..."
              placeholderTextColor="#94A3B8"
              value={editDrugAllergies}
              onChangeText={setEditDrugAllergies}
            />

            <Text style={styles.fieldLabel}>Dị ứng thực phẩm / đồ ăn</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="VD: Hải sản có vỏ (tôm, cua), đậu phộng..."
              placeholderTextColor="#94A3B8"
              value={editFoodAllergies}
              onChangeText={setEditFoodAllergies}
            />

            <Text style={styles.fieldLabel}>Chế độ ăn uống khuyến nghị</Text>
            <TextInput
              style={[
                styles.inputField,
                { height: 80, textAlignVertical: 'top', color: colors.textPrimary, borderColor: colors.border },
              ]}
              multiline
              placeholder="VD: Ăn nhạt, giảm muối < 3g/ngày, bổ sung Canxi + D3..."
              placeholderTextColor="#94A3B8"
              value={editDietaryNotes}
              onChangeText={setEditDietaryNotes}
            />

            <TouchableOpacity
              style={[styles.modalSubmitBtn, isSavingAllergies && { opacity: 0.7 }]}
              onPress={handleSaveAllergiesDiet}
              disabled={isSavingAllergies}
            >
              {isSavingAllergies ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Lưu Thông Tin Dinh Dưỡng</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================================================================= */}
      {/* 4. MODAL KÊ ĐƠN THUỐC MỚI / SỬA ĐƠN THUỐC                        */}
      {/* ================================================================= */}
      <Modal visible={modalPrescribeVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {editingRxId ? 'Sửa Đơn Thuốc Y Khoa' : 'Kê Đơn Thuốc Mới'}
              </Text>
              <TouchableOpacity onPress={() => setModalPrescribeVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Tên biệt dược / hoạt chất (*)</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="VD: Amlodipine 5mg, Vastarel 20mg..."
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
                  placeholder="VD: Hàng ngày"
                  placeholderTextColor="#94A3B8"
                  value={frequency}
                  onChangeText={setFrequency}
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Giờ uống thuốc (ngăn cách bởi dấu phẩy)</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="VD: 08:00, 19:30"
              placeholderTextColor="#94A3B8"
              value={scheduleTimes}
              onChangeText={setScheduleTimes}
            />

            <Text style={styles.fieldLabel}>Dặn dò cách uống</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="VD: Uống sau ăn 15 phút với nước ấm..."
              placeholderTextColor="#94A3B8"
              value={instructions}
              onChangeText={setInstructions}
            />

            <View style={styles.switchRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
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
              style={[styles.modalSubmitBtn, isSubmittingRx && { opacity: 0.7 }]}
              onPress={handleSavePrescription}
              disabled={isSubmittingRx}
            >
              {isSubmittingRx ? (
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

      {/* ================================================================= */}
      {/* 5. MODAL ĐIỀU CHỈNH NGƯỠNG AN TOÀN Y TẾ                            */}
      {/* ================================================================= */}
      <Modal visible={modalThresholdVisible} animationType="fade" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Cấu Hình Ngưỡng Y Tế</Text>
              <TouchableOpacity onPress={() => setModalThresholdVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Ngưỡng Nhịp tim tối đa (bpm)</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              keyboardType="numeric"
              value={hrHigh}
              onChangeText={setHrHigh}
            />

            <Text style={styles.fieldLabel}>Ngưỡng Nhịp tim tối thiểu (bpm)</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              keyboardType="numeric"
              value={hrLow}
              onChangeText={setHrLow}
            />

            <Text style={styles.fieldLabel}>Ngưỡng SpO₂ nguy hiểm (%)</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              keyboardType="numeric"
              value={spo2Low}
              onChangeText={setSpo2Low}
            />

            <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleSaveThresholds}>
              <Text style={styles.modalSubmitBtnText}>Lưu Cấu Hình Ngưỡng</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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

  heroCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginBottom: 16,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  avatarBig: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBigText: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  heroName: { fontSize: 17, fontWeight: '800', marginRight: 8 },
  badgeAge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeAgeText: { fontSize: 11, color: '#2563EB', fontWeight: '700' },
  heroSub: { fontSize: 12, marginTop: 3 },
  heroAddress: { fontSize: 12, marginTop: 4 },

  metricsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  metricItem: { flex: 1, alignItems: 'center' },
  metricVal: { fontSize: 15, fontWeight: '800' },
  metricUnit: { fontSize: 10, fontWeight: '500' },
  metricLabel: { fontSize: 10, color: '#94A3B8', marginTop: 2, textAlign: 'center' },
  metricDivider: { width: 1, height: 22, backgroundColor: '#E2E8F0' },
  heroReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  heroReportBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0284C7',
    marginRight: 4,
  },

  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: { fontSize: 11.5, textAlign: 'center' },

  sectionBox: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  btnActionSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#3B82F633',
    backgroundColor: '#EFF6FF55',
  },
  btnActionSmallText: { fontSize: 12, color: Colors.primary, fontWeight: '700' },

  notesQuoteBox: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    marginVertical: 4,
  },
  notesBody: { fontSize: 14, lineHeight: 21, fontStyle: 'italic' },
  appointmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 10,
    gap: 6,
  },
  appointmentText: { fontSize: 12, color: '#0369A1', fontWeight: '700' },

  emptyHintText: { fontSize: 13, fontStyle: 'italic', marginVertical: 8 },

  conditionCardItem: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  conditionCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  severityPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  severityPillText: { fontSize: 10, fontWeight: '700' },
  conditionActionRow: { flexDirection: 'row' },
  iconActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  conditionName: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  conditionNote: { fontSize: 12, lineHeight: 18 },
  conditionDot: { width: 8, height: 8, borderRadius: 4 },

  dietSubCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  dietSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dietSubTitle: { fontSize: 12, fontWeight: '700' },
  dietSubContent: { fontSize: 13, lineHeight: 19, fontWeight: '500' },

  btnPrescribeNew: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: 13,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  btnPrescribeNewText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  emptyBox: { alignItems: 'center', paddingVertical: 40 },

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

  rxScheduleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, flexWrap: 'wrap', gap: 6 },
  rxScheduleLabel: { fontSize: 12 },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  timeTagText: { fontSize: 11, color: '#0369A1', fontWeight: '700' },

  rxInstructions: { fontSize: 13, marginTop: 8, fontStyle: 'italic', lineHeight: 18 },

  rxActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  rxDoctorCredit: { fontSize: 11 },
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

  thresholdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  thresholdLabel: { fontSize: 13, color: '#64748B' },
  thresholdVal: { fontSize: 13, fontWeight: '700' },

  btnOpenAnalytics: {
    flexDirection: 'row',
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  btnOpenAnalyticsText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // MODAL STYLES
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
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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

  severityPickerRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  severityOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 4,
  },
  severityOptionText: { fontSize: 11, fontWeight: '700' },

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

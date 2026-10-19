// DoctorPatientDetailScreen.tsx
// Chi tiết hồ sơ bệnh nhân, quản lý phác đồ điều trị, danh mục bệnh lý, dị ứng, dinh dưỡng & kê đơn thuốc cho Bác sĩ

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
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Colors } from '../../../theme/colors';
import { useTheme } from '../../../store/useThemeStore';
import { doctorApi, BASE_URL } from '../../../services/api';

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

  const patientId = route.params?.patientId || '';

  const [activeTab, setActiveTab] = useState<'RECORD' | 'PRESCRIPTIONS' | 'VITALS'>('RECORD');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<any>(null);
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
  const [condSeverity, setCondSeverity] = useState<'danger' | 'warning' | 'info'>('warning');
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
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('Hàng ngày');
  const [scheduleTimes, setScheduleTimes] = useState('08:00');
  const [instructions, setInstructions] = useState('');
  const [enableSpeaker, setEnableSpeaker] = useState(true);
  const [isSubmittingRx, setIsSubmittingRx] = useState(false);

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
    setMedName('');
    setDosage('');
    setFrequency('Hàng ngày');
    setScheduleTimes('08:00');
    setInstructions('');
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
      const parsedTimes = scheduleTimes.split(',').map((t) => t.trim()).filter(Boolean);
      const payload = {
        medication_name: medName.trim(),
        dosage: dosage.trim(),
        frequency: frequency.trim() || 'Hàng ngày',
        schedule_times: parsedTimes.length > 0 ? parsedTimes : ['08:00'],
        instructions: instructions.trim(),
        enable_speaker_reminder: enableSpeaker,
      };

      if (editingRxId) {
        const res = await doctorApi.updatePrescription(patientId, editingRxId, payload);
        if (res.data) {
          setPrescriptions((prev) => prev.map((rx) => (rx.id === editingRxId ? res.data : rx)));
        }
        setModalPrescribeVisible(false);
        Alert.alert('Thành công', `Đã cập nhật đơn thuốc "${payload.medication_name}".`);
      } else {
        const res = await doctorApi.createPrescription(patientId, payload);
        if (res.data) {
          setPrescriptions([res.data, ...prescriptions]);
        }
        setModalPrescribeVisible(false);
        Alert.alert('Kê đơn thành công', `Đã lưu đơn thuốc "${payload.medication_name}". Lịch nhắc đã đồng bộ qua Hub AI!`);
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu đơn thuốc.');
    } finally {
      setIsSubmittingRx(false);
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

  const patientName = detail?.name || 'Bệnh nhân';
  const initialLetter = patientName.trim().split(/\s+/).slice(-1)[0]?.[0]?.toUpperCase() || 'A';

  const metaParts = [
    detail?.age ? `${detail.age} tuổi` : null,
    detail?.gender ? detail.gender : null,
    detail?.blood_type ? `Nhóm máu ${detail.blood_type}` : null,
    detail?.bmi ? `BMI: ${detail.bmi}` : null,
  ].filter(Boolean);

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Top Header */}
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {loading && !refreshing && <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 10 }} />}

        {/* Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
          <View style={styles.heroRow}>
            <View style={styles.avatarBig}>
              {detail?.avatar_url ? (
                <Image
                  source={{
                    uri: detail.avatar_url.startsWith('http')
                      ? detail.avatar_url
                      : `${BASE_URL.replace('/api/v1', '')}${detail.avatar_url}`,
                  }}
                  style={styles.avatarBigImg}
                />
              ) : (
                <Text style={styles.avatarBigText}>{initialLetter}</Text>
              )}
            </View>

            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={styles.heroNameRow}>
                <Text style={[styles.heroName, { color: colors.textPrimary }]} numberOfLines={1}>{patientName}</Text>
                {detail?.age ? (
                  <View style={styles.badgeAge}>
                    <Text style={styles.badgeAgeText}>{detail.age} tuổi</Text>
                  </View>
                ) : null}
              </View>

              {metaParts.length > 0 ? (
                <Text style={[styles.heroSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
                  {metaParts.join(' • ')}
                </Text>
              ) : null}

              {detail?.house_name || detail?.house_address ? (
                <Text style={[styles.heroAddress, { color: isDarkMode ? '#CBD5E1' : '#475569' }]} numberOfLines={1}>
                  📍 {[detail?.house_name, detail?.house_address].filter(Boolean).join(' • ')}
                </Text>
              ) : null}

              {/* Huy hiệu Face ID */}
              <View style={styles.faceIdPillRow}>
                <View
                  style={[
                    styles.faceIdPill,
                    detail?.has_face_enrolled
                      ? { backgroundColor: isDarkMode ? '#064E3B' : '#DCFCE7', borderColor: '#10B981' }
                      : { backgroundColor: isDarkMode ? '#451A03' : '#FEF3C7', borderColor: '#F59E0B' },
                  ]}
                >
                  <Ionicons
                    name={detail?.has_face_enrolled ? 'scan-circle' : 'scan-outline'}
                    size={12}
                    color={detail?.has_face_enrolled ? '#10B981' : '#F59E0B'}
                  />
                  <Text style={[styles.faceIdPillText, { color: detail?.has_face_enrolled ? '#047857' : '#B45309' }]}>
                    {detail?.has_face_enrolled ? 'AI Face ID: Đã đăng ký' : 'Khuôn mặt: Chưa đăng ký'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Dải 4 sinh hiệu tức thời */}
          <View style={styles.metricsBar}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: '#EF4444' }]}>{detail?.heart_rate ?? '--'} <Text style={styles.metricUnit}>bpm</Text></Text>
              <Text style={styles.metricLabel}>Nhịp tim</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: '#0284C7' }]}>{detail?.spo2 ? `${detail.spo2}%` : '--'}</Text>
              <Text style={styles.metricLabel}>SpO₂</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: '#10B981' }]}>{detail?.blood_pressure || '--'}</Text>
              <Text style={styles.metricLabel}>Huyết áp</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: '#F59E0B' }]}>{detail?.skin_temp_max ? `${detail.skin_temp_max}°C` : '--'}</Text>
              <Text style={styles.metricLabel}>Nhiệt độ</Text>
            </View>
          </View>

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
                style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                onPress={() => setActiveTab(tab.key as any)}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, active ? { color: Colors.primary, fontWeight: '700' } : { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* TAB 1: BỆNH ÁN & TIỀN SỬ Y KHOA */}
        {activeTab === 'RECORD' && (
          <View>
            {/* Ghi chú & dặn dò */}
            <View style={[styles.sectionBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: '#3B82F644' }]}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="chatbox-ellipses" size={17} color={Colors.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Ghi chú & Dặn dò Bác sĩ</Text>
                </View>
                <TouchableOpacity style={styles.btnActionSmall} onPress={handleOpenNotesModal}>
                  <Ionicons name="create-outline" size={13} color={Colors.primary} style={{ marginRight: 2 }} />
                  <Text style={styles.btnActionSmallText}>Chỉnh sửa</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.notesQuoteBox, { borderLeftColor: Colors.primary }]}>
                <Text style={[styles.notesBody, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>
                  {detail?.doctor_notes ? `"${detail.doctor_notes}"` : 'Chưa có ghi chú từ bác sĩ.'}
                </Text>
              </View>

              {detail?.next_appointment ? (
                <View style={styles.appointmentBadge}>
                  <Ionicons name="calendar-outline" size={14} color="#0284C7" />
                  <Text style={styles.appointmentText}>Tái khám: {detail.next_appointment}</Text>
                </View>
              ) : null}
            </View>

            {/* Danh mục bệnh lý nền */}
            <View style={[styles.sectionBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                  <Ionicons name="fitness" size={17} color="#EF4444" style={{ marginRight: 6 }} />
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Danh mục Bệnh lý nền</Text>
                </View>
                <TouchableOpacity style={[styles.btnActionSmall, { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' }]} onPress={handleOpenAddCondition}>
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

                  return (
                    <View key={c.id} style={[styles.conditionCardItem, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: colors.border }]}>
                      <View style={styles.conditionCardTop}>
                        <View style={[styles.severityPill, { backgroundColor: badgeBg }]}>
                          <Text style={[styles.severityPillText, { color: badgeTextColor }]}>{badgeLabel}</Text>
                        </View>
                        <View style={styles.conditionActionRow}>
                          <TouchableOpacity style={styles.iconActionBtn} onPress={() => handleOpenEditCondition(c)}>
                            <Ionicons name="pencil" size={13} color="#0284C7" />
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.iconActionBtn, { marginLeft: 6 }]} onPress={() => handleDeleteCondition(c.id, c.name)}>
                            <Ionicons name="trash-outline" size={13} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text style={[styles.conditionName, { color: colors.textPrimary }]}>{c.name}</Text>
                      {c.note ? <Text style={[styles.conditionNote, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>{c.note}</Text> : null}
                    </View>
                  );
                })
              )}
            </View>

            {/* Dị ứng & Dinh dưỡng */}
            <View style={[styles.sectionBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="nutrition" size={17} color="#16A34A" style={{ marginRight: 6 }} />
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Dị ứng & Dinh dưỡng</Text>
                </View>
                <TouchableOpacity style={styles.btnActionSmall} onPress={handleOpenAllergiesDietModal}>
                  <Ionicons name="create-outline" size={13} color={Colors.primary} style={{ marginRight: 2 }} />
                  <Text style={styles.btnActionSmallText}>Chỉnh sửa</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.dietSubCard, { backgroundColor: isDarkMode ? '#450A0A33' : '#FEF2F2', borderColor: '#FCA5A5' }]}>
                <View style={styles.dietSubHeader}>
                  <Ionicons name="warning" size={15} color="#DC2626" style={{ marginRight: 6 }} />
                  <Text style={[styles.dietSubTitle, { color: '#DC2626' }]}>Dị ứng thuốc</Text>
                </View>
                <Text style={[styles.dietSubContent, { color: isDarkMode ? '#FCA5A5' : '#991B1B' }]}>
                  {detail?.drug_allergies || 'Không có dị ứng thuốc ghi nhận.'}
                </Text>
              </View>

              <View style={[styles.dietSubCard, { backgroundColor: isDarkMode ? '#451A0333' : '#FFFBEB', borderColor: '#FCD34D', marginTop: 8 }]}>
                <View style={styles.dietSubHeader}>
                  <Ionicons name="restaurant" size={15} color="#D97706" style={{ marginRight: 6 }} />
                  <Text style={[styles.dietSubTitle, { color: '#D97706' }]}>Dị ứng thực phẩm</Text>
                </View>
                <Text style={[styles.dietSubContent, { color: isDarkMode ? '#FDE68A' : '#92400E' }]}>
                  {detail?.food_allergies || 'Không có dị ứng thực phẩm ghi nhận.'}
                </Text>
              </View>

              <View style={[styles.dietSubCard, { backgroundColor: isDarkMode ? '#064E3B33' : '#ECFDF5', borderColor: '#6EE7B7', marginTop: 8 }]}>
                <View style={styles.dietSubHeader}>
                  <Ionicons name="leaf" size={15} color="#059669" style={{ marginRight: 6 }} />
                  <Text style={[styles.dietSubTitle, { color: '#059669' }]}>Chế độ ăn khuyến nghị</Text>
                </View>
                <Text style={[styles.dietSubContent, { color: isDarkMode ? '#A7F3D0' : '#065F46' }]}>
                  {detail?.dietary_notes || 'Ăn uống bình thường, đảm bảo dinh dưỡng.'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* TAB 2: ĐƠN THUỐC */}
        {activeTab === 'PRESCRIPTIONS' && (
          <View>
            <TouchableOpacity style={styles.btnPrescribeNew} activeOpacity={0.88} onPress={handleOpenCreatePrescription}>
              <Ionicons name="add-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.btnPrescribeNewText}>Kê đơn thuốc mới cho Bệnh nhân</Text>
            </TouchableOpacity>

            {prescriptions.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="medkit-outline" size={44} color="#94A3B8" />
                <Text style={[styles.emptyHintText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  Chưa có đơn thuốc nào. Chạm nút phía trên để kê đơn.
                </Text>
              </View>
            ) : (
              prescriptions.map((rx) => (
                <View key={rx.id} style={[styles.rxCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
                  <View style={styles.rxHeader}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.rxMedName, { color: colors.textPrimary }]}>💊 {rx.medication_name}</Text>
                      <Text style={[styles.rxDosage, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                        {rx.dosage} • {rx.frequency}
                      </Text>
                    </View>

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
                        size={13}
                        color={rx.enable_speaker_reminder ? '#059669' : '#94A3B8'}
                        style={{ marginRight: 3 }}
                      />
                      <Text style={[styles.speakerToggleBtnText, { color: rx.enable_speaker_reminder ? '#059669' : '#64748B' }]}>
                        {rx.enable_speaker_reminder ? 'Loa: BẬT' : 'Loa: TẮT'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.rxScheduleRow}>
                    <Text style={[styles.rxScheduleLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Giờ uống:</Text>
                    {(rx.schedule_times || ['08:00']).map((t, idx) => (
                      <View key={idx} style={styles.timeTag}>
                        <Ionicons name="time-outline" size={11} color="#0284C7" style={{ marginRight: 2 }} />
                        <Text style={styles.timeTagText}>{t}</Text>
                      </View>
                    ))}
                  </View>

                  {rx.instructions ? (
                    <Text style={[styles.rxInstructions, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>
                      📝 {rx.instructions}
                    </Text>
                  ) : null}

                  <View style={styles.rxActionRow}>
                    <Text style={[styles.rxDoctorCredit, { color: isDarkMode ? '#64748B' : '#94A3B8' }]}>
                      {rx.doctor_name ? `BS: ${rx.doctor_name}` : ''}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity style={styles.rxEditBtn} onPress={() => handleOpenEditPrescription(rx)}>
                        <Ionicons name="pencil" size={12} color="#0284C7" style={{ marginRight: 3 }} />
                        <Text style={styles.rxEditBtnText}>Sửa</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.rxDeleteBtn} onPress={() => handleDeletePrescription(rx.id, rx.medication_name)}>
                        <Ionicons name="trash-outline" size={12} color="#EF4444" style={{ marginRight: 3 }} />
                        <Text style={styles.rxDeleteBtnText}>Ngừng thuốc</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* TAB 3: NGƯỠNG AN TOÀN Y TẾ */}
        {activeTab === 'VITALS' && (
          <View>
            <View style={[styles.sectionBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Ngưỡng An Toàn Lâm Sàng</Text>
                <TouchableOpacity style={styles.btnActionSmall} onPress={() => setModalThresholdVisible(true)}>
                  <Ionicons name="settings-outline" size={13} color={Colors.primary} style={{ marginRight: 2 }} />
                  <Text style={styles.btnActionSmallText}>Cấu hình</Text>
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
            </View>

            <TouchableOpacity
              style={styles.btnOpenAnalytics}
              activeOpacity={0.88}
              onPress={() => navigation.navigate('DoctorAnalytics', { patientId })}
            >
              <Ionicons name="bar-chart" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.btnOpenAnalyticsText}>Xem Phân Tích Đồ Thị & Báo Cáo Sinh Hiệu</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* 1. Modal ghi chú */}
      <Modal visible={modalNotesVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Ghi Chú & Lịch Tái Khám</Text>
              <TouchableOpacity onPress={() => setModalNotesVisible(false)}>
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Lời dặn dò y khoa</Text>
            <TextInput
              style={[styles.inputField, { height: 80, textAlignVertical: 'top', color: colors.textPrimary, borderColor: colors.border }]}
              multiline
              placeholder="Nhập ghi chú / tiến triển lâm sàng..."
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

            <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleSaveNotes} disabled={isSavingNotes}>
              {isSavingNotes ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.modalSubmitBtnText}>Lưu Thay Đổi</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 2. Modal bệnh lý nền */}
      <Modal visible={modalConditionVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {editingConditionId ? 'Sửa Chẩn Đoán Bệnh Lý' : 'Thêm Bệnh Lý Nền Mới'}
              </Text>
              <TouchableOpacity onPress={() => setModalConditionVisible(false)}>
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Tên bệnh lý / chẩn đoán (*)</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="VD: Tăng huyết áp, Đái tháo đường..."
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
                    style={[styles.severityOptionBtn, isSelected ? { borderColor: s.color, backgroundColor: s.bg } : { borderColor: colors.border }]}
                    onPress={() => setCondSeverity(s.key as any)}
                  >
                    <Text style={[styles.severityOptionText, { color: isSelected ? s.color : isDarkMode ? '#CBD5E1' : '#64748B' }]}>{s.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Ghi chú lâm sàng</Text>
            <TextInput
              style={[styles.inputField, { height: 70, textAlignVertical: 'top', color: colors.textPrimary, borderColor: colors.border }]}
              multiline
              placeholder="Dặn dò cụ thể..."
              placeholderTextColor="#94A3B8"
              value={condNote}
              onChangeText={setCondNote}
            />

            <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleSaveCondition} disabled={isSavingCondition}>
              {isSavingCondition ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.modalSubmitBtnText}>Lưu Bệnh Lý</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 3. Modal dị ứng & dinh dưỡng */}
      <Modal visible={modalAllergiesDietVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Dị Ứng & Dinh Dưỡng</Text>
              <TouchableOpacity onPress={() => setModalAllergiesDietVisible(false)}>
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Dị ứng thuốc</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="VD: Penicillin, Aspirin..."
              placeholderTextColor="#94A3B8"
              value={editDrugAllergies}
              onChangeText={setEditDrugAllergies}
            />

            <Text style={styles.fieldLabel}>Dị ứng thực phẩm</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="VD: Hải sản, đậu phộng..."
              placeholderTextColor="#94A3B8"
              value={editFoodAllergies}
              onChangeText={setEditFoodAllergies}
            />

            <Text style={styles.fieldLabel}>Chế độ ăn khuyến nghị</Text>
            <TextInput
              style={[styles.inputField, { height: 75, textAlignVertical: 'top', color: colors.textPrimary, borderColor: colors.border }]}
              multiline
              placeholder="VD: Ăn nhạt, giảm muối..."
              placeholderTextColor="#94A3B8"
              value={editDietaryNotes}
              onChangeText={setEditDietaryNotes}
            />

            <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleSaveAllergiesDiet} disabled={isSavingAllergies}>
              {isSavingAllergies ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.modalSubmitBtnText}>Lưu Dinh Dưỡng</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 4. Modal đơn thuốc */}
      <Modal visible={modalPrescribeVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {editingRxId ? 'Sửa Đơn Thuốc' : 'Kê Đơn Thuốc Mới'}
              </Text>
              <TouchableOpacity onPress={() => setModalPrescribeVisible(false)}>
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Tên thuốc (*)</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="VD: Amlodipine 5mg..."
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
              <View style={{ flex: 1.2 }}>
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

            <Text style={styles.fieldLabel}>Giờ uống thuốc (cách nhau bởi dấu phẩy)</Text>
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
              placeholder="VD: Uống sau ăn 15 phút..."
              placeholderTextColor="#94A3B8"
              value={instructions}
              onChangeText={setInstructions}
            />

            <View style={styles.switchRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.switchTitle, { color: colors.textPrimary }]}>Nhắc nhở qua Loa Hub AI</Text>
                <Text style={styles.switchSub}>Tự động phát lời nhắc uống thuốc cho bệnh nhân</Text>
              </View>
              <Switch value={enableSpeaker} onValueChange={setEnableSpeaker} trackColor={{ false: '#94A3B8', true: Colors.primary }} />
            </View>

            <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleSavePrescription} disabled={isSubmittingRx}>
              {isSubmittingRx ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.modalSubmitBtnText}>Lưu Đơn Thuốc</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 5. Modal ngưỡng an toàn y tế */}
      <Modal visible={modalThresholdVisible} animationType="fade" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Cấu Hình Ngưỡng Y Tế</Text>
              <TouchableOpacity onPress={() => setModalThresholdVisible(false)}>
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Nhịp tim tối đa (bpm)</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              keyboardType="numeric"
              value={hrHigh}
              onChangeText={setHrHigh}
            />

            <Text style={styles.fieldLabel}>Nhịp tim tối thiểu (bpm)</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              keyboardType="numeric"
              value={hrLow}
              onChangeText={setHrLow}
            />

            <Text style={styles.fieldLabel}>SpO₂ tối thiểu (%)</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              keyboardType="numeric"
              value={spo2Low}
              onChangeText={setSpo2Low}
            />

            <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleSaveThresholds}>
              <Text style={styles.modalSubmitBtnText}>Lưu Cấu Hình</Text>
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
    elevation: 2,
    marginBottom: 14,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  avatarBig: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarBigImg: { width: '100%', height: '100%' },
  avatarBigText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroName: { fontSize: 16.5, fontWeight: '800', flex: 1, marginRight: 6 },
  badgeAge: { backgroundColor: '#F1F5F9', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  badgeAgeText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  heroSub: { fontSize: 11.5, marginTop: 2 },
  heroAddress: { fontSize: 11, marginTop: 2 },
  faceIdPillRow: { flexDirection: 'row', marginTop: 6 },
  faceIdPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, borderWidth: 1, gap: 4 },
  faceIdPillText: { fontSize: 10, fontWeight: '700' },

  metricsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC33',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 12,
  },
  metricItem: { flex: 1, alignItems: 'center' },
  metricVal: { fontSize: 14, fontWeight: '800' },
  metricUnit: { fontSize: 10, fontWeight: '400' },
  metricLabel: { fontSize: 10, color: '#94A3B8', marginTop: 1 },
  metricDivider: { width: 1, height: 24, backgroundColor: '#CBD5E1' },

  heroReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  heroReportBtnText: { fontSize: 12.5, fontWeight: '700', color: '#0284C7' },

  segmentContainer: { flexDirection: 'row', borderRadius: 10, padding: 3, marginBottom: 14 },
  segmentBtn: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 8 },
  segmentBtnActive: { backgroundColor: '#FFFFFF', elevation: 1 },
  segmentText: { fontSize: 12, fontWeight: '600' },

  sectionBox: { borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 14 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700' },
  btnActionSmall: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#CBD5E1' },
  btnActionSmallText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  notesQuoteBox: { borderLeftWidth: 3, paddingLeft: 10, marginVertical: 4 },
  notesBody: { fontSize: 12.5, lineHeight: 18, fontStyle: 'italic' },
  appointmentBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  appointmentText: { fontSize: 11.5, fontWeight: '600', color: '#0284C7' },

  emptyHintText: { fontSize: 12, fontStyle: 'italic', marginVertical: 6 },
  conditionCardItem: { borderRadius: 10, padding: 10, borderWidth: 1, marginBottom: 8 },
  conditionCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  severityPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  severityPillText: { fontSize: 9.5, fontWeight: '800' },
  conditionActionRow: { flexDirection: 'row' },
  iconActionBtn: { padding: 4 },
  conditionName: { fontSize: 13.5, fontWeight: '700' },
  conditionNote: { fontSize: 11.5, marginTop: 2 },

  dietSubCard: { borderRadius: 8, padding: 10, borderWidth: 1 },
  dietSubHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  dietSubTitle: { fontSize: 12, fontWeight: '700' },
  dietSubContent: { fontSize: 11.5, lineHeight: 16 },

  btnPrescribeNew: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  btnPrescribeNewText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  rxCard: { borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 10 },
  rxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rxMedName: { fontSize: 14.5, fontWeight: '700' },
  rxDosage: { fontSize: 11.5, marginTop: 2 },
  speakerToggleBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  speakerToggleBtnText: { fontSize: 10, fontWeight: '700' },
  rxScheduleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  rxScheduleLabel: { fontSize: 11 },
  timeTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  timeTagText: { fontSize: 10.5, fontWeight: '700', color: '#0284C7' },
  rxInstructions: { fontSize: 11.5, marginTop: 6, lineHeight: 16 },
  rxActionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E2E8F066' },
  rxDoctorCredit: { fontSize: 11 },
  rxEditBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5, backgroundColor: '#EFF6FF' },
  rxEditBtnText: { fontSize: 11, color: '#0284C7', fontWeight: '700' },
  rxDeleteBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5, backgroundColor: '#FEE2E2' },
  rxDeleteBtnText: { fontSize: 11, color: '#EF4444', fontWeight: '700' },

  thresholdRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E8F044' },
  thresholdLabel: { fontSize: 12, color: '#64748B' },
  thresholdVal: { fontSize: 12.5, fontWeight: '700' },
  btnOpenAnalytics: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0284C7', paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  btnOpenAnalyticsText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalBox: { borderRadius: 14, padding: 18, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '800' },
  fieldLabel: { fontSize: 11.5, fontWeight: '700', color: '#64748B', marginTop: 8, marginBottom: 4 },
  inputField: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  severityPickerRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  severityOptionBtn: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 6, borderWidth: 1 },
  severityOptionText: { fontSize: 11, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 10, paddingVertical: 6 },
  switchTitle: { fontSize: 12.5, fontWeight: '700' },
  switchSub: { fontSize: 10.5, color: '#64748B' },
  modalSubmitBtn: { backgroundColor: Colors.primary, paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 14 },
  modalSubmitBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});

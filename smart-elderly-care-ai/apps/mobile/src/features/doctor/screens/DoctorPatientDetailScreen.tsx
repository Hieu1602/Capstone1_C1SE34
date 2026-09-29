// DoctorPatientDetailScreen.tsx
// Chi tiết hồ sơ bệnh nhân, quản lý phác đồ điều trị & kê đơn thuốc cho Bác sĩ

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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Colors } from '../../../theme/colors';
import { useTheme } from '../../../store/useThemeStore';
import { doctorApi } from '../../../services/api';

export default function DoctorPatientDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDarkMode, colors } = useTheme();

  const patientId = route.params?.patientId || 'e0000000-b4e1-4b08-b2d3-d949a0eb075c';

  const [activeTab, setActiveTab] = useState<'RECORD' | 'VITALS' | 'PRESCRIPTIONS'>('RECORD');
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);

  // Modal Kê đơn thuốc mới
  const [modalPrescribeVisible, setModalPrescribeVisible] = useState(false);
  const [medName, setMedName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('Hàng ngày');
  const [instructions, setInstructions] = useState('');
  const [enableSpeaker, setEnableSpeaker] = useState(true);
  const [isSubmittingRx, setIsSubmittingRx] = useState(false);

  // Modal Chỉnh sửa hồ sơ bệnh án
  const [modalEditRecordVisible, setModalEditRecordVisible] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editNextAppt, setEditNextAppt] = useState('');
  const [editDiet, setEditDiet] = useState('');

  // Modal Điều chỉnh ngưỡng y tế
  const [modalThresholdVisible, setModalThresholdVisible] = useState(false);
  const [hrHigh, setHrHigh] = useState('120');
  const [hrLow, setHrLow] = useState('50');
  const [spo2Low, setSpo2Low] = useState('90');

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
        setEditDiet(resDetail.data.dietary_notes || '');
      }
      if (resRx.data && Array.isArray(resRx.data)) {
        setPrescriptions(resRx.data);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleCreatePrescription = async () => {
    if (!medName.trim() || !dosage.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên thuốc và liều lượng.');
      return;
    }

    try {
      setIsSubmittingRx(true);
      const payload = {
        medication_name: medName.trim(),
        dosage: dosage.trim(),
        frequency,
        schedule_times: ['08:00', '19:30'],
        instructions: instructions.trim() || 'Uống sau ăn 15 phút với nước ấm.',
        enable_speaker_reminder: enableSpeaker,
      };

      const res = await doctorApi.createPrescription(patientId, payload);
      if (res.data) {
        setPrescriptions([res.data, ...prescriptions]);
        setModalPrescribeVisible(false);
        setMedName('');
        setDosage('');
        setInstructions('');
        Alert.alert(
          'Kê đơn thành công',
          `Đã lưu đơn thuốc "${payload.medication_name}". Lịch nhắc uống thuốc đã được đồng bộ xuống loa thông minh Edge Hub Orange Pi 5!`
        );
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể kết nối lưu đơn thuốc.');
    } finally {
      setIsSubmittingRx(false);
    }
  };

  const handleSaveMedicalRecord = async () => {
    try {
      await doctorApi.updateMedicalRecord(patientId, {
        doctor_notes: editNotes,
        next_appointment: editNextAppt,
        dietary_notes: editDiet,
      });
      setDetail((prev: any) => ({
        ...prev,
        doctor_notes: editNotes,
        next_appointment: editNextAppt,
        dietary_notes: editDiet,
      }));
      setModalEditRecordVisible(false);
      Alert.alert('Thành công', 'Đã cập nhật ghi chú y khoa và lịch tái khám.');
    } catch {
      Alert.alert('Lỗi', 'Không thể cập nhật hồ sơ bệnh án.');
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

  const patientName = detail?.name || 'Cụ Nguyễn Văn An';

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Top Bar */}
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

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading && (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 10 }} />
        )}

        {/* Patient Hero Card */}
        <View
          style={[
            styles.heroCard,
            { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border },
          ]}
        >
          <View style={styles.heroRow}>
            <View style={styles.avatarBig}>
              <Text style={styles.avatarBigText}>{patientName[0] || 'C'}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.heroName, { color: colors.textPrimary }]}>{patientName}</Text>
                <View style={styles.badgeAge}>
                  <Text style={styles.badgeAgeText}>{detail?.age || 78} tuổi</Text>
                </View>
              </View>
              <Text style={[styles.heroSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                Giới tính: {detail?.gender || 'Nam'} • Nhóm máu: {detail?.blood_type || 'O+'} • BMI: {detail?.bmi || 22.8}
              </Text>
              <Text style={[styles.heroAddress, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>
                📍 {detail?.house_name || 'Nhà của tôi'} • {detail?.house_address || '123 Hải Phòng, Đà Nẵng'}
              </Text>
            </View>
          </View>

          {/* Quick Metrics Bar */}
          <View style={styles.metricsBar}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: '#EF4444' }]}>{detail?.heart_rate || 76}</Text>
              <Text style={styles.metricLabel}>Nhịp tim (bpm)</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: '#0284C7' }]}>{detail?.spo2 || 98}%</Text>
              <Text style={styles.metricLabel}>SpO₂ máu</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: '#10B981' }]}>120/80</Text>
              <Text style={styles.metricLabel}>Huyết áp</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: '#F59E0B' }]}>{detail?.skin_temp_max || 36.6}°C</Text>
              <Text style={styles.metricLabel}>Nhiệt độ da</Text>
            </View>
          </View>
        </View>

        {/* Tab Switcher */}
        <View style={[styles.segmentContainer, { backgroundColor: isDarkMode ? '#1E293B' : '#EEF2F6' }]}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'RECORD' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('RECORD')}
          >
            <Ionicons
              name="document-text-outline"
              size={16}
              color={activeTab === 'RECORD' ? Colors.primary : isDarkMode ? '#94A3B8' : '#64748B'}
            />
            <Text
              style={[
                styles.segmentText,
                activeTab === 'RECORD'
                  ? { color: Colors.primary, fontWeight: '700' }
                  : { color: isDarkMode ? '#94A3B8' : '#64748B' },
              ]}
            >
              Bệnh án & Tiền sử
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'PRESCRIPTIONS' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('PRESCRIPTIONS')}
          >
            <Ionicons
              name="medkit-outline"
              size={16}
              color={activeTab === 'PRESCRIPTIONS' ? Colors.primary : isDarkMode ? '#94A3B8' : '#64748B'}
            />
            <Text
              style={[
                styles.segmentText,
                activeTab === 'PRESCRIPTIONS'
                  ? { color: Colors.primary, fontWeight: '700' }
                  : { color: isDarkMode ? '#94A3B8' : '#64748B' },
              ]}
            >
              Đơn thuốc ({prescriptions.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'VITALS' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('VITALS')}
          >
            <Ionicons
              name="pulse-outline"
              size={16}
              color={activeTab === 'VITALS' ? Colors.primary : isDarkMode ? '#94A3B8' : '#64748B'}
            />
            <Text
              style={[
                styles.segmentText,
                activeTab === 'VITALS'
                  ? { color: Colors.primary, fontWeight: '700' }
                  : { color: isDarkMode ? '#94A3B8' : '#64748B' },
              ]}
            >
              Ngưỡng & Đồ thị
            </Text>
          </TouchableOpacity>
        </View>

        {/* TAB 1: BỆNH ÁN & TIỀN SỬ */}
        {activeTab === 'RECORD' && (
          <View>
            {/* Lời dặn Bác sĩ */}
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
                <TouchableOpacity onPress={() => setModalEditRecordVisible(true)}>
                  <Text style={{ fontSize: 13, color: Colors.primary, fontWeight: '600' }}>Chỉnh sửa</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.notesBody, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>
                {detail?.doctor_notes || 'Bệnh nhân ổn định, đáp ứng tốt với thuốc huyết áp. Cần duy trì uống thuốc đúng giờ.'}
              </Text>
              <View style={styles.appointmentBadge}>
                <Ionicons name="calendar-outline" size={14} color="#0284C7" />
                <Text style={styles.appointmentText}>
                  Tái khám: {detail?.next_appointment || '15/10/2026 - 08:30'}
                </Text>
              </View>
            </View>

            {/* Bệnh nền & Tình trạng sức khỏe */}
            <View
              style={[
                styles.sectionBox,
                { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 12 }]}>
                Danh mục Bệnh lý nền (Chẩn đoán)
              </Text>
              {(detail?.conditions || [
                { id: '1', name: 'Cao huyết áp (Độ 2)', severity: 'danger', note: 'Huyết áp nền 145/90 mmHg' },
                { id: '2', name: 'Thiếu máu cơ tim nhẹ', severity: 'warning', note: 'Tránh gắng sức thể lực mạnh' },
                { id: '3', name: 'Rối loạn tiền đình', severity: 'warning', note: 'Dễ mất thăng bằng khi đứng dậy đột ngột' },
              ]).map((c: any) => (
                <View key={c.id} style={styles.conditionItem}>
                  <View
                    style={[
                      styles.conditionDot,
                      { backgroundColor: c.severity === 'danger' ? '#EF4444' : '#F59E0B' },
                    ]}
                  />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.conditionName, { color: colors.textPrimary }]}>{c.name}</Text>
                    <Text style={[styles.conditionNote, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                      {c.note}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Dị ứng & Chế độ dinh dưỡng */}
            <View
              style={[
                styles.sectionBox,
                { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 10 }]}>
                Dị ứng & Dinh dưỡng khuyến nghị
              </Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Dị ứng thuốc:</Text>
                <Text style={[styles.infoVal, { color: '#EF4444' }]}>
                  {detail?.drug_allergies || 'Penicillin (dị ứng nổi mề đay)'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Dị ứng đồ ăn:</Text>
                <Text style={[styles.infoVal, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>
                  {detail?.food_allergies || 'Hải sản có vỏ (tôm, cua)'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Chế độ ăn:</Text>
                <Text style={[styles.infoVal, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>
                  {detail?.dietary_notes || 'Ăn nhạt, giảm muối < 3g/ngày, hạn chế dầu mỡ'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* TAB 2: ĐƠN THUỐC & KÊ ĐƠN */}
        {activeTab === 'PRESCRIPTIONS' && (
          <View>
            <TouchableOpacity
              style={styles.btnPrescribeNew}
              onPress={() => setModalPrescribeVisible(true)}
            >
              <Ionicons name="add-circle" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.btnPrescribeNewText}>Kê đơn thuốc mới cho Bệnh nhân</Text>
            </TouchableOpacity>

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
                    <Text style={[styles.rxMedName, { color: colors.textPrimary }]}>
                      💊 {rx.medication_name}
                    </Text>
                    <Text style={[styles.rxDosage, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                      Liều dùng: {rx.dosage} • {rx.frequency}
                    </Text>
                  </View>
                  {rx.enable_speaker_reminder && (
                    <View style={styles.speakerBadge}>
                      <Ionicons name="volume-high" size={12} color="#059669" />
                      <Text style={styles.speakerBadgeText}>Phát loa Hub</Text>
                    </View>
                  )}
                </View>

                <View style={styles.rxScheduleRow}>
                  <Text style={[styles.rxScheduleLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                    Giờ uống:
                  </Text>
                  {(rx.schedule_times || ['08:00']).map((t: string, idx: number) => (
                    <View key={idx} style={styles.timeTag}>
                      <Text style={styles.timeTagText}>{t}</Text>
                    </View>
                  ))}
                </View>

                <Text style={[styles.rxInstructions, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>
                  📝 {rx.instructions}
                </Text>

                <View style={styles.rxFooter}>
                  <Text style={styles.rxDoctor}>Bác sĩ kê: {rx.doctor_name}</Text>
                  <Text style={styles.rxDate}>{rx.created_at?.split(' ')[0]}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* TAB 3: NGƯỠNG Y TẾ & ĐỒ THỊ */}
        {activeTab === 'VITALS' && (
          <View>
            <View
              style={[
                styles.sectionBox,
                { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border },
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Ngưỡng An toàn Y tế Cá nhân hóa
                </Text>
                <TouchableOpacity onPress={() => setModalThresholdVisible(true)}>
                  <Text style={{ fontSize: 13, color: Colors.primary, fontWeight: '600' }}>Điều chỉnh</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.thresholdRow}>
                <View style={styles.thresholdItem}>
                  <Text style={styles.thresholdVal}>{hrHigh} bpm</Text>
                  <Text style={styles.thresholdLabel}>Nhịp tim tối đa</Text>
                </View>
                <View style={styles.thresholdItem}>
                  <Text style={styles.thresholdVal}>{hrLow} bpm</Text>
                  <Text style={styles.thresholdLabel}>Nhịp tim tối thiểu</Text>
                </View>
                <View style={styles.thresholdItem}>
                  <Text style={[styles.thresholdVal, { color: '#0284C7' }]}>{spo2Low}%</Text>
                  <Text style={styles.thresholdLabel}>SpO₂ nguy hiểm</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.btnOpenAnalytics}
              onPress={() => navigation.navigate('DoctorAnalytics', { patientId })}
            >
              <Ionicons name="bar-chart" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.btnOpenAnalyticsText}>Xem Phân tích Đồ thị 7 ngày & Xuất Báo cáo</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* MODAL KÊ ĐƠN THUỐC MỚI */}
      <Modal visible={modalPrescribeVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Kê Đơn Thuốc Y Khoa</Text>
              <TouchableOpacity onPress={() => setModalPrescribeVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Tên thuốc y tế (*)</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="VD: Amlodipine 5mg, Panadol..."
              placeholderTextColor="#94A3B8"
              value={medName}
              onChangeText={setMedName}
            />

            <Text style={styles.fieldLabel}>Liều lượng & Quy cách (*)</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="VD: 1 viên, 1 gói..."
              placeholderTextColor="#94A3B8"
              value={dosage}
              onChangeText={setDosage}
            />

            <Text style={styles.fieldLabel}>Tần suất uống</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="VD: Hàng ngày vào buổi sáng"
              placeholderTextColor="#94A3B8"
              value={frequency}
              onChangeText={setFrequency}
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
              style={styles.modalSubmitBtn}
              onPress={handleCreatePrescription}
              disabled={isSubmittingRx}
            >
              {isSubmittingRx ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Lưu Đơn Thuốc & Đồng Bộ Hub</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL ĐIỀU CHỈNH NGƯỠNG AN TOÀN */}
      <Modal visible={modalThresholdVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
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
        </View>
      </Modal>

      {/* MODAL CHỈNH SỬA HỒ SƠ BỆNH ÁN */}
      <Modal visible={modalEditRecordVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Chỉnh Sửa Dặn Dò Y Khoa</Text>
              <TouchableOpacity onPress={() => setModalEditRecordVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Ghi chú & Dặn dò điều trị</Text>
            <TextInput
              style={[styles.inputField, { height: 80, color: colors.textPrimary, borderColor: colors.border }]}
              multiline
              value={editNotes}
              onChangeText={setEditNotes}
            />

            <Text style={styles.fieldLabel}>Lịch hẹn tái khám</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              value={editNextAppt}
              onChangeText={setEditNextAppt}
            />

            <Text style={styles.fieldLabel}>Chế độ dinh dưỡng khuyến nghị</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              value={editDiet}
              onChangeText={setEditDiet}
            />

            <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleSaveMedicalRecord}>
              <Text style={styles.modalSubmitBtnText}>Cập Nhật Bệnh Án</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  topTitle: { fontSize: 17, fontWeight: '700' },
  moreBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  scrollContent: { padding: 16, paddingBottom: 60 },
  heroCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  avatarBig: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBigText: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  heroName: { fontSize: 18, fontWeight: '700', marginRight: 8 },
  badgeAge: { backgroundColor: '#EEF2F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeAgeText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  heroSub: { fontSize: 12, marginTop: 4 },
  heroAddress: { fontSize: 12, marginTop: 4 },
  metricsBar: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F066',
    justifyContent: 'space-between',
  },
  metricItem: { flex: 1, alignItems: 'center' },
  metricVal: { fontSize: 16, fontWeight: '800' },
  metricLabel: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  metricDivider: { width: 1, height: '80%', backgroundColor: '#E2E8F066' },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 4,
  },
  segmentBtnActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.05, elevation: 1 },
  segmentText: { fontSize: 12 },
  sectionBox: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  notesBody: { fontSize: 13, lineHeight: 20 },
  appointmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
    alignSelf: 'flex-start',
    gap: 6,
  },
  appointmentText: { fontSize: 12, fontWeight: '600', color: '#1E40AF' },
  conditionItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  conditionDot: { width: 10, height: 10, borderRadius: 5 },
  conditionName: { fontSize: 13, fontWeight: '700' },
  conditionNote: { fontSize: 12 },
  infoRow: { flexDirection: 'row', marginBottom: 8 },
  infoLabel: { fontSize: 13, fontWeight: '600', width: 110, color: '#64748B' },
  infoVal: { fontSize: 13, flex: 1, fontWeight: '500' },
  btnPrescribeNew: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  btnPrescribeNewText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  rxCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  rxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rxMedName: { fontSize: 15, fontWeight: '700' },
  rxDosage: { fontSize: 12, marginTop: 2 },
  speakerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  speakerBadgeText: { fontSize: 10, fontWeight: '700', color: '#059669' },
  rxScheduleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  rxScheduleLabel: { fontSize: 12 },
  timeTag: { backgroundColor: '#EEF2F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  timeTagText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  rxInstructions: { fontSize: 12, marginTop: 8 },
  rxFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F044',
  },
  rxDoctor: { fontSize: 11, color: '#94A3B8' },
  rxDate: { fontSize: 11, color: '#94A3B8' },
  thresholdRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  thresholdItem: { alignItems: 'center' },
  thresholdVal: { fontSize: 18, fontWeight: '800', color: '#EF4444' },
  thresholdLabel: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  btnOpenAnalytics: {
    flexDirection: 'row',
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  btnOpenAnalyticsText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
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
  modalSubmitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 14,
  },
  modalSubmitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});

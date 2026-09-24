// PatientMedicalRecordScreen.tsx
// Màn hình Hồ sơ bệnh án người cao tuổi (Bảo mật y tế chuẩn AES-256)

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Pressable,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../store/useThemeStore';
import { Colors } from '../../../theme/colors';

interface MedicalCondition {
  id: string;
  name: string;
  severity: 'warning' | 'danger' | 'info';
  note: string;
}

export default function PatientMedicalRecordScreen({ navigation }: any) {
  const { isDarkMode, colors } = useTheme();

  // Patient Info State
  const [patientName, setPatientName] = useState('Nguyễn Văn An');
  const [birthYear, setBirthYear] = useState('1948');
  const [age, setAge] = useState(78);
  const [gender, setGender] = useState('Nam');
  const [bloodType, setBloodType] = useState('O+');
  const [height, setHeight] = useState('165');
  const [weight, setWeight] = useState('62');

  // Medical conditions list
  const [conditions, setConditions] = useState<MedicalCondition[]>([
    {
      id: 'c1',
      name: 'Cao huyết áp (Độ 2)',
      severity: 'danger',
      note: 'Huyết áp nền 145/90 mmHg, uống Amlodipine 5mg hàng ngày',
    },
    {
      id: 'c2',
      name: 'Tim mạch (Thiếu máu cơ tim nhẹ)',
      severity: 'warning',
      note: 'Tái khám định kỳ, tránh gắng sức thể lực quá mức',
    },
    {
      id: 'c3',
      name: 'Đái tháo đường Type 2',
      severity: 'warning',
      note: 'Duy trì HbA1c < 7.0%, kiểm tra đường huyết đói mỗi sáng',
    },
    {
      id: 'c4',
      name: 'Thoái hóa khớp gối hai bên',
      severity: 'info',
      note: 'Nguy cơ té ngã khi đứng lên ngồi xuống, cần gậy hỗ trợ',
    },
  ]);

  // Allergies
  const [drugAllergies, setDrugAllergies] = useState('Penicillin, Aspirin liều cao');
  const [foodAllergies, setFoodAllergies] = useState('Tôm, cua biển (Hải sản có vỏ)');
  const [dietaryNotes, setDietaryNotes] = useState('Ăn nhạt, giảm muối (<5g/ngày), uống đủ 1.5 - 2L nước ấm');

  // Doctor & Hospital
  const [doctorName, setDoctorName] = useState('BSCKII. Trần Minh Đức');
  const [doctorPhone, setDoctorPhone] = useState('0988 123 456');
  const [doctorSpecialty, setDoctorSpecialty] = useState('Lão khoa & Tim mạch');
  const [hospital, setHospital] = useState('Bệnh viện Lão khoa TW / BV Chợ Rẫy');
  const [nextAppointment, setNextAppointment] = useState('15/10/2026');

  // Add/Edit modal states
  const [isAddConditionModalVisible, setAddConditionModalVisible] = useState(false);
  const [newConditionName, setNewConditionName] = useState('');
  const [newConditionNote, setNewConditionNote] = useState('');
  const [newConditionSeverity, setNewConditionSeverity] = useState<'warning' | 'danger' | 'info'>('warning');

  // Edit patient modal
  const [isEditPatientVisible, setEditPatientVisible] = useState(false);
  const [editNameDraft, setEditNameDraft] = useState(patientName);
  const [editBloodDraft, setEditBloodDraft] = useState(bloodType);
  const [editWeightDraft, setEditWeightDraft] = useState(weight);
  const [editHeightDraft, setEditHeightDraft] = useState(height);

  const handleCallDoctor = async () => {
    const cleanPhone = doctorPhone.replace(/\s+/g, '');
    const url = `tel:${cleanPhone}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Thông báo', `Gọi số bác sĩ phụ trách: ${doctorPhone}`);
      }
    } catch {
      Alert.alert('Thông báo', `Gọi số bác sĩ: ${doctorPhone}`);
    }
  };

  const handleAddCondition = () => {
    if (!newConditionName.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên bệnh lý hoặc tiền sử bệnh.');
      return;
    }
    const newCond: MedicalCondition = {
      id: `c_${Date.now()}`,
      name: newConditionName.trim(),
      severity: newConditionSeverity,
      note: newConditionNote.trim() || 'Đang theo dõi sức khoẻ định kỳ',
    };
    setConditions([...conditions, newCond]);
    setNewConditionName('');
    setNewConditionNote('');
    setAddConditionModalVisible(false);
    Alert.alert('Thành công', 'Đã thêm tiền sử bệnh lý vào hồ sơ.');
  };

  const handleDeleteCondition = (id: string, name: string) => {
    Alert.alert(
      'Xóa bệnh lý',
      `Bạn có chắc muốn xóa "${name}" khỏi hồ sơ bệnh án?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => {
            setConditions(conditions.filter((c) => c.id !== id));
          },
        },
      ]
    );
  };

  const handleSavePatientInfo = () => {
    setPatientName(editNameDraft.trim() || patientName);
    setBloodType(editBloodDraft.trim() || bloodType);
    setWeight(editWeightDraft.trim() || weight);
    setHeight(editHeightDraft.trim() || height);
    setEditPatientVisible(false);
    Alert.alert('Đã cập nhật', 'Thông tin bệnh nhân đã được lưu an toàn.');
  };

  const bmi = (
    parseFloat(weight) / Math.pow(parseFloat(height) / 100, 2)
  ).toFixed(1);

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: isDarkMode ? '#0B0F19' : '#F8FAFC' },
      ]}
      edges={['top']}
    >
      {/* Header */}
      <View
        style={[
          styles.headerRow,
          {
            backgroundColor: isDarkMode ? '#0B0F19' : '#FFFFFF',
            borderBottomColor: isDarkMode ? '#1E293B' : '#E2E8F0',
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.backBtn,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
            },
          ]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={isDarkMode ? '#F8FAFC' : '#0F172A'}
          />
        </TouchableOpacity>

        <View style={styles.headerTitleCenter}>
          <Text
            style={[
              styles.headerTitle,
              { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
            ]}
          >
            Hồ sơ bệnh án người cao tuổi
          </Text>
          <Text
            style={[
              styles.headerSubtitle,
              { color: isDarkMode ? '#94A3B8' : '#64748B' },
            ]}
          >
            Thông tin y tế, bệnh nền &amp; đơn thuốc
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.headerActionBtn,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
            },
          ]}
          onPress={() => {
            setEditNameDraft(patientName);
            setEditBloodDraft(bloodType);
            setEditWeightDraft(weight);
            setEditHeightDraft(height);
            setEditPatientVisible(true);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="create-outline" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Huy hiệu an toàn chuẩn mã hoá y tế AES-256 */}
        <View
          style={[
            styles.securityCard,
            {
              backgroundColor: isDarkMode ? '#0F2942' : '#F0F9FF',
              borderColor: isDarkMode ? '#0369A1' : '#BAE6FD',
            },
          ]}
        >
          <View style={styles.securityIconCircle}>
            <Ionicons name="shield-checkmark" size={24} color="#0EA5E9" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.securityBadgeRow}>
              <Text
                style={[
                  styles.securityTitle,
                  { color: isDarkMode ? '#38BDF8' : '#0369A1' },
                ]}
              >
                Dữ liệu được mã hóa chuẩn y tế AES-256
              </Text>
              <View style={styles.aesTag}>
                <Ionicons name="lock-closed" size={10} color="#0EA5E9" />
                <Text style={styles.aesTagText}>AES-256 GCM</Text>
              </View>
            </View>
            <Text
              style={[
                styles.securityDesc,
                { color: isDarkMode ? '#94A3B8' : '#0C4A6E' },
              ]}
            >
              Hồ sơ bệnh án điện tử tuân thủ tiêu chuẩn an toàn HL7/FHIR, bảo mật
              đa lớp và chỉ chia sẻ với bác sĩ chỉ định.
            </Text>
          </View>
        </View>

        {/* Khối 1: Thông tin bệnh nhân */}
        <View
          style={[
            styles.cardBlock,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={[
                  styles.cardIconBox,
                  { backgroundColor: isDarkMode ? '#1E3A8A' : '#EFF6FF' },
                ]}
              >
                <Ionicons name="person-outline" size={20} color="#2563EB" />
              </View>
              <Text
                style={[
                  styles.cardTitle,
                  { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                ]}
              >
                Thông tin người cao tuổi
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setEditNameDraft(patientName);
                setEditBloodDraft(bloodType);
                setEditWeightDraft(weight);
                setEditHeightDraft(height);
                setEditPatientVisible(true);
              }}
            >
              <Text style={styles.editLink}>Chỉnh sửa</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.patientHeroRow}>
            <View
              style={[
                styles.patientAvatar,
                { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9' },
              ]}
            >
              <Ionicons
                name="person"
                size={40}
                color={isDarkMode ? '#64748B' : '#94A3B8'}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text
                style={[
                  styles.patientHeroName,
                  { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                ]}
              >
                {patientName}
              </Text>
              <Text
                style={[
                  styles.patientHeroSub,
                  { color: isDarkMode ? '#94A3B8' : '#64748B' },
                ]}
              >
                Sinh năm: {birthYear} ({age} tuổi) • Giới tính: {gender}
              </Text>
              <View style={styles.bloodBadgeRow}>
                <View style={styles.bloodBadge}>
                  <Ionicons name="water" size={13} color="#EF4444" />
                  <Text style={styles.bloodBadgeText}>Nhóm máu: {bloodType}</Text>
                </View>
                <View
                  style={[
                    styles.bmiBadge,
                    { backgroundColor: isDarkMode ? '#064E3B' : '#DCFCE7' },
                  ]}
                >
                  <Text style={styles.bmiBadgeText}>BMI: {bmi} (Bình thường)</Text>
                </View>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.metricsGrid,
              { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' },
            ]}
          >
            <View style={styles.metricItem}>
              <Text
                style={[
                  styles.metricLabel,
                  { color: isDarkMode ? '#94A3B8' : '#64748B' },
                ]}
              >
                Chiều cao
              </Text>
              <Text
                style={[
                  styles.metricVal,
                  { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                ]}
              >
                {height} <Text style={styles.metricUnit}>cm</Text>
              </Text>
            </View>
            <View
              style={[
                styles.metricDivider,
                { backgroundColor: isDarkMode ? '#334155' : '#E2E8F0' },
              ]}
            />
            <View style={styles.metricItem}>
              <Text
                style={[
                  styles.metricLabel,
                  { color: isDarkMode ? '#94A3B8' : '#64748B' },
                ]}
              >
                Cân nặng
              </Text>
              <Text
                style={[
                  styles.metricVal,
                  { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                ]}
              >
                {weight} <Text style={styles.metricUnit}>kg</Text>
              </Text>
            </View>
            <View
              style={[
                styles.metricDivider,
                { backgroundColor: isDarkMode ? '#334155' : '#E2E8F0' },
              ]}
            />
            <View style={styles.metricItem}>
              <Text
                style={[
                  styles.metricLabel,
                  { color: isDarkMode ? '#94A3B8' : '#64748B' },
                ]}
              >
                Nhóm máu
              </Text>
              <Text style={[styles.metricVal, { color: '#EF4444' }]}>
                {bloodType}
              </Text>
            </View>
          </View>
        </View>

        {/* Khối 2: Tiền sử bệnh nền */}
        <View
          style={[
            styles.cardBlock,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={[
                  styles.cardIconBox,
                  { backgroundColor: isDarkMode ? '#4C1D1D' : '#FEE2E2' },
                ]}
              >
                <Ionicons name="pulse-outline" size={20} color="#EF4444" />
              </View>
              <View>
                <Text
                  style={[
                    styles.cardTitle,
                    { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                  ]}
                >
                  Tiền sử bệnh nền ({conditions.length})
                </Text>
                <Text
                  style={[
                    styles.cardSubtitle,
                    { color: isDarkMode ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  Được đồng bộ cảnh báo với mô hình YOLO-Pose &amp; Hub AI
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.addBtnSmall}
              onPress={() => setAddConditionModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={16} color="#FFF" />
              <Text style={styles.addBtnSmallText}>Thêm</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.conditionList}>
            {conditions.map((item, idx) => (
              <View
                key={item.id}
                style={[
                  styles.conditionCard,
                  {
                    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                    borderColor: isDarkMode ? '#334155' : '#F1F5F9',
                  },
                ]}
              >
                <View style={styles.conditionCardTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <View
                      style={[
                        styles.severityDot,
                        {
                          backgroundColor:
                            item.severity === 'danger'
                              ? '#EF4444'
                              : item.severity === 'warning'
                              ? '#F59E0B'
                              : '#0EA5E9',
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.conditionName,
                        { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                      ]}
                    >
                      {item.name}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteCondition(item.id, item.name)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color={isDarkMode ? '#94A3B8' : '#CBD5E1'}
                    />
                  </TouchableOpacity>
                </View>
                <Text
                  style={[
                    styles.conditionNote,
                    { color: isDarkMode ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  {item.note}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Khối 3: Dị ứng & Lưu ý dinh dưỡng */}
        <View
          style={[
            styles.cardBlock,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={[
                  styles.cardIconBox,
                  { backgroundColor: isDarkMode ? '#452F10' : '#FEF3C7' },
                ]}
              >
                <Ionicons name="warning-outline" size={20} color="#D97706" />
              </View>
              <Text
                style={[
                  styles.cardTitle,
                  { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                ]}
              >
                Dị ứng &amp; Lưu ý dinh dưỡng
              </Text>
            </View>
          </View>

          <View style={styles.allergySection}>
            <View style={styles.allergyRow}>
              <View style={styles.allergyTagDanger}>
                <Ionicons name="bandage-outline" size={15} color="#EF4444" />
                <Text style={styles.allergyTagDangerText}>Dị ứng thuốc:</Text>
              </View>
              <Text
                style={[
                  styles.allergyValueText,
                  { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                ]}
              >
                {drugAllergies}
              </Text>
            </View>

            <View style={styles.allergyRow}>
              <View style={styles.allergyTagWarning}>
                <Ionicons name="restaurant-outline" size={15} color="#D97706" />
                <Text style={styles.allergyTagWarningText}>Dị ứng thức ăn:</Text>
              </View>
              <Text
                style={[
                  styles.allergyValueText,
                  { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                ]}
              >
                {foodAllergies}
              </Text>
            </View>

            <View
              style={[
                styles.dietaryNoteCard,
                { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Ionicons name="nutrition-outline" size={16} color="#10B981" />
                <Text style={styles.dietaryNoteTitle}>Chế độ ăn khuyến nghị</Text>
              </View>
              <Text
                style={[
                  styles.dietaryNoteBody,
                  { color: isDarkMode ? '#94A3B8' : '#64748B' },
                ]}
              >
                {dietaryNotes}
              </Text>
            </View>
          </View>
        </View>

        {/* Khối 4: Bác sĩ điều trị & Bệnh viện phụ trách */}
        <View
          style={[
            styles.cardBlock,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={[
                  styles.cardIconBox,
                  { backgroundColor: isDarkMode ? '#133E3B' : '#CCFBF1' },
                ]}
              >
                <Ionicons name="medkit-outline" size={20} color="#0F766E" />
              </View>
              <Text
                style={[
                  styles.cardTitle,
                  { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                ]}
              >
                Bác sĩ &amp; Bệnh viện phụ trách
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.doctorCard,
              {
                backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                borderColor: isDarkMode ? '#334155' : '#E2E8F0',
              },
            ]}
          >
            <View style={styles.doctorHeader}>
              <View style={styles.doctorAvatarBox}>
                <Ionicons name="medical" size={26} color="#0EA5E9" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text
                  style={[
                    styles.doctorName,
                    { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                  ]}
                >
                  {doctorName}
                </Text>
                <Text
                  style={[
                    styles.doctorSpecialty,
                    { color: isDarkMode ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  Chuyên khoa: {doctorSpecialty}
                </Text>
                <Text
                  style={[
                    styles.hospitalName,
                    { color: isDarkMode ? '#94A3B8' : '#475569' },
                  ]}
                >
                  {hospital}
                </Text>
              </View>
            </View>

            <View style={styles.appointmentRow}>
              <Ionicons name="calendar-outline" size={16} color="#0EA5E9" />
              <Text
                style={[
                  styles.appointmentText,
                  { color: isDarkMode ? '#94A3B8' : '#475569' },
                ]}
              >
                Lịch tái khám tiếp theo:{' '}
                <Text style={{ fontWeight: '700', color: Colors.primary }}>
                  {nextAppointment}
                </Text>
              </Text>
            </View>

            <TouchableOpacity
              style={styles.callDoctorBtn}
              onPress={handleCallDoctor}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={18} color="#FFF" />
              <Text style={styles.callDoctorBtnText}>
                Gọi bác sĩ phụ trách ({doctorPhone})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Khối 5: Đơn thuốc hiện tại */}
        <View
          style={[
            styles.cardBlock,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={[
                  styles.cardIconBox,
                  { backgroundColor: isDarkMode ? '#3B1D54' : '#F3E8FF' },
                ]}
              >
                <Ionicons name="receipt-outline" size={20} color="#A855F7" />
              </View>
              <Text
                style={[
                  styles.cardTitle,
                  { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                ]}
              >
                Đơn thuốc đang điều trị
              </Text>
            </View>
          </View>

          <View style={styles.prescriptionList}>
            {[
              {
                name: 'Amlodipine 5mg',
                dosage: '1 viên / ngày (Uống 18:30 sau bữa tối)',
                purpose: 'Kiểm soát huyết áp ổn định',
              },
              {
                name: 'Metformin 500mg',
                dosage: '1 viên / ngày (Uống sau bữa tối)',
                purpose: 'Ổn định đường huyết Type 2',
              },
              {
                name: 'Glucosamine Sulfate 1500mg',
                dosage: '1 gói / ngày (Uống sau bữa sáng)',
                purpose: 'Hỗ trợ bôi trơn sụn khớp gối',
              },
            ].map((rx, idx) => (
              <View
                key={idx}
                style={[
                  styles.rxItem,
                  {
                    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                    borderBottomColor: isDarkMode ? '#334155' : '#E2E8F0',
                  },
                ]}
              >
                <View style={styles.rxIconBox}>
                  <Ionicons name="bandage" size={18} color="#A855F7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.rxName,
                      { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                    ]}
                  >
                    {rx.name}
                  </Text>
                  <Text style={styles.rxDosage}>{rx.dosage}</Text>
                  <Text
                    style={[
                      styles.rxPurpose,
                      { color: isDarkMode ? '#94A3B8' : '#64748B' },
                    ]}
                  >
                    Chỉ định: {rx.purpose}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Modal Thêm Bệnh Lý */}
      <Modal
        transparent
        visible={isAddConditionModalVisible}
        animationType="fade"
        onRequestClose={() => setAddConditionModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setAddConditionModalVisible(false)}
        >
          <Pressable
            style={[
              styles.modalCard,
              {
                backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                borderColor: isDarkMode ? '#334155' : '#E2E8F0',
              },
            ]}
            onPress={() => {}}
          >
            <Text
              style={[
                styles.modalTitle,
                { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
              ]}
            >
              Thêm bệnh nền / Tiền sử bệnh
            </Text>

            <Text
              style={[
                styles.inputLabel,
                { color: isDarkMode ? '#94A3B8' : '#64748B' },
              ]}
            >
              Tên bệnh lý / Chẩn đoán:
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                  color: isDarkMode ? '#F8FAFC' : '#0F172A',
                  borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                },
              ]}
              placeholder="VD: Suy giãn tĩnh mạch, Thoái hoá đốt sống..."
              placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
              value={newConditionName}
              onChangeText={setNewConditionName}
            />

            <Text
              style={[
                styles.inputLabel,
                { color: isDarkMode ? '#94A3B8' : '#64748B' },
              ]}
            >
              Ghi chú điều trị / Lưu ý:
            </Text>
            <TextInput
              style={[
                styles.textInput,
                styles.textArea,
                {
                  backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                  color: isDarkMode ? '#F8FAFC' : '#0F172A',
                  borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                },
              ]}
              placeholder="Ghi chú thuốc uống hoặc hướng dẫn của bác sĩ..."
              placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
              multiline
              numberOfLines={3}
              value={newConditionNote}
              onChangeText={setNewConditionNote}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[
                  styles.modalCancelBtn,
                  {
                    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
                    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                  },
                ]}
                onPress={() => setAddConditionModalVisible(false)}
              >
                <Text
                  style={[
                    styles.modalCancelText,
                    { color: isDarkMode ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  Hủy
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleAddCondition}
              >
                <Text style={styles.modalSaveText}>Lưu bệnh lý</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Chỉnh Sửa Thông Tin Cụ */}
      <Modal
        transparent
        visible={isEditPatientVisible}
        animationType="fade"
        onRequestClose={() => setEditPatientVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setEditPatientVisible(false)}
        >
          <Pressable
            style={[
              styles.modalCard,
              {
                backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                borderColor: isDarkMode ? '#334155' : '#E2E8F0',
              },
            ]}
            onPress={() => {}}
          >
            <Text
              style={[
                styles.modalTitle,
                { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
              ]}
            >
              Chỉnh sửa thông tin bệnh nhân
            </Text>

            <Text
              style={[
                styles.inputLabel,
                { color: isDarkMode ? '#94A3B8' : '#64748B' },
              ]}
            >
              Họ tên cụ:
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                  color: isDarkMode ? '#F8FAFC' : '#0F172A',
                  borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                },
              ]}
              value={editNameDraft}
              onChangeText={setEditNameDraft}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: isDarkMode ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  Chiều cao (cm):
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                      color: isDarkMode ? '#F8FAFC' : '#0F172A',
                      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                    },
                  ]}
                  keyboardType="numeric"
                  value={editHeightDraft}
                  onChangeText={setEditHeightDraft}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: isDarkMode ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  Cân nặng (kg):
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                      color: isDarkMode ? '#F8FAFC' : '#0F172A',
                      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                    },
                  ]}
                  keyboardType="numeric"
                  value={editWeightDraft}
                  onChangeText={setEditWeightDraft}
                />
              </View>
            </View>

            <Text
              style={[
                styles.inputLabel,
                { color: isDarkMode ? '#94A3B8' : '#64748B' },
              ]}
            >
              Nhóm máu:
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                  color: isDarkMode ? '#F8FAFC' : '#0F172A',
                  borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                },
              ]}
              value={editBloodDraft}
              onChangeText={setEditBloodDraft}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[
                  styles.modalCancelBtn,
                  {
                    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
                    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                  },
                ]}
                onPress={() => setEditPatientVisible(false)}
              >
                <Text
                  style={[
                    styles.modalCancelText,
                    { color: isDarkMode ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  Hủy
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSavePatientInfo}
              >
                <Text style={styles.modalSaveText}>Lưu thay đổi</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleCenter: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  securityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 12,
  },
  securityIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 4,
  },
  securityTitle: {
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  aesTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#BAE6FD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aesTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
  },
  securityDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  cardBlock: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  editLink: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  patientHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  patientAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientHeroName: {
    fontSize: 18,
    fontWeight: '800',
  },
  patientHeroSub: {
    fontSize: 12,
    marginTop: 2,
  },
  bloodBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  bloodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bloodBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B91C1C',
  },
  bmiBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bmiBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#15803D',
  },
  metricsGrid: {
    flexDirection: 'row',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  metricVal: {
    fontSize: 16,
    fontWeight: '800',
  },
  metricUnit: {
    fontSize: 11,
    fontWeight: '500',
  },
  metricDivider: {
    width: 1,
    height: 24,
  },
  addBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  addBtnSmallText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  conditionList: {
    gap: 10,
  },
  conditionCard: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  conditionCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  conditionName: {
    fontSize: 14,
    fontWeight: '700',
  },
  conditionNote: {
    fontSize: 12,
    lineHeight: 18,
    marginLeft: 16,
  },
  allergySection: {
    gap: 10,
  },
  allergyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  allergyTagDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  allergyTagDangerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B91C1C',
  },
  allergyTagWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  allergyTagWarningText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  allergyValueText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  dietaryNoteCard: {
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  dietaryNoteTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  dietaryNoteBody: {
    fontSize: 12,
    lineHeight: 18,
  },
  doctorCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  doctorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  doctorAvatarBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '800',
  },
  doctorSpecialty: {
    fontSize: 12,
    marginTop: 2,
  },
  hospitalName: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  appointmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  appointmentText: {
    fontSize: 12,
  },
  callDoctorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 12,
  },
  callDoctorBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  prescriptionList: {
    gap: 10,
  },
  rxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rxIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rxName: {
    fontSize: 14,
    fontWeight: '700',
  },
  rxDosage: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
    marginTop: 2,
  },
  rxPurpose: {
    fontSize: 11,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 10,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    height: 72,
    textAlignVertical: 'top',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  modalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
});

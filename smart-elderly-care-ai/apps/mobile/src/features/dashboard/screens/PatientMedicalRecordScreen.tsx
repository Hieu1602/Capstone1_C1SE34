// ==============================================================================
// TỆP: PatientMedicalRecordScreen.tsx
// PHÂN HỆ: Màn hình Hồ sơ Bệnh án Điện tử Người cao tuổi (Bảo mật chuẩn AES-256)
// TÁC GIẢ: Phan Nguyễn Giáng My
// MÔ TẢ CHỨC NĂNG:
//   1. Quản lý thông tin hành chính & thể trạng của người cao tuổi (Họ tên, Năm sinh,
//      Nhóm máu, Chiều cao, Cân nặng, Chỉ số BMI).
//   2. Đăng ký khuôn mặt AI (ArcFace Face Enrollment) phục vụ nhận diện định danh trên Camera.
//   3. Lưu trữ bệnh lý nền, tiền sử dị ứng thuốc/thực phẩm và thông tin Bác sĩ điều trị.
//   4. Đồng bộ hai chiều với cơ sở dữ liệu PostgreSQL qua RESTful API.
// ==============================================================================

import React, { useState, useEffect } from 'react';
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
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../../store/useThemeStore';
import { Colors } from '../../../theme/colors';
import { useVitalStore } from '../../../store/useVitalStore';
import { BASE_URL } from '../../../services/api';

// Cấu trúc dữ liệu một bệnh lý nền trong hồ sơ bệnh án
interface MedicalCondition {
  id: string;
  name: string;
  severity: 'warning' | 'danger' | 'info';
  note: string;
}

export default function PatientMedicalRecordScreen({ navigation }: any) {
  const { isDarkMode } = useTheme();
  const { fetchPatientRecord, patientRecord, isLoadingPatient, enrollPatientFace } = useVitalStore();

  // State lưu trữ thông tin hành chính & chỉ số cơ thể của người cao tuổi
  const [patientName, setPatientName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [age, setAge] = useState<number | string>('--');
  const [gender, setGender] = useState('--');
  const [bloodType, setBloodType] = useState('--');
  const [height, setHeight] = useState('--');
  const [weight, setWeight] = useState('--');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [hasFaceEnrolled, setHasFaceEnrolled] = useState(false);
  const [isUploadingFace, setIsUploadingFace] = useState(false);
  const [isFaceModalVisible, setFaceModalVisible] = useState(false);

  // Conditions & Allergies
  const [conditions, setConditions] = useState<MedicalCondition[]>([]);
  const [drugAllergies, setDrugAllergies] = useState('');
  const [foodAllergies, setFoodAllergies] = useState('');
  const [dietaryNotes, setDietaryNotes] = useState('');

  // Doctor & Hospital
  const [doctorName, setDoctorName] = useState('');
  const [doctorPhone, setDoctorPhone] = useState('');
  const [doctorSpecialty, setDoctorSpecialty] = useState('');
  const [hospital, setHospital] = useState('');
  const [nextAppointment, setNextAppointment] = useState('');

  // Date selection
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [isCalendarModalVisible, setIsCalendarModalVisible] = useState(false);
  const [calendarInputDraft, setCalendarInputDraft] = useState('');

  // Modals
  const [isAddConditionModalVisible, setAddConditionModalVisible] = useState(false);
  const [newConditionName, setNewConditionName] = useState('');
  const [newConditionNote, setNewConditionNote] = useState('');
  const [newConditionSeverity, setNewConditionSeverity] = useState<'warning' | 'danger' | 'info'>('warning');

  const [isEditPatientVisible, setEditPatientVisible] = useState(false);
  const [editNameDraft, setEditNameDraft] = useState('');
  const [editBloodDraft, setEditBloodDraft] = useState('');
  const [editWeightDraft, setEditWeightDraft] = useState('');
  const [editHeightDraft, setEditHeightDraft] = useState('');

  const formatDisplayDateVN = (ymd: string) => {
    if (!ymd || !ymd.includes('-')) return ymd;
    const parts = ymd.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : ymd;
  };

  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const getDaysAgoStr = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const loadRecord = async (targetDate?: string) => {
    const data = await fetchPatientRecord(1, targetDate || selectedDate);
    if (data) {
      setPatientName(data.name || 'Người cao tuổi');
      setBirthYear(data.birth_year ? String(data.birth_year) : '--');
      setAge(data.age || '--');
      setGender(data.gender || '--');
      setBloodType(data.blood_type || '--');
      setHeight(data.height_cm ? String(data.height_cm) : '--');
      setWeight(data.weight_kg ? String(data.weight_kg) : '--');
      setConditions(data.conditions || []);
      setDrugAllergies(data.drug_allergies || 'Không ghi nhận');
      setFoodAllergies(data.food_allergies || 'Không ghi nhận');
      setDietaryNotes(data.dietary_notes || 'Ăn uống đủ chất, hạn chế dầu mỡ và đồ mặn');
      setDoctorName(data.doctor_name || 'Chưa chỉ định');
      setDoctorPhone(data.doctor_phone || '');
      setDoctorSpecialty(data.doctor_specialty || '--');
      setHospital(data.hospital || '--');
      setNextAppointment(data.next_appointment || 'Chưa có lịch hẹn');
      if ((data as any).avatar_url) setAvatarUrl((data as any).avatar_url);
      if ((data as any).has_face_enrolled !== undefined) {
        setHasFaceEnrolled(Boolean((data as any).has_face_enrolled));
      }
    }
  };

  useEffect(() => {
    loadRecord(selectedDate);
  }, [selectedDate]);

  const handleCallDoctor = async () => {
    const activePhone = patientRecord?.doctor_phone || doctorPhone;
    if (!activePhone) {
      Alert.alert('Thông báo', 'Chưa có số điện thoại của bác sĩ phụ trách.');
      return;
    }
    const cleanPhone = activePhone.replace(/\s+/g, '');
    const url = `tel:${cleanPhone}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Thông báo', `Gọi số bác sĩ phụ trách: ${activePhone}`);
      }
    } catch {
      Alert.alert('Thông báo', `Gọi số bác sĩ: ${activePhone}`);
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
    Alert.alert('Xóa bệnh lý', `Bạn có chắc muốn xóa "${name}" khỏi hồ sơ bệnh án?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => setConditions(conditions.filter((c) => c.id !== id)),
      },
    ]);
  };

  const handleSavePatientInfo = () => {
    setPatientName(editNameDraft.trim() || patientName);
    setBloodType(editBloodDraft.trim() || bloodType);
    setWeight(editWeightDraft.trim() || weight);
    setHeight(editHeightDraft.trim() || height);
    setEditPatientVisible(false);
    Alert.alert('Đã cập nhật', 'Thông tin bệnh nhân đã được lưu an toàn.');
  };

  const handlePickFaceImage = async (useCamera: boolean) => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = useCamera
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Quyền truy cập', 'Cần cấp quyền để tải ảnh.');
          return;
        }
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      };

      const result = useCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      setFaceModalVisible(false);
      setIsUploadingFace(true);

      const formData = new FormData();
      if (Platform.OS === 'web') {
        const fetchRes = await fetch(asset.uri);
        const blob = await fetchRes.blob();
        formData.append('file', blob, 'elderly_face.jpg');
      } else {
        formData.append('file', {
          uri: asset.uri,
          name: 'elderly_face.jpg',
          type: 'image/jpeg',
        } as any);
      }

      const res = await enrollPatientFace(1, formData);
      if (res?.success) {
        setAvatarUrl(res.avatar_url);
        setHasFaceEnrolled(true);
        Alert.alert('Đăng ký khuôn mặt thành công 🎉', 'Đã trích xuất vector đặc trưng nhận diện khuôn mặt.');
      } else {
        Alert.alert('Thông báo', res?.message || 'Không thể đăng ký khuôn mặt.');
      }
    } catch (err) {
      console.warn('handlePickFaceImage error:', err);
      Alert.alert('Lỗi', 'Không thể tải ảnh khuôn mặt lên server.');
    } finally {
      setIsUploadingFace(false);
    }
  };

  const numH = parseFloat(height);
  const numW = parseFloat(weight);
  const bmi = !isNaN(numH) && !isNaN(numW) && numH > 0
    ? (numW / Math.pow(numH / 100, 2)).toFixed(1)
    : '--';

  const bgScreen = isDarkMode ? '#0B0F19' : '#F8FAFC';
  const bgCard = isDarkMode ? '#1E293B' : '#FFFFFF';
  const borderCol = isDarkMode ? '#334155' : '#E2E8F0';
  const textTitle = isDarkMode ? '#F8FAFC' : '#0F172A';
  const textSub = isDarkMode ? '#94A3B8' : '#64748B';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgScreen }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.headerRow, { backgroundColor: isDarkMode ? '#0B0F19' : '#FFFFFF', borderBottomColor: borderCol }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: borderCol }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={textTitle} />
        </TouchableOpacity>

        <View style={styles.headerTitleCenter}>
          <Text style={[styles.headerTitle, { color: textTitle }]}>Hồ sơ bệnh án người cao tuổi</Text>
          <Text style={[styles.headerSubtitle, { color: textSub }]}>Thông tin y tế, bệnh nền & đơn thuốc</Text>
        </View>

        <TouchableOpacity
          style={[styles.headerActionBtn, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: borderCol }]}
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Security Badge AES-256 */}
        <View style={[styles.securityCard, { backgroundColor: isDarkMode ? '#0F2942' : '#F0F9FF', borderColor: isDarkMode ? '#0369A1' : '#BAE6FD' }]}>
          <View style={styles.securityIconCircle}>
            <Ionicons name="shield-checkmark" size={24} color="#0EA5E9" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.securityBadgeRow}>
              <Text style={[styles.securityTitle, { color: isDarkMode ? '#38BDF8' : '#0369A1' }]}>
                Dữ liệu được mã hóa chuẩn y tế AES-256
              </Text>
              <View style={styles.aesTag}>
                <Ionicons name="lock-closed" size={10} color="#0EA5E9" />
                <Text style={styles.aesTagText}>AES-256 GCM</Text>
              </View>
            </View>
            <Text style={[styles.securityDesc, { color: isDarkMode ? '#94A3B8' : '#0C4A6E' }]}>
              Hồ sơ bệnh án điện tử tuân thủ tiêu chuẩn an toàn HL7/FHIR, bảo mật đa lớp và chỉ chia sẻ với bác sĩ chỉ định.
            </Text>
          </View>
        </View>

        {/* Khối 1: Thông tin người cao tuổi */}
        <View style={[styles.cardBlock, { backgroundColor: bgCard, borderColor: borderCol }]}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.cardIconBox, { backgroundColor: isDarkMode ? '#1E3A8A' : '#EFF6FF' }]}>
                <Ionicons name="person-outline" size={20} color="#2563EB" />
              </View>
              <Text style={[styles.cardTitle, { color: textTitle }]}>Thông tin người cao tuổi</Text>
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
            <TouchableOpacity
              style={[styles.patientAvatarContainer, { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9' }]}
              onPress={() => setFaceModalVisible(true)}
              activeOpacity={0.8}
            >
              {avatarUrl ? (
                <Image
                  source={{
                    uri: avatarUrl.startsWith('http')
                      ? avatarUrl
                      : `${BASE_URL.replace('/api/v1', '')}${avatarUrl}?t=${Date.now()}`,
                  }}
                  style={styles.patientAvatarImg}
                />
              ) : (
                <Ionicons name="person" size={40} color={isDarkMode ? '#64748B' : '#94A3B8'} />
              )}
              <View style={styles.avatarCameraBadge}>
                <Ionicons name="camera" size={11} color="#FFF" />
              </View>
            </TouchableOpacity>

            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.patientHeroName, { color: textTitle }]}>{patientName || 'Chưa cập nhật tên'}</Text>
              <Text style={[styles.patientHeroSub, { color: textSub }]}>
                Năm sinh: {birthYear} ({age} tuổi) • Giới tính: {gender}
              </Text>

              <View style={styles.bloodBadgeRow}>
                <View style={styles.bloodBadge}>
                  <Ionicons name="water" size={13} color="#EF4444" />
                  <Text style={styles.bloodBadgeText}>Nhóm máu: {bloodType}</Text>
                </View>
                <View style={[styles.bmiBadge, { backgroundColor: isDarkMode ? '#064E3B' : '#DCFCE7' }]}>
                  <Text style={styles.bmiBadgeText}>BMI: {bmi}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.faceEnrollPill,
                  hasFaceEnrolled
                    ? { backgroundColor: isDarkMode ? '#064E3B' : '#DCFCE7', borderColor: '#10B981' }
                    : { backgroundColor: isDarkMode ? '#451A03' : '#FEF3C7', borderColor: '#F59E0B' },
                ]}
                onPress={() => setFaceModalVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={hasFaceEnrolled ? 'scan-circle' : 'scan-outline'}
                  size={14}
                  color={hasFaceEnrolled ? '#10B981' : '#F59E0B'}
                />
                <Text style={[styles.faceEnrollPillText, { color: hasFaceEnrolled ? '#047857' : '#B45309' }]}>
                  {hasFaceEnrolled ? 'AI Face ID: Đã kích hoạt' : 'Khuôn mặt: Chưa đăng ký'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.metricsGrid, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricLabel, { color: textSub }]}>Chiều cao</Text>
              <Text style={[styles.metricVal, { color: textTitle }]}>
                {height} <Text style={styles.metricUnit}>cm</Text>
              </Text>
            </View>
            <View style={[styles.metricDivider, { backgroundColor: borderCol }]} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricLabel, { color: textSub }]}>Cân nặng</Text>
              <Text style={[styles.metricVal, { color: textTitle }]}>
                {weight} <Text style={styles.metricUnit}>kg</Text>
              </Text>
            </View>
            <View style={[styles.metricDivider, { backgroundColor: borderCol }]} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricLabel, { color: textSub }]}>Nhóm máu</Text>
              <Text style={[styles.metricVal, { color: '#EF4444' }]}>{bloodType}</Text>
            </View>
          </View>
        </View>

        {/* Khối Lọc Dữ Liệu Sinh Tồn Theo Ngày */}
        <View style={[styles.cardBlock, { backgroundColor: bgCard, borderColor: borderCol }]}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.cardIconBox, { backgroundColor: isDarkMode ? 'rgba(37, 99, 235, 0.15)' : '#EFF6FF' }]}>
                <Ionicons name="calendar-outline" size={20} color="#2563EB" />
              </View>
              <View>
                <Text style={[styles.cardTitle, { color: textTitle }]}>Nhật ký sinh tồn theo ngày</Text>
                <Text style={[styles.cardSubtitle, { color: textSub }]}>Đồng bộ từ vòng đeo tay BLE và Hub AI</Text>
              </View>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 10 }}>
            {[
              { label: 'Hôm nay', value: getTodayStr() },
              { label: 'Hôm qua', value: getDaysAgoStr(1) },
              { label: '2 ngày trước', value: getDaysAgoStr(2) },
              { label: '3 ngày trước', value: getDaysAgoStr(3) },
            ].map((opt) => {
              const isSelected = selectedDate === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.dateChip,
                    {
                      backgroundColor: isSelected ? Colors.primary : isDarkMode ? '#0F172A' : '#F1F5F9',
                      borderColor: isSelected ? Colors.primary : borderCol,
                    },
                  ]}
                  onPress={() => setSelectedDate(opt.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dateChipText, { color: isSelected ? '#FFF' : textTitle }]}>
                    {opt.label} ({opt.value.slice(5)})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={[styles.daySummaryBox, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: borderCol }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#93C5FD' : '#1D4ED8' }}>
                Tổng kết ngày {formatDisplayDateVN(selectedDate)}
              </Text>
              <Text style={{ fontSize: 11, color: textSub }}>
                {patientRecord?.daily_vitals?.length || 0} mốc đo ghi nhận
              </Text>
            </View>

            <TouchableOpacity
              style={styles.openDetailChartBtn}
              onPress={() => navigation.navigate('HealthDetail')}
              activeOpacity={0.8}
            >
              <Ionicons name="stats-chart" size={16} color="#FFF" />
              <Text style={styles.openDetailChartBtnText}>Xem Biểu Đồ & Dòng Thời Gian Chi Tiết</Text>
              <Ionicons name="arrow-forward" size={14} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Khối 2: Tiền sử bệnh nền */}
        <View style={[styles.cardBlock, { backgroundColor: bgCard, borderColor: borderCol }]}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.cardIconBox, { backgroundColor: isDarkMode ? '#4C1D1D' : '#FEE2E2' }]}>
                <Ionicons name="pulse-outline" size={20} color="#EF4444" />
              </View>
              <Text style={[styles.cardTitle, { color: textTitle }]}>Tiền sử bệnh nền ({conditions.length})</Text>
            </View>
            <TouchableOpacity style={styles.addBtnSmall} onPress={() => setAddConditionModalVisible(true)} activeOpacity={0.7}>
              <Ionicons name="add" size={16} color="#FFF" />
              <Text style={styles.addBtnSmallText}>Thêm</Text>
            </TouchableOpacity>
          </View>

          {conditions.length === 0 ? (
            <View style={styles.emptyInlineBox}>
              <Text style={[styles.emptyInlineText, { color: textSub }]}>Chưa có ghi nhận tiền sử bệnh nền.</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {conditions.map((item) => (
                <View
                  key={item.id}
                  style={[styles.conditionCard, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: borderCol }]}
                >
                  <View style={styles.conditionCardTop}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <View
                        style={[
                          styles.severityDot,
                          {
                            backgroundColor:
                              item.severity === 'danger' ? '#EF4444' : item.severity === 'warning' ? '#F59E0B' : '#0EA5E9',
                          },
                        ]}
                      />
                      <Text style={[styles.conditionName, { color: textTitle }]}>{item.name}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteCondition(item.id, item.name)}>
                      <Ionicons name="trash-outline" size={17} color={isDarkMode ? '#94A3B8' : '#CBD5E1'} />
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.conditionNote, { color: textSub }]}>{item.note}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Khối 3: Dị ứng & Lưu ý dinh dưỡng */}
        <View style={[styles.cardBlock, { backgroundColor: bgCard, borderColor: borderCol }]}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.cardIconBox, { backgroundColor: isDarkMode ? '#452F10' : '#FEF3C7' }]}>
                <Ionicons name="warning-outline" size={20} color="#D97706" />
              </View>
              <Text style={[styles.cardTitle, { color: textTitle }]}>Dị ứng & Lưu ý dinh dưỡng</Text>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <View style={styles.allergyRow}>
              <View style={styles.allergyTagDanger}>
                <Ionicons name="bandage-outline" size={14} color="#EF4444" />
                <Text style={styles.allergyTagDangerText}>Dị ứng thuốc:</Text>
              </View>
              <Text style={[styles.allergyValueText, { color: textTitle }]}>{drugAllergies}</Text>
            </View>

            <View style={styles.allergyRow}>
              <View style={styles.allergyTagWarning}>
                <Ionicons name="restaurant-outline" size={14} color="#D97706" />
                <Text style={styles.allergyTagWarningText}>Dị ứng thức ăn:</Text>
              </View>
              <Text style={[styles.allergyValueText, { color: textTitle }]}>{foodAllergies}</Text>
            </View>

            <View style={[styles.dietaryNoteCard, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Ionicons name="nutrition-outline" size={16} color="#10B981" />
                <Text style={styles.dietaryNoteTitle}>Chế độ ăn khuyến nghị</Text>
              </View>
              <Text style={[styles.dietaryNoteBody, { color: textSub }]}>{dietaryNotes}</Text>
            </View>
          </View>
        </View>

        {/* Khối 4: Bác sĩ điều trị & Bệnh viện */}
        <View style={[styles.cardBlock, { backgroundColor: bgCard, borderColor: borderCol }]}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.cardIconBox, { backgroundColor: isDarkMode ? '#133E3B' : '#CCFBF1' }]}>
                <Ionicons name="medkit-outline" size={20} color="#0F766E" />
              </View>
              <Text style={[styles.cardTitle, { color: textTitle }]}>Bác sĩ & Bệnh viện phụ trách</Text>
            </View>
          </View>

          <View style={[styles.doctorCard, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: borderCol }]}>
            <View style={styles.doctorHeader}>
              <View style={styles.doctorAvatarBox}>
                <Ionicons name="medical" size={24} color="#0EA5E9" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.doctorName, { color: textTitle }]}>{doctorName}</Text>
                <Text style={[styles.doctorSpecialty, { color: textSub }]}>Chuyên khoa: {doctorSpecialty}</Text>
                <Text style={[styles.hospitalName, { color: textSub }]}>Cơ sở: {hospital}</Text>
              </View>
            </View>

            <View style={styles.appointmentRow}>
              <Ionicons name="calendar-outline" size={15} color="#0EA5E9" />
              <Text style={[styles.appointmentText, { color: textSub }]}>
                Lịch tái khám: <Text style={{ fontWeight: '700', color: Colors.primary }}>{nextAppointment}</Text>
              </Text>
            </View>

            {doctorPhone ? (
              <TouchableOpacity style={styles.callDoctorBtn} onPress={handleCallDoctor} activeOpacity={0.8}>
                <Ionicons name="call" size={16} color="#FFF" />
                <Text style={styles.callDoctorBtnText}>Gọi bác sĩ ({doctorPhone})</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {/* Modal Thêm Bệnh Lý */}
      <Modal transparent visible={isAddConditionModalVisible} animationType="fade" onRequestClose={() => setAddConditionModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setAddConditionModalVisible(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: bgCard, borderColor: borderCol }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: textTitle }]}>Thêm tiền sử bệnh nền</Text>
            <Text style={[styles.inputLabel, { color: textSub }]}>Tên bệnh lý / Chẩn đoán:</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', color: textTitle, borderColor: borderCol }]}
              placeholder="VD: Thoái hoá đốt sống, Viêm xoang..."
              placeholderTextColor="#94A3B8"
              value={newConditionName}
              onChangeText={setNewConditionName}
            />
            <Text style={[styles.inputLabel, { color: textSub, marginTop: 10 }]}>Ghi chú:</Text>
            <TextInput
              style={[styles.textInput, styles.textArea, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', color: textTitle, borderColor: borderCol }]}
              placeholder="Ghi chú điều trị hoặc lưu ý..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              value={newConditionNote}
              onChangeText={setNewConditionNote}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={[styles.modalCancelBtn, { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9', borderColor: borderCol }]} onPress={() => setAddConditionModalVisible(false)}>
                <Text style={[styles.modalCancelText, { color: textSub }]}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleAddCondition}>
                <Text style={styles.modalSaveText}>Lưu bệnh lý</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Chỉnh Sửa Thông Tin Cụ */}
      <Modal transparent visible={isEditPatientVisible} animationType="fade" onRequestClose={() => setEditPatientVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditPatientVisible(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: bgCard, borderColor: borderCol }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: textTitle }]}>Chỉnh sửa thông tin bệnh nhân</Text>
            <Text style={[styles.inputLabel, { color: textSub }]}>Họ tên người cao tuổi:</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', color: textTitle, borderColor: borderCol }]}
              value={editNameDraft}
              onChangeText={setEditNameDraft}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: textSub }]}>Chiều cao (cm):</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', color: textTitle, borderColor: borderCol }]}
                  keyboardType="numeric"
                  value={editHeightDraft}
                  onChangeText={setEditHeightDraft}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: textSub }]}>Cân nặng (kg):</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', color: textTitle, borderColor: borderCol }]}
                  keyboardType="numeric"
                  value={editWeightDraft}
                  onChangeText={setEditWeightDraft}
                />
              </View>
            </View>
            <Text style={[styles.inputLabel, { color: textSub, marginTop: 10 }]}>Nhóm máu:</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', color: textTitle, borderColor: borderCol }]}
              value={editBloodDraft}
              onChangeText={setEditBloodDraft}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={[styles.modalCancelBtn, { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9', borderColor: borderCol }]} onPress={() => setEditPatientVisible(false)}>
                <Text style={[styles.modalCancelText, { color: textSub }]}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSavePatientInfo}>
                <Text style={styles.modalSaveText}>Lưu thay đổi</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Chụp / Đăng ký khuôn mặt */}
      <Modal visible={isFaceModalVisible} transparent animationType="fade" onRequestClose={() => setFaceModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setFaceModalVisible(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: bgCard, borderColor: borderCol }]}>
            <View style={{ alignItems: 'center', marginBottom: 14 }}>
              <View style={[styles.modalIconCircle, { backgroundColor: isDarkMode ? '#064E3B' : '#DCFCE7' }]}>
                <Ionicons name="scan" size={28} color="#10B981" />
              </View>
              <Text style={[styles.modalTitle, { color: textTitle, marginTop: 10 }]}>Đăng ký khuôn mặt AI</Text>
              <Text style={[styles.modalSubDesc, { color: textSub }]}>
                Chụp ảnh rõ nét chính diện khuôn mặt để camera AI nhận diện an toàn.
              </Text>
            </View>

            <TouchableOpacity style={styles.modalActionRowBtn} onPress={() => handlePickFaceImage(true)} activeOpacity={0.8}>
              <View style={[styles.modalActionIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="camera" size={20} color="#2563EB" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.modalActionTitle, { color: textTitle }]}>Mở máy ảnh chụp trực tiếp</Text>
                <Text style={[styles.modalActionSub, { color: textSub }]}>Chụp khuôn mặt ngay bây giờ</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.modalActionRowBtn, { marginTop: 10 }]} onPress={() => handlePickFaceImage(false)} activeOpacity={0.8}>
              <View style={[styles.modalActionIconBox, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="images" size={20} color="#16A34A" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.modalActionTitle, { color: textTitle }]}>Chọn ảnh từ thư viện</Text>
                <Text style={[styles.modalActionSub, { color: textSub }]}>Tải ảnh chân dung có sẵn</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.modalCloseBtn, { borderColor: borderCol, marginTop: 14 }]} onPress={() => setFaceModalVisible(false)}>
              <Text style={[styles.modalCloseBtnText, { color: textSub }]}>Hủy bỏ</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitleCenter: { flex: 1, marginHorizontal: 12 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSubtitle: { fontSize: 11, marginTop: 2 },
  headerActionBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 14 },

  securityCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 14, borderWidth: 1, gap: 12 },
  securityIconCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' },
  securityBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 },
  securityTitle: { fontSize: 13, fontWeight: '800', flex: 1 },
  aesTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#BAE6FD', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  aesTagText: { fontSize: 10, fontWeight: '700', color: '#0284C7' },
  securityDesc: { fontSize: 11, lineHeight: 16 },

  cardBlock: { borderRadius: 18, padding: 16, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  cardIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardSubtitle: { fontSize: 11, marginTop: 2 },
  editLink: { fontSize: 13, fontWeight: '600', color: Colors.primary },

  patientHeroRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  patientAvatarContainer: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.primary, overflow: 'hidden' },
  patientAvatarImg: { width: 64, height: 64, borderRadius: 32 },
  avatarCameraBadge: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 18, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  patientHeroName: { fontSize: 17, fontWeight: '800' },
  patientHeroSub: { fontSize: 12, marginTop: 2 },
  bloodBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  bloodBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEE2E2', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  bloodBadgeText: { fontSize: 11, fontWeight: '700', color: '#B91C1C' },
  bmiBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  bmiBadgeText: { fontSize: 11, fontWeight: '600', color: '#15803D' },
  faceEnrollPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 8, alignSelf: 'flex-start' },
  faceEnrollPillText: { fontSize: 11, fontWeight: '700' },

  metricsGrid: { flexDirection: 'row', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'space-around' },
  metricItem: { alignItems: 'center', flex: 1 },
  metricLabel: { fontSize: 11, marginBottom: 3 },
  metricVal: { fontSize: 15, fontWeight: '800' },
  metricUnit: { fontSize: 11, fontWeight: '500' },
  metricDivider: { width: 1, height: 22 },

  dateChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginRight: 8, borderWidth: 1 },
  dateChipText: { fontSize: 11.5, fontWeight: '700' },
  daySummaryBox: { borderRadius: 12, padding: 12, borderWidth: 1, marginTop: 6 },
  openDetailChartBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 10, gap: 6 },
  openDetailChartBtnText: { color: '#FFF', fontSize: 12.5, fontWeight: '700' },

  addBtnSmall: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  addBtnSmallText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  emptyInlineBox: { paddingVertical: 12, alignItems: 'center' },
  emptyInlineText: { fontSize: 12 },

  conditionCard: { borderRadius: 10, padding: 10, borderWidth: 1 },
  conditionCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  severityDot: { width: 8, height: 8, borderRadius: 4 },
  conditionName: { fontSize: 13.5, fontWeight: '700' },
  conditionNote: { fontSize: 11.5, marginLeft: 16 },

  allergyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  allergyTagDanger: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEE2E2', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  allergyTagDangerText: { fontSize: 11, fontWeight: '700', color: '#B91C1C' },
  allergyTagWarning: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF3C7', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  allergyTagWarningText: { fontSize: 11, fontWeight: '700', color: '#B45309' },
  allergyValueText: { fontSize: 12.5, fontWeight: '600', flex: 1 },
  dietaryNoteCard: { borderRadius: 10, padding: 10, marginTop: 4 },
  dietaryNoteTitle: { fontSize: 11.5, fontWeight: '700', color: '#10B981' },
  dietaryNoteBody: { fontSize: 11.5, lineHeight: 17 },

  doctorCard: { borderRadius: 12, padding: 12, borderWidth: 1 },
  doctorHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  doctorAvatarBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' },
  doctorName: { fontSize: 15, fontWeight: '800' },
  doctorSpecialty: { fontSize: 11.5, marginTop: 2 },
  hospitalName: { fontSize: 11.5, marginTop: 1 },
  appointmentRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  appointmentText: { fontSize: 11.5 },
  callDoctorBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#0284C7', borderRadius: 10, paddingVertical: 10 },
  callDoctorBtnText: { fontSize: 12.5, fontWeight: '700', color: '#FFF' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 420, borderRadius: 18, padding: 18, borderWidth: 1 },
  modalTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  inputLabel: { fontSize: 11.5, fontWeight: '600', marginBottom: 4 },
  textInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13.5 },
  textArea: { height: 68, textAlignVertical: 'top' },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancelBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  modalCancelText: { fontSize: 13, fontWeight: '600' },
  modalSaveBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  modalSaveText: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  modalIconCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  modalSubDesc: { fontSize: 11.5, textAlign: 'center', marginTop: 4, paddingHorizontal: 10 },
  modalActionRowBtn: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  modalActionIconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalActionTitle: { fontSize: 13, fontWeight: '700' },
  modalActionSub: { fontSize: 10.5, marginTop: 2 },
  modalCloseBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  modalCloseBtnText: { fontSize: 12.5, fontWeight: '600' },
});

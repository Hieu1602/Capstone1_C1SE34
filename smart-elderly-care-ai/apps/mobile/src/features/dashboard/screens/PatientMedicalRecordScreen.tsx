// ==============================================================================
// TỆP: PatientMedicalRecordScreen.tsx
// PHÂN HỆ: Màn hình Hồ sơ Bệnh án Điện tử Người cao tuổi (Bảo mật chuẩn AES-256)
// TÁC GIẢ: Phan Nguyễn Giáng My
// MÔ TẢ CHỨC NĂNG:
//   1. Quản lý thông tin hành chính & thể trạng của người cao tuổi (Họ tên, Năm sinh,
//      Nhóm máu, Chiều cao, Cân nặng, Chỉ số BMI).
//   2. Đăng ký khuôn mặt AI (ArcFace Face Enrollment) phục vụ nhận diện định danh trên Camera.
//   3. Lưu trữ bệnh lý nền, chỉnh sửa trực tiếp (Inline Edit) Dị ứng & Lưu ý dinh dưỡng.
//   4. Đồng bộ hai chiều với cơ sở dữ liệu PostgreSQL qua RESTful API (không dùng dữ liệu mẫu).
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../../store/useThemeStore';
import { Colors } from '../../../theme/colors';
import { useVitalStore, MedicalConditionItem } from '../../../store/useVitalStore';
import { BASE_URL } from '../../../services/api';

const getDaysAgoStr = (days = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDisplayDateVN = (ymd: string) => {
  const parts = ymd?.split('-');
  return parts?.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : ymd;
};

// Tính toán BMI chuẩn y tế: BMI = Cân nặng (kg) / (Chiều cao (m) ^ 2)
const calculateBMIInfo = (hStr: string, wStr: string) => {
  const h = parseFloat(hStr);
  const w = parseFloat(wStr);
  if (!isNaN(h) && !isNaN(w) && h > 0 && w > 0) {
    const val = w / Math.pow(h / 100, 2);
    const bmiNum = parseFloat(val.toFixed(1));
    let category = 'Bình thường';
    let color = '#15803D';
    let bg = '#DCFCE7';
    if (bmiNum < 18.5) {
      category = 'Gầy (Thiếu cân)';
      color = '#0284C7';
      bg = '#E0F2FE';
    } else if (bmiNum < 25) {
      category = 'Bình thường (Lý tưởng)';
      color = '#15803D';
      bg = '#DCFCE7';
    } else if (bmiNum < 30) {
      category = 'Tiền béo phì (Thừa cân)';
      color = '#D97706';
      bg = '#FEF3C7';
    } else {
      category = 'Béo phì';
      color = '#DC2626';
      bg = '#FEE2E2';
    }
    return { bmi: val.toFixed(1), category, color, bg };
  }
  return { bmi: '--', category: 'Chưa tính', color: '#64748B', bg: '#F1F5F9' };
};

// Tự động tính tuổi từ năm sinh
const calculateAgeFromYear = (yearStr: string) => {
  const y = parseInt(yearStr, 10);
  const cur = new Date().getFullYear();
  if (!isNaN(y) && y >= 1900 && y <= cur) {
    return cur - y;
  }
  return 0;
};

export default function PatientMedicalRecordScreen({ navigation }: any) {
  const { isDarkMode } = useTheme();
  const { fetchPatientRecord, updatePatientRecord, patientRecord, enrollPatientFace } = useVitalStore();

  // Kiểm tra trạng thái đã có hồ sơ người cao tuổi hay chưa
  const hasPatient = Boolean(
    patientRecord &&
    patientRecord.name &&
    patientRecord.name.trim() !== '' &&
    patientRecord.name.trim() !== '--'
  );

  // Trích xuất dữ liệu thực tế từ Store (hiển thị trạng thái rỗng nếu chưa có dữ liệu)
  const patientName = patientRecord?.name?.trim() ? patientRecord.name : '--';
  const birthYear = patientRecord?.birth_year && String(patientRecord.birth_year).trim() ? String(patientRecord.birth_year) : '--';
  const age =
    patientRecord?.age && Number(patientRecord.age) > 0
      ? String(patientRecord.age)
      : birthYear !== '--' && calculateAgeFromYear(birthYear) > 0
      ? String(calculateAgeFromYear(birthYear))
      : '--';
  const gender = patientRecord?.gender?.trim() ? patientRecord.gender : '--';
  const bloodType = patientRecord?.blood_type?.trim() ? patientRecord.blood_type : '--';
  const height = patientRecord?.height_cm && Number(patientRecord.height_cm) > 0 ? String(patientRecord.height_cm) : '--';
  const weight = patientRecord?.weight_kg && Number(patientRecord.weight_kg) > 0 ? String(patientRecord.weight_kg) : '--';
  const cardBMI = calculateBMIInfo(height, weight);
  const avatarUrl = patientRecord?.avatar_url || null;
  const hasFaceEnrolled = Boolean(patientRecord?.has_face_enrolled);
  const conditions: MedicalConditionItem[] = patientRecord?.conditions || [];
  const drugAllergies = patientRecord?.drug_allergies?.trim() ? patientRecord.drug_allergies : 'Chưa ghi nhận';
  const foodAllergies = patientRecord?.food_allergies?.trim() ? patientRecord.food_allergies : 'Chưa ghi nhận';
  const dietaryNotes = patientRecord?.dietary_notes?.trim() ? patientRecord.dietary_notes : 'Chưa ghi nhận';
  const doctorName = patientRecord?.doctor_name?.trim() ? patientRecord.doctor_name : 'Chưa chỉ định';
  const doctorPhone = patientRecord?.doctor_phone?.trim() ? patientRecord.doctor_phone : '';
  const doctorSpecialty = patientRecord?.doctor_specialty?.trim() ? patientRecord.doctor_specialty : '--';
  const hospital = patientRecord?.hospital?.trim() ? patientRecord.hospital : '--';
  const nextAppointment = patientRecord?.next_appointment?.trim() ? patientRecord.next_appointment : 'Chưa có lịch hẹn';

  // State bộ lọc ngày và các hộp thoại chỉnh sửa
  const [selectedDate, setSelectedDate] = useState(() => getDaysAgoStr(0));
  const [isFaceModalVisible, setFaceModalVisible] = useState(false);

  // State Modal thêm tiền sử bệnh nền
  const [isAddConditionModalVisible, setAddConditionModalVisible] = useState(false);
  const [condDraft, setCondDraft] = useState({ name: '', note: '' });

  // State Modal chỉnh sửa thông tin hành chính / thể trạng
  const [isEditPatientVisible, setEditPatientVisible] = useState(false);
  const [patientDraft, setPatientDraft] = useState({
    name: '',
    birthYear: '',
    gender: 'Nam',
    blood: 'A+',
    weight: '',
    height: '',
  });

  const draftAge = calculateAgeFromYear(patientDraft.birthYear);
  const draftBMI = calculateBMIInfo(patientDraft.height, patientDraft.weight);

  // State chỉnh sửa trực tiếp (Inline Edit) phần Dị ứng & Lưu ý dinh dưỡng
  const [isEditingAllergies, setIsEditingAllergies] = useState(false);
  const [allergyDraft, setAllergyDraft] = useState({ drug: '', food: '', diet: '' });

  useEffect(() => {
    fetchPatientRecord(1, selectedDate);
  }, [selectedDate]);

  // Mở hộp thoại chỉnh sửa thông tin người cao tuổi
  const openEditPatientModal = () => {
    setPatientDraft({
      name: patientRecord?.name || '',
      birthYear: patientRecord?.birth_year ? String(patientRecord.birth_year) : '',
      gender: patientRecord?.gender || 'Nam',
      blood: patientRecord?.blood_type || 'A+',
      weight: patientRecord?.weight_kg && Number(patientRecord.weight_kg) > 0 ? String(patientRecord.weight_kg) : '',
      height: patientRecord?.height_cm && Number(patientRecord.height_cm) > 0 ? String(patientRecord.height_cm) : '',
    });
    setEditPatientVisible(true);
  };

  // Lưu thông tin hành chính & chỉ số cơ thể xuống DB
  const handleSavePatientInfo = async () => {
    if (!patientDraft.name.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập họ tên người cao tuổi.');
      return;
    }
    const h = parseInt(patientDraft.height, 10) || 0;
    const w = parseInt(patientDraft.weight, 10) || 0;
    const by = patientDraft.birthYear.trim();
    const computedAge = calculateAgeFromYear(by);
    const { bmi: computedBMI } = calculateBMIInfo(patientDraft.height, patientDraft.weight);

    setEditPatientVisible(false);
    await updatePatientRecord(1, {
      name: patientDraft.name.trim(),
      birth_year: by,
      age: computedAge,
      gender: patientDraft.gender,
      blood_type: patientDraft.blood,
      weight_kg: w,
      height_cm: h,
      bmi: computedBMI !== '--' ? parseFloat(computedBMI) : 0,
    });
    Alert.alert('Thành công 🎉', 'Đã lưu hồ sơ người cao tuổi thành công.');
  };

  // Thêm bệnh lý nền mới vào hồ sơ
  const handleAddCondition = async () => {
    if (!condDraft.name.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên bệnh lý hoặc tiền sử bệnh.');
      return;
    }
    const nextConditions: MedicalConditionItem[] = [
      ...conditions,
      {
        id: `c_${Date.now()}`,
        name: condDraft.name.trim(),
        severity: 'warning',
        note: condDraft.note.trim(),
      },
    ];
    setCondDraft({ name: '', note: '' });
    setAddConditionModalVisible(false);
    await updatePatientRecord(1, { conditions: nextConditions });
    Alert.alert('Thành công', 'Đã thêm tiền sử bệnh lý vào hồ sơ.');
  };

  // Xóa bệnh lý nền khỏi hồ sơ
  const handleDeleteCondition = (id: string, name: string) => {
    Alert.alert('Xóa bệnh lý', `Bạn có chắc muốn xóa "${name}" khỏi hồ sơ bệnh án?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          await updatePatientRecord(1, { conditions: conditions.filter((c) => c.id !== id) });
        },
      },
    ]);
  };

  // Chuyển sang chế độ chỉnh sửa trực tiếp (Inline Edit) cho Dị ứng & Lưu ý dinh dưỡng
  const handleStartEditAllergies = () => {
    setAllergyDraft({
      drug: patientRecord?.drug_allergies || '',
      food: patientRecord?.food_allergies || '',
      diet: patientRecord?.dietary_notes || '',
    });
    setIsEditingAllergies(true);
  };

  // Lưu thay đổi Dị ứng & Lưu ý dinh dưỡng vào state và cơ sở dữ liệu
  const handleSaveAllergies = async () => {
    setIsEditingAllergies(false);
    await updatePatientRecord(1, {
      drug_allergies: allergyDraft.drug.trim(),
      food_allergies: allergyDraft.food.trim(),
      dietary_notes: allergyDraft.diet.trim(),
    });
  };

  // Gọi điện trực tiếp cho bác sĩ phụ trách
  const handleCallDoctor = async () => {
    if (!doctorPhone) {
      Alert.alert('Thông báo', 'Chưa có số điện thoại của bác sĩ phụ trách.');
      return;
    }
    const url = `tel:${doctorPhone.replace(/\s+/g, '')}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else Alert.alert('Thông báo', `Gọi số bác sĩ phụ trách: ${doctorPhone}`);
    } catch {
      Alert.alert('Thông báo', `Gọi số bác sĩ: ${doctorPhone}`);
    }
  };

  // Chụp hoặc tải ảnh chân dung để đăng ký khuôn mặt AI
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

      const formData = new FormData();
      if (Platform.OS === 'web') {
        const blob = await (await fetch(asset.uri)).blob();
        formData.append('file', blob, 'elderly_face.jpg');
      } else {
        formData.append('file', { uri: asset.uri, name: 'elderly_face.jpg', type: 'image/jpeg' } as any);
      }

      const res = await enrollPatientFace(1, formData);
      if (res?.success) {
        Alert.alert('Đăng ký khuôn mặt thành công 🎉', 'Đã trích xuất vector đặc trưng nhận diện khuôn mặt.');
      } else {
        Alert.alert('Thông báo', res?.message || 'Không thể đăng ký khuôn mặt.');
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể tải ảnh khuôn mặt lên server.');
    }
  };

  const bmi = cardBMI.bmi;

  const bgScreen = isDarkMode ? '#0B0F19' : '#F8FAFC';
  const bgCard = isDarkMode ? '#1E293B' : '#FFFFFF';
  const bgSubtle = isDarkMode ? '#0F172A' : '#F8FAFC';
  const borderCol = isDarkMode ? '#334155' : '#E2E8F0';
  const textTitle = isDarkMode ? '#F8FAFC' : '#0F172A';
  const textSub = isDarkMode ? '#94A3B8' : '#64748B';
  const inputThemeStyle = { backgroundColor: bgSubtle, color: textTitle, borderColor: borderCol };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgScreen }]} edges={['top']}>
      {/* Thanh tiêu đề (Header) */}
      <View style={[styles.headerRow, { backgroundColor: isDarkMode ? '#0B0F19' : '#FFFFFF', borderBottomColor: borderCol }]}>
        <TouchableOpacity
          style={[styles.iconCircleBtn, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: borderCol }]}
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
          style={[styles.iconCircleBtn, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: borderCol }]}
          onPress={openEditPatientModal}
          activeOpacity={0.7}
        >
          <Ionicons name={hasPatient ? "create-outline" : "add"} size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Nhãn bảo mật y tế AES-256 */}
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
        {!hasPatient ? (
          <View style={[styles.cardBlock, styles.emptyPatientCard, { backgroundColor: bgCard, borderColor: borderCol }]}>
            <View style={[styles.emptyPatientIconCircle, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}>
              <Ionicons name="person-circle-outline" size={44} color={isDarkMode ? '#64748B' : '#94A3B8'} />
            </View>
            <Text style={[styles.emptyPatientTitle, { color: textTitle }]}>
              Chưa có hồ sơ người cao tuổi
            </Text>
            <Text style={[styles.emptyPatientDesc, { color: textSub }]}>
              Vui lòng thêm thông tin để theo dõi sức khoẻ và lịch uống thuốc
            </Text>
            <TouchableOpacity
              style={styles.addPatientPrimaryBtn}
              onPress={openEditPatientModal}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle" size={18} color="#FFFFFF" />
              <Text style={styles.addPatientPrimaryBtnText}>+ Thêm hồ sơ người cao tuổi</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.cardBlock, { backgroundColor: bgCard, borderColor: borderCol }]}>
            <View style={styles.cardHeader}>
              <View style={styles.rowCenterGap8}>
                <View style={[styles.cardIconBox, { backgroundColor: isDarkMode ? '#1E3A8A' : '#EFF6FF' }]}>
                  <Ionicons name="person-outline" size={20} color="#2563EB" />
                </View>
                <Text style={[styles.cardTitle, { color: textTitle }]}>Thông tin người cao tuổi</Text>
              </View>
              <TouchableOpacity onPress={openEditPatientModal}>
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
                <Text style={[styles.patientHeroName, { color: textTitle }]}>
                  {patientName}
                </Text>
                <Text style={[styles.patientHeroSub, { color: textSub }]}>
                  {birthYear !== '--'
                    ? `Năm sinh: ${birthYear} (${age !== '--' ? `${age} tuổi` : ''}) • Giới tính: ${gender}`
                    : 'Chưa cập nhật thông tin cá nhân'}
                </Text>

                <View style={styles.bloodBadgeRow}>
                  <View style={styles.bloodBadge}>
                    <Ionicons name="water" size={13} color="#EF4444" />
                    <Text style={styles.bloodBadgeText}>Nhóm máu: {bloodType}</Text>
                  </View>
                  <View
                    style={[
                      styles.bmiBadge,
                      {
                        backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : cardBMI.bg,
                      },
                    ]}
                  >
                    <Text style={[styles.bmiBadgeText, { color: cardBMI.color }]}>
                      BMI: {cardBMI.bmi} {cardBMI.bmi !== '--' ? `(${cardBMI.category})` : ''}
                    </Text>
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

            <View style={[styles.metricsGrid, { backgroundColor: bgSubtle }]}>
              <View style={styles.metricItem}>
                <Text style={[styles.metricLabel, { color: textSub }]}>Chiều cao</Text>
                <Text style={[styles.metricVal, { color: textTitle }]}>
                  {height !== '--' ? (
                    <>
                      {height} <Text style={styles.metricUnit}>cm</Text>
                    </>
                  ) : (
                    '--'
                  )}
                </Text>
              </View>
              <View style={[styles.metricDivider, { backgroundColor: borderCol }]} />
              <View style={styles.metricItem}>
                <Text style={[styles.metricLabel, { color: textSub }]}>Cân nặng</Text>
                <Text style={[styles.metricVal, { color: textTitle }]}>
                  {weight !== '--' ? (
                    <>
                      {weight} <Text style={styles.metricUnit}>kg</Text>
                    </>
                  ) : (
                    '--'
                  )}
                </Text>
              </View>
              <View style={[styles.metricDivider, { backgroundColor: borderCol }]} />
              <View style={styles.metricItem}>
                <Text style={[styles.metricLabel, { color: textSub }]}>Nhóm máu</Text>
                <Text style={[styles.metricVal, { color: bloodType !== '--' ? '#EF4444' : textTitle }]}>
                  {bloodType}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Khối Lọc Dữ Liệu Sinh Hiệu Theo Ngày */}
        <View style={[styles.cardBlock, { backgroundColor: bgCard, borderColor: borderCol }]}>
          <View style={styles.cardHeader}>
            <View style={styles.rowCenterGap8}>
              <View style={[styles.cardIconBox, { backgroundColor: isDarkMode ? 'rgba(37, 99, 235, 0.15)' : '#EFF6FF' }]}>
                <Ionicons name="calendar-outline" size={20} color="#2563EB" />
              </View>
              <View>
                <Text style={[styles.cardTitle, { color: textTitle }]}>Nhật ký sinh hiệu theo ngày</Text>
                <Text style={[styles.cardSubtitle, { color: textSub }]}>Đồng bộ từ vòng đeo tay BLE và Hub AI</Text>
              </View>
            </View>
          </View>

          {!hasPatient ? (
            <View style={[styles.emptyNoticeBox, { backgroundColor: bgSubtle, borderColor: borderCol }]}>
              <Ionicons name="information-circle-outline" size={18} color={isDarkMode ? '#64748B' : '#94A3B8'} />
              <Text style={[styles.emptyNoticeText, { color: textSub }]}>
                Chưa có dữ liệu sinh hiệu do chưa thêm người theo dõi
              </Text>
            </View>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 10 }}>
                {[
                  { label: 'Hôm nay', value: getDaysAgoStr(0) },
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

              <View style={[styles.daySummaryBox, { backgroundColor: bgSubtle, borderColor: borderCol }]}>
                <View style={styles.summaryTopRow}>
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
            </>
          )}
        </View>

        {/* Khối 2: Tiền sử bệnh nền */}
        <View style={[styles.cardBlock, { backgroundColor: bgCard, borderColor: borderCol }]}>
          <View style={styles.cardHeader}>
            <View style={styles.rowCenterGap8}>
              <View style={[styles.cardIconBox, { backgroundColor: isDarkMode ? '#4C1D1D' : '#FEE2E2' }]}>
                <Ionicons name="pulse-outline" size={20} color="#EF4444" />
              </View>
              <Text style={[styles.cardTitle, { color: textTitle }]}>
                Tiền sử bệnh nền {hasPatient ? `(${conditions.length})` : ''}
              </Text>
            </View>
            {hasPatient && (
              <TouchableOpacity style={styles.addBtnSmall} onPress={() => setAddConditionModalVisible(true)} activeOpacity={0.7}>
                <Ionicons name="add" size={16} color="#FFF" />
                <Text style={styles.addBtnSmallText}>Thêm</Text>
              </TouchableOpacity>
            )}
          </View>

          {!hasPatient ? (
            <View style={[styles.emptyNoticeBox, { backgroundColor: bgSubtle, borderColor: borderCol }]}>
              <Ionicons name="information-circle-outline" size={18} color={isDarkMode ? '#64748B' : '#94A3B8'} />
              <Text style={[styles.emptyNoticeText, { color: textSub }]}>
                Chưa có dữ liệu bệnh nền do chưa thêm người theo dõi
              </Text>
            </View>
          ) : conditions.length === 0 ? (
            <View style={styles.emptyInlineBox}>
              <Text style={[styles.emptyInlineText, { color: textSub }]}>Chưa có ghi nhận tiền sử bệnh nền.</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {conditions.map((item) => (
                <View key={item.id} style={[styles.conditionCard, { backgroundColor: bgSubtle, borderColor: borderCol }]}>
                  <View style={styles.conditionCardTop}>
                    <View style={[styles.rowCenterGap8, { flex: 1 }]}>
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
                  {item.note ? <Text style={[styles.conditionNote, { color: textSub }]}>{item.note}</Text> : null}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Khối 3: Dị ứng & Lưu ý dinh dưỡng (Hỗ trợ Inline Edit) */}
        <View style={[styles.cardBlock, { backgroundColor: bgCard, borderColor: borderCol }]}>
          <View style={styles.cardHeader}>
            <View style={styles.rowCenterGap8}>
              <View style={[styles.cardIconBox, { backgroundColor: isDarkMode ? '#452F10' : '#FEF3C7' }]}>
                <Ionicons name="warning-outline" size={20} color="#D97706" />
              </View>
              <Text style={[styles.cardTitle, { color: textTitle }]}>Dị ứng & Lưu ý dinh dưỡng</Text>
            </View>
            {!isEditingAllergies && (
              <TouchableOpacity
                style={[
                  styles.editBtnSmall,
                  {
                    backgroundColor: isDarkMode ? 'rgba(255, 107, 0, 0.15)' : '#FFF7ED',
                    borderColor: isDarkMode ? '#EA580C' : '#FDBA74',
                  },
                ]}
                onPress={handleStartEditAllergies}
                activeOpacity={0.7}
              >
                <Ionicons name="pencil" size={13} color="#FF6B00" />
                <Text style={styles.editBtnSmallText}>Chỉnh sửa</Text>
              </TouchableOpacity>
            )}
          </View>

          {isEditingAllergies ? (
            <View style={{ gap: 12 }}>
              {/* Trường 1: Dị ứng thuốc */}
              <View>
                <View style={[styles.allergyTagDanger, { alignSelf: 'flex-start', marginBottom: 6 }]}>
                  <Ionicons name="bandage-outline" size={14} color="#EF4444" />
                  <Text style={styles.allergyTagDangerText}>Dị ứng thuốc</Text>
                </View>
                <TextInput
                  style={[styles.textInput, inputThemeStyle]}
                  placeholder="Nhập thông tin dị ứng thuốc..."
                  placeholderTextColor="#94A3B8"
                  value={allergyDraft.drug}
                  onChangeText={(drug) => setAllergyDraft((prev) => ({ ...prev, drug }))}
                />
              </View>

              {/* Trường 2: Dị ứng thức ăn */}
              <View>
                <View style={[styles.allergyTagWarning, { alignSelf: 'flex-start', marginBottom: 6 }]}>
                  <Ionicons name="restaurant-outline" size={14} color="#D97706" />
                  <Text style={styles.allergyTagWarningText}>Dị ứng thức ăn</Text>
                </View>
                <TextInput
                  style={[styles.textInput, inputThemeStyle]}
                  placeholder="Nhập thông tin dị ứng thức ăn..."
                  placeholderTextColor="#94A3B8"
                  value={allergyDraft.food}
                  onChangeText={(food) => setAllergyDraft((prev) => ({ ...prev, food }))}
                />
              </View>

              {/* Trường 3: Chế độ ăn khuyến nghị */}
              <View>
                <View style={[styles.rowCenterGap8, { marginBottom: 6 }]}>
                  <Ionicons name="nutrition-outline" size={16} color="#10B981" />
                  <Text style={styles.dietaryNoteTitle}>Chế độ ăn khuyến nghị</Text>
                </View>
                <TextInput
                  style={[styles.textInput, styles.textArea, inputThemeStyle]}
                  placeholder="Nhập chế độ ăn khuyến nghị..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={3}
                  value={allergyDraft.diet}
                  onChangeText={(diet) => setAllergyDraft((prev) => ({ ...prev, diet }))}
                />
              </View>

              {/* Hành động Hủy và Lưu thay đổi ở góc dưới bên phải */}
              <View style={styles.inlineEditActionRow}>
                <TouchableOpacity
                  style={[styles.inlineCancelBtn, { backgroundColor: isDarkMode ? '#334155' : '#E2E8F0' }]}
                  onPress={() => setIsEditingAllergies(false)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.inlineCancelBtnText, { color: isDarkMode ? '#E2E8F0' : '#475569' }]}>Hủy</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.inlineSaveBtn} onPress={handleSaveAllergies} activeOpacity={0.8}>
                  <Text style={styles.inlineSaveBtnText}>Lưu thay đổi</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
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

              <View style={[styles.dietaryNoteCard, { backgroundColor: bgSubtle }]}>
                <View style={[styles.rowCenterGap8, { marginBottom: 4 }]}>
                  <Ionicons name="nutrition-outline" size={16} color="#10B981" />
                  <Text style={styles.dietaryNoteTitle}>Chế độ ăn khuyến nghị</Text>
                </View>
                <Text style={[styles.dietaryNoteBody, { color: textSub }]}>{dietaryNotes}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Khối 4: Bác sĩ điều trị & Bệnh viện */}
        <View style={[styles.cardBlock, { backgroundColor: bgCard, borderColor: borderCol }]}>
          <View style={styles.cardHeader}>
            <View style={styles.rowCenterGap8}>
              <View style={[styles.cardIconBox, { backgroundColor: isDarkMode ? '#133E3B' : '#CCFBF1' }]}>
                <Ionicons name="medkit-outline" size={20} color="#0F766E" />
              </View>
              <Text style={[styles.cardTitle, { color: textTitle }]}>Bác sĩ & Bệnh viện phụ trách</Text>
            </View>
          </View>

          <View style={[styles.doctorCard, { backgroundColor: bgSubtle, borderColor: borderCol }]}>
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
              style={[styles.textInput, inputThemeStyle]}
              placeholder="VD: Thoái hoá đốt sống, Viêm xoang..."
              placeholderTextColor="#94A3B8"
              value={condDraft.name}
              onChangeText={(name) => setCondDraft((prev) => ({ ...prev, name }))}
            />
            <Text style={[styles.inputLabel, { color: textSub, marginTop: 10 }]}>Ghi chú:</Text>
            <TextInput
              style={[styles.textInput, styles.textArea, inputThemeStyle]}
              placeholder="Ghi chú điều trị hoặc lưu ý..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              value={condDraft.note}
              onChangeText={(note) => setCondDraft((prev) => ({ ...prev, note }))}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9', borderColor: borderCol }]}
                onPress={() => setAddConditionModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: textSub }]}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleAddCondition}>
                <Text style={styles.modalSaveText}>Lưu bệnh lý</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Chỉnh Sửa Thông Tin Bệnh Nhân */}
      <Modal transparent visible={isEditPatientVisible} animationType="fade" onRequestClose={() => setEditPatientVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditPatientVisible(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: bgCard, borderColor: borderCol, maxHeight: '92%' }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: textTitle }]}>
              {hasPatient ? 'Chỉnh sửa thông tin bệnh nhân' : 'Thêm hồ sơ người cao tuổi'}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 6 }}>
              {/* 1. Họ tên */}
              <Text style={[styles.inputLabel, { color: textSub }]}>Họ tên người cao tuổi:</Text>
              <TextInput
                style={[styles.textInput, inputThemeStyle]}
                value={patientDraft.name}
                onChangeText={(name) => setPatientDraft((prev) => ({ ...prev, name }))}
                placeholder="Nhập họ và tên người cao tuổi..."
                placeholderTextColor="#94A3B8"
              />

              {/* 2. Năm sinh & Tự động tính tuổi */}
              <View style={{ marginTop: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={[styles.inputLabel, { color: textSub, marginBottom: 0 }]}>Năm sinh:</Text>
                  {draftAge > 0 && (
                    <View style={[styles.calcBadge, { backgroundColor: isDarkMode ? '#1E3A8A' : '#EFF6FF' }]}>
                      <Ionicons name="calendar-outline" size={12} color="#2563EB" />
                      <Text style={[styles.calcBadgeText, { color: '#2563EB' }]}>
                        Tự động tính: {draftAge} tuổi
                      </Text>
                    </View>
                  )}
                </View>
                <TextInput
                  style={[styles.textInput, inputThemeStyle]}
                  keyboardType="numeric"
                  maxLength={4}
                  value={patientDraft.birthYear}
                  onChangeText={(val) => setPatientDraft((prev) => ({ ...prev, birthYear: val.replace(/[^0-9]/g, '') }))}
                  placeholder="VD: 1950 (nhập 4 chữ số)"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              {/* 3. Giới tính */}
              <Text style={[styles.inputLabel, { color: textSub, marginTop: 12 }]}>Giới tính:</Text>
              <View style={styles.genderRow}>
                {[
                  { key: 'Nam', icon: 'male', label: 'Nam' },
                  { key: 'Nữ', icon: 'female', label: 'Nữ' },
                  { key: 'Khác', icon: 'person-outline', label: 'Khác' },
                ].map((g) => {
                  const isSelected = patientDraft.gender === g.key;
                  return (
                    <TouchableOpacity
                      key={g.key}
                      style={[
                        styles.genderBtn,
                        isDarkMode && { backgroundColor: bgSubtle, borderColor: borderCol },
                        isSelected && { backgroundColor: isDarkMode ? '#1E3A8A' : '#EFF6FF', borderColor: '#2563EB', borderWidth: 1.5 },
                      ]}
                      onPress={() => setPatientDraft((prev) => ({ ...prev, gender: g.key }))}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={g.icon as any}
                        size={15}
                        color={isSelected ? '#2563EB' : textSub}
                      />
                      <Text
                        style={[
                          styles.genderBtnText,
                          { color: isSelected ? '#2563EB' : textSub, fontWeight: isSelected ? '700' : '500' },
                        ]}
                      >
                        {g.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 4. Nhóm máu (Chuẩn A+, A-, B+, B-, AB+, AB-, O+, O-) */}
              <Text style={[styles.inputLabel, { color: textSub, marginTop: 12 }]}>Nhóm máu:</Text>
              <View style={styles.bloodTypeGrid}>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => {
                  const isSelected = patientDraft.blood === b;
                  return (
                    <TouchableOpacity
                      key={b}
                      style={[
                        styles.bloodChip,
                        isDarkMode && { backgroundColor: bgSubtle, borderColor: borderCol },
                        isSelected && { backgroundColor: '#FEE2E2', borderColor: '#EF4444', borderWidth: 1.5 },
                      ]}
                      onPress={() => setPatientDraft((prev) => ({ ...prev, blood: b }))}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="water" size={11} color={isSelected ? '#DC2626' : '#94A3B8'} />
                      <Text
                        style={[
                          styles.bloodChipText,
                          { color: isSelected ? '#DC2626' : textSub, fontWeight: isSelected ? '800' : '600' },
                        ]}
                      >
                        {b}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 5. Chiều cao & Cân nặng */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: textSub }]}>Chiều cao (cm):</Text>
                  <TextInput
                    style={[styles.textInput, inputThemeStyle]}
                    keyboardType="numeric"
                    maxLength={3}
                    placeholder="VD: 165"
                    placeholderTextColor="#94A3B8"
                    value={patientDraft.height}
                    onChangeText={(heightVal) => setPatientDraft((prev) => ({ ...prev, height: heightVal.replace(/[^0-9]/g, '') }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: textSub }]}>Cân nặng (kg):</Text>
                  <TextInput
                    style={[styles.textInput, inputThemeStyle]}
                    keyboardType="numeric"
                    maxLength={3}
                    placeholder="VD: 58"
                    placeholderTextColor="#94A3B8"
                    value={patientDraft.weight}
                    onChangeText={(weightVal) => setPatientDraft((prev) => ({ ...prev, weight: weightVal.replace(/[^0-9]/g, '') }))}
                  />
                </View>
              </View>

              {/* 6. Tự động tính chỉ số BMI */}
              <View
                style={[
                  styles.bmiCalcBox,
                  {
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : draftBMI.bg,
                    borderColor: draftBMI.color,
                  },
                ]}
              >
                <Ionicons name="calculator-outline" size={18} color={draftBMI.color} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.bmiCalcTitle, { color: draftBMI.color }]}>
                    Chỉ số BMI: {draftBMI.bmi} {draftBMI.bmi !== '--' ? 'kg/m²' : ''}
                  </Text>
                  <Text style={[styles.bmiCalcSub, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>
                    {draftBMI.bmi !== '--'
                      ? `Thể trạng: ${draftBMI.category} (BMI = Cân nặng / Chiều cao²)`
                      : 'Nhập đủ chiều cao và cân nặng để tự động tính BMI'}
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9', borderColor: borderCol }]}
                onPress={() => setEditPatientVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: textSub }]}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSavePatientInfo}>
                <Text style={styles.modalSaveText}>{hasPatient ? 'Lưu thay đổi' : 'Lưu hồ sơ'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Chụp / Đăng Ký Khuôn Mặt AI */}
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
  iconCircleBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitleCenter: { flex: 1, marginHorizontal: 12 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSubtitle: { fontSize: 11, marginTop: 2 },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 14 },
  rowCenterGap8: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  securityCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 14, borderWidth: 1, gap: 12 },
  securityIconCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' },
  securityBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 },
  securityTitle: { fontSize: 13, fontWeight: '800', flex: 1 },
  aesTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#BAE6FD', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  aesTagText: { fontSize: 10, fontWeight: '700', color: '#0284C7' },
  securityDesc: { fontSize: 11, lineHeight: 16 },

  cardBlock: { borderRadius: 18, padding: 16, borderWidth: 1 },
  emptyPatientCard: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28, paddingHorizontal: 20 },
  emptyPatientIconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyPatientTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  emptyPatientDesc: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 18, paddingHorizontal: 16 },
  addPatientPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  addPatientPrimaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  emptyNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
  },
  emptyNoticeText: { fontSize: 12.5, fontWeight: '500', flex: 1 },
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
  summaryTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  openDetailChartBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 10, gap: 6 },
  openDetailChartBtnText: { color: '#FFF', fontSize: 12.5, fontWeight: '700' },

  addBtnSmall: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FF6B00', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  addBtnSmallText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  editBtnSmall: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  editBtnSmallText: { fontSize: 12, fontWeight: '700', color: '#FF6B00' },
  inlineEditActionRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 4 },
  inlineCancelBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  inlineCancelBtnText: { fontSize: 12.5, fontWeight: '600' },
  inlineSaveBtn: { backgroundColor: '#FF6B00', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  inlineSaveBtnText: { fontSize: 12.5, fontWeight: '700', color: '#FFF' },
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

  calcBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  calcBadgeText: { fontSize: 11.5, fontWeight: '700' },
  genderRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  genderBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingVertical: 9, borderColor: '#CBD5E1' },
  genderBtnText: { fontSize: 12.5 },
  bloodTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  bloodChip: { width: '23%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderRadius: 8, paddingVertical: 7, borderColor: '#CBD5E1' },
  bloodChipText: { fontSize: 12 },
  bmiCalcBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, padding: 10, marginTop: 12 },
  bmiCalcTitle: { fontSize: 12.5, fontWeight: '800' },
  bmiCalcSub: { fontSize: 11, marginTop: 2 },
});

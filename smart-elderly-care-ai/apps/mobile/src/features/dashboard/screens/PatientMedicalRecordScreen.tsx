// ==============================================================================
// TỆP: PatientMedicalRecordScreen.tsx
// PHÂN HỆ: Màn hình Hồ sơ Bệnh án Điện tử Người cao tuổi (Bảo mật chuẩn AES-256)
// TÁC GIẢ: Phan Nguyễn Giáng My
// ==============================================================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  Modal, Pressable, Alert, Linking, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../../store/useThemeStore';
import { Colors } from '../../../theme/colors';
import { useVitalStore, MedicalConditionItem } from '../../../store/useVitalStore';
import { BASE_URL } from '../../../services/api';

const getDaysAgoStr = (days = 0) => {
  const d = new Date(); d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDisplayDateVN = (ymd: string) => {
  const p = ymd?.split('-'); return p?.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : ymd;
};

// Tính toán BMI chuẩn y tế: BMI = Cân nặng (kg) / (Chiều cao (m) ^ 2)
const calculateBMIInfo = (hStr: string, wStr: string) => {
  const h = parseFloat(hStr) / 100, w = parseFloat(wStr);
  if (h > 0 && w > 0) {
    const bmiNum = parseFloat((w / (h * h)).toFixed(1));
    const [category, color, bg] =
      bmiNum < 18.5 ? ['Gầy (Thiếu cân)', '#0284C7', '#E0F2FE']
      : bmiNum < 25 ? ['Bình thường (Lý tưởng)', '#15803D', '#DCFCE7']
      : bmiNum < 30 ? ['Tiền béo phì (Thừa cân)', '#D97706', '#FEF3C7']
      : ['Béo phì', '#DC2626', '#FEE2E2'];
    return { bmi: bmiNum.toFixed(1), category, color, bg };
  }
  return { bmi: '--', category: 'Chưa tính', color: '#64748B', bg: '#F1F5F9' };
};

const calculateAgeFromYear = (yearStr: string) => {
  const y = parseInt(yearStr, 10), cur = new Date().getFullYear();
  return !isNaN(y) && y >= 1900 && y <= cur ? cur - y : 0;
};

export default function PatientMedicalRecordScreen({ navigation }: any) {
  const { isDarkMode } = useTheme();
  const { fetchPatientRecord, updatePatientRecord, patientRecord, enrollPatientFace } = useVitalStore();

  const hasPatient = Boolean(patientRecord?.name && patientRecord.name.trim() !== '' && patientRecord.name.trim() !== '--');
  const patientName = patientRecord?.name?.trim() || '--';
  const birthYear = patientRecord?.birth_year ? String(patientRecord.birth_year).trim() : '--';
  const age = patientRecord?.age && Number(patientRecord.age) > 0 ? String(patientRecord.age) : birthYear !== '--' && calculateAgeFromYear(birthYear) > 0 ? String(calculateAgeFromYear(birthYear)) : '--';
  const gender = patientRecord?.gender?.trim() || '--', bloodType = patientRecord?.blood_type?.trim() || '--';
  const height = patientRecord?.height_cm && Number(patientRecord.height_cm) > 0 ? String(patientRecord.height_cm) : '--';
  const weight = patientRecord?.weight_kg && Number(patientRecord.weight_kg) > 0 ? String(patientRecord.weight_kg) : '--';
  const cardBMI = calculateBMIInfo(height, weight), avatarUrl = patientRecord?.avatar_url || null;
  const hasFaceEnrolled = Boolean(patientRecord?.has_face_enrolled);
  const conditions: MedicalConditionItem[] = patientRecord?.conditions || [];
  const drugAllergies = patientRecord?.drug_allergies?.trim() || 'Chưa ghi nhận';
  const foodAllergies = patientRecord?.food_allergies?.trim() || 'Chưa ghi nhận';
  const dietaryNotes = patientRecord?.dietary_notes?.trim() || 'Chưa ghi nhận';
  const doctorName = patientRecord?.doctor_name?.trim() || 'Chưa chỉ định', doctorPhone = patientRecord?.doctor_phone?.trim() || '';
  const doctorSpecialty = patientRecord?.doctor_specialty?.trim() || '--', hospital = patientRecord?.hospital?.trim() || '--';
  const nextAppointment = patientRecord?.next_appointment?.trim() || 'Chưa có lịch hẹn';

  const [selectedDate, setSelectedDate] = useState(() => getDaysAgoStr(0));
  const [isFaceModalVisible, setFaceModalVisible] = useState(false);
  const [isAddConditionModalVisible, setAddConditionModalVisible] = useState(false);
  const [condDraft, setCondDraft] = useState({ name: '', note: '' });
  const [isEditPatientVisible, setEditPatientVisible] = useState(false);
  const [patientDraft, setPatientDraft] = useState({ name: '', birthYear: '', gender: 'Nam', blood: 'A+', weight: '', height: '' });
  const [isEditingAllergies, setIsEditingAllergies] = useState(false);
  const [allergyDraft, setAllergyDraft] = useState({ drug: '', food: '', diet: '' });

  const draftAge = calculateAgeFromYear(patientDraft.birthYear);
  const draftBMI = calculateBMIInfo(patientDraft.height, patientDraft.weight);

  useEffect(() => { fetchPatientRecord(1, selectedDate); }, [selectedDate]);

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

  const executeSavePatientInfo = async () => {
    const h = parseInt(patientDraft.height, 10) || 0, w = parseInt(patientDraft.weight, 10) || 0, by = patientDraft.birthYear.trim();
    const { bmi } = calculateBMIInfo(patientDraft.height, patientDraft.weight);
    setEditPatientVisible(false);
    await updatePatientRecord(1, {
      name: patientDraft.name.trim(), birth_year: by, age: calculateAgeFromYear(by),
      gender: patientDraft.gender, blood_type: patientDraft.blood, weight_kg: w, height_cm: h,
      bmi: bmi !== '--' ? parseFloat(bmi) : 0,
    });
    Alert.alert('Thành công 🎉', 'Đã lưu hồ sơ người cao tuổi thành công.');
  };

  const handleSavePatientInfo = () => {
    if (!patientDraft.name.trim()) return Alert.alert('Thiếu thông tin', 'Vui lòng nhập họ tên người cao tuổi.');
    Alert.alert(
      'Xác nhận lưu hồ sơ',
      `Bạn có chắc chắn muốn lưu thông tin hồ sơ cho "${patientDraft.name.trim()}" không?`,
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Xác nhận lưu', onPress: executeSavePatientInfo },
      ]
    );
  };

  const handleCloseEditPatient = () => {
    const isDirty =
      patientDraft.name.trim() !== (patientRecord?.name || '').trim() ||
      patientDraft.gender !== (patientRecord?.gender || 'male') ||
      patientDraft.blood !== (patientRecord?.blood_type || 'A+') ||
      patientDraft.birthYear !== (patientRecord?.birth_year || '');

    if (isDirty) {
      Alert.alert(
        'Thay đổi chưa lưu',
        'Thông tin hồ sơ đã được chỉnh sửa. Bạn có muốn lưu thay đổi trước khi đóng không?',
        [
          { text: 'Tiếp tục sửa', style: 'cancel' },
          {
            text: 'Không lưu',
            style: 'destructive',
            onPress: () => setEditPatientVisible(false),
          },
          { text: 'Lưu thay đổi', onPress: executeSavePatientInfo },
        ]
      );
    } else {
      setEditPatientVisible(false);
    }
  };

  const handleAddCondition = async () => {
    if (!condDraft.name.trim()) return Alert.alert('Lỗi', 'Vui lòng nhập tên bệnh lý hoặc tiền sử bệnh.');
    const next = [...conditions, { id: `c_${Date.now()}`, name: condDraft.name.trim(), severity: 'warning' as const, note: condDraft.note.trim() }];
    setCondDraft({ name: '', note: '' }); setAddConditionModalVisible(false);
    await updatePatientRecord(1, { conditions: next });
    Alert.alert('Thành công', 'Đã thêm tiền sử bệnh lý vào hồ sơ.');
  };

  const handleDeleteCondition = (id: string, name: string) => {
    Alert.alert('Xóa bệnh lý', `Bạn có chắc muốn xóa "${name}" khỏi hồ sơ bệnh án?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: async () => { await updatePatientRecord(1, { conditions: conditions.filter(c => c.id !== id) }); } },
    ]);
  };

  const handleStartEditAllergies = () => {
    setAllergyDraft({ drug: patientRecord?.drug_allergies || '', food: patientRecord?.food_allergies || '', diet: patientRecord?.dietary_notes || '' });
    setIsEditingAllergies(true);
  };

  const handleSaveAllergies = async () => {
    setIsEditingAllergies(false);
    await updatePatientRecord(1, { drug_allergies: allergyDraft.drug.trim(), food_allergies: allergyDraft.food.trim(), dietary_notes: allergyDraft.diet.trim() });
  };

  const handleCallDoctor = async () => {
    if (!doctorPhone) return Alert.alert('Thông báo', 'Chưa có số điện thoại của bác sĩ phụ trách.');
    const url = `tel:${doctorPhone.replace(/\s+/g, '')}`;
    try {
      if (await Linking.canOpenURL(url)) await Linking.openURL(url);
      else Alert.alert('Thông báo', `Gọi số bác sĩ phụ trách: ${doctorPhone}`);
    } catch { Alert.alert('Lỗi', 'Không thể khởi chạy ứng dụng gọi điện thoại.'); }
  };

  const handlePickFaceImage = async (fromCamera = false) => {
    try {
      const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') return Alert.alert('Quyền truy cập', `Vui lòng cấp quyền ${fromCamera ? 'Camera' : 'Thư viện ảnh'}.`);
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 };
      const res = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets?.[0]) return;
      setFaceModalVisible(false);

      const formData = new FormData();
      if (Platform.OS === 'web') {
        const blob = await (await fetch(res.assets[0].uri)).blob();
        formData.append('file', blob, 'elderly_face.jpg');
      } else {
        formData.append('file', { uri: res.assets[0].uri, name: 'elderly_face.jpg', type: 'image/jpeg' } as any);
      }
      const enrollRes = await enrollPatientFace(1, formData);
      Alert.alert(enrollRes?.success ? 'Đăng ký khuôn mặt thành công 🎉' : 'Thông báo', enrollRes?.success ? 'Đã trích xuất vector đặc trưng nhận diện khuôn mặt.' : (enrollRes?.message || 'Không thể đăng ký khuôn mặt.'));
    } catch { Alert.alert('Lỗi', 'Không thể tải ảnh khuôn mặt lên server.'); }
  };

  const bgScreen = isDarkMode ? '#0B0F19' : '#F8FAFC', bgCard = isDarkMode ? '#1E293B' : '#FFFFFF';
  const bgSubtle = isDarkMode ? '#0F172A' : '#F8FAFC', borderCol = isDarkMode ? '#334155' : '#E2E8F0';
  const textTitle = isDarkMode ? '#F8FAFC' : '#0F172A', textSub = isDarkMode ? '#94A3B8' : '#64748B';
  const inputStyle = [styles.textInput, { backgroundColor: bgSubtle, color: textTitle, borderColor: borderCol }];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgScreen }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.headerRow, { backgroundColor: isDarkMode ? '#0B0F19' : '#FFFFFF', borderBottomColor: borderCol }]}>
        <TouchableOpacity style={[styles.iconCircleBtn, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: borderCol }]} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={textTitle} />
        </TouchableOpacity>
        <View style={styles.headerTitleCenter}>
          <Text style={[styles.headerTitle, { color: textTitle }]}>Hồ sơ bệnh án người cao tuổi</Text>
          <Text style={[styles.headerSubtitle, { color: textSub }]}>Thông tin y tế, bệnh nền & đơn thuốc</Text>
        </View>
        <TouchableOpacity style={[styles.iconCircleBtn, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: borderCol }]} onPress={openEditPatientModal} activeOpacity={0.7}>
          <Ionicons name={hasPatient ? 'create-outline' : 'add'} size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Nhãn bảo mật y tế AES-256 */}
        <View style={[styles.securityCard, { backgroundColor: isDarkMode ? '#0F2942' : '#F0F9FF', borderColor: isDarkMode ? '#0369A1' : '#BAE6FD' }]}>
          <View style={styles.securityIconCircle}><Ionicons name="shield-checkmark" size={24} color="#0EA5E9" /></View>
          <View style={{ flex: 1 }}>
            <View style={styles.securityBadgeRow}>
              <Text style={[styles.securityTitle, { color: isDarkMode ? '#38BDF8' : '#0369A1' }]}>Dữ liệu được mã hóa chuẩn y tế AES-256</Text>
              <View style={styles.aesTag}><Ionicons name="lock-closed" size={10} color="#0EA5E9" /><Text style={styles.aesTagText}>AES-256 GCM</Text></View>
            </View>
            <Text style={[styles.securityDesc, { color: isDarkMode ? '#94A3B8' : '#0C4A6E' }]}>Hồ sơ bệnh án điện tử tuân thủ tiêu chuẩn an toàn HL7/FHIR, bảo mật đa lớp và chỉ chia sẻ với bác sĩ chỉ định.</Text>
          </View>
        </View>

        {/* Khối 1: Thông tin người cao tuổi */}
        {!hasPatient ? (
          <View style={[styles.cardBlock, styles.emptyPatientCard, { backgroundColor: bgCard, borderColor: borderCol }]}>
            <View style={[styles.emptyPatientIconCircle, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}>
              <Ionicons name="person-circle-outline" size={44} color={isDarkMode ? '#64748B' : '#94A3B8'} />
            </View>
            <Text style={[styles.emptyPatientTitle, { color: textTitle }]}>Chưa có hồ sơ người cao tuổi</Text>
            <Text style={[styles.emptyPatientDesc, { color: textSub }]}>Vui lòng thêm thông tin để theo dõi sức khoẻ và lịch uống thuốc</Text>
            <TouchableOpacity style={styles.addPatientPrimaryBtn} onPress={openEditPatientModal} activeOpacity={0.8}>
              <Ionicons name="add-circle" size={18} color="#FFFFFF" /><Text style={styles.addPatientPrimaryBtnText}>+ Thêm hồ sơ người cao tuổi</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.cardBlock, { backgroundColor: bgCard, borderColor: borderCol }]}>
            <View style={styles.cardHeader}>
              <View style={styles.rowCenterGap8}>
                <View style={[styles.cardIconBox, { backgroundColor: isDarkMode ? '#1E3A8A' : '#EFF6FF' }]}><Ionicons name="person-outline" size={20} color="#2563EB" /></View>
                <Text style={[styles.cardTitle, { color: textTitle }]}>Thông tin người cao tuổi</Text>
              </View>
              <TouchableOpacity onPress={openEditPatientModal}><Text style={styles.editLink}>Chỉnh sửa</Text></TouchableOpacity>
            </View>

            <View style={styles.patientHeroRow}>
              <TouchableOpacity style={[styles.patientAvatarContainer, { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9' }]} onPress={() => setFaceModalVisible(true)} activeOpacity={0.8}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl.startsWith('http') ? avatarUrl : `${BASE_URL.replace('/api/v1', '')}${avatarUrl}?t=${Date.now()}` }} style={styles.patientAvatarImg} />
                ) : <Ionicons name="person" size={40} color={isDarkMode ? '#64748B' : '#94A3B8'} />}
                <View style={styles.avatarCameraBadge}><Ionicons name="camera" size={11} color="#FFF" /></View>
              </TouchableOpacity>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[styles.patientHeroName, { color: textTitle }]}>{patientName}</Text>
                <Text style={[styles.patientHeroSub, { color: textSub }]}>
                  {birthYear !== '--' ? `Năm sinh: ${birthYear} (${age !== '--' ? `${age} tuổi` : ''}) • Giới tính: ${gender}` : 'Chưa cập nhật thông tin cá nhân'}
                </Text>
                <View style={styles.bloodBadgeRow}>
                  <View style={styles.bloodBadge}><Ionicons name="water" size={13} color="#EF4444" /><Text style={styles.bloodBadgeText}>Nhóm máu: {bloodType}</Text></View>
                  <View style={[styles.bmiBadge, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : cardBMI.bg }]}>
                    <Text style={[styles.bmiBadgeText, { color: cardBMI.color }]}>BMI: {cardBMI.bmi} {cardBMI.bmi !== '--' ? `(${cardBMI.category})` : ''}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.faceEnrollPill, hasFaceEnrolled ? { backgroundColor: isDarkMode ? '#064E3B' : '#DCFCE7', borderColor: '#10B981' } : { backgroundColor: isDarkMode ? '#451A03' : '#FEF3C7', borderColor: '#F59E0B' }]}
                  onPress={() => setFaceModalVisible(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={hasFaceEnrolled ? 'scan-circle' : 'scan-outline'} size={14} color={hasFaceEnrolled ? '#10B981' : '#F59E0B'} />
                  <Text style={[styles.faceEnrollPillText, { color: hasFaceEnrolled ? '#047857' : '#B45309' }]}>{hasFaceEnrolled ? 'AI Face ID: Đã kích hoạt' : 'Khuôn mặt: Chưa đăng ký'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.metricsGrid, { backgroundColor: bgSubtle }]}>
              {[
                { label: 'Chiều cao', val: height !== '--' ? `${height} cm` : '--' },
                { label: 'Cân nặng', val: weight !== '--' ? `${weight} kg` : '--' },
                { label: 'Nhóm máu', val: bloodType, isBlood: true },
              ].map((m, idx) => (
                <React.Fragment key={m.label}>
                  {idx > 0 && <View style={[styles.metricDivider, { backgroundColor: borderCol }]} />}
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: textSub }]}>{m.label}</Text>
                    <Text style={[styles.metricVal, { color: m.isBlood && bloodType !== '--' ? '#EF4444' : textTitle }]}>{m.val}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </View>
        )}

        {/* Khối Lọc Dữ Liệu Sinh Hiệu Theo Ngày */}
        <View style={[styles.cardBlock, { backgroundColor: bgCard, borderColor: borderCol }]}>
          <View style={styles.cardHeader}>
            <View style={styles.rowCenterGap8}>
              <View style={[styles.cardIconBox, { backgroundColor: isDarkMode ? 'rgba(37, 99, 235, 0.15)' : '#EFF6FF' }]}><Ionicons name="calendar-outline" size={20} color="#2563EB" /></View>
              <View>
                <Text style={[styles.cardTitle, { color: textTitle }]}>Nhật ký sinh hiệu theo ngày</Text>
                <Text style={[styles.cardSubtitle, { color: textSub }]}>Đồng bộ từ vòng đeo tay BLE và Hub AI</Text>
              </View>
            </View>
          </View>

          {!hasPatient ? (
            <View style={[styles.emptyNoticeBox, { backgroundColor: bgSubtle, borderColor: borderCol }]}>
              <Ionicons name="information-circle-outline" size={18} color={isDarkMode ? '#64748B' : '#94A3B8'} />
              <Text style={[styles.emptyNoticeText, { color: textSub }]}>Chưa có dữ liệu sinh hiệu do chưa thêm người theo dõi</Text>
            </View>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 10 }}>
                {[0, 1, 2, 3].map((daysAgo) => {
                  const val = getDaysAgoStr(daysAgo), isSelected = selectedDate === val;
                  const label = daysAgo === 0 ? 'Hôm nay' : daysAgo === 1 ? 'Hôm qua' : `${daysAgo} ngày trước`;
                  return (
                    <TouchableOpacity key={val} style={[styles.dateChip, { backgroundColor: isSelected ? Colors.primary : isDarkMode ? '#0F172A' : '#F1F5F9', borderColor: isSelected ? Colors.primary : borderCol }]} onPress={() => setSelectedDate(val)} activeOpacity={0.8}>
                      <Text style={[styles.dateChipText, { color: isSelected ? '#FFF' : textTitle }]}>{label} ({val.slice(5)})</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={[styles.daySummaryBox, { backgroundColor: bgSubtle, borderColor: borderCol }]}>
                <View style={styles.summaryTopRow}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#93C5FD' : '#1D4ED8' }}>Tổng kết ngày {formatDisplayDateVN(selectedDate)}</Text>
                  <Text style={{ fontSize: 11, color: textSub }}>{patientRecord?.daily_vitals?.length || 0} mốc đo ghi nhận</Text>
                </View>
                <TouchableOpacity style={styles.openDetailChartBtn} onPress={() => navigation.navigate('HealthDetail')} activeOpacity={0.8}>
                  <Ionicons name="stats-chart" size={16} color="#FFF" /><Text style={styles.openDetailChartBtnText}>Xem Biểu Đồ & Dòng Thời Gian Chi Tiết</Text><Ionicons name="arrow-forward" size={14} color="#FFF" />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Khối 2: Tiền sử bệnh nền */}
        <View style={[styles.cardBlock, { backgroundColor: bgCard, borderColor: borderCol }]}>
          <View style={styles.cardHeader}>
            <View style={styles.rowCenterGap8}>
              <View style={[styles.cardIconBox, { backgroundColor: isDarkMode ? '#4C1D1D' : '#FEE2E2' }]}><Ionicons name="pulse-outline" size={20} color="#EF4444" /></View>
              <Text style={[styles.cardTitle, { color: textTitle }]}>Tiền sử bệnh nền {hasPatient ? `(${conditions.length})` : ''}</Text>
            </View>
            {hasPatient && (
              <TouchableOpacity style={styles.addBtnSmall} onPress={() => setAddConditionModalVisible(true)} activeOpacity={0.7}>
                <Ionicons name="add" size={16} color="#FFF" /><Text style={styles.addBtnSmallText}>Thêm</Text>
              </TouchableOpacity>
            )}
          </View>

          {!hasPatient ? (
            <View style={[styles.emptyNoticeBox, { backgroundColor: bgSubtle, borderColor: borderCol }]}>
              <Ionicons name="information-circle-outline" size={18} color={isDarkMode ? '#64748B' : '#94A3B8'} />
              <Text style={[styles.emptyNoticeText, { color: textSub }]}>Chưa có dữ liệu bệnh nền do chưa thêm người theo dõi</Text>
            </View>
          ) : conditions.length === 0 ? (
            <View style={styles.emptyInlineBox}><Text style={[styles.emptyInlineText, { color: textSub }]}>Chưa có ghi nhận tiền sử bệnh nền.</Text></View>
          ) : (
            <View style={{ gap: 8 }}>
              {conditions.map((item) => (
                <View key={item.id} style={[styles.conditionCard, { backgroundColor: bgSubtle, borderColor: borderCol }]}>
                  <View style={styles.conditionCardTop}>
                    <View style={[styles.rowCenterGap8, { flex: 1 }]}>
                      <View style={[styles.severityDot, { backgroundColor: item.severity === 'danger' ? '#EF4444' : item.severity === 'warning' ? '#F59E0B' : '#0EA5E9' }]} />
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
              <View style={[styles.cardIconBox, { backgroundColor: isDarkMode ? '#452F10' : '#FEF3C7' }]}><Ionicons name="warning-outline" size={20} color="#D97706" /></View>
              <Text style={[styles.cardTitle, { color: textTitle }]}>Dị ứng & Lưu ý dinh dưỡng</Text>
            </View>
            {!isEditingAllergies && (
              <TouchableOpacity
                style={[styles.editBtnSmall, { backgroundColor: isDarkMode ? 'rgba(255, 107, 0, 0.15)' : '#FFF7ED', borderColor: isDarkMode ? '#EA580C' : '#FDBA74' }]}
                onPress={handleStartEditAllergies}
                activeOpacity={0.7}
              >
                <Ionicons name="pencil" size={13} color="#FF6B00" /><Text style={styles.editBtnSmallText}>Chỉnh sửa</Text>
              </TouchableOpacity>
            )}
          </View>

          {isEditingAllergies ? (
            <View style={{ gap: 12 }}>
              {[
                { tagStyle: styles.allergyTagDanger, textStyle: styles.allergyTagDangerText, icon: 'bandage-outline' as const, color: '#EF4444', label: 'Dị ứng thuốc', ph: 'Nhập thông tin dị ứng thuốc...', val: allergyDraft.drug, key: 'drug' },
                { tagStyle: styles.allergyTagWarning, textStyle: styles.allergyTagWarningText, icon: 'restaurant-outline' as const, color: '#D97706', label: 'Dị ứng thức ăn', ph: 'Nhập thông tin dị ứng thức ăn...', val: allergyDraft.food, key: 'food' },
              ].map((f) => (
                <View key={f.key}>
                  <View style={[f.tagStyle, { alignSelf: 'flex-start', marginBottom: 6 }]}>
                    <Ionicons name={f.icon} size={14} color={f.color} /><Text style={f.textStyle}>{f.label}</Text>
                  </View>
                  <TextInput style={inputStyle} placeholder={f.ph} placeholderTextColor="#94A3B8" value={f.val} onChangeText={(v) => setAllergyDraft(p => ({ ...p, [f.key]: v }))} />
                </View>
              ))}
              <View>
                <View style={[styles.rowCenterGap8, { marginBottom: 6 }]}>
                  <Ionicons name="nutrition-outline" size={16} color="#10B981" /><Text style={styles.dietaryNoteTitle}>Chế độ ăn khuyến nghị</Text>
                </View>
                <TextInput style={[...inputStyle, styles.textArea]} placeholder="Nhập chế độ ăn khuyến nghị..." placeholderTextColor="#94A3B8" multiline numberOfLines={3} value={allergyDraft.diet} onChangeText={(diet) => setAllergyDraft(p => ({ ...p, diet }))} />
              </View>
              <View style={styles.inlineEditActionRow}>
                <TouchableOpacity style={[styles.inlineCancelBtn, { backgroundColor: isDarkMode ? '#334155' : '#E2E8F0' }]} onPress={() => setIsEditingAllergies(false)} activeOpacity={0.7}>
                  <Text style={[styles.inlineCancelBtnText, { color: isDarkMode ? '#E2E8F0' : '#475569' }]}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.inlineSaveBtn} onPress={handleSaveAllergies} activeOpacity={0.8}>
                  <Text style={styles.inlineSaveBtnText}>Lưu thay đổi</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {[
                { tagStyle: styles.allergyTagDanger, textStyle: styles.allergyTagDangerText, icon: 'bandage-outline' as const, color: '#EF4444', label: 'Dị ứng thuốc:', val: drugAllergies },
                { tagStyle: styles.allergyTagWarning, textStyle: styles.allergyTagWarningText, icon: 'restaurant-outline' as const, color: '#D97706', label: 'Dị ứng thức ăn:', val: foodAllergies },
              ].map((row) => (
                <View key={row.label} style={styles.allergyRow}>
                  <View style={row.tagStyle}><Ionicons name={row.icon} size={14} color={row.color} /><Text style={row.textStyle}>{row.label}</Text></View>
                  <Text style={[styles.allergyValueText, { color: textTitle }]}>{row.val}</Text>
                </View>
              ))}
              <View style={[styles.dietaryNoteCard, { backgroundColor: bgSubtle }]}>
                <View style={[styles.rowCenterGap8, { marginBottom: 4 }]}>
                  <Ionicons name="nutrition-outline" size={16} color="#10B981" /><Text style={styles.dietaryNoteTitle}>Chế độ ăn khuyến nghị</Text>
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
              <View style={[styles.cardIconBox, { backgroundColor: isDarkMode ? '#133E3B' : '#CCFBF1' }]}><Ionicons name="medkit-outline" size={20} color="#0F766E" /></View>
              <Text style={[styles.cardTitle, { color: textTitle }]}>Bác sĩ & Bệnh viện phụ trách</Text>
            </View>
          </View>
          <View style={[styles.doctorCard, { backgroundColor: bgSubtle, borderColor: borderCol }]}>
            <View style={styles.doctorHeader}>
              <View style={styles.doctorAvatarBox}><Ionicons name="medical" size={24} color="#0EA5E9" /></View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.doctorName, { color: textTitle }]}>{doctorName}</Text>
                <Text style={[styles.doctorSpecialty, { color: textSub }]}>Chuyên khoa: {doctorSpecialty}</Text>
                <Text style={[styles.hospitalName, { color: textSub }]}>Cơ sở: {hospital}</Text>
              </View>
            </View>
            <View style={styles.appointmentRow}>
              <Ionicons name="calendar-outline" size={15} color="#0EA5E9" />
              <Text style={[styles.appointmentText, { color: textSub }]}>Lịch tái khám: <Text style={{ fontWeight: '700', color: Colors.primary }}>{nextAppointment}</Text></Text>
            </View>
            {doctorPhone ? (
              <TouchableOpacity style={styles.callDoctorBtn} onPress={handleCallDoctor} activeOpacity={0.8}>
                <Ionicons name="call" size={16} color="#FFF" /><Text style={styles.callDoctorBtnText}>Gọi bác sĩ ({doctorPhone})</Text>
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
            <TextInput style={inputStyle} placeholder="VD: Thoái hoá đốt sống, Viêm xoang..." placeholderTextColor="#94A3B8" value={condDraft.name} onChangeText={(name) => setCondDraft(p => ({ ...p, name }))} />
            <Text style={[styles.inputLabel, { color: textSub, marginTop: 10 }]}>Ghi chú:</Text>
            <TextInput style={[...inputStyle, styles.textArea]} placeholder="Ghi chú điều trị hoặc lưu ý..." placeholderTextColor="#94A3B8" multiline numberOfLines={3} value={condDraft.note} onChangeText={(note) => setCondDraft(p => ({ ...p, note }))} />
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

      {/* Modal Chỉnh Sửa / Thêm Mới Thông Tin Bệnh Nhân */}
      <Modal transparent visible={isEditPatientVisible} animationType="fade" onRequestClose={handleCloseEditPatient}>
        <Pressable style={styles.modalOverlay} onPress={handleCloseEditPatient}>
          <Pressable style={[styles.modalCard, { backgroundColor: bgCard, borderColor: borderCol, maxHeight: '92%' }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: textTitle }]}>{hasPatient ? 'Chỉnh sửa thông tin bệnh nhân' : 'Thêm hồ sơ người cao tuổi'}</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 6 }}>
              <Text style={[styles.inputLabel, { color: textSub }]}>Họ tên người cao tuổi:</Text>
              <TextInput style={inputStyle} value={patientDraft.name} onChangeText={(name) => setPatientDraft(p => ({ ...p, name }))} placeholder="Nhập họ và tên người cao tuổi..." placeholderTextColor="#94A3B8" />

              <View style={{ marginTop: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={[styles.inputLabel, { color: textSub, marginBottom: 0 }]}>Năm sinh:</Text>
                  {draftAge > 0 && (
                    <View style={[styles.calcBadge, { backgroundColor: isDarkMode ? '#1E3A8A' : '#EFF6FF' }]}>
                      <Ionicons name="calendar-outline" size={12} color="#2563EB" /><Text style={[styles.calcBadgeText, { color: '#2563EB' }]}>Tự động tính: {draftAge} tuổi</Text>
                    </View>
                  )}
                </View>
                <TextInput style={inputStyle} keyboardType="numeric" maxLength={4} value={patientDraft.birthYear} onChangeText={(val) => setPatientDraft(p => ({ ...p, birthYear: val.replace(/[^0-9]/g, '') }))} placeholder="VD: 1950 (nhập 4 chữ số)" placeholderTextColor="#94A3B8" />
              </View>

              <Text style={[styles.inputLabel, { color: textSub, marginTop: 12 }]}>Giới tính:</Text>
              <View style={styles.genderRow}>
                {(['Nam', 'Nữ', 'Khác'] as const).map((g) => {
                  const isSel = patientDraft.gender === g;
                  return (
                    <TouchableOpacity key={g} style={[styles.genderBtn, isDarkMode && { backgroundColor: bgSubtle, borderColor: borderCol }, isSel && { backgroundColor: isDarkMode ? '#1E3A8A' : '#EFF6FF', borderColor: '#2563EB', borderWidth: 1.5 }]} onPress={() => setPatientDraft(p => ({ ...p, gender: g }))} activeOpacity={0.7}>
                      <Ionicons name={g === 'Nam' ? 'male' : g === 'Nữ' ? 'female' : 'person-outline'} size={15} color={isSel ? '#2563EB' : textSub} />
                      <Text style={[styles.genderBtnText, { color: isSel ? '#2563EB' : textTitle, fontWeight: isSel ? '700' : '500' }]}>{g}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.inputLabel, { color: textSub, marginTop: 12 }]}>Nhóm máu:</Text>
              <View style={styles.bloodTypeGrid}>
                {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((type) => {
                  const isSel = patientDraft.blood === type;
                  return (
                    <TouchableOpacity key={type} style={[styles.bloodChip, isDarkMode && { backgroundColor: bgSubtle, borderColor: borderCol }, isSel && { backgroundColor: isDarkMode ? '#4C1D1D' : '#FEE2E2', borderColor: '#EF4444', borderWidth: 1.5 }]} onPress={() => setPatientDraft(p => ({ ...p, blood: type }))} activeOpacity={0.7}>
                      <Ionicons name="water" size={12} color={isSel ? '#EF4444' : textSub} />
                      <Text style={[styles.bloodChipText, { color: isSel ? '#EF4444' : textTitle, fontWeight: isSel ? '800' : '600' }]}>{type}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                {[
                  { label: 'Chiều cao (cm):', val: patientDraft.height, ph: 'VD: 165', key: 'height' },
                  { label: 'Cân nặng (kg):', val: patientDraft.weight, ph: 'VD: 60', key: 'weight' },
                ].map((f) => (
                  <View key={f.key} style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: textSub }]}>{f.label}</Text>
                    <TextInput style={inputStyle} keyboardType="numeric" maxLength={3} placeholder={f.ph} placeholderTextColor="#94A3B8" value={f.val} onChangeText={(v) => setPatientDraft(p => ({ ...p, [f.key]: v.replace(/[^0-9]/g, '') }))} />
                  </View>
                ))}
              </View>

              <View style={[styles.bmiCalcBox, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : draftBMI.bg, borderColor: draftBMI.color }]}>
                <Ionicons name="calculator-outline" size={18} color={draftBMI.color} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.bmiCalcTitle, { color: draftBMI.color }]}>Chỉ số BMI: {draftBMI.bmi} {draftBMI.bmi !== '--' ? 'kg/m²' : ''}</Text>
                  <Text style={[styles.bmiCalcSub, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>
                    {draftBMI.bmi !== '--' ? `Thể trạng: ${draftBMI.category} (BMI = Cân nặng / Chiều cao²)` : 'Nhập đủ chiều cao và cân nặng để tự động tính BMI'}
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={[styles.modalCancelBtn, { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9', borderColor: borderCol }]} onPress={handleCloseEditPatient}>
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
              <View style={[styles.modalIconCircle, { backgroundColor: isDarkMode ? '#064E3B' : '#DCFCE7' }]}><Ionicons name="scan" size={28} color="#10B981" /></View>
              <Text style={[styles.modalTitle, { color: textTitle, marginTop: 10 }]}>Đăng ký khuôn mặt AI</Text>
              <Text style={[styles.modalSubDesc, { color: textSub }]}>Chụp ảnh rõ nét chính diện khuôn mặt để camera AI nhận diện an toàn.</Text>
            </View>

            {[
              { isCam: true, icon: 'camera' as const, bg: '#EFF6FF', color: '#2563EB', title: 'Mở máy ảnh chụp trực tiếp', sub: 'Chụp khuôn mặt ngay bây giờ' },
              { isCam: false, icon: 'images' as const, bg: '#F0FDF4', color: '#16A34A', title: 'Chọn ảnh từ thư viện', sub: 'Tải ảnh chân dung có sẵn' },
            ].map((act, idx) => (
              <TouchableOpacity key={act.title} style={[styles.modalActionRowBtn, idx > 0 && { marginTop: 10 }]} onPress={() => handlePickFaceImage(act.isCam)} activeOpacity={0.8}>
                <View style={[styles.modalActionIconBox, { backgroundColor: act.bg }]}><Ionicons name={act.icon} size={20} color={act.color} /></View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.modalActionTitle, { color: textTitle }]}>{act.title}</Text>
                  <Text style={[styles.modalActionSub, { color: textSub }]}>{act.sub}</Text>
                </View>
              </TouchableOpacity>
            ))}

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
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  iconCircleBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitleCenter: { flex: 1, marginHorizontal: 12 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSubtitle: { fontSize: 11.5, marginTop: 2 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  securityCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 12, borderWidth: 1, marginBottom: 14, gap: 10 },
  securityIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(14,165,233,0.15)', alignItems: 'center', justifyContent: 'center' },
  securityBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  securityTitle: { fontSize: 12.5, fontWeight: '700', flex: 1, marginRight: 6 },
  aesTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(14,165,233,0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  aesTagText: { fontSize: 10, fontWeight: '800', color: '#0EA5E9' },
  securityDesc: { fontSize: 11, lineHeight: 15 },
  cardBlock: { borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 14 },
  emptyPatientCard: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20 },
  emptyPatientIconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyPatientTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  emptyPatientDesc: { fontSize: 12.5, textAlign: 'center', lineHeight: 18, marginBottom: 18 },
  addPatientPrimaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  addPatientPrimaryBtnText: { fontSize: 13.5, fontWeight: '700', color: '#FFFFFF' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  rowCenterGap8: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardIconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14.5, fontWeight: '700' },
  cardSubtitle: { fontSize: 11, marginTop: 1 },
  editLink: { fontSize: 12.5, fontWeight: '700', color: Colors.primary },
  patientHeroRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  patientAvatarContainer: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  patientAvatarImg: { width: 70, height: 70, borderRadius: 35 },
  avatarCameraBadge: { position: 'absolute', bottom: -2, right: -2, backgroundColor: Colors.primary, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF' },
  patientHeroName: { fontSize: 16, fontWeight: '800' },
  patientHeroSub: { fontSize: 12, marginTop: 2 },
  bloodBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  bloodBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEE2E2', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  bloodBadgeText: { fontSize: 11.5, fontWeight: '700', color: '#B91C1C' },
  bmiBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  bmiBadgeText: { fontSize: 11.5, fontWeight: '700' },
  faceEnrollPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, alignSelf: 'flex-start', marginTop: 8 },
  faceEnrollPillText: { fontSize: 11.5, fontWeight: '700' },
  metricsGrid: { flexDirection: 'row', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center' },
  metricItem: { flex: 1, alignItems: 'center' },
  metricLabel: { fontSize: 11, fontWeight: '500' },
  metricVal: { fontSize: 14, fontWeight: '800', marginTop: 3 },
  metricDivider: { width: 1, height: 26 },
  emptyNoticeBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  emptyNoticeText: { fontSize: 12, flex: 1, lineHeight: 17 },
  dateChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  dateChipText: { fontSize: 12, fontWeight: '600' },
  daySummaryBox: { borderRadius: 10, padding: 10, borderWidth: 1, marginTop: 6 },
  summaryTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  openDetailChartBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primary, borderRadius: 8, paddingVertical: 8 },
  openDetailChartBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  addBtnSmall: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.primary, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6 },
  addBtnSmallText: { fontSize: 11.5, fontWeight: '700', color: '#FFF' },
  editBtnSmall: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  editBtnSmallText: { fontSize: 11.5, fontWeight: '700', color: '#FF6B00' },
  inlineEditActionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  inlineCancelBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6 },
  inlineCancelBtnText: { fontSize: 12, fontWeight: '600' },
  inlineSaveBtn: { backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6 },
  inlineSaveBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
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

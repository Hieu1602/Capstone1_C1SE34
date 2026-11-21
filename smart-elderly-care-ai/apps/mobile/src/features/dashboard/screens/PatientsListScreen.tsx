// PatientsListScreen.tsx
// Màn hình Danh sách thẻ bệnh nhân người cao tuổi trong nhà
// Bấm vào thẻ bệnh nhân sẽ mở hồ sơ bệnh án điện tử tương ứng

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
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../../../theme/colors';
import { useTheme } from '../../../store/useThemeStore';
import { BirthYearPickerModal } from '../components/BirthYearPickerModal';
import { useVitalStore } from '../../../store/useVitalStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { BASE_URL } from '../../../services/api';

const calculateAgeFromYear = (yearStr: string) => {
  const y = parseInt(yearStr, 10), cur = new Date().getFullYear();
  return !isNaN(y) && y >= 1900 && y <= cur ? cur - y : 0;
};

const calculateBMIInfo = (heightCmStr: string, weightKgStr: string) => {
  const h = parseFloat(heightCmStr), w = parseFloat(weightKgStr);
  if (isNaN(h) || isNaN(w) || h <= 50 || w <= 10) {
    return { bmi: '--', category: 'Chưa đủ dữ liệu', color: '#94A3B8', bg: '#F1F5F9' };
  }
  const bmiVal = w / ((h / 100) * (h / 100));
  const rounded = Math.round(bmiVal * 10) / 10;
  if (rounded < 18.5) return { bmi: rounded.toString(), category: 'Thiếu cân', color: '#0284C7', bg: '#E0F2FE' };
  if (rounded < 23) return { bmi: rounded.toString(), category: 'Bình thường', color: '#059669', bg: '#DCFCE7' };
  if (rounded < 25) return { bmi: rounded.toString(), category: 'Tiền béo phì', color: '#D97706', bg: '#FEF3C7' };
  return { bmi: rounded.toString(), category: 'Béo phì', color: '#DC2626', bg: '#FEE2E2' };
};

export default function PatientsListScreen({ navigation }: any) {
  const { isDarkMode } = useTheme();
  const {
    patientsList,
    fetchPatientsList,
    setActivePatientId,
    createPatient,
    isLoadingList,
  } = useVitalStore();
  const { userRole, role, permissions, viewRole, userPhone, phone_number, has_house, household_id } = useAuthStore();
  const ownerPhone = (userPhone || phone_number || '').trim();
  const isSpecialUser = userRole === 'admin' || userRole === 'doctor' || role === 'admin' || role === 'doctor';
  const hasNoHouse = !isSpecialUser && !household_id && has_house === false;

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateVisible, setIsCreateVisible] = useState(false);
  const [isBirthYearPickerVisible, setBirthYearPickerVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [createDraft, setCreateDraft] = useState({
    name: '',
    birthYear: '',
    gender: 'Nam',
    blood: 'Chưa rõ',
    weight: '',
    height: '',
    phone: '',
  });

  const canEdit = Boolean(
    userRole === 'admin' ||
    role === 'admin' ||
    permissions?.is_owner ||
    permissions?.role_in_house === 'OWNER' ||
    permissions?.can_manage_records ||
    viewRole === 'DOCTOR'
  );

  const loadData = useCallback(async () => {
    await fetchPatientsList();
  }, [fetchPatientsList]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSelectPatient = (p: any) => {
    const pId = p.id || p.elderly_id;
    if (pId) {
      setActivePatientId(pId);
      navigation.navigate('PatientMedicalRecord', {
        patientId: pId,
        patientName: p.full_name || p.name,
        from: 'PatientsList',
      });
    }
  };

  const createAge = calculateAgeFromYear(createDraft.birthYear);
  const createBMI = calculateBMIInfo(createDraft.height, createDraft.weight);

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  };

  const handleExecuteCreate = async () => {
    const trimmed = createDraft.name.trim();
    if (!trimmed || trimmed.length < 2) {
      return showAlert('Thiếu thông tin', 'Vui lòng nhập họ và tên người cao tuổi (tối thiểu 2 ký tự).');
    }
    const curYear = new Date().getFullYear();
    const byNum = parseInt(createDraft.birthYear, 10);
    const by = !isNaN(byNum) && byNum >= 1900 && byNum <= curYear ? byNum : undefined;

    setIsSubmitting(true);
    try {
      const created = await createPatient({
        full_name: trimmed,
        birth_year: by,
        gender: createDraft.gender,
        blood_type: createDraft.blood === 'Chưa rõ' ? undefined : createDraft.blood,
        height_cm: parseInt(createDraft.height, 10) || undefined,
        weight_kg: parseInt(createDraft.weight, 10) || undefined,
        emergency_contact_phone: createDraft.phone.trim() || undefined,
      });
      setIsCreateVisible(false);
      setCreateDraft({ name: '', birthYear: '', gender: 'Nam', blood: 'Chưa rõ', weight: '', height: '', phone: '' });
      showAlert('Thành công 🎉', `Đã thêm hồ sơ cụ ${trimmed}!`);
      if (created?.id) {
        navigation.navigate('PatientMedicalRecord', { patientId: created.id, patientName: trimmed });
      }
    } catch (err: any) {
      showAlert('Lỗi', err?.response?.data?.detail || 'Không thể tạo hồ sơ lúc này.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const bgScreen = isDarkMode ? '#0B0F19' : '#F8FAFC';
  const bgCard = isDarkMode ? '#1E293B' : '#FFFFFF';
  const borderCol = isDarkMode ? '#334155' : '#E2E8F0';
  const textTitle = isDarkMode ? '#F8FAFC' : '#0F172A';
  const textSub = isDarkMode ? '#94A3B8' : '#64748B';
  const inputStyle = [styles.textInput, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', color: textTitle, borderColor: borderCol }];

  const actualPatientsList = hasNoHouse ? [] : (patientsList || []);

  const filteredPatients = actualPatientsList.filter((p: any) => {
    if (!searchQuery.trim()) return true;
    const term = searchQuery.toLowerCase().trim();
    const name = (p.full_name || p.name || '').toLowerCase();
    const phone = (p.emergency_contact_phone || '').toLowerCase();
    return name.includes(term) || phone.includes(term);
  });

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgScreen }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.headerRow, { backgroundColor: isDarkMode ? '#0B0F19' : '#FFFFFF', borderBottomColor: borderCol }]}>
        <TouchableOpacity
          style={[styles.iconCircleBtn, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: borderCol }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={textTitle} />
        </TouchableOpacity>
        <View style={styles.headerTitleCenter}>
          <Text style={[styles.headerTitle, { color: textTitle }]}>Hồ sơ bệnh án</Text>
          <Text style={[styles.headerSubtitle, { color: textSub }]}>
            {hasNoHouse
              ? 'Chưa tham gia gia đình nào'
              : actualPatientsList.length > 0
              ? `${actualPatientsList.length} người cao tuổi trong nhà`
              : 'Hồ sơ người cao tuổi'}
          </Text>
        </View>
        {canEdit && !hasNoHouse ? (
          <TouchableOpacity
            style={[styles.addTopBtn, { backgroundColor: Colors.primary }]}
            onPress={() => setIsCreateVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.addTopBtnText}>Thêm hồ sơ</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />}
      >
        {/* Banner hướng dẫn & Bảo mật AES-256 */}
        <View style={[styles.securityCard, { backgroundColor: isDarkMode ? '#0F2942' : '#F0F9FF', borderColor: isDarkMode ? '#0369A1' : '#BAE6FD' }]}>
          <View style={styles.securityIconCircle}>
            <Ionicons name="shield-checkmark" size={22} color="#0EA5E9" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.securityBadgeRow}>
              <Text style={[styles.securityTitle, { color: isDarkMode ? '#38BDF8' : '#0369A1' }]}>
                Bệnh án điện tử bảo mật AES-256
              </Text>
              <View style={styles.aesTag}>
                <Ionicons name="lock-closed" size={10} color="#0EA5E9" />
                <Text style={styles.aesTagText}>HL7/FHIR</Text>
              </View>
            </View>
            <Text style={[styles.securityDesc, { color: isDarkMode ? '#94A3B8' : '#0C4A6E' }]}>
              {hasNoHouse
                ? 'Tài khoản chưa tham gia căn nhà nào. Hãy liên kết vào nhà để xem hồ sơ bệnh án người cao tuổi.'
                : 'Chọn thẻ người cao tuổi bên dưới để xem bệnh án chi tiết, đơn thuốc và nhật ký chăm sóc y tế.'}
            </Text>
          </View>
        </View>

        {/* Thanh tìm kiếm nếu danh sách có nhiều cụ */}
        {actualPatientsList.length > 2 && (
          <View style={[styles.searchBox, { backgroundColor: bgCard, borderColor: borderCol }]}>
            <Ionicons name="search" size={18} color={textSub} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { color: textTitle }]}
              placeholder="Tìm theo tên người cao tuổi..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={textSub} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Danh sách thẻ bệnh nhân (Thiết kế chính xác theo ảnh mẫu người dùng) */}
        {isLoadingList && actualPatientsList.length === 0 ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={{ marginTop: 12, color: textSub, fontSize: 13 }}>Đang tải danh sách hồ sơ...</Text>
          </View>
        ) : filteredPatients.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: bgCard, borderColor: borderCol }]}>
            <View style={[styles.emptyIconCircle, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}>
              <Ionicons name="people-outline" size={44} color="#94A3B8" />
            </View>
            <Text style={[styles.emptyTitle, { color: textTitle }]}>
              {hasNoHouse ? 'Chưa tham gia gia đình nào' : 'Chưa có hồ sơ người cao tuổi'}
            </Text>
            <Text style={[styles.emptyDesc, { color: textSub }]}>
              {hasNoHouse
                ? 'Tài khoản của bạn chưa thuộc căn nhà nào. Hãy nhập mã mời tham gia nhà từ Menu để xem hồ sơ người cao tuổi.'
                : 'Thêm thông tin người cao tuổi vào căn nhà để theo dõi sức khỏe và lịch uống thuốc.'}
            </Text>
            {canEdit && !hasNoHouse && (
              <TouchableOpacity
                style={styles.emptyAddBtn}
                onPress={() => setIsCreateVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                <Text style={styles.emptyAddBtnText}>+ Thêm hồ sơ người cao tuổi</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredPatients.map((patient: any, idx: number) => {
            const mrCode = `MR-${String(idx + 1).padStart(3, '0')}`;
            const pName = patient.full_name || patient.name || 'Người cao tuổi';
            const pAge = patient.age ? `${patient.age} tuổi` : (patient.birth_year ? `${calculateAgeFromYear(String(patient.birth_year))} tuổi` : 'Cao tuổi');
            const pGender = patient.gender || 'Nam';
            const pBlood = patient.blood_type || 'A+';
            const avatarUri = patient.avatar_url
              ? (patient.avatar_url.startsWith('http') ? patient.avatar_url : `${BASE_URL.replace('/api/v1', '')}${patient.avatar_url}`)
              : null;
            const initial = pName.trim().split(/\s+/).slice(-1)[0]?.[0]?.toUpperCase() || 'A';

            return (
              <TouchableOpacity
                key={String(patient.id || patient.elderly_id || idx)}
                style={[
                  styles.patientCard,
                  {
                    backgroundColor: bgCard,
                    borderColor: isDarkMode ? '#1E3A8A' : '#BFDBFE',
                  },
                ]}
                onPress={() => handleSelectPatient(patient)}
                activeOpacity={0.82}
              >
                {/* Thông tin thẻ: Avatar, Mã MR, Tên, Badge Ổn định, Thông số */}
                <View style={styles.cardTopRow}>
                  <View style={styles.avatarWrapper}>
                    <View style={[styles.avatarBox, { backgroundColor: isDarkMode ? '#1E3A8A' : '#DBEAFE' }]}>
                      {avatarUri ? (
                        <Image source={{ uri: avatarUri }} style={styles.avatarImg} resizeMode="cover" />
                      ) : (
                        <Text style={[styles.avatarInitial, { color: Colors.primary }]}>{initial}</Text>
                      )}
                    </View>
                  </View>

                  {/* Thông tin chính */}
                  <View style={styles.infoCol}>
                    <View style={styles.nameHeaderRow}>
                      <View style={styles.nameLeftGroup}>
                        <View style={styles.mrBadge}>
                          <Text style={styles.mrBadgeText}>{mrCode}</Text>
                        </View>
                        <Text style={styles.patientNameText} numberOfLines={1}>
                          {pName}
                        </Text>
                      </View>

                      {/* Huy hiệu tình trạng: Ổn định */}
                      <View style={styles.statusPill}>
                        <Text style={styles.statusPillText}>Ổn định</Text>
                      </View>
                    </View>

                    {/* Dòng tuổi, giới tính, nhóm máu */}
                    <Text style={[styles.metaSubText, { color: textSub }]}>
                      {pAge} • {pGender} • Nhóm máu {pBlood}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Modal Thêm Hồ Sơ Người Cao Tuổi Mới */}
      <Modal visible={isCreateVisible} transparent animationType="fade" onRequestClose={() => setIsCreateVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setIsCreateVisible(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: bgCard, borderColor: borderCol, maxHeight: '88%' }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: textTitle }]}>Thêm hồ sơ người cao tuổi</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
              <Text style={[styles.inputLabel, { color: textSub }]}>Họ và tên người cao tuổi (*):</Text>
              <TextInput
                style={inputStyle}
                placeholder="VD: Cụ Nguyễn Văn B..."
                placeholderTextColor="#94A3B8"
                value={createDraft.name}
                onChangeText={(v) => setCreateDraft((p) => ({ ...p, name: v }))}
              />

              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: textSub }]}>Năm sinh:</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TextInput
                      style={[inputStyle, { flex: 1, height: 42 }]}
                      keyboardType="numeric"
                      maxLength={4}
                      placeholder="VD: 1948"
                      placeholderTextColor="#94A3B8"
                      value={createDraft.birthYear}
                      onChangeText={(v) => setCreateDraft((p) => ({ ...p, birthYear: v.replace(/[^0-9]/g, '') }))}
                    />
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => setBirthYearPickerVisible(true)}
                      style={{
                        height: 42,
                        paddingHorizontal: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: '#FED7AA',
                        backgroundColor: isDarkMode ? 'rgba(249, 115, 22, 0.15)' : '#FFF7ED',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Ionicons name="calendar-outline" size={18} color="#EA580C" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={[styles.calcBadge, { height: 42, paddingHorizontal: 12, borderRadius: 10, backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={[styles.calcBadgeText, { color: textTitle }]}>
                    {createAge > 0 ? `${createAge} tuổi` : '-- tuổi'}
                  </Text>
                </View>
              </View>

              <Text style={[styles.inputLabel, { color: textSub, marginTop: 12 }]}>Giới tính:</Text>
              <View style={styles.genderRow}>
                {['Nam', 'Nữ', 'Khác'].map((g) => {
                  const isSel = createDraft.gender === g;
                  return (
                    <TouchableOpacity
                      key={g}
                      style={[
                        styles.genderBtn,
                        isDarkMode && { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: borderCol },
                        isSel && { backgroundColor: isDarkMode ? '#1E3A8A' : '#EFF6FF', borderColor: '#2563EB', borderWidth: 1.5 },
                      ]}
                      onPress={() => setCreateDraft((p) => ({ ...p, gender: g }))}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={g === 'Nam' ? 'male' : g === 'Nữ' ? 'female' : 'person-outline'} size={15} color={isSel ? '#2563EB' : textSub} />
                      <Text style={[styles.genderBtnText, { color: isSel ? '#2563EB' : textTitle, fontWeight: isSel ? '700' : '500' }]}>{g}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.inputLabel, { color: textSub, marginTop: 12 }]}>Nhóm máu:</Text>
              <View style={[styles.bloodTypeGrid, { gap: 8 }]}>
                {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Chưa rõ'].map((type) => {
                  const isSel = createDraft.blood === type;
                  const isUnknown = type === 'Chưa rõ';
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.bloodChip,
                        { width: '31.3%', height: 38, paddingVertical: 0 },
                        isDarkMode && { backgroundColor: '#0F172A', borderColor: borderCol },
                        isSel && {
                          backgroundColor: isUnknown ? (isDarkMode ? '#1E293B' : '#FFF7ED') : (isDarkMode ? '#4C1D1D' : '#FEE2E2'),
                          borderColor: isUnknown ? '#F97316' : '#EF4444',
                          borderWidth: 1.5,
                        },
                      ]}
                      onPress={() => setCreateDraft((p) => ({ ...p, blood: type }))}
                      activeOpacity={0.7}
                    >
                      {!isUnknown && <Ionicons name="water" size={12} color={isSel ? '#EF4444' : textSub} />}
                      <Text
                        style={[
                          styles.bloodChipText,
                          {
                            color: isSel ? (isUnknown ? '#EA580C' : '#EF4444') : textTitle,
                            fontWeight: isSel ? '800' : '600',
                          },
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: textSub }]}>Chiều cao (cm):</Text>
                  <TextInput
                    style={inputStyle}
                    keyboardType="numeric"
                    maxLength={3}
                    placeholder="VD: 165"
                    placeholderTextColor="#94A3B8"
                    value={createDraft.height}
                    onChangeText={(v) => setCreateDraft((p) => ({ ...p, height: v.replace(/[^0-9]/g, '') }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: textSub }]}>Cân nặng (kg):</Text>
                  <TextInput
                    style={inputStyle}
                    keyboardType="numeric"
                    maxLength={3}
                    placeholder="VD: 60"
                    placeholderTextColor="#94A3B8"
                    value={createDraft.weight}
                    onChangeText={(v) => setCreateDraft((p) => ({ ...p, weight: v.replace(/[^0-9]/g, '') }))}
                  />
                </View>
              </View>

              <View style={[styles.bmiCalcBox, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : createBMI.bg, borderColor: createBMI.color }]}>
                <Ionicons name="calculator-outline" size={18} color={createBMI.color} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.bmiCalcTitle, { color: createBMI.color }]}>
                    Chỉ số BMI: {createBMI.bmi} {createBMI.bmi !== '--' ? 'kg/m²' : ''}
                  </Text>
                  <Text style={[styles.bmiCalcSub, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>
                    {createBMI.bmi !== '--' ? `Thể trạng: ${createBMI.category}` : 'Nhập chiều cao và cân nặng để tính BMI'}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 4 }}>
                <Text style={[styles.inputLabel, { color: textSub, marginBottom: 0 }]}>Số ĐT liên hệ khẩn cấp (tùy chọn):</Text>
                {Boolean(ownerPhone) && (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => setCreateDraft((p) => ({ ...p, phone: ownerPhone }))}
                    style={{
                      paddingHorizontal: 9,
                      paddingVertical: 4,
                      borderRadius: 12,
                      backgroundColor: isDarkMode ? 'rgba(249, 115, 22, 0.2)' : '#FFF7ED',
                      borderWidth: 1,
                      borderColor: '#FED7AA',
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#EA580C' }}>Dùng số của tôi</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={inputStyle}
                keyboardType="phone-pad"
                placeholder="VD: 0912345678"
                placeholderTextColor="#94A3B8"
                value={createDraft.phone}
                onChangeText={(v) => setCreateDraft((p) => ({ ...p, phone: v }))}
              />
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9', borderColor: borderCol }]}
                onPress={() => setIsCreateVisible(false)}
                disabled={isSubmitting}
              >
                <Text style={[styles.modalCancelText, { color: textSub }]}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, isSubmitting && { opacity: 0.7 }]}
                onPress={handleExecuteCreate}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveText}>Thêm hồ sơ</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <BirthYearPickerModal
        visible={isBirthYearPickerVisible}
        selectedYear={createDraft.birthYear}
        onSelectYear={(yr) => setCreateDraft((p) => ({ ...p, birthYear: yr }))}
        onClose={() => setBirthYearPickerVisible(false)}
        isDarkMode={isDarkMode}
        bgCard={bgCard}
        borderCol={borderCol}
        textTitle={textTitle}
      />
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
  iconCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleCenter: { flex: 1, marginHorizontal: 12 },
  headerTitle: { fontSize: 16.5, fontWeight: '800' },
  headerSubtitle: { fontSize: 11.5, marginTop: 2 },
  addTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  addTopBtnText: { fontSize: 12.5, fontWeight: '700', color: '#FFFFFF' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  securityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 14,
    gap: 10,
  },
  securityIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(14,165,233,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  securityTitle: { fontSize: 12.5, fontWeight: '700', flex: 1, marginRight: 6 },
  aesTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(14,165,233,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aesTagText: { fontSize: 10, fontWeight: '800', color: '#0EA5E9' },
  securityDesc: { fontSize: 11, lineHeight: 15 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 13, padding: 0 },

  // Patient Card Style khớp chính xác với ảnh mẫu của người dùng
  patientCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '800',
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
  },
  nameHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 6,
  },
  mrBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  mrBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#475569',
  },
  patientNameText: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#2563EB',
    flexShrink: 1,
  },
  statusPill: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 9,
    paddingVertical: 2.5,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  metaSubText: {
    fontSize: 12,
    marginTop: 3,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  houseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  houseNameText: {
    fontSize: 12,
    fontWeight: '600',
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  onlineBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  onlineBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#047857',
  },

  // Empty State
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  emptyDesc: { fontSize: 12.5, textAlign: 'center', lineHeight: 18, marginBottom: 18 },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyAddBtnText: { fontSize: 13.5, fontWeight: '700', color: '#FFFFFF' },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 420, borderRadius: 18, padding: 18, borderWidth: 1 },
  modalTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  inputLabel: { fontSize: 11.5, fontWeight: '600', marginBottom: 4 },
  textInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13.5 },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancelBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  modalCancelText: { fontSize: 13, fontWeight: '600' },
  modalSaveBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  modalSaveText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
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

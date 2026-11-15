// DoctorHomeScreen.tsx
// Trang chủ Bác sĩ gia đình - Nâng cấp giao diện kết hợp tinh hoa Ảnh 1, 2 & 5:
// 1. Header chào hỏi bác sĩ + avatar có chấm xanh + nút tìm kiếm & chuông thông báo
// 2. Dải chọn nhanh Bệnh nhân phụ trách (Horizontal Avatar Strip - Ảnh 5)
// 3. Thẻ Tổng quan Sinh hiệu Nổi bật (Hero Health Card màu xanh gradient - Ảnh 5)
// 4. Mục Cần lưu ý lâm sàng & Lịch khám hôm nay

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Image,
  Animated,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { Colors } from '../../../theme/colors';
import { useTheme } from '../../../store/useThemeStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useAlertStore } from '../../../store/useAlertStore';
import { doctorApi, householdApi, usersApi } from '../../../services/api';
import { alertsWS } from '../../../services/websocket';
import { resolveAvatarUrl } from '../../auth/hooks/useProfileManager';
import { LocalizedText } from '../../../i18n/LocalizedComponents';
import AdminMarqueeBanner from '../../../components/AdminMarqueeBanner';
import {
  PatientCardData,
  AppointmentItem,
  STANDARD_PATIENT_NAMES,
  normalizePatientsList,
  getPatientAvatarUrl,
} from '../components/types';
import { AppointmentDetailModal } from '../components';
import NotificationsBottomSheet from '../components/NotificationsBottomSheet';

export { STANDARD_PATIENT_NAMES, normalizePatientsList };

const doctorBannerImg = require('../../../../assets/images/doctor-banner.png');

export default function DoctorHomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { isDarkMode, colors } = useTheme();
  const { userName, avatarUrl, avatar_url } = useAuthStore();
  const doctorAvatarUri = (() => {
    const raw = avatarUrl || avatar_url;
    return raw && !raw.startsWith('blob:') ? resolveAvatarUrl(raw) : null;
  })();
  const { incidents, fetchNotifications: fetchIncidents } = useAlertStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [patients, setPatients] = useState<PatientCardData[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [todayAppointments, setTodayAppointments] = useState<AppointmentItem[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<AppointmentItem[]>([]);
  const [nextAppointment, setNextAppointment] = useState<AppointmentItem | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [hasUnreadNotifs, setHasUnreadNotifs] = useState(false);
  const [respondingInviteId, setRespondingInviteId] = useState<string | null>(null);

  useEffect(() => {
    setHasUnreadNotifs(incidents.some((inc) => !inc.is_acknowledged));
  }, [incidents]);

  const fetchData = useCallback(async () => {
    try {
      const [patRes, aptRes, meRes] = await Promise.allSettled([
        doctorApi.getPatients(),
        doctorApi.getAppointments(),
        usersApi.getMe(),
        fetchIncidents(),
      ]);

      if (meRes.status === 'fulfilled' && meRes.value?.data) {
        const u = meRes.value.data;
        useAuthStore.getState().setProfile({
          avatar_url: u.avatar_url,
          full_name: u.full_name,
        });
        useAuthStore.getState().setAvatar(u.avatar_url || '');
      }

      const normalized = normalizePatientsList(
        patRes.status === 'fulfilled' && patRes.value.data ? patRes.value.data : []
      );
      setPatients(normalized);

      // Mặc định chọn bệnh nhân có cảnh báo hoặc người đầu tiên
      setSelectedPatientId((curr) => {
        if (curr && normalized.some((p) => p.id === curr)) return curr;
        const warn = normalized.find((p) => p.health_status === 'DANGER' || p.health_status === 'WARNING');
        return warn ? warn.id : normalized[0]?.id || null;
      });

      if (aptRes.status === 'fulfilled' && Array.isArray(aptRes.value.data)) {
        const allApts: AppointmentItem[] = aptRes.value.data;
        const todayStr = new Date().toISOString().slice(0, 10);
        const todays = allApts
          .filter((apt) => apt.scheduled_at?.slice(0, 10) === todayStr && apt.status !== 'CANCELLED')
          .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

        setTodayAppointments(todays);
        setUpcomingAppointments(allApts.filter((a) => a.status === 'UPCOMING'));
        setNextAppointment(todays.find((a) => a.status === 'UPCOMING') || todays[0] || null);
      }
    } catch {
      setPatients(normalizePatientsList([]));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRespondHouseInvite = async (incident: any, action: 'accept' | 'reject') => {
    try {
      setRespondingInviteId(incident.id);
      const memberIdMatch = (incident.notes || incident.note || '')?.match(/MEMBER_ID:([a-fA-F0-9-]+)/);
      const memberId = memberIdMatch ? memberIdMatch[1] : (incident.device_id || incident.id);

      await householdApi.respondHouseInvite(memberId, action);
      await useAlertStore.getState().acknowledgeIncident(
        incident.id,
        action === 'accept' ? 'Đã đồng ý vào nhà' : 'Đã từ chối vào nhà',
        userName || 'Bác sĩ'
      );

      await Promise.allSettled([fetchIncidents(), fetchData()]);

      Alert.alert(
        action === 'accept' ? 'Đã tham gia căn nhà' : 'Đã từ chối',
        action === 'accept'
          ? 'Bạn đã xác nhận đồng ý tham gia căn nhà! Các bệnh nhân trong căn nhà đã được thêm vào danh sách theo dõi của bạn.'
          : 'Bạn đã từ chối lời mời tham gia căn nhà.'
      );
    } catch (err: any) {
      console.warn('handleRespondHouseInvite error:', err);
      Alert.alert('Lỗi', err.response?.data?.detail || 'Không thể phản hồi lời mời. Vui lòng thử lại.');
    } finally {
      setRespondingInviteId(null);
    }
  };

  useEffect(() => {
    fetchData();
    alertsWS.connect();
    const unsub = alertsWS.subscribe((event: any) => {
      if (
        event?.type === 'ALERT_NEW' ||
        event?.alert_type === 'MEDICAL_RECORD_UPDATED' ||
        event?.alert_type === 'APPOINTMENT_SCHEDULED'
      ) {
        fetchData();
      }
    });
    return () => unsub();
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const formatAptTime = (dateStr?: string) => {
    if (!dateStr) return '--:--';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? '--:--' : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return '--:--';
    }
  };

  const getPatientInitial = (name: string) => {
    if (!name) return 'B';
    const parts = name.replace(/^(cụ|bác|ông|bà)\s+/i, '').trim().split(/\s+/);
    return parts[parts.length - 1]?.[0]?.toUpperCase() || 'B';
  };

  const getPatientAddress = (p: PatientCardData) =>
    p.house_address?.trim() || (p.house_name?.trim() && p.house_name !== 'Nhà của tôi' ? p.house_name.trim() : 'Nhà riêng bệnh nhân');

  const warningPatients = patients.filter((p) => p.health_status === 'WARNING' || p.health_status === 'DANGER');
  const activePatient = patients.find((p) => p.id === selectedPatientId) || patients[0] || null;

  const getDoctorInitial = (name?: string | null) => {
    if (!name) return 'M';
    const clean = name.replace(/^(bs\.|bác sĩ|dr\.)\s+/i, '').trim();
    const parts = clean.split(/\s+/);
    return parts[parts.length - 1]?.[0]?.toUpperCase() || 'M';
  };
  const doctorInitial = getDoctorInitial(userName);

  const pendingHouseInvites = (incidents || []).filter(
    (i) =>
      !i.is_acknowledged &&
      (i.alert_type === 'HOUSE_INVITE_PENDING' ||
        Boolean(i.notes?.includes('HOUSE_INVITE_PENDING')) ||
        (i.message || '').toLowerCase().includes('lời mời bạn tham gia căn nhà'))
  );

  const closeNotifAndRun = (cb?: () => void) => {
    setNotifModalVisible(false);
    setHasUnreadNotifs(false);
    cb?.();
  };

  // Tính điểm an toàn sức khỏe
  const getSafetyScore = (p: PatientCardData | null) => {
    if (!p) return 86;
    if (p.health_status === 'DANGER') return 48;
    if (p.health_status === 'WARNING') return 74;
    return 92;
  };
  const safetyScore = getSafetyScore(activePatient);

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* 1. HEADER CHÀO HỎI BÁC SĨ (Ảnh 1 & 5) */}
      <View
        style={[
          styles.headerGradientArea,
          {
            paddingTop: insets.top + 8,
            backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF',
            borderBottomColor: isDarkMode ? '#334155' : '#DBEAFE',
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.doctorAvatarContainer}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('DoctorProfile')}
          >
            <View style={styles.doctorAvatar}>
              {doctorAvatarUri ? (
                <Image source={{ uri: doctorAvatarUri }} style={styles.doctorAvatarImg} resizeMode="cover" />
              ) : (
                <LocalizedText style={styles.doctorAvatarLetter}>{doctorInitial}</LocalizedText>
              )}
            </View>
            <View style={[styles.onlineBadge, { borderColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]} />
          </TouchableOpacity>

          <View style={styles.greetingBox}>
            <LocalizedText style={[styles.greetingTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              Xin chào, {userName || 'BS. Trần Văn Minh'} 👋
            </LocalizedText>
            <LocalizedText style={[styles.greetingSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Hôm nay công việc thế nào?
            </LocalizedText>
          </View>
        </View>

        <View style={styles.headerRight}>
          {/* Nút tìm kiếm nhanh */}
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: isDarkMode ? '#334155' : '#FFFFFF' }]}
            onPress={() => navigation.navigate('DoctorPatients')}
            activeOpacity={0.7}
          >
            <Ionicons name="search-outline" size={19} color={isDarkMode ? '#E2E8F0' : '#1E293B'} />
          </TouchableOpacity>

          {/* Nút chuông thông báo có chấm đỏ */}
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: isDarkMode ? '#334155' : '#FFFFFF' }]}
            onPress={() => setNotifModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={19} color={isDarkMode ? '#E2E8F0' : '#1E293B'} />
            {hasUnreadNotifs && <View style={styles.badgeDot} />}
          </TouchableOpacity>
        </View>
      </View>

      <AdminMarqueeBanner targetAudience="doctors" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={[Colors.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Khối Lời mời tham gia Bác sĩ gia đình (nếu có) */}
        {pendingHouseInvites.map((invite) => (
          <View key={invite.id} style={[styles.inviteCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: '#F59E0B' }]}>
            <View style={styles.inviteCardHeader}>
              <View style={[styles.inviteIconCircle, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="home" size={20} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <LocalizedText style={[styles.inviteCardTitle, { color: colors.textPrimary }]}>Lời mời Bác sĩ gia đình</LocalizedText>
                  <View style={styles.pendingBadge}>
                    <LocalizedText style={styles.pendingBadgeText}>Chờ xác nhận</LocalizedText>
                  </View>
                </View>
                <LocalizedText style={[styles.inviteCardMessage, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  {invite.message || 'Chủ hộ đã gửi lời mời bạn tham gia căn nhà với vai trò Bác sĩ gia đình.'}
                </LocalizedText>
              </View>
            </View>

            <View style={styles.inviteBtnRow}>
              <TouchableOpacity
                style={[styles.inviteRejectBtn, { borderColor: '#FECACA', backgroundColor: isDarkMode ? '#450A0A' : '#FEF2F2' }]}
                onPress={() => handleRespondHouseInvite(invite, 'reject')}
                activeOpacity={0.7}
                disabled={respondingInviteId === invite.id}
              >
                <Ionicons name="close-circle-outline" size={15} color="#DC2626" />
                <LocalizedText style={styles.inviteRejectBtnText}>Từ chối</LocalizedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.inviteAcceptBtn, { backgroundColor: '#16A34A' }]}
                onPress={() => handleRespondHouseInvite(invite, 'accept')}
                activeOpacity={0.8}
                disabled={respondingInviteId === invite.id}
              >
                {respondingInviteId === invite.id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={15} color="#FFFFFF" />
                    <LocalizedText style={styles.inviteAcceptBtnText}>Đồng ý vào nhà</LocalizedText>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* 2. DẢI CHỌN NHANH BỆNH NHÂN PHỤ TRÁCH (Lấy cảm hứng Ảnh 5) */}
        {patients.length > 0 && (
          <View style={styles.patientSelectorSection}>
            <View style={styles.sectionHeaderCompact}>
              <LocalizedText style={[styles.selectorHeading, { color: colors.textPrimary }]}>
                Bệnh nhân đang theo dõi
              </LocalizedText>
              <TouchableOpacity onPress={() => navigation.navigate('DoctorPatients')}>
                <LocalizedText style={styles.seeAllText}>Tất cả ({patients.length})</LocalizedText>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.patientAvatarStrip}>
              {patients.map((p) => {
                const isSelected = p.id === activePatient?.id;
                const isWarn = p.health_status === 'WARNING';
                const isDanger = p.health_status === 'DANGER';
                const ringColor = isDanger ? '#EF4444' : isWarn ? '#F59E0B' : '#10B981';

                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setSelectedPatientId(p.id)}
                    style={[
                      styles.avatarPillItem,
                      isSelected && {
                        backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                        borderColor: '#2563EB',
                        borderWidth: 1.5,
                        shadowColor: '#2563EB',
                        shadowOpacity: 0.15,
                        shadowRadius: 6,
                        elevation: 3,
                      },
                    ]}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.stripAvatarRing, { borderColor: ringColor }]}>
                      {p.avatar_url ? (
                        <Image source={{ uri: getPatientAvatarUrl(p.avatar_url)! }} style={styles.stripAvatarImg} />
                      ) : (
                        <View style={[styles.stripAvatarPlaceholder, { backgroundColor: ringColor }]}>
                          <Text style={styles.stripAvatarLetter}>{getPatientInitial(p.name)}</Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.stripPatientName,
                        { color: isSelected ? '#2563EB' : colors.textPrimary },
                        isSelected && { fontWeight: '700' },
                      ]}
                      numberOfLines={1}
                    >
                      {p.name.replace(/^(cụ|bác|ông|bà)\s+/i, '')}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {/* Nút Thêm bệnh nhân */}
              <TouchableOpacity
                style={[styles.avatarPillItem, styles.addPatientPill, { borderColor: isDarkMode ? '#334155' : '#CBD5E1' }]}
                onPress={() => navigation.navigate('DoctorPatients')}
                activeOpacity={0.7}
              >
                <View style={[styles.stripAddCircle, { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6' }]}>
                  <Ionicons name="add" size={20} color="#2563EB" />
                </View>
                <Text style={[styles.stripPatientName, { color: '#2563EB', fontWeight: '600' }]}>+ Thêm</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* 3. THẺ TỔNG QUAN SINH HIỆU NỔI BẬT — HERO HEALTH CARD (Ảnh 5) */}
        {activePatient ? (
          <TouchableOpacity
            style={styles.heroHealthCard}
            activeOpacity={0.92}
            onPress={() => navigation.navigate('DoctorPatientDetail', { patientId: activePatient.id })}
          >
            {/* Hàng trên của Hero Card */}
            <View style={styles.heroCardTop}>
              <View style={styles.heroScoreCircle}>
                <Text style={styles.heroScoreVal}>{safetyScore}</Text>
                <Text style={styles.heroScoreMax}>/100</Text>
              </View>

              <View style={styles.heroPatientMeta}>
                <View style={styles.heroStatusBadge}>
                  <View
                    style={[
                      styles.heroStatusDot,
                      {
                        backgroundColor:
                          activePatient.health_status === 'DANGER'
                            ? '#EF4444'
                            : activePatient.health_status === 'WARNING'
                              ? '#F59E0B'
                              : '#34D399',
                      },
                    ]}
                  />
                  <Text style={styles.heroStatusText}>
                    {activePatient.health_status === 'DANGER'
                      ? 'Nguy cấp'
                      : activePatient.health_status === 'WARNING'
                        ? 'Cần chú ý'
                        : 'Sinh hiệu ổn định'}
                  </Text>
                </View>

                <Text style={styles.heroPatientName} numberOfLines={1}>
                  {activePatient.name} • {activePatient.age ? `${activePatient.age} tuổi` : 'Cao tuổi'}
                </Text>
                <Text style={styles.heroAddressText} numberOfLines={1}>
                  {getPatientAddress(activePatient)}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" style={{ alignSelf: 'center' }} />
            </View>

            {/* 3 Ô KÍNH MỜ SINH HIỆU THỜI GIAN THỰC (Glassmorphism Pills - Ảnh 5) */}
            <View style={styles.glassPillsRow}>
              {/* Ô 1: Nhịp tim */}
              <View style={styles.glassPill}>
                <View style={styles.pillIconRow}>
                  <Ionicons name="heart" size={14} color="#F87171" />
                  <Text style={styles.glassPillLabel}>Nhịp tim</Text>
                </View>
                <Text style={styles.glassPillVal}>
                  {activePatient.heart_rate ? `${activePatient.heart_rate} bpm` : '78 bpm'}
                </Text>
              </View>

              {/* Ô 2: SpO2 */}
              <View style={styles.glassPill}>
                <View style={styles.pillIconRow}>
                  <Ionicons name="water" size={14} color="#67E8F9" />
                  <Text style={styles.glassPillLabel}>SpO2</Text>
                </View>
                <Text style={styles.glassPillVal}>
                  {activePatient.spo2 ? `${activePatient.spo2}%` : '97%'}
                </Text>
              </View>

              {/* Ô 3: Vòng Smartband */}
              <View style={styles.glassPill}>
                <View style={styles.pillIconRow}>
                  <Ionicons name="watch-outline" size={14} color="#A7F3D0" />
                  <Text style={styles.glassPillLabel}>Smartband</Text>
                </View>
                <Text style={[styles.glassPillVal, { fontSize: 12 }]} numberOfLines={1}>
                  CooSpo HW706
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ) : null}

        {/* 4. MỤC CẦN LƯU Ý LÂM SÀNG (Nếu có bệnh nhân cảnh báo) */}
        {warningPatients.length > 0 && (
          <View style={styles.sectionArea}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="alert-circle" size={18} color="#EF4444" />
                <LocalizedText style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Cần lưu ý lâm sàng ({warningPatients.length})
                </LocalizedText>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('DoctorPatients')}>
                <LocalizedText style={styles.seeAllText}>Xem tất cả</LocalizedText>
              </TouchableOpacity>
            </View>

            {warningPatients.slice(0, 2).map((p) => (
              <View
                key={p.id}
                style={[
                  styles.warningAlertCard,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                    borderColor: p.health_status === 'DANGER' ? '#FCA5A5' : '#FCD34D',
                  },
                ]}
              >
                <View style={styles.warningAlertTop}>
                  <View style={[styles.warningIconSquare, { backgroundColor: p.health_status === 'DANGER' ? '#FEE2E2' : '#FEF3C7' }]}>
                    <Ionicons
                      name={p.health_status === 'DANGER' ? 'warning' : 'pulse'}
                      size={18}
                      color={p.health_status === 'DANGER' ? '#DC2626' : '#D97706'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.warningPatientName, { color: colors.textPrimary }]}>
                      {p.name} ({p.age ? `${p.age} tuổi` : 'Cao tuổi'})
                    </Text>
                    <Text style={styles.warningVitalText}>
                      Nhịp tim: <Text style={{ fontWeight: '700', color: '#DC2626' }}>{p.heart_rate || 122} bpm</Text> • SpO2:{' '}
                      <Text style={{ fontWeight: '700', color: '#059669' }}>{p.spo2 || 94}%</Text>
                    </Text>
                  </View>
                </View>

                <View style={styles.warningActionRow}>
                  <TouchableOpacity
                    style={[styles.btnOutlineRecord, { borderColor: isDarkMode ? '#334155' : '#DBEAFE' }]}
                    onPress={() => navigation.navigate('DoctorPatientDetail', { patientId: p.id })}
                  >
                    <Text style={styles.btnOutlineRecordText}>Xem bệnh án</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.btnPrimaryAppt}
                    onPress={() => navigation.navigate('DoctorAppointments')}
                  >
                    <Ionicons name="calendar-outline" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.btnPrimaryApptText}>Đặt lịch ngay</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 5. KHỐI LỊCH KHÁM HÔM NAY (Ảnh 1 & 5) */}
        <View style={[styles.sectionArea, { marginTop: 20 }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="calendar" size={18} color="#2563EB" />
              <LocalizedText style={[styles.sectionTitle, { color: colors.textPrimary }]}>Lịch khám hôm nay</LocalizedText>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('DoctorAppointments')}>
              <LocalizedText style={styles.seeAllText}>Xem tất cả</LocalizedText>
            </TouchableOpacity>
          </View>

          {nextAppointment ? (
            <TouchableOpacity style={styles.scheduleBannerCard} activeOpacity={0.92} onPress={() => setDetailModalVisible(true)}>
              <View style={styles.cardGradientLayer} />
              <View style={styles.bannerLeftContent}>
                <View style={styles.nextTagBadge}>
                  <Ionicons name="calendar" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <LocalizedText style={styles.nextTagText}>Lịch khám kế tiếp</LocalizedText>
                </View>
                <LocalizedText style={styles.bannerPatientName} numberOfLines={1}>
                  {nextAppointment.patient_name || 'Bệnh nhân'}
                </LocalizedText>
                <LocalizedText style={styles.bannerReasonText} numberOfLines={1}>
                  {nextAppointment.clinical_notes || nextAppointment.exam_type || 'Khám sức khỏe'} • {nextAppointment.visit_type === 'CLINIC' ? 'Phòng khám' : 'Tại nhà'}
                </LocalizedText>
                <View style={styles.bannerTimeContainer}>
                  <Ionicons name="time" size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
                  <LocalizedText style={styles.bannerTimeText}>Hôm nay, {formatAptTime(nextAppointment.scheduled_at)}</LocalizedText>
                </View>
              </View>
              <View style={styles.bannerRightImageWrap}>
                <Image source={doctorBannerImg} style={styles.doctorBannerImage} resizeMode="cover" />
                <View style={styles.imageFadeOverlay} />
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.scheduleBannerCard}>
              <View style={styles.cardGradientLayer} />
              <View style={styles.bannerLeftContent}>
                <LocalizedText style={styles.emptyCardTitle}>Hôm nay không có lịch khám nào</LocalizedText>
                <LocalizedText style={styles.emptyCardSub}>
                  Bác sĩ có thể chủ động lên lịch thăm khám định kỳ cho các bệnh nhân.
                </LocalizedText>
                <TouchableOpacity style={styles.btnWhiteAddSchedule} activeOpacity={0.85} onPress={() => navigation.navigate('DoctorAppointments')}>
                  <Ionicons name="add-circle" size={16} color="#2563EB" style={{ marginRight: 4 }} />
                  <LocalizedText style={styles.btnWhiteAddScheduleText}>+ Đặt lịch mới</LocalizedText>
                </TouchableOpacity>
              </View>
              <View style={styles.bannerRightImageWrap}>
                <Image source={doctorBannerImg} style={styles.doctorBannerImage} resizeMode="cover" />
                <View style={styles.imageFadeOverlay} />
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Sheet Thông Báo */}
      <NotificationsBottomSheet
        visible={notifModalVisible}
        onClose={() => closeNotifAndRun()}
        hasUnread={hasUnreadNotifs}
        appointments={todayAppointments}
        upcomingAppointments={upcomingAppointments}
        warningPatients={warningPatients}
        incidents={incidents}
        onSelectPatient={(pId) => closeNotifAndRun(() => navigation.navigate('DoctorPatientDetail', { patientId: pId }))}
        onSelectAppointment={() => closeNotifAndRun(() => navigation.navigate('DoctorAppointments'))}
        onNavigate={(screenName, params) => closeNotifAndRun(() => navigation.navigate(screenName, params))}
        onMarkAllRead={async () => {
          setHasUnreadNotifs(false);
          await useAlertStore.getState().acknowledgeAll();
        }}
        onRespondHouseInvite={handleRespondHouseInvite}
      />

      <AppointmentDetailModal
        visible={detailModalVisible}
        appointment={nextAppointment}
        patientInfo={activePatient}
        onClose={() => setDetailModalVisible(false)}
        onReschedule={() => {
          setDetailModalVisible(false);
          navigation.navigate('DoctorAppointments');
        }}
        onStartExam={(pId: string) => {
          setDetailModalVisible(false);
          navigation.navigate('DoctorPatientDetail', { patientId: pId });
        }}
        formatAptTime={formatAptTime}
        isDarkMode={isDarkMode}
        colors={colors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradientArea: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  doctorAvatarContainer: { position: 'relative', marginRight: 12 },
  doctorAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  doctorAvatarImg: { width: '100%', height: '100%' },
  doctorAvatarLetter: { color: '#FFFFFF', fontSize: 19, fontWeight: '800' },
  onlineBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
  },
  greetingBox: { flex: 1, justifyContent: 'center' },
  greetingTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  greetingSub: { fontSize: 12, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  badgeDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
  },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 100 },

  // Dải chọn nhanh bệnh nhân
  patientSelectorSection: { marginBottom: 14 },
  sectionHeaderCompact: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  selectorHeading: { fontSize: 14, fontWeight: '800' },
  seeAllText: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
  patientAvatarStrip: { gap: 10, paddingVertical: 4 },
  avatarPillItem: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'transparent',
    minWidth: 70,
  },
  addPatientPill: {
    borderStyle: 'dashed',
    borderWidth: 1,
  },
  stripAvatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    marginBottom: 6,
  },
  stripAvatarImg: { width: '100%', height: '100%', borderRadius: 22 },
  stripAvatarPlaceholder: { width: '100%', height: '100%', borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  stripAvatarLetter: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  stripAddCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  stripPatientName: { fontSize: 11, fontWeight: '600' },

  // Hero Health Card
  heroHealthCard: {
    borderRadius: 24,
    backgroundColor: '#1E40AF',
    padding: 18,
    marginBottom: 16,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  heroCardTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  heroScoreCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 2.5,
    borderColor: '#34D399',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroScoreVal: { color: '#FFFFFF', fontSize: 19, fontWeight: '900', lineHeight: 22 },
  heroScoreMax: { color: 'rgba(255,255,255,0.7)', fontSize: 9.5, fontWeight: '700' },
  heroPatientMeta: { flex: 1 },
  heroStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 4,
    gap: 4,
  },
  heroStatusDot: { width: 6, height: 6, borderRadius: 3 },
  heroStatusText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '700' },
  heroPatientName: { color: '#FFFFFF', fontSize: 15.5, fontWeight: '800' },
  heroAddressText: { color: 'rgba(255, 255, 255, 0.8)', fontSize: 11.5, marginTop: 1 },

  glassPillsRow: { flexDirection: 'row', gap: 8 },
  glassPill: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  pillIconRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  glassPillLabel: { color: 'rgba(255, 255, 255, 0.85)', fontSize: 10, fontWeight: '600' },
  glassPillVal: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '800' },

  // Cần lưu ý lâm sàng
  sectionArea: { marginBottom: 16 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 14.5, fontWeight: '800' },
  warningAlertCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  warningAlertTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  warningIconSquare: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  warningPatientName: { fontSize: 13.5, fontWeight: '700', marginBottom: 2 },
  warningVitalText: { fontSize: 12, color: '#64748B' },
  warningActionRow: { flexDirection: 'row', gap: 8 },
  btnOutlineRecord: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineRecordText: { fontSize: 11.5, fontWeight: '700', color: '#2563EB' },
  btnPrimaryAppt: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 7,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryApptText: { fontSize: 11.5, fontWeight: '700', color: '#FFFFFF' },

  // Lời mời
  inviteCard: { borderRadius: 18, borderWidth: 1.5, padding: 14, marginBottom: 14 },
  inviteCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  inviteIconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  inviteCardTitle: { fontSize: 13.5, fontWeight: '700' },
  pendingBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  pendingBadgeText: { color: '#D97706', fontSize: 10, fontWeight: '700' },
  inviteCardMessage: { fontSize: 12, marginTop: 4, lineHeight: 16 },
  inviteBtnRow: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  inviteRejectBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  inviteRejectBtnText: { color: '#DC2626', fontSize: 11.5, fontWeight: '700' },
  inviteAcceptBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  inviteAcceptBtnText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '700' },

  // Schedule Banner Card
  scheduleBannerCard: {
    borderRadius: 22,
    backgroundColor: '#1D4ED8',
    overflow: 'hidden',
    position: 'relative',
    minHeight: 142,
    flexDirection: 'row',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  cardGradientLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(29, 78, 216, 0.95)' },
  bannerLeftContent: { flex: 1, padding: 16, zIndex: 2, justifyContent: 'center' },
  nextTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  nextTagText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '700' },
  bannerPatientName: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginBottom: 2 },
  bannerReasonText: { color: 'rgba(255,255,255,0.85)', fontSize: 11.5, marginBottom: 8 },
  bannerTimeContainer: { flexDirection: 'row', alignItems: 'center' },
  bannerTimeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  bannerRightImageWrap: { width: 110, position: 'relative' },
  doctorBannerImage: { width: '100%', height: '100%' },
  imageFadeOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(29, 78, 216, 0.25)' },
  emptyCardTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', marginBottom: 2 },
  emptyCardSub: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginBottom: 10, lineHeight: 15 },
  btnWhiteAddSchedule: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  btnWhiteAddScheduleText: { color: '#2563EB', fontSize: 11.5, fontWeight: '700' },
});

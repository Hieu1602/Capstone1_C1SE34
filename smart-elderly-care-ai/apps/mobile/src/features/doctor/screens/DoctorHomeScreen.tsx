// DoctorHomeScreen.tsx
// Trang chủ Bác sĩ gia đình - Giao diện hiện đại cao cấp, Skeleton Loading mượt mà không giật

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Image,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { Colors } from '../../../theme/colors';
import { useTheme } from '../../../store/useThemeStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useAlertStore } from '../../../store/useAlertStore';
import { doctorApi } from '../../../services/api';
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

// Export lại để các màn hình khác (DoctorPatientsScreen) import không bị lỗi
export { STANDARD_PATIENT_NAMES, normalizePatientsList };

// Ảnh banner bác sĩ
const doctorBannerImg = require('../../../../assets/images/doctor-banner.png');

// Component Skeleton Loading khung mờ nhấp nháy dạng Card
const PatientCardSkeleton = ({ isDarkMode }: { isDarkMode: boolean }) => {
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.85, duration: 750, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  const bgPlaceholder = isDarkMode ? '#334155' : '#E2E8F0';

  return (
    <Animated.View
      style={[
        styles.patientCardItem,
        {
          backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
          borderColor: isDarkMode ? '#334155' : '#E2E8F0',
          opacity: pulseAnim,
        },
      ]}
    >
      <View style={[styles.patientAvatarWrap, { backgroundColor: bgPlaceholder }]} />
      <View style={styles.patientInfoCol}>
        <View style={{ height: 16, width: '55%', borderRadius: 6, backgroundColor: bgPlaceholder, marginBottom: 6 }} />
        <View style={{ height: 12, width: '80%', borderRadius: 4, backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }} />
      </View>
      <View style={{ width: 60, height: 24, borderRadius: 8, backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }} />
    </Animated.View>
  );
};

export default function DoctorHomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { isDarkMode, colors } = useTheme();
  const { userName } = useAuthStore();
  const { incidents, fetchNotifications: fetchIncidents } = useAlertStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [patients, setPatients] = useState<PatientCardData[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<AppointmentItem[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<AppointmentItem[]>([]);
  const [nextAppointment, setNextAppointment] = useState<AppointmentItem | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [hasUnreadNotifs, setHasUnreadNotifs] = useState(false);

  useEffect(() => {
    const unread = incidents.some((inc) => !inc.is_acknowledged);
    setHasUnreadNotifs(unread);
  }, [incidents]);

  const fetchData = useCallback(async () => {
    try {
      const [patRes, aptRes] = await Promise.allSettled([
        doctorApi.getPatients(),
        doctorApi.getAppointments(),
        fetchIncidents(),
      ]);

      if (patRes.status === 'fulfilled' && patRes.value.data) {
        setPatients(normalizePatientsList(patRes.value.data));
      } else {
        setPatients(normalizePatientsList([]));
      }

      if (aptRes.status === 'fulfilled' && aptRes.value.data && Array.isArray(aptRes.value.data)) {
        const allApts: AppointmentItem[] = aptRes.value.data;
        const todayStr = new Date().toISOString().slice(0, 10);
        const todays = allApts.filter((apt) => {
          if (!apt.scheduled_at) return false;
          return apt.scheduled_at.slice(0, 10) === todayStr && apt.status !== 'CANCELLED';
        });

        todays.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
        setTodayAppointments(todays);
        setUpcomingAppointments(allApts.filter((a) => a.status === 'UPCOMING'));

        const upcoming = todays.find((a) => a.status === 'UPCOMING') || todays[0] || null;
        setNextAppointment(upcoming);
      }
    } catch {
      setPatients(normalizePatientsList([]));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatAptTime = (dateStr?: string) => {
    if (!dateStr) return '--:--';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '--:--';
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return '--:--';
    }
  };

  const getPatientInitial = (name: string) => {
    if (!name) return 'B';
    const parts = name.replace(/^(cụ|bác|ông|bà)\s+/i, '').trim().split(/\s+/);
    return parts[parts.length - 1]?.[0]?.toUpperCase() || 'B';
  };

  const currentPatientInfo = nextAppointment
    ? patients.find((p) => p.id === nextAppointment.patient_id)
    : null;

  const warningPatients = patients.filter((p) => p.health_status === 'WARNING' || p.health_status === 'DANGER');
  const totalNotifCount = todayAppointments.length + upcomingAppointments.length + warningPatients.length + incidents.length;

  const doctorInitial =
    (userName || 'Bác sĩ').trim().split(/\s+/).slice(-1)[0][0]?.toUpperCase() || 'B';

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* 1. Header trang chủ (Góc nhìn Bác sĩ) */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <View style={styles.doctorAvatar}>
            <LocalizedText style={styles.doctorAvatarLetter}>{doctorInitial}</LocalizedText>
            <View style={styles.onlineBadge} />
          </View>
          <View style={styles.greetingBox}>
            <LocalizedText style={[styles.greetingTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              Xin chào, {userName || 'Bác sĩ'} 👋
            </LocalizedText>
            <LocalizedText style={[styles.greetingSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Hôm nay công việc thế nào?
            </LocalizedText>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]}
            onPress={() => {
              setNotifModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={20} color={isDarkMode ? '#E2E8F0' : '#334155'} />
            {hasUnreadNotifs && <View style={styles.badgeDot} />}
          </TouchableOpacity>
        </View>
      </View>

      <AdminMarqueeBanner targetAudience="doctors" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Khối Lịch khám hôm nay / sắp tới */}
        <View style={styles.sectionHeaderRow}>
          <LocalizedText style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Lịch khám hôm nay
          </LocalizedText>
          <TouchableOpacity
            onPress={() => navigation.navigate('DoctorAppointments')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <LocalizedText style={styles.seeAllText}>Xem tất cả</LocalizedText>
          </TouchableOpacity>
        </View>

        {nextAppointment ? (
          <TouchableOpacity
            style={styles.scheduleBannerCard}
            activeOpacity={0.92}
            onPress={() => setDetailModalVisible(true)}
          >
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
                {nextAppointment.clinical_notes || nextAppointment.exam_type || 'Khám sức khỏe'} •{' '}
                {nextAppointment.visit_type === 'CLINIC' ? 'Phòng khám' : 'Tại nhà'}
              </LocalizedText>

              <View style={styles.bannerTimeContainer}>
                <Ionicons name="time" size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
                <LocalizedText style={styles.bannerTimeText}>
                  Hôm nay, {formatAptTime(nextAppointment.scheduled_at)}
                </LocalizedText>
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
                Bác sĩ có thể chủ động lên lịch thăm khám định kỳ cho các cụ.
              </LocalizedText>

              <TouchableOpacity
                style={styles.btnWhiteAddSchedule}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('DoctorAppointments')}
              >
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

        {/* 3. Khối Danh sách bệnh nhân phụ trách */}
        <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
          <LocalizedText style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Bệnh nhân phụ trách
          </LocalizedText>
          <TouchableOpacity
            onPress={() => navigation.navigate('DoctorPatients')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <LocalizedText style={styles.seeAllText}>Xem tất cả</LocalizedText>
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <>
            <PatientCardSkeleton isDarkMode={isDarkMode} />
            <PatientCardSkeleton isDarkMode={isDarkMode} />
            <PatientCardSkeleton isDarkMode={isDarkMode} />
          </>
        ) : patients.length === 0 ? (
          <View
            style={[
              styles.emptyPatientsCard,
              {
                backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                borderColor: isDarkMode ? '#334155' : '#E2E8F0',
              },
            ]}
          >
            <Ionicons name="people-outline" size={38} color={isDarkMode ? '#64748B' : '#94A3B8'} style={{ marginBottom: 8 }} />
            <LocalizedText style={[styles.emptyPatientsTitle, { color: colors.textPrimary }]}>
              Chưa có bệnh nhân nào phụ trách
            </LocalizedText>
            <LocalizedText style={[styles.emptyPatientsSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Danh sách sẽ hiển thị khi bạn được phân công phụ trách hồ sơ người cao tuổi.
            </LocalizedText>
          </View>
        ) : (
          patients.slice(0, 5).map((patient) => {
            const initial = getPatientInitial(patient.name);
            const isWarn = patient.health_status === 'WARNING';
            const isDanger = patient.health_status === 'DANGER';
            const isStable = !isWarn && !isDanger;

            return (
              <TouchableOpacity
                key={patient.id}
                style={[
                  styles.patientCardItem,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                    borderColor: isDanger ? '#FCA5A5' : isWarn ? '#FCD34D' : (isDarkMode ? '#334155' : '#E2E8F0'),
                  },
                ]}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('DoctorPatientDetail', { patientId: patient.id })}
              >
                <View style={styles.patientAvatarContainer}>
                  <View
                    style={[
                      styles.patientAvatarWrap,
                      { backgroundColor: isDanger ? '#EF4444' : isWarn ? '#F59E0B' : '#2563EB' },
                    ]}
                  >
                    {patient.avatar_url ? (
                      <Image
                        source={{ uri: getPatientAvatarUrl(patient.avatar_url)! }}
                        style={styles.patientAvatarImg}
                        resizeMode="cover"
                      />
                    ) : (
                      <LocalizedText style={styles.patientAvatarLetter}>{initial}</LocalizedText>
                    )}
                  </View>
                  <View
                    style={[
                      styles.patientStatusDot,
                      {
                        backgroundColor: isDanger ? '#EF4444' : isWarn ? '#F59E0B' : '#10B981',
                        borderColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                      },
                    ]}
                  />
                </View>

                <View style={styles.patientInfoCol}>
                  <LocalizedText style={[styles.patientFullDisplayName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {patient.name}
                  </LocalizedText>
                  <LocalizedText style={[styles.patientMetaText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                    {patient.age ? `${patient.age} tuổi` : 'Cao tuổi'} • {patient.gender ? (patient.gender === 'Nữ' || patient.gender.toUpperCase() === 'FEMALE' ? 'Nữ' : 'Nam') : 'Chưa cập nhật'} • {patient.house_name || 'Nhà riêng'}
                  </LocalizedText>
                </View>

                <View style={styles.patientRightCol}>
                  <View
                    style={[
                      styles.healthStatusPill,
                      { backgroundColor: isDanger ? '#FEE2E2' : isWarn ? '#FEF3C7' : '#D1FAE5' },
                    ]}
                  >
                    <LocalizedText
                      style={[
                        styles.healthStatusText,
                        { color: isDanger ? '#DC2626' : isWarn ? '#D97706' : '#059669' },
                      ]}
                    >
                      {isStable ? 'Ổn định' : 'Cần chú ý'}
                    </LocalizedText>
                  </View>

                  <View style={styles.quickRecordBtn}>
                    <LocalizedText style={styles.quickRecordText}>Xem bệnh án</LocalizedText>
                    <Ionicons name="chevron-forward" size={13} color="#2563EB" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Modal Chi tiết Lịch hẹn khi nhấn vào Card Banner */}
      <NotificationsBottomSheet
        visible={notifModalVisible}
        onClose={() => {
          setNotifModalVisible(false);
          setHasUnreadNotifs(false);
        }}
        hasUnread={hasUnreadNotifs}
        appointments={todayAppointments}
        upcomingAppointments={upcomingAppointments}
        warningPatients={warningPatients}
        incidents={incidents}
        onSelectPatient={(pId) => {
          setNotifModalVisible(false);
          setHasUnreadNotifs(false);
          navigation.navigate('DoctorPatientDetail', { patientId: pId });
        }}
        onSelectAppointment={() => {
          setNotifModalVisible(false);
          setHasUnreadNotifs(false);
          navigation.navigate('DoctorAppointments');
        }}
        onNavigate={(screenName, params) => {
          setNotifModalVisible(false);
          setHasUnreadNotifs(false);
          navigation.navigate(screenName, params);
        }}
        onMarkAllRead={async () => {
          setHasUnreadNotifs(false);
          await useAlertStore.getState().acknowledgeAll();
        }}
      />

      <AppointmentDetailModal
        visible={detailModalVisible}
        appointment={nextAppointment}
        patientInfo={currentPatientInfo}
        onClose={() => setDetailModalVisible(false)}
        onReschedule={() => {
          setDetailModalVisible(false);
          navigation.navigate('DoctorAppointments');
        }}
        onStartExam={(pId) => {
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
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  doctorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginRight: 12,
  },
  doctorAvatarLetter: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  greetingBox: { flex: 1 },
  greetingTitle: {
    fontSize: 15.5,
    fontWeight: '800',
  },
  greetingSub: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 95,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16.5,
    fontWeight: '800',
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },

  /* Card Lịch khám hôm nay */
  scheduleBannerCard: {
    borderRadius: 20,
    minHeight: 170,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  cardGradientLayer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#1D4ED8',
    opacity: 0.15,
  },
  bannerLeftContent: {
    flex: 1,
    paddingLeft: 18,
    paddingVertical: 16,
    paddingRight: 6,
    justifyContent: 'center',
    zIndex: 2,
  },
  nextTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 12,
    marginBottom: 8,
  },
  nextTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  bannerPatientName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  bannerReasonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12.5,
    fontWeight: '500',
    marginBottom: 10,
  },
  bannerTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 10,
  },
  bannerTimeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  bannerRightImageWrap: {
    width: '38%',
    height: '100%',
    position: 'relative',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  doctorBannerImage: {
    width: '100%',
    height: '100%',
  },
  imageFadeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 25,
    backgroundColor: '#2563EB',
    opacity: 0.25,
  },

  emptyCardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyCardSub: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 12,
  },
  btnWhiteAddSchedule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  btnWhiteAddScheduleText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '800',
  },


  /* Danh sách bệnh nhân phụ trách */
  patientCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  patientAvatarContainer: {
    width: 46,
    height: 46,
    position: 'relative',
    marginRight: 12,
  },
  patientAvatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  patientAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 23,
  },
  patientAvatarLetter: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  patientStatusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    zIndex: 2,
  },
  patientInfoCol: { flex: 1, paddingRight: 6 },
  patientFullDisplayName: {
    fontSize: 15.5,
    fontWeight: '800',
    marginBottom: 3,
  },
  patientMetaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  patientRightCol: {
    alignItems: 'flex-end',
    gap: 8,
  },
  healthStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  healthStatusText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  quickRecordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  quickRecordText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  emptyPatientsCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginVertical: 4,
  },
  emptyPatientsTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyPatientsSub: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
});
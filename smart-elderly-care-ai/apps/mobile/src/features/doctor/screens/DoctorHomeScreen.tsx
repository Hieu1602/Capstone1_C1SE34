// DoctorHomeScreen.tsx
// Trang chủ Bác sĩ gia đình

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors } from '../../../theme/colors';
import { useTheme } from '../../../store/useThemeStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useAlertStore } from '../../../store/useAlertStore';
import { useDoctorAppointmentsStore } from '../../../store/useDoctorAppointmentsStore';
import { doctorApi, householdApi, usersApi } from '../../../services/api';
import { toLocalYMD, getLocalTodayYMD } from '../utils/dateUtils';
import { alertsWS } from '../../../services/websocket';
import { resolveAvatarUrl } from '../../auth/hooks/useProfileManager';
import { LocalizedText } from '../../../i18n/LocalizedComponents';
import AdminMarqueeBanner from '../../../components/AdminMarqueeBanner';
import {
  PatientCardData,
  AppointmentItem,
  STANDARD_PATIENT_NAMES,
  normalizePatientsList,
} from '../components/types';
import { AppointmentDetailModal } from '../components';
import NotificationsBottomSheet from '../components/NotificationsBottomSheet';
import {
  withTimeout,
  formatAptTime,
  getDoctorInitial,
  DoctorInviteCard,
  TodayScheduleBanner,
  ClinicalWarningsSection,
  PatientQuickStrip,
  HeroHealthCard,
} from '../components/DoctorHomeComponents';

export { STANDARD_PATIENT_NAMES, normalizePatientsList };

const DOCTOR_HOME_CACHE_KEY = '@seca_doctor_home_cache_v1';

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

  const {
    appointments,
    fetchAppointments: fetchSharedAppointments,
    setAppointments: setSharedAppointments,
  } = useDoctorAppointmentsStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [patients, setPatients] = useState<PatientCardData[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [hasUnreadNotifs, setHasUnreadNotifs] = useState(false);
  const [respondingInviteId, setRespondingInviteId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const todayYMD = getLocalTodayYMD();
  const todayAppointments = useMemo(
    () =>
      appointments
        .filter((apt) => apt.scheduled_at && apt.status !== 'CANCELLED' && toLocalYMD(apt.scheduled_at) === todayYMD)
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
    [appointments, todayYMD]
  );
  const upcomingAppointments = useMemo(
    () =>
      appointments
        .filter((a) => a.status === 'UPCOMING' || a.status === 'CONFIRMED')
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
    [appointments]
  );
  const nextAppointment = useMemo(() => {
    const cutoff = nowMs - 30 * 60 * 1000;
    const isActiveStatus = (s?: string) => s === 'UPCOMING' || s === 'CONFIRMED';
    const activeToday = todayAppointments.find(
      (a) => isActiveStatus(a.status) && new Date(a.scheduled_at).getTime() >= cutoff
    );
    if (activeToday) return activeToday;
    const activeUpcoming = upcomingAppointments.find(
      (a) => new Date(a.scheduled_at).getTime() >= cutoff
    );
    if (activeUpcoming) return activeUpcoming;
    return todayAppointments.find((a) => isActiveStatus(a.status)) || upcomingAppointments[0] || null;
  }, [todayAppointments, upcomingAppointments, nowMs]);

  // 1. Nạp Cache tức thì (0ms) từ AsyncStorage khi mở màn hình
  useEffect(() => {
    AsyncStorage.getItem(DOCTOR_HOME_CACHE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.patients) && parsed.patients.length > 0) {
          setPatients(parsed.patients);
          setSelectedPatientId((curr) => curr || parsed.selectedPatientId || parsed.patients[0]?.id || null);
        }
        if (useDoctorAppointmentsStore.getState().appointments.length === 0 && Array.isArray(parsed.appointments)) {
          setSharedAppointments(parsed.appointments);
        }
        setLoading(false);
      })
      .catch(() => {});
  }, [setSharedAppointments]);

  // 2. Bộ đếm 10s kiểm tra độ trễ sinh hiệu
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setHasUnreadNotifs(incidents.some((inc) => !inc.is_acknowledged));
  }, [incidents]);

  const fetchData = useCallback(async () => {
    try {
      const [patRes, aptRes, meRes] = await Promise.allSettled([
        withTimeout(doctorApi.getPatients(), 5000),
        withTimeout(fetchSharedAppointments(), 5000),
        withTimeout(usersApi.getMe(), 5000),
        withTimeout(fetchIncidents(), 5000),
      ]);

      if (meRes.status === 'fulfilled' && meRes.value?.data) {
        const u = meRes.value.data;
        useAuthStore.getState().setProfile({ avatar_url: u.avatar_url, full_name: u.full_name });
        useAuthStore.getState().setAvatar(u.avatar_url || '');
      }

      let nextPatients: PatientCardData[] | null = null;
      let nextSelId: string | null = null;
      if (patRes.status === 'fulfilled' && patRes.value.data) {
        const normalized = normalizePatientsList(patRes.value.data);
        nextPatients = normalized;
        setPatients(normalized);
        setSelectedPatientId((curr) => {
          if (curr && normalized.some((p) => p.id === curr)) {
            nextSelId = curr;
            return curr;
          }
          const warn = normalized.find((p) => p.health_status === 'DANGER' || p.health_status === 'WARNING');
          nextSelId = warn ? warn.id : normalized[0]?.id || null;
          return nextSelId;
        });
      }

      const fetchedApts = aptRes.status === 'fulfilled' && Array.isArray(aptRes.value) ? aptRes.value : null;

      setNowMs(Date.now());

      AsyncStorage.getItem(DOCTOR_HOME_CACHE_KEY)
        .then((prevRaw) => {
          const prev = prevRaw ? JSON.parse(prevRaw) : {};
          return AsyncStorage.setItem(
            DOCTOR_HOME_CACHE_KEY,
            JSON.stringify({
              patients: nextPatients ?? prev.patients ?? [],
              selectedPatientId: nextSelId ?? prev.selectedPatientId ?? null,
              appointments: fetchedApts ?? prev.appointments ?? [],
            })
          );
        })
        .catch(() => {});
    } catch {
      // Giữ nguyên dữ liệu cache hiện tại nếu mạng lỗi
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchIncidents, fetchSharedAppointments]);

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
      const evtType = String(event?.type || '');
      const alertType = String(event?.alert_type || '');
      if (
        evtType === 'ALERT_NEW' ||
        evtType === 'INCIDENT_RESOLVED' ||
        evtType === 'INCIDENT_ESCALATED' ||
        evtType === 'vitals_update' ||
        evtType === 'TELEMETRY_UPDATE' ||
        evtType === 'DEVICE_STATUS' ||
        evtType.startsWith('APPOINTMENT_') ||
        alertType === 'MEDICAL_RECORD_UPDATED' ||
        alertType.startsWith('APPOINTMENT_')
      ) {
        setNowMs(Date.now());
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

  const warningPatients = patients.filter((p) => p.health_status === 'WARNING' || p.health_status === 'DANGER');
  const activePatient = patients.find((p) => p.id === selectedPatientId) || patients[0] || null;
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

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* 1. HEADER CHÀO HỎI BÁC SĨ */}
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
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: isDarkMode ? '#334155' : '#FFFFFF' }]}
            onPress={() => navigation.navigate('DoctorPatients')}
            activeOpacity={0.7}
          >
            <Ionicons name="search-outline" size={19} color={isDarkMode ? '#E2E8F0' : '#1E293B'} />
          </TouchableOpacity>

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
        {pendingHouseInvites.map((invite) => (
          <DoctorInviteCard
            key={invite.id}
            invite={invite}
            isDarkMode={isDarkMode}
            colors={colors}
            responding={respondingInviteId === invite.id}
            onRespond={handleRespondHouseInvite}
          />
        ))}

        <TodayScheduleBanner
          loading={loading}
          hasPatients={patients.length > 0}
          nextAppointment={nextAppointment}
          isDarkMode={isDarkMode}
          colors={colors}
          onSeeAll={() => navigation.navigate('DoctorAppointments')}
          onPressAppointment={() => setDetailModalVisible(true)}
        />

        <ClinicalWarningsSection
          warningPatients={warningPatients}
          isDarkMode={isDarkMode}
          colors={colors}
          onSeeAll={() => navigation.navigate('DoctorPatients')}
          onViewPatient={(patientId) => navigation.navigate('DoctorPatientDetail', { patientId })}
          onBookAppointment={() => navigation.navigate('DoctorAppointments')}
        />

        <PatientQuickStrip
          patients={patients}
          activePatientId={activePatient?.id}
          nowMs={nowMs}
          isDarkMode={isDarkMode}
          colors={colors}
          onSeeAll={() => navigation.navigate('DoctorPatients')}
          onSelectPatient={(patientId) => {
            setSelectedPatientId(patientId);
          }}
        />

        <HeroHealthCard
          patient={activePatient}
          nowMs={nowMs}
          onPress={(patientId) => navigation.navigate('DoctorPatientDetail', { patientId })}
        />
      </ScrollView>

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
  onlineBadge: { position: 'absolute', bottom: -1, right: -1, width: 14, height: 14, borderRadius: 7, backgroundColor: '#10B981', borderWidth: 2 },
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
  badgeDot: { position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#EF4444' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 100 },
});

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText } from '../../../i18n/LocalizedComponents';
import { PatientCardData, AppointmentItem, getPatientAvatarUrl } from './types';

const doctorBannerImg = require('../../../../assets/images/doctor-banner.png');
const STALE_THRESHOLD_MS = 45 * 1000;

export const withTimeout = <T,>(promise: Promise<T>, ms = 5000): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('API Timeout')), ms)),
  ]);

export const isPatientOnline = (p: PatientCardData | null | undefined, nowMs: number): boolean => {
  if (!p) return false;
  if (p.is_online === false) return false;
  const tsRaw = (p as any).last_updated || (p as any).recorded_at || (p as any).last_seen;
  if (tsRaw) {
    const ts = new Date(tsRaw).getTime();
    if (!isNaN(ts) && nowMs - ts > STALE_THRESHOLD_MS) return false;
  }
  return Boolean(p.is_online);
};

export const formatAptTime = (dateStr?: string) => {
  if (!dateStr) return '--:--';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '--:--' : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '--:--';
  }
};

export const getPatientInitial = (name: string) => {
  if (!name) return 'B';
  const parts = name.replace(/^(cụ|bác|ông|bà)\s+/i, '').trim().split(/\s+/);
  return parts[parts.length - 1]?.[0]?.toUpperCase() || 'B';
};

export const getPatientAddress = (p: PatientCardData) =>
  p.house_address?.trim() || (p.house_name?.trim() && p.house_name !== 'Nhà của tôi' ? p.house_name.trim() : 'Nhà riêng bệnh nhân');

export const getDoctorInitial = (name?: string | null) => {
  if (!name) return 'M';
  const clean = name.replace(/^(bs\.|bác sĩ|dr\.)\s+/i, '').trim();
  const parts = clean.split(/\s+/);
  return parts[parts.length - 1]?.[0]?.toUpperCase() || 'M';
};

export const getSafetyScore = (p: PatientCardData | null) => {
  if (!p) return 86;
  if (p.health_status === 'DANGER') return 48;
  if (p.health_status === 'WARNING') return 74;
  return 92;
};

interface DoctorInviteCardProps {
  invite: any;
  isDarkMode: boolean;
  colors: any;
  responding: boolean;
  onRespond: (invite: any, action: 'accept' | 'reject') => void;
}

export const DoctorInviteCard: React.FC<DoctorInviteCardProps> = ({
  invite,
  isDarkMode,
  colors,
  responding,
  onRespond,
}) => (
  <View style={[styles.inviteCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: '#F59E0B' }]}>
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
        onPress={() => onRespond(invite, 'reject')}
        activeOpacity={0.7}
        disabled={responding}
      >
        <Ionicons name="close-circle-outline" size={15} color="#DC2626" />
        <LocalizedText style={styles.inviteRejectBtnText}>Từ chối</LocalizedText>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.inviteAcceptBtn, { backgroundColor: '#16A34A' }]}
        onPress={() => onRespond(invite, 'accept')}
        activeOpacity={0.8}
        disabled={responding}
      >
        {responding ? (
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
);

interface TodayScheduleBannerProps {
  loading: boolean;
  hasPatients: boolean;
  nextAppointment: AppointmentItem | null;
  isDarkMode: boolean;
  colors: any;
  onSeeAll: () => void;
  onPressAppointment: () => void;
}

export const TodayScheduleBanner: React.FC<TodayScheduleBannerProps> = ({
  loading,
  hasPatients,
  nextAppointment,
  isDarkMode,
  colors,
  onSeeAll,
  onPressAppointment,
}) => (
  <View style={[styles.sectionArea, { marginTop: 8 }]}>
    <View style={styles.sectionHeaderRow}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name="calendar" size={18} color="#2563EB" />
        <LocalizedText style={[styles.sectionTitle, { color: colors.textPrimary }]}>Lịch khám hôm nay</LocalizedText>
      </View>
      <TouchableOpacity onPress={onSeeAll}>
        <LocalizedText style={styles.seeAllText}>Xem tất cả</LocalizedText>
      </TouchableOpacity>
    </View>

    {loading && !nextAppointment && !hasPatients ? (
      <View
        style={[
          styles.scheduleBannerCard,
          {
            backgroundColor: isDarkMode ? '#1E293B' : '#E2E8F0',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
          },
        ]}
      >
        <View style={{ flex: 1, gap: 10, justifyContent: 'center', paddingRight: 12 }}>
          <View style={{ width: '70%', height: 16, borderRadius: 8, backgroundColor: isDarkMode ? '#334155' : '#CBD5E1' }} />
          <View style={{ width: '90%', height: 12, borderRadius: 6, backgroundColor: isDarkMode ? '#334155' : '#CBD5E1' }} />
          <View style={{ width: 110, height: 30, borderRadius: 12, backgroundColor: isDarkMode ? '#334155' : '#CBD5E1', marginTop: 4 }} />
        </View>
        <View style={{ width: 96, height: '100%', borderRadius: 14, backgroundColor: isDarkMode ? '#334155' : '#CBD5E1' }} />
      </View>
    ) : nextAppointment ? (
      <TouchableOpacity style={styles.scheduleBannerCard} activeOpacity={0.92} onPress={onPressAppointment}>
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
          <LocalizedText style={styles.emptyCardTitle} numberOfLines={2}>Hôm nay không có lịch khám nào</LocalizedText>
          <LocalizedText style={styles.emptyCardSub} numberOfLines={2}>
            Bác sĩ có thể chủ động lên lịch thăm khám định kỳ cho các bệnh nhân.
          </LocalizedText>
          <TouchableOpacity style={styles.btnWhiteAddSchedule} activeOpacity={0.85} onPress={onSeeAll}>
            <Ionicons name="add-circle" size={16} color="#2563EB" style={{ marginRight: 4 }} />
            <LocalizedText style={styles.btnWhiteAddScheduleText}>Đặt lịch mới</LocalizedText>
          </TouchableOpacity>
        </View>
        <View style={styles.bannerRightImageWrap}>
          <Image source={doctorBannerImg} style={styles.doctorBannerImage} resizeMode="cover" />
          <View style={styles.imageFadeOverlay} />
        </View>
      </View>
    )}
  </View>
);

interface ClinicalWarningsSectionProps {
  warningPatients: PatientCardData[];
  isDarkMode: boolean;
  colors: any;
  onSeeAll: () => void;
  onViewPatient: (patientId: string) => void;
  onBookAppointment: () => void;
}

export const ClinicalWarningsSection: React.FC<ClinicalWarningsSectionProps> = ({
  warningPatients,
  isDarkMode,
  colors,
  onSeeAll,
  onViewPatient,
  onBookAppointment,
}) => {
  if (warningPatients.length === 0) return null;

  return (
    <View style={[styles.sectionArea, { marginTop: 14 }]}>
      <View style={styles.sectionHeaderRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="alert-circle" size={18} color="#EF4444" />
          <LocalizedText style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Cần lưu ý lâm sàng ({warningPatients.length})
          </LocalizedText>
        </View>
        <TouchableOpacity onPress={onSeeAll}>
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
              onPress={() => onViewPatient(p.id)}
            >
              <Text style={styles.btnOutlineRecordText}>Xem bệnh án</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnPrimaryAppt} onPress={onBookAppointment}>
              <Ionicons name="calendar-outline" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.btnPrimaryApptText}>Đặt lịch ngay</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
};

interface PatientQuickStripProps {
  patients: PatientCardData[];
  activePatientId?: string;
  nowMs: number;
  isDarkMode: boolean;
  colors: any;
  onSeeAll: () => void;
  onSelectPatient: (patientId: string) => void;
}

export const PatientQuickStrip: React.FC<PatientQuickStripProps> = ({
  patients,
  activePatientId,
  nowMs,
  isDarkMode,
  colors,
  onSeeAll,
  onSelectPatient,
}) => {
  if (patients.length === 0) return null;

  return (
    <View style={[styles.patientSelectorSection, { marginTop: 14 }]}>
      <View style={styles.sectionHeaderCompact}>
        <LocalizedText style={[styles.selectorHeading, { color: colors.textPrimary }]}>
          Bệnh nhân đang theo dõi
        </LocalizedText>
        <TouchableOpacity onPress={onSeeAll}>
          <LocalizedText style={styles.seeAllText}>Tất cả ({patients.length})</LocalizedText>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.patientAvatarStrip}>
        {patients.map((p) => {
          const isSelected = p.id === activePatientId;
          const online = isPatientOnline(p, nowMs);
          const ringColor = !online ? '#CBD5E1' : p.health_status === 'DANGER' ? '#EF4444' : p.health_status === 'WARNING' ? '#F59E0B' : '#10B981';

          return (
            <TouchableOpacity
              key={p.id}
              onPress={() => onSelectPatient(p.id)}
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
      </ScrollView>
    </View>
  );
};

interface HeroHealthCardProps {
  patient: PatientCardData | null;
  nowMs: number;
  onPress: (patientId: string) => void;
}

export const HeroHealthCard: React.FC<HeroHealthCardProps> = ({ patient, nowMs, onPress }) => {
  if (!patient) return null;
  const activeOnline = isPatientOnline(patient, nowMs);
  const safetyScore = getSafetyScore(patient);
  const statusColor = !activeOnline
    ? '#94A3B8'
    : patient.health_status === 'DANGER'
      ? '#EF4444'
      : patient.health_status === 'WARNING'
        ? '#F59E0B'
        : '#34D399';
  const statusLabel = !activeOnline
    ? 'Chờ tín hiệu'
    : patient.health_status === 'DANGER'
      ? 'Nguy cấp'
      : patient.health_status === 'WARNING'
        ? 'Cần chú ý'
        : 'Sinh hiệu ổn định';

  return (
    <TouchableOpacity style={styles.heroHealthCard} activeOpacity={0.92} onPress={() => onPress(patient.id)}>
      <View style={styles.heroCardTop}>
        <View style={styles.heroScoreCircle}>
          <Text style={styles.heroScoreVal}>{safetyScore}</Text>
          <Text style={styles.heroScoreMax}>/100</Text>
        </View>

        <View style={styles.heroPatientMeta}>
          <View style={styles.heroStatusBadge}>
            <View style={[styles.heroStatusDot, { backgroundColor: statusColor }]} />
            <Text style={styles.heroStatusText}>{statusLabel}</Text>
          </View>

          <Text style={styles.heroPatientName} numberOfLines={1}>
            {patient.name} • {patient.age ? `${patient.age} tuổi` : 'Cao tuổi'}
          </Text>
          <Text style={styles.heroAddressText} numberOfLines={1}>
            {getPatientAddress(patient)}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" style={{ alignSelf: 'center' }} />
      </View>

      <View style={styles.glassPillsRow}>
        {[
          {
            icon: 'heart',
            color: activeOnline ? '#F87171' : '#CBD5E1',
            label: 'Nhịp tim',
            val: activeOnline && patient.heart_rate ? `${patient.heart_rate} bpm` : '-- bpm',
          },
          {
            icon: 'water',
            color: activeOnline ? '#67E8F9' : '#CBD5E1',
            label: 'SpO2',
            val: activeOnline && patient.spo2 ? `${patient.spo2}%` : '--%',
          },
          {
            icon: 'watch-outline',
            color: activeOnline ? '#A7F3D0' : '#CBD5E1',
            label: 'Smartband',
            val: activeOnline ? 'CooSpo HW706' : 'Chờ tín hiệu',
            isSmall: true,
          },
        ].map((pill) => (
          <View key={pill.label} style={styles.glassPill}>
            <View style={styles.pillIconRow}>
              <Ionicons name={pill.icon as any} size={14} color={pill.color} />
              <Text style={styles.glassPillLabel}>{pill.label}</Text>
            </View>
            <Text style={[styles.glassPillVal, pill.isSmall && { fontSize: 12 }]} numberOfLines={1}>
              {pill.val}
            </Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  sectionArea: { marginBottom: 16 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 14.5, fontWeight: '800' },
  seeAllText: { fontSize: 12, fontWeight: '700', color: '#2563EB' },

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

  scheduleBannerCard: {
    borderRadius: 20,
    backgroundColor: '#1D4ED8',
    overflow: 'hidden',
    position: 'relative',
    height: 156,
    minHeight: 148,
    maxHeight: 168,
    flexDirection: 'row',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  cardGradientLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(29, 78, 216, 0.95)' },
  bannerLeftContent: { flex: 1, padding: 16, zIndex: 2, justifyContent: 'center' },
  nextTagBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, alignSelf: 'flex-start', marginBottom: 6 },
  nextTagText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '700' },
  bannerPatientName: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginBottom: 2 },
  bannerReasonText: { color: 'rgba(255,255,255,0.85)', fontSize: 11.5, marginBottom: 8 },
  bannerTimeContainer: { flexDirection: 'row', alignItems: 'center' },
  bannerTimeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  bannerRightImageWrap: { width: 115, height: '100%', position: 'relative', overflow: 'hidden', flexShrink: 0 },
  doctorBannerImage: { width: 115, height: '100%' },
  imageFadeOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(29, 78, 216, 0.25)' },
  emptyCardTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', marginBottom: 2 },
  emptyCardSub: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginBottom: 10, lineHeight: 15 },
  btnWhiteAddSchedule: { backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  btnWhiteAddScheduleText: { color: '#2563EB', fontSize: 11.5, fontWeight: '700' },

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
  btnOutlineRecord: { flex: 1, paddingVertical: 7, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnOutlineRecordText: { fontSize: 11.5, fontWeight: '700', color: '#2563EB' },
  btnPrimaryAppt: { flex: 1, backgroundColor: '#2563EB', paddingVertical: 7, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  btnPrimaryApptText: { fontSize: 11.5, fontWeight: '700', color: '#FFFFFF' },

  patientSelectorSection: { marginBottom: 14 },
  sectionHeaderCompact: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  selectorHeading: { fontSize: 14, fontWeight: '800' },
  patientAvatarStrip: { gap: 10, paddingVertical: 4 },
  avatarPillItem: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: 'transparent', minWidth: 70 },
  stripAvatarRing: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: 'center', justifyContent: 'center', padding: 2, marginBottom: 6 },
  stripAvatarImg: { width: '100%', height: '100%', borderRadius: 22 },
  stripAvatarPlaceholder: { width: '100%', height: '100%', borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  stripAvatarLetter: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  stripPatientName: { fontSize: 11, fontWeight: '600' },

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
  heroScoreCircle: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(255, 255, 255, 0.18)', borderWidth: 2.5, borderColor: '#34D399', alignItems: 'center', justifyContent: 'center' },
  heroScoreVal: { color: '#FFFFFF', fontSize: 19, fontWeight: '900', lineHeight: 22 },
  heroScoreMax: { color: 'rgba(255,255,255,0.7)', fontSize: 9.5, fontWeight: '700' },
  heroPatientMeta: { flex: 1 },
  heroStatusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 4, gap: 4 },
  heroStatusDot: { width: 6, height: 6, borderRadius: 3 },
  heroStatusText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '700' },
  heroPatientName: { color: '#FFFFFF', fontSize: 15.5, fontWeight: '800' },
  heroAddressText: { color: 'rgba(255, 255, 255, 0.8)', fontSize: 11.5, marginTop: 1 },
  glassPillsRow: { flexDirection: 'row', gap: 8 },
  glassPill: { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.15)', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' },
  pillIconRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  glassPillLabel: { color: 'rgba(255, 255, 255, 0.85)', fontSize: 10, fontWeight: '600' },
  glassPillVal: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '800' },
});

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText } from '../../../i18n/LocalizedComponents';
import { AppointmentItem } from './types';

interface AppointmentCardProps {
  appointment: AppointmentItem;
  onViewPatient: (patientId: string) => void;
  onMarkCompleted: (aptId: string) => void;
  onEdit: (apt: AppointmentItem) => void;
  onDelete: (aptId: string, examType: string) => void;
  isDarkMode: boolean;
  colors: any;
}

export const AppointmentCard: React.FC<AppointmentCardProps> = ({
  appointment: apt,
  onViewPatient,
  onMarkCompleted,
  onEdit,
  onDelete,
  isDarkMode,
  colors,
}) => {
  const isUpcoming = apt.status === 'UPCOMING';
  const isCompleted = apt.status === 'COMPLETED';
  const initial = apt.patient_name.trim().split(/\s+/).slice(-1)[0][0]?.toUpperCase() || 'A';

  return (
    <View
      style={[
        styles.aptCard,
        {
          backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
          borderColor: isUpcoming ? '#3B82F655' : isCompleted ? '#10B98144' : colors.border,
        },
      ]}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.dateTagBox}>
          <Ionicons name="calendar" size={13} color="#0284C7" style={{ marginRight: 4 }} />
          <LocalizedText style={styles.dateTagText}>{apt.scheduled_at}</LocalizedText>
        </View>

        <View
          style={[
            styles.statusPill,
            { backgroundColor: isUpcoming ? '#FEF3C7' : isCompleted ? '#D1FAE5' : '#F1F5F9' },
          ]}
        >
          <LocalizedText
            style={[
              styles.statusPillText,
              { color: isUpcoming ? '#D97706' : isCompleted ? '#059669' : '#64748B' },
            ]}
          >
            {isUpcoming ? 'SẮP TỚI' : isCompleted ? 'ĐÃ KHÁM XONG' : 'ĐÃ HỦY'}
          </LocalizedText>
        </View>
      </View>

      {/* Thông tin bệnh nhân */}
      <View style={styles.patientRow}>
        <View style={styles.patientAvatar}>
          <LocalizedText style={styles.patientAvatarText}>{initial}</LocalizedText>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <LocalizedText style={[styles.patientName, { color: colors.textPrimary }]} numberOfLines={1}>
            {apt.patient_name}
          </LocalizedText>
          {apt.location ? (
            <LocalizedText
              style={[styles.aptMetaText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}
              numberOfLines={1}
            >
              {apt.location}
            </LocalizedText>
          ) : null}
        </View>
      </View>

      {/* Chuyên khoa khám */}
      <View style={styles.examTypeBox}>
        <Ionicons name="medkit" size={14} color="#0284C7" style={{ marginRight: 6 }} />
        <LocalizedText style={[styles.examTypeText, { color: colors.textPrimary }]}>
          {apt.exam_type}
        </LocalizedText>
      </View>

      {/* Dặn dò */}
      {apt.instructions ? (
        <View style={[styles.instructionsBox, { backgroundColor: isDarkMode ? '#0F172A88' : '#F8FAFC' }]}>
          <LocalizedText style={[styles.instructionsText, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>
            📝 <LocalizedText style={{ fontWeight: '700' }}>Dặn dò:</LocalizedText> {apt.instructions}
          </LocalizedText>
        </View>
      ) : null}

      {/* Nhắc nhở qua loa */}
      <View style={styles.speakerRow}>
        <View
          style={[
            styles.speakerBadge,
            apt.enable_speaker_reminder
              ? { backgroundColor: '#ECFDF5', borderColor: '#10B98144' }
              : { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' },
          ]}
        >
          <Ionicons
            name={apt.enable_speaker_reminder ? 'volume-high' : 'volume-mute'}
            size={12}
            color={apt.enable_speaker_reminder ? '#059669' : '#94A3B8'}
            style={{ marginRight: 4 }}
          />
          <LocalizedText
            style={[
              styles.speakerBadgeText,
              { color: apt.enable_speaker_reminder ? '#059669' : '#64748B' },
            ]}
          >
            {apt.enable_speaker_reminder ? 'Loa Hub nhắc trước 24h: BẬT' : 'Loa Hub: TẮT'}
          </LocalizedText>
        </View>
      </View>

      {/* Nút hành động */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.btnViewPatient}
          onPress={() => onViewPatient(apt.patient_id)}
        >
          <Ionicons name="document-text-outline" size={13} color="#0284C7" style={{ marginRight: 4 }} />
          <LocalizedText style={styles.btnViewPatientText}>Hồ sơ bệnh án</LocalizedText>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', gap: 6 }}>
          {isUpcoming && (
            <TouchableOpacity style={styles.btnComplete} onPress={() => onMarkCompleted(apt.id)}>
              <Ionicons name="checkmark" size={13} color="#FFFFFF" style={{ marginRight: 2 }} />
              <LocalizedText style={styles.btnCompleteText}>Đã khám</LocalizedText>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.btnEdit} onPress={() => onEdit(apt)}>
            <Ionicons name="pencil" size={13} color="#475569" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnDelete} onPress={() => onDelete(apt.id, apt.exam_type)}>
            <Ionicons name="trash-outline" size={13} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  aptCard: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 10,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateTagBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dateTagText: { fontSize: 11.5, fontWeight: '700', color: '#0284C7' },
  statusPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  statusPillText: { fontSize: 9.5, fontWeight: '800' },
  patientRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  patientAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientAvatarText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  patientName: { fontSize: 14.5, fontWeight: '700' },
  aptMetaText: { fontSize: 11.5, marginTop: 1 },
  examTypeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F933',
    paddingVertical: 3,
    marginBottom: 6,
  },
  examTypeText: { fontSize: 13.5, fontWeight: '700' },
  instructionsBox: { borderRadius: 8, padding: 8, marginBottom: 6 },
  instructionsText: { fontSize: 12, lineHeight: 17 },
  speakerRow: { marginBottom: 8 },
  speakerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  speakerBadgeText: { fontSize: 10.5, fontWeight: '600' },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F066',
  },
  btnViewPatient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  btnViewPatientText: { fontSize: 11, color: '#0284C7', fontWeight: '700' },
  btnComplete: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },
  btnCompleteText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  btnEdit: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDelete: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

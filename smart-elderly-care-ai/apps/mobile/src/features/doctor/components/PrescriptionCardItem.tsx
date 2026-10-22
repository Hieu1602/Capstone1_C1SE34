import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PrescriptionItem } from './types';

interface PrescriptionCardItemProps {
  prescription: PrescriptionItem;
  patientName?: string;
  onToggleSpeaker: (rxId: string) => void;
  onEdit: (rx: PrescriptionItem) => void;
  onDelete: (rxId: string, name: string) => void;
  isDarkMode: boolean;
  colors: any;
}

export const PrescriptionCardItem: React.FC<PrescriptionCardItemProps> = ({
  prescription,
  patientName,
  onToggleSpeaker,
  onEdit,
  onDelete,
  isDarkMode,
  colors,
}) => {
  return (
    <View
      style={[
        styles.rxCard,
        { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border },
      ]}
    >
      <View style={styles.rxHeader}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={[styles.rxMedName, { color: colors.textPrimary }]}>
            💊 {prescription.medication_name}
          </Text>
          <Text style={[styles.rxDosage, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            Liều lượng: {prescription.dosage} • {prescription.frequency}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.speakerToggleBtn,
            prescription.enable_speaker_reminder
              ? { backgroundColor: '#ECFDF5', borderColor: '#10B981' }
              : { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9', borderColor: '#94A3B8' },
          ]}
          onPress={() => onToggleSpeaker(prescription.id)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={prescription.enable_speaker_reminder ? 'volume-high' : 'volume-mute'}
            size={14}
            color={prescription.enable_speaker_reminder ? '#059669' : '#94A3B8'}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.speakerToggleBtnText,
              { color: prescription.enable_speaker_reminder ? '#059669' : '#64748B' },
            ]}
          >
            {prescription.enable_speaker_reminder ? 'Loa Hub: BẬT' : 'Loa Hub: TẮT'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* LỊCH GIỜ UỐNG */}
      <View style={styles.scheduleRow}>
        <Text style={[styles.scheduleLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
          Giờ nhắc uống:
        </Text>
        {(prescription.schedule_times || []).map((t: string, idx: number) => (
          <View key={idx} style={styles.timeBadge}>
            <Ionicons name="time-outline" size={12} color="#0284C7" style={{ marginRight: 2 }} />
            <Text style={styles.timeBadgeText}>{t}</Text>
          </View>
        ))}
      </View>

      {/* HƯỚNG DẪN */}
      {prescription.instructions ? (
        <Text style={[styles.instructionsText, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>
          📝 Dặn dò: {prescription.instructions}
        </Text>
      ) : null}

      {/* FOOTER & NÚT SỬA / XÓA */}
      <View style={styles.rxFooter}>
        <View style={{ flex: 1, marginRight: 8 }}>
          {patientName ? (
            <Text style={[styles.footerText, { color: isDarkMode ? '#64748B' : '#94A3B8' }]} numberOfLines={1}>
              {patientName}
            </Text>
          ) : null}
          {prescription.doctor_name ? (
            <Text style={[styles.footerDoctor, { color: isDarkMode ? '#64748B' : '#94A3B8' }]} numberOfLines={1}>
              BS: {prescription.doctor_name}
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={styles.rxEditBtn}
            onPress={() => onEdit(prescription)}
            activeOpacity={0.8}
          >
            <Ionicons name="pencil" size={13} color="#0284C7" style={{ marginRight: 4 }} />
            <Text style={styles.rxEditBtnText}>Sửa</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.rxDeleteBtn}
            onPress={() => onDelete(prescription.id, prescription.medication_name)}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={13} color="#EF4444" style={{ marginRight: 4 }} />
            <Text style={styles.rxDeleteBtnText}>Ngừng thuốc</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  rxCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
    elevation: 1,
  },
  rxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rxMedName: { fontSize: 16, fontWeight: '800' },
  rxDosage: { fontSize: 13, marginTop: 2 },
  speakerToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  speakerToggleBtnText: { fontSize: 10, fontWeight: '700' },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, flexWrap: 'wrap', gap: 6 },
  scheduleLabel: { fontSize: 12 },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  timeBadgeText: { fontSize: 11, color: '#2563EB', fontWeight: '700' },
  instructionsText: { fontSize: 13, marginTop: 8, fontStyle: 'italic', lineHeight: 18 },
  rxFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  footerText: { fontSize: 11, fontWeight: '600' },
  footerDoctor: { fontSize: 10, marginTop: 2 },
  rxEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  rxEditBtnText: { fontSize: 11, color: '#0284C7', fontWeight: '700' },
  rxDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  rxDeleteBtnText: { fontSize: 11, color: '#EF4444', fontWeight: '700' },
});

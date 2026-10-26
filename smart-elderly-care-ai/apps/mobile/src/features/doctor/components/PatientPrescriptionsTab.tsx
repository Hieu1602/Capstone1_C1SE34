import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { PrescriptionItem } from './types';

interface PatientPrescriptionsTabProps {
  prescriptions: PrescriptionItem[];
  isDarkMode: boolean;
  colors: any;
  onOpenCreatePrescription: () => void;
  onOpenEditPrescription: (rx: PrescriptionItem) => void;
  onDeletePrescription: (id: string, name: string) => void;
  onToggleSpeakerReminder: (id: string) => void;
}

export const PatientPrescriptionsTab: React.FC<PatientPrescriptionsTabProps> = ({
  prescriptions,
  isDarkMode,
  colors,
  onOpenCreatePrescription,
  onOpenEditPrescription,
  onDeletePrescription,
  onToggleSpeakerReminder,
}) => {
  return (
    <View>
      <TouchableOpacity
        style={styles.btnPrescribeNew}
        activeOpacity={0.88}
        onPress={onOpenCreatePrescription}
      >
        <Ionicons name="add-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
        <Text style={styles.btnPrescribeNewText}>Kê đơn thuốc mới cho Bệnh nhân</Text>
      </TouchableOpacity>

      {prescriptions.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="medkit-outline" size={44} color="#94A3B8" />
          <Text style={[styles.emptyHintText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            Chưa có đơn thuốc nào. Chạm nút phía trên để kê đơn.
          </Text>
        </View>
      ) : (
        prescriptions.map((rx) => (
          <View
            key={rx.id}
            style={[
              styles.rxCard,
              { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border },
            ]}
          >
            <View style={styles.rxHeader}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.rxMedName, { color: colors.textPrimary }]}>💊 {rx.medication_name}</Text>
                <Text style={[styles.rxDosage, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  {rx.dosage} • {rx.frequency}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.speakerToggleBtn,
                  rx.enable_speaker_reminder
                    ? { backgroundColor: '#ECFDF5', borderColor: '#10B981' }
                    : { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9', borderColor: '#94A3B8' },
                ]}
                onPress={() => onToggleSpeakerReminder(rx.id)}
              >
                <Ionicons
                  name={rx.enable_speaker_reminder ? 'volume-high' : 'volume-mute'}
                  size={13}
                  color={rx.enable_speaker_reminder ? '#059669' : '#94A3B8'}
                  style={{ marginRight: 3 }}
                />
                <Text
                  style={[
                    styles.speakerToggleBtnText,
                    { color: rx.enable_speaker_reminder ? '#059669' : '#64748B' },
                  ]}
                >
                  {rx.enable_speaker_reminder ? 'Loa: BẬT' : 'Loa: TẮT'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.rxScheduleRow}>
              <Text style={[styles.rxScheduleLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                Giờ uống:
              </Text>
              {(rx.schedule_times || ['08:00']).map((t, idx) => (
                <View key={idx} style={styles.timeTag}>
                  <Ionicons name="time-outline" size={11} color="#0284C7" style={{ marginRight: 2 }} />
                  <Text style={styles.timeTagText}>{t}</Text>
                </View>
              ))}
            </View>

            {rx.instructions ? (
              <Text style={[styles.rxInstructions, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>
                📝 {rx.instructions}
              </Text>
            ) : null}

            <View style={styles.rxActionRow}>
              <Text style={[styles.rxDoctorCredit, { color: isDarkMode ? '#64748B' : '#94A3B8' }]}>
                {rx.doctor_name ? `BS: ${rx.doctor_name}` : ''}
              </Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity style={styles.rxEditBtn} onPress={() => onOpenEditPrescription(rx)}>
                  <Ionicons name="pencil" size={12} color="#0284C7" style={{ marginRight: 3 }} />
                  <Text style={styles.rxEditBtnText}>Sửa</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rxDeleteBtn}
                  onPress={() => onDeletePrescription(rx.id, rx.medication_name)}
                >
                  <Ionicons name="trash-outline" size={12} color="#EF4444" style={{ marginRight: 3 }} />
                  <Text style={styles.rxDeleteBtnText}>Ngừng thuốc</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  btnPrescribeNew: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  btnPrescribeNewText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyHintText: { fontSize: 12, fontStyle: 'italic', marginVertical: 6 },

  rxCard: { borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 10 },
  rxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rxMedName: { fontSize: 14.5, fontWeight: '700' },
  rxDosage: { fontSize: 11.5, marginTop: 2 },
  speakerToggleBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  speakerToggleBtnText: { fontSize: 10, fontWeight: '700' },
  rxScheduleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  rxScheduleLabel: { fontSize: 11 },
  timeTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  timeTagText: { fontSize: 10.5, fontWeight: '700', color: '#0284C7' },
  rxInstructions: { fontSize: 11.5, marginTop: 6, lineHeight: 16 },
  rxActionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E2E8F066' },
  rxDoctorCredit: { fontSize: 11 },
  rxEditBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5, backgroundColor: '#EFF6FF' },
  rxEditBtnText: { fontSize: 11, color: '#0284C7', fontWeight: '700' },
  rxDeleteBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5, backgroundColor: '#FEE2E2' },
  rxDeleteBtnText: { fontSize: 11, color: '#EF4444', fontWeight: '700' },
});

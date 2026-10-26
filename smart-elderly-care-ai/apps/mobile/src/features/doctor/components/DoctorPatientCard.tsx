import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { LocalizedText } from '../../../i18n/LocalizedComponents';
import { PatientCardData } from './types';

interface DoctorPatientCardProps {
  patient: PatientCardData;
  onViewDetail: (patientId: string) => void;
  onViewAnalytics: (patientId: string) => void;
  isDarkMode: boolean;
  colors: any;
}

export const DoctorPatientCard: React.FC<DoctorPatientCardProps> = ({
  patient,
  onViewDetail,
  onViewAnalytics,
  isDarkMode,
  colors,
}) => {
  const isWarn = patient.health_status === 'WARNING';
  const isDanger = patient.health_status === 'DANGER';
  const initial = patient.name.trim().split(/\s+/).slice(-1)[0][0]?.toUpperCase() || 'A';

  return (
    <TouchableOpacity
      style={[
        styles.patientCard,
        {
          backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
          borderColor: isDanger ? '#EF4444' : isWarn ? '#F59E0B' : colors.border,
        },
      ]}
      activeOpacity={0.85}
      onPress={() => onViewDetail(patient.id)}
    >
      {/* Header card */}
      <View style={styles.cardHeader}>
        <View style={styles.patientAvatar}>
          <LocalizedText style={styles.patientAvatarText}>{initial}</LocalizedText>
        </View>
        <View style={styles.cardHeaderInfo}>
          <View style={styles.nameBadgeRow}>
            <LocalizedText style={[styles.patientName, { color: colors.textPrimary }]} numberOfLines={1}>
              {patient.name}
            </LocalizedText>
            <View
              style={[
                styles.statusBadge,
                isDanger
                  ? { backgroundColor: '#FEE2E2' }
                  : isWarn
                  ? { backgroundColor: '#FEF3C7' }
                  : { backgroundColor: '#D1FAE5' },
              ]}
            >
              <LocalizedText
                style={[
                  styles.statusBadgeText,
                  isDanger
                    ? { color: '#DC2626' }
                    : isWarn
                    ? { color: '#D97706' }
                    : { color: '#059669' },
                ]}
              >
                {isDanger ? 'NGUY CƠ' : isWarn ? 'CHÚ Ý' : 'ỔN ĐỊNH'}
              </LocalizedText>
            </View>
          </View>
          <LocalizedText style={[styles.patientMeta, { color: isDarkMode ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
            {patient.age} tuổi • {patient.gender} • Nhóm máu {patient.blood_type || 'O+'}
          </LocalizedText>
          <LocalizedText style={[styles.patientAddress, { color: isDarkMode ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
            🏠 {patient.house_name} • {patient.house_address}
          </LocalizedText>
          {patient.emergency_contact_phone ? (
            <LocalizedText style={[styles.patientPhone, { color: isDarkMode ? '#38BDF8' : '#0284C7' }]} numberOfLines={1}>
              📞 {patient.emergency_contact_phone}
            </LocalizedText>
          ) : null}
        </View>
      </View>

      {/* Medical History Tags */}
      {patient.medical_history ? (
        <View style={[styles.historyRow, { backgroundColor: isDarkMode ? '#33415544' : '#F1F5F9' }]}>
          <Ionicons name="medical" size={13} color="#EF4444" style={{ marginRight: 5 }} />
          <LocalizedText style={[styles.historyText, { color: isDarkMode ? '#CBD5E1' : '#475569' }]} numberOfLines={1}>
            Bệnh nền: {patient.medical_history}
          </LocalizedText>
        </View>
      ) : null}

      {/* Vitals Grid Chips */}
      <View style={styles.vitalsRow}>
        {/* Nhịp tim */}
        <View style={[styles.vitalChip, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
          <Ionicons name="heart" size={14} color="#EF4444" />
          <LocalizedText style={[styles.vitalValue, { color: colors.textPrimary }]}>
            {patient.heart_rate !== null && patient.heart_rate !== undefined ? `${patient.heart_rate} ` : '-- '}
            {patient.heart_rate !== null && patient.heart_rate !== undefined && (
              <LocalizedText style={styles.vitalUnit}>bpm</LocalizedText>
            )}
          </LocalizedText>
          <LocalizedText style={styles.vitalLabel}>Nhịp tim</LocalizedText>
        </View>

        {/* SpO2 */}
        <View style={[styles.vitalChip, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
          <Ionicons name="water" size={14} color="#0284C7" />
          <LocalizedText
            style={[
              styles.vitalValue,
              { color: patient.spo2 && patient.spo2 < 95 ? '#EA580C' : colors.textPrimary },
            ]}
          >
            {patient.spo2 !== null && patient.spo2 !== undefined ? `${patient.spo2}` : '--'}
            {patient.spo2 !== null && patient.spo2 !== undefined && (
              <LocalizedText style={styles.vitalUnit}>%</LocalizedText>
            )}
          </LocalizedText>
          <LocalizedText style={styles.vitalLabel}>SpO₂</LocalizedText>
        </View>

        {/* Nhiệt độ */}
        <View style={[styles.vitalChip, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
          <Ionicons name="thermometer" size={14} color="#F59E0B" />
          <LocalizedText style={[styles.vitalValue, { color: colors.textPrimary }]}>
            {patient.skin_temp_max !== null && patient.skin_temp_max !== undefined ? `${patient.skin_temp_max}` : '--'}
            {patient.skin_temp_max !== null && patient.skin_temp_max !== undefined && (
              <LocalizedText style={styles.vitalUnit}>°C</LocalizedText>
            )}
          </LocalizedText>
          <LocalizedText style={styles.vitalLabel}>Nhiệt độ</LocalizedText>
        </View>

        {/* Vòng đeo / Pin */}
        <View style={[styles.vitalChip, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
          <Ionicons
            name="watch"
            size={14}
            color={patient.battery_level !== null && patient.battery_level !== undefined ? "#10B981" : "#94A3B8"}
          />
          <LocalizedText
            style={[
              styles.vitalValue,
              { color: patient.battery_level !== null && patient.battery_level !== undefined ? '#10B981' : '#94A3B8' },
            ]}
          >
            {patient.battery_level !== null && patient.battery_level !== undefined ? (
              <>
                {patient.battery_level}
                <LocalizedText style={styles.vitalUnit}>%</LocalizedText>
              </>
            ) : (
              '--'
            )}
          </LocalizedText>
          <LocalizedText style={styles.vitalLabel}>Pin vòng</LocalizedText>
        </View>
      </View>

      {/* Footer action button */}
      <View style={styles.cardFooter}>
        <View style={styles.syncWrap}>
          <Ionicons name="bluetooth" size={12} color="#0284C7" style={{ marginRight: 4 }} />
          <LocalizedText
            style={[styles.updatedText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}
            numberOfLines={1}
          >
            BLE Hub • {patient.last_updated}
          </LocalizedText>
        </View>
        <View style={styles.footerActionGroup}>
          <TouchableOpacity
            style={[styles.btnMiniReport, { backgroundColor: isDarkMode ? '#334155' : '#E0F2FE' }]}
            onPress={(e) => {
              e.stopPropagation();
              onViewAnalytics(patient.id);
            }}
          >
            <Ionicons name="bar-chart-outline" size={13} color="#0284C7" style={{ marginRight: 4 }} />
            <LocalizedText style={styles.btnMiniReportText}>Báo cáo</LocalizedText>
          </TouchableOpacity>
          <View style={styles.viewDetailBtn}>
            <LocalizedText style={styles.viewDetailText}>Bệnh án</LocalizedText>
            <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  patientCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  patientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientAvatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  cardHeaderInfo: { flex: 1, marginLeft: 12 },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  patientName: { fontSize: 16, fontWeight: '800', flex: 1, marginRight: 8 },
  patientMeta: { fontSize: 12, marginTop: 1 },
  patientAddress: { fontSize: 11.5, marginTop: 3 },
  patientPhone: { fontSize: 11.5, fontWeight: '600', marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 10,
  },
  historyText: { fontSize: 11, fontWeight: '600', flex: 1 },
  vitalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 6,
  },
  vitalChip: {
    flex: 1,
    padding: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  vitalValue: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  vitalUnit: { fontSize: 10, fontWeight: '500' },
  vitalLabel: { fontSize: 10, color: '#94A3B8', marginTop: 1 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F044',
  },
  syncWrap: { flexDirection: 'row', alignItems: 'center' },
  updatedText: { fontSize: 11, fontWeight: '500' },
  footerActionGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnMiniReport: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  btnMiniReportText: { fontSize: 11.5, fontWeight: '700', color: '#0284C7' },
  viewDetailBtn: { flexDirection: 'row', alignItems: 'center' },
  viewDetailText: { fontSize: 12, fontWeight: '700', color: Colors.primary, marginRight: 2 },
});

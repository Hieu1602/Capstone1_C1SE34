import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';

interface PrescriptionHeaderStatsProps {
  prescriptionsCount: number;
  speakerCount: number;
  patientsCount: number;
  patients: any[];
  selectedPatient: any;
  onSelectPatient: (patient: any) => void;
  onAddPress: () => void;
  insetsTop: number;
  isDarkMode: boolean;
  colors: any;
}

export const PrescriptionHeaderStats: React.FC<PrescriptionHeaderStatsProps> = ({
  prescriptionsCount,
  speakerCount,
  patientsCount,
  patients,
  selectedPatient,
  onSelectPatient,
  onAddPress,
  insetsTop,
  isDarkMode,
  colors,
}) => {
  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insetsTop + 8,
          backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Quản Lý Đơn Thuốc</Text>
          <Text style={[styles.headerSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            Phác đồ điều trị & Lịch nhắc nhở y tế tự động qua Loa Hub
          </Text>
        </View>
        <TouchableOpacity style={styles.btnAddHeader} onPress={onAddPress} activeOpacity={0.85}>
          <Ionicons name="add" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* THẺ TỔNG HỢP NHANH */}
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: isDarkMode ? '#334155' : '#EFF6FF' }]}>
          <Text style={[styles.statNumber, { color: '#2563EB' }]}>{prescriptionsCount}</Text>
          <Text style={styles.statLabel} numberOfLines={1}>
            Đang kê đơn
          </Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: isDarkMode ? '#334155' : '#ECFDF5' }]}>
          <Text style={[styles.statNumber, { color: '#059669' }]}>{speakerCount}</Text>
          <Text style={styles.statLabel} numberOfLines={1}>
            Phát loa Hub
          </Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: isDarkMode ? '#334155' : '#FFFBEB' }]}>
          <Text style={[styles.statNumber, { color: '#D97706' }]}>{patientsCount}</Text>
          <Text style={styles.statLabel} numberOfLines={1}>
            Bệnh nhân
          </Text>
        </View>
      </View>

      {/* THANH CHỌN BỆNH NHÂN */}
      {patients.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          {patients.map((p) => {
            const active = selectedPatient?.id === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => onSelectPatient(p)}
                style={[
                  styles.patientPill,
                  active
                    ? { backgroundColor: '#0284C7', borderColor: '#0284C7' }
                    : { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9', borderColor: colors.border },
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.patientPillName,
                    active ? { color: '#FFFFFF', fontWeight: '700' } : { color: colors.textPrimary },
                  ]}
                >
                  {p.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  headerSub: { fontSize: 12, marginTop: 2 },
  btnAddHeader: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  statBox: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  statNumber: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 10, color: '#64748B', marginTop: 2, textAlign: 'center' },
  patientPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  patientPillName: {
    fontSize: 12,
    fontWeight: '600',
  },
});

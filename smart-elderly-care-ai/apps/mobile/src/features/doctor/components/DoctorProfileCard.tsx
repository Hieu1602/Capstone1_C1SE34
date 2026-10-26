import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DoctorProfileInfo } from './types';

interface DoctorProfileCardProps {
  info: DoctorProfileInfo;
  avatarUri: string | null;
  patientCount: number;
  appointmentCount: number;
  onPickImage: () => void;
  isDarkMode: boolean;
  colors: any;
}

export const DoctorProfileCard: React.FC<DoctorProfileCardProps> = ({
  info,
  avatarUri,
  patientCount,
  appointmentCount,
  onPickImage,
  isDarkMode,
  colors,
}) => {
  return (
    <View
      style={[
        styles.profileCard,
        { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border },
      ]}
    >
      <TouchableOpacity
        style={styles.avatarContainer}
        activeOpacity={0.85}
        onPress={onPickImage}
      >
        <View style={styles.avatarBig}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="medkit" size={38} color="#FFFFFF" />
          )}
        </View>
        <View style={styles.cameraIconBadge}>
          <Ionicons name="camera" size={13} color="#FFFFFF" />
        </View>
      </TouchableOpacity>

      <Text style={[styles.docName, { color: colors.textPrimary }]}>{info.name}</Text>
      {info.degree ? <Text style={styles.docDegree}>{info.degree}</Text> : null}
      {info.specialty ? <Text style={styles.docSpecialty}>Chuyên khoa: {info.specialty}</Text> : null}

      {info.hospital ? (
        <View style={[styles.hospitalBadge, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]}>
          <Ionicons name="business" size={13} color="#0284C7" style={{ marginRight: 5 }} />
          <Text style={[styles.hospitalBadgeText, { color: isDarkMode ? '#CBD5E1' : '#475569' }]} numberOfLines={1}>
            {info.hospital}
          </Text>
        </View>
      ) : null}

      <View style={styles.statsGrid}>
        <View style={[styles.statBox, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
          <Text style={[styles.statNum, { color: '#0284C7' }]}>{patientCount}</Text>
          <Text style={styles.statLabel}>Bệnh nhân</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
          <Text style={[styles.statNum, { color: '#8B5CF6' }]}>{appointmentCount}</Text>
          <Text style={styles.statLabel}>Lịch khám</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  profileCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 14,
    elevation: 2,
  },
  avatarContainer: { position: 'relative', marginBottom: 10 },
  avatarBig: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  cameraIconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#0284C7',
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  docName: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  docDegree: { fontSize: 12.5, color: '#0284C7', fontWeight: '700', marginTop: 2 },
  docSpecialty: { fontSize: 12, color: '#64748B', marginTop: 2 },
  hospitalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  hospitalBadgeText: { fontSize: 11.5, fontWeight: '600' },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    width: '100%',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  statNum: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, color: '#94A3B8', marginTop: 2, fontWeight: '600' },
});

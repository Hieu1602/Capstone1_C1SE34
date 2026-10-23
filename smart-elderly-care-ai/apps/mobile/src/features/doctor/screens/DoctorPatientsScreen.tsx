// DoctorPatientsScreen.tsx
// Danh sách bệnh nhân người cao tuổi phụ trách dành cho Bác sĩ gia đình

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, StatusBar, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { Colors } from '../../../theme/colors';
import { useTheme } from '../../../store/useThemeStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { doctorApi } from '../../../services/api';
import { LocalizedText } from '../../../i18n/LocalizedComponents';
import AdminMarqueeBanner from '../../../components/AdminMarqueeBanner';

import {
  PatientCardData,
  DoctorPatientsHeader,
  DoctorPatientCard,
} from '../components';

export type { PatientCardData };

export default function DoctorPatientsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { isDarkMode, colors } = useTheme();
  const { userName } = useAuthStore();

  const [patients, setPatients] = useState<PatientCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'WARNING' | 'NORMAL'>('ALL');

  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      const res = await doctorApi.getPatients();
      if (res.data && Array.isArray(res.data)) {
        setPatients(res.data);
      }
    } catch {
      // Giữ dữ liệu hiện tại khi mất kết nối mạng
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  useFocusEffect(
    useCallback(() => {
      fetchPatients();
    }, [fetchPatients])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchPatients();
  };

  const filteredPatients = patients.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length > 0) {
      const cleanQ = q.replace(/[^0-9]/g, '');
      const cleanPhone = (p.emergency_contact_phone || '').replace(/[^0-9]/g, '');

      const matchesName = p.name.toLowerCase().includes(q);
      const matchesPhone = cleanQ.length > 0 && cleanPhone.includes(cleanQ);

      if (!matchesName && !matchesPhone) return false;
    }

    if (filterTab === 'WARNING') return p.health_status === 'WARNING' || p.health_status === 'DANGER';
    if (filterTab === 'NORMAL') return p.health_status === 'NORMAL';
    return true;
  });

  const totalPatients = patients.length;
  const warningCount = patients.filter(
    (p) => p.health_status === 'WARNING' || p.health_status === 'DANGER'
  ).length;

  const handleViewDetail = (patientId: string) => {
    navigation.navigate('DoctorPatientDetail', { patientId });
  };

  const handleViewAnalytics = (patientId: string) => {
    navigation.navigate('DoctorAnalytics', { patientId });
  };

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Top Doctor Header */}
      <DoctorPatientsHeader
        insets={insets}
        userName={userName}
        totalPatients={totalPatients}
        warningCount={warningCount}
        searchQuery={searchQuery}
        filterTab={filterTab}
        onChangeSearch={setSearchQuery}
        onChangeFilter={setFilterTab}
        onRefresh={onRefresh}
        isDarkMode={isDarkMode}
        colors={colors}
      />

      {/* Thanh thông báo chạy chữ từ Admin (dành cho Bác sĩ) */}
      <AdminMarqueeBanner targetAudience="doctors" />

      {/* Patient Cards List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {loading && !refreshing && (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 20 }} />
        )}

        {filteredPatients.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="people-outline" size={48} color="#94A3B8" />
            <LocalizedText style={[styles.emptyText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Không tìm thấy hồ sơ người cao tuổi nào.
            </LocalizedText>
          </View>
        ) : (
          filteredPatients.map((patient) => (
            <DoctorPatientCard
              key={patient.id}
              patient={patient}
              onViewDetail={handleViewDetail}
              onViewAnalytics={handleViewAnalytics}
              isDarkMode={isDarkMode}
              colors={colors}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 95 },
  emptyBox: { alignItems: 'center', marginTop: 40 },
  emptyText: { marginTop: 12, fontSize: 14 },
});

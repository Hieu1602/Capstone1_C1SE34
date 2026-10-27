// DoctorPatientsScreen.tsx
// Danh sách bệnh nhân người cao tuổi phụ trách - Bố cục Card lưới (Grid Layout) 2 cột kèm Skeleton Loading

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  StatusBar,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { Colors } from '../../../theme/colors';
import { useTheme } from '../../../store/useThemeStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { doctorApi } from '../../../services/api';
import { LocalizedAlert, LocalizedText } from '../../../i18n/LocalizedComponents';
import AdminMarqueeBanner from '../../../components/AdminMarqueeBanner';

import {
  PatientCardData,
  DoctorPatientsHeader,
  DoctorPatientCard,
  AppointmentFormModal,
} from '../components';
import { normalizePatientsList } from './DoctorHomeScreen';

export type { PatientCardData };

// Component Skeleton Loading cho Card lưới 2 cột
const GridSkeletonCard = ({ isDarkMode }: { isDarkMode: boolean }) => {
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        styles.skeletonCard,
        {
          backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
          borderColor: isDarkMode ? '#334155' : '#E2E8F0',
          opacity: pulseAnim,
        },
      ]}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: isDarkMode ? '#334155' : '#E2E8F0',
          marginBottom: 12,
        }}
      />
      <View
        style={{
          width: '75%',
          height: 15,
          borderRadius: 6,
          backgroundColor: isDarkMode ? '#334155' : '#E2E8F0',
          marginBottom: 8,
        }}
      />
      <View
        style={{
          width: '55%',
          height: 12,
          borderRadius: 4,
          backgroundColor: isDarkMode ? '#334155' : '#F1F5F9',
          marginBottom: 16,
        }}
      />
      <View
        style={{
          width: '90%',
          height: 32,
          borderRadius: 8,
          backgroundColor: isDarkMode ? '#334155' : '#E0F2FE',
        }}
      />
    </Animated.View>
  );
};

export default function DoctorPatientsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { isDarkMode, colors } = useTheme();
  const { userName } = useAuthStore();

  const [patients, setPatients] = useState<PatientCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'WARNING' | 'NORMAL'>('ALL');

  // Modal Đặt lịch hẹn nhanh cho bệnh nhân từ Card
  const [appointmentModalVisible, setAppointmentModalVisible] = useState(false);
  const [selectedPatientForApt, setSelectedPatientForApt] = useState<PatientCardData | null>(null);
  const [scheduledAt, setScheduledAt] = useState('');
  const [examType, setExamType] = useState('Khám định kỳ');
  const [visitType, setVisitType] = useState<'HOME_VISIT' | 'CLINIC'>('HOME_VISIT');
  const [location, setLocation] = useState('');
  const [instructions, setInstructions] = useState('');
  const [enableSpeaker, setEnableSpeaker] = useState(true);
  const [recurrencePattern, setRecurrencePattern] = useState<'NONE' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY'>('NONE');
  const [recurrenceOccurrences, setRecurrenceOccurrences] = useState(1);
  const [isSubmittingApt, setIsSubmittingApt] = useState(false);

  const fetchPatients = useCallback(async () => {
    try {
      const res = await doctorApi.getPatients();
      setPatients(normalizePatientsList(res.data));
    } catch {
      setPatients(normalizePatientsList([]));
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

  const handleOpenAppointmentModal = (patient: PatientCardData) => {
    setSelectedPatientForApt(patient);
    const d = new Date();
    d.setHours(d.getHours() + 2);
    setScheduledAt(d.toISOString().slice(0, 16));
    setLocation(patient.house_address || patient.house_name || 'Khám tại nhà');
    setAppointmentModalVisible(true);
  };

  const handleSaveAppointment = async () => {
    if (!selectedPatientForApt) return;
    try {
      setIsSubmittingApt(true);
      await doctorApi.createAppointment({
        patient_id: selectedPatientForApt.id,
        patient_name: selectedPatientForApt.name,
        scheduled_at: scheduledAt,
        visit_type: visitType,
        location: location,
        clinical_notes: examType,
        instructions: instructions,
        enable_speaker_reminder: enableSpeaker,
        recurrence_pattern: recurrencePattern,
        recurrence_occurrences: recurrenceOccurrences,
      });
      setAppointmentModalVisible(false);
      LocalizedAlert.alert('Thành công', 'Đã tạo lịch khám thành công cho bệnh nhân!');
    } catch {
      LocalizedAlert.alert('Lỗi', 'Không thể tạo lịch khám. Vui lòng thử lại sau.');
    } finally {
      setIsSubmittingApt(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Top Doctor Header & Toolbar */}
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

      {/* Trạng thái chờ: Skeleton Loading dạng lưới 2 cột */}
      {loading && !refreshing ? (
        <View style={styles.skeletonGridWrapper}>
          <View style={styles.columnWrapper}>
            <GridSkeletonCard isDarkMode={isDarkMode} />
            <GridSkeletonCard isDarkMode={isDarkMode} />
          </View>
          <View style={styles.columnWrapper}>
            <GridSkeletonCard isDarkMode={isDarkMode} />
            <GridSkeletonCard isDarkMode={isDarkMode} />
          </View>
        </View>
      ) : (
        /* Danh sách bệnh nhân dạng lưới (Grid 2 cột) */
        <FlatList
          data={filteredPatients}
          keyExtractor={(item) => item.id.toString()}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="people-outline" size={48} color="#94A3B8" />
              <LocalizedText style={[styles.emptyText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                Không tìm thấy hồ sơ bệnh nhân nào phù hợp.
              </LocalizedText>
            </View>
          }
          renderItem={({ item }) => (
            <DoctorPatientCard
              patient={item}
              onViewDetail={handleViewDetail}
              onViewAnalytics={handleViewAnalytics}
              onBookAppointment={handleOpenAppointmentModal}
              isDarkMode={isDarkMode}
              colors={colors}
            />
          )}
        />
      )}

      {/* Modal Đặt lịch hẹn nhanh từ Card Bệnh nhân */}
      {selectedPatientForApt && (
        <AppointmentFormModal
          visible={appointmentModalVisible}
          onClose={() => setAppointmentModalVisible(false)}
          onSave={handleSaveAppointment}
          isEditing={false}
          patientId={selectedPatientForApt.id}
          patientName={selectedPatientForApt.name}
          onChangePatientName={() => {}}
          scheduledAt={scheduledAt}
          onChangeScheduledAt={setScheduledAt}
          examType={examType}
          onChangeExamType={setExamType}
          visitType={visitType}
          onChangeVisitType={setVisitType}
          location={location}
          onChangeLocation={setLocation}
          instructions={instructions}
          onChangeInstructions={setInstructions}
          enableSpeaker={enableSpeaker}
          onToggleEnableSpeaker={setEnableSpeaker}
          recurrencePattern={recurrencePattern}
          onChangeRecurrencePattern={setRecurrencePattern}
          recurrenceOccurrences={recurrenceOccurrences}
          onChangeRecurrenceOccurrences={setRecurrenceOccurrences}
          isSubmitting={isSubmittingApt}
          patients={patients}
          isDarkMode={isDarkMode}
          colors={colors}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: {
    padding: 12,
    paddingBottom: 95,
  },
  skeletonGridWrapper: {
    padding: 12,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  skeletonCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    marginHorizontal: 4,
    marginBottom: 12,
  },
  emptyBox: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
  },
});

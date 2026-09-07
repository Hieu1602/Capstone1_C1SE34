// RealtimeDashboardScreen.tsx
// Màn hình chính – Theo dõi chỉ số sinh hiệu thời gian thực

import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import VitalCard from '../components/VitalCard';
import HeartRateChart from '../components/HeartRateChart';
import { vitalsWS } from '../../../services/websocket';
import type { VitalPayload } from '../../../services/websocket';
import { useVitalStore } from '../../../store/useVitalStore';

export default function RealtimeDashboardScreen() {
  const { currentVitals, setVitals, activeDevice, isConnected, setConnected } =
    useVitalStore();
  const [refreshing, setRefreshing] = React.useState(false);

  // ---- WebSocket connection ----
  useEffect(() => {
    const deviceId = activeDevice?.device_id ?? 'hub-001';

    vitalsWS.connect(deviceId);
    setConnected(true);

    const unsub = vitalsWS.subscribe((data: VitalPayload) => {
      setVitals({
        heart_rate:    data.heart_rate ?? null,
        spo2:          data.spo2 ?? null,
        skin_temp_max: data.skin_temp_max ?? null,
        person_count:  data.person_count ?? null,
        fall_detected: data.fall_detected ?? false,
        timestamp:     data.timestamp,
      });
    });

    return () => {
      unsub();
      vitalsWS.disconnect();
      setConnected(false);
    };
  }, [activeDevice?.device_id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // TODO: Fetch latest from REST API
    window.setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const getAlertColor = (hr: number | null, spo2: number | null): string => {
    if (spo2 !== null && spo2 < 90) return '#EF4444';
    if (hr !== null && (hr > 120 || hr < 50)) return '#F97316';
    return '#22C55E';
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Theo dõi sức khỏe</Text>
        <View style={[styles.statusDot, { backgroundColor: isConnected ? '#22C55E' : '#6B7280' }]} />
        <Text style={styles.statusText}>{isConnected ? 'Trực tiếp' : 'Ngoại tuyến'}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />}
      >
        {/* Fall Alert Banner */}
        {currentVitals.fall_detected && (
          <View style={styles.alertBanner}>
            <Text style={styles.alertBannerText}>🚨 PHÁT HIỆN TÉ NGÃ!</Text>
          </View>
        )}

        {/* Vital Cards Grid */}
        <View style={styles.grid}>
          <VitalCard
            icon="heart"
            label="Nhịp tim"
            value={currentVitals.heart_rate}
            unit="bpm"
            normalRange={{ min: 60, max: 100 }}
            color="#EF4444"
          />
          <VitalCard
            icon="water"
            label="SpO₂"
            value={currentVitals.spo2}
            unit="%"
            normalRange={{ min: 95, max: 100 }}
            color="#3B82F6"
          />
          <VitalCard
            icon="thermometer"
            label="Nhiệt độ da"
            value={currentVitals.skin_temp_max}
            unit="°C"
            normalRange={{ min: 35, max: 38 }}
            color="#F97316"
            decimals={1}
          />
          <VitalCard
            icon="person"
            label="Phát hiện người"
            value={currentVitals.person_count}
            unit="người"
            color="#8B5CF6"
          />
        </View>

        {/* Heart Rate Chart */}
        <View style={styles.chartSection}>
          <Text style={styles.sectionTitle}>Biểu đồ nhịp tim (24h)</Text>
          <HeartRateChart />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitle: { flex: 1, color: '#F8FAFC', fontSize: 20, fontWeight: '700' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { color: '#94A3B8', fontSize: 13 },
  content: { padding: 16, paddingBottom: 32 },
  alertBanner: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  alertBannerText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  chartSection: { marginTop: 24 },
  sectionTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '600', marginBottom: 12 },
});

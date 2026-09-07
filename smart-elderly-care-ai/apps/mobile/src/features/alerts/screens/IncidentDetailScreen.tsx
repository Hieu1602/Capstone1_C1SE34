// IncidentDetailScreen.tsx
// Màn hình chi tiết sự kiện cảnh báo – Xem thông tin và clip video 5 giây

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
let Video: any = null;
if (Platform.OS !== 'web') {
  try {
    Video = require('react-native-video').default;
  } catch (e) {}
}

import { incidentsApi } from '../../../services/api';

interface Incident {
  id: string;
  alert_type: string;
  alert_level: string;
  message: string;
  confidence: number;
  video_clip_url: string | null;
  is_acknowledged: boolean;
  created_at: string;
}

const LEVEL_COLORS: Record<string, string> = {
  CRITICAL: '#EF4444',
  HIGH:     '#F97316',
  MEDIUM:   '#EAB308',
  LOW:      '#22C55E',
};

const ALERT_TYPE_LABELS: Record<string, string> = {
  FALL_DETECTED:    '🤸 Phát hiện té ngã',
  ABNORMAL_HR:      '💓 Nhịp tim bất thường',
  LOW_SPO2:         '💨 SpO₂ thấp',
  HIGH_TEMPERATURE: '🌡️ Nhiệt độ cao',
  EMERGENCY_SOUND:  '📢 Âm thanh khẩn cấp',
  INACTIVITY:       '⏱️ Không có hoạt động',
};

export default function IncidentDetailScreen({ route, navigation }: any) {
  const { incidentId } = route.params ?? {};
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (incidentId) fetchIncident();
  }, [incidentId]);

  const fetchIncident = async () => {
    try {
      const res = await incidentsApi.get(incidentId);
      setIncident(res.data);
    } catch {
      // Mock data
      setIncident({
        id: incidentId,
        alert_type: 'FALL_DETECTED',
        alert_level: 'CRITICAL',
        message: 'Phát hiện té ngã! Xác nhận bởi: camera_ai, audio_ai',
        confidence: 0.92,
        video_clip_url: null,
        is_acknowledged: false,
        created_at: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!incident) return;
    Alert.prompt(
      'Xác nhận xử lý',
      'Ghi chú (tuỳ chọn):',
      async (notes: string | undefined) => {
        await incidentsApi.acknowledge(incident.id, notes ?? '');
        setIncident({ ...incident, is_acknowledged: true });
      },
      'plain-text',
    );
  };

  if (!incident || loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Đang tải...</Text>
      </SafeAreaView>
    );
  }

  const levelColor = LEVEL_COLORS[incident.alert_level] ?? '#64748B';
  const typeLabel  = ALERT_TYPE_LABELS[incident.alert_type] ?? incident.alert_type;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết sự kiện</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Alert Level Badge */}
        <View style={[styles.levelBadge, { backgroundColor: `${levelColor}20`, borderColor: levelColor }]}>
          <Text style={[styles.levelText, { color: levelColor }]}>
            {incident.alert_level}
          </Text>
        </View>

        {/* Type & Message */}
        <Text style={styles.typeLabel}>{typeLabel}</Text>
        <Text style={styles.message}>{incident.message}</Text>

        {/* Confidence */}
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Độ tin cậy</Text>
          <Text style={styles.rowValue}>{(incident.confidence * 100).toFixed(0)}%</Text>
        </View>

        {/* Timestamp */}
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Thời gian</Text>
          <Text style={styles.rowValue}>
            {new Date(incident.created_at).toLocaleString('vi-VN')}
          </Text>
        </View>

        {/* Video Clip */}
        {incident.video_clip_url ? (
          <View style={styles.videoSection}>
            <Text style={styles.sectionTitle}>Video bằng chứng (5 giây)</Text>
            {Platform.OS === 'web' || !Video ? (
              <video
                src={incident.video_clip_url}
                style={{ width: '100%', height: 220, borderRadius: 12, backgroundColor: '#000' }}
                controls
              />
            ) : (
              <Video
                source={{ uri: incident.video_clip_url }}
                style={styles.video}
                controls
                resizeMode="contain"
                paused={false}
              />
            )}
          </View>
        ) : (
          <View style={styles.noVideo}>
            <Ionicons name="videocam-off" size={36} color="#475569" />
            <Text style={styles.noVideoText}>Clip chưa có sẵn</Text>
          </View>
        )}

        {/* Acknowledge Button */}
        {!incident.is_acknowledged ? (
          <TouchableOpacity style={styles.ackBtn} onPress={handleAcknowledge}>
            <Ionicons name="checkmark-circle" size={20} color="#FFF" />
            <Text style={styles.ackBtnText}>Đánh dấu đã xử lý</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.ackConfirm}>
            <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
            <Text style={styles.ackConfirmText}>Đã được xử lý</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backBtn: { marginRight: 12 },
  headerTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' },
  content: { padding: 20, gap: 16 },
  loadingText: { color: '#94A3B8', textAlign: 'center', marginTop: 100 },
  levelBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  levelText: { fontWeight: '700', fontSize: 14 },
  typeLabel: { color: '#F8FAFC', fontSize: 22, fontWeight: '700' },
  message:   { color: '#94A3B8', fontSize: 15, lineHeight: 22 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { color: '#64748B', fontSize: 14 },
  rowValue:  { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  videoSection: { gap: 8 },
  sectionTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '600' },
  video: { width: '100%', height: 220, borderRadius: 12, backgroundColor: '#000' },
  noVideo: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 32,
  },
  noVideoText: { color: '#475569', fontSize: 14 },
  ackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 8,
  },
  ackBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  ackConfirm: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  ackConfirmText: { color: '#22C55E', fontWeight: '600', fontSize: 15 },
});

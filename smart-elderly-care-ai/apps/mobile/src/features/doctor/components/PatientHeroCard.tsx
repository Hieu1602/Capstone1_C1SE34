import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BASE_URL } from '../../../services/api';
import { PatientDetail } from './types';

interface PatientHeroCardProps {
  detail: PatientDetail | null;
  isDarkMode: boolean;
  colors: any;
  onViewAnalytics: () => void;
}

export const PatientHeroCard: React.FC<PatientHeroCardProps> = ({
  detail,
  isDarkMode,
  colors,
  onViewAnalytics,
}) => {
  const patientName = detail?.name || 'Bệnh nhân';
  const initialLetter = patientName.trim().split(/\s+/).slice(-1)[0]?.[0]?.toUpperCase() || 'A';

  const metaParts = [
    detail?.age ? `${detail.age} tuổi` : null,
    detail?.gender ? detail.gender : null,
    detail?.blood_type ? `Nhóm máu ${detail.blood_type}` : null,
    detail?.bmi ? `BMI: ${detail.bmi}` : null,
  ].filter(Boolean);

  return (
    <View style={[styles.heroCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
      <View style={styles.heroRow}>
        <View style={styles.avatarBig}>
          {detail?.avatar_url ? (
            <Image
              source={{
                uri: detail.avatar_url.startsWith('http')
                  ? detail.avatar_url
                  : `${BASE_URL.replace('/api/v1', '')}${detail.avatar_url}`,
              }}
              style={styles.avatarBigImg}
            />
          ) : (
            <Text style={styles.avatarBigText}>{initialLetter}</Text>
          )}
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={styles.heroNameRow}>
            <Text style={[styles.heroName, { color: colors.textPrimary }]} numberOfLines={1}>
              {patientName}
            </Text>
            {detail?.age ? (
              <View style={styles.badgeAge}>
                <Text style={styles.badgeAgeText}>{detail.age} tuổi</Text>
              </View>
            ) : null}
          </View>

          {metaParts.length > 0 ? (
            <Text style={[styles.heroSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
              {metaParts.join(' • ')}
            </Text>
          ) : null}

          {detail?.house_name || detail?.house_address ? (
            <Text style={[styles.heroAddress, { color: isDarkMode ? '#CBD5E1' : '#475569' }]} numberOfLines={1}>
              📍 {[detail?.house_name, detail?.house_address].filter(Boolean).join(' • ')}
            </Text>
          ) : null}

          {/* Huy hiệu Face ID */}
          <View style={styles.faceIdPillRow}>
            <View
              style={[
                styles.faceIdPill,
                detail?.has_face_enrolled
                  ? { backgroundColor: isDarkMode ? '#064E3B' : '#DCFCE7', borderColor: '#10B981' }
                  : { backgroundColor: isDarkMode ? '#451A03' : '#FEF3C7', borderColor: '#F59E0B' },
              ]}
            >
              <Ionicons
                name={detail?.has_face_enrolled ? 'scan-circle' : 'scan-outline'}
                size={12}
                color={detail?.has_face_enrolled ? '#10B981' : '#F59E0B'}
              />
              <Text style={[styles.faceIdPillText, { color: detail?.has_face_enrolled ? '#047857' : '#B45309' }]}>
                {detail?.has_face_enrolled ? 'AI Face ID: Đã đăng ký' : 'Khuôn mặt: Chưa đăng ký'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Dải 4 sinh hiệu tức thời */}
      <View style={styles.metricsBar}>
        <View style={styles.metricItem}>
          <Text style={[styles.metricVal, { color: '#EF4444' }]}>
            {detail?.heart_rate ?? '--'} <Text style={styles.metricUnit}>bpm</Text>
          </Text>
          <Text style={styles.metricLabel}>Nhịp tim</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={[styles.metricVal, { color: '#0284C7' }]}>
            {detail?.spo2 ? `${detail.spo2}%` : '--'}
          </Text>
          <Text style={styles.metricLabel}>SpO₂</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={[styles.metricVal, { color: '#10B981' }]}>
            {detail?.blood_pressure || '--'}
          </Text>
          <Text style={styles.metricLabel}>Huyết áp</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={[styles.metricVal, { color: '#F59E0B' }]}>
            {detail?.skin_temp_max ? `${detail.skin_temp_max}°C` : '--'}
          </Text>
          <Text style={styles.metricLabel}>Nhiệt độ</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.heroReportBtn, { backgroundColor: isDarkMode ? '#0284C722' : '#E0F2FE' }]}
        activeOpacity={0.85}
        onPress={onViewAnalytics}
      >
        <Ionicons name="bar-chart" size={15} color="#0284C7" style={{ marginRight: 6 }} />
        <Text style={styles.heroReportBtnText}>Xem Báo Cáo & Phân Tích Sinh Hiệu</Text>
        <Ionicons name="chevron-forward" size={14} color="#0284C7" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    elevation: 2,
    marginBottom: 14,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  avatarBig: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarBigImg: { width: '100%', height: '100%' },
  avatarBigText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroName: { fontSize: 16.5, fontWeight: '800', flex: 1, marginRight: 6 },
  badgeAge: { backgroundColor: '#F1F5F9', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  badgeAgeText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  heroSub: { fontSize: 11.5, marginTop: 2 },
  heroAddress: { fontSize: 11, marginTop: 2 },
  faceIdPillRow: { flexDirection: 'row', marginTop: 6 },
  faceIdPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, borderWidth: 1, gap: 4 },
  faceIdPillText: { fontSize: 10, fontWeight: '700' },

  metricsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC33',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 12,
  },
  metricItem: { flex: 1, alignItems: 'center' },
  metricVal: { fontSize: 14, fontWeight: '800' },
  metricUnit: { fontSize: 10, fontWeight: '400' },
  metricLabel: { fontSize: 10, color: '#94A3B8', marginTop: 1 },
  metricDivider: { width: 1, height: 24, backgroundColor: '#CBD5E1' },

  heroReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  heroReportBtnText: { fontSize: 12.5, fontWeight: '700', color: '#0284C7' },
});

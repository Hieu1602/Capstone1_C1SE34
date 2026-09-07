// AlertsListScreen.tsx – Danh sách cảnh báo sự kiện & Báo động khẩn cấp
// Bám sát phong cách Light Theme Smart Home và yêu cầu Proposal (FR07, FR08, FR10)

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { useVitalStore } from '../../../store/useVitalStore';

const LEVEL_COLORS: Record<string, string> = {
  CRITICAL: '#EF4444',
  HIGH: '#F97316',
  MEDIUM: '#F59E0B',
  LOW: '#10B981',
};

export default function AlertsListScreen({ navigation }: any) {
  const { incidents } = useVitalStore();
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | 'CRITICAL' | 'VITAL'>('ALL');

  const filteredIncidents = incidents.filter((item) => {
    if (filterType === 'CRITICAL') return item.alert_level === 'CRITICAL';
    if (filterType === 'VITAL') return item.alert_type.includes('HEART') || item.alert_type.includes('SPO2');
    return true;
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.topHeader}>
        <Text style={styles.headerTitle}>Thông Báo &amp; Sự Kiện</Text>
        <TouchableOpacity
          style={styles.sosQuickBtn}
          onPress={() => navigation.navigate('CameraDetail')}
        >
          <Ionicons name="videocam" size={18} color="#FFF" />
          <Text style={styles.sosQuickText}>Camera</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterPill, filterType === 'ALL' && styles.filterPillActive]}
          onPress={() => setFilterType('ALL')}
        >
          <Text style={[styles.filterText, filterType === 'ALL' && styles.filterTextActive]}>
            Tất cả ({incidents.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterPill, filterType === 'CRITICAL' && styles.filterPillActive]}
          onPress={() => setFilterType('CRITICAL')}
        >
          <Text style={[styles.filterText, filterType === 'CRITICAL' && styles.filterTextActive]}>
            🚨 Nguy kịch (Red Alert)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterPill, filterType === 'VITAL' && styles.filterPillActive]}
          onPress={() => setFilterType('VITAL')}
        >
          <Text style={[styles.filterText, filterType === 'VITAL' && styles.filterTextActive]}>
            Sinh hiệu
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredIncidents}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setTimeout(() => setRefreshing(false), 800);
            }}
            tintColor={Colors.primary}
          />
        }
        renderItem={({ item }) => {
          const isCritical = item.alert_level === 'CRITICAL';
          const isFall = item.alert_type === 'FALL_DETECTED';

          return (
            <TouchableOpacity
              style={[styles.card, isFall && styles.cardCritical]}
              onPress={() => {
                if (item.video_clip_url) {
                  navigation.navigate('CameraDetail');
                } else {
                  navigation.navigate('IncidentDetail', { incidentId: item.id });
                }
              }}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.dot,
                  { backgroundColor: LEVEL_COLORS[item.alert_level] ?? Colors.primary },
                ]}
              />

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.cardTitle}>
                    {item.alert_type.replace(/_/g, ' ')}
                  </Text>
                  {!item.is_acknowledged && (
                    <View style={styles.newBadge}>
                      <Text style={styles.newBadgeText}>MỚI</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.cardMsg} numberOfLines={2}>
                  {item.message}
                </Text>
                <Text style={styles.cardTime}>
                  {new Date(item.created_at).toLocaleString('vi-VN')}
                </Text>
              </View>

              {item.thumbnail_url && (
                <View style={styles.thumbWrapper}>
                  <Image source={{ uri: item.thumbnail_url }} style={styles.thumbImg} />
                  {item.video_clip_url && (
                    <View style={styles.playTag}>
                      <Ionicons name="play" size={10} color="#FFF" />
                      <Text style={styles.playTagText}>5s Clip</Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="shield-checkmark-outline" size={48} color="#94A3B8" />
            <Text style={styles.emptyText}>Không có cảnh báo bất thường nào</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  sosQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  sosQuickText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterPillActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...Shadows.card,
  },
  cardCritical: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  newBadge: {
    backgroundColor: Colors.danger,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  newBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
  },
  cardMsg: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
    lineHeight: 18,
  },
  cardTime: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  thumbWrapper: {
    width: 64,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  playTag: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    gap: 2,
  },
  playTagText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '700',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});

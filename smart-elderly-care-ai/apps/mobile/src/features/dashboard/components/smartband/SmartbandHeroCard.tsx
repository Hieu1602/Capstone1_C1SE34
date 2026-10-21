import React from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Shadows } from '../../../../theme/colors';
import { LocalizedText } from '../../../../i18n/LocalizedComponents';

interface SmartbandHeroCardProps {
  pulseAnim: Animated.Value;
  deviceParam?: any;
  isSyncing: boolean;
  isFinding: boolean;
  onSyncNow: () => void;
  onFindBand: () => void;
  colors?: any;
  isDarkMode?: boolean;
}

export const SmartbandHeroCard: React.FC<SmartbandHeroCardProps> = ({
  pulseAnim,
  deviceParam,
  isSyncing,
  isFinding,
  onSyncNow,
  onFindBand,
  colors = {},
  isDarkMode = false,
}) => {
  return (
    <View style={[styles.heroCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.heroTopRow}>
        {/* Vòng tròn biểu tượng Vòng đeo tay */}
        <View style={styles.watchIconWrapper}>
          <Animated.View
            style={[
              styles.watchIconPulseRing,
              { transform: [{ scale: pulseAnim }] },
            ]}
          />
          <View style={styles.watchIconCenter}>
            <Ionicons name="watch" size={36} color="#10B981" />
          </View>
        </View>

        {/* Thông tin thiết bị */}
        <View style={styles.heroInfoColumn}>
          <View style={styles.modelBadgeRow}>
            <LocalizedText style={[styles.modelNameText, isDarkMode && { color: colors.textPrimary }]}>
              BLE Smartband FR01
            </LocalizedText>
            <View style={styles.medicalBadge}>
              <LocalizedText style={styles.medicalBadgeText}>Y TẾ</LocalizedText>
            </View>
          </View>

          <LocalizedText style={[styles.wearerInfoText, isDarkMode && { color: colors.textSecondary }]}>
            <Ionicons name="person" size={14} color="#64748B" /> Người đeo:{' '}
            <LocalizedText style={{ fontWeight: '700', color: colors.textPrimary }}>Cụ Ông (78 tuổi)</LocalizedText>
          </LocalizedText>

          <LocalizedText style={[styles.locationInfoText, isDarkMode && { color: colors.textSecondary }]}>
            <Ionicons name="location" size={14} color="#64748B" /> Vị trí:{' '}
            <LocalizedText style={{ fontWeight: '600', color: colors.textSecondary }}>
              {deviceParam?.location || 'Phòng ngủ'}
            </LocalizedText>
          </LocalizedText>

          {/* Trạng thái tiếp xúc da */}
          <View style={styles.skinContactBadge}>
            <Ionicons name="checkmark-circle" size={15} color="#059669" />
            <LocalizedText style={styles.skinContactText}>Đang đeo trên cổ tay (Tiếp xúc da tốt)</LocalizedText>
          </View>
        </View>
      </View>

      <View style={[styles.heroDivider, isDarkMode && { backgroundColor: colors.border }]} />

      {/* Hàng 4 thông số kỹ thuật nhanh */}
      <View style={styles.specsQuickGrid}>
        <View style={styles.specQuickItem}>
          <View style={[styles.specQuickIconBox, isDarkMode && { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
            <Ionicons name="battery-charging" size={18} color="#10B981" />
          </View>
          <LocalizedText style={[styles.specQuickVal, isDarkMode && { color: colors.textPrimary }]}>84%</LocalizedText>
          <LocalizedText style={[styles.specQuickLabel, isDarkMode && { color: colors.textSecondary }]}>Pin (~5 ngày)</LocalizedText>
        </View>

        <View style={styles.specQuickItem}>
          <View style={[styles.specQuickIconBox, isDarkMode && { backgroundColor: 'rgba(2, 132, 199, 0.15)' }]}>
            <Ionicons name="bluetooth" size={18} color="#0284C7" />
          </View>
          <LocalizedText style={[styles.specQuickVal, isDarkMode && { color: colors.textPrimary }]}>BLE 5.0</LocalizedText>
          <LocalizedText style={[styles.specQuickLabel, isDarkMode && { color: colors.textSecondary }]}>GATT Active</LocalizedText>
        </View>

        <View style={styles.specQuickItem}>
          <View style={[styles.specQuickIconBox, isDarkMode && { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
            <Ionicons name="wifi" size={18} color="#8B5CF6" />
          </View>
          <LocalizedText style={[styles.specQuickVal, isDarkMode && { color: colors.textPrimary }]}>-58 dBm</LocalizedText>
          <LocalizedText style={[styles.specQuickLabel, isDarkMode && { color: colors.textSecondary }]}>Sóng rất tốt</LocalizedText>
        </View>

        <View style={styles.specQuickItem}>
          <View style={[styles.specQuickIconBox, isDarkMode && { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
            <Ionicons name="finger-print" size={18} color="#F59E0B" />
          </View>
          <LocalizedText style={[styles.specQuickVal, isDarkMode && { color: colors.textPrimary }]}>88:2A:9C</LocalizedText>
          <LocalizedText style={[styles.specQuickLabel, isDarkMode && { color: colors.textSecondary }]}>MAC ID</LocalizedText>
        </View>
      </View>

      {/* 2 Nút hành động nhanh */}
      <View style={styles.heroActionRow}>
        <TouchableOpacity
          style={[styles.heroActionBtn, styles.heroActionBtnPrimary]}
          onPress={onSyncNow}
          disabled={isSyncing}
          activeOpacity={0.8}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Ionicons name="sync" size={18} color="#FFF" style={{ marginRight: 6 }} />
          )}
          <LocalizedText style={styles.heroActionBtnPrimaryText}>
            {isSyncing ? 'Đang đồng bộ...' : 'Đo ngay (PPG Live)'}
          </LocalizedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.heroActionBtn,
            styles.heroActionBtnSecondary,
            isDarkMode && { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
          ]}
          onPress={onFindBand}
          disabled={isFinding}
          activeOpacity={0.8}
        >
          <Ionicons
            name="phone-portrait-outline"
            size={18}
            color="#0284C7"
            style={{ marginRight: 6 }}
          />
          <LocalizedText style={styles.heroActionBtnSecondaryText}>
            {isFinding ? 'Đang gửi...' : 'Tìm vòng tay (Rung)'}
          </LocalizedText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  watchIconWrapper: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  watchIconPulseRing: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  watchIconCenter: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ECFDF5',
    borderWidth: 2,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfoColumn: {
    flex: 1,
  },
  modelBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modelNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  medicalBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  medicalBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  wearerInfoText: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 3,
  },
  locationInfoText: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 6,
  },
  skinContactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  skinContactText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#15803D',
    marginLeft: 5,
  },
  heroDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  specsQuickGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  specQuickItem: {
    alignItems: 'center',
    flex: 1,
  },
  specQuickIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  specQuickVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  specQuickLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  heroActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroActionBtnPrimary: {
    backgroundColor: '#059669',
  },
  heroActionBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  heroActionBtnSecondary: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  heroActionBtnSecondaryText: {
    color: '#0284C7',
    fontSize: 13,
    fontWeight: '700',
  },
});


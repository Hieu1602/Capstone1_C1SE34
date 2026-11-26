// DoctorPatientsComponents.tsx
// Tập hợp các component cho màn hình Quản lý Bệnh nhân (Bác sĩ):
// 1. DoctorPatientsHeader: Thanh tìm kiếm, đếm số ca cảnh báo, dải pill lọc nhanh & popup lọc (Ảnh 1 & 5)
// 2. DoctorPatientCard: Thẻ bệnh nhân bo tròn lớn, avatar, badge tình trạng, dải sinh hiệu + sparkline (Ảnh 5)

import React, { useState, RefObject } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle } from 'react-native-svg';
import { Colors } from '../../../theme/colors';
import { LocalizedText, LocalizedTextInput } from '../../../i18n/LocalizedComponents';
import { PatientCardData, getPatientAvatarUrl } from './types';
import { formatGenderVN } from '../../../utils/formatters';

// =============================================================
// MINI SPARKLINE COMPONENT (Lấy cảm hứng từ phần Records ở Ảnh 5)
// =============================================================
const MiniSparkline: React.FC<{ color?: string }> = ({ color = '#0D9488' }) => (
  <Svg width={64} height={24} viewBox="0 0 64 24">
    <Path
      d="M 2 18 Q 16 16, 26 11 T 46 7 T 58 3"
      fill="none"
      stroke={color}
      strokeWidth={2.4}
      strokeLinecap="round"
    />
    <Circle cx={58} cy={3} r={3} fill={color} />
  </Svg>
);

// =============================================================
// 1. HEADER & THANH CÔNG CỤ TÌM KIẾM / LỌC BỆNH NHÂN (Ảnh 1 & 5)
// =============================================================
export interface DoctorPatientsHeaderProps {
  insets: { top: number; bottom: number; left: number; right: number };
  userName?: string | null;
  totalPatients: number;
  warningCount: number;
  dangerCount?: number;
  normalCount?: number;
  searchQuery: string;
  filterTab: 'ALL' | 'DANGER' | 'WARNING' | 'NORMAL';
  onChangeSearch: (val: string) => void;
  onChangeFilter: (tab: 'ALL' | 'DANGER' | 'WARNING' | 'NORMAL') => void;
  onRefresh: () => void;
  refreshing?: boolean;
  isDarkMode: boolean;
  colors: any;
  searchInputRef?: RefObject<any>;
}

export const DoctorPatientsHeader: React.FC<DoctorPatientsHeaderProps> = ({
  insets,
  totalPatients,
  warningCount,
  dangerCount = 0,
  normalCount = 0,
  searchQuery,
  filterTab,
  onChangeSearch,
  onChangeFilter,
  onRefresh,
  refreshing = false,
  isDarkMode,
  colors,
  searchInputRef,
}) => {
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const filterOptions = [
    { key: 'ALL' as const, label: 'Tất cả', count: totalPatients, color: '#2563EB', bg: '#EFF6FF' },
    { key: 'DANGER' as const, label: 'Nguy cấp', count: dangerCount, color: '#EF4444', bg: '#FEF2F2' },
    { key: 'WARNING' as const, label: 'Cần chú ý', count: warningCount, color: '#F59E0B', bg: '#FFFBEB' },
    { key: 'NORMAL' as const, label: 'Ổn định', count: normalCount, color: '#10B981', bg: '#ECFDF5' },
  ];

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + 8,
          backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
          borderBottomColor: colors.border,
        },
      ]}
    >
      {/* Tiêu đề & Thông tin số lượng */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <LocalizedText style={[styles.title, { color: colors.textPrimary }]}>
            Danh sách bệnh nhân
          </LocalizedText>
          <LocalizedText style={[styles.subtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            {totalPatients} người cao tuổi đang theo dõi
            {warningCount + dangerCount > 0 ? ` • ${warningCount + dangerCount} ca cần lưu ý` : ''}
          </LocalizedText>
        </View>

        <TouchableOpacity
          style={[styles.reloadBtn, { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6' }]}
          onPress={onRefresh}
          disabled={refreshing}
          activeOpacity={0.7}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#2563EB" />
          ) : (
            <Ionicons name="refresh" size={18} color="#2563EB" />
          )}
        </TouchableOpacity>
      </View>

      {/* Thanh tìm kiếm & Nút Lọc (Filter) đồng hàng */}
      <View style={styles.searchFilterRow}>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name="search" size={18} color="#94A3B8" />
          <LocalizedTextInput
            ref={searchInputRef}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Tìm theo tên bệnh nhân..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={onChangeSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => onChangeSearch('')}>
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.filterBtn,
            {
              backgroundColor: filterTab !== 'ALL' ? '#EFF6FF' : (isDarkMode ? '#0F172A' : '#F8FAFC'),
              borderColor: filterTab !== 'ALL' ? '#2563EB' : colors.border,
            },
          ]}
          activeOpacity={0.75}
          onPress={() => setFilterModalVisible(true)}
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={filterTab !== 'ALL' ? '#2563EB' : colors.textPrimary}
          />
          {filterTab !== 'ALL' && <View style={styles.activeFilterDot} />}
        </TouchableOpacity>
      </View>

      {/* DẢI PILL LỌC NHANH (Tự xuống dòng gọn gàng không bị cắt chữ ở cạnh phải) */}
      <View style={styles.filterPillRow}>
        {filterOptions.map((opt) => {
          const isSelected = filterTab === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => onChangeFilter(opt.key)}
              activeOpacity={0.8}
              style={[
                styles.quickPill,
                isSelected
                  ? { backgroundColor: opt.color, borderColor: opt.color, shadowColor: opt.color, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3, elevation: 3 }
                  : { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6', borderColor: 'transparent' },
              ]}
            >
              <View
                style={[
                  styles.quickPillDot,
                  { backgroundColor: isSelected ? '#FFFFFF' : opt.color },
                ]}
              />
              <LocalizedText
                style={[
                  styles.quickPillText,
                  isSelected
                    ? { color: '#FFFFFF', fontWeight: '700' }
                    : { color: isDarkMode ? '#CBD5E1' : '#64748B' },
                ]}
              >
                {opt.label} ({opt.count})
              </LocalizedText>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Modal / Dialog chọn bộ lọc trạng thái */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFilterModalVisible(false)}
        >
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <LocalizedText style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Bộ lọc trạng thái sức khỏe
              </LocalizedText>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close" size={22} color={isDarkMode ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            {filterOptions.map((opt) => {
              const isSelected = filterTab === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.modalOption,
                    {
                      backgroundColor: isSelected
                        ? (isDarkMode ? '#1E3A8A44' : '#EFF6FF')
                        : 'transparent',
                    },
                  ]}
                  onPress={() => {
                    onChangeFilter(opt.key);
                    setFilterModalVisible(false);
                  }}
                >
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: opt.color,
                      marginRight: 10,
                    }}
                  />
                  <LocalizedText
                    style={[
                      styles.modalOptionText,
                      {
                        color: isSelected ? '#2563EB' : colors.textPrimary,
                        fontWeight: isSelected ? '700' : '500',
                        flex: 1,
                      },
                    ]}
                  >
                    {opt.label} ({opt.count})
                  </LocalizedText>
                  {isSelected && <Ionicons name="checkmark" size={18} color="#2563EB" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// =============================================================
// 2. CARD BỆNH NHÂN (DoctorPatientCard - Ảnh 1 & 5)
// =============================================================
export interface DoctorPatientCardProps {
  patient: PatientCardData;
  onViewDetail: (patientId: string) => void;
  onViewAnalytics?: (patientId: string) => void;
  onBookAppointment?: (patient: PatientCardData) => void;
  isDarkMode: boolean;
  colors: any;
}

export const DoctorPatientCard: React.FC<DoctorPatientCardProps> = ({
  patient,
  onViewDetail,
  onViewAnalytics,
  onBookAppointment,
  isDarkMode,
  colors,
}) => {
  const isWarn = patient.health_status === 'WARNING';
  const isDanger = patient.health_status === 'DANGER';

  const rawName = patient.name || (patient as any).full_name || '';
  const displayName = (() => {
    if (!rawName || rawName.trim().length === 0) return 'Bệnh nhân';
    const clean = rawName.trim();
    if (clean.toLowerCase().startsWith('cụ ') || clean.toLowerCase().startsWith('bác ')) return clean;
    return `Cụ ${clean}`;
  })();

  const initial = (() => {
    const parts = displayName.replace(/^(cụ|bác|ông|bà)\s+/i, '').trim().split(/\s+/);
    return parts[parts.length - 1]?.[0]?.toUpperCase() || 'B';
  })();

  const statusColor = isDanger ? '#EF4444' : isWarn ? '#F59E0B' : '#10B981';
  const statusLabel = isDanger ? 'Nguy cấp' : isWarn ? 'Cần chú ý' : 'Ổn định';
  const statusBg = isDanger ? '#FEE2E2' : isWarn ? '#FEF3C7' : '#ECFDF5';

  return (
    <View
      style={[
        cardStyles.fullCard,
        {
          backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
          borderColor: isDanger ? '#FCA5A5' : isWarn ? '#FCD34D' : (isDarkMode ? '#334155' : '#E2E8F0'),
        },
      ]}
    >
      {/* 1. Header Row: Avatar, Tên, Tuổi, Địa chỉ & Badge trạng thái */}
      <TouchableOpacity
        style={cardStyles.patientInfoRow}
        activeOpacity={0.8}
        onPress={() => onViewDetail(patient.id)}
      >
        <View style={cardStyles.avatarContainer}>
          <View
            style={[
              cardStyles.avatarCircle,
              { backgroundColor: isDanger ? '#EF4444' : isWarn ? '#F59E0B' : '#2563EB' },
            ]}
          >
            {patient.avatar_url ? (
              <Image
                source={{ uri: getPatientAvatarUrl(patient.avatar_url)! }}
                style={cardStyles.avatarImg}
                resizeMode="cover"
              />
            ) : (
              <LocalizedText style={cardStyles.avatarLetter}>{initial}</LocalizedText>
            )}
          </View>
          <View
            style={[
              cardStyles.onlineDot,
              {
                backgroundColor: statusColor,
                borderColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              },
            ]}
          />
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={cardStyles.nameAndBadgeRow}>
            <LocalizedText
              style={[cardStyles.patientName, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {displayName}
            </LocalizedText>
            <View style={[cardStyles.statusBadge, { backgroundColor: statusBg }]}>
              <View style={[cardStyles.statusBadgeDot, { backgroundColor: statusColor }]} />
              <LocalizedText style={[cardStyles.statusBadgeText, { color: statusColor }]}>
                {statusLabel}
              </LocalizedText>
            </View>
          </View>

          <LocalizedText
            style={[cardStyles.patientMeta, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}
            numberOfLines={1}
          >
            {patient.age ? `${patient.age} tuổi` : 'Cao tuổi'} • {formatGenderVN(patient.gender)}
            {patient.house_name && patient.house_name !== 'Nhà của tôi'
              ? ` • ${patient.house_name}`
              : (!patient.house_address ? ' • Nhà riêng' : '')}
          </LocalizedText>

          {patient.house_address ? (
            <LocalizedText
              style={[cardStyles.patientAddress, { color: isDarkMode ? '#64748B' : '#94A3B8' }]}
              numberOfLines={1}
            >
              📍 {patient.house_address}
            </LocalizedText>
          ) : null}
        </View>
      </TouchableOpacity>

      {/* 2. DẢI CHỈ SỐ SINH HIỆU THU NHỎ KÈM MINI SPARKLINE (Ảnh 5 - Records) */}
      <View
        style={[
          cardStyles.vitalsStrip,
          {
            backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
            borderColor: isDarkMode ? '#334155' : '#E2E8F0',
          },
        ]}
      >
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {/* Nhịp tim */}
          <View style={cardStyles.vitalItem}>
            <Ionicons name="heart" size={14} color="#EF4444" style={{ marginRight: 4 }} />
            <View>
              <LocalizedText style={[cardStyles.vitalValue, { color: colors.textPrimary }]}>
                {patient.heart_rate != null ? `${patient.heart_rate} bpm` : '-- bpm'}
              </LocalizedText>
              <LocalizedText style={cardStyles.vitalSub}>Nhịp tim</LocalizedText>
            </View>
          </View>

          <View style={cardStyles.vitalDivider} />

          {/* SpO2 */}
          <View style={cardStyles.vitalItem}>
            <Ionicons name="water" size={14} color="#0284C7" style={{ marginRight: 4 }} />
            <View>
              <LocalizedText style={[cardStyles.vitalValue, { color: colors.textPrimary }]}>
                {patient.spo2 != null ? `${patient.spo2}%` : '--%'}
              </LocalizedText>
              <LocalizedText style={cardStyles.vitalSub}>SpO2</LocalizedText>
            </View>
          </View>
        </View>

        {/* Mini Sparkline Chart & Online/Offline tag */}
        <View style={cardStyles.sparklineWrap}>
          {!patient.is_online && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 }}>
              <Ionicons name="cloud-offline-outline" size={11} color="#94A3B8" />
              <LocalizedText style={{ fontSize: 9.5, color: '#94A3B8', fontWeight: '600' }}>Ngoại tuyến</LocalizedText>
            </View>
          )}
          <View style={!patient.is_online ? { opacity: 0.45 } : undefined}>
            <MiniSparkline color={isDanger ? '#EF4444' : isWarn ? '#F59E0B' : '#0D9488'} />
          </View>
        </View>
      </View>

      {/* 3. Cụm nút hành động chuẩn y tế */}
      <View style={[cardStyles.actionRow, { borderTopColor: isDarkMode ? '#334155' : '#E2E8F0' }]}>
        <TouchableOpacity
          style={[
            cardStyles.btnActionPrimary,
            { backgroundColor: isDarkMode ? '#1E3A8A33' : '#EFF6FF', borderColor: isDarkMode ? '#2563EB55' : '#BFDBFE' },
          ]}
          activeOpacity={0.8}
          onPress={() => onViewDetail(patient.id)}
        >
          <Ionicons name="document-text" size={14} color="#2563EB" style={{ marginRight: 4 }} />
          <LocalizedText style={[cardStyles.btnActionPrimaryText, { color: '#2563EB' }]}>
            Xem bệnh án
          </LocalizedText>
        </TouchableOpacity>

        {onBookAppointment && (
          <TouchableOpacity
            style={[
              cardStyles.btnActionSecondary,
              { backgroundColor: isDarkMode ? '#0C4A6E33' : '#F0F9FF', borderColor: isDarkMode ? '#0284C744' : '#BAE6FD' },
            ]}
            activeOpacity={0.8}
            onPress={() => onBookAppointment(patient)}
          >
            <Ionicons name="calendar-outline" size={14} color="#0284C7" style={{ marginRight: 4 }} />
            <LocalizedText style={[cardStyles.btnActionSecondaryText, { color: '#0284C7' }]}>
              Đặt lịch
            </LocalizedText>
          </TouchableOpacity>
        )}

        {onViewAnalytics && (
          <TouchableOpacity
            style={[
              cardStyles.btnActionSecondary,
              { backgroundColor: isDarkMode ? '#064E3B33' : '#ECFDF5', borderColor: isDarkMode ? '#05966944' : '#A7F3D0' },
            ]}
            activeOpacity={0.8}
            onPress={() => onViewAnalytics(patient.id)}
          >
            <Ionicons name="pulse-outline" size={14} color="#059669" style={{ marginRight: 4 }} />
            <LocalizedText style={[cardStyles.btnActionSecondaryText, { color: '#059669' }]}>
              Sinh hiệu
            </LocalizedText>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  reloadBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    marginLeft: 8,
    paddingVertical: 0,
  },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  activeFilterDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
  },
  filterPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingBottom: 2,
  },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
  },
  quickPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  quickPillText: {
    fontSize: 11.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000066',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#CBD5E155',
  },
  modalTitle: { fontSize: 16, fontWeight: '800' },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  modalOptionText: { fontSize: 14 },
});

const cardStyles = StyleSheet.create({
  fullCard: {
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  patientInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 2,
    zIndex: 2,
  },
  nameAndBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  patientName: {
    fontSize: 15.5,
    fontWeight: '800',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  patientMeta: {
    fontSize: 12,
    marginBottom: 2,
  },
  patientAddress: {
    fontSize: 11,
  },
  vitalsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  vitalItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vitalDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#CBD5E188',
  },
  vitalValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  vitalSub: {
    fontSize: 9.5,
    color: '#94A3B8',
    fontWeight: '500',
  },
  sparklineWrap: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btnActionPrimary: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  btnActionPrimaryText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  btnActionSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  btnActionSecondaryText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

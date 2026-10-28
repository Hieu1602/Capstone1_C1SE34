// DoctorPatientsComponents.tsx
// Tập hợp các component cho màn hình Quản lý Bệnh nhân (Bác sĩ):
// 1. DoctorPatientsHeader: Thanh tìm kiếm, đếm số ca cảnh báo, bộ lọc trạng thái & popup lọc
// 2. DoctorPatientCard: Thẻ bệnh nhân bố cục Grid 2 cột (Avatar, trạng thái, chỉ số & nút hành động)

import React, { useState, RefObject } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { LocalizedText, LocalizedTextInput } from '../../../i18n/LocalizedComponents';
import { PatientCardData } from './types';

// =============================================================
// 1. HEADER & THANH CÔNG CỤ TÌM KIẾM / LỌC BỆNH NHÂN
// =============================================================
export interface DoctorPatientsHeaderProps {
  insets: { top: number; bottom: number; left: number; right: number };
  userName?: string | null;
  totalPatients: number;
  warningCount: number;
  searchQuery: string;
  filterTab: 'ALL' | 'WARNING' | 'NORMAL';
  onChangeSearch: (val: string) => void;
  onChangeFilter: (tab: 'ALL' | 'WARNING' | 'NORMAL') => void;
  onRefresh: () => void;
  isDarkMode: boolean;
  colors: any;
  searchInputRef?: RefObject<any>;
}

export const DoctorPatientsHeader: React.FC<DoctorPatientsHeaderProps> = ({
  insets,
  userName,
  totalPatients,
  warningCount,
  searchQuery,
  filterTab,
  onChangeSearch,
  onChangeFilter,
  onRefresh,
  isDarkMode,
  colors,
  searchInputRef,
}) => {
  const [filterModalVisible, setFilterModalVisible] = useState(false);

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
        <View>
          <LocalizedText style={[styles.title, { color: colors.textPrimary }]}>
            Danh sách bệnh nhân
          </LocalizedText>
          <LocalizedText style={[styles.subtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            {totalPatients} người cao tuổi đang theo dõi
            {warningCount > 0 ? ` • ${warningCount} ca cần chú ý` : ''}
          </LocalizedText>
        </View>

        <TouchableOpacity
          style={[styles.reloadBtn, { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6' }]}
          onPress={onRefresh}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Thanh tìm kiếm & Nút Lọc (Filter) đồng hàng theo bố cục mẫu */}
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
            placeholder="Tìm theo tên hoặc số điện thoại..."
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
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {[
              { key: 'ALL', label: `Tất cả bệnh nhân (${totalPatients})`, icon: 'people-outline' },
              { key: 'WARNING', label: `Cần chú ý / Nguy cơ (${warningCount})`, icon: 'warning-outline', color: '#EF4444' },
              { key: 'NORMAL', label: `Chỉ số ổn định (${Math.max(0, totalPatients - warningCount)})`, icon: 'checkmark-circle-outline', color: '#10B981' },
            ].map((opt) => {
              const isSelected = filterTab === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.modalOption,
                    isSelected && { backgroundColor: isDarkMode ? '#334155' : '#EFF6FF' },
                  ]}
                  onPress={() => {
                    onChangeFilter(opt.key as any);
                    setFilterModalVisible(false);
                  }}
                >
                  <Ionicons
                    name={opt.icon as any}
                    size={20}
                    color={opt.color || (isSelected ? '#2563EB' : colors.textPrimary)}
                    style={{ marginRight: 12 }}
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
                    {opt.label}
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
// 2. CARD BỆNH NHÂN THEO BỐ CỤC LƯỚI (GRID 2 CỘT)
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

  const statusDotColor = isDanger ? '#EF4444' : isWarn ? '#F59E0B' : '#10B981';

  return (
    <TouchableOpacity
      style={[
        cardStyles.gridCard,
        {
          backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
          borderColor: isDanger ? '#FCA5A5' : isWarn ? '#FCD34D' : (isDarkMode ? '#334155' : '#E2E8F0'),
        },
      ]}
      activeOpacity={0.88}
      onPress={() => onViewDetail(patient.id)}
    >
      {/* 1. Avatar tròn với chấm trạng thái */}
      <View style={cardStyles.avatarSection}>
        <View
          style={[
            cardStyles.avatarCircle,
            { backgroundColor: isDanger ? '#EF4444' : isWarn ? '#F59E0B' : '#2563EB' },
          ]}
        >
          <LocalizedText style={cardStyles.avatarLetter}>{initial}</LocalizedText>
          <View
            style={[
              cardStyles.onlineDot,
              {
                backgroundColor: statusDotColor,
                borderColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              },
            ]}
          />
        </View>

        {(isDanger || isWarn) && (
          <View style={cardStyles.dangerBadge}>
            <Ionicons name="warning" size={10} color="#DC2626" />
            <LocalizedText style={cardStyles.dangerBadgeText}>
              {isDanger ? 'Nguy cấp' : 'Cảnh báo'}
            </LocalizedText>
          </View>
        )}
      </View>

      {/* 2. Tên & Tuổi / Giới tính */}
      <LocalizedText
        style={[cardStyles.patientName, { color: colors.textPrimary }]}
        numberOfLines={1}
      >
        {displayName}
      </LocalizedText>

      <LocalizedText
        style={[cardStyles.patientSummary, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}
        numberOfLines={1}
      >
        {patient.age ? `${patient.age} tuổi` : 'Cao tuổi'} • {patient.gender ? (patient.gender === 'Nữ' || patient.gender.toUpperCase() === 'FEMALE' ? 'Nữ' : 'Nam') : 'Chưa cập nhật'}
      </LocalizedText>

      {/* 3. Vị trí / Địa chỉ */}
      <LocalizedText
        style={[cardStyles.patientLocation, { color: isDarkMode ? '#64748B' : '#94A3B8' }]}
        numberOfLines={1}
      >
        📍 {patient.house_address ? patient.house_address.split(',')[0] : (patient.house_name || 'Tại nhà riêng')}
      </LocalizedText>

      {/* 4. Cụm nút hành động dưới cùng */}
      <View style={cardStyles.actionButtonGroup}>
        <TouchableOpacity
          style={[
            cardStyles.btnViewRecord,
            { backgroundColor: isDarkMode ? '#0F172A' : '#EFF6FF' },
          ]}
          activeOpacity={0.8}
          onPress={() => onViewDetail(patient.id)}
        >
          <LocalizedText style={cardStyles.btnViewRecordText}>Hồ sơ</LocalizedText>
        </TouchableOpacity>

        {onBookAppointment && (
          <TouchableOpacity
            style={[
              cardStyles.btnAppointment,
              { backgroundColor: isDarkMode ? '#0F172A' : '#EFF6FF' },
            ]}
            activeOpacity={0.8}
            onPress={() => onBookAppointment(patient)}
          >
            <Ionicons name="calendar-outline" size={16} color="#2563EB" />
          </TouchableOpacity>
        )}

        {onViewAnalytics && (
          <TouchableOpacity
            style={[
              cardStyles.btnAppointment,
              { backgroundColor: isDarkMode ? '#0F172A' : '#EFF6FF' },
            ]}
            activeOpacity={0.8}
            onPress={() => onViewAnalytics(patient.id)}
          >
            <Ionicons name="analytics-outline" size={16} color="#2563EB" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2 },
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
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 13 },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  activeFilterDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
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
  gridCard: {
    flex: 1,
    maxWidth: '48.5%',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginHorizontal: 4,
    marginBottom: 12,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 10,
    position: 'relative',
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
  },
  dangerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 6,
  },
  dangerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  patientName: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  patientSummary: {
    fontSize: 12.5,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 2,
  },
  patientLocation: {
    fontSize: 11.5,
    textAlign: 'center',
    marginBottom: 12,
  },
  actionButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    marginTop: 'auto',
  },
  btnViewRecord: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnViewRecordText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  btnAppointment: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});


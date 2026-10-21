import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../../theme/colors';
import { LocalizedText as Text } from '../../../../i18n/LocalizedComponents';

export interface DateOptionItem {
  label: string;
  sub: string;
  value: string;
}

interface HealthDateFilterBarProps {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  dateOptions: DateOptionItem[];
  isCustomDate: boolean;
  isLoadingVitals: boolean;
  hasDayVitals: boolean;
  formatDisplayDateVN: (ymd: string) => string;
  formatDateYMD: (d: Date) => string;
  onOpenCalendarModal: () => void;
  isDarkMode?: boolean;
  colors?: any;
}

export const HealthDateFilterBar: React.FC<HealthDateFilterBarProps> = ({
  selectedDate,
  setSelectedDate,
  dateOptions,
  isCustomDate,
  isLoadingVitals,
  hasDayVitals,
  formatDisplayDateVN,
  formatDateYMD,
  onOpenCalendarModal,
  isDarkMode = false,
  colors = {},
}) => {
  return (
    <View style={styles.dateFilterSection}>
      <View style={styles.dateFilterHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="calendar" size={17} color={Colors.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.dateFilterTitle, { color: colors.textPrimary }]}>
            Chọn ngày kiểm tra:
          </Text>
        </View>
        {isLoadingVitals && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 6 }} />
            <Text style={{ fontSize: 11, color: Colors.primary }}>Đang tải...</Text>
          </View>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.datePillsRow}>
        {/* Nút "Chọn ngày trên lịch" kèm icon Calendar */}
        {Platform.OS === 'web' ? (
          <label
            style={{
              position: 'relative',
              display: 'inline-flex',
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isCustomDate ? '#2563EB' : (isDarkMode ? '#1E293B' : '#EFF6FF'),
              borderWidth: 1.5,
              borderColor: isCustomDate ? '#1D4ED8' : (isDarkMode ? '#334155' : '#BFDBFE'),
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 8,
              cursor: 'pointer',
              boxShadow: isCustomDate ? '0 4px 10px rgba(37, 99, 235, 0.3)' : 'none',
            } as any}
          >
            <Ionicons
              name="calendar"
              size={16}
              color={isCustomDate ? '#FFFFFF' : '#2563EB'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={{
                fontSize: 12,
                fontWeight: '800',
                color: isCustomDate ? '#FFFFFF' : '#1D4ED8',
              }}
            >
              📅 Ngày: {formatDisplayDateVN(selectedDate)}
            </Text>
            <Ionicons
              name="chevron-down"
              size={13}
              color={isCustomDate ? '#FFFFFF' : '#2563EB'}
              style={{ marginLeft: 6 }}
            />
            <input
              type="date"
              value={selectedDate}
              max={formatDateYMD(new Date())}
              onChange={(e: any) => {
                if (e.target.value) {
                  setSelectedDate(e.target.value);
                }
              }}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer',
              }}
            />
          </label>
        ) : (
          <TouchableOpacity
            style={[
              styles.calendarPickerBtn,
              isCustomDate && styles.calendarPickerBtnActive,
              isDarkMode && !isCustomDate && { backgroundColor: '#1E293B', borderColor: '#334155' },
            ]}
            onPress={onOpenCalendarModal}
            activeOpacity={0.8}
          >
            <Ionicons
              name="calendar"
              size={16}
              color={isCustomDate ? '#FFFFFF' : '#2563EB'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.calendarPickerBtnText,
                isCustomDate && { color: '#FFFFFF' },
              ]}
            >
              📅 Ngày: {formatDisplayDateVN(selectedDate)}
            </Text>
            <Ionicons
              name="chevron-down"
              size={13}
              color={isCustomDate ? '#FFFFFF' : '#2563EB'}
              style={{ marginLeft: 6 }}
            />
          </TouchableOpacity>
        )}

        {/* Các nút chọn nhanh (Hôm nay, Hôm qua, 2 ngày trước, 3 ngày trước) */}
        {dateOptions.map((opt) => {
          const isSelected = selectedDate === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.datePill,
                isSelected ? styles.datePillActive : styles.datePillInactive,
                !isSelected && isDarkMode && { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => setSelectedDate(opt.value)}
              activeOpacity={0.75}
            >
              <Text style={[styles.datePillLabel, isSelected ? styles.datePillLabelActive : { color: colors.textPrimary }]}>
                {opt.label}
              </Text>
              <Text style={[styles.datePillSub, isSelected ? styles.datePillSubActive : { color: colors.textMuted }]}>
                {opt.sub}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Thông báo khi ngày chưa có dữ liệu đo trong PostgreSQL */}
      {!isLoadingVitals && !hasDayVitals && (
        <View style={[styles.noDataNoticeBox, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
          <Ionicons name="information-circle" size={18} color="#D97706" style={{ marginRight: 8 }} />
          <Text style={[styles.noDataNoticeText, { color: isDarkMode ? '#FDE68A' : '#92400E' }]}>
            Chưa có dữ liệu đo cho ngày này ({formatDisplayDateVN(selectedDate)}).
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  dateFilterSection: {
    marginBottom: 14,
  },
  dateFilterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateFilterTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  datePillsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  datePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  datePillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  datePillInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  datePillLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  datePillLabelActive: {
    color: '#FFFFFF',
  },
  datePillSub: {
    fontSize: 10,
    marginTop: 1,
  },
  datePillSubActive: {
    color: '#FFFFFF',
    opacity: 0.85,
  },
  calendarPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  calendarPickerBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
  calendarPickerBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  noDataNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
  },
  noDataNoticeText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
});


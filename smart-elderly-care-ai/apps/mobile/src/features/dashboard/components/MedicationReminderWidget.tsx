// MedicationReminderWidget.tsx
// Component widget nhắc nhở lịch uống thuốc / sinh hoạt tiếp theo kèm nút hoàn thành nhanh

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedAlert as Alert, LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { Colors } from '../../../theme/colors';

interface MedicationReminderWidgetProps {
  nextMedication: {
    time: string;
    name: string;
    [key: string]: any;
  };
  isMedDone: boolean;
  setNextMedTaken: (val: boolean) => void;
  isDarkMode: boolean;
  colors: any;
  navigation: any;
}

export const MedicationReminderWidget: React.FC<MedicationReminderWidgetProps> = ({
  nextMedication,
  isMedDone,
  setNextMedTaken,
  isDarkMode,
  colors,
  navigation,
}) => {
  return (
    <View
      style={[
        styles.reminderWidgetCard,
        isDarkMode && { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <TouchableOpacity
        style={styles.reminderWidgetMain}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('MedicationReminder')}
      >
        <View style={styles.reminderWidgetHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[styles.reminderIconCircle, { backgroundColor: isDarkMode ? '#432005' : '#FFF7ED' }]}>
              <Ionicons name="medical" size={15} color={Colors.primary} />
            </View>
            <Text style={[styles.reminderWidgetTitle, isDarkMode && { color: colors.textPrimary }]}>
              Lịch nhắc nhở tiếp theo
            </Text>
          </View>
          <View style={styles.reminderRightHeader}>
            <View style={styles.reminderLiveVoiceBadge}>
              <Ionicons name="volume-medium" size={11} color="#0EA5E9" />
              <Text style={styles.reminderLiveVoiceText}>Loa Hub</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={isDarkMode ? colors.textSecondary : '#94A3B8'} />
          </View>
        </View>

        <View style={styles.reminderContentRow}>
          <View style={styles.reminderClockBox}>
            <Ionicons name="time" size={13} color="#0EA5E9" />
            <Text style={styles.reminderClockText}>{nextMedication.time}</Text>
          </View>
          <Text
            style={[
              styles.reminderMedText,
              isDarkMode && { color: colors.textPrimary },
              isMedDone && styles.reminderMedTextDone,
            ]}
            numberOfLines={1}
          >
            {nextMedication.name}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.reminderTickBtn,
          isMedDone ? styles.reminderTickBtnDone : styles.reminderTickBtnPending,
          isDarkMode && !isMedDone && { backgroundColor: '#0F172A', borderColor: '#334155' },
        ]}
        onPress={() => {
          const next = !isMedDone;
          setNextMedTaken(next);
          if (next) {
            Alert.alert('Đã hoàn thành', `Đã ghi nhận: ${nextMedication.name}.`);
          }
        }}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isMedDone ? 'checkmark-circle' : 'checkmark'}
          size={15}
          color={isMedDone ? '#10B981' : (isDarkMode ? '#94A3B8' : '#64748B')}
        />
        <Text
          style={[
            styles.reminderTickText,
            { color: isMedDone ? '#10B981' : (isDarkMode ? '#94A3B8' : '#64748B') },
          ]}
        >
          {isMedDone ? 'Đã uống' : 'Uống'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  reminderWidgetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  reminderWidgetMain: {
    flex: 1,
    marginRight: 10,
  },
  reminderWidgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  reminderIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderWidgetTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  reminderRightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reminderLiveVoiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  reminderLiveVoiceText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
  },
  reminderContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reminderClockBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  reminderClockText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284C7',
  },
  reminderMedText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  reminderMedTextDone: {
    textDecorationLine: 'line-through',
    color: '#10B981',
    opacity: 0.8,
  },
  reminderTickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  reminderTickBtnPending: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  reminderTickBtnDone: {
    backgroundColor: '#DCFCE7',
    borderColor: '#10B981',
  },
  reminderTickText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

import React, { useEffect, useRef } from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText as Text } from '../../../i18n/LocalizedComponents';

interface BirthYearPickerModalProps {
  visible: boolean;
  selectedYear: string;
  onSelectYear: (year: string) => void;
  onClose: () => void;
  isDarkMode?: boolean;
  bgCard?: string;
  borderCol?: string;
  textTitle?: string;
}

const YEARS = Array.from({ length: 1970 - 1920 + 1 }, (_, i) => 1920 + i);
const ROW_HEIGHT = 44;

export const BirthYearPickerModal: React.FC<BirthYearPickerModalProps> = ({
  visible,
  selectedYear,
  onSelectYear,
  onClose,
  isDarkMode = false,
  bgCard = '#FFFFFF',
  borderCol = '#E2E8F0',
  textTitle = '#0F172A',
}) => {
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (!visible) return;
    const targetYear = parseInt(selectedYear, 10);
    const anchor = !isNaN(targetYear) && targetYear >= 1920 && targetYear <= 1970 ? targetYear : 1950;
    const index = anchor - 1920;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, index * ROW_HEIGHT - ROW_HEIGHT * 2), animated: false });
    }, 50);
    return () => clearTimeout(timer);
  }, [visible, selectedYear]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View
          style={[styles.card, { backgroundColor: bgCard, borderColor: borderCol }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={[styles.header, { borderBottomColor: borderCol }]}>
            <Text style={[styles.title, { color: textTitle }]}>Chọn năm sinh (1920 – 1970)</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView ref={scrollRef} style={styles.list} showsVerticalScrollIndicator>
            {YEARS.map((yr) => {
              const yrStr = String(yr);
              const isSelected = selectedYear === yrStr;
              const age = currentYear - yr;
              return (
                <TouchableOpacity
                  key={yr}
                  activeOpacity={0.75}
                  onPress={() => {
                    onSelectYear(yrStr);
                    onClose();
                  }}
                  style={[
                    styles.row,
                    isSelected && {
                      backgroundColor: isDarkMode ? 'rgba(249, 115, 22, 0.2)' : '#FFF7ED',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.yearText,
                      { color: isSelected ? '#EA580C' : textTitle, fontWeight: isSelected ? '800' : '600' },
                    ]}
                  >
                    {yr}
                  </Text>
                  <Text style={[styles.ageText, { color: isSelected ? '#EA580C' : '#64748B' }]}>
                    {age} tuổi
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
  },
  list: {
    maxHeight: 280,
  },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  yearText: {
    fontSize: 15,
  },
  ageText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default BirthYearPickerModal;

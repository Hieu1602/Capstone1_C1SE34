import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Shadows } from '../../../../theme/colors';
import { LocalizedText as Text } from '../../../../i18n/LocalizedComponents';

interface HealthAiAdviceCardProps {
  aiAdvice: string;
  isDarkMode?: boolean;
}

export const HealthAiAdviceCard: React.FC<HealthAiAdviceCardProps> = ({
  aiAdvice,
  isDarkMode = false,
}) => {
  return (
    <View
      style={[
        styles.aiAdviceCard,
        isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
      ]}
    >
      <View style={styles.aiAdviceHeader}>
        <Ionicons name="sparkles" size={18} color="#D97706" />
        <Text style={styles.aiAdviceTitle}>Lời khuyên Bác sĩ AI</Text>
      </View>
      <Text style={[styles.aiAdviceBody, isDarkMode && { color: '#CBD5E1' }]}>
        {aiAdvice}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  aiAdviceCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 16,
    marginBottom: 14,
    ...Shadows.soft,
  },
  aiAdviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  aiAdviceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B45309',
  },
  aiAdviceBody: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 19,
  },
});


import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../../theme/colors';
import { LocalizedText as Text } from '../../../../i18n/LocalizedComponents';

interface HealthOverallBannerProps {
  bannerAlert: boolean;
  bannerIcon: keyof typeof Ionicons.glyphMap;
  bannerTitle: string;
  bannerSubtitle: string;
  isDarkMode?: boolean;
  colors?: any;
}

export const HealthOverallBanner: React.FC<HealthOverallBannerProps> = ({
  bannerAlert,
  bannerIcon,
  bannerTitle,
  bannerSubtitle,
  isDarkMode = false,
  colors = {},
}) => {
  return (
    <View
      style={[
        styles.overallCard,
        bannerAlert ? styles.overallCardAlert : styles.overallCardNormal,
        !bannerAlert && isDarkMode && { backgroundColor: colors.card },
      ]}
    >
      <View
        style={[
          styles.overallIconCircle,
          { backgroundColor: bannerAlert ? '#FEE2E2' : '#E8FDF3' },
        ]}
      >
        <Ionicons
          name={bannerIcon}
          size={28}
          color={bannerAlert ? Colors.danger : Colors.success}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.overallTitle,
            { color: bannerAlert ? Colors.danger : Colors.success },
          ]}
        >
          {bannerTitle}
        </Text>
        <Text style={[styles.overallSubtitle, isDarkMode && { color: colors.textSecondary }]}>
          {bannerSubtitle}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overallCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
    ...Shadows.soft,
  },
  overallCardNormal: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    borderLeftColor: Colors.success,
  },
  overallCardAlert: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: Colors.danger,
  },
  overallIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  overallTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 3,
  },
  overallSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
});


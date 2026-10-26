import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ProfileHeaderProps {
  isDarkMode: boolean;
  colors: any;
  onPressSearch?: () => void;
  onPressSettings: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  isDarkMode,
  colors,
  onPressSearch,
  onPressSettings,
}) => {
  return (
    <View style={styles.fbHeaderRow}>
      <Text style={[styles.fbHeaderTitle, isDarkMode && { color: colors.textPrimary }]}>
        Menu
      </Text>
      <View style={styles.fbHeaderActionIcons}>
        <TouchableOpacity
          style={[styles.fbHeaderCircleBtn, isDarkMode && { backgroundColor: colors.card }]}
          onPress={onPressSearch || onPressSettings}
          activeOpacity={0.7}
        >
          <Ionicons
            name="search"
            size={20}
            color={isDarkMode ? colors.textPrimary : '#1E293B'}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.fbHeaderCircleBtn, isDarkMode && { backgroundColor: colors.card }]}
          onPress={onPressSettings}
          activeOpacity={0.7}
        >
          <Ionicons
            name="settings-sharp"
            size={20}
            color={isDarkMode ? colors.textPrimary : '#1E293B'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fbHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  fbHeaderTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  fbHeaderActionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fbHeaderCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
});


import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../../theme/colors';
import { IoTDeviceItem } from '../../../../store/useVitalStore';
import { LocalizedText } from '../../../../i18n/LocalizedComponents';

interface DeviceCardItemProps {
  device: IoTDeviceItem;
  onPress: (device: IoTDeviceItem) => void;
  variant?: 'standard' | 'inGroup';
  hasDivider?: boolean;
  isDarkMode?: boolean;
  colors?: any;
}

export const DeviceCardItem: React.FC<DeviceCardItemProps> = ({
  device,
  onPress,
  variant = 'standard',
  hasDivider = false,
  isDarkMode = false,
  colors = {},
}) => {
  if (variant === 'inGroup') {
    return (
      <TouchableOpacity
        style={[
          styles.deviceItemInGroup,
          hasDivider && styles.deviceItemInGroupDivider,
          hasDivider && isDarkMode && { borderTopColor: colors.border },
        ]}
        onPress={() => onPress(device)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconBoxSmall, { backgroundColor: `${device.color}18` }]}>
          <Ionicons name={device.icon as any} size={20} color={device.color} />
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <LocalizedText style={[styles.deviceNameText, isDarkMode && { color: colors.textPrimary }]}>
            {device.name}
          </LocalizedText>
          <LocalizedText
            style={[styles.deviceSubText, isDarkMode && { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {device.sub}
          </LocalizedText>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: device.isOnline ? Colors.success : Colors.danger },
              ]}
            />
            <LocalizedText style={[styles.statusText, isDarkMode && { color: colors.textSecondary }]}>
              {device.status}
            </LocalizedText>
            {(device.icon === 'watch' || device.type === 'watch' || (device as any).device_type === 'SMARTBAND') && (
              <View style={[styles.wearerPill, isDarkMode && { backgroundColor: 'rgba(5, 150, 105, 0.15)' }]}>
                <Ionicons name="person-outline" size={10} color={device.wearer_name ? '#059669' : '#64748B'} />
                <LocalizedText style={[styles.wearerPillText, { color: device.wearer_name ? '#059669' : '#64748B' }]}>
                  {device.wearer_name ? `Người đeo: ${device.wearer_name}` : 'Người đeo: Chưa cập nhật'}
                </LocalizedText>
              </View>
            )}
          </View>
        </View>

        <Ionicons
          name="chevron-forward"
          size={16}
          color={isDarkMode ? '#64748B' : '#CBD5E1'}
        />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.deviceCard,
        isDarkMode && { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
      ]}
      onPress={() => onPress(device)}
      activeOpacity={0.8}
    >
      <View style={[styles.iconBox, { backgroundColor: `${device.color}18` }]}>
        <Ionicons name={device.icon as any} size={24} color={device.color} />
      </View>

      <View style={{ flex: 1, marginLeft: 14 }}>
        <LocalizedText style={[styles.deviceNameText, isDarkMode && { color: colors.textPrimary }]}>
          {device.name}
        </LocalizedText>
        <LocalizedText
          style={[styles.deviceSubText, isDarkMode && { color: colors.textSecondary }]}
          numberOfLines={2}
        >
          {device.sub}
        </LocalizedText>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: device.isOnline ? Colors.success : Colors.danger },
            ]}
          />
          <LocalizedText style={[styles.statusText, isDarkMode && { color: colors.textSecondary }]}>
            {device.status}
          </LocalizedText>
          {(device.icon === 'watch' || device.type === 'watch' || (device as any).device_type === 'SMARTBAND') && (
            <View style={[styles.wearerPill, isDarkMode && { backgroundColor: 'rgba(5, 150, 105, 0.15)' }]}>
              <Ionicons name="person-outline" size={10} color={device.wearer_name ? '#059669' : '#64748B'} />
              <LocalizedText style={[styles.wearerPillText, { color: device.wearer_name ? '#059669' : '#64748B' }]}>
                {device.wearer_name ? `Người đeo: ${device.wearer_name}` : 'Người đeo: Chưa cập nhật'}
              </LocalizedText>
            </View>
          )}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={isDarkMode ? '#64748B' : '#CBD5E1'} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    ...Shadows.sm,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  deviceSubText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  wearerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  wearerPillText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  deviceItemInGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  deviceItemInGroupDivider: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  iconBoxSmall: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});


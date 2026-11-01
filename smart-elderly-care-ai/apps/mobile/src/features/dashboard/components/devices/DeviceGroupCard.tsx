import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Shadows } from '../../../../theme/colors';
import { IoTDeviceItem } from '../../../../store/useVitalStore';
import { LocalizedText } from '../../../../i18n/LocalizedComponents';
import { DeviceCardItem } from './DeviceCardItem';

interface DeviceGroupCardProps {
  groupName: string;
  devicesInGroup: IoTDeviceItem[];
  onDevicePress: (device: IoTDeviceItem) => void;
  onDeviceDelete?: (device: IoTDeviceItem) => void;
  onOpenGroupActionMenu: (groupName: string) => void;
  isDarkMode?: boolean;
  colors?: any;
}

export const DeviceGroupCard: React.FC<DeviceGroupCardProps> = ({
  groupName,
  devicesInGroup,
  onDevicePress,
  onDeviceDelete,
  onOpenGroupActionMenu,
  isDarkMode = false,
  colors = {},
}) => {
  const onlineCount = devicesInGroup.filter((d) => d.isOnline).length;

  return (
    <View
      style={[
        styles.groupCardWrapper,
        isDarkMode && { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* Tiêu đề nhóm */}
      <View
        style={[
          styles.groupCardHeader,
          isDarkMode && { backgroundColor: '#1E1B4B', borderBottomColor: '#2E1065' },
        ]}
      >
        <View style={styles.groupCardHeaderLeft}>
          <View style={styles.groupFolderIconBox}>
            <Ionicons name="folder" size={18} color="#7C3AED" />
          </View>
          <View style={{ marginLeft: 10 }}>
            <LocalizedText style={[styles.groupCardName, isDarkMode && { color: '#F8FAFC' }]}>
              {groupName}
            </LocalizedText>
            <LocalizedText style={[styles.groupCardMeta, isDarkMode && { color: '#94A3B8' }]}>
              {devicesInGroup.length} thiết bị • {onlineCount} trực tuyến
            </LocalizedText>
          </View>
        </View>

        <View style={styles.groupCardHeaderRight}>
          <View
            style={[
              styles.groupCountBadge,
              isDarkMode && { backgroundColor: 'rgba(124, 58, 237, 0.25)' },
            ]}
          >
            <LocalizedText
              style={[
                styles.groupCountBadgeText,
                isDarkMode && { color: '#DDD6FE' },
              ]}
            >
              {devicesInGroup.length} thiết bị
            </LocalizedText>
          </View>
          <TouchableOpacity
            style={styles.groupMoreBtn}
            onPress={() => onOpenGroupActionMenu(groupName)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={isDarkMode ? '#94A3B8' : '#64748B'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Danh sách thiết bị trong nhóm */}
      {devicesInGroup.length > 0 ? (
        <View style={styles.groupDeviceList}>
          {devicesInGroup.map((dev, idx) => (
            <DeviceCardItem
              key={dev.id}
              device={dev}
              variant="inGroup"
              hasDivider={idx > 0}
              onPress={onDevicePress}
              onDelete={onDeviceDelete}
              isDarkMode={isDarkMode}
              colors={colors}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyGroupContent}>
          <Ionicons name="cube-outline" size={24} color={isDarkMode ? '#64748B' : '#94A3B8'} />
          <LocalizedText
            style={[styles.emptyGroupContentText, isDarkMode && { color: colors.textSecondary }]}
          >
            Chưa có thiết bị nào trong nhóm "{groupName}"
          </LocalizedText>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  groupCardWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EDE9FE',
    marginBottom: 16,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  groupCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FAF5FF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3E8FF',
  },
  groupCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupFolderIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupCardName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2E1065',
  },
  groupCardMeta: {
    fontSize: 11,
    color: '#7C3AED',
    marginTop: 1,
  },
  groupCardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupCountBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 6,
  },
  groupCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  groupMoreBtn: {
    padding: 6,
    borderRadius: 8,
  },
  groupDeviceList: {
    paddingVertical: 4,
  },
  emptyGroupContent: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyGroupContentText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 6,
  },
});


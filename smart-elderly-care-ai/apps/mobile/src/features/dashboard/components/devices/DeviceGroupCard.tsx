import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../../theme/colors';
import { IoTDeviceItem } from '../../../../store/useVitalStore';
import { LocalizedText } from '../../../../i18n/LocalizedComponents';
import { DeviceCardItem } from './DeviceCardItem';

interface DeviceGroupCardProps {
  groupName: string;
  devicesInGroup: IoTDeviceItem[];
  onDevicePress: (device: IoTDeviceItem) => void;
  onDeviceDelete?: (device: IoTDeviceItem) => void;
  onOpenGroupActionMenu?: (groupName: string) => void;
  onAddDeviceToGroup?: (groupName: string) => void;
  isDarkMode?: boolean;
  colors?: any;
}

export const DeviceGroupCard: React.FC<DeviceGroupCardProps> = ({
  groupName,
  devicesInGroup,
  onDevicePress,
  onDeviceDelete,
  onOpenGroupActionMenu,
  onAddDeviceToGroup,
  isDarkMode = false,
  colors = {},
}) => {
  const onlineCount = devicesInGroup.filter((d) => d.isOnline).length;

  // Icon động theo các thiết bị có trong nhóm
  const renderGroupIcon = () => {
    if (devicesInGroup.length === 0) {
      return (
        <View style={[styles.groupFolderIconBox, isDarkMode && { backgroundColor: '#334155' }]}>
          <Ionicons name="folder-open-outline" size={18} color={Colors.primary} />
        </View>
      );
    }

    if (devicesInGroup.length === 1) {
      const dev = devicesInGroup[0];
      const iconName = dev.icon || (dev.type === 'camera' ? 'videocam' : 'watch');
      const iconColor = dev.color || Colors.primary;
      return (
        <View style={[styles.groupFolderIconBox, { backgroundColor: `${iconColor}18` }]}>
          <Ionicons name={iconName as any} size={20} color={iconColor} />
        </View>
      );
    }

    // Nhiều thiết bị: hiển thị cụm icon của các thiết bị trong nhóm
    return (
      <View style={styles.groupDynamicIconsCluster}>
        {devicesInGroup.slice(0, 3).map((dev, idx) => {
          const iconName = dev.icon || (dev.type === 'camera' ? 'videocam' : 'watch');
          const iconColor = dev.color || Colors.primary;
          return (
            <View
              key={dev.id || idx}
              style={[
                styles.clusterIconBadge,
                idx > 0 && { marginLeft: -8 },
                { backgroundColor: `${iconColor}22`, borderColor: isDarkMode ? '#1E293B' : '#FFF' },
              ]}
            >
              <Ionicons name={iconName as any} size={14} color={iconColor} />
            </View>
          );
        })}
      </View>
    );
  };

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
          isDarkMode && { backgroundColor: '#1E293B', borderBottomColor: '#334155' },
        ]}
      >
        <View style={styles.groupCardHeaderLeft}>
          {renderGroupIcon()}
          <View style={{ marginLeft: 10 }}>
            <LocalizedText style={[styles.groupCardName, isDarkMode && { color: '#F8FAFC' }]}>
              {groupName}
            </LocalizedText>
            <LocalizedText style={[styles.groupCardMeta, isDarkMode && { color: '#FB923C' }]}>
              {devicesInGroup.length} thiết bị • {onlineCount} trực tuyến
            </LocalizedText>
          </View>
        </View>

        <View style={styles.groupCardHeaderRight}>
          <View
            style={[
              styles.groupCountBadge,
              isDarkMode && { backgroundColor: 'rgba(255, 107, 0, 0.2)' },
            ]}
          >
            <LocalizedText
              style={[
                styles.groupCountBadgeText,
                isDarkMode && { color: '#FB923C' },
              ]}
            >
              {devicesInGroup.length} thiết bị
            </LocalizedText>
          </View>
          {Boolean(onOpenGroupActionMenu) && (
            <TouchableOpacity
              style={styles.groupMoreBtn}
              onPress={() => onOpenGroupActionMenu?.(groupName)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="ellipsis-vertical" size={18} color={isDarkMode ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Danh sách thiết bị trong nhóm */}
      {devicesInGroup.length > 0 ? (
        <>
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
          {onAddDeviceToGroup && (
            <View style={[styles.groupCardFooter, isDarkMode && { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={styles.groupCardFooterAddBtn}
                onPress={() => onAddDeviceToGroup(groupName)}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={15} color={Colors.primary} />
                <LocalizedText style={styles.groupCardFooterAddText}>
                  + Gán thêm thiết bị vào nhóm
                </LocalizedText>
              </TouchableOpacity>
            </View>
          )}
        </>
      ) : (
        <View style={styles.emptyGroupContent}>
          <Ionicons name="cube-outline" size={28} color={isDarkMode ? '#64748B' : '#94A3B8'} />
          <LocalizedText
            style={[styles.emptyGroupContentText, isDarkMode && { color: colors.textSecondary }]}
          >
            Chưa có thiết bị nào trong nhóm "{groupName}"
          </LocalizedText>
          {onAddDeviceToGroup && (
            <TouchableOpacity
              style={styles.addDeviceToGroupBtn}
              onPress={() => onAddDeviceToGroup(groupName)}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle" size={16} color="#7C3AED" />
              <LocalizedText style={styles.addDeviceToGroupBtnText}>
                Thêm thiết bị vào nhóm
              </LocalizedText>
            </TouchableOpacity>
          )}
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
    borderColor: '#FED7AA',
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
    backgroundColor: '#FFF7ED',
    borderBottomWidth: 1,
    borderBottomColor: '#FFEDD5',
  },
  groupCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupFolderIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupDynamicIconsCluster: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clusterIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupCardName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  groupCardMeta: {
    fontSize: 11,
    color: '#EA580C',
    marginTop: 1,
  },
  groupCardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupCountBadge: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 6,
  },
  groupCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EA580C',
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
  addDeviceToGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 12,
  },
  addDeviceToGroupBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#EA580C',
  },
  groupCardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#FFEDD5',
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupCardFooterAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  groupCardFooterAddText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#EA580C',
  },
});


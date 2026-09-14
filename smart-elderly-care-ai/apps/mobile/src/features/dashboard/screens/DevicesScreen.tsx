// DevicesScreen.tsx
// Màn hình Quản lý phần cứng và Thiết bị IoT (Tab 2 - Thiết bị)
// Thể hiện toàn bộ danh mục phần cứng trong Proposal Capstone 1 (Orange Pi 5, AMG8833, BLE Band, Camera)

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import AIBotIcon from '../../../components/AIBotIcon';
import { useVitalStore } from '../../../store/useVitalStore';

export default function DevicesScreen({ navigation }: any) {
  const { incidents } = useVitalStore();
  const hasUnreadAlerts = incidents.some((inc) => !inc.is_acknowledged);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main', { screen: 'Home' });
    }
  };
  const devices = [
    {
      id: 'dev-01',
      name: 'Orange Pi 5 - Edge AI Hub',
      sub: 'Rockchip RK3588S NPU • 32 FPS YOLO-Pose • EMQX MQTT',
      type: 'hub',
      status: 'Trực tuyến (24/7)',
      isOnline: true,
      icon: 'server',
      color: '#0284C7',
    },
    {
      id: 'dev-02',
      name: 'Ranger 2C 3MP-08F2',
      sub: 'Camera góc rộng • 2K Super HD • Đàm thoại 2 chiều',
      type: 'camera',
      status: 'Đang ghi hình',
      isOnline: true,
      icon: 'videocam',
      color: '#FF7A00',
    },
    {
      id: 'dev-03',
      name: 'Vòng đeo tay BLE Smartband',
      sub: 'Nhịp tim • SpO₂ • Gia tốc kế phát hiện va đập',
      type: 'ble',
      status: 'Pin 84% • Đang đeo',
      isOnline: true,
      icon: 'watch',
      color: '#10B981',
    },
    {
      id: 'dev-04',
      name: 'Cảm biến hồng ngoại AMG8833',
      sub: 'Ma trận nhiệt 8x8 IR • Sàng lọc sốt vùng trán',
      type: 'thermal',
      status: '36.8°C • Hoạt động tốt',
      isOnline: true,
      icon: 'thermometer',
      color: '#F59E0B',
    },
    {
      id: 'dev-05',
      name: 'Micro AI âm thanh YAMNet',
      sub: 'Phát hiện tiếng kêu cứu, la hét, tiếng ngã đập mạnh',
      type: 'audio',
      status: 'Đang lắng nghe',
      isOnline: true,
      icon: 'mic',
      color: '#8B5CF6',
    },
    {
      id: 'dev-06',
      name: 'Loa thông minh Hub (Voice Reminder)',
      sub: 'Phát giọng nói tiếng Việt nhắc nhở người cao tuổi (FR12)',
      type: 'speaker',
      status: 'Sẵn sàng',
      isOnline: true,
      icon: 'volume-high',
      color: '#EC4899',
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header with Back button and Add button */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeftGroup}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleBack}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thiết bị &amp; Cảm biến IoT</Text>
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => Alert.alert('Thêm thiết bị mới', 'Quét mã QR trên thân thiết bị hoặc bật Bluetooth để tìm kiếm.')}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.sectionSubtitle}>
          Hệ sinh thái giám sát đa phương thức (Multimodal Sensor Fusion)
        </Text>

        {devices.map((dev) => (
          <TouchableOpacity
            key={dev.id}
            style={styles.deviceCard}
            onPress={() => {
              if (dev.type === 'camera') {
                navigation.navigate('CameraDetail');
              } else {
                Alert.alert(dev.name, `${dev.sub}\nTrạng thái: ${dev.status}`);
              }
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.iconBox, { backgroundColor: `${dev.color}18` }]}>
              <Ionicons name={dev.icon as any} size={24} color={dev.color} />
            </View>

            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.deviceNameText}>{dev.name}</Text>
              <Text style={styles.deviceSubText} numberOfLines={2}>
                {dev.sub}
              </Text>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: dev.isOnline ? Colors.success : Colors.danger },
                  ]}
                />
                <Text style={styles.statusText}>{dev.status}</Text>
              </View>
            </View>

            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.bottomTabItem}
          onPress={() => navigation.navigate('Main', { screen: 'Home' })}
          activeOpacity={0.7}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="home-outline" size={25} color="#94A3B8" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomTabItem}
          onPress={() => navigation.navigate('Main', { screen: 'Alerts' })}
          activeOpacity={0.7}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="notifications-outline" size={25} color="#94A3B8" />
            {hasUnreadAlerts && <View style={styles.tabBadgeDot} />}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomTabItem}
          onPress={() => navigation.navigate('Main', { screen: 'AIAssistant' })}
          activeOpacity={0.7}
        >
          <AIBotIcon size={46} focused={false} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomTabItem}
          onPress={() => navigation.navigate('Main', { screen: 'Profile' })}
          activeOpacity={0.7}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="person-outline" size={25} color="#94A3B8" />
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    ...Shadows.card,
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
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  deviceSubText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  // Bottom Bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E2E8F0',
    borderTopWidth: 1,
    height: 62,
    paddingTop: 8,
    paddingBottom: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  bottomTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabBadgeDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.danger,
  },
});

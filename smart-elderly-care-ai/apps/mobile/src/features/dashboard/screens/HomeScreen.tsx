// HomeScreen.tsx
// Màn hình Trang chủ thiết kế lại khớp chính xác Hình 1 (Phong cách Smart Home Imou / Elderly Care)

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { useVitalStore } from '../../../store/useVitalStore';

export default function HomeScreen({ navigation }: any) {
  const {
    house,
    setHouseMode,
    camera,
    toggleCameraSleep,
    toggleCameraAIProtect,
    currentVitals,
  } = useVitalStore();

  const [isMicSpeaking, setIsMicSpeaking] = useState(false);
  const [houseSelectorVisible, setHouseSelectorVisible] = useState(false);

  const handleMicPress = () => {
    setIsMicSpeaking(!isMicSpeaking);
    Alert.alert(
      isMicSpeaking ? 'Đã tắt đàm thoại' : 'Đang bật đàm thoại 2 chiều 🎙️',
      isMicSpeaking
        ? 'Loa tại nhà đã đóng.'
        : 'Bạn đang kết nối trực tiếp đến loa và micro của camera phòng cụ bà.'
    );
  };

  const handleMultiView = () => {
    Alert.alert(
      'Nhiều chế độ xem',
      'Đang mở màn hình chia lưới 4 camera: Phòng khách, Phòng ngủ, Bếp, Ban công.'
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 1. Header: "Nhà của tôi v", Bell with badge, Add button */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.houseTitleRow}
          onPress={() => navigation.navigate('HouseDetail')}
          activeOpacity={0.7}
        >
          <Text style={styles.houseTitleText}>{house.name}</Text>
          <Ionicons name="chevron-down" size={16} color={Colors.textPrimary} style={{ marginLeft: 4 }} />
        </TouchableOpacity>

        <View style={styles.topRightActions}>
          <TouchableOpacity
            style={styles.iconCircleBtn}
            onPress={() => navigation.navigate('Alerts')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
            <View style={styles.redBadgeDot} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconCircleBtn, { marginLeft: 12 }]}
            onPress={() => navigation.navigate('Devices')}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={26} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 2. Quick Mode Selector: Xa, Tại nhà, Riêng tư */}
        <View style={styles.modesRow}>
          {/* Nút Xa */}
          <TouchableOpacity
            style={[
              styles.modePill,
              house.currentMode === 'AWAY' ? styles.modePillActiveAway : styles.modePillInactive,
            ]}
            onPress={() => setHouseMode('AWAY')}
            activeOpacity={0.8}
          >
            <View style={[styles.modeIconCircle, { backgroundColor: '#10B981' }]}>
              <Ionicons name="exit-outline" size={16} color="#FFF" />
            </View>
            <Text
              style={[
                styles.modePillText,
                house.currentMode === 'AWAY' ? { color: '#065F46', fontWeight: '700' } : { color: '#475569' },
              ]}
            >
              Xa
            </Text>
          </TouchableOpacity>

          {/* Nút Tại nhà */}
          <TouchableOpacity
            style={[
              styles.modePill,
              house.currentMode === 'HOME' ? styles.modePillActiveHome : styles.modePillInactive,
            ]}
            onPress={() => setHouseMode('HOME')}
            activeOpacity={0.8}
          >
            <View style={[styles.modeIconCircle, { backgroundColor: '#3B82F6' }]}>
              <Ionicons name="home" size={16} color="#FFF" />
            </View>
            {house.currentMode === 'HOME' && (
              <Text style={[styles.modePillText, { color: '#1D4ED8', fontWeight: '700' }]}>
                Tại nhà
              </Text>
            )}
          </TouchableOpacity>

          {/* Nút Riêng tư / Tắt tiếng */}
          <TouchableOpacity
            style={[
              styles.modePill,
              house.currentMode === 'PRIVACY' ? styles.modePillActivePrivacy : styles.modePillInactive,
            ]}
            onPress={() => setHouseMode('PRIVACY')}
            activeOpacity={0.8}
          >
            <View style={[styles.modeIconCircle, { backgroundColor: '#F59E0B' }]}>
              <Ionicons name="shield-outline" size={16} color="#FFF" />
            </View>
            {house.currentMode === 'PRIVACY' && (
              <Text style={[styles.modePillText, { color: '#B45309', fontWeight: '700' }]}>
                Riêng tư
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 3. Section Title: "Tất cả" & icon chế độ xem */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitleText}>Tất cả</Text>
          <View style={styles.viewLayoutIcons}>
            <View style={styles.dividerLineSmall} />
            <TouchableOpacity onPress={() => {}}>
              <Ionicons name="reorder-three-outline" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 4. Banner "Nhiều chế độ xem" (Multi-view) */}
        <TouchableOpacity
          style={styles.multiViewCard}
          onPress={handleMultiView}
          activeOpacity={0.9}
        >
          <Text style={styles.multiViewText}>Nhiều chế độ xem</Text>
          <View style={styles.playCircleBtn}>
            <Ionicons name="play" size={14} color={Colors.primary} style={{ marginLeft: 2 }} />
          </View>
        </TouchableOpacity>

        {/* 5. Main Device Card: Ranger 2C 3MP-08F2 (Screenshot 1) */}
        <View style={styles.cameraCard}>
          {/* Card Video Area (Clickable to open CameraDetail) */}
          <TouchableOpacity
            activeOpacity={0.95}
            onPress={() => navigation.navigate('CameraDetail')}
            style={styles.cameraPreviewBox}
          >
            {/* Ảnh phòng khách thực tế của người cao tuổi */}
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80',
              }}
              style={styles.cameraSnapshot}
              resizeMode="cover"
            />

            {/* Simulated Live Stream Overlay Header */}
            <View style={styles.cameraOverlayTop}>
              <Text style={styles.cameraNameOverlay}>{camera.name}</Text>
              <View style={styles.cameraStatusIcons}>
                <View style={styles.sdCardBadge}>
                  <Ionicons name="file-tray-full-outline" size={12} color="#FFF" />
                </View>
                <Ionicons name="wifi" size={14} color="#10B981" style={{ marginLeft: 6 }} />
                <TouchableOpacity style={{ marginLeft: 8 }} onPress={() => navigation.navigate('CameraDetail')}>
                  <Ionicons name="ellipsis-horizontal" size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* SmartCare Watermark góc dưới phải */}
            <View style={styles.watermarkTag}>
              <Text style={styles.watermarkText}>SmartCare AI</Text>
            </View>

            {/* Sleep Mode Overlay nếu đang ngủ */}
            {camera.isSleep && (
              <View style={styles.sleepOverlay}>
                <Ionicons name="eye-off" size={40} color="#CBD5E1" />
                <Text style={styles.sleepOverlayText}>Ống kính đang ở chế độ ngủ riêng tư</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* 3 Quick Action Buttons Under Video (Sleep, Mic, AI Shield) */}
          <View style={styles.cameraBottomToolbar}>
            {/* 1. Nút Sleep / Chế độ ngủ (Icon mắt nhắm) */}
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={toggleCameraSleep}
              activeOpacity={0.7}
            >
              <Ionicons
                name={camera.isSleep ? 'eye' : 'eye-off-outline'}
                size={22}
                color={camera.isSleep ? Colors.primary : Colors.textPrimary}
              />
            </TouchableOpacity>

            <View style={styles.toolDivider} />

            {/* 2. Nút Đàm thoại 2 chiều (Micro ở giữa) */}
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={handleMicPress}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isMicSpeaking ? 'mic' : 'mic-outline'}
                size={22}
                color={isMicSpeaking ? Colors.danger : Colors.textPrimary}
              />
            </TouchableOpacity>

            <View style={styles.toolDivider} />

            {/* 3. Nút Chế độ bảo vệ AI (Khiên AI) */}
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={toggleCameraAIProtect}
              activeOpacity={0.7}
            >
              <View style={styles.aiShieldContainer}>
                <Ionicons
                  name={camera.isAIProtect ? 'shield-checkmark' : 'shield-outline'}
                  size={20}
                  color={camera.isAIProtect ? Colors.aiBlue : Colors.textPrimary}
                />
                <Text
                  style={[
                    styles.aiShieldText,
                    { color: camera.isAIProtect ? Colors.aiBlue : Colors.textPrimary },
                  ]}
                >
                  AI
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* 6. Widget Tóm tắt Sinh hiệu thời gian thực (Proposal FR02) */}
        <View style={styles.vitalsSummaryCard}>
          <View style={styles.vitalsSummaryHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.livePulseDot} />
              <Text style={styles.vitalsSummaryTitle}>Sinh hiệu người cao tuổi (Trực tiếp)</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('AIAssistant')}>
              <Text style={styles.vitalsDetailLink}>Chi tiết &gt;</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.vitalsGrid}>
            <View style={styles.vitalItem}>
              <Ionicons name="heart" size={18} color="#EF4444" />
              <Text style={styles.vitalValText}>{currentVitals.heart_rate ?? 74} <Text style={styles.vitalUnit}>bpm</Text></Text>
              <Text style={styles.vitalLblText}>Nhịp tim</Text>
            </View>
            <View style={styles.vitalDivider} />

            <View style={styles.vitalItem}>
              <Ionicons name="water" size={18} color="#3B82F6" />
              <Text style={styles.vitalValText}>{currentVitals.spo2 ?? 98} <Text style={styles.vitalUnit}>%</Text></Text>
              <Text style={styles.vitalLblText}>SpO₂</Text>
            </View>
            <View style={styles.vitalDivider} />

            <View style={styles.vitalItem}>
              <Ionicons name="thermometer" size={18} color="#F59E0B" />
              <Text style={styles.vitalValText}>{currentVitals.skin_temp_max ?? 36.8} <Text style={styles.vitalUnit}>°C</Text></Text>
              <Text style={styles.vitalLblText}>AMG8833</Text>
            </View>
            <View style={styles.vitalDivider} />

            <View style={styles.vitalItem}>
              <Ionicons name="body" size={18} color="#10B981" />
              <Text style={[styles.vitalValText, { fontSize: 13, color: '#10B981' }]}>Bình thường</Text>
              <Text style={styles.vitalLblText}>YOLO-Pose</Text>
            </View>
          </View>
        </View>

        {/* 7. Dòng chữ kết thúc danh sách: "Không còn dữ liệu" */}
        <View style={styles.endOfListContainer}>
          <View style={styles.endLine} />
          <Text style={styles.endOfListText}>Không còn dữ liệu</Text>
          <View style={styles.endLine} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
  },
  houseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  houseTitleText: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  redBadgeDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.danger,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  // Quick Mode Pills
  modesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
    marginBottom: 20,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    ...Shadows.soft,
  },
  modePillActiveAway: {
    backgroundColor: '#E6F9F5',
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  modePillActiveHome: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  modePillActivePrivacy: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  modePillInactive: {
    backgroundColor: Colors.surface,
  },
  modeIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  modePillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Section Header "Tất cả"
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleText: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  viewLayoutIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dividerLineSmall: {
    width: 1,
    height: 14,
    backgroundColor: Colors.borderDark,
    marginRight: 8,
  },
  // Multi-view Banner
  multiViewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 16,
    ...Shadows.card,
  },
  multiViewText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  playCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Camera Card (Ranger 2C)
  cameraCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    ...Shadows.card,
  },
  cameraPreviewBox: {
    width: '100%',
    height: 200,
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  cameraSnapshot: {
    width: '100%',
    height: '100%',
  },
  cameraOverlayTop: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cameraNameOverlay: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  cameraStatusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sdCardBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    padding: 2,
  },
  watermarkTag: {
    position: 'absolute',
    bottom: 8,
    right: 12,
  },
  watermarkText: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.5,
  },
  sleepOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleepOverlayText: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 8,
    fontWeight: '600',
  },
  cameraBottomToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
  },
  toolBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  toolDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
  },
  aiShieldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  aiShieldText: {
    fontSize: 12,
    fontWeight: '800',
  },
  // Vitals Summary Card
  vitalsSummaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    ...Shadows.soft,
  },
  vitalsSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
    marginRight: 6,
  },
  vitalsSummaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  vitalsDetailLink: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  vitalsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 4,
  },
  vitalItem: {
    alignItems: 'center',
    flex: 1,
  },
  vitalValText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  vitalUnit: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  vitalLblText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  vitalDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
  },
  // End of list
  endOfListContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 20,
    gap: 12,
  },
  endLine: {
    width: 50,
    height: 1,
    backgroundColor: Colors.borderDark,
  },
  endOfListText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});

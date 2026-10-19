// ==============================================================================
// TỆP: HomeCameraCard.tsx
// PHÂN HỆ: Thẻ Camera AI Giám sát Trực tiếp trên Trang chủ (HomeScreen)
// TÁC GIẢ: Phan Nguyễn Giáng My
// MÔ TẢ CHỨC NĂNG:
//   - Hiển thị luồng hình ảnh trực tiếp (WebRTC Live View) của phòng người cao tuổi.
//   - Đồng bộ nhãn trạng thái bảo vệ theo chế độ ngôi nhà (Ở nhà, Vắng nhà, Tắt báo động)
//     và chế độ Ống kính riêng tư (Privacy Shutter).
//   - Cung cấp thanh công cụ điều khiển nhanh: Xem lại 24/48h, Đàm thoại 2 chiều,
//     Bật/Tắt AI phát hiện té ngã, Chế độ đa khung hình 2x2 (MultiView).
// ==============================================================================

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { Colors, Shadows } from '../../../theme/colors';

// Định nghĩa Props điều khiển trạng thái Camera và điều hướng màn hình
interface HomeCameraCardProps {
  cameraDisplayName: string;
  camera: {
    isSleep?: boolean;
    isAIProtect?: boolean;
    isLive?: boolean;
    [key: string]: any;
  };
  house: {
    currentMode?: string;
    [key: string]: any;
  };
  isDarkMode: boolean;
  colors: any;
  navigation: any;
  handleTogglePrivacyMode: () => void;
  handleMicPress: () => void;
  isMicSpeaking: boolean;
  handleToggleAIProtect: () => void;
}

export const HomeCameraCard: React.FC<HomeCameraCardProps> = ({
  cameraDisplayName,
  camera,
  house,
  isDarkMode,
  colors,
  navigation,
  handleTogglePrivacyMode,
  handleMicPress,
  isMicSpeaking,
  handleToggleAIProtect,
}) => {
  return (
    <View style={[styles.cameraCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
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

        {/* Live Stream Overlay Header: Tên thiết bị thân thiện & Badge WebRTC / Edge Hub */}
        <View style={styles.cameraOverlayTop}>
          <View style={styles.cameraTitleWithBadge}>
            <Text style={styles.cameraNameOverlay} numberOfLines={1}>
              {cameraDisplayName}
            </Text>
            {/* Badge trạng thái kết nối WebRTC / Live */}
            {camera.isSleep ? (
              <View style={styles.privacyLiveBadge}>
                <Ionicons name="eye-off" size={10} color="#F59E0B" style={{ marginRight: 4 }} />
                <Text style={styles.privacyLiveBadgeText}>Ống kính riêng tư • Đã che</Text>
              </View>
            ) : !camera.isAIProtect ? (
              <View style={styles.normalModeBadge}>
                <View style={styles.normalGrayDot} />
                <Text style={styles.normalModeBadgeText}>Chế độ thường • AI Tắt</Text>
              </View>
            ) : house.currentMode === 'AWAY' ? (
              <View style={styles.awayLiveBadge}>
                <View style={styles.liveGreenDot} />
                <Text style={styles.awayLiveBadgeText}>Vắng nhà • AI Giám sát 24/7</Text>
              </View>
            ) : house.currentMode === 'DISARM' ? (
              <View style={styles.disarmLiveBadge}>
                <MaterialCommunityIcons name="shield-off-outline" size={11} color="#E2E8F0" style={{ marginRight: 4 }} />
                <Text style={styles.disarmLiveBadgeText}>Tắt báo động • AI Trực tiếp</Text>
              </View>
            ) : (
              <View style={styles.liveWebRTCBadge}>
                <View style={styles.liveGreenDot} />
                <Text style={styles.liveWebRTCText}>Ở nhà • AI WebRTC</Text>
              </View>
            )}
          </View>

          <View style={styles.cameraStatusIcons}>
            <View style={styles.hubStatusPill}>
              <Text style={styles.hubStatusPillText}>Hub #01 Online</Text>
            </View>
            <Ionicons name="wifi" size={14} color="#10B981" style={{ marginLeft: 6 }} />
            <TouchableOpacity
              style={{ marginLeft: 8 }}
              onPress={() => navigation.navigate('CameraDetail')}
            >
              <Ionicons name="ellipsis-horizontal" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* SmartCare Watermark góc dưới phải */}
        <View style={styles.watermarkTag}>
          <Text style={styles.watermarkText}>SmartCare AI</Text>
        </View>

        {/* Privacy Mode Overlay: Màn hình đen che camera vật lý khi camera.isSleep = true */}
        {camera.isSleep ? (
          <View style={styles.privacyOverlay}>
            <View style={styles.privacyIconCircle}>
              <Ionicons name="eye-off" size={32} color="#F59E0B" />
            </View>
            <Text style={styles.privacyOverlayTitle}>Ống kính đang ở chế độ riêng tư</Text>
            <Text style={styles.privacyOverlaySub}>
              Ống kính camera đã cụp lại và che khung hình. Luồng trực tiếp tạm thời tắt.
            </Text>
            <TouchableOpacity
              style={styles.privacyDisableBtn}
              onPress={handleTogglePrivacyMode}
              activeOpacity={0.8}
            >
              <Ionicons name="eye" size={14} color="#FFF" style={{ marginRight: 4 }} />
              <Text style={styles.privacyDisableText}>Bật lại camera</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </TouchableOpacity>

      {/* NÚT TRUY CẬP NHANH: "Xem lại 24/48h" (Interactive Timeline Playback) ngay bên dưới video */}
      <TouchableOpacity
        style={[styles.playbackQuickBar, isDarkMode && { backgroundColor: colors.surfaceSubtle, borderBottomColor: colors.border }]}
        onPress={() => navigation.navigate('CameraDetail')}
        activeOpacity={0.8}
      >
        <View style={styles.playbackLeftBox}>
          <View style={styles.playbackIconCircle}>
            <Ionicons name="play-back" size={16} color={Colors.primary} />
          </View>
          <View>
            <Text style={[styles.playbackTitle, isDarkMode && { color: colors.textPrimary }]}>Xem lại 24/48h (Interactive Timeline Playback)</Text>
            <Text style={[styles.playbackSub, isDarkMode && { color: colors.textSecondary }]}>Bộ đệm RAM Edge Hub &amp; lưu trữ MinIO Cloud</Text>
          </View>
        </View>
        <View style={styles.playbackRightAction}>
          <Text style={styles.playbackBadgeText}>24h - 48h</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
        </View>
      </TouchableOpacity>

      {/* 3 Quick Action Buttons Under Video (Power/Standby, Mic, AI Shield) */}
      <View style={[styles.cameraBottomToolbar, isDarkMode && { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        {/* 1. Nút Chế độ riêng tư của camera (Con mắt: eye / eye-off) */}
        <TouchableOpacity
          style={styles.toolBtn}
          onPress={handleTogglePrivacyMode}
          activeOpacity={0.7}
        >
          <View style={styles.cameraPrivacyContainer}>
            <Ionicons
              name={camera.isSleep ? 'eye-off' : 'eye-outline'}
              size={20}
              color={camera.isSleep ? '#F59E0B' : (isDarkMode ? colors.textPrimary : Colors.textPrimary)}
            />
            <Text
              style={[
                styles.cameraPrivacyText,
                { color: camera.isSleep ? '#D97706' : (isDarkMode ? colors.textPrimary : Colors.textPrimary) },
              ]}
            >
              Riêng tư
            </Text>
          </View>
        </TouchableOpacity>

        <View style={[styles.toolDivider, isDarkMode && { backgroundColor: colors.border }]} />

        {/* 2. Nút Đàm thoại 2 chiều (Micro ở giữa) */}
        <TouchableOpacity
          style={styles.toolBtn}
          onPress={handleMicPress}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isMicSpeaking ? 'mic' : 'mic-outline'}
            size={22}
            color={isMicSpeaking ? Colors.danger : (isDarkMode ? colors.textPrimary : Colors.textPrimary)}
          />
        </TouchableOpacity>

        <View style={[styles.toolDivider, isDarkMode && { backgroundColor: colors.border }]} />

        {/* 3. Nút Chế độ bảo vệ AI (Khiên AI) */}
        <TouchableOpacity
          style={styles.toolBtn}
          onPress={handleToggleAIProtect}
          activeOpacity={0.7}
        >
          <View style={styles.aiShieldContainer}>
            {camera.isAIProtect ? (
              <Ionicons
                name="shield-checkmark"
                size={18}
                color="#2563EB"
              />
            ) : (
              <MaterialCommunityIcons
                name="shield-off-outline"
                size={18}
                color="#94A3B8"
              />
            )}
            <Text
              style={[
                styles.aiShieldText,
                { color: camera.isAIProtect ? '#2563EB' : '#94A3B8' },
              ]}
              numberOfLines={1}
            >
              {camera.isAIProtect ? 'AI Bảo vệ: Bật' : 'AI: Tắt'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cameraTitleWithBadge: {
    flexDirection: 'column',
    maxWidth: '55%',
  },
  cameraNameOverlay: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  liveWebRTCBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 4,
  },
  liveWebRTCText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#A7F3D0',
  },
  privacyLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  privacyLiveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FDE68A',
  },
  disarmLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    backgroundColor: 'rgba(100, 116, 139, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  disarmLiveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  normalModeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    backgroundColor: 'rgba(100, 116, 139, 0.45)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  normalGrayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
    marginRight: 4,
  },
  normalModeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  awayLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  awayLiveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#A7F3D0',
  },
  cameraStatusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hubStatusPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 0.8,
    borderColor: '#10B981',
  },
  hubStatusPillText: {
    color: '#E6F9F5',
    fontSize: 10,
    fontWeight: '700',
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
  privacyOverlay: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  privacyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  privacyOverlayTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  privacyOverlaySub: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 16,
  },
  privacyDisableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
  },
  privacyDisableText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  playbackQuickBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  playbackLeftBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  playbackIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  playbackTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  playbackSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  playbackRightAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playbackBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
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
    gap: 4,
  },
  aiShieldText: {
    fontSize: 11,
    fontWeight: '800',
  },
  cameraPrivacyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cameraPrivacyText: {
    fontSize: 12,
    fontWeight: '800',
  },
});


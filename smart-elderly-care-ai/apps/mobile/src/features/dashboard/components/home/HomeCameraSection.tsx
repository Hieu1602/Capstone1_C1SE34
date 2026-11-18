import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText as Text } from '../../../../i18n/LocalizedComponents';
import { Colors, Shadows } from '../../../../theme/colors';
import { HomeCameraCard } from '../HomeCameraCard';

interface HomeCameraSectionProps {
  isCameraExplicitlyBlocked: boolean;
  hasLinkedHouse: boolean;
  canViewCamera: boolean;
  hasValidCamera: boolean;
  effectiveCameraList: any[];
  cardWidth: number;
  activeCamIndex: number;
  setActiveCamIndex: (idx: number) => void;
  house: any;
  isDarkMode: boolean;
  colors: any;
  navigation: any;
  isOwnerOrAdmin: boolean;
  canManageDevices: boolean;
  isMicSpeaking: boolean;
  onMultiView: () => void;
  onTogglePrivacyMode: () => void;
  onMicPress: () => void;
  onToggleAIProtect: () => void;
}

export const HomeCameraSection: React.FC<HomeCameraSectionProps> = ({
  isCameraExplicitlyBlocked,
  hasLinkedHouse,
  canViewCamera,
  hasValidCamera,
  effectiveCameraList,
  cardWidth,
  activeCamIndex,
  setActiveCamIndex,
  house,
  isDarkMode,
  colors,
  navigation,
  isOwnerOrAdmin,
  canManageDevices,
  isMicSpeaking,
  onMultiView,
  onTogglePrivacyMode,
  onMicPress,
  onToggleAIProtect,
}) => {
  if (isCameraExplicitlyBlocked && hasLinkedHouse) {
    return (
      <View
        style={[
          styles.cameraBlockedCard,
          { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: isDarkMode ? '#334155' : '#E2E8F0' },
        ]}
      >
        <View style={styles.cameraBlockedIconBox}>
          <Ionicons name="videocam-off" size={32} color="#EF4444" />
        </View>
        <Text style={[styles.cameraBlockedTitle, { color: colors.textPrimary }]}>
          Camera an ninh đã bị khóa
        </Text>
        <Text style={[styles.cameraBlockedDesc, { color: colors.textSecondary }]}>
          Chủ hộ đã tắt quyền giám sát camera an ninh đối với tài khoản này. Vui lòng liên hệ Chủ hộ để được cấp quyền theo dõi.
        </Text>
        <View style={[styles.cameraBlockedBadge, isDarkMode && { backgroundColor: '#334155' }]}>
          <Ionicons name="lock-closed" size={13} color="#94A3B8" />
          <Text style={[styles.cameraBlockedBadgeText, isDarkMode && { color: '#94A3B8' }]}>
            Chưa được cấp quyền xem camera
          </Text>
        </View>
      </View>
    );
  }

  if (canViewCamera && hasValidCamera) {
    return (
      <>
        <TouchableOpacity
          style={[styles.multiViewCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={onMultiView}
          activeOpacity={0.9}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.multiViewText, isDarkMode && { color: colors.textPrimary }]}>Nhiều chế độ xem</Text>
            {effectiveCameraList.length > 1 && (
              <View style={styles.camCountBadge}>
                <Text style={styles.camCountBadgeText}>{effectiveCameraList.length} camera</Text>
              </View>
            )}
          </View>
          <View style={styles.playCircleBtn}>
            <Ionicons name="play" size={14} color={Colors.primary} style={{ marginLeft: 2 }} />
          </View>
        </TouchableOpacity>

        {effectiveCameraList.length === 1 ? (
          <HomeCameraCard
            cameraDisplayName={effectiveCameraList[0].name}
            camera={effectiveCameraList[0]}
            house={house}
            isDarkMode={isDarkMode}
            colors={colors}
            navigation={navigation}
            handleTogglePrivacyMode={onTogglePrivacyMode}
            handleMicPress={onMicPress}
            isMicSpeaking={isMicSpeaking}
            handleToggleAIProtect={onToggleAIProtect}
          />
        ) : (
          <View style={{ marginBottom: 16 }}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={cardWidth + 12}
              snapToAlignment="center"
              contentContainerStyle={{ gap: 12 }}
              onScroll={(e) => {
                const x = e.nativeEvent.contentOffset.x;
                const idx = Math.round(x / (cardWidth + 12));
                if (idx !== activeCamIndex && idx >= 0 && idx < effectiveCameraList.length) {
                  setActiveCamIndex(idx);
                }
              }}
              scrollEventThrottle={16}
            >
              {effectiveCameraList.map((cam, idx) => (
                <View key={cam.id || `cam-${idx}`} style={{ width: cardWidth }}>
                  <HomeCameraCard
                    cameraDisplayName={cam.name}
                    camera={cam}
                    house={house}
                    isDarkMode={isDarkMode}
                    colors={colors}
                    navigation={navigation}
                    handleTogglePrivacyMode={onTogglePrivacyMode}
                    handleMicPress={() => {
                      navigation.navigate('CameraDetail', {
                        cameraId: cam.id,
                        cameraName: cam.name,
                        room: cam.room || 'Phòng khách',
                        streamUrl: cam.streamUrl,
                      });
                    }}
                    isMicSpeaking={isMicSpeaking}
                    handleToggleAIProtect={onToggleAIProtect}
                  />
                </View>
              ))}
            </ScrollView>

            <View style={styles.carouselDotsRow}>
              {effectiveCameraList.map((_, idx) => (
                <View
                  key={`dot-${idx}`}
                  style={[
                    styles.carouselDot,
                    idx === activeCamIndex
                      ? [styles.carouselDotActive, { backgroundColor: Colors.primary }]
                      : [styles.carouselDotInactive, { backgroundColor: isDarkMode ? '#475569' : '#CBD5E1' }],
                  ]}
                />
              ))}
            </View>
          </View>
        )}
      </>
    );
  }

  if (canViewCamera && hasLinkedHouse) {
    return (
      <View
        style={[
          styles.cameraBlockedCard,
          { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: isDarkMode ? '#334155' : '#E2E8F0' },
        ]}
      >
        <View style={[styles.cameraBlockedIconBox, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]}>
          <Ionicons name="videocam-outline" size={32} color="#64748B" />
        </View>
        <Text style={[styles.cameraBlockedTitle, { color: colors.textPrimary }]}>
          Chưa kết nối Camera an ninh
        </Text>
        <Text style={[styles.cameraBlockedDesc, { color: colors.textSecondary }]}>
          {isOwnerOrAdmin
            ? 'Ngôi nhà chưa có camera an ninh. Vui lòng thêm camera để bắt đầu theo dõi bảo vệ.'
            : 'Ngôi nhà hiện chưa kết nối camera an ninh. Khi Chủ hộ kết nối camera, bạn sẽ có thể theo dõi trực tiếp tại đây.'}
        </Text>
        {isOwnerOrAdmin && canManageDevices && (
          <TouchableOpacity
            style={[styles.cameraBlockedBadge, { backgroundColor: Colors.primary, marginTop: 8 }]}
            onPress={() => navigation.navigate('Devices')}
          >
            <Ionicons name="add" size={14} color="#FFFFFF" />
            <Text style={[styles.cameraBlockedBadgeText, { color: '#FFFFFF', fontWeight: '700' }]}>
              Thêm Camera an ninh
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
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
  multiViewText: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  camCountBadge: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 0.8,
    borderColor: '#FED7AA',
  },
  camCountBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  playCircleBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' },
  carouselDotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: -4, marginBottom: 8 },
  carouselDot: { height: 6, borderRadius: 3 },
  carouselDotActive: { width: 20 },
  carouselDotInactive: { width: 6 },
  cameraBlockedCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cameraBlockedIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  cameraBlockedTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  cameraBlockedDesc: { fontSize: 13, lineHeight: 18, textAlign: 'center', paddingHorizontal: 12, marginBottom: 14 },
  cameraBlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  cameraBlockedBadgeText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
});

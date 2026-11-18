import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { Colors, Shadows } from '../../../theme/colors';
import { getAlertConfig, formatFriendlyTime } from '../utils/alertConfig';

interface IncidentAlertCardProps {
  inc: any;
  isDarkMode: boolean;
  colors: any;
  onPress: (item: any) => void;
  onQuickAcknowledge: (item: any, e?: any) => void;
  onRespondInvite: (item: any, action: 'accept' | 'reject') => void;
  onRespondJoinRequest: (item: any, action: 'accept' | 'reject') => void;
}

export const IncidentAlertCard: React.FC<IncidentAlertCardProps> = ({
  inc,
  isDarkMode,
  colors,
  onPress,
  onQuickAcknowledge,
  onRespondInvite,
  onRespondJoinRequest,
}) => {
  const { t } = useTranslation();
  const config = getAlertConfig(inc.alert_type, inc.notes || inc.note, inc.message);
  const isCriticalActive = config.isCritical && !inc.is_acknowledged;
  const isHandled = Boolean(inc.is_acknowledged);
  const friendlyTime = formatFriendlyTime(inc.created_at, (key, count) =>
    count === undefined ? t(key) : t(key, { count })
  );

  const isHouseRequestOrInvite =
    inc.alert_type === 'HOUSE_INVITE_PENDING' || inc.alert_type === 'HOUSE_JOIN_REQUEST';
  const isRejectedNote = Boolean(inc.notes?.includes('từ chối') || inc.note?.includes('từ chối'));

  const badgeBg =
    inc.is_acknowledged && isHouseRequestOrInvite
      ? isDarkMode ? 'rgba(22, 163, 74, 0.2)' : '#DCFCE7'
      : isDarkMode && config.badgeBg === '#FFF7ED'
      ? 'rgba(234, 88, 12, 0.2)'
      : config.badgeBg;

  const badgeColor = inc.is_acknowledged && isHouseRequestOrInvite ? '#16A34A' : config.badgeColor;

  const badgeLabel =
    inc.is_acknowledged && inc.alert_type === 'HOUSE_INVITE_PENDING'
      ? isRejectedNote ? t('Đã từ chối') : t('Đã tham gia')
      : inc.is_acknowledged && inc.alert_type === 'HOUSE_JOIN_REQUEST'
      ? isRejectedNote ? t('Đã từ chối') : t('Đã đồng ý')
      : t(config.badgeText);

  const iconBg = isDarkMode
    ? isCriticalActive
      ? 'rgba(220, 38, 38, 0.25)'
      : isHandled
      ? 'rgba(16, 185, 129, 0.12)'
      : 'rgba(255, 255, 255, 0.08)'
    : isCriticalActive
    ? '#FEE2E2'
    : isHandled
    ? '#ECFDF5'
    : config.iconBg;

  const renderHouseActionRow = () => {
    const isInvite = inc.alert_type === 'HOUSE_INVITE_PENDING';
    const handler = isInvite ? onRespondInvite : onRespondJoinRequest;
    const acceptLabel = isInvite ? 'Xác nhận vào nhà' : 'Cho phép vào nhà';

    return (
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        <TouchableOpacity style={styles.actionBtnReject} onPress={() => handler(inc, 'reject')} activeOpacity={0.7}>
          <Ionicons name="close-circle-outline" size={14} color="#DC2626" />
          <Text style={styles.actionBtnRejectText}>Từ chối</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtnAccept} onPress={() => handler(inc, 'accept')} activeOpacity={0.7}>
          <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
          <Text style={styles.actionBtnAcceptText}>{acceptLabel}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isDarkMode && { backgroundColor: colors.card, borderColor: colors.border },
        isCriticalActive && styles.cardCritical,
        isCriticalActive && isDarkMode && { backgroundColor: '#3F1219', borderColor: '#7F1D1D' },
        !inc.is_acknowledged && styles.cardUnread,
        isHandled && styles.cardHandled,
        isHandled && isDarkMode && { backgroundColor: '#131B2E', borderColor: '#1E293B' },
      ]}
      onPress={() => onPress(inc)}
      activeOpacity={0.8}
    >
      <View style={[styles.categoryIconCircle, { backgroundColor: iconBg }]}>
        <Ionicons
          name={isHandled ? 'checkmark-circle' : config.iconName}
          size={22}
          color={isHandled ? '#10B981' : isCriticalActive ? '#EF4444' : config.iconColor}
        />
      </View>

      <View style={styles.cardCenter}>
        <View style={styles.cardMetaRow}>
          <View style={[styles.typeBadge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.typeBadgeText, { color: badgeColor }]}>{badgeLabel}</Text>
          </View>
          {!inc.is_acknowledged ? (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>{t('MỚI')}</Text>
            </View>
          ) : (
            <View style={styles.handledBadge}>
              <Ionicons name="checkmark-circle" size={10} color="#16A34A" />
              <Text style={styles.handledBadgeText}>{t('ĐÃ XỬ LÝ')}</Text>
            </View>
          )}
        </View>

        <Text
          style={[
            styles.cardTitle,
            isDarkMode && { color: colors.textPrimary },
            isCriticalActive && styles.cardTitleCritical,
            isHandled && { color: isDarkMode ? '#94A3B8' : '#64748B' },
          ]}
          numberOfLines={2}
        >
          {t(config.title)}
        </Text>

        <Text style={[styles.cardMsg, isDarkMode && { color: colors.textSecondary }]} numberOfLines={2}>
          {inc.message}
        </Text>

        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={12} color={isDarkMode ? '#64748B' : '#94A3B8'} />
          <Text style={[styles.cardTime, isDarkMode && { color: colors.textSecondary }]}>{friendlyTime}</Text>
          <Text style={[styles.dotSeparator, isDarkMode && { color: colors.border }]}>•</Text>
          <Text
            style={[styles.deviceLocationText, isDarkMode && { color: colors.textSecondary }]}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {inc.alert_type === 'HOUSE_MEMBER_ADDED' || inc.alert_type === 'MEMBER_ADDED'
              ? t('Ngôi nhà')
              : inc.device_id
              ? `${t('Thiết bị')}: ${inc.device_id}`
              : t('Hệ thống AI')}
          </Text>
        </View>

        {!inc.is_acknowledged && isHouseRequestOrInvite && (
          <View style={styles.cardQuickActionRow}>
            {renderHouseActionRow()}
          </View>
        )}

        {inc.is_acknowledged && isHouseRequestOrInvite && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <Ionicons name="checkmark-done-circle" size={15} color="#16A34A" />
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#16A34A' }}>
              {isRejectedNote ? 'Đã từ chối' : 'Đã hoàn tất xác nhận'}
            </Text>
          </View>
        )}
      </View>

      {inc.thumbnail_url && (
        <View style={styles.thumbWrapper}>
          <Image source={{ uri: inc.thumbnail_url }} style={styles.thumbImg} />
          <View style={styles.thumbOverlay}>
            {inc.video_clip_url && (
              <View style={styles.playCenterBtn}>
                <Ionicons name="play" size={12} color="#FFFFFF" style={{ marginLeft: 2 }} />
              </View>
            )}
            {inc.video_clip_url && (
              <View style={styles.playTag}>
                <Text style={styles.playTagText}>5s Clip</Text>
              </View>
            )}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...Shadows.soft,
  },
  cardCritical: { backgroundColor: '#FFF1F2', borderWidth: 1.5, borderColor: '#FECACA' },
  cardHandled: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', opacity: 0.9 },
  cardUnread: { borderLeftWidth: 3.5, borderLeftColor: '#FF6B00' },
  categoryIconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  cardCenter: { flex: 1 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  typeBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  typeBadgeText: { fontSize: 9.5, fontWeight: '800' },
  newBadge: { backgroundColor: '#EF4444', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1.5 },
  newBadgeText: { color: '#FFF', fontSize: 8.5, fontWeight: '800' },
  handledBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1.5 },
  handledBadgeText: { color: '#16A34A', fontSize: 9, fontWeight: '800' },
  cardTitle: { fontSize: 13.5, fontWeight: '700', color: Colors.textPrimary, lineHeight: 19, marginBottom: 3 },
  cardTitleCritical: { color: '#DC2626', fontWeight: '800' },
  cardMsg: { fontSize: 12.5, color: '#475569', lineHeight: 18, marginBottom: 6 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardTime: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  dotSeparator: { fontSize: 10, color: '#CBD5E1', marginHorizontal: 2 },
  deviceLocationText: { fontSize: 11, color: '#94A3B8', fontWeight: '500', flexShrink: 1 },
  cardQuickActionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  actionBtnAccept: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#16A34A', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  actionBtnAcceptText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  actionBtnReject: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  actionBtnRejectText: { fontSize: 12, fontWeight: '600', color: '#DC2626' },
  thumbWrapper: { width: 76, height: 58, borderRadius: 12, overflow: 'hidden', backgroundColor: '#E2E8F0', marginTop: 2 },
  thumbImg: { width: '100%', height: '100%', borderRadius: 12 },
  thumbOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.25)', justifyContent: 'center', alignItems: 'center' },
  playCenterBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0, 0, 0, 0.55)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.7)' },
  playTag: { position: 'absolute', bottom: 3, right: 3, backgroundColor: 'rgba(0, 0, 0, 0.7)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  playTagText: { color: '#FFFFFF', fontSize: 8, fontWeight: '700' },
});

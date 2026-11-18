import React from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText } from '../../../../i18n/LocalizedComponents';
import type { UnifiedNotification } from './notificationHelpers';

interface NotificationListItemProps {
  item: UnifiedNotification;
  respondingId: string | null;
  isDarkMode: boolean;
  colors: any;
  border: string;
  textSub: string;
  onPress: (item: UnifiedNotification) => void;
  onRespondInvite: (item: UnifiedNotification, action: 'accept' | 'reject') => void;
}

export const NotificationListItem: React.FC<NotificationListItemProps> = ({
  item,
  respondingId,
  isDarkMode,
  colors,
  border,
  textSub,
  onPress,
  onRespondInvite,
}) => (
  <View
    style={[
      styles.card,
      {
        backgroundColor: item.isRead ? (isDarkMode ? '#0F172A66' : '#F8FAFC') : (isDarkMode ? '#1E293B' : '#FFFFFF'),
        borderColor: item.isRead ? border : (isDarkMode ? '#2563EB66' : '#93C5FD'),
        borderWidth: item.isRead ? 1 : 1.5,
      },
    ]}
  >
    <TouchableOpacity style={styles.cardMainRow} activeOpacity={0.75} onPress={() => onPress(item)}>
      <View style={[styles.iconBox, { backgroundColor: item.badgeBg }]}>
        <Ionicons name={item.iconName} size={20} color={item.iconColor} />
        {!item.isRead && <View style={styles.cardUnreadDot} />}
      </View>

      <View style={styles.cardBody}>
        <LocalizedText
          style={[
            styles.itemTitle,
            { color: item.isRead ? (isDarkMode ? '#94A3B8' : '#64748B') : colors.textPrimary },
            !item.isRead && { fontWeight: '700' },
          ]}
          numberOfLines={2}
        >
          {item.title}
        </LocalizedText>
        <LocalizedText style={[styles.itemSub, { color: textSub }]} numberOfLines={2}>
          {item.subtitle}
        </LocalizedText>
      </View>

      <View style={styles.cardRightCol}>
        <View style={[styles.statusTag, { backgroundColor: item.badgeBg }]}>
          <LocalizedText style={[styles.statusText, { color: item.badgeColor }]}>{item.badgeLabel}</LocalizedText>
        </View>
        {item.isRead ? (
          <View style={styles.readBadge}>
            <Ionicons name="checkmark-done" size={11} color="#059669" style={{ marginRight: 2 }} />
            <LocalizedText style={styles.readBadgeText}>Đã đọc</LocalizedText>
          </View>
        ) : (
          <View style={styles.unreadBadge}>
            <LocalizedText style={styles.unreadBadgeText}>Chưa đọc</LocalizedText>
          </View>
        )}
      </View>
    </TouchableOpacity>

    {item.type === 'HOUSE_INVITE' && !item.isRead && (
      <View style={styles.inviteActionRow}>
        <TouchableOpacity
          style={[
            styles.sheetRejectBtn,
            { borderColor: isDarkMode ? '#7F1D1D' : '#FECACA', backgroundColor: isDarkMode ? '#450A0A' : '#FEF2F2' },
          ]}
          onPress={() => onRespondInvite(item, 'reject')}
          activeOpacity={0.7}
          disabled={respondingId === item.id}
        >
          {respondingId === item.id ? (
            <ActivityIndicator size="small" color="#DC2626" />
          ) : (
            <>
              <Ionicons name="close-circle-outline" size={14} color="#DC2626" />
              <LocalizedText style={styles.sheetRejectBtnText}>Từ chối</LocalizedText>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sheetAcceptBtn, { backgroundColor: '#16A34A' }]}
          onPress={() => onRespondInvite(item, 'accept')}
          activeOpacity={0.8}
          disabled={respondingId === item.id}
        >
          {respondingId === item.id ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={14} color="#FFFFFF" />
              <LocalizedText style={styles.sheetAcceptBtnText}>Đồng ý vào nhà</LocalizedText>
            </>
          )}
        </TouchableOpacity>
      </View>
    )}
  </View>
);

const styles = StyleSheet.create({
  card: { borderRadius: 12, padding: 12, marginBottom: 8 },
  cardMainRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inviteActionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#CBD5E1' },
  sheetRejectBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, gap: 4 },
  sheetRejectBtnText: { fontSize: 12, fontWeight: '700', color: '#DC2626' },
  sheetAcceptBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, gap: 4 },
  sheetAcceptBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  cardUnreadDot: { position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB', borderWidth: 1.5, borderColor: '#FFFFFF' },
  cardBody: { flex: 1, gap: 3 },
  itemTitle: { fontSize: 13.5 },
  itemSub: { fontSize: 11.5 },
  cardRightCol: { alignItems: 'flex-end', gap: 4 },
  statusTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 10.5, fontWeight: '700' },
  readBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#A7F3D0' },
  readBadgeText: { fontSize: 10, fontWeight: '700', color: '#059669' },
  unreadBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#BFDBFE' },
  unreadBadgeText: { fontSize: 10, fontWeight: '700', color: '#2563EB' },
});

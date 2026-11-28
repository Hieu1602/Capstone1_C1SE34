import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PatientCardData } from '../types';
import { UnifiedNotification, formatDate, getMedicalRecommendation } from './notificationHelpers';

interface NotificationDetailViewProps {
  item: UnifiedNotification;
  /** Thời điểm bác sĩ đã đọc (ISO), đồng bộ với Doctor Web */
  readAt?: string;
  warningPatients: PatientCardData[];
  respondingId: string | null;
  isDarkMode: boolean;
  colors: any;
  border: string;
  textSub: string;
  onBack: () => void;
  onClose: () => void;
  onNavigate: (item: UnifiedNotification) => void;
  onRespondInvite: (item: UnifiedNotification, action: 'accept' | 'reject') => void;
}

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

export const NotificationDetailView: React.FC<NotificationDetailViewProps> = ({
  item,
  readAt,
  warningPatients,
  respondingId,
  isDarkMode,
  colors,
  border,
  textSub,
  onBack,
  onClose,
  onNavigate,
  onRespondInvite,
}) => {
  const linkedPatient =
    warningPatients.find((p) => p.id === item.patientId) ||
    (item.rawAppointment
      ? {
          name: item.rawAppointment.patient_name,
          house_address: item.rawAppointment.location,
          house_name: '',
          heart_rate: undefined,
          spo2: undefined,
        }
      : undefined);

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.header, { borderBottomColor: border }]}>
        <TouchableOpacity
          onPress={onBack}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color="#2563EB" />
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#2563EB' }}>Quay lại</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.textPrimary }]}>Chi tiết thông báo</Text>

        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={22} color={textSub} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.detailScrollContent} showsVerticalScrollIndicator={false}>
        {/* Thẻ Tiêu đề & Cảnh báo */}
        <View style={[styles.detailCard, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', borderColor: border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={[styles.iconBox, { backgroundColor: item.badgeBg }]}>
              <Ionicons name={item.iconName} size={22} color={item.iconColor} />
            </View>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <View style={[styles.statusTag, { backgroundColor: item.badgeBg }]}>
                <Text style={[styles.statusText, { color: item.badgeColor }]}>{item.badgeLabel}</Text>
              </View>
              <View style={styles.readBadge}>
                <Ionicons name="checkmark-done" size={11} color="#059669" style={{ marginRight: 2 }} />
                <Text style={styles.readBadgeText}>Đã xem</Text>
              </View>
            </View>
          </View>

          <Text style={[styles.detailMainTitle, { color: colors.textPrimary }]}>{item.title}</Text>
          <Text style={[styles.detailSubTitle, { color: textSub }]}>{item.subtitle}</Text>

          <View style={[styles.detailMetaRow, { borderTopColor: border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="time-outline" size={14} color={textSub} />
              <Text style={{ fontSize: 11.5, color: textSub }}>
                {item.timeStr ? formatDate(item.timeStr) || 'Hôm nay' : 'Hôm nay'}
              </Text>
            </View>
            <View style={styles.syncTag}>
              <Ionicons name="flash" size={11} color="#059669" />
              <Text style={styles.syncTagText}>Đồng bộ thời gian thực</Text>
            </View>
          </View>
          {readAt ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
              <Ionicons name="checkmark-done-outline" size={14} color={textSub} />
              <Text style={{ fontSize: 11.5, color: textSub }}>Đã đọc lúc {fmtDateTime(readAt)}</Text>
            </View>
          ) : null}
          {item.rawIncident?.is_acknowledged && item.rawIncident?.acknowledged_at ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Ionicons name="shield-checkmark-outline" size={14} color="#059669" />
              <Text style={{ fontSize: 11.5, color: '#059669' }}>
                Đã xử lý{item.rawIncident.acknowledged_by_name ? ` bởi ${item.rawIncident.acknowledged_by_name}` : ''} lúc{' '}
                {fmtDateTime(item.rawIncident.acknowledged_at)}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Thông tin bệnh nhân phụ trách */}
        {item.type !== 'ADMIN' && (
          <View
            style={[
              styles.detailCard,
              {
                backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF88',
                borderColor: isDarkMode ? '#1E3A8A' : '#BFDBFE',
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="person-circle" size={18} color="#2563EB" />
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563EB', textTransform: 'uppercase' }}>
                Thông tin bệnh nhân liên quan
              </Text>
            </View>
            <View style={{ gap: 6, marginTop: 4 }}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: textSub }]}>Bệnh nhân:</Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                  {linkedPatient?.name || item.rawAppointment?.patient_name || 'Người cao tuổi'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: textSub }]}>Khu vực / Căn nhà:</Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]} numberOfLines={1}>
                  {linkedPatient?.house_address || linkedPatient?.house_name || item.rawAppointment?.location || 'Nhà riêng bệnh nhân'}
                </Text>
              </View>
              {(item.type === 'INCIDENT' || item.type === 'PATIENT_WARNING') && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: textSub }]}>Thiết bị theo dõi:</Text>
                  <Text
                    style={[
                      styles.infoValue,
                      { color: (linkedPatient as any)?.is_online ? '#059669' : textSub, fontWeight: '700' },
                    ]}
                  >
                    {(linkedPatient as any)?.is_online ? 'Smartband (Đang kết nối)' : 'Smartband (Ngoại tuyến)'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Thẻ chỉ số sinh hiệu */}
        {(item.type === 'INCIDENT' || item.type === 'PATIENT_WARNING') && (
          <View style={[styles.detailCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="heart" size={16} color="#DC2626" />
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, textTransform: 'uppercase' }}>
                Chỉ số sinh hiệu tại thời điểm phát hiện
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              <View style={[styles.vitalCard, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#DC2626' }}>Nhịp tim</Text>
                  <Ionicons name="pulse" size={14} color="#DC2626" />
                </View>
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#DC2626', marginTop: 4 }}>
                  {linkedPatient?.heart_rate ?? '--'} <Text style={{ fontSize: 11, fontWeight: '600' }}>bpm</Text>
                </Text>
              </View>

              <View style={[styles.vitalCard, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#059669' }}>SpO2</Text>
                  <Ionicons name="water" size={14} color="#059669" />
                </View>
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#059669', marginTop: 4 }}>
                  {linkedPatient?.spo2 ?? '--'} <Text style={{ fontSize: 11, fontWeight: '600' }}>%</Text>
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Khuyến nghị chuyên môn Bác sĩ */}
        <View style={[styles.detailCard, { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9', borderColor: border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="medkit" size={16} color="#2563EB" />
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>Khuyến nghị chuyên môn Bác sĩ</Text>
          </View>
          <Text style={{ fontSize: 12, color: textSub, lineHeight: 18, marginTop: 4 }}>
            {getMedicalRecommendation(item.type)}
          </Text>
        </View>

        {/* Các nút hành động thao tác */}
        <View style={{ gap: 10, marginTop: 10, marginBottom: 20 }}>
          {item.type === 'HOUSE_INVITE' && !item.isRead ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.actionBtnReject, { flex: 1 }]}
                onPress={() => onRespondInvite(item, 'reject')}
                disabled={respondingId === item.id}
              >
                <Text style={styles.actionBtnRejectText}>Từ chối</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtnAccept, { flex: 1 }]}
                onPress={() => onRespondInvite(item, 'accept')}
                disabled={respondingId === item.id}
              >
                <Text style={styles.actionBtnAcceptText}>Đồng ý vào nhà</Text>
              </TouchableOpacity>
            </View>
          ) : item.type === 'ADMIN' ? (
            <TouchableOpacity style={[styles.actionBtnSecondary, { borderColor: border }]} onPress={onBack}>
              <Text style={[styles.actionBtnSecondaryText, { color: colors.textPrimary }]}>Quay lại danh sách thông báo</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => onNavigate(item)}>
                <Ionicons name={item.type === 'APPOINTMENT' ? 'calendar-outline' : 'person-outline'} size={16} color="#FFFFFF" />
                <Text style={styles.actionBtnPrimaryText}>
                  {item.type === 'APPOINTMENT' ? 'Xem lịch khám chi tiết' : 'Xem hồ sơ bệnh nhân'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionBtnSecondary, { borderColor: border }]} onPress={onBack}>
                <Text style={[styles.actionBtnSecondaryText, { color: colors.textPrimary }]}>Quay lại danh sách thông báo</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  title: { fontSize: 16, fontWeight: '700' },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  statusTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 10.5, fontWeight: '700' },
  readBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#A7F3D0' },
  readBadgeText: { fontSize: 10, fontWeight: '700', color: '#059669' },
  detailScrollContent: { padding: 16, paddingBottom: 36, gap: 12 },
  detailCard: { borderRadius: 14, padding: 14, borderWidth: 1, gap: 8 },
  detailMainTitle: { fontSize: 16, fontWeight: '700', lineHeight: 22, marginTop: 4 },
  detailSubTitle: { fontSize: 13, lineHeight: 19 },
  detailMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 10, marginTop: 4 },
  syncTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECFDF5', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  syncTagText: { fontSize: 10.5, fontWeight: '700', color: '#059669' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 12 },
  infoValue: { fontSize: 12.5, fontWeight: '600' },
  vitalCard: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1 },
  actionBtnPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563EB', paddingVertical: 13, borderRadius: 12 },
  actionBtnPrimaryText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },
  actionBtnSecondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  actionBtnSecondaryText: { fontSize: 13, fontWeight: '600' },
  actionBtnReject: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  actionBtnRejectText: { color: '#DC2626', fontSize: 13, fontWeight: '700' },
  actionBtnAccept: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: '#16A34A' },
  actionBtnAcceptText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});

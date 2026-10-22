import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { ConditionItem, PatientDetail } from './types';

interface PatientRecordTabProps {
  detail: PatientDetail | null;
  isDarkMode: boolean;
  colors: any;
  onOpenNotesModal: () => void;
  onOpenAddCondition: () => void;
  onOpenEditCondition: (c: ConditionItem) => void;
  onDeleteCondition: (id: string, name: string) => void;
  onOpenAllergiesDietModal: () => void;
}

export const PatientRecordTab: React.FC<PatientRecordTabProps> = ({
  detail,
  isDarkMode,
  colors,
  onOpenNotesModal,
  onOpenAddCondition,
  onOpenEditCondition,
  onDeleteCondition,
  onOpenAllergiesDietModal,
}) => {
  return (
    <View>
      {/* Ghi chú & dặn dò */}
      <View style={[styles.sectionBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: '#3B82F644' }]}>
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="chatbox-ellipses" size={17} color={Colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Ghi chú & Dặn dò Bác sĩ</Text>
          </View>
          <TouchableOpacity style={styles.btnActionSmall} onPress={onOpenNotesModal}>
            <Ionicons name="create-outline" size={13} color={Colors.primary} style={{ marginRight: 2 }} />
            <Text style={styles.btnActionSmallText}>Chỉnh sửa</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.notesQuoteBox, { borderLeftColor: Colors.primary }]}>
          <Text style={[styles.notesBody, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>
            {detail?.doctor_notes ? `"${detail.doctor_notes}"` : 'Chưa có ghi chú từ bác sĩ.'}
          </Text>
        </View>

        {detail?.next_appointment ? (
          <View style={styles.appointmentBadge}>
            <Ionicons name="calendar-outline" size={14} color="#0284C7" />
            <Text style={styles.appointmentText}>Tái khám: {detail.next_appointment}</Text>
          </View>
        ) : null}
      </View>

      {/* Danh mục bệnh lý nền */}
      <View style={[styles.sectionBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
            <Ionicons name="fitness" size={17} color="#EF4444" style={{ marginRight: 6 }} />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Danh mục Bệnh lý nền</Text>
          </View>
          <TouchableOpacity
            style={[styles.btnActionSmall, { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' }]}
            onPress={onOpenAddCondition}
          >
            <Ionicons name="add" size={14} color="#2563EB" style={{ marginRight: 2 }} />
            <Text style={[styles.btnActionSmallText, { color: '#2563EB' }]}>Thêm bệnh</Text>
          </TouchableOpacity>
        </View>

        {!detail?.conditions || detail.conditions.length === 0 ? (
          <Text style={[styles.emptyHintText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            Chưa có danh mục bệnh nền. Chạm "Thêm bệnh" để bổ sung.
          </Text>
        ) : (
          detail.conditions.map((c: ConditionItem) => {
            const isDanger = c.severity === 'danger';
            const isWarn = c.severity === 'warning';
            const badgeBg = isDanger ? '#FEE2E2' : isWarn ? '#FEF3C7' : '#E0F2FE';
            const badgeTextColor = isDanger ? '#DC2626' : isWarn ? '#D97706' : '#0369A1';
            const badgeLabel = isDanger ? 'Nguy cơ cao' : isWarn ? 'Cần theo dõi' : 'Ổn định';

            return (
              <View
                key={c.id}
                style={[
                  styles.conditionCardItem,
                  { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: colors.border },
                ]}
              >
                <View style={styles.conditionCardTop}>
                  <View style={[styles.severityPill, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.severityPillText, { color: badgeTextColor }]}>{badgeLabel}</Text>
                  </View>
                  <View style={styles.conditionActionRow}>
                    <TouchableOpacity style={styles.iconActionBtn} onPress={() => onOpenEditCondition(c)}>
                      <Ionicons name="pencil" size={13} color="#0284C7" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.iconActionBtn, { marginLeft: 6 }]}
                      onPress={() => onDeleteCondition(c.id, c.name)}
                    >
                      <Ionicons name="trash-outline" size={13} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={[styles.conditionName, { color: colors.textPrimary }]}>{c.name}</Text>
                {c.note ? (
                  <Text style={[styles.conditionNote, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                    {c.note}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </View>

      {/* Dị ứng & Dinh dưỡng */}
      <View style={[styles.sectionBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="nutrition" size={17} color="#16A34A" style={{ marginRight: 6 }} />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Dị ứng & Dinh dưỡng</Text>
          </View>
          <TouchableOpacity style={styles.btnActionSmall} onPress={onOpenAllergiesDietModal}>
            <Ionicons name="create-outline" size={13} color={Colors.primary} style={{ marginRight: 2 }} />
            <Text style={styles.btnActionSmallText}>Chỉnh sửa</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.dietSubCard, { backgroundColor: isDarkMode ? '#450A0A33' : '#FEF2F2', borderColor: '#FCA5A5' }]}>
          <View style={styles.dietSubHeader}>
            <Ionicons name="warning" size={15} color="#DC2626" style={{ marginRight: 6 }} />
            <Text style={[styles.dietSubTitle, { color: '#DC2626' }]}>Dị ứng thuốc</Text>
          </View>
          <Text style={[styles.dietSubContent, { color: isDarkMode ? '#FCA5A5' : '#991B1B' }]}>
            {detail?.drug_allergies || 'Không có dị ứng thuốc ghi nhận.'}
          </Text>
        </View>

        <View style={[styles.dietSubCard, { backgroundColor: isDarkMode ? '#451A0333' : '#FFFBEB', borderColor: '#FCD34D', marginTop: 8 }]}>
          <View style={styles.dietSubHeader}>
            <Ionicons name="restaurant" size={15} color="#D97706" style={{ marginRight: 6 }} />
            <Text style={[styles.dietSubTitle, { color: '#D97706' }]}>Dị ứng thực phẩm</Text>
          </View>
          <Text style={[styles.dietSubContent, { color: isDarkMode ? '#FDE68A' : '#92400E' }]}>
            {detail?.food_allergies || 'Không có dị ứng thực phẩm ghi nhận.'}
          </Text>
        </View>

        <View style={[styles.dietSubCard, { backgroundColor: isDarkMode ? '#064E3B33' : '#ECFDF5', borderColor: '#6EE7B7', marginTop: 8 }]}>
          <View style={styles.dietSubHeader}>
            <Ionicons name="leaf" size={15} color="#059669" style={{ marginRight: 6 }} />
            <Text style={[styles.dietSubTitle, { color: '#059669' }]}>Chế độ ăn khuyến nghị</Text>
          </View>
          <Text style={[styles.dietSubContent, { color: isDarkMode ? '#A7F3D0' : '#065F46' }]}>
            {detail?.dietary_notes || 'Ăn uống bình thường, đảm bảo dinh dưỡng.'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sectionBox: { borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 14 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700' },
  btnActionSmall: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#CBD5E1' },
  btnActionSmallText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  notesQuoteBox: { borderLeftWidth: 3, paddingLeft: 10, marginVertical: 4 },
  notesBody: { fontSize: 12.5, lineHeight: 18, fontStyle: 'italic' },
  appointmentBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  appointmentText: { fontSize: 11.5, fontWeight: '600', color: '#0284C7' },

  emptyHintText: { fontSize: 12, fontStyle: 'italic', marginVertical: 6 },
  conditionCardItem: { borderRadius: 10, padding: 10, borderWidth: 1, marginBottom: 8 },
  conditionCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  severityPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  severityPillText: { fontSize: 9.5, fontWeight: '800' },
  conditionActionRow: { flexDirection: 'row' },
  iconActionBtn: { padding: 4 },
  conditionName: { fontSize: 13.5, fontWeight: '700' },
  conditionNote: { fontSize: 11.5, marginTop: 2 },

  dietSubCard: { borderRadius: 8, padding: 10, borderWidth: 1 },
  dietSubHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  dietSubTitle: { fontSize: 12, fontWeight: '700' },
  dietSubContent: { fontSize: 11.5, lineHeight: 16 },
});

// PatientDetailComponents.tsx
// Tập hợp các component cho màn hình Chi tiết Bệnh nhân (Bác sĩ):
// 1. PatientHeroCard: Card Header tổng quan bệnh nhân (Avatar, tuổi, địa chỉ, Face ID, dải 4 sinh hiệu tức thời)
// 2. PatientRecordTab: Ghi chú bác sĩ, danh mục bệnh lý nền & dị ứng/dinh dưỡng
// 3. PatientPrescriptionsTab: Kê đơn & danh mục thuốc đang điều trị
// 4. PatientVitalsTab: Cấu hình ngưỡng sinh hiệu & nút mở báo cáo đồ thị

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { BASE_URL } from '../../../services/api';
import { ConditionItem, PatientDetail, PrescriptionItem } from './types';

// =============================================================
// 1. CARD HERO TỔNG QUAN BỆNH NHÂN (PatientHeroCard)
// =============================================================
export interface PatientHeroCardProps {
  detail: PatientDetail | null;
  isDarkMode: boolean;
  colors: any;
  onViewAnalytics: () => void;
}

export const PatientHeroCard: React.FC<PatientHeroCardProps> = ({
  detail,
  isDarkMode,
  colors,
  onViewAnalytics,
}) => {
  const patientName = detail?.name || 'Bệnh nhân';
  const initialLetter = patientName.trim().split(/\s+/).slice(-1)[0]?.[0]?.toUpperCase() || 'A';

  const metaParts = [
    detail?.age ? `${detail.age} tuổi` : null,
    detail?.gender ? detail.gender : null,
    detail?.blood_type ? `Nhóm máu ${detail.blood_type}` : null,
    detail?.bmi ? `BMI: ${detail.bmi}` : null,
  ].filter(Boolean);

  return (
    <View style={[heroStyles.heroCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
      <View style={heroStyles.heroRow}>
        <View style={heroStyles.avatarBig}>
          {detail?.avatar_url ? (
            <Image
              source={{
                uri: detail.avatar_url.startsWith('http')
                  ? detail.avatar_url
                  : `${BASE_URL.replace('/api/v1', '')}${detail.avatar_url}`,
              }}
              style={heroStyles.avatarBigImg}
            />
          ) : (
            <Text style={heroStyles.avatarBigText}>{initialLetter}</Text>
          )}
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={heroStyles.heroNameRow}>
            <Text style={[heroStyles.heroName, { color: colors.textPrimary }]} numberOfLines={1}>
              {patientName}
            </Text>
            {detail?.age ? (
              <View style={heroStyles.badgeAge}>
                <Text style={heroStyles.badgeAgeText}>{detail.age} tuổi</Text>
              </View>
            ) : null}
          </View>

          {metaParts.length > 0 ? (
            <Text style={[heroStyles.heroSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
              {metaParts.join(' • ')}
            </Text>
          ) : null}

          {detail?.house_name || detail?.house_address ? (
            <Text style={[heroStyles.heroAddress, { color: isDarkMode ? '#CBD5E1' : '#475569' }]} numberOfLines={1}>
              📍 {[detail?.house_name, detail?.house_address].filter(Boolean).join(' • ')}
            </Text>
          ) : null}

          {/* Huy hiệu Face ID */}
          <View style={heroStyles.faceIdPillRow}>
            <View
              style={[
                heroStyles.faceIdPill,
                detail?.has_face_enrolled
                  ? { backgroundColor: isDarkMode ? '#064E3B' : '#DCFCE7', borderColor: '#10B981' }
                  : { backgroundColor: isDarkMode ? '#451A03' : '#FEF3C7', borderColor: '#F59E0B' },
              ]}
            >
              <Ionicons
                name={detail?.has_face_enrolled ? 'scan-circle' : 'scan-outline'}
                size={12}
                color={detail?.has_face_enrolled ? '#10B981' : '#F59E0B'}
              />
              <Text style={[heroStyles.faceIdPillText, { color: detail?.has_face_enrolled ? '#047857' : '#B45309' }]}>
                {detail?.has_face_enrolled ? 'AI Face ID: Đã đăng ký' : 'Khuôn mặt: Chưa đăng ký'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Dải 4 sinh hiệu tức thời */}
      <View style={heroStyles.metricsBar}>
        <View style={heroStyles.metricItem}>
          <Text style={[heroStyles.metricVal, { color: '#EF4444' }]}>
            {detail?.heart_rate ?? '--'} <Text style={heroStyles.metricUnit}>bpm</Text>
          </Text>
          <Text style={heroStyles.metricLabel}>Nhịp tim</Text>
        </View>
        <View style={heroStyles.metricDivider} />
        <View style={heroStyles.metricItem}>
          <Text style={[heroStyles.metricVal, { color: '#0284C7' }]}>
            {detail?.spo2 ? `${detail.spo2}%` : '--'}
          </Text>
          <Text style={heroStyles.metricLabel}>SpO₂</Text>
        </View>
        <View style={heroStyles.metricDivider} />
        <View style={heroStyles.metricItem}>
          <Text style={[heroStyles.metricVal, { color: '#10B981' }]}>
            {detail?.blood_pressure || '--'}
          </Text>
          <Text style={heroStyles.metricLabel}>Huyết áp</Text>
        </View>
        <View style={heroStyles.metricDivider} />
        <View style={heroStyles.metricItem}>
          <Text style={[heroStyles.metricVal, { color: '#F59E0B' }]}>
            {detail?.skin_temp_max ? `${detail.skin_temp_max}°C` : '--'}
          </Text>
          <Text style={heroStyles.metricLabel}>Nhiệt độ</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[heroStyles.heroReportBtn, { backgroundColor: isDarkMode ? '#0284C722' : '#E0F2FE' }]}
        activeOpacity={0.85}
        onPress={onViewAnalytics}
      >
        <Ionicons name="bar-chart" size={15} color="#0284C7" style={{ marginRight: 6 }} />
        <Text style={heroStyles.heroReportBtnText}>Xem Báo Cáo & Phân Tích Sinh Hiệu</Text>
        <Ionicons name="chevron-forward" size={14} color="#0284C7" />
      </TouchableOpacity>
    </View>
  );
};

// =============================================================
// 2. TAB BỆNH ÁN & BỆNH LÝ NỀN (PatientRecordTab)
// =============================================================
export interface PatientRecordTabProps {
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
      <View style={[tabStyles.sectionBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: '#3B82F644' }]}>
        <View style={tabStyles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="chatbox-ellipses" size={17} color={Colors.primary} style={{ marginRight: 6 }} />
            <Text style={[tabStyles.sectionTitle, { color: colors.textPrimary }]}>Ghi chú & Dặn dò Bác sĩ</Text>
          </View>
          <TouchableOpacity style={tabStyles.btnActionSmall} onPress={onOpenNotesModal}>
            <Ionicons name="create-outline" size={13} color={Colors.primary} style={{ marginRight: 2 }} />
            <Text style={tabStyles.btnActionSmallText}>Chỉnh sửa</Text>
          </TouchableOpacity>
        </View>

        <Text style={[tabStyles.notesContent, { color: isDarkMode ? '#E2E8F0' : '#334155' }]}>
          {detail?.doctor_notes || 'Chưa có lời dặn dò y tế nào cho bệnh nhân này.'}
        </Text>

        <View style={tabStyles.nextApptBox}>
          <Ionicons name="calendar-outline" size={14} color={Colors.primary} style={{ marginRight: 6 }} />
          <Text style={[tabStyles.nextApptText, { color: colors.textPrimary }]}>
            Lịch tái khám dự kiến:{' '}
            <Text style={{ fontWeight: '700', color: Colors.primary }}>
              {detail?.next_appointment || 'Chưa lên lịch'}
            </Text>
          </Text>
        </View>
      </View>

      {/* Danh mục bệnh lý nền */}
      <View style={[tabStyles.sectionBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
        <View style={tabStyles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="pulse" size={17} color="#DC2626" style={{ marginRight: 6 }} />
            <Text style={[tabStyles.sectionTitle, { color: colors.textPrimary }]}>
              Bệnh lý nền ({detail?.conditions?.length || 0})
            </Text>
          </View>
          <TouchableOpacity style={tabStyles.btnActionSmall} onPress={onOpenAddCondition}>
            <Ionicons name="add" size={14} color={Colors.primary} style={{ marginRight: 2 }} />
            <Text style={tabStyles.btnActionSmallText}>Thêm</Text>
          </TouchableOpacity>
        </View>

        {(!detail?.conditions || detail.conditions.length === 0) ? (
          <Text style={{ fontSize: 12.5, color: '#94A3B8', fontStyle: 'italic', marginVertical: 6 }}>
            Chưa có bệnh lý nền nào được ghi nhận.
          </Text>
        ) : (
          detail.conditions.map((item) => {
            const isDanger = item.severity === 'danger';
            const isWarning = item.severity === 'warning';
            return (
              <View
                key={item.id}
                style={[
                  tabStyles.conditionRow,
                  {
                    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                    borderColor: isDanger ? '#EF444455' : isWarning ? '#F59E0B55' : colors.border,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[tabStyles.conditionName, { color: colors.textPrimary }]}>{item.name}</Text>
                    <View
                      style={[
                        tabStyles.badgeSeverity,
                        {
                          backgroundColor: isDanger ? '#FEE2E2' : isWarning ? '#FEF3C7' : '#DCFCE7',
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '700',
                          color: isDanger ? '#DC2626' : isWarning ? '#B45309' : '#059669',
                        }}
                      >
                        {isDanger ? 'Nguy cơ cao' : isWarning ? 'Cảnh báo' : 'Thông tin'}
                      </Text>
                    </View>
                  </View>
                  {item.note ? (
                    <Text style={[tabStyles.conditionNote, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                      {item.note}
                    </Text>
                  ) : null}
                </View>

                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity onPress={() => onOpenEditCondition(item)}>
                    <Ionicons name="create-outline" size={18} color="#0284C7" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => onDeleteCondition(item.id, item.name)}>
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Dị ứng & Dinh dưỡng */}
      <View style={[tabStyles.sectionBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
        <View style={tabStyles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="warning" size={17} color="#F59E0B" style={{ marginRight: 6 }} />
            <Text style={[tabStyles.sectionTitle, { color: colors.textPrimary }]}>Dị ứng & Chế độ Dinh dưỡng</Text>
          </View>
          <TouchableOpacity style={tabStyles.btnActionSmall} onPress={onOpenAllergiesDietModal}>
            <Ionicons name="create-outline" size={13} color={Colors.primary} style={{ marginRight: 2 }} />
            <Text style={tabStyles.btnActionSmallText}>Cập nhật</Text>
          </TouchableOpacity>
        </View>

        <View style={{ gap: 8 }}>
          <View style={[tabStyles.dietSubCard, { backgroundColor: isDarkMode ? '#0F172A' : '#FEF2F2', borderColor: '#FCA5A5' }]}>
            <View style={tabStyles.dietSubHeader}>
              <Ionicons name="alert-circle" size={14} color="#EF4444" style={{ marginRight: 4 }} />
              <Text style={[tabStyles.dietSubTitle, { color: '#DC2626' }]}>Dị ứng thuốc & thực phẩm:</Text>
            </View>
            <Text style={[tabStyles.dietSubContent, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>
              {detail?.drug_allergies || detail?.food_allergies
                ? [detail.drug_allergies ? `Thuốc: ${detail.drug_allergies}` : null, detail.food_allergies ? `Thức ăn: ${detail.food_allergies}` : null].filter(Boolean).join(' • ')
                : 'Không có dị ứng nào được báo cáo.'}
            </Text>
          </View>

          <View style={[tabStyles.dietSubCard, { backgroundColor: isDarkMode ? '#0F172A' : '#EFF6FF', borderColor: '#BFDBFE' }]}>
            <View style={tabStyles.dietSubHeader}>
              <Ionicons name="nutrition" size={14} color="#0284C7" style={{ marginRight: 4 }} />
              <Text style={[tabStyles.dietSubTitle, { color: '#0284C7' }]}>Chế độ ăn khuyến nghị:</Text>
            </View>
            <Text style={[tabStyles.dietSubContent, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>
              {detail?.dietary_notes || 'Chưa thiết lập chế độ dinh dưỡng chuyên biệt.'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

// =============================================================
// 3. TAB ĐƠN THUỐC (PatientPrescriptionsTab)
// =============================================================
export interface PatientPrescriptionsTabProps {
  prescriptions: PrescriptionItem[];
  isDarkMode: boolean;
  colors: any;
  onOpenCreatePrescription?: () => void;
  onOpenAddModal?: () => void;
  onOpenEditPrescription?: (item: PrescriptionItem) => void;
  onOpenEditModal?: (item: PrescriptionItem) => void;
  onDeletePrescription: (id: string, name: string) => void;
  onToggleSpeakerReminder?: (id: string) => void | Promise<any>;
  onToggleSpeaker?: (item: PrescriptionItem) => void;
}

export const PatientPrescriptionsTab: React.FC<PatientPrescriptionsTabProps> = ({
  prescriptions,
  isDarkMode,
  colors,
  onOpenCreatePrescription,
  onOpenAddModal,
  onOpenEditPrescription,
  onOpenEditModal,
  onDeletePrescription,
  onToggleSpeakerReminder,
  onToggleSpeaker,
}) => {
  const handleAdd = onOpenCreatePrescription || onOpenAddModal || (() => {});
  const handleEdit = onOpenEditPrescription || onOpenEditModal || (() => {});
  const handleToggle = (item: PrescriptionItem) => {
    if (onToggleSpeakerReminder) onToggleSpeakerReminder(item.id);
    else if (onToggleSpeaker) onToggleSpeaker(item);
  };

  return (
    <View>
      <TouchableOpacity style={tabStyles.btnPrescribeNew} onPress={handleAdd} activeOpacity={0.85}>
        <Ionicons name="add-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
        <Text style={tabStyles.btnPrescribeNewText}>Kê Đơn Thuốc Mới</Text>
      </TouchableOpacity>

      {prescriptions.length === 0 ? (
        <View style={tabStyles.emptyBox}>
          <Ionicons name="medkit-outline" size={42} color="#94A3B8" />
          <Text style={{ fontSize: 13, color: '#94A3B8', marginTop: 8, textAlign: 'center' }}>
            Bệnh nhân chưa có đơn thuốc nào đang điều trị.
          </Text>
        </View>
      ) : (
        prescriptions.map((item) => (
          <View
            key={item.id}
            style={[
              tabStyles.rxCard,
              {
                backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                borderColor: colors.border,
              },
            ]}
          >
            <View style={tabStyles.rxHeader}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[tabStyles.rxMedName, { color: colors.textPrimary }]}>{item.medication_name}</Text>
                <Text style={[tabStyles.rxDosage, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  Liều: <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{item.dosage}</Text> • {item.frequency || 'Hằng ngày'}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  tabStyles.speakerToggleBtn,
                  item.enable_speaker_reminder
                    ? { backgroundColor: isDarkMode ? '#064E3B' : '#DCFCE7', borderColor: '#10B981' }
                    : { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9', borderColor: colors.border },
                ]}
                onPress={() => handleToggle(item)}
              >
                <Ionicons
                  name={item.enable_speaker_reminder ? 'volume-high' : 'volume-mute'}
                  size={14}
                  color={item.enable_speaker_reminder ? '#10B981' : '#94A3B8'}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    tabStyles.speakerToggleBtnText,
                    { color: item.enable_speaker_reminder ? '#047857' : '#94A3B8' },
                  ]}
                >
                  {item.enable_speaker_reminder ? 'Loa: BẬT' : 'Loa: TẮT'}
                </Text>
              </TouchableOpacity>
            </View>

            {item.schedule_times && item.schedule_times.length > 0 && (
              <View style={tabStyles.rxScheduleRow}>
                <Text style={[tabStyles.rxScheduleLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  Giờ uống:
                </Text>
                {item.schedule_times.map((t, idx) => (
                  <View key={idx} style={tabStyles.timeTag}>
                    <Ionicons name="alarm-outline" size={11} color="#0284C7" style={{ marginRight: 3 }} />
                    <Text style={tabStyles.timeTagText}>{t}</Text>
                  </View>
                ))}
              </View>
            )}

            {item.instructions ? (
              <Text style={[tabStyles.rxInstructions, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>
                📝 {item.instructions}
              </Text>
            ) : null}

            <View style={tabStyles.rxActionRow}>
              <Text style={[tabStyles.rxDoctorCredit, { color: isDarkMode ? '#64748B' : '#94A3B8' }]}>
                Kê bởi: {item.doctor_name || 'Bác sĩ'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={tabStyles.rxEditBtn} onPress={() => handleEdit(item)}>
                  <Ionicons name="create-outline" size={13} color="#0284C7" style={{ marginRight: 2 }} />
                  <Text style={tabStyles.rxEditBtnText}>Sửa</Text>
                </TouchableOpacity>
                <TouchableOpacity style={tabStyles.rxDeleteBtn} onPress={() => onDeletePrescription(item.id, item.medication_name)}>
                  <Ionicons name="trash-outline" size={13} color="#EF4444" style={{ marginRight: 2 }} />
                  <Text style={tabStyles.rxDeleteBtnText}>Xóa</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))
      )}
    </View>
  );
};

// =============================================================
// 4. TAB THEO DÕI SINH HIỆU (PatientVitalsTab)
// =============================================================
export interface PatientVitalsTabProps {
  detail?: PatientDetail | null;
  hrHigh?: string;
  hrLow?: string;
  spo2Low?: string;
  isDarkMode: boolean;
  colors: any;
  onOpenThresholdModal: () => void;
  onViewAnalytics: () => void;
}

export const PatientVitalsTab: React.FC<PatientVitalsTabProps> = ({
  detail,
  hrHigh,
  hrLow,
  spo2Low,
  isDarkMode,
  colors,
  onOpenThresholdModal,
  onViewAnalytics,
}) => {
  return (
    <View>
      <View style={[tabStyles.sectionBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
        <View style={tabStyles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="options" size={17} color="#2563EB" style={{ marginRight: 6 }} />
            <Text style={[tabStyles.sectionTitle, { color: colors.textPrimary }]}>Ngưỡng Cảnh Báo Sinh Hiệu Cá Nhân Hóa</Text>
          </View>
          <TouchableOpacity style={tabStyles.btnActionSmall} onPress={onOpenThresholdModal}>
            <Ionicons name="create-outline" size={13} color={Colors.primary} style={{ marginRight: 2 }} />
            <Text style={tabStyles.btnActionSmallText}>Cấu hình</Text>
          </TouchableOpacity>
        </View>

        <View style={{ gap: 8 }}>
          <View style={tabStyles.thresholdRow}>
            <Text style={tabStyles.thresholdLabel}>Nhịp tim tối thiểu (Min):</Text>
            <Text style={[tabStyles.thresholdVal, { color: colors.textPrimary }]}>
              {hrLow ? `${hrLow} bpm` : '50 bpm (Chuẩn)'}
            </Text>
          </View>
          <View style={tabStyles.thresholdRow}>
            <Text style={tabStyles.thresholdLabel}>Nhịp tim tối đa (Max):</Text>
            <Text style={[tabStyles.thresholdVal, { color: colors.textPrimary }]}>
              {hrHigh ? `${hrHigh} bpm` : '110 bpm (Chuẩn)'}
            </Text>
          </View>
          <View style={[tabStyles.thresholdRow, { borderBottomWidth: 0 }]}>
            <Text style={tabStyles.thresholdLabel}>Ngưỡng suy hô hấp SpO₂ Min:</Text>
            <Text style={[tabStyles.thresholdVal, { color: '#DC2626' }]}>
              {spo2Low ? `${spo2Low}%` : '93% (Chuẩn)'}
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={tabStyles.btnOpenAnalytics} onPress={onViewAnalytics} activeOpacity={0.85}>
        <Ionicons name="analytics" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
        <Text style={tabStyles.btnOpenAnalyticsText}>Mở Báo Cáo & Phân Tích Chi Tiết</Text>
      </TouchableOpacity>
    </View>
  );
};

const heroStyles = StyleSheet.create({
  heroCard: { borderRadius: 16, padding: 16, borderWidth: 1, elevation: 2, marginBottom: 14 },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  avatarBig: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarBigImg: { width: '100%', height: '100%' },
  avatarBigText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroName: { fontSize: 16.5, fontWeight: '800', flex: 1, marginRight: 6 },
  badgeAge: { backgroundColor: '#F1F5F9', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  badgeAgeText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  heroSub: { fontSize: 11.5, marginTop: 2 },
  heroAddress: { fontSize: 11, marginTop: 2 },
  faceIdPillRow: { flexDirection: 'row', marginTop: 6 },
  faceIdPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, borderWidth: 1, gap: 4 },
  faceIdPillText: { fontSize: 10, fontWeight: '700' },
  metricsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC33',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 12,
  },
  metricItem: { flex: 1, alignItems: 'center' },
  metricVal: { fontSize: 14, fontWeight: '800' },
  metricUnit: { fontSize: 10, fontWeight: '400' },
  metricLabel: { fontSize: 10, color: '#94A3B8', marginTop: 1 },
  metricDivider: { width: 1, height: 24, backgroundColor: '#CBD5E1' },
  heroReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  heroReportBtnText: { fontSize: 12.5, fontWeight: '700', color: '#0284C7' },
});

const tabStyles = StyleSheet.create({
  sectionBox: { borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 12 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 13.5, fontWeight: '800' },
  btnActionSmall: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: '#EFF6FF' },
  btnActionSmallText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  notesContent: { fontSize: 12.5, lineHeight: 18 },
  nextApptBox: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#CBD5E1' },
  nextApptText: { fontSize: 12 },
  conditionRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 6 },
  badgeSeverity: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  conditionName: { fontSize: 13.5, fontWeight: '700' },
  conditionNote: { fontSize: 11.5, marginTop: 2 },
  dietSubCard: { borderRadius: 8, padding: 10, borderWidth: 1 },
  dietSubHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  dietSubTitle: { fontSize: 12, fontWeight: '700' },
  dietSubContent: { fontSize: 11.5, lineHeight: 16 },
  btnPrescribeNew: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  btnPrescribeNewText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  rxCard: { borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 10 },
  rxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rxMedName: { fontSize: 14.5, fontWeight: '700' },
  rxDosage: { fontSize: 11.5, marginTop: 2 },
  speakerToggleBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  speakerToggleBtnText: { fontSize: 10, fontWeight: '700' },
  rxScheduleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  rxScheduleLabel: { fontSize: 11 },
  timeTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  timeTagText: { fontSize: 10.5, fontWeight: '700', color: '#0284C7' },
  rxInstructions: { fontSize: 11.5, marginTop: 6, lineHeight: 16 },
  rxActionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E2E8F066' },
  rxDoctorCredit: { fontSize: 11 },
  rxEditBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5, backgroundColor: '#EFF6FF' },
  rxEditBtnText: { fontSize: 11, color: '#0284C7', fontWeight: '700' },
  rxDeleteBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5, backgroundColor: '#FEE2E2' },
  rxDeleteBtnText: { fontSize: 11, color: '#EF4444', fontWeight: '700' },
  thresholdRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E8F044' },
  thresholdLabel: { fontSize: 12, color: '#64748B' },
  thresholdVal: { fontSize: 12.5, fontWeight: '700' },
  btnOpenAnalytics: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563EB', paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  btnOpenAnalyticsText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});


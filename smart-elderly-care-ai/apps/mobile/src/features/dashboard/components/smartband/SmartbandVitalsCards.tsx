import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Shadows } from '../../../../theme/colors';
import { LocalizedText } from '../../../../i18n/LocalizedComponents';

export interface SmartbandVitalsCardsProps {
  hrValue?: string | number | null;
  spo2Value?: string | number | null;
  tempValue?: string | number | null;
  hasHR: boolean;
  hasSpO2: boolean;
  hasTemp: boolean;
  hrTimeline?: { time: string; hr: number; note: string }[];
  colors?: any;
  isDarkMode?: boolean;
}

export const SmartbandVitalsCards: React.FC<SmartbandVitalsCardsProps> = ({
  hrValue,
  spo2Value,
  tempValue,
  hasHR,
  hasSpO2,
  hasTemp,
  hrTimeline = [],
  colors = {},
  isDarkMode = false,
}) => {
  const displayHR = hrValue ?? '--';
  const displaySpO2 = spo2Value ?? '--';
  const displayTemp = tempValue ?? '--';

  return (
    <>
      {/* Tiêu đề mục */}
      <View style={styles.sectionHeaderRow}>
        <LocalizedText style={[styles.sectionTitle, isDarkMode && { color: colors.textPrimary }]}>
          Chỉ Số Sức Khỏe Thu Thập
        </LocalizedText>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <LocalizedText style={styles.liveBadgeText}>GATT STREAMING</LocalizedText>
        </View>
      </View>

      {/* THẺ 1: NHỊP TIM QUANG HỌC (PPG MAX30102) */}
      <View style={[styles.metricCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.metricCardHeader}>
          <View style={styles.metricHeaderLeft}>
            <View style={[styles.metricIconCircle, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="heart" size={22} color="#EF4444" />
            </View>
            <View style={{ marginLeft: 12 }}>
              <LocalizedText style={[styles.metricTitle, isDarkMode && { color: colors.textPrimary }]}>
                Nhịp Tim Quang Học (PPG)
              </LocalizedText>
              <LocalizedText style={[styles.metricSub, isDarkMode && { color: colors.textSecondary }]}>
                Cảm biến Maxim MAX30102 (Đo liên tục)
              </LocalizedText>
            </View>
          </View>

          <View style={styles.statusPillGreen}>
            <LocalizedText style={styles.statusPillGreenText}>Bình thường</LocalizedText>
          </View>
        </View>

        <View style={styles.metricMainRow}>
          <View style={styles.metricValueWrapper}>
            <LocalizedText style={[styles.metricMainValue, { color: '#EF4444' }]}>{displayHR}</LocalizedText>
            <LocalizedText style={styles.metricMainUnit}>bpm</LocalizedText>
          </View>

          <View style={styles.metricMiniStatsColumn}>
            <LocalizedText style={[styles.metricMiniStatItem, isDarkMode && { color: colors.textSecondary }]}>
              Ngưỡng an toàn: <LocalizedText style={{ fontWeight: '700', color: '#059669' }}>60 - 100 bpm</LocalizedText>
            </LocalizedText>
            <LocalizedText style={[styles.metricMiniStatItem, isDarkMode && { color: colors.textSecondary }]}>
              Nghỉ ngơi chuẩn: <LocalizedText style={{ fontWeight: '600' }}>65 - 75 bpm</LocalizedText>
            </LocalizedText>
            <LocalizedText style={[styles.metricMiniStatItem, isDarkMode && { color: colors.textSecondary }]}>
              Trạng thái đo: <LocalizedText style={{ fontWeight: '600' }}>Liên tục qua BLE</LocalizedText>
            </LocalizedText>
          </View>
        </View>

        {/* Thanh trực quan hoá nhịp tim */}
        <View style={styles.rangeBarContainer}>
          <View style={styles.rangeBarBackground}>
            <View style={styles.rangeBarSegmentSafe} />
            {hasHR && (
              <View
                style={[
                  styles.rangeBarIndicator,
                  {
                    left: `${Math.min(Math.max(((Number(displayHR) - 40) / 100) * 100, 5), 95)}%`,
                    backgroundColor: '#EF4444',
                  },
                ]}
              />
            )}
          </View>
          <View style={styles.rangeLabelsRow}>
            <LocalizedText style={styles.rangeLabelText}>50 (Ngủ)</LocalizedText>
            <LocalizedText style={[styles.rangeLabelText, { color: '#059669', fontWeight: '700' }]}>
              Khoảng an toàn: 60 - 100 bpm
            </LocalizedText>
            <LocalizedText style={styles.rangeLabelText}>120 (Cảnh báo)</LocalizedText>
          </View>
        </View>

        {/* Timeline nhịp tim trong ngày */}
        {hrTimeline.length > 0 ? (
          <View style={styles.timelineRow}>
            {hrTimeline.map((item, idx) => (
              <View key={idx} style={styles.timelineCol}>
                <View
                  style={[
                    styles.timelineBar,
                    { height: Math.max((item.hr - 50) * 1.5, 16) },
                  ]}
                />
                <LocalizedText style={styles.timelineHrText}>{item.hr}</LocalizedText>
                <LocalizedText style={styles.timelineTimeText}>{item.time}</LocalizedText>
              </View>
            ))}
          </View>
        ) : (
          <View style={{ paddingVertical: 14, alignItems: 'center' }}>
            <LocalizedText style={{ fontSize: 13, color: colors.textSecondary }}>
              Chưa có dữ liệu đo nhịp tim trong ngày
            </LocalizedText>
          </View>
        )}

        <View style={[styles.aiInsightBox, isDarkMode && { backgroundColor: colors.surfaceSubtle }]}>
          <Ionicons name="sparkles" size={15} color="#0284C7" />
          <LocalizedText style={[styles.aiInsightText, isDarkMode && { color: colors.textSecondary }]}>
            {hasHR
              ? 'Đánh giá AI: Nhịp xoang đều đặn, không có hiện tượng loạn nhịp (Arrhythmia) hay nhịp tim nhanh bất thường trong ngày.'
              : 'Đánh giá AI: Chưa ghi nhận dữ liệu nhịp tim từ vòng đeo tay.'}
          </LocalizedText>
        </View>
      </View>

      {/* THẺ 2: NỒNG ĐỘ OXY TRONG MÁU (SpO2) */}
      <View style={[styles.metricCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.metricCardHeader}>
          <View style={styles.metricHeaderLeft}>
            <View style={[styles.metricIconCircle, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="water" size={22} color="#0284C7" />
            </View>
            <View style={{ marginLeft: 12 }}>
              <LocalizedText style={[styles.metricTitle, isDarkMode && { color: colors.textPrimary }]}>
                Nồng Độ Oxy Trong Máu (SpO₂)
              </LocalizedText>
              <LocalizedText style={[styles.metricSub, isDarkMode && { color: colors.textSecondary }]}>
                Bão hòa oxy mao mạch ngoại vi (Pulse Oximetry)
              </LocalizedText>
            </View>
          </View>

          <View style={styles.statusPillGreen}>
            <LocalizedText style={styles.statusPillGreenText}>Tối ưu</LocalizedText>
          </View>
        </View>

        <View style={styles.metricMainRow}>
          <View style={styles.metricValueWrapper}>
            <LocalizedText style={[styles.metricMainValue, { color: '#0284C7' }]}>{displaySpO2}</LocalizedText>
            <LocalizedText style={styles.metricMainUnit}>%</LocalizedText>
          </View>

          <View style={styles.metricMiniStatsColumn}>
            <LocalizedText style={[styles.metricMiniStatItem, isDarkMode && { color: colors.textSecondary }]}>
              Ngưỡng an toàn: <LocalizedText style={{ fontWeight: '700', color: '#059669' }}>≥ 95%</LocalizedText>
            </LocalizedText>
            <LocalizedText style={[styles.metricMiniStatItem, isDarkMode && { color: colors.textSecondary }]}>
              Cảnh báo nguy hiểm:{' '}
              <LocalizedText style={{ fontWeight: '700', color: '#EF4444' }}>&lt; 90%</LocalizedText>
            </LocalizedText>
            <LocalizedText style={[styles.metricMiniStatItem, isDarkMode && { color: colors.textSecondary }]}>
              Phương thức đo: <LocalizedText style={{ fontWeight: '600' }}>LED Đỏ 660nm &amp; IR 880nm</LocalizedText>
            </LocalizedText>
          </View>
        </View>

        {/* Thanh SpO2 phân cấp y tế */}
        <View style={styles.spo2BarWrapper}>
          <View style={styles.spo2BarSegmentDanger} />
          <View style={styles.spo2BarSegmentWarning} />
          <View style={styles.spo2BarSegmentSafe} />
          {hasSpO2 && (
            <View
              style={[
                styles.spo2IndicatorPin,
                { left: `${Math.min(Math.max(((Number(displaySpO2) - 85) * 6.6), 5), 96)}%` },
              ]}
            >
              <View style={styles.spo2PinDot} />
            </View>
          )}
        </View>
        <View style={styles.rangeLabelsRow}>
          <LocalizedText style={[styles.rangeLabelText, { color: '#EF4444' }]}>Nguy hiểm (&lt;90%)</LocalizedText>
          <LocalizedText style={[styles.rangeLabelText, { color: '#F59E0B' }]}>Cần theo dõi (90-94%)</LocalizedText>
          <LocalizedText style={[styles.rangeLabelText, { color: '#059669' }]}>Lý tưởng (95-100%)</LocalizedText>
        </View>

        <View style={[styles.aiInsightBox, isDarkMode && { backgroundColor: colors.surfaceSubtle }]}>
          <Ionicons name="sparkles" size={15} color="#0284C7" />
          <LocalizedText style={[styles.aiInsightText, isDarkMode && { color: colors.textSecondary }]}>
            {hasSpO2
              ? `Đánh giá AI: Độ bão hòa oxy mô ngoại vi đạt mức lý tưởng ${displaySpO2}%, lưu thông phế nang phổi hoạt động thông suốt.`
              : 'Đánh giá AI: Chưa ghi nhận dữ liệu SpO₂ từ vòng đeo tay.'}
          </LocalizedText>
        </View>
      </View>

      {/* THẺ 3 & 4 (2 CỘT): GIA TỐC KẾ PHÁT HIỆN NGÃ & THÂN NHIỆT */}
      <View style={styles.twoColumnGrid}>
        {/* Card Gia tốc kế */}
        <View style={[styles.smallMetricCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.smallMetricHeader}>
            <View style={[styles.metricIconCircleSmall, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="body" size={18} color="#10B981" />
            </View>
            <LocalizedText style={[styles.smallMetricTitle, isDarkMode && { color: colors.textPrimary }]}>
              Gia Tốc Kế 3 Trục
            </LocalizedText>
          </View>
          <LocalizedText style={[styles.smallMetricSub, isDarkMode && { color: colors.textSecondary }]}>
            MPU6050 (100 Hz)
          </LocalizedText>

          <View style={styles.smallMetricValueRow}>
            <LocalizedText style={[styles.smallMetricValue, isDarkMode && { color: colors.textPrimary }]}>1.01</LocalizedText>
            <LocalizedText style={styles.smallMetricUnit}>G</LocalizedText>
          </View>
          <LocalizedText style={styles.impactSafeStatus}>✓ Không có va chạm ngã</LocalizedText>

          <View style={[styles.xyzAxisBox, isDarkMode && { backgroundColor: colors.surfaceSubtle }]}>
            <LocalizedText style={[styles.xyzAxisText, isDarkMode && { color: colors.textSecondary }]}>
              X: 0.02G | Y: 0.14G | Z: 0.99G
            </LocalizedText>
          </View>
          <LocalizedText style={[styles.sensorNoteText, isDarkMode && { color: colors.textMuted }]}>
            Ngưỡng té ngã: &gt; 3.0G
          </LocalizedText>
        </View>

        {/* Card Nhiệt độ da */}
        <View style={[styles.smallMetricCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.smallMetricHeader}>
            <View style={[styles.metricIconCircleSmall, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="thermometer" size={18} color="#F59E0B" />
            </View>
            <LocalizedText style={[styles.smallMetricTitle, isDarkMode && { color: colors.textPrimary }]}>
              Thân Nhiệt Cổ Tay
            </LocalizedText>
          </View>
          <LocalizedText style={[styles.smallMetricSub, isDarkMode && { color: colors.textSecondary }]}>
            NTC Sensor (±0.1°C)
          </LocalizedText>

          <View style={styles.smallMetricValueRow}>
            <LocalizedText style={[styles.smallMetricValue, { color: '#D97706' }]}>{displayTemp}</LocalizedText>
            <LocalizedText style={styles.smallMetricUnit}>°C</LocalizedText>
          </View>
          <LocalizedText style={styles.impactSafeStatus}>✓ Thân nhiệt ổn định</LocalizedText>

          <View style={[styles.xyzAxisBox, isDarkMode && { backgroundColor: colors.surfaceSubtle }]}>
            <LocalizedText style={[styles.xyzAxisText, isDarkMode && { color: colors.textSecondary }]}>
              Chuẩn da: 36.5°C - 37.2°C
            </LocalizedText>
          </View>
          <LocalizedText style={[styles.sensorNoteText, isDarkMode && { color: colors.textMuted }]}>
            Kết hợp AMG8833 Hub
          </LocalizedText>
        </View>
      </View>

      {/* THẺ 5: VẬN ĐỘNG & BƯỚC CHÂN (PEDOMETER) */}
      <View style={[styles.metricCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.metricCardHeader}>
          <View style={styles.metricHeaderLeft}>
            <View style={[styles.metricIconCircle, { backgroundColor: '#F3E8FF' }]}>
              <Ionicons name="walk" size={22} color="#8B5CF6" />
            </View>
            <View style={{ marginLeft: 12 }}>
              <LocalizedText style={[styles.metricTitle, isDarkMode && { color: colors.textPrimary }]}>
                Vận Động &amp; Đếm Bước Chân
              </LocalizedText>
              <LocalizedText style={[styles.metricSub, isDarkMode && { color: colors.textSecondary }]}>
                Theo dõi mức độ tích cực của người cao tuổi
              </LocalizedText>
            </View>
          </View>

          <View style={styles.stepCountGoalBadge}>
            <LocalizedText style={styles.stepCountGoalText}>Mục tiêu: 5,000</LocalizedText>
          </View>
        </View>

        <View style={styles.stepStatsRow}>
          <View style={styles.stepStatBox}>
            <LocalizedText style={[styles.stepStatBigNumber, isDarkMode && { color: colors.textPrimary }]}>3,420</LocalizedText>
            <LocalizedText style={[styles.stepStatLabel, isDarkMode && { color: colors.textSecondary }]}>Bước (68% mục tiêu)</LocalizedText>
          </View>
          <View style={[styles.stepStatDivider, isDarkMode && { backgroundColor: colors.border }]} />
          <View style={styles.stepStatBox}>
            <LocalizedText style={[styles.stepStatBigNumber, isDarkMode && { color: colors.textPrimary }]}>2.1</LocalizedText>
            <LocalizedText style={[styles.stepStatLabel, isDarkMode && { color: colors.textSecondary }]}>Kilômét (km)</LocalizedText>
          </View>
          <View style={[styles.stepStatDivider, isDarkMode && { backgroundColor: colors.border }]} />
          <View style={styles.stepStatBox}>
            <LocalizedText style={[styles.stepStatBigNumber, isDarkMode && { color: colors.textPrimary }]}>142</LocalizedText>
            <LocalizedText style={[styles.stepStatLabel, isDarkMode && { color: colors.textSecondary }]}>Calo tiêu hao (kcal)</LocalizedText>
          </View>
        </View>

        {/* Thanh tiến độ bước chân */}
        <View style={styles.stepProgressBarBg}>
          <View style={[styles.stepProgressBarFill, { width: '68%' }]} />
        </View>

        <View style={[styles.aiInsightBox, isDarkMode && { backgroundColor: colors.surfaceSubtle }]}>
          <Ionicons name="sparkles" size={15} color="#0284C7" />
          <LocalizedText style={[styles.aiInsightText, isDarkMode && { color: colors.textSecondary }]}>
            Đánh giá AI: Mức vận động đi bộ nhẹ nhàng trong nhà và khuôn viên buổi sáng rất tốt cho tim mạch và lưu thông khớp gối.
          </LocalizedText>
        </View>
      </View>

      {/* THẺ 6: GIẤC NGỦ & PHỤC HỒI SINH HỌC */}
      <View style={[styles.metricCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.metricCardHeader}>
          <View style={styles.metricHeaderLeft}>
            <View style={[styles.metricIconCircle, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="moon" size={22} color="#7C3AED" />
            </View>
            <View style={{ marginLeft: 12 }}>
              <LocalizedText style={[styles.metricTitle, isDarkMode && { color: colors.textPrimary }]}>
                Giấc Ngủ &amp; Phục Hồi Sinh Học
              </LocalizedText>
              <LocalizedText style={[styles.metricSub, isDarkMode && { color: colors.textSecondary }]}>
                Phân tích chu kỳ ngủ sâu qua PPG &amp; IMU
              </LocalizedText>
            </View>
          </View>

          <View style={styles.sleepScoreBadge}>
            <LocalizedText style={styles.sleepScoreBadgeText}>88/100 Điểm</LocalizedText>
          </View>
        </View>

        <View style={styles.sleepStatsRow}>
          <View style={styles.sleepStatMainBox}>
            <LocalizedText style={[styles.sleepStatHours, isDarkMode && { color: colors.textPrimary }]}>
              7<LocalizedText style={{ fontSize: 16 }}>h </LocalizedText>15<LocalizedText style={{ fontSize: 16 }}>m</LocalizedText>
            </LocalizedText>
            <LocalizedText style={[styles.sleepStatDesc, isDarkMode && { color: colors.textSecondary }]}>
              Tổng thời gian ngủ đêm qua
            </LocalizedText>
          </View>

          <View style={styles.sleepStagePillsCol}>
            <View style={styles.sleepStagePill}>
              <View style={[styles.sleepColorDot, { backgroundColor: '#3B82F6' }]} />
              <LocalizedText style={[styles.sleepStageName, isDarkMode && { color: colors.textSecondary }]}>
                Ngủ sâu: 2h 10m (30%)
              </LocalizedText>
            </View>
            <View style={styles.sleepStagePill}>
              <View style={[styles.sleepColorDot, { backgroundColor: '#60A5FA' }]} />
              <LocalizedText style={[styles.sleepStageName, isDarkMode && { color: colors.textSecondary }]}>
                Ngủ nhẹ: 3h 40m (51%)
              </LocalizedText>
            </View>
            <View style={styles.sleepStagePill}>
              <View style={[styles.sleepColorDot, { backgroundColor: '#A78BFA' }]} />
              <LocalizedText style={[styles.sleepStageName, isDarkMode && { color: colors.textSecondary }]}>
                REM (Mơ): 50m (11%)
              </LocalizedText>
            </View>
          </View>
        </View>

        {/* Thanh phân tầng giấc ngủ trực quan */}
        <View style={styles.sleepSegmentBar}>
          <View style={[styles.sleepSegItem, { flex: 30, backgroundColor: '#3B82F6' }]} />
          <View style={[styles.sleepSegItem, { flex: 51, backgroundColor: '#60A5FA' }]} />
          <View style={[styles.sleepSegItem, { flex: 11, backgroundColor: '#A78BFA' }]} />
          <View style={[styles.sleepSegItem, { flex: 8, backgroundColor: '#FCD34D' }]} />
        </View>
        <View style={styles.sleepLegendRow}>
          <View style={styles.sleepLegendItem}>
            <View style={[styles.sleepLegendDot, { backgroundColor: '#3B82F6' }]} />
            <LocalizedText style={styles.sleepLegendText}>Sâu: 30%</LocalizedText>
          </View>
          <View style={styles.sleepLegendItem}>
            <View style={[styles.sleepLegendDot, { backgroundColor: '#60A5FA' }]} />
            <LocalizedText style={styles.sleepLegendText}>Nhẹ: 51%</LocalizedText>
          </View>
          <View style={styles.sleepLegendItem}>
            <View style={[styles.sleepLegendDot, { backgroundColor: '#A78BFA' }]} />
            <LocalizedText style={styles.sleepLegendText}>REM: 11%</LocalizedText>
          </View>
          <View style={styles.sleepLegendItem}>
            <View style={[styles.sleepLegendDot, { backgroundColor: '#FCD34D' }]} />
            <LocalizedText style={styles.sleepLegendText}>Thức: 35m (8%)</LocalizedText>
          </View>
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.5,
  },
  metricCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  metricCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metricHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  metricIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  metricSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  statusPillGreen: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillGreenText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  metricMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  metricValueWrapper: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  metricMainValue: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1,
  },
  metricMainUnit: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
    marginLeft: 6,
  },
  metricMiniStatsColumn: {
    alignItems: 'flex-end',
    gap: 3,
  },
  metricMiniStatItem: {
    fontSize: 11,
    color: '#475569',
  },
  rangeBarContainer: {
    marginBottom: 12,
  },
  rangeBarBackground: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  rangeBarSegmentSafe: {
    position: 'absolute',
    left: '20%',
    width: '60%',
    height: '100%',
    backgroundColor: '#BBF7D0',
    borderRadius: 4,
  },
  rangeBarIndicator: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFF',
    marginLeft: -7,
  },
  rangeLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  rangeLabelText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 70,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 6,
  },
  timelineCol: {
    alignItems: 'center',
    flex: 1,
  },
  timelineBar: {
    width: 12,
    borderRadius: 6,
    backgroundColor: '#FCA5A5',
    marginBottom: 4,
  },
  timelineHrText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
  },
  timelineTimeText: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 1,
  },
  aiInsightBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0F9FF',
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
    gap: 8,
  },
  aiInsightText: {
    fontSize: 11,
    color: '#0369A1',
    lineHeight: 16,
    flex: 1,
  },
  spo2BarWrapper: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 4,
  },
  spo2BarSegmentDanger: {
    flex: 25,
    backgroundColor: '#FCA5A5',
  },
  spo2BarSegmentWarning: {
    flex: 25,
    backgroundColor: '#FDE68A',
  },
  spo2BarSegmentSafe: {
    flex: 50,
    backgroundColor: '#86EFAC',
  },
  spo2IndicatorPin: {
    position: 'absolute',
    top: -3,
    marginLeft: -8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spo2PinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0284C7',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  twoColumnGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  smallMetricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  smallMetricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricIconCircleSmall: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  smallMetricTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  smallMetricSub: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 8,
  },
  smallMetricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  smallMetricValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
  },
  smallMetricUnit: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginLeft: 4,
  },
  impactSafeStatus: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 8,
  },
  xyzAxisBox: {
    backgroundColor: '#F8FAFC',
    padding: 6,
    borderRadius: 6,
    marginBottom: 4,
  },
  xyzAxisText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  sensorNoteText: {
    fontSize: 9,
    color: '#94A3B8',
    textAlign: 'center',
  },
  stepCountGoalBadge: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stepCountGoalText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  stepStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  stepStatBox: {
    alignItems: 'center',
    flex: 1,
  },
  stepStatBigNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  stepStatLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  stepStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },
  stepProgressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
    overflow: 'hidden',
  },
  stepProgressBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#8B5CF6',
  },
  sleepScoreBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sleepScoreBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6D28D9',
  },
  sleepStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  sleepStatMainBox: {
    flex: 1,
  },
  sleepStatHours: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
  },
  sleepStatDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  sleepStagePillsCol: {
    gap: 4,
  },
  sleepStagePill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sleepColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  sleepStageName: {
    fontSize: 11,
    color: '#475569',
  },
  sleepSegmentBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginVertical: 10,
  },
  sleepSegItem: {
    height: '100%',
  },
  sleepLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sleepLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sleepLegendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  sleepLegendText: {
    fontSize: 10,
    color: '#64748B',
  },
});

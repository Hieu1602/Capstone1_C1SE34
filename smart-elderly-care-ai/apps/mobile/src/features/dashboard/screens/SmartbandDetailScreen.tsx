// SmartbandDetailScreen.tsx
// Màn hình Chi tiết Vòng Đeo Tay Thông Minh (BLE Smartband) & Các chỉ số sức khỏe thu thập
// Thiết kế chuẩn y khoa cho hệ thống Smart Elderly Care AI theo Proposal Capstone 1

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { useVitalStore } from '../../../store/useVitalStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SmartbandDetailScreen({ navigation, route }: any) {
  const deviceParam = route?.params?.device;
  const { currentVitals, setVitals, algoSettings } = useVitalStore();

  const [isSyncing, setIsSyncing] = useState(false);
  const [isFinding, setIsFinding] = useState(false);
  const [timeRange, setTimeRange] = useState<'TODAY' | 'WEEK'>('TODAY');

  // Pulse animation cho hiệu ứng nhịp tim / kết nối
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const triggerPulse = () => {
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1.18,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Đồng bộ đo tức thời
  const handleSyncNow = () => {
    setIsSyncing(true);
    triggerPulse();
    setTimeout(() => {
      // Giả lập đọc dữ liệu từ BLE GATT MAX30102
      const newHR = Math.floor(70 + Math.random() * 10);
      const newSpO2 = Math.floor(97 + Math.random() * 2);
      setVitals({
        heart_rate: newHR,
        spo2: newSpO2,
        skin_temp_max: 36.7,
        timestamp: Date.now(),
      });
      setIsSyncing(false);
      Alert.alert(
        'Đồng Bộ Thành Công',
        `Đã nhận gói tin GATT mới nhất từ vòng đeo tay:\n• Nhịp tim: ${newHR} bpm\n• SpO₂: ${newSpO2}%\n• Thân nhiệt da: 36.7°C\n• Trọng lực: 1.01G (Bình thường)`
      );
    }, 1200);
  };

  // Phát tín hiệu rung tìm vòng tay
  const handleFindBand = () => {
    setIsFinding(true);
    setTimeout(() => {
      setIsFinding(false);
      Alert.alert(
        'Đã Gửi Tín Hiệu Rung 📳',
        'Đã gửi lệnh GATT (Vibration Motor Alert) đến vòng đeo tay tại Phòng ngủ. Vòng tay đang rung 3 hồi chu kỳ.'
      );
    }, 800);
  };

  const hrValue = currentVitals.heart_rate ?? 74;
  const spo2Value = currentVitals.spo2 ?? 98;
  const tempValue = currentVitals.skin_temp_max ?? 36.6;

  // Dữ liệu mô phỏng nhịp tim trong ngày (6 mốc)
  const hrTimeline = [
    { time: '06:00', hr: 68, note: 'Thức dậy' },
    { time: '09:00', hr: 76, note: 'Ăn sáng / Đi dạo' },
    { time: '12:00', hr: 72, note: 'Nghỉ trưa' },
    { time: '15:00', hr: 82, note: 'Vận động nhẹ' },
    { time: '18:00', hr: 74, note: 'Ăn tối' },
    { time: '21:00', hr: 66, note: 'Chuẩn bị ngủ' },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* 1. Header Điều Hướng */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={26} color="#0F172A" />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>
            {deviceParam?.name || 'Vòng đeo tay BLE Smartband'}
          </Text>
          <View style={styles.headerSubtitleRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.headerSubtitle}>GATT BLE 5.0 • Đang kết nối trực tuyến</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('AlgoConfig')}
          activeOpacity={0.7}
        >
          <Ionicons name="options-outline" size={22} color="#0F172A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ============================================================== */}
        {/* 2. HERO CARD: THÔNG TIN CHI TIẾT ĐỒNG HỒ / VÒNG ĐEO TAY        */}
        {/* ============================================================== */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            {/* Vòng tròn biểu tượng Vòng đeo tay */}
            <View style={styles.watchIconWrapper}>
              <Animated.View
                style={[
                  styles.watchIconPulseRing,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              />
              <View style={styles.watchIconCenter}>
                <Ionicons name="watch" size={36} color="#10B981" />
              </View>
            </View>

            {/* Thông tin thiết bị */}
            <View style={styles.heroInfoColumn}>
              <View style={styles.modelBadgeRow}>
                <Text style={styles.modelNameText}>BLE Smartband FR01</Text>
                <View style={styles.medicalBadge}>
                  <Text style={styles.medicalBadgeText}>Y TẾ</Text>
                </View>
              </View>

              <Text style={styles.wearerInfoText}>
                <Ionicons name="person" size={14} color="#64748B" /> Người đeo:{' '}
                <Text style={{ fontWeight: '700', color: '#0F172A' }}>Cụ Ông (78 tuổi)</Text>
              </Text>

              <Text style={styles.locationInfoText}>
                <Ionicons name="location" size={14} color="#64748B" /> Vị trí:{' '}
                <Text style={{ fontWeight: '600', color: '#334155' }}>
                  {deviceParam?.location || 'Phòng ngủ'}
                </Text>
              </Text>

              {/* Trạng thái tiếp xúc da */}
              <View style={styles.skinContactBadge}>
                <Ionicons name="checkmark-circle" size={15} color="#059669" />
                <Text style={styles.skinContactText}>Đang đeo trên cổ tay (Tiếp xúc da tốt)</Text>
              </View>
            </View>
          </View>

          <View style={styles.heroDivider} />

          {/* Hàng 4 thông số kỹ thuật nhanh */}
          <View style={styles.specsQuickGrid}>
            <View style={styles.specQuickItem}>
              <View style={styles.specQuickIconBox}>
                <Ionicons name="battery-charging" size={18} color="#10B981" />
              </View>
              <Text style={styles.specQuickVal}>84%</Text>
              <Text style={styles.specQuickLabel}>Pin (~5 ngày)</Text>
            </View>

            <View style={styles.specQuickItem}>
              <View style={styles.specQuickIconBox}>
                <Ionicons name="bluetooth" size={18} color="#0284C7" />
              </View>
              <Text style={styles.specQuickVal}>BLE 5.0</Text>
              <Text style={styles.specQuickLabel}>GATT Active</Text>
            </View>

            <View style={styles.specQuickItem}>
              <View style={styles.specQuickIconBox}>
                <Ionicons name="wifi" size={18} color="#8B5CF6" />
              </View>
              <Text style={styles.specQuickVal}>-58 dBm</Text>
              <Text style={styles.specQuickLabel}>Sóng rất tốt</Text>
            </View>

            <View style={styles.specQuickItem}>
              <View style={styles.specQuickIconBox}>
                <Ionicons name="finger-print" size={18} color="#F59E0B" />
              </View>
              <Text style={styles.specQuickVal}>88:2A:9C</Text>
              <Text style={styles.specQuickLabel}>MAC ID</Text>
            </View>
          </View>

          {/* 2 Nút hành động nhanh */}
          <View style={styles.heroActionRow}>
            <TouchableOpacity
              style={[styles.heroActionBtn, styles.heroActionBtnPrimary]}
              onPress={handleSyncNow}
              disabled={isSyncing}
              activeOpacity={0.8}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="sync" size={18} color="#FFF" style={{ marginRight: 6 }} />
              )}
              <Text style={styles.heroActionBtnPrimaryText}>
                {isSyncing ? 'Đang đồng bộ...' : 'Đo ngay (PPG Live)'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.heroActionBtn, styles.heroActionBtnSecondary]}
              onPress={handleFindBand}
              disabled={isFinding}
              activeOpacity={0.8}
            >
              <Ionicons
                name="phone-portrait-outline"
                size={18}
                color="#0284C7"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.heroActionBtnSecondaryText}>
                {isFinding ? 'Đang gửi...' : 'Tìm vòng tay (Rung)'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ============================================================== */}
        {/* 3. CÁC THÔNG TIN SỨC KHỎE ĐỒNG HỒ THU THẬP                     */}
        {/* ============================================================== */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Chỉ Số Sức Khỏe Thu Thập</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveBadgePulse} />
            <Text style={styles.liveBadgeText}>TRỰC TIẾP</Text>
          </View>
        </View>

        {/* THẺ 1: NHỊP TIM THỜI GIAN THỰC (PPG) */}
        <View style={styles.metricCard}>
          <View style={styles.metricCardHeader}>
            <View style={styles.metricHeaderLeft}>
              <View style={[styles.metricIconCircle, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="heart" size={22} color="#EF4444" />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.metricTitle}>Nhịp Tim (Heart Rate - PPG)</Text>
                <Text style={styles.metricSub}>Cảm biến quang học Maxim MAX30102 (1 Hz)</Text>
              </View>
            </View>

            <View style={styles.statusPillGreen}>
              <Text style={styles.statusPillGreenText}>Ổn định</Text>
            </View>
          </View>

          <View style={styles.metricMainRow}>
            <View style={styles.metricValueWrapper}>
              <Text style={[styles.metricMainValue, { color: '#EF4444' }]}>{hrValue}</Text>
              <Text style={styles.metricMainUnit}>bpm</Text>
            </View>

            <View style={styles.metricMiniStatsColumn}>
              <Text style={styles.metricMiniStatItem}>
                Thấp nhất: <Text style={{ fontWeight: '700', color: '#0F172A' }}>62 bpm</Text>
              </Text>
              <Text style={styles.metricMiniStatItem}>
                Trung bình: <Text style={{ fontWeight: '700', color: '#0F172A' }}>73 bpm</Text>
              </Text>
              <Text style={styles.metricMiniStatItem}>
                Cao nhất: <Text style={{ fontWeight: '700', color: '#0F172A' }}>98 bpm</Text>
              </Text>
            </View>
          </View>

          {/* Dải tiến độ an toàn: 50 - 120 bpm */}
          <View style={styles.rangeBarContainer}>
            <View style={styles.rangeBarTrack}>
              <View
                style={[
                  styles.rangeBarIndicator,
                  {
                    left: `${Math.min(Math.max(((hrValue - 40) / 100) * 100, 5), 95)}%`,
                    backgroundColor: '#EF4444',
                  },
                ]}
              />
            </View>
            <View style={styles.rangeLabelsRow}>
              <Text style={styles.rangeLabelText}>50 (Ngủ)</Text>
              <Text style={[styles.rangeLabelText, { color: '#059669', fontWeight: '700' }]}>
                Khoảng an toàn: 60 - 100 bpm
              </Text>
              <Text style={styles.rangeLabelText}>120 (Cảnh báo)</Text>
            </View>
          </View>

          {/* Timeline mô phỏng trong ngày */}
          <View style={styles.timelineRow}>
            {hrTimeline.map((item, idx) => (
              <View key={idx} style={styles.timelineCol}>
                <View
                  style={[
                    styles.timelineBar,
                    { height: Math.max((item.hr - 50) * 1.5, 16) },
                  ]}
                />
                <Text style={styles.timelineHrText}>{item.hr}</Text>
                <Text style={styles.timelineTimeText}>{item.time}</Text>
              </View>
            ))}
          </View>

          <View style={styles.aiInsightBox}>
            <Ionicons name="sparkles" size={15} color="#0284C7" />
            <Text style={styles.aiInsightText}>
              Đánh giá AI: Nhịp xoang đều đặn, không có hiện tượng loạn nhịp (Arrhythmia) hay nhịp tim nhanh bất thường trong ngày.
            </Text>
          </View>
        </View>

        {/* THẺ 2: NỒNG ĐỘ OXY TRONG MÁU (SpO2) */}
        <View style={styles.metricCard}>
          <View style={styles.metricCardHeader}>
            <View style={styles.metricHeaderLeft}>
              <View style={[styles.metricIconCircle, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="water" size={22} color="#0284C7" />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.metricTitle}>Nồng Độ Oxy Trong Máu (SpO₂)</Text>
                <Text style={styles.metricSub}>Bão hòa oxy mao mạch ngoại vi (Pulse Oximetry)</Text>
              </View>
            </View>

            <View style={styles.statusPillGreen}>
              <Text style={styles.statusPillGreenText}>Tối ưu</Text>
            </View>
          </View>

          <View style={styles.metricMainRow}>
            <View style={styles.metricValueWrapper}>
              <Text style={[styles.metricMainValue, { color: '#0284C7' }]}>{spo2Value}</Text>
              <Text style={styles.metricMainUnit}>%</Text>
            </View>

            <View style={styles.metricMiniStatsColumn}>
              <Text style={styles.metricMiniStatItem}>
                Ngưỡng an toàn: <Text style={{ fontWeight: '700', color: '#059669' }}>≥ 95%</Text>
              </Text>
              <Text style={styles.metricMiniStatItem}>
                Cảnh báo nguy hiểm:{' '}
                <Text style={{ fontWeight: '700', color: '#EF4444' }}>&lt; 90%</Text>
              </Text>
              <Text style={styles.metricMiniStatItem}>
                Phương thức đo: <Text style={{ fontWeight: '600' }}>LED Đỏ 660nm &amp; IR 880nm</Text>
              </Text>
            </View>
          </View>

          {/* Thanh SpO2 phân cấp y tế */}
          <View style={styles.spo2BarWrapper}>
            <View style={styles.spo2BarSegmentDanger} />
            <View style={styles.spo2BarSegmentWarning} />
            <View style={styles.spo2BarSegmentSafe} />
            <View
              style={[
                styles.spo2IndicatorPin,
                { left: `${Math.min(Math.max((spo2Value - 85) * 6.6, 5), 96)}%` },
              ]}
            >
              <View style={styles.spo2PinDot} />
            </View>
          </View>
          <View style={styles.rangeLabelsRow}>
            <Text style={[styles.rangeLabelText, { color: '#EF4444' }]}>Nguy hiểm (&lt;90%)</Text>
            <Text style={[styles.rangeLabelText, { color: '#F59E0B' }]}>Cần theo dõi (90-94%)</Text>
            <Text style={[styles.rangeLabelText, { color: '#059669' }]}>Lý tưởng (95-100%)</Text>
          </View>

          <View style={styles.aiInsightBox}>
            <Ionicons name="sparkles" size={15} color="#0284C7" />
            <Text style={styles.aiInsightText}>
              Đánh giá AI: Độ bão hòa oxy mô ngoại vi đạt mức lý tưởng 98%, lưu thông phế nang phổi hoạt động thông suốt.
            </Text>
          </View>
        </View>

        {/* THẺ 3 & 4 (2 CỘT): GIA TỐC KẾ PHÁT HIỆN NGÃ & THÂN NHIỆT */}
        <View style={styles.twoColumnGrid}>
          {/* Card Gia tốc kế */}
          <View style={styles.smallMetricCard}>
            <View style={styles.smallMetricHeader}>
              <View style={[styles.metricIconCircleSmall, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="body" size={18} color="#10B981" />
              </View>
              <Text style={styles.smallMetricTitle}>Gia Tốc Kế 3 Trục</Text>
            </View>
            <Text style={styles.smallMetricSub}>MPU6050 (100 Hz)</Text>

            <View style={styles.smallMetricValueRow}>
              <Text style={styles.smallMetricValue}>1.01</Text>
              <Text style={styles.smallMetricUnit}>G</Text>
            </View>
            <Text style={styles.impactSafeStatus}>🟢 Không có va chạm ngã</Text>

            <View style={styles.xyzAxisBox}>
              <Text style={styles.xyzAxisText}>X: 0.02G | Y: 0.14G | Z: 0.99G</Text>
            </View>
            <Text style={styles.sensorNoteText}>Ngưỡng té ngã: &gt; 3.0G</Text>
          </View>

          {/* Card Nhiệt độ da */}
          <View style={styles.smallMetricCard}>
            <View style={styles.smallMetricHeader}>
              <View style={[styles.metricIconCircleSmall, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="thermometer" size={18} color="#F59E0B" />
              </View>
              <Text style={styles.smallMetricTitle}>Thân Nhiệt Cổ Tay</Text>
            </View>
            <Text style={styles.smallMetricSub}>NTC Sensor (±0.1°C)</Text>

            <View style={styles.smallMetricValueRow}>
              <Text style={[styles.smallMetricValue, { color: '#D97706' }]}>{tempValue}</Text>
              <Text style={styles.smallMetricUnit}>°C</Text>
            </View>
            <Text style={styles.impactSafeStatus}>🟢 Thân nhiệt ổn định</Text>

            <View style={styles.xyzAxisBox}>
              <Text style={styles.xyzAxisText}>Chuẩn da: 36.5°C - 37.2°C</Text>
            </View>
            <Text style={styles.sensorNoteText}>Kết hợp AMG8833 Hub</Text>
          </View>
        </View>

        {/* THẺ 5: VẬN ĐỘNG & BƯỚC CHÂN (PEDOMETER) */}
        <View style={styles.metricCard}>
          <View style={styles.metricCardHeader}>
            <View style={styles.metricHeaderLeft}>
              <View style={[styles.metricIconCircle, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="walk" size={22} color="#8B5CF6" />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.metricTitle}>Vận Động &amp; Đếm Bước Chân</Text>
                <Text style={styles.metricSub}>Theo dõi mức độ tích cực của người cao tuổi</Text>
              </View>
            </View>

            <View style={styles.stepCountGoalBadge}>
              <Text style={styles.stepCountGoalText}>Mục tiêu: 5,000</Text>
            </View>
          </View>

          <View style={styles.stepStatsRow}>
            <View style={styles.stepStatBox}>
              <Text style={styles.stepStatBigNumber}>3,420</Text>
              <Text style={styles.stepStatLabel}>Bước chân (68%)</Text>
            </View>
            <View style={styles.stepDivider} />
            <View style={styles.stepStatBox}>
              <Text style={styles.stepStatBigNumber}>2.2</Text>
              <Text style={styles.stepStatLabel}>Quãng đường (km)</Text>
            </View>
            <View style={styles.stepDivider} />
            <View style={styles.stepStatBox}>
              <Text style={styles.stepStatBigNumber}>145</Text>
              <Text style={styles.stepStatLabel}>Tiêu hao (kcal)</Text>
            </View>
          </View>

          {/* Thanh tiến độ bước chân */}
          <View style={styles.stepProgressBarBg}>
            <View style={[styles.stepProgressBarFill, { width: '68%' }]} />
          </View>
        </View>

        {/* THẺ 6: THEO DÕI GIẤC NGỦ (SLEEP TRACKING) */}
        <View style={styles.metricCard}>
          <View style={styles.metricCardHeader}>
            <View style={styles.metricHeaderLeft}>
              <View style={[styles.metricIconCircle, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="moon" size={22} color="#6D28D9" />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.metricTitle}>Giám Sát Giấc Ngủ Ban Đêm</Text>
                <Text style={styles.metricSub}>Đêm qua (22:15 - 05:30)</Text>
              </View>
            </View>

            <View style={styles.sleepScoreBadge}>
              <Text style={styles.sleepScoreBadgeText}>86 / 100 • Ngon giấc</Text>
            </View>
          </View>

          <View style={styles.sleepTotalRow}>
            <Text style={styles.sleepTotalTime}>7 giờ 15 phút</Text>
            <Text style={styles.sleepTotalSub}>Thời gian ngủ thực tế</Text>
          </View>

          {/* Biểu đồ phân kỳ ngủ */}
          <View style={styles.sleepBarContainer}>
            <View style={[styles.sleepSegmentDeep, { width: '30%' }]} />
            <View style={[styles.sleepSegmentLight, { width: '62%' }]} />
            <View style={[styles.sleepSegmentAwake, { width: '8%' }]} />
          </View>

          <View style={styles.sleepLegendRow}>
            <View style={styles.sleepLegendItem}>
              <View style={[styles.sleepLegendDot, { backgroundColor: '#312E81' }]} />
              <Text style={styles.sleepLegendText}>Ngủ sâu: 2h 10m (30%)</Text>
            </View>
            <View style={styles.sleepLegendItem}>
              <View style={[styles.sleepLegendDot, { backgroundColor: '#6366F1' }]} />
              <Text style={styles.sleepLegendText}>Ngủ nông: 4h 30m (62%)</Text>
            </View>
            <View style={styles.sleepLegendItem}>
              <View style={[styles.sleepLegendDot, { backgroundColor: '#FCD34D' }]} />
              <Text style={styles.sleepLegendText}>Thức: 35m (8%)</Text>
            </View>
          </View>
        </View>

        {/* ============================================================== */}
        {/* 4. THÔNG SỐ KỸ THUẬT PHẦN CỨNG (HARDWARE SPECIFICATIONS)       */}
        {/* ============================================================== */}
        <View style={styles.specsCard}>
          <Text style={styles.specsCardTitle}>Thông Số Kỹ Thuật Phần Cứng</Text>
          <Text style={styles.specsCardDesc}>
            Cấu hình phần cứng IoT y tế thu thập tín hiệu sinh học kết nối Orange Pi 5 Hub:
          </Text>

          <View style={styles.specTableRow}>
            <Text style={styles.specTableKey}>Chip vi điều khiển (MCU)</Text>
            <Text style={styles.specTableVal}>Nordic nRF52840 (ARM Cortex-M4F 64MHz)</Text>
          </View>
          <View style={styles.specTableRow}>
            <Text style={styles.specTableKey}>Cảm biến sinh trắc PPG</Text>
            <Text style={styles.specTableVal}>Maxim MAX30102 (Đo Nhịp tim &amp; SpO₂ quang học)</Text>
          </View>
          <View style={styles.specTableRow}>
            <Text style={styles.specTableKey}>Cảm biến chuyển động IMU</Text>
            <Text style={styles.specTableVal}>MPU6050 6-DoF (Gia tốc 3 trục + Con quay 3 trục)</Text>
          </View>
          <View style={styles.specTableRow}>
            <Text style={styles.specTableKey}>Cảm biến nhiệt độ bề mặt</Text>
            <Text style={styles.specTableVal}>NTC Skin Contact Thermistor (Sai số ±0.1°C)</Text>
          </View>
          <View style={styles.specTableRow}>
            <Text style={styles.specTableKey}>Giao thức kết nối không dây</Text>
            <Text style={styles.specTableVal}>Bluetooth Low Energy 5.0 (GATT Client Bleak)</Text>
          </View>
          <View style={styles.specTableRow}>
            <Text style={styles.specTableKey}>Dung lượng Pin &amp; Nguồn sạc</Text>
            <Text style={styles.specTableVal}>Li-Po 110mAh • Sạc từ tính 5V/1A (Dùng 5-7 ngày)</Text>
          </View>
          <View style={styles.specTableRow}>
            <Text style={styles.specTableKey}>Chuẩn kháng nước &amp; bụi</Text>
            <Text style={styles.specTableVal}>IP67 (Chống nước sinh hoạt, rửa tay, đi mưa nhẹ)</Text>
          </View>
          <View style={[styles.specTableRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.specTableKey}>Phiên bản Firmware OTA</Text>
            <Text style={styles.specTableVal}>v2.4.1-seca (Bản mới nhất, cập nhật 05/09/2026)</Text>
          </View>
        </View>

        {/* 5. CÀI ĐẶT CẢNH BÁO AN TOÀN */}
        <TouchableOpacity
          style={styles.algoShortcutCard}
          onPress={() => navigation.navigate('AlgoConfig')}
          activeOpacity={0.85}
        >
          <View style={styles.algoShortcutLeft}>
            <View style={styles.algoShortcutIconBox}>
              <Ionicons name="shield-checkmark" size={24} color="#0284C7" />
            </View>
            <View style={{ marginLeft: 14 }}>
              <Text style={styles.algoShortcutTitle}>Cài Đặt Ngưỡng Cảnh Báo AI</Text>
              <Text style={styles.algoShortcutSub}>
                Ngưỡng nhịp tim ({algoSettings.minHeartRate}-{algoSettings.maxHeartRate} bpm) • SpO₂ (&lt;{algoSettings.minSpO2}%)
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBox: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // HERO CARD
  heroCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  watchIconWrapper: {
    position: 'relative',
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchIconPulseRing: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  watchIconCenter: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#A7F3D0',
  },
  heroInfoColumn: {
    flex: 1,
    marginLeft: 16,
  },
  modelBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  modelNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  medicalBadge: {
    backgroundColor: '#DEF7EC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  medicalBadgeText: {
    color: '#03543F',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  wearerInfoText: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  locationInfoText: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  skinContactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    alignSelf: 'flex-start',
  },
  skinContactText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#15803D',
    marginLeft: 4,
  },
  heroDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  specsQuickGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  specQuickItem: {
    alignItems: 'center',
    flex: 1,
  },
  specQuickIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  specQuickVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  specQuickLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  heroActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroActionBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroActionBtnPrimary: {
    backgroundColor: '#10B981',
  },
  heroActionBtnPrimaryText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  heroActionBtnSecondary: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  heroActionBtnSecondaryText: {
    color: '#0284C7',
    fontSize: 13,
    fontWeight: '700',
  },

  // SECTION HEADER
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
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  liveBadgePulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    marginRight: 4,
  },
  liveBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B91C1C',
    letterSpacing: 0.5,
  },

  // METRIC CARD
  metricCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  metricCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  metricIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  metricSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  statusPillGreen: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillGreenText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '700',
  },
  metricMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginVertical: 14,
  },
  metricValueWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  metricMainValue: {
    fontSize: 40,
    fontWeight: '900',
    lineHeight: 44,
  },
  metricMainUnit: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
    marginLeft: 6,
    paddingBottom: 6,
  },
  metricMiniStatsColumn: {
    alignItems: 'flex-end',
  },
  metricMiniStatItem: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 18,
  },
  rangeBarContainer: {
    marginVertical: 6,
  },
  rangeBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    position: 'relative',
  },
  rangeBarIndicator: {
    position: 'absolute',
    top: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFF',
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
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 90,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 10,
  },
  timelineCol: {
    alignItems: 'center',
    flex: 1,
  },
  timelineBar: {
    width: 14,
    borderRadius: 7,
    backgroundColor: '#FCA5A5',
    marginBottom: 4,
  },
  timelineHrText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F172A',
  },
  timelineTimeText: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 2,
  },
  aiInsightBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#0284C7',
  },
  aiInsightText: {
    flex: 1,
    fontSize: 11,
    color: '#0369A1',
    lineHeight: 16,
    marginLeft: 6,
  },

  // SpO2 Bar
  spo2BarWrapper: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    position: 'relative',
    marginTop: 4,
  },
  spo2BarSegmentDanger: {
    flex: 1,
    backgroundColor: '#F87171',
  },
  spo2BarSegmentWarning: {
    flex: 1,
    backgroundColor: '#FBBF24',
  },
  spo2BarSegmentSafe: {
    flex: 2,
    backgroundColor: '#34D399',
  },
  spo2IndicatorPin: {
    position: 'absolute',
    top: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spo2PinDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#0284C7',
  },

  // 2-COLUMN GRID
  twoColumnGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  smallMetricCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  smallMetricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricIconCircleSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  smallMetricTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  smallMetricSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
  },
  smallMetricValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 8,
  },
  smallMetricValue: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
  },
  smallMetricUnit: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginLeft: 4,
    paddingBottom: 3,
  },
  impactSafeStatus: {
    fontSize: 11,
    fontWeight: '600',
    color: '#15803D',
    marginBottom: 6,
  },
  xyzAxisBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 4,
  },
  xyzAxisText: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
  },
  sensorNoteText: {
    fontSize: 9,
    color: '#94A3B8',
    textAlign: 'center',
  },

  // PEDOMETER
  stepCountGoalBadge: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stepCountGoalText: {
    color: '#7C3AED',
    fontSize: 11,
    fontWeight: '700',
  },
  stepStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 12,
  },
  stepStatBox: {
    flex: 1,
    alignItems: 'center',
  },
  stepStatBigNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#6D28D9',
  },
  stepStatLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  stepDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#F1F5F9',
  },
  stepProgressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  stepProgressBarFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8B5CF6',
  },

  // SLEEP
  sleepScoreBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sleepScoreBadgeText: {
    color: '#5B21B6',
    fontSize: 11,
    fontWeight: '700',
  },
  sleepTotalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 10,
  },
  sleepTotalTime: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1E1B4B',
  },
  sleepTotalSub: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 8,
  },
  sleepBarContainer: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginVertical: 6,
  },
  sleepSegmentDeep: {
    backgroundColor: '#312E81',
  },
  sleepSegmentLight: {
    backgroundColor: '#6366F1',
  },
  sleepSegmentAwake: {
    backgroundColor: '#FCD34D',
  },
  sleepLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sleepLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sleepLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  sleepLegendText: {
    fontSize: 10,
    color: '#475569',
  },

  // HARDWARE SPECS
  specsCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  specsCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  specsCardDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    marginBottom: 12,
  },
  specTableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  specTableKey: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
  },
  specTableVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1.2,
    textAlign: 'right',
  },

  // ALGO SHORTCUT
  algoShortcutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  algoShortcutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  algoShortcutIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  algoShortcutTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0369A1',
  },
  algoShortcutSub: {
    fontSize: 11,
    color: '#0284C7',
    marginTop: 2,
  },
});


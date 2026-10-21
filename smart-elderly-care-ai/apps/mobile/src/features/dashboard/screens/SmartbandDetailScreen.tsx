/**
 * SmartbandDetailScreen.tsx
 * Màn hình Chi tiết Vòng Đeo Tay Thông Minh (BLE Smartband) & Các chỉ số sức khỏe thu thập
 * Thiết kế chuẩn y khoa cho hệ thống Smart Elderly Care AI theo Proposal Capstone 1
 */

import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useVitalStore } from '../../../store/useVitalStore';
import { LocalizedAlert, LocalizedText } from '../../../i18n/LocalizedComponents';
import { useTheme } from '../../../store/useThemeStore';
import { SmartbandHeroCard } from '../components/smartband/SmartbandHeroCard';
import { SmartbandVitalsCards } from '../components/smartband/SmartbandVitalsCards';
import { SmartbandHardwareSpecsCard } from '../components/smartband/SmartbandHardwareSpecsCard';

export default function SmartbandDetailScreen({ navigation, route }: any) {
  const deviceParam = route?.params?.device;
  const { currentVitals, setVitals, algoSettings } = useVitalStore();
  const { isDarkMode, colors } = useTheme();

  const [isSyncing, setIsSyncing] = useState(false);
  const [isFinding, setIsFinding] = useState(false);

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
      LocalizedAlert.alert(
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
      LocalizedAlert.alert(
        'Đã Gửi Tín Hiệu Rung 📳',
        'Đã gửi lệnh GATT (Vibration Motor Alert) đến vòng đeo tay tại Phòng ngủ. Vòng tay đang rung 3 hồi chu kỳ.'
      );
    }, 800);
  };

  const hasHR = typeof currentVitals.heart_rate === 'number';
  const hasSpO2 = typeof currentVitals.spo2 === 'number';
  const hasTemp = typeof currentVitals.skin_temp_max === 'number';

  const hrValue: string | number = currentVitals.heart_rate != null ? currentVitals.heart_rate : '--';
  const spo2Value: string | number = currentVitals.spo2 != null ? currentVitals.spo2 : '--';
  const tempValue: string | number = currentVitals.skin_temp_max != null ? currentVitals.skin_temp_max : '--';

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* 1. Header Điều Hướng */}
      <View style={[styles.header, isDarkMode && { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.backButton, isDarkMode && { backgroundColor: colors.surfaceSubtle }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <LocalizedText style={[styles.headerTitle, isDarkMode && { color: colors.textPrimary }]}>
            {deviceParam?.name || 'Vòng đeo tay BLE Smartband'}
          </LocalizedText>
          <View style={styles.headerSubtitleRow}>
            <View style={styles.onlineDot} />
            <LocalizedText style={[styles.headerSubtitle, isDarkMode && { color: colors.textSecondary }]}>
              GATT BLE 5.0 • Đang kết nối trực tuyến
            </LocalizedText>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.settingsButton, isDarkMode && { backgroundColor: colors.surfaceSubtle }]}
          onPress={() => navigation.navigate('AlgoConfig')}
          activeOpacity={0.7}
        >
          <Ionicons name="options-outline" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, isDarkMode && { backgroundColor: colors.background }]}
      >
        {/* 2. Hero Card: Thông tin chi tiết vòng đeo tay */}
        <SmartbandHeroCard
          pulseAnim={pulseAnim}
          deviceParam={deviceParam}
          isSyncing={isSyncing}
          isFinding={isFinding}
          onSyncNow={handleSyncNow}
          onFindBand={handleFindBand}
          colors={colors}
          isDarkMode={isDarkMode}
        />

        {/* 3. Các thẻ chỉ số sức khỏe thu thập */}
        <SmartbandVitalsCards
          hrValue={hrValue}
          spo2Value={spo2Value}
          tempValue={tempValue}
          hasHR={hasHR}
          hasSpO2={hasSpO2}
          hasTemp={hasTemp}
          colors={colors}
          isDarkMode={isDarkMode}
        />

        {/* 4. Thông số kỹ thuật phần cứng & Phím tắt AlgoConfig */}
        <SmartbandHardwareSpecsCard
          algoSettings={algoSettings}
          onNavigateAlgoConfig={() => navigation.navigate('AlgoConfig')}
          colors={colors}
          isDarkMode={isDarkMode}
        />
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
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
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
});

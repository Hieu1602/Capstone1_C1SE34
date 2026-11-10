// AlgoConfigScreen.tsx
// Màn hình Căn Chỉnh Tham Số Thuật Toán ("Chơi Algo" - Screenshot 2)
// Cho phép thiết lập các ngưỡng kích hoạt cảnh báo theo yêu cầu Proposal

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { useVitalStore } from '../../../store/useVitalStore';
import { useTheme } from '../../../store/useThemeStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useDeviceStore } from '../../../store/useDeviceStore';
import { devicesApi } from '../../../services/deviceService';
import { alertsWS } from '../../../services/websocket';
import { LocalizedAlert, LocalizedText, LocalizedTextInput } from '../../../i18n/LocalizedComponents';


export default function AlgoConfigScreen({ navigation }: any) {
  const { isDarkMode } = useTheme();
  const { algoSettings, updateAlgoSettings } = useVitalStore();
  const { userRole, role, permissions, fetchMyPermissions } = useAuthStore();
  const [checkingPerms, setCheckingPerms] = useState(true);

  const { iotDevices, activeDevice } = useDeviceStore();

  useEffect(() => {
    fetchMyPermissions().finally(() => setCheckingPerms(false));
  }, []);

  const isOwnerOrAdmin =
    userRole === 'admin' ||
    role === 'admin' ||
    userRole === 'owner' ||
    role === 'owner' ||
    Boolean(permissions?.is_owner) ||
    permissions?.role_in_house === 'OWNER';
  const canManageDevices = isOwnerOrAdmin || Boolean(permissions?.can_manage_devices);

  const [maxHR, setMaxHR] = useState(algoSettings.maxHeartRate.toString());
  const [minHR, setMinHR] = useState(algoSettings.minHeartRate.toString());
  const [minSpO2, setMinSpO2] = useState(algoSettings.minSpO2.toString());
  const [maxTemp, setMaxTemp] = useState(algoSettings.maxTemp.toString());
  const [fallAngle, setFallAngle] = useState(algoSettings.fallAngle.toString());
  const [immobilitySec, setImmobilitySec] = useState(algoSettings.immobilitySec.toString());

  useEffect(() => {
    alertsWS.connect();
    const handleWs = (event: any) => {
      if (
        event?.type === 'ALERT_NEW' &&
        (event?.alert_type === 'DEVICE_CONFIG_UPDATED' || event?.data?.alert_type === 'DEVICE_CONFIG_UPDATED')
      ) {
        const t = event?.data?.thresholds;
        if (t) {
          if (t.hr_threshold_high) setMaxHR(String(t.hr_threshold_high));
          if (t.hr_threshold_low) setMinHR(String(t.hr_threshold_low));
          if (t.spo2_threshold_low) setMinSpO2(String(t.spo2_threshold_low));
          updateAlgoSettings({
            maxHeartRate: Number(t.hr_threshold_high) || 120,
            minHeartRate: Number(t.hr_threshold_low) || 50,
            minSpO2: Number(t.spo2_threshold_low) || 90,
          });
        }
      }
    };
    const unsub = alertsWS.subscribe(handleWs);
    return () => {
      unsub();
    };
  }, [updateAlgoSettings]);

  const handleSave = async () => {
    if (!canManageDevices) {
      LocalizedAlert.alert(
        'Không có quyền thay đổi',
        'Tài khoản Thành viên của bạn chưa được Chủ hộ cấp quyền "Cấu hình thiết bị & Tham số thuật toán AI". Vui lòng liên hệ Chủ hộ để được cấp quyền.'
      );
      return;
    }
    const newMaxHR = Number(maxHR) || 120;
    const newMinHR = Number(minHR) || 50;
    const newMinSpO2 = Number(minSpO2) || 90;
    const newMaxTemp = Number(maxTemp) || 37.8;
    const newFallAngle = Number(fallAngle) || 60;
    const newImmobilitySec = Number(immobilitySec) || 30;

    updateAlgoSettings({
      maxHeartRate: newMaxHR,
      minHeartRate: newMinHR,
      minSpO2: newMinSpO2,
      maxTemp: newMaxTemp,
      fallAngle: newFallAngle,
      immobilitySec: newImmobilitySec,
    });

    try {
      const devices = useDeviceStore.getState().iotDevices;
      const targetDev = devices.find((d) => d.type === 'watch' || d.type === 'SMARTBAND') || devices[0];
      const devId = targetDev?.deviceId || targetDev?.id || activeDevice?.id || 'BLE_BAND_01';
      if (devId) {
        await devicesApi.updateDeviceConfig(devId, {
          hr_threshold_high: newMaxHR,
          hr_threshold_low: newMinHR,
          spo2_threshold_low: newMinSpO2,
          immobility_seconds: newImmobilitySec,
        });
      }
    } catch (e) {
      console.warn('Sync device config fallback:', e);
    }

    const title = 'Cập nhật ngưỡng thành công';
    const msg = 'Đã lưu và đồng bộ các ngưỡng an toàn y tế và thuật toán cảnh báo xuống AI Edge Hub.';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n${msg}`);
      navigation.goBack();
    } else {
      Alert.alert(title, msg, [
        { text: 'Đồng ý', onPress: () => navigation.goBack() }
      ]);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && { backgroundColor: '#0B0F19' }]} edges={['top']}>
      <View style={[styles.topHeader, isDarkMode && { backgroundColor: '#0B0F19', borderBottomColor: '#334155' }]}>
        <TouchableOpacity
          style={[
            styles.backBtn,
            isDarkMode && { backgroundColor: '#1E293B', borderRadius: 18, borderWidth: 1, borderColor: '#334155' },
          ]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={isDarkMode ? '#F8FAFC' : Colors.textPrimary} />
        </TouchableOpacity>
        <LocalizedText style={[styles.headerTitle, isDarkMode && { color: '#F8FAFC' }]}>Cài Đặt Thuật Toán </LocalizedText>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >


        <LocalizedText style={[styles.introText, isDarkMode && { color: '#94A3B8' }]}>
          Tùy chỉnh ngưỡng kích hoạt báo động khẩn cấp (Red Alert) để phù hợp với tình trạng sức khỏe cụ thể của người cao tuổi.
        </LocalizedText>

        {/* 1. Ngưỡng Té ngã (FR03) */}
        <View style={[styles.groupCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]}>
          <LocalizedText style={styles.groupTitle}>1. Thuật toán phát hiện ngã (YOLO-Pose)</LocalizedText>
          <View style={styles.inputRow}>
            <LocalizedText style={[styles.inputLabel, isDarkMode && { color: '#F8FAFC' }]}>Góc nghiêng cột sống tối đa:</LocalizedText>
            <View style={[styles.inputBoxWrap, !canManageDevices && styles.inputBoxDisabled, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' }]}>
              <LocalizedTextInput
                style={[styles.inputVal, !canManageDevices && { opacity: 0.6 }, isDarkMode && { color: '#F8FAFC' }]}
                keyboardType="numeric"
                value={fallAngle}
                onChangeText={setFallAngle}
                editable={canManageDevices}
              />
              <LocalizedText style={[styles.inputUnit, isDarkMode && { color: '#94A3B8' }]}>độ (°)</LocalizedText>
            </View>
          </View>
          <View style={styles.inputRow}>
            <LocalizedText style={[styles.inputLabel, isDarkMode && { color: '#F8FAFC' }]}>Thời gian nằm bất động:</LocalizedText>
            <View style={[styles.inputBoxWrap, !canManageDevices && styles.inputBoxDisabled, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' }]}>
              <LocalizedTextInput
                style={[styles.inputVal, !canManageDevices && { opacity: 0.6 }, isDarkMode && { color: '#F8FAFC' }]}
                keyboardType="numeric"
                value={immobilitySec}
                onChangeText={setImmobilitySec}
                editable={canManageDevices}
              />
              <LocalizedText style={[styles.inputUnit, isDarkMode && { color: '#94A3B8' }]}>giây</LocalizedText>
            </View>
          </View>
        </View>

        {/* 2. Ngưỡng Sức khoẻ Vòng BLE (FR02) */}
        <View style={[styles.groupCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]}>
          <LocalizedText style={styles.groupTitle}>2. Thuật toán sức khoẻ (Vòng đeo tay BLE)</LocalizedText>
          <View style={styles.inputRow}>
            <LocalizedText style={[styles.inputLabel, isDarkMode && { color: '#F8FAFC' }]}>Nhịp tim tối đa (Cảnh báo cao):</LocalizedText>
            <View style={[styles.inputBoxWrap, !canManageDevices && styles.inputBoxDisabled, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' }]}>
              <LocalizedTextInput
                style={[styles.inputVal, !canManageDevices && { opacity: 0.6 }, isDarkMode && { color: '#F8FAFC' }]}
                keyboardType="numeric"
                value={maxHR}
                onChangeText={setMaxHR}
                editable={canManageDevices}
              />
              <LocalizedText style={[styles.inputUnit, isDarkMode && { color: '#94A3B8' }]}>bpm</LocalizedText>
            </View>
          </View>
          <View style={styles.inputRow}>
            <LocalizedText style={[styles.inputLabel, isDarkMode && { color: '#F8FAFC' }]}>Nhịp tim tối thiểu (Cảnh báo thấp):</LocalizedText>
            <View style={[styles.inputBoxWrap, !canManageDevices && styles.inputBoxDisabled, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' }]}>
              <LocalizedTextInput
                style={[styles.inputVal, !canManageDevices && { opacity: 0.6 }, isDarkMode && { color: '#F8FAFC' }]}
                keyboardType="numeric"
                value={minHR}
                onChangeText={setMinHR}
                editable={canManageDevices}
              />
              <LocalizedText style={[styles.inputUnit, isDarkMode && { color: '#94A3B8' }]}>bpm</LocalizedText>
            </View>
          </View>
          <View style={styles.inputRow}>
            <LocalizedText style={[styles.inputLabel, isDarkMode && { color: '#F8FAFC' }]}>Nồng độ oxy SpO₂ tối thiểu:</LocalizedText>
            <View style={[styles.inputBoxWrap, !canManageDevices && styles.inputBoxDisabled, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' }]}>
              <LocalizedTextInput
                style={[styles.inputVal, !canManageDevices && { opacity: 0.6 }, isDarkMode && { color: '#F8FAFC' }]}
                keyboardType="numeric"
                value={minSpO2}
                onChangeText={setMinSpO2}
                editable={canManageDevices}
              />
              <LocalizedText style={[styles.inputUnit, isDarkMode && { color: '#94A3B8' }]}>%</LocalizedText>
            </View>
          </View>
        </View>

        {/* 3. Ngưỡng Cảm biến nhiệt AMG8833 (FR04) */}
        <View style={[styles.groupCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]}>
          <LocalizedText style={styles.groupTitle}>3. Thuật toán nhiệt độ trán (AMG8833)</LocalizedText>
          <View style={styles.inputRow}>
            <LocalizedText style={[styles.inputLabel, isDarkMode && { color: '#F8FAFC' }]}>Ngưỡng sốt cao bất thường:</LocalizedText>
            <View style={[styles.inputBoxWrap, !canManageDevices && styles.inputBoxDisabled, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' }]}>
              <LocalizedTextInput
                style={[styles.inputVal, !canManageDevices && { opacity: 0.6 }, isDarkMode && { color: '#F8FAFC' }]}
                keyboardType="numeric"
                value={maxTemp}
                onChangeText={setMaxTemp}
                editable={canManageDevices}
              />
              <LocalizedText style={[styles.inputUnit, isDarkMode && { color: '#94A3B8' }]}>°C</LocalizedText>
            </View>
          </View>
        </View>

        {/* Nút lưu cấu hình thuật toán (chỉ hiển thị khi có quyền) */}
        {canManageDevices && (
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            activeOpacity={0.85}
          >
            <LocalizedText style={styles.saveBtnText}>
              Lưu cấu hình thuật toán
            </LocalizedText>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topHeader: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    position: 'absolute',
    left: 10,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 36,
  },
  introText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  groupCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    ...Shadows.card,
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    gap: 12,
  },
  inputLabel: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
    flex: 1,
    lineHeight: 20,
  },
  inputBoxWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputVal: {
    width: 52,
    paddingVertical: 6,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  inputUnit: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 2,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 10,
    ...Shadows.card,
  },
  saveBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
  },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#F87171',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  lockBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#991B1B',
    marginBottom: 2,
  },
  lockBannerDesc: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 16,
  },
  inputBoxDisabled: {
    backgroundColor: '#E2E8F0',
    borderColor: '#CBD5E1',
  },
});

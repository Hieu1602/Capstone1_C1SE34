// AlgoConfigScreen.tsx
// Màn hình Căn Chỉnh Tham Số Thuật Toán ("Chơi Algo" - Screenshot 2)
// Cho phép thiết lập các ngưỡng kích hoạt cảnh báo theo yêu cầu Proposal

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { useVitalStore } from '../../../store/useVitalStore';
import { useTheme } from '../../../store/useThemeStore';

export default function AlgoConfigScreen({ navigation }: any) {
  const { isDarkMode } = useTheme();
  const { algoSettings, updateAlgoSettings } = useVitalStore();
  const [maxHR, setMaxHR] = useState(algoSettings.maxHeartRate.toString());
  const [minHR, setMinHR] = useState(algoSettings.minHeartRate.toString());
  const [minSpO2, setMinSpO2] = useState(algoSettings.minSpO2.toString());
  const [maxTemp, setMaxTemp] = useState(algoSettings.maxTemp.toString());
  const [fallAngle, setFallAngle] = useState(algoSettings.fallAngle.toString());
  const [immobilitySec, setImmobilitySec] = useState(algoSettings.immobilitySec.toString());

  const handleSave = () => {
    updateAlgoSettings({
      maxHeartRate: Number(maxHR) || 120,
      minHeartRate: Number(minHR) || 50,
      minSpO2: Number(minSpO2) || 90,
      maxTemp: Number(maxTemp) || 37.8,
      fallAngle: Number(fallAngle) || 60,
      immobilitySec: Number(immobilitySec) || 30,
    });
    Alert.alert('Thành công', 'Đã cập nhật các tham số thuật toán cảnh báo cho Hub Edge AI.');
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
        <Text style={[styles.headerTitle, isDarkMode && { color: '#F8FAFC' }]}>Cài Đặt Thuật Toán (Algo)</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={[styles.introText, isDarkMode && { color: '#94A3B8' }]}>
          Tùy chỉnh ngưỡng kích hoạt báo động khẩn cấp (Red Alert) để phù hợp với tình trạng sức khỏe cụ thể của người cao tuổi.
        </Text>

        {/* 1. Ngưỡng Té ngã (FR03) */}
        <View style={[styles.groupCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]}>
          <Text style={styles.groupTitle}>1. Thuật toán phát hiện ngã (YOLO-Pose)</Text>
          <View style={styles.inputRow}>
            <Text style={[styles.inputLabel, isDarkMode && { color: '#F8FAFC' }]}>Góc nghiêng cột sống tối đa:</Text>
            <View style={[styles.inputBoxWrap, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' }]}>
              <TextInput
                style={[styles.inputVal, isDarkMode && { color: '#F8FAFC' }]}
                keyboardType="numeric"
                value={fallAngle}
                onChangeText={setFallAngle}
              />
              <Text style={[styles.inputUnit, isDarkMode && { color: '#94A3B8' }]}>độ (°)</Text>
            </View>
          </View>
          <View style={styles.inputRow}>
            <Text style={[styles.inputLabel, isDarkMode && { color: '#F8FAFC' }]}>Thời gian nằm bất động:</Text>
            <View style={[styles.inputBoxWrap, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' }]}>
              <TextInput
                style={[styles.inputVal, isDarkMode && { color: '#F8FAFC' }]}
                keyboardType="numeric"
                value={immobilitySec}
                onChangeText={setImmobilitySec}
              />
              <Text style={[styles.inputUnit, isDarkMode && { color: '#94A3B8' }]}>giây</Text>
            </View>
          </View>
        </View>

        {/* 2. Ngưỡng Sức khoẻ Vòng BLE (FR02) */}
        <View style={[styles.groupCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]}>
          <Text style={styles.groupTitle}>2. Thuật toán sức khoẻ (Vòng đeo tay BLE)</Text>
          <View style={styles.inputRow}>
            <Text style={[styles.inputLabel, isDarkMode && { color: '#F8FAFC' }]}>Nhịp tim tối đa (Cảnh báo cao):</Text>
            <View style={[styles.inputBoxWrap, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' }]}>
              <TextInput
                style={[styles.inputVal, isDarkMode && { color: '#F8FAFC' }]}
                keyboardType="numeric"
                value={maxHR}
                onChangeText={setMaxHR}
              />
              <Text style={[styles.inputUnit, isDarkMode && { color: '#94A3B8' }]}>bpm</Text>
            </View>
          </View>
          <View style={styles.inputRow}>
            <Text style={[styles.inputLabel, isDarkMode && { color: '#F8FAFC' }]}>Nhịp tim tối thiểu (Cảnh báo thấp):</Text>
            <View style={[styles.inputBoxWrap, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' }]}>
              <TextInput
                style={[styles.inputVal, isDarkMode && { color: '#F8FAFC' }]}
                keyboardType="numeric"
                value={minHR}
                onChangeText={setMinHR}
              />
              <Text style={[styles.inputUnit, isDarkMode && { color: '#94A3B8' }]}>bpm</Text>
            </View>
          </View>
          <View style={styles.inputRow}>
            <Text style={[styles.inputLabel, isDarkMode && { color: '#F8FAFC' }]}>Nồng độ oxy SpO₂ tối thiểu:</Text>
            <View style={[styles.inputBoxWrap, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' }]}>
              <TextInput
                style={[styles.inputVal, isDarkMode && { color: '#F8FAFC' }]}
                keyboardType="numeric"
                value={minSpO2}
                onChangeText={setMinSpO2}
              />
              <Text style={[styles.inputUnit, isDarkMode && { color: '#94A3B8' }]}>%</Text>
            </View>
          </View>
        </View>

        {/* 3. Ngưỡng Cảm biến nhiệt AMG8833 (FR04) */}
        <View style={[styles.groupCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]}>
          <Text style={styles.groupTitle}>3. Thuật toán nhiệt độ trán (AMG8833)</Text>
          <View style={styles.inputRow}>
            <Text style={[styles.inputLabel, isDarkMode && { color: '#F8FAFC' }]}>Ngưỡng sốt cao bất thường:</Text>
            <View style={[styles.inputBoxWrap, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' }]}>
              <TextInput
                style={[styles.inputVal, isDarkMode && { color: '#F8FAFC' }]}
                keyboardType="numeric"
                value={maxTemp}
                onChangeText={setMaxTemp}
              />
              <Text style={[styles.inputUnit, isDarkMode && { color: '#94A3B8' }]}>°C</Text>
            </View>
          </View>
        </View>

        {/* Nút lưu */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <Text style={styles.saveBtnText}>Lưu cấu hình thuật toán</Text>
        </TouchableOpacity>
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
    marginTop: 10,
    ...Shadows.card,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
  },
});

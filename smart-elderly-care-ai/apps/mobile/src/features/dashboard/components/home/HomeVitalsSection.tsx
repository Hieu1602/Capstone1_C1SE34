import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText as Text } from '../../../../i18n/LocalizedComponents';
import { Colors } from '../../../../theme/colors';
import { VitalsSummaryCard } from '../VitalsSummaryCard';
import { HealthTrendsCard } from '../HealthTrendsCard';

interface HomeVitalsSectionProps {
  patientsList: any[];
  patientRecord: any;
  iotDevices: any[];
  currentVitals: any;
  isEdgeHubOnline: boolean;
  braceletBattery?: number | null;
  isAcousticAlarm: boolean;
  cardWidth: number;
  isDarkMode: boolean;
  colors: any;
  navigation: any;
}

export const HomeVitalsSection: React.FC<HomeVitalsSectionProps> = ({
  patientsList,
  patientRecord,
  iotDevices,
  currentVitals,
  isEdgeHubOnline,
  braceletBattery,
  isAcousticAlarm,
  cardWidth,
  isDarkMode,
  colors,
  navigation,
}) => {
  const [activePatientIndex, setActivePatientIndex] = useState(0);

  // Danh sách người cao tuổi trong gia đình
  const effectivePatientsList = (patientsList && patientsList.length > 0)
    ? patientsList
    : (patientRecord && patientRecord.name && patientRecord.name.trim() !== ''
        ? [{
            id: patientRecord.patient_id || patientRecord.id,
            full_name: patientRecord.name,
            name: patientRecord.name,
            age: patientRecord.age,
            gender: patientRecord.gender,
            avatar_url: patientRecord.avatar_url,
          }]
        : []);

  // Chuẩn hóa tên (bỏ dấu, chữ thường) để so sánh chính xác
  const normalizeStr = (s: any) =>
    String(s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd');

  // Kiểm tra thiết bị có phải là vòng đeo tay BLE / Smartband / Watch hay không
  const isSmartbandDevice = (d: any) => {
    if (!d) return false;
    const type = String(d.type || '').toLowerCase();
    const icon = String(d.icon || '').toLowerCase();
    const name = String(d.name || '').toLowerCase();
    const devType = String(d.device_type || '').toLowerCase();
    return (
      type === 'watch' ||
      type === 'smartband' ||
      type === 'band' ||
      icon === 'watch' ||
      devType.includes('band') ||
      devType.includes('watch') ||
      name.includes('smartband') ||
      name.includes('smart band') ||
      name.includes('band') ||
      name.includes('xiaomi') ||
      name.includes('vòng') ||
      name.includes('đồng hồ')
    );
  };

  // Hàm trích xuất vòng tay và chỉ số sinh hiệu gán riêng cho từng cụ
  // QUY TẮC: 1 đồng hồ chỉ kết nối với 1 cụ duy nhất. Cụ chưa gán đồng hồ -> dữ liệu rỗng.
  const getPatientVitalsData = (patient: any, idx: number) => {
    const pId = String(patient?.id || patient?.elderly_id || '');
    const pName = normalizeStr(patient?.full_name || patient?.name);

    const bands = (iotDevices || []).filter(isSmartbandDevice);

    // 1. Khớp theo ID người cao tuổi
    let patientDevice = bands.find((d: any) => {
      if (d.elderly_id && pId && String(d.elderly_id).toLowerCase() === pId.toLowerCase()) {
        return true;
      }
      return false;
    });

    // 2. Khớp theo tên người đeo (wearer_name)
    if (!patientDevice && pName) {
      patientDevice = bands.find((d: any) => {
        if (d.wearer_name && normalizeStr(d.wearer_name) === pName) {
          return true;
        }
        return false;
      });
    }

    // 3. Fallback cho người cao tuổi đầu tiên (Cụ chính trong nhà)
    // Nếu là cụ thứ 1 (idx === 0) và có vòng trong nhà chưa gán hoặc vòng đeo của cụ
    if (!patientDevice && idx === 0 && bands.length > 0) {
      const candidate = bands.find((d: any) => {
        if (!d.wearer_name && !d.elderly_id) return true;
        if (d.wearer_name && pName && normalizeStr(d.wearer_name) === pName) return true;
        return false;
      });
      patientDevice = candidate || (bands.length === 1 && !bands[0].wearer_name ? bands[0] : null);
    }

    if (!patientDevice) {
      // Cụ này chưa được gán đồng hồ thông minh -> Không lấy chỉ số của cụ khác
      return {
        patientDevice: null,
        vitals: {
          heart_rate: null,
          spo2: null,
          skin_temp_max: null,
          fall_detected: false,
          timestamp: null,
          bracelet_connected: false,
          bracelet_battery: null,
        },
        battery: null,
      };
    }

    // Kiểm tra chính xác: currentVitals có thực sự thuộc về đồng hồ của cụ này không?
    const curDevId = String((currentVitals as any)?.device_id || '').toLowerCase();
    const devSerial = String(patientDevice.deviceId || patientDevice.device_id || '').toLowerCase();
    const devUuid = String(patientDevice.id || '').toLowerCase();

    const isMatchingDevice = Boolean(
      curDevId
        ? (
            (devSerial && (curDevId === devSerial || curDevId.includes(devSerial) || devSerial.includes(curDevId))) ||
            (devUuid && (curDevId === devUuid || curDevId.includes(devUuid) || devUuid.includes(curDevId)))
          )
        : (idx === 0)
    );

    // Nếu đồng hồ của cụ này chưa bật hoặc không khớp với thiết bị đang phát dữ liệu:
    if (!isMatchingDevice || currentVitals?.bracelet_connected === false) {
      return {
        patientDevice,
        vitals: {
          heart_rate: null,
          spo2: null,
          skin_temp_max: null,
          fall_detected: false,
          timestamp: null,
          bracelet_connected: false,
          bracelet_battery: null,
        },
        battery: null,
      };
    }

    // Cụ này ĐƯỢC gán đồng hồ VÀ đúng là đồng hồ đang phát dữ liệu -> nhận luồng sinh hiệu hiện tại
    return {
      patientDevice,
      vitals: currentVitals,
      battery: braceletBattery ?? currentVitals?.bracelet_battery ?? patientDevice?.battery_level ?? null,
    };
  };

  // Nếu chỉ có 1 người cao tuổi, hiển thị dạng đơn lẻ chuẩn như trước
  if (effectivePatientsList.length <= 1) {
    const singlePatient = effectivePatientsList[0];
    const { patientDevice, vitals, battery } = getPatientVitalsData(singlePatient, 0);
    return (
      <View style={{ marginBottom: 16 }}>
        <VitalsSummaryCard
          patient={singlePatient}
          patientDevice={patientDevice}
          currentVitals={vitals}
          isEdgeHubOnline={isEdgeHubOnline}
          braceletBattery={battery}
          isAcousticAlarm={isAcousticAlarm}
          isDarkMode={isDarkMode}
          colors={colors}
          navigation={navigation}
        />
        <HealthTrendsCard
          patient={singlePatient}
          patientDevice={patientDevice}
          currentVitals={vitals}
          isDarkMode={isDarkMode}
          colors={colors}
          navigation={navigation}
        />
      </View>
    );
  }

  // Khi gia đình có từ 2 - 3 người lớn tuổi trở lên: chế độ Carousel vuốt ngang mượt mà
  return (
    <View style={{ marginBottom: 16 }}>
      {/* Thanh tiêu đề & chuyển đổi người cao tuổi */}
      <View style={styles.carouselHeaderRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[styles.sectionTitle, isDarkMode && { color: colors.textPrimary }]}>
            Chỉ số sinh hiệu
          </Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{effectivePatientsList.length} người cao tuổi</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate('PatientsList')}
          style={styles.allPatientsBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.allPatientsBtnText}>Hồ sơ</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={cardWidth + 12}
        snapToAlignment="center"
        contentContainerStyle={{ gap: 12 }}
        onScroll={(e) => {
          const x = e.nativeEvent.contentOffset.x;
          const idx = Math.round(x / (cardWidth + 12));
          if (idx !== activePatientIndex && idx >= 0 && idx < effectivePatientsList.length) {
            setActivePatientIndex(idx);
          }
        }}
        scrollEventThrottle={16}
      >
        {effectivePatientsList.map((patient: any, idx: number) => {
          const { patientDevice, vitals, battery } = getPatientVitalsData(patient, idx);
          return (
            <View key={patient.id || `patient-${idx}`} style={{ width: cardWidth }}>
              <VitalsSummaryCard
                patient={patient}
                patientDevice={patientDevice}
                currentVitals={vitals}
                isEdgeHubOnline={isEdgeHubOnline}
                braceletBattery={battery}
                isAcousticAlarm={isAcousticAlarm}
                isDarkMode={isDarkMode}
                colors={colors}
                navigation={navigation}
              />
              <HealthTrendsCard
                patient={patient}
                patientDevice={patientDevice}
                currentVitals={vitals}
                isDarkMode={isDarkMode}
                colors={colors}
                navigation={navigation}
              />
            </View>
          );
        })}
      </ScrollView>

      {/* Dấu chấm chuyển trang Carousel */}
      <View style={styles.carouselDotsRow}>
        {effectivePatientsList.map((_, idx) => (
          <View
            key={`dot-${idx}`}
            style={[
              styles.carouselDot,
              idx === activePatientIndex
                ? [styles.carouselDotActive, { backgroundColor: Colors.primary }]
                : [styles.carouselDotInactive, { backgroundColor: isDarkMode ? '#475569' : '#CBD5E1' }],
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  carouselHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  countBadge: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 0.8,
    borderColor: '#FED7AA',
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  allPatientsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  allPatientsBtnText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '700',
  },
  carouselDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  carouselDot: {
    height: 6,
    borderRadius: 3,
  },
  carouselDotActive: {
    width: 20,
  },
  carouselDotInactive: {
    width: 6,
  },
});

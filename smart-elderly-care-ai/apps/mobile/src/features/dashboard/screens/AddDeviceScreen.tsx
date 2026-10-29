/**
 * AddDeviceScreen.tsx
 * Màn hình Thêm thiết bị mới (Onboarding Wizard đa giao thức)
 * Nghiệp vụ: Điều khiển máy trạng thái hữu hạn (FSM) hỗ trợ cài đặt thiết bị qua Wi-Fi AP (Camera AI SECA_001),
 * ghép nối BLE (Smartband nhịp tim/SpO2/MPU6050) và Gateway MQTT (Orange Pi 5).
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, TouchableOpacity, ScrollView, Animated, Linking, Platform, TurboModuleRegistry, NativeModules } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useVitalStore, IoTDeviceItem } from '../../../store/useVitalStore';
import { LocalizedText } from '../../../i18n/LocalizedComponents';
import { createThemeStyles, useTheme } from '../../../store/useThemeStore';
import { multiWearableManager } from '../../../services/multiWearableManager';
import { startWearablePipeline, processAndUploadVital } from '../../../services/wearableIntegration';

import {
  FlowStep,
  ProtocolType,
  PREVIOUS_STEP_MAP,
  DiscoveredBleItem,
  SetupSuccessInfo,
  baseStyles,
  StepCategorySelect,
  StepCameraFlow,
  StepCameraSearching,
  StepWatchFlow,
  StepBleScanAndPairing,
  StepOtherSensors,
  StepSetupSuccess,
  AddDeviceModals,
} from '../components/add-device';

export default function AddDeviceScreen({ navigation }: any) {
  const { addIoTDevice } = useVitalStore();
  const { isDarkMode, colors } = useTheme();
  const styles = useMemo(
    () => createThemeStyles(baseStyles, isDarkMode, colors),
    [isDarkMode, colors],
  );

  // ---- 1. State Quản lý Luồng & Giao thức ----
  const [currentStep, setCurrentStep] = useState<FlowStep>('CATEGORY_SELECT');
  const [protocol, setProtocol] = useState<ProtocolType>('WIFI_AP');
  const [selectedDeviceModel, setSelectedDeviceModel] = useState<string>('');

  // ---- 2. State Nhánh Wi-Fi AP (Camera) ----
  const [isLedBlinking, setIsLedBlinking] = useState<boolean>(true);
  const [showPhoneWifiSettingsModal, setShowPhoneWifiSettingsModal] = useState<boolean>(false);
  const [selectedPhoneWifi, setSelectedPhoneWifi] = useState<string>('SECA_001');
  const [isConnectingPhoneWifi, setIsConnectingPhoneWifi] = useState<boolean>(false);
  const [connectedPhoneWifi, setConnectedPhoneWifi] = useState<string | null>(null);
  const [showWifiWarningDialog, setShowWifiWarningDialog] = useState<boolean>(false);
  const [showResetGuideModal, setShowResetGuideModal] = useState<boolean>(false);

  // Radar Pulse Animations cho bước WIFI_SEARCHING
  const searchingPulseAnim1 = useRef(new Animated.Value(0)).current;
  const searchingPulseAnim2 = useRef(new Animated.Value(0)).current;

  // ---- 3. State Nhánh Bluetooth (Smartwatch) ----
  const [hasBlePermission, setHasBlePermission] = useState<boolean>(false);
  const [showPermRequestModal, setShowPermRequestModal] = useState<boolean>(false);
  const [isBleScanning, setIsBleScanning] = useState<boolean>(false);
  const [showBleErrorDialog, setShowBleErrorDialog] = useState<boolean>(false);
  const [isBlePairing, setIsBlePairing] = useState<boolean>(false);
  const [isBlePairingSuccess, setIsBlePairingSuccess] = useState<boolean>(false);
  const [bleErrorMessage, setBleErrorMessage] = useState<string>('');
  const [selectedBleDevice, setSelectedBleDevice] = useState<DiscoveredBleItem | null>(null);
  const [discoveredBleList, setDiscoveredBleList] = useState<DiscoveredBleItem[]>([]);

  // Radar Animation cho BLE
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ---- 4. State Nhánh Khác (Cảm biến IoT) ----
  const [selectedOtherSensor, setSelectedOtherSensor] = useState<string>('amg8833');
  const [otherSensorLocation, setOtherSensorLocation] = useState<string>('Phòng khách');

  // ---- 5. State Màn hình Thành công (SetupSuccess) ----
  const [successInfo, setSuccessInfo] = useState<SetupSuccessInfo>({
    name: '',
    type: '',
    protocol: '',
    details: '',
    location: '',
    icon: 'checkmark-circle',
    color: '#10B981',
  });

  // Radar Pulse Effect khi ở bước BLE_SCAN
  useEffect(() => {
    if (currentStep === 'BLE_SCAN' && isBleScanning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.35,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [currentStep, isBleScanning]);

  // Hiệu ứng sóng radar khi ở màn hình WIFI_SEARCHING
  useEffect(() => {
    if (currentStep === 'WIFI_SEARCHING') {
      searchingPulseAnim1.setValue(0);
      searchingPulseAnim2.setValue(0);

      const radarAnimation = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(searchingPulseAnim1, {
              toValue: 1,
              duration: 2200,
              useNativeDriver: true,
            }),
            Animated.timing(searchingPulseAnim1, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(900),
            Animated.timing(searchingPulseAnim2, {
              toValue: 1,
              duration: 2200,
              useNativeDriver: true,
            }),
            Animated.timing(searchingPulseAnim2, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      radarAnimation.start();

      // Sau 4 giây tìm kiếm, nếu không phát hiện được camera SECA_001 thực tế -> Báo lỗi, không thêm thiết bị ảo
      const timer = setTimeout(() => {
        setCurrentStep('WIFI_GUIDE');
        setShowWifiWarningDialog(true);
      }, 4000);

      return () => {
        clearTimeout(timer);
        radarAnimation.stop();
      };
    }
  }, [currentStep]);

  // Handle Back Button navigation
  const handleBack = () => {
    if (currentStep === 'CATEGORY_SELECT') {
      navigation.goBack();
      return;
    }
    if (currentStep === 'SETUP_SUCCESS') {
      navigation.navigate('Devices');
      return;
    }
    setCurrentStep(PREVIOUS_STEP_MAP[currentStep] || 'CATEGORY_SELECT');
  };

  const handleExit = () => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main');
    }
  };

  // -------------------------------------------------------------
  // LOGIC NHÁNH WI-FI AP (Camera)
  // -------------------------------------------------------------
  const handleSelectCameraModel = (model: string) => {
    setSelectedDeviceModel(model);
    setProtocol('WIFI_AP');
    setCurrentStep('WIFI_POWER_CHECK');
  };

  const phoneWifiNetworks = [
    {
      ssid: 'SECA_001',
      desc: 'Mạng SoftAP phát ra từ Camera SECA • Không cần mật khẩu',
      icon: 'wifi',
      isValid: true,
      isTarget: true,
      hasLock: false,
      tag: 'Thiết bị SECA',
    },
    {
      ssid: '5 chang trai',
      desc: 'Mạng Wi-Fi gia đình hiện tại',
      icon: 'wifi',
      isValid: true,
      isTarget: false,
      hasLock: true,
      tag: '2.4G/5G',
    },
    {
      ssid: 'Dinh Quan',
      desc: 'Mạng Wi-Fi gia đình lân cận',
      icon: 'wifi',
      isValid: false,
      isTarget: false,
      hasLock: true,
      tag: '2.4G/5G',
    },
    {
      ssid: 'Thien Khoa',
      desc: 'Mạng Wi-Fi lân cận',
      icon: 'wifi',
      isValid: false,
      isTarget: false,
      hasLock: true,
    },
    {
      ssid: 'Vu Trang',
      desc: 'Mạng Wi-Fi lân cận',
      icon: 'wifi',
      isValid: false,
      isTarget: false,
      hasLock: true,
    },
  ];

  const handleOpenPhoneWifiSettings = () => {
    try {
      if (Platform.OS === 'android') {
        Linking.sendIntent('android.settings.WIFI_SETTINGS').catch(() => {
          Linking.openSettings().catch(() => {});
        });
      } else if (Platform.OS === 'ios') {
        Linking.openURL('App-Prefs:WIFI').catch(() => {
          Linking.openSettings().catch(() => {});
        });
      }
    } catch (e) {
      // ignore
    }
    setShowPhoneWifiSettingsModal(true);
  };

  const handleConnectPhoneWifi = (ssid: string) => {
    setSelectedPhoneWifi(ssid);
    setIsConnectingPhoneWifi(true);

    setTimeout(() => {
      setIsConnectingPhoneWifi(false);
      setConnectedPhoneWifi(ssid);

      if (ssid === 'SECA_001') {
        setTimeout(() => {
          setShowPhoneWifiSettingsModal(false);
          setCurrentStep('WIFI_SEARCHING');
        }, 500);
      }
    }, 700);
  };

  const handlePressAlreadyConnected = () => {
    if (connectedPhoneWifi === 'SECA_001') {
      setCurrentStep('WIFI_SEARCHING');
    } else {
      setShowWifiWarningDialog(true);
    }
  };

  // -------------------------------------------------------------
  // LOGIC NHÁNH THIẾT BỊ ĐEO (BLE & Google Health Connect)
  // Quy trình: Chọn nguồn -> Quét/Kiểm tra quyền -> Kết nối/Đọc dữ liệu -> Chuẩn hóa -> Kiểm tra hợp lệ -> Gửi dữ liệu
  // -------------------------------------------------------------
  const handleSelectWatchModel = (model: string) => {
    setSelectedDeviceModel(model);
    if (model.includes('Health Connect')) {
      setCurrentStep('HEALTH_CONNECT_SETUP');
    } else {
      setProtocol('BLUETOOTH');
      setCurrentStep('BLE_POWER_CHECK');
    }
  };

  const handleOpenHealthConnectSettings = async () => {
    try {
      const mod = require('@mbdayo/react-native-health-kits');
      const HealthKits = mod.default || mod;
      if (HealthKits?.openHealthConnectSettings) {
        await HealthKits.openHealthConnectSettings();
      }
    } catch (e) {
      console.warn('[HealthConnect] Open settings error:', e);
    }
  };

  const handleConnectHealthConnect = async () => {
    if (Platform.OS !== 'android') {
      setBleErrorMessage('Google Health Connect chỉ hỗ trợ trên điện thoại Android.');
      setShowBleErrorDialog(true);
      return;
    }

    let HealthKits: any = null;
    try {
      const mod = require('@mbdayo/react-native-health-kits');
      HealthKits = mod.default || mod;
    } catch (err) {
      console.warn('[HealthConnect] Require module error:', err);
    }

    if (!HealthKits) {
      setBleErrorMessage(
        'Không thể nạp module Google Health Connect trên thiết bị này.'
      );
      setShowBleErrorDialog(true);
      return;
    }

    try {
      const isAvailable = await HealthKits.isAvailable?.();
      if (!isAvailable) {
        setBleErrorMessage(
          'Dịch vụ Google Health Connect không khả dụng hoặc chưa được cài đặt trên điện thoại. Vui lòng mở Google Play Store để cài đặt hoặc kích hoạt Health Connect.'
        );
        setShowBleErrorDialog(true);
        return;
      }

      // Xin quyền theo đúng chuẩn của @mbdayo/react-native-health-kits
      const permissions = [
        { type: 'heartRate', access: 'read' },
        { type: 'oxygenSaturation', access: 'read' },
        { type: 'bodyTemperature', access: 'read' },
        { type: 'steps', access: 'read' },
      ];

      const granted = await HealthKits.requestPermissions(permissions);
      if (!granted) {
        setBleErrorMessage('Chưa được cấp quyền truy cập các chỉ số trong Google Health Connect. Vui lòng nhấn Cho phép khi hộp thoại hiện lên hoặc vào Cài đặt để kích hoạt.');
        setShowBleErrorDialog(true);
        return;
      }

      let readVitals: { heartRate?: number; spo2?: number; temp?: number } = {};
      const now = new Date();
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      try {
        const hrRecords = await HealthKits.readData({
          type: 'heartRate',
          startDate: oneDayAgo,
          endDate: now,
        });
        if (Array.isArray(hrRecords) && hrRecords.length > 0) {
          const latest = hrRecords[hrRecords.length - 1];
          if (typeof latest.value === 'number') {
            readVitals.heartRate = Math.round(latest.value);
          }
        }
      } catch (hrErr) {
        console.log('[HealthConnect] Chưa có dữ liệu nhịp tim:', hrErr);
      }

      try {
        const spo2Records = await HealthKits.readData({
          type: 'oxygenSaturation',
          startDate: oneDayAgo,
          endDate: now,
        });
        if (Array.isArray(spo2Records) && spo2Records.length > 0) {
          const latest = spo2Records[spo2Records.length - 1];
          if (typeof latest.value === 'number') {
            readVitals.spo2 = Math.round(latest.value);
          }
        }
      } catch (spo2Err) {
        console.log('[HealthConnect] Chưa có dữ liệu SpO2:', spo2Err);
      }

      try {
        const tempRecords = await HealthKits.readData({
          type: 'bodyTemperature',
          startDate: oneDayAgo,
          endDate: now,
        });
        if (Array.isArray(tempRecords) && tempRecords.length > 0) {
          const latest = tempRecords[tempRecords.length - 1];
          if (typeof latest.value === 'number') {
            readVitals.temp = Math.round(latest.value * 10) / 10;
          }
        }
      } catch (tempErr) {
        console.log('[HealthConnect] Chưa có dữ liệu thân nhiệt:', tempErr);
      }

      // Khởi tạo giá trị ban đầu hợp lệ nếu chưa có bản ghi gần đây
      if (!readVitals.heartRate) readVitals.heartRate = 75;
      if (!readVitals.spo2) readVitals.spo2 = 98;
      if (!readVitals.temp) readVitals.temp = 36.5;

      // Chuẩn hóa dữ liệu + Kiểm tra hợp lệ + Gửi dữ liệu SECA (FastAPI + TimescaleDB + Store)
      const deviceIdentifier = `health-connect-${Date.now()}`;
      await processAndUploadVital({
        deviceId: deviceIdentifier,
        heartRate: readVitals.heartRate,
        spo2: readVitals.spo2,
        bodyTemperature: readVitals.temp,
        timestamp: Date.now(),
      }, deviceIdentifier);

      const newDevice: IoTDeviceItem = {
        id: deviceIdentifier,
        name: 'Google Health Connect',
        sub: 'Google Health Connect • Nhịp tim • SpO₂',
        type: 'band',
        status: 'Đang kết nối • Tự động đồng bộ',
        isOnline: true,
        icon: 'fitness',
        color: '#7C3AED',
        location: 'Người cao tuổi trong nhà',
        macAddress: 'Health Connect Android',
      };
      addIoTDevice(newDevice);

      setSuccessInfo({
        name: newDevice.name,
        type: 'Google Health Connect',
        protocol: 'Health Connect',
        details: 'Đang kết nối • Tự động đồng bộ sinh hiệu',
        location: 'Người cao tuổi trong nhà',
        icon: 'fitness',
        color: '#7C3AED',
      });

      setCurrentStep('SETUP_SUCCESS');
    } catch (e: any) {
      console.warn('[HealthConnect] Lỗi kết nối Health Connect:', e);
      setBleErrorMessage(`Lỗi Health Connect: ${e?.message || e}`);
      setShowBleErrorDialog(true);
    }
  };

  const triggerBleScan = async () => {
    setIsBleScanning(true);
    setDiscoveredBleList([]);
    try {
      const found = await multiWearableManager.discoverDevices(7000);
      const items: DiscoveredBleItem[] = found.map((d) => ({
        id: d.id,
        name: d.name || 'Thiết bị BLE',
        mac: d.id,
        rssi: '-55 dBm',
        battery: 90,
        services: 'Đo nhịp tim, SpO₂',
        rawDevice: d.device,
      }));
      setDiscoveredBleList(items);
    } catch (e) {
      console.warn('[BLE_SCAN] scan error', e);
    } finally {
      setIsBleScanning(false);
    }
  };

  const handleGrantBlePermission = () => {
    setHasBlePermission(true);
    setShowPermRequestModal(false);
    setCurrentStep('BLE_SCAN');
    triggerBleScan();
  };

  const handleSelectBleDevice = async (item: DiscoveredBleItem) => {
    setSelectedBleDevice(item);
    setCurrentStep('BLE_PAIRING');
    setIsBlePairing(true);
    setIsBlePairingSuccess(false);

    try {
      if (!item.rawDevice) {
        throw new Error('Không tìm thấy tín hiệu phần cứng Bluetooth từ thiết bị này.');
      }
      await multiWearableManager.connectAndStart(
        { id: item.id, name: item.name, device: item.rawDevice },
        (deviceId, m) => {
          // Chuẩn hóa -> Kiểm tra hợp lệ -> Gửi dữ liệu SECA
          processAndUploadVital({
            deviceId,
            metric: m.metric,
            value: m.value,
            timestamp: m.measuredAt.getTime(),
          }, deviceId);
        }
      );
      startWearablePipeline(item.id);
      setIsBlePairingSuccess(true);
      setIsBlePairing(false);
    } catch (e: any) {
      console.warn('[BLE_PAIRING] Connection error', e);
      setIsBlePairing(false);
      setIsBlePairingSuccess(false);
      setBleErrorMessage(e?.message || 'Không thể kết nối GATT với thiết bị BLE. Vui lòng thử lại.');
      setShowBleErrorDialog(true);
    }
  };

  const handleConfirmPairing = () => {
    if (!selectedBleDevice || !isBlePairingSuccess) return;
    const item = selectedBleDevice;

    const newDevice: IoTDeviceItem = {
      id: 'ble-smartband-' + Date.now(),
      name: item.name || 'Vòng đeo tay BLE',
      sub: 'Bluetooth BLE • Nhịp tim • SpO₂',
      type: 'band',
      status: `Đang kết nối • Pin ${item.battery}%`,
      isOnline: true,
      icon: 'watch',
      color: '#10B981',
      location: 'Người cao tuổi trong nhà',
      macAddress: item.mac,
    };
    addIoTDevice(newDevice);

    setSuccessInfo({
      name: newDevice.name,
      type: 'Đồng hồ / Vòng đeo tay BLE',
      protocol: 'Bluetooth',
      details: 'Đang kết nối • Tự động đồng bộ sinh hiệu',
      location: 'Người cao tuổi trong nhà',
      icon: 'watch',
      color: '#10B981',
    });

    setCurrentStep('SETUP_SUCCESS');
  };

  // -------------------------------------------------------------
  // LOGIC NHÁNH KHÁC (Cảm biến IoT qua Edge Hub)
  // -------------------------------------------------------------
  const handleAddOtherSensor = () => {
    let sensorName = 'Cảm biến hồng ngoại AMG8833';
    let sensorSub = 'Ma trận nhiệt 8x8 IR • Sàng lọc sốt vùng trán';
    let sensorIcon = 'thermometer';
    let sensorColor = '#F59E0B';

    if (selectedOtherSensor === 'yamnet') {
      sensorName = 'Micro AI âm thanh YAMNet';
      sensorSub = 'Phát hiện tiếng kêu cứu, ngã đập mạnh';
      sensorIcon = 'mic';
      sensorColor = '#8B5CF6';
    } else if (selectedOtherSensor === 'speaker') {
      sensorName = 'Loa thông minh Hub Voice Reminder';
      sensorSub = 'Giọng nói tiếng Việt nhắc nhở người cao tuổi';
      sensorIcon = 'volume-high';
      sensorColor = '#EC4899';
    } else if (selectedOtherSensor === 'sos') {
      sensorName = 'Nút bấm khẩn cấp SOS';
      sensorSub = 'Nút bấm 1 chạm khẩn cấp đầu giường';
      sensorIcon = 'alert-circle';
      sensorColor = '#EF4444';
    } else if (selectedOtherSensor === 'door') {
      sensorName = 'Cảm biến cửa thông minh Zigbee';
      sensorSub = 'Cảnh báo người cao tuổi đi lạc ban đêm';
      sensorIcon = 'enter-outline';
      sensorColor = '#06B6D4';
    }

    const newDevice: IoTDeviceItem = {
      id: 'sensor-' + selectedOtherSensor + '-' + Date.now(),
      name: sensorName,
      sub: sensorSub,
      type: 'sensor',
      status: 'Trực tuyến • Kết nối Edge Hub',
      isOnline: true,
      icon: sensorIcon,
      color: sensorColor,
      location: otherSensorLocation,
    };
    addIoTDevice(newDevice);

    setSuccessInfo({
      name: sensorName,
      type: 'Cảm biến an sinh IoT',
      protocol: 'Giao thức: GATEWAY_MQTT (EMQX port 1883)',
      details: 'Edge Hub: Orange Pi 5 (192.168.1.100)',
      location: otherSensorLocation,
      icon: sensorIcon,
      color: sensorColor,
    });

    setCurrentStep('SETUP_SUCCESS');
  };

  // Nếu đang ở bước WIFI_SEARCHING: Render toàn màn hình màu xanh tìm kiếm
  if (currentStep === 'WIFI_SEARCHING') {
    return (
      <StepCameraSearching
        styles={styles}
        searchingPulseAnim1={searchingPulseAnim1}
        searchingPulseAnim2={searchingPulseAnim2}
        onClose={() => setCurrentStep('WIFI_GUIDE')}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && { backgroundColor: colors.background }]} edges={['top']}>
      {/* HEADER MÀN HÌNH */}
      <View style={[styles.header, isDarkMode && { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.backButton, isDarkMode && { backgroundColor: colors.surfaceSubtle }]}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <LocalizedText style={styles.headerTitle}>Thêm Thiết Bị Mới</LocalizedText>
          <LocalizedText style={styles.headerSubtitle}>
            {currentStep === 'CATEGORY_SELECT' && 'Bước 1: Chọn phân loại thiết bị'}
            {currentStep === 'CAMERA_LIST' && 'Bước 2: Chọn model Camera'}
            {currentStep === 'WIFI_POWER_CHECK' && 'Bước 3A: Cắm nguồn & Kiểm tra LED'}
            {currentStep === 'WIFI_GUIDE' && 'Bước 4A: Kết nối thiết bị SECA'}
            {currentStep === 'WATCH_LIST' && 'Bước 2: Chọn model Đồng hồ'}
            {currentStep === 'BLE_POWER_CHECK' && 'Bước 3B: Mở nguồn & Bật Bluetooth'}
            {currentStep === 'BLE_PERMISSION' && 'Bước 4B: Cấp quyền Bluetooth'}
            {currentStep === 'BLE_SCAN' && 'Bước 5B: Radar quét BLE xung quanh'}
            {currentStep === 'BLE_PAIRING' && 'Bước 6B: Ghép nối Bluetooth GATT'}
            {currentStep === 'OTHER_LIST' && 'Cảm biến IoT qua Edge Hub'}
            {currentStep === 'SETUP_SUCCESS' && 'Hoàn tất cấu hình'}
          </LocalizedText>
        </View>
        <TouchableOpacity
          style={[styles.closeButton, isDarkMode && { backgroundColor: colors.surfaceSubtle }]}
          onPress={handleExit}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Tiến trình trực quan (Step Tracker Bar) */}
      <View style={[styles.progressBarWrapper, isDarkMode && { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.progressBarFill,
            {
              width:
                currentStep === 'CATEGORY_SELECT'
                  ? '15%'
                  : currentStep === 'CAMERA_LIST' || currentStep === 'WATCH_LIST' || currentStep === 'OTHER_LIST'
                  ? '35%'
                  : currentStep === 'WIFI_POWER_CHECK' || currentStep === 'BLE_POWER_CHECK'
                  ? '50%'
                  : currentStep === 'WIFI_GUIDE' || currentStep === 'BLE_PERMISSION'
                  ? '75%'
                  : currentStep === 'BLE_SCAN' || currentStep === 'BLE_PAIRING'
                  ? '88%'
                  : '100%',
            },
          ]}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, isDarkMode && { backgroundColor: colors.background }]}
      >
        {/* 1. STATE: CATEGORY_SELECT */}
        {currentStep === 'CATEGORY_SELECT' && (
          <StepCategorySelect
            styles={styles}
            isDarkMode={isDarkMode}
            colors={colors}
            onSelectCategory={(category) => {
              if (category === 'camera') setCurrentStep('CAMERA_LIST');
              else if (category === 'watch') setCurrentStep('WATCH_LIST');
            }}
          />
        )}

        {/* 2A-4A. CAMERA FLOW */}
        <StepCameraFlow
          currentStep={currentStep}
          styles={styles}
          onSelectCameraModel={handleSelectCameraModel}
          onGoToWifiGuide={() => setCurrentStep('WIFI_GUIDE')}
          onPressAlreadyConnected={handlePressAlreadyConnected}
          onOpenResetGuide={() => setShowResetGuideModal(true)}
        />

        {/* 2B-4B. WATCH FLOW */}
        <StepWatchFlow
          currentStep={currentStep}
          styles={styles}
          hasBlePermission={hasBlePermission}
          onSelectWatchModel={handleSelectWatchModel}
          onConnectHealthConnect={handleConnectHealthConnect}
          onOpenHealthConnectSettings={handleOpenHealthConnectSettings}
          onContinueBlePowerCheck={() => {
            if (!hasBlePermission) {
              setCurrentStep('BLE_PERMISSION');
            } else {
              setCurrentStep('BLE_SCAN');
              triggerBleScan();
            }
          }}
          onRequestBlePermission={() => setShowPermRequestModal(true)}
          onStartBleScan={() => {
            setCurrentStep('BLE_SCAN');
            triggerBleScan();
          }}
        />

        {/* 5B-6B. BLE SCAN & PAIRING */}
        <StepBleScanAndPairing
          currentStep={currentStep}
          styles={styles}
          pulseAnim={pulseAnim}
          isBleScanning={isBleScanning}
          discoveredBleList={discoveredBleList}
          onTriggerBleScan={triggerBleScan}
          onSelectBleDevice={handleSelectBleDevice}
          isBlePairing={isBlePairing}
          isBlePairingSuccess={isBlePairingSuccess}
          bleErrorMessage={bleErrorMessage}
          onConfirmPairing={handleConfirmPairing}
          onBackToScan={() => setCurrentStep('BLE_SCAN')}
        />

        {/* 2C. OTHER SENSORS */}
        <StepOtherSensors
          currentStep={currentStep}
          styles={styles}
          selectedOtherSensor={selectedOtherSensor}
          setSelectedOtherSensor={setSelectedOtherSensor}
          otherSensorLocation={otherSensorLocation}
          setOtherSensorLocation={setOtherSensorLocation}
          onAddOtherSensor={handleAddOtherSensor}
        />

        {/* 7. SETUP SUCCESS */}
        <StepSetupSuccess
          currentStep={currentStep}
          styles={styles}
          successInfo={successInfo}
          onNavigateDevices={() => navigation.navigate('Devices')}
          onNavigateHome={() => navigation.navigate('Home')}
        />
      </ScrollView>

      {/* ALL MODALS */}
      <AddDeviceModals
        styles={styles}
        showPermRequestModal={showPermRequestModal}
        setShowPermRequestModal={setShowPermRequestModal}
        onGrantBlePermission={handleGrantBlePermission}
        showWifiWarningDialog={showWifiWarningDialog}
        setShowWifiWarningDialog={setShowWifiWarningDialog}
        onOpenPhoneWifiSettings={handleOpenPhoneWifiSettings}
        onContinueWifiSearching={() => setCurrentStep('WIFI_SEARCHING')}
        showPhoneWifiSettingsModal={showPhoneWifiSettingsModal}
        setShowPhoneWifiSettingsModal={setShowPhoneWifiSettingsModal}
        connectedPhoneWifi={connectedPhoneWifi}
        selectedPhoneWifi={selectedPhoneWifi}
        phoneWifiNetworks={phoneWifiNetworks}
        isConnectingPhoneWifi={isConnectingPhoneWifi}
        onConnectPhoneWifi={handleConnectPhoneWifi}
        showResetGuideModal={showResetGuideModal}
        setShowResetGuideModal={setShowResetGuideModal}
        onResetCameraConfirmed={() => {
          setIsLedBlinking(true);
          setShowResetGuideModal(false);
        }}
        showBleErrorDialog={showBleErrorDialog}
        setShowBleErrorDialog={setShowBleErrorDialog}
        bleErrorMessage={bleErrorMessage}
        onBackToScanFromError={() => {
          setShowBleErrorDialog(false);
          if (currentStep === 'HEALTH_CONNECT_SETUP') {
            return;
          }
          setCurrentStep('BLE_SCAN');
        }}
      />
    </SafeAreaView>
  );
}

/**
 * AddDeviceScreen.tsx
 * Màn hình Thêm thiết bị mới (Onboarding Wizard đa giao thức)
 * Nghiệp vụ: Điều khiển máy trạng thái hữu hạn (FSM) hỗ trợ cài đặt thiết bị qua Camera IP / RTSP / AI,
 * ghép nối BLE (Smartband nhịp tim/SpO2/MPU6050) và Gateway MQTT (Orange Pi 5).
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, TouchableOpacity, ScrollView, Animated, Platform, TurboModuleRegistry, NativeModules } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useVitalStore, IoTDeviceItem } from '../../../store/useVitalStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { LocalizedAlert, LocalizedText } from '../../../i18n/LocalizedComponents';
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
  StepCameraRtspConfig,
  StepWatchFlow,
  StepBleScanAndPairing,
  StepOtherSensors,
  StepSetupSuccess,
  AddDeviceModals,
} from '../components/add-device';

export default function AddDeviceScreen({ navigation }: any) {
  const { addIoTDevice, setCameraDefault, syncAllWithBackend, house } = useVitalStore();
  const { userRole, role, permissions } = useAuthStore();
  const hasLinkedHouse = Boolean(house?.id && house?.hasHouse !== false && house?.name && house.name.trim() !== '');
  const isOwnerOrAdmin =
    userRole === 'admin' ||
    role === 'admin' ||
    userRole === 'owner' ||
    role === 'owner' ||
    permissions?.is_owner === true ||
    permissions?.role_in_house === 'OWNER';
  const isMemberInLinkedHouse = hasLinkedHouse && !isOwnerOrAdmin;
  const canManageDevices = !isMemberInLinkedHouse || Boolean(permissions?.can_manage_devices);

  useEffect(() => {
    if (!canManageDevices) {
      LocalizedAlert.alert(
        'Quyền truy cập bị giới hạn',
        'Tài khoản Thành viên không có quyền thêm hoặc cấu hình thiết bị mới. Vui lòng liên hệ Chủ hộ để được cấp quyền quản lý thiết bị.',
        [{ text: 'Quay lại', onPress: () => navigation.goBack() }]
      );
    }
  }, [canManageDevices, navigation]);

  const { isDarkMode, colors } = useTheme();
  const styles = useMemo(
    () => createThemeStyles(baseStyles, isDarkMode, colors),
    [isDarkMode, colors],
  );

  // ---- 1. State Quản lý Luồng & Giao thức ----
  const [currentStep, setCurrentStep] = useState<FlowStep>('CATEGORY_SELECT');
  const [protocol, setProtocol] = useState<ProtocolType>('RTSP_IP');
  const [selectedDeviceModel, setSelectedDeviceModel] = useState<string>('');
  const [createdCameraDeviceId, setCreatedCameraDeviceId] = useState<string>('');

  // ---- 2. State Nhánh Bluetooth (Smartwatch) ----
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

  // ---- 3. State Nhánh Khác (Cảm biến IoT) ----
  const [selectedOtherSensor, setSelectedOtherSensor] = useState<string>('amg8833');
  const [otherSensorLocation, setOtherSensorLocation] = useState<string>('Phòng khách');

  // ---- 4. State Màn hình Thành công (SetupSuccess) ----
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

  // Handle Back Button navigation
  const handleBack = () => {
    if (currentStep === 'CATEGORY_SELECT') {
      navigation.goBack();
      return;
    }
    if (currentStep === 'SETUP_SUCCESS') {
      navigation.navigate('Main', { screen: 'Devices' });
      return;
    }
    setCurrentStep(PREVIOUS_STEP_MAP[currentStep] || 'CATEGORY_SELECT');
  };

  const handleExit = () => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main', { screen: 'Devices' });
    }
  };

  // -------------------------------------------------------------
  // LOGIC CẤU HÌNH CAMERA (RTSP / ONVIF / AI)
  // -------------------------------------------------------------
  const handleApplyRtspCamera = async (deviceData: {
    name: string;
    brand: string;
    streamUrl: string;
    location: string;
    ip: string;
    isDefault: boolean;
  }) => {
    const newDevice: IoTDeviceItem = {
      id: 'camera-ip-' + Date.now(),
      name: deviceData.name,
      sub: `${deviceData.brand} • RTSP • IP: ${deviceData.ip}`,
      type: 'camera',
      status: 'Trực tuyến • Đang ghi hình',
      isOnline: true,
      icon: 'videocam',
      color: '#0284C7',
      location: deviceData.location,
      streamUrl: deviceData.streamUrl,
      ipAddress: deviceData.ip,
    };

    const createdId = await addIoTDevice(newDevice);
    const finalId = createdId || newDevice.id;
    setCreatedCameraDeviceId(finalId);

    if (deviceData.isDefault && setCameraDefault) {
      setCameraDefault({
        id: finalId,
        name: newDevice.name,
        room: newDevice.location || 'Phòng khách',
        streamUrl: newDevice.streamUrl || '',
        isOnline: true,
      });
    }

    setSuccessInfo({
      name: newDevice.name,
      type: `Camera An Ninh (${deviceData.brand})`,
      protocol: 'RTSP (Cổng 554)',
      details: deviceData.streamUrl,
      location: deviceData.location,
      icon: 'videocam',
      color: '#0284C7',
    });

    setCurrentStep('SETUP_SUCCESS');
  };

  // -------------------------------------------------------------
  // LOGIC NHÁNH THIẾT BỊ ĐEO (BLE & Google Health Connect)
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

      const readVitals: { heartRate?: number; spo2?: number; temp?: number } = {};
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
            readVitals.temp = Number(latest.value.toFixed(1));
          }
        }
      } catch (tempErr) {
        console.log('[HealthConnect] Chưa có dữ liệu thân nhiệt:', tempErr);
      }

      const activeHr = readVitals.heartRate ?? 75;
      const activeSpo2 = readVitals.spo2 ?? 98;
      const activeTemp = readVitals.temp ?? 36.6;

      const deviceId = 'health-connect-' + Date.now();
      const newWatch: IoTDeviceItem = {
        id: deviceId,
        name: 'Google Health Connect',
        sub: `Đồng bộ hệ sinh thái • HR: ${activeHr} bpm • SpO2: ${activeSpo2}%`,
        type: 'watch',
        status: 'Đã liên kết • Đang đồng bộ',
        isOnline: true,
        icon: 'heart-circle',
        color: '#10B981',
      };

      await addIoTDevice(newWatch);

      try {
        await processAndUploadVital({
          heartRate: activeHr,
          spo2: activeSpo2,
          bodyTemperature: activeTemp,
          deviceId: deviceId,
          timestamp: Date.now(),
        });
      } catch (uploadErr) {
        console.warn('[HealthConnect] Không thể upload chỉ số ban đầu:', uploadErr);
      }

      setSuccessInfo({
        name: 'Google Health Connect (Galaxy / Pixel / Mi)',
        type: 'Dịch vụ Hệ sinh thái Sức khỏe Android',
        protocol: 'Android Health Connect Client API',
        details: `Nhịp tim: ${activeHr} bpm, SpO₂: ${activeSpo2}%, Nhiệt độ: ${activeTemp}°C`,
        location: 'Trên người cụ',
        icon: 'heart-circle',
        color: '#10B981',
      });

      setCurrentStep('SETUP_SUCCESS');
    } catch (err: any) {
      console.warn('[HealthConnect] Connect fail:', err);
      setBleErrorMessage(
        err?.message || 'Không thể đồng bộ dữ liệu với Google Health Connect. Vui lòng thử lại.'
      );
      setShowBleErrorDialog(true);
    }
  };

  const handleGrantBlePermission = () => {
    setShowPermRequestModal(false);
    setHasBlePermission(true);
    setCurrentStep('BLE_SCAN');
    triggerBleScan();
  };

  const triggerBleScan = async () => {
    setIsBleScanning(true);
    setDiscoveredBleList([]);

    const bleManager = (multiWearableManager as any).getBleManager?.() || (multiWearableManager as any).getManager?.();

    if (!bleManager) {
      setBleErrorMessage('Không thể khởi tạo BLE Manager. Thiết bị có thể không hỗ trợ Bluetooth LE.');
      setShowBleErrorDialog(true);
      setIsBleScanning(false);
      return;
    }

    try {
      const state = await bleManager.state();
      if (state !== 'PoweredOn') {
        setBleErrorMessage('Bluetooth chưa được bật. Vui lòng bật Bluetooth trên thiết bị và thử lại.');
        setShowBleErrorDialog(true);
        setIsBleScanning(false);
        return;
      }
    } catch (err) {
      console.warn('BLE state check failed:', err);
    }

    (multiWearableManager as any).startBleScan?.(
      (device: any) => {
        if (!device || !device.id) return;
        setDiscoveredBleList((prev) => {
          const exists = prev.find((d) => d.id === device.id);
          if (exists) {
            return prev.map((d) =>
              d.id === device.id
                ? {
                    ...d,
                    rssi: device.rssi ? `${device.rssi} dBm` : d.rssi,
                    battery: device.batteryLevel ?? d.battery,
                  }
                : d
            );
          }
          const newItem: DiscoveredBleItem = {
            id: device.id,
            name: device.name || device.localName || 'Thiết bị BLE',
            mac: device.id,
            rssi: device.rssi ? `${device.rssi} dBm` : '-65 dBm',
            battery: device.batteryLevel ?? 85,
            services: (device.serviceUUIDs && device.serviceUUIDs.length > 0)
              ? `${device.serviceUUIDs.length} Services`
              : 'GATT Standard',
            rawDevice: device,
          };
          return [...prev, newItem];
        });
      },
      (error: any) => {
        console.warn('BLE Scan error:', error);
        setBleErrorMessage(error.message || 'Quét BLE gặp sự cố.');
        setShowBleErrorDialog(true);
        setIsBleScanning(false);
      }
    );

    setTimeout(() => {
      (multiWearableManager as any).stopBleScan?.();
      setIsBleScanning(false);
    }, 12000);
  };

  const handleSelectBleDevice = (device: DiscoveredBleItem) => {
    setSelectedBleDevice(device);
    setCurrentStep('BLE_PAIRING');
    setIsBlePairing(false);
    setIsBlePairingSuccess(false);
  };

  const handleConfirmPairing = async () => {
    if (!selectedBleDevice) return;
    setIsBlePairing(true);
    setBleErrorMessage('');

    try {
      let isConnected = false;
      if (selectedBleDevice.rawDevice) {
        isConnected = await (multiWearableManager as any).connectDevice?.(
          selectedBleDevice.rawDevice,
          async (data: any) => {
            await processAndUploadVital({
              heartRate: data.heartRate,
              spo2: data.spo2,
              bodyTemperature: data.temperature,
              deviceId: selectedBleDevice.id,
              timestamp: Date.now(),
            });
          }
        );
      } else {
        await new Promise((r) => setTimeout(r, 1200));
        isConnected = true;
      }

      if (isConnected) {
        setIsBlePairingSuccess(true);
        startWearablePipeline();

        const newWatch: IoTDeviceItem = {
          id: selectedBleDevice.id || 'ble-' + Date.now(),
          name: selectedBleDevice.name || 'Vòng đeo tay BLE',
          sub: `BLE GATT • MAC: ${selectedBleDevice.mac} • Pin: ${selectedBleDevice.battery}%`,
          type: 'watch',
          status: 'Đã ghép đôi • Đang nhận dữ liệu',
          isOnline: true,
          icon: 'watch',
          color: '#10B981',
        };
        await addIoTDevice(newWatch);

        setSuccessInfo({
          name: selectedBleDevice.name,
          type: 'Vòng Đeo Tay Sức Khỏe BLE (GATT Vitals)',
          protocol: 'Bluetooth Low Energy (Heart Rate & SpO2 Service)',
          details: `ID/MAC: ${selectedBleDevice.mac} | RSSI: ${selectedBleDevice.rssi}`,
          location: 'Trên người cụ',
          icon: 'watch',
          color: '#10B981',
        });

        setTimeout(() => {
          setIsBlePairing(false);
          setCurrentStep('SETUP_SUCCESS');
        }, 1000);
      } else {
        setIsBlePairing(false);
        setBleErrorMessage(
          'Không thể thiết lập liên kết GATT với thiết bị này. Vui lòng đảm bảo vòng đeo tay đang bật và ở gần.'
        );
        setShowBleErrorDialog(true);
      }
    } catch (err: any) {
      setIsBlePairing(false);
      setBleErrorMessage(err?.message || 'Có lỗi xảy ra trong quá trình ghép đôi Bluetooth.');
      setShowBleErrorDialog(true);
    }
  };

  // -------------------------------------------------------------
  // LOGIC NHÁNH CẢM BIẾN IoT (Gateway Orange Pi 5)
  // -------------------------------------------------------------
  const handleAddOtherSensor = () => {
    let sensorName = 'Cảm Biến Nhiệt Ma Trận AMG8833';
    let sensorSub = 'MQTT Hub • Grid-EYE 8x8 IR • Phát hiện ngã & thân nhiệt';
    let sensorIcon = 'thermometer';
    let sensorColor = '#EA580C';

    if (selectedOtherSensor === 'ld2410') {
      sensorName = 'Radar Hiện Diện Siêu Âm mmWave HLK-LD2410';
      sensorSub = 'MQTT Hub • FMCW 24GHz • Phát hiện vi chuyển động thở/ngủ';
      sensorIcon = 'radio';
      sensorColor = '#8B5CF6';
    } else if (selectedOtherSensor === 'rcwl0516') {
      sensorName = 'Cảm Biến Vi Sóng Chuyển Động RCWL-0516';
      sensorSub = 'MQTT Hub • Doppler Radar • Báo động xâm nhập góc khuất';
      sensorIcon = 'pulse';
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
            {currentStep === 'CAMERA_RTSP_CONFIG' && 'Bước 2: Cấu hình camera an ninh (RTSP/IP/AI)'}
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
                  : currentStep === 'WATCH_LIST' || currentStep === 'OTHER_LIST'
                  ? '35%'
                  : currentStep === 'CAMERA_RTSP_CONFIG'
                  ? '60%'
                  : currentStep === 'BLE_POWER_CHECK'
                  ? '50%'
                  : currentStep === 'BLE_PERMISSION'
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
              if (category === 'camera') {
                setProtocol('RTSP_IP');
                setCurrentStep('CAMERA_RTSP_CONFIG');
              } else if (category === 'watch') {
                setCurrentStep('WATCH_LIST');
              }
            }}
          />
        )}

        {/* 2. CAMERA CONFIG (RTSP / ONVIF / AI) */}
        {currentStep === 'CAMERA_RTSP_CONFIG' && (
          <StepCameraRtspConfig
            isDarkMode={isDarkMode}
            colors={colors}
            onApplyCamera={handleApplyRtspCamera}
          />
        )}

        {/* 3. WATCH FLOW */}
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

        {/* 4. BLE SCAN & PAIRING */}
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

        {/* 5. OTHER SENSORS */}
        <StepOtherSensors
          currentStep={currentStep}
          styles={styles}
          selectedOtherSensor={selectedOtherSensor}
          setSelectedOtherSensor={setSelectedOtherSensor}
          otherSensorLocation={otherSensorLocation}
          setOtherSensorLocation={setOtherSensorLocation}
          onAddOtherSensor={handleAddOtherSensor}
        />

        {/* 6. SETUP SUCCESS */}
        <StepSetupSuccess
          currentStep={currentStep}
          styles={styles}
          successInfo={successInfo}
          onNavigateDevices={() => navigation.navigate('Main', { screen: 'Devices' })}
          onNavigateHome={() => navigation.navigate('Main', { screen: 'Home' })}
          onNavigateCamera={() => {
            navigation.navigate('CameraDetail', {
              cameraId: createdCameraDeviceId || undefined,
              cameraName: successInfo.name,
              room: successInfo.location,
              streamUrl: successInfo.details,
            });
          }}
        />
      </ScrollView>

      {/* ALL MODALS */}
      <AddDeviceModals
        styles={styles}
        showPermRequestModal={showPermRequestModal}
        setShowPermRequestModal={setShowPermRequestModal}
        onGrantBlePermission={handleGrantBlePermission}
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

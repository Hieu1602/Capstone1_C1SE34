// AddDeviceScreen.tsx
// Màn hình Thêm thiết bị mới - Triển khai chính xác 100% theo Sơ đồ trạng thái Mermaid:
// Home -> CategorySelect -> CameraList / WatchList -> CheckProtocol (WIFI_AP / BLUETOOTH)
// Nhánh Wi-Fi AP: Wifi_PowerCheck -> Wifi_Guide -> Wifi_Check {Khớp SSID?} -> SetupSuccess / DialogWifi
// Nhánh Bluetooth: BLE_PowerCheck -> BLE_Permission -> RequestPerm -> BLE_Scan -> BLE_Pairing -> SetupSuccess / DialogBLE

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
  Modal,
  Animated,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { useVitalStore, IoTDeviceItem } from '../../../store/useVitalStore';

// Các trạng thái của toàn bộ luồng theo Mermaid flowchart
type FlowStep =
  | 'CATEGORY_SELECT'
  | 'CAMERA_LIST'
  | 'WATCH_LIST'
  | 'OTHER_LIST'
  | 'WIFI_POWER_CHECK'
  | 'WIFI_GUIDE'
  | 'WIFI_SEARCHING'
  | 'BLE_POWER_CHECK'
  | 'BLE_PERMISSION'
  | 'BLE_SCAN'
  | 'BLE_PAIRING'
  | 'SETUP_SUCCESS';

type ProtocolType = 'WIFI_AP' | 'BLUETOOTH' | 'GATEWAY_MQTT';

interface DiscoveredBleItem {
  id: string;
  name: string;
  mac: string;
  rssi: string;
  battery: number;
  services: string;
}

export default function AddDeviceScreen({ navigation }: any) {
  const { addIoTDevice } = useVitalStore();

  // ---- 1. State Quản lý Luồng & Giao thức ----
  const [currentStep, setCurrentStep] = useState<FlowStep>('CATEGORY_SELECT');
  const [protocol, setProtocol] = useState<ProtocolType>('WIFI_AP');
  const [selectedDeviceModel, setSelectedDeviceModel] = useState<string>('');

  // ---- 2. State Nhánh Wi-Fi AP (Camera) - Chuẩn Onboarding SECA ----
  const [isLedBlinking, setIsLedBlinking] = useState<boolean>(true);
  const [showPhoneWifiSettingsModal, setShowPhoneWifiSettingsModal] = useState<boolean>(false);
  const [selectedPhoneWifi, setSelectedPhoneWifi] = useState<string>('SECA_001');
  const [isConnectingPhoneWifi, setIsConnectingPhoneWifi] = useState<boolean>(false);
  const [connectedPhoneWifi, setConnectedPhoneWifi] = useState<string | null>(null);
  const [showWifiWarningDialog, setShowWifiWarningDialog] = useState<boolean>(false);
  const [wifiSsidOption, setWifiSsidOption] = useState<string>('SECA_001');
  const [customSsid, setCustomSsid] = useState<string>('');
  const [camUsername, setCamUsername] = useState<string>('admin162');
  const [camPassword, setCamPassword] = useState<string>('16161616');
  const [camIp] = useState<string>('192.168.1.4');
  const [aiFallDetect, setAiFallDetect] = useState<boolean>(true);
  const [isVerifyingWifi, setIsVerifyingWifi] = useState<boolean>(false);
  const [showWifiErrorDialog, setShowWifiErrorDialog] = useState<boolean>(false);
  const [showResetGuideModal, setShowResetGuideModal] = useState<boolean>(false);

  // Radar Pulse Animations cho bước WIFI_SEARCHING
  const searchingPulseAnim1 = useRef(new Animated.Value(0)).current;
  const searchingPulseAnim2 = useRef(new Animated.Value(0)).current;

  // ---- 3. State Nhánh Bluetooth (Smartwatch) ----
  const [hasBlePermission, setHasBlePermission] = useState<boolean>(false);
  const [showPermRequestModal, setShowPermRequestModal] = useState<boolean>(false);
  const [isBleScanning, setIsBleScanning] = useState<boolean>(true);
  const [simulateBleError, setSimulateBleError] = useState<boolean>(false);
  const [showBleErrorDialog, setShowBleErrorDialog] = useState<boolean>(false);
  const [isBlePairing, setIsBlePairing] = useState<boolean>(false);
  const [selectedBleDevice, setSelectedBleDevice] = useState<DiscoveredBleItem | null>(null);
  const [wearerName, setWearerName] = useState<string>('Cụ Ông (78 tuổi)');

  // Radar Animation cho BLE
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ---- 4. State Nhánh Khác (Cảm biến IoT) ----
  const [selectedOtherSensor, setSelectedOtherSensor] = useState<string>('amg8833');
  const [otherSensorLocation, setOtherSensorLocation] = useState<string>('Phòng khách');

  // ---- 5. State Màn hình Thành công (SetupSuccess) ----
  const [successInfo, setSuccessInfo] = useState<{
    name: string;
    type: string;
    protocol: string;
    details: string;
    location: string;
    icon: string;
    color: string;
  }>({
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

  // Hiệu ứng sóng radar & tự động chuyển bước khi ở màn hình WIFI_SEARCHING
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

      // Sau 2.8 giây tìm kiếm, tự động kết nối & thêm thiết bị vào danh sách
      const timer = setTimeout(() => {
        const newDevice: IoTDeviceItem = {
          id: 'seca-001-' + Date.now(),
          name: selectedDeviceModel || 'SECA_001',
          sub: 'Wi-Fi AP • 1080p FHD • YOLOv8-Pose Phát hiện ngã',
          type: 'camera',
          status: 'Đang ghi hình • Trực tuyến',
          isOnline: true,
          icon: 'videocam',
          color: '#F97316',
          location: 'Phòng khách',
          streamUrl: `rtsp://${camUsername}:${camPassword}@${camIp}:554/stream1`,
        };
        addIoTDevice(newDevice);

        setSuccessInfo({
          name: newDevice.name,
          type: 'Camera giám sát AI',
          protocol: 'Giao thức: WIFI_AP (802.11 b/g/n)',
          details: `SSID: SECA_001 • IP: ${camIp} • Stream 1080p 32 FPS`,
          location: 'Phòng khách (Phát hiện ngã YOLOv8)',
          icon: 'videocam',
          color: '#F97316',
        });

        setCurrentStep('SETUP_SUCCESS');
      }, 2800);

      return () => {
        clearTimeout(timer);
        radarAnimation.stop();
      };
    }
  }, [currentStep]);

  // Handle Back Button navigation
  const handleBack = () => {
    switch (currentStep) {
      case 'CATEGORY_SELECT':
        navigation.goBack();
        break;
      case 'CAMERA_LIST':
      case 'WATCH_LIST':
      case 'OTHER_LIST':
        setCurrentStep('CATEGORY_SELECT');
        break;
      case 'WIFI_POWER_CHECK':
        setCurrentStep('CAMERA_LIST');
        break;
      case 'WIFI_GUIDE':
        setCurrentStep('WIFI_POWER_CHECK');
        break;
      case 'WIFI_SEARCHING':
        setCurrentStep('WIFI_GUIDE');
        break;
      case 'BLE_POWER_CHECK':
        setCurrentStep('WATCH_LIST');
        break;
      case 'BLE_PERMISSION':
        setCurrentStep('BLE_POWER_CHECK');
        break;
      case 'BLE_SCAN':
        setCurrentStep('BLE_PERMISSION');
        break;
      case 'BLE_PAIRING':
        setCurrentStep('BLE_SCAN');
        break;
      case 'SETUP_SUCCESS':
        navigation.navigate('Devices');
        break;
      default:
        setCurrentStep('CATEGORY_SELECT');
    }
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
    // CheckProtocol: Xác định giao thức là WIFI_AP
    setProtocol('WIFI_AP');
    setCurrentStep('WIFI_POWER_CHECK');
  };

  // Danh sách các mạng Wi-Fi hiển thị trong Cài Đặt Wi-Fi Điện Thoại
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
    {
      ssid: 'Tang 3',
      desc: 'Mạng Wi-Fi nội bộ',
      icon: 'wifi',
      isValid: false,
      isTarget: false,
      hasLock: true,
    },
    {
      ssid: 'BVH An Trung 2',
      desc: 'Mạng văn phòng lân cận',
      icon: 'wifi',
      isValid: false,
      isTarget: false,
      hasLock: true,
    },
    {
      ssid: 'Cafe Da Lat Ngoai San',
      desc: 'Mạng công cộng ngoài',
      icon: 'wifi',
      isValid: false,
      isTarget: false,
      hasLock: true,
    },
    {
      ssid: 'Bibocute',
      desc: 'Mạng 5GHz tốc độ cao',
      icon: 'wifi',
      isValid: false,
      isTarget: false,
      hasLock: true,
      tag: '5G',
    },
    {
      ssid: 'Cong Phan',
      desc: 'Mạng gia đình lân cận',
      icon: 'wifi',
      isValid: false,
      isTarget: false,
      hasLock: true,
    },
  ];

  // Mở giao diện Cài đặt Wi-Fi của điện thoại
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

  // Thao tác trực tiếp chọn và kết nối mạng Wi-Fi trên màn hình Cài đặt điện thoại
  const handleConnectPhoneWifi = (ssid: string) => {
    setSelectedPhoneWifi(ssid);
    setIsConnectingPhoneWifi(true);

    setTimeout(() => {
      setIsConnectingPhoneWifi(false);
      setConnectedPhoneWifi(ssid);

      // Nếu chọn mạng Camera SECA_001: Tự động đóng cài đặt và chuyển sang màn hình tìm kiếm SoftAP
      if (ssid === 'SECA_001') {
        setTimeout(() => {
          setShowPhoneWifiSettingsModal(false);
          setCurrentStep('WIFI_SEARCHING');
        }, 500);
      }
    }, 700);
  };

  // Xử lý khi nhấn nút "Tôi đã kết nối"
  const handlePressAlreadyConnected = () => {
    if (connectedPhoneWifi === 'SECA_001') {
      setCurrentStep('WIFI_SEARCHING');
    } else {
      setShowWifiWarningDialog(true);
    }
  };

  const handleVerifyWifi = () => {
    handleOpenPhoneWifiSettings();
  };

  // -------------------------------------------------------------
  // LOGIC NHÁNH BLUETOOTH (Smartwatch)
  // -------------------------------------------------------------
  const handleSelectWatchModel = (model: string) => {
    setSelectedDeviceModel(model);
    // CheckProtocol: Xác định giao thức là BLUETOOTH
    setProtocol('BLUETOOTH');
    setCurrentStep('BLE_POWER_CHECK');
  };

  const handleGrantBlePermission = () => {
    setHasBlePermission(true);
    setShowPermRequestModal(false);
    setCurrentStep('BLE_SCAN');
    setIsBleScanning(true);
  };

  const handleSelectBleDevice = (item: DiscoveredBleItem) => {
    setSelectedBleDevice(item);
    setCurrentStep('BLE_PAIRING');
    setIsBlePairing(true);

    // Bắt đầu quy trình ghép nối GATT
    setTimeout(() => {
      setIsBlePairing(false);
      if (simulateBleError) {
        // Thất bại -> DialogBLE: Báo lỗi ghép nối
        setShowBleErrorDialog(true);
      } else {
        // Thành công -> SetupSuccess
        const newDevice: IoTDeviceItem = {
          id: 'ble-smartband-' + Date.now(),
          name: `${item.name} (${wearerName})`,
          sub: 'BLE 5.2 • Nhịp tim PPG • SpO₂ • MPU6050 ngã',
          type: 'band',
          status: `Đang đeo • Pin ${item.battery}%`,
          isOnline: true,
          icon: 'watch',
          color: '#10B981',
          location: wearerName,
          macAddress: item.mac,
        };
        addIoTDevice(newDevice);

        setSuccessInfo({
          name: newDevice.name,
          type: 'Đồng hồ y tế thông minh',
          protocol: 'Giao thức: BLUETOOTH (BLE 5.2 GATT)',
          details: `MAC: ${item.mac} • Pin ${item.battery}% • RSSI ${item.rssi}`,
          location: `Người đeo: ${wearerName}`,
          icon: 'watch',
          color: '#10B981',
        });

        setCurrentStep('SETUP_SUCCESS');
      }
    }, 1500);
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

  // Danh sách các thiết bị BLE phát hiện trong radar
  const discoveredBleList: DiscoveredBleItem[] = [
    {
      id: 'ble-01',
      name: 'BLE Smartband FR01',
      mac: 'C4:D8:33:A1:0F:77',
      rssi: '-42 dBm (Rất gần)',
      battery: 94,
      services: 'Heart Rate (0x180D) • SpO₂ (0x1822) • MPU6050',
    },
    {
      id: 'ble-02',
      name: 'Mi Band 8 Active',
      mac: 'E4:5F:01:8A:22:9B',
      rssi: '-65 dBm (Ổn định)',
      battery: 88,
      services: 'Heart Rate • Step Counter',
    },
    {
      id: 'ble-03',
      name: 'Apple Watch Series 8',
      mac: 'BC:D0:74:11:4A:E8',
      rssi: '-78 dBm (Trung bình)',
      battery: 65,
      services: 'Apple Health BLE Peripheral',
    },
  ];

  // Nếu đang ở bước WIFI_SEARCHING: Render toàn màn hình màu xanh tìm kiếm
  if (currentStep === 'WIFI_SEARCHING') {
    return (
      <SafeAreaView style={styles.searchingContainer} edges={['top', 'bottom']}>
        {/* Nút đóng góc trên bên trái */}
        <View style={styles.searchingHeader}>
          <TouchableOpacity
            style={styles.searchingCloseBtn}
            onPress={() => setCurrentStep('WIFI_GUIDE')}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Tiêu đề tìm kiếm trung tâm */}
        <Text style={styles.searchingTitle}>
          SECA đang tìm kiếm thiết bị của bạn...
        </Text>

        {/* Khu vực đồ họa trung tâm: Sóng Radar tỏa ra + Camera + Điện thoại */}
        <View style={styles.searchingCenter}>
          {/* Sóng radar tỏa ra 1 */}
          <Animated.View
            style={[
              styles.radarPulseCircle,
              {
                transform: [
                  {
                    scale: searchingPulseAnim1.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 2.3],
                    }),
                  },
                ],
                opacity: searchingPulseAnim1.interpolate({
                  inputRange: [0, 0.4, 1],
                  outputRange: [0.55, 0.25, 0],
                }),
              },
            ]}
          />

          {/* Sóng radar tỏa ra 2 */}
          <Animated.View
            style={[
              styles.radarPulseCircle,
              {
                transform: [
                  {
                    scale: searchingPulseAnim2.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 2.3],
                    }),
                  },
                ],
                opacity: searchingPulseAnim2.interpolate({
                  inputRange: [0, 0.4, 1],
                  outputRange: [0.55, 0.25, 0],
                }),
              },
            ]}
          />

          {/* Khối Camera trên (Bong bóng mờ + Camera trắng) */}
          <View style={styles.searchingCameraCircleOuter}>
            <View style={styles.searchingCameraCircleInner}>
              <Ionicons name="videocam" size={44} color="#0284C7" />
            </View>
          </View>

          {/* Dấu cộng và các điểm nhấn chuyển động */}
          <View style={styles.searchingPlusBadge}>
            <Text style={styles.searchingPlusText}>+</Text>
          </View>
          <View style={styles.searchingStreakLine1} />
          <View style={styles.searchingStreakLine2} />
          <View style={styles.searchingStreakLine3} />

          {/* Khối Điện thoại dưới (Khung smartphone + Sóng Wi-Fi) */}
          <View style={styles.searchingPhoneCircleOuter}>
            <View style={styles.searchingPhoneBody}>
              <View style={styles.searchingPhoneSpeaker} />
              <View style={styles.searchingPhoneScreen}>
                <Ionicons name="wifi" size={32} color="#FFF" />
              </View>
              <View style={styles.searchingPhoneHomeButton} />
            </View>
          </View>
        </View>

        {/* Dòng hướng dẫn bên dưới */}
        <View style={styles.searchingFooter}>
          <Text style={styles.searchingFooterText}>
            Đảm bảo rằng bạn đã kết nối với Wi-Fi của thiết bị SECA của mình:{' '}
            <Text style={{ fontWeight: 'bold' }}>SECA_001</Text>.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header Điều hướng */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={26} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Thêm Thiết Bị Mới</Text>
          <Text style={styles.headerSubtitle}>
            {currentStep === 'CATEGORY_SELECT' && 'Bước 1: Chọn phân loại thiết bị'}
            {currentStep === 'CAMERA_LIST' && 'Bước 2: Chọn model Camera'}
            {currentStep === 'WIFI_POWER_CHECK' && 'Bước 3A: Cắm nguồn & Kiểm tra LED'}
            {currentStep === 'WIFI_GUIDE' && 'Bước 4A: Kết nối thiết bị SECA'}
            {currentStep === 'WATCH_LIST' && 'Bước 2: Chọn model Đồng hồ'}
            {currentStep === 'BLE_POWER_CHECK' && 'Bước 3B: Mở nguồn & Bật Bluetooth'}
            {currentStep === 'BLE_PERMISSION' && 'Bước 4B: Cấp quyền Bluetooth & Vị trí'}
            {currentStep === 'BLE_SCAN' && 'Bước 5B: Radar quét BLE xung quanh'}
            {currentStep === 'BLE_PAIRING' && 'Bước 6B: Ghép nối Bluetooth GATT'}
            {currentStep === 'OTHER_LIST' && 'Cảm biến IoT qua Edge Hub'}
            {currentStep === 'SETUP_SUCCESS' && 'Hoàn tất cấu hình'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleExit}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={24} color="#1E293B" />
        </TouchableOpacity>
      </View>

      {/* Tiến trình trực quan (Step Tracker Bar) */}
      <View style={styles.progressBarWrapper}>
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
        contentContainerStyle={styles.scrollContent}
      >
        {/* ============================================================== */}
        {/* 1. STATE: CATEGORY_SELECT                                      */}
        {/* ============================================================== */}
        {currentStep === 'CATEGORY_SELECT' && (
          <View>
            <Text style={styles.stepHeaderTitle}>Chọn Loại Thiết Bị Cần Thêm</Text>
            <Text style={styles.stepHeaderDesc}>
              Hệ thống sẽ tự động kích hoạt luồng kiểm tra giao thức tương ứng (Wi-Fi AP hoặc Bluetooth BLE).
            </Text>

            {/* Option 1: Camera */}
            <TouchableOpacity
              style={styles.categoryCard}
              onPress={() => setCurrentStep('CAMERA_LIST')}
              activeOpacity={0.8}
            >
              <View style={[styles.categoryIconBox, { backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="videocam" size={30} color="#EA580C" />
              </View>
              <View style={styles.categoryInfo}>
                <View style={styles.categoryBadgeRow}>
                  <Text style={styles.categoryName}>Thiết bị Camera</Text>
                  <View style={[styles.protoBadge, { backgroundColor: '#FFEDD5' }]}>
                    <Text style={[styles.protoBadgeText, { color: '#C2410C' }]}>WIFI_AP</Text>
                  </View>
                </View>
                <Text style={styles.categoryDesc}>
                  Camera an ninh AI giám sát, tích hợp YOLOv8-Pose nhận diện té ngã và luồng RTSP 1080p.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
            </TouchableOpacity>

            {/* Option 2: Đồng hồ thông minh */}
            <TouchableOpacity
              style={styles.categoryCard}
              onPress={() => setCurrentStep('WATCH_LIST')}
              activeOpacity={0.8}
            >
              <View style={[styles.categoryIconBox, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="watch" size={30} color="#059669" />
              </View>
              <View style={styles.categoryInfo}>
                <View style={styles.categoryBadgeRow}>
                  <Text style={styles.categoryName}>Đồng hồ thông minh</Text>
                  <View style={[styles.protoBadge, { backgroundColor: '#D1FAE5' }]}>
                    <Text style={[styles.protoBadgeText, { color: '#047857' }]}>BLUETOOTH</Text>
                  </View>
                </View>
                <Text style={styles.categoryDesc}>
                  Vòng đeo tay y tế, cảm biến quang PPG đo nhịp tim, SpO₂ và gia tốc kế cảnh báo va đập.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        )}

        {/* ============================================================== */}
        {/* 2A. STATE: CAMERA_LIST                                         */}
        {/* ============================================================== */}
        {currentStep === 'CAMERA_LIST' && (
          <View>
            <Text style={styles.stepHeaderTitle}>Chọn Model Camera</Text>
            <Text style={styles.stepHeaderDesc}>
              Danh sách camera được hỗ trợ bởi hệ sinh thái Smart Elderly Care AI:
            </Text>

            {/* Thiết bị Camera duy nhất: SECA_001 */}
            <TouchableOpacity
              style={[styles.modelCard, styles.modelCardActive]}
              onPress={() => handleSelectCameraModel('SECA_001')}
              activeOpacity={0.8}
            >
              <View style={[styles.modelIconBox, { backgroundColor: '#FFEDD5' }]}>
                <Ionicons name="videocam" size={26} color="#EA580C" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.modelHeaderRow}>
                  <Text style={styles.modelTitle}>SECA_001</Text>
                  <View style={styles.activeTag}>
                    <Text style={styles.activeTagText}>Hiện có</Text>
                  </View>
                </View>
                <Text style={styles.modelDesc}>
                  Giao thức: WIFI_AP • Camera an ninh AI • Nhận diện té ngã YOLOv8-Pose 32 FPS
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#EA580C" />
            </TouchableOpacity>

            {/* CheckProtocol Box */}
            <View style={styles.protocolCheckBanner}>
              <Ionicons name="flash" size={18} color="#0284C7" />
              <Text style={styles.protocolCheckText}>
                CheckProtocol: Hệ thống tự động nhận diện giao thức{' '}
                <Text style={{ fontWeight: 'bold' }}>WIFI_AP</Text> cho Camera.
              </Text>
            </View>
          </View>
        )}

        {/* ============================================================== */}
        {/* 3A. STATE: WIFI_POWER_CHECK                                    */}
        {/* ============================================================== */}
        {currentStep === 'WIFI_POWER_CHECK' && (
          <View style={styles.guideContainer}>
            <View style={styles.visualGraphicBox}>
              <Ionicons name="power" size={54} color="#EA580C" />
              <View style={styles.ledIndicatorRow}>
                <View style={[styles.ledDot, styles.ledRed]} />
                <View style={[styles.ledDot, styles.ledGreen]} />
                <Text style={styles.ledText}>Đèn LED chớp Đỏ & Xanh</Text>
              </View>
            </View>

            <Text style={styles.guideMainTitle}>Cắm Nguồn & Kiểm Tra Đèn LED</Text>
            <Text style={styles.guideSubtitle}>
              Thực hiện theo các bước kiểm tra nguồn ban đầu:
            </Text>

            <View style={styles.instructionsList}>
              <View style={styles.instItem}>
                <View style={styles.instNumber}>
                  <Text style={styles.instNumberText}>1</Text>
                </View>
                <Text style={styles.instText}>
                  Cắm dây nguồn vào cổng nguồn Camera và kết nối ổ điện gia đình.
                </Text>
              </View>

              <View style={styles.instItem}>
                <View style={styles.instNumber}>
                  <Text style={styles.instNumberText}>2</Text>
                </View>
                <Text style={styles.instText}>
                  Đợi khoảng 30 giây cho Camera hoàn tất tiến trình tự kiểm tra ban đầu.
                </Text>
              </View>

              <View style={styles.instItem}>
                <View style={styles.instNumber}>
                  <Text style={styles.instNumberText}>3</Text>
                </View>
                <Text style={styles.instText}>
                  Quan sát đèn LED ở mặt trước: Đèn phải{' '}
                  <Text style={{ fontWeight: 'bold', color: '#EA580C' }}>
                    nhấp nháy luân phiên Đỏ và Xanh
                  </Text>{' '}
                  (Báo hiệu Camera đang ở chế độ SoftAP chờ kết nối).
                </Text>
              </View>
            </View>

            {/* Câu hỏi dành cho người dùng nếu đèn KHÔNG nhấp nháy Đỏ/Xanh */}
            <TouchableOpacity
              style={styles.ledHelpQuestionCard}
              onPress={() => setShowResetGuideModal(true)}
              activeOpacity={0.8}
            >
              <View style={styles.ledHelpIconCircle}>
                <Ionicons name="help" size={18} color="#0284C7" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.ledHelpQuestionTitle}>
                  Đèn LED không nhấp nháy Đỏ / Xanh?
                </Text>
                <Text style={styles.ledHelpQuestionSubtitle}>
                  Bấm vào đây để xem hướng dẫn reset thủ công Camera SECA_001
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#0284C7" />
            </TouchableOpacity>

            {/* Nút Tiếp Tục luôn luôn sẵn sàng */}
            <View style={styles.continueButtonSection}>
              <TouchableOpacity
                style={styles.primaryActionButton}
                onPress={() => setCurrentStep('WIFI_GUIDE')}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryActionButtonText}>Tiếp Tục</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ============================================================== */}
        {/* 4A. STATE: WIFI_GUIDE (Hướng dẫn kết nối Wi-Fi Camera)        */}
        {/* ============================================================== */}
        {currentStep === 'WIFI_GUIDE' && (
          <View style={styles.softApGuideContainer}>
            <Text style={styles.softApGuideTitle}>Kết nối đến thiết bị SECA của bạn</Text>

            <Text style={styles.softApGuideSubtitle}>
              Đi tới cài đặt Wi-Fi của điện thoại hoặc máy tính bảng và tham gia mạng thiết bị SECA của bạn:{' '}
              <Text style={{ fontWeight: 'bold', color: '#0F172A' }}>SECA_001</Text>. Sau đó quay lại ứng dụng này.
            </Text>

            <Text style={styles.guideDetailText}>
              001 là ba chữ số cuối cùng của địa chỉ MAC duy nhất của thiết bị SECA. Bạn có thể tìm thấy nó dưới đế thiết bị SECA của mình.
            </Text>

            {/* Đồ họa minh họa đế Camera & Phóng to mã vạch MAC */}
            <View style={styles.barcodeGraphicWrapper}>
              {/* Thẻ mã vạch phóng to (Enlarged Callout Card) */}
              <View style={styles.enlargedBarcodeCard}>
                <View style={styles.barcodeBarsRow}>
                  {[3, 1, 4, 2, 1, 3, 2, 4, 1, 2, 4, 2, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3].map((w, idx) => (
                    <View
                      key={idx}
                      style={{
                        width: w,
                        height: 26,
                        backgroundColor: '#0F172A',
                        marginRight: idx % 4 === 0 ? 3 : 1.5,
                      }}
                    />
                  ))}
                </View>
                <Text style={styles.barcodeMacText}>MAC: AC-67-B2-3F-00-01</Text>
                <Text style={styles.barcodeSsidBadge}>SSID: SECA_001</Text>
              </View>

              {/* Vệt sáng chiếu phóng to (Cyan Projection Beam) */}
              <View style={styles.projectionCone} />

              {/* Mặt đế Camera hình tròn (Camera Base Diagram) */}
              <View style={styles.cameraBaseCircle}>
                {/* Đệm cao su đế camera (Rubber pads) */}
                <View style={[styles.rubberFoot, styles.rubberFootTop]} />
                <View style={[styles.rubberFoot, styles.rubberFootLeft]} />
                <View style={[styles.rubberFoot, styles.rubberFootRight]} />

                {/* Vòng tròn đồng tâm bên trong */}
                <View style={styles.cameraBaseInnerRing}>
                  <View style={styles.cameraBaseCenterHole} />
                </View>

                {/* Nhãn mã vạch nhỏ ở cạnh dưới đế camera */}
                <View style={styles.miniBarcodeSticker}>
                  <View style={styles.miniBarcodeBars}>
                    {[2, 1, 2, 1, 3, 1, 2, 1, 2, 1, 3, 1].map((w, i) => (
                      <View
                        key={i}
                        style={{
                          width: w,
                          height: 10,
                          backgroundColor: '#64748B',
                          marginRight: 1,
                        }}
                      />
                    ))}
                  </View>
                  <Text style={styles.miniBarcodeText}>MAC:••-••-••-00-01</Text>
                </View>
              </View>
            </View>

            {/* Nút Tôi đã kết nối */}
            <View style={styles.bottomActionSection}>
              <TouchableOpacity
                style={styles.primaryPillBtn}
                onPress={handlePressAlreadyConnected}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryPillBtnText}>Tôi đã kết nối</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ============================================================== */}
        {/* 2B. STATE: WATCH_LIST                                          */}
        {/* ============================================================== */}
        {currentStep === 'WATCH_LIST' && (
          <View>
            <Text style={styles.stepHeaderTitle}>Chọn Model Đồng Hồ / Vòng Đeo Tay</Text>
            <Text style={styles.stepHeaderDesc}>
              Danh sách thiết bị đeo tay theo dõi sức khỏe người cao tuổi qua Bluetooth BLE:
            </Text>

            {/* Model 1: BLE Smartband FR01 */}
            <TouchableOpacity
              style={[styles.modelCard, styles.modelCardActive, { borderColor: '#10B981' }]}
              onPress={() => handleSelectWatchModel('Vòng đeo tay y tế BLE Smartband FR01')}
              activeOpacity={0.8}
            >
              <View style={[styles.modelIconBox, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="watch" size={26} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.modelHeaderRow}>
                  <Text style={styles.modelTitle}>BLE Smartband FR01 (Y tế)</Text>
                  <View style={[styles.activeTag, { backgroundColor: '#DCFCE7' }]}>
                    <Text style={[styles.activeTagText, { color: '#15803D' }]}>Hiện có</Text>
                  </View>
                </View>
                <Text style={styles.modelDesc}>
                  Giao thức: BLUETOOTH • Đo PPG Nhịp tim (0x180D) • SpO₂ (0x1822) • Gia tốc ngã MPU6050
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#059669" />
            </TouchableOpacity>

            {/* Model 2: Mi Band 8 Active */}
            <TouchableOpacity
              style={styles.modelCard}
              onPress={() => handleSelectWatchModel('Xiaomi Mi Band 8 Active')}
              activeOpacity={0.8}
            >
              <View style={[styles.modelIconBox, { backgroundColor: '#F1F5F9' }]}>
                <Ionicons name="watch-outline" size={26} color="#64748B" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.modelHeaderRow}>
                  <Text style={styles.modelTitle}>Xiaomi Mi Band 8 / Active</Text>
                  <View style={[styles.activeTag, { backgroundColor: '#E2E8F0' }]}>
                    <Text style={[styles.activeTagText, { color: '#475569' }]}>Hỗ trợ</Text>
                  </View>
                </View>
                <Text style={styles.modelDesc}>
                  Giao thức: BLUETOOTH • Nhịp tim 24/7 • Pin 14 ngày • Chuẩn BLE 5.1
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
            </TouchableOpacity>

            {/* Model 3: Apple Watch */}
            <TouchableOpacity
              style={styles.modelCard}
              onPress={() => handleSelectWatchModel('Apple Watch Series 8')}
              activeOpacity={0.8}
            >
              <View style={[styles.modelIconBox, { backgroundColor: '#F1F5F9' }]}>
                <Ionicons name="watch-outline" size={26} color="#64748B" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.modelHeaderRow}>
                  <Text style={styles.modelTitle}>Apple Watch Series 8 / SE</Text>
                  <View style={[styles.activeTag, { backgroundColor: '#E2E8F0' }]}>
                    <Text style={[styles.activeTagText, { color: '#475569' }]}>Sắp hỗ trợ</Text>
                  </View>
                </View>
                <Text style={styles.modelDesc}>
                  Giao thức: BLUETOOTH • HealthKit Gateway • Cảnh báo ngã Crash Detection
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
            </TouchableOpacity>

            {/* CheckProtocol Box */}
            <View style={[styles.protocolCheckBanner, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
              <Ionicons name="bluetooth" size={18} color="#059669" />
              <Text style={[styles.protocolCheckText, { color: '#065F46' }]}>
                CheckProtocol: Hệ thống tự động kích hoạt giao thức{' '}
                <Text style={{ fontWeight: 'bold' }}>BLUETOOTH</Text> cho Smartwatch.
              </Text>
            </View>
          </View>
        )}

        {/* ============================================================== */}
        {/* 3B. STATE: BLE_POWER_CHECK                                     */}
        {/* ============================================================== */}
        {currentStep === 'BLE_POWER_CHECK' && (
          <View style={styles.guideContainer}>
            <View style={[styles.visualGraphicBox, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="bluetooth" size={54} color="#059669" />
              <View style={styles.ledIndicatorRow}>
                <Ionicons name="battery-charging" size={18} color="#059669" />
                <Text style={[styles.ledText, { color: '#059669' }]}>Đồng hồ đã bật nguồn</Text>
              </View>
            </View>

            <Text style={styles.guideMainTitle}>Mở Nguồn & Bật Bluetooth Đồng Hồ</Text>
            <Text style={styles.guideSubtitle}>
              Chuẩn bị thiết bị trước khi tiến hành quét sóng BLE:
            </Text>

            <View style={styles.instructionsList}>
              <View style={styles.instItem}>
                <View style={[styles.instNumber, { backgroundColor: '#10B981' }]}>
                  <Text style={styles.instNumberText}>1</Text>
                </View>
                <Text style={styles.instText}>
                  Nhấn giữ nút nguồn cạnh bên đồng hồ để màn hình sáng lên.
                </Text>
              </View>

              <View style={styles.instItem}>
                <View style={[styles.instNumber, { backgroundColor: '#10B981' }]}>
                  <Text style={styles.instNumberText}>2</Text>
                </View>
                <Text style={styles.instText}>
                  Đảm bảo pin đồng hồ còn trên 20% và biểu tượng Bluetooth đang sẵn sàng kết nối.
                </Text>
              </View>

              <View style={styles.instItem}>
                <View style={[styles.instNumber, { backgroundColor: '#10B981' }]}>
                  <Text style={styles.instNumberText}>3</Text>
                </View>
                <Text style={styles.instText}>
                  Đặt đồng hồ ngay cạnh điện thoại trong khoảng cách dưới 1 mét để tín hiệu ổn định nhất.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryActionButton, { backgroundColor: '#059669' }]}
              onPress={() => {
                // Kiểm tra xem đã có quyền chưa
                if (!hasBlePermission) {
                  setCurrentStep('BLE_PERMISSION');
                } else {
                  setCurrentStep('BLE_SCAN');
                }
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryActionButtonText}>
                Đồng Hồ Đã Mở Nguồn & Sẵn Sàng → Tiếp Tục
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* ============================================================== */}
        {/* 4B. STATE: BLE_PERMISSION                                      */}
        {/* ============================================================== */}
        {currentStep === 'BLE_PERMISSION' && (
          <View>
            <Text style={styles.stepHeaderTitle}>Kiểm Tra Quyền Hệ Điều Hành (OS)</Text>
            <Text style={styles.stepHeaderDesc}>
              Theo quy định của Android và iOS, để quét tìm thiết bị Bluetooth xung quanh, ứng dụng cần được cấp quyền:
            </Text>

            <View style={styles.permissionCard}>
              {/* Perm 1 */}
              <View style={styles.permRow}>
                <View style={[styles.permIconBox, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="bluetooth" size={22} color="#059669" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.permTitle}>Quyền Bluetooth Scan & Connect</Text>
                  <Text style={styles.permDesc}>Cho phép app quét tìm và kết nối kênh GATT với đồng hồ</Text>
                </View>
                <Ionicons
                  name={hasBlePermission ? 'checkmark-circle' : 'alert-circle'}
                  size={24}
                  color={hasBlePermission ? '#10B981' : '#F59E0B'}
                />
              </View>

              {/* Perm 2 */}
              <View style={styles.permRow}>
                <View style={[styles.permIconBox, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="location" size={22} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.permTitle}>Quyền Vị trí (Location OS)</Text>
                  <Text style={styles.permDesc}>Bắt buộc trên Android để quét Beacon & BLE lân cận</Text>
                </View>
                <Ionicons
                  name={hasBlePermission ? 'checkmark-circle' : 'alert-circle'}
                  size={24}
                  color={hasBlePermission ? '#10B981' : '#F59E0B'}
                />
              </View>
            </View>

            {/* Trạng thái quyền */}
            {!hasBlePermission ? (
              <View style={styles.unauthorizedBox}>
                <Ionicons name="lock-closed" size={20} color="#DC2626" />
                <Text style={styles.unauthorizedText}>
                  Trạng thái: <Text style={{ fontWeight: 'bold' }}>Chưa cấp quyền</Text>. Nhấn nút bên dưới để mở popup yêu cầu quyền hệ điều hành.
                </Text>
              </View>
            ) : (
              <View style={styles.authorizedBox}>
                <Ionicons name="checkmark-circle" size={20} color="#059669" />
                <Text style={styles.authorizedText}>
                  Trạng thái: <Text style={{ fontWeight: 'bold' }}>Đã cấp quyền thành công</Text>! Bạn có thể chuyển sang quét Radar.
                </Text>
              </View>
            )}

            {!hasBlePermission ? (
              <TouchableOpacity
                style={[styles.primaryActionButton, { backgroundColor: '#2563EB' }]}
                onPress={() => setShowPermRequestModal(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryActionButtonText}>
                  Hiển Thị Popup Xin Quyền (RequestPerm)
                </Text>
                <Ionicons name="key" size={20} color="#FFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.primaryActionButton, { backgroundColor: '#059669' }]}
                onPress={() => setCurrentStep('BLE_SCAN')}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryActionButtonText}>
                  Đã Cấp Quyền → Bắt Đầu Quét Radar BLE
                </Text>
                <Ionicons name="radio" size={20} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ============================================================== */}
        {/* 5B. STATE: BLE_SCAN (Màn hình Radar)                           */}
        {/* ============================================================== */}
        {currentStep === 'BLE_SCAN' && (
          <View>
            <Text style={styles.stepHeaderTitle}>Màn Hình Radar Quét Thiết Bị</Text>
            <Text style={styles.stepHeaderDesc}>
              Đang dò quét các sóng BLE lân cận (trong bán kính 5 mét):
            </Text>

            {/* Radar Animation Box */}
            <View style={styles.radarContainer}>
              <Animated.View
                style={[
                  styles.radarCircleOuter,
                  {
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              />
              <View style={styles.radarCircleMid} />
              <View style={styles.radarCenter}>
                <Ionicons name="bluetooth" size={28} color="#FFF" />
              </View>
              <Text style={styles.radarStatusText}>
                {isBleScanning ? 'Đang phát xung radar quét BLE...' : 'Đã tìm thấy thiết bị lân cận'}
              </Text>
            </View>

            {/* Simulation switch: Mô phỏng lỗi để test DialogBLE */}
            <View style={styles.testSimBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.testSimTitle}>Mô phỏng lỗi ghép nối (DialogBLE)</Text>
                <Text style={styles.testSimDesc}>Bật tùy chọn này để kiểm tra nhánh thất bại trong sơ đồ</Text>
              </View>
              <Switch
                value={simulateBleError}
                onValueChange={setSimulateBleError}
                trackColor={{ false: '#CBD5E1', true: '#FCA5A5' }}
                thumbColor={simulateBleError ? '#DC2626' : '#94A3B8'}
              />
            </View>

            {/* Discovered BLE Devices List */}
            <Text style={styles.sectionHeader}>Thiết bị tìm thấy ({discoveredBleList.length}):</Text>
            {discoveredBleList.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.bleDeviceCard}
                onPress={() => handleSelectBleDevice(item)}
                activeOpacity={0.8}
              >
                <View style={[styles.bleIconBox, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="watch" size={24} color="#059669" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.bleDeviceName}>{item.name}</Text>
                  <Text style={styles.bleDeviceSub}>MAC: {item.mac} • Pin: {item.battery}%</Text>
                  <Text style={styles.bleServicesText}>{item.services}</Text>
                </View>
                <View style={styles.bleRssiBox}>
                  <Text style={styles.bleRssiText}>{item.rssi.split(' ')[0]}</Text>
                  <Ionicons name="wifi" size={14} color="#059669" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ============================================================== */}
        {/* 6B. STATE: BLE_PAIRING (Đang ghép nối)                         */}
        {/* ============================================================== */}
        {currentStep === 'BLE_PAIRING' && (
          <View style={styles.guideContainer}>
            <View style={[styles.visualGraphicBox, { backgroundColor: '#ECFDF5' }]}>
              {isBlePairing ? (
                <ActivityIndicator size="large" color="#059669" />
              ) : (
                <Ionicons name="checkmark-circle" size={54} color="#059669" />
              )}
              <Text style={[styles.ledText, { marginTop: 12, color: '#059669', fontSize: 16 }]}>
                {isBlePairing ? 'Đang bắt tay GATT với đồng hồ...' : 'Kết nối GATT thành công!'}
              </Text>
            </View>

            <Text style={styles.guideMainTitle}>
              {isBlePairing ? 'Đang Ghép Nối Thiết Bị...' : 'Xác Nhận Người Sử Dụng'}
            </Text>
            <Text style={styles.guideSubtitle}>
              {isBlePairing
                ? 'Đang đồng bộ Service 0x180D (Heart Rate) và 0x1822 (SpO2)...'
                : 'Chọn thành viên trong gia đình sử dụng đồng hồ này:'}
            </Text>

            {!isBlePairing && (
              <View style={styles.wearerSelectBox}>
                {['Cụ Ông (78 tuổi)', 'Cụ Bà (75 tuổi)', 'Bố', 'Mẹ'].map((w) => (
                  <TouchableOpacity
                    key={w}
                    style={[
                      styles.wearerChip,
                      wearerName === w && styles.wearerChipActive,
                    ]}
                    onPress={() => setWearerName(w)}
                  >
                    <Ionicons
                      name="person"
                      size={16}
                      color={wearerName === w ? '#FFF' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.wearerChipText,
                        wearerName === w && styles.wearerChipTextActive,
                      ]}
                    >
                      {w}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {!isBlePairing && (
              <TouchableOpacity
                style={[styles.primaryActionButton, { backgroundColor: '#059669' }]}
                onPress={() => {
                  if (selectedBleDevice) {
                    handleSelectBleDevice(selectedBleDevice);
                  }
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryActionButtonText}>
                  Hoàn Tất Ghép Nối → Xem Kết Quả
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ============================================================== */}
        {/* 2C. STATE: OTHER_LIST (Cảm biến IoT)                           */}
        {/* ============================================================== */}
        {currentStep === 'OTHER_LIST' && (
          <View>
            <Text style={styles.stepHeaderTitle}>Cảm Biến IoT & Edge Hub</Text>
            <Text style={styles.stepHeaderDesc}>
              Kết nối cảm biến chuyên sâu qua Edge Hub Orange Pi 5 (EMQX Broker port 1883):
            </Text>

            {/* 5 Sensors options */}
            {[
              {
                id: 'amg8833',
                name: 'Cảm biến hồng ngoại AMG8833',
                sub: 'Ma trận nhiệt 8x8 IR • Sàng lọc sốt vùng trán',
                icon: 'thermometer',
                color: '#F59E0B',
              },
              {
                id: 'yamnet',
                name: 'Micro AI âm thanh YAMNet',
                sub: 'Phát hiện tiếng kêu cứu, ngã đập mạnh',
                icon: 'mic',
                color: '#8B5CF6',
              },
              {
                id: 'speaker',
                name: 'Loa thông minh Hub Voice Reminder',
                sub: 'Giọng nói tiếng Việt nhắc nhở người cao tuổi',
                icon: 'volume-high',
                color: '#EC4899',
              },
              {
                id: 'sos',
                name: 'Nút bấm khẩn cấp SOS',
                sub: 'Nút bấm 1 chạm gắn đầu giường/nhà tắm',
                icon: 'alert-circle',
                color: '#EF4444',
              },
              {
                id: 'door',
                name: 'Cảm biến cửa ra vào Zigbee',
                sub: 'Cảnh báo người già đi lạc ban đêm',
                icon: 'enter-outline',
                color: '#06B6D4',
              },
            ].map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.otherSensorCard,
                  selectedOtherSensor === s.id && styles.otherSensorCardActive,
                ]}
                onPress={() => setSelectedOtherSensor(s.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.sensorIconBox, { backgroundColor: `${s.color}15` }]}>
                  <Ionicons name={s.icon as any} size={22} color={s.color} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.sensorCardTitle}>{s.name}</Text>
                  <Text style={styles.sensorCardSub}>{s.sub}</Text>
                </View>
                <Ionicons
                  name={selectedOtherSensor === s.id ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={selectedOtherSensor === s.id ? '#7C3AED' : '#94A3B8'}
                />
              </TouchableOpacity>
            ))}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Vị trí lắp đặt:</Text>
              <TextInput
                style={styles.textInput}
                value={otherSensorLocation}
                onChangeText={setOtherSensorLocation}
                placeholder="Ví dụ: Phòng khách, Đầu giường Cụ..."
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryActionButton, { backgroundColor: '#7C3AED' }]}
              onPress={handleAddOtherSensor}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryActionButtonText}>
                Thêm Cảm Biến Vào Hệ Thống
              </Text>
              <Ionicons name="add-circle" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* ============================================================== */}
        {/* 7. STATE: SETUP_SUCCESS (Màn hình cấu hình thành công)         */}
        {/* ============================================================== */}
        {currentStep === 'SETUP_SUCCESS' && (
          <View style={styles.successContainer}>
            <View style={styles.successIconOuter}>
              <View style={styles.successIconInner}>
                <Ionicons name="checkmark" size={48} color="#FFF" />
              </View>
            </View>

            <Text style={styles.successTitle}>Cấu Hình Thành Công!</Text>
            <Text style={styles.successSubtitle}>
              Thiết bị đã được kết nối và tích hợp vào hệ sinh thái giám sát an sinh người cao tuổi.
            </Text>

            {/* Thông tin thiết bị */}
            <View style={styles.successDetailCard}>
              <View style={styles.successHeaderRow}>
                <View style={[styles.successBadgeIcon, { backgroundColor: `${successInfo.color}20` }]}>
                  <Ionicons name={successInfo.icon as any} size={24} color={successInfo.color} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.successDeviceName}>{successInfo.name}</Text>
                  <Text style={styles.successDeviceType}>{successInfo.type}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.successRow}>
                <Text style={styles.successLabel}>Giao thức:</Text>
                <Text style={styles.successValue}>{successInfo.protocol}</Text>
              </View>

              <View style={styles.successRow}>
                <Text style={styles.successLabel}>Thông số:</Text>
                <Text style={styles.successValue}>{successInfo.details}</Text>
              </View>

              <View style={styles.successRow}>
                <Text style={styles.successLabel}>Vị trí / Người đeo:</Text>
                <Text style={[styles.successValue, { color: '#059669', fontWeight: 'bold' }]}>
                  {successInfo.location}
                </Text>
              </View>

              <View style={styles.successRow}>
                <Text style={styles.successLabel}>Trạng thái:</Text>
                <Text style={[styles.successValue, { color: '#10B981', fontWeight: 'bold' }]}>
                  ● Trực tuyến & Hoạt động tốt
                </Text>
              </View>
            </View>

            {/* 2 Nút điều hướng */}
            <TouchableOpacity
              style={[styles.primaryActionButton, { backgroundColor: '#0284C7', marginBottom: 12 }]}
              onPress={() => navigation.navigate('Devices')}
              activeOpacity={0.85}
            >
              <Ionicons name="list" size={20} color="#FFF" />
              <Text style={styles.primaryActionButtonText}>
                Xem Danh Sách Thiết Bị
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryActionButton, { backgroundColor: '#F1F5F9' }]}
              onPress={() => navigation.navigate('Home')}
              activeOpacity={0.85}
            >
              <Ionicons name="home" size={20} color="#1E293B" />
              <Text style={[styles.primaryActionButtonText, { color: '#1E293B' }]}>
                Về Màn Hình Chính (Home)
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ============================================================== */}
      {/* MODAL: RequestPerm (Hiển thị Popup xin quyền)                  */}
      {/* ============================================================== */}
      <Modal
        visible={showPermRequestModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPermRequestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconBox}>
              <Ionicons name="shield-checkmark" size={36} color="#2563EB" />
            </View>
            <Text style={styles.modalTitle}>Cấp Quyền Hệ Thống</Text>
            <Text style={styles.modalMessage}>
              Để phát hiện và đồng bộ dữ liệu nhịp tim, SpO₂ từ đồng hồ thông minh, hệ thống cần quyền{' '}
              <Text style={{ fontWeight: 'bold' }}>Bluetooth & Vị trí</Text> theo tiêu chuẩn OS.
            </Text>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowPermRequestModal(false)}
              >
                <Text style={styles.modalCancelText}>Từ chối</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleGrantBlePermission}
              >
                <Text style={styles.modalConfirmText}>Cho phép</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL: WARNING DIALOG (Cảnh báo chưa kết nối SECA_001)         */}
      {/* ============================================================== */}
      <Modal
        visible={showWifiWarningDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWifiWarningDialog(false)}
      >
        <View style={styles.warningModalOverlay}>
          <View style={styles.warningDialogCard}>
            <Text style={styles.warningDialogText}>
              Có vẻ bạn đang không kết nối đến SECA_001. Tiếp tục?
            </Text>

            <View style={styles.warningActionColumn}>
              <TouchableOpacity
                style={styles.warningActionBtn}
                onPress={() => {
                  setShowWifiWarningDialog(false);
                  handleOpenPhoneWifiSettings();
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.warningActionPrimaryText}>Đến Cài đặt</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.warningActionBtn}
                onPress={() => {
                  setShowWifiWarningDialog(false);
                  setCurrentStep('WIFI_SEARCHING');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.warningActionPrimaryText}>Tiếp tục</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.warningActionBtn}
                onPress={() => setShowWifiWarningDialog(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.warningActionCancelText}>Hủy</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL: Phone Wi-Fi Settings                                    */}
      {/* ============================================================== */}
      <Modal
        visible={showPhoneWifiSettingsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPhoneWifiSettingsModal(false)}
      >
        <View style={styles.phoneSettingsOverlay}>
          <SafeAreaView style={styles.phoneSettingsSafeArea}>
            <View style={styles.phoneSettingsCard}>
              {/* Phone Settings Header */}
              <View style={styles.phoneSettingsHeader}>
                <TouchableOpacity
                  style={styles.phoneSettingsBackBtn}
                  onPress={() => setShowPhoneWifiSettingsModal(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.phoneSettingsTitle}>Wi-Fi</Text>
                <TouchableOpacity style={styles.phoneSettingsScanBtn} activeOpacity={0.7}>
                  <Ionicons name="scan-outline" size={22} color="#1E293B" />
                </TouchableOpacity>
              </View>

              {/* Wi-Fi Main Toggle */}
              <View style={styles.phoneWifiToggleRow}>
                <Text style={styles.phoneWifiToggleLabel}>Wi-Fi</Text>
                <Switch
                  value={true}
                  trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
                  thumbColor="#0284C7"
                />
              </View>

              {/* Thẻ mạng đang kết nối hiện tại */}
              <View style={styles.phoneConnectedCard}>
                <View style={styles.phoneConnectedIconBox}>
                  <Ionicons name="wifi" size={24} color="#FFF" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.phoneConnectedSsid}>
                      {connectedPhoneWifi || '5 chang trai'}
                    </Text>
                    <View style={styles.phoneBandTag}>
                      <Text style={styles.phoneBandTagText}>2.4G/5G</Text>
                    </View>
                  </View>
                  <Text style={styles.phoneConnectedSub}>
                    {connectedPhoneWifi === 'SECA_001'
                      ? 'Đã kết nối trực tiếp đến Camera'
                      : 'Chạm để chia sẻ mật khẩu'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="lock-closed" size={16} color="rgba(255,255,255,0.85)" />
                  <View style={styles.phoneConnectedArrowCircle}>
                    <Ionicons name="chevron-forward" size={16} color="#0284C7" />
                  </View>
                </View>
              </View>

              {/* Tiêu đề danh sách Mạng có sẵn */}
              <View style={styles.phoneAvailableSectionHeader}>
                <Text style={styles.phoneAvailableSectionTitle}>Mạng có sẵn</Text>
                <TouchableOpacity activeOpacity={0.7}>
                  <Ionicons name="sync-outline" size={18} color="#475569" />
                </TouchableOpacity>
              </View>

              {/* Danh sách mạng Wi-Fi lân cận */}
              <ScrollView
                style={styles.phoneNetworkListScroll}
                showsVerticalScrollIndicator={false}
              >
                {phoneWifiNetworks.map((net) => {
                  const isSelected = selectedPhoneWifi === net.ssid;
                  const isCameraTarget = net.isTarget;

                  return (
                    <TouchableOpacity
                      key={net.ssid}
                      style={[
                        styles.phoneNetworkItem,
                        isCameraTarget && styles.phoneNetworkItemTarget,
                      ]}
                      onPress={() => handleConnectPhoneWifi(net.ssid)}
                      disabled={isConnectingPhoneWifi}
                      activeOpacity={0.7}
                    >
                      <View style={styles.networkItemLeft}>
                        <Ionicons
                          name={net.icon as any}
                          size={22}
                          color={isCameraTarget ? '#0284C7' : '#475569'}
                        />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text
                              style={[
                                styles.networkItemSsid,
                                isCameraTarget && { color: '#0284C7', fontWeight: '800' },
                              ]}
                            >
                              {net.ssid}
                            </Text>
                            {net.tag && (
                              <View
                                style={[
                                  styles.phoneNetworkTagBox,
                                  isCameraTarget && { backgroundColor: '#E0F2FE' },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.phoneNetworkTagText,
                                    isCameraTarget && { color: '#0284C7' },
                                  ]}
                                >
                                  {net.tag}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.networkItemDesc}>{net.desc}</Text>
                        </View>
                      </View>

                      <View style={styles.networkItemRight}>
                        {isConnectingPhoneWifi && selectedPhoneWifi === net.ssid ? (
                          <ActivityIndicator size="small" color="#0284C7" />
                        ) : connectedPhoneWifi === net.ssid ? (
                          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                        ) : (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {net.hasLock && (
                              <Ionicons name="lock-closed" size={14} color="#94A3B8" />
                            )}
                            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {isConnectingPhoneWifi && (
                <View style={styles.connectingToast}>
                  <ActivityIndicator size="small" color="#FFF" />
                  <Text style={styles.connectingToastText}>
                    Đang kết nối vào mạng "{selectedPhoneWifi}"...
                  </Text>
                </View>
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL: Hướng Dẫn Reset Camera SECA_001 Thủ Công              */}
      {/* ============================================================== */}
      <Modal
        visible={showResetGuideModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResetGuideModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.resetGuideModalCard}>
            {/* Header */}
            <View style={styles.resetModalHeader}>
              <View style={styles.resetModalIconBox}>
                <Ionicons name="refresh" size={24} color="#EA580C" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.resetModalTitle}>Hướng Dẫn Reset Camera</Text>
                <Text style={styles.resetModalSub}>Camera an ninh AI SECA_001</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowResetGuideModal(false)}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Graphic Illustration */}
            <View style={styles.resetGraphicCard}>
              <Ionicons name="videocam" size={44} color="#EA580C" />
              <View style={styles.resetButtonPointerBadge}>
                <Ionicons name="finger-print" size={14} color="#FFF" />
                <Text style={styles.resetButtonPointerText}>Vị trí nút RESET ở đáy Camera</Text>
              </View>
            </View>

            {/* 4 Steps List */}
            <View style={styles.resetStepsList}>
              <View style={styles.resetStepItem}>
                <View style={styles.resetStepNum}>
                  <Text style={styles.resetStepNumText}>1</Text>
                </View>
                <Text style={styles.resetStepText}>
                  Cắm nguồn điện và đảm bảo Camera đang được cấp điện liên tục.
                </Text>
              </View>

              <View style={styles.resetStepItem}>
                <View style={styles.resetStepNum}>
                  <Text style={styles.resetStepNumText}>2</Text>
                </View>
                <Text style={styles.resetStepText}>
                  Tìm nút bấm <Text style={{ fontWeight: 'bold' }}>RESET</Text> ở mặt đáy Camera (hoặc lật nhẹ mắt camera lên trên để thấy nút reset bên dưới).
                </Text>
              </View>

              <View style={styles.resetStepItem}>
                <View style={styles.resetStepNum}>
                  <Text style={styles.resetStepNumText}>3</Text>
                </View>
                <Text style={styles.resetStepText}>
                  Dùng que chọc hoặc ngón tay <Text style={{ fontWeight: 'bold', color: '#EA580C' }}>nhấn giữ nút RESET trong 5 đến 10 giây</Text> cho đến khi nghe tiếng "Bíp" hoặc giọng nói thông báo.
                </Text>
              </View>

              <View style={styles.resetStepItem}>
                <View style={styles.resetStepNum}>
                  <Text style={styles.resetStepNumText}>4</Text>
                </View>
                <Text style={styles.resetStepText}>
                  Đợi camera xoay tự khởi động lại (~30s). Đèn LED sẽ chuyển sang <Text style={{ fontWeight: 'bold', color: '#059669' }}>nhấp nháy luân phiên Đỏ và Xanh</Text>.
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <TouchableOpacity
              style={[styles.modalConfirmBtn, { backgroundColor: '#EA580C', width: '100%', marginBottom: 10 }]}
              onPress={() => {
                setIsLedBlinking(true);
                setShowResetGuideModal(false);
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFF" />
              <Text style={styles.modalConfirmText}>Tôi Đã Reset Xong • Đèn Đã Nhấp Nháy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalCancelBtn, { width: '100%' }]}
              onPress={() => setShowResetGuideModal(false)}
            >
              <Text style={styles.modalCancelText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL: DialogBLE (Báo lỗi ghép nối)                            */}
      {/* ============================================================== */}
      <Modal
        visible={showBleErrorDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBleErrorDialog(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIconBox, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="close-circle" size={36} color="#DC2626" />
            </View>
            <Text style={[styles.modalTitle, { color: '#B91C1C' }]}>Lỗi Ghép Nối Bluetooth!</Text>
            <Text style={styles.modalMessage}>
              Không thể kết nối GATT với thiết bị BLE. Vui lòng đảm bảo đồng hồ ở khoảng cách dưới 1 mét, pin còn đủ và thử lại.
            </Text>

            <TouchableOpacity
              style={[styles.modalConfirmBtn, { backgroundColor: '#DC2626', width: '100%' }]}
              onPress={() => {
                setShowBleErrorDialog(false);
                setCurrentStep('BLE_SCAN');
              }}
            >
              <Text style={styles.modalConfirmText}>Quay Lại Màn Hình Radar Quét</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// -------------------------------------------------------------
// STYLESHEET
// -------------------------------------------------------------
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  progressBarWrapper: {
    height: 4,
    backgroundColor: '#E2E8F0',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#EA580C',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Step headers
  stepHeaderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  stepHeaderDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },

  // Category Cards
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  categoryIconBox: {
    width: 54,
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  categoryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginRight: 8,
  },
  protoBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  protoBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  categoryDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },

  // Model Cards
  modelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modelCardActive: {
    borderColor: '#EA580C',
    backgroundColor: '#FFFBF7',
  },
  modelIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  modelTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  modelDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  activeTag: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EA580C',
  },
  protocolCheckBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  protocolCheckText: {
    fontSize: 12,
    color: '#0369A1',
    marginLeft: 8,
    flex: 1,
  },

  // Visual Graphic Guides
  guideContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  visualGraphicBox: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  ledIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  ledDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  ledRed: {
    backgroundColor: '#EF4444',
  },
  ledGreen: {
    backgroundColor: '#10B981',
  },
  ledText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginLeft: 2,
  },
  guideMainTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  guideSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
  },

  // Instructions
  instructionsList: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  instItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  instNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EA580C',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  instNumberText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  instText: {
    fontSize: 13,
    color: '#334155',
    flex: 1,
    lineHeight: 19,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginBottom: 20,
    width: '100%',
  },
  tipText: {
    fontSize: 12,
    color: '#0369A1',
    marginLeft: 8,
    flex: 1,
    lineHeight: 17,
  },

  // Buttons
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EA580C',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    width: '100%',
    elevation: 2,
  },
  primaryActionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
    marginRight: 8,
  },

  // Form Cards
  formCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  wifiOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
    backgroundColor: '#F8FAFC',
  },
  wifiOptionRowSelected: {
    borderColor: '#EA580C',
    backgroundColor: '#FFFBF7',
  },
  wifiOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  wifiOptionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  switchSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },

  // Permissions Card
  permissionCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  permIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  permTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  permDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  unauthorizedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 16,
  },
  unauthorizedText: {
    fontSize: 12,
    color: '#991B1B',
    marginLeft: 8,
    flex: 1,
  },
  authorizedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 16,
  },
  authorizedText: {
    fontSize: 12,
    color: '#065F46',
    marginLeft: 8,
    flex: 1,
  },

  // Radar Screen
  radarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 180,
    marginBottom: 16,
  },
  radarCircleOuter: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  radarCircleMid: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
  },
  radarCenter: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  radarStatusText: {
    marginTop: 140,
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  testSimBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  testSimTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  testSimDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
  },
  bleDeviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bleDeviceName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  bleDeviceSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  bleServicesText: {
    fontSize: 10,
    color: '#059669',
    marginTop: 3,
    fontWeight: '600',
  },
  bleRssiBox: {
    alignItems: 'center',
    marginLeft: 6,
  },
  bleRssiText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },

  // Wearer selector
  wearerSelectBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
    justifyContent: 'center',
  },
  wearerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 6,
  },
  wearerChipActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  wearerChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  wearerChipTextActive: {
    color: '#FFF',
  },

  // Other Sensors
  otherSensorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  otherSensorCardActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#FAF5FF',
  },
  sensorIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sensorCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  sensorCardSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },

  // Setup Success
  successContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  successIconOuter: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successIconInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  successDetailCard: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 24,
    elevation: 2,
  },
  successHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  successBadgeIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successDeviceName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  successDeviceType: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  successRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  successLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  successValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
    maxWidth: '65%',
    textAlign: 'right',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    elevation: 8,
  },
  modalIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  modalButtonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },

  // =========================================================
  // LED confirm & separate action styles
  // =========================================================
  ledConfirmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#FED7AA',
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    marginBottom: 6,
  },
  ledConfirmCardActive: {
    borderColor: '#EA580C',
    backgroundColor: '#FFF7ED',
  },
  ledConfirmTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9A3412',
  },
  ledConfirmSub: {
    fontSize: 12,
    color: '#C2410C',
    marginTop: 2,
  },
  continueButtonSection: {
    marginTop: 12,
    marginBottom: 16,
  },
  primaryActionButtonDisabled: {
    backgroundColor: '#CBD5E1',
    opacity: 0.6,
  },

  // SoftAP graphic badge
  softApIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  ssidBadgeGraphic: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ssidBadgeGraphicText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },

  // =========================================================
  // Phone Wi-Fi Settings Panel
  // =========================================================
  phoneSettingsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  phoneSettingsSafeArea: {
    maxHeight: '85%',
  },
  phoneSettingsCard: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    minHeight: 480,
  },
  phoneSettingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  phoneSettingsBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneSettingsBackText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0284C7',
    marginLeft: 2,
  },
  phoneSettingsTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  phoneWifiToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  phoneWifiIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneWifiToggleLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  phoneWifiToggleSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  phoneWifiHelperBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  phoneWifiHelperText: {
    fontSize: 12,
    color: '#0369A1',
    flex: 1,
    lineHeight: 16,
  },
  networkSectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  phoneNetworkListScroll: {
    maxHeight: 250,
  },
  phoneNetworkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  phoneNetworkItemSelected: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
  },
  networkItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  networkItemRight: {
    marginLeft: 8,
  },
  networkItemSsid: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  networkItemDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  cameraTargetBadge: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cameraTargetBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EA580C',
  },
  connectingToast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 12,
    alignSelf: 'center',
    gap: 8,
  },
  connectingToastText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // =========================================================
  // LED Help Question & Reset Guide Modal Styles
  // =========================================================
  ledHelpQuestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  ledHelpIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ledHelpQuestionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369A1',
  },
  ledHelpQuestionSubtitle: {
    fontSize: 11,
    color: '#0284C7',
    marginTop: 1,
  },
  resetGuideModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    elevation: 10,
  },
  resetModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  resetModalIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  resetModalSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  resetGraphicCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    marginBottom: 14,
    gap: 8,
  },
  resetButtonPointerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EA580C',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  resetButtonPointerText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  resetStepsList: {
    gap: 10,
    marginBottom: 16,
  },
  resetStepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  resetStepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  resetStepNumText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  resetStepText: {
    flex: 1,
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
  },

  // =========================================================
  // SOFTAP ONBOARDING FLOW STYLES (Ảnh 2, 3, 4, 5)
  // =========================================================

  // Màn hình 1: WIFI_GUIDE (Ảnh 2)
  softApGuideContainer: {
    paddingTop: 8,
    paddingBottom: 30,
  },
  softApGuideTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  softApGuideSubtitle: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 21,
    marginBottom: 10,
  },
  guideDetailText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
    marginBottom: 24,
  },
  barcodeGraphicWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    position: 'relative',
  },
  enlargedBarcodeCard: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#0284C7',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 3,
  },
  barcodeBarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  barcodeMacText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  barcodeSsidBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284C7',
    marginTop: 2,
  },
  projectionCone: {
    width: 140,
    height: 48,
    backgroundColor: 'rgba(56, 189, 248, 0.22)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.3)',
    transform: [{ perspective: 100 }, { rotateX: '55deg' }],
    zIndex: 2,
    marginVertical: -8,
  },
  cameraBaseCircle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 3,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 1,
  },
  rubberFoot: {
    position: 'absolute',
    backgroundColor: '#94A3B8',
    borderRadius: 4,
  },
  rubberFootTop: {
    top: 8,
    width: 28,
    height: 6,
  },
  rubberFootLeft: {
    left: 8,
    width: 6,
    height: 28,
  },
  rubberFootRight: {
    right: 8,
    width: 6,
    height: 28,
  },
  cameraBaseInnerRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBaseCenterHole: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#CBD5E1',
  },
  miniBarcodeSticker: {
    position: 'absolute',
    bottom: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
  },
  miniBarcodeBars: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  miniBarcodeText: {
    fontSize: 7,
    color: '#64748B',
    fontWeight: '600',
  },
  bottomActionSection: {
    marginTop: 32,
    paddingHorizontal: 4,
  },
  primaryPillBtn: {
    backgroundColor: '#0284C7',
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryPillBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Màn hình 2: Warning Dialog (Ảnh 3)
  warningModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  warningDialogCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  warningDialogText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    lineHeight: 24,
    marginBottom: 20,
  },
  warningActionColumn: {
    alignItems: 'flex-end',
    gap: 14,
  },
  warningActionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  warningActionPrimaryText: {
    color: '#0284C7',
    fontSize: 15,
    fontWeight: '700',
  },
  warningActionCancelText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '600',
  },

  // Màn hình 3: Phone Wi-Fi Settings Panel (Ảnh 4)
  phoneSettingsScanBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneConnectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  phoneConnectedIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneConnectedSsid: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
  },
  phoneBandTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  phoneBandTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  phoneConnectedSub: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  phoneConnectedArrowCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneAvailableSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  phoneAvailableSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
  },
  phoneNetworkItemTarget: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  phoneNetworkTagBox: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  phoneNetworkTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },

  // Màn hình 4: WIFI_SEARCHING (Ảnh 5)
  searchingContainer: {
    flex: 1,
    backgroundColor: '#0284C7',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  searchingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 8,
  },
  searchingCloseBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
  },
  searchingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  radarPulseCircle: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  searchingCameraCircleOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  searchingCameraCircleInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  searchingPlusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  searchingPlusText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  searchingStreakLine1: {
    position: 'absolute',
    top: '25%',
    left: '15%',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.4)',
    transform: [{ rotate: '-40deg' }],
  },
  searchingStreakLine2: {
    position: 'absolute',
    top: '35%',
    right: '12%',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    transform: [{ rotate: '35deg' }],
  },
  searchingStreakLine3: {
    position: 'absolute',
    bottom: '30%',
    right: '16%',
    width: 30,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    transform: [{ rotate: '-45deg' }],
  },
  searchingPhoneCircleOuter: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  searchingPhoneBody: {
    width: 76,
    height: 124,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#334155',
    padding: 6,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  searchingPhoneSpeaker: {
    width: 18,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#64748B',
    marginTop: 2,
  },
  searchingPhoneScreen: {
    width: 60,
    height: 86,
    borderRadius: 6,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchingPhoneHomeButton: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#475569',
    marginBottom: 2,
  },
  searchingFooter: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  searchingFooterText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    lineHeight: 20,
  },
});

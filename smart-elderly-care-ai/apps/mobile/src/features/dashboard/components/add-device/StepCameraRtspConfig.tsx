import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedAlert, LocalizedText } from '../../../../i18n/LocalizedComponents';
import { cameraApi } from '../../../../services/camera';
import { FlowStep } from './types';

export interface CameraBrandTemplate {
  name: string;
  template: string;
  note: string;
  defaultPort: string;
  defaultChannelPath: string;
}

export const CAMERA_BRANDS: CameraBrandTemplate[] = [
  {
    name: 'TP-Link Tapo',
    template: 'rtsp://TAIKHOAN:MATKHAU@192.168.1.100:554/stream1',
    note: 'Tạo “Tài khoản camera” trong app Tapo: Cài đặt nâng cao → Tài khoản camera. stream2 là luồng phụ (nhẹ hơn).',
    defaultPort: '554',
    defaultChannelPath: '/stream1',
  },
  {
    name: 'Hikvision',
    template: 'rtsp://admin:MATKHAU@192.168.1.100:554/Streaming/Channels/101',
    note: '101 = luồng chính chất lượng cao, 102 = luồng phụ (mượt mà, nhẹ hơn).',
    defaultPort: '554',
    defaultChannelPath: '/Streaming/Channels/101',
  },
  {
    name: 'Dahua / Imou',
    template: 'rtsp://admin:MATKHAU@192.168.1.100:554/cam/realmonitor?channel=1&subtype=0',
    note: 'subtype=0 là luồng chính, subtype=1 là luồng phụ. Tài khoản admin và mật khẩu thiết bị.',
    defaultPort: '554',
    defaultChannelPath: '/cam/realmonitor?channel=1&subtype=0',
  },
  {
    name: 'Yoosee',
    template: 'rtsp://admin:MATKHAU@192.168.1.100:554/onvif1',
    note: 'Mật khẩu là mật khẩu quản trị thiết bị đặt trong app Yoosee (Cài đặt bảo mật thiết bị).',
    defaultPort: '554',
    defaultChannelPath: '/onvif1',
  },
  {
    name: 'EZVIZ',
    template: 'rtsp://admin:MAXACMINH@192.168.1.100:554/h264/ch1/main/av_stream',
    note: 'Tên đăng nhập là admin, mật khẩu là mã xác minh 6 chữ in hoa trên tem dán dưới camera.',
    defaultPort: '554',
    defaultChannelPath: '/h264/ch1/main/av_stream',
  },
  {
    name: 'Tùy chỉnh / Khác',
    template: 'rtsp://admin:MATKHAU@192.168.1.100:554/live',
    note: 'Hỗ trợ chuẩn RTSP / HTTP / RTMP / ONVIF mọi dòng camera an ninh gia đình.',
    defaultPort: '554',
    defaultChannelPath: '/live',
  },
];

export const SOURCE_TYPES = [
  { id: 'RTSP_IP', label: '🌐 Camera IP / Camera ở xa (RTSP, HTTP, RTMP)', icon: 'globe-outline' },
  { id: 'SECA_AI', label: '📹 Camera AI SECA (Luồng trực tiếp)', icon: 'videocam-outline' },
  { id: 'WEBCAM', label: '💻 Webcam USB / Tích hợp', icon: 'camera-outline' },
];

export const ROOM_SUGGESTIONS = [
  'Phòng khách',
  'Phòng ngủ cụ',
  'Khu vực bếp',
  'Hành lang',
  'Cửa chính / Sân trước',
  'Nhà vệ sinh',
];

interface StepCameraRtspConfigProps {
  currentStep?: FlowStep;
  isDarkMode?: boolean;
  colors?: any;
  onApplyCamera: (deviceData: {
    name: string;
    brand: string;
    streamUrl: string;
    location: string;
    ip: string;
    isDefault: boolean;
  }) => void | Promise<void>;
  initialValues?: {
    name?: string;
    brand?: string;
    streamUrl?: string;
    location?: string;
    username?: string;
    password?: string;
  };
}

export const StepCameraRtspConfig: React.FC<StepCameraRtspConfigProps> = ({
  isDarkMode = false,
  colors = {},
  onApplyCamera,
  initialValues,
}) => {
  const [selectedSourceType, setSelectedSourceType] = useState<string>(
    SOURCE_TYPES[0].label
  );
  const [selectedBrand, setSelectedBrand] = useState<string>(
    initialValues?.brand || 'TP-Link Tapo'
  );
  const [streamUrl, setStreamUrl] = useState<string>(
    initialValues?.streamUrl ||
    'rtsp://192.168.1.100:554/stream1'
  );
  const [cameraName, setCameraName] = useState<string>(
    initialValues?.name || 'Camera IP Tapo C200'
  );
  const [location, setLocation] = useState<string>(
    initialValues?.location || 'Phòng khách'
  );
  const [username, setUsername] = useState<string>(
    initialValues?.username || ''
  );
  const [password, setPassword] = useState<string>(
    initialValues?.password || ''
  );
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [applyingType, setApplyingType] = useState<'apply' | 'default' | null>(null);

  // Modals dropdown
  const [showSourceModal, setShowSourceModal] = useState<boolean>(false);
  const [showBrandModal, setShowBrandModal] = useState<boolean>(false);
  const [showLocationModal, setShowLocationModal] = useState<boolean>(false);

  // Kiểm tra kết nối RTSP
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    status: 'none' | 'success' | 'error';
    message: string;
  }>({ status: 'none', message: '' });

  // Dò camera trong mạng
  const [isScanningNetwork, setIsScanningNetwork] = useState<boolean>(false);
  const [discoveredCameras, setDiscoveredCameras] = useState<
    Array<{ ip: string; name: string; brand?: string; status: string; port: number; rtsp_url?: string }>
  >([]);
  const [scanMessage, setScanMessage] = useState<string>('');

  // Tự động cập nhật mẫu URL khi đổi hãng
  const handleSelectBrand = (brandName: string) => {
    setSelectedBrand(brandName);
    setShowBrandModal(false);

    const brandConfig = CAMERA_BRANDS.find((b) => b.name === brandName);
    if (!brandConfig) return;

    let user = username.trim() || 'TAIKHOAN';
    if (brandName === 'Hikvision' || brandName === 'EZVIZ' || brandName === 'Yoosee') {
      if (!username.trim()) user = 'admin';
    }
    const pass = password.trim() || (brandName === 'EZVIZ' ? 'MAXACMINH' : 'MATKHAU');

    // Giữ nguyên IP hiện tại nếu người dùng đã nhập
    const ipMatch = streamUrl.match(/@?([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/);
    const currentIp = ipMatch ? ipMatch[1] : '192.168.1.100';

    const newUrl = `rtsp://${user}:${pass}@${currentIp}:${brandConfig.defaultPort}${brandConfig.defaultChannelPath}`;
    setStreamUrl(newUrl);

    // Cập nhật tên camera gợi ý
    if (!initialValues?.name) {
      setCameraName(`Camera ${brandName}`);
    }
  };

  // Cập nhật thông tin credentials vào URL
  const handleUpdateCredentials = (newUsername: string, newPassword: string) => {
    setUsername(newUsername);
    setPassword(newPassword);

    try {
      const match = streamUrl.match(/^(rtsp|http|https|rtmp):\/\/([^@]+@)?(.*)$/i);
      if (match) {
        const protocol = match[1];
        const rest = match[3];
        const u = newUsername.trim() || 'TAIKHOAN';
        const p = newPassword.trim() || 'MATKHAU';
        setStreamUrl(`${protocol}://${u}:${p}@${rest}`);
      }
    } catch {
      // ignore
    }
  };

  // Kiểm tra đường dẫn RTSP thực tế qua mạng
  const handleTestConnection = async () => {
    const trimmed = streamUrl.trim();
    if (!trimmed) {
      setTestResult({
        status: 'error',
        message: 'Vui lòng nhập đường dẫn RTSP camera.',
      });
      return;
    }

    if (
      !trimmed.startsWith('rtsp://') &&
      !trimmed.startsWith('http://') &&
      !trimmed.startsWith('https://') &&
      !trimmed.startsWith('rtmp://')
    ) {
      setTestResult({
        status: 'error',
        message: 'Đường dẫn phải bắt đầu bằng rtsp://, http:// hoặc rtmp://',
      });
      return;
    }

    setIsTesting(true);
    setTestResult({ status: 'none', message: '' });

    try {
      const res = await cameraApi.probe(trimmed);
      if (res.data?.success) {
        setTestResult({
          status: 'success',
          message: res.data.message || 'Sẵn sàng: Cổng RTSP 554 đang mở, luồng video phản hồi tốt.',
        });
        if (res.data.brand && res.data.brand !== 'Camera IP (RTSP)') {
          const matchBrand = CAMERA_BRANDS.find((b) => b.name.toLowerCase() === res.data.brand?.toLowerCase());
          if (matchBrand) {
            setSelectedBrand(matchBrand.name);
          }
        }
      } else {
        setTestResult({
          status: 'error',
          message: res.data?.message || 'Không thể kết nối đến camera.',
        });
      }
    } catch (err: any) {
      setTestResult({
        status: 'error',
        message: err?.response?.data?.message || err?.message || 'Lỗi kiểm tra kết nối camera.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Dò quét camera thực tế trong toàn bộ mạng nội bộ
  const handleScanNetwork = async () => {
    setIsScanningNetwork(true);
    setDiscoveredCameras([]);
    setScanMessage('');

    try {
      const res = await cameraApi.discover();
      const items = res.data?.found || [];
      if (items.length > 0) {
        setDiscoveredCameras(items);
        setScanMessage(`Tìm thấy ${items.length} camera IP đang mở cổng RTSP trong mạng:`);
        // Tự động điền nếu tìm thấy 1 camera duy nhất
        if (items.length === 1) {
          handleSelectDiscovered(items[0]);
        }
      } else {
        setScanMessage('Không tìm thấy camera RTSP/ONVIF nào trong mạng nội bộ. Hãy kiểm tra camera đã cắm nguồn và kết nối cùng WiFi với hệ thống.');
      }
    } catch (err: any) {
      setScanMessage(err?.response?.data?.detail || err?.message || 'Không thể quét mạng từ máy chủ. Vui lòng kiểm tra lại kết nối mạng.');
    } finally {
      setIsScanningNetwork(false);
    }
  };

  // Chọn camera vừa dò được để cập nhật cấu hình tự động
  const handleSelectDiscovered = (item: {
    ip: string;
    name?: string;
    brand?: string;
    rtsp_url?: string;
    port?: number;
  }) => {
    try {
      if (item.brand) {
        const foundBrand = CAMERA_BRANDS.find(
          (b) => b.name.toLowerCase() === item.brand?.toLowerCase() || item.brand?.toLowerCase().includes(b.name.toLowerCase())
        );
        if (foundBrand) {
          setSelectedBrand(foundBrand.name);
        }
      }
      if (item.name) {
        setCameraName(item.name);
      }

      let u = username.trim();
      let p = password.trim();
      let targetUrl = item.rtsp_url || `rtsp://${item.ip}:554/stream1`;
      if (u || p) {
        u = u || 'admin';
        p = p || 'admin';
        targetUrl = targetUrl.replace(/rtsp:\/\/(?:[^@]+@)?(.*)/i, `rtsp://${u}:${p}@$1`);
      }
      setStreamUrl(targetUrl);
      setTestResult({
        status: 'success',
        message: `Đã tự động nhận diện và cập nhật đường dẫn cho ${item.name || item.ip}`,
      });
      LocalizedAlert.alert(
        'Đã chọn camera',
        `Đã tự động nhận diện ${item.brand || 'Camera'} tại ${item.ip} và điền đường dẫn RTSP.`
      );
    } catch {
      // ignore
    }
  };

  // Xử lý áp dụng camera
  const handleApply = async (isDefault: boolean) => {
    if (applyingType) return;
    const trimmedUrl = streamUrl.trim();
    if (!trimmedUrl) {
      LocalizedAlert.alert('Lỗi cấu hình', 'Đường dẫn camera không được để trống.');
      return;
    }

    const ipMatch = trimmedUrl.match(/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/);
    const ip = ipMatch ? ipMatch[0] : '192.168.1.100';

    setApplyingType(isDefault ? 'default' : 'apply');
    try {
      await onApplyCamera({
        name: cameraName.trim() || `Camera ${selectedBrand}`,
        brand: selectedBrand,
        streamUrl: trimmedUrl,
        location: location.trim() || 'Phòng khách',
        ip,
        isDefault,
      });
    } catch (err: any) {
      LocalizedAlert.alert('Lỗi lưu thiết bị', err?.message || 'Không thể lưu camera, vui lòng thử lại.');
    } finally {
      setApplyingType(null);
    }
  };

  const currentBrandInfo = CAMERA_BRANDS.find((b) => b.name === selectedBrand);

    return (
      <ScrollView
        style={[
          localStyles.container,
          isDarkMode && { backgroundColor: colors.background || '#0F172A' },
        ]}
        contentContainerStyle={localStyles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Khối Tiêu đề mô phỏng đúng giao diện CẤU HÌNH NGUỒN CAMERA */}
        <View style={localStyles.headerBox}>
          <LocalizedText
            style={[
              localStyles.mainHeaderTitle,
              isDarkMode && { color: colors.textPrimary || '#F8FAFC' },
            ]}
          >
            CẤU HÌNH NGUỒN CAMERA
          </LocalizedText>
        </View>

        {/* Row 1: Loại Nguồn & Hãng Camera */}
        <View style={localStyles.twoColRow}>
          <View style={localStyles.colField}>
            <LocalizedText
              style={[
                localStyles.fieldLabel,
                isDarkMode && { color: colors.textSecondary || '#94A3B8' },
              ]}
            >
              Loại Nguồn:
            </LocalizedText>
            <TouchableOpacity
              style={[
                localStyles.dropdownTrigger,
                isDarkMode && {
                  backgroundColor: colors.card || '#1E293B',
                  borderColor: colors.border || '#334155',
                },
              ]}
              onPress={() => setShowSourceModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="globe-outline" size={16} color="#0284C7" style={{ marginRight: 6 }} />
              <LocalizedText
                style={[
                  localStyles.dropdownTriggerText,
                  isDarkMode && { color: colors.textPrimary || '#F8FAFC' },
                ]}
                numberOfLines={1}
              >
                Camera IP / Camera
              </LocalizedText>
              <Ionicons
                name="chevron-down"
                size={14}
                color={isDarkMode ? '#94A3B8' : '#64748B'}
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>
          </View>

          <View style={localStyles.colField}>
            <LocalizedText
              style={[
                localStyles.fieldLabel,
                isDarkMode && { color: colors.textSecondary || '#94A3B8' },
              ]}
            >
              Hãng Camera:
            </LocalizedText>
            <TouchableOpacity
              style={[
                localStyles.dropdownTrigger,
                isDarkMode && {
                  backgroundColor: colors.card || '#1E293B',
                  borderColor: colors.border || '#334155',
                },
              ]}
              onPress={() => setShowBrandModal(true)}
              activeOpacity={0.8}
            >
              <LocalizedText
                style={[
                  localStyles.dropdownTriggerText,
                  isDarkMode && { color: colors.textPrimary || '#F8FAFC' },
                ]}
                numberOfLines={1}
              >
                {selectedBrand}
              </LocalizedText>
              <Ionicons
                name="chevron-down"
                size={14}
                color={isDarkMode ? '#94A3B8' : '#64748B'}
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Row 2: Đường dẫn camera (rtsp://, http://, rtmp://) kèm nút Kiểm tra */}
        <View style={localStyles.fieldGroup}>
          <LocalizedText
            style={[
              localStyles.fieldLabel,
              isDarkMode && { color: colors.textSecondary || '#94A3B8' },
            ]}
          >
            Đường dẫn camera (rtsp://, http://, rtmp://):
          </LocalizedText>
          <View style={localStyles.urlInputRow}>
            <TextInput
              style={[
                localStyles.urlInput,
                isDarkMode && {
                  backgroundColor: colors.card || '#1E293B',
                  borderColor: colors.border || '#334155',
                  color: colors.textPrimary || '#F8FAFC',
                },
              ]}
              value={streamUrl}
              onChangeText={setStreamUrl}
              placeholder="rtsp://192.168.1.100:554/stream1 hoặc rtsp://tenmi..."
              placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[
                localStyles.checkButton,
                isTesting && { opacity: 0.7 },
              ]}
              onPress={handleTestConnection}
              disabled={isTesting}
              activeOpacity={0.8}
            >
              {isTesting ? (
                <ActivityIndicator size="small" color="#0284C7" />
              ) : (
                <LocalizedText style={localStyles.checkButtonText}>
                  Kiểm tra
                </LocalizedText>
              )}
            </TouchableOpacity>
          </View>

          {/* Kết quả kiểm tra */}
          {testResult.status !== 'none' && (
            <View
              style={[
                localStyles.testResultBox,
                testResult.status === 'success'
                  ? localStyles.testResultSuccess
                  : localStyles.testResultError,
              ]}
            >
              <Ionicons
                name={
                  testResult.status === 'success'
                    ? 'checkmark-circle'
                    : 'alert-circle'
                }
                size={16}
                color={testResult.status === 'success' ? '#10B981' : '#EF4444'}
              />
              <LocalizedText
                style={[
                  localStyles.testResultText,
                  {
                    color:
                      testResult.status === 'success' ? '#10B981' : '#EF4444',
                  },
                ]}
              >
                {testResult.message}
              </LocalizedText>
            </View>
          )}
        </View>

        {/* Row 3: Nút Dò camera trong mạng */}
        <View style={localStyles.fieldGroup}>
          <TouchableOpacity
            style={[
              localStyles.scanNetworkButton,
              isDarkMode && {
                backgroundColor: '#1E293B',
                borderColor: '#0284C7',
              },
            ]}
            onPress={handleScanNetwork}
            disabled={isScanningNetwork}
            activeOpacity={0.8}
          >
            {isScanningNetwork ? (
              <ActivityIndicator size="small" color="#0284C7" style={{ marginRight: 8 }} />
            ) : (
              <Ionicons name="radio" size={16} color="#0284C7" style={{ marginRight: 8 }} />
            )}
            <LocalizedText style={localStyles.scanNetworkButtonText}>
              {isScanningNetwork ? 'Đang dò quét mạng nội bộ...' : '📡 Dò camera trong mạng'}
            </LocalizedText>
          </TouchableOpacity>

          {/* Thông báo kết quả dò quét mạng */}
          {scanMessage ? (
            <View
              style={[
                localStyles.scanMessageBox,
                isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
              ]}
            >
              <Ionicons
                name={discoveredCameras.length > 0 ? 'information-circle' : 'alert-circle'}
                size={18}
                color={discoveredCameras.length > 0 ? '#0284C7' : '#F59E0B'}
                style={{ marginRight: 8, marginTop: 2 }}
              />
              <LocalizedText
                style={[
                  localStyles.scanMessageText,
                  { color: discoveredCameras.length > 0 ? (isDarkMode ? '#38BDF8' : '#0284C7') : '#F59E0B' },
                ]}
              >
                {scanMessage}
              </LocalizedText>
            </View>
          ) : null}

          {/* Thẻ Camera tìm thấy trong mạng */}
          {discoveredCameras.map((cam, idx) => (
            <TouchableOpacity
              key={idx}
              style={[
                localStyles.discoveredCard,
                isDarkMode && {
                  backgroundColor: '#1E293B',
                  borderColor: '#1D4ED8',
                },
              ]}
              onPress={() => handleSelectDiscovered(cam)}
              activeOpacity={0.8}
            >
              <View style={localStyles.discoveredHeader}>
                <LocalizedText style={localStyles.discoveredIp}>
                  {cam.ip} · {cam.name}
                </LocalizedText>
                <View style={localStyles.autoFillBadge}>
                  <LocalizedText style={localStyles.autoFillBadgeText}>Chạm để chọn</LocalizedText>
                </View>
              </View>
              <View style={localStyles.discoveredStatusRow}>
                <Ionicons name="checkbox" size={16} color="#10B981" style={{ marginRight: 6 }} />
                <LocalizedText style={localStyles.discoveredStatusText}>
                  {cam.status}
                </LocalizedText>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Row 4: Tài khoản & Mật khẩu (tùy chọn) */}
        <View style={localStyles.twoColRow}>
          <View style={localStyles.colField}>
            <TextInput
              style={[
                localStyles.standardInput,
                isDarkMode && {
                  backgroundColor: colors.card || '#1E293B',
                  borderColor: colors.border || '#334155',
                  color: colors.textPrimary || '#F8FAFC',
                },
              ]}
              value={username}
              onChangeText={(txt) => handleUpdateCredentials(txt, password)}
              placeholder="Tài khoản (tùy chọn)"
              placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={localStyles.colField}>
            <View style={localStyles.passwordInputWrapper}>
              <TextInput
                style={[
                  localStyles.standardInput,
                  { paddingRight: 38 },
                  isDarkMode && {
                    backgroundColor: colors.card || '#1E293B',
                    borderColor: colors.border || '#334155',
                    color: colors.textPrimary || '#F8FAFC',
                  },
                ]}
                value={password}
                onChangeText={(txt) => handleUpdateCredentials(username, txt)}
                placeholder="Mật khẩu (tùy chọn)"
                placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={localStyles.eyeIconBtn}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={16}
                  color={isDarkMode ? '#94A3B8' : '#64748B'}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Row 5: Tên thiết bị & Vị trí phòng */}
        <View style={localStyles.twoColRow}>
          <View style={localStyles.colField}>
            <LocalizedText
              style={[
                localStyles.fieldLabel,
                isDarkMode && { color: colors.textSecondary || '#94A3B8' },
              ]}
            >
              Tên Camera:
            </LocalizedText>
            <TextInput
              style={[
                localStyles.standardInput,
                isDarkMode && {
                  backgroundColor: colors.card || '#1E293B',
                  borderColor: colors.border || '#334155',
                  color: colors.textPrimary || '#F8FAFC',
                },
              ]}
              value={cameraName}
              onChangeText={setCameraName}
              placeholder="Vd: Camera Phòng Khách"
              placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
            />
          </View>

          <View style={localStyles.colField}>
            <LocalizedText
              style={[
                localStyles.fieldLabel,
                isDarkMode && { color: colors.textSecondary || '#94A3B8' },
              ]}
            >
              Vị trí phòng:
            </LocalizedText>
            <TouchableOpacity
              style={[
                localStyles.dropdownTrigger,
                isDarkMode && {
                  backgroundColor: colors.card || '#1E293B',
                  borderColor: colors.border || '#334155',
                },
              ]}
              onPress={() => setShowLocationModal(true)}
              activeOpacity={0.8}
            >
              <LocalizedText
                style={[
                  localStyles.dropdownTriggerText,
                  isDarkMode && { color: colors.textPrimary || '#F8FAFC' },
                ]}
                numberOfLines={1}
              >
                {location}
              </LocalizedText>
              <Ionicons
                name="chevron-down"
                size={14}
                color={isDarkMode ? '#94A3B8' : '#64748B'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Row 6: Khối Lưu Ý & Hướng Dẫn Kỹ Thuật chuẩn theo hình đính kèm */}
        <View
          style={[
            localStyles.guideCard,
            isDarkMode && {
              backgroundColor: 'rgba(30, 41, 59, 0.6)',
              borderColor: colors.border || '#334155',
            },
          ]}
        >
          <LocalizedText
            style={[
              localStyles.guideNoticeText,
              isDarkMode && { color: colors.textSecondary || '#94A3B8' },
            ]}
          >
            Nhập tài khoản/mật khẩu riêng nếu mật khẩu có ký tự đặc biệt (@ : # /). Camera ở xa: dùng tên miền DDNS + mở cổng trên router, hoặc an toàn hơn là VPN (Tailscale/ZeroTier). Hệ thống tự kết nối lại khi mạng chập chờn.
          </LocalizedText>

          {currentBrandInfo?.note && (
            <View style={localStyles.brandSpecificNote}>
              <Ionicons name="information-circle" size={16} color="#0284C7" style={{ marginRight: 6 }} />
              <LocalizedText style={localStyles.brandSpecificNoteText}>
                <LocalizedText style={{ fontWeight: '700' }}>{selectedBrand}: </LocalizedText>
                {currentBrandInfo.note}
              </LocalizedText>
            </View>
          )}
        </View>

        {/* Row 7: Hai Nút Hành Động Lớn (ÁP DỤNG CAMERA & LƯU MẶC ĐỊNH) */}
        <View style={localStyles.actionButtonsRow}>
          <TouchableOpacity
            style={[localStyles.applyButton, applyingType !== null && { opacity: 0.8 }]}
            onPress={() => handleApply(false)}
            activeOpacity={0.85}
            disabled={applyingType !== null}
          >
            {applyingType === 'apply' ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <LocalizedText style={localStyles.applyButtonText}>
                ÁP DỤNG CAMERA
              </LocalizedText>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              localStyles.saveDefaultButton,
              isDarkMode && {
                backgroundColor: '#1E293B',
                borderColor: '#334155',
              },
              applyingType !== null && { opacity: 0.8 },
            ]}
            onPress={() => handleApply(true)}
            activeOpacity={0.85}
            disabled={applyingType !== null}
          >
            {applyingType === 'default' ? (
              <ActivityIndicator size="small" color={isDarkMode ? '#F8FAFC' : '#1E293B'} />
            ) : (
              <LocalizedText
                style={[
                  localStyles.saveDefaultButtonText,
                  isDarkMode && { color: '#F8FAFC' },
                ]}
              >
                LƯU MẶC ĐỊNH
              </LocalizedText>
            )}
          </TouchableOpacity>
        </View>

        {/* MODAL CHỌN HÃNG CAMERA */}
        <Modal visible={showBrandModal} transparent animationType="fade">
          <TouchableOpacity
            style={localStyles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowBrandModal(false)}
          >
            <View
              style={[
                localStyles.modalBox,
                isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
              ]}
            >
              <LocalizedText
                style={[
                  localStyles.modalTitle,
                  isDarkMode && { color: '#F8FAFC' },
                ]}
              >
                Chọn Hãng Camera
              </LocalizedText>
              {CAMERA_BRANDS.map((item) => (
                <TouchableOpacity
                  key={item.name}
                  style={[
                    localStyles.modalItem,
                    selectedBrand === item.name && localStyles.modalItemActive,
                    isDarkMode && { borderBottomColor: '#334155' },
                  ]}
                  onPress={() => handleSelectBrand(item.name)}
                >
                  <View style={{ flex: 1 }}>
                    <LocalizedText
                      style={[
                        localStyles.modalItemText,
                        selectedBrand === item.name && localStyles.modalItemTextActive,
                        isDarkMode && { color: '#F8FAFC' },
                      ]}
                    >
                      {item.name}
                    </LocalizedText>
                    <LocalizedText
                      style={[
                        localStyles.modalItemSub,
                        isDarkMode && { color: '#94A3B8' },
                      ]}
                    >
                      {item.template}
                    </LocalizedText>
                  </View>
                  {selectedBrand === item.name && (
                    <Ionicons name="checkmark" size={18} color="#0284C7" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* MODAL CHỌN VỊ TRÍ PHÒNG */}
        <Modal visible={showLocationModal} transparent animationType="fade">
          <TouchableOpacity
            style={localStyles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowLocationModal(false)}
          >
            <View
              style={[
                localStyles.modalBox,
                isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
              ]}
            >
              <LocalizedText
                style={[
                  localStyles.modalTitle,
                  isDarkMode && { color: '#F8FAFC' },
                ]}
              >
                Chọn Vị Trí Lắp Đặt
              </LocalizedText>
              {ROOM_SUGGESTIONS.map((room) => (
                <TouchableOpacity
                  key={room}
                  style={[
                    localStyles.modalItem,
                    location === room && localStyles.modalItemActive,
                    isDarkMode && { borderBottomColor: '#334155' },
                  ]}
                  onPress={() => {
                    setLocation(room);
                    setShowLocationModal(false);
                  }}
                >
                  <LocalizedText
                    style={[
                      localStyles.modalItemText,
                      location === room && localStyles.modalItemTextActive,
                      isDarkMode && { color: '#F8FAFC' },
                    ]}
                  >
                    {room}
                  </LocalizedText>
                  {location === room && (
                    <Ionicons name="checkmark" size={18} color="#0284C7" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* MODAL CHỌN LOẠI NGUỒN */}
        <Modal visible={showSourceModal} transparent animationType="fade">
          <TouchableOpacity
            style={localStyles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowSourceModal(false)}
          >
            <View
              style={[
                localStyles.modalBox,
                isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
              ]}
            >
              <LocalizedText
                style={[
                  localStyles.modalTitle,
                  isDarkMode && { color: '#F8FAFC' },
                ]}
              >
                Chọn Loại Nguồn Camera
              </LocalizedText>
              {SOURCE_TYPES.map((src) => (
                <TouchableOpacity
                  key={src.id}
                  style={[
                    localStyles.modalItem,
                    selectedSourceType === src.label && localStyles.modalItemActive,
                    isDarkMode && { borderBottomColor: '#334155' },
                  ]}
                  onPress={() => {
                    setSelectedSourceType(src.label);
                    setShowSourceModal(false);
                  }}
                >
                  <Ionicons
                    name={src.icon as any}
                    size={18}
                    color="#0284C7"
                    style={{ marginRight: 8 }}
                  />
                  <LocalizedText
                    style={[
                      localStyles.modalItemText,
                      selectedSourceType === src.label && localStyles.modalItemTextActive,
                      isDarkMode && { color: '#F8FAFC' },
                      { flex: 1 },
                    ]}
                  >
                    {src.label}
                  </LocalizedText>
                  {selectedSourceType === src.label && (
                    <Ionicons name="checkmark" size={18} color="#0284C7" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      </ScrollView>
    );
  };

  const localStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#F8FAFC',
    },
    contentContainer: {
      padding: 16,
      paddingBottom: 40,
    },
    headerBox: {
      marginBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(148, 163, 184, 0.2)',
      paddingBottom: 8,
    },
    mainHeaderTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: '#0F172A',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    twoColRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 14,
    },
    colField: {
      flex: 1,
    },
    fieldGroup: {
      marginBottom: 14,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: '#475569',
      marginBottom: 6,
    },
    dropdownTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#FFF',
      borderWidth: 1,
      borderColor: '#CBD5E1',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 44,
    },
    dropdownTriggerText: {
      fontSize: 13,
      color: '#0F172A',
      flex: 1,
    },
    standardInput: {
      backgroundColor: '#FFF',
      borderWidth: 1,
      borderColor: '#CBD5E1',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 13,
      color: '#0F172A',
      minHeight: 44,
    },
    passwordInputWrapper: {
      position: 'relative',
      justifyContent: 'center',
    },
    eyeIconBtn: {
      position: 'absolute',
      right: 12,
      top: 14,
    },
    urlInputRow: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    urlInput: {
      flex: 1,
      backgroundColor: '#FFF',
      borderWidth: 1,
      borderColor: '#CBD5E1',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 13,
      color: '#0F172A',
      minHeight: 44,
    },
    checkButton: {
      backgroundColor: 'rgba(2, 132, 199, 0.1)',
      borderWidth: 1,
      borderColor: '#0284C7',
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkButtonText: {
      color: '#0284C7',
      fontWeight: '700',
      fontSize: 13,
    },
    testResultBox: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      padding: 10,
      borderRadius: 8,
      gap: 8,
    },
    testResultSuccess: {
      backgroundColor: 'rgba(16, 185, 129, 0.12)',
      borderWidth: 1,
      borderColor: '#10B981',
    },
    testResultError: {
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
      borderWidth: 1,
      borderColor: '#EF4444',
    },
    testResultText: {
      fontSize: 12,
      flex: 1,
      fontWeight: '600',
    },
    scanNetworkButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFF',
      borderWidth: 1,
      borderColor: '#0284C7',
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    scanNetworkButtonText: {
      color: '#0284C7',
      fontSize: 13,
      fontWeight: '700',
    },
    scanMessageBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: '#F8FAFC',
      borderWidth: 1,
      borderColor: '#E2E8F0',
      borderRadius: 8,
      padding: 10,
      marginTop: 8,
    },
    scanMessageText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '500',
    },
    discoveredCard: {
      marginTop: 10,
      backgroundColor: '#FFF',
      borderWidth: 1.5,
      borderColor: '#0284C7',
      borderRadius: 10,
      padding: 12,
    },
    discoveredHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    discoveredIp: {
      fontSize: 14,
      fontWeight: '700',
      color: '#0284C7',
    },
    autoFillBadge: {
      backgroundColor: 'rgba(2, 132, 199, 0.15)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    autoFillBadgeText: {
      fontSize: 11,
      color: '#0284C7',
      fontWeight: '700',
    },
    discoveredStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 2,
    },
    discoveredStatusText: {
      fontSize: 12,
      color: '#10B981',
      fontWeight: '600',
    },
    guideCard: {
      backgroundColor: '#F1F5F9',
      borderRadius: 10,
      padding: 12,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: '#E2E8F0',
    },
    guideNoticeText: {
      fontSize: 12,
      color: '#64748B',
      lineHeight: 18,
    },
    brandSpecificNote: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(148, 163, 184, 0.3)',
    },
    brandSpecificNoteText: {
      fontSize: 12,
      color: '#0284C7',
      flex: 1,
      lineHeight: 16,
    },
    actionButtonsRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    applyButton: {
      flex: 1,
      backgroundColor: '#1D4ED8',
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 2,
      shadowColor: '#1D4ED8',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    applyButtonText: {
      color: '#FFF',
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    saveDefaultButton: {
      flex: 1,
      backgroundColor: '#0F172A',
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#334155',
    },
    saveDefaultButtonText: {
      color: '#FFF',
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalBox: {
      width: '100%',
      maxHeight: '80%',
      backgroundColor: '#FFF',
      borderRadius: 14,
      padding: 18,
      borderWidth: 1,
      borderColor: '#E2E8F0',
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: '#0F172A',
      marginBottom: 12,
      textAlign: 'center',
    },
    modalItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#E2E8F0',
    },
    modalItemActive: {
      backgroundColor: 'rgba(2, 132, 199, 0.05)',
    },
    modalItemText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#334155',
    },
    modalItemTextActive: {
      color: '#0284C7',
      fontWeight: '700',
    },
    modalItemSub: {
      fontSize: 11,
      color: '#64748B',
      marginTop: 2,
    },
  });


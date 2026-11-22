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
  scannedData?: {
    mac?: string;
    sn?: string;
    brand?: string;
    suggestedName?: string;
    deviceId?: string;
  };
  onOpenScanner?: () => void;
}

// Xóa IP khỏi tên thiết bị để giao diện thân thiện
const cleanCameraName = (rawName?: string, brand?: string) => {
  if (!rawName) return brand ? `Camera ${brand}` : 'Camera an ninh';
  const cleaned = rawName
    .replace(/\s*\([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\)/g, '')
    .replace(/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\s*·?\s*/g, '')
    .trim();
  return cleaned || (brand ? `Camera ${brand}` : 'Camera an ninh');
};

// Trích xuất IP và tài khoản từ RTSP URL nếu có
const parseInitialStreamUrl = (url?: string) => {
  if (!url) return { ip: '192.168.1.100', user: '', pass: '' };
  try {
    const match = url.match(/^(?:[a-z]+:\/\/)?(?:([^:@]+)(?::([^@]+))?@)?([^:/]+)/i);
    if (match) {
      const u = match[1] && match[1] !== 'TAIKHOAN' && match[1] !== 'admin' ? match[1] : (match[1] === 'admin' ? 'admin' : '');
      const p = match[2] && match[2] !== 'MATKHAU' && match[2] !== 'MAXACMINH' ? match[2] : '';
      const ip = match[3] || '192.168.1.100';
      return { ip, user: u, pass: p };
    }
  } catch {
    // ignore
  }
  return { ip: '192.168.1.100', user: '', pass: '' };
};

export const StepCameraRtspConfig: React.FC<StepCameraRtspConfigProps> = ({
  isDarkMode = false,
  colors = {},
  onApplyCamera,
  initialValues,
  scannedData,
  onOpenScanner,
}) => {
  const parsed = parseInitialStreamUrl(initialValues?.streamUrl);

  const [selectedBrand, setSelectedBrand] = useState<string>(
    scannedData?.brand || initialValues?.brand || 'TP-Link Tapo'
  );
  const [cameraIp, setCameraIp] = useState<string>(parsed.ip);
  const [username, setUsername] = useState<string>(
    scannedData ? 'admin123' : (initialValues?.username || parsed.user)
  );
  const [password, setPassword] = useState<string>(
    scannedData ? 'admin123' : (initialValues?.password || parsed.pass)
  );
  const [streamUrl, setStreamUrl] = useState<string>(
    initialValues?.streamUrl || 'rtsp://192.168.1.100:554/stream1'
  );
  const [cameraName, setCameraName] = useState<string>(
    scannedData?.suggestedName || cleanCameraName(initialValues?.name, initialValues?.brand || 'TP-Link Tapo')
  );
  const [location, setLocation] = useState<string>(
    initialValues?.location || 'Phòng khách'
  );
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [applyingType, setApplyingType] = useState<'apply' | 'default' | null>(null);

  // Modals dropdown
  const [showBrandModal, setShowBrandModal] = useState<boolean>(false);
  const [showLocationModal, setShowLocationModal] = useState<boolean>(false);

  // Kiểm tra kết nối RTSP (tự động)
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

  // Tự động lắp ráp URL ngầm
  const buildRtspUrl = (brand: string, host: string, user: string, pass: string) => {
    const brandConfig = CAMERA_BRANDS.find((b) => b.name === brand) || CAMERA_BRANDS[0];
    const port = brandConfig.defaultPort || '554';
    const path = brandConfig.defaultChannelPath || '/stream1';
    const cleanHost = host.trim() || '192.168.1.100';
    const u = user.trim();
    const p = pass.trim();
    const auth = (u || p) ? `${u || 'admin'}:${p}@` : '';
    return `rtsp://${auth}${cleanHost}:${port}${path}`;
  };

  // Kiểm tra kết nối RTSP tự động khi chọn camera hoặc đổi cấu hình
  const verifyCameraConnection = async (targetUrl?: string) => {
    const urlToTest = (targetUrl || streamUrl).trim();
    if (!urlToTest) return;

    setIsTesting(true);
    setTestResult({ status: 'none', message: '' });

    try {
      const res = await cameraApi.probe(urlToTest);
      if (res.data?.success) {
        setTestResult({
          status: 'success',
          message: 'Kết nối thành công! Camera phản hồi tốt, luồng video sẵn sàng.',
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
          message: res.data?.message || 'Không thể kết nối đến camera. Vui lòng kiểm tra lại mật khẩu camera.',
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

  // Đổi hãng camera
  const handleSelectBrand = (brandName: string) => {
    setSelectedBrand(brandName);
    setShowBrandModal(false);

    const newUrl = buildRtspUrl(brandName, cameraIp, username, password);
    setStreamUrl(newUrl);

    if (!initialValues?.name) {
      setCameraName(`Camera ${brandName}`);
    }

    if (cameraIp && cameraIp !== '192.168.1.100') {
      verifyCameraConnection(newUrl);
    }
  };

  // Đổi tài khoản/mật khẩu
  const handleCredentialsChange = (newUsername: string, newPassword: string) => {
    setUsername(newUsername);
    setPassword(newPassword);
    const newUrl = buildRtspUrl(selectedBrand, cameraIp, newUsername, newPassword);
    setStreamUrl(newUrl);
  };

  // Chỉnh sửa nâng cao
  const handleManualIpChange = (newIp: string) => {
    setCameraIp(newIp);
    const newUrl = buildRtspUrl(selectedBrand, newIp, username, password);
    setStreamUrl(newUrl);
  };

  const handleCustomUrlChange = (txt: string) => {
    setStreamUrl(txt);
    const match = txt.match(/@?([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/);
    if (match) {
      setCameraIp(match[1]);
    }
  };

  // Dò quét camera thực tế trong mạng nội bộ (xử lý ngầm)
  const handleScanNetwork = async () => {
    setIsScanningNetwork(true);
    setScanMessage('');

    try {
      const res = await cameraApi.discover();
      const items = res.data?.found || [];
      if (items.length > 0) {
        setDiscoveredCameras(items);
        setScanMessage(`Tìm thấy ${items.length} camera trong mạng:`);
        handleSelectDiscovered(items[0]);
      } else {
        setScanMessage('Không tìm thấy camera nào. Hãy chắc chắn camera đã bật và cùng mạng WiFi.');
      }
    } catch (err: any) {
      setScanMessage('Không thể quét camera từ máy chủ. Vui lòng kiểm tra kết nối WiFi.');
    } finally {
      setIsScanningNetwork(false);
    }
  };

  // Chọn camera tìm được -> Tự động kiểm tra kết nối ngay lập tức!
  const handleSelectDiscovered = (item: {
    ip: string;
    name?: string;
    brand?: string;
    rtsp_url?: string;
    port?: number;
  }) => {
    setCameraIp(item.ip);
    const resolvedBrand = item.brand || selectedBrand;
    if (item.brand) {
      const foundBrand = CAMERA_BRANDS.find(
        (b) => b.name.toLowerCase() === item.brand?.toLowerCase() || item.brand?.toLowerCase().includes(b.name.toLowerCase())
      );
      if (foundBrand) {
        setSelectedBrand(foundBrand.name);
      }
    }
    const cleanName = cleanCameraName(item.name, resolvedBrand);
    setCameraName(cleanName);

    const targetUser = username || (scannedData ? 'admin123' : '');
    const targetPass = password || (scannedData ? 'admin123' : '');
    const updatedUrl = buildRtspUrl(resolvedBrand, item.ip, targetUser, targetPass);
    setStreamUrl(updatedUrl);

    // Kiểm tra kết nối ngầm ngay khi chọn
    verifyCameraConnection(updatedUrl);
  };

  // Tự động quét camera ngầm khi mở màn hình hoặc nhận diện từ mã vạch
  useEffect(() => {
    if (scannedData) {
      if (scannedData.brand) setSelectedBrand(scannedData.brand);
      if (scannedData.suggestedName) setCameraName(scannedData.suggestedName);
      setUsername('admin123');
      setPassword('admin123');
      handleScanNetwork();
    } else if (!initialValues?.streamUrl || initialValues.streamUrl.includes('192.168.1.100')) {
      handleScanNetwork();
    }
  }, [scannedData]);

  // Áp dụng cấu hình camera
  const handleApply = async (isDefault: boolean) => {
    if (applyingType) return;
    const trimmedUrl = streamUrl.trim();
    if (!trimmedUrl) {
      LocalizedAlert.alert('Lỗi cấu hình', 'Không tìm thấy thông tin camera để lưu.');
      return;
    }

    setApplyingType(isDefault ? 'default' : 'apply');
    try {
      await onApplyCamera({
        name: cameraName.trim() || `Camera ${selectedBrand}`,
        brand: selectedBrand,
        streamUrl: trimmedUrl,
        location: location.trim() || 'Phòng khách',
        ip: cameraIp.trim() || '192.168.1.100',
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
      {/* Khối Tiêu đề */}
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

      {/* Nút bấm Quét mã vạch ở đáy Camera */}
      {onOpenScanner && (
        <TouchableOpacity
          style={[
            localStyles.scanBarcodeBtn,
            isDarkMode && { backgroundColor: '#1E293B', borderColor: '#0284C7' },
          ]}
          onPress={onOpenScanner}
          activeOpacity={0.8}
        >
          <Ionicons name="barcode-outline" size={20} color="#0284C7" style={{ marginRight: 8 }} />
          <LocalizedText style={[localStyles.scanBarcodeBtnText, isDarkMode && { color: '#38BDF8' }]}>
            {scannedData ? 'Quét lại mã vạch camera' : 'Quét mã vạch S/N ở đáy camera'}
          </LocalizedText>
        </TouchableOpacity>
      )}

      {/* Thông tin nhận diện từ mã vạch / QR */}
      {scannedData && (
        <View
          style={[
            localStyles.scannedBanner,
            isDarkMode && { backgroundColor: '#1E293B', borderColor: '#0284C7' },
          ]}
        >
          <Ionicons name="barcode-outline" size={22} color="#0284C7" style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <LocalizedText
              style={[
                localStyles.scannedBannerTitle,
                isDarkMode && { color: '#38BDF8' },
              ]}
            >
              Đã nhận diện qua mã vạch / QR
            </LocalizedText>
            <LocalizedText
              style={[
                localStyles.scannedBannerText,
                isDarkMode && { color: '#94A3B8' },
              ]}
            >
              {scannedData.brand || 'Camera'}
              {scannedData.mac ? ` • MAC: ${scannedData.mac}` : ''}
              {scannedData.sn ? ` • S/N: ${scannedData.sn}` : ''}
            </LocalizedText>
          </View>
          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
        </View>
      )}

      {/* 1. Hãng Camera */}
      <View style={localStyles.fieldGroup}>
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
          <Ionicons name="videocam-outline" size={16} color="#0284C7" style={{ marginRight: 6 }} />
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

      {/* 2. Thiết bị phát hiện trong mạng (Xử lý ngầm, không hiện IP) */}
      <View style={localStyles.fieldGroup}>
        <View style={localStyles.sectionHeaderRow}>
          <LocalizedText
            style={[
              localStyles.fieldLabel,
              { marginBottom: 0 },
              isDarkMode && { color: colors.textSecondary || '#94A3B8' },
            ]}
          >
            Thiết bị kết nối:
          </LocalizedText>
          {discoveredCameras.length > 0 && (
            <TouchableOpacity
              style={localStyles.rescanSmallBtn}
              onPress={handleScanNetwork}
              disabled={isScanningNetwork}
              activeOpacity={0.7}
            >
              <Ionicons
                name="refresh"
                size={13}
                color="#0284C7"
                style={{ marginRight: 4 }}
              />
              <LocalizedText style={localStyles.rescanSmallBtnText}>
                {isScanningNetwork ? 'Đang dò...' : 'Dò lại'}
              </LocalizedText>
            </TouchableOpacity>
          )}
        </View>

        {/* Trạng thái đang quét */}
        {isScanningNetwork && (
          <View
            style={[
              localStyles.scanningBox,
              isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
            ]}
          >
            <ActivityIndicator size="small" color="#0284C7" style={{ marginRight: 8 }} />
            <LocalizedText
              style={[
                localStyles.scanningText,
                isDarkMode && { color: '#38BDF8' },
              ]}
            >
              Đang tự động dò tìm camera trong mạng WiFi...
            </LocalizedText>
          </View>
        )}

        {/* Thẻ Camera tìm thấy (Tên sạch, không hiện IP) */}
        {!isScanningNetwork && discoveredCameras.length > 0 && (
          discoveredCameras.map((cam, idx) => {
            const isSelected = cameraIp === cam.ip;
            const displayName = cleanCameraName(cam.name, cam.brand || selectedBrand);
            return (
              <TouchableOpacity
                key={idx}
                style={[
                  localStyles.discoveredCard,
                  isSelected && localStyles.discoveredCardActive,
                  isDarkMode && {
                    backgroundColor: '#1E293B',
                    borderColor: isSelected ? '#38BDF8' : '#334155',
                  },
                ]}
                onPress={() => handleSelectDiscovered(cam)}
                activeOpacity={0.8}
              >
                <View style={localStyles.discoveredHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Ionicons name="videocam" size={16} color="#0284C7" style={{ marginRight: 6 }} />
                    <LocalizedText style={localStyles.discoveredTitle}>
                      {displayName}
                    </LocalizedText>
                  </View>
                  <View style={[localStyles.autoFillBadge, isSelected && localStyles.autoFillBadgeActive]}>
                    <LocalizedText
                      style={[
                        localStyles.autoFillBadgeText,
                        isSelected && localStyles.autoFillBadgeTextActive,
                      ]}
                    >
                      {isSelected ? 'Đang chọn ✓' : 'Chạm để chọn'}
                    </LocalizedText>
                  </View>
                </View>
                <LocalizedText style={localStyles.discoveredStatusText}>
                  {cam.ip} · Cổng {cam.port || 554} · {cam.status || 'Sẵn sàng'}
                </LocalizedText>
              </TouchableOpacity>
            );
          })
        )}

        {/* Nút bấm dò nếu chưa tìm thấy */}
        {!isScanningNetwork && discoveredCameras.length === 0 && (
          <TouchableOpacity
            style={[
              localStyles.scanNetworkButton,
              isDarkMode && { backgroundColor: '#1E293B', borderColor: '#0284C7' },
            ]}
            onPress={handleScanNetwork}
            activeOpacity={0.8}
          >
            <Ionicons name="wifi" size={16} color="#0284C7" style={{ marginRight: 8 }} />
            <LocalizedText style={localStyles.scanNetworkButtonText}>
              Dò tìm camera trong mạng WiFi
            </LocalizedText>
          </TouchableOpacity>
        )}

        {/* Thông báo nếu không thấy */}
        {!isScanningNetwork && scanMessage && discoveredCameras.length === 0 ? (
          <View
            style={[
              localStyles.scanMessageBox,
              isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
            ]}
          >
            <Ionicons
              name="alert-circle"
              size={16}
              color="#F59E0B"
              style={{ marginRight: 6, marginTop: 1 }}
            />
            <LocalizedText style={localStyles.scanMessageText}>
              {scanMessage}
            </LocalizedText>
          </View>
        ) : null}
      </View>

      {/* 3. Tài khoản & Mật khẩu */}
      <View style={localStyles.twoColRow}>
        <View style={localStyles.colField}>
          <LocalizedText
            style={[
              localStyles.fieldLabel,
              isDarkMode && { color: colors.textSecondary || '#94A3B8' },
            ]}
          >
            Tài khoản (tùy chọn):
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
            value={username}
            onChangeText={(txt) => handleCredentialsChange(txt, password)}
            onBlur={() => {
              if (cameraIp && cameraIp !== '192.168.1.100') {
                const newUrl = buildRtspUrl(selectedBrand, cameraIp, username, password);
                verifyCameraConnection(newUrl);
              }
            }}
            placeholder="Vd: admin"
            placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={localStyles.colField}>
          <LocalizedText
            style={[
              localStyles.fieldLabel,
              isDarkMode && { color: colors.textSecondary || '#94A3B8' },
            ]}
          >
            Mật khẩu (tùy chọn):
          </LocalizedText>
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
              onChangeText={(txt) => handleCredentialsChange(username, txt)}
              onBlur={() => {
                if (cameraIp && cameraIp !== '192.168.1.100') {
                  const newUrl = buildRtspUrl(selectedBrand, cameraIp, username, password);
                  verifyCameraConnection(newUrl);
                }
              }}
              placeholder="Mật khẩu camera"
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

      {/* 4. Kết quả kiểm tra kết nối tự động (Không cần nút bấm thủ công) */}
      {(isTesting || testResult.status !== 'none') && (
        <View style={localStyles.fieldGroup}>
          {isTesting ? (
            <View
              style={[
                localStyles.testResultBox,
                { backgroundColor: 'rgba(2, 132, 199, 0.08)', borderColor: '#0284C7' },
              ]}
            >
              <ActivityIndicator size="small" color="#0284C7" />
              <LocalizedText style={[localStyles.testResultText, { color: '#0284C7' }]}>
                Đang tự động kiểm tra kết nối camera...
              </LocalizedText>
            </View>
          ) : (
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
      )}

      {/* 5. Tùy chỉnh nâng cao (IP & RTSP - Ẩn mặc định) */}
      <View
        style={[
          localStyles.advancedContainer,
          isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
        ]}
      >
        <TouchableOpacity
          style={localStyles.advancedHeader}
          onPress={() => setShowAdvanced(!showAdvanced)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="settings-outline"
            size={14}
            color={isDarkMode ? '#94A3B8' : '#64748B'}
            style={{ marginRight: 6 }}
          />
          <LocalizedText
            style={[
              localStyles.advancedHeaderText,
              isDarkMode && { color: colors.textSecondary || '#94A3B8' },
            ]}
          >
            Tùy chỉnh nâng cao (IP & RTSP)
          </LocalizedText>
          <Ionicons
            name={showAdvanced ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={isDarkMode ? '#94A3B8' : '#64748B'}
            style={{ marginLeft: 'auto' }}
          />
        </TouchableOpacity>

        {showAdvanced && (
          <View style={localStyles.advancedBody}>
            <LocalizedText style={[localStyles.fieldLabel, { fontSize: 11 }]}>
              Địa chỉ IP thủ công:
            </LocalizedText>
            <TextInput
              style={[
                localStyles.advancedInput,
                isDarkMode && {
                  backgroundColor: '#0F172A',
                  borderColor: '#334155',
                  color: colors.textPrimary || '#F8FAFC',
                },
              ]}
              value={cameraIp}
              onChangeText={handleManualIpChange}
              placeholder="192.168.10.35"
              placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <LocalizedText style={[localStyles.fieldLabel, { fontSize: 11, marginTop: 10 }]}>
              Đường dẫn RTSP tùy chỉnh:
            </LocalizedText>
            <TextInput
              style={[
                localStyles.advancedInput,
                isDarkMode && {
                  backgroundColor: '#0F172A',
                  borderColor: '#334155',
                  color: colors.textPrimary || '#F8FAFC',
                },
              ]}
              value={streamUrl}
              onChangeText={handleCustomUrlChange}
              placeholder="rtsp://192.168.1.100:554/stream1"
              placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <LocalizedText
              style={[
                localStyles.advancedHint,
                isDarkMode && { color: '#94A3B8' },
              ]}
            >
              Hệ thống tự động nhận diện và ghép URL. Chỉ chỉnh sửa mục này nếu bạn dùng cổng mạng riêng biệt.
            </LocalizedText>
          </View>
        )}
      </View>

      {/* 6. Tên thiết bị & Vị trí phòng */}
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

      {/* 7. Gợi ý cấu hình nhanh theo từng hãng camera */}
      {currentBrandInfo?.note ? (
        <View
          style={[
            localStyles.brandHintBox,
            isDarkMode && {
              backgroundColor: 'rgba(2, 132, 199, 0.1)',
              borderColor: 'rgba(2, 132, 199, 0.3)',
            },
          ]}
        >
          <Ionicons name="information-circle" size={16} color="#0284C7" style={{ marginRight: 6, marginTop: 1 }} />
          <LocalizedText
            style={[
              localStyles.brandHintText,
              isDarkMode && { color: '#38BDF8' },
            ]}
          >
            <LocalizedText style={{ fontWeight: '700' }}>{selectedBrand}: </LocalizedText>
            {currentBrandInfo.note}
          </LocalizedText>
        </View>
      ) : null}

      {/* 8. Hai Nút Hành Động Lớn (ÁP DỤNG CAMERA & LƯU MẶC ĐỊNH) */}
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
                    {item.note}
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
  scannedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    padding: 12,
    marginBottom: 16,
  },
  scannedBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369A1',
  },
  scannedBannerText: {
    fontSize: 12,
    color: '#0284C7',
    marginTop: 2,
  },
  scanBarcodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1.5,
    borderColor: '#0284C7',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  scanBarcodeBtnText: {
    color: '#0284C7',
    fontSize: 14,
    fontWeight: '700',
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  rescanSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  rescanSmallBtnText: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
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
  scanningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 132, 199, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    padding: 12,
  },
  scanningText: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
    flex: 1,
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
  testResultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
  },
  testResultSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10B981',
  },
  testResultError: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#EF4444',
  },
  testResultText: {
    fontSize: 12,
    flex: 1,
    fontWeight: '600',
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
    color: '#F59E0B',
    fontWeight: '500',
  },
  discoveredCard: {
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  discoveredCardActive: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
  },
  discoveredHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  discoveredTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284C7',
  },
  autoFillBadge: {
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  autoFillBadgeActive: {
    backgroundColor: '#0284C7',
  },
  autoFillBadgeText: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '700',
  },
  autoFillBadgeTextActive: {
    color: '#FFFFFF',
  },
  discoveredStatusText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  advancedContainer: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    overflow: 'hidden',
  },
  advancedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  advancedHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  advancedBody: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
  },
  advancedInput: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0F172A',
  },
  advancedHint: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 6,
    lineHeight: 16,
  },
  brandHintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  brandHintText: {
    fontSize: 12,
    color: '#0369A1',
    flex: 1,
    lineHeight: 18,
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

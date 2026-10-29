// AppInfoScreen.tsx
// Màn hình Thông tin ứng dụng & Hướng dẫn sử dụng thiết bị
// Smart Elderly Care AI (SECA)

import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Linking,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { useTheme } from '../../../store/useThemeStore';
import { LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { supportApi } from '../../../services/api';

export default function AppInfoScreen({ navigation }: any) {
  const { isDarkMode } = useTheme();
  const [docData, setDocData] = React.useState<any>(null);

  React.useEffect(() => {
    supportApi
      .getDocumentation()
      .then((res) => {
        if (res?.data) {
          setDocData(res.data);
        }
      })
      .catch((err) => {
        console.warn('[AppInfoScreen] Không thể tải tài liệu hướng dẫn:', err);
      });
  }, []);

  const screenWidth = Dimensions.get('window').width || 450;
  const translateX = useRef(new Animated.Value(screenWidth)).current;

  useEffect(() => {
    translateX.setValue(screenWidth);
    const raf = requestAnimationFrame(() => {
      Animated.timing(translateX, {
        toValue: 0,
        duration: 260,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    });
    return () => cancelAnimationFrame(raf);
  }, [screenWidth, translateX]);

  const handleGoBack = () => {
    Animated.timing(translateX, {
      toValue: screenWidth,
      duration: 200,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      navigation?.goBack?.();
    });
  };

  return (
    <SafeAreaView
      style={[styles.container, isDarkMode && { backgroundColor: '#0B0F19' }]}
      edges={['top']}
    >
      <Animated.View style={{ flex: 1, transform: [{ translateX }] }}>
        <View style={[styles.inner, isDarkMode && { backgroundColor: '#0B0F19' }]}>
        {/* Header hàng trên cùng */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[
              styles.backButton,
              isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
            ]}
            onPress={handleGoBack}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
          >
            <Ionicons
              name="chevron-back-outline"
              size={24}
              color={isDarkMode ? '#F8FAFC' : Colors.textPrimary}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isDarkMode && { color: '#F8FAFC' }]}>
            Thông tin ứng dụng
          </Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.appInfoPanel}>
            {/* Logo */}
            <View
              style={[
                styles.appInfoIcon,
                isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
              ]}
            >
              <Image
                source={require('../../../../assets/logo.png')}
                style={styles.appInfoLogo}
                resizeMode="contain"
              />
            </View>

            {/* Tên dự án */}
            <Text style={[styles.infoDetailHeading, isDarkMode && { color: '#F8FAFC' }]}>
              {docData?.project_name || 'Smart Elderly Care AI'}
            </Text>

            {/* Phiên bản */}
            <Text style={[styles.appInfoVersion, isDarkMode && { color: '#94A3B8' }]}>
              {docData ? `${docData.project_code} • Phiên bản ${docData.version}` : 'C1SE.34 • Phiên bản 1.0.0'}
            </Text>

            {/* Mô tả đồ án */}
            <Text style={[styles.infoDetailText, isDarkMode && { color: '#94A3B8' }]}>
              {docData?.description ||
                'Đồ án tốt nghiệp C1SE.34 xây dựng giải pháp công nghệ toàn diện kết hợp trí tuệ nhân tạo (AI) và Internet vạn vật (IoT) nhằm hỗ trợ gia đình và bác sĩ theo dõi sức khỏe, tự động phát hiện té ngã thời gian thực và phát tín hiệu cấp cứu kịp thời cho người cao tuổi tại nhà.'}
            </Text>

            {/* Khối Tổng đài CSKH 24/7 */}
            <View
              style={[
                styles.docHotlineCard,
                isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
              ]}
            >
              <View style={[styles.docHotlineIconWrap, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="headset" size={24} color="#2563EB" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.docHotlineTitle, isDarkMode && { color: '#F8FAFC' }]}>
                  Tổng đài hỗ trợ kỹ thuật CSKH 24/7
                </Text>
                <Text style={styles.docHotlineSub}>
                  Hỗ trợ kết nối camera, vòng tay, hub AI
                </Text>
                <TouchableOpacity
                  style={styles.docHotlineButton}
                  activeOpacity={0.8}
                  onPress={() => Linking.openURL('tel:0898230852')}
                >
                  <Ionicons name="call" size={15} color="#FFFFFF" />
                  <Text style={styles.docHotlineButtonText}>Gọi ngay: 0898230852</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Danh mục Hướng dẫn sử dụng chi tiết từ Backend */}
            <Text style={[styles.docSectionTitle, isDarkMode && { color: '#F8FAFC' }]}>
              📖 Hướng dẫn sử dụng thiết bị
            </Text>

            {(docData?.user_guides || [
              {
                id: 'smartband',
                title: 'Kết nối Vòng đeo tay thông minh (BLE Band)',
                icon: 'watch-outline',
                badge: 'BLE 5.0',
                description: 'Đo nhịp tim, nồng độ oxy trong máu (SpO2), bước chân và thân nhiệt liên tục theo thời gian thực.',
                steps: [
                  'Bước 1: Bật Bluetooth trên điện thoại di động hoặc đặt vòng tay gần Edge Hub trong phạm vi 5 mét.',
                  'Bước 2: Mở ứng dụng Smart Elderly Care AI, vào mục Thiết bị -> Chọn dấu (+) Thêm thiết bị.',
                  'Bước 3: Chọn danh mục Vòng tay đo sinh hiệu và nhấn Kết nối BLE.',
                ],
              },
              {
                id: 'camera',
                title: 'Cài đặt Camera AI phát hiện té ngã',
                icon: 'videocam-outline',
                badge: 'YOLOv8 AI',
                description: 'Phát hiện sự cố té ngã tức thời bằng mô hình nhận diện tư thế trên Edge Hub AI.',
                steps: [
                  'Bước 1: Lắp camera ở độ cao 2m - 2.5m bao quát phòng khách hoặc phòng ngủ người cao tuổi.',
                  'Bước 2: Kết nối camera vào cùng mạng WiFi / LAN nội bộ với bộ Edge Hub.',
                  'Bước 3: Quét mã QR dán trên thân camera hoặc nhập luồng RTSP vào app.',
                ],
              },
              {
                id: 'hub',
                title: 'Thiết lập bộ Hub AI trung tâm (Edge Hub)',
                icon: 'hardware-chip-outline',
                badge: 'Edge Hub',
                description: 'Xử lý hình ảnh AI cục bộ không gián đoạn mạng, còi báo động tại chỗ và kết nối đám mây an toàn.',
                steps: [
                  'Bước 1: Cắm nguồn Type-C và cắm dây mạng LAN vào cổng Hub AI.',
                  'Bước 2: Mở app, chọn Quét thiết bị và quét mã QR ở mặt đáy Edge Hub để gán vào nhà.',
                ],
              },
            ]).map((guide: any) => (
              <View
                key={guide.id}
                style={[
                  styles.docGuideCard,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
                ]}
              >
                <View style={styles.docGuideHeader}>
                  <View style={styles.docGuideIconBox}>
                    <Ionicons name={guide.icon || 'book-outline'} size={18} color={Colors.primary} />
                  </View>
                  <Text style={[styles.docGuideTitle, isDarkMode && { color: '#F8FAFC' }]}>
                    {guide.title}
                  </Text>
                  <View style={styles.docGuideBadge}>
                    <Text style={styles.docGuideBadgeText}>{guide.badge}</Text>
                  </View>
                </View>
                <Text style={[styles.docGuideDesc, isDarkMode && { color: '#94A3B8' }]}>
                  {guide.description}
                </Text>
                <View style={styles.docGuideStepsWrap}>
                  {guide.steps?.map((step: string, sIdx: number) => (
                    <Text key={sIdx} style={[styles.docGuideStep, isDarkMode && { color: '#CBD5E1' }]}>
                      {step}
                    </Text>
                  ))}
                </View>
              </View>
            ))}

            <Text style={[styles.appInfoCopyright, isDarkMode && { color: '#64748B' }]}>
              © 2026 Smart Elderly Care AI • Đồ án tốt nghiệp C1SE.34
            </Text>
          </View>
        </ScrollView>
      </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  inner: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 24,
  },
  headerRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    minHeight: 40,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 40,
    width: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 32,
  },
  appInfoPanel: {
    alignItems: 'center',
    paddingTop: 10,
  },
  appInfoIcon: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    padding: 8,
  },
  appInfoLogo: {
    width: '100%',
    height: '100%',
  },
  infoDetailHeading: {
    marginBottom: 6,
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  appInfoVersion: {
    marginBottom: 16,
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  infoDetailText: {
    marginBottom: 18,
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
    textAlign: 'left',
  },
  docHotlineCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  docHotlineIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docHotlineTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  docHotlineSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 8,
  },
  docHotlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignSelf: 'flex-start',
    gap: 6,
  },
  docHotlineButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  docSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    width: '100%',
    textAlign: 'left',
    marginBottom: 12,
  },
  docGuideCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  docGuideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  docGuideIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 122, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docGuideTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  docGuideBadge: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  docGuideBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
  },
  docGuideDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 10,
  },
  docGuideStepsWrap: {
    backgroundColor: 'rgba(241, 245, 249, 0.6)',
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  docGuideStep: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  appInfoCopyright: {
    marginTop: 18,
    marginBottom: 24,
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
});


// ==============================================================================
// LoginScreen.tsx – Màn hình Đăng nhập Smart Elderly Care AI
// ------------------------------------------------------------------------------
// Thiết kế đồng bộ hoàn toàn với giao diện Đăng ký (RegisterScreen) & WelcomeScreen
// - Phần trên: Photo collage phong cách Pinterest chất lượng cao (LoginPhotoCollage)
// - Phần dưới: Form đăng nhập trực tiếp (LoginFormSection)
// - Thông báo lỗi inline chuyên nghiệp (noticeBox)
// - Dấu tích (checkbox) Điều khoản & Chính sách đồng bộ từ WelcomeScreen
// ==============================================================================

import React, { useState } from 'react';
import {
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useAuthStore } from '../../../store/useAuthStore';
import { useThemeStore } from '../../../store/useThemeStore';
import { authApi, usersApi } from '../../../services/api';
import { LoginPhotoCollage, LoginFormSection } from '../components/login';
import { LegalTermsModal, LegalModalType } from '../components/LegalTermsModal';
import * as Location from 'expo-location';

const FONT_SCALE_LEVELS = [0.8, 1, 1.2, 1.5, 1.8] as const;

// Chuẩn hóa số điện thoại Việt Nam chuẩn E.164 (+84...)
const normalizePhoneNumber = (rawPhone: string): string => {
  const trimmed = rawPhone.trim();
  if (['admin', 'admin123', 'root'].includes(trimmed.toLowerCase())) {
    return trimmed;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  const national = digits.startsWith('84') ? digits.slice(2) : digits;
  return `+84${national.replace(/^0/, '')}`;
};

// Component màn hình đăng nhập; navigation dùng để chuyển sang các màn hình liên quan.
export default function LoginScreen({ navigation, route }: any) {
  const { login, setViewRole, setTokens, logout } = useAuthStore();
  const { setFontSizeMode, setFontScale } = useThemeStore();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Đồng bộ trạng thái đã tích từ màn hình ngoài (Welcome) hoặc mặc định đã tích khi vào màn hình
  const [isAgreed, setIsAgreed] = useState<boolean>(route?.params?.isAgreed ?? true);
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [legalModalType, setLegalModalType] = useState<LegalModalType>('terms');

  const handleOpenLegal = (type: LegalModalType) => {
    setLegalModalType(type);
    setLegalModalVisible(true);
  };

  // Xử lý đăng nhập kết nối trực tiếp với Database qua Backend FastAPI
  const handleLogin = async () => {
    if (!isAgreed) {
      setErrorMessage('Vui lòng tích chọn đồng ý với Điều khoản dịch vụ & Chính sách quyền riêng tư.');
      return;
    }

    const normalizedAccount = normalizePhoneNumber(phone);
    if (!normalizedAccount || !password.trim()) {
      setErrorMessage('Vui lòng nhập số điện thoại và mật khẩu.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    // Mỗi phiên đăng nhập bắt đầu ở cỡ chữ hệ thống; người dùng có thể bật tùy chỉnh sau.
    setFontSizeMode('system');
    setFontScale(1);
    let tokensApplied = false;

    // Lấy vị trí địa lý của thiết bị khi đăng nhập để lưu vào Quản lý đầu cuối
    let detectedLocation: string | undefined;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      let permStatus = status;
      if (permStatus !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        permStatus = req.status;
      }
      if (permStatus === 'granted') {
        const pos = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((r) => setTimeout(() => r(null), 2500)),
        ]);
        if (pos && pos.coords) {
          const places = await Location.reverseGeocodeAsync({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          if (places && places.length > 0) {
            const p = places[0];
            const parts = [
              p.street || p.name,
              p.district || p.subregion,
              p.city || p.region,
              p.country || 'Việt Nam',
            ].filter(Boolean);
            detectedLocation = parts.join(', ');
          }
        }
      }
    } catch (e) {
      console.warn('[Login] Không thể lấy vị trí thiết bị:', e);
    }

    try {
      // 1. Gửi request OAuth2 Password Grant lên Backend FastAPI (kèm vị trí đăng nhập)
      const { access_token, refresh_token } = (await authApi.login(normalizedAccount, password, detectedLocation)).data;

      // 2. Thiết lập token tạm vào Zustand store
      setTokens(access_token, refresh_token);
      tokensApplied = true;

      // 3. Lấy thông tin tài khoản thực tế từ PostgreSQL Database (/api/v1/users/me)
      const userProfile = (await usersApi.getMe()).data;
      const savedScale = userProfile?.custom_font_scale;
      if (userProfile?.font_size_mode === 'custom') {
        // Clear a previously saved custom mode so each new login starts with system sizing.
        try {
          const savedScaleIndex =
            Number.isInteger(savedScale) && savedScale >= 0 && savedScale < FONT_SCALE_LEVELS.length
              ? savedScale
              : 2;
          await usersApi.updateFontPreferences('system', savedScaleIndex);
        } catch (error) {
          console.warn('[Login] Could not reset font-size mode to system:', error);
        }
      }

      // 4. Lưu thông tin đăng nhập vào Store
      login(
        access_token,
        refresh_token,
        userProfile.full_name,
        userProfile.id,
        userProfile.phone,
        userProfile.role,
        userProfile.household_id,
        userProfile.avatar_url
      );
      setViewRole(userProfile.role === 'doctor' ? 'DOCTOR' : 'CAREGIVER');
    } catch (error: any) {
      if (tokensApplied) logout();
      console.error('[Login] Error:', error);
      const detail = error?.response?.data?.detail || error?.message || 'Thông tin đăng nhập hoặc mật khẩu không đúng.';

      setErrorMessage(
        typeof detail === 'string' ? detail : 'Đăng nhập không thành công. Vui lòng kiểm tra lại.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.safeArea}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* PHẦN 1: DYNAMIC PHOTO COLLAGE */}
          <LoginPhotoCollage
            onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Welcome'))}
          />

          {/* PHẦN 2: LOGO BADGE, TIÊU ĐỀ & FORM ĐĂNG NHẬP TRỰC TIẾP */}
          <LoginFormSection
            phone={phone}
            onChangePhone={(value) => {
              setPhone(value);
              setErrorMessage(null);
            }}
            password={password}
            onChangePassword={(value) => {
              setPassword(value);
              setErrorMessage(null);
            }}
            showPassword={showPassword}
            onToggleShowPassword={() => setShowPassword((prev) => !prev)}
            loading={loading}
            errorMessage={errorMessage}
            isAgreed={isAgreed}
            onToggleAgree={() => setIsAgreed(!isAgreed)}
            onSubmit={handleLogin}
            onForgotPassword={() => navigation.navigate('ForgotPassword')}
            onNavigateRegister={() => navigation.navigate('Register', { isAgreed })}
            onOpenLegal={handleOpenLegal}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal Điều khoản dịch vụ & Chính sách quyền riêng tư */}
      <LegalTermsModal
        visible={legalModalVisible}
        initialType={legalModalType}
        onClose={() => setLegalModalVisible(false)}
        onAgree={() => setIsAgreed(true)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingBottom: 24,
  },
});

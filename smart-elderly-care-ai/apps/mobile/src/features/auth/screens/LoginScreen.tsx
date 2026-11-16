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
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useAuthStore } from '../../../store/useAuthStore';
import { useThemeStore } from '../../../store/useThemeStore';
import api, { authApi, usersApi } from '../../../services/api';
import { LocalizedAlert as Alert } from '../../../i18n/LocalizedComponents';
import { LoginPhotoCollage, LoginFormSection, Login2FAStep } from '../components/login';
import { normalizePhone } from '../utils/phoneValidation';
import { LegalTermsModal, LegalModalType } from '../components/LegalTermsModal';
import * as Location from 'expo-location';

const FONT_SCALE_LEVELS = [0.8, 1, 1.2, 1.5, 1.8] as const;

// Component màn hình đăng nhập; navigation dùng để chuyển sang các màn hình liên quan.
export default function LoginScreen({ navigation, route }: any) {
  const { login, setViewRole, logout } = useAuthStore();
  const { setFontSizeMode, setFontScale } = useThemeStore();

  const [phone, setPhone] = useState(route?.params?.registeredPhone || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    route?.params?.successMessage || null
  );

  // Trạng thái Xác thực 2 bước (2FA)
  const [is2faStep, setIs2faStep] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [otpErrorMessage, setOtpErrorMessage] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(60);

  // Đếm ngược gửi lại mã OTP 2FA
  React.useEffect(() => {
    let timer: any;
    if (is2faStep && resendSeconds > 0) {
      timer = setInterval(() => {
        setResendSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [is2faStep, resendSeconds]);

  // Tiền lấy vị trí địa lý chạy ngầm (hoàn toàn không làm chậm nút Đăng nhập)
  const cachedLocationRef = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const lastPos = await Location.getLastKnownPositionAsync();
          if (lastPos?.coords) {
            const places = await Location.reverseGeocodeAsync({
              latitude: lastPos.coords.latitude,
              longitude: lastPos.coords.longitude,
            });
            if (places && places.length > 0) {
              const p = places[0];
              const parts = [
                p.street || p.name,
                p.district || p.subregion,
                p.city || p.region,
                p.country || 'Việt Nam',
              ].filter(Boolean);
              cachedLocationRef.current = parts.join(', ');
            }
          }
        }
      } catch {}
    })();
  }, []);

  React.useEffect(() => {
    if (route?.params?.registeredPhone) {
      setPhone(route.params.registeredPhone);
    }
    if (route?.params?.successMessage) {
      setSuccessMessage(route.params.successMessage);
    }
  }, [route?.params?.registeredPhone, route?.params?.successMessage]);

  

  // Đồng bộ trạng thái đã tích từ màn hình ngoài (Welcome) hoặc mặc định đã tích khi vào màn hình
  const [isAgreed, setIsAgreed] = useState<boolean>(route?.params?.isAgreed ?? true);
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [legalModalType, setLegalModalType] = useState<LegalModalType>('terms');

  const handleOpenLegal = (type: LegalModalType) => {
    setLegalModalType(type);
    setLegalModalVisible(true);
  };

  const applySuccessfulLogin = (access_token: string, refresh_token: string, userProfile: any) => {
    api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

    login(
      access_token,
      refresh_token,
      userProfile.full_name,
      userProfile.id,
      userProfile.phone,
      userProfile.role,
      userProfile.household_id,
      userProfile.avatar_url,
      userProfile
    );
    setViewRole(userProfile.role === 'doctor' ? 'DOCTOR' : 'CAREGIVER');

    if (userProfile?.font_size_mode === 'custom') {
      const savedScale = userProfile?.custom_font_scale;
      const savedScaleIndex =
        Number.isInteger(savedScale) && savedScale >= 0 && savedScale < FONT_SCALE_LEVELS.length
          ? savedScale
          : 2;
      usersApi.updateFontPreferences('system', savedScaleIndex).catch(() => {});
    }
  };

  // Xử lý xác thực OTP khi tài khoản bật Xác minh 2 bước
  const handleVerify2fa = async () => {
    if (!twoFactorToken || otp.length < 6) return;
    setLoading(true);
    setOtpErrorMessage(null);
    let tokensApplied = false;

    try {
      const normalizedAccount = normalizePhone(phone);
      const res = await authApi.verifyLogin2fa(twoFactorToken, otp, normalizedAccount);
      const { access_token, refresh_token, user: preloadedUser } = res.data;

      let userProfile = preloadedUser;
      if (!userProfile) {
        api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
        userProfile = (await usersApi.getMe()).data;
      }

      tokensApplied = true;
      applySuccessfulLogin(access_token, refresh_token, userProfile);
    } catch (error: any) {
      delete api.defaults.headers.common['Authorization'];
      if (tokensApplied) logout();
      console.error('[Login 2FA] Error:', error);
      const detailMsg = error?.response?.data?.detail;
      const msg = detailMsg || 'Mã xác thực OTP không chính xác hoặc đã hết hạn.';
      setOtpErrorMessage(msg);
      Alert.alert('Xác thực thất bại', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend2fa = async () => {
    if (!twoFactorToken || resendSeconds > 0) return;
    try {
      setLoading(true);
      await authApi.resendLogin2fa(twoFactorToken);
      setResendSeconds(60);
      setOtpErrorMessage(null);
      Alert.alert('Đã gửi lại mã', 'Mã xác thực OTP mới đã được gửi qua SMS.');
    } catch (error: any) {
      const detailMsg = error?.response?.data?.detail;
      Alert.alert('Không thể gửi lại', detailMsg || 'Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackFrom2fa = () => {
    setIs2faStep(false);
    setTwoFactorToken(null);
    setOtp('');
    setOtpErrorMessage(null);
  };

  // Xử lý đăng nhập kết nối trực tiếp với Database qua Backend FastAPI
  const handleLogin = async () => {
    if (!isAgreed) {
      const msg = 'Vui lòng tích chọn đồng ý với Điều khoản dịch vụ & Chính sách quyền riêng tư.';
      setErrorMessage(msg);
      Alert.alert('Thông báo', msg);
      return;
    }

    const normalizedAccount = normalizePhone(phone);
    if (!normalizedAccount || !password.trim()) {
      const msg = 'Vui lòng nhập số điện thoại và mật khẩu.';
      setErrorMessage(msg);
      Alert.alert('Thông báo', msg);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setFontSizeMode('system');
    setFontScale(1);
    let tokensApplied = false;

    try {
      // 1. Gửi request OAuth2 Password Grant lên Backend FastAPI
      const res = await authApi.login(normalizedAccount, password, cachedLocationRef.current);

      // NẾU TÀI KHOẢN BẬT XÁC MINH 2 BƯỚC (2FA QUA SMS OTP)
      if (res.data?.requires_2fa) {
        setTwoFactorToken(res.data.two_factor_token);
        setIs2faStep(true);
        setOtp('');
        setOtpErrorMessage(null);
        setResendSeconds(60);
        return;
      }

      const { access_token, refresh_token, user: preloadedUser } = res.data;

      let userProfile = preloadedUser;
      if (!userProfile) {
        api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
        userProfile = (await usersApi.getMe()).data;
      }

      tokensApplied = true;
      applySuccessfulLogin(access_token, refresh_token, userProfile);
    } catch (error: any) {
      delete api.defaults.headers.common['Authorization'];
      if (tokensApplied) logout();
      console.error('[Login] Error:', error);

      const status = error?.response?.status;
      const detailMsg = error?.response?.data?.detail;
      const isNetworkErr = error?.message?.includes('Network Error') || error?.code === 'ERR_NETWORK' || !error?.response;

      if (isNetworkErr) {
        const msg = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.';
        setErrorMessage(msg);
        Alert.alert('Không thể kết nối', msg);
        return;
      }

      // Xử lý rõ ràng: Số điện thoại chưa được đăng ký (chưa tồn tại)
      if (
        status === 404 ||
        (typeof detailMsg === 'string' &&
          (detailMsg.toLowerCase().includes('chưa tồn tại') ||
            detailMsg.toLowerCase().includes('chưa được đăng ký')))
      ) {
        const notFoundMsg = 'Số điện thoại này chưa được đăng ký tài khoản trong hệ thống. Bạn có muốn đăng ký tài khoản mới không?';
        setErrorMessage('Số điện thoại chưa tồn tại trong hệ thống.');
        Alert.alert(
          'Số điện thoại chưa tồn tại',
          notFoundMsg,
          [
            {
              text: 'Đăng ký ngay',
              onPress: () =>
                navigation.navigate('Register', {
                  phone: phone.trim(),
                }),
            },
            {
              text: 'Thử lại',
              style: 'cancel',
            },
          ]
        );
        return;
      }

      if (status === 403) {
        const msg = detailMsg || 'Tài khoản đã bị tạm khóa do nhập sai mật khẩu quá 5 lần.';
        setErrorMessage(msg);
        Alert.alert('Tài khoản bị khóa', msg);
        return;
      }

      const msg = detailMsg || 'Mật khẩu không chính xác. Vui lòng kiểm tra lại.';
      setErrorMessage(msg);
      Alert.alert('Đăng nhập thất bại', msg);
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
            onBack={() => {
              if (is2faStep) {
                handleBackFrom2fa();
              } else if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('Welcome');
              }
            }}
          />

          {/* PHẦN 2: FORM ĐĂNG NHẬP HOẶC BƯỚC XÁC THỰC 2FA QUA OTP */}
          {is2faStep ? (
            <Login2FAStep
              phone={phone}
              otp={otp}
              setOtp={(val) => {
                setOtp(val);
                setOtpErrorMessage(null);
              }}
              resendSeconds={resendSeconds}
              loading={loading}
              errorMessage={otpErrorMessage}
              onResendOtp={handleResend2fa}
              onSubmit={handleVerify2fa}
              onBack={handleBackFrom2fa}
            />
          ) : (
            <LoginFormSection
              phone={phone}
              onChangePhone={(value) => {
                setPhone(value);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              password={password}
              onChangePassword={(value) => {
                setPassword(value);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              showPassword={showPassword}
              onToggleShowPassword={() => setShowPassword((prev) => !prev)}
              loading={loading}
              errorMessage={errorMessage}
              successMessage={successMessage}
              isAgreed={isAgreed}
              onToggleAgree={() => setIsAgreed(!isAgreed)}
              onSubmit={handleLogin}
              onForgotPassword={() => navigation.navigate('ForgotPassword')}
              onNavigateRegister={() => navigation.navigate('Register', { isAgreed })}
              onOpenLegal={handleOpenLegal}
            />
          )}

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

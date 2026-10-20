// ==============================================================================
// LoginScreen.tsx – Màn hình Đăng nhập Smart Elderly Care AI
// ------------------------------------------------------------------------------
// Thiết kế đồng bộ hoàn toàn với giao diện Đăng ký (RegisterScreen)
// - Phần trên: Photo collage phong cách Pinterest chất lượng cao
// - Phần dưới: Form đăng nhập trực tiếp (Số điện thoại, Mật khẩu, Quên mật khẩu)
// - Thông báo lỗi inline chuyên nghiệp (noticeBox)
// ==============================================================================

import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { useAuthStore } from '../../../store/useAuthStore';
import { useThemeStore } from '../../../store/useThemeStore';
import { authApi, usersApi } from '../../../services/api';
import { LocalizedText, LocalizedTextInput } from '../../../i18n/LocalizedComponents';

const FONT_SCALE_LEVELS = [0.8, 1, 1.2, 1.5, 1.8] as const;

// Lấy kích thước chiều rộng màn hình để tính toán tỉ lệ cho bố cục Collage
const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

// Danh sách hình ảnh collage chất lượng cao 
const COLLAGE_ITEMS = [
  {
    key: 'topLeft',
    uri: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=500&q=80',
    style: { top: -15, left: -20, width: SCREEN_WIDTH * 0.38, height: 220, borderRadius: 24 },
  },
  {
    key: 'topRight',
    uri: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=500&q=80',
    style: { top: -25, right: -25, width: SCREEN_WIDTH * 0.52, height: 145, borderRadius: 24 },
  },
  {
    key: 'center',
    uri: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=600&q=80',
    style: {
      top: 50,
      left: SCREEN_WIDTH * 0.22,
      width: SCREEN_WIDTH * 0.56,
      height: 275,
      borderRadius: 26,
      zIndex: 10,
      borderWidth: 3,
      borderColor: '#FFFFFF',
    },
  },
  {
    key: 'midRight',
    uri: 'https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?auto=format&fit=crop&w=500&q=80',
    style: { top: 130, right: -30, width: SCREEN_WIDTH * 0.35, height: 120, borderRadius: 22, zIndex: 5 },
  },
  {
    key: 'bottomLeft',
    uri: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=500&q=80',
    style: { bottom: -20, left: -15, width: SCREEN_WIDTH * 0.44, height: 170, borderRadius: 24, zIndex: 5 },
  },
  {
    key: 'bottomRight',
    uri: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=500&q=80',
    style: { bottom: -15, right: -20, width: SCREEN_WIDTH * 0.42, height: 155, borderRadius: 24, zIndex: 4 },
  },
] as const;


// Component màn hình đăng nhập; navigation dùng để chuyển sang các màn hình liên quan.
export default function LoginScreen({ navigation }: any) {
  const { login, setViewRole, setTokens, logout } = useAuthStore();
  const { setFontSizeMode, setFontScale } = useThemeStore();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Xử lý đăng nhập kết nối trực tiếp với Database qua Backend FastAPI
  const handleLogin = async () => {
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
    try {
      // 1. Gửi request OAuth2 Password Grant lên Backend FastAPI
      const { access_token, refresh_token } = (await authApi.login(normalizedAccount, password)).data;

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
    // SafeAreaView tránh hiển thị nội dung dưới tai thỏ/status bar.
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
          {/* ================================================================= */}
          {/* PHẦN 1: DYNAMIC PHOTO COLLAGE (ĐỒNG BỘ REGISTER SCREEN)           */}
          {/* ================================================================= */}
          <View style={styles.collageContainer}>
            <TouchableOpacity
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Quay lại"
              onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Welcome'))}
            >
              <Ionicons name="arrow-back" size={20} color="#0F172A" />
              <LocalizedText style={styles.backButtonText}>Quay lại</LocalizedText>
            </TouchableOpacity>

            {COLLAGE_ITEMS.map((item) => (
              <View key={item.key} style={[styles.card, item.style]}>
                <Image source={{ uri: item.uri }} style={styles.cardImage} resizeMode="cover" />
              </View>
            ))}
          </View>

          {/* ================================================================= */}
          {/* PHẦN 2: LOGO BADGE, TIÊU ĐỀ & FORM ĐĂNG NHẬP TRỰC TIẾP            */}
          {/* ================================================================= */}
          <View style={styles.bottomSection}>
            <View style={styles.logoBadgeContainer}>
              <Image
                source={require('../../../../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            <LocalizedText style={styles.heroTitle}>
              {'Chào mừng bạn trở lại\nĐăng nhập ngay'}
            </LocalizedText>

            <LocalizedText style={styles.heroSubtitle}>
              Hệ sinh thái AI bảo vệ sức khỏe & an toàn người cao tuổi 24/7
            </LocalizedText>

            {/* Thông báo lỗi / trạng thái */}
            {errorMessage ? (
              <View style={styles.noticeBox} accessibilityRole="alert">
                <Ionicons name="alert-circle-outline" size={18} color="#B42318" />
                <LocalizedText style={styles.noticeText}>{errorMessage}</LocalizedText>
              </View>
            ) : null}

            {/* Card các ô nhập liệu */}
            <View style={styles.formCard}>
              {/* Input 1: Số điện thoại */}
              <View style={styles.inputWrap}>
                <View style={styles.inputPrefix}>
                  <Ionicons name="call-outline" size={18} color="#64748B" />
                  <LocalizedText style={styles.prefixText}>+84</LocalizedText>
                </View>
                <LocalizedTextInput
                  style={styles.textInput}
                  placeholder="Nhập số điện thoại"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={(value) => {
                    setPhone(value);
                    setErrorMessage(null);
                  }}
                  autoCapitalize="none"
                />
              </View>

              {/* Input 2: Mật khẩu */}
              <View style={styles.inputWrap}>
                <View style={styles.inputPrefix}>
                  <Ionicons name="lock-closed-outline" size={18} color="#64748B" />
                </View>
                <LocalizedTextInput
                  style={styles.textInput}
                  placeholder="Mật khẩu"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    setErrorMessage(null);
                  }}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword((prev) => !prev)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>

              {/* Liên kết Quên mật khẩu */}
              <TouchableOpacity
                style={styles.forgotBtn}
                onPress={() => navigation.navigate('ForgotPassword')}
              >
                <LocalizedText style={styles.forgotText}>Quên mật khẩu?</LocalizedText>
              </TouchableOpacity>
            </View>

            {/* Nút hành động Đăng nhập chính */}
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={[styles.btnLogin, loading && styles.btnDisabled]}
                activeOpacity={0.88}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <LocalizedText style={styles.btnLoginText}>Đăng nhập</LocalizedText>
                )}
              </TouchableOpacity>
            </View>

            {/* Hàng chuyển sang Đăng ký */}
            <View style={styles.switchAuthRow}>
              <LocalizedText style={styles.switchAuthText}>Chưa có tài khoản? </LocalizedText>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <LocalizedText style={styles.switchAuthLink}>Đăng ký ngay</LocalizedText>
              </TouchableOpacity>
            </View>

            {/* Điều khoản pháp lý ở chân trang */}
            <LocalizedText style={styles.termsNoticeText}>
              Bằng cách tiếp tục, bạn đồng ý với{' '}
              <LocalizedText style={styles.termsLink}>Điều khoản dịch vụ</LocalizedText>{' '}
              của SECA và xác nhận rằng bạn đã đọc{' '}
              <LocalizedText style={styles.termsLink}>Chính sách quyền riêng tư</LocalizedText>{' '}
              của chúng tôi.
            </LocalizedText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Các kiểu dáng dùng chung cho các thành phần giao diện ở trên.
const styles = StyleSheet.create({
  // Vùng an toàn hiển thị toàn màn hình
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  // Nội dung cuộn chiếm chiều cao có thể, dàn khoảng trống và chừa lề dưới.
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingBottom: 24,
  },

  // -------------------------------------------------------------------------
  // PHOTO COLLAGE STYLES (ĐỒNG BỘ REGISTER)
  // -------------------------------------------------------------------------
  collageContainer: {
    width: '100%',
    height: 380,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
  },
  backButton: {
    position: 'absolute',
    top: 14,
    left: 16,
    zIndex: 20,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  backButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },

  // -------------------------------------------------------------------------
  // FORM & BOTTOM SECTION STYLES
  // -------------------------------------------------------------------------
  bottomSection: {
    paddingHorizontal: 28,
    paddingTop: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  logoBadgeContainer: {
    marginBottom: 14,
  },
  logoImage: {
    width: 96,
    height: 64,
  },
  heroTitle: {
    fontSize: 27,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 35,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  // Mô tả phụ bên dưới tiêu đề.
  heroSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  noticeBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 16,
    gap: 8,
    backgroundColor: '#FEF3F2',
    borderWidth: 1,
    borderColor: '#FECDCA',
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#B42318',
    fontWeight: '600',
  },
  formCard: {
    width: '100%',
  },
  // Khung nhập liệu chung, gồm biểu tượng và nội dung trên một hàng.
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 14,
  },
  // Nhóm tiền tố/biểu tượng nằm bên trái ô nhập.
  inputPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    gap: 4,
  },
  // Kiểu chữ cho mã quốc gia +84.
  prefixText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  // Ô nhập chiếm phần chiều rộng còn lại trong khung.
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    borderWidth: 0,
    outlineWidth: 0,
  },
  // Kích thước vùng bấm biểu tượng hiện/ẩn mật khẩu.
  eyeBtn: {
    padding: 6,
  },
  // Đặt liên kết quên mật khẩu về phía phải.
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 14,
    marginTop: -4,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  actionButtonsContainer: {
    width: '100%',
    gap: 12,
    marginTop: 4,
    marginBottom: 18,
  },
  btnLogin: {
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnLoginText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  switchAuthRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  // Chữ mô tả trước liên kết đăng ký.
  switchAuthText: {
    fontSize: 14,
    color: '#64748B',
  },
  // Liên kết đăng ký dùng màu nhận diện và chữ đậm.
  switchAuthLink: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  termsNoticeText: {
    fontSize: 11,
    color: '#334155',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 6,
  },
  termsLink: {
    fontWeight: '700',
    color: '#0F172A',
    textDecorationLine: 'underline',
  },
});
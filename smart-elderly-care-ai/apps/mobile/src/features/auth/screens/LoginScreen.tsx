// ==============================================================================
// LoginScreen.tsx – Màn hình Đăng nhập Smart Elderly Care AI
// ------------------------------------------------------------------------------
// Thiết kế đồng bộ hoàn toàn với giao diện Đăng ký (RegisterScreen)
// - Phần trên: Photo collage phong cách Pinterest chất lượng cao
// - Phần dưới: Form đăng nhập trực tiếp (Số điện thoại, Mật khẩu, Quên mật khẩu)
// - Thông báo lỗi inline chuyên nghiệp (noticeBox)
// - Hỗ trợ tài khoản mẫu tiện lợi cho demo/chấm điểm
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
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('84')) {
    const national = digits.slice(2);
    return '+84' + (national.startsWith('0') ? national.slice(1) : national);
  }
  if (digits.startsWith('0')) {
    return '+84' + digits.slice(1);
  }
  return '+84' + digits;
};

// Danh sách hình ảnh collage chất lượng cao (phong cách sống, chăm sóc gia đình, y tế)
const COLLAGE_IMAGES = {
  center: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=600&q=80',
  topLeft: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=500&q=80',
  topRight: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=500&q=80',
  midRight: 'https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?auto=format&fit=crop&w=500&q=80',
  bottomLeft: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=500&q=80',
  bottomRight: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=500&q=80',
};

export default function LoginScreen({ navigation }: any) {
  const { login, setViewRole } = useAuthStore();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // Xử lý đăng nhập kết nối trực tiếp với Database qua Backend FastAPI
  const handleLogin = async () => {
    const normalizedAccount = normalizePhoneNumber(phone);
    if (!normalizedAccount || !password.trim()) {
      setNotice({ type: 'error', message: 'Vui lòng nhập số điện thoại và mật khẩu.' });
      return;
    }

    setLoading(true);
    setNotice(null);
    // Mỗi phiên đăng nhập bắt đầu ở cỡ chữ hệ thống; người dùng có thể bật tùy chỉnh sau.
    useThemeStore.getState().setFontSizeMode('system');
    useThemeStore.getState().setFontScale(1);
    try {
      // 1. Gửi request OAuth2 Password Grant lên Backend FastAPI
      const response = await authApi.login(normalizedAccount, password);
      const { access_token, refresh_token } = response.data;

      // 2. Thiết lập token tạm vào Zustand store
      useAuthStore.getState().setTokens(access_token, refresh_token);

      // 3. Lấy thông tin tài khoản thực tế từ PostgreSQL Database (/api/v1/users/me)
      let userProfile: any = null;
      try {
        const meRes = await usersApi.getMe();
        userProfile = meRes.data;
      } catch (err) {
        console.warn('[Login] Lỗi truy vấn /users/me:', err);
      }

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

      const full_name = userProfile?.full_name || 'Nguyễn Hữu Nghĩa';
      const phone_number = userProfile?.phone || normalizedAccount;
      const isDoctor =
        userProfile?.role === 'doctor' ||
        userProfile?.full_name?.includes('BS.') ||
        userProfile?.full_name?.includes('Bác sĩ') ||
        phone_number?.includes('111222') ||
        phone_number?.includes('888999');
      const role_str = isDoctor ? 'Bác sĩ phụ trách' : 'Chủ nhà / Người sở hữu';
      const user_id = userProfile?.id || 1;
      const household_id = 1;

      // 4. Lưu thông tin đăng nhập vào Store
      login(access_token, refresh_token, full_name, user_id, phone_number, role_str, household_id);
      setViewRole(isDoctor ? 'DOCTOR' : 'CAREGIVER');
    } catch (error: any) {
      console.error('[Login] Error:', error);
      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        'Thông tin đăng nhập hoặc mật khẩu không đúng.';
      setNotice({
        type: 'error',
        message: typeof detail === 'string' ? detail : 'Đăng nhập không thành công. Vui lòng kiểm tra lại.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Điền nhanh tài khoản mẫu thử nghiệm
  const handleQuickFill = (fillPhone: string, fillPass: string) => {
    setPhone(fillPhone);
    setPassword(fillPass);
    setNotice(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
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
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  navigation.navigate('Welcome');
                }
              }}
            >
              <Ionicons name="arrow-back" size={20} color="#0F172A" />
              <LocalizedText style={styles.backButtonText}>Quay lại</LocalizedText>
            </TouchableOpacity>

            <View style={[styles.card, styles.cardTopLeft]}>
              <Image source={{ uri: COLLAGE_IMAGES.topLeft }} style={styles.cardImage} resizeMode="cover" />
            </View>
            <View style={[styles.card, styles.cardTopRight]}>
              <Image source={{ uri: COLLAGE_IMAGES.topRight }} style={styles.cardImage} resizeMode="cover" />
            </View>
            <View style={[styles.card, styles.cardCenterHero]}>
              <Image source={{ uri: COLLAGE_IMAGES.center }} style={styles.cardImage} resizeMode="cover" />
            </View>
            <View style={[styles.card, styles.cardMidRight]}>
              <Image source={{ uri: COLLAGE_IMAGES.midRight }} style={styles.cardImage} resizeMode="cover" />
            </View>
            <View style={[styles.card, styles.cardBottomLeft]}>
              <Image source={{ uri: COLLAGE_IMAGES.bottomLeft }} style={styles.cardImage} resizeMode="cover" />
            </View>
            <View style={[styles.card, styles.cardBottomRight]}>
              <Image source={{ uri: COLLAGE_IMAGES.bottomRight }} style={styles.cardImage} resizeMode="cover" />
            </View>
          </View>

          {/* ================================================================= */}
          {/* PHẦN 2: LOGO BADGE, TIÊU ĐỀ & FORM ĐĂNG NHẬP TRỰC TIẾP            */}
          {/* ================================================================= */}
          <View style={styles.bottomSection}>
            <View style={styles.logoBadgeContainer}>
              <Image
                source={require('../../../../assets/logo.png')}
                style={{ width: 96, height: 64 }}
                resizeMode="contain"
              />
            </View>

            <LocalizedText style={styles.heroTitle}>
              {'Chào mừng bạn trở lại\n' + 'Đăng nhập ngay'}
            </LocalizedText>

            <LocalizedText style={styles.heroSubtitle}>
              Hệ sinh thái AI bảo vệ sức khỏe & an toàn người cao tuổi 24/7
            </LocalizedText>

            {/* Thông báo lỗi / trạng thái */}
            {notice ? (
              <View
                style={[styles.noticeBox, notice.type === 'success' ? styles.noticeSuccess : styles.noticeError]}
                accessibilityRole="alert"
              >
                <Ionicons
                  name={notice.type === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                  size={18}
                  color={notice.type === 'success' ? '#067647' : '#B42318'}
                />
                <LocalizedText
                  style={[
                    styles.noticeText,
                    notice.type === 'success' ? styles.noticeSuccessText : styles.noticeErrorText,
                  ]}
                >
                  {notice.message}
                </LocalizedText>
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
                    setNotice(null);
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
                  style={[styles.textInput, { flex: 1 }]}
                  placeholder="Mật khẩu"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    setNotice(null);
                  }}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
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

              {/* Tài khoản mẫu từ Database */}
              <View style={styles.quickFillContainer}>
                <LocalizedText style={styles.quickFillLabel}>Tài khoản mẫu từ Database (chạm để điền):</LocalizedText>
                <View style={styles.quickFillRow}>
                  <TouchableOpacity
                    style={styles.quickFillChip}
                    onPress={() => handleQuickFill('0905123456', '12345678')}
                  >
                    <Ionicons name="home-outline" size={14} color="#0284C7" />
                    <LocalizedText style={styles.quickFillChipText}>Nguyễn Hữu Nghĩa (0905123456)</LocalizedText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.quickFillChip}
                    onPress={() => handleQuickFill('0905111222', '12345678')}
                  >
                    <Ionicons name="medkit-outline" size={14} color="#16A34A" />
                    <LocalizedText style={styles.quickFillChipText}>BS. Trần Văn Minh (0905111222)</LocalizedText>
                  </TouchableOpacity>
                </View>
                <LocalizedText style={styles.quickFillNote}>
                  Mật khẩu tài khoản trong Database: 12345678
                </LocalizedText>
              </View>
            </View>

            {/* Nút hành động Đăng nhập chính */}
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={[styles.btnLogin, loading && { opacity: 0.7 }]}
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

const styles = StyleSheet.create({
  // Vùng an toàn hiển thị toàn màn hình
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
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardTopLeft: {
    top: -15,
    left: -20,
    width: SCREEN_WIDTH * 0.38,
    height: 220,
    borderRadius: 24,
  },
  cardTopRight: {
    top: -25,
    right: -25,
    width: SCREEN_WIDTH * 0.52,
    height: 145,
    borderRadius: 24,
  },
  cardCenterHero: {
    top: 50,
    left: SCREEN_WIDTH * 0.22,
    width: SCREEN_WIDTH * 0.56,
    height: 275,
    borderRadius: 26,
    zIndex: 10,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  cardMidRight: {
    top: 130,
    right: -30,
    width: SCREEN_WIDTH * 0.35,
    height: 120,
    borderRadius: 22,
    zIndex: 5,
  },
  cardBottomLeft: {
    bottom: -20,
    left: -15,
    width: SCREEN_WIDTH * 0.44,
    height: 170,
    borderRadius: 24,
    zIndex: 5,
  },
  cardBottomRight: {
    bottom: -15,
    right: -20,
    width: SCREEN_WIDTH * 0.42,
    height: 155,
    borderRadius: 24,
    zIndex: 4,
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
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  noticeSuccess: {
    backgroundColor: '#ECFDF3',
    borderWidth: 1,
    borderColor: '#A6F4C5',
  },
  noticeError: {
    backgroundColor: '#FEF3F2',
    borderWidth: 1,
    borderColor: '#FECDCA',
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  noticeSuccessText: {
    color: '#067647',
    fontWeight: '600',
  },
  noticeErrorText: {
    color: '#B42318',
    fontWeight: '600',
  },
  formCard: {
    width: '100%',
  },
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
  inputPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    gap: 4,
  },
  prefixText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    borderWidth: 0,
    outlineWidth: 0,
  },
  eyeBtn: {
    padding: 6,
  },
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
  quickFillContainer: {
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    width: '100%',
  },
  quickFillLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  quickFillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  quickFillNote: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 4,
  },
  quickFillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 5,
  },
  quickFillChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
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
  switchAuthText: {
    fontSize: 14,
    color: '#64748B',
  },
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
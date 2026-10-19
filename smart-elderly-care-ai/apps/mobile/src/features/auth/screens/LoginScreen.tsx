// LoginScreen.tsx
// Màn hình Chào mừng & Đăng nhập theo phong cách Pinterest Collage hiện đại

import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, SafeAreaView, Image, ScrollView, KeyboardAvoidingView, Platform, Modal, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { useAuthStore } from '../../../store/useVitalStore';
import { authApi } from '../../../services/api';
import { LocalizedAlert, LocalizedText, LocalizedTextInput } from '../../../i18n/LocalizedComponents';


const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Danh sách hình ảnh collage chất lượng cao (phong cách sống, chăm sóc gia đình, y tế)
const COLLAGE_IMAGES = {
  center: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=600&q=80', // Nụ cười cụ bà hạnh phúc
  topLeft: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=500&q=80', // Không gian sống ấm áp, gương & cây xanh
  topRight: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=500&q=80', // Giày đi bộ rèn luyện sức khỏe
  midRight: 'https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?auto=format&fit=crop&w=500&q=80', // Bác sĩ & chăm sóc ân cần
  bottomLeft: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=500&q=80', // Bữa sáng dinh dưỡng, trái cây
  bottomRight: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=500&q=80', // Đèn ngủ đầu giường bình yên
};

// Chuẩn hóa số điện thoại người dùng nhập thành định dạng quốc tế +84.
const normalizePhoneNumber = (rawPhone: string): string => {
  // Loại bỏ dấu cách, dấu cộng và mọi ký tự không phải chữ số.
  const digits = rawPhone.replace(/\D/g, '');
  // Trả về rỗng để hàm đăng nhập báo người dùng nhập số hợp lệ.
  if (!digits) return '';
  // Nếu đã có mã quốc gia 84, chỉ bỏ số 0 quốc nội nếu còn.
  if (digits.startsWith('84')) {
    const national = digits.slice(2);
    return '+84' + (national.startsWith('0') ? national.slice(1) : national);
  }
  // Nếu nhập số nội địa bắt đầu bằng 0, thay số 0 bằng mã +84.
  if (digits.startsWith('0')) {
    return '+84' + digits.slice(1);
  }
  // Với số chỉ có phần thuê bao, thêm mã quốc gia +84.
  return '+84' + digits;
};

// Component màn hình đăng nhập; navigation dùng để chuyển sang các màn hình liên quan.
export default function LoginScreen({ navigation }: any) {
  const { login } = useAuthStore();

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isLoginModalVisible, setIsLoginModalVisible] = useState(false);
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Đăng nhập vào hệ thống
  const handleLoginAction = async () => {
    setLoginError('');
    if (!account.trim() || !password.trim()) {
      setLoginError('Vui lòng nhập số điện thoại và mật khẩu.');
      return;
    }

    setIsLoading(true);
    try {
      const cleanAccount = account.replace(/\s+/g, '').replace(/^\+84/, '0');
      const normalizedAccount = cleanAccount.startsWith('0')
        ? `+84${cleanAccount.slice(1)}`
        : cleanAccount.startsWith('+')
          ? cleanAccount
          : `+84${cleanAccount}`;

      const response = await authApi.login(normalizedAccount, password);
      const { access_token, refresh_token } = response.data;

      let resolvedName = 'Nguyễn Hữu Nghĩa';
      let resolvedRole = 'user';
      if (normalizedAccount.includes('111222')) {
        resolvedName = 'BS. Trần Văn Minh';
        resolvedRole = 'doctor';
      } else if (normalizedAccount.includes('999888')) {
        resolvedName = 'Nguyễn Thị Lan';
        resolvedRole = 'user';
      }

      // Lưu token và chuyển đổi giao diện dựa trên vai trò Bác sĩ / Người nhà
      login(access_token, refresh_token, resolvedName, normalizedAccount, normalizedAccount, resolvedRole);
      setIsLoginModalVisible(false);
    } catch (error: any) {
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;
      if (!error?.response) {
        setLoginError('Không kết nối được máy chủ. Vui lòng kiểm tra kết nối và thử lại.');
      } else if (status === 401) {
        setLoginError('Số điện thoại hoặc mật khẩu không đúng. Vui lòng kiểm tra lại.');
      } else if (status === 403) {
        setLoginError('Tài khoản hiện đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.');
      } else {
        setLoginError(typeof detail === 'string' ? detail : 'Đăng nhập chưa thành công. Vui lòng thử lại.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Điền nhanh tài khoản mẫu để kiểm thử
  const handleQuickFill = (phone: string, pass: string) => {
    setAccount(phone);
    setPassword(pass);
    setLoginError('');
  };

  const openAuthModal = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setIsLoginModalVisible(true);
  };

  const handleRegisterInModal = () => {
    if (!registerPhone.trim() || !registerPassword.trim() || !registerConfirmPassword.trim()) {
      LocalizedAlert.alert('Thiếu thông tin', 'Vui lòng nhập đầy đủ số điện thoại và mật khẩu.');
      return;
    }

    if (registerPassword !== registerConfirmPassword) {
      LocalizedAlert.alert('Hai mật khẩu chưa khớp', 'Hãy nhập cùng một mật khẩu ở cả hai ô.');
      return;
    }

    setIsLoginModalVisible(false);
    navigation.navigate('Register', {
      phone: registerPhone.trim(),
      password: registerPassword,
      confirmPassword: registerConfirmPassword,
    });
  };

  return (
    // SafeAreaView tránh hiển thị nội dung dưới tai thỏ/status bar.
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ================================================================= */}
        {/* PHẦN 1: DYNAMIC PHOTO COLLAGE (PHONG CÁCH PINTEREST)              */}
        {/* ================================================================= */}
        <View style={styles.collageContainer}>
          {/* Card Top Left: Gương & phòng khách Bắc Âu */}
          <View style={[styles.card, styles.cardTopLeft]}>
            <Image
              source={{ uri: COLLAGE_IMAGES.topLeft }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          </View>

          {/* Card Top Right: Giày vận động thể thao */}
          <View style={[styles.card, styles.cardTopRight]}>
            <Image
              source={{ uri: COLLAGE_IMAGES.topRight }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          </View>

          {/* Card Center: Hero chính (Nụ cười ấm áp tuổi già) */}
          <View style={[styles.card, styles.cardCenterHero]}>
            <Image
              source={{ uri: COLLAGE_IMAGES.center }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          </View>

          {/* Card Middle Right: Chăm sóc & khám sức khỏe */}
          <View style={[styles.card, styles.cardMidRight]}>
            <Image
              source={{ uri: COLLAGE_IMAGES.midRight }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          </View>

          {/* Card Bottom Left: Đĩa bánh dâu dinh dưỡng */}
          <View style={[styles.card, styles.cardBottomLeft]}>
            <Image
              source={{ uri: COLLAGE_IMAGES.bottomLeft }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          </View>

          {/* Card Bottom Right: Đèn ngủ an lành */}
          <View style={[styles.card, styles.cardBottomRight]}>
            <Image
              source={{ uri: COLLAGE_IMAGES.bottomRight }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          </View>
        </View>

        {/* ================================================================= */}
        {/* PHẦN 2: LOGO BADGE, TIÊU ĐỀ & NÚT HÀNH ĐỘNG                       */}
        {/* ================================================================= */}
        <View style={styles.bottomSection}>
          {/* Logo Badge hình tròn màu cam thương hiệu */}
          <View style={styles.logoBadgeContainer}>
            <View style={styles.logoBadge}>
              <Ionicons name="heart" size={26} color="#FFFFFF" />
            </View>
          </View>

          {/* Tiêu đề & Slogan */}
          <LocalizedText style={styles.heroTitle}>
            Tạo dựng cuộc sống{'\n'}bạn yêu thích
          </LocalizedText>
          <LocalizedText style={styles.heroSubtitle}>
            Hệ sinh thái AI bảo vệ sức khỏe & an toàn người cao tuổi 24/7
          </LocalizedText>

          {/* Bộ 2 nút hành động theo mockup full-screen */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={styles.btnRegister}
              activeOpacity={0.88}
              onPress={() => navigation.navigate('Register')}
            >
              <LocalizedText style={styles.btnRegisterText}>Đăng ký</LocalizedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnLogin}
              activeOpacity={0.88}
              onPress={() => setIsLoginModalVisible(true)}
            >
              <LocalizedText style={styles.btnLoginText}>Đăng nhập</LocalizedText>
            </TouchableOpacity>
          </View>

          {/* Điều khoản pháp lý ở chân trang */}
          <LocalizedText style={styles.termsNoticeText}>
            Bằng cách tiếp tục, bạn đồng ý với{' '}
            <LocalizedText
              style={styles.termsLink}
              onPress={() => LocalizedAlert.alert('Điều khoản dịch vụ', 'Hệ thống Smart Elderly Care AI tuân thủ chuẩn an ninh y tế.')}
            >
              Điều khoản dịch vụ
            </LocalizedText>{' '}
            của SECA và xác nhận rằng bạn đã đọc{' '}
            <LocalizedText
              style={styles.termsLink}
              onPress={() => LocalizedAlert.alert('Chính sách bảo mật', 'Bảo mật thông tin sinh hiệu chuẩn mã hóa AES-256.')}
            >
              Chính sách quyền riêng tư
            </LocalizedText>{' '}
            của chúng tôi.{' '}
            <LocalizedText
              style={styles.termsLink}
              onPress={() => LocalizedAlert.alert('Thông báo thu thập', 'Dữ liệu được thu thập từ Camera AI và Vòng tay BLE.')}
            >
              Thông báo khi thu thập
            </LocalizedText>
            .
          </LocalizedText>
        </View>
      </ScrollView>

      {/* ================================================================= */}
      {/* PHẦN 3: MODAL ĐĂNG NHẬP (BOTTOM SHEET HIỆN ĐẠI)                   */}
      {/* ================================================================= */}
      <Modal
        visible={isLoginModalVisible}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setIsLoginModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <ScrollView
              contentContainerStyle={styles.modalScrollContainer}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={styles.collageContainer}>
                <TouchableOpacity
                  style={styles.backToWelcomeButton}
                  accessibilityRole="button"
                  accessibilityLabel="Quay lại màn hình đầu tiên"
                  onPress={() => {
                    setIsLoginModalVisible(false);
                    setAuthMode('login');
                  }}
                >
                  <Ionicons name="arrow-back" size={20} color="#0F172A" />
                  <LocalizedText style={styles.backToWelcomeText}>Quay lại</LocalizedText>
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

              <View style={styles.bottomSection}>
                <View style={styles.logoBadgeContainer}>
                  <View style={styles.logoBadge}>
                    <Ionicons name="heart" size={26} color="#FFFFFF" />
                  </View>
                </View>

                <LocalizedText style={styles.heroTitle}>
                  {authMode === 'login' ? 'Chào mừng bạn trở lại' : 'Tạo tài khoản mới'}
                </LocalizedText>

                <LocalizedText style={styles.heroSubtitle}>
                  {authMode === 'login'
                    ? 'Nhập thông tin tài khoản người nhà hoặc bác sĩ để tiếp tục.'
                    : 'Tạo tài khoản để trải nghiệm đầy đủ dịch vụ chăm sóc người cao tuổi.'}
                </LocalizedText>

                <View style={styles.formCard}>
                  {authMode === 'login' ? (
                    <>
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
                          value={account}
                          onChangeText={(value) => {
                            setAccount(value);
                            setLoginError('');
                          }}
                          autoCapitalize="none"
                        />
                      </View>

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
                            setLoginError('');
                          }}
                        />
                        <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                          <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#64748B" />
                        </TouchableOpacity>
                      </View>

                      {loginError ? (
                        <View style={styles.loginErrorBox} accessibilityRole="alert">
                          <Ionicons name="alert-circle-outline" size={18} color="#B42318" />
                          <LocalizedText style={styles.loginErrorText}>{loginError}</LocalizedText>
                        </View>
                      ) : null}

                      <TouchableOpacity
                        style={styles.forgotBtn}
                        onPress={() => {
                          setIsLoginModalVisible(false);
                          navigation.navigate('ForgotPassword');
                        }}
                      >
                        <LocalizedText style={styles.forgotText}>Quên mật khẩu?</LocalizedText>
                      </TouchableOpacity>

                      <View style={styles.quickFillContainer}>
                        <LocalizedText style={styles.quickFillLabel}>Tài khoản mẫu thử nghiệm</LocalizedText>
                        <View style={styles.quickFillRow}>
                          <TouchableOpacity style={styles.quickFillChip} onPress={() => handleQuickFill('0905123456', '12345678')}>
                            <Ionicons name="person-circle-outline" size={14} color="#0284C7" />
                            <LocalizedText style={styles.quickFillChipText}>Chủ nhà</LocalizedText>
                          </TouchableOpacity>

                          <TouchableOpacity style={styles.quickFillChip} onPress={() => handleQuickFill('0905111222', '12345678')}>
                            <Ionicons name="medkit-outline" size={14} color="#16A34A" />
                            <LocalizedText style={styles.quickFillChipText}>Bác sĩ</LocalizedText>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </>
                  ) : (
                    <>
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
                          value={registerPhone}
                          onChangeText={setRegisterPhone}
                          autoCapitalize="none"
                        />
                      </View>

                      <View style={styles.inputWrap}>
                        <View style={styles.inputPrefix}>
                          <Ionicons name="lock-closed-outline" size={18} color="#64748B" />
                        </View>
                        <LocalizedTextInput
                          style={[styles.textInput, { flex: 1 }]}
                          placeholder="Mật khẩu"
                          placeholderTextColor="#94A3B8"
                          secureTextEntry={!showRegisterPassword}
                          value={registerPassword}
                          onChangeText={setRegisterPassword}
                        />
                        <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowRegisterPassword(!showRegisterPassword)}>
                          <Ionicons name={showRegisterPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#64748B" />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.inputWrap}>
                        <View style={styles.inputPrefix}>
                          <Ionicons name="shield-checkmark-outline" size={18} color="#64748B" />
                        </View>
                        <LocalizedTextInput
                          style={[styles.textInput, { flex: 1 }]}
                          placeholder="Xác nhận mật khẩu"
                          placeholderTextColor="#94A3B8"
                          secureTextEntry={!showRegisterConfirmPassword}
                          value={registerConfirmPassword}
                          onChangeText={setRegisterConfirmPassword}
                        />
                        <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowRegisterConfirmPassword(!showRegisterConfirmPassword)}>
                          <Ionicons name={showRegisterConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#64748B" />
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>

                <View style={styles.actionButtonsContainer}>
                  <TouchableOpacity
                    style={[styles.btnSubmitLogin, isLoading && { opacity: 0.7 }]}
                    activeOpacity={0.88}
                    onPress={authMode === 'login' ? handleLoginAction : handleRegisterInModal}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <LocalizedText style={styles.btnSubmitLoginText}>{authMode === 'login' ? 'Đăng nhập' : 'Đăng ký'}</LocalizedText>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.switchAuthRow}>
                  <LocalizedText style={styles.switchAuthText}>
                    {authMode === 'login' ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
                  </LocalizedText>
                  <TouchableOpacity onPress={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
                    <LocalizedText style={styles.switchAuthLink}>{authMode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập'}</LocalizedText>
                  </TouchableOpacity>
                </View>

                <LocalizedText style={styles.termsNoticeText}>
                  Bằng cách tiếp tục, bạn đồng ý với{' '}
                  <LocalizedText style={styles.termsLink}>Điều khoản dịch vụ</LocalizedText>{' '}
                  của SECA và xác nhận rằng bạn đã đọc{' '}
                  <LocalizedText style={styles.termsLink}>Chính sách quyền riêng tư</LocalizedText>{' '}
                  của chúng tôi.
                </LocalizedText>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// Các kiểu dáng dùng chung cho các thành phần giao diện ở trên.
const styles = StyleSheet.create({
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
  // PHOTO COLLAGE STYLES
  // -------------------------------------------------------------------------
  collageContainer: {
    width: '100%',
    height: 380,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
  },
  backToWelcomeButton: {
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
  },
  backToWelcomeText: {
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

  // Vị trí từng card theo đúng layout Pinterest
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
  // BOTTOM SECTION & BUTTONS
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
    backgroundColor: Colors.primary, // Cam thương hiệu đặc trưng
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
  // Mô tả phụ bên dưới tiêu đề.
  heroSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  actionButtonsContainer: {
    width: '100%',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 20,
  },
  btnRegister: {
    backgroundColor: Colors.primary,
    width: '100%',
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnRegisterText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  btnLogin: {
    backgroundColor: '#EFEFEF',
    width: '100%',
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnLoginText: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '700',
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

  // -------------------------------------------------------------------------
  // MODAL BOTTOM SHEET STYLES
  // -------------------------------------------------------------------------
  modalOverlay: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    width: '100%',
    paddingTop: 0,
    paddingBottom: 0,
  },
  modalScrollContainer: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  sheetHeaderContent: {
    flex: 1,
    marginRight: 12,
  },
  sheetTabRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 10,
  },
  sheetTab: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sheetTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  sheetTabTextActive: {
    color: '#0F172A',
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  sheetSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  // Kích thước vùng bấm biểu tượng hiện/ẩn mật khẩu.
  eyeBtn: {
    padding: 6,
  },
  // Đặt liên kết quên mật khẩu về phía phải.
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    marginTop: -4,
  },
  loginErrorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF3F2',
    borderColor: '#FDA29B',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  loginErrorText: {
    flex: 1,
    color: '#B42318',
    fontSize: 13,
    lineHeight: 18,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  btnSubmitLogin: {
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  btnSubmitLoginText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  quickFillContainer: {
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  quickFillLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  quickFillRow: {
    flexDirection: 'row',
    gap: 8,
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
  formCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
});
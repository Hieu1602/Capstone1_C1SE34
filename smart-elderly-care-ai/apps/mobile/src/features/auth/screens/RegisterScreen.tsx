import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, SafeAreaView, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { authApi } from '../../../services/api';
import { LocalizedAlert, LocalizedText, LocalizedTextInput } from '../../../i18n/LocalizedComponents';


const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLLAGE_IMAGES = {
  center: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=600&q=80',
  topLeft: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=500&q=80',
  topRight: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=500&q=80',
  midRight: 'https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?auto=format&fit=crop&w=500&q=80',
  bottomLeft: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=500&q=80',
  bottomRight: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=500&q=80',
};

export default function RegisterScreen({ navigation, route }: any) {
  const initialValues = route?.params;
  const [phone, setPhone] = useState(initialValues?.phone || '');
  const [password, setPassword] = useState(initialValues?.password || '');
  const [confirmPassword, setConfirmPassword] = useState(initialValues?.confirmPassword || '');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [notice, setNotice] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  useEffect(() => {
    if (resendSeconds <= 0) {
      return undefined;
    }

    const timer = setInterval(() => {
      setResendSeconds((seconds) => Math.max(seconds - 1, 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendSeconds]);

  const startResendCountdown = () => setResendSeconds(60);

  const handleRegister = async () => {
    const normalizedPhone = phone.trim().replace(/\s+/g, '');

    if (!normalizedPhone || !password || !confirmPassword) {
      setNotice({ type: 'error', message: 'Vui lòng nhập số điện thoại, mật khẩu và xác nhận mật khẩu.' });
      return;
    }

    if (!/^\+?[0-9]{9,15}$/.test(normalizedPhone)) {
      setNotice({ type: 'error', message: 'Số điện thoại không hợp lệ. Vui lòng kiểm tra lại.' });
      return;
    }
    if (password.length < 8 || password.length > 128) {
      setNotice({ type: 'error', message: 'Mật khẩu cần có từ 8 đến 128 ký tự.' });
      return;
    }
    if (password !== confirmPassword) {
      setNotice({ type: 'error', message: 'Hai mật khẩu không khớp. Vui lòng nhập lại.' });
      return;
    }

    setLoading(true);
    try {
      await authApi.requestOtp(normalizedPhone);
      setStep('verify');
      startResendCountdown();
      setNotice({
        type: 'success',
        message: 'Yêu cầu xác minh đã được tạo. Nếu đang dùng OTP thử nghiệm, xem mã trong terminal backend.',
      });
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      setNotice({
        type: 'error',
        message: typeof detail === 'string' ? detail : 'Không thể gửi yêu cầu xác minh. Vui lòng thử lại.',
      });
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (resendSeconds > 0) {
      return;
    }

    const normalizedPhone = phone.trim().replace(/\s+/g, '');
    if (!normalizedPhone) {
      setNotice({ type: 'error', message: 'Vui lòng nhập số điện thoại trước.' });
      return;
    }

    setLoading(true);
    try {
      await authApi.requestOtp(normalizedPhone);
      startResendCountdown();
      setNotice({
        type: 'success',
        message: 'Đã tạo yêu cầu gửi lại mã. Nếu dùng OTP thử nghiệm, xem terminal backend.',
      });
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      setNotice({
        type: 'error',
        message: typeof detail === 'string' ? detail : 'Không thể gửi lại mã xác minh. Vui lòng thử lại.',
      });
    } finally {
      setLoading(false);
    }
  };

  const completeRegistration = async () => {
    const normalizedPhone = phone.trim().replace(/\s+/g, '');

    if (otp.length !== 6) {
      setNotice({ type: 'error', message: 'Mã xác minh cần đủ 6 chữ số.' });
      return;
    }

    setLoading(true);
    try {
      await authApi.register({
        phone: normalizedPhone,
        full_name: 'User',
        password,
        role: 'user',
        otp_code: otp,
      });

      setNotice(null);
      setRegistrationComplete(true);
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      setNotice({
        type: 'error',
        message: typeof detail === 'string' ? detail : 'Không thể tạo tài khoản. Vui lòng thử lại.',
      });
    } finally {
      setLoading(false);
    }
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
        >
          <View style={styles.collageContainer}>
            <TouchableOpacity
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel={registrationComplete ? 'Đi tới đăng nhập' : step === 'verify' ? 'Quay lại form đăng ký' : 'Quay lại màn hình đầu tiên'}
              onPress={() => {
                if (registrationComplete) {
                  navigation.navigate('Login');
                  return;
                }
                if (step === 'verify') {
                  setStep('form');
                  return;
                }
                navigation.goBack();
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

          <View style={styles.bottomSection}>
            <View style={styles.logoBadgeContainer}>
              <View style={styles.logoBadge}>
                <Ionicons name="heart" size={26} color="#FFFFFF" />
              </View>
            </View>

            <LocalizedText style={styles.heroTitle}>
              {registrationComplete
                ? 'Tạo tài khoản thành công'
                : step === 'form'
                  ? 'Tạo dựng cuộc sống\n' + 'bạn yêu thích'
                  : 'Xác minh tài khoản'}
            </LocalizedText>

            <LocalizedText style={styles.heroSubtitle}>
              {registrationComplete
                ? 'OTP chính xác và tài khoản đã được lưu. Bạn có thể đăng nhập ngay.'
                : step === 'form'
                  ? 'Hệ sinh thái AI bảo vệ sức khỏe & an toàn người cao tuổi 24/7'
                  : 'Nhập mã xác minh 6 chữ số đã được gửi đến số điện thoại của bạn'}
            </LocalizedText>

            {notice && !registrationComplete ? (
              <View
                style={[styles.noticeBox, notice.type === 'success' ? styles.noticeSuccess : styles.noticeError]}
                accessibilityRole="alert"
              >
                <Ionicons
                  name={notice.type === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                  size={18}
                  color={notice.type === 'success' ? '#067647' : '#B42318'}
                />
                <LocalizedText style={[styles.noticeText, notice.type === 'success' ? styles.noticeSuccessText : styles.noticeErrorText]}>
                  {notice.message}
                </LocalizedText>
              </View>
            ) : null}

            {registrationComplete ? (
              <View style={styles.registrationSuccessCard}>
                <Ionicons name="checkmark-circle" size={30} color="#067647" />
                <LocalizedText style={styles.registrationSuccessText}>
                  Xác nhận OTP thành công. Tài khoản đã được tạo.
                </LocalizedText>
              </View>
            ) : (
              <View style={styles.formCard}>
              {step === 'form' ? (
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
                      value={phone}
                      onChangeText={(value) => {
                        setPhone(value);
                        setNotice(null);
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
                        setNotice(null);
                      }}
                    />
                    <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                      <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#64748B" />
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
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPassword}
                      onChangeText={(value) => {
                        setConfirmPassword(value);
                        setNotice(null);
                      }}
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      <Ionicons
                        name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.otpRow}>
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <LocalizedTextInput
                        key={index}
                        style={[styles.otpInput, otp.length === index && styles.otpInputActive]}
                        value={otp[index] || ''}
                        onChangeText={(value) => {
                          setNotice(null);
                          const nextValue = `${otp.slice(0, index)}${value.replace(/[^0-9]/g, '').slice(-1)}${otp.slice(index + 1)}`.slice(0, 6);
                          setOtp(nextValue);
                        }}
                        keyboardType="number-pad"
                        maxLength={1}
                        textAlign="center"
                      />
                    ))}
                  </View>

                  <TouchableOpacity
                    style={styles.resendButton}
                    onPress={resendOtp}
                    disabled={resendSeconds > 0 || loading}
                  >
                    <LocalizedText style={[styles.resendText, resendSeconds > 0 && styles.resendDisabled]}>
                      {resendSeconds > 0 ? `Gửi lại mã sau ${resendSeconds}s` : 'Gửi lại mã'}
                    </LocalizedText>
                  </TouchableOpacity>
                </>
              )}
              </View>
            )}

            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={styles.btnRegister}
                activeOpacity={0.88}
                onPress={() => {
                  if (registrationComplete) {
                    navigation.navigate('Login');
                    return;
                  }
                  if (step === 'form') {
                    void handleRegister();
                    return;
                  }
                  void completeRegistration();
                }}
                disabled={loading}
              >
                <LocalizedText style={styles.btnRegisterText}>
                  {loading ? 'Đang xử lý...' : registrationComplete ? 'Đăng nhập ngay' : step === 'form' ? 'Đăng ký' : 'Xác nhận'}
                </LocalizedText>
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
      </KeyboardAvoidingView>
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
    marginBottom: 18,
    paddingHorizontal: 12,
  },
  noticeBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
  },
  noticeSuccess: {
    backgroundColor: '#ECFDF3',
    borderColor: '#ABEFC6',
  },
  noticeError: {
    backgroundColor: '#FEF3F2',
    borderColor: '#FDA29B',
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  noticeSuccessText: {
    color: '#067647',
  },
  noticeErrorText: {
    color: '#B42318',
  },
  registrationSuccessCard: {
    width: '100%',
    minHeight: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
    marginBottom: 18,
    backgroundColor: '#ECFDF3',
    borderWidth: 1,
    borderColor: '#ABEFC6',
    borderRadius: 18,
  },
  registrationSuccessText: {
    flex: 1,
    color: '#067647',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
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
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 12,
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
  },
  eyeBtn: {
    padding: 6,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  otpInput: {
    width: 42,
    height: 50,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
  },
  otpInputActive: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  resendButton: {
    alignItems: 'center',
    marginTop: 14,
  },
  resendText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  resendDisabled: {
    color: '#94A3B8',
  },
  actionButtonsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  btnRegister: {
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  btnRegisterText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  btnLogin: {
    backgroundColor: '#EFEFEF',
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
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
});


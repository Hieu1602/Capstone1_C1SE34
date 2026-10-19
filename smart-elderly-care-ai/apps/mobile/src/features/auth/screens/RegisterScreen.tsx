// ============================================================================
// MÀN HÌNH ĐĂNG KÝ TÀI KHOẢN (REGISTER SCREEN)
// Hệ thống: Smart Elderly Care AI (SECA)
// Quy trình:
//   - Bước 1 (form): Người dùng nhập Họ tên, Số điện thoại (+84), Mật khẩu và Xác nhận mật khẩu.
//     Hệ thống gửi mã OTP xác thực qua SMS bằng authApi.requestOtp và chuyển sang màn hình OTP.
//   - Bước 2 (verify): Người dùng nhập mã OTP 6 chữ số kèm bộ đếm ngược 60 giây gửi lại mã.
//     Hệ thống gọi authApi.verifyOtp và authApi.register để kích hoạt tài khoản.
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  TextInput as RNTextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { authApi } from '../../../services/api';
import {
  LocalizedAlert as Alert,
  LocalizedText as Text,
  LocalizedTextInput as TextInput,
} from '../../../i18n/LocalizedComponents';

type FeedbackNotice = {
  type: 'error' | 'info' | 'success';
  message: string;
};

// Chuẩn hóa số điện thoại Việt Nam về định dạng quốc tế E.164 (+84...)
const formatVietnamPhone = (rawPhone: string): string => {
  const cleaned = rawPhone.trim().replace(/[\s().-]/g, '');
  if (!cleaned) return '';

  if (cleaned.startsWith('+84')) {
    const rest = cleaned.slice(3).replace(/^0+/, '');
    return `+84${rest}`;
  }
  if (cleaned.startsWith('84') && cleaned.length >= 11) {
    const rest = cleaned.slice(2).replace(/^0+/, '');
    return `+84${rest}`;
  }
  if (cleaned.startsWith('0')) {
    return `+84${cleaned.slice(1)}`;
  }
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  return `+84${cleaned}`;
};

export default function RegisterScreen({ navigation }: any) {
  // Trạng thái các trường thông tin đăng ký
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Trạng thái hiển thị mật khẩu
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Trạng thái bước thực hiện: 'form' (nhập thông tin) hoặc 'verify' (màn hình nhập mã OTP đăng ký)
  const [step, setStep] = useState<'form' | 'verify'>('form');

  // Trạng thái mã xác minh OTP 6 số
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackNotice | null>(null);

  // Refs cho 6 ô nhập OTP để tự động chuyển ô khi nhập
  const otpInputRefs = useRef<Array<RNTextInput | null>>([]);

  // Bộ đếm thời gian cho tính năng gửi lại mã OTP (tính bằng giây)
  const [resendSeconds, setResendSeconds] = useState(0);

  // Hiệu ứng đếm ngược thời gian gửi lại mã OTP mỗi 1 giây
  useEffect(() => {
    if (resendSeconds <= 0) {
      return undefined;
    }

    const timer = setInterval(() => {
      setResendSeconds((seconds) => Math.max(seconds - 1, 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendSeconds]);

  // Tự động focus vào ô OTP đầu tiên khi chuyển sang màn hình xác minh OTP
  useEffect(() => {
    if (step === 'verify') {
      const focusTimer = setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 150);
      return () => clearTimeout(focusTimer);
    }
    return undefined;
  }, [step]);

  // Bắt đầu đếm ngược 60 giây cho lượt gửi lại mã tiếp theo
  const startResendCountdown = () => setResendSeconds(60);

  const getApiErrorMessage = (error: any, fallback: string): string => {
    const detail = error?.response?.data?.detail;
    if (Array.isArray(detail)) {
      return detail.map((item: { msg?: string }) => item?.msg).filter(Boolean).join('\n') || fallback;
    }
    return typeof detail === 'string' && detail.trim() ? detail : fallback;
  };

  /**
   * Bước 1: Kiểm tra tính hợp lệ biểu mẫu & Yêu cầu gửi mã OTP để chuyển sang màn hình OTP
   */
  const handleRegister = async () => {
    setFeedback(null);
    const formattedPhone = formatVietnamPhone(phone);

    // Kiểm tra các trường bắt buộc
    if (!phone.trim() || !password || !confirmPassword) {
      const msg = 'Vui lòng điền đầy đủ số điện thoại và mật khẩu.';
      setFeedback({ type: 'error', message: msg });
      Alert.alert('Thiếu thông tin', msg);
      return;
    }

    // Kiểm tra định dạng số điện thoại
    if (!/^\+[0-9]{9,15}$/.test(formattedPhone)) {
      const msg = 'Số điện thoại không hợp lệ. Vui lòng kiểm tra lại.';
      setFeedback({ type: 'error', message: msg });
      Alert.alert('Lỗi', msg);
      return;
    }

    // Kiểm tra mật khẩu tối thiểu 6 ký tự
    if (password.length < 6) {
      const msg = 'Mật khẩu cần có ít nhất 6 ký tự để đảm bảo an toàn.';
      setFeedback({ type: 'error', message: msg });
      Alert.alert('Mật khẩu quá ngắn', msg);
      return;
    }

    // Kiểm tra khớp mật khẩu xác nhận
    if (password !== confirmPassword) {
      const msg = 'Mật khẩu và xác nhận mật khẩu không trùng khớp.';
      setFeedback({ type: 'error', message: msg });
      Alert.alert('Mật khẩu không khớp', msg);
      return;
    }

    setLoading(true);
    try {
      // Gửi yêu cầu OTP đến máy chủ SMS backend
      await authApi.requestOtp(formattedPhone);
      setOtp('');
      setStep('verify');
      startResendCountdown();
      setFeedback({
        type: 'info',
        message: `Mã xác minh gồm 6 chữ số đã được gửi tới số ${formattedPhone}.`,
      });
    } catch (error: any) {
      const errMsg = getApiErrorMessage(error, 'Không thể kết nối đến máy chủ SMS.');
      setFeedback({ type: 'error', message: errMsg });
      Alert.alert('Không gửi được mã', errMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Yêu cầu gửi lại mã xác minh OTP nếu người dùng chưa nhận được
   */
  const resendOtp = async () => {
    if (resendSeconds > 0 || loading) {
      return;
    }

    const formattedPhone = formatVietnamPhone(phone);
    if (!formattedPhone) {
      setStep('form');
      return;
    }

    setLoading(true);
    setFeedback(null);
    try {
      await authApi.requestOtp(formattedPhone);
      setOtp('');
      startResendCountdown();
      setFeedback({
        type: 'info',
        message: `Đã gửi lại mã xác minh mới tới số ${formattedPhone}.`,
      });
      otpInputRefs.current[0]?.focus();
    } catch (error: any) {
      const errMsg = getApiErrorMessage(error, 'Không thể gửi lại mã xác minh.');
      setFeedback({ type: 'error', message: errMsg });
      Alert.alert('Không gửi được mã', errMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Xử lý nhập từng ký tự hoặc dán mã OTP 6 chữ số
   */
  const handleOtpChange = (index: number, rawValue: string) => {
    const digitsOnly = rawValue.replace(/[^0-9]/g, '');

    // Trường hợp người dùng dán (paste) nhiều số cùng lúc
    if (digitsOnly.length > 1) {
      const pasted = digitsOnly.slice(0, 6);
      setOtp(pasted);
      const nextFocusIndex = Math.min(pasted.length, 5);
      otpInputRefs.current[nextFocusIndex]?.focus();
      return;
    }

    const chars = otp.split('');
    while (chars.length < 6) {
      chars.push('');
    }
    chars[index] = digitsOnly;
    const nextOtp = chars.join('').slice(0, 6);
    setOtp(nextOtp);

    // Tự động chuyển sang ô tiếp theo nếu vừa nhập 1 chữ số
    if (digitsOnly && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  /**
   * Xử lý phím Backspace để lùi về ô trước đó
   */
  const handleOtpKeyPress = (index: number, key: string) => {
    if (key === 'Backspace') {
      if (!otp[index] && index > 0) {
        const chars = otp.split('');
        chars[index - 1] = '';
        setOtp(chars.join(''));
        otpInputRefs.current[index - 1]?.focus();
      }
    }
  };

  /**
   * Bước 2: Xác minh OTP & Đăng ký tài khoản người dùng chính thức
   */
  const completeRegistration = async () => {
    setFeedback(null);
    const cleanOtp = otp.replace(/[^0-9]/g, '');

    // Kiểm tra độ dài mã OTP 6 chữ số
    if (cleanOtp.length !== 6) {
      const msg = 'Vui lòng nhập đủ 6 chữ số mã xác thực OTP.';
      setFeedback({ type: 'error', message: msg });
      Alert.alert('Mã xác minh không hợp lệ', msg);
      return;
    }

    const formattedPhone = formatVietnamPhone(phone);

    setLoading(true);
    try {
      // 1. Xác thực mã OTP với Backend
      await authApi.verifyOtp(formattedPhone, cleanOtp);

      // 2. Tạo tài khoản người dùng mới trên hệ thống (truyền kèm otp_code)
      await authApi.register({
        phone: formattedPhone,
        full_name: fullName.trim() || 'Người dùng',
        password,
        role: 'user',
        otp_code: cleanOtp,
      });

      setFeedback({
        type: 'success',
        message: 'Đăng ký tài khoản thành công! Đang chuyển hướng sang màn hình Đăng nhập...',
      });

      if (Platform.OS === 'web') {
        setTimeout(() => {
          navigation.navigate('Login');
        }, 900);
      } else {
        Alert.alert(
          'Đăng ký thành công',
          'Tài khoản của bạn đã được khởi tạo thành công. Vui lòng đăng nhập.',
          [{ text: 'Đăng nhập', onPress: () => navigation.navigate('Login') }]
        );
      }
    } catch (error: any) {
      const errMsg = getApiErrorMessage(
        error,
        'Mã xác minh không đúng hoặc không thể tạo tài khoản. Vui lòng thử lại.'
      );
      setFeedback({ type: 'error', message: errMsg });
      Alert.alert('Đăng ký thất bại', errMsg);
    } finally {
      setLoading(false);
    }
  };

  const formattedDisplayPhone = formatVietnamPhone(phone) || phone;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View>
            {/* Header & Tiêu đề màn hình */}
            <View style={styles.headerSection}>
              <TouchableOpacity
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel={step === 'verify' ? 'Quay lại form đăng ký' : 'Quay lại'}
                onPress={() => {
                  setFeedback(null);
                  if (step === 'verify') {
                    setStep('form');
                    return;
                  }
                  if (navigation.canGoBack()) {
                    navigation.goBack();
                  } else {
                    navigation.navigate('Welcome');
                  }
                }}
              >
                <Ionicons name="arrow-back" size={24} color={Colors.textPrimary || '#0F172A'} />
              </TouchableOpacity>

              <Text style={styles.welcomeTitle}>
                {step === 'form' ? 'Đăng ký tài khoản' : 'Xác minh mã OTP'}
              </Text>
              <Text style={styles.subtitle}>
                {step === 'form'
                  ? 'Đăng ký tài khoản để kết nối và quản lý an toàn cho người thân. Chúng tôi sẽ gửi tin nhắn kèm mã xác minh đến số điện thoại này.'
                  : `Vui lòng nhập mã OTP gồm 6 chữ số vừa được gửi tới số điện thoại ${formattedDisplayPhone}.`}
              </Text>
            </View>

            {/* Thông báo trạng thái / lỗi trực tiếp trên màn hình */}
            {feedback && (
              <View
                style={[
                  styles.feedbackBanner,
                  feedback.type === 'error'
                    ? styles.feedbackError
                    : feedback.type === 'success'
                      ? styles.feedbackSuccess
                      : styles.feedbackInfo,
                ]}
              >
                <Ionicons
                  name={
                    feedback.type === 'error'
                      ? 'alert-circle'
                      : feedback.type === 'success'
                        ? 'checkmark-circle'
                        : 'information-circle'
                  }
                  size={20}
                  color={
                    feedback.type === 'error'
                      ? '#DC2626'
                      : feedback.type === 'success'
                        ? '#16A34A'
                        : '#2563EB'
                  }
                />
                <Text
                  style={[
                    styles.feedbackText,
                    feedback.type === 'error'
                      ? { color: '#991B1B' }
                      : feedback.type === 'success'
                        ? { color: '#166534' }
                        : { color: '#1E40AF' },
                  ]}
                >
                  {feedback.message}
                </Text>
              </View>
            )}

            {/* Biểu mẫu nhập liệu */}
            <View style={styles.formContainer}>
              {step === 'form' ? (
                <>
                  {/* Lựa chọn quốc gia / Mã vùng */}
                  <TouchableOpacity
                    style={styles.countryPickerBtn}
                    activeOpacity={0.7}
                    onPress={() => Alert.alert('Khu vực', 'Đã chọn mặc định: Việt Nam (+84)')}
                  >
                    <View style={styles.countryInfoRow}>
                      <Ionicons
                        name="location-outline"
                        size={20}
                        color={Colors.textPrimary || '#0F172A'}
                        style={styles.countryIcon}
                      />
                      <Text style={styles.countryText}>Việt Nam</Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={Colors.textSecondary || '#64748B'}
                    />
                  </TouchableOpacity>

                  {/* Trường 1: Họ và tên người dùng */}
                  <View style={styles.inputContainer}>
                    <Ionicons name="person-outline" size={20} color="#64748B" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Họ và tên của bạn"
                      placeholderTextColor="#94A3B8"
                      value={fullName}
                      onChangeText={setFullName}
                      autoCapitalize="words"
                    />
                  </View>

                  {/* Trường 2: Số điện thoại kèm tiền tố +84 */}
                  <View style={styles.inputContainer}>
                    <Ionicons
                      name="phone-portrait-outline"
                      size={20}
                      color="#64748B"
                      style={styles.inputIcon}
                    />
                    <Text style={styles.prefixText}>+84 </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Số điện thoại của bạn"
                      placeholderTextColor="#94A3B8"
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      autoCapitalize="none"
                    />
                  </View>

                  {/* Trường 3: Mật khẩu */}
                  <View style={styles.inputContainer}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color="#64748B"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Mật khẩu (tối thiểu 6 ký tự)"
                      placeholderTextColor="#94A3B8"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      <Ionicons
                        name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Trường 4: Xác nhận mật khẩu */}
                  <View style={styles.inputContainer}>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={20}
                      color="#64748B"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Xác nhận lại mật khẩu"
                      placeholderTextColor="#94A3B8"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                      <Ionicons
                        name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                /* Bước 2: Màn hình nhập mã xác minh OTP 6 số */
                <View style={styles.otpSection}>
                  {/* Thông tin số điện thoại nhận OTP & nút đổi số */}
                  <View style={styles.phoneSummaryCard}>
                    <View style={styles.countryInfoRow}>
                      <Ionicons
                        name="chatbubble-ellipses-outline"
                        size={20}
                        color={Colors.primary}
                        style={styles.countryIcon}
                      />
                      <View>
                        <Text style={styles.phoneSummaryLabel}>Số điện thoại nhận mã</Text>
                        <Text style={styles.phoneSummaryValue}>{formattedDisplayPhone}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setFeedback(null);
                        setStep('form');
                      }}
                    >
                      <Text style={styles.changePhoneText}>Đổi số</Text>
                    </TouchableOpacity>
                  </View>

                  {/* 6 ô nhập mã OTP */}
                  <View style={styles.otpRow}>
                    {[0, 1, 2, 3, 4, 5].map((index) => {
                      const digit = otp[index] || '';
                      const isFocusedOrNext =
                        otp.length === index || (otp.length === 6 && index === 5);
                      return (
                        <RNTextInput
                          key={index}
                          ref={(el) => {
                            otpInputRefs.current[index] = el;
                          }}
                          style={[
                            styles.otpInput,
                            digit ? styles.otpInputFilled : null,
                            isFocusedOrNext ? styles.otpInputActive : null,
                          ]}
                          value={digit}
                          onChangeText={(value) => handleOtpChange(index, value)}
                          onKeyPress={({ nativeEvent }) =>
                            handleOtpKeyPress(index, nativeEvent.key)
                          }
                          keyboardType="number-pad"
                          maxLength={6}
                          textAlign="center"
                          selectTextOnFocus
                        />
                      );
                    })}
                  </View>

                  {/* Nút gửi lại mã xác minh kèm đếm ngược */}
                  <View style={styles.resendRow}>
                    <Text style={styles.resendPrompt}>Bạn chưa nhận được mã? </Text>
                    <TouchableOpacity
                      onPress={resendOtp}
                      disabled={resendSeconds > 0 || loading}
                    >
                      <Text
                        style={[
                          styles.resendText,
                          resendSeconds > 0 && styles.resendDisabled,
                        ]}
                      >
                        {resendSeconds > 0
                          ? `Gửi lại sau ${resendSeconds}s`
                          : 'Gửi lại mã OTP'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Nút hành động chính & Điều hướng */}
          <View>
            <TouchableOpacity
              style={[styles.loginButton, loading && { opacity: 0.7 }]}
              onPress={step === 'form' ? handleRegister : completeRegistration}
              disabled={loading}
              activeOpacity={0.88}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.loginButtonText}>
                  {step === 'form' ? 'Tiếp tục' : 'Xác nhận đăng ký'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.loginLink}
              onPress={() => {
                setFeedback(null);
                if (step === 'verify') {
                  setStep('form');
                } else {
                  navigation.navigate('Login');
                }
              }}
            >
              <Text style={styles.loginText}>
                {step === 'verify' ? (
                  'Quay lại chỉnh sửa thông tin'
                ) : (
                  <>
                    Tôi đã có tài khoản.{' '}
                    <Text style={styles.link}>Đăng nhập</Text>
                  </>
                )}
              </Text>
            </TouchableOpacity>
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
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 24,
  },
  headerSection: {
    marginBottom: 16,
  },
  backButton: {
    height: 38,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  welcomeTitle: {
    color: '#0F172A',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  feedbackError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  feedbackInfo: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  feedbackSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  feedbackText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  formContainer: {
    gap: 12,
    marginBottom: 20,
  },
  countryPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    marginBottom: 4,
  },
  countryInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countryIcon: {
    marginRight: 10,
  },
  countryText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#0F172A',
  },
  inputContainer: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  inputIcon: {
    marginRight: 10,
  },
  prefixText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginRight: 4,
  },
  input: {
    flex: 1,
    color: '#0F172A',
    fontSize: 16,
    padding: 0,
    borderWidth: 0,
    outlineWidth: 0,
  },
  otpSection: {
    marginTop: 4,
    gap: 20,
  },
  phoneSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
  },
  phoneSummaryLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  phoneSummaryValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  changePhoneText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  otpInput: {
    flex: 1,
    maxWidth: 50,
    height: 56,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    textAlign: 'center',
    outlineWidth: 0,
  },
  otpInputFilled: {
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
  },
  otpInputActive: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  resendPrompt: {
    color: '#64748B',
    fontSize: 14,
  },
  resendText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  resendDisabled: {
    color: '#94A3B8',
  },
  loginButton: {
    backgroundColor: Colors.primary,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  loginLink: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 14,
    width: '100%',
  },
  loginText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
  },
  link: {
    color: Colors.primary,
    fontWeight: '600',
  },
});

// ============================================================================
// MÀN HÌNH ĐĂNG KÝ TÀI KHOẢN (REGISTER SCREEN)
// Hệ thống: Smart Elderly Care AI (SECA)
// Quy trình:
//   - Bước 1 (form): Người dùng nhập Họ tên, Số điện thoại (+84), Mật khẩu và Xác nhận mật khẩu.
//     Hệ thống gửi mã OTP xác thực qua SMS bằng authApi.requestOtp.
//   - Bước 2 (verify): Người dùng nhập mã OTP 6 chữ số kèm bộ đếm ngược 60 giây gửi lại mã.
//     Hệ thống gọi authApi.verifyOtp và authApi.register để kích hoạt tài khoản.
// ============================================================================

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { authApi } from '../../../services/api';

export default function RegisterScreen({ navigation }: any) {
  // Trạng thái các trường thông tin đăng ký
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Trạng thái hiển thị mật khẩu
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Trạng thái bước thực hiện: 'form' (nhập thông tin) hoặc 'verify' (nhập mã OTP)
  const [step, setStep] = useState<'form' | 'verify'>('form');

  // Trạng thái mã xác minh OTP 6 số
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

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

  // Bắt đầu đếm ngược 60 giây cho lượt gửi lại mã tiếp theo
  const startResendCountdown = () => setResendSeconds(60);

  /**
   * Bước 1: Kiểm tra tính hợp lệ biểu mẫu & Yêu cầu gửi mã OTP qua SMS
   */
  const handleRegister = async () => {
    const normalizedPhone = phone.trim().replace(/\s+/g, '');

    // Kiểm tra các trường bắt buộc
    if (!normalizedPhone || !password || !confirmPassword) {
      Alert.alert('Thiếu thông tin', 'Vui lòng điền đầy đủ số điện thoại và mật khẩu.');
      return;
    }

    // Kiểm tra định dạng số điện thoại (từ 9 đến 15 ký tự số)
    if (!/^\+?[0-9]{9,15}$/.test(normalizedPhone)) {
      Alert.alert('Lỗi', 'Số điện thoại không hợp lệ. Vui lòng kiểm tra lại.');
      return;
    }

    // Kiểm tra mật khẩu tối thiểu 6 ký tự
    if (password.length < 6) {
      Alert.alert('Mật khẩu quá ngắn', 'Mật khẩu cần có ít nhất 6 ký tự để đảm bảo an toàn.');
      return;
    }

    // Kiểm tra khớp mật khẩu xác nhận
    if (password !== confirmPassword) {
      Alert.alert('Mật khẩu không khớp', 'Mật khẩu và xác nhận mật khẩu không trùng khớp.');
      return;
    }

    // Chuẩn hóa định dạng số điện thoại chuẩn quốc tế (+84...)
    const formattedPhone = normalizedPhone.startsWith('0')
      ? `+84${normalizedPhone.slice(1)}`
      : normalizedPhone.startsWith('+')
        ? normalizedPhone
        : `+84${normalizedPhone}`;

    setLoading(true);
    try {
      // Gửi yêu cầu OTP đến máy chủ SMS backend
      await authApi.requestOtp(formattedPhone);
      setStep('verify');
      startResendCountdown();
      Alert.alert('Đã gửi mã', `Mã xác minh đã được gửi tới số điện thoại ${formattedPhone}.`);
    } catch (error: any) {
      Alert.alert('Không gửi được mã', error.response?.data?.detail || 'Không thể kết nối đến máy chủ SMS.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Yêu cầu gửi lại mã xác minh OTP nếu người dùng chưa nhận được
   */
  const resendOtp = async () => {
    if (resendSeconds > 0) {
      return;
    }

    const normalizedPhone = phone.trim().replace(/\s+/g, '');
    if (!normalizedPhone) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập số điện thoại trước.');
      return;
    }

    const formattedPhone = normalizedPhone.startsWith('0')
      ? `+84${normalizedPhone.slice(1)}`
      : normalizedPhone.startsWith('+')
        ? normalizedPhone
        : `+84${normalizedPhone}`;

    setLoading(true);
    try {
      await authApi.requestOtp(formattedPhone);
      startResendCountdown();
      Alert.alert('Đã gửi lại mã', 'Mã xác minh mới đã được gửi. Vui lòng kiểm tra tin nhắn SMS.');
    } catch (error: any) {
      Alert.alert('Không gửi được mã', error.response?.data?.detail || 'Không thể kết nối đến máy chủ SMS.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Bước 2: Xác minh OTP & Đăng ký tài khoản người dùng chính thức
   */
  const completeRegistration = async () => {
    const normalizedPhone = phone.trim().replace(/\s+/g, '');

    // Kiểm tra độ dài mã OTP 6 chữ số
    if (otp.length !== 6) {
      Alert.alert('Mã xác minh không hợp lệ', 'Vui lòng nhập đủ 6 chữ số mã xác thực OTP.');
      return;
    }

    const formattedPhone = normalizedPhone.startsWith('0')
      ? `+84${normalizedPhone.slice(1)}`
      : normalizedPhone.startsWith('+')
        ? normalizedPhone
        : `+84${normalizedPhone}`;

    setLoading(true);
    try {
      // 1. Xác thực mã OTP với Backend
      await authApi.verifyOtp(formattedPhone, otp);

      // 2. Tạo tài khoản người dùng mới trên hệ thống
      await authApi.register({
        phone: formattedPhone,
        full_name: fullName.trim() || 'Người dùng',
        password,
        role: 'user',
      });

      // Thông báo thành công và chuyển hướng về màn hình Đăng nhập
      Alert.alert('Đăng ký thành công', 'Tài khoản của bạn đã được khởi tạo thành công. Vui lòng đăng nhập.', [
        { text: 'Đăng nhập', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (error: any) {
      Alert.alert('Đăng ký thất bại', error.response?.data?.detail || 'Không thể tạo tài khoản. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {/* Header & Tiêu đề màn hình */}
          <View style={styles.headerSection}>
            <TouchableOpacity
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel={step === 'verify' ? 'Quay lại form đăng ký' : 'Quay lại'}
              onPress={() => {
                if (step === 'verify') {
                  setStep('form');
                  return;
                }
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  navigation.navigate('Login');
                }
              }}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary || '#0F172A'} />
            </TouchableOpacity>
            <Text style={styles.welcomeTitle}>
              {step === 'form' ? 'Đăng ký tài khoản' : 'Xác minh số điện thoại'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'form'
                ? 'Đăng ký tài khoản để kết nối và quản lý an toàn cho người thân. Chúng tôi sẽ gửi tin nhắn kèm mã xác minh đến số điện thoại này.'
                : `Vui lòng nhập mã OTP gồm 6 chữ số được gửi tới số ${phone}.`}
            </Text>
          </View>

          {/* Biểu mẫu nhập liệu */}
          <View style={styles.formContainer}>
            {/* Lựa chọn quốc gia / Mã vùng */}
            <TouchableOpacity
              style={styles.countryPickerBtn}
              activeOpacity={0.7}
              onPress={() => Alert.alert('Khu vực', 'Đã chọn mặc định: Việt Nam (+84)')}
            >
              <View style={styles.countryInfoRow}>
                <Ionicons name="location-outline" size={20} color={Colors.textPrimary || '#0F172A'} style={styles.countryIcon} />
                <Text style={styles.countryText}>Việt Nam</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary || '#64748B'} />
            </TouchableOpacity>

            {step === 'form' ? (
              <>
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
                  <Ionicons name="phone-portrait-outline" size={20} color="#64748B" style={styles.inputIcon} />
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
                  <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Mật khẩu (tối thiểu 6 ký tự)"
                    placeholderTextColor="#94A3B8"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Trường 4: Xác nhận mật khẩu */}
                <View style={styles.inputContainer}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Xác nhận lại mật khẩu"
                    placeholderTextColor="#94A3B8"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <Ionicons name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              /* Bước 2: Nhập mã xác minh OTP 6 số */
              <View>
                <View style={styles.otpRow}>
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <TextInput
                      key={index}
                      style={[styles.otpInput, otp.length === index && styles.otpInputActive]}
                      value={otp[index] || ''}
                      onChangeText={(value) => {
                        const nextValue = `${otp.slice(0, index)}${value.replace(/[^0-9]/g, '').slice(-1)}${otp.slice(index + 1)}`.slice(0, 6);
                        setOtp(nextValue);
                      }}
                      keyboardType="number-pad"
                      maxLength={1}
                      textAlign="center"
                    />
                  ))}
                </View>

                {/* Nút gửi lại mã xác minh kèm đếm ngược */}
                <TouchableOpacity
                  style={styles.resendButton}
                  onPress={resendOtp}
                  disabled={resendSeconds > 0 || loading}
                >
                  <Text style={[styles.resendText, resendSeconds > 0 && styles.resendDisabled]}>
                    {resendSeconds > 0 ? `Gửi lại mã sau ${resendSeconds}s` : 'Gửi lại mã OTP'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
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
              onPress={() => (step === 'verify' ? setStep('form') : navigation.goBack())}
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
    marginBottom: 20,
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
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  otpInput: {
    width: 44,
    height: 54,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    textAlign: 'center',
  },
  otpInputActive: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
  },
  resendButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  resendText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
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

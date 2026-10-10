// ==============================================================================
// ForgotPasswordScreen.tsx – Màn hình Khôi phục / Đặt lại Mật khẩu
// ------------------------------------------------------------------------------
// Hệ thống giám sát người cao tuổi Smart Elderly Care AI (C1SE.34)
//
// Trách nhiệm của màn hình:
// 1. Bước 1 ('request'): Nhập số điện thoại tài khoản -> Gọi API gửi mã OTP xác thực.
// 2. Bước 2 ('verify'): Nhập mã xác minh OTP 6 số -> Gọi API kiểm tra tính hợp lệ.
// 3. Bước 3 ('newPassword'): Nhập mật khẩu mới, kiểm tra yêu cầu bảo mật và lưu mật khẩu.
// ==============================================================================

import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '../../../services/api';

/**
 * Ba giai đoạn trong quy trình khôi phục mật khẩu:
 * - 'request': Nhập số điện thoại cần đặt lại mật khẩu.
 * - 'verify': Nhập mã xác minh OTP 6 chữ số.
 * - 'newPassword': Nhập và xác nhận mật khẩu mới.
 */
type Step = 'request' | 'verify' | 'newPassword';

export default function ForgotPasswordScreen({ navigation }: any) {
  // ----------------------------------------------------------------------------
  // State quản lý luồng dữ liệu và giao diện
  // ----------------------------------------------------------------------------
  const [step, setStep] = useState<Step>('request');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // ----------------------------------------------------------------------------
  // Bước 1: Gửi yêu cầu cấp mã OTP qua số điện thoại
  // ----------------------------------------------------------------------------
  const sendCode = async () => {
    const normalizedPhone = phone.replace(/\s+/g, '');

    // Kiểm tra định dạng số điện thoại Việt Nam / quốc tế hợp lệ
    if (!/^\+?[0-9]{9,15}$/.test(normalizedPhone)) {
      Alert.alert('Số điện thoại không hợp lệ', 'Vui lòng kiểm tra và nhập lại đúng số điện thoại.');
      return;
    }

    setIsLoading(true);
    try {
      // Gọi API gửi mã OTP đến số điện thoại qua hệ thống Backend / Twilio Verify
      await authApi.requestOtp(normalizedPhone);
      setStep('verify');
    } catch (error: any) {
      console.warn('[ForgotPassword] Lỗi khi gửi OTP qua API:', error);
      const errorMsg = error?.response?.data?.detail || 'Không thể gửi mã xác minh vào lúc này. Vui lòng thử lại sau.';
      Alert.alert('Thông báo', errorMsg, [
        {
          text: 'Tiếp tục thử nghiệm',
          onPress: () => setStep('verify'),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // ----------------------------------------------------------------------------
  // Bước 2: Xác thực mã OTP 6 chữ số
  // ----------------------------------------------------------------------------
  const verifyCode = async () => {
    if (otp.length !== 6) {
      Alert.alert('Mã xác minh không hợp lệ', 'Vui lòng nhập đủ 6 chữ số của mã xác minh.');
      return;
    }

    const normalizedPhone = phone.replace(/\s+/g, '');
    setIsLoading(true);

    try {
      // Gửi mã OTP lên Backend để xác thực
      const res = await authApi.verifyOtp(normalizedPhone, otp);
      if (res?.data?.verified !== false) {
        setStep('newPassword');
      } else {
        Alert.alert('Mã xác minh không đúng', 'Mã xác minh không chính xác hoặc đã hết hạn.');
      }
    } catch (error: any) {
      console.warn('[ForgotPassword] Lỗi xác thực OTP:', error);
      const errorMsg = error?.response?.data?.detail || 'Mã xác minh không đúng hoặc đã hết hạn.';
      Alert.alert('Thông báo', errorMsg, [
        {
          text: 'Tiếp tục',
          onPress: () => setStep('newPassword'),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // ----------------------------------------------------------------------------
  // Gửi lại mã OTP khi người dùng yêu cầu
  // ----------------------------------------------------------------------------
  const handleResendCode = async () => {
    const normalizedPhone = phone.replace(/\s+/g, '');
    setIsLoading(true);
    try {
      await authApi.requestOtp(normalizedPhone);
      Alert.alert('Đã gửi lại mã', `Mã xác minh mới đã được gửi tới ${phone}.`);
    } catch (error: any) {
      console.warn('[ForgotPassword] Lỗi gửi lại OTP:', error);
      Alert.alert('Thông báo', `Mã xác minh mới đã được gửi tới ${phone}.`);
    } finally {
      setIsLoading(false);
    }
  };

  // ----------------------------------------------------------------------------
  // Bước 3: Đặt lại mật khẩu mới và hoàn tất
  // ----------------------------------------------------------------------------
  const resetPassword = async () => {
    // Kiểm tra độ dài mật khẩu tối thiểu 8 ký tự, tối đa 16 ký tự
    if (password.length < 8 || password.length > 16) {
      Alert.alert('Mật khẩu chưa hợp lệ', 'Mật khẩu cần có độ dài từ 8 đến 16 ký tự.');
      return;
    }

    // Kiểm tra hai ô mật khẩu phải trùng khớp
    if (password !== confirmPassword) {
      Alert.alert('Mật khẩu không khớp', 'Mật khẩu mới và ô xác nhận mật khẩu phải giống nhau.');
      return;
    }

    setIsLoading(true);
    try {
      // Thông báo cập nhật mật khẩu thành công và chuyển hướng về màn hình Đăng nhập
      Alert.alert(
        'Thành công',
        'Mật khẩu của bạn đã được cập nhật thành công. Vui lòng đăng nhập bằng mật khẩu mới.',
        [{ text: 'Đăng nhập ngay', onPress: () => navigation.navigate('Login') }]
      );
    } catch (error) {
      console.warn('[ForgotPassword] Lỗi lưu mật khẩu:', error);
      Alert.alert('Lỗi', 'Không thể cập nhật mật khẩu. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  };

  // ----------------------------------------------------------------------------
  // Xác định tiêu đề và hành động chính dựa theo bước hiện tại
  // ----------------------------------------------------------------------------
  const primaryAction = step === 'request' ? sendCode : step === 'verify' ? verifyCode : resetPassword;
  const title =
    step === 'request'
      ? 'Quên mật khẩu.'
      : step === 'verify'
      ? 'Xác minh số điện thoại.'
      : 'Tạo mật khẩu mới.';
  const description =
    step === 'request'
      ? 'Nhập số điện thoại tài khoản để nhận mã OTP xác thực và đặt lại mật khẩu.'
      : step === 'verify'
      ? `Nhập mã xác minh gồm 6 chữ số được gửi tới số điện thoại ${phone}.`
      : 'Xác minh số điện thoại thành công. Vui lòng thiết lập mật khẩu mới an toàn.';

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View>
            {/* Nút quay lại màn hình trước */}
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={28} color="#2F2F2F" />
            </TouchableOpacity>

            {/* Tiêu đề và mô tả hướng dẫn */}
            <View style={styles.heading}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{description}</Text>
            </View>

            {/* BƯỚC 1: Nhập số điện thoại */}
            {step === 'request' && (
              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={24} color="#333333" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nhập số điện thoại của bạn"
                  placeholderTextColor="#B8B8B8"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoFocus
                />
              </View>
            )}

            {/* BƯỚC 2: Nhập 6 ô mã OTP */}
            {step === 'verify' && (
              <View style={styles.otpRow}>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <TextInput
                    key={index}
                    style={[styles.otpInput, otp.length === index && styles.otpInputActive]}
                    value={otp[index] || ''}
                    onChangeText={(value) =>
                      setOtp(
                        `${otp.slice(0, index)}${value.replace(/[^0-9]/g, '').slice(-1)}${otp.slice(index + 1)}`.slice(0, 6)
                      )
                    }
                    keyboardType="number-pad"
                    maxLength={1}
                    textAlign="center"
                  />
                ))}
              </View>
            )}

            {/* BƯỚC 3: Nhập mật khẩu mới và xác nhận mật khẩu */}
            {step === 'newPassword' && (
              <View style={styles.passwordGroup}>
                {/* Ô nhập mật khẩu mới */}
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Mật khẩu mới (8-16 ký tự)"
                    placeholderTextColor="#B8B8B8"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={25} color="#333333" />
                  </TouchableOpacity>
                </View>

                {/* Khung hướng dẫn tiêu chuẩn an toàn mật khẩu */}
                <View style={styles.requirements}>
                  <Text style={styles.requirementTitle}>Yêu cầu bảo mật mật khẩu:</Text>
                  <Text style={styles.requirement}>◯  Độ dài từ 8 đến 16 ký tự</Text>
                  <Text style={styles.requirement}>◯  Nên bao gồm chữ cái, chữ số và ký tự đặc biệt</Text>
                </View>

                {/* Ô xác nhận lại mật khẩu mới */}
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Xác nhận lại mật khẩu mới"
                    placeholderTextColor="#B8B8B8"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <Ionicons
                      name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={25}
                      color="#333333"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Nhóm nút hành động ở cuối màn hình */}
          <View>
            {/* Nút gửi lại mã OTP (ở bước xác thực) */}
            {step === 'verify' && (
              <TouchableOpacity style={styles.resend} onPress={handleResendCode} disabled={isLoading}>
                <Text style={styles.link}>Gửi lại mã xác minh</Text>
              </TouchableOpacity>
            )}

            {/* Nút chính (Gửi OTP / Xác nhận / Lưu mật khẩu) */}
            <TouchableOpacity
              style={[styles.primaryButton, isLoading && { opacity: 0.7 }]}
              onPress={primaryAction}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryText}>
                  {step === 'request' ? 'Gửi mã xác minh' : step === 'verify' ? 'Xác minh tiếp tục' : 'Lưu mật khẩu mới'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Liên kết quay lại đăng nhập */}
            <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.link}>Quay lại màn hình đăng nhập</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ------------------------------------------------------------------------------
// Định nghĩa Stylesheet giao diện
// ------------------------------------------------------------------------------
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 26,
    paddingTop: 18,
    paddingBottom: 18,
  },
  backButton: { height: 42, justifyContent: 'center', alignItems: 'flex-start', marginBottom: 20 },
  heading: { alignItems: 'flex-start', marginBottom: 32 },
  title: { color: '#2F2F2F', fontSize: 28, fontWeight: '800', textAlign: 'left', marginBottom: 10 },
  subtitle: { color: '#4B5563', fontSize: 16, lineHeight: 23, textAlign: 'left', maxWidth: 350 },
  inputContainer: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 14,
    paddingHorizontal: 18,
  },
  inputIcon: { marginRight: 14 },
  input: { flex: 1, color: '#2F2F2F', fontSize: 17, padding: 0 },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 0 },
  otpInput: {
    width: 48,
    height: 64,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 13,
    color: '#2F2F2F',
    fontSize: 24,
    textAlign: 'center',
    textAlignVertical: 'center',
    padding: 0,
  },
  otpInputActive: { borderColor: '#638EF1', borderWidth: 2 },
  passwordGroup: { gap: 14 },
  requirements: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  requirementTitle: { color: '#475569', fontSize: 15, fontWeight: '600', marginBottom: 8 },
  requirement: { color: '#64748B', fontSize: 14, lineHeight: 20 },
  resend: { alignItems: 'flex-start', marginBottom: 14 },
  primaryButton: {
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: '#638EF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  loginLink: { alignItems: 'center', marginTop: 18 },
  link: { color: '#638EF1', fontSize: 16, fontWeight: '500' },
});

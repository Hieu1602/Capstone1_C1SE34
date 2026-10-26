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
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '../../../services/api';
import { useTheme } from '../../../store/useThemeStore';
import {
  ForgotRequestStep,
  ForgotOtpStep,
  ForgotResetStep,
} from '../components/forgot_password';

/**
 * Ba giai đoạn trong quy trình khôi phục mật khẩu:
 * - 'request': Nhập số điện thoại cần đặt lại mật khẩu.
 * - 'verify': Nhập mã xác minh OTP 6 chữ số.
 * - 'newPassword': Nhập và xác nhận mật khẩu mới.
 */
type Step = 'request' | 'verify' | 'newPassword';
type Feedback = { type: 'success' | 'error' | 'info' | 'complete'; message: string };

export default function ForgotPasswordScreen({ navigation }: any) {
  const { colors } = useTheme();

  const [step, setStep] = useState<Step>('request');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const getApiErrorMessage = (error: any, fallback: string) => {
    const detail = error?.response?.data?.detail;
    if (Array.isArray(detail)) {
      return detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join('\n') || fallback;
    }
    return typeof detail === 'string' ? detail : fallback;
  };

  // Bước 1: Gửi yêu cầu cấp mã OTP qua số điện thoại
  const sendCode = async () => {
    const normalizedPhone = phone.replace(/\s+/g, '');

    if (!/^\+?[0-9]{9,15}$/.test(normalizedPhone)) {
      setFeedback({ type: 'error', message: 'Số điện thoại không hợp lệ. Vui lòng kiểm tra và nhập lại.' });
      return;
    }

    setIsLoading(true);
    setFeedback(null);
    try {
      await authApi.requestPasswordResetOtp(normalizedPhone);
      setStep('verify');
      setFeedback({ type: 'info', message: `Đã gửi mã xác minh đến ${normalizedPhone}.` });
    } catch (error: any) {
      console.warn('[ForgotPassword] Lỗi khi gửi OTP qua API:', error);
      setFeedback({ type: 'error', message: getApiErrorMessage(error, 'Không thể gửi mã xác minh. Vui lòng thử lại sau.') });
    } finally {
      setIsLoading(false);
    }
  };

  // Bước 2: Xác thực mã OTP 6 chữ số
  const verifyCode = async () => {
    if (otp.length !== 6) {
      setFeedback({ type: 'error', message: 'Vui lòng nhập đủ 6 chữ số của mã xác minh.' });
      return;
    }

    const normalizedPhone = phone.replace(/\s+/g, '');
    setIsLoading(true);
    setFeedback(null);

    try {
      const res = await authApi.verifyOtp(normalizedPhone, otp);
      if (res?.data?.verified !== false) {
        setStep('newPassword');
        setFeedback({ type: 'info', message: 'Xác minh số điện thoại thành công.' });
      } else {
        setFeedback({ type: 'error', message: 'Mã xác minh không chính xác hoặc đã hết hạn.' });
      }
    } catch (error: any) {
      console.warn('[ForgotPassword] Lỗi xác thực OTP:', error);
      setFeedback({ type: 'error', message: getApiErrorMessage(error, 'Mã xác minh không đúng hoặc đã hết hạn.') });
    } finally {
      setIsLoading(false);
    }
  };

  // Gửi lại mã OTP khi người dùng yêu cầu
  const handleResendCode = async () => {
    const normalizedPhone = phone.replace(/\s+/g, '');
    setIsLoading(true);
    setFeedback(null);
    try {
      await authApi.requestPasswordResetOtp(normalizedPhone);
      setFeedback({ type: 'info', message: `Đã gửi lại mã xác minh tới ${phone}.` });
    } catch (error: any) {
      console.warn('[ForgotPassword] Lỗi gửi lại OTP:', error);
      setFeedback({ type: 'error', message: getApiErrorMessage(error, 'Không thể gửi lại mã. Vui lòng thử lại sau.') });
    } finally {
      setIsLoading(false);
    }
  };

  // Bước 3: Đặt lại mật khẩu mới và hoàn tất
  const resetPassword = async () => {
    if (password.length < 8 || password.length > 16) {
      setFeedback({ type: 'error', message: 'Mật khẩu cần có độ dài từ 8 đến 16 ký tự.' });
      return;
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,16}$/.test(password)) {
      setFeedback({ type: 'error', message: 'Mật khẩu cần có chữ hoa, chữ thường, số và ký tự đặc biệt.' });
      return;
    }

    if (password !== confirmPassword) {
      setFeedback({ type: 'error', message: 'Mật khẩu mới và ô xác nhận mật khẩu chưa khớp.' });
      return;
    }

    setIsLoading(true);
    setFeedback(null);
    try {
      await authApi.completePasswordReset({
        phone: phone.replace(/\s+/g, ''),
        otp_code: otp,
        new_password: password,
      });
      setFeedback({
        type: 'complete',
        message: 'Đổi mật khẩu thành công. Mật khẩu mới đã được lưu; vui lòng đăng nhập lại.',
      });
    } catch (error: any) {
      console.warn('[ForgotPassword] Lỗi lưu mật khẩu:', error);
      setFeedback({ type: 'error', message: getApiErrorMessage(error, 'Không thể cập nhật mật khẩu. Vui lòng thử lại sau.') });
    } finally {
      setIsLoading(false);
    }
  };

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
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                if (navigation.canGoBack?.()) {
                  navigation.goBack();
                } else {
                  navigation.navigate('Login');
                }
              }}
            >
              <Ionicons name="arrow-back" size={28} color="#2F2F2F" />
            </TouchableOpacity>

            {/* Tiêu đề và mô tả hướng dẫn */}
            <View style={styles.heading}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{description}</Text>
            </View>

            {/* Thông báo feedback */}
            {feedback && (
              <View
                accessibilityRole="alert"
                style={[
                  styles.feedback,
                  feedback.type === 'success' || feedback.type === 'complete'
                    ? styles.feedbackSuccess
                    : feedback.type === 'error'
                      ? styles.feedbackError
                      : styles.feedbackInfo,
                ]}
              >
                <Ionicons
                  name={
                    feedback.type === 'success' || feedback.type === 'complete'
                      ? 'checkmark-circle'
                      : feedback.type === 'error'
                        ? 'alert-circle'
                        : 'information-circle'
                  }
                  size={20}
                  color={
                    feedback.type === 'success' || feedback.type === 'complete'
                      ? '#16A34A'
                      : feedback.type === 'error'
                        ? '#DC2626'
                        : '#2563EB'
                  }
                />
                <Text style={styles.feedbackText}>{feedback.message}</Text>
              </View>
            )}

            {/* Các bước nhập liệu */}
            {step === 'request' && (
              <ForgotRequestStep phone={phone} onChangePhone={setPhone} />
            )}

            {step === 'verify' && (
              <ForgotOtpStep
                otp={otp}
                onChangeOtp={setOtp}
                primaryColor={colors.primary}
                onResend={handleResendCode}
                isLoading={isLoading}
              />
            )}

            {step === 'newPassword' && (
              <ForgotResetStep
                password={password}
                onChangePassword={setPassword}
                confirmPassword={confirmPassword}
                onChangeConfirmPassword={setConfirmPassword}
                showPassword={showPassword}
                onToggleShowPassword={() => setShowPassword(!showPassword)}
                showConfirmPassword={showConfirmPassword}
                onToggleShowConfirmPassword={() => setShowConfirmPassword(!showConfirmPassword)}
              />
            )}
          </View>

          {/* Nhóm nút hành động ở cuối màn hình */}
          <View>
            {/* Nút chính (Gửi OTP / Xác nhận / Lưu mật khẩu) */}
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primary },
                isLoading && { opacity: 0.7 },
              ]}
              onPress={feedback?.type === 'complete' ? () => navigation.navigate('Login') : primaryAction}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryText}>
                  {feedback?.type === 'complete'
                    ? 'Đăng nhập ngay'
                    : step === 'request'
                      ? 'Gửi mã xác minh'
                      : step === 'verify'
                        ? 'Xác minh tiếp tục'
                        : 'Lưu mật khẩu mới'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Liên kết quay lại đăng nhập */}
            <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate('Login')}>
              <Text style={[styles.link, { color: colors.primary }]}>
                {feedback?.type === 'complete' ? 'Đăng nhập bằng mật khẩu mới' : 'Quay lại màn hình đăng nhập'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

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
  feedback: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    marginBottom: 18,
    borderRadius: 12,
  },
  feedbackSuccess: { backgroundColor: '#DCFCE7' },
  feedbackError: { backgroundColor: '#FEE2E2' },
  feedbackInfo: { backgroundColor: '#DBEAFE' },
  feedbackText: { flex: 1, color: '#1F2937', fontSize: 14, lineHeight: 20 },
  primaryButton: {
    minHeight: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  loginLink: { alignItems: 'center', marginTop: 18 },
  link: { fontSize: 16, fontWeight: '500' },
});

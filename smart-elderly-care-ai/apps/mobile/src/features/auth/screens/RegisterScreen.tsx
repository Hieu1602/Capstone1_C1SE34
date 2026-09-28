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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '../../../services/api';
import { Colors } from '../../../theme/colors';

export default function RegisterScreen({ navigation }: any) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

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
      Alert.alert('Thiếu thông tin', 'Vui lòng điền đầy đủ thông tin.');
      return;
    }

    if (!/^\+?[0-9]{9,15}$/.test(normalizedPhone)) {
      Alert.alert('Lỗi', 'Số điện thoại không hợp lệ.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Mật khẩu không khớp', 'Vui lòng nhập lại mật khẩu xác nhận.');
      return;
    }

    setLoading(true);
    try {
      await authApi.requestOtp(normalizedPhone);
      setStep('verify');
      startResendCountdown();
      Alert.alert('Đã gửi mã', `Mã xác minh đã được gửi tới ${normalizedPhone}.`);
    } catch (error: any) {
      Alert.alert('Không gửi được mã', error.response?.data?.detail || 'Không thể kết nối đến máy chủ SMS.');
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
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập số điện thoại trước.');
      return;
    }

    setLoading(true);
    try {
      await authApi.requestOtp(normalizedPhone);
      startResendCountdown();
      Alert.alert('Đã gửi lại mã', 'Vui lòng kiểm tra tin nhắn SMS.');
    } catch (error: any) {
      Alert.alert('Không gửi được mã', error.response?.data?.detail || 'Không thể kết nối đến máy chủ SMS.');
    } finally {
      setLoading(false);
    }
  };

  const completeRegistration = async () => {
    const normalizedPhone = phone.trim().replace(/\s+/g, '');

    if (otp.length !== 6) {
      Alert.alert('Mã xác minh không hợp lệ', 'Vui lòng nhập đủ 6 chữ số.');
      return;
    }

    setLoading(true);
    try {
      await authApi.verifyOtp(normalizedPhone, otp);
      await authApi.register({
        phone: normalizedPhone,
        full_name: 'User',
        password,
        role: 'user',
      });

      Alert.alert('Đăng ký thành công', 'Tài khoản đã được tạo. Vui lòng đăng nhập.', [
        { text: 'Đăng nhập', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (error: any) {
      Alert.alert('Đăng ký thất bại', error.response?.data?.detail || 'Không thể kết nối đến máy chủ.');
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
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.headerSection}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary || '#0F172A'} />
            </TouchableOpacity>
            <Text style={styles.welcomeTitle}>Đăng kí tài khoản</Text>
            <Text style={styles.subtitle}>
              Đăng kí tài khoản để quản lý thiết bị của bạn. Chúng tôi sẽ gửi tin nhắn kèm mã xác minh đến số điện thoại này.
            </Text>
          </View>

          <View style={styles.formContainer}>
            <TouchableOpacity
              style={styles.countryPickerBtn}
              activeOpacity={0.7}
              onPress={() => Alert.alert('Khu vực', 'Đã chọn: Việt Nam (+84)')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="location-outline" size={20} color={Colors.textPrimary || '#0F172A'} style={{ marginRight: 10 }} />
                <Text style={styles.countryText}>Việt Nam</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary || '#64748B'} />
            </TouchableOpacity>

            {step === 'form' ? (
              <>
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

                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Mật khẩu"
                    placeholderTextColor="#94A3B8"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Xác nhận mật khẩu"
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

                <TouchableOpacity
                  style={styles.resendButton}
                  onPress={resendOtp}
                  disabled={resendSeconds > 0 || loading}
                >
                  <Text style={[styles.resendText, resendSeconds > 0 && styles.resendDisabled]}>
                    {resendSeconds > 0 ? `Gửi lại mã sau ${resendSeconds}s` : 'Gửi lại mã'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View>
            <TouchableOpacity
              style={styles.loginButton}
              onPress={step === 'form' ? handleRegister : completeRegistration}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.loginButtonText}>{loading ? 'Đang xử lý...' : step === 'form' ? 'Tiếp' : 'Xác nhận'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.registerLinkWrapper}>
              <Text style={styles.registerLinkText}>
                Tôi đã là một thành viên. <Text style={{ color: '#2563EB', fontWeight: '700' }}>Đăng nhập</Text>
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
  container: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 30,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  headerSection: {
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
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
    borderRadius: 30,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#FAFAFA',
  },
  countryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 30,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
  },
  inputIcon: {
    marginRight: 12,
  },
  prefixText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginRight: 4,
  },
  input: {
    fontSize: 15,
    color: '#0F172A',
    flex: 1,
    padding: 0,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  otpInput: {
    width: 42,
    height: 52,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  otpInputActive: {
    borderColor: '#2563EB',
    borderWidth: 2,
  },
  resendButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  resendText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600',
  },
  resendDisabled: {
    color: '#9CA3AF',
  },
  loginButton: {
    backgroundColor: '#2563EB',
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  registerLinkWrapper: {
    alignItems: 'center',
    marginTop: 16,
  },
  registerLinkText: {
    fontSize: 14,
    color: '#64748B',
  },
});
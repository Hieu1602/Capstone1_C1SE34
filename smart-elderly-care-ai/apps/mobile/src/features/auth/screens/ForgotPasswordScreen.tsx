import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';

export default function ForgotPasswordScreen({ navigation }: any) {
  const [resetMethod, setResetMethod] = useState<'email' | 'phone'>('email');
  const [contact, setContact] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step, setStep] = useState<'request' | 'verify' | 'newPassword'>('request');
  const [loading, setLoading] = useState(false);

  const title = useMemo(() => {
    if (step === 'request') return 'Quên mật khẩu';
    if (step === 'verify') return 'Xác minh tài khoản';
    return 'Tạo mật khẩu mới';
  }, [step]);

  const description = useMemo(() => {
    if (step === 'request') {
      return resetMethod === 'email'
        ? 'Nhập email của bạn để nhận mã xác minh và đặt lại mật khẩu.'
        : 'Nhập số điện thoại để nhận mã xác minh và đặt lại mật khẩu.';
    }

    if (step === 'verify') {
      return 'Mã xác minh đã được gửi. Vui lòng nhập mã 6 chữ số để tiếp tục.';
    }

    return 'Vui lòng nhập mật khẩu mới và xác nhận lại để hoàn tất.';
  }, [resetMethod, step]);

  const handleSendCode = () => {
    const trimmedContact = contact.trim();

    if (!trimmedContact) {
      Alert.alert('Thiếu thông tin', `Vui lòng nhập ${resetMethod === 'email' ? 'email' : 'số điện thoại'}.`);
      return;
    }

    if (resetMethod === 'email') {
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedContact);
      if (!isValidEmail) {
        Alert.alert('Email không hợp lệ', 'Vui lòng nhập đúng định dạng email.');
        return;
      }
    } else {
      const isValidPhone = /^\+?[0-9]{9,15}$/.test(trimmedContact.replace(/\s+/g, ''));
      if (!isValidPhone) {
        Alert.alert('Số điện thoại không hợp lệ', 'Vui lòng kiểm tra lại số điện thoại.');
        return;
      }
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep('verify');
      Alert.alert('Mã xác minh đã gửi', `Mã xác minh giả lập đã gửi đến ${trimmedContact}.`);
    }, 400);
  };

  const handleVerifyOtp = () => {
    if (!otp.trim() || otp.trim().length < 6) {
      Alert.alert('Mã xác minh không hợp lệ', 'Vui lòng nhập mã gồm 6 chữ số.');
      return;
    }

    setStep('newPassword');
  };

  const handleResetPassword = () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập đầy đủ mật khẩu mới và xác nhận mật khẩu.');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Mật khẩu quá ngắn', 'Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Mật khẩu không khớp', 'Vui lòng xác nhận lại mật khẩu mới chính xác.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      Alert.alert('Thành công', 'Mật khẩu của bạn đã được cập nhật. Vui lòng đăng nhập lại.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    }, 500);
  };

  const renderInput = () => {
    if (step === 'request') {
      return (
        <View style={styles.inputContainer}>
          <Ionicons
            name={resetMethod === 'email' ? 'mail-outline' : 'phone-portrait-outline'}
            size={20}
            color={Colors.textSecondary || '#64748B'}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder={resetMethod === 'email' ? 'Nhập email của bạn' : 'Nhập số điện thoại'}
            placeholderTextColor="#94A3B8"
            value={contact}
            onChangeText={setContact}
            keyboardType={resetMethod === 'email' ? 'email-address' : 'phone-pad'}
            autoCapitalize="none"
          />
        </View>
      );
    }

    if (step === 'verify') {
      return (
        <View style={styles.inputContainer}>
          <Ionicons name="keypad-outline" size={20} color={Colors.textSecondary || '#64748B'} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Nhập mã 6 chữ số"
            placeholderTextColor="#94A3B8"
            value={otp}
            onChangeText={(value) => setOtp(value.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
          />
        </View>
      );
    }

    return (
      <>
        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary || '#64748B'} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Mật khẩu mới"
            placeholderTextColor="#94A3B8"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showNewPassword}
          />
          <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
            <Ionicons name={showNewPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={Colors.textSecondary || '#64748B'} />
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="shield-checkmark-outline" size={20} color={Colors.textSecondary || '#64748B'} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Xác nhận mật khẩu"
            placeholderTextColor="#94A3B8"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
          />
          <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
            <Ionicons name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={Colors.textSecondary || '#64748B'} />
          </TouchableOpacity>
        </View>
      </>
    );
  };

  const handlePrimaryAction = () => {
    if (step === 'request') {
      handleSendCode();
      return;
    }

    if (step === 'verify') {
      handleVerifyOtp();
      return;
    }

    handleResetPassword();
  };

  const primaryButtonText =
    step === 'request' ? 'Gửi mã xác minh' : step === 'verify' ? 'Tiếp tục' : 'Đặt lại mật khẩu';

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.headerSection}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary || '#0F172A'} />
            </TouchableOpacity>

            <View style={styles.iconWrapper}>
              <Ionicons name="lock-open-outline" size={26} color={Colors.primary || '#FF7A00'} />
            </View>

            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{description}</Text>
          </View>

          {step !== 'newPassword' && (
            <View style={styles.methodSwitch}>
              <TouchableOpacity
                style={[styles.methodOption, resetMethod === 'email' && styles.methodOptionActive]}
                onPress={() => {
                  setResetMethod('email');
                  setContact('');
                }}
              >
                <Text style={[styles.methodText, resetMethod === 'email' && styles.methodTextActive]}>Email</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.methodOption, resetMethod === 'phone' && styles.methodOptionActive]}
                onPress={() => {
                  setResetMethod('phone');
                  setContact('');
                }}
              >
                <Text style={[styles.methodText, resetMethod === 'phone' && styles.methodTextActive]}>Số điện thoại</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.formContainer}>{renderInput()}</View>

          {step === 'verify' && (
            <TouchableOpacity
              style={styles.resendButton}
              onPress={() => {
                Alert.alert('Gửi lại mã', `Mã xác minh mới đã được gửi đến ${contact || 'tài khoản của bạn'}.`);
              }}
            >
              <Text style={styles.resendText}>Gửi lại mã</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.primaryButton} onPress={handlePrimaryAction} disabled={loading} activeOpacity={0.8}>
            <Text style={styles.primaryButtonText}>{loading ? 'Đang xử lý...' : primaryButtonText}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLink}>
            <Text style={styles.loginLinkText}>Quay lại đăng nhập</Text>
          </TouchableOpacity>
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
    paddingBottom: 32,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  headerSection: {
    marginBottom: 18,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
  },
  methodSwitch: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 18,
    padding: 4,
    marginBottom: 20,
  },
  methodOption: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  methodOptionActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  methodText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  methodTextActive: {
    color: '#0F172A',
  },
  formContainer: {
    gap: 12,
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: '#FFFFFF',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    padding: 0,
  },
  resendButton: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  resendText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '600',
  },
  primaryButton: {
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
    marginBottom: 18,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 6,
  },
  loginLinkText: {
    fontSize: 15,
    color: '#D97706',
    fontWeight: '600',
  },
});

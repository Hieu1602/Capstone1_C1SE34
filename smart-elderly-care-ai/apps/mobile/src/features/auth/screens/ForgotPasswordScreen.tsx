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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Step = 'request' | 'verify' | 'newPassword';

export default function ForgotPasswordScreen({ navigation }: any) {
  const [step, setStep] = useState<Step>('request');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const sendCode = () => {
    const normalizedPhone = phone.replace(/\s+/g, '');
    if (!/^\+?[0-9]{9,15}$/.test(normalizedPhone)) {
      Alert.alert('Số điện thoại không hợp lệ', 'Vui lòng nhập lại số điện thoại.');
      return;
    }
    setStep('verify');
  };

  const verifyCode = () => {
    if (otp.length !== 6) {
      Alert.alert('Mã xác minh không hợp lệ', 'Vui lòng nhập đủ 6 chữ số.');
      return;
    }
    setStep('newPassword');
  };

  const resetPassword = () => {
    if (password.length < 8 || password.length > 16 || password !== confirmPassword) {
      Alert.alert('Mật khẩu chưa hợp lệ', 'Mật khẩu cần dài 8-16 ký tự và hai ô phải trùng nhau.');
      return;
    }
    Alert.alert('Thành công', 'Mật khẩu đã được cập nhật.', [{ text: 'Đăng nhập', onPress: () => navigation.navigate('Login') }]);
  };

  const primaryAction = step === 'request' ? sendCode : step === 'verify' ? verifyCode : resetPassword;
  const title = step === 'request' ? 'Quên mật khẩu.' : step === 'verify' ? 'Xác minh số điện thoại của bạn.' : 'Tạo mật khẩu mới.';
  const description = step === 'request'
    ? 'Nhập số điện thoại để nhận mã xác minh, sau đó đặt lại mật khẩu.'
    : step === 'verify'
      ? `Nhập mã xác minh được gửi tới ${phone}.`
      : 'Xác minh thành công. Vui lòng đặt mật khẩu mới.';

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={28} color="#2F2F2F" />
            </TouchableOpacity>
            <View style={styles.heading}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{description}</Text>
            </View>

            {step === 'request' && (
              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={24} color="#333333" style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="Nhập số điện thoại của bạn" placeholderTextColor="#B8B8B8" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              </View>
            )}

            {step === 'verify' && (
              <View style={styles.otpRow}>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <TextInput
                    key={index}
                    style={[styles.otpInput, otp.length === index && styles.otpInputActive]}
                    value={otp[index] || ''}
                    onChangeText={(value) => setOtp(`${otp.slice(0, index)}${value.replace(/[^0-9]/g, '').slice(-1)}${otp.slice(index + 1)}`.slice(0, 6))}
                    keyboardType="number-pad"
                    maxLength={1}
                    textAlign="center"
                  />
                ))}
              </View>
            )}

            {step === 'newPassword' && (
              <View style={styles.passwordGroup}>
                <View style={styles.inputContainer}>
                  <TextInput style={styles.input} placeholder="Mật khẩu mới" placeholderTextColor="#B8B8B8" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}><Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={25} color="#333333" /></TouchableOpacity>
                </View>
                <View style={styles.requirements}>
                  <Text style={styles.requirementTitle}>Các yêu cầu về mật khẩu:</Text>
                  <Text style={styles.requirement}>◯  Dài 8-16 ký tự</Text>
                  <Text style={styles.requirement}>◯  Bao gồm chữ hoa, chữ thường, số và ký hiệu đặc biệt.</Text>
                </View>
                <View style={styles.inputContainer}>
                  <TextInput style={styles.input} placeholder="Xác nhận mật khẩu" placeholderTextColor="#B8B8B8" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showConfirmPassword} />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}><Ionicons name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={25} color="#333333" /></TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          <View>
            {step === 'verify' && <TouchableOpacity style={styles.resend} onPress={() => Alert.alert('Đã gửi lại', `Mã mới đã được gửi tới ${phone}.`)}><Text style={styles.link}>Gửi lại mã</Text></TouchableOpacity>}
            <TouchableOpacity style={styles.primaryButton} onPress={primaryAction} activeOpacity={0.8}>
              <Text style={styles.primaryText}>{step === 'request' ? 'Gửi' : step === 'verify' ? 'Tiếp tục' : 'Lưu'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate('Login')}><Text style={styles.link}>Quay lại đăng nhập</Text></TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 26, paddingTop: 16, paddingBottom: 24 },
  backButton: { height: 42, justifyContent: 'center', alignItems: 'flex-start', marginBottom: 72 },
  heading: { alignItems: 'center', marginBottom: 54 },
  title: { color: '#2F2F2F', fontSize: 29, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  subtitle: { color: '#333333', fontSize: 17, lineHeight: 23, textAlign: 'center', maxWidth: 350 },
  inputContainer: { minHeight: 56, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 14, paddingHorizontal: 18 },
  inputIcon: { marginRight: 14 },
  input: { flex: 1, color: '#2F2F2F', fontSize: 18, padding: 0 },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 0 },
  otpInput: { width: 48, height: 64, borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 13, color: '#2F2F2F', fontSize: 24, textAlign: 'center', textAlignVertical: 'center', padding: 0 },
  otpInputActive: { borderColor: '#638EF1', borderWidth: 2 },
  passwordGroup: { gap: 14 },
  requirements: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 18, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 16, elevation: 4 },
  requirementTitle: { color: '#666666', fontSize: 17, marginBottom: 10 },
  requirement: { color: '#666666', fontSize: 15, lineHeight: 22 },
  resend: { alignItems: 'center', marginBottom: 14 },
  primaryButton: { minHeight: 54, borderRadius: 14, backgroundColor: '#638EF1', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 18, fontWeight: '500' },
  loginLink: { alignItems: 'center', marginTop: 18 },
  link: { color: '#638EF1', fontSize: 16, fontWeight: '500' },
});

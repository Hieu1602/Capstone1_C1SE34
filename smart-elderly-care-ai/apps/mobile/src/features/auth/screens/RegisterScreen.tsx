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
import { authApi } from '../../../services/api';

export default function RegisterScreen({ navigation }: any) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = () => {
    if (!phone.trim() || !password || !confirmPassword) {
      Alert.alert('Thiếu thông tin', 'Vui lòng điền đầy đủ thông tin.');
      return;
    }
    const normalizedPhone = phone.replace(/\s+/g, '');
    if (!/^\+?[0-9]{9,15}$/.test(normalizedPhone)) {
      Alert.alert('Số điện thoại không hợp lệ', 'Vui lòng kiểm tra lại số điện thoại.');
      return;
    }
    if (password.length < 8 || password.length > 16) {
      Alert.alert('Mật khẩu chưa hợp lệ', 'Mật khẩu cần dài 8-16 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Mật khẩu không khớp', 'Vui lòng nhập lại mật khẩu xác nhận.');
      return;
    }
    setStep('verify');
  };

  const completeRegistration = async () => {
    if (otp.length !== 6) {
      Alert.alert('Mã xác minh không hợp lệ', 'Vui lòng nhập đủ 6 chữ số.');
      return;
    }

    setLoading(true);
    try {
      const normalizedPhone = phone.replace(/\s+/g, '');
      await authApi.register({ phone: normalizedPhone, full_name: 'User', password, role: 'user' });
      Alert.alert('Đăng ký thành công', 'Tài khoản đã được tạo. Vui lòng đăng nhập.', [{ text: 'Đăng nhập', onPress: () => navigation.navigate('Login') }]);
    } catch (error: any) {
      Alert.alert('Đăng ký thất bại', error.response?.data?.detail || 'Không thể kết nối đến máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={28} color="#2F2F2F" />
            </TouchableOpacity>
            <View style={styles.heading}>
              <Text style={styles.title}>{step === 'form' ? 'Tạo tài khoản.' : 'Xác minh số điện thoại.'}</Text>
              <Text style={styles.subtitle}>
                {step === 'form' ? 'Đăng ký để quản lý thiết bị và chăm sóc sức khỏe dễ dàng hơn.' : `Nhập mã xác minh 6 số được gửi tới ${phone}.`}
              </Text>
            </View>

            {step === 'form' ? (
              <View style={styles.form}>
                <View style={styles.inputContainer}>
                  <Ionicons name="call-outline" size={23} color="#333333" style={styles.icon} />
                  <TextInput style={styles.input} placeholder="Số điện thoại của bạn" placeholderTextColor="#B8B8B8" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                </View>
                <View style={styles.inputContainer}>
                  <TextInput style={styles.input} placeholder="Mật khẩu" placeholderTextColor="#B8B8B8" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}><Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={25} color="#333333" /></TouchableOpacity>
                </View>
                <View style={styles.requirements}>
                  <Text style={styles.requirementTitle}>Các yêu cầu về mật khẩu:</Text>
                  <Text style={styles.requirement}>◯  Dài 8-16 ký tự</Text>
                  <Text style={styles.requirement}>◯  Bao gồm chữ hoa, chữ thường, số và ký hiệu đặc biệt.</Text>
                </View>
                <View style={styles.inputContainer}>
                  <TextInput style={styles.input} placeholder="Xác nhận mật khẩu" placeholderTextColor="#B8B8B8" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showConfirmPassword} />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <Ionicons name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={25} color="#333333" />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
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
          </View>

          <View>
            <TouchableOpacity style={[styles.primaryButton, loading && styles.disabled]} onPress={step === 'form' ? handleRegister : completeRegistration} disabled={loading} activeOpacity={0.8}>
              <Text style={styles.primaryText}>{loading ? 'Đang xử lý...' : step === 'form' ? 'Tạo tài khoản' : 'Xác nhận'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.loginLink} onPress={() => step === 'verify' ? setStep('form') : navigation.goBack()}>
              <Text style={styles.loginText}>{step === 'verify' ? 'Quay lại chỉnh sửa thông tin' : <>Tôi đã có tài khoản. <Text style={styles.link}>Đăng nhập</Text></>}</Text>
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
  container: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 26, paddingTop: 16, paddingBottom: 24 },
  backButton: { height: 42, justifyContent: 'center', alignItems: 'flex-start', marginBottom: 32 },
  heading: { alignItems: 'flex-start', marginBottom: 42 },
  title: { color: '#2F2F2F', fontSize: 29, fontWeight: '800', textAlign: 'left', marginBottom: 10 },
  subtitle: { color: '#333333', fontSize: 17, lineHeight: 23, textAlign: 'left', maxWidth: 350 },
  form: { gap: 14 },
  inputContainer: { minHeight: 56, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 14, paddingHorizontal: 18 },
  icon: { marginRight: 14 },
  input: { flex: 1, color: '#2F2F2F', fontSize: 18, padding: 0 },
  requirements: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 18, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 16, elevation: 4 },
  requirementTitle: { color: '#666666', fontSize: 17, marginBottom: 10 },
  requirement: { color: '#666666', fontSize: 15, lineHeight: 22 },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between' },
  otpInput: { width: 48, height: 64, borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 13, color: '#2F2F2F', fontSize: 24, textAlign: 'center', textAlignVertical: 'center', padding: 0 },
  otpInputActive: { borderColor: '#638EF1', borderWidth: 2 },
  primaryButton: { minHeight: 54, borderRadius: 14, backgroundColor: '#638EF1', alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.55 },
  primaryText: { color: '#FFFFFF', fontSize: 18, fontWeight: '500' },
  loginLink: { alignItems: 'flex-start', marginTop: 18 },
  loginText: { color: '#333333', fontSize: 16 },
  link: { color: '#638EF1', fontWeight: '600' },
});

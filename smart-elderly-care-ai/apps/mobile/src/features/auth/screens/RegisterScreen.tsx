// RegisterScreen.tsx – Màn hình Đăng ký linh hoạt (SĐT hoặc Email) giống mẫu TP-Link
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '../../../services/api';
import { Colors } from '../../../theme/colors';

export default function RegisterScreen({ navigation }: any) {
  // State quản lý phương thức đăng ký: 'phone' (Số điện thoại) hoặc 'email'
  const [registerMethod, setRegisterMethod] = useState<'phone' | 'email'>('phone');

  const [accountValue, setAccountValue] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // State quản lý ẩn/hiện mật khẩu
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [loading, setLoading]         = useState(false);

  const handleRegister = async () => {
    const trimmedAccount = accountValue.trim();

    if (!trimmedAccount || !password || !confirmPassword) {
      Alert.alert('Lỗi', 'Vui lòng điền đầy đủ thông tin.');
      return;
    }

    if (registerMethod === 'phone') {
      const phone = trimmedAccount.replace(/\s+/g, '');
      if (!/^\+?[0-9]{9,15}$/.test(phone)) {
        Alert.alert('Lỗi', 'Số điện thoại không hợp lệ.');
        return;
      }
    } else {
      const email = trimmedAccount;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        Alert.alert('Lỗi', 'Email không hợp lệ.');
        return;
      }
    }

    if (password !== confirmPassword) {
      Alert.alert('Lỗi', 'Mật khẩu nhập lại không khớp.');
      return;
    }

    setLoading(true);
    try {
      const payload = registerMethod === 'phone'
        ? { phone: trimmedAccount.replace(/\s+/g, ''), full_name: 'User', password, role: 'user' }
        : { email: trimmedAccount, full_name: 'User', password, role: 'user' };

      await authApi.register(payload);

      Alert.alert('Thành công', 'Đăng ký tài khoản thành công! Vui lòng đăng nhập.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (err: any) {
      const message = err.response?.data?.detail || err.response?.data?.message || 'Không thể kết nối đến máy chủ.';
      Alert.alert('Đăng ký thất bại', message);
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
          
          {/* 1. Header & Nút quay lại */}
          <View style={styles.headerSection}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary || '#0F172A'} />
            </TouchableOpacity>
            <Text style={styles.welcomeTitle}>Đăng kí tài khoản</Text>
            <Text style={styles.subtitle}>
              {registerMethod === 'phone' 
                ? 'Đăng kí tài khoản để quản lý thiết bị của bạn. Chúng tôi sẽ gửi tin nhắn kèm mã xác minh đến số điện thoại này.' 
                : 'Đăng kí tài khoản để quản lý thiết bị của bạn. Chúng tôi sẽ gửi cho bạn một email đến địa chỉ này để xác minh.'}
            </Text>
          </View>

          {/* 2. Form nhập liệu */}
          <View style={styles.formContainer}>
            
            {/* Nút chọn Vị trí / Khu vực */}
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

            {/* Ô nhập Số điện thoại hoặc Email tùy theo lựa chọn */}
            <View style={styles.inputContainer}>
              <Ionicons 
                name={registerMethod === 'phone' ? "phone-portrait-outline" : "mail-outline"} 
                size={20} 
                color="#64748B" 
                style={styles.inputIcon} 
              />
              {registerMethod === 'phone' && <Text style={styles.prefixText}>+84  </Text>}
              <TextInput
                style={styles.input}
                placeholder={registerMethod === 'phone' ? 'Số điện thoại của bạn' : 'Gmail của bạn'}
                placeholderTextColor="#94A3B8"
                value={accountValue}
                onChangeText={setAccountValue}
                keyboardType={registerMethod === 'phone' ? 'phone-pad' : 'email-address'}
                autoCapitalize="none"
              />
            </View>

            {/* Ô nhập Mật khẩu */}
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
                <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Ô Xác nhận mật khẩu */}
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
                <Ionicons name={showConfirmPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

          </View>

          {/* Phần dưới cùng: Nút Tiếp / Đăng ký & biểu tượng chuyển đổi */}
          <View>
            <View style={styles.bottomActionRow}>
              <TouchableOpacity
                onPress={() => {
                  setRegisterMethod(registerMethod === 'phone' ? 'email' : 'phone');
                  setAccountValue('');
                }}
                style={styles.switchFloatingButton}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={registerMethod === 'phone' ? 'mail-outline' : 'phone-portrait-outline'}
                  size={20}
                  color="#2563EB"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.loginButton} 
              onPress={handleRegister} 
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.loginButtonText}>{loading ? 'Đang xử lý...' : 'Tiếp'}</Text>
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
  bottomActionRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  switchFloatingButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
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
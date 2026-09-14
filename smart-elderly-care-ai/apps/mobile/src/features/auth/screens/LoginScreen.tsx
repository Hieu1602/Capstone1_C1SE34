// LoginScreen.tsx
// Màn hình Đăng nhập linh hoạt: Chọn Email hoặc Số điện thoại để nhập thông tin

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors'; // Điều chỉnh đường dẫn theme nếu cần
import { useAuthStore } from '../../../store/useVitalStore'; // Đường dẫn tới store của bạn

export default function LoginScreen({ navigation }: any) {
  const { login } = useAuthStore() as unknown as {
    login: (token: string, name: string, userId: string) => void;
  };

  // State quản lý luồng hiển thị: 'none' (hiện danh sách nút), 'email' (nhập email), 'phone' (nhập sđt)
  const [activeTab, setActiveTab] = useState<'none' | 'email' | 'phone'>('none');

  // State lưu giá trị nhập liệu
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(true);

  const DEMO_PASSWORD = '123456';
  const DEMO_EMAILS = ['demo@tp-link.com', 'ngolevinh233@gmail.com'];
  const DEMO_PHONES = ['0900000000', '0382694409'];

  const handleSelectMethod = (method: 'email' | 'phone') => {
    const defaultValue = method === 'email' ? DEMO_EMAILS[0] : DEMO_PHONES[0];
    setAccount(defaultValue);
    setPassword(DEMO_PASSWORD);
    setAgreed(true);
    setShowPassword(false);
    setActiveTab(method);
  };

  // Xử lý hành động đăng nhập
  const handleLoginAction = () => {
    if (!agreed) {
      setAgreed(true);
    }

    if (!account.trim() || !password.trim()) {
      Alert.alert('Thiếu thông tin', `Vui lòng nhập ${activeTab === 'email' ? 'Email' : 'Số điện thoại'} và Mật khẩu.`);
      return;
    }

    const normalizedAccount = account.trim();
    const isDemoLogin =
      (activeTab === 'email' &&
        DEMO_EMAILS.some((email) => normalizedAccount.toLowerCase() === email.toLowerCase()) &&
        password === DEMO_PASSWORD) ||
      (activeTab === 'phone' &&
        DEMO_PHONES.some((phone) => normalizedAccount === phone) &&
        password === DEMO_PASSWORD);

    if (isDemoLogin) {
      login('fake-jwt-token-demo', 'Demo User', 'demo-user-001');
      return;
    }

    Alert.alert(
      'Đăng nhập thất bại',
      `Tài khoản demo có thể dùng:\n- Email: ${DEMO_EMAILS.join(', ')}\n- SĐT: ${DEMO_PHONES.join(', ')}\n- Mật khẩu: ${DEMO_PASSWORD}`
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          
          {/* 1. Header: Biểu tượng & Tiêu đề Chào mừng */}
          <View style={styles.headerSection}>
            {activeTab !== 'none' ? (
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => {
                  setActiveTab('none');
                  setAccount('');
                  setPassword('');
                }}
              >
                <Ionicons name="arrow-back" size={24} color={Colors.textPrimary || '#0F172A'} />
              </TouchableOpacity>
            ) : (
              <View style={styles.appIconWrapper}>
                <Image
                  source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }}
                  style={styles.appIcon}
                />
              </View>
            )}
            <Text style={styles.welcomeTitle}>
              {activeTab === 'email' ? 'Đăng nhập Email' : activeTab === 'phone' ? 'Đăng nhập SĐT' : 'Chào mừng'}
            </Text>
          </View>

          {/* 2. Nút chọn Quốc gia / Khu vực (Chỉ hiện khi ở màn hình chính) */}
          {activeTab === 'none' && (
            <TouchableOpacity 
              style={styles.countryPickerBtn}
              activeOpacity={0.7}
              onPress={() => Alert.alert('Khu vực', 'Đã chọn: Vietnam (+84)')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="globe-outline" size={20} color={Colors.textPrimary || '#0F172A'} style={{ marginRight: 8 }} />
                <Text style={styles.countryText}>Vietnam</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary || '#64748B'} />
            </TouchableOpacity>
          )}

          {/* 3. Hiển thị tương ứng dựa vào lựa chọn của người dùng */}
          {activeTab === 'none' ? (
            /* --- GIAO DIỆN 1: Hiển thị các nút chọn phương thức --- */
            <View style={styles.methodsContainer}>
              <TouchableOpacity 
                style={styles.authButton} 
                activeOpacity={0.7}
                onPress={() => handleSelectMethod('email')}
              >
                <View style={styles.authButtonInner}>
                  <Ionicons name="mail-outline" size={20} color={Colors.textPrimary || '#0F172A'} style={styles.authIcon} />
                  <Text style={styles.authButtonText}>Email</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.authButton} 
                activeOpacity={0.7}
                onPress={() => handleSelectMethod('phone')}
              >
                <View style={styles.authButtonInner}>
                  <Ionicons name="phone-portrait-outline" size={20} color={Colors.textPrimary || '#0F172A'} style={styles.authIcon} />
                  <Text style={styles.authButtonText}>Số điện thoại</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.googleLoginButton}
                onPress={() => Alert.alert('Thông báo', 'Đăng nhập Google đang phát triển')}
                activeOpacity={0.8}
              >
                <View style={styles.googleInnerRow}>
                  <View style={styles.googleIconWrap}>
                    <Ionicons name="logo-google" size={20} color="#EA4335" />
                  </View>
                  <Text style={styles.googleButtonText}>Đăng nhập Google</Text>
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            /* --- GIAO DIỆN 2: Khung nhập Email/SĐT và Mật khẩu tương ứng --- */
            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <Ionicons 
                  name={activeTab === 'email' ? "mail-outline" : "phone-portrait-outline"} 
                  size={20} 
                  color={Colors.textSecondary || '#64748B'} 
                  style={styles.inputIcon} 
                />
                <TextInput
                  style={styles.input}
                  placeholder={activeTab === 'email' ? "Nhập địa chỉ Email" : "Nhập số điện thoại"}
                  placeholderTextColor="#94A3B8"
                  keyboardType={activeTab === 'email' ? 'email-address' : 'phone-pad'}
                  value={account}
                  onChangeText={setAccount}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary || '#64748B'} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Nhập mật khẩu"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? "eye-outline" : "eye-off-outline"}
                    size={20}
                    color={Colors.textSecondary || '#64748B'}
                  />
                </TouchableOpacity>
              </View>

              {/* Dòng Quên mật khẩu căn lề phải */}
              <TouchableOpacity 
                style={styles.forgotPasswordContainer}
                onPress={() => navigation.navigate('ForgotPassword')}
              >
                <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
              </TouchableOpacity>

              {/* Nút Đăng nhập chính */}
              <TouchableOpacity 
                style={styles.loginButton} 
                activeOpacity={0.8}
                onPress={handleLoginAction}
              >
                <Text style={styles.loginButtonText}>Đăng nhập</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 4. Link: Tạo tài khoản mới */}
          <TouchableOpacity 
            style={styles.registerLinkWrapper}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.registerLinkText}>Tạo tài khoản mới</Text>
          </TouchableOpacity>

          {/* 5. Checkbox Đồng ý điều khoản */}
          <View style={styles.termsContainer}>
            <TouchableOpacity 
              style={styles.checkbox} 
              onPress={() => setAgreed(!agreed)}
              activeOpacity={0.8}
            >
              {agreed && <View style={styles.checkboxInner} />}
            </TouchableOpacity>
            <Text style={styles.termsText}>
              Tôi đã đọc và đồng ý với thỏa thuận quyền riêng tư{' '}
              <Text 
                style={styles.linkText}
                onPress={() => Alert.alert('Chính sách bảo mật', 'Hiển thị nội dung chính sách quyền riêng tư.')}
              >
                Chính sách bảo mật
              </Text>
            </Text>
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
  appIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  appIcon: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0F172A',
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
    marginBottom: 16,
    backgroundColor: '#FAFAFA',
  },
  countryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  methodsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  authButton: {
    height: 60,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  authButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingLeft: 4,
    paddingRight: 4,
  },
  authIcon: {
    marginRight: 12,
    width: 20,
    textAlign: 'center',
  },
  authButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  formContainer: {
    gap: 12,
    marginBottom: 16,
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
  input: {
    fontSize: 15,
    color: '#0F172A',
    flex: 1,
    padding: 0,
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginTop: -4,
    marginBottom: 4,
    paddingRight: 4,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: '#2563EB',
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
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
    marginVertical: 8,
  },
  registerLinkText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#D97706',
  },
  googleLoginButton: {
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  googleInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingLeft: 4,
    paddingRight: 4,
  },
  googleIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginRight: 10,
  },
  checkboxInner: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#2563EB',
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  linkText: {
    color: '#2563EB',
    textDecorationLine: 'underline',
  },
});
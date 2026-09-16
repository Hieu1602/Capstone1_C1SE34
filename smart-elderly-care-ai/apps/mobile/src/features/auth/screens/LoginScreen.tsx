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
  const [activeTab, setActiveTab] = useState<'none' | 'phone'>('none');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(true);

  const DEMO_PASSWORD = '123456';
  const DEMO_PHONES = ['0900000000', '0382694409'];

  const handleSelectMethod = () => {
    setAccount(DEMO_PHONES[0]);
    setPassword(DEMO_PASSWORD);
    setAgreed(true);
    setShowPassword(false);
    setActiveTab('phone');
  };

  const handleLoginAction = () => {
    if (!agreed) {
      setAgreed(true);
    }

    if (!account.trim() || !password.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập số điện thoại và mật khẩu.');
      return;
    }

    const normalizedAccount = account.trim();
    const isDemoLogin =
      DEMO_PHONES.some((phone) => normalizedAccount === phone) &&
      password === DEMO_PASSWORD;

    if (isDemoLogin) {
      login('fake-jwt-token-demo', 'Demo User', 'demo-user-001');
      return;
    }

    Alert.alert(
      'Đăng nhập thất bại',
      `Tài khoản demo có thể dùng:\n- SĐT: ${DEMO_PHONES.join(', ')}\n- Mật khẩu: ${DEMO_PASSWORD}`
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
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
              {activeTab === 'phone' ? 'Đăng nhập SĐT' : 'Chào mừng'}
            </Text>
          </View>

          {activeTab === 'none' && (
            <TouchableOpacity
              style={styles.countryPickerBtn}
              activeOpacity={0.7}
              onPress={() => Alert.alert('Khu vực', 'Đã chọn: Vietnam (+84)')}
            >
              <View style={styles.countryLeftWrap}>
                <View style={styles.countryIconWrap}>
                  <Ionicons name="globe-outline" size={15} color={Colors.textPrimary || '#0F172A'} />
                </View>
                <Text style={styles.countryText}>Vietnam</Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color={Colors.textSecondary || '#64748B'} />
            </TouchableOpacity>
          )}

          {activeTab === 'none' ? (
            <View style={styles.methodsContainer}>
              <TouchableOpacity
                style={styles.authButton}
                activeOpacity={0.7}
                onPress={handleSelectMethod}
              >
                <View style={styles.authButtonInner}>
                  <Ionicons name="phone-portrait-outline" size={20} color={Colors.textPrimary || '#0F172A'} style={styles.authIcon} />
                  <Text style={styles.authButtonText}>Số điện thoại</Text>
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <Ionicons name="phone-portrait-outline" size={22} color={Colors.textSecondary || '#64748B'} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nhập số điện thoại"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  value={account}
                  onChangeText={setAccount}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={22} color={Colors.textSecondary || '#64748B'} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Nhập mật khẩu"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={Colors.textSecondary || '#64748B'} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.forgotPasswordContainer}
                onPress={() => navigation.navigate('ForgotPassword')}
              >
                <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.loginButton} activeOpacity={0.8} onPress={handleLoginAction}>
                <Text style={styles.loginButtonText}>Đăng nhập</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.registerLinkWrapper} onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerLinkText}>Tạo tài khoản mới</Text>
          </TouchableOpacity>

          <View style={styles.termsContainer}>
            <TouchableOpacity style={styles.checkbox} onPress={() => setAgreed(!agreed)} activeOpacity={0.8}>
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
    marginBottom: 5,
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
    fontSize: 30,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 44,
  },
  countryPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.2,
    borderColor: '#D9E3EE',
    borderRadius: 999,
    height: 38,
    width: '50%',
    maxWidth: 420,
    alignSelf: 'stretch',
    marginLeft: 0,
    marginTop: -82,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 100,
    backgroundColor: '#F8F9FB',
  },
  countryLeftWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start',
    marginLeft: 0,
    paddingLeft: 0,
  },
  countryIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: '#FFFFFF',
  },
  countryText: {
    fontSize: 15,
    fontWeight: '400',
    color: '#0F172A',
    textAlign: 'left',
    flex: 1,
    marginLeft: 0,
    paddingLeft: 0,
    lineHeight: 19,
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
    transform: [{ translateY: -85 }],
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
    borderWidth: 1.2,
    borderColor: '#D9E3EE',
    borderRadius: 999,
    height: 52,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'stretch',
    marginLeft: 0,
    marginTop: 0,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  inputIcon: {
    marginRight: 14,
  },
  input: {
    fontSize: 17,
    color: '#0F172A',
    flex: 1,
    padding: 0,
    lineHeight: 22,
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    width: '100%',
    marginTop: -2,
    marginBottom: 8,
    paddingRight: 14,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: '#2563EB',
    borderRadius: 30,
    minHeight: 58,
    paddingVertical: 18,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#D97706',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 4,
    width: '84%',
    alignSelf: 'center',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginRight: 10,
  },
  checkboxInner: {
    width: 9,
    height: 9,
    borderRadius: 2,
    backgroundColor: '#2563EB',
  },
  termsText: {
    flex: 1,
    fontSize: 11,
    color: '#64748B',
    lineHeight: 18,
  },
  linkText: {
    color: '#2563EB',
    textDecorationLine: 'underline',
  },
});
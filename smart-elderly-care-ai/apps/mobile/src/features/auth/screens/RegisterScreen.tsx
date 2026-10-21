// ============================================================================
// MÀN HÌNH ĐĂNG KÝ TÀI KHOẢN (REGISTER SCREEN)
// Hệ thống: Smart Elderly Care AI (SECA)
// Hỗ trợ:
//   - Đăng ký Người thân / Gia đình (User/Caregiver)
//   - Đăng ký Bác sĩ gia đình (Doctor) kèm Tự động xác minh CCHN qua Cổng Sở Y tế (Medinet)
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
  // Lựa chọn vai trò đăng ký: 'user' (Người thân) hoặc 'doctor' (Bác sĩ gia đình)
  const [accountType, setAccountType] = useState<'user' | 'doctor'>('user');

  // Trạng thái các trường thông tin cơ bản
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Trạng thái bổ sung cho Bác sĩ
  const [cchnNumber, setCchnNumber] = useState('');
  const [workplace, setWorkplace] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [verifyingCchn, setVerifyingCchn] = useState(false);
  const [cchnVerifiedInfo, setCchnVerifiedInfo] = useState<{
    valid: boolean;
    official_name?: string;
    scope_of_practice?: string;
    status?: string;
    source?: string;
    message?: string;
  } | null>(null);

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

  const startResendCountdown = () => setResendSeconds(60);

  /**
   * Tự động kiểm tra Số Chứng chỉ hành nghề (CCHN) Bác sĩ qua Cổng Sở Y tế
   */
  const handleCheckCchn = async () => {
    const cleanCchn = cchnNumber.trim();
    const cleanName = fullName.trim();

    if (!cleanName) {
      Alert.alert('Chưa nhập họ tên', 'Vui lòng nhập Họ và tên trước để đối soát với thông tin CCHN.');
      return;
    }
    if (!cleanCchn) {
      Alert.alert('Chưa nhập CCHN', 'Vui lòng nhập Số Chứng chỉ hành nghề y tế.');
      return;
    }

    setVerifyingCchn(true);
    setCchnVerifiedInfo(null);
    try {
      const response = await authApi.verifyCchn(cleanCchn, cleanName);
      const data = response.data;
      setCchnVerifiedInfo(data);

      if (data.scope_of_practice && !specialty) {
        setSpecialty(data.scope_of_practice);
      }
      if (data.workplace && !workplace) {
        setWorkplace(data.workplace);
      }

      Alert.alert('Xác minh thành công', `Bác sĩ: ${data.official_name}\nPhạm vi: ${data.scope_of_practice}\nTrạng thái: ${data.status}`);
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Không thể xác minh CCHN trên Cổng Sở Y tế.';
      setCchnVerifiedInfo({ valid: false, message: errorMsg });
      Alert.alert('Xác minh thất bại', errorMsg);
    } finally {
      setVerifyingCchn(false);
    }
  };

  /**
   * Bước 1: Kiểm tra tính hợp lệ biểu mẫu & Yêu cầu gửi mã OTP qua SMS
   */
  const handleRegister = async () => {
    const normalizedPhone = phone.trim().replace(/\s+/g, '');

    // Kiểm tra các trường bắt buộc
    if (!fullName.trim() || !normalizedPhone || !password || !confirmPassword) {
      Alert.alert('Thiếu thông tin', 'Vui lòng điền đầy đủ họ tên, số điện thoại và mật khẩu.');
      return;
    }

    // Nếu đăng ký Bác sĩ: bắt buộc có CCHN
    if (accountType === 'doctor' && !cchnNumber.trim()) {
      Alert.alert('Thiếu CCHN', 'Vui lòng nhập Số Chứng chỉ hành nghề y khoa của Bác sĩ.');
      return;
    }

    // Kiểm tra định dạng số điện thoại
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

    // Chuẩn hóa định dạng số điện thoại quốc tế (+84...)
    const formattedPhone = normalizedPhone.startsWith('0')
      ? `+84${normalizedPhone.slice(1)}`
      : normalizedPhone.startsWith('+')
        ? normalizedPhone
        : `+84${normalizedPhone}`;

    setLoading(true);
    try {
      // Nếu là Bác sĩ và chưa kiểm tra CCHN: thực hiện kiểm tra trước khi gửi OTP
      if (accountType === 'doctor' && !cchnVerifiedInfo?.valid) {
        const verifyRes = await authApi.verifyCchn(cchnNumber.trim(), fullName.trim());
        setCchnVerifiedInfo(verifyRes.data);
      }

      // Gửi yêu cầu OTP đến máy chủ SMS backend
      await authApi.requestOtp(formattedPhone);
      setStep('verify');
      startResendCountdown();
      Alert.alert('Đã gửi mã OTP', `Mã xác minh đã được gửi tới số điện thoại ${formattedPhone}.`);
    } catch (error: any) {
      Alert.alert('Không thể tiếp tục', error.response?.data?.detail || 'Không thể gửi mã xác minh. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Yêu cầu gửi lại mã xác minh OTP
   */
  const resendOtp = async () => {
    if (resendSeconds > 0) return;

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
   * Bước 2: Xác minh OTP & Đăng ký tài khoản (Người thân hoặc Bác sĩ)
   */
  const completeRegistration = async () => {
    const normalizedPhone = phone.trim().replace(/\s+/g, '');

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

      // 2. Tạo tài khoản theo vai trò đã chọn
      if (accountType === 'doctor') {
        await authApi.registerDoctor({
          phone: formattedPhone,
          full_name: fullName.trim(),
          password,
          role: 'doctor',
          otp_code: otp,
          cchn_number: cchnNumber.trim(),
          workplace: workplace.trim() || undefined,
          specialty: specialty.trim() || undefined,
        });

        Alert.alert(
          'Đăng ký Bác sĩ thành công!',
          'Chứng chỉ hành nghề đã được xác minh qua Cổng Sở Y tế. Bạn có thể đăng nhập để quản lý bệnh nhân.',
          [{ text: 'Đăng nhập ngay', onPress: () => navigation.navigate('Login') }]
        );
      } else {
        await authApi.register({
          phone: formattedPhone,
          full_name: fullName.trim() || 'Người dùng',
          password,
          role: 'user',
          otp_code: otp,
        });

        Alert.alert(
          'Đăng ký thành công',
          'Tài khoản của bạn đã được khởi tạo thành công. Vui lòng đăng nhập.',
          [{ text: 'Đăng nhập', onPress: () => navigation.navigate('Login') }]
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Đăng ký thất bại',
        error.response?.data?.detail || 'Không thể tạo tài khoản. Vui lòng kiểm tra lại thông tin.'
      );
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
                ? 'Hệ thống Smart Elderly Care AI kết nối người cao tuổi, gia đình và bác sĩ chăm sóc chuyên khoa.'
                : `Vui lòng nhập mã OTP gồm 6 chữ số được gửi tới số ${phone}.`}
            </Text>
          </View>

          {/* Chọn loại tài khoản: Người thân / Bác sĩ */}
          {step === 'form' && (
            <View style={styles.roleSelectorContainer}>
              <TouchableOpacity
                style={[
                  styles.roleTab,
                  accountType === 'user' && styles.roleTabActive,
                ]}
                onPress={() => setAccountType('user')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="people-outline"
                  size={18}
                  color={accountType === 'user' ? '#FFFFFF' : '#64748B'}
                />
                <Text
                  style={[
                    styles.roleTabText,
                    accountType === 'user' && styles.roleTabTextActive,
                  ]}
                >
                  Người thân / Gia đình
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleTab,
                  accountType === 'doctor' && styles.roleTabActiveDoctor,
                ]}
                onPress={() => setAccountType('doctor')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="medkit-outline"
                  size={18}
                  color={accountType === 'doctor' ? '#FFFFFF' : '#64748B'}
                />
                <Text
                  style={[
                    styles.roleTabText,
                    accountType === 'doctor' && styles.roleTabTextActive,
                  ]}
                >
                  Bác sĩ gia đình
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Biểu mẫu nhập liệu */}
          <View style={styles.formContainer}>
            {step === 'form' ? (
              <>
                {/* Lựa chọn quốc gia / Mã vùng */}
                <TouchableOpacity
                  style={styles.countryPickerBtn}
                  activeOpacity={0.7}
                  onPress={() => Alert.alert('Khu vực', 'Đã chọn mặc định: Việt Nam (+84)')}
                >
                  <View style={styles.countryInfoRow}>
                    <Ionicons name="location-outline" size={20} color={Colors.textPrimary || '#0F172A'} style={styles.countryIcon} />
                    <Text style={styles.countryText}>Việt Nam (+84)</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary || '#64748B'} />
                </TouchableOpacity>

                {/* Trường 1: Họ và tên người dùng / Bác sĩ */}
                <View style={styles.inputContainer}>
                  <Ionicons name="person-outline" size={20} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={accountType === 'doctor' ? 'Họ và tên Bác sĩ (trên CCHN)' : 'Họ và tên của bạn'}
                    placeholderTextColor="#94A3B8"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                  />
                </View>

                {/* Trường 2: Số điện thoại */}
                <View style={styles.inputContainer}>
                  <Ionicons name="phone-portrait-outline" size={20} color="#64748B" style={styles.inputIcon} />
                  <Text style={styles.prefixText}>+84 </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Số điện thoại nhận OTP"
                    placeholderTextColor="#94A3B8"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                  />
                </View>

                {/* KHU VỰC BỔ SUNG DÀNH RIÊNG CHO BÁC SĨ */}
                {accountType === 'doctor' && (
                  <View style={styles.doctorSection}>
                    <View style={styles.doctorHeaderRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="ribbon-outline" size={18} color="#0D9488" style={{ marginRight: 6 }} />
                        <Text style={styles.doctorSectionTitle}>Thông tin Chứng chỉ hành nghề</Text>
                      </View>
                    </View>

                    {/* Ô nhập Số CCHN & Nút Tra cứu */}
                    <View style={styles.cchnInputRow}>
                      <View style={[styles.inputContainer, { flex: 1, marginBottom: 0 }]}>
                        <Ionicons name="document-text-outline" size={20} color="#0D9488" style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder="Số CCHN (VD: 001234/HCM-CCHN)"
                          placeholderTextColor="#94A3B8"
                          value={cchnNumber}
                          onChangeText={(val) => {
                            setCchnNumber(val);
                            setCchnVerifiedInfo(null);
                          }}
                          autoCapitalize="characters"
                        />
                      </View>
                      <TouchableOpacity
                        style={styles.verifyCchnBtn}
                        onPress={handleCheckCchn}
                        disabled={verifyingCchn}
                      >
                        {verifyingCchn ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.verifyCchnBtnText}>Tra cứu</Text>
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Thẻ hiển thị kết quả kiểm tra CCHN */}
                    {cchnVerifiedInfo && (
                      <View
                        style={[
                          styles.cchnBadge,
                          cchnVerifiedInfo.valid ? styles.cchnBadgeSuccess : styles.cchnBadgeError,
                        ]}
                      >
                        <Ionicons
                          name={cchnVerifiedInfo.valid ? 'checkmark-circle' : 'alert-circle'}
                          size={20}
                          color={cchnVerifiedInfo.valid ? '#059669' : '#DC2626'}
                        />
                        <View style={{ marginLeft: 8, flex: 1 }}>
                          <Text
                            style={[
                              styles.cchnBadgeTitle,
                              { color: cchnVerifiedInfo.valid ? '#065F46' : '#991B1B' },
                            ]}
                          >
                            {cchnVerifiedInfo.valid ? 'CCHN Hợp lệ & Đang hoạt động' : 'Không đủ điều kiện'}
                          </Text>
                          {cchnVerifiedInfo.valid ? (
                            <>
                              <Text style={styles.cchnBadgeDetail}>
                                • Người đứng tên: {cchnVerifiedInfo.official_name}
                              </Text>
                              <Text style={styles.cchnBadgeDetail}>
                                • Chuyên môn: {cchnVerifiedInfo.scope_of_practice}
                              </Text>
                            </>
                          ) : (
                            <Text style={styles.cchnBadgeDetail}>{cchnVerifiedInfo.message}</Text>
                          )}
                        </View>
                      </View>
                    )}

                    {/* Nơi công tác */}
                    <View style={styles.inputContainer}>
                      <Ionicons name="business-outline" size={20} color="#64748B" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Nơi công tác (Bệnh viện / Phòng khám)"
                        placeholderTextColor="#94A3B8"
                        value={workplace}
                        onChangeText={setWorkplace}
                      />
                    </View>
                  </View>
                )}

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
              style={[
                styles.loginButton,
                accountType === 'doctor' && styles.doctorButton,
                loading && { opacity: 0.7 },
              ]}
              onPress={step === 'form' ? handleRegister : completeRegistration}
              disabled={loading}
              activeOpacity={0.88}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.loginButtonText}>
                  {step === 'form'
                    ? (accountType === 'doctor' ? 'Tiếp tục đăng ký Bác sĩ' : 'Tiếp tục')
                    : 'Xác nhận kích hoạt tài khoản'}
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
    marginBottom: 16,
  },
  backButton: {
    height: 38,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  welcomeTitle: {
    color: '#0F172A',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
  },
  roleSelectorContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  roleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  roleTabActive: {
    backgroundColor: Colors.primary || '#0284C7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  roleTabActiveDoctor: {
    backgroundColor: '#0D9488',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  roleTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  roleTabTextActive: {
    color: '#FFFFFF',
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
    marginBottom: 2,
  },
  countryInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countryIcon: {
    marginRight: 10,
  },
  countryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0F172A',
  },
  inputContainer: {
    minHeight: 50,
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
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginRight: 4,
  },
  input: {
    flex: 1,
    color: '#0F172A',
    fontSize: 15,
    padding: 0,
    borderWidth: 0,
  },
  doctorSection: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  doctorHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  doctorSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F766E',
  },
  cchnInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  verifyCchnBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyCchnBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  cchnBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  cchnBadgeSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  cchnBadgeError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  cchnBadgeTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  cchnBadgeDetail: {
    fontSize: 12,
    color: '#374151',
    lineHeight: 16,
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
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
  },
  doctorButton: {
    backgroundColor: '#0D9488',
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

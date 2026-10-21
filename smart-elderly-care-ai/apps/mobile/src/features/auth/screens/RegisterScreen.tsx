// ============================================================================
// MÀN HÌNH ĐĂNG KÝ TÀI KHOẢN (REGISTER SCREEN)
// Dự án: Smart Elderly Care AI (SECA)
// Thiết kế: Chuẩn UX/UI Healthtech hiện đại, bố cục cân đối, thuận mắt người dùng
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
import { authApi } from '../../../services/api';
import { Colors } from '../../../theme/colors';

export default function RegisterScreen({ route, navigation }: any) {
  // Trạng thái màn hình:
  // - 'select_role': Màn hình chọn vai trò trực quan (Người thân vs Bác sĩ)
  // - 'form': Màn hình form điền thông tin tương ứng của vai trò đã chọn
  // - 'verify': Màn hình xác thực OTP SMS
  const initialRole: 'user' | 'doctor' = route?.params?.role === 'doctor' ? 'doctor' : 'user';
  const [step, setStep] = useState<'select_role' | 'form' | 'verify'>(
    route?.params?.role ? 'form' : 'select_role'
  );
  const [accountType, setAccountType] = useState<'user' | 'doctor'>(initialRole);

  // Form states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Doctor-specific states
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

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // OTP & Loading states
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = setInterval(() => {
      setResendSeconds((prev) => Math.max(prev - 1, 0));
    }, 1000);
  return () => clearInterval(timer);
  }, [resendSeconds]);

  const startResendCountdown = () => setResendSeconds(60);

  const handleChooseRole = (role: 'user' | 'doctor') => {
    setAccountType(role);
    setStep('form');
  };

  const handleCheckCchn = async () => {
    const cleanCchn = cchnNumber.trim();
    const cleanName = fullName.trim();

    if (!cleanName) {
      Alert.alert('Chưa nhập họ tên', 'Vui lòng nhập Họ và tên Bác sĩ trước để đối soát với thông tin CCHN.');
      return;
    }
    if (!cleanCchn) {
      Alert.alert('Chưa nhập CCHN', 'Vui lòng nhập Số Chứng chỉ hành nghề y tế (VD: 001234/HCM-CCHN).');
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

      Alert.alert(
        'Xác minh thành công',
        `Bác sĩ: ${data.official_name || cleanName}\nPhạm vi: ${data.scope_of_practice || 'Khám chữa bệnh'}\nTrạng thái: ${data.status || 'Đang hoạt động'}`
      );
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Không thể xác minh CCHN trên Cổng Sở Y tế.';
      setCchnVerifiedInfo({ valid: false, message: errorMsg });
      Alert.alert('Xác minh thất bại', errorMsg);
    } finally {
      setVerifyingCchn(false);
    }
  };

  const handleRegister = async () => {
    const normalizedPhone = phone.trim().replace(/\s+/g, '');

    if (!fullName.trim() || !normalizedPhone || !password || !confirmPassword) {
      Alert.alert('Thiếu thông tin', 'Vui lòng điền đầy đủ họ tên, số điện thoại và mật khẩu.');
      return;
    }

    if (accountType === 'doctor' && !cchnNumber.trim()) {
      Alert.alert('Thiếu CCHN', 'Vui lòng nhập Số Chứng chỉ hành nghề y khoa của Bác sĩ.');
      return;
    }

    if (!/^\+?[0-9]{9,15}$/.test(normalizedPhone)) {
      Alert.alert('Lỗi', 'Số điện thoại không hợp lệ. Vui lòng kiểm tra lại.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Mật khẩu quá ngắn', 'Mật khẩu cần có ít nhất 6 ký tự để đảm bảo an toàn.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Mật khẩu không khớp', 'Mật khẩu và xác nhận lại mật khẩu không trùng khớp.');
      return;
    }

    const formattedPhone = normalizedPhone.startsWith('0')
      ? `+84${normalizedPhone.slice(1)}`
      : normalizedPhone.startsWith('+')
        ? normalizedPhone
        : `+84${normalizedPhone}`;

    setLoading(true);
    try {
      if (accountType === 'doctor' && !cchnVerifiedInfo?.valid) {
        try {
          const verifyRes = await authApi.verifyCchn(cchnNumber.trim(), fullName.trim());
          setCchnVerifiedInfo(verifyRes.data);
        } catch (_) {}
      }

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
      Alert.alert('Đã gửi lại mã', 'Mã xác minh mới đã được gửi. Vui lòng kiểm tra tin nhắn.');
    } catch (error: any) {
      Alert.alert('Không gửi được mã', error.response?.data?.detail || 'Không thể kết nối đến máy chủ SMS.');
    } finally {
      setLoading(false);
    }
  };

  const completeRegistration = async () => {
    const normalizedPhone = phone.trim().replace(/\s+/g, '');

    if (otp.length !== 6) {
      Alert.alert('Mã không hợp lệ', 'Vui lòng nhập đủ 6 chữ số mã xác thực OTP.');
      return;
    }

    const formattedPhone = normalizedPhone.startsWith('0')
      ? `+84${normalizedPhone.slice(1)}`
      : normalizedPhone.startsWith('+')
        ? normalizedPhone
        : `+84${normalizedPhone}`;

    setLoading(true);
    try {
      await authApi.verifyOtp(formattedPhone, otp);

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
          'Tài khoản Bác sĩ gia đình đã được khởi tạo. Bạn có thể đăng nhập để bắt đầu kết nối bệnh nhân.',
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
          'Đăng ký thành công!',
          'Tài khoản của bạn đã được khởi tạo thành công. Vui lòng đăng nhập để bắt đầu.',
          [{ text: 'Đăng nhập ngay', onPress: () => navigation.navigate('Login') }]
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

  const handleBack = () => {
    if (step === 'verify') {
      setStep('form');
      return;
    }
    if (step === 'form') {
      setStep('select_role');
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Login');
    }
  };

  // BƯỚC 1: MÀN HÌNH CHỌN VAI TRÒ (CHUẨN UX/UI MOBILE APP & DESIGN SYSTEM SECA)
  // =========================================================================
  if (step === 'select_role') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.selectRoleScreen}>
          {/* Top Bar: Nút quay lại & Badge bước */}
          <View style={styles.selectRoleTopBar}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Quay lại"
            >
              <Ionicons name="arrow-back" size={24} color="#0F172A" />
            </TouchableOpacity>

            <View style={styles.stepBadge}>
              <View style={styles.stepBadgeDot} />
              <Text style={styles.stepBadgeText}>BƯỚC 1 / 2 • CHỌN VAI TRÒ</Text>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.selectRoleScrollContent}
            bounces={false}
          >
            {/* Header Tiêu đề */}
            <View style={styles.selectRoleHeaderBox}>
              <Text style={styles.selectRoleTitle}>
                Bạn muốn đăng ký với vai trò nào?
              </Text>
              <Text style={styles.selectRoleSubtitle}>
                Chọn vai trò phù hợp để hệ thống thiết lập giao diện và công cụ tối ưu cho bạn.
              </Text>
            </View>

            {/* 2 Thẻ chọn vai trò */}
            <View style={styles.selectRoleCardsList}>
              {/* Thẻ 1: Người thân / Gia đình */}
              <TouchableOpacity
                style={[
                  styles.modernRoleCard,
                  accountType === 'user' && styles.modernRoleCardActive,
                ]}
                activeOpacity={0.88}
                onPress={() => setAccountType('user')}
              >
                <View
                  style={[
                    styles.modernRoleIconBox,
                    { backgroundColor: accountType === 'user' ? '#FFEDD5' : '#FFF7ED' },
                  ]}
                >
                  <Ionicons name="people" size={26} color={Colors.primary} />
                </View>

                <View style={styles.modernRoleTextBox}>
                  <View style={styles.modernRoleTitleRow}>
                    <Text style={styles.modernRoleTitle}>Người thân / Gia đình</Text>
                    {accountType === 'user' && (
                      <View style={styles.activePillTag}>
                        <Text style={styles.activePillTagText}>Đang chọn</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.modernRoleDesc}>
                    Theo dõi sức khỏe và nhận cảnh báo chăm sóc người thân trong gia đình.
                  </Text>
                </View>

                <View
                  style={[
                    styles.modernRadioCircle,
                    accountType === 'user' && styles.modernRadioCircleActive,
                  ]}
                >
                  {accountType === 'user' && (
                    <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                  )}
                </View>
              </TouchableOpacity>

              {/* Thẻ 2: Bác sĩ gia đình */}
              <TouchableOpacity
                style={[
                  styles.modernRoleCard,
                  accountType === 'doctor' && styles.modernRoleCardActive,
                ]}
                activeOpacity={0.88}
                onPress={() => setAccountType('doctor')}
              >
                <View
                  style={[
                    styles.modernRoleIconBox,
                    { backgroundColor: accountType === 'doctor' ? '#D1FAE5' : '#ECFDF5' },
                  ]}
                >
                  <Ionicons name="medical" size={24} color="#059669" />
                </View>

                <View style={styles.modernRoleTextBox}>
                  <View style={styles.modernRoleTitleRow}>
                    <Text style={styles.modernRoleTitle}>Bác sĩ gia đình</Text>
                    {accountType === 'doctor' && (
                      <View style={[styles.activePillTag, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                        <Text style={[styles.activePillTagText, { color: '#059669' }]}>Đang chọn</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.modernRoleDesc}>
                    Theo dõi hồ sơ bệnh nhân, tư vấn và hỗ trợ chăm sóc sức khỏe từ xa.
                  </Text>
                </View>

                <View
                  style={[
                    styles.modernRadioCircle,
                    accountType === 'doctor' && styles.modernRadioCircleActive,
                  ]}
                >
                  {accountType === 'doctor' && (
                    <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                  )}
                </View>
              </TouchableOpacity>
            </View>

            {/* Huy hiệu bảo mật y tế */}
            <View style={styles.securityInfoBanner}>
              <Ionicons name="shield-checkmark" size={18} color="#0D9488" />
              <Text style={styles.securityInfoBannerText}>
                Bảo mật dữ liệu y tế theo chuẩn Bộ Y tế & HIPAA
              </Text>
            </View>

            {/* Khoảng trống đẩy nút xuống */}
            <View style={{ flex: 1, minHeight: 48 }} />

            {/* Nút Tiếp tục chuẩn phong cách SECA */}
            <TouchableOpacity
              style={styles.mobileContinueBtn}
              activeOpacity={0.88}
              onPress={() => handleChooseRole(accountType)}
            >
              <Text style={styles.mobileContinueBtnText}>Tiếp tục</Text>
            </TouchableOpacity>

            {/* Dòng liên kết sang Đăng nhập */}
            <View style={styles.mobileLoginLinkRow}>
              <Text style={styles.mobileLoginLinkText}>Đã có tài khoản? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.mobileLoginLinkHighlight}>Đăng nhập</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header & Nút Quay lại */}
          <View style={styles.headerSection}>
            <TouchableOpacity
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Quay lại"
              onPress={handleBack}
            >
              <Ionicons name="arrow-back" size={24} color="#0F172A" />
            </TouchableOpacity>

            {/* Badge bước thực hiện */}
            <View style={styles.stepBadge}>
              <View style={styles.stepBadgeDot} />
              <Text style={styles.stepBadgeText}>
                {step === 'form'
                  ? 'BƯỚC 2 / 2 • NHẬP THÔNG TIN'
                  : 'XÁC THỰC BẢO MẬT OTP'}
              </Text>
            </View>

            <Text style={styles.welcomeTitle}>
              {step === 'verify'
                ? 'Xác minh số điện thoại'
                : accountType === 'doctor'
                  ? 'Đăng ký Bác sĩ gia đình'
                  : 'Đăng ký tài khoản'}
            </Text>

            <Text style={styles.subtitle}>
              {step === 'verify'
                ? `Vui lòng nhập mã OTP gồm 6 chữ số được gửi tới số ${phone}.`
                : accountType === 'doctor'
                  ? 'Dành cho Bác sĩ & Chuyên gia y tế đồng hành chăm sóc sức khỏe người cao tuổi.'
                  : 'Hệ thống Smart Elderly Care AI kết nối người cao tuổi, gia đình và bác sĩ chăm sóc chuyên khoa.'}
            </Text>
          </View>


          {/* ========================================================================= */}
          {/* MÀN HÌNH 2: FORM ĐĂNG KÝ CỦA ROLE ĐÃ CHỌN                                */}
          {/* ========================================================================= */}
          {step === 'form' && (
            <View style={styles.formContainer}>
              {/* Thanh hiển thị vai trò hiện tại kèm nút đổi vai trò */}
              <View style={styles.currentRoleBar}>
                <View
                  style={[
                    styles.currentRoleBadge,
                    { backgroundColor: accountType === 'doctor' ? '#059669' : '#FF7A00' },
                  ]}
                >
                  <Ionicons
                    name={accountType === 'doctor' ? 'medical' : 'people'}
                    size={15}
                    color="#FFFFFF"
                  />
                  <Text style={styles.currentRoleText}>
                    {accountType === 'doctor' ? 'Bác sĩ gia đình' : 'Người thân / Gia đình'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.changeRoleBtn}
                  onPress={() => setStep('select_role')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.changeRoleBtnText}>Đổi vai trò khác</Text>
                  <Ionicons name="swap-horizontal" size={14} color="#EA580C" />
                </TouchableOpacity>
              </View>

              {/* 1. Chọn Quốc gia / Mã vùng */}
              <TouchableOpacity
                style={styles.countryPickerBtn}
                activeOpacity={0.7}
                onPress={() => Alert.alert('Khu vực', 'Đã chọn mặc định: Việt Nam (+84)')}
              >
                <View style={styles.countryInfoRow}>
                  <Ionicons name="location-outline" size={20} color="#0F172A" style={styles.countryIcon} />
                  <Text style={styles.countryText}>Việt Nam (+84)</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#64748B" />
              </TouchableOpacity>

              {/* 2. Họ và tên */}
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={accountType === 'doctor' ? 'Họ và tên Bác sĩ (trên CCHN)' : 'Họ và tên của bạn'}
                  placeholderTextColor="#94A3B8"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              </View>

              {/* CÁC TRƯỜNG DÀNH RIÊNG CHO ROLE: BÁC SĨ GIA ĐÌNH */}
              {accountType === 'doctor' && (
                <View style={styles.doctorCardSection}>
                  <View style={styles.doctorHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="ribbon-outline" size={18} color="#059669" style={{ marginRight: 6 }} />
                      <Text style={styles.doctorSectionTitle}>Thông tin Chứng chỉ hành nghề y tế</Text>
                    </View>
                  </View>

                  {/* Số CCHN & Nút Tra cứu */}
                  <View style={styles.cchnInputRow}>
                    <View style={[styles.inputContainer, { flex: 1, marginBottom: 0 }]}>
                      <Ionicons name="document-text-outline" size={20} color="#059669" style={styles.inputIcon} />
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
                      activeOpacity={0.8}
                    >
                      {verifyingCchn ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.verifyCchnBtnText}>Tra cứu</Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Thẻ hiển thị kết quả xác minh CCHN */}
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
                          {cchnVerifiedInfo.valid ? 'CCHN Hợp lệ (Sở Y tế TP.HCM)' : 'Không đủ điều kiện'}
                        </Text>
                        {cchnVerifiedInfo.valid ? (
                          <>
                            <Text style={styles.cchnBadgeDetail}>
                              • Người sở hữu: {cchnVerifiedInfo.official_name || fullName}
                            </Text>
                            <Text style={styles.cchnBadgeDetail}>
                              • Phạm vi: {cchnVerifiedInfo.scope_of_practice || 'Khám chữa bệnh đa khoa'}
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
                    <Ionicons name="business-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Nơi công tác (Bệnh viện / Phòng khám)"
                      placeholderTextColor="#94A3B8"
                      value={workplace}
                      onChangeText={setWorkplace}
                    />
                  </View>

                  {/* Chuyên khoa */}
                  <View style={styles.inputContainer}>
                    <Ionicons name="fitness-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Chuyên khoa (Lão khoa, Tim mạch, Đa khoa...)"
                      placeholderTextColor="#94A3B8"
                      value={specialty}
                      onChangeText={setSpecialty}
                    />
                  </View>
                </View>
              )}

              {/* 3. Số điện thoại nhận OTP */}
              <View style={styles.inputContainer}>
                <Ionicons name="phone-portrait-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
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

              {/* 4. Mật khẩu */}
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Mật khẩu (tối thiểu 6 ký tự)"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* 5. Xác nhận lại mật khẩu */}
              <View style={styles.inputContainer}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Xác nhận lại mật khẩu"
                  placeholderTextColor="#94A3B8"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <Ionicons name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* Nút bấm Tiếp tục (Màu cam) */}
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.88}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Tiếp tục</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ========================================================================= */}
          {/* MÀN HÌNH 3: XÁC MINH MÃ OTP                                               */}
          {/* ========================================================================= */}
          {step === 'verify' && (
            <View style={styles.formContainer}>
              <View style={styles.verifyContainer}>
                <View style={styles.inputContainer}>
                  <Ionicons name="key-outline" size={20} color="#FF7A00" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { fontSize: 20, letterSpacing: 8, textAlign: 'center', fontWeight: '700' }]}
                    placeholder="• • • • • •"
                    placeholderTextColor="#CBD5E1"
                    value={otp}
                    onChangeText={(val) => setOtp(val.replace(/\D/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                  />
                </View>

                <TouchableOpacity
                  style={styles.resendButton}
                  onPress={resendOtp}
                  disabled={resendSeconds > 0 || loading}
                >
                  <Text style={[styles.resendText, resendSeconds > 0 && styles.resendDisabled]}>
                    {resendSeconds > 0 ? `Gửi lại mã sau ${resendSeconds}s` : 'Gửi lại mã xác minh OTP'}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={completeRegistration}
                disabled={loading}
                activeOpacity={0.88}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Xác nhận & Hoàn tất</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Footer chuyển sang Đăng nhập */}
          <View style={styles.footerContainer}>
            <TouchableOpacity
              style={styles.loginLink}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.7}
            >
              <Text style={styles.loginText}>
                Tôi đã có tài khoản. <Text style={styles.loginHighlight}>Đăng nhập</Text>
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
    backgroundColor: '#FAFAFC',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'android' ? 24 : 12,
    paddingBottom: 36,
  },
  scrollContentSelectRole: {
    minHeight: '100%',
    justifyContent: 'space-between',
  },
  headerSection: {
    marginBottom: 20,
  },
  backButton: {
    height: 40,
    width: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  stepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 10,
    gap: 6,
  },
  stepBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF7A00',
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EA580C',
    letterSpacing: 0.5,
  },
  welcomeTitle: {
    color: '#0F172A',
    fontSize: 25,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 13.5,
    lineHeight: 20,
  },

  // ==========================================
  // THIẾT KẾ CARD CHỌN VAI TRÒ (THUẬN MẮT & SANG TRỌNG)
  // ==========================================
  selectRoleWrapper: {
    gap: 16,
    marginBottom: 20,
  },
  roleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  roleCardUser: {
    borderColor: '#FED7AA',
  },
  roleCardDoctor: {
    borderColor: '#BBF7D0',
  },
  roleCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  roleIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleTagUser: {
    backgroundColor: '#FFF7ED',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  roleTagUserText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#EA580C',
  },
  roleTagDoctor: {
    backgroundColor: '#F0FDF4',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  roleTagDoctorText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#059669',
  },
  roleCardBody: {
    gap: 6,
  },
  roleCardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roleCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  arrowCircleUser: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF7A00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowCircleDoctor: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCardDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 8,
  },
  featuresList: {
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureCheckIcon: {
    marginRight: 8,
  },
  featureText: {
    fontSize: 12.5,
    color: '#334155',
    fontWeight: '500',
    flex: 1,
  },
  securityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
    marginTop: 6,
  },
  securityBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F766E',
  },

  // ==========================================
  // FORM ĐĂNG KÝ
  // ==========================================
  currentRoleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  currentRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 6,
  },
  currentRoleText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  changeRoleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  changeRoleBtnText: {
    color: '#EA580C',
    fontSize: 12.5,
    fontWeight: '600',
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
    paddingVertical: 13,
    backgroundColor: '#FFFFFF',
  },
  countryInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countryIcon: {
    marginRight: 10,
  },
  countryText: {
    fontSize: 14.5,
    fontWeight: '500',
    color: '#0F172A',
  },
  inputContainer: {
    minHeight: 52,
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
    fontSize: 14.5,
    paddingVertical: 8,
  },

  doctorCardSection: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
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
    color: '#059669',
  },
  cchnInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  verifyCchnBtn: {
    backgroundColor: '#059669',
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
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  cchnBadgeDetail: {
    fontSize: 12,
    color: '#374151',
    lineHeight: 16,
  },

  verifyContainer: {
    gap: 14,
    paddingVertical: 10,
  },
  resendButton: {
    alignItems: 'center',
    marginTop: 8,
  },
  resendText: {
    color: '#EA580C',
    fontSize: 14,
    fontWeight: '600',
  },
  resendDisabled: {
    color: '#94A3B8',
  },

  submitButton: {
    backgroundColor: '#FF7A00',
    borderRadius: 26,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
    marginTop: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // FOOTER ĐĂNG NHẬP
  footerContainer: {
    marginTop: 'auto',
    paddingTop: 20,
  },
  loginLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  loginText: {
    color: '#64748B',
    fontSize: 14,
  },
    loginHighlight: {
    color: '#FF7A00',
    fontWeight: '700',
  },

  // ==========================================
  // GIAO DIá»†N CHá»ŒN VAI TRÃ’ CHUáº¨N MOBILE APP
  // ==========================================
  selectRoleScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  selectRoleTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  selectRoleScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  selectRoleHeaderBox: {
    marginTop: 8,
    marginBottom: 24,
  },
  selectRoleTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 34,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  selectRoleSubtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  selectRoleCardsList: {
    gap: 16,
    marginBottom: 20,
  },
  modernRoleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  modernRoleCardActive: {
    borderColor: Colors.primary,
    backgroundColor: '#FFFBF7',
    shadowColor: Colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  modernRoleIconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  modernRoleTextBox: {
    flex: 1,
    marginRight: 10,
  },
  modernRoleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  modernRoleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  activePillTag: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  activePillTagText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.primary,
  },
  modernRoleDesc: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
  },
  modernRadioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernRadioCircleActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  securityInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
    marginTop: 4,
  },
  securityInfoBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F766E',
  },
  mobileContinueBtn: {
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  mobileContinueBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  mobileLoginLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  mobileLoginLinkText: {
    fontSize: 14,
    color: '#64748B',
  },
  mobileLoginLinkHighlight: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
});

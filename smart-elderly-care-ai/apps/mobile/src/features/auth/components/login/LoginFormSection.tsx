import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../../theme/colors';
import { LocalizedText, LocalizedTextInput } from '../../../../i18n/LocalizedComponents';

interface LoginFormSectionProps {
  phone: string;
  onChangePhone: (value: string) => void;
  password: string;
  onChangePassword: (value: string) => void;
  showPassword: boolean;
  onToggleShowPassword: () => void;
  loading: boolean;
  errorMessage: string | null;
  isAgreed: boolean;
  onToggleAgree: () => void;
  onSubmit: () => void;
  onForgotPassword: () => void;
  onNavigateRegister: () => void;
  onOpenLegal?: (type: 'terms' | 'privacy') => void;
}

export const LoginFormSection: React.FC<LoginFormSectionProps> = ({
  phone,
  onChangePhone,
  password,
  onChangePassword,
  showPassword,
  onToggleShowPassword,
  loading,
  errorMessage,
  isAgreed,
  onToggleAgree,
  onSubmit,
  onForgotPassword,
  onNavigateRegister,
  onOpenLegal,
}) => {
  return (
    <View style={styles.bottomSection}>
      <View style={styles.logoBadgeContainer}>
        <Image
          source={require('../../../../../assets/logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>

      {/* Hero */}
      <LocalizedText style={styles.heroTitle}>
        {'Chào mừng bạn trở lại\nĐăng nhập ngay'}
      </LocalizedText>

      <LocalizedText style={styles.heroSubtitle}>
        Hệ sinh thái AI bảo vệ sức khỏe & an toàn người cao tuổi 24/7
      </LocalizedText>

      {/* Thông báo lỗi / trạng thái */}
      {errorMessage ? (
        <View style={styles.noticeBox} accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={18} color="#B42318" />
          <LocalizedText style={styles.noticeText}>{errorMessage}</LocalizedText>
        </View>
      ) : null}

      {/* Card các ô nhập liệu */}
      <View style={styles.formCard}>
        {/* Input 1: Số điện thoại */}
        <View style={styles.inputWrap}>
          <View style={styles.inputPrefix}>
            <Ionicons name="call-outline" size={18} color="#64748B" />
            <LocalizedText style={styles.prefixText}>+84</LocalizedText>
          </View>
          <LocalizedTextInput
            style={styles.textInput}
            placeholder="Nhập số điện thoại"
            placeholderTextColor="#94A3B8"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={onChangePhone}
            autoCapitalize="none"
          />
        </View>

        {/* Input 2: Mật khẩu */}
        <View style={styles.inputWrap}>
          <View style={styles.inputPrefix}>
            <Ionicons name="lock-closed-outline" size={18} color="#64748B" />
          </View>
          <LocalizedTextInput
            style={styles.textInput}
            placeholder="Mật khẩu"
            placeholderTextColor="#94A3B8"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={onChangePassword}
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={onToggleShowPassword}
          >
            <Ionicons
              name={showPassword ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color="#64748B"
            />
          </TouchableOpacity>
        </View>

        {/* Liên kết Quên mật khẩu */}
        <TouchableOpacity
          style={styles.forgotBtn}
          onPress={onForgotPassword}
        >
          <LocalizedText style={styles.forgotText}>Quên mật khẩu?</LocalizedText>
        </TouchableOpacity>
      </View>

      {/* Nút hành động Đăng nhập chính */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          style={[styles.btnLogin, (loading || !isAgreed) && styles.btnDisabled]}
          activeOpacity={isAgreed ? 0.88 : 0.7}
          onPress={onSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <LocalizedText style={styles.btnLoginText}>Đăng nhập</LocalizedText>
          )}
        </TouchableOpacity>
      </View>

      {/* Hàng chuyển sang Đăng ký */}
      <View style={styles.switchAuthRow}>
        <LocalizedText style={styles.switchAuthText}>Chưa có tài khoản? </LocalizedText>
        <TouchableOpacity onPress={onNavigateRegister}>
          <LocalizedText style={styles.switchAuthLink}>Đăng ký ngay</LocalizedText>
        </TouchableOpacity>
      </View>

      {/* Điều khoản pháp lý ở chân trang với checkbox hình vuông */}
      <View style={styles.termsContainer}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onToggleAgree}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isAgreed ? 'checkbox' : 'square-outline'}
            size={20}
            color={isAgreed ? Colors.primary : '#94A3B8'}
            style={styles.checkboxIcon}
          />
        </TouchableOpacity>
        <Text style={styles.termsNoticeText}>
          <Text onPress={onToggleAgree}>
            Bằng cách tiếp tục, bạn đồng ý với{' '}
          </Text>
          <Text
            style={styles.termsLink}
            onPress={() => onOpenLegal?.('terms')}
          >
            Điều khoản dịch vụ
          </Text>{' '}
          <Text onPress={onToggleAgree}>
            của SECA và xác nhận rằng bạn đã đọc{' '}
          </Text>
          <Text
            style={styles.termsLink}
            onPress={() => onOpenLegal?.('privacy')}
          >
            Chính sách quyền riêng tư
          </Text>{' '}
          <Text onPress={onToggleAgree}>
            của chúng tôi.
          </Text>
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bottomSection: {
    paddingHorizontal: 28,
    paddingTop: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  logoBadgeContainer: {
    marginBottom: 14,
  },
  logoImage: {
    width: 96,
    height: 64,
  },
  heroTitle: {
    fontSize: 27,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 35,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  noticeBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 16,
    gap: 8,
    backgroundColor: '#FEF3F2',
    borderWidth: 1,
    borderColor: '#FECDCA',
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#B42318',
    fontWeight: '600',
  },
  formCard: {
    width: '100%',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 14,
  },
  inputPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    gap: 4,
  },
  prefixText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    borderWidth: 0,
    outlineWidth: 0,
  },
  eyeBtn: {
    padding: 6,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 14,
    marginTop: -4,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  actionButtonsContainer: {
    width: '100%',
    gap: 12,
    marginTop: 4,
    marginBottom: 18,
  },
  btnLogin: {
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnLoginText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  switchAuthRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  switchAuthText: {
    fontSize: 14,
    color: '#64748B',
  },
  switchAuthLink: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
    marginTop: 4,
  },
  checkboxIcon: {
    marginRight: 8,
    marginTop: -1,
  },
  termsNoticeText: {
    flex: 1,
    fontSize: 11,
    color: '#334155',
    textAlign: 'left',
    lineHeight: 16,
  },
  termsLink: {
    fontWeight: '700',
    color: '#0F172A',
    textDecorationLine: 'underline',
  },
});


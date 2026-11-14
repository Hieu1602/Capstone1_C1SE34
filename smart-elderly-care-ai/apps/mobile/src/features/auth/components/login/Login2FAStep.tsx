import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../../theme/colors';
import { LocalizedText } from '../../../../i18n/LocalizedComponents';

interface Login2FAStepProps {
  phone: string;
  otp: string;
  setOtp: (val: string) => void;
  resendSeconds: number;
  loading: boolean;
  errorMessage?: string | null;
  onResendOtp: () => void;
  onSubmit: () => void;
  onBack: () => void;
}

export const Login2FAStep: React.FC<Login2FAStepProps> = ({
  phone,
  otp,
  setOtp,
  resendSeconds,
  loading,
  errorMessage,
  onResendOtp,
  onSubmit,
  onBack,
}) => {
  const inputRef = useRef<any>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  const handleContainerPress = () => {
    inputRef.current?.focus();
  };

  const maskedPhone =
    phone.length >= 6
      ? `${phone.slice(0, 4)}***${phone.slice(-3)}`
      : phone;

  return (
    <View style={styles.bottomSection}>
      {/* Icon Shield Badge */}
      <View style={styles.badgeContainer}>
        <View style={styles.iconCircle}>
          <Ionicons name="shield-checkmark" size={32} color="#059669" />
        </View>
      </View>

      {/* Hero Title & Subtitle */}
      <LocalizedText style={styles.heroTitle}>
        {'Xác minh bảo mật 2 bước\n(2FA qua SMS OTP)'}
      </LocalizedText>

      <LocalizedText style={styles.heroSubtitle}>
        Tài khoản của bạn đã kích hoạt bảo vệ 2 lớp. Vui lòng nhập mã OTP 6 số đã được gửi tới số điện thoại {maskedPhone}.
      </LocalizedText>

      {/* Thông báo lỗi nếu nhập sai */}
      {errorMessage ? (
        <View style={styles.noticeBox} accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={18} color="#B42318" />
          <View style={{ flex: 1 }}>
            <LocalizedText style={styles.noticeText}>{errorMessage}</LocalizedText>
          </View>
        </View>
      ) : null}

      {/* 6 ô nhập mã OTP */}
      <Pressable onPress={handleContainerPress} style={styles.otpRow}>
        {[0, 1, 2, 3, 4, 5].map((index) => {
          const char = otp[index] || '';
          const isActive =
            isFocused &&
            (otp.length === index || (index === 5 && otp.length === 6));

          return (
            <View
              key={index}
              style={[
                styles.otpBox,
                isActive && styles.otpBoxActive,
                char ? styles.otpBoxFilled : null,
              ]}
            >
              <Text style={styles.otpText}>{char}</Text>
            </View>
          );
        })}

        {/* Input ẩn phía trên để nhận phím số mượt mà */}
        <TextInput
          ref={inputRef}
          value={otp}
          onChangeText={(text) => {
            const cleaned = text.replace(/[^0-9]/g, '').slice(0, 6);
            setOtp(cleaned);
          }}
          keyboardType="number-pad"
          maxLength={6}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={styles.hiddenInput}
          caretHidden
          autoFocus
        />
      </Pressable>

      {/* Hàng gửi lại mã */}
      <View style={styles.resendRow}>
        <Text style={styles.resendLabel}>Chưa nhận được mã? </Text>
        {resendSeconds > 0 ? (
          <Text style={styles.timerText}>Gửi lại sau ({resendSeconds}s)</Text>
        ) : (
          <TouchableOpacity onPress={onResendOtp} disabled={loading} activeOpacity={0.7}>
            <Text style={styles.resendButtonText}>Gửi lại mã OTP</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Nút bấm xác nhận đăng nhập */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          (otp.length < 6 || loading) && styles.submitButtonDisabled,
        ]}
        onPress={onSubmit}
        disabled={otp.length < 6 || loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <Ionicons name="lock-open-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <LocalizedText style={styles.submitButtonText}>
              Xác nhận & Đăng nhập
            </LocalizedText>
          </>
        )}
      </TouchableOpacity>

      {/* Nút quay lại đăng nhập thường */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
        disabled={loading}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={16} color="#64748B" style={{ marginRight: 6 }} />
        <Text style={styles.backButtonText}>Quay lại nhập mật khẩu</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  bottomSection: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    marginTop: -24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 8,
  },
  badgeContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#A7F3D0',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 21,
    paddingHorizontal: 8,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3F2',
    borderWidth: 1,
    borderColor: '#FECDCA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  noticeText: {
    fontSize: 13,
    color: '#B42318',
    lineHeight: 18,
    fontWeight: '500',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    position: 'relative',
    paddingHorizontal: 4,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpBoxActive: {
    borderColor: Colors.primary,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  otpBoxFilled: {
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  otpText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.01,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  resendLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  timerText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
  },
  resendButtonText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 16,
    height: 54,
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  backButtonText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
});

import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';

interface ForgotOtpStepProps {
  otp: string;
  onChangeOtp: (otp: string) => void;
  primaryColor: string;
  onResend: () => void;
  isLoading: boolean;
}

export const ForgotOtpStep: React.FC<ForgotOtpStepProps> = ({
  otp,
  onChangeOtp,
  primaryColor,
  onResend,
  isLoading,
}) => {
  const inputRef = useRef<any>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    // Tự động focus khi màn hình hiển thị
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const handleContainerPress = () => {
    inputRef.current?.focus();
  };

  return (
    <View>
      <Pressable onPress={handleContainerPress} style={styles.otpRow}>
        {[0, 1, 2, 3, 4, 5].map((index) => {
          const char = otp[index] || '';
          // Ô đang được gõ là ô trống đầu tiên hoặc ô cuối khi đã gõ đủ 6 số
          const isActive =
            isFocused &&
            (otp.length === index || (index === 5 && otp.length === 6));

          return (
            <View
              key={index}
              style={[
                styles.otpBox,
                isActive && [styles.otpBoxActive, { borderColor: primaryColor }],
              ]}
            >
              <Text style={styles.otpText}>{char}</Text>
            </View>
          );
        })}

        {/* Input ẩn phía trên để nhận trực tiếp toàn bộ phím số, xóa lùi và paste mà không bị delay hoặc nhảy lệch ô */}
        <TextInput
          ref={inputRef}
          value={otp}
          onChangeText={(text) => {
            const cleaned = text.replace(/[^0-9]/g, '').slice(0, 6);
            onChangeOtp(cleaned);
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

      <TouchableOpacity
        style={styles.resend}
        onPress={onResend}
        disabled={isLoading}
      >
        <Text style={[styles.link, { color: primaryColor }]}>
          Gửi lại mã xác minh
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    marginBottom: 20,
    position: 'relative',
  },
  otpBox: {
    width: 48,
    height: 64,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpBoxActive: {
    borderWidth: 2,
  },
  otpText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2F2F2F',
    textAlign: 'center',
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0.01,
    fontSize: 1,
    color: 'transparent',
  },
  resend: {
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  link: {
    fontSize: 16,
    fontWeight: '500',
  },
});

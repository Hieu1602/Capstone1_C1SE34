import React from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';

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
  return (
    <View>
      <View style={styles.otpRow}>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <TextInput
            key={index}
            style={[
              styles.otpInput,
              otp.length === index && [styles.otpInputActive, { borderColor: primaryColor }],
            ]}
            value={otp[index] || ''}
            onChangeText={(value) =>
              onChangeOtp(
                `${otp.slice(0, index)}${value.replace(/[^0-9]/g, '').slice(-1)}${otp.slice(index + 1)}`.slice(0, 6)
              )
            }
            keyboardType="number-pad"
            maxLength={1}
            textAlign="center"
          />
        ))}
      </View>

      <TouchableOpacity
        style={styles.resend}
        onPress={onResend}
        disabled={isLoading}
      >
        <Text style={[styles.link, { color: primaryColor }]}>Gửi lại mã xác minh</Text>
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
  },
  otpInput: {
    width: 48,
    height: 64,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 13,
    color: '#2F2F2F',
    fontSize: 24,
    textAlign: 'center',
    textAlignVertical: 'center',
    padding: 0,
    outlineWidth: 0,
  },
  otpInputActive: {
    borderWidth: 2,
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


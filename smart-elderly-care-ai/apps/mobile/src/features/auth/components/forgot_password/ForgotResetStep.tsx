import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ForgotResetStepProps {
  password: string;
  onChangePassword: (text: string) => void;
  confirmPassword: string;
  onChangeConfirmPassword: (text: string) => void;
  showPassword: boolean;
  onToggleShowPassword: () => void;
  showConfirmPassword: boolean;
  onToggleShowConfirmPassword: () => void;
}

export const ForgotResetStep: React.FC<ForgotResetStepProps> = ({
  password,
  onChangePassword,
  confirmPassword,
  onChangeConfirmPassword,
  showPassword,
  onToggleShowPassword,
  showConfirmPassword,
  onToggleShowConfirmPassword,
}) => {
  return (
    <View style={styles.passwordGroup}>
      {/* Ô nhập mật khẩu mới */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Mật khẩu mới (8-16 ký tự)"
          placeholderTextColor="#B8B8B8"
          value={password}
          onChangeText={onChangePassword}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity onPress={onToggleShowPassword}>
          <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={25} color="#333333" />
        </TouchableOpacity>
      </View>

      {/* Khung hướng dẫn tiêu chuẩn an toàn mật khẩu */}
      <View style={styles.requirements}>
        <Text style={styles.requirementTitle}>Yêu cầu bảo mật mật khẩu:</Text>
        <Text style={styles.requirement}>◯  Độ dài từ 8 đến 16 ký tự</Text>
        <Text style={styles.requirement}>◯  Nên bao gồm chữ cái, chữ số và ký tự đặc biệt</Text>
      </View>

      {/* Ô xác nhận lại mật khẩu mới */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Xác nhận lại mật khẩu mới"
          placeholderTextColor="#B8B8B8"
          value={confirmPassword}
          onChangeText={onChangeConfirmPassword}
          secureTextEntry={!showConfirmPassword}
        />
        <TouchableOpacity onPress={onToggleShowConfirmPassword}>
          <Ionicons
            name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
            size={25}
            color="#333333"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  passwordGroup: {
    gap: 14,
  },
  inputContainer: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 14,
    paddingHorizontal: 18,
  },
  input: {
    flex: 1,
    color: '#2F2F2F',
    fontSize: 17,
    padding: 0,
    borderWidth: 0,
    outlineWidth: 0,
  },
  requirements: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  requirementTitle: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  requirement: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
  },
});


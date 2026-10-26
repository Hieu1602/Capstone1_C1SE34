import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ForgotRequestStepProps {
  phone: string;
  onChangePhone: (text: string) => void;
}

export const ForgotRequestStep: React.FC<ForgotRequestStepProps> = ({
  phone,
  onChangePhone,
}) => {
  return (
    <View style={styles.inputContainer}>
      <Ionicons name="call-outline" size={24} color="#333333" style={styles.inputIcon} />
      <TextInput
        style={styles.input}
        placeholder="Nhập số điện thoại của bạn"
        placeholderTextColor="#B8B8B8"
        value={phone}
        onChangeText={onChangePhone}
        keyboardType="phone-pad"
        autoFocus
      />
    </View>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 14,
    paddingHorizontal: 18,
  },
  inputIcon: { marginRight: 14 },
  input: {
    flex: 1,
    color: '#2F2F2F',
    fontSize: 17,
    padding: 0,
    borderWidth: 0,
    outlineWidth: 0,
  },
});


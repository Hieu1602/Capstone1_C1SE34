import { LocalizedText as Text, LocalizedTextInput as TextInput } from '../../../../i18n/LocalizedComponents';
import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../../theme/colors';
import { SlideRightModal } from '../settings/SlideRightModal';
import ForgotPasswordScreen from '../../screens/ForgotPasswordScreen';

interface PasswordFeedback {
  type: 'success' | 'error';
  message: string;
}

interface ChangePasswordModalProps {
  visible: boolean;
  isDarkMode: boolean;
  onClose: () => void;
  onSubmit: (
    currentPass: string,
    newPass: string,
    confirmPass: string,
  ) => Promise<boolean>;
  onForgotPassword?: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  visible,
  isDarkMode,
  onClose,
  onSubmit,
  onForgotPassword,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPasswordTips, setShowPasswordTips] = useState(false);
  const [isForgotPasswordVisible, setIsForgotPasswordVisible] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [feedback, setFeedback] = useState<PasswordFeedback | null>(null);

  const handleReset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setFeedback(null);
    setShowPasswordTips(false);
    setIsForgotPasswordVisible(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleForgotPress = () => {
    if (onForgotPassword) {
      onForgotPassword();
      return;
    }
    setIsForgotPasswordVisible(true);
  };

  const handleSave = async () => {
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setFeedback({
        type: 'error',
        message: 'Vui lòng nhập đầy đủ các trường mật khẩu.',
      });
      return;
    }

    if (newPassword.length < 8 || newPassword.length > 16) {
      setFeedback({
        type: 'error',
        message: 'Mật khẩu mới phải dài từ 8 đến 16 ký tự.',
      });
      return;
    }

    const isComplex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/.test(newPassword);
    if (!isComplex) {
      setFeedback({
        type: 'error',
        message: 'Mật khẩu cần bao gồm chữ hoa, chữ thường, số và ký hiệu đặc biệt.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback({
        type: 'error',
        message: 'Mật khẩu xác nhận không trùng khớp.',
      });
      return;
    }

    setIsChangingPassword(true);
    setFeedback(null);
    try {
      const success = await onSubmit(currentPassword, newPassword, confirmPassword);
      if (success) {
        setFeedback({
          type: 'success',
          message: 'Mật khẩu của bạn đã được cập nhật thành công!',
        });
        setTimeout(() => {
          handleClose();
        }, 1400);
      }
    } catch (error: any) {
      setFeedback({
        type: 'error',
        message:
          error?.response?.data?.detail ||
          error?.message ||
          'Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mật khẩu hiện tại.',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const bgScreen = isDarkMode ? '#0B0F19' : '#FFFFFF';
  const textPrimary = isDarkMode ? '#F8FAFC' : '#111827';
  const textSecondary = isDarkMode ? '#94A3B8' : '#4B5563';
  const linkColor = Colors.primary;
  const cardBg = isDarkMode ? '#1E293B' : '#F3F4F6';
  const inputBg = isDarkMode ? '#111827' : '#FFFFFF';
  const inputBorder = isDarkMode ? '#334155' : '#D1D5DB';

  return (
    <SlideRightModal visible={visible} onClose={handleClose} isDarkMode={isDarkMode}>
      <SafeAreaView style={[styles.screen, { backgroundColor: bgScreen }]} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Minimal Back Arrow Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleClose}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="arrow-back" size={24} color={textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Title & Description */}
            <Text style={[styles.title, { color: textPrimary }]}>Đổi mật khẩu</Text>
            <Text style={[styles.subtitle, { color: textSecondary }]}>
              Bạn sẽ dùng mật khẩu này để đăng nhập vào Tài khoản SmartCare AI. Hãy sử dụng tối thiểu 8 chữ cái, chữ số và ký hiệu đặc biệt.
            </Text>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setShowPasswordTips((prev) => !prev)}
              style={styles.learnMoreBtn}
            >
              <Text style={[styles.learnMoreText, { color: linkColor }]}>
                Tìm hiểu cách tạo mật khẩu mạnh
              </Text>
            </TouchableOpacity>

            {showPasswordTips && (
              <View
                style={[
                  styles.tipsBox,
                  {
                    backgroundColor: cardBg,
                    borderColor: inputBorder,
                  },
                ]}
              >
                <Text style={[styles.tipItem, { color: textSecondary }]}>
                  • Độ dài từ 8 đến 16 ký tự
                </Text>
                <Text style={[styles.tipItem, { color: textSecondary }]}>
                  • Kết hợp chữ hoa (A-Z), chữ thường (a-z), chữ số (0-9) và ký tự đặc biệt (!@#$...)
                </Text>
                <Text style={[styles.tipItem, { color: textSecondary }]}>
                  • Không dùng ngày sinh, số điện thoại hoặc mật khẩu dễ đoán
                </Text>
              </View>
            )}

            {/* Error / Success Feedback */}
            {feedback && (
              <View
                accessibilityRole="alert"
                style={[
                  styles.feedbackBanner,
                  feedback.type === 'success'
                    ? {
                        backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
                        borderColor: isDarkMode ? '#065F46' : '#A7F3D0',
                      }
                    : {
                        backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
                        borderColor: isDarkMode ? '#7F1D1D' : '#FECACA',
                      },
                ]}
              >
                <Ionicons
                  name={feedback.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                  size={20}
                  color={feedback.type === 'success' ? '#10B981' : '#EF4444'}
                />
                <Text
                  style={[
                    styles.feedbackText,
                    { color: feedback.type === 'success' ? (isDarkMode ? '#6EE7B7' : '#065F46') : (isDarkMode ? '#FCA5A5' : '#991B1B') },
                  ]}
                >
                  {feedback.message}
                </Text>
              </View>
            )}

            {/* 3 Clean Rounded Inputs */}
            <View style={styles.inputsGroup}>
              <View
                style={[
                  styles.inputBox,
                  {
                    backgroundColor: inputBg,
                    borderColor: currentPassword.length > 0 ? linkColor : inputBorder,
                  },
                ]}
              >
                <TextInput
                  style={[styles.inputField, { color: textPrimary }]}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Mật khẩu hiện tại"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showCurrentPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.inputBox,
                  {
                    backgroundColor: inputBg,
                    borderColor: newPassword.length > 0 ? linkColor : inputBorder,
                  },
                ]}
              >
                <TextInput
                  style={[styles.inputField, { color: textPrimary }]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Mật khẩu mới"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowNewPassword(!showNewPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.inputBox,
                  {
                    backgroundColor: inputBg,
                    borderColor: confirmPassword.length > 0 ? linkColor : inputBorder,
                  },
                ]}
              >
                <TextInput
                  style={[styles.inputField, { color: textPrimary }]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Nhập lại mật khẩu mới"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot Password Link */}
            <TouchableOpacity
              onPress={handleForgotPress}
              activeOpacity={0.7}
              style={styles.forgotBtn}
            >
              <Text style={[styles.forgotText, { color: linkColor }]}>
                Bạn quên mật khẩu ư?
              </Text>
            </TouchableOpacity>

            {/* Logout Other Devices Note */}
            <Text style={[styles.securityNote, { color: textSecondary }]}>
              Nếu người khác từng sử dụng tài khoản của bạn, hãy đăng xuất khỏi các thiết bị khác trong phần{' '}
              <Text style={[styles.securityNoteBold, { color: textPrimary }]}>
                Trung tâm bảo mật
              </Text>
            </Text>

            {/* Full-Width Pill Primary Button */}
            <TouchableOpacity
              style={[
                styles.submitBtn,
                isChangingPassword && { opacity: 0.7 },
              ]}
              onPress={handleSave}
              activeOpacity={0.85}
              disabled={isChangingPassword}
            >
              {isChangingPassword ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Đổi mật khẩu</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Slide-in từ phải sang trái: Quên mật khẩu, khi thoát quay lại đúng màn Đổi mật khẩu */}
      <SlideRightModal
        visible={isForgotPasswordVisible}
        onClose={() => setIsForgotPasswordVisible(false)}
        isDarkMode={isDarkMode}
      >
        <ForgotPasswordScreen
          navigation={{
            canGoBack: () => true,
            goBack: () => setIsForgotPasswordVisible(false),
            navigate: () => setIsForgotPasswordVisible(false),
          }}
        />
      </SlideRightModal>
    </SlideRightModal>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  learnMoreBtn: {
    marginTop: 4,
    marginBottom: 18,
    alignSelf: 'flex-start',
  },
  learnMoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tipsBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
    gap: 6,
  },
  tipItem: {
    fontSize: 13,
    lineHeight: 18,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  feedbackText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '500',
  },
  inputsGroup: {
    gap: 12,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputField: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  forgotBtn: {
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  forgotText: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  securityNote: {
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 14,
    marginBottom: 22,
  },
  securityNoteBold: {
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 28,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '700',
  },
});

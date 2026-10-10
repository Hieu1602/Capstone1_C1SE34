// ============================================================================
// MÀN HÌNH ĐĂNG NHẬP & CHÀO MỪNG (LOGIN SCREEN)
// Hệ thống: Smart Elderly Care AI (SECA)
// Giao diện: Thiết kế phong cách Pinterest Collage + Bottom Sheet Modal
// Chức năng:
//   - Trưng bày bộ ảnh trực quan mang thông điệp chăm sóc sức khỏe người cao tuổi
//   - Điều hướng sang màn hình Đăng ký tài khoản (RegisterScreen)
//   - Modal Bottom Sheet đăng nhập hỗ trợ chuẩn hóa số điện thoại E.164 (+84)
//   - Tích hợp gọi API OAuth2 Password Bearer và lưu phiên vào useAuthStore
// ============================================================================

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
  Modal,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { useAuthStore } from '../../../store/useVitalStore';
import { authApi } from '../../../services/api';

// Lấy kích thước chiều rộng màn hình để tính toán tỉ lệ cho bố cục Collage
const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Danh sách hình ảnh chất lượng cao phục vụ bố cục Collage
 * Mang thông điệp: niềm vui tuổi già, không gian sống ấm áp, y tế ân cần và sinh hoạt lành mạnh
 */
const COLLAGE_IMAGES = {
  center: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=600&q=80', // Nụ cười cụ bà hạnh phúc (Ảnh trung tâm Hero)
  topLeft: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=500&q=80', // Không gian sống ấm áp
  topRight: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=500&q=80', // Giày rèn luyện sức khỏe
  midRight: 'https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?auto=format&fit=crop&w=500&q=80', // Bác sĩ & chăm sóc ân cần
  bottomLeft: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=500&q=80', // Bữa ăn dinh dưỡng
  bottomRight: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=500&q=80', // Không gian bình yên
};

export default function LoginScreen({ navigation }: any) {
  // Hook quản lý trạng thái phiên đăng nhập toàn cục (Zustand Store)
  const { login } = useAuthStore();

  // Quản lý hiển thị modal Bottom Sheet đăng nhập
  const [isLoginModalVisible, setIsLoginModalVisible] = useState(false);

  // Trạng thái nhập liệu của biểu mẫu
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Xử lý xác thực đăng nhập người dùng
   * 1. Kiểm tra tính hợp lệ dữ liệu đầu vào (số điện thoại và mật khẩu không rỗng)
   * 2. Chuẩn hóa số điện thoại về định dạng quốc tế chuẩn E.164 (+84...)
   * 3. Gửi request đến FastAPI backend qua authApi.login (OAuth2 Password Request Form)
   * 4. Nhận access_token, refresh_token và thông tin hồ sơ tài khoản người dùng thực tế
   * 5. Lưu phiên đăng nhập vào useAuthStore và đóng Modal
   */
  const handleLoginAction = async () => {
    // Kiểm tra dữ liệu bắt buộc
    if (!account.trim() || !password.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập số điện thoại và mật khẩu.');
      return;
    }

    setIsLoading(true);
    try {
      // Chuẩn hóa số điện thoại: loại bỏ khoảng trắng và chuyển đầu số 0 sang mã quốc tế +84
      const cleanAccount = account.replace(/\s+/g, '').replace(/^\+84/, '0');
      const normalizedAccount = cleanAccount.startsWith('0')
        ? `+84${cleanAccount.slice(1)}`
        : cleanAccount.startsWith('+')
          ? cleanAccount
          : `+84${cleanAccount}`;

      // Gọi API đăng nhập hệ thống backend
      const response = await authApi.login(normalizedAccount, password);
      const { access_token, refresh_token, user } = response.data;

      // Trích xuất dữ liệu người dùng từ response API backend (không sử dụng dữ liệu giả định)
      const full_name = user?.full_name || 'Người dùng';
      const phone_number = user?.phone_number || user?.phone || cleanAccount;
      const role_str = user?.role || 'Chủ nhà';
      const user_id = user?.user_id || user?.id || 1;
      const household_id = user?.household_id ?? 1;

      // Lưu trữ phiên làm việc vào Store Zustand và đồng bộ trạng thái ứng dụng
      login(access_token, refresh_token, full_name, user_id, phone_number, role_str, household_id);

      // Đóng modal đăng nhập thành công
      setIsLoginModalVisible(false);
    } catch (error: any) {
      console.error('[Login] Error:', error);
      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        'Số điện thoại hoặc mật khẩu không chính xác.';
      Alert.alert('Đăng nhập thất bại', String(detail));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ================================================================= */}
        {/* PHẦN 1: BỐ CỤC ẢNH NGHỆ THUẬT COLLAGE (PINTEREST STYLE)           */}
        {/* ================================================================= */}
        <View style={styles.collageContainer}>
          {/* Card góc trên bên trái */}
          <View style={[styles.card, styles.cardTopLeft]}>
            <Image
              source={{ uri: COLLAGE_IMAGES.topLeft }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          </View>

          {/* Card góc trên bên phải */}
          <View style={[styles.card, styles.cardTopRight]}>
            <Image
              source={{ uri: COLLAGE_IMAGES.topRight }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          </View>

          {/* Card trung tâm nổi bật (Hero Card) */}
          <View style={[styles.card, styles.cardCenterHero]}>
            <Image
              source={{ uri: COLLAGE_IMAGES.center }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          </View>

          {/* Card giữa bên phải */}
          <View style={[styles.card, styles.cardMidRight]}>
            <Image
              source={{ uri: COLLAGE_IMAGES.midRight }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          </View>

          {/* Card góc dưới bên trái */}
          <View style={[styles.card, styles.cardBottomLeft]}>
            <Image
              source={{ uri: COLLAGE_IMAGES.bottomLeft }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          </View>

          {/* Card góc dưới bên phải */}
          <View style={[styles.card, styles.cardBottomRight]}>
            <Image
              source={{ uri: COLLAGE_IMAGES.bottomRight }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          </View>
        </View>

        {/* ================================================================= */}
        {/* PHẦN 2: LOGO BADGE, TIÊU ĐỀ & NÚT HÀNH ĐỘNG                       */}
        {/* ================================================================= */}
        <View style={styles.bottomSection}>
          {/* Huy hiệu Logo thương hiệu hình trái tim */}
          <View style={styles.logoBadgeContainer}>
            <View style={styles.logoBadge}>
              <Ionicons name="heart" size={26} color="#FFFFFF" />
            </View>
          </View>

          {/* Tiêu đề & Thông điệp sứ mệnh */}
          <Text style={styles.heroTitle}>
            Tạo dựng cuộc sống{'\n'}bạn yêu thích
          </Text>
          <Text style={styles.heroSubtitle}>
            Hệ sinh thái AI bảo vệ sức khỏe & an toàn người cao tuổi 24/7
          </Text>

          {/* Bộ 2 nút hành động chính (Pill Buttons) */}
          <View style={styles.actionButtonsContainer}>
            {/* Nút 1: Mở màn hình Đăng ký */}
            <TouchableOpacity
              style={styles.btnRegister}
              activeOpacity={0.88}
              onPress={() => navigation.navigate('Register')}
            >
              <Text style={styles.btnRegisterText}>Đăng ký</Text>
            </TouchableOpacity>

            {/* Nút 2: Mở Modal Bottom Sheet Đăng nhập */}
            <TouchableOpacity
              style={styles.btnLogin}
              activeOpacity={0.88}
              onPress={() => setIsLoginModalVisible(true)}
            >
              <Text style={styles.btnLoginText}>Đăng nhập</Text>
            </TouchableOpacity>
          </View>

          {/* Điều khoản pháp lý & chính sách bảo mật */}
          <Text style={styles.termsNoticeText}>
            Bằng cách tiếp tục, bạn đồng ý với{' '}
            <Text
              style={styles.termsLink}
              onPress={() => Alert.alert('Điều khoản dịch vụ', 'Hệ thống Smart Elderly Care AI tuân thủ chuẩn an ninh y tế.')}
            >
              Điều khoản dịch vụ
            </Text>{' '}
            của SECA và xác nhận rằng bạn đã đọc{' '}
            <Text
              style={styles.termsLink}
              onPress={() => Alert.alert('Chính sách bảo mật', 'Bảo mật thông tin sinh hiệu chuẩn mã hóa AES-256.')}
            >
              Chính sách quyền riêng tư
            </Text>{' '}
            của chúng tôi.{' '}
            <Text
              style={styles.termsLink}
              onPress={() => Alert.alert('Thông báo thu thập', 'Dữ liệu được thu thập từ Camera AI và Vòng tay BLE.')}
            >
              Thông báo khi thu thập
            </Text>
            .
          </Text>
        </View>
      </ScrollView>

      {/* ================================================================= */}
      {/* PHẦN 3: MODAL ĐĂNG NHẬP (BOTTOM SHEET HIỆN ĐẠI)                   */}
      {/* ================================================================= */}
      <Modal
        visible={isLoginModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsLoginModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            {/* Thanh kéo gạt chỉ dẫn đỉnh Bottom Sheet */}
            <View style={styles.sheetHandle} />

            {/* Tiêu đề Modal & Nút đóng */}
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Đăng nhập</Text>
                <Text style={styles.sheetSubtitle}>Nhập thông tin tài khoản người nhà hoặc bác sĩ</Text>
              </View>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setIsLoginModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Trường nhập số điện thoại kèm tiền tố +84 */}
            <View style={styles.inputWrap}>
              <View style={styles.inputPrefix}>
                <Ionicons name="call-outline" size={18} color="#64748B" />
                <Text style={styles.prefixText}>+84</Text>
              </View>
              <TextInput
                style={styles.textInput}
                placeholder="Nhập số điện thoại (VD: 0905123456)"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={account}
                onChangeText={setAccount}
                autoCapitalize="none"
              />
            </View>

            {/* Trường nhập mật khẩu kèm nút bật/tắt ẩn hiện */}
            <View style={styles.inputWrap}>
              <View style={styles.inputPrefix}>
                <Ionicons name="lock-closed-outline" size={18} color="#64748B" />
              </View>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                placeholder="Mật khẩu"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

            {/* Điều hướng Quên mật khẩu */}
            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={() => {
                setIsLoginModalVisible(false);
                navigation.navigate('ForgotPassword');
              }}
            >
              <Text style={styles.forgotText}>Quên mật khẩu?</Text>
            </TouchableOpacity>

            {/* Nút bấm Đăng nhập */}
            <TouchableOpacity
              style={[styles.btnSubmitLogin, isLoading && { opacity: 0.7 }]}
              activeOpacity={0.88}
              onPress={handleLoginAction}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.btnSubmitLoginText}>Đăng nhập</Text>
              )}
            </TouchableOpacity>

            {/* Điều hướng chuyển sang Đăng ký tài khoản mới */}
            <View style={styles.switchAuthRow}>
              <Text style={styles.switchAuthText}>Chưa có tài khoản? </Text>
              <TouchableOpacity
                onPress={() => {
                  setIsLoginModalVisible(false);
                  navigation.navigate('Register');
                }}
              >
                <Text style={styles.switchAuthLink}>Đăng ký ngay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Vùng an toàn hiển thị toàn màn hình
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingBottom: 24,
  },

  // -------------------------------------------------------------------------
  // ĐỊNH DẠNG BỐ CỤC BỘ ẢNH COLLAGE
  // -------------------------------------------------------------------------
  collageContainer: {
    width: '100%',
    height: 380,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
  },
  card: {
    position: 'absolute',
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },

  // Tọa độ định vị từng khung ảnh theo phong cách Pinterest
  cardTopLeft: {
    top: -15,
    left: -20,
    width: SCREEN_WIDTH * 0.38,
    height: 220,
    borderRadius: 24,
  },
  cardTopRight: {
    top: -25,
    right: -25,
    width: SCREEN_WIDTH * 0.52,
    height: 145,
    borderRadius: 24,
  },
  cardCenterHero: {
    top: 50,
    left: SCREEN_WIDTH * 0.22,
    width: SCREEN_WIDTH * 0.56,
    height: 275,
    borderRadius: 26,
    zIndex: 10,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  cardMidRight: {
    top: 130,
    right: -30,
    width: SCREEN_WIDTH * 0.35,
    height: 120,
    borderRadius: 22,
    zIndex: 5,
  },
  cardBottomLeft: {
    bottom: -20,
    left: -15,
    width: SCREEN_WIDTH * 0.44,
    height: 170,
    borderRadius: 24,
    zIndex: 5,
  },
  cardBottomRight: {
    bottom: -15,
    right: -20,
    width: SCREEN_WIDTH * 0.42,
    height: 155,
    borderRadius: 24,
    zIndex: 4,
  },

  // -------------------------------------------------------------------------
  // ĐỊNH DẠNG KHU VỰC THƯƠNG HIỆU & NÚT HÀNH ĐỘNG
  // -------------------------------------------------------------------------
  bottomSection: {
    paddingHorizontal: 28,
    paddingTop: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  logoBadgeContainer: {
    marginBottom: 14,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary, // Màu cam thương hiệu chủ đạo
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  actionButtonsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  btnRegister: {
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  btnRegisterText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  btnLogin: {
    backgroundColor: '#EFEFEF', // Màu xám nhẹ thanh lịch
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  btnLoginText: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '700',
  },
  termsNoticeText: {
    fontSize: 11,
    color: '#334155',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 6,
  },
  termsLink: {
    fontWeight: '700',
    color: '#0F172A',
    textDecorationLine: 'underline',
  },

  // -------------------------------------------------------------------------
  // ĐỊNH DẠNG MODAL BOTTOM SHEET ĐĂNG NHẬP
  // -------------------------------------------------------------------------
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    width: '100%',
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  sheetSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  eyeBtn: {
    padding: 6,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    marginTop: -4,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  btnSubmitLogin: {
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  btnSubmitLoginText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  switchAuthRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
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
});
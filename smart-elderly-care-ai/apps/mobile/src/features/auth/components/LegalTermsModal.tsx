// ==============================================================================
// LegalTermsModal.tsx – Hộp thoại Điều khoản dịch vụ & Chính sách quyền riêng tư
// ------------------------------------------------------------------------------
// Hệ thống Smart Elderly Care AI (SECA - C1SE.34)
// Cho phép người dùng xem chi tiết Điều khoản dịch vụ và Chính sách quyền riêng tư
// theo chuẩn an toàn dữ liệu y tế Bộ Y Tế & HIPAA.
// ==============================================================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';

export type LegalModalType = 'terms' | 'privacy';

interface LegalTermsModalProps {
  visible: boolean;
  initialType?: LegalModalType;
  onClose: () => void;
  onAgree?: () => void;
}

export const LegalTermsModal: React.FC<LegalTermsModalProps> = ({
  visible,
  initialType = 'terms',
  onClose,
  onAgree,
}) => {
  const [activeTab, setActiveTab] = useState<LegalModalType>(initialType);

  useEffect(() => {
    if (visible) {
      setActiveTab(initialType);
    }
  }, [visible, initialType]);

  const handleAgree = () => {
    onAgree?.();
    onClose();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.dialogCard} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconCircle}>
                <Ionicons
                  name={activeTab === 'terms' ? 'document-text' : 'shield-checkmark'}
                  size={22}
                  color={Colors.primary}
                />
              </View>
              <View style={styles.headerTextCol}>
                <Text style={styles.headerTitle}>
                  {activeTab === 'terms' ? 'Điều khoản dịch vụ' : 'Chính sách quyền riêng tư'}
                </Text>
                <Text style={styles.headerSubtitle}>
                  Smart Elderly Care AI (SECA)
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Segmented Tab Switcher */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'terms' && styles.tabButtonActive]}
              onPress={() => setActiveTab('terms')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === 'terms' && styles.tabTextActive]}>
                Điều khoản dịch vụ
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'privacy' && styles.tabButtonActive]}
              onPress={() => setActiveTab('privacy')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === 'privacy' && styles.tabTextActive]}>
                Quyền riêng tư & Bảo mật
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content Area */}
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.contentBody}
            showsVerticalScrollIndicator={true}
          >
            {activeTab === 'terms' ? (
              <View style={styles.sectionWrapper}>
                <View style={styles.highlightBadge}>
                  <Ionicons name="information-circle-outline" size={18} color="#0284C7" />
                  <Text style={styles.highlightBadgeText}>
                    Cập nhật mới nhất: Tháng 10/2026 • Phiên bản 2.4.0
                  </Text>
                </View>

                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionHeading}>1. Giới thiệu dịch vụ</Text>
                  <Text style={styles.paragraph}>
                    Smart Elderly Care AI (SECA) là hệ sinh thái hỗ trợ giám sát an toàn và chăm sóc sức khỏe người cao tuổi thông qua trí tuệ nhân tạo (AI), camera thông minh và cảm biến sinh hiệu kết nối gia đình và bác sĩ.
                  </Text>
                </View>

                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionHeading}>2. Tài khoản & Trách nhiệm người dùng</Text>
                  <Text style={styles.paragraph}>
                    • Người dùng có trách nhiệm bảo mật số điện thoại và mã OTP được cấp.{'\n'}
                    • Bác sĩ gia đình tham gia hệ thống phải cung cấp Chứng chỉ hành nghề y khoa (CCHN) hợp lệ và được xác thực tự động trên Cổng Sở Y tế.{'\n'}
                    • Tuyệt đối không chia sẻ tài khoản giám sát camera gia đình cho người ngoài để đảm bảo tính riêng tư.
                  </Text>
                </View>

                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionHeading}>3. Cảnh báo y tế & Trách nhiệm cấp cứu</Text>
                  <Text style={styles.paragraph}>
                    • Hệ thống AI tự động phát hiện té ngã, bất thường nhịp tim và gửi cảnh báo tức thì qua Notification và SMS.{'\n'}
                    • Các cảnh báo và chỉ số mang tính chất hỗ trợ phát hiện sớm. Trong các tình huống nguy kịch, người nhà vui lòng liên hệ ngay <Text style={styles.boldText}>Tổng đài Cấp cứu 115</Text> hoặc đưa người cao tuổi đến bệnh viện gần nhất.
                  </Text>
                </View>

                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionHeading}>4. Quyền thay đổi & Chấm dứt dịch vụ</Text>
                  <Text style={styles.paragraph}>
                    SECA có quyền cập nhật, nâng cấp các tính năng nhằm cải thiện độ chính xác của mô hình AI mà không làm gián đoạn việc giám sát người cao tuổi của gia đình bạn.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.sectionWrapper}>
                <View style={[styles.highlightBadge, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#059669" />
                  <Text style={[styles.highlightBadgeText, { color: '#065F46' }]}>
                    Chuẩn bảo mật dữ liệu Y tế Bộ Y Tế & HIPAA
                  </Text>
                </View>

                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionHeading}>1. Thông tin chúng tôi thu thập</Text>
                  <Text style={styles.paragraph}>
                    • <Text style={styles.boldText}>Thông tin tài khoản:</Text> Họ tên, số điện thoại, vai trò (người thân/bác sĩ), địa chỉ gia đình.{'\n'}
                    • <Text style={styles.boldText}>Chỉ số sinh hiệu y tế:</Text> Nhịp tim, nồng độ oxy trong máu (SpO2), nhiệt độ, nhật ký té ngã.{'\n'}
                    • <Text style={styles.boldText}>Dữ liệu camera an toàn:</Text> Luồng video giám sát phòng khách/phòng ngủ phục vụ thuật toán AI nhận diện ngã theo thời gian thực.
                  </Text>
                </View>

                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionHeading}>2. Mã hóa & Bảo mật nhiều lớp</Text>
                  <Text style={styles.paragraph}>
                    • Toàn bộ dữ liệu video livestream và ảnh chụp khẩn cấp được mã hóa đường truyền an toàn (WSS / WebRTC / TLS 1.3).{'\n'}
                    • Mật khẩu tài khoản được băm một chiều bằng chuẩn mã hóa cao cấp (Bcrypt), đảm bảo ngay cả quản trị viên cũng không thể đọc được mật khẩu của bạn.
                  </Text>
                </View>

                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionHeading}>3. Quyền kiểm soát của gia đình</Text>
                  <Text style={styles.paragraph}>
                    • Chỉ những người thân được chủ hộ cấp quyền hoặc bác sĩ gia đình được chỉ định mới có thể xem hồ sơ sức khỏe và video giám sát.{'\n'}
                    • Bạn có quyền bật/tắt camera hoặc xóa dữ liệu cảnh báo bất cứ lúc nào trong mục Trung tâm bảo mật của ứng dụng.
                  </Text>
                </View>

                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionHeading}>4. Cam kết không chia sẻ bên thứ ba</Text>
                  <Text style={styles.paragraph}>
                    Chúng tôi cam kết không kinh doanh, cho thuê hoặc cung cấp dữ liệu y tế của người cao tuổi cho bất kỳ đơn vị quảng cáo nào.
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Đóng</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.agreeButton}
              onPress={handleAgree}
              activeOpacity={0.85}
            >
              <Text style={styles.agreeButtonText}>Tôi đồng ý</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 36,
  },
  dialogCard: {
    width: '100%',
    maxHeight: '88%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    marginHorizontal: 18,
    marginTop: 14,
    borderRadius: 12,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  contentScroll: {
    maxHeight: 380,
    paddingHorizontal: 20,
  },
  contentBody: {
    paddingVertical: 16,
  },
  sectionWrapper: {
    gap: 16,
  },
  highlightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  highlightBadgeText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#0369A1',
    flex: 1,
  },
  sectionBlock: {
    gap: 6,
  },
  sectionHeading: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  paragraph: {
    fontSize: 13.5,
    lineHeight: 21,
    color: '#475569',
  },
  boldText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  agreeButton: {
    flex: 1.6,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  agreeButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});


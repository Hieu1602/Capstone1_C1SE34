// ==============================================================================
// WelcomeScreen.tsx – Màn hình Đầu tiên (Chào mừng / Landing Screen)
// ------------------------------------------------------------------------------
// Hệ thống Smart Elderly Care AI (C1SE.34)
// - Phần trên: Photo collage phong cách Pinterest chất lượng cao
// - Phần dưới: Logo thương hiệu, slogan, nút "Đăng ký" và "Đăng nhập"
// ==============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { LegalTermsModal, LegalModalType } from '../components/LegalTermsModal';
import { LocalizedText } from '../../../i18n/LocalizedComponents';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Danh sách hình ảnh collage chất lượng cao (phong cách sống, chăm sóc gia đình, y tế)
const COLLAGE_IMAGES = {
  center: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=600&q=80',
  topLeft: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=500&q=80',
  topRight: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=500&q=80',
  midRight: 'https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?auto=format&fit=crop&w=500&q=80',
  bottomLeft: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=500&q=80',
  bottomRight: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=500&q=80',
};

export default function WelcomeScreen({ navigation }: any) {
  const [isAgreed, setIsAgreed] = useState(false);
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [legalModalType, setLegalModalType] = useState<LegalModalType>('terms');

  const handleOpenLegal = (type: LegalModalType) => {
    setLegalModalType(type);
    setLegalModalVisible(true);
  };

  const handleNavigate = (screen: 'Register' | 'Login') => {
    if (!isAgreed) {
      Alert.alert(
        'Thông báo',
        'Vui lòng đọc và tích chọn đồng ý với Điều khoản dịch vụ và Chính sách quyền riêng tư để tiếp tục.'
      );
      return;
    }
    navigation.navigate(screen, { isAgreed });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ================================================================= */}
        {/* PHẦN 1: DYNAMIC PHOTO COLLAGE (PHONG CÁCH PINTEREST)              */}
        {/* ================================================================= */}
        <View style={styles.collageContainer}>
          <View style={[styles.card, styles.cardTopLeft]}>
            <Image source={{ uri: COLLAGE_IMAGES.topLeft }} style={styles.cardImage} resizeMode="cover" />
          </View>
          <View style={[styles.card, styles.cardTopRight]}>
            <Image source={{ uri: COLLAGE_IMAGES.topRight }} style={styles.cardImage} resizeMode="cover" />
          </View>
          <View style={[styles.card, styles.cardCenterHero]}>
            <Image source={{ uri: COLLAGE_IMAGES.center }} style={styles.cardImage} resizeMode="cover" />
          </View>
          <View style={[styles.card, styles.cardMidRight]}>
            <Image source={{ uri: COLLAGE_IMAGES.midRight }} style={styles.cardImage} resizeMode="cover" />
          </View>
          <View style={[styles.card, styles.cardBottomLeft]}>
            <Image source={{ uri: COLLAGE_IMAGES.bottomLeft }} style={styles.cardImage} resizeMode="cover" />
          </View>
          <View style={[styles.card, styles.cardBottomRight]}>
            <Image source={{ uri: COLLAGE_IMAGES.bottomRight }} style={styles.cardImage} resizeMode="cover" />
          </View>
        </View>

        {/* ================================================================= */}
        {/* PHẦN 2: LOGO BADGE, TIÊU ĐỀ & 2 NÚT ĐĂNG KÝ / ĐĂNG NHẬP           */}
        {/* ================================================================= */}
        <View style={styles.bottomSection}>
          <View style={styles.logoBadgeContainer}>
            <Image
              source={require('../../../../assets/logo.png')}
              style={{ width: 96, height: 64 }}
              resizeMode="contain"
            />
          </View>

          <LocalizedText style={styles.heroTitle}>
            {'Tạo dựng cuộc sống\n' + 'bạn yêu thích'}
          </LocalizedText>

          <LocalizedText style={styles.heroSubtitle}>
            Hệ sinh thái AI bảo vệ sức khỏe & an toàn người cao tuổi 24/7
          </LocalizedText>

          {/* Bộ 2 nút hành động Pill Button */}
          <View style={styles.actionButtonsContainer}>
            {/* Nút 1: Đăng ký */}
            <TouchableOpacity
              style={[styles.btnRegister, !isAgreed && styles.btnDisabled]}
              activeOpacity={isAgreed ? 0.88 : 0.7}
              onPress={() => handleNavigate('Register')}
            >
              <LocalizedText style={styles.btnRegisterText}>Đăng ký</LocalizedText>
            </TouchableOpacity>

            {/* Nút 2: Đăng nhập */}
            <TouchableOpacity
              style={[styles.btnLogin, !isAgreed && styles.btnLoginDisabled]}
              activeOpacity={isAgreed ? 0.88 : 0.7}
              onPress={() => handleNavigate('Login')}
            >
              <LocalizedText style={styles.btnLoginText}>Đăng nhập</LocalizedText>
            </TouchableOpacity>
          </View>

          {/* Điều khoản pháp lý ở chân trang với checkbox hình vuông */}
          <View style={styles.termsContainer}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setIsAgreed(!isAgreed)}
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
              <Text onPress={() => setIsAgreed(!isAgreed)}>
                Bằng cách tiếp tục, bạn đồng ý với{' '}
              </Text>
              <Text
                style={styles.termsLink}
                onPress={() => handleOpenLegal('terms')}
              >
                Điều khoản dịch vụ
              </Text>{' '}
              <Text onPress={() => setIsAgreed(!isAgreed)}>
                của SECA và xác nhận rằng bạn đã đọc{' '}
              </Text>
              <Text
                style={styles.termsLink}
                onPress={() => handleOpenLegal('privacy')}
              >
                Chính sách quyền riêng tư
              </Text>{' '}
              <Text onPress={() => setIsAgreed(!isAgreed)}>
                của chúng tôi.
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Modal Điều khoản dịch vụ & Chính sách quyền riêng tư */}
      <LegalTermsModal
        visible={legalModalVisible}
        initialType={legalModalType}
        onClose={() => setLegalModalVisible(false)}
        onAgree={() => setIsAgreed(true)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: Colors.primary,
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
  btnDisabled: {
    opacity: 0.5,
  },
  btnRegisterText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  btnLogin: {
    backgroundColor: '#EFEFEF',
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  btnLoginDisabled: {
    opacity: 0.5,
  },
  btnLoginText: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '700',
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

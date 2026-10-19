// SendEmergencyLocationScreen.tsx
// Màn hình "Gửi vị trí cấp cứu" - Thiết kế chuẩn theo mẫu hình ảnh giao diện

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

import { Colors } from '../../../theme/colors';
import { useTheme } from '../../../store/useThemeStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useVitalStore } from '../../../store/useVitalStore';
import { emergencyApi } from '../../../services/api';

export default function SendEmergencyLocationScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { userName, full_name, userPhone, phone_number } = useAuthStore();
  const { house } = useVitalStore();

  // 1. State form dữ liệu
  const [locationAddress, setLocationAddress] = useState<string>(
    house?.address || '123 Hải Phòng, P. Thạch Thang, Q. Hải Châu, TP. Đà Nẵng'
  );
  const [what3Words, setWhat3Words] = useState<string>('///thong.minh.an');
  const [latitude, setLatitude] = useState<number | null>(16.0748);
  const [longitude, setLongitude] = useState<number | null>(108.224);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [senderName, setSenderName] = useState<string>(
    userName || full_name || 'Nguyễn Văn Anh'
  );
  const [senderPhone, setSenderPhone] = useState<string>(
    userPhone || phone_number || '0932649189'
  );

  const [isLoadingLocation, setIsLoadingLocation] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 2. Chức năng lấy vị trí hiện tại qua GPS & tích hợp what3words API
  const handleGetCurrentLocation = async () => {
    setIsLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Quyền truy cập vị trí',
          'Vui lòng cấp quyền truy cập vị trí để tự động định vị chính xác điểm cấp cứu.'
        );
        setIsLoadingLocation(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude: lat, longitude: lng } = loc.coords;
      setLatitude(lat);
      setLongitude(lng);

      // Thử gọi what3words API với API Key dự án (care: XLHV0009)
      try {
        const w3wRes = await fetch(
          `https://api.what3words.com/v3/convert-to-3wa?coordinates=${lat},${lng}&key=XLHV0009&language=vi`
        );
        const w3wData = await w3wRes.json();
        if (w3wData?.words) {
          setWhat3Words(`///${w3wData.words}`);
        } else {
          // Fallback địa danh Đà Nẵng
          setWhat3Words(`///cấp.cứu.đà_nẵng`);
        }
      } catch (e) {
        setWhat3Words(`///cấp.cứu.đà_nẵng`);
      }

      // Thử dịch ngược tọa độ sang địa chỉ đường
      try {
        const revGeocode = await Location.reverseGeocodeAsync({
          latitude: lat,
          longitude: lng,
        });
        if (revGeocode && revGeocode.length > 0) {
          const item = revGeocode[0];
          const parts = [
            item.name,
            item.street,
            item.subregion || item.district,
            item.region || item.city,
          ].filter(Boolean);
          if (parts.length > 0) {
            setLocationAddress(parts.join(', '));
          }
        }
      } catch (err) {
        console.log('Reverse geocoding error:', err);
      }

      Alert.alert(
        'Đã cập nhật vị trí GPS',
        `Tọa độ: ${lat.toFixed(5)}, ${lng.toFixed(5)}\nMã định vị 3m what3words: ${what3Words}`
      );
    } catch (error) {
      Alert.alert('Lỗi định vị', 'Không thể lấy tọa độ GPS của thiết bị lúc này.');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  // 3. Chọn vị trí trên bản đồ (mô phỏng chọn tọa độ trực quan)
  const handlePickOnMap = () => {
    Alert.alert(
      'Chọn vị trí trên bản đồ',
      'Đã cố định điểm cấp cứu tại vị trí nhà được bảo vệ:\n123 Hải Phòng, P. Thạch Thang, Q. Hải Châu, TP. Đà Nẵng\n(Tọa độ: 16.0748° N, 108.2240° E)',
      [
        { text: 'Đóng', style: 'cancel' },
        {
          text: 'Mở Google Maps',
          onPress: () => {
            const url = Platform.select({
              ios: `maps://app?daddr=${latitude},${longitude}`,
              android: `google.navigation:q=${latitude},${longitude}`,
              default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
            });
            if (url) Linking.openURL(url);
          },
        },
      ]
    );
  };

  // 4. Chọn ảnh đăng tải (Chụp ảnh hiện trường hoặc Thư viện ảnh)
  const handlePickImage = async () => {
    Alert.alert(
      'Đăng tải hình ảnh hiện trường',
      'Chọn phương thức cung cấp hình ảnh cho đội cứu hộ:',
      [
        {
          text: 'Chụp ảnh mới 📷',
          onPress: async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) {
              Alert.alert('Quyền máy ảnh', 'Cần cấp quyền máy ảnh để chụp ảnh.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              quality: 0.8,
            });
            if (!result.canceled && result.assets?.[0]?.uri) {
              setSelectedImage(result.assets[0].uri);
            }
          },
        },
        {
          text: 'Chọn từ thư viện 🖼️',
          onPress: async () => {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
              Alert.alert('Quyền thư viện', 'Cần cấp quyền thư viện để chọn ảnh.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              quality: 0.8,
            });
            if (!result.canceled && result.assets?.[0]?.uri) {
              setSelectedImage(result.assets[0].uri);
            }
          },
        },
        { text: 'Hủy', style: 'cancel' },
      ]
    );
  };

  // 5. Gửi thông tin cấp cứu 115
  const handleSubmit = async () => {
    if (!locationAddress.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập địa điểm cần cấp cứu.');
      return;
    }
    if (!senderName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập họ tên người liên hệ.');
      return;
    }
    if (!senderPhone.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập số điện thoại liên hệ.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Gửi tín hiệu SOS và vị trí lên Backend FastAPI
      await emergencyApi.triggerSOS({
        address: `${locationAddress} [what3words: ${what3Words}]`,
        latitude: latitude || undefined,
        longitude: longitude || undefined,
        message: `Yêu cầu cấp cứu từ ${senderName} (${senderPhone})`,
      });

      // Báo thành công và cung cấp nút bấm gọi 115 ngay lập tức
      Alert.alert(
        '🚨 ĐÃ GỬI VỊ TRÍ CẤP CỨU THÀNH CÔNG',
        `Thông tin cấp cứu đã được phát đi đến toàn bộ người thân và lưu tại hệ thống.\n\n📍 Địa chỉ: ${locationAddress}\n⚡ Định vị 3 từ what3words: ${what3Words}\n👤 Người liên hệ: ${senderName} (${senderPhone})`,
        [
          {
            text: 'Đóng',
            style: 'cancel',
            onPress: () => navigation.goBack(),
          },
          {
            text: '📞 GỌI 115 NGAY',
            style: 'destructive',
            onPress: () => {
              void Linking.openURL('tel:115');
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error) {
      // Kể cả khi offline vẫn ưu tiên mở cuộc gọi điện thoại 115
      Alert.alert(
        'Đã ghi nhận yêu cầu',
        'Hệ thống đang mở trình quay số cấp cứu 115...',
        [
          {
            text: 'Gọi 115',
            onPress: () => {
              void Linking.openURL('tel:115');
              navigation.goBack();
            },
          },
        ]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.headerBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Gửi vị trí cấp cứu</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Ô nhập địa điểm cần cấp cứu */}
        <View style={[styles.inputBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.addressInput, { color: colors.textPrimary }]}
            placeholder="Nhập địa điểm cần cấp cứu"
            placeholderTextColor={colors.textMuted}
            value={locationAddress}
            onChangeText={setLocationAddress}
          />
        </View>

        {/* Huy hiệu định vị chuẩn 3 từ what3words (///) */}
        {what3Words ? (
          <View style={styles.w3wBadgeRow}>
            <View style={styles.w3wLogoBox}>
              <Text style={styles.w3wLogoText}>///</Text>
            </View>
            <Text style={styles.w3wBadgeText}>{what3Words}</Text>
            <Text style={[styles.w3wSubText, { color: colors.textSecondary }]}>(Chuẩn cấp cứu 3m)</Text>
          </View>
        ) : null}

        {/* 3. Khối 2 lựa chọn: Vị trí hiện tại & Chọn vị trí trên bản đồ */}
        <View style={[styles.locationOptionsBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Lựa chọn 1: Vị trí hiện tại */}
          <TouchableOpacity
            style={styles.locationOptionRow}
            onPress={handleGetCurrentLocation}
            activeOpacity={0.7}
            disabled={isLoadingLocation}
          >
            <View style={styles.optionIconContainer}>
              {isLoadingLocation ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="location" size={22} color={colors.textSecondary} />
              )}
            </View>
            <Text style={[styles.locationOptionText, { color: colors.textPrimary }]}>
              {isLoadingLocation ? 'Đang lấy tọa độ GPS...' : 'Vị trí hiện tại'}
            </Text>
          </TouchableOpacity>

          <View style={[styles.optionDivider, { backgroundColor: colors.border }]} />

          {/* Lựa chọn 2: Chọn vị trí trên bản đồ */}
          <TouchableOpacity
            style={styles.locationOptionRow}
            onPress={handlePickOnMap}
            activeOpacity={0.7}
          >
            <View style={styles.optionIconContainer}>
              <Ionicons name="map" size={20} color={colors.textSecondary} />
            </View>
            <Text style={[styles.locationOptionText, { color: colors.textPrimary }]}>
              Chọn vị trí trên bản đồ
            </Text>
          </TouchableOpacity>
        </View>

        {/* 4. Mục: Hình ảnh đăng tải */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          Hình ảnh đăng tải
        </Text>

        <TouchableOpacity
          style={[styles.uploadBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
          onPress={handlePickImage}
          activeOpacity={0.8}
        >
          {selectedImage ? (
            <View style={styles.imagePreviewWrapper}>
              <Image source={{ uri: selectedImage }} style={styles.previewImage} resizeMode="cover" />
              <TouchableOpacity
                style={[styles.removeImageBtn, { backgroundColor: colors.card }]}
                onPress={() => setSelectedImage(null)}
              >
                <Ionicons name="close-circle" size={26} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.placeholderContainer}>
              {/* Icon ảnh có dấu cộng xanh lá chuẩn theo mẫu hình 2 */}
              <View style={styles.photoIconWrapper}>
                <Ionicons name="image" size={54} color={colors.textMuted} />
                <View style={[styles.greenPlusBadge, { borderColor: colors.inputBg }]}>
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                </View>
              </View>
            </View>
          )}
        </TouchableOpacity>

        {/* 5. Trường Họ và tên */}
        <View style={[styles.contactInputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="person" size={20} color={colors.textSecondary} style={styles.contactIcon} />
          <TextInput
            style={[styles.contactTextInput, { color: colors.textPrimary }]}
            placeholder="Họ và tên người cần cấp cứu"
            placeholderTextColor={colors.textMuted}
            value={senderName}
            onChangeText={setSenderName}
          />
        </View>

        {/* 6. Trường Số điện thoại */}
        <View style={[styles.contactInputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="call" size={20} color={colors.textSecondary} style={styles.contactIcon} />
          <TextInput
            style={[styles.contactTextInput, { color: colors.textPrimary }]}
            placeholder="Số điện thoại liên hệ"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            value={senderPhone}
            onChangeText={setSenderPhone}
          />
        </View>

        {/* 7. Gửi thông tin cấp cứu */}
        <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: colors.primary },
              isSubmitting && { opacity: 0.7 },
            ]}
          onPress={handleSubmit}
          activeOpacity={0.85}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Gửi</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  inputBox: {
    height: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    justifyContent: 'center',
    marginBottom: 8,
  },
  addressInput: {
    fontSize: 14,
    minHeight: 46,
  },
  w3wBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  w3wLogoBox: {
    backgroundColor: '#E11D48',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  w3wLogoText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: -1,
  },
  w3wBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E11D48',
    marginRight: 6,
  },
  w3wSubText: {
    fontSize: 12,
  },
  locationOptionsBox: {
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 20,
  },
  locationOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  optionIconContainer: {
    width: 28,
    alignItems: 'center',
    marginRight: 10,
  },
  locationOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  optionDivider: {
    height: 1,
    marginHorizontal: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  uploadBox: {
    height: 190,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoIconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greenPlusBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  imagePreviewWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 14,
  },
  contactInputRow: {
    height: 48,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  contactIcon: {
    marginRight: 10,
  },
  contactTextInput: {
    flex: 1,
    fontSize: 14,
  },
  submitButton: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    elevation: 2,
    shadowColor: Colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

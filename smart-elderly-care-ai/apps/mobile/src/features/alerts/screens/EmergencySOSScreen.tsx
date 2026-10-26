import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { emergencyApi } from '../../../services/api';
import { useAuthStore } from '../../../store/useAuthStore';
import { useDeviceStore } from '../../../store/useDeviceStore';
import { useTheme } from '../../../store/useThemeStore';

// Kiểu dữ liệu tối thiểu của phản hồi Photon, dịch tọa độ thành địa chỉ trên web.
type PhotonReverseGeocodeResult = {
  features?: Array<{
    properties?: {
      name?: string;
      housenumber?: string;
      street?: string;
      locality?: string;
      district?: string;
      city?: string;
      county?: string;
      state?: string;
      country?: string;
    };
  }>;
};

const uniqueAddressParts = (parts: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  // Bỏ phần trống và phần bị lặp (không phân biệt hoa/thường) để địa chỉ gọn hơn.
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => {
      if (!part) return false;
      const normalized = part.toLocaleLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
};

const formatPhotonAddress = (result: PhotonReverseGeocodeResult) => {
  const place = result.features?.[0]?.properties;
  if (!place) return '';
  const street = [place.housenumber, place.street].filter(Boolean).join(' ');
  const isNameDuplicate = !place.name || place.name === place.street || place.name === place.housenumber || place.name === street;
  const placeName = isNameDuplicate ? null : place.name;
  const parts = uniqueAddressParts([
    placeName,
    street,
    place.locality,
    place.district,
    place.city,
    place.county,
    place.state,
    place.country,
  ]);
  return parts.join(', ');
};

const resolveAddressFromCoords = async (latitude: number, longitude: number): Promise<string> => {
  // 1. Thử Photon Komoot (cực nhanh ~1s, không bị CORS, chính xác số nhà, tên đường, tổ thôn xã)
  try {
    const photonResp = await fetch(`https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}`);
    if (photonResp.ok) {
      const result = (await photonResp.json()) as PhotonReverseGeocodeResult;
      const addr = formatPhotonAddress(result);
      if (addr) return addr;
    }
  } catch (e) {
    console.warn('[ReverseGeocode] Photon error, trying backend:', e);
  }

  // 2. Thử gọi API backend (Nominatim & Photon Server-side, hỗ trợ tiếng Việt đầy đủ)
  try {
    const res = await emergencyApi.reverseGeocode(latitude, longitude);
    if (res.data?.address) {
      return res.data.address;
    }
  } catch (e) {
    console.warn('[ReverseGeocode] Backend API error, trying client fallbacks:', e);
  }

  // 3. Fallback BigDataCloud Client (chỉ có cấp phường/xã, quận, thành phố)
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=vi`;
    const resp = await fetch(bdcUrl);
    if (resp.ok) {
      const data = await resp.json();
      const parts = uniqueAddressParts([
        data.locality,
        data.city || data.principalSubdivision,
        data.countryName,
      ]);
      if (parts.length > 0) {
        return parts.join(', ');
      }
    }
  } catch (e) {
    console.warn('[ReverseGeocode] BigDataCloud error:', e);
  }

  return '';
};

export default function EmergencySOSScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { userName, full_name, userPhone, phone_number } = useAuthStore();
  const house = useDeviceStore((s) => s.house);
  // Dữ liệu biểu mẫu và trạng thái của các thao tác bất đồng bộ.
  const [address, setAddress] = useState(house?.address || '');
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [senderName, setSenderName] = useState(userName || full_name || '');
  const [senderPhone, setSenderPhone] = useState(userPhone || phone_number || '');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleGetCurrentLocation = async () => {
    setIsGettingLocation(true);
    try {
      // Chỉ tiếp tục lấy vị trí khi người dùng đã cấp quyền truy cập vị trí.
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Chưa được cấp quyền vị trí', 'Cho phép truy cập vị trí để xác định địa điểm cấp cứu.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = position.coords;
      setCoordinates({ latitude, longitude });

      try {
        let resolvedAddress = '';
        if (Platform.OS === 'web') {
          resolvedAddress = await resolveAddressFromCoords(latitude, longitude);
        } else {
          try {
            const places = await Location.reverseGeocodeAsync({ latitude, longitude });
            const place = places[0];
            const street = [place?.streetNumber, place?.street].filter(Boolean).join(' ');
            const resolved = uniqueAddressParts([
              street,
              place?.name,
              place?.district,
              place?.subregion,
              place?.city,
              place?.region,
              place?.country,
            ]).join(', ');
            // Nếu định vị native không trích xuất được số nhà/tên đường thì bổ sung từ Photon
            if (!street) {
              const detailedAddr = await resolveAddressFromCoords(latitude, longitude);
              resolvedAddress = detailedAddr || resolved;
            } else {
              resolvedAddress = resolved;
            }
          } catch {
            resolvedAddress = await resolveAddressFromCoords(latitude, longitude);
          }
        }

        // Nếu geocode không lấy được tên cụ thể thì ưu tiên lấy địa chỉ nhà đã lưu
        if (!resolvedAddress && house?.address) {
          resolvedAddress = house.address;
        }

        if (resolvedAddress) {
          setAddress(resolvedAddress);
        } else {
          Alert.alert('Không tìm được địa chỉ chi tiết', 'Đã lưu tọa độ GPS hiện tại để gửi cấp cứu.');
        }
      } catch (error) {
        console.warn('[EmergencySOSScreen] Could not resolve current address:', error);
        if (house?.address) {
          setAddress(house.address);
        }
      }
    } catch (error) {
      console.warn('[EmergencySOSScreen] Could not get current location:', error);
      if (house?.address) {
        setAddress(house.address);
      }
      Alert.alert('Không lấy được vị trí GPS', 'Đã tải địa chỉ nhà hoặc bạn có thể nhập thủ công.');
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleChooseOnMap = async () => {
    // Mở ứng dụng bản đồ bên ngoài với tọa độ hiện tại hoặc nội dung địa chỉ đã nhập.
    const query = coordinates
      ? `${coordinates.latitude},${coordinates.longitude}`
      : encodeURIComponent(address || 'Vietnam');
    const url = Platform.select({
      ios: `maps://?q=${query}`,
      android: `geo:0,0?q=${query}`,
      default: `https://www.google.com/maps/search/?api=1&query=${query}`,
    });
    if (!url) return;

    try {
      await Linking.openURL(url);
    } catch (error) {
      console.warn('[EmergencySOSScreen] Could not open map application:', error);
      Alert.alert('Không mở được bản đồ', 'Bạn có thể nhập địa chỉ cấp cứu vào ô địa chỉ.');
    }
  };

  const handlePickImage = async () => {
    // Xin quyền thư viện ảnh trước khi mở trình chọn ảnh của thiết bị.
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Chưa được cấp quyền', 'Cho phép truy cập thư viện ảnh để chọn ảnh.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      // Ảnh hiện chỉ được lưu để xem trước trên màn hình, chưa nằm trong payload SOS.
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    // Cần có ít nhất địa chỉ hoặc tọa độ để người nhận biết vị trí cấp cứu.
    if (!address.trim() && !coordinates) {
      Alert.alert('Thiếu địa điểm', 'Hãy lấy vị trí hiện tại hoặc nhập địa chỉ cấp cứu.');
      return;
    }
    if (!senderName.trim() || !senderPhone.trim()) {
      Alert.alert('Thiếu thông tin liên hệ', 'Vui lòng nhập họ tên và số điện thoại liên hệ.');
      return;
    }

    // Thông báo backend/người thân trước, sau đó mới mở trình gọi số cấp cứu 115.
    setIsSending(true);
    try {
      await emergencyApi.triggerSOS({
        address: address.trim() || undefined,
        latitude: coordinates?.latitude,
        longitude: coordinates?.longitude,
        message: `Yêu cầu cấp cứu từ ${senderName.trim()} (${senderPhone.trim()})`,
      });
    } catch (error) {
      console.warn('[EmergencySOSScreen] Could not notify household through backend:', error);
      Alert.alert('Không gửi được cảnh báo', 'Không thể thông báo cho người thân. Bạn vẫn có thể gọi 115.');
      setIsSending(false);
      return;
    }

    setIsSending(false);
    try {
      await Linking.openURL('tel:115');
    } catch (error) {
      console.warn('[EmergencySOSScreen] Could not open emergency dialer:', error);
      Alert.alert('Đã báo người thân', 'Không thể mở trình gọi. Vui lòng gọi cấp cứu 115 trực tiếp.');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Thanh tiêu đề và nút quay lại. */}
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          style={[styles.backButton, { backgroundColor: colors.inputBg }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.75}
        >
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Gửi vị trí cấp cứu</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Người dùng có thể nhập địa chỉ hoặc lấy tọa độ và tự điền địa chỉ. */}
        <TextInput
          accessibilityLabel="Địa chỉ cấp cứu"
          style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.textPrimary }]}
          placeholder="Nhập địa chỉ cấp cứu"
          placeholderTextColor={colors.textMuted}
          value={address}
          onChangeText={(value) => {
            setAddress(value);
          }}
        />

        {coordinates && (
          <Text style={[styles.coordinates, { color: colors.textSecondary }]}>
            Tọa độ: {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
          </Text>
        )}

        {/* Hai cách bổ sung vị trí: dùng vị trí hiện tại hoặc mở ứng dụng bản đồ. */}
        <View style={[styles.locationOptions, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.optionRow}
            onPress={handleGetCurrentLocation}
            disabled={isGettingLocation}
            activeOpacity={0.75}
          >
            {isGettingLocation ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="location" size={21} color={colors.textSecondary} />
            )}
            <Text style={[styles.optionText, { color: colors.textPrimary }]}>
              {isGettingLocation ? 'Đang lấy vị trí hiện tại...' : 'Vị trí hiện tại'}
            </Text>
          </TouchableOpacity>
          {Boolean(house?.address) && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.optionRow}
                onPress={() => {
                  setAddress(house?.address || '');
                }}
                activeOpacity={0.75}
              >
                <Ionicons name="home" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionText, { color: colors.textPrimary }]}>Dùng địa chỉ nhà của tôi</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>
                    {house?.address}
                  </Text>
                </View>
              </TouchableOpacity>
            </>
          )}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.optionRow}
            onPress={handleChooseOnMap}
            activeOpacity={0.75}
          >
            <Ionicons name="map" size={21} color={colors.textSecondary} />
            <Text style={[styles.optionText, { color: colors.textPrimary }]}>Chọn vị trí trên bản đồ</Text>
          </TouchableOpacity>
        </View>

        {/* Chọn ảnh để xem trước; ảnh chưa được gửi cùng yêu cầu SOS. */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Hình ảnh đăng tải</Text>
        <TouchableOpacity
          accessibilityRole="button"
          style={[styles.imagePicker, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handlePickImage}
          activeOpacity={0.8}
        >
          {selectedImage ? (
            <Image source={{ uri: selectedImage }} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={52} color={colors.textMuted} />
              <View style={styles.addImageBadge}>
                <Ionicons name="add" size={15} color="#FFFFFF" />
              </View>
            </View>
          )}
        </TouchableOpacity>

        {/* Thông tin liên hệ được dùng để tạo nội dung cảnh báo gửi lên backend. */}
        <TextInput
          accessibilityLabel="Họ tên người liên hệ"
          style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.textPrimary }]}
          placeholder="Họ tên người liên hệ"
          placeholderTextColor={colors.textMuted}
          value={senderName}
          onChangeText={setSenderName}
        />
        <TextInput
          accessibilityLabel="Số điện thoại liên hệ"
          style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.textPrimary }]}
          placeholder="Số điện thoại liên hệ"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          value={senderPhone}
          onChangeText={setSenderPhone}
        />

        {/* Nút này gửi cảnh báo; khi thành công sẽ mở trình gọi 115. */}
        <TouchableOpacity
          accessibilityRole="button"
          style={[styles.submitButton, isSending && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={isSending}
          activeOpacity={0.85}
        >
          {isSending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>Gửi & gọi 115</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// Các kiểu trình bày tĩnh của màn hình.
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 38,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 36,
    gap: 14,
  },
  textInput: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 14,
    fontSize: 14,
  },
  coordinates: {
    marginTop: -8,
    paddingHorizontal: 4,
    fontSize: 12,
  },
  locationOptions: {
    borderWidth: 1,
    borderRadius: 14,
  },
  optionRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 14,
  },
  sectionTitle: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '700',
  },
  imagePicker: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 14,
  },
  imagePlaceholder: {
    position: 'relative',
  },
  addImageBadge: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 11,
    backgroundColor: '#22C55E',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  submitButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    borderRadius: 15,
    backgroundColor: '#FF7A00',
  },
  disabledButton: {
    opacity: 0.7,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});

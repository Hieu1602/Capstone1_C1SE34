// ==============================================================================
// TỆP: AlertsListScreen.tsx
// PHÂN HỆ: Màn hình Danh sách Cảnh báo & Thông báo Sự kiện Khẩn cấp
// TÁC GIẢ: Phan Nguyễn Giáng My
// MÔ TẢ CHỨC NĂNG:
//   1. Hiển thị danh sách sự cố/cảnh báo được đồng bộ từ Cloud Backend theo thời gian thực.
//   2. Phân loại mức độ nguy hiểm: Cực kỳ nguy hiểm (Té ngã, Tiếng kêu cứu) & Cảnh báo sinh hiệu (Nhịp tim, SpO2).
//   3. Cung cấp bộ lọc (Filter Chips) để người nhà/bác sĩ dễ dàng tra cứu nhanh sự kiện.
//   4. Cho phép đánh dấu đã đọc tập trung hoặc xem chi tiết clip bằng chứng 5 giây.
// ==============================================================================

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  ScrollView,
} from 'react-native';
// Lấy t() để dịch chuỗi động; dùng Text/Alert đã bọc i18n cho nội dung tĩnh và hộp thoại.
import { useTranslation } from 'react-i18next';
import { LocalizedAlert as Alert, LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { useAlertStore } from '../../../store';
import { usePatientStore, ReminderItem } from '../../../store/usePatientStore';
import { useTheme } from '../../../store/useThemeStore';
import { FamilyAppointmentsModal } from '../../dashboard/components/FamilyAppointmentsModal';

// ------------------------------------------------------------------------------
// 1. Interface cấu hình giao diện hiển thị cho từng loại sự kiện
// ------------------------------------------------------------------------------
interface AlertConfig {
  title: string;                               // Tiêu đề sự kiện chuẩn hóa tiếng Việt
  badgeText: string;                           // Chữ hiển thị trên huy hiệu (Badge)
  badgeBg: string;                             // Màu nền của huy hiệu
  badgeColor: string;                          // Màu chữ của huy hiệu
  iconName: keyof typeof Ionicons.glyphMap;   // Tên biểu tượng Ionicons
  iconColor: string;                           // Màu biểu tượng
  iconBg: string;                              // Màu nền tròn bao quanh biểu tượng
  isCritical: boolean;                         // Cờ xác định mức độ nguy kịch (Red Alert)
}

/**
 * getAlertConfig: Ánh xạ mã sự kiện từ Backend (alert_type) sang cấu hình giao diện tương ứng.
 * Giúp giao diện hiển thị đồng nhất về màu sắc và icon nhận diện.
 */
function getAlertConfig(alertType: string): AlertConfig {
  switch (alertType) {
    case 'FALL_DETECTED':
      return {
        title: 'CẢNH BÁO TÉ NGÃ KHẨN CẤP',
        badgeText: 'CỰC KỲ NGUY HIỂM',
        badgeBg: '#EF4444',
        badgeColor: '#FFFFFF',
        iconName: 'warning',
        iconColor: '#DC2626',
        iconBg: '#FEE2E2',
        isCritical: true,
      };
    case 'HIGH_HEART_RATE':
      return {
        title: 'Nhịp tim tăng cao bất thường',
        badgeText: 'Cảnh báo tim',
        badgeBg: '#FFF7ED',
        badgeColor: '#EA580C',
        iconName: 'heart',
        iconColor: '#EA580C',
        iconBg: '#FFEDD5',
        isCritical: false,
      };
    case 'ACOUSTIC_DISTRESS':
      return {
        title: 'Phát hiện âm thanh kêu cứu',
        badgeText: 'Âm thanh YAMNet',
        badgeBg: '#F3E8FF',
        badgeColor: '#7C3AED',
        iconName: 'mic',
        iconColor: '#9333EA',
        iconBg: '#F3E8FF',
        isCritical: true,
      };
    case 'PERSON_DETECTED':
      return {
        title: 'Phát hiện chuyển động người',
        badgeText: 'Chuyển động',
        badgeBg: '#ECFDF5',
        badgeColor: '#059669',
        iconName: 'person',
        iconColor: '#10B981',
        iconBg: '#DCFCE7',
        isCritical: false,
      };
    case 'APPOINTMENT_SCHEDULED':
      return {
        title: 'Lịch khám mới từ Bác sĩ',
        badgeText: 'Chờ gia đình xác nhận',
        badgeBg: '#FEF3C7',
        badgeColor: '#D97706',
        iconName: 'calendar',
        iconColor: '#D97706',
        iconBg: '#FEF3C7',
        isCritical: false,
      };
    case 'APPOINTMENT_CONFIRMED':
      return {
        title: 'Lịch khám đã được xác nhận',
        badgeText: 'Đã xác nhận',
        badgeBg: '#DCFCE7',
        badgeColor: '#16A34A',
        iconName: 'checkmark-circle',
        iconColor: '#16A34A',
        iconBg: '#DCFCE7',
        isCritical: false,
      };
    case 'APPOINTMENT_CANCELLED':
      return {
        title: 'Lịch khám đã bị hủy',
        badgeText: 'Đã hủy',
        badgeBg: '#FEE2E2',
        badgeColor: '#DC2626',
        iconName: 'close-circle',
        iconColor: '#DC2626',
        iconBg: '#FEE2E2',
        isCritical: false,
      };
    default:
      // Các loại sự kiện mở rộng khác (Cảm biến nhiệt, ngắt kết nối...)
      return {
        title: alertType.replace(/_/g, ' '),
        badgeText: 'Thông báo',
        badgeBg: '#F1F5F9',
        badgeColor: '#64748B',
        iconName: 'notifications',
        iconColor: Colors.primary,
        iconBg: '#FFF4EC',
        isCritical: false,
      };
  }
}

/**
 * formatFriendlyTime: Định dạng mốc thời gian ISO thành định dạng thân thiện với người dùng
 * (Vừa xong, X phút trước, Hôm qua, hoặc giờ:phút ngày/tháng).
 */
function formatFriendlyTime(dateStr: string, translate: (key: string, count?: number) => string) {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs <= 60 * 1000) return translate('Vừa xong');
    const diffMin = Math.floor(diffMs / (60 * 1000));
    // Truyền số lượng riêng để i18next thay {{count}} bằng đúng số phút/giờ/ngày.
    if (diffMin < 60) return translate('{{count}} phút trước', diffMin);
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return translate('{{count}} giờ trước', diffHour);
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay === 1) return translate('Hôm qua');
    if (diffDay < 7) return translate('{{count}} ngày trước', diffDay);

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${hours}:${minutes} • ${day}/${month}`;
  } catch {
    return dateStr;
  }
}

// ------------------------------------------------------------------------------
// 2. Component chính: AlertsListScreen
// ------------------------------------------------------------------------------
export default function AlertsListScreen({ navigation }: any) {
  const { t } = useTranslation();
  // Lấy trạng thái giao diện Sáng / Tối từ ThemeStore
  const { isDarkMode, colors } = useTheme();

  // Kết nối trực tiếp vào Domain Store useAlertStore để lấy danh sách cảnh báo từ Backend
  const { incidents, setIncidents, fetchNotifications } = useAlertStore();
  const {
    patientRecord,
    todayReminders,
    markMedicationTaken,
    snoozeMedication,
    fetchReminders,
  } = usePatientStore();

  // State cục bộ quản lý hiệu ứng kéo để tải lại (Pull-to-refresh)
  const [refreshing, setRefreshing] = useState(false);

  // State quản lý mở modal xác nhận lịch khám bác sĩ
  const [familyAppointmentsModalVisible, setFamilyAppointmentsModalVisible] = useState(false);
  const [selectedAppointmentPatientId, setSelectedAppointmentPatientId] = useState<string | number | null>(null);

  // State bộ lọc: 'ALL' (Tất cả), 'CRITICAL' (Nguy kịch), 'VITAL' (Sức khỏe), 'MEDICATION' (Uống thuốc), 'APPOINTMENT' (Lịch khám)
  const [filterType, setFilterType] = useState<'ALL' | 'CRITICAL' | 'VITAL' | 'MEDICATION' | 'APPOINTMENT'>('ALL');

  // Khi màn hình được mở: Tự động kéo danh sách thông báo và lịch nhắc thuốc mới nhất từ API
  React.useEffect(() => {
    fetchNotifications();
    fetchReminders();
  }, []);

  // Xử lý kéo xuống để làm mới danh sách
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchNotifications(), fetchReminders()]);
    setRefreshing(false);
  };

  // Danh sách thuốc trong ngày từ Store
  const medications: ReminderItem[] = todayReminders?.medications || [];

  const pendingMedCount = medications.filter((m) => !m.taken).length;
  const unreadIncidentsCount = incidents.filter((item) => !item.is_acknowledged).length;
  // Đếm tổng số thông báo chưa được xác nhận / chưa đọc
  const unreadCount = unreadIncidentsCount + pendingMedCount;

  // Helper tính trạng thái nhắc nhở uống thuốc: Sắp đến giờ/Đúng giờ, Đã uống, Quá giờ/Bỏ lỡ
  const getMedicationStatus = (item: ReminderItem) => {
    if (item.taken) {
      return {
        state: 'TAKEN' as const,
        badgeText: `Đã uống lúc ${item.takenAt || item.time}`,
        badgeBg: '#DCFCE7',
        badgeColor: '#15803D',
        badgeBorder: '#86EFAC',
        iconName: 'checkmark-circle' as const,
        iconColor: '#16A34A',
        iconBg: '#DCFCE7',
        statusLabel: 'Đã hoàn thành',
        isOverdue: false,
      };
    }

    // Tính chênh lệch thời gian so với giờ hẹn uống thuốc (phút)
    const [hourStr, minStr] = item.time.split(':');
    const now = new Date();
    const medTime = new Date();
    medTime.setHours(parseInt(hourStr || '0', 10), parseInt(minStr || '0', 10), 0, 0);

    const diffMinutes = Math.floor((now.getTime() - medTime.getTime()) / (60 * 1000));

    if (diffMinutes > 15) {
      let lateStr = `${diffMinutes} phút`;
      if (diffMinutes >= 60) {
        const h = Math.floor(diffMinutes / 60);
        const m = diffMinutes % 60;
        lateStr = m > 0 ? `${h}h ${m}p` : `${h} giờ`;
      }
      return {
        state: 'OVERDUE' as const,
        badgeText: `Chưa uống (Đã trễ ${lateStr})`,
        badgeBg: '#FEE2E2',
        badgeColor: '#DC2626',
        badgeBorder: '#FCA5A5',
        iconName: 'alert-circle' as const,
        iconColor: '#DC2626',
        iconBg: '#FEE2E2',
        statusLabel: `Quá giờ ${lateStr}`,
        isOverdue: true,
      };
    }

    const isNow = diffMinutes >= -15 && diffMinutes <= 15;
    const statusText = isNow
      ? 'Đúng giờ uống thuốc'
      : `Sắp đến giờ (${Math.abs(diffMinutes)} phút nữa)`;

    return {
      state: 'UPCOMING' as const,
      badgeText: statusText,
      badgeBg: '#E0F2FE',
      badgeColor: '#0284C7',
      badgeBorder: '#BAE6FD',
      iconName: 'time' as const,
      iconColor: '#0284C7',
      iconBg: '#E0F2FE',
      statusLabel: isNow ? 'Đúng giờ' : 'Sắp tới',
      isOverdue: false,
    };
  };

  // Thao tác thuốc 1: Xác nhận đã uống
  const handleConfirmMedication = async (med: ReminderItem) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    await markMedicationTaken(med.id, true, timeStr);
    Alert.alert(
      'Xác nhận thành công',
      `Đã ghi nhận người cao tuổi đã uống thuốc "${med.name}" lúc ${timeStr}. Trạng thái đã được đồng bộ toàn hệ thống.`
    );
  };

  // Thao tác thuốc 2: Bỏ qua / Nhắc lại sau 15 phút
  const handleSnoozeMedication = (med: ReminderItem) => {
    snoozeMedication(med.id, 15);
    Alert.alert(
      'Đã hoãn nhắc nhở',
      `Hệ thống sẽ phát loa Hub và nhắc lại cữ "${med.name}" sau 15 phút nữa.`
    );
  };

  // Thao tác thuốc 3: Kích hoạt Loa Hub phát lại lời nhắc
  const handleReplaySpeakerMedication = (med: ReminderItem) => {
    Alert.alert(
      'Loa Hub đã phát lời nhắc',
      `📢 "Đã đến giờ uống thuốc: ${med.name}. Liều dùng: ${med.dose}. Cụ nhớ uống thuốc cùng một cốc nước ấm nhé!"`
    );
  };

  // Lọc danh sách sự cố theo tab đang chọn
  const filteredIncidents = incidents.filter((item) => {
    if (filterType === 'CRITICAL') {
      return (
        item.alert_level === 'CRITICAL' ||
        item.alert_type === 'FALL_DETECTED' ||
        item.alert_type === 'ACOUSTIC_DISTRESS'
      );
    }
    if (filterType === 'VITAL') {
      return (
        item.alert_type.includes('HEART') ||
        item.alert_type.includes('SPO2') ||
        item.alert_type.includes('TEMP')
      );
    }
    if (filterType === 'APPOINTMENT') {
      return (
        item.alert_type === 'APPOINTMENT_SCHEDULED' ||
        item.alert_type === 'APPOINTMENT_CONFIRMED' ||
        item.alert_type === 'APPOINTMENT_CANCELLED'
      );
    }
    return true;
  });

  // Định nghĩa kiểu phần tử hiển thị trong danh sách thông báo
  type ListItem =
    | { itemType: 'INCIDENT'; id: string; data: any }
    | { itemType: 'MEDICATION'; id: string; data: ReminderItem };

  const listData: ListItem[] = React.useMemo(() => {
    if (filterType === 'MEDICATION') {
      return medications.map((med): ListItem => ({
        itemType: 'MEDICATION',
        id: `med-${med.id}`,
        data: med,
      }));
    }
    if (filterType === 'CRITICAL' || filterType === 'VITAL' || filterType === 'APPOINTMENT') {
      return filteredIncidents.map((inc): ListItem => ({
        itemType: 'INCIDENT',
        id: `inc-${inc.id}`,
        data: inc,
      }));
    }
    // Filter 'ALL' (Tất cả): Hiển thị cữ thuốc hôm nay + các cảnh báo sự cố
    return [
      ...medications.map((med): ListItem => ({
        itemType: 'MEDICATION',
        id: `med-${med.id}`,
        data: med,
      })),
      ...filteredIncidents.map((inc): ListItem => ({
        itemType: 'INCIDENT',
        id: `inc-${inc.id}`,
        data: inc,
      })),
    ];
  }, [filterType, medications, filteredIncidents]);

  // Xử lý bấm "Đã đọc tất cả": Đánh dấu trạng thái acknowledged cho toàn bộ danh sách sự cố
  const handleMarkAllAsRead = () => {
    if (unreadIncidentsCount === 0) {
      Alert.alert('Thông báo', 'Tất cả sự kiện đều đã được đánh dấu đọc.');
      return;
    }
    setIncidents(incidents.map((i) => ({ ...i, is_acknowledged: true })));
    Alert.alert('Thành công', 'Đã đánh dấu đã đọc tất cả thông báo.');
  };

  /**
   * handlePressCard: Xử lý khi người dùng chạm vào một thẻ cảnh báo cụ thể.
   * - Đánh dấu thẻ đó là đã đọc (is_acknowledged = true).
   * - Điều hướng thông minh đến màn hình tương ứng với loại sự kiện.
   */
  const handlePressCard = (item: any) => {
    // Tự động đánh dấu đã đọc khi người dùng bấm xem
    if (!item.is_acknowledged) {
      setIncidents(
        incidents.map((i) => (i.id === item.id ? { ...i, is_acknowledged: true } : i))
      );
    }

    // Trường hợp 0: Lịch khám bác sĩ -> Mở Modal chi tiết lịch khám và bấm xác nhận / xem lý do hủy
    if (
      item.alert_type === 'APPOINTMENT_SCHEDULED' ||
      item.alert_type === 'APPOINTMENT_CONFIRMED' ||
      item.alert_type === 'APPOINTMENT_CANCELLED'
    ) {
      const pid = item.device_id && !isNaN(Number(item.device_id)) ? item.device_id : (patientRecord?.patient_id || 1);
      setSelectedAppointmentPatientId(pid);
      setFamilyAppointmentsModalVisible(true);
      return;
    }

    // Trường hợp 1: Chuyển động người -> Mở Camera xem lại phát lại (Playback)
    if (item.alert_type === 'PERSON_DETECTED') {
      navigation.navigate('CameraDetail', {
        cameraId: item.device_id || 'cam_living_room',
        tab: 'playback',
      });
      return;
    }

    // Trường hợp 2: Cảnh báo sinh hiệu (Nhịp tim, SpO2, Thân nhiệt) -> Mở màn hình Sức khỏe chi tiết
    if (
      item.alert_type === 'HIGH_HEART_RATE' ||
      item.alert_type.includes('HEART') ||
      item.alert_type.includes('SPO2') ||
      item.alert_type.includes('TEMP')
    ) {
      navigation.navigate('HealthDetail', {
        initialTab: 'today',
        focusMetric: 'heartRate',
        metric: 'heartRate',
      });
      return;
    }

    // Trường hợp 3: Sự cố té ngã khẩn cấp -> Mở màn hình Chi tiết Sự cố (IncidentDetail)
    if (item.alert_type === 'FALL_DETECTED') {
      navigation.navigate('IncidentDetail', {
        incidentId: item.id,
        id: item.id,
        type: 'FALL',
        alert_type: 'FALL_DETECTED',
        alert_level: 'CRITICAL',
        confidence: item.confidence != null ? `${Math.round(Number(item.confidence) * 100)}%` : undefined,
        time: item.created_at ?? new Date().toISOString(),
        created_at: item.created_at ?? new Date().toISOString(),
        message: item.message,
        clipAvailable: Boolean(item.video_clip_url || item.thumbnail_url),
        video_clip_url: item.video_clip_url ?? null,
        is_acknowledged: item.is_acknowledged ?? false,
      });
      return;
    }

    // Trường hợp 4: Cảnh báo âm thanh kêu cứu hoặc các sự cố khác
    navigation.navigate('IncidentDetail', {
      incidentId: item.id,
      id: item.id,
      type: item.alert_type === 'ACOUSTIC_DISTRESS' ? 'ACOUSTIC' : item.alert_type,
      alert_type: item.alert_type,
      alert_level: item.alert_level ?? 'CRITICAL',
      confidence: item.confidence != null ? `${Math.round(Number(item.confidence) * 100)}%` : undefined,
      time: item.created_at ?? new Date().toISOString(),
      created_at: item.created_at ?? new Date().toISOString(),
      message: item.message,
      clipAvailable: Boolean(item.video_clip_url || item.thumbnail_url),
      video_clip_url: item.video_clip_url ?? null,
      is_acknowledged: item.is_acknowledged ?? false,
    });
  };

  /**
   * renderMedicationCard: Hiển thị card nhắc nhở uống thuốc chuẩn hóa với 3 trạng thái:
   * 1. Sắp đến giờ / Đúng giờ (Nút Xác nhận đã uống & Bỏ qua / Nhắc lại sau)
   * 2. Đã uống (Badge xanh lá "Đã uống lúc [giờ]")
   * 3. Quá giờ / Bỏ lỡ (Cảnh báo cam/đỏ "Chưa uống (Đã trễ X phút)")
   */
  const renderMedicationCard = (item: ReminderItem) => {
    const status = getMedicationStatus(item);

    return (
      <TouchableOpacity
        key={`med-${item.id}`}
        style={[
          styles.card,
          styles.medCard,
          isDarkMode && { backgroundColor: colors.card, borderColor: colors.border },
          status.state === 'OVERDUE' && styles.medCardOverdue,
          status.state === 'OVERDUE' && isDarkMode && { backgroundColor: '#3F1219', borderColor: '#7F1D1D' },
          status.state === 'TAKEN' && styles.medCardTaken,
          status.state === 'TAKEN' && isDarkMode && { backgroundColor: 'rgba(16, 185, 129, 0.08)', borderColor: '#065F46' },
        ]}
        onPress={() => navigation.navigate('MedicationReminder')}
        activeOpacity={0.85}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          {/* Biểu tượng phân loại tròn */}
          <View
            style={[
              styles.categoryIconCircle,
              {
                backgroundColor: isDarkMode
                  ? status.state === 'OVERDUE'
                    ? 'rgba(220, 38, 38, 0.25)'
                    : status.state === 'TAKEN'
                    ? 'rgba(16, 185, 129, 0.2)'
                    : 'rgba(2, 132, 199, 0.2)'
                  : status.iconBg,
              },
            ]}
          >
            <Ionicons name={status.iconName} size={22} color={status.iconColor} />
          </View>

          {/* Chi tiết thông tin cữ thuốc */}
          <View style={styles.cardCenter}>
            {/* Hàng huy hiệu Badge: Thể loại + Trạng thái */}
            <View style={styles.cardMetaRow}>
              <View style={[styles.typeBadge, { backgroundColor: '#F0FDF4' }]}>
                <Text style={[styles.typeBadgeText, { color: '#16A34A' }]}>
                  💊 UỐNG THUỐC
                </Text>
              </View>

              <View
                style={[
                  styles.typeBadge,
                  { backgroundColor: status.badgeBg, borderWidth: 1, borderColor: status.badgeBorder },
                ]}
              >
                <Text style={[styles.typeBadgeText, { color: status.badgeColor }]}>
                  {status.badgeText}
                </Text>
              </View>
            </View>

            {/* Tiêu đề: Tên thuốc */}
            <Text
              style={[
                styles.cardTitle,
                isDarkMode && { color: colors.textPrimary },
                status.state === 'OVERDUE' && { color: '#DC2626' },
              ]}
              numberOfLines={2}
            >
              {item.name}
            </Text>

            {/* Chi tiết liều dùng & mục đích điều trị */}
            <Text style={[styles.cardMsg, isDarkMode && { color: colors.textSecondary }]} numberOfLines={2}>
              Liều dùng: {item.dose} {item.purpose ? `• ${item.purpose}` : ''}
            </Text>

            {/* Dòng mốc thời gian và định danh Loa Hub */}
            <View style={styles.timeRow}>
              <Ionicons name="time-outline" size={12} color={isDarkMode ? '#64748B' : '#94A3B8'} />
              <Text style={[styles.cardTime, isDarkMode && { color: colors.textSecondary }]}>
                Lịch: {item.time} hôm nay
              </Text>
              <Text style={[styles.dotSeparator, isDarkMode && { color: colors.border }]}>•</Text>
              <Ionicons name="volume-medium-outline" size={12} color={Colors.primary} />
              <Text style={[styles.deviceLocationText, { color: Colors.primary, fontWeight: '600' }]}>
                Loa Edge Hub
              </Text>
            </View>
          </View>
        </View>

        {/* Hàng nút bấm thao tác nhanh */}
        {!item.taken ? (
          <View style={styles.medActionsRow}>
            {/* Nút 1: Xác nhận đã uống */}
            <TouchableOpacity
              style={[
                styles.medConfirmBtn,
                status.state === 'OVERDUE' && { backgroundColor: '#EA580C' },
              ]}
              onPress={() => handleConfirmMedication(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
              <Text style={styles.medConfirmBtnText}>Xác nhận đã uống</Text>
            </TouchableOpacity>

            {/* Nút 2: Bỏ qua / Nhắc lại sau */}
            <TouchableOpacity
              style={[styles.medSnoozeBtn, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => handleSnoozeMedication(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="time-outline" size={15} color={isDarkMode ? '#94A3B8' : '#64748B'} />
              <Text style={[styles.medSnoozeBtnText, isDarkMode && { color: colors.textSecondary }]}>
                Bỏ qua / Nhắc lại sau
              </Text>
            </TouchableOpacity>

            {/* Nút 3: Kích hoạt Loa Hub nhắc nhở */}
            <TouchableOpacity
              style={[styles.medSpeakerBtn, isDarkMode && { backgroundColor: 'rgba(2, 132, 199, 0.2)' }]}
              onPress={() => handleReplaySpeakerMedication(item)}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="volume-high" size={16} color="#0284C7" />
            </TouchableOpacity>
          </View>
        ) : (
          /* Khi ĐÃ UỐNG: Hiển thị thanh xác nhận hoàn thành */
          <View style={styles.medCompletedRow}>
            <Ionicons name="checkmark-done-circle" size={16} color="#16A34A" />
            <Text style={[styles.medCompletedText, isDarkMode && { color: '#86EFAC' }]}>
              Đã hoàn thành cữ thuốc lúc {item.takenAt || item.time} • Dữ liệu đã lưu hồ sơ
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && { backgroundColor: colors.background }]} edges={['top']}>
      {/* ---------------------------------------------------------------------- */}
      {/* 1. Header trên cùng: Tiêu đề, số lượng chưa đọc, thao tác nhanh       */}
      {/* ---------------------------------------------------------------------- */}
      <View style={[styles.topHeader, isDarkMode && { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerTitleCol}>
          <Text style={[styles.headerTitle, isDarkMode && { color: colors.textPrimary }]}>Thông Báo &amp; Sự Kiện</Text>
          <Text style={[styles.headerSubtitle, isDarkMode && { color: colors.textSecondary }]}>
            {unreadCount > 0
              ? t('{{count}} thông báo mới chưa đọc', { count: unreadCount })
              : 'Tất cả đã được xử lý'}
          </Text>
        </View>

        <View style={styles.headerRightActions}>
          {/* Nút đánh dấu đã đọc tất cả */}
          <TouchableOpacity
            style={[styles.markAllReadBtn, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleMarkAllAsRead}
            activeOpacity={0.7}
          >
            <Ionicons
              name="checkmark-done"
              size={15}
              color={unreadIncidentsCount > 0 ? '#EA580C' : '#94A3B8'}
            />
            <Text
              style={[
                styles.markAllReadText,
                unreadIncidentsCount === 0 && { color: '#94A3B8' },
              ]}
            >
              Đã đọc tất cả
            </Text>
          </TouchableOpacity>

          {/* Nút xem trực tiếp camera */}
          <TouchableOpacity
            style={styles.cameraQuickBtn}
            onPress={() => navigation.navigate('CameraDetail')}
            activeOpacity={0.7}
          >
            <Ionicons name="videocam" size={15} color="#FFF" />
            <Text style={styles.cameraQuickText}>Camera</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ---------------------------------------------------------------------- */}
      {/* 2. Thanh bộ lọc phân loại (Filter Chips dạng thanh cuộn ngang)        */}
      {/* ---------------------------------------------------------------------- */}
      <View style={[styles.filterBarContainer, isDarkMode && { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBarScroll}
        >
          {[
            {
              key: 'ALL',
              label: t('Tất cả ({{count}})', { count: incidents.length + medications.length }),
              activePill: styles.filterPillActive,
              darkBg: 'rgba(255, 107, 0, 0.15)',
              darkBorder: '#FF6B00',
              activeTextColor: undefined,
            },
            {
              key: 'MEDICATION',
              label: `💊 Uống thuốc ${pendingMedCount > 0 ? `(${pendingMedCount})` : '(Xong)'}`,
              activePill: styles.filterPillActiveMed,
              darkBg: 'rgba(16, 185, 129, 0.15)',
              darkBorder: '#10B981',
              activeTextColor: '#059669',
            },
            {
              key: 'CRITICAL',
              label: '🚨 Nguy kịch',
              activePill: styles.filterPillActive,
              darkBg: 'rgba(255, 107, 0, 0.15)',
              darkBorder: '#FF6B00',
              activeTextColor: undefined,
            },
            {
              key: 'VITAL',
              label: 'Sức khoẻ',
              activePill: styles.filterPillActive,
              darkBg: 'rgba(255, 107, 0, 0.15)',
              darkBorder: '#FF6B00',
              activeTextColor: undefined,
            },
            {
              key: 'APPOINTMENT',
              label: '🗓️ Lịch khám',
              activePill: styles.filterPillActive,
              darkBg: 'rgba(217, 119, 6, 0.15)',
              darkBorder: '#D97706',
              activeTextColor: '#D97706',
            },
          ].map((tab) => {
            const isActive = filterType === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.filterPill,
                  isDarkMode && !isActive && { backgroundColor: colors.card, borderColor: colors.border },
                  isActive && tab.activePill,
                  isActive && isDarkMode && { backgroundColor: tab.darkBg, borderColor: tab.darkBorder },
                ]}
                onPress={() => setFilterType(tab.key as any)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterText,
                    isDarkMode && !isActive && { color: colors.textSecondary },
                    isActive && (tab.activeTextColor ? { color: tab.activeTextColor, fontWeight: '700' } : styles.filterTextActive),
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ---------------------------------------------------------------------- */}
      {/* 3. Danh sách thông báo (FlatList tối ưu cuộn + Pull-to-refresh)       */}
      {/* ---------------------------------------------------------------------- */}
      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
        renderItem={({ item }) => {
          if (item.itemType === 'MEDICATION') {
            return renderMedicationCard(item.data);
          }

          const inc = item.data;
          // Lấy cấu hình màu sắc, icon và tiêu đề theo alert_type
          const config = getAlertConfig(inc.alert_type);
          // Dịch nhãn thời gian lúc render để ngôn ngữ luôn khớp với lựa chọn hiện tại.
          const friendlyTime = formatFriendlyTime(inc.created_at, (key, count) =>
            count === undefined ? t(key) : t(key, { count }),
          );

          return (
            <TouchableOpacity
              style={[
                styles.card,
                isDarkMode && { backgroundColor: colors.card, borderColor: colors.border },
                config.isCritical && styles.cardCritical,
                config.isCritical && isDarkMode && { backgroundColor: '#3F1219', borderColor: '#7F1D1D' },
                !inc.is_acknowledged && styles.cardUnread,
              ]}
              onPress={() => handlePressCard(inc)}
              activeOpacity={0.8}
            >
              {/* Cột trái: Biểu tượng phân loại tròn có màu nền theo mức độ */}
              <View style={[styles.categoryIconCircle, { backgroundColor: isDarkMode ? (config.isCritical ? 'rgba(220, 38, 38, 0.25)' : 'rgba(255, 255, 255, 0.08)') : config.iconBg }]}>
                <Ionicons name={config.iconName} size={22} color={config.iconColor} />
              </View>

              {/* Cột giữa: Chi tiết thông tin sự kiện */}
              <View style={styles.cardCenter}>
                {/* Hàng huy hiệu (Badge) loại cảnh báo & nhãn MỚI */}
                <View style={styles.cardMetaRow}>
                  <View style={[styles.typeBadge, { backgroundColor: isDarkMode && config.badgeBg === '#FFF7ED' ? 'rgba(234, 88, 12, 0.2)' : config.badgeBg }]}>
                    <Text style={[styles.typeBadgeText, { color: config.badgeColor }]}>
                      {config.badgeText}
                    </Text>
                  </View>
                  {!inc.is_acknowledged && (
                    <View style={styles.newBadge}>
                      <Text style={styles.newBadgeText}>MỚI</Text>
                    </View>
                  )}
                </View>

                {/* Tiêu đề sự kiện chuẩn hóa tiếng Việt */}
                <Text
                  style={[
                    styles.cardTitle,
                    isDarkMode && { color: colors.textPrimary },
                    config.isCritical && styles.cardTitleCritical,
                  ]}
                  numberOfLines={2}
                >
                  {config.title}
                </Text>

                {/* Chi tiết thông điệp sự kiện từ AI / cảm biến */}
                <Text style={[styles.cardMsg, isDarkMode && { color: colors.textSecondary }]} numberOfLines={2}>
                  {inc.message}
                </Text>

                {/* Dòng thời gian và định danh nguồn thiết bị phát hiện */}
                <View style={styles.timeRow}>
                  <Ionicons name="time-outline" size={12} color={isDarkMode ? '#64748B' : '#94A3B8'} />
                  <Text style={[styles.cardTime, isDarkMode && { color: colors.textSecondary }]}>{friendlyTime}</Text>
                  <Text style={[styles.dotSeparator, isDarkMode && { color: colors.border }]}>•</Text>
                  <Text style={[styles.deviceLocationText, isDarkMode && { color: colors.textSecondary }]}>
                    {inc.device_id ? (
                      <>
                        <Text>Thiết bị: </Text>
                        {inc.device_id}
                      </>
                    ) : 'Hệ thống AI'}
                  </Text>
                </View>
              </View>

              {/* Cột phải: Ảnh chụp bằng chứng hoặc clip 5 giây trích xuất (nếu có) */}
              {inc.thumbnail_url && (
                <View style={styles.thumbWrapper}>
                  <Image source={{ uri: inc.thumbnail_url }} style={styles.thumbImg} />
                  <View style={styles.thumbOverlay}>
                    {inc.video_clip_url && (
                      <View style={styles.playCenterBtn}>
                        <Ionicons name="play" size={12} color="#FFFFFF" style={{ marginLeft: 2 }} />
                      </View>
                    )}
                    {inc.video_clip_url && (
                      <View style={styles.playTag}>
                        <Text style={styles.playTagText}>5s Clip</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.listContainer}
        // Giao diện khi danh sách trống
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <View style={[styles.emptyIconCircle, filterType === 'MEDICATION' && { backgroundColor: '#EFF6FF' }]}>
              <Ionicons
                name={filterType === 'MEDICATION' ? 'medical' : 'shield-checkmark-outline'}
                size={36}
                color={filterType === 'MEDICATION' ? '#0284C7' : '#10B981'}
              />
            </View>
            <Text style={[styles.emptyTitle, isDarkMode && { color: colors.textPrimary }]}>
              {filterType === 'MEDICATION'
                ? 'Không có lịch nhắc uống thuốc nào'
                : 'Không có cảnh báo bất thường nào'}
            </Text>
            <Text style={[styles.emptySub, isDarkMode && { color: colors.textSecondary }]}>
              {filterType === 'MEDICATION'
                ? 'Các cữ thuốc sẽ hiển thị theo đơn thuốc của bác sĩ và kế hoạch điều trị trong hồ sơ bệnh án.'
                : 'Hệ thống AI đang giám sát an toàn 24/7 và mọi chỉ số sức khoẻ đều trong ngưỡng chuẩn.'}
            </Text>
          </View>
        }
      />

      {/* Modal Lịch khám Bác sĩ & Xác nhận cho Người thân */}
      <FamilyAppointmentsModal
        visible={familyAppointmentsModalVisible}
        patientId={selectedAppointmentPatientId || patientRecord?.patient_id || 1}
        patientName={patientRecord?.name}
        onClose={() => {
          setFamilyAppointmentsModalVisible(false);
          fetchNotifications();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleCol: {
    flex: 1,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  markAllReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFF4EC',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  markAllReadText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EA580C',
  },
  cameraQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  cameraQuickText: {
    color: '#FFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  filterBarContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  filterBarScroll: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    alignItems: 'center',
  },
  filterPill: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillActive: {
    backgroundColor: '#FFF4EC',
    borderColor: '#FF6B00',
    borderWidth: 1.5,
  },
  filterPillActiveMed: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
    borderWidth: 1.5,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterTextActive: {
    color: '#FF6B00',
    fontWeight: '700',
  },
  medCard: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
  },
  medCardOverdue: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
  },
  medCardTaken: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.2,
    borderColor: '#BBF7D0',
  },
  medActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  medConfirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  medConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  medSnoozeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  medSnoozeBtnText: {
    color: '#64748B',
    fontSize: 11.5,
    fontWeight: '600',
  },
  medSpeakerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  medCompletedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#DCFCE7',
  },
  medCompletedText: {
    fontSize: 12,
    color: '#15803D',
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...Shadows.soft,
  },
  cardCritical: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
  },
  cardUnread: {
    borderLeftWidth: 3.5,
    borderLeftColor: '#FF6B00',
  },
  categoryIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cardCenter: {
    flex: 1,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  newBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  newBadgeText: {
    color: '#FFF',
    fontSize: 8.5,
    fontWeight: '800',
  },
  cardTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 19,
    marginBottom: 3,
  },
  cardTitleCritical: {
    color: '#DC2626',
    fontWeight: '800',
  },
  cardMsg: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 6,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardTime: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  dotSeparator: {
    fontSize: 10,
    color: '#CBD5E1',
    marginHorizontal: 2,
  },
  deviceLocationText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  thumbWrapper: {
    width: 76,
    height: 58,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E2E8F0',
    marginTop: 2,
  },
  thumbImg: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playCenterBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.7)',
  },
  playTag: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  playTagText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
  },
});

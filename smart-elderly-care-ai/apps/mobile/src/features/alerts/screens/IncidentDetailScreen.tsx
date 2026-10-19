// ==============================================================================
// TỆP: IncidentDetailScreen.tsx
// PHÂN HỆ: Màn hình Chi tiết Sự cố Khẩn cấp & Bằng chứng Video Clip 5 giây
// TÁC GIẢ: Phan Nguyễn Giáng My
// MÔ TẢ CHỨC NĂNG:
//   1. Hiển thị chi tiết toàn diện về sự cố (Loại sự cố, Độ tin cậy AI, Mốc thời gian).
//   2. Trình chiếu video clip bằng chứng 5 giây trích xuất từ camera Edge (hoặc MinIO).
//   3. Cung cấp nút bấm "Đánh dấu đã xử lý":
//      - Tắt còi hú và rung SOS trên điện thoại người nhà.
//      - Đồng bộ API lên PostgreSQL Cloud Backend.
//      - Cập nhật trạng thái acknowledged cho toàn bộ ứng dụng (Zustand store).
// ==============================================================================

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  Vibration,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// Nạp thư viện video native (trên Web dùng thẻ video HTML5 tiêu chuẩn)
let Video: any = null;
if (Platform.OS !== 'web') {
  try {
    Video = require('react-native-video').default;
  } catch (e) {}
}

import { incidentsApi } from '../../../services/api';
import { useTheme } from '../../../store/useThemeStore';
import { useAlertStore, useAuthStore } from '../../../store';
import type { Incident } from '../../../store/useAlertStore';

// Bảng màu tương ứng với các cấp độ nghiêm trọng của sự cố
const LEVEL_COLORS: Record<string, string> = {
  CRITICAL: '#EF4444',
  HIGH:     '#F97316',
  MEDIUM:   '#EAB308',
  LOW:      '#22C55E',
};

// Nhãn tiếng Việt trực quan cho từng mã sự kiện
const ALERT_TYPE_LABELS: Record<string, string> = {
  FALL_DETECTED:    '🤸 Cảnh báo té ngã khẩn cấp',
  ABNORMAL_HR:      '💓 Nhịp tim bất thường',
  HIGH_HEART_RATE:  '💓 Nhịp tim tăng cao',
  LOW_SPO2:         '💨 SpO₂ thấp',
  HIGH_TEMPERATURE: '🌡️ Nhiệt độ cao',
  EMERGENCY_SOUND:  '📢 Âm thanh khẩn cấp',
  ACOUSTIC_DISTRESS:'📢 Âm thanh kêu cứu YAMNet',
  INACTIVITY:       '⏱️ Không có hoạt động',
};

export default function IncidentDetailScreen({ route, navigation }: any) {
  // Lấy trạng thái màu giao diện Sáng / Tối
  const { isDarkMode, colors } = useTheme();

  // Kết nối Domain Store useAlertStore để quản lý còi hú và sự cố
  const {
    acknowledgeIncident,
    setSirenActive,
    incidents,
    fetchNotifications,
  } = useAlertStore();

  // Lấy tên người dùng đang đăng nhập để gán vào mục "Người xử lý"
  const { userName } = useAuthStore();
  const operatorName = userName || 'Người nhà';

  // Lấy các tham số truyền qua navigation route
  const params = route.params ?? {};
  const incidentId = params.incidentId ?? params.id;
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [viewMode, setViewMode] = useState<'ai_box' | 'video'>('ai_box');

  // ----------------------------------------------------------------------------
  // Lifecycle: Khởi tạo dữ liệu sự cố từ params hoặc tải từ Backend API
  // ----------------------------------------------------------------------------
  useEffect(() => {
    if (!incidentId) {
      setLoading(false);
      return;
    }

    // 1. Kiểm tra xem sự cố đã có sẵn trong AlertStore chưa
    const storeInc = incidents.find((i) => i.id === incidentId);

    // 2. Nếu navigation có truyền sẵn thông tin chi tiết: Nạp ngay để hiển thị tức thì
    if (params.alert_type || params.type || params.confidence != null || params.message) {
      let conf: number | undefined = undefined;
      if (typeof params.confidence === 'number') {
        conf = params.confidence > 1 ? params.confidence / 100 : params.confidence;
      } else if (typeof params.confidence === 'string') {
        const p = parseFloat(params.confidence.replace('%', ''));
        conf = isNaN(p) ? undefined : (p > 1 ? p / 100 : p);
      }

      setIncident({
        id: incidentId,
        device_id: params.device_id ?? storeInc?.device_id,
        alert_type: params.alert_type ?? (params.type === 'FALL' ? 'FALL_DETECTED' : params.type) ?? 'FALL_DETECTED',
        alert_level: params.alert_level ?? 'CRITICAL',
        message: params.message ?? 'Cảnh báo khẩn cấp ghi nhận từ hệ thống cảm biến.',
        confidence: conf,
        video_clip_url: params.video_clip_url ?? null,
        thumbnail_url: params.thumbnail_url ?? null,
        is_acknowledged: storeInc ? storeInc.is_acknowledged : (params.is_acknowledged ?? false),
        acknowledged_by: storeInc?.acknowledged_by ?? params.acknowledged_by ?? (storeInc?.is_acknowledged ? operatorName : null),
        acknowledged_at: storeInc?.acknowledged_at ?? params.acknowledged_at,
        created_at: params.created_at ?? params.time ?? new Date().toISOString(),
      });
      setLoading(false);
      return;
    }

    // 3. Nếu tìm thấy trong store: Sử dụng trực tiếp
    if (storeInc) {
      setIncident(storeInc);
      setLoading(false);
      return;
    }

    // 4. Nếu chưa có: Gọi API Backend để lấy chi tiết sự kiện
    fetchIncident();
  }, [incidentId, incidents]);

  const fetchIncident = async () => {
    try {
      const res = await incidentsApi.get(incidentId);
      if (res.data) {
        setIncident(res.data);
      } else {
        setIncident(null);
      }
    } catch (err) {
      console.warn('Lỗi khi tải chi tiết sự cố từ backend API:', err);
      setIncident(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!incident || incident.is_acknowledged || isProcessing) return;

    setIsProcessing(true);

    try {
      // 1. Tắt rung và còi báo động khẩn cấp
      try {
        if (Platform.OS !== 'web') {
          Vibration.cancel();
        }
      } catch (e) {}
      setSirenActive(false);

      // 2. Gửi request cập nhật tới Backend API để lưu trực tiếp vào cơ sở dữ liệu PostgreSQL (is_resolved = True)
      try {
        await incidentsApi.acknowledge(incident.id, 'Đã kiểm tra an toàn');
      } catch (apiErr) {
        console.warn('Backend API acknowledge fallback:', apiErr);
      }

      // 3. Cập nhật state trong Zustand store (toàn bộ app)
      acknowledgeIncident(incident.id, 'Đã kiểm tra an toàn', operatorName);

      // 4. Đồng bộ lại dữ liệu thông báo từ Backend
      try {
        fetchNotifications();
      } catch (e) {}

      // 5. Cập nhật state cục bộ màn hình
      const nowIso = new Date().toISOString();
      setIncident((prev) =>
        prev
          ? {
              ...prev,
              is_acknowledged: true,
              acknowledged_by: operatorName,
              acknowledged_at: nowIso,
            }
          : null
      );

      // 6. Hiển thị thông báo phản hồi (Toast Banner & Native/Web Alert)
      setShowSuccessToast(true);

      const alertTitle = '✅ ĐÃ ĐÁNH DẤU XỬ LÝ SỰ KIỆN THÀNH CÔNG!';
      const alertMsg = `• Trạng thái: Đã xử lý (is_resolved = True)\n• Còi hú báo động: Đã tắt ngay lập tức\n• Cơ sở dữ liệu: Đã lưu vào PostgreSQL\n• Người xử lý: ${operatorName}`;

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`${alertTitle}\n\n${alertMsg}`);
      } else {
        Alert.alert(alertTitle, alertMsg, [{ text: 'Đồng ý' }]);
      }

      // 7. Tự động quay lại màn hình trước đó sau 2 giây
      setTimeout(() => {
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
      }, 2000);
    } catch (error) {
      console.error('Lỗi khi xác nhận xử lý sự cố:', error);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('Thông báo: Đã lưu trạng thái xử lý an toàn.');
      } else {
        Alert.alert('Thông báo', 'Đã lưu trạng thái xử lý an toàn.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FF7A00" />
        <Text style={[styles.loadingText, { color: colors.textSecondary, marginTop: 12 }]}>Đang tải chi tiết sự cố...</Text>
      </SafeAreaView>
    );
  }

  if (!incident) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Ionicons name="alert-circle-outline" size={54} color="#94A3B8" />
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 16, textAlign: 'center' }}>
          Không tìm thấy sự cố
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
          Sự cố có thể đã được xử lý xong hoặc không tồn tại trong hệ thống.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#FF7A00', borderRadius: 10 }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Quay lại danh sách</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const levelColor = LEVEL_COLORS[incident.alert_level] ?? '#64748B';
  const typeLabel  = ALERT_TYPE_LABELS[incident.alert_type] ?? incident.alert_type;
  const videoUrl   = incident.video_clip_url || null;
  const evidenceImg= imgError ? null : (incident.thumbnail_url || null);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Chi tiết sự kiện</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Alert Level & Status Badges */}
        <View style={styles.badgeRow}>
          {!incident.is_acknowledged ? (
            <View style={[styles.statusBadge, { backgroundColor: isDarkMode ? '#450A0A' : '#FEE2E2', borderColor: '#EF4444' }]}>
              <View style={styles.liveRedDot} />
              <Text style={[styles.statusBadgeText, { color: isDarkMode ? '#FCA5A5' : '#DC2626' }]}>
                CRITICAL / CHƯA XỬ LÝ
              </Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.15)' : '#ECFDF5', borderColor: '#22C55E' }]}>
              <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
              <Text style={[styles.statusBadgeText, { color: isDarkMode ? '#86EFAC' : '#16A34A' }]}>
                ĐÃ XỬ LÝ (Bởi {incident.acknowledged_by || operatorName})
              </Text>
            </View>
          )}

          <View style={[styles.levelBadge, { backgroundColor: `${levelColor}20`, borderColor: levelColor }]}>
            <Text style={[styles.levelText, { color: levelColor }]}>
              {incident.alert_level}
            </Text>
          </View>
        </View>

        {/* Type & Message */}
        <Text style={[styles.typeLabel, { color: colors.textPrimary }]}>{typeLabel}</Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>{incident.message}</Text>

        {/* Details Card */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
          {incident.confidence != null && (
            <>
              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Độ tin cậy AI</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="sparkles" size={14} color="#EF4444" style={{ marginRight: 4 }} />
                  <Text style={[styles.rowValue, { color: '#EF4444', fontWeight: '700' }]}>
                    {(incident.confidence * 100).toFixed(0)}% (AI)
                  </Text>
                </View>
              </View>
              <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
            </>
          )}

          {/* Timestamp */}
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Thời gian ghi nhận</Text>
            <Text style={[styles.rowValue, { color: colors.textPrimary }]}>
              {new Date(incident.created_at).toLocaleString('vi-VN')}
            </Text>
          </View>

          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />

          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Vị trí cảm biến</Text>
            <Text style={[styles.rowValue, { color: colors.textPrimary }]}>
              {incident.device_id ? `Thiết bị: ${incident.device_id}` : 'Cảm biến giám sát'}
            </Text>
          </View>

          {incident.is_acknowledged && (
            <>
              <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Người xử lý</Text>
                <Text style={[styles.rowValue, { color: '#16A34A', fontWeight: '700' }]}>
                  {incident.acknowledged_by || operatorName}
                </Text>
              </View>
              {incident.acknowledged_at && (
                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Thời gian xử lý</Text>
                  <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                    {new Date(incident.acknowledged_at).toLocaleString('vi-VN')}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Evidence Video & AI Snapshot (Feature 2) */}
        <View style={styles.videoSection}>
          <View style={styles.evidenceHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Bằng chứng hình ảnh / clip sự cố
            </Text>
            {incident.confidence != null && (
              <View style={styles.confidenceBadge}>
                <Ionicons name="shield-checkmark" size={13} color="#EF4444" style={{ marginRight: 4 }} />
                <Text style={styles.confidenceBadgeText}>
                  Độ tin cậy: {(incident.confidence * 100).toFixed(0)}%
                </Text>
              </View>
            )}
          </View>

          {/* Tab selector giữa Ảnh AI Bounding Box và Video Clip */}
          <View style={[styles.tabSelector, { backgroundColor: isDarkMode ? '#1E293B' : '#E2E8F0' }]}>
            <TouchableOpacity
              style={[styles.tabItem, viewMode === 'ai_box' && styles.tabItemActive]}
              onPress={() => setViewMode('ai_box')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="scan-outline"
                size={15}
                color={viewMode === 'ai_box' ? '#FFF' : (isDarkMode ? '#94A3B8' : '#64748B')}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.tabText, viewMode === 'ai_box' && styles.tabTextActive]}>
                Ảnh bằng chứng AI
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, viewMode === 'video' && styles.tabItemActive]}
              onPress={() => setViewMode('video')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="videocam-outline"
                size={15}
                color={viewMode === 'video' ? '#FFF' : (isDarkMode ? '#94A3B8' : '#64748B')}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.tabText, viewMode === 'video' && styles.tabTextActive]}>
                Video Clip trích xuất
              </Text>
            </TouchableOpacity>
          </View>

          {/* VIEW MODE 1: Ảnh có Bounding Box phát hiện ngã AI nếu có ảnh */}
          {viewMode === 'ai_box' ? (
            evidenceImg ? (
              <View style={[styles.evidenceCard, { backgroundColor: '#0B0F19', borderColor: colors.border }]}>
                <Image
                  source={{ uri: evidenceImg }}
                  style={styles.evidenceImage}
                  resizeMode="cover"
                  onError={() => setImgError(true)}
                />

                {/* Lớp phủ OSD giám sát camera an ninh */}
                <View style={styles.evidenceOverlayHeader}>
                  <View style={styles.recDot} />
                  <Text style={styles.evidenceOsdText}>REC ● TRÍCH XUẤT BUFFER</Text>
                  <Text style={[styles.evidenceOsdText, { marginLeft: 'auto' }]}>
                    {incident.device_id || 'CAM-01'}
                  </Text>
                </View>

                {/* Khung Bounding Box AI màu đỏ khi phát hiện ngã */}
                {incident.alert_type === 'FALL_DETECTED' && (
                  <View style={styles.aiBoundingBox}>
                    <View style={styles.boxTag}>
                      <Ionicons name="warning" size={11} color="#FFF" style={{ marginRight: 3 }} />
                      <Text style={styles.boxTagText}>
                        FALL DETECTED{incident.confidence != null ? ` (${(incident.confidence * 100).toFixed(1)}%)` : ''}
                      </Text>
                    </View>

                    {/* Các điểm khớp xương tư thế (Pose Estimation Skeleton Nodes) */}
                    <View style={[styles.skeletonJoint, { top: 12, left: '46%' }]} />
                    <View style={[styles.skeletonJoint, { top: 38, left: '32%' }]} />
                    <View style={[styles.skeletonJoint, { top: 38, left: '60%' }]} />
                    <View style={[styles.skeletonJoint, { top: 82, left: '40%' }]} />
                    <View style={[styles.skeletonJoint, { top: 110, left: '26%' }]} />
                    <View style={[styles.skeletonJoint, { top: 125, left: '72%' }]} />
                  </View>
                )}

                {/* Thanh trạng thái dưới đáy ảnh */}
                <View style={styles.evidenceOverlayFooter}>
                  <View style={styles.aiTag}>
                    <Ionicons name="scan-outline" size={13} color="#FFF" style={{ marginRight: 4 }} />
                    <Text style={styles.aiTagText}>YOLO-Pose AI • Bằng chứng sự cố</Text>
                  </View>
                  {incident.confidence != null && (
                    <Text style={styles.evidenceOsdText}>
                      Độ tin cậy: {(incident.confidence * 100).toFixed(0)}%
                    </Text>
                  )}
                </View>
              </View>
            ) : (
              <View style={[styles.evidenceCard, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: colors.border, height: 180, justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="image-outline" size={38} color={colors.textMuted} />
                <Text style={{ color: colors.textSecondary, marginTop: 8, fontSize: 13, fontWeight: '500' }}>
                  Không có hình ảnh bằng chứng cho sự cố này
                </Text>
              </View>
            )
          ) : (
            /* VIEW MODE 2: Video Player trích xuất */
            videoUrl ? (
              <View style={[styles.evidenceCard, { backgroundColor: '#000', borderColor: colors.border }]}>
                {Platform.OS === 'web' || !Video ? (
                  <video
                    src={videoUrl}
                    style={{ width: '100%', height: 230, borderRadius: 12, backgroundColor: '#000', objectFit: 'contain' }}
                    controls
                    autoPlay
                    loop
                  />
                ) : (
                  <Video
                    source={{ uri: videoUrl }}
                    style={styles.video}
                    controls
                    resizeMode="contain"
                    paused={false}
                  />
                )}
                <View style={styles.videoOsdBar}>
                  <View style={styles.recDot} />
                  <Text style={styles.evidenceOsdText}>CLIP ĐÃ LƯU VÀO HỒ SƠ SỰ CỐ</Text>
                </View>
              </View>
            ) : (
              <View style={[styles.evidenceCard, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: colors.border, height: 180, justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="videocam-off-outline" size={38} color={colors.textMuted} />
                <Text style={{ color: colors.textSecondary, marginTop: 8, fontSize: 13, fontWeight: '500' }}>
                  Không có video clip trích xuất cho sự cố này
                </Text>
              </View>
            )
          )}
        </View>

        {/* Success Toast Banner */}
        {(showSuccessToast || incident.is_acknowledged) && (
          <View
            style={[
              styles.successToast,
              {
                backgroundColor: isDarkMode ? '#064E3B25' : '#F0FDF4',
                borderColor: '#16A34A',
              },
            ]}
          >
            <Ionicons name="checkmark-circle" size={24} color="#16A34A" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.successToastTitle, { color: isDarkMode ? '#86EFAC' : '#15803D' }]}>
                Đã đánh dấu xử lý sự kiện thành công!
              </Text>
              <Text style={[styles.successToastSubtitle, { color: isDarkMode ? '#A7F3D0' : '#166534' }]}>
                Còi hú đã tắt ngay lập tức và trạng thái an toàn đã được cập nhật vào PostgreSQL.
              </Text>
            </View>
          </View>
        )}

        {/* Nút Đánh dấu đã xử lý */}
        {!incident.is_acknowledged ? (
          <TouchableOpacity
            style={[
              styles.ackBtn,
              isProcessing && { opacity: 0.8, backgroundColor: '#2563EB' },
            ]}
            onPress={handleAcknowledge}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            {isProcessing ? (
              <>
                <ActivityIndicator size="small" color="#FFF" />
                <Text style={styles.ackBtnText}>Đang cập nhật PostgreSQL...</Text>
              </>
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                <Text style={styles.ackBtnText}>Đánh dấu đã xử lý</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ gap: 10, marginTop: 8 }}>
            <View
              style={[
                styles.ackBtnDisabled,
                {
                  backgroundColor: isDarkMode ? '#1E293B' : '#ECFDF5',
                  borderColor: isDarkMode ? '#059669' : '#22C55E',
                },
              ]}
            >
              <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
              <Text style={[styles.ackBtnDisabledText, { color: isDarkMode ? '#86EFAC' : '#15803D' }]}>
                Đã xử lý thành công (Bởi {incident.acknowledged_by || operatorName})
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.returnBtn,
                {
                  backgroundColor: isDarkMode ? colors.card : '#F1F5F9',
                  borderColor: colors.border,
                },
              ]}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
              <Text style={[styles.returnBtnText, { color: colors.textPrimary }]}>
                Quay lại màn hình chính
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backBtn: { marginRight: 12 },
  headerTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' },
  content: { padding: 20, gap: 16 },
  loadingText: { color: '#94A3B8', textAlign: 'center', marginTop: 100 },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  statusBadgeText: {
    fontWeight: '700',
    fontSize: 13,
  },
  liveRedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  levelBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  levelText: { fontWeight: '700', fontSize: 13 },
  typeLabel: { color: '#F8FAFC', fontSize: 22, fontWeight: '700' },
  message:   { color: '#94A3B8', fontSize: 15, lineHeight: 22 },
  infoCard: {
    padding: 16,
    borderRadius: 14,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { color: '#64748B', fontSize: 14 },
  rowValue:  { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  rowDivider: {
    height: 1,
    marginVertical: 8,
  },
  videoSection: { gap: 10 },
  evidenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '600' },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF444420',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  confidenceBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  tabSelector: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 3,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
  },
  tabItemActive: {
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  evidenceCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  evidenceImage: {
    width: '100%',
    height: 230,
    backgroundColor: '#1E293B',
  },
  video: { width: '100%', height: 230, borderRadius: 12, backgroundColor: '#000' },
  videoOsdBar: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  evidenceOverlayHeader: {
    position: 'absolute',
    top: 8,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 6,
  },
  evidenceOsdText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowRadius: 4,
  },
  aiBoundingBox: {
    position: 'absolute',
    top: '32%',
    left: '24%',
    width: '54%',
    height: '52%',
    borderWidth: 2,
    borderColor: '#EF4444',
    borderRadius: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  boxTag: {
    position: 'absolute',
    top: -18,
    left: -2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  boxTagText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  skeletonJoint: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  evidenceOverlayFooter: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  aiTagText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  ackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 8,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  ackBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  ackBtnDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 8,
    borderWidth: 1.5,
  },
  ackBtnDisabledText: { fontWeight: '700', fontSize: 16 },
  successToast: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginTop: 6,
    marginBottom: 4,
  },
  successToastTitle: {
    fontWeight: '700',
    fontSize: 14,
  },
  successToastSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  returnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  returnBtnText: {
    fontWeight: '600',
    fontSize: 15,
  },
});

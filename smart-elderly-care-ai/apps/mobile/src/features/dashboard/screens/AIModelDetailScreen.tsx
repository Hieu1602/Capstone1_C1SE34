// AIModelDetailScreen.tsx
// Chi tiết các mô hình AI trên Hub Orange Pi 5 (Rockchip RK3588S NPU)
// Hiện thực hóa FR03 (YOLO-Pose), FR04 (AMG8833 Thermal), FR05 (YAMNet Audio), FR06 (Sensor Fusion)

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';

export default function AIModelDetailScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mô Hình AI Tại Biên (Edge AI)</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.introText}>
          Tất cả mô hình AI suy luận trực tiếp trên Hub Orange Pi 5 (NPU 6 TOPS), bảo vệ quyền riêng tư tuyệt đối (NFR02) và độ trễ &lt; 500ms (NFR01).
        </Text>

        {/* 1. YOLO-Pose 17 Keypoints (FR03) */}
        <View style={styles.modelCard}>
          <View style={styles.modelHeaderRow}>
            <View style={[styles.modelIconBox, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="body" size={24} color="#0284C7" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.modelTitle}>YOLO-Pose 17 Khớp Xương (FR03)</Text>
              <Text style={styles.modelStatusText}>Trạng thái: 32 FPS (Rockchip RK3588S NPU)</Text>
            </View>
          </View>
          <Text style={styles.modelDesc}>
            Theo dõi góc nghiêng cột sống và thời gian nằm bất động trên sàn. Tự động kích hoạt Red Alert khi góc nghiêng &gt; 60° và không có chuyển động &gt; 30 giây.
          </Text>
        </View>

        {/* 2. Contactless Thermal Mapping AMG8833 (FR04) */}
        <View style={styles.modelCard}>
          <View style={styles.modelHeaderRow}>
            <View style={[styles.modelIconBox, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="thermometer" size={24} color="#D97706" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.modelTitle}>Ma Trận Nhiệt AMG8833 (FR04)</Text>
              <Text style={styles.modelStatusText}>Độ phân giải: 8x8 IR Grid • Tần số: 10 Hz</Text>
            </View>
          </View>
          <Text style={styles.modelDesc}>
            Định vị vùng trán kết hợp từ YOLO-Pose và ánh xạ nhiệt độ hồng ngoại để phát hiện sớm các cơn sốt cao bất thường không cần tiếp xúc.
          </Text>
        </View>

        {/* 3. YAMNet Acoustic Distress Analysis (FR05) */}
        <View style={styles.modelCard}>
          <View style={styles.modelHeaderRow}>
            <View style={[styles.modelIconBox, { backgroundColor: '#F3E8FF' }]}>
              <Ionicons name="mic" size={24} color="#9333EA" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.modelTitle}>Phân Tích Âm Thanh YAMNet (FR05)</Text>
              <Text style={styles.modelStatusText}>Lớp phân loại: Tiếng ngã đập mạnh, Kêu cứu, La hét</Text>
            </View>
          </View>
          <Text style={styles.modelDesc}>
            Liên tục phân tích âm thanh môi trường trong phòng. Phát hiện các mẫu âm thanh khẩn cấp như tiếng va đập sàn nhà hoặc tiếng kêu cứu "Cứu tôi với!".
          </Text>
        </View>

        {/* 4. Multimodal Sensor Fusion Decision Matrix (FR06) */}
        <View style={[styles.modelCard, { borderColor: '#BBF7D0' }]}>
          <View style={styles.modelHeaderRow}>
            <View style={[styles.modelIconBox, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="git-merge" size={24} color="#16A34A" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.modelTitle, { color: '#15803D' }]}>Hợp Nhất Đa Cảm Biến (FR06)</Text>
              <Text style={styles.modelStatusText}>Độ chính xác: TPR ≥ 95% • Báo giả: FPR &lt; 2%</Text>
            </View>
          </View>
          <Text style={styles.modelDesc}>
            Bộ não trung tâm kết hợp ma trận quyết định giữa Hình ảnh + Thân nhiệt + Âm thanh + Vòng tay BLE nhằm loại bỏ hoàn toàn báo động giả (như nằm ngủ hoặc cúi nhặt đồ).
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 36,
  },
  introText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 16,
  },
  modelCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  modelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  modelIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  modelStatusText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  modelDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
});

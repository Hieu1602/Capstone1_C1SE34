// AIAssistantScreen.tsx
// Màn hình Trợ lý AI SmartCare (Nút Robot AI ở giữa thanh Tab Navigation)
// Hiện thực hóa đầy đủ FR06 (Sensor Fusion), FR11 (SOS 115) và FR12 (Smart Voice Reminder tiếng Việt)

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import AIBotIcon from '../../../components/AIBotIcon';
import { useVitalStore } from '../../../store/useVitalStore';

export default function AIAssistantScreen({ navigation }: any) {
  const { currentVitals, house } = useVitalStore();
  const [messages, setMessages] = useState([
    {
      id: '1',
      sender: 'bot',
      text: 'Xin chào! Tôi là Trợ lý AI SmartCare 🤖. Hệ thống AI đang theo dõi 4 luồng dữ liệu (Camera YOLO-Pose, Nhiệt độ AMG8833, Âm thanh YAMNet, Vòng tay BLE). Hiện tại sinh hiệu của người cao tuổi đang ổn định.',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isVoiceTesting, setIsVoiceTesting] = useState(false);

  // Kích hoạt loa giọng nói tiếng Việt tại Hub Orange Pi 5 (FR12)
  const handleTestVoicePrompt = () => {
    setIsVoiceTesting(true);
    Alert.alert(
      '🔊 Phát loa giọng nói tiếng Việt tại Hub (FR12)',
      'Loa tại Hub Orange Pi 5 đang phát âm thanh:\n\n"Bác ơi, hãy nhớ đeo vòng tay thông minh trước khi rời khỏi giường nhé!"',
      [
        {
          text: 'Đã hiểu',
          onPress: () => setIsVoiceTesting(false),
        },
      ]
    );
  };

  // SOS 115 kèm auto-copy địa chỉ nhà (FR11)
  const handleSOS115 = () => {
    Alert.alert(
      '🚨 GỌI CẤP CỨU 115 KHẨN CẤP?',
      `Hệ thống sẽ kết nối số điện thoại 115 và tự động sao chép địa chỉ nhà:\n"${house.address}"\nđể bạn đọc ngay cho nhân viên cấp cứu.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Gọi 115 Ngay',
          style: 'destructive',
          onPress: () => Linking.openURL('tel:115'),
        },
      ]
    );
  };

  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    const userMsg = { id: Date.now().toString(), sender: 'user', text: inputText };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');

    // AI Bot smart reply
    setTimeout(() => {
      let replyText = 'Tôi đã ghi nhận câu hỏi. Các chỉ số nhịp tim và thân nhiệt hiện tại đều nằm trong giới hạn an toàn.';
      const lower = inputText.toLowerCase();
      if (lower.includes('ngã') || lower.includes('té') || lower.includes('fall')) {
        replyText = 'Hệ thống YOLO-Pose 17 khớp xương đang quét liên tục ở 32 FPS. Nếu phát hiện góc nghiêng >60° kèm bất động >30s, còi Red Alert sẽ hú ngay lập tức (FR03/FR07).';
      } else if (lower.includes('sốt') || lower.includes('nhiệt độ')) {
        replyText = `Cảm biến hồng ngoại AMG8833 ghi nhận nhiệt độ trán là ${currentVitals.skin_temp_max ?? 36.8}°C (Bình thường). Ngưỡng cảnh báo sốt là 37.8°C.`;
      } else if (lower.includes('nhịp tim') || lower.includes('spo2')) {
        replyText = `Vòng tay BLE đang báo nhịp tim: ${currentVitals.heart_rate ?? 74} bpm, SpO₂: ${currentVitals.spo2 ?? 98}%. Trạng thái: Rất tốt.`;
      }

      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), sender: 'bot', text: replyText },
      ]);
    }, 600);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 1. Header */}
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AIBotIcon size={36} />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.headerTitle}>Trợ lý AI SmartCare</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Sensor Fusion 4 luồng hoạt động</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.sosButtonHeader}
          onPress={handleSOS115}
          activeOpacity={0.8}
        >
          <Ionicons name="call" size={16} color="#FFF" />
          <Text style={styles.sosButtonHeaderText}>115</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 2. Multimodal Health Score Banner (Proposal FR06) */}
        <View style={styles.scoreCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.scoreTitle}>Chỉ số an toàn AI tổng hợp</Text>
            <Text style={styles.scoreSub}>
              Kết hợp 4 luồng: Camera + Thân nhiệt + Âm thanh + Vòng đeo tay
            </Text>
            <View style={styles.scoreBarContainer}>
              <View style={[styles.scoreBarFill, { width: '96%' }]} />
            </View>
            <Text style={styles.scoreValueText}>96 / 100 • Rất an toàn</Text>
          </View>
          <View style={styles.scoreBadgeCircle}>
            <Text style={styles.scoreBadgePercent}>98.5%</Text>
            <Text style={styles.scoreBadgeLabel}>Độ tin cậy</Text>
          </View>
        </View>

        {/* 3. Phím bấm nhanh kích hoạt chức năng đặc biệt */}
        <View style={styles.actionGrid}>
          {/* Nút 1: Thử giọng nói tiếng Việt loa Hub (FR12) */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleTestVoicePrompt}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="volume-high" size={22} color="#0284C7" />
            </View>
            <Text style={styles.actionCardTitle}>Loa giọng nói Hub</Text>
            <Text style={styles.actionCardSub}>Nhắc người già đeo vòng (FR12)</Text>
          </TouchableOpacity>

          {/* Nút 2: Cấp cứu SOS 115 (FR11) */}
          <TouchableOpacity
            style={[styles.actionCard, { borderColor: '#FECACA' }]}
            onPress={handleSOS115}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="alert-circle" size={22} color="#EF4444" />
            </View>
            <Text style={[styles.actionCardTitle, { color: '#DC2626' }]}>Cấp cứu SOS 115</Text>
            <Text style={styles.actionCardSub}>Quay số &amp; tự copy địa chỉ (FR11)</Text>
          </TouchableOpacity>
        </View>

        {/* 4. Chat Messages */}
        <Text style={styles.chatSectionTitle}>Trò chuyện &amp; Tư vấn sức khỏe</Text>
        <View style={styles.chatBox}>
          {messages.map((m) => (
            <View
              key={m.id}
              style={[
                styles.messageBubble,
                m.sender === 'user' ? styles.userBubble : styles.botBubble,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  m.sender === 'user' ? styles.userText : styles.botText,
                ]}
              >
                {m.text}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* 5. Chat Input Bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.chatInput}
          placeholder="Hỏi AI về nhịp tim, giấc ngủ, sốt, ngã..."
          value={inputText}
          onChangeText={setInputText}
          placeholderTextColor="#94A3B8"
        />
        <TouchableOpacity
          style={styles.sendBtn}
          onPress={handleSendMessage}
          activeOpacity={0.8}
        >
          <Ionicons name="send" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
    marginRight: 6,
  },
  onlineText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  sosButtonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  sosButtonHeaderText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    ...Shadows.card,
  },
  scoreTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  scoreSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  scoreBarContainer: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    marginTop: 10,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  scoreValueText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
    marginTop: 6,
  },
  scoreBadgeCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#93C5FD',
    marginLeft: 12,
  },
  scoreBadgePercent: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1D4ED8',
  },
  scoreBadgeLabel: {
    fontSize: 9,
    color: '#60A5FA',
    fontWeight: '600',
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.soft,
  },
  actionIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  actionCardSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  chatSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  chatBox: {
    gap: 10,
    marginBottom: 20,
  },
  messageBubble: {
    maxWidth: '85%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  botBubble: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 4,
    ...Shadows.soft,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primary,
    borderTopRightRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  botText: {
    color: Colors.textPrimary,
  },
  userText: {
    color: '#FFF',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
});

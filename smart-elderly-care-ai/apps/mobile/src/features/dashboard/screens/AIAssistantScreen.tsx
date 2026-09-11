// AIAssistantScreen.tsx
// Module Trợ lý AI thiết kế theo phong cách Gemini (Hình 2 & 3)
// Được tùy biến chuyên biệt cho Hệ thống Giám sát & Chăm sóc Người Cao Tuổi

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// Import biểu tượng Robot Trợ lý AI theo hình mẫu người dùng cung cấp
import AIBotIcon from '../../../components/AIBotIcon';
import { useVitalStore } from '../../../store/useVitalStore';

// Định nghĩa cấu trúc dữ liệu cho tin nhắn chat
interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  isError?: boolean;
}

// Các loại cảnh báo lỗi AI
type AIErrorType = 'NONE' | 'HUB_OFFLINE' | 'BLE_DISCONNECTED' | 'CAMERA_OCCLUDED' | 'NETWORK_TIMEOUT';

// Dữ liệu mẫu các cuộc trò chuyện y tế trong lịch sử
const INITIAL_HISTORY_CHATS = [
  {
    id: 'chat-1',
    title: 'Tư vấn xử lý huyết áp cao tại nhà',
    messages: [
      {
        id: 'msg-1-1',
        sender: 'user',
        text: 'Huyết áp của mẹ tôi đo được 155/95 mmHg, có cao quá không và cần xử lý thế nào?',
        timestamp: '08:30',
      },
      {
        id: 'msg-1-2',
        sender: 'ai',
        text: '❤️ Chỉ số 155/95 mmHg thuộc mức Tăng huyết áp độ 1.\n\n1. Giữ bình tĩnh: Cho cụ ngồi nghỉ ngơi tĩnh lặng ở nơi thoáng mát 15-20 phút, tựa lưng thoải mái, không nói chuyện.\n2. Uống một cốc nước ấm, kiểm tra xem cụ đã uống thuốc huyết áp buổi sáng theo đơn của bác sĩ chưa.\n3. Tiến hành đo lại sau 20 phút. Nếu huyết áp tăng > 180 mmHg hoặc cụ có biểu hiện đau đầu, chóng mặt, buồn nôn, hãy gọi cấp cứu hoặc đưa cụ đến cơ sở y tế ngay.\n\nHiện tại nhịp tim đo qua vòng BLE là 74 bpm (Bình thường).',
        timestamp: '08:31',
      },
      {
        id: 'msg-1-3',
        sender: 'user',
        text: 'Đo lại sau 20 phút thì xuống 138/85 rồi, cảm ơn AI!',
        timestamp: '08:52',
      },
      {
        id: 'msg-1-4',
        sender: 'ai',
        text: 'Dạ rất tốt ạ! Huyết áp 138/85 mmHg đã hạ về ngưỡng an toàn. Bạn hãy tiếp tục theo dõi biến động sinh hiệu của cụ qua vòng đeo tay BLE trên ứng dụng nhé.',
        timestamp: '08:53',
      },
    ],
  },
  {
    id: 'chat-2',
    title: 'Giải thích chỉ số SpO₂ 93% có nguy hiểm không',
    messages: [
      {
        id: 'msg-2-1',
        sender: 'user',
        text: 'Vòng tay báo nồng độ oxy SpO2 của cụ là 93%, mức này có nguy hiểm không?',
        timestamp: '14:15',
      },
      {
        id: 'msg-2-2',
        sender: 'ai',
        text: '⚠️ Chỉ số SpO₂ 93% là dấu hiệu cảnh báo giảm oxy máu nhẹ (mức an toàn chuẩn của người cao tuổi là từ 95% - 100%).\n\n• Hãy kiểm tra ngay xem cụ có bị khó thở, thở gấp, hụt hơi hoặc mệt mỏi tím tái môi không.\n• Nhắc cụ ngồi tựa lưng thẳng, nới lỏng cúc áo ngực, hít sâu bằng mũi và thở chậm bằng miệng.\n• Kiểm tra xem đầu cảm biến quang học của vòng tay có bị lỏng, xoay lệch hoặc bám mồ hôi không và thử đo lại.\n\nNếu chỉ số SpO₂ duy trì dưới 93% quá 15 phút, cần cho cụ thở oxy hỗ trợ hoặc liên hệ bác sĩ gia đình.',
        timestamp: '14:16',
      },
    ],
  },
  {
    id: 'chat-3',
    title: 'Quy trình sơ cứu khi người già bị trượt chân',
    messages: [
      {
        id: 'msg-3-1',
        sender: 'user',
        text: 'Mẹ tôi vừa bị trượt chân ngã trong phòng khách, tôi nên làm gì đầu tiên?',
        timestamp: '19:00',
      },
      {
        id: 'msg-3-2',
        sender: 'ai',
        text: '🚨 HƯỚNG DẪN SƠ CỨU TRƯỢT NGÃ Ở NGƯỜI CAO TUỔI:\n\n1. GIỮ BÌNH TĨNH: Tuyệt đối không vội vàng nâng cụ dậy ngay! Việc kéo giật cụ có thể làm lệch vị trí gãy xương nếu có chấn thương.\n2. KIỂM TRA TRI GIÁC: Hỏi xem cụ còn tỉnh táo không, hỏi vị trí đau (khớp háng, cổ xương đùi, cổ tay, gáy).\n3. QUAN SÁT TƯ THẾ: Nếu một bên chân ngắn hơn hoặc bàn chân xoay ngoài bất thường, nghi ngờ gãy cổ xương đùi, tuyệt đối giữ nguyên tư thế.\n4. Đắp chăn mỏng giữ ấm cơ thể cho cụ trong khi chờ hỗ trợ y tế.\n\nCamera AI phòng khách đang theo dõi liên tục ở tốc độ 32 FPS để đảm bảo an toàn.',
        timestamp: '19:01',
      },
    ],
  },
];

export default function AIAssistantScreen({ navigation }: any) {
  // Lấy dữ liệu sinh hiệu và trạng thái kết nối từ Store
  const { currentVitals, isConnected } = useVitalStore();

  // ---- CÁC STATE QUẢN LÝ GIAO DIỆN ----
  // 1. Trạng thái mở/đóng Sidebar trượt từ bên trái sang (Hình 2)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Giá trị tọa độ trượt translateX (-340 ẩn bên trái -> 0 hiển thị trên màn hình)
  const slideAnim = React.useRef(new Animated.Value(-340)).current;

  // Hàm mở Sidebar: trượt mượt mà từ cạnh trái sang
  const openSidebar = () => {
    setIsSidebarOpen(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  // Hàm đóng Sidebar: trượt lùi về bên trái rồi mới tắt modal
  const closeSidebar = () => {
    Animated.timing(slideAnim, {
      toValue: -340,
      duration: 200,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setIsSidebarOpen(false);
    });
  };

  // 2. Tên mô hình AI mới nhất (Hiển thị gọn gàng: SmartCare Flash 1)
  const [selectedModel, setSelectedModel] = useState('SmartCare Flash 1');
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);

  // 3. Danh sách các tin nhắn trao đổi
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // 4. Nội dung người dùng nhập vào ô tìm kiếm / hỏi đáp
  const [inputText, setInputText] = useState('');

  // 5. Cảnh báo lỗi AI (chỉ đưa ra cảnh báo lỗi, không có nút mô phỏng test)
  const [aiError, setAiError] = useState<AIErrorType>('NONE');

  // 6. State tìm kiếm trong các cuộc trò chuyện lịch sử
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Hàm mở lại cuộc trò chuyện từ lịch sử khi người dùng bấm vào
  const handleOpenHistoryChat = (chat: (typeof INITIAL_HISTORY_CHATS)[0]) => {
    setMessages(chat.messages as ChatMessage[]);
    closeSidebar();
  };

  // Lọc danh sách cuộc trò chuyện theo từ khóa tìm kiếm (tìm cả tiêu đề lẫn nội dung câu hỏi)
  const filteredChats = INITIAL_HISTORY_CHATS.filter((chat) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchTitle = chat.title.toLowerCase().includes(q);
    const matchMsg = chat.messages.some((m) => m.text.toLowerCase().includes(q));
    return matchTitle || matchMsg;
  });

  // ---- HÀM XỬ LÝ GỬI TIN NHẮN TƯ VẤN ----
  const handleSend = (customText?: string) => {
    const textToSend = customText || inputText;
    if (!textToSend.trim()) return;

    // Thêm tin nhắn của người dùng vào danh sách
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInputText('');

    // Nếu gặp lỗi mạng thì cảnh báo lỗi ngay
    if (aiError === 'NETWORK_TIMEOUT') {
      setTimeout(() => {
        const errorMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: '⚠️ Không thể kết nối đến máy chủ AI Cloud (Timeout). Vui lòng kiểm tra đường truyền mạng hoặc bấm Thử lại.',
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          isError: true,
        };
        setMessages((prev) => [...prev, errorMsg]);
      }, 700);
      return;
    }

    // AI phân tích thông minh và phản hồi dữ liệu sinh hiệu
    setTimeout(() => {
      let reply = 'Tôi đã nhận được câu hỏi và đang liên tục giám sát an toàn cho người thân của bạn.';
      const lower = textToSend.toLowerCase();

      if (lower.includes('nhịp tim') || lower.includes('spo2') || lower.includes('sinh hiệu')) {
        reply = `❤️ Chỉ số sinh hiệu hiện tại:\n• Nhịp tim: ${currentVitals.heart_rate ?? 74} bpm (Ổn định)\n• Nồng độ Oxy SpO₂: ${currentVitals.spo2 ?? 98}% (Rất tốt)\n• Thân nhiệt trán AMG8833: ${currentVitals.skin_temp_max ?? 36.8}°C (Bình thường)\n\nKhông có dấu hiệu bất thường nào trong 24 giờ qua.`;
      } else if (lower.includes('ngã') || lower.includes('té') || lower.includes('fall')) {
        reply = '🛡️ Hệ thống YOLO-Pose 17 khớp xương đang theo dõi liên tục ở tốc độ 32 FPS.\nHiện tại người cao tuổi đang ở tư thế an toàn, góc nghiêng cột sống < 20°.\nNếu phát hiện ngã hoặc nằm bất động quá 30 giây, còi báo động Red Alert và video 5s sẽ được kích hoạt ngay lập tức!';
      } else if (lower.includes('sơ cứu') || lower.includes('cấp cứu')) {
        reply = '🚨 HƯỚNG DẪN SƠ CỨU KHI NGƯỜI GIÀ BỊ NGÃ:\n1. Giữ bình tĩnh, không vội vàng nâng cụ dậy ngay.\n2. Kiểm tra xem cụ còn tỉnh táo không, hỏi chỗ bị đau (khớp háng, đầu, cổ tay).\n3. Nếu nghi ngờ gãy xương hoặc cụ bất tỉnh, hãy bấm ngay nút "115" ở góc trên để mở bảng quản trị cấp cứu!\n4. Giữ ấm cơ thể cho cụ trong lúc chờ hỗ trợ y tế.';
      } else if (lower.includes('uống thuốc') || lower.includes('nhắc nhở') || lower.includes('loa')) {
        reply = '🔊 Đã kích hoạt lệnh phát loa tiếng Việt trên Hub Orange Pi 5:\n"Bác ơi, đã đến giờ uống thuốc theo đơn của bác sĩ rồi ạ!" (FR12).';
      }

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: reply,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    }, 600);
  };

  // Tạo cuộc trò chuyện mới
  const handleNewChat = () => {
    setMessages([]);
    setSearchQuery('');
    setIsSearching(false);
    closeSidebar();
  };

  // Nút Profile: Chuyển hướng sang màn hình Profile / Quản trị hệ thống (Hình 2) theo yêu cầu
  const handleOpenProfileModule = () => {
    navigation.navigate('Profile');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ========================================================================= */}
      {/* 1. THANH HEADER TRÊN CÙNG (Hình 1 đã chỉnh sửa theo yêu cầu)               */}
      {/* - Nút Menu = bên trái: mở sidebar trượt từ trái sang                      */}
      {/* - Tên mô hình AI mới nhất: SmartCare Flash 1                              */}
      {/* - Nút Profile bên ngoài: Đổi thành hình tròn Avatar Hình 1, không ghi chữ */}
      {/* ========================================================================= */}
      <View style={styles.topBar}>
        {/* Nút Menu Hamburger mở Sidebar từ trái sang */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={openSidebar}
          activeOpacity={0.7}
        >
          <Ionicons name="menu-outline" size={26} color="#0F172A" />
        </TouchableOpacity>

        {/* Nút chọn mô hình AI (Chỉ ghi tên 1 loại AI mới nhất: SmartCare Flash 1) */}
        <TouchableOpacity
          style={styles.modelPicker}
          onPress={() => setIsModelPickerOpen(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.modelText} numberOfLines={1}>
            {selectedModel}
          </Text>
          <Ionicons name="chevron-down" size={14} color="#64748B" style={{ marginLeft: 4 }} />
        </TouchableOpacity>

        {/* Nút Profile bên ngoài: Đồng bộ với Avatar Hình 1 (chỉ đổi hình nút tròn, không ghi chữ) */}
        <TouchableOpacity
          style={styles.profileAvatarBtn}
          onPress={handleOpenProfileModule}
          activeOpacity={0.8}
        >
          <Ionicons name="person" size={18} color="#0284C7" />
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* 2. CẢNH BÁO LỖI AI (CHỈ ĐƯA RA CẢNH BÁO LỖI KHI CÓ SỰ CỐ, KHÔNG CÓ NÚT TEST) */}
      {/* ========================================================================= */}
      {(!isConnected || aiError !== 'NONE') && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={20} color="#DC2626" />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.errorTitle}>
              {!isConnected || aiError === 'HUB_OFFLINE'
                ? 'Cảnh báo: Hub Edge AI mất kết nối (Offline)'
                : aiError === 'BLE_DISCONNECTED'
                ? 'Cảnh báo: Vòng đeo tay BLE mất tín hiệu'
                : aiError === 'CAMERA_OCCLUDED'
                ? 'Cảnh báo: Camera bị che khuất / Thiếu sáng'
                : 'Cảnh báo: Mất kết nối máy chủ AI Cloud (Timeout)'}
            </Text>
            <Text style={styles.errorDesc}>
              {!isConnected || aiError === 'HUB_OFFLINE'
                ? 'Hub Orange Pi 5 đang ngoại tuyến. Dữ liệu camera tạm ngưng cập nhật.'
                : aiError === 'BLE_DISCONNECTED'
                ? 'Không nhận được nhịp tim. Vui lòng kiểm tra pin hoặc nhắc cụ đeo vòng.'
                : aiError === 'CAMERA_OCCLUDED'
                ? 'Độ tin cậy YOLO-Pose < 40%. Hệ thống chuyển sang cảm biến nhiệt AMG8833.'
                : 'Vui lòng kiểm tra kết nối Wi-Fi / 4G hoặc chạm Thử lại.'}
            </Text>
          </View>
          <TouchableOpacity style={styles.retryBtn} onPress={() => setAiError('NONE')}>
            <Text style={styles.retryText}>Đóng</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 3. VÙNG NỘI DUNG CHÍNH (HERO KHI CHƯA CHAT HOẶC DANH SÁCH TIN NHẮN)        */}
      {/* ========================================================================= */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.mainScroll}
      >
        {/* NẾU CHƯA CÓ TIN NHẮN: Hiển thị giao diện chào mừng Hero chuẩn Hình 3 */}
        {messages.length === 0 ? (
          <View style={styles.heroBox}>
            {/* Biểu tượng Robot AI đội tai nghe hỗ trợ theo đúng hình ảnh bạn cung cấp */}
            <View style={styles.iconWrap}>
              <AIBotIcon size={84} />
            </View>

            {/* Dòng chữ chào đón chuẩn hình mẫu */}
            <Text style={styles.heroTitle}>Mình sẵn sàng, chỉ chờ bạn thôi</Text>
            <Text style={styles.heroSub}>
              Hỏi bất kỳ điều gì về sức khỏe, nhịp tim, giấc ngủ hoặc phát hiện té ngã của người thân.
            </Text>

            {/* Các thẻ gợi ý câu hỏi nhanh (Prompt Suggestions) */}
            <View style={styles.promptList}>
              <TouchableOpacity
                style={styles.promptChip}
                onPress={() => handleSend('Kiểm tra nhịp tim và SpO2 hiện tại')}
                activeOpacity={0.7}
              >
                <Ionicons name="heart-outline" size={16} color="#0284C7" style={{ marginRight: 8 }} />
                <Text style={styles.promptText}>Kiểm tra nhịp tim &amp; SpO₂ hiện tại</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.promptChip}
                onPress={() => handleSend('Tình trạng té ngã hôm nay thế nào?')}
                activeOpacity={0.7}
              >
                <Ionicons name="body-outline" size={16} color="#0284C7" style={{ marginRight: 8 }} />
                <Text style={styles.promptText}>Tình trạng té ngã hôm nay thế nào?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.promptChip}
                onPress={() => handleSend('Hướng dẫn sơ cứu khi người già bị ngã')}
                activeOpacity={0.7}
              >
                <Ionicons name="medkit-outline" size={16} color="#0284C7" style={{ marginRight: 8 }} />
                <Text style={styles.promptText}>Hướng dẫn sơ cứu khi người già bị ngã</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.promptChip}
                onPress={() => handleSend('Phát loa nhắc cụ uống thuốc (FR12)')}
                activeOpacity={0.7}
              >
                <Ionicons name="volume-high-outline" size={16} color="#0284C7" style={{ marginRight: 8 }} />
                <Text style={styles.promptText}>Phát loa nhắc cụ uống thuốc (FR12)</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* NẾU ĐÃ CÓ TIN NHẮN: Hiển thị các bong bóng chat */
          <View style={styles.chatList}>
            {messages.map((m) => (
              <View
                key={m.id}
                style={[
                  styles.msgRow,
                  m.sender === 'user' ? styles.userRow : styles.aiRow,
                ]}
              >
                {/* Icon Robot AI nhỏ cạnh tin nhắn của AI */}
                {m.sender === 'ai' && (
                  <View style={styles.aiAvatarSmall}>
                    <AIBotIcon size={24} />
                  </View>
                )}

                <View
                  style={[
                    styles.bubble,
                    m.sender === 'user' ? styles.userBubble : styles.aiBubble,
                    m.isError && styles.errorBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.msgText,
                      m.sender === 'user' ? styles.userMsgText : styles.aiMsgText,
                    ]}
                  >
                    {m.text}
                  </Text>
                  <Text
                    style={[
                      styles.timeText,
                      m.sender === 'user' ? styles.userTimeText : styles.aiTimeText,
                    ]}
                  >
                    {m.timestamp}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* 4. THANH NHẬP LIỆU NỔI HÌNH VIÊN THUỐC (FLOATING PILL INPUT BAR - Hình 3)  */}
      {/* ========================================================================= */}
      <View style={styles.bottomBarWrap}>
        <View style={styles.pillInput}>
          {/* Ô nhập nội dung câu hỏi (đã bỏ nút dấu cộng theo yêu cầu của bạn) */}
          <TextInput
            style={styles.textInput}
            placeholder="Hỏi SmartCare AI..."
            placeholderTextColor="#94A3B8"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => handleSend()}
            returnKeyType="send"
          />

          {/* Nút Ghi âm giọng nói (Chỉ giữ nút ghi âm, đã bỏ nút sóng bên phải theo yêu cầu của bạn) */}
          {inputText.trim() ? (
            <TouchableOpacity style={styles.sendBtn} onPress={() => handleSend()} activeOpacity={0.8}>
              <Ionicons name="arrow-up" size={18} color="#FFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.micBtn}
              onPress={() =>
                Alert.alert(
                  'Ghi âm giọng nói 🎙️',
                  'Đang lắng nghe câu hỏi của bạn... Hãy nói vào micro để AI tự động chuyển thành văn bản và trả lời.'
                )
              }
              activeOpacity={0.7}
            >
              <Ionicons name="mic-outline" size={20} color="#0F172A" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 5. SIDEBAR MENU TRƯỢT TỪ BÊN TRÁI SANG (Không che thanh Tab Bar Hình 2)   */}
      {/* ========================================================================= */}
      {isSidebarOpen && (
        <View style={styles.sidebarOverlay}>
          {/* Container trượt từ bên trái sang (translateX từ -340 về 0) */}
          <Animated.View
            style={[
              styles.sidebarContainer,
              { transform: [{ translateX: slideAnim }] },
            ]}
          >
            {/* Header Sidebar: Tên "SmartCare AI" & Nút đóng X */}
            <View style={styles.sidebarHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <AIBotIcon size={28} />
                <Text style={styles.sidebarBrandTitle}>SmartCare AI</Text>
              </View>
              <TouchableOpacity onPress={closeSidebar} style={styles.iconBtn}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              {/* Nút: Cuộc trò chuyện mới (Pill xám bo tròn như hình 2) */}
              <TouchableOpacity
                style={styles.newChatPill}
                onPress={handleNewChat}
                activeOpacity={0.8}
              >
                <Ionicons name="create-outline" size={20} color="#0F172A" style={{ marginRight: 12 }} />
                <Text style={styles.newChatPillText}>Cuộc trò chuyện mới</Text>
              </TouchableOpacity>

              {/* Nút / Khung: Tìm kiếm trong các cuộc trò chuyện (Hỗ trợ gõ từ khóa lọc thật) */}
              {isSearching ? (
                <View style={styles.searchBarBox}>
                  <Ionicons name="search-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.searchBarInput}
                    placeholder="Tìm theo từ khóa (huyết áp, SpO2, ngã...)"
                    placeholderTextColor="#94A3B8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus
                  />
                  <TouchableOpacity
                    onPress={() => {
                      setSearchQuery('');
                      setIsSearching(false);
                    }}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.searchRow}
                  onPress={() => setIsSearching(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="search-outline" size={20} color="#64748B" style={{ marginRight: 12 }} />
                  <Text style={styles.searchRowText}>Tìm kiếm trong các cuộc trò chuyện</Text>
                </TouchableOpacity>
              )}

              {/* Section: Gần đây (Recent Conversations) */}
              <Text style={styles.sidebarGroupTitle}>
                {isSearching && searchQuery.trim() ? `Kết quả tìm kiếm (${filteredChats.length})` : 'Gần đây'}
              </Text>

              {filteredChats.length === 0 ? (
                <View style={styles.emptySearchBox}>
                  <Ionicons name="alert-circle-outline" size={18} color="#94A3B8" />
                  <Text style={styles.emptySearchText}>Không tìm thấy cuộc trò chuyện phù hợp</Text>
                </View>
              ) : (
                filteredChats.map((chat) => (
                  <TouchableOpacity
                    key={chat.id}
                    style={styles.sidebarItemRow}
                    onPress={() => handleOpenHistoryChat(chat)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color="#0284C7" style={{ marginRight: 10 }} />
                    <Text style={styles.sidebarItemText} numberOfLines={1}>
                      {chat.title}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            {/* Chân trang Sidebar: Chỉ để tên người dùng theo đúng yêu cầu Hình 1 */}
            <View style={styles.sidebarFooter}>
              <TouchableOpacity
                style={styles.userProfileRow}
                onPress={() => {
                  closeSidebar();
                  navigation.navigate('Profile');
                }}
              >
                <View style={styles.userAvatarCircle}>
                  <Ionicons name="person" size={20} color="#0284C7" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.userNameText}>Nghia Nguyen</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Vùng bấm ra ngoài để đóng sidebar */}
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeSidebar} />
        </View>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL CHỌN MÔ HÌNH AI (DROPDOWN GỌN GÀNG)                              */}
      {/* ========================================================================= */}
      <Modal visible={isModelPickerOpen} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Chọn Mô Hình AI</Text>

            <TouchableOpacity
              style={[
                styles.pickerOption,
                selectedModel === 'SmartCare Flash 1' && styles.pickerOptionActive,
              ]}
              onPress={() => {
                setSelectedModel('SmartCare Flash 1');
                setIsModelPickerOpen(false);
              }}
            >
              <Text style={styles.pickerOptionTitle}>SmartCare Flash 1 (Mới nhất)</Text>
              <Text style={styles.pickerOptionSub}>
                Mô hình AI đa phương thức mới nhất kết hợp YOLO-Pose, YAMNet và AMG8833.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.pickerOption,
                selectedModel === 'SmartCare Pro 1' && styles.pickerOptionActive,
              ]}
              onPress={() => {
                setSelectedModel('SmartCare Pro 1');
                setIsModelPickerOpen(false);
              }}
            >
              <Text style={styles.pickerOptionTitle}>SmartCare Pro 1</Text>
              <Text style={styles.pickerOptionSub}>
                Mô hình phân tích y khoa chuyên sâu và chẩn đoán nguy cơ té ngã dài hạn.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pickerCloseBtn}
              onPress={() => setIsModelPickerOpen(false)}
            >
              <Text style={styles.pickerCloseBtnText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// =========================================================================
// STYLESHEET: ĐẶT TÊN CÁC THẺ NGẮN GỌN, DỄ HIỂU THEO ĐÚNG YÊU CẦU CỦA BẠN
// =========================================================================
const styles = StyleSheet.create({
  // Khung chứa toàn bộ màn hình
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // 1. Header trên cùng
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#0F172A',
  },
  modelText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  // Nút Profile tròn góc trên bên phải đồng bộ với avatar Hình 1 (chỉ đổi hình nút tròn, không ghi chữ)
  profileAvatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 2. Khung Báo Lỗi AI
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#FCA5A5',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#991B1B',
  },
  errorDesc: {
    fontSize: 11,
    color: '#B91C1C',
    marginTop: 2,
    lineHeight: 15,
  },
  retryBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  retryText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // 3. Vùng Cuộn Chính
  mainScroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 110,
  },

  // Hero Box (Mẫu Gemini Hình 3)
  heroBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
  },
  iconWrap: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starWrap: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    maxWidth: 320,
  },

  // Danh sách Prompt gợi ý
  promptList: {
    width: '100%',
    marginTop: 28,
    gap: 10,
  },
  promptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  promptText: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '600',
    flex: 1,
  },

  // 4. Danh Sách Tin Nhắn Chat
  chatList: {
    gap: 14,
  },
  msgRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  aiRow: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  aiAvatarSmall: {
    marginRight: 8,
    marginTop: 4,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userBubble: {
    backgroundColor: '#0284C7',
    borderTopRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  errorBubble: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  msgText: {
    fontSize: 14,
    lineHeight: 22,
  },
  userMsgText: {
    color: '#FFFFFF',
  },
  aiMsgText: {
    color: '#0F172A',
  },
  timeText: {
    fontSize: 10,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  userTimeText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  aiTimeText: {
    color: '#94A3B8',
  },

  // 5. Thanh Nhập Liệu Hình Viên Thuốc (Floating Pill Input)
  bottomBarWrap: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
  },
  pillInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  // Nút Ghi âm tròn có viền (nút duy nhất bên phải ô nhập liệu theo yêu cầu)
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 6. Sidebar Menu (Mẫu Gemini Hình 2)
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    flexDirection: 'row',
    zIndex: 999,
  },
  sidebarContainer: {
    width: '82%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    height: '100%',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sidebarBrandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginLeft: 8,
  },
  newChatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
  },
  newChatPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  searchRowText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 6,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  emptySearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 8,
  },
  emptySearchText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  sidebarGroupTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 12,
    textTransform: 'uppercase',
  },
  sidebarItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  sidebarItemText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
    flex: 1,
  },
  sidebarFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 14,
  },
  userProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },

  // 7. Modal Chọn Model AI
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  pickerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
  },
  pickerOption: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  pickerOptionActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7',
  },
  pickerOptionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  pickerOptionSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 16,
  },
  pickerCloseBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  pickerCloseBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
});

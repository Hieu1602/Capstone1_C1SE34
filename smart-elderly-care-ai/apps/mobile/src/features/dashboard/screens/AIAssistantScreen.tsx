// ============================================================================
// MÀN HÌNH TRỢ LÝ SỨC KHỎE AI (AI ASSISTANT SCREEN)
// Hệ thống: Smart Elderly Care AI (SECA)
// Thiết kế: Phong cách đàm thoại trực quan Gemini Assistant
// Chức năng:
//   - Trò chuyện, tư vấn hỏi đáp sức khỏe và tình trạng người cao tuổi thông qua RAG Chatbot API
//   - Tích hợp nhận diện giọng nói, thanh nhập liệu nổi (Floating Pill Bar)
//   - Quản lý lịch sử hội thoại có thanh tìm kiếm nhanh trong Sidebar trượt
//   - Tự động cuộn xuống cuối danh sách tin nhắn khi có phản hồi mới
//   - Tương thích chế độ giao diện Sáng / Tối (Light & Dark Theme)
// ============================================================================

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// Helper an toàn cho Speech & Audio: Ngăn ngừa lỗi native module làm sập app trên Expo Go
let SafeSpeech: any = null;
try {
  SafeSpeech = require('expo-speech');
} catch (e) {
  console.warn('expo-speech không khả dụng:', e);
}

let SafeAudio: any = null;
try {
  SafeAudio = require('expo-audio');
} catch (e) {
  console.warn('expo-audio không khả dụng:', e);
}

// Import biểu tượng Robot Trợ lý AI và các Store quản trị trạng thái
import AIBotIcon from '../../../components/AIBotIcon';
import { useVitalStore } from '../../../store/useVitalStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useTheme } from '../../../store/useThemeStore';
import api, { chatbotApi } from '../../../services/api';


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

// Lịch sử các cuộc trò chuyện y tế
export interface HistoryChat {
  id: string;
  title: string;
  messages: ChatMessage[];
}

export default function AIAssistantScreen({ navigation }: any) {
  const { isDarkMode, colors } = useTheme();
  // Lấy trạng thái kết nối từ Store
  const { isConnected } = useVitalStore();
  // Lấy thông tin tài khoản người dùng thực tế từ AuthStore (loại bỏ dữ liệu giả lập)
  const { userName, full_name } = useAuthStore();
  const displayName = full_name || userName || 'Người dùng';

  // ---- CÁC STATE QUẢN LÝ GIAO DIỆN ----
  // 1. Trạng thái mở/đóng Sidebar trượt từ bên trái sang
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Giá trị tọa độ trượt translateX (-340 ẩn bên trái -> 0 hiển thị trên màn hình)
  const slideAnim = React.useRef(new Animated.Value(-340)).current;
  const backdropAnim = React.useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  // 2. Quản lý ghi âm giọng nói (STT - Speech to Text)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingInstance, setRecordingInstance] = useState<any>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recordingTimerRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Dọn dẹp âm thanh khi unmount
  useEffect(() => {
    return () => {
      try {
        SafeSpeech?.stop?.();
      } catch (_) {}
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (recordingInstance) {
        try {
          recordingInstance.stop?.();
        } catch (_) {}
      }
    };
  }, []);



  // Hàm bắt đầu ghi âm giọng nói (Speech-to-Text)
  const startVoiceRecording = async () => {
    // 1. Nếu chạy trên Web: Sử dụng Web Speech API
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.lang = 'vi-VN';
          recognition.continuous = false;
          recognition.interimResults = false;

          setIsRecording(true);
          recognition.onresult = (event: any) => {
            const transcript = event.results?.[0]?.[0]?.transcript;
            if (transcript) {
              setInputText(transcript);
              handleSend(transcript);
            }
            setIsRecording(false);
          };
          recognition.onerror = (e: any) => {
            console.warn('SpeechRecognition error:', e);
            setIsRecording(false);
          };
          recognition.onend = () => {
            setIsRecording(false);
          };
          recognition.start();
          return;
        } catch (e) {
          console.warn('Web Speech API failed, fallback to audio recorder:', e);
        }
      }
    }

    // 2. Trên thiết bị Mobile: Sử dụng expo-audio hiện đại an toàn
    if (!SafeAudio) {
      Alert.alert(
        'Ghi âm giọng nói',
        'Mô-đun ghi âm native chưa sẵn sàng trong môi trường này. Bạn hãy nhập câu hỏi bằng văn bản nhé.'
      );
      return;
    }

    try {
      const AudioMod = SafeAudio.AudioModule || SafeAudio.default || SafeAudio;
      const requestPerms = SafeAudio.requestRecordingPermissionsAsync || AudioMod?.requestRecordingPermissionsAsync;

      if (typeof requestPerms === 'function') {
        const perm = await requestPerms();
        if (!perm?.granted) {
          Alert.alert('Cấp quyền Microphone', 'Vui lòng cho phép ứng dụng truy cập micro để hỏi đáp bằng giọng nói.');
          return;
        }
      }

      const setAudioMode = SafeAudio.setAudioModeAsync || AudioMod?.setAudioModeAsync;
      if (typeof setAudioMode === 'function') {
        await setAudioMode({
          allowsRecording: true,
          playsInSilentMode: true,
        });
      }

      const AudioRecorderClass = SafeAudio.AudioRecorder || AudioMod?.AudioRecorder;
      if (!AudioRecorderClass) {
        throw new Error('AudioRecorder không khả dụng trong expo-audio');
      }

      const recording = new AudioRecorderClass({
        extension: '.wav',
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 128000,
        android: {
          extension: '.wav',
          outputFormat: 'default',
          audioEncoder: 'default',
        },
        ios: {
          extension: '.wav',
          outputFormat: 'lpcm',
          audioQuality: 32,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });

      await recording.prepareToRecordAsync();
      recording.record();
      setRecordingInstance(recording);
      setIsRecording(true);
      setRecordingDuration(0);

      // Hiệu ứng nhịp đập Pulse cho Micro
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
        ])
      ).start();

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= 25) {
            stopAndSendVoiceRecording(false, recording);
            return 25;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err: any) {
      console.warn('Lỗi khởi động ghi âm:', err);
      Alert.alert('Lỗi micro', 'Không thể khởi động ghi âm: ' + (err.message || 'Vui lòng thử lại.'));
      setIsRecording(false);
    }
  };

  // Hàm dừng ghi âm và gửi xử lý nhận diện giọng nói
  const stopAndSendVoiceRecording = async (cancel = false, customRecording?: any) => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);

    const rec = customRecording || recordingInstance;
    if (!rec) {
      setIsRecording(false);
      return;
    }

    try {
      await rec.stop();
      const uri = rec.uri || rec.getURI?.();
      setRecordingInstance(null);
      setIsRecording(false);

      if (cancel || !uri) {
        return;
      }

      setIsTranscribing(true);
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'recording.wav';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `audio/${match[1]}` : 'audio/wav';

      formData.append('file', {
        uri,
        name: filename,
        type,
      } as any);

      const res = await chatbotApi.transcribeAudio(formData);

      if (res.data?.status === 'success' && res.data?.text) {
        const transcribedText = res.data.text.trim();
        setInputText(transcribedText);
        handleSend(transcribedText);
      } else {
        Alert.alert(
          'Nhận diện giọng nói',
          res.data?.message || 'Không thể nhận diện được câu hỏi. Bạn hãy thử nói to và rõ hơn nhé.'
        );
      }
    } catch (err: any) {
      console.warn('Lỗi chuyển giọng nói thành văn bản:', err);
      Alert.alert(
        'Lỗi giọng nói',
        'Không thể nhận diện giọng nói: ' + (err?.response?.data?.detail || err?.message || 'Lỗi mạng')
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  // Hàm mở Sidebar: trượt mượt mà từ cạnh trái sang kèm hiệu ứng mờ nền toàn màn hình
  const openSidebar = () => {
    setIsSidebarOpen(true);
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        bounciness: 0,
        speed: 16,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };

  // Hàm đóng Sidebar: trượt lùi về bên trái và mờ dần nền rồi mới tắt modal
  const closeSidebar = () => {
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(slideAnim, {
        toValue: -340,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      setIsSidebarOpen(false);
    });
  };

  // 3. Tên mô hình AI cố định của hệ thống: SmartCare Flash 1
  const MODEL_NAME = 'SmartCare Flash 1';

  // 4. Danh sách các tin nhắn trao đổi
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // 5. Nội dung người dùng nhập vào ô tìm kiếm / hỏi đáp
  const [inputText, setInputText] = useState('');

  // 6. Cảnh báo lỗi AI (chỉ đưa ra cảnh báo lỗi, không có nút mô phỏng test)
  const [aiError, setAiError] = useState<AIErrorType>('NONE');

  // 7. State loading khi đang chờ AI phản hồi
  const [isLoading, setIsLoading] = useState(false);

  // 8. State tìm kiếm và danh sách cuộc trò chuyện lịch sử
  const [historyChats, setHistoryChats] = useState<HistoryChat[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Hàm mở lại cuộc trò chuyện từ lịch sử khi người dùng bấm vào
  const handleOpenHistoryChat = (chat: HistoryChat) => {
    setMessages(chat.messages);
    closeSidebar();
  };

  // Lọc danh sách cuộc trò chuyện theo từ khóa tìm kiếm (tìm cả tiêu đề lẫn nội dung câu hỏi)
  const filteredChats = historyChats.filter((chat: HistoryChat) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchTitle = chat.title.toLowerCase().includes(q);
    const matchMsg = chat.messages.some((m: ChatMessage) => m.text.toLowerCase().includes(q));
    return matchTitle || matchMsg;
  });

  // ---- HÀM XỬ LÝ GỬI TIN NHẮN TƯ VẤN ----
  const handleSend = async (customText?: string) => {
    const textToSend = customText || inputText;
    if (!textToSend.trim() || isLoading) return;

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
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: '⚠️ Không thể kết nối đến máy chủ AI (Timeout). Vui lòng kiểm tra kết nối mạng.',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
      return;
    }

    // Gọi RAG Chatbot API thật
    setIsLoading(true);
    try {
      const response = await api.post('/chatbot/chat', {
        message: textToSend,
        context_window: 8,
      });

      const data = response.data;
      const reply = data.answer || 'Tôi đã nhận được câu hỏi nhưng chưa có câu trả lời.';

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: reply,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);



    } catch (error: any) {
      // Fallback nếu chatbot service chưa chạy
      const isOffline =
        error?.response?.status === 503 ||
        error?.code === 'ECONNREFUSED' ||
        error?.message?.includes('Network Error');

      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: isOffline
          ? '⚠️ Không thể kết nối đến máy chủ Backend. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau.'
          : `⚠️ Lỗi kết nối AI: ${error?.response?.data?.detail || error?.message}`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };


  // Tạo cuộc trò chuyện mới
  const handleNewChat = () => {
    if (messages.length > 0) {
      const firstUserMsg = messages.find((m: ChatMessage) => m.sender === 'user');
      const title = firstUserMsg ? firstUserMsg.text.slice(0, 30) : 'Cuộc trò chuyện';
      setHistoryChats((prev: HistoryChat[]) => [
        {
          id: Date.now().toString(),
          title: title + (firstUserMsg && firstUserMsg.text.length > 30 ? '...' : ''),
          messages: [...messages],
        },
        ...prev,
      ]);
    }
    setMessages([]);
    setSearchQuery('');
    setIsSearching(false);
    closeSidebar();
  };



  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? colors.background : '#FFFFFF' }]} edges={['top']}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={isDarkMode ? colors.background : '#FFFFFF'}
      />

      {/* ========================================================================= */}
      {/* 1. THANH HEADER TRÊN CÙNG (Đồng nhất màu Status Bar, cân đối và tinh gọn)  */}
      {/* ========================================================================= */}
      <View style={[styles.topBar, isDarkMode && { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        {/* Nút Menu Hamburger mở Sidebar từ trái sang */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={openSidebar}
          activeOpacity={0.7}
          accessibilityLabel="Mở danh sách trò chuyện"
        >
          <Ionicons name="menu-outline" size={26} color={isDarkMode ? colors.textPrimary : '#0F172A'} />
        </TouchableOpacity>

        {/* Nhãn hiển thị mô hình AI duy nhất: SmartCare Flash 1 */}
        <View style={[styles.modelBadge, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.modelDot} />
          <Text style={[styles.modelText, isDarkMode && { color: colors.textPrimary }]} numberOfLines={1}>
            {MODEL_NAME}
          </Text>
        </View>

        {/* Nút Cuộc trò chuyện mới tiện ích ở góc phải (cân đối giao diện header) */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={handleNewChat}
          activeOpacity={0.7}
          accessibilityLabel="Cuộc trò chuyện mới"
        >
          <Ionicons name="create-outline" size={22} color={isDarkMode ? colors.textPrimary : '#0F172A'} />
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* VÙNG NỘI DUNG CHÍNH (Nền dịu mắt #F8FAFC)                                  */}
      {/* ========================================================================= */}
      <View style={[styles.mainBody, isDarkMode && { backgroundColor: colors.background }]}>

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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.mainScroll}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {/* NẾU CHƯA CÓ TIN NHẮN: Hiển thị giao diện chào mừng Hero chuẩn Hình 3 */}
          {messages.length === 0 ? (
            <View style={styles.heroBox}>
              {/* Biểu tượng Robot AI đội tai nghe hỗ trợ theo đúng hình ảnh bạn cung cấp */}
              <View style={styles.iconWrap}>
                <AIBotIcon size={84} />
              </View>

              {/* Dòng chữ chào đón chuẩn hình mẫu */}
              <Text style={[styles.heroTitle, isDarkMode && { color: colors.textPrimary }]}>Mình sẵn sàng, chỉ chờ bạn thôi</Text>
              <Text style={[styles.heroSub, isDarkMode && { color: colors.textSecondary }]}>
                Hỏi bất kỳ điều gì về sức khỏe, nhịp tim, giấc ngủ hoặc phát hiện té ngã của người thân.
              </Text>

              {/* Các thẻ gợi ý câu hỏi nhanh (Prompt Suggestions) */}
              <View style={styles.promptList}>
                <TouchableOpacity
                  style={[styles.promptChip, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => handleSend('Kiểm tra nhịp tim và SpO2 hiện tại')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="heart-outline" size={16} color={isDarkMode ? '#38BDF8' : '#0284C7'} style={{ marginRight: 8 }} />
                  <Text style={[styles.promptText, isDarkMode && { color: colors.textPrimary }]}>Kiểm tra nhịp tim &amp; SpO₂ hiện tại</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.promptChip, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => handleSend('Tình trạng té ngã hôm nay thế nào?')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="body-outline" size={16} color={isDarkMode ? '#38BDF8' : '#0284C7'} style={{ marginRight: 8 }} />
                  <Text style={[styles.promptText, isDarkMode && { color: colors.textPrimary }]}>Tình trạng té ngã hôm nay thế nào?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.promptChip, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => handleSend('Hướng dẫn sơ cứu khi người già bị ngã')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="medkit-outline" size={16} color={isDarkMode ? '#38BDF8' : '#0284C7'} style={{ marginRight: 8 }} />
                  <Text style={[styles.promptText, isDarkMode && { color: colors.textPrimary }]}>Hướng dẫn sơ cứu khi người già bị ngã</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.promptChip, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => handleSend('Phát loa nhắc cụ uống thuốc (FR12)')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="volume-high-outline" size={16} color={isDarkMode ? '#38BDF8' : '#0284C7'} style={{ marginRight: 8 }} />
                  <Text style={[styles.promptText, isDarkMode && { color: colors.textPrimary }]}>Phát loa nhắc cụ uống thuốc (FR12)</Text>
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
                      m.sender === 'user'
                        ? styles.userBubble
                        : [styles.aiBubble, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }],
                      m.isError && styles.errorBubble,
                    ]}
                  >
                    <Text
                      style={[
                        styles.msgText,
                        m.sender === 'user'
                          ? styles.userMsgText
                          : [styles.aiMsgText, isDarkMode && { color: colors.textPrimary }],
                      ]}
                    >
                      {m.text}
                    </Text>

                    {/* Footer tin nhắn: Thời gian */}
                    <View style={styles.bubbleFooter}>
                      <Text
                        style={[
                          styles.timeText,
                          m.sender === 'user'
                            ? styles.userTimeText
                            : [styles.aiTimeText, isDarkMode && { color: colors.textMuted }],
                        ]}
                      >
                        {m.timestamp}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}

              {/* Typing indicator - hiển thị khi AI đang suy nghĩ */}
              {isLoading && (
                <View style={[styles.msgRow, styles.aiRow]}>
                  <View style={styles.aiAvatarSmall}>
                    <AIBotIcon size={24} />
                  </View>
                  <View
                    style={[
                      styles.bubble,
                      styles.aiBubble,
                      isDarkMode && { backgroundColor: colors.card, borderColor: colors.border },
                      { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
                    ]}
                  >
                    <ActivityIndicator size="small" color="#0284C7" style={{ marginRight: 8 }} />
                    <Text style={[styles.aiMsgText, { fontStyle: 'italic' }, isDarkMode && { color: colors.textMuted }]}>
                      AI đang suy nghĩ...
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* ========================================================================= */}
        {/* 4. THANH NHẬP LIỆU NỔI HÌNH VIÊN THUỐC (FLOATING PILL INPUT BAR - Hình 3)  */}
        {/* ========================================================================= */}
        <View style={styles.bottomBarWrap}>
          <View style={[styles.pillInput, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Ô nhập nội dung câu hỏi */}
            <TextInput
              style={[styles.textInput, { maxHeight: 80 }, isDarkMode && { color: colors.textPrimary }]}
              placeholder={isTranscribing ? "Đang nhận diện giọng nói..." : "Hỏi SmartCare AI..."}
              placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
              value={inputText}
              onChangeText={setInputText}
              multiline
              editable={!isTranscribing}
            />

            {/* Nút Gửi hoặc Nút Ghi âm giọng nói */}
            {inputText.trim() ? (
              <TouchableOpacity
                style={[styles.sendBtn, (isLoading || isTranscribing) && { opacity: 0.6 }]}
                onPress={() => handleSend()}
                disabled={isLoading || isTranscribing}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name="arrow-up" size={18} color="#FFF" />
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.micBtn,
                  isRecording && styles.micBtnRecording,
                  isDarkMode && { borderColor: colors.border, backgroundColor: colors.card }
                ]}
                onPress={startVoiceRecording}
                disabled={isLoading || isTranscribing}
                activeOpacity={0.7}
              >
                {isTranscribing ? (
                  <ActivityIndicator size="small" color="#0284C7" />
                ) : (
                  <Ionicons
                    name={isRecording ? "mic" : "mic-outline"}
                    size={20}
                    color={isRecording ? "#EF4444" : (isDarkMode ? colors.textPrimary : '#0F172A')}
                  />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
      </View>

      {/* ========================================================================= */}
      {/* 5. MODAL GHI ÂM GIỌNG NÓI TRỰC QUAN (VOICE RECORDING MODAL)               */}
      {/* ========================================================================= */}
      <Modal
        visible={isRecording}
        transparent
        animationType="fade"
        onRequestClose={() => stopAndSendVoiceRecording(true)}
      >
        <View style={styles.recordingOverlay}>
          <View style={[styles.recordingCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Vòng tròn nhịp đập Pulse của Micro */}
            <Animated.View style={[styles.micPulseWrap, { transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.micPulseOuter}>
                <View style={styles.micPulseInner}>
                  <Ionicons name="mic" size={36} color="#FFFFFF" />
                </View>
              </View>
            </Animated.View>

            <Text style={[styles.recordingTitle, isDarkMode && { color: colors.textPrimary }]}>
              Đang lắng nghe câu hỏi...
            </Text>
            <Text style={styles.recordingTimer}>
              00:{recordingDuration < 10 ? `0${recordingDuration}` : recordingDuration}
            </Text>
            <Text style={[styles.recordingSub, isDarkMode && { color: colors.textMuted }]}>
              Hãy nói rõ câu hỏi (ví dụ: "Nhịp tim hôm nay", "Cụ có bị ngã không?", "Nhắc uống thuốc")
            </Text>

            <View style={styles.recordingActions}>
              <TouchableOpacity
                style={styles.cancelRecordBtn}
                onPress={() => stopAndSendVoiceRecording(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={18} color="#64748B" style={{ marginRight: 4 }} />
                <Text style={styles.cancelRecordText}>Hủy bỏ</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.finishRecordBtn}
                onPress={() => stopAndSendVoiceRecording(false)}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.finishRecordText}>Hoàn tất &amp; Gửi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 5. SIDEBAR MENU TRƯỢT TỪ BÊN TRÁI SANG QUA MODAL TOÀN MÀN HÌNH            */}
      {/* ========================================================================= */}
      <Modal
        visible={isSidebarOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeSidebar}
      >
        <View style={styles.modalRoot}>
          {/* Backdrop tối mờ che phủ toàn màn hình (che cả Status Bar lẫn Tab Bar) */}
          <Animated.View style={[styles.modalBackdrop, { opacity: backdropAnim }]}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={closeSidebar}
            />
          </Animated.View>

          {/* Container Sidebar trượt từ bên trái sang */}
          <Animated.View
            style={[
              styles.sidebarContainer,
              isDarkMode && { backgroundColor: colors.background },
              { transform: [{ translateX: slideAnim }] },
            ]}
          >
            <SafeAreaView style={styles.sidebarSafeArea} edges={['top', 'bottom']}>
              {/* Header Sidebar: Tên "SmartCare AI" & Nút đóng X */}
              <View style={[styles.sidebarHeader, isDarkMode && { borderBottomColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <AIBotIcon size={28} />
                  <Text style={[styles.sidebarBrandTitle, isDarkMode && { color: colors.textPrimary }]}>SmartCare AI</Text>
                </View>
                <TouchableOpacity
                  onPress={closeSidebar}
                  style={styles.iconBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={24} color={isDarkMode ? colors.textPrimary : '#0F172A'} />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 16 }}
                keyboardShouldPersistTaps="handled"
              >
                {/* Nút: Cuộc trò chuyện mới (Pill xám bo tròn chuẩn giao diện) */}
                <TouchableOpacity
                  style={[styles.newChatPill, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={handleNewChat}
                  activeOpacity={0.8}
                >
                  <Ionicons name="create-outline" size={20} color={isDarkMode ? colors.textPrimary : '#0F172A'} style={{ marginRight: 12 }} />
                  <Text style={[styles.newChatPillText, isDarkMode && { color: colors.textPrimary }]}>Cuộc trò chuyện mới</Text>
                </TouchableOpacity>

                {/* Nút / Khung: Tìm kiếm trong các cuộc trò chuyện (Hỗ trợ gõ từ khóa lọc thật) */}
                {isSearching ? (
                  <View style={[styles.searchBarBox, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="search-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
                    <TextInput
                      style={[styles.searchBarInput, isDarkMode && { color: colors.textPrimary }]}
                      placeholder="Tìm theo từ khóa (huyết áp, SpO2, ngã...)"
                      placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
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
                    style={[styles.searchRow, isDarkMode && { backgroundColor: colors.card }]}
                    onPress={() => setIsSearching(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="search-outline" size={20} color="#64748B" style={{ marginRight: 12 }} />
                    <Text style={[styles.searchRowText, isDarkMode && { color: colors.textSecondary }]}>Tìm kiếm trong các cuộc trò chuyện</Text>
                  </TouchableOpacity>
                )}

                {/* Section: Gần đây (Recent Conversations) */}
                <Text style={[styles.sidebarGroupTitle, isDarkMode && { color: colors.textSecondary }]}>
                  {isSearching && searchQuery.trim() ? `Kết quả tìm kiếm (${filteredChats.length})` : 'Gần đây'}
                </Text>

                {filteredChats.length === 0 ? (
                  <View style={styles.emptySearchBox}>
                    <Ionicons name="alert-circle-outline" size={18} color="#94A3B8" />
                    <Text style={[styles.emptySearchText, isDarkMode && { color: colors.textSecondary }]}>Không tìm thấy cuộc trò chuyện phù hợp</Text>
                  </View>
                ) : (
                  filteredChats.map((chat: HistoryChat) => (
                    <TouchableOpacity
                      key={chat.id}
                      style={[styles.sidebarItemRow, isDarkMode && { backgroundColor: colors.card }]}
                      onPress={() => handleOpenHistoryChat(chat)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={16} color="#0284C7" style={{ marginRight: 10 }} />
                      <Text style={[styles.sidebarItemText, isDarkMode && { color: colors.textPrimary }]} numberOfLines={1}>
                        {chat.title}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>

              {/* Chân trang Sidebar: Hiển thị tên người dùng thực tế từ AuthStore */}
              <View style={[styles.sidebarFooter, isDarkMode && { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={styles.userProfileRow}
                  onPress={() => {
                    closeSidebar();
                    navigation.navigate('Profile');
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.userAvatarCircle}>
                    <Ionicons name="person" size={20} color="#0284C7" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.userNameText, isDarkMode && { color: colors.textPrimary }]}>{displayName}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </Animated.View>
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
    backgroundColor: '#FFFFFF',
  },

  // 1. Header trên cùng (Đồng bộ trắng tinh khôi với status bar, chiều cao 52 chuẩn)
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  mainBody: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modelDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
    marginRight: 7,
  },
  modelText: {
    fontSize: 13,
    fontWeight: '700',
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
  autoSpeakBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  autoSpeakBtnActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#38BDF8',
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
    paddingBottom: 16,
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
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 8,
  },
  speakerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 132, 199, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  speakerBtnText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },

  // 5. Thanh Nhập Liệu Hình Viên Thuốc (Floating Pill Input)
  bottomBarWrap: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 16 : 14,
    paddingTop: 8,
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
  // Nút Ghi âm tròn có viền
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnRecording: {
    borderColor: '#EF4444',
    backgroundColor: '#FEE2E2',
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modal Ghi Âm Giọng Nói
  recordingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  recordingCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  micPulseWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  micPulseOuter: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micPulseInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  recordingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  recordingTimer: {
    fontSize: 24,
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: 1,
    marginBottom: 8,
  },
  recordingSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  recordingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  cancelRecordBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 12,
  },
  cancelRecordText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  finishRecordBtn: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284C7',
    borderRadius: 14,
    paddingVertical: 12,
  },
  finishRecordText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // 6. Sidebar Menu (Mẫu Drawer Toàn Màn Hình)
  modalRoot: {
    flex: 1,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sidebarContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '82%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 20,
    zIndex: 10,
  },
  sidebarSafeArea: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
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

});


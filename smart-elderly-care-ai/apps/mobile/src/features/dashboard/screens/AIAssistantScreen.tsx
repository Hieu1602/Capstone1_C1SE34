// ============================================================================
// MÀN HÌNH TRỢ LÝ SỨC KHỎE AI (AI ASSISTANT SCREEN)
// Hệ thống: Smart Elderly Care AI (SECA)
// Chức năng:
//   - Trò chuyện, tư vấn hỏi đáp sức khỏe và tình trạng người cao tuổi qua Chatbot RAG API
//   - Tích hợp nhận diện giọng nói (STT), thanh nhập liệu nổi (Floating Pill Bar)
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
  Keyboard,
  Modal,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// Helper an toàn cho Audio: Ngăn ngừa lỗi native module làm sập app trên Expo Go
let SafeAudio: any = null;
try {
  SafeAudio = require('expo-audio');
} catch (e) {
  console.warn('expo-audio không khả dụng:', e);
}

import AIBotIcon from '../../../components/AIBotIcon';
import { useAuthStore } from '../../../store/useAuthStore';
import { useTheme } from '../../../store/useThemeStore';
import { chatbotApi } from '../../../services/api';

// Cấu trúc dữ liệu cho tin nhắn chat
interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  isError?: boolean;
}

// Lịch sử các cuộc trò chuyện
export interface HistoryChat {
  id: string;
  title: string;
  messages: ChatMessage[];
}

// Danh sách gợi ý câu hỏi nhanh ban đầu
const PROMPT_SUGGESTIONS = [
  { icon: 'heart-outline', text: 'Kiểm tra nhịp tim & SpO₂ hiện tại' },
  { icon: 'body-outline', text: 'Tình trạng té ngã hôm nay thế nào?' },
  { icon: 'medkit-outline', text: 'Hướng dẫn sơ cứu khi người già bị ngã' },
  { icon: 'volume-high-outline', text: 'Phát loa nhắc cụ uống thuốc' },
] as const;

const MODEL_NAME = 'SmartCare Flash 1';

export default function AIAssistantScreen({ navigation }: any) {
  const { isDarkMode, colors } = useTheme();
  const { userName, full_name } = useAuthStore();
  const displayName = full_name || userName || 'Người dùng';

  // State quản lý giao diện
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-340)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  // State tin nhắn & tìm kiếm
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [historyChats, setHistoryChats] = useState<HistoryChat[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Quản lý ghi âm giọng nói (STT - Speech to Text)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingInstance, setRecordingInstance] = useState<any>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recordingTimerRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Dọn dẹp timer & audio khi unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (recordingInstance) {
        try {
          recordingInstance.stop?.();
        } catch (_) { }
      }
    };
  }, [recordingInstance]);

  // Chiều cao Bottom Tab Bar để bù trừ KeyboardAvoidingView trên iOS
  let tabBarHeight = 84;
  try {
    tabBarHeight = useBottomTabBarHeight();
  } catch (_) {
    tabBarHeight = Platform.OS === 'ios' ? 84 : 0;
  }

  // Cuộn xuống tin nhắn mới nhất khi mở bàn phím
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(showEvent, () => {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 50);
    });
    return () => sub.remove();
  }, []);

  // Format nội dung markdown từ AI (**bold**, *italic*, ngắt dòng)
  const renderFormattedAIMessage = (content: string) => {
    const lines = content.split('\n');
    return (
      <View style={{ gap: 4 }}>
        {lines.map((line, lIdx) => {
          if (!line.trim()) return <View key={lIdx} style={{ height: 6 }} />;
          const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
          return (
            <Text
              key={lIdx}
              style={[
                styles.msgText,
                styles.aiMsgText,
                isDarkMode && { color: colors.textPrimary },
              ]}
            >
              {parts.map((part, pIdx) => {
                if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
                  return (
                    <Text
                      key={pIdx}
                      style={{
                        fontWeight: '700',
                        color: isDarkMode ? '#38BDF8' : '#0284C7',
                      }}
                    >
                      {part.slice(2, -2)}
                    </Text>
                  );
                }
                if (part.startsWith('*') && part.endsWith('*') && part.length >= 3) {
                  return (
                    <Text
                      key={pIdx}
                      style={{
                        fontStyle: 'italic',
                        color: isDarkMode ? '#94A3B8' : '#64748B',
                      }}
                    >
                      {part.slice(1, -1)}
                    </Text>
                  );
                }
                return part;
              })}
            </Text>
          );
        })}
      </View>
    );
  };

  // Khởi động ghi âm giọng nói
  const startVoiceRecording = async () => {
    // 1. Web: Sử dụng Web Speech API
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
          recognition.onerror = () => setIsRecording(false);
          recognition.onend = () => setIsRecording(false);
          recognition.start();
          return;
        } catch (e) {
          console.warn('Web Speech API failed:', e);
        }
      }
    }

    // 2. Mobile: Sử dụng expo-audio
    if (!SafeAudio) {
      Alert.alert('Ghi âm giọng nói', 'Mô-đun ghi âm chưa sẵn sàng. Bạn hãy nhập câu hỏi bằng văn bản nhé.');
      return;
    }

    try {
      const AudioMod = SafeAudio.AudioModule || SafeAudio.default || SafeAudio;
      const requestPerms = SafeAudio.requestRecordingPermissionsAsync || AudioMod?.requestRecordingPermissionsAsync;

      if (typeof requestPerms === 'function') {
        const perm = await requestPerms();
        if (!perm?.granted) {
          Alert.alert('Quyền Microphone', 'Vui lòng cho phép ứng dụng truy cập micro để hỏi đáp bằng giọng nói.');
          return;
        }
      }

      const setAudioMode = SafeAudio.setAudioModeAsync || AudioMod?.setAudioModeAsync;
      if (typeof setAudioMode === 'function') {
        await setAudioMode({ allowsRecording: true, playsInSilentMode: true });
      }

      const AudioRecorderClass = SafeAudio.AudioRecorder || AudioMod?.AudioRecorder;
      if (!AudioRecorderClass) throw new Error('AudioRecorder không khả dụng');

      const recording = new AudioRecorderClass({
        extension: '.wav',
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 128000,
        android: { extension: '.wav', outputFormat: 'default', audioEncoder: 'default' },
        ios: {
          extension: '.wav',
          outputFormat: 'lpcm',
          audioQuality: 32,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
      });

      await recording.prepareToRecordAsync();
      recording.record();
      setRecordingInstance(recording);
      setIsRecording(true);
      setRecordingDuration(0);

      // Hiệu ứng nhịp đập Pulse
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
      console.warn('Lỗi ghi âm:', err);
      Alert.alert('Lỗi micro', 'Không thể khởi động ghi âm: ' + (err.message || 'Vui lòng thử lại.'));
      setIsRecording(false);
    }
  };

  // Dừng ghi âm và gửi xử lý STT
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

      if (cancel || !uri) return;

      setIsTranscribing(true);
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'recording.wav';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `audio/${match[1]}` : 'audio/wav';

      formData.append('file', { uri, name: filename, type } as any);

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
      console.warn('Lỗi STT:', err);
      Alert.alert(
        'Lỗi giọng nói',
        'Không thể nhận diện giọng nói: ' + (err?.response?.data?.detail || err?.message || 'Lỗi mạng')
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  // Mở Sidebar
  const openSidebar = () => {
    setIsSidebarOpen(true);
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(slideAnim, { toValue: 0, bounciness: 0, speed: 16, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  };

  // Đóng Sidebar
  const closeSidebar = () => {
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(slideAnim, { toValue: -340, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
    ]).start(() => {
      setIsSidebarOpen(false);
    });
  };

  // Mở lại cuộc trò chuyện từ lịch sử
  const handleOpenHistoryChat = (chat: HistoryChat) => {
    setMessages(chat.messages);
    closeSidebar();
  };

  // Lọc lịch sử trò chuyện
  const filteredChats = historyChats.filter((chat) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return chat.title.toLowerCase().includes(q) || chat.messages.some((m) => m.text.toLowerCase().includes(q));
  });

  // Gửi tin nhắn đến Chatbot RAG API
  const handleSend = async (customText?: string) => {
    const textToSend = (customText || inputText).trim();
    if (!textToSend || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInputText('');

    setIsLoading(true);
    try {
      const response = await chatbotApi.chat({
        message: textToSend,
        context_window: 8,
      });

      const reply = response.data?.answer || 'Tôi đã nhận được câu hỏi nhưng chưa có câu trả lời.';
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: reply,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (error: any) {
      const isOffline =
        error?.response?.status === 503 ||
        error?.code === 'ECONNREFUSED' ||
        error?.message?.includes('Network Error');

      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: isOffline
          ? '⚠️ Không thể kết nối đến máy chủ Backend. Vui lòng kiểm tra lại mạng hoặc thử lại sau.'
          : `⚠️ Lỗi kết nối AI: ${error?.response?.data?.detail || error?.message}`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Bắt đầu cuộc trò chuyện mới
  const handleNewChat = () => {
    if (messages.length > 0) {
      const firstUserMsg = messages.find((m) => m.sender === 'user');
      const title = firstUserMsg ? firstUserMsg.text.slice(0, 30) : 'Cuộc trò chuyện';
      setHistoryChats((prev) => [
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

      {/* 1. Header Bar */}
      <View style={[styles.topBar, isDarkMode && { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={openSidebar}
          activeOpacity={0.7}
          accessibilityLabel="Mở danh sách trò chuyện"
        >
          <Ionicons name="menu-outline" size={26} color={isDarkMode ? colors.textPrimary : '#0F172A'} />
        </TouchableOpacity>

        <View style={[styles.modelBadge, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.modelDot} />
          <Text style={[styles.modelText, isDarkMode && { color: colors.textPrimary }]} numberOfLines={1}>
            {MODEL_NAME}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={handleNewChat}
          activeOpacity={0.7}
          accessibilityLabel="Cuộc trò chuyện mới"
        >
          <Ionicons name="create-outline" size={22} color={isDarkMode ? colors.textPrimary : '#0F172A'} />
        </TouchableOpacity>
      </View>

      {/* 2. Main Content */}
      <View style={[styles.mainBody, isDarkMode && { backgroundColor: colors.background }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? tabBarHeight : 0}
        >
          <ScrollView
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.mainScroll}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.length === 0 ? (
              /* Hero Box khi chưa có tin nhắn */
              <View style={styles.heroBox}>
                <View style={styles.iconWrap}>
                  <AIBotIcon size={84} />
                </View>
                <Text style={[styles.heroTitle, isDarkMode && { color: colors.textPrimary }]}>
                  Mình sẵn sàng, chỉ chờ bạn thôi
                </Text>
                <Text style={[styles.heroSub, isDarkMode && { color: colors.textSecondary }]}>
                  Hỏi bất kỳ điều gì về sức khỏe, nhịp tim, giấc ngủ hoặc phát hiện té ngã của người thân.
                </Text>

                {/* Các thẻ gợi ý câu hỏi nhanh */}
                <View style={styles.promptList}>
                  {PROMPT_SUGGESTIONS.map((prompt, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.promptChip, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={() => handleSend(prompt.text)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={prompt.icon as any}
                        size={16}
                        color={isDarkMode ? '#38BDF8' : '#0284C7'}
                        style={{ marginRight: 8 }}
                      />
                      <Text style={[styles.promptText, isDarkMode && { color: colors.textPrimary }]}>
                        {prompt.text}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              /* Danh sách tin nhắn chat */
              <View style={styles.chatList}>
                {messages.map((m) => (
                  <View
                    key={m.id}
                    style={[styles.msgRow, m.sender === 'user' ? styles.userRow : styles.aiRow]}
                  >
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
                      {m.sender === 'user' ? (
                        <Text style={[styles.msgText, styles.userMsgText]}>{m.text}</Text>
                      ) : (
                        renderFormattedAIMessage(m.text)
                      )}

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

                {/* Typing indicator */}
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

          {/* 3. Floating Pill Input Bar */}
          <View style={styles.bottomBarWrap}>
            <View style={[styles.pillInput, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.textInput, { maxHeight: 80 }, isDarkMode && { color: colors.textPrimary }]}
                placeholder={isTranscribing ? 'Đang nhận diện giọng nói...' : 'Hỏi SmartCare AI...'}
                placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
                value={inputText}
                onChangeText={setInputText}
                multiline
                editable={!isTranscribing}
              />

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
                    isDarkMode && { borderColor: colors.border, backgroundColor: colors.card },
                  ]}
                  onPress={startVoiceRecording}
                  disabled={isLoading || isTranscribing}
                  activeOpacity={0.7}
                >
                  {isTranscribing ? (
                    <ActivityIndicator size="small" color="#0284C7" />
                  ) : (
                    <Ionicons
                      name={isRecording ? 'mic' : 'mic-outline'}
                      size={20}
                      color={isRecording ? '#EF4444' : isDarkMode ? colors.textPrimary : '#0F172A'}
                    />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>

      {/* 4. Modal Ghi âm giọng nói */}
      <Modal
        visible={isRecording}
        transparent
        animationType="fade"
        onRequestClose={() => stopAndSendVoiceRecording(true)}
      >
        <View style={styles.recordingOverlay}>
          <View style={[styles.recordingCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
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

      {/* 5. Sidebar Menu Modal */}
      <Modal
        visible={isSidebarOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeSidebar}
      >
        <View style={styles.modalRoot}>
          <Animated.View style={[styles.modalBackdrop, { opacity: backdropAnim }]}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeSidebar} />
          </Animated.View>

          <Animated.View
            style={[
              styles.sidebarContainer,
              isDarkMode && { backgroundColor: colors.background },
              { transform: [{ translateX: slideAnim }] },
            ]}
          >
            <SafeAreaView style={styles.sidebarSafeArea} edges={['top', 'bottom']}>
              <View style={[styles.sidebarHeader, isDarkMode && { borderBottomColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <AIBotIcon size={28} />
                  <Text style={[styles.sidebarBrandTitle, isDarkMode && { color: colors.textPrimary }]}>SmartCare AI</Text>
                </View>
                <TouchableOpacity onPress={closeSidebar} style={styles.iconBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={24} color={isDarkMode ? colors.textPrimary : '#0F172A'} />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 16 }}
                keyboardShouldPersistTaps="handled"
              >
                <TouchableOpacity
                  style={[styles.newChatPill, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={handleNewChat}
                  activeOpacity={0.8}
                >
                  <Ionicons name="create-outline" size={20} color={isDarkMode ? colors.textPrimary : '#0F172A'} style={{ marginRight: 12 }} />
                  <Text style={[styles.newChatPillText, isDarkMode && { color: colors.textPrimary }]}>Cuộc trò chuyện mới</Text>
                </TouchableOpacity>

                {isSearching ? (
                  <View style={[styles.searchBarBox, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="search-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
                    <TextInput
                      style={[styles.searchBarInput, isDarkMode && { color: colors.textPrimary }]}
                      placeholder="Tìm kiếm cuộc trò chuyện..."
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
                    <Text style={[styles.searchRowText, isDarkMode && { color: colors.textSecondary }]}>
                      Tìm kiếm trong các cuộc trò chuyện
                    </Text>
                  </TouchableOpacity>
                )}

                <Text style={[styles.sidebarGroupTitle, isDarkMode && { color: colors.textSecondary }]}>
                  {isSearching && searchQuery.trim() ? `Kết quả tìm kiếm (${filteredChats.length})` : 'Gần đây'}
                </Text>

                {filteredChats.length === 0 ? (
                  <View style={styles.emptySearchBox}>
                    <Ionicons name="alert-circle-outline" size={18} color="#94A3B8" />
                    <Text style={[styles.emptySearchText, isDarkMode && { color: colors.textSecondary }]}>
                      Không tìm thấy cuộc trò chuyện nào
                    </Text>
                  </View>
                ) : (
                  filteredChats.map((chat) => (
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
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
  mainScroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
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

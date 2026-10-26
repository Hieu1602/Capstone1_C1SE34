// ============================================================================
// MÀN HÌNH TRỢ LÝ SỨC KHỎE AI (AI ASSISTANT SCREEN) - REFACTORED & OPTIMIZED
// Hệ thống: Smart Elderly Care AI (SECA)
// Tối ưu hóa:
//   - Tải tức thì trên Expo Go: Loại bỏ top-level native modules & Modal window lag
//   - Memoized Components: ChatMessageRow & Markdown Renderer không re-render khi gõ chữ
//   - Zero-Modal Drawer: Sidebar trượt mượt mà 60fps qua Animated.View in-tree
//   - Tích hợp giọng đọc AI tiếng Việt (TTS qua expo-speech)
//   - Tuân thủ nghiêm ngặt React Hook Rules (không gọi hook trong try/catch)
// ============================================================================

import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
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
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { AudioModule, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';

import AIBotIcon from '../../../components/AIBotIcon';
import { useAuthStore } from '../../../store/useAuthStore';
import { useTheme } from '../../../store/useThemeStore';
import { chatbotApi } from '../../../services/api';

// Cấu trúc dữ liệu cho tin nhắn chat
export interface ChatMessage {
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
] as const;

const MODEL_NAME = 'SmartCare Flash 1';

// ----------------------------------------------------------------------------
// Memoized Markdown Renderer cho tin nhắn AI (tránh re-split regex khi gõ phím)
// ----------------------------------------------------------------------------
interface FormattedAIMarkdownProps {
  content: string;
  isDarkMode: boolean;
  textPrimary: string;
}

const FormattedAIMarkdown = memo(({ content, isDarkMode, textPrimary }: FormattedAIMarkdownProps) => {
  const renderedLines = useMemo(() => {
    const lines = content.split('\n');
    return lines.map((line, lIdx) => {
      if (!line.trim()) return <View key={lIdx} style={{ height: 6 }} />;
      const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
      return (
        <Text
          key={lIdx}
          style={[
            styles.msgText,
            styles.aiMsgText,
            isDarkMode && { color: textPrimary },
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
    });
  }, [content, isDarkMode, textPrimary]);

  return <View style={{ gap: 4 }}>{renderedLines}</View>;
});

// ----------------------------------------------------------------------------
// Memoized Row cho từng tin nhắn (Tăng tốc cuộn và gõ phím)
// ----------------------------------------------------------------------------
interface ChatMessageRowProps {
  message: ChatMessage;
  isDarkMode: boolean;
  colors: any;
  onSpeak?: (msgId: string, text: string) => void;
  isSpeaking?: boolean;
}

const ChatMessageRow = memo(
  ({ message, isDarkMode, colors, onSpeak, isSpeaking }: ChatMessageRowProps) => {
    const isUser = message.sender === 'user';

    return (
      <View style={[styles.msgRow, isUser ? styles.userRow : styles.aiRow]}>
        {!isUser && (
          <View style={styles.aiAvatarSmall}>
            <AIBotIcon size={24} />
          </View>
        )}

        <View
          style={[
            styles.bubble,
            isUser
              ? styles.userBubble
              : [styles.aiBubble, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }],
            message.isError && styles.errorBubble,
          ]}
        >
          {isUser ? (
            <Text style={[styles.msgText, styles.userMsgText]}>{message.text}</Text>
          ) : (
            <FormattedAIMarkdown
              content={message.text}
              isDarkMode={isDarkMode}
              textPrimary={colors.textPrimary}
            />
          )}

          <View style={styles.bubbleFooter}>
            <Text
              style={[
                styles.timeText,
                isUser
                  ? styles.userTimeText
                  : [styles.aiTimeText, isDarkMode && { color: colors.textMuted || '#94A3B8' }],
              ]}
            >
              {message.timestamp}
            </Text>

            {!isUser && !message.isError && onSpeak && (
              <TouchableOpacity
                onPress={() => onSpeak(message.id, message.text)}
                style={styles.speakBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
                accessibilityLabel="Đọc nội dung tư vấn AI"
              >
                <Ionicons
                  name={isSpeaking ? 'volume-high' : 'volume-medium-outline'}
                  size={16}
                  color={isSpeaking ? '#0284C7' : isDarkMode ? '#94A3B8' : '#64748B'}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }
);

// ----------------------------------------------------------------------------
// Component Chính: AIAssistantScreen
// ----------------------------------------------------------------------------
export default function AIAssistantScreen({ navigation }: any) {
  const { isDarkMode, colors } = useTheme();
  const { userName, full_name } = useAuthStore();
  const displayName = full_name || userName || 'Người dùng';

  // State điều khiển Drawer Sidebar (In-tree, Không dùng Modal nặng)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-340)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  // Refs & Chat State
  const scrollViewRef = useRef<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [historyChats, setHistoryChats] = useState<HistoryChat[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Giọng đọc AI (TTS)
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  // Ghi âm giọng nói (STT - Speech to Text)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recorderRef = useRef<any>(null);
  const recordingTimerRef = useRef<any>(null);

  // Chiều cao bàn phím iOS an toàn (Không dùng try/catch hook)
  const keyboardVerticalOffset = Platform.OS === 'ios' ? 88 : 0;

  // Tự động dừng TTS & Audio Recorder khi unmount
  useEffect(() => {
    return () => {
      Speech.stop().catch(() => {});
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (recorderRef.current) {
        try {
          recorderRef.current.stop();
        } catch (_) {}
      }
    };
  }, []);

  // Cuộn xuống tin nhắn mới nhất khi mở bàn phím
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(showEvent, () => {
      if (messages.length > 0) {
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 60);
      }
    });
    return () => sub.remove();
  }, [messages.length]);

  // Điều khiển đọc giọng nói AI (TTS tiếng Việt)
  const handleSpeak = useCallback(
    async (msgId: string, text: string) => {
      try {
        const isSpeaking = await Speech.isSpeakingAsync();
        if (isSpeaking && speakingMessageId === msgId) {
          await Speech.stop();
          setSpeakingMessageId(null);
          return;
        }

        await Speech.stop();
        setSpeakingMessageId(msgId);

        // Làm sạch ký tự markdown trước khi đọc
        const cleanText = text.replace(/[*_#`]/g, '').trim();

        Speech.speak(cleanText, {
          language: 'vi-VN',
          pitch: 1.0,
          rate: 0.95,
          onDone: () => setSpeakingMessageId(null),
          onError: () => setSpeakingMessageId(null),
          onStopped: () => setSpeakingMessageId(null),
        });
      } catch (err) {
        console.warn('[Speech] Lỗi phát âm:', err);
        setSpeakingMessageId(null);
      }
    },
    [speakingMessageId]
  );

  // Mở Sidebar mượt mà (60fps với Native Driver)
  const openSidebar = useCallback(() => {
    setIsSidebarOpen(true);
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        bounciness: 0,
        speed: 18,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropAnim, slideAnim]);

  // Đóng Sidebar
  const closeSidebar = useCallback(() => {
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -340,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsSidebarOpen(false);
    });
  }, [backdropAnim, slideAnim]);

  // Chọn cuộc trò chuyện từ lịch sử
  const handleOpenHistoryChat = useCallback(
    (chat: HistoryChat) => {
      setMessages(chat.messages);
      closeSidebar();
    },
    [closeSidebar]
  );

  // Bắt đầu cuộc trò chuyện mới
  const handleNewChat = useCallback(() => {
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
  }, [messages, closeSidebar]);

  // Gửi tin nhắn đến Chatbot RAG API
  const handleSend = useCallback(
    async (customText?: string) => {
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
    },
    [inputText, isLoading]
  );

  // Dừng ghi âm và gửi lên Backend STT xử lý
  const stopAndSendVoiceRecording = useCallback(
    async (cancel = false, customRecorder?: any) => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      const rec = customRecorder || recorderRef.current;
      recorderRef.current = null;
      setIsRecording(false);
      setRecordingDuration(0);

      if (!rec) return;

      try {
        await rec.stop();
        const uri = rec.uri;

        if (cancel || !uri) return;

        setIsTranscribing(true);
        const formData = new FormData();
        const filename = uri.split('/').pop() || 'voice_recording.wav';
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
        console.warn('[Voice STT] Lỗi nhận diện giọng nói:', err);
        Alert.alert(
          'Lỗi giọng nói',
          'Không thể nhận diện giọng nói: ' +
            (err?.response?.data?.detail || err?.message || 'Lỗi kết nối đến máy chủ AI.')
        );
      } finally {
        setIsTranscribing(false);
      }
    },
    [handleSend]
  );

  // Xử lý Voice Input an toàn
  const startVoiceRecording = useCallback(async () => {
    // 1. Web: Hỗ trợ Web Speech API
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
          setIsRecording(false);
        }
      }
    }

    // Nếu đang ghi âm mà nhấn lại nút mic -> Dừng và gửi
    if (isRecording) {
      await stopAndSendVoiceRecording(false);
      return;
    }

    // 2. Mobile App (Android / iOS): Sử dụng AudioRecorder của expo-audio
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm?.granted) {
        Alert.alert(
          'Quyền Microphone',
          'Vui lòng cấp quyền truy cập micro trong Cài đặt để đặt câu hỏi bằng giọng nói cho Trợ lý AI.'
        );
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      const recorder = new AudioModule.AudioRecorder({
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
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
      recorderRef.current = recorder;
      setIsRecording(true);
      setRecordingDuration(0);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= 25) {
            stopAndSendVoiceRecording(false, recorder);
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
  }, [isRecording, handleSend, stopAndSendVoiceRecording]);

  // Lọc lịch sử trò chuyện (memoized)
  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return historyChats;
    const q = searchQuery.toLowerCase();
    return historyChats.filter(
      (chat) => chat.title.toLowerCase().includes(q) || chat.messages.some((m) => m.text.toLowerCase().includes(q))
    );
  }, [historyChats, searchQuery]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? colors.background : '#FFFFFF' }]} edges={['top']}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        
      />

      {/* 1. Top Navigation Bar */}
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

      {/* 2. Chat Main Area */}
      <View style={[styles.mainBody, isDarkMode && { backgroundColor: colors.background }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={keyboardVerticalOffset}
        >
          <ScrollView
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.mainScroll}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => {
              if (messages.length > 0) {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }
            }}
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
                  <ChatMessageRow
                    key={m.id}
                    message={m}
                    isDarkMode={isDarkMode}
                    colors={colors}
                    onSpeak={handleSpeak}
                    isSpeaking={speakingMessageId === m.id}
                  />
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
            {/* Thanh thông báo trạng thái ghi âm */}
            {isRecording && (
              <View style={[styles.recordingBanner, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
                <View style={styles.recordingLeft}>
                  <View style={styles.recordingDot} />
                  <Text style={[styles.recordingText, isDarkMode && { color: '#F1F5F9' }]}>
                    Đang ghi âm: 00:{recordingDuration < 10 ? `0${recordingDuration}` : recordingDuration} / 00:25
                  </Text>
                </View>
                <View style={styles.recordingActions}>
                  <TouchableOpacity
                    style={styles.cancelRecBtn}
                    onPress={() => stopAndSendVoiceRecording(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelRecText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.doneRecBtn}
                    onPress={() => stopAndSendVoiceRecording(false)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="checkmark" size={15} color="#FFF" style={{ marginRight: 4 }} />
                    <Text style={styles.doneRecText}>Xong</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Thanh thông báo nhận diện giọng nói */}
            {isTranscribing && (
              <View style={[styles.transcribingBanner, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
                <ActivityIndicator size="small" color="#0284C7" style={{ marginRight: 8 }} />
                <Text style={[styles.transcribingText, isDarkMode && { color: '#F1F5F9' }]}>
                  Đang nhận diện giọng nói tiếng Việt...
                </Text>
              </View>
            )}

            <View style={[styles.pillInput, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.textInput, { maxHeight: 80 }, isDarkMode && { color: colors.textPrimary }]}
                placeholder={
                  isRecording
                    ? 'Đang lắng nghe câu hỏi...'
                    : isTranscribing
                    ? 'Đang chuyển đổi giọng nói...'
                    : 'Hỏi SmartCare AI...'
                }
                placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
                value={inputText}
                onChangeText={setInputText}
                multiline
                editable={!isRecording && !isTranscribing}
              />

              {inputText.trim() && !isRecording && !isTranscribing ? (
                <TouchableOpacity
                  style={[styles.sendBtn, isLoading && { opacity: 0.6 }]}
                  onPress={() => handleSend()}
                  disabled={isLoading}
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
                  accessibilityLabel={isRecording ? 'Dừng ghi âm và gửi' : 'Nói câu hỏi'}
                >
                  {isTranscribing ? (
                    <ActivityIndicator size="small" color="#0284C7" />
                  ) : (
                    <Ionicons
                      name={isRecording ? 'stop' : 'mic-outline'}
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

      {/* 4. Drawer Backdrop (Tối ưu hóa In-Tree, Không dùng Modal nặng) */}
      <Animated.View
        pointerEvents={isSidebarOpen ? 'auto' : 'none'}
        style={[
          styles.drawerBackdrop,
          {
            opacity: backdropAnim,
          },
        ]}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeSidebar} />
      </Animated.View>

      {/* 5. In-Tree Sliding Sidebar (Trượt 60fps Native Driver) */}
      <Animated.View
        pointerEvents={isSidebarOpen ? 'auto' : 'none'}
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
    </SafeAreaView>
  );
}

// ----------------------------------------------------------------------------
// Stylesheet Tối Ưu Hóa
// ----------------------------------------------------------------------------
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
  speakBtn: {
    padding: 3,
    borderRadius: 8,
  },
  bottomBarWrap: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 16 : 14,
    paddingTop: 8,
  },
  recordingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  recordingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  recordingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#991B1B',
  },
  recordingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelRecBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  cancelRecText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  doneRecBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#0284C7',
  },
  doneRecText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  transcribingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  transcribingText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#0369A1',
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
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    zIndex: 90,
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
    zIndex: 100,
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

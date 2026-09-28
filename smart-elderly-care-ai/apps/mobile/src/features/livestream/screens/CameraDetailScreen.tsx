// CameraDetailScreen.tsx
// Màn hình Camera Chi Tiết – UI chuẩn Imou Life / SmartCare AI
// Tham khảo giao diện thực tế Imou Ranger 2C

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Modal,
  Linking,
  Animated,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path, Circle, Ellipse, Polygon } from 'react-native-svg';
import { Colors, Shadows } from '../../../theme/colors';
import { useVitalStore } from '../../../store/useVitalStore';
import { useTheme } from '../../../store/useThemeStore';

// Safe dynamic require for video modules
let NativeVideo: any = null;
let NativeWebView: any = null;

if (Platform.OS !== 'web') {
  try {
    NativeVideo = require('react-native-video').default;
  } catch (e) { }
  try {
    NativeWebView = require('react-native-webview').WebView;
  } catch (e) { }
}

const DEFAULT_MOCK_STREAM =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
const FALLBACK_POSTER =
  'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1000&q=85';

// ── Web Audio API Emergency Siren Sound Engine ──
let webAudioCtx: any = null;
let webSirenOsc: any = null;
let webSirenGain: any = null;
let webSirenTimer: any = null;

function playSirenSound() {
  try {
    if (typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        if (!webAudioCtx) {
          webAudioCtx = new AudioCtx();
        }
        if (webAudioCtx.state === 'suspended') {
          webAudioCtx.resume();
        }
        stopSirenSound();
        const osc = webAudioCtx.createOscillator();
        const gain = webAudioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(750, webAudioCtx.currentTime);
        gain.gain.setValueAtTime(0.25, webAudioCtx.currentTime);
        osc.connect(gain);
        gain.connect(webAudioCtx.destination);
        osc.start();
        webSirenOsc = osc;
        webSirenGain = gain;

        let isHigh = true;
        webSirenTimer = setInterval(() => {
          if (webSirenOsc && webAudioCtx) {
            const freq = isHigh ? 1300 : 750;
            webSirenOsc.frequency.setTargetAtTime(freq, webAudioCtx.currentTime, 0.12);
            isHigh = !isHigh;
          }
        }, 320);
      }
    }
  } catch (err) {
    console.warn('Web Audio Siren not supported or blocked:', err);
  }
}

function stopSirenSound() {
  try {
    if (webSirenTimer) {
      clearInterval(webSirenTimer);
      webSirenTimer = null;
    }
    if (webSirenOsc) {
      webSirenOsc.stop();
      webSirenOsc.disconnect();
      webSirenOsc = null;
    }
    if (webSirenGain) {
      webSirenGain.disconnect();
      webSirenGain = null;
    }
  } catch (e) { }
}

function getLiveCameraTimestamp(date = new Date()) {
  const days = ['CN', 'Hai', 'Ba', 'Tư', 'Năm', 'Sáu', 'Bảy'];
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const dayName = days[date.getDay()];
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy} ${dayName}  ${hh}:${min}:${ss}`;
}

function formatSecondsToHMS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface UniversalVideoPlayerProps {
  uri: string;
  paused?: boolean;
  muted?: boolean;
  repeat?: boolean;
  resizeMode?: 'cover' | 'contain';
  style?: any;
  showControls?: boolean;
  fallbackPoster?: string;
}

function UniversalVideoPlayer({
  uri,
  paused = false,
  muted = false,
  repeat = true,
  resizeMode = 'cover',
  style,
  showControls = false,
  fallbackPoster = FALLBACK_POSTER,
}: UniversalVideoPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.playerInner, style]}>
        <video
          src={uri}
          autoPlay={!paused}
          playsInline
          loop={repeat}
          muted={muted}
          controls={showControls}
          poster={fallbackPoster}
          onLoadedData={() => setIsLoading(false)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: resizeMode,
            backgroundColor: '#000',
            border: 'none',
          }}
        />
        {isLoading && (
          <View style={styles.playerLoadingOverlay}>
            <ActivityIndicator size="small" color="#38BDF8" />
            <Text style={styles.playerLoadingText}>Đang nạp luồng camera...</Text>
          </View>
        )}
      </View>
    );
  }

  // Native: Try react-native-video if available
  if (NativeVideo) {
    return (
      <View style={[styles.playerInner, style]}>
        <NativeVideo
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          paused={paused}
          muted={muted}
          repeat={repeat}
          resizeMode={resizeMode}
          controls={showControls}
          onLoad={() => setIsLoading(false)}
        />
        {isLoading && (
          <View style={styles.playerLoadingOverlay}>
            <ActivityIndicator size="small" color="#38BDF8" />
            <Text style={styles.playerLoadingText}>Đang nạp luồng camera...</Text>
          </View>
        )}
      </View>
    );
  }

  // Native: Fallback to WebView with inline HTML5 video
  if (NativeWebView) {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; background: #000; overflow: hidden; }
            body, html { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
            video { width: 100%; height: 100%; object-fit: ${resizeMode}; }
          </style>
        </head>
        <body>
          <video
            src="${uri}"
            ${paused ? '' : 'autoplay'}
            ${repeat ? 'loop' : ''}
            playsinline
            ${muted ? 'muted' : ''}
            ${showControls ? 'controls' : ''}
          ></video>
        </body>
      </html>
    `;

    return (
      <View style={[styles.playerInner, style]}>
        <NativeWebView
          source={{ html: htmlContent }}
          style={StyleSheet.absoluteFill}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          scrollEnabled={false}
          onLoadEnd={() => setIsLoading(false)}
        />
        {isLoading && (
          <View style={styles.playerLoadingOverlay}>
            <ActivityIndicator size="small" color="#38BDF8" />
            <Text style={styles.playerLoadingText}>Đang nạp luồng camera...</Text>
          </View>
        )}
      </View>
    );
  }

  // Fallback to Image
  return (
    <View style={[styles.playerInner, style]}>
      <Image
        source={{ uri: fallbackPoster }}
        style={StyleSheet.absoluteFill}
        resizeMode={resizeMode}
      />
    </View>
  );
}

export default function CameraDetailScreen({ navigation, route }: any) {
  const routeParams = route?.params ?? {};
  const { width: winW, height: winH } = useWindowDimensions();
  const isPortrait = winH > winW;
  const {
    camera,
    house,
    incidents,
    currentVitals,
    setCameraResolution,
    toggleCameraSleep,
    toggleCameraAIProtect,
  } = useVitalStore();

  const cameraDisplayName = routeParams.cameraName || camera.name;

  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isExtendedActionsOpen, setIsExtendedActionsOpen] = useState(false);
  const [isSpotlightOn, setIsSpotlightOn] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [smartTracking, setSmartTracking] = useState(true);
  const [showAIHud, setShowAIHud] = useState(true);
  const [isLandscapeFullscreen, setIsLandscapeFullscreen] = useState(false);
  const [selectedIncidentForReplay, setSelectedIncidentForReplay] = useState<any | null>(null);

  // PTZ Virtual Controller states
  const [showPTZModal, setShowPTZModal] = useState(false);
  const [panAngle, setPanAngle] = useState(180); // 0 - 355 độ
  const [tiltAngle, setTiltAngle] = useState(30); // -5 - 80 độ
  const [ptzActionToast, setPtzActionToast] = useState<string | null>(null);
  const ptzToastTimer = useRef<any>(null);

  const showPtzFeedback = (msg: string) => {
    setPtzActionToast(msg);
    if (ptzToastTimer.current) clearTimeout(ptzToastTimer.current);
    ptzToastTimer.current = setTimeout(() => {
      setPtzActionToast(null);
    }, 1800);
  };

  const handlePTZMove = (direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => {
    if (direction === 'UP') {
      setTiltAngle((prev) => {
        const next = Math.min(80, prev + 10);
        showPtzFeedback(`Nâng góc lên: Tilt ${next}°`);
        return next;
      });
    } else if (direction === 'DOWN') {
      setTiltAngle((prev) => {
        const next = Math.max(-5, prev - 10);
        showPtzFeedback(`Hạ góc xuống: Tilt ${next}°`);
        return next;
      });
    } else if (direction === 'LEFT') {
      setPanAngle((prev) => {
        const next = (prev - 15 + 360) % 360;
        showPtzFeedback(`Xoay trái: Pan ${next}°`);
        return next;
      });
    } else if (direction === 'RIGHT') {
      setPanAngle((prev) => {
        const next = (prev + 15) % 360;
        showPtzFeedback(`Xoay phải: Pan ${next}°`);
        return next;
      });
    }
  };

  const handlePTZReset = () => {
    setPanAngle(180);
    setTiltAngle(30);
    showPtzFeedback('Đã về vị trí gốc (Home 180°)');
  };

  const PRESETS = [
    { id: 'living', name: 'Sofa', icon: 'tv-outline', pan: 180, tilt: 30 },
    { id: 'bed', name: 'Giường', icon: 'bed-outline', pan: 90, tilt: 25 },
    { id: 'door', name: 'Cửa vào', icon: 'enter-outline', pan: 270, tilt: 15 },
    { id: 'kitchen', name: 'Bếp ăn', icon: 'restaurant-outline', pan: 330, tilt: 20 },
  ];

  const handleSelectPreset = (p: typeof PRESETS[0]) => {
    setPanAngle(p.pan);
    setTiltAngle(p.tilt);
    showPtzFeedback(`Chuyển góc: ${p.name} (${p.pan}°, ${p.tilt}°)`);
  };

  // Chế độ luồng: Mặc định phát Mock Stream mượt mà khi chưa có phần cứng
  const [useMockStream, setUseMockStream] = useState(true);
  const activeStreamUrl = useMockStream ? DEFAULT_MOCK_STREAM : (camera.streamUrl || DEFAULT_MOCK_STREAM);

  // Playback & Interactive Timeline states
  const [isPlaybackMode, setIsPlaybackMode] = useState(false);
  const [selectedPlaybackDate, setSelectedPlaybackDate] = useState('Today');
  const [playbackTimeSec, setPlaybackTimeSec] = useState(3 * 3600 + 2 * 60 + 22); // 03:02:22 như trong ảnh
  const [playbackSpeed, setPlaybackSpeed] = useState<'1X' | '2X' | '4X'>('1X');
  const [selectedEventId, setSelectedEventId] = useState<string | null>('ev-fall');
  const [isMultiViewGrid, setIsMultiViewGrid] = useState(false);
  const [selectedGridCam, setSelectedGridCam] = useState('cam-1');
  const [playbackViewMode, setPlaybackViewMode] = useState<'TIMELINE' | 'LIST'>('TIMELINE');

  const HOUR_WIDTH = 120;
  const TOTAL_TIMELINE_WIDTH = 24 * HOUR_WIDTH;
  const timelineScrollRef = useRef<ScrollView>(null);

  const handleSeekOffset = (offsetSec: number) => {
    setPlaybackTimeSec((prev) => {
      const next = Math.max(0, Math.min(86399, prev + offsetSec));
      if (timelineScrollRef.current) {
        const scrollPos = (next / 86400) * TOTAL_TIMELINE_WIDTH;
        timelineScrollRef.current.scrollTo({ x: scrollPos, animated: true });
      }
      return next;
    });
  };

  const handleCycleSpeed = () => {
    const next = playbackSpeed === '1X' ? '2X' : playbackSpeed === '2X' ? '4X' : '1X';
    setPlaybackSpeed(next);
    showPtzFeedback(`Tốc độ phát: ${next}`);
  };

  const handleDownloadClip = () => {
    Alert.alert(
      '📥 Tải Đoạn Clip',
      `Đang trích xuất đoạn video phát lại lúc ${formatSecondsToHMS(playbackTimeSec)} ngày ${selectedPlaybackDate} và lưu vào thư viện thiết bị.`
    );
  };

  useEffect(() => {
    if (isPlaybackMode && timelineScrollRef.current) {
      const scrollPos = (playbackTimeSec / 86400) * TOTAL_TIMELINE_WIDTH;
      setTimeout(() => {
        timelineScrollRef.current?.scrollTo({ x: scrollPos, animated: false });
      }, 120);
    }
  }, [isPlaybackMode]);

  // Live OSD Clock (Cập nhật thời gian thực mỗi giây)
  const [currentTime, setCurrentTime] = useState(() => getLiveCameraTimestamp());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getLiveCameraTimestamp());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const MULTI_GRID_FEEDS = [
    {
      id: 'cam-1',
      name: cameraDisplayName.toUpperCase(),
      room: 'Phòng ngủ',
      uri: FALLBACK_POSTER,
      isLive: true,
      bitrate: '22.25 KB/s',
      osd: currentTime,
    },
    {
      id: 'cam-2',
      name: 'CAMERA PHÒNG KHÁCH - HUB #02',
      room: 'Phòng khách',
      uri: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80',
      isLive: true,
      bitrate: '24.10 KB/s',
      osd: currentTime,
    },
    {
      id: 'cam-3',
      name: 'CAMERA KHU BẾP & BÀN ĂN',
      room: 'Bếp',
      uri: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&q=80',
      isLive: true,
      bitrate: '19.80 KB/s',
      osd: currentTime,
    },
    {
      id: 'cam-4',
      name: 'CAMERA NHÀ TẮM & HÀNH LANG',
      room: 'Hành lang',
      uri: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600&q=80',
      isLive: true,
      bitrate: '21.50 KB/s',
      osd: currentTime,
    },
  ];

  // Siren Alarm states
  const [isSirenActive, setIsSirenActive] = useState(false);
  const [showSirenConfirmModal, setShowSirenConfirmModal] = useState(false);
  const sirenAnim = useRef(new Animated.Value(0)).current;

  const triggerStartSiren = () => {
    setIsSirenActive(true);
    setShowSirenConfirmModal(false);
    playSirenSound();
    Animated.loop(
      Animated.sequence([
        Animated.timing(sirenAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(sirenAnim, { toValue: 0.2, duration: 350, useNativeDriver: true }),
      ])
    ).start();
  };

  const triggerStopSiren = () => {
    setIsSirenActive(false);
    setShowSirenConfirmModal(false);
    stopSirenSound();
    sirenAnim.stopAnimation();
    sirenAnim.setValue(0);
  };

  const handleToggleSiren = () => {
    if (isSirenActive) {
      triggerStopSiren();
    } else {
      setShowSirenConfirmModal(true);
    }
  };

  // Cleanup audio siren on screen unmount
  useEffect(() => {
    return () => {
      stopSirenSound();
    };
  }, []);

  const PLAYBACK_EVENTS = [
    { id: 'ev-audio', timeSec: 15 * 3600 + 20 * 60, timeStr: '15:20', label: 'Cầu cứu "Cứu tôi với"', color: '#F97316', icon: 'mic', type: 'ACOUSTIC' },
    { id: 'ev-heart', timeSec: 16 * 3600 + 45 * 60 + 10, timeStr: '16:45', label: 'Nhịp tim cao (128 bpm)', color: '#EAB308', icon: 'heart', type: 'HEART' },
    { id: 'ev-fall', timeSec: 3 * 3600 + 2 * 60 + 22, timeStr: '03:02', label: '🚨 Té ngã (Fall Detected)', color: '#DC2626', icon: 'warning', type: 'FALL' },
    { id: 'ev-motion', timeSec: 5 * 3600 + 15 * 60, timeStr: '05:15', label: 'Phát hiện người', color: '#10B981', icon: 'walk', type: 'MOTION' },
  ];

  const handleSeekTimeline = (seconds: number, eventId?: string) => {
    setPlaybackTimeSec(seconds);
    if (eventId) setSelectedEventId(eventId);
    if (timelineScrollRef.current) {
      const scrollPos = (seconds / 86400) * TOTAL_TIMELINE_WIDTH;
      timelineScrollRef.current.scrollTo({ x: scrollPos, animated: true });
    }
    showPtzFeedback(`Tua đến: ${formatSecondsToHMS(seconds)}`);
  };

  // Flash animation cho nút chụp ảnh
  const flashAnim = useRef(new Animated.Value(0)).current;
  const snapScale = useRef(new Animated.Value(1)).current;

  const handleSnapshot = () => {
    flashAnim.setValue(0);
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(snapScale, { toValue: 0.7, duration: 80, useNativeDriver: true }),
      Animated.spring(snapScale, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
    Alert.alert('📸 Đã chụp ảnh!', 'Ảnh khoảnh khắc đã được lưu vào thư viện thiết bị.');
  };

  const [recordDuration, setRecordDuration] = useState(0);
  const recDotAnim = useRef(new Animated.Value(1)).current;

  // Pulsing blink animation for REC dot and elapsed timer
  useEffect(() => {
    let blinkLoop: Animated.CompositeAnimation | null = null;
    let recTimer: any = null;

    if (isRecording) {
      setRecordDuration(0);
      recTimer = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);

      blinkLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(recDotAnim, { toValue: 0.25, duration: 500, useNativeDriver: true }),
          Animated.timing(recDotAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      blinkLoop.start();
    } else {
      setRecordDuration(0);
      recDotAnim.setValue(1);
    }

    return () => {
      if (recTimer) clearInterval(recTimer);
      if (blinkLoop) blinkLoop.stop();
    };
  }, [isRecording]);

  const handleRecordToggle = () => {
    const nextState = !isRecording;
    setIsRecording(nextState);
    showPtzFeedback(
      nextState
        ? '🔴 Đang ghi hình video cục bộ...'
        : '💾 Đã lưu đoạn video quay được vào thư viện'
    );
  };

  // ── Two-Way Walkie-Talkie Intercom states ──
  const [showIntercomModal, setShowIntercomModal] = useState(false);
  const [intercomMode, setIntercomMode] = useState<'PTT' | 'HANDS_FREE'>('PTT');
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [speakerVolume, setSpeakerVolume] = useState(85); // 0 - 100%
  const [aiNoiseFilter, setAiNoiseFilter] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [quickMsgSent, setQuickMsgSent] = useState<string | null>(null);

  // Audio chirp feedback for Walkie-Talkie PTT click
  const playWalkieTalkieChirp = (type: 'START' | 'STOP') => {
    if (typeof window !== 'undefined') {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          const freq = type === 'START' ? 950 : 650;
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.12);
        }
      } catch (e) { }
    }
  };

  // Timer for Hands-Free mode
  useEffect(() => {
    let timer: any = null;
    if (isTransmitting && intercomMode === 'HANDS_FREE') {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isTransmitting, intercomMode]);

  // Waveform animated values
  const waveAnims = useRef(
    Array.from({ length: 9 }, () => new Animated.Value(0.2))
  ).current;

  useEffect(() => {
    let animLoop: any = null;
    if (isTransmitting) {
      const animations = waveAnims.map((anim, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 0.35 + Math.random() * 0.65,
              duration: 160 + (i % 3) * 50,
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: 0.15 + Math.random() * 0.25,
              duration: 160 + (i % 3) * 50,
              useNativeDriver: false,
            }),
          ])
        )
      );
      animLoop = Animated.parallel(animations);
      animLoop.start();
    } else {
      waveAnims.forEach((anim) => anim.setValue(0.2));
    }
    return () => {
      if (animLoop) animLoop.stop();
    };
  }, [isTransmitting]);

  const handlePttPressIn = () => {
    setIsTransmitting(true);
    setIsSpeaking(true);
    playWalkieTalkieChirp('START');
    showPtzFeedback(`🎙️ Đang truyền giọng nói tới loa camera (${speakerVolume}%)`);
  };

  const handlePttPressOut = () => {
    setIsTransmitting(false);
    setIsSpeaking(false);
    playWalkieTalkieChirp('STOP');
    showPtzFeedback('Đã dừng truyền giọng nói');
  };

  const handleToggleHandsFree = () => {
    if (isTransmitting) {
      setIsTransmitting(false);
      setIsSpeaking(false);
      playWalkieTalkieChirp('STOP');
      showPtzFeedback('Đã kết thúc cuộc đàm thoại 2 chiều');
    } else {
      setIsTransmitting(true);
      setIsSpeaking(true);
      playWalkieTalkieChirp('START');
      showPtzFeedback('Đã kết nối đàm thoại 2 chiều liên tục');
    }
  };

  const QUICK_VOICE_MESSAGES = [
    { id: 'q1', text: 'Ông/Bà ơi, con đang xem camera, ông/bà có khỏe không?', icon: 'heart' },
    { id: 'q2', text: 'Ông/Bà nhớ uống thuốc đúng giờ nhé!', icon: 'medkit' },
    { id: 'q3', text: 'Con đang trên đường về tới nhà rồi ạ!', icon: 'car' },
    { id: 'q4', text: 'Ông/Bà ngồi yên một chỗ, con gọi người đến giúp ngay!', icon: 'warning' },
  ];

  const handleSendQuickVoiceMsg = (text: string) => {
    setQuickMsgSent(text);
    setIsTransmitting(true);
    setIsSpeaking(true);
    playWalkieTalkieChirp('START');
    showPtzFeedback(`🔊 Đang phát: "${text}"`);
    setTimeout(() => {
      setIsTransmitting(false);
      setIsSpeaking(false);
      playWalkieTalkieChirp('STOP');
      setQuickMsgSent(null);
    }, 2800);
  };

  const handleMicToggle = () => {
    setShowIntercomModal(true);
  };

  const handleResolutionSwitch = () => {
    const nextRes: 'HD' | 'BASIC' = camera.resolution === 'HD' ? 'BASIC' : 'HD';
    setCameraResolution(nextRes);
    showPtzFeedback(`Độ phân giải: ${nextRes}`);
  };

  const handleSOS115 = () => {
    Alert.alert(
      '🚨 GỌI CẤP CỨU 115?',
      `Hành động này sẽ quay số 115 ngay lập tức.\nĐịa chỉ: "${house.address}"`,
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Gọi 115 Ngay', style: 'destructive', onPress: () => Linking.openURL('tel:115') },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* ═══ 1. HEADER ═══ */}
      <View style={[styles.header, isDarkMode && { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.headerBackBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={26} color={isDarkMode ? colors.textPrimary : '#0F172A'} />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {cameraDisplayName.toUpperCase()}
        </Text>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => Alert.alert('Thêm Camera', 'Thêm thiết bị hoặc chia sẻ luồng camera.')}
          >
            <MaterialCommunityIcons name="video-plus-outline" size={24} color="#0F172A" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setShowSettingsModal(true)}
          >
            <Ionicons name="ellipsis-horizontal" size={24} color="#0F172A" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ═══ 2. VIDEO PLAYER ═══ */}
      <View style={[styles.playerContainer, isSirenActive && styles.playerContainerSirenActive]}>
        {camera.isSleep ? (
          <View style={styles.privacyOverlay}>
            <View style={styles.privacyIconCircle}>
              <Ionicons name="eye-off" size={32} color="#F59E0B" />
            </View>
            <Text style={styles.privacyTitle}>Chế độ riêng tư</Text>
            <Text style={styles.privacySub}>Ống kính đã được che. Luồng trực tiếp tạm tắt.</Text>
            <TouchableOpacity style={styles.privacyBtn} onPress={toggleCameraSleep} activeOpacity={0.8}>
              <Ionicons name="eye" size={14} color="#FFF" style={{ marginRight: 4 }} />
              <Text style={styles.privacyBtnText}>Mở lại ống kính</Text>
            </TouchableOpacity>
          </View>
        ) : isMultiViewGrid && !isPlaybackMode ? (
          /* 4-Camera Multi-View Grid (Ảnh 2) */
          <View style={styles.gridContainer}>
            {MULTI_GRID_FEEDS.map((feed) => {
              const isSelected = selectedGridCam === feed.id;
              return (
                <TouchableOpacity
                  key={feed.id}
                  style={[styles.gridCell, isSelected && styles.gridCellActive]}
                  activeOpacity={0.9}
                  onPress={() => {
                    setSelectedGridCam(feed.id);
                    setIsMultiViewGrid(false);
                    showPtzFeedback(`Mở toàn màn hình: ${feed.name}`);
                  }}
                >
                  <Image source={{ uri: feed.uri }} style={styles.gridCellImg} resizeMode="cover" />
                  {feed.id === 'cam-1' && (
                    <View style={styles.liveKbBadge}>
                      <View style={styles.liveGreenDot} />
                      <Text style={styles.liveKbText}>Live    {feed.bitrate}</Text>
                    </View>
                  )}
                  <View style={styles.gridCellBadge}>
                    <Text style={styles.gridCellBadgeText}>{feed.name}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          /* Single Player */
          <>
            <UniversalVideoPlayer
              uri={activeStreamUrl}
              paused={isPaused}
              muted={isMuted}
              repeat={true}
              style={styles.playerStream}
              resizeMode="cover"
              fallbackPoster={FALLBACK_POSTER}
            />

            {/* OSD Watermark Top-Left */}
            {isPlaybackMode ? (
              <View style={styles.playbackOsdOverlay}>
                <Text style={styles.playbackOsdText}>
                  {currentTime.substring(0, 14)}  {formatSecondsToHMS(playbackTimeSec)}
                </Text>
              </View>
            ) : (
              <View style={styles.liveBadgeTopLeft}>
                <View style={styles.liveGreenDot} />
                <Text style={styles.liveBadgeText}>Live    22.25 KB/s</Text>
              </View>
            )}

            {/* Camera Name Bottom-Right */}
            <View style={styles.cameraNameOverlay}>
              <Text style={styles.cameraNameWatermark}>{cameraDisplayName.toUpperCase()}</Text>
            </View>

            {/* Siren Alert Pulsing Overlay if active */}
            {isSirenActive && (
              <Animated.View style={[styles.sirenOverlay, { opacity: sirenAnim }]}>
                <View style={styles.sirenBanner}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialCommunityIcons name="bullhorn" size={18} color="#FFF" />
                    <Text style={styles.sirenBannerText}>🚨 CÒI HÚ ĐANG PHÁT (90dB)</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.sirenDismissBtn}
                    onPress={triggerStopSiren}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="stop-circle" size={14} color="#DC2626" style={{ marginRight: 3 }} />
                    <Text style={styles.sirenDismissBtnText}>DỪNG CÒI</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}

            {/* Top-Right HUD Container: Recording Badge & AI Protect Badge (Never overlapping) */}
            <View style={styles.topRightHudContainer}>
              {/* Recording badge with live elapsed timer and pulsing dot */}
              {isRecording && (
                <View style={styles.recordingBadge}>
                  <Animated.View style={[styles.recordingDot, { opacity: recDotAnim }]} />
                  <Text style={styles.recordingText}>
                    REC {Math.floor(recordDuration / 60).toString().padStart(2, '0')}:{(recordDuration % 60).toString().padStart(2, '0')}
                  </Text>
                </View>
              )}

              {/* AI Protect Status Badge */}
              {!isPlaybackMode && camera.isAIProtect && showAIHud && (
                <View style={styles.aiHudBadge}>
                  <View style={[styles.aiHudDot, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.aiHudText}>AI Protect: ON</Text>
                </View>
              )}

              {/* Spotlight Status Badge */}
              {isSpotlightOn && (
                <View style={[styles.aiHudBadge, { backgroundColor: 'rgba(234, 179, 8, 0.92)' }]}>
                  <Ionicons name="flashlight" size={10} color="#FFF" style={{ marginRight: 3 }} />
                  <Text style={styles.aiHudText}>ĐÈN: BẬT</Text>
                </View>
              )}
            </View>

            {/* AI HUD Bottom Left Overlays */}
            {!isPlaybackMode && camera.isAIProtect && showAIHud && (
              <View style={styles.aiHudBottomLeft}>
                <View style={[styles.aiHudBadge, { backgroundColor: 'rgba(245,158,11,0.88)' }]}>
                  <Ionicons name="thermometer" size={10} color="#FFF" style={{ marginRight: 3 }} />
                  <Text style={styles.aiHudText}>
                    AMG8833: {currentVitals?.skin_temp_max ? `${currentVitals.skin_temp_max.toFixed(1)}°C` : '36.8°C'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.aiHudBadge,
                    {
                      backgroundColor: currentVitals?.fall_detected
                        ? 'rgba(239,68,68,0.9)'
                        : 'rgba(16,185,129,0.85)',
                    },
                  ]}
                >
                  <Ionicons name="walk" size={10} color="#FFF" style={{ marginRight: 3 }} />
                  <Text style={styles.aiHudText}>
                    Người: {currentVitals?.person_count ?? 1} • {currentVitals?.fall_detected ? 'TÉ NGÃ ⚠️' : 'An toàn'}
                  </Text>
                </View>
              </View>
            )}

            {/* Flash overlay for snapshot */}
            <Animated.View
              pointerEvents="none"
              style={[styles.shutterFlash, { opacity: flashAnim }]}
            />
          </>
        )}
      </View>

      {/* Indicator Bar directly beneath Video Player (Ảnh 1 & Ảnh 2) */}
      <View style={styles.videoIndicatorRow}>
        <View style={styles.videoIndicatorBarActive} />
        <View style={styles.videoIndicatorBarInactive} />
      </View>

      {/* ═══ 3. TOOLBAR (5 ICONS) ═══ */}
      <View style={styles.toolbar1}>
        {/* 1. Pause / Play */}
        <TouchableOpacity
          style={styles.toolbarBtn}
          onPress={() => setIsPaused(!isPaused)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isPaused ? 'play' : 'pause'}
            size={22}
            color="#475569"
          />
        </TouchableOpacity>

        {/* 2. Audio Speaker */}
        <TouchableOpacity
          style={styles.toolbarBtn}
          onPress={() => setIsMuted(!isMuted)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isMuted ? 'volume-mute-outline' : 'volume-high-outline'}
            size={22}
            color="#475569"
          />
        </TouchableOpacity>

        {/* 3. Mode Specific: Zoom (Playback) or Resolution Basic (Live) */}
        {isPlaybackMode ? (
          <TouchableOpacity
            style={styles.toolbarBtn}
            onPress={() => showPtzFeedback('🔍 Thu phóng kỹ thuật số')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="magnify-plus-outline" size={24} color="#475569" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.toolbarBtn}
            onPress={handleResolutionSwitch}
            activeOpacity={0.7}
          >
            <View style={styles.basicBadge}>
              <Text style={styles.basicBadgeText}>
                {camera.resolution === 'HD' ? 'HD' : 'BASIC'}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* 4. Multi-View Grid */}
        <TouchableOpacity
          style={styles.toolbarBtn}
          onPress={() => {
            if (isPlaybackMode) {
              setIsPlaybackMode(false);
              setIsMultiViewGrid(true);
            } else {
              setIsMultiViewGrid(!isMultiViewGrid);
            }
          }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="view-grid-outline"
            size={22}
            color={isMultiViewGrid ? Colors.primary : '#475569'}
          />
        </TouchableOpacity>

        {/* 5. Fullscreen Landscape Rotate */}
        <TouchableOpacity
          style={styles.toolbarBtn}
          onPress={() => setIsLandscapeFullscreen(true)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="phone-rotate-landscape"
            size={22}
            color="#475569"
          />
        </TouchableOpacity>
      </View>

      {/* ═══ 4. ACTION ROW (PILL + 4 ROUND BUTTONS) ═══ */}
      <View style={styles.actionRowContainer}>
        <View style={styles.actionRow}>
          {/* 1. Playback / Live View Pill Button */}
          <TouchableOpacity
            style={styles.actionPillBtn}
            onPress={() => {
              setIsPlaybackMode(!isPlaybackMode);
              if (isMultiViewGrid) setIsMultiViewGrid(false);
            }}
            activeOpacity={0.8}
          >
            {isPlaybackMode ? (
              <Ionicons name="play-circle-outline" size={20} color="#EF4444" />
            ) : (
              <MaterialCommunityIcons name="history" size={20} color="#EF4444" />
            )}
            <Text style={styles.actionPillText}>
              {isPlaybackMode ? 'Live View' : 'Playback'}
            </Text>
          </TouchableOpacity>

          {/* 2. Snapshot */}
          <TouchableOpacity
            style={styles.actionCircleBtn}
            onPress={handleSnapshot}
            activeOpacity={0.75}
          >
            <Animated.View style={{ transform: [{ scale: snapScale }] }}>
              <Ionicons name="camera-outline" size={22} color="#334155" />
            </Animated.View>
          </TouchableOpacity>

          {/* 3. Record */}
          <TouchableOpacity
            style={[
              styles.actionCircleBtn,
              isRecording && styles.actionCircleBtnRecording,
            ]}
            onPress={handleRecordToggle}
            activeOpacity={0.75}
          >
            <Ionicons
              name="radio-button-on-outline"
              size={22}
              color={isRecording ? '#EF4444' : '#334155'}
            />
          </TouchableOpacity>

          {/* 4. Speed (Playback) or Mic (Live) */}
          {isPlaybackMode ? (
            <TouchableOpacity
              style={styles.actionCircleBtn}
              onPress={handleCycleSpeed}
              activeOpacity={0.75}
            >
              <Text style={styles.actionSpeedBtnText}>{playbackSpeed}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.actionCircleBtn,
                (isSpeaking || isTransmitting) && styles.actionCircleBtnActive,
              ]}
              onPress={handleMicToggle}
              activeOpacity={0.75}
            >
              <Ionicons
                name={(isSpeaking || isTransmitting) ? 'mic' : 'mic-outline'}
                size={22}
                color={(isSpeaking || isTransmitting) ? '#FFF' : '#334155'}
              />
            </TouchableOpacity>
          )}

          {/* 5. Download (Playback) or PTZ Camera Direction Controller (Live) */}
          {isPlaybackMode ? (
            <TouchableOpacity
              style={styles.actionCircleBtn}
              onPress={handleDownloadClip}
              activeOpacity={0.75}
            >
              <Ionicons name="download-outline" size={22} color="#334155" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionCircleBtn, showPTZModal && styles.actionCircleBtnActive]}
              onPress={() => setShowPTZModal(true)}
              activeOpacity={0.75}
            >
              <Ionicons
                name="move-outline"
                size={22}
                color={showPTZModal ? '#FFF' : '#334155'}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Extended Quick Actions Grid (Xổ xuống khi bấm mũi tên) */}
        {isExtendedActionsOpen && (
          <View style={styles.extendedActionsPanel}>
            <View style={styles.extendedDivider} />
            <View style={styles.extendedGrid}>
              {/* 1. Còi Hú Cảnh Báo Khẩn Cấp (Siren) */}
              <TouchableOpacity
                style={styles.extendedItem}
                onPress={handleToggleSiren}
                activeOpacity={0.75}
              >
                <View
                  style={[
                    styles.extendedIconCircle,
                    isSirenActive && styles.extendedIconCircleActive,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={isSirenActive ? 'bullhorn' : 'bullhorn-outline'}
                    size={22}
                    color={isSirenActive ? '#FFF' : '#334155'}
                  />
                </View>
                <Text style={styles.extendedLabel} numberOfLines={1}>
                  {isSirenActive ? 'Tắt Còi' : 'Còi Hú'}
                </Text>
              </TouchableOpacity>

              {/* 2. Chế Độ Riêng Tư (Cụp Ống Kính) */}
              <TouchableOpacity
                style={styles.extendedItem}
                onPress={() => {
                  toggleCameraSleep();
                  showPtzFeedback(camera.isSleep ? 'Đã bật lại camera' : 'Đã bật chế độ riêng tư');
                }}
                activeOpacity={0.75}
              >
                <View
                  style={[
                    styles.extendedIconCircle,
                    camera.isSleep && styles.extendedIconCircleActive,
                  ]}
                >
                  <Ionicons
                    name={camera.isSleep ? 'eye-off' : 'eye-outline'}
                    size={22}
                    color={camera.isSleep ? '#FFF' : '#334155'}
                  />
                </View>
                <Text style={styles.extendedLabel} numberOfLines={1}>
                  {camera.isSleep ? 'Đang Che' : 'Riêng Tư'}
                </Text>
              </TouchableOpacity>

              {/* 3. Tự Động Bám Người (Smart Tracking) */}
              <TouchableOpacity
                style={styles.extendedItem}
                onPress={() => {
                  const nextState = !smartTracking;
                  setSmartTracking(nextState);
                  showPtzFeedback(nextState ? 'Bật theo dõi người già' : 'Tắt theo dõi chuyển động');
                }}
                activeOpacity={0.75}
              >
                <View
                  style={[
                    styles.extendedIconCircle,
                    smartTracking && styles.extendedIconCircleActive,
                  ]}
                >
                  <Ionicons
                    name="scan-outline"
                    size={22}
                    color={smartTracking ? '#FFF' : '#334155'}
                  />
                </View>
                <Text style={styles.extendedLabel} numberOfLines={1}>
                  Bám Người
                </Text>
              </TouchableOpacity>

              {/* 4. Lớp Phủ Cảm Biến HUD (AMG8833 & Vitals) */}
              <TouchableOpacity
                style={styles.extendedItem}
                onPress={() => {
                  const nextHud = !showAIHud;
                  setShowAIHud(nextHud);
                  showPtzFeedback(nextHud ? 'Bật hiển thị HUD cảm biến' : 'Ẩn hiển thị HUD cảm biến');
                }}
                activeOpacity={0.75}
              >
                <View
                  style={[
                    styles.extendedIconCircle,
                    showAIHud && styles.extendedIconCircleActive,
                  ]}
                >
                  <Ionicons
                    name="thermometer-outline"
                    size={22}
                    color={showAIHud ? '#FFF' : '#334155'}
                  />
                </View>
                <Text style={styles.extendedLabel} numberOfLines={1}>
                  Cảm Biến
                </Text>
              </TouchableOpacity>

              {/* 5. Đèn Trợ Sáng Ban Đêm (Spotlight LED) */}
              <TouchableOpacity
                style={styles.extendedItem}
                onPress={() => {
                  const nextLight = !isSpotlightOn;
                  setIsSpotlightOn(nextLight);
                  showPtzFeedback(nextLight ? '💡 Đã bật đèn trợ sáng ban đêm' : 'Đã tắt đèn trợ sáng');
                }}
                activeOpacity={0.75}
              >
                <View
                  style={[
                    styles.extendedIconCircle,
                    isSpotlightOn && styles.extendedIconCircleActive,
                  ]}
                >
                  <Ionicons
                    name={isSpotlightOn ? 'flashlight' : 'flashlight-outline'}
                    size={22}
                    color={isSpotlightOn ? '#FFF' : '#334155'}
                  />
                </View>
                <Text style={styles.extendedLabel} numberOfLines={1}>
                  Đèn Đêm
                </Text>
              </TouchableOpacity>

              {/* 6. Thư Viện Lưu Trữ Cục Bộ (Local Album) */}
              <TouchableOpacity
                style={styles.extendedItem}
                onPress={() => {
                  Alert.alert(
                    '📁 Thư Viện Cục Bộ',
                    'Đã lưu 12 ảnh khoảnh khắc và 3 video giám sát trong bộ nhớ thiết bị.'
                  );
                }}
                activeOpacity={0.75}
              >
                <View style={styles.extendedIconCircle}>
                  <Ionicons name="images-outline" size={22} color="#334155" />
                </View>
                <Text style={styles.extendedLabel} numberOfLines={1}>
                  Thư Viện
                </Text>
              </TouchableOpacity>

              {/* 7. Chia Sẻ Camera Cho Người Thân */}
              <TouchableOpacity
                style={styles.extendedItem}
                onPress={() => {
                  Alert.alert(
                    '👨‍👩‍👧 Chia Sẻ Camera',
                    'Chia sẻ quyền xem luồng camera an toàn cho thành viên gia đình qua mã QR hoặc số điện thoại.'
                  );
                }}
                activeOpacity={0.75}
              >
                <View style={styles.extendedIconCircle}>
                  <Ionicons name="share-social-outline" size={22} color="#334155" />
                </View>
                <Text style={styles.extendedLabel} numberOfLines={1}>
                  Chia Sẻ
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Down / Up Chevron */}
        <TouchableOpacity
          style={styles.actionChevronBtn}
          onPress={() => setIsExtendedActionsOpen(!isExtendedActionsOpen)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isExtendedActionsOpen ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#9CA3AF"
          />
        </TouchableOpacity>
      </View>

      {/* ═══ 5. MAIN BODY CONTENT (PLAYBACK vs LIVE) ═══ */}
      {isPlaybackMode ? (
        /* PLAYBACK SECTION (Ảnh 1) */
        <View style={styles.playbackContainer}>
          {/* Date Picker Bar */}
          <View style={styles.dateBarRow}>
            <View style={styles.datePill}>
              <TouchableOpacity
                onPress={() => {
                  setSelectedPlaybackDate((prev) => (prev === 'Today' ? 'Yesterday' : 'Today'));
                  showPtzFeedback('Đổi ngày xem lại');
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="chevron-back" size={16} color="#64748B" />
              </TouchableOpacity>
              <Text style={styles.datePillText}>{selectedPlaybackDate}</Text>
              <TouchableOpacity
                onPress={() => {
                  setSelectedPlaybackDate((prev) => (prev === 'Yesterday' ? 'Today' : 'Yesterday'));
                  showPtzFeedback('Đổi ngày xem lại');
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="chevron-forward" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.viewModeBtn}
              onPress={() => {
                const nextMode = playbackViewMode === 'TIMELINE' ? 'LIST' : 'TIMELINE';
                setPlaybackViewMode(nextMode);
                showPtzFeedback(`Chế độ xem: ${nextMode === 'TIMELINE' ? 'Thước đo' : 'Danh sách'}`);
              }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="view-agenda-outline" size={22} color="#475569" />
            </TouchableOpacity>
          </View>

          {/* Timeline Ruler */}
          <View style={styles.timelineRulerWrapper}>
            <ScrollView
              ref={timelineScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: winW / 2 - 1,
              }}
              onScroll={(e) => {
                const offsetX = e.nativeEvent.contentOffset.x;
                const ratio = Math.max(0, Math.min(1, offsetX / TOTAL_TIMELINE_WIDTH));
                const sec = Math.round(ratio * 86399);
                setPlaybackTimeSec(sec);
              }}
              scrollEventThrottle={16}
            >
              <View style={[styles.timelineRulerTrack, { width: TOTAL_TIMELINE_WIDTH }]}>
                {/* Hour Ticks and Labels */}
                {Array.from({ length: 25 }, (_, i) => i).map((hour) => (
                  <View key={hour} style={[styles.hourColumn, { left: hour * HOUR_WIDTH }]}>
                    <View style={styles.majorTick} />
                    <Text style={styles.hourText}>
                      {String(hour).padStart(2, '0')}:00
                    </Text>
                  </View>
                ))}

                {/* Minor Ticks (10m, 20m, 30m, 40m, 50m) */}
                {Array.from({ length: 24 * 6 }, (_, i) => i).map((subIdx) => {
                  if (subIdx % 6 === 0) return null;
                  const pos = (subIdx / (24 * 6)) * TOTAL_TIMELINE_WIDTH;
                  return <View key={`sub-${subIdx}`} style={[styles.minorTick, { left: pos }]} />;
                })}

                {/* Recorded Blue Band */}
                <View style={styles.recordedBand}>
                  {/* Event Markers on Timeline */}
                  {PLAYBACK_EVENTS.map((ev) => (
                    <View
                      key={ev.id}
                      style={[
                        styles.recordedEventMarker,
                        {
                          left: `${(ev.timeSec / 86400) * 100}%`,
                          backgroundColor: ev.color,
                        },
                      ]}
                    />
                  ))}
                </View>
              </View>
            </ScrollView>

            {/* Center Red Needle (Playhead Cursor) */}
            <View style={[styles.centerNeedle, { left: winW / 2 - 1 }]} pointerEvents="none">
              <View style={styles.needleTopPin} />
              <View style={styles.needleLine} />
              <View style={styles.needleBottomPin} />
            </View>
          </View>

          {/* Timeline Scrubber Controls: Rewind 10s | Time Pill | Forward 10s */}
          <View style={styles.timelineScrubControls}>
            <TouchableOpacity
              style={styles.rewindCircleBtn}
              onPress={() => handleSeekOffset(-10)}
              activeOpacity={0.75}
            >
              <MaterialCommunityIcons name="rewind-10" size={24} color="#334155" />
            </TouchableOpacity>

            <View style={styles.timeDisplayPill}>
              <Text style={styles.timeDisplayText}>{formatSecondsToHMS(playbackTimeSec)}</Text>
            </View>

            <TouchableOpacity
              style={styles.forwardCircleBtn}
              onPress={() => handleSeekOffset(10)}
              activeOpacity={0.75}
            >
              <MaterialCommunityIcons name="fast-forward-10" size={24} color="#334155" />
            </TouchableOpacity>
          </View>

          {/* Event Quick List under Timeline */}
          <ScrollView style={styles.playbackEventSubList} showsVerticalScrollIndicator={false}>
            <Text style={styles.playbackEventSubTitle}>SỰ KIỆN GHI NHẬN TRONG NGÀY:</Text>
            {PLAYBACK_EVENTS.map((ev) => (
              <TouchableOpacity
                key={ev.id}
                style={[
                  styles.playbackEventChip,
                  selectedEventId === ev.id && styles.playbackEventChipActive,
                ]}
                onPress={() => handleSeekTimeline(ev.timeSec, ev.id)}
                activeOpacity={0.75}
              >
                <View style={[styles.eventDot, { backgroundColor: ev.color }]} />
                <Text style={styles.playbackEventChipTime}>{ev.timeStr}</Text>
                <Text style={styles.playbackEventChipLabel} numberOfLines={1}>{ev.label}</Text>
                <Ionicons name="play-circle" size={16} color={ev.color} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : (
        /* LIVE SECTION: EVENT MESSAGES (Ảnh 2) */
        <View style={styles.eventSection}>
          <Text style={styles.eventSectionTitle}>Event Messages</Text>

          <ScrollView
            style={styles.eventListScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {incidents.length === 0 ? (
              /* Vector SVG Empty State chuẩn theo Ảnh 2 */
              <View style={styles.emptyMessagesContainer}>
                <Svg width={200} height={160} viewBox="0 0 200 160">
                  {/* Soft Ground Shadow */}
                  <Ellipse cx="100" cy="142" rx="75" ry="10" fill="#EEF2F6" />
                  {/* Box Back */}
                  <Polygon points="88,95 138,95 148,132 78,132" fill="#E2E8F0" />
                  {/* Box Lid open */}
                  <Polygon points="68,98 88,95 81,110 61,112" fill="#CBD5E1" />
                  {/* Floating cubes background */}
                  <Polygon points="54,60 62,56 70,60 62,64" fill="#F1F5F9" />
                  <Polygon points="135,62 143,58 151,62 143,66" fill="#F1F5F9" />
                  {/* Man: Head */}
                  <Circle cx="76" cy="46" r="8" fill="#FDBA74" />
                  {/* Hair */}
                  <Path d="M68 46 C68 38 84 38 84 46 Z" fill="#0F172A" />
                  {/* Shirt */}
                  <Polygon points="73,54 79,54 78,75 74,75" fill="#FFFFFF" />
                  {/* Red Jacket */}
                  <Path d="M65 54 L73 54 L72 85 L63 85 Z" fill="#EA580C" />
                  <Path d="M79 54 L87 54 L89 85 L80 85 Z" fill="#EA580C" />
                  {/* Left Arm outstretched */}
                  <Path d="M65 56 L47 70 L51 74 L69 62 Z" fill="#EA580C" />
                  <Circle cx="46" cy="71" r="3.5" fill="#FDBA74" />
                  {/* Right Arm outstretched */}
                  <Path d="M87 56 L105 70 L101 74 L83 62 Z" fill="#EA580C" />
                  <Circle cx="106" cy="71" r="3.5" fill="#FDBA74" />
                  {/* Blue Pants */}
                  <Path d="M64 85 L74 85 L73 130 L65 130 Z" fill="#1E3A8A" />
                  <Path d="M77 85 L87 85 L85 130 L78 130 Z" fill="#1E3A8A" />
                  {/* Shoes */}
                  <Ellipse cx="68" cy="132" rx="5" ry="2.5" fill="#0F172A" />
                  <Ellipse cx="82" cy="132" rx="5" ry="2.5" fill="#0F172A" />
                  {/* Box Front */}
                  <Polygon points="78,105 148,105 143,138 73,138" fill="#EDE9FE" />
                  {/* Box Flap Front */}
                  <Polygon points="73,105 143,105 145,114 71,114" fill="#DDD6FE" />
                </Svg>
                <Text style={styles.emptyMessagesText}>
                  No messages. Event messages can only be kept for 7 days.
                </Text>
              </View>
            ) : (
              incidents.map((item) => {
                const isCritical = item.alert_level === 'CRITICAL';
                const isFall = item.alert_type === 'FALL_DETECTED';
                const timeStr = item.created_at.substring(11, 19);

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.eventItem, isFall && styles.eventItemAlert]}
                    onPress={() => {
                      if (item.video_clip_url) {
                        setSelectedIncidentForReplay(item);
                      } else {
                        Alert.alert('Chi tiết', `${item.message}\nThời gian: ${timeStr}`);
                      }
                    }}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.eventIconCircle,
                        { backgroundColor: isCritical ? '#FEE2E2' : '#FFF7ED' },
                      ]}
                    >
                      <Ionicons
                        name={
                          isFall ? 'warning' :
                            item.alert_type === 'HIGH_HEART_RATE' ? 'heart' :
                              item.alert_type === 'ACOUSTIC_DISTRESS' ? 'mic' : 'walk'
                        }
                        size={16}
                        color={isCritical ? '#EF4444' : '#F97316'}
                      />
                    </View>
                    <View style={styles.eventContent}>
                      <Text style={[styles.eventTitle, isFall && { color: '#DC2626' }]} numberOfLines={1}>
                        {item.message}
                      </Text>
                      <Text style={styles.eventTime}>{timeStr}</Text>
                    </View>
                    {item.thumbnail_url ? (
                      <View style={styles.eventThumb}>
                        <Image source={{ uri: item.thumbnail_url }} style={styles.eventThumbImg} resizeMode="cover" />
                        {item.video_clip_url && (
                          <View style={styles.eventThumbPlay}>
                            <Ionicons name="play" size={10} color="#FFF" />
                          </View>
                        )}
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      )}

      {/* ═══ FLOATING SOS 115 ═══ */}
      <TouchableOpacity style={styles.floatingSOS} onPress={handleSOS115} activeOpacity={0.85}>
        <Ionicons name="call" size={18} color="#FFF" />
        <Text style={styles.floatingSOSText}>SOS 115</Text>
      </TouchableOpacity>

      {/* ═══ MODAL: FULLSCREEN LANDSCAPE (XOAY NGANG) ═══ */}
      <Modal
        visible={isLandscapeFullscreen}
        transparent={false}
        animationType="fade"
        supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      >
        <View style={styles.landscapeRoot}>
          <View
            style={[
              styles.landscapeRotatedBox,
              isPortrait && {
                width: winH,
                height: winW,
                top: (winH - winW) / 2,
                left: (winW - winH) / 2,
                transform: [{ rotate: '90deg' }],
              },
            ]}
          >
            <UniversalVideoPlayer
              uri={activeStreamUrl}
              paused={isPaused}
              muted={isMuted}
              repeat={true}
              style={styles.landscapeStream}
              resizeMode="cover"
              fallbackPoster={FALLBACK_POSTER}
            />

            {/* Top Bar: Back / Close & Title */}
            <View style={styles.landscapeTopBar}>
              <TouchableOpacity
                style={styles.landscapeCloseBtn}
                onPress={() => setIsLandscapeFullscreen(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={26} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.landscapeTitle} numberOfLines={1}>
                {cameraDisplayName} • {currentTime} • {camera.resolution}
              </Text>
              {isRecording && (
                <View style={styles.recordingBadge}>
                  <Animated.View style={[styles.recordingDot, { opacity: recDotAnim }]} />
                  <Text style={styles.recordingText}>
                    REC {Math.floor(recordDuration / 60).toString().padStart(2, '0')}:{(recordDuration % 60).toString().padStart(2, '0')}
                  </Text>
                </View>
              )}
            </View>

            {/* Bottom Bar: Snapshot, Record, Mic, Res, Rotate Exit */}
            <View style={styles.landscapeBottomBar}>
              <TouchableOpacity style={styles.landscapeIconBtn} onPress={handleSnapshot}>
                <Ionicons name="camera-outline" size={22} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.landscapeIconBtn, isRecording && { backgroundColor: Colors.danger }]}
                onPress={handleRecordToggle}
              >
                <Ionicons name="radio-button-on" size={22} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.landscapeIconBtn, isSpeaking && { backgroundColor: Colors.danger }]}
                onPress={handleMicToggle}
              >
                <Ionicons name="mic-outline" size={22} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.landscapeIconBtn} onPress={handleResolutionSwitch}>
                <Text style={styles.landscapeHdText}>{camera.resolution}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.landscapeIconBtn}
                onPress={() => setIsLandscapeFullscreen(false)}
              >
                <MaterialCommunityIcons name="phone-rotate-landscape" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══ MODAL: CLIP REPLAY ═══ */}
      <Modal visible={Boolean(selectedIncidentForReplay)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.eventIconCircle, { width: 30, height: 30, backgroundColor: '#EF4444' }]}>
                  <Ionicons name="warning" size={16} color="#FFF" />
                </View>
                <Text style={styles.modalTitle}>Clip Sự Kiện 5 Giây</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedIncidentForReplay(null)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalPlayer}>
              <UniversalVideoPlayer
                uri={selectedIncidentForReplay?.video_clip_url || DEFAULT_MOCK_STREAM}
                style={{ width: '100%', height: 220 }}
                repeat={true}
                showControls={true}
                resizeMode="contain"
                fallbackPoster={selectedIncidentForReplay?.thumbnail_url}
              />
              <View style={styles.modalClipBadge}>
                <View style={styles.modalClipDot} />
                <Text style={styles.modalClipBadgeText}>5s BUFFER REPLAY</Text>
              </View>
            </View>
            <View style={{ padding: 16 }}>
              <Text style={styles.modalMsg}>{selectedIncidentForReplay?.message}</Text>
              <Text style={styles.modalSub}>
                Trích xuất tự động từ bộ đệm RAM Hub Orange Pi 5 → MinIO Cloud (FR08).
              </Text>
              <TouchableOpacity style={styles.modalSOSBtn} onPress={handleSOS115}>
                <Ionicons name="call" size={18} color="#FFF" />
                <Text style={styles.modalSOSText}>GỌI CẤP CỨU 115 NGAY</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══ MODAL: PTZ VIRTUAL D-PAD CONTROLLER ═══ */}
      <Modal visible={showPTZModal} transparent animationType="slide">
        <View style={styles.ptzOverlay}>
          <View style={styles.ptzCard}>
            {/* Header */}
            <View style={styles.ptzHeader}>
              <View>
                <Text style={styles.ptzTitle}>Điều Khiển Xoay Camera 360°</Text>
                <Text style={styles.ptzSub}>Imou Ranger 2C • Pan 355° / Tilt -5° ~ 80°</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPTZModal(false)} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={28} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Angle Indicators */}
            <View style={styles.ptzGaugesRow}>
              <View style={styles.ptzGaugeBadge}>
                <Ionicons name="swap-horizontal" size={14} color="#0284C7" />
                <Text style={styles.ptzGaugeLabel}>Pan (Ngang):</Text>
                <Text style={styles.ptzGaugeValue}>{panAngle}° / 355°</Text>
              </View>
              <View style={styles.ptzGaugeBadge}>
                <Ionicons name="swap-vertical" size={14} color="#0284C7" />
                <Text style={styles.ptzGaugeLabel}>Tilt (Dọc):</Text>
                <Text style={styles.ptzGaugeValue}>{tiltAngle}° / 80°</Text>
              </View>
            </View>

            {/* MQTT Command Banner */}
            <View style={styles.ptzMqttBanner}>
              <View style={styles.ptzMqttDot} />
              <Text style={styles.ptzMqttText} numberOfLines={1}>
                {ptzActionToast || `MQTT: camera/${camera.id}/ptz → {"pan": ${panAngle}, "tilt": ${tiltAngle}}`}
              </Text>
            </View>

            {/* Virtual D-Pad Controller */}
            <View style={styles.dpadContainer}>
              <View style={styles.dpadOuterCircle}>
                {/* UP */}
                <TouchableOpacity
                  style={[styles.dpadBtn, styles.dpadBtnUp]}
                  onPress={() => handlePTZMove('UP')}
                  activeOpacity={0.6}
                >
                  <Ionicons name="chevron-up" size={32} color="#FFF" />
                </TouchableOpacity>

                {/* LEFT */}
                <TouchableOpacity
                  style={[styles.dpadBtn, styles.dpadBtnLeft]}
                  onPress={() => handlePTZMove('LEFT')}
                  activeOpacity={0.6}
                >
                  <Ionicons name="chevron-back" size={32} color="#FFF" />
                </TouchableOpacity>

                {/* CENTER (HOME) */}
                <TouchableOpacity
                  style={styles.dpadCenterBtn}
                  onPress={handlePTZReset}
                  activeOpacity={0.7}
                >
                  <Ionicons name="home" size={22} color="#0284C7" />
                  <Text style={styles.dpadCenterText}>HOME</Text>
                </TouchableOpacity>

                {/* RIGHT */}
                <TouchableOpacity
                  style={[styles.dpadBtn, styles.dpadBtnRight]}
                  onPress={() => handlePTZMove('RIGHT')}
                  activeOpacity={0.6}
                >
                  <Ionicons name="chevron-forward" size={32} color="#FFF" />
                </TouchableOpacity>

                {/* DOWN */}
                <TouchableOpacity
                  style={[styles.dpadBtn, styles.dpadBtnDown]}
                  onPress={() => handlePTZMove('DOWN')}
                  activeOpacity={0.6}
                >
                  <Ionicons name="chevron-down" size={32} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Presets Quick-Jump */}
            <Text style={styles.ptzSectionTitle}>Điểm Quan Sát Quan Trọng (Presets)</Text>
            <View style={styles.presetsRow}>
              {PRESETS.map((p) => {
                const isSelected = panAngle === p.pan && tiltAngle === p.tilt;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.presetChip, isSelected && styles.presetChipActive]}
                    onPress={() => handleSelectPreset(p)}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={p.icon as any}
                      size={18}
                      color={isSelected ? Colors.primary : '#475569'}
                    />
                    <Text style={[styles.presetChipText, isSelected && styles.presetChipTextActive]}>
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Smart Tracking Quick Toggle in Panel */}
            <TouchableOpacity
              style={styles.ptzTrackingRow}
              onPress={() => setSmartTracking(!smartTracking)}
              activeOpacity={0.7}
            >
              <View style={styles.ptzTrackingLeft}>
                <Ionicons name="scan-outline" size={20} color="#0F172A" />
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.ptzTrackingTitle}>Tự động bám người (Smart Tracking)</Text>
                  <Text style={styles.ptzTrackingSub}>Tự xoay camera theo chuyển động người già</Text>
                </View>
              </View>
              <View style={[styles.toggle, smartTracking && styles.toggleOn]}>
                <View style={[styles.toggleThumb, smartTracking && styles.toggleThumbOn]} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══ MODAL: SETTINGS ═══ */}
      <Modal visible={showSettingsModal} transparent animationType="slide">
        <View style={styles.settingsOverlay}>
          <View style={[styles.settingsCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
            <View style={styles.settingsHeader}>
              <Text style={[styles.settingsTitle, isDarkMode && { color: colors.textPrimary }]}>Cài Đặt Camera</Text>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
                <Ionicons name="close-circle" size={28} color={isDarkMode ? colors.textMuted : '#94A3B8'} />
              </TouchableOpacity>
            </View>

            <View style={[styles.settingsCamInfo, isDarkMode && { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}>
              <View style={[styles.settingsCamIcon, isDarkMode && { backgroundColor: colors.card }]}>
                <Ionicons name="camera-outline" size={22} color={isDarkMode ? colors.textPrimary : '#1E293B'} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.settingsCamName, isDarkMode && { color: colors.textPrimary }]}>{camera.name}</Text>
                <Text style={[styles.settingsCamRoom, isDarkMode && { color: colors.textSecondary }]}>{camera.room} • Imou Ranger 2C</Text>
              </View>
              <View style={[styles.onlinePill, !camera.isOnline && { backgroundColor: '#FEE2E2' }]}>
                <View style={[styles.onlineDot, !camera.isOnline && { backgroundColor: '#EF4444' }]} />
                <Text style={[styles.onlineText, !camera.isOnline && { color: '#EF4444' }]}>
                  {camera.isOnline ? 'Online' : 'Offline'}
                </Text>
              </View>
            </View>

            <View style={[styles.settingsDivider, isDarkMode && { backgroundColor: colors.border }]} />

            {/* Toggle: Privacy */}
            <TouchableOpacity style={styles.settingsRow} onPress={toggleCameraSleep} activeOpacity={0.7}>
              <View style={styles.settingsRowLeft}>
                <View style={[styles.settingsIconBox, isDarkMode && { backgroundColor: colors.background }]}>
                  <Ionicons name="eye-off-outline" size={20} color={isDarkMode ? colors.textPrimary : '#1E293B'} />
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={[styles.settingsRowTitle, isDarkMode && { color: colors.textPrimary }]}>Chế Độ Riêng Tư</Text>
                  <Text style={[styles.settingsRowSub, isDarkMode && { color: colors.textSecondary }]}>Cụp ống kính, tắt luồng video</Text>
                </View>
              </View>
              <View style={[styles.toggle, camera.isSleep && styles.toggleOn]}>
                <View style={[styles.toggleThumb, camera.isSleep && styles.toggleThumbOn]} />
              </View>
            </TouchableOpacity>

            {/* Toggle: AI Protect */}
            <TouchableOpacity style={styles.settingsRow} onPress={toggleCameraAIProtect} activeOpacity={0.7}>
              <View style={styles.settingsRowLeft}>
                <View style={[styles.settingsIconBox, isDarkMode && { backgroundColor: colors.background }]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={isDarkMode ? colors.textPrimary : '#1E293B'} />
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={[styles.settingsRowTitle, isDarkMode && { color: colors.textPrimary }]}>AI Protect (YOLO-Pose)</Text>
                  <Text style={[styles.settingsRowSub, isDarkMode && { color: colors.textSecondary }]}>Nhận dạng tư thế & phát hiện té ngã</Text>
                </View>
              </View>
              <View style={[styles.toggle, camera.isAIProtect && styles.toggleOn]}>
                <View style={[styles.toggleThumb, camera.isAIProtect && styles.toggleThumbOn]} />
              </View>
            </TouchableOpacity>

            {/* Toggle: Smart Tracking (Control) */}
            <TouchableOpacity style={styles.settingsRow} onPress={() => setSmartTracking(!smartTracking)} activeOpacity={0.7}>
              <View style={styles.settingsRowLeft}>
                <View style={[styles.settingsIconBox, isDarkMode && { backgroundColor: colors.background }]}>
                  <Ionicons name="person-outline" size={20} color={isDarkMode ? colors.textPrimary : '#1E293B'} />
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={[styles.settingsRowTitle, isDarkMode && { color: colors.textPrimary }]}>Smart Tracking (Theo Dõi Đối Tượng)</Text>
                  <Text style={[styles.settingsRowSub, isDarkMode && { color: colors.textSecondary }]}>Tự động xoay PTZ 355° bám sát người</Text>
                </View>
              </View>
              <View style={[styles.toggle, smartTracking && styles.toggleOn]}>
                <View style={[styles.toggleThumb, smartTracking && styles.toggleThumbOn]} />
              </View>
            </TouchableOpacity>

            {/* Toggle: Microphone / Intercom Walkie-Talkie */}
            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => {
                setShowSettingsModal(false);
                setShowIntercomModal(true);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.settingsRowLeft}>
                <View style={styles.settingsIconBox}>
                  <MaterialCommunityIcons name="radio-handheld" size={20} color="#1E293B" />
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.settingsRowTitle}>Microphone & Đàm Thoại 2 Chiều</Text>
                  <Text style={styles.settingsRowSub}>Mở bảng Walkie-Talkie đàm thoại với phòng</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <View style={[styles.settingsDivider, isDarkMode && { backgroundColor: colors.border }]} />

            {/* Resolution */}
            <Text style={[styles.settingsLabel, isDarkMode && { color: colors.textPrimary }]}>Độ Phân Giải</Text>
            <View style={styles.resRow}>
              {(['HD', 'BASIC'] as const).map((res) => {
                const active = camera.resolution === res;
                return (
                  <TouchableOpacity
                    key={res}
                    style={[styles.resChip, active && styles.resChipActive]}
                    onPress={() => {
                      setCameraResolution(res);
                      showPtzFeedback(`Đã chuyển độ phân giải sang ${res}`);
                    }}
                  >
                    <Text style={[styles.resChipText, isDarkMode && { color: colors.textSecondary }, active && styles.resChipTextActive]}>{res}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Hardware */}
            <View style={[styles.hwBox, isDarkMode && { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}>
              <View style={[styles.hwRow, isDarkMode && { borderBottomColor: colors.border }]}>
                <Text style={[styles.hwKey, isDarkMode && { color: colors.textSecondary }]}>Bộ đệm RAM</Text>
                <Text style={[styles.hwVal, isDarkMode && { color: colors.textPrimary }]}>5 giây (FR08)</Text>
              </View>
              <View style={[styles.hwRow, isDarkMode && { borderBottomColor: colors.border }]}>
                <Text style={[styles.hwKey, isDarkMode && { color: colors.textSecondary }]}>Mã thiết bị</Text>
                <Text style={[styles.hwVal, isDarkMode && { color: colors.textPrimary }]}>{camera.id}</Text>
              </View>
              <View style={[styles.hwRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.hwKey, isDarkMode && { color: colors.textSecondary }]}>Stream URL</Text>
                <Text style={[styles.hwVal, { color: '#0284C7' }]}>{camera.streamUrl}</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
      {/* ═══ MODAL: SIREN CONFIRMATION DIALOG (CÒI HÚ KHẨN CẤP 90dB) ═══ */}
      <Modal visible={showSirenConfirmModal} transparent animationType="fade">
        <View style={styles.sirenOverlayBg}>
          <View style={styles.sirenDialogCard}>
            {/* Accent stripe */}
            <View style={styles.sirenDialogStripe} />

            {/* Header row */}
            <View style={styles.sirenDialogHeader}>
              <View style={styles.sirenDialogIconBox}>
                <MaterialCommunityIcons name="shield-alert" size={26} color="#DC2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sirenDialogTitle}>Kích Hoạt Còi Báo Động</Text>
                <View style={styles.sirenSeverityBadge}>
                  <View style={styles.sirenSeverityDot} />
                  <Text style={styles.sirenSeverityText}>MỨC ĐỘ: KHẨN CẤP • 90dB</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.sirenDialogCloseBtn}
                onPress={() => setShowSirenConfirmModal(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Device info */}
            <View style={styles.sirenDeviceRow}>
              <Ionicons name="videocam" size={16} color={Colors.primary} />
              <Text style={styles.sirenDeviceText}>
                Thiết bị: <Text style={{ fontWeight: '800', color: '#0F172A' }}>{cameraDisplayName}</Text>
              </Text>
              <View style={styles.sirenDeviceOnline}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#10B981' }}>Online</Text>
              </View>
            </View>

            {/* Warning box */}
            <View style={styles.sirenWarningBox}>
              <Ionicons name="volume-high" size={18} color="#DC2626" style={{ marginTop: 1 }} />
              <Text style={styles.sirenWarningText}>
                Loa camera sẽ phát âm thanh còi hú tần số cao với cường độ lên tới <Text style={{ fontWeight: '900', color: '#991B1B' }}>90dB</Text>. Đảm bảo người thân đã được thông báo trước.
              </Text>
            </View>

            {/* Purpose bullets */}
            <View style={styles.sirenBulletList}>
              {[
                { icon: 'alert-circle', color: '#F97316', text: 'Cảnh báo người xung quanh khi có sự cố té ngã' },
                { icon: 'shield-checkmark', color: '#10B981', text: 'Ngăn chặn xâm nhập khu vực nguy hiểm' },
                { icon: 'phone-portrait', color: '#3B82F6', text: 'Thiết bị di động đồng thời phát còi mô phỏng' },
              ].map((item, idx) => (
                <View key={idx} style={styles.sirenBulletItem}>
                  <View style={[styles.sirenBulletIcon, { backgroundColor: `${item.color}12` }]}>
                    <Ionicons name={item.icon as any} size={14} color={item.color} />
                  </View>
                  <Text style={styles.sirenBulletText}>{item.text}</Text>
                </View>
              ))}
            </View>

            {/* Action buttons */}
            <View style={styles.sirenDialogBtnRow}>
              <TouchableOpacity
                style={styles.sirenDialogCancelBtn}
                onPress={() => setShowSirenConfirmModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.sirenDialogCancelText}>Hủy Bỏ</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sirenDialogActivateBtn}
                onPress={triggerStartSiren}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="bullhorn" size={18} color="#FFF" />
                <Text style={styles.sirenDialogActivateText}>BẬT CÒI NGAY</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══ MODAL: TWO-WAY WALKIE-TALKIE INTERCOM (ĐÀM THOẠI 2 CHIỀU) ═══ */}
      <Modal visible={showIntercomModal} transparent animationType="slide">
        <View style={styles.intercomOverlay}>
          <View style={styles.intercomCard}>
            {/* Header */}
            <View style={styles.intercomHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.intercomHeaderIconBox}>
                  <MaterialCommunityIcons name="radio-handheld" size={24} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.intercomTitle}>Đàm Thoại 2 Chiều Walkie-Talkie</Text>
                  <Text style={styles.intercomSub}>
                    Loa Imou Ranger 2C • Âm lượng {speakerVolume}%
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  if (isTransmitting) {
                    setIsTransmitting(false);
                    setIsSpeaking(false);
                  }
                  setShowIntercomModal(false);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={28} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Mode Switcher Tabs */}
            <View style={styles.intercomModeTabs}>
              <TouchableOpacity
                style={[
                  styles.intercomModeTab,
                  intercomMode === 'PTT' && styles.intercomModeTabActive,
                ]}
                onPress={() => {
                  if (isTransmitting) {
                    setIsTransmitting(false);
                    setIsSpeaking(false);
                  }
                  setIntercomMode('PTT');
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="hand-left-outline"
                  size={16}
                  color={intercomMode === 'PTT' ? Colors.primary : '#64748B'}
                />
                <Text
                  style={[
                    styles.intercomModeTabText,
                    intercomMode === 'PTT' && styles.intercomModeTabTextActive,
                  ]}
                >
                  Nhấn & Giữ Nói (PTT)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.intercomModeTab,
                  intercomMode === 'HANDS_FREE' && styles.intercomModeTabActive,
                ]}
                onPress={() => {
                  if (isTransmitting) {
                    setIsTransmitting(false);
                    setIsSpeaking(false);
                  }
                  setIntercomMode('HANDS_FREE');
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="call-outline"
                  size={16}
                  color={intercomMode === 'HANDS_FREE' ? '#059669' : '#64748B'}
                />
                <Text
                  style={[
                    styles.intercomModeTabText,
                    intercomMode === 'HANDS_FREE' && { color: '#059669', fontWeight: '800' },
                  ]}
                >
                  Rảnh Tay (Gọi Liên Tục)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Waveform Visualizer & Status */}
            <View style={styles.intercomWaveformContainer}>
              <View style={styles.waveformBarsRow}>
                {waveAnims.map((anim, idx) => (
                  <Animated.View
                    key={idx}
                    style={[
                      styles.waveformBar,
                      {
                        transform: [{ scaleY: isTransmitting ? anim : 0.2 }],
                        backgroundColor: isTransmitting
                          ? intercomMode === 'PTT'
                            ? Colors.primary
                            : '#10B981'
                          : '#CBD5E1',
                      },
                    ]}
                  />
                ))}
              </View>

              <Text style={styles.intercomStatusText}>
                {isTransmitting
                  ? intercomMode === 'PTT'
                    ? '🟢 ĐANG TRUYỀN GIỌNG NÓI TỚI LOA CAMERA...'
                    : `🔴 CUỘC GỌI ĐANG MỞ (${formatSecondsToHMS(callDuration)})`
                  : intercomMode === 'PTT'
                    ? 'Chạm và GIỮ nút micro bên dưới để nói'
                    : 'Chạm nút bên dưới để bắt đầu đàm thoại 2 chiều'}
              </Text>
            </View>

            {/* Main Central Microphone Button */}
            <View style={styles.intercomMainBtnArea}>
              {intercomMode === 'PTT' ? (
                <TouchableOpacity
                  style={[
                    styles.pttLargeBtn,
                    isTransmitting && styles.pttLargeBtnActive,
                  ]}
                  onPressIn={handlePttPressIn}
                  onPressOut={handlePttPressOut}
                  activeOpacity={0.85}
                >
                  <View style={[styles.pttInnerCircle, isTransmitting && styles.pttInnerCircleActive]}>
                    <Ionicons
                      name={isTransmitting ? 'mic' : 'mic-outline'}
                      size={44}
                      color={isTransmitting ? '#FFF' : Colors.primary}
                    />
                    <Text
                      style={[
                        styles.pttBtnLabel,
                        isTransmitting && { color: '#FFF', fontWeight: '900' },
                      ]}
                    >
                      {isTransmitting ? 'ĐANG NÓI' : 'GIỮ ĐỂ NÓI'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.handsFreeLargeBtn,
                    isTransmitting && styles.handsFreeLargeBtnActive,
                  ]}
                  onPress={handleToggleHandsFree}
                  activeOpacity={0.85}
                >
                  <View
                    style={[
                      styles.handsFreeInnerCircle,
                      isTransmitting && styles.handsFreeInnerCircleActive,
                    ]}
                  >
                    <Ionicons
                      name={isTransmitting ? 'call' : 'call-outline'}
                      size={40}
                      color="#FFF"
                    />
                    <Text style={styles.handsFreeBtnLabel}>
                      {isTransmitting ? 'KẾT THÚC' : 'BẬT GỌI'}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* Camera Speaker Volume Controller */}
            <View style={styles.intercomControlCard}>
              <View style={styles.intercomCardHeader}>
                <Ionicons name="volume-medium" size={16} color="#0F172A" />
                <Text style={styles.intercomCardTitle}>Âm Lượng Loa Camera: {speakerVolume}%</Text>
              </View>
              <View style={styles.intercomVolumeChipsRow}>
                {[50, 75, 100].map((vol) => (
                  <TouchableOpacity
                    key={vol}
                    style={[
                      styles.volChip,
                      speakerVolume === vol && styles.volChipActive,
                    ]}
                    onPress={() => {
                      setSpeakerVolume(vol);
                      showPtzFeedback(`Âm lượng loa camera: ${vol}%`);
                    }}
                  >
                    <Text
                      style={[
                        styles.volChipText,
                        speakerVolume === vol && styles.volChipTextActive,
                      ]}
                    >
                      {vol === 100 ? '100% (Cực đại)' : `${vol}%`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* AI Noise Reduction Toggle */}
              <TouchableOpacity
                style={styles.intercomNoiseRow}
                onPress={() => setAiNoiseFilter(!aiNoiseFilter)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="shield-checkmark" size={18} color={aiNoiseFilter ? '#0284C7' : '#94A3B8'} />
                  <Text style={styles.intercomNoiseLabel}>Lọc ồn AI 2 chiều (AEC / Noise Suppression)</Text>
                </View>
                <View style={[styles.toggle, aiNoiseFilter && styles.toggleOn]}>
                  <View style={[styles.toggleThumb, aiNoiseFilter && styles.toggleThumbOn]} />
                </View>
              </TouchableOpacity>
            </View>

            {/* Quick Voice Messages for Elderly */}
            <View style={styles.quickVoiceSection}>
              <Text style={styles.quickVoiceTitle}>TIN NHẮN GIỌNG NÓI NHANH (PHÁT QUA LOA):</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
              >
                {QUICK_VOICE_MESSAGES.map((msg) => (
                  <TouchableOpacity
                    key={msg.id}
                    style={[
                      styles.quickVoiceChip,
                      quickMsgSent === msg.text && styles.quickVoiceChipActive,
                    ]}
                    onPress={() => handleSendQuickVoiceMsg(msg.text)}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={msg.icon as any}
                      size={14}
                      color={quickMsgSent === msg.text ? Colors.primary : '#475569'}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.quickVoiceChipText,
                        quickMsgSent === msg.text && styles.quickVoiceChipTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {msg.text}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6F8FA',
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFF',
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginLeft: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Video Player ──
  playerContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#0F172A',
    position: 'relative',
    overflow: 'hidden',
  },
  playerStream: {
    width: '100%',
    height: '100%',
  },
  playerInner: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  playerLoadingOverlay: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    gap: 8,
  },
  playerLoadingText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  streamModePill: {
    position: 'absolute',
    top: 32,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
    zIndex: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  streamModeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  streamModeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  modalClipBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.88)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 5,
    zIndex: 10,
  },
  modalClipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
  },
  modalClipBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  playbackOsdOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 5,
  },
  playbackOsdText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  liveBadgeTopLeft: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    gap: 6,
    zIndex: 5,
  },
  liveGreenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#22C55E',
  },
  liveBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  // 4-Camera Grid Mode (Ảnh 2)
  gridContainer: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#000',
  },
  gridCell: {
    width: '50%',
    height: '50%',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#334155',
  },
  gridCellActive: {
    borderWidth: 1.5,
    borderColor: '#EF4444',
  },
  gridCellImg: {
    width: '100%',
    height: '100%',
  },
  gridCellBadge: {
    position: 'absolute',
    bottom: 5,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  gridCellBadgeText: {
    color: '#FFF',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  liveKbBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
    gap: 5,
    zIndex: 5,
  },
  liveKbText: {
    color: '#FFF',
    fontSize: 9.5,
    fontWeight: '700',
  },
  videoIndicatorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    backgroundColor: '#F1F3F6',
  },
  videoIndicatorBarActive: {
    width: 32,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#EF4444',
  },
  videoIndicatorBarInactive: {
    width: 32,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
  },
  timestampOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 5,
  },
  timestampText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 11,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  cameraNameOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    zIndex: 5,
  },
  cameraNameWatermark: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
  },
  topRightHudContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 6,
    zIndex: 10,
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.92)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    gap: 5,
    ...Shadows.soft,
  },
  recordingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FFF',
  },
  recordingText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 10.5,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  shutterFlash: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: '#FFFFFF',
    zIndex: 20,
  },

  // Privacy overlay
  privacyOverlay: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(245,158,11,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  privacyTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  privacySub: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 14,
  },
  privacyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  privacyBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // ── AI HUD Overlays ──
  aiHudTopRight: {
    position: 'absolute',
    top: 8,
    right: 8,
    gap: 4,
    alignItems: 'flex-end',
    zIndex: 3,
  },
  aiHudBottomLeft: {
    position: 'absolute',
    bottom: 28,
    left: 8,
    gap: 4,
    zIndex: 3,
  },
  aiHudBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 132, 199, 0.85)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  aiHudDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 4,
  },
  aiHudText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
  },
  safeZoneBorder: {
    position: 'absolute',
    top: '15%',
    left: '10%',
    right: '10%',
    bottom: '20%',
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.5)',
    borderStyle: 'dashed',
    borderRadius: 8,
    zIndex: 2,
  },
  aiToggleBtn: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    zIndex: 4,
  },
  aiToggleText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
  },

  // ── Toolbar 1 (Under Video) ──
  toolbar1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 48,
    backgroundColor: '#F1F3F6',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  toolbarBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  basicBadge: {
    borderWidth: 1.2,
    borderColor: '#9CA3AF',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  basicBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#4B5563',
    letterSpacing: 0.5,
  },

  // ── Action Row (Pill + 4 Round Buttons) ──
  actionRowContainer: {
    backgroundColor: '#F8F9FA',
    paddingTop: 12,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F6',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  actionPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  actionPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  actionCircleBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  actionCircleBtnActive: {
    backgroundColor: Colors.primary,
  },
  actionCircleBtnRecording: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#EF4444',
  },
  actionSpeedBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F2937',
  },
  actionChevronBtn: {
    alignSelf: 'center',
    paddingVertical: 4,
    marginTop: 2,
  },

  // ── Extended Quick Actions Panel (Xổ xuống từ mũi tên) ──
  extendedActionsPanel: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  extendedDivider: {
    height: 1,
    backgroundColor: '#EDF2F7',
    marginBottom: 14,
  },
  extendedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 14,
  },
  extendedItem: {
    width: '25%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  extendedIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  extendedIconCircleActive: {
    backgroundColor: '#1E293B',
    borderColor: '#0F172A',
  },
  extendedLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginTop: 5,
    textAlign: 'center',
  },

  // ── Playback Timeline Section (Ảnh 1) ──
  playbackContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  dateBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  datePillText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  viewModeBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineRulerWrapper: {
    height: 96,
    backgroundColor: '#EFF6FF',
    position: 'relative',
    overflow: 'hidden',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  timelineRulerTrack: {
    height: '100%',
    position: 'relative',
  },
  hourColumn: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
    transform: [{ translateX: -18 }],
    zIndex: 2,
  },
  majorTick: {
    width: 1.5,
    height: 10,
    backgroundColor: '#94A3B8',
  },
  hourText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
  },
  minorTick: {
    position: 'absolute',
    top: 0,
    width: 1,
    height: 5,
    backgroundColor: '#CBD5E1',
    zIndex: 1,
  },
  recordedBand: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 34,
    backgroundColor: '#0091FF',
  },
  recordedEventMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 4,
    borderRadius: 1,
  },
  centerNeedle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    alignItems: 'center',
    zIndex: 10,
  },
  needleTopPin: {
    width: 6,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#EF4444',
  },
  needleLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#EF4444',
  },
  needleBottomPin: {
    width: 6,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#EF4444',
  },
  timelineScrubControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rewindCircleBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeDisplayPill: {
    backgroundColor: '#F1F3F6',
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeDisplayText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  forwardCircleBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playbackEventSubList: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  playbackEventSubTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  playbackEventChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  playbackEventChipActive: {
    backgroundColor: '#FFF7ED',
    borderColor: Colors.primary,
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  playbackEventChipTime: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginRight: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  playbackEventChipLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  emptyMessagesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 36,
    paddingBottom: 24,
  },
  emptyMessagesText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 18,
    lineHeight: 19,
    paddingHorizontal: 32,
    fontWeight: '500',
  },

  // Siren alert styles
  playerContainerSirenActive: {
    borderWidth: 3,
    borderColor: '#DC2626',
  },
  sirenInactiveBtn: {
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.25)',
  },
  sirenActiveBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  sirenOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    zIndex: 20,
  },
  sirenBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...Shadows.soft,
  },
  sirenBannerText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  sirenDismissBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sirenDismissBtnText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '900',
  },
  sirenActiveStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#F87171',
    borderRadius: 10,
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sirenBlinkingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
  },
  sirenActiveStripTitle: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '800',
  },
  sirenActiveStripSub: {
    color: '#B91C1C',
    fontSize: 10,
    fontWeight: '500',
  },
  sirenActiveStripStopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#DC2626',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sirenActiveStripStopText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '900',
  },
  // ── Siren Dialog (Redesigned) ──
  sirenOverlayBg: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  sirenDialogCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    overflow: 'hidden',
    maxWidth: 420,
    alignSelf: 'center',
    width: '100%',
    ...Shadows.card,
  },
  sirenDialogStripe: {
    height: 4,
    backgroundColor: '#DC2626',
  },
  sirenDialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    gap: 12,
  },
  sirenDialogIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  sirenDialogTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  sirenSeverityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  sirenSeverityDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#DC2626',
  },
  sirenSeverityText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  sirenDialogCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sirenDeviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sirenDeviceText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  sirenDeviceOnline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  sirenWarningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 14,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  sirenWarningText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#7F1D1D',
    fontWeight: '600',
  },
  sirenBulletList: {
    marginHorizontal: 20,
    marginTop: 14,
    gap: 8,
  },
  sirenBulletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sirenBulletIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sirenBulletText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    lineHeight: 17,
  },
  sirenDialogBtnRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
  },
  sirenDialogCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sirenDialogCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  sirenDialogActivateBtn: {
    flex: 1.8,
    flexDirection: 'row',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  sirenDialogActivateText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.5,
  },

  // ── Event Messages ──
  eventSection: {
    flex: 1,
    backgroundColor: '#F6F8FA',
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  eventSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  eventListScroll: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 24,
  },
  emptyStateText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    ...Shadows.soft,
  },
  eventItemAlert: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  eventIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventContent: {
    flex: 1,
    marginLeft: 10,
  },
  eventTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  eventTime: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  eventThumb: {
    width: 50,
    height: 38,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E2E8F0',
    marginLeft: 8,
  },
  eventThumbImg: {
    width: '100%',
    height: '100%',
  },
  eventThumbPlay: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Floating SOS ──
  floatingSOS: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger,
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
    ...Shadows.soft,
  },
  floatingSOSText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // ── Modal: Clip Replay ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  modalPlayer: {
    width: '100%',
    height: 220,
    backgroundColor: '#000',
    position: 'relative',
  },
  modalPlayOverlay: {
    ...(StyleSheet.absoluteFill as object),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  modalMsg: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalSub: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  modalSOSBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.danger,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  modalSOSText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },

  // ── Modal: Settings ──
  settingsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  settingsCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 34,
    paddingHorizontal: 20,
    maxHeight: '85%',
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  settingsCamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  settingsCamIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  settingsCamName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  settingsCamRoom: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 4,
  },
  onlineText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  settingsDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  settingsIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  settingsRowSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  settingsLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  resRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  resChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  resChipActive: {
    backgroundColor: '#FFF7ED',
    borderColor: Colors.primary,
  },
  resChipText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#64748B',
  },
  resChipTextActive: {
    color: Colors.primary,
  },
  hwBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hwRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  hwKey: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  hwVal: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '700',
  },
  // Toggle
  toggle: {
    width: 46,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleOn: {
    backgroundColor: '#10B981',
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },

  // ── Landscape Fullscreen (Xoay Ngang) ──
  landscapeRoot: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
    position: 'relative',
  },
  landscapeRotatedBox: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  landscapeStream: {
    width: '100%',
    height: '100%',
  },
  landscapeTopBar: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 12,
    zIndex: 10,
  },
  landscapeCloseBtn: {
    padding: 2,
  },
  landscapeTitle: {
    flex: 1,
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  landscapeBottomBar: {
    position: 'absolute',
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 16,
    zIndex: 10,
  },
  landscapeIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  landscapeHdText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 12,
  },

  // ── Modal: PTZ Virtual D-Pad Controller ──
  ptzOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  ptzCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingBottom: 34,
    paddingHorizontal: 20,
    maxHeight: '90%',
  },
  ptzHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  ptzTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  ptzSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  ptzGaugesRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  ptzGaugeBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    gap: 6,
  },
  ptzGaugeLabel: {
    fontSize: 12,
    color: '#0369A1',
    fontWeight: '600',
  },
  ptzGaugeValue: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '800',
  },
  ptzMqttBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  ptzMqttDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  ptzMqttText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
  },
  dpadContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  dpadOuterCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#0F172A',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.soft,
  },
  dpadBtn: {
    position: 'absolute',
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dpadBtnUp: {
    top: 4,
  },
  dpadBtnDown: {
    bottom: 4,
  },
  dpadBtnLeft: {
    left: 4,
  },
  dpadBtnRight: {
    right: 4,
  },
  dpadCenterBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#38BDF8',
    zIndex: 10,
  },
  dpadCenterText: {
    fontSize: 10,
    color: '#38BDF8',
    fontWeight: '900',
    marginTop: 2,
  },
  ptzSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 14,
    marginBottom: 8,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  presetChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  presetChipActive: {
    backgroundColor: '#FFF7ED',
    borderColor: Colors.primary,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
  },
  presetChipTextActive: {
    color: Colors.primary,
  },
  ptzTrackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  ptzTrackingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  ptzTrackingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  ptzTrackingSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  ptzStreamBadge: {
    position: 'absolute',
    bottom: 34,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 5,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  ptzStreamBadgeText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // ── Two-Way Walkie-Talkie Intercom Styles ──
  intercomFloatingBadge: {
    position: 'absolute',
    top: 58,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 132, 199, 0.88)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  intercomPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
    marginRight: 5,
  },
  intercomFloatingBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  intercomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  intercomCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 18,
    paddingBottom: 28,
    paddingHorizontal: 20,
    maxHeight: '90%',
    ...Shadows.card,
  },
  intercomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  intercomHeaderIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  intercomTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  intercomSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  intercomModeTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  intercomModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 9,
    gap: 6,
  },
  intercomModeTabActive: {
    backgroundColor: '#FFF',
    ...Shadows.soft,
  },
  intercomModeTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  intercomModeTabTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  intercomWaveformContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    marginBottom: 18,
  },
  waveformBarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    gap: 6,
    marginBottom: 8,
  },
  waveformBar: {
    width: 5,
    height: 32,
    borderRadius: 3,
  },
  intercomStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
  },
  intercomMainBtnArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  pttLargeBtn: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#BAE6FD',
    ...Shadows.card,
  },
  pttLargeBtnActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
    transform: [{ scale: 1.05 }],
  },
  pttInnerCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pttInnerCircleActive: {
    backgroundColor: '#0284C7',
  },
  pttBtnLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  handsFreeLargeBtn: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#A7F3D0',
    ...Shadows.card,
  },
  handsFreeLargeBtnActive: {
    backgroundColor: '#DC2626',
    borderColor: '#F87171',
  },
  handsFreeInnerCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handsFreeInnerCircleActive: {
    backgroundColor: '#DC2626',
  },
  handsFreeBtnLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFF',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  intercomControlCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  intercomCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  intercomCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  intercomVolumeChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  volChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  volChipActive: {
    backgroundColor: '#F0F9FF',
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  volChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  volChipTextActive: {
    color: Colors.primary,
    fontWeight: '900',
  },
  intercomNoiseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EDF2F7',
  },
  intercomNoiseLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  quickVoiceSection: {
    marginBottom: 4,
  },
  quickVoiceTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  quickVoiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickVoiceChipActive: {
    backgroundColor: '#F0F9FF',
    borderColor: Colors.primary,
  },
  quickVoiceChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    maxWidth: 240,
  },
  quickVoiceChipTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
});
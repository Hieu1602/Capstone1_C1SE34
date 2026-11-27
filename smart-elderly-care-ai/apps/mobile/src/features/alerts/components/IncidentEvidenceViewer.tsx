import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import type { Incident } from '../../../store/useAlertStore';

let Video: any = null;
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  (Constants as any).appOwnership === 'expo';

if (Platform.OS !== 'web' && !isExpoGo) {
  try { Video = require('react-native-video').default; } catch {}
}

interface IncidentEvidenceViewerProps {
  incident: Incident;
  viewMode: 'ai_box' | 'video';
  setViewMode: (mode: 'ai_box' | 'video') => void;
  evidenceImg: string | null;
  videoUrl: string | null;
  onImageError: () => void;
  isDarkMode: boolean;
  colors: any;
}

export const IncidentEvidenceViewer: React.FC<IncidentEvidenceViewerProps> = ({
  incident,
  viewMode,
  setViewMode,
  evidenceImg,
  videoUrl,
  onImageError,
  isDarkMode,
  colors,
}) => (
  <View style={styles.videoSection}>
    <View style={styles.evidenceHeader}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Bằng chứng hình ảnh / clip sự cố</Text>
      {incident.confidence != null && (
        <View style={styles.confidenceBadge}>
          <Ionicons name="shield-checkmark" size={13} color="#EF4444" style={{ marginRight: 4 }} />
          <Text style={styles.confidenceBadgeText}>Độ tin cậy: {(incident.confidence * 100).toFixed(0)}%</Text>
        </View>
      )}
    </View>

    <View style={[styles.tabSelector, { backgroundColor: isDarkMode ? '#1E293B' : '#E2E8F0' }]}>
      {[
        { mode: 'ai_box' as const, icon: 'scan-outline' as const, label: 'Ảnh bằng chứng AI' },
        { mode: 'video' as const, icon: 'videocam-outline' as const, label: 'Video Clip trích xuất' },
      ].map((tab) => {
        const active = viewMode === tab.mode;
        return (
          <TouchableOpacity
            key={tab.mode}
            style={[styles.tabItem, active && styles.tabItemActive]}
            onPress={() => setViewMode(tab.mode)}
            activeOpacity={0.8}
          >
            <Ionicons name={tab.icon} size={15} color={active ? '#FFF' : (isDarkMode ? '#94A3B8' : '#64748B')} style={{ marginRight: 6 }} />
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>

    {viewMode === 'ai_box' ? (
      evidenceImg ? (
        <View style={[styles.evidenceCard, { backgroundColor: '#0B0F19', borderColor: colors.border }]}>
          <Image source={{ uri: evidenceImg }} style={styles.evidenceImage} resizeMode="cover" onError={onImageError} />
          <View style={styles.evidenceOverlayHeader}>
            <View style={styles.recDot} />
            <Text style={styles.evidenceOsdText}>REC ● TRÍCH XUẤT BUFFER</Text>
            <Text style={[styles.evidenceOsdText, { marginLeft: 'auto' }]}>{incident.device_id || 'CAM-01'}</Text>
          </View>

          <View style={styles.evidenceOverlayFooter}>
            <View style={styles.aiTag}>
              <Ionicons name="scan-outline" size={13} color="#FFF" style={{ marginRight: 4 }} />
              <Text style={styles.aiTagText}>YOLO-Pose AI • Bằng chứng sự cố</Text>
            </View>
            {incident.confidence != null && (
              <Text style={styles.evidenceOsdText}>Độ tin cậy: {(incident.confidence * 100).toFixed(0)}%</Text>
            )}
          </View>
        </View>
      ) : (
        <View style={[styles.evidenceCard, styles.evidenceFallback, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: colors.border }]}>
          <Ionicons name="image-outline" size={38} color={colors.textMuted} />
          <Text style={[styles.fallbackText, { color: colors.textSecondary }]}>Không có hình ảnh bằng chứng cho sự cố này</Text>
        </View>
      )
    ) : videoUrl ? (
      <View style={[styles.evidenceCard, { backgroundColor: '#000', borderColor: colors.border }]}>
        {Platform.OS === 'web' ? (
          <video src={videoUrl} style={{ width: '100%', height: 230, borderRadius: 12, backgroundColor: '#000', objectFit: 'contain' }} controls autoPlay loop />
        ) : Video ? (
          <Video source={{ uri: videoUrl }} style={styles.video} controls resizeMode="contain" paused={false} />
        ) : (
          <WebView
            source={{
              html: `
                <!DOCTYPE html>
                <html>
                  <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                    <style>
                      * { margin: 0; padding: 0; box-sizing: border-box; }
                      body { background: #000; display: flex; align-items: center; justify-content: center; height: 100vh; overflow: hidden; }
                      video { width: 100%; height: 100%; object-fit: contain; }
                    </style>
                  </head>
                  <body>
                    <video src="${videoUrl}" controls autoplay playsinline loop></video>
                  </body>
                </html>
              `
            }}
            style={{ width: '100%', height: 230, backgroundColor: '#000', borderRadius: 12 }}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            scrollEnabled={false}
          />
        )}
        <View style={styles.videoOsdBar}>
          <View style={styles.recDot} />
          <Text style={styles.evidenceOsdText}>CLIP ĐÃ LƯU VÀO HỒ SƠ SỰ CỐ</Text>
        </View>
      </View>
    ) : (
      <View style={[styles.evidenceCard, styles.evidenceFallback, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: colors.border }]}>
        <Ionicons name="videocam-off-outline" size={38} color={colors.textMuted} />
        <Text style={[styles.fallbackText, { color: colors.textSecondary }]}>Không có video clip trích xuất cho sự cố này</Text>
      </View>
    )}
  </View>
);

const styles = StyleSheet.create({
  videoSection: { gap: 10 },
  evidenceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '600' },
  confidenceBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EF444420', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#EF4444' },
  confidenceBadgeText: { fontSize: 12, fontWeight: '700', color: '#EF4444' },
  tabSelector: { flexDirection: 'row', borderRadius: 8, padding: 3 },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 6 },
  tabItemActive: { backgroundColor: '#2563EB', shadowColor: '#2563EB', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#FFF', fontWeight: '700' },
  evidenceCard: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, position: 'relative', backgroundColor: '#0F172A' },
  evidenceFallback: { height: 180, justifyContent: 'center', alignItems: 'center' },
  fallbackText: { marginTop: 8, fontSize: 13, fontWeight: '500' },
  evidenceImage: { width: '100%', height: 230, backgroundColor: '#1E293B' },
  video: { width: '100%', height: 230, borderRadius: 12, backgroundColor: '#000' },
  videoOsdBar: { position: 'absolute', bottom: 8, left: 10, right: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  evidenceOverlayHeader: { position: 'absolute', top: 8, left: 10, right: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', marginRight: 6 },
  evidenceOsdText: { color: '#FFF', fontSize: 11, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 4 },
  evidenceOverlayFooter: { position: 'absolute', bottom: 8, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  aiTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.9)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 },
  aiTagText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
});

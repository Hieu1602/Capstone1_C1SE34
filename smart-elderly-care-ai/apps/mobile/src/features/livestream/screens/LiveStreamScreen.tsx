// LiveStreamScreen.tsx
// Xem live stream camera từ Edge Hub và gọi SOS 115

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
let WebView: any = null;
if (Platform.OS !== 'web') {
  try {
    WebView = require('react-native-webview').WebView;
  } catch (e) {}
}

const RTSP_STREAM_URL = 'http://10.0.2.2:8080';  // WebRTC signaling

export default function LiveStreamScreen() {
  const [isLive, setIsLive] = useState(false);

  const handleSOS = () => {
    Alert.alert(
      '🚨 Gọi cấp cứu 115?',
      'Hành động này sẽ quay số 115 ngay lập tức.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Gọi 115',
          style: 'destructive',
          onPress: () => Linking.openURL('tel:115'),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Camera trực tiếp</Text>
        <View style={[styles.liveDot, { backgroundColor: isLive ? '#EF4444' : '#64748B' }]} />
        <Text style={styles.liveText}>{isLive ? 'LIVE' : 'Offline'}</Text>
      </View>

      {/* Stream View */}
      <View style={styles.streamContainer}>
        {isLive ? (
          Platform.OS === 'web' || !WebView ? (
            <iframe
              src={RTSP_STREAM_URL}
              style={{ width: '100%', height: 260, border: 'none' }}
              title="Camera Stream"
            />
          ) : (
            <WebView
              source={{ uri: RTSP_STREAM_URL }}
              style={styles.webview}
              onLoad={() => setIsLive(true)}
              onError={() => setIsLive(false)}
            />
          )
        ) : (
          <View style={styles.offlinePlaceholder}>
            <Ionicons name="videocam-off" size={48} color="#475569" />
            <Text style={styles.offlineText}>Camera không kết nối</Text>
            <TouchableOpacity style={styles.connectBtn} onPress={() => setIsLive(true)}>
              <Text style={styles.connectBtnText}>Kết nối camera</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* SOS Button */}
      <TouchableOpacity style={styles.sosButton} onPress={handleSOS} activeOpacity={0.8}>
        <Ionicons name="call" size={28} color="#FFF" />
        <Text style={styles.sosText}>GỌI CẤP CỨU 115</Text>
      </TouchableOpacity>
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
  title: { flex: 1, color: '#F8FAFC', fontSize: 20, fontWeight: '700' },
  liveDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  liveText: { color: '#EF4444', fontWeight: '700', fontSize: 13 },
  streamContainer: {
    flex: 1,
    backgroundColor: '#000',
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  webview: { flex: 1 },
  offlinePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  offlineText: { color: '#64748B', fontSize: 16 },
  connectBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  connectBtnText: { color: '#FFF', fontWeight: '700' },
  sosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    gap: 12,
    elevation: 8,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  sosText: { color: '#FFF', fontWeight: '900', fontSize: 20, letterSpacing: 1 },
});

// LoginScreen.tsx – Đăng nhập
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authApi } from '../../../services/api';
import { useAuthStore } from '../../../store/useVitalStore';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail]       = useState('caregiver@elderlycare.com');
  const [password, setPassword] = useState('Caregiver@123');
  const [loading, setLoading]   = useState(false);
  const { setTokens, setUser }  = useAuthStore();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      setTokens(res.data.access_token, res.data.refresh_token);
      setUser('user-001', email, 'Nguyễn Văn Chăm Sóc');
    } catch (err) {
      // Fallback demo login nếu backend database chưa khởi động xong
      Alert.alert(
        'Đăng nhập dùng thử?',
        'Không thể kết nối máy chủ database. Bạn có muốn đăng nhập chế độ Demo để xem toàn bộ giao diện ngay không?',
        [
          { text: 'Thử lại', style: 'cancel' },
          { text: 'Vào giao diện Demo', onPress: handleDemoLogin },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setTokens('demo-access-token-jwt-example', 'demo-refresh-token');
    setUser('user-demo-001', 'caregiver@elderlycare.com', 'Bác sĩ / Người Chăm Sóc Demo');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text style={styles.logo}>🏥</Text>
        <Text style={styles.title}>Smart Elderly Care</Text>
        <Text style={styles.subtitle}>Đăng nhập để theo dõi sức khỏe</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#64748B"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Mật khẩu"
          placeholderTextColor="#64748B"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
          <Text style={styles.btnText}>{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}</Text>
        </TouchableOpacity>

        {/* Nút đăng nhập trải nghiệm nhanh */}
        <TouchableOpacity style={styles.demoBtn} onPress={handleDemoLogin}>
          <Text style={styles.demoBtnText}>⚡ Đăng nhập dùng thử nhanh (Demo)</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Register')} style={{ marginTop: 20, alignItems: 'center' }}>
          <Text style={styles.link}>Chưa có tài khoản? <Text style={{ color: '#3B82F6', fontWeight: '600' }}>Đăng ký</Text></Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F6F8FA' },
  logo:        { fontSize: 56, textAlign: 'center', marginBottom: 8 },
  title:       { color: '#0F172A', fontSize: 26, fontWeight: '900', textAlign: 'center' },
  subtitle:    { color: '#64748B', fontSize: 14, textAlign: 'center', marginBottom: 28, marginTop: 4 },
  input:       { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, color: '#0F172A', marginBottom: 12, fontSize: 15, borderWidth: 1, borderColor: '#E2E8F0' },
  btn:         { backgroundColor: '#FF7A00', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 4 },
  btnText:     { color: '#FFF', fontWeight: '800', fontSize: 16 },
  demoBtn:     { backgroundColor: '#EFF6FF', borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: '#BFDBFE' },
  demoBtnText: { color: '#2563EB', fontWeight: '700', fontSize: 14 },
  link:        { color: '#64748B', fontSize: 14 },
});

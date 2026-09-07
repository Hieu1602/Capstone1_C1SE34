// RegisterScreen.tsx – Đăng ký tài khoản
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authApi } from '../../../services/api';

export default function RegisterScreen({ navigation }: any) {
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole]         = useState<'caregiver' | 'doctor'>('caregiver');
  const [loading, setLoading]   = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) { Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ.'); return; }
    setLoading(true);
    try {
      await authApi.register({ email, full_name: name, password, role });
      Alert.alert('Thành công', 'Tài khoản đã được tạo. Vui lòng đăng nhập.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch { Alert.alert('Lỗi', 'Đăng ký thất bại. Email có thể đã được sử dụng.'); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 60 }}>
        <Text style={styles.title}>Tạo tài khoản</Text>
        <Text style={styles.sub}>Hệ thống chăm sóc người cao tuổi thông minh</Text>

        <TextInput style={styles.input} placeholder="Họ và tên" placeholderTextColor="#64748B" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#64748B" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="Mật khẩu (≥8 ký tự)" placeholderTextColor="#64748B" value={password} onChangeText={setPassword} secureTextEntry />

        {/* Role Selector */}
        <Text style={styles.roleLabel}>Vai trò</Text>
        <View style={styles.roleRow}>
          {(['caregiver', 'doctor'] as const).map((r) => (
            <TouchableOpacity key={r} style={[styles.roleBtn, role === r && styles.roleBtnActive]} onPress={() => setRole(r)}>
              <Text style={[styles.roleBtnText, role === r && { color: '#FFF' }]}>
                {r === 'caregiver' ? '👨‍👩‍👧 Người chăm sóc' : '👨‍⚕️ Bác sĩ'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
          <Text style={styles.btnText}>{loading ? 'Đang tạo...' : 'Đăng ký'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginTop: 16, alignItems: 'center' }}>
          <Text style={{ color: '#64748B', fontSize: 14 }}>Đã có tài khoản? <Text style={{ color: '#3B82F6' }}>Đăng nhập</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title:       { color: '#F8FAFC', fontSize: 28, fontWeight: '800', marginBottom: 4 },
  sub:         { color: '#94A3B8', fontSize: 14, marginBottom: 32 },
  input:       { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, color: '#F8FAFC', marginBottom: 12, fontSize: 16 },
  roleLabel:   { color: '#94A3B8', fontSize: 14, marginBottom: 8, marginTop: 4 },
  roleRow:     { flexDirection: 'row', gap: 10, marginBottom: 20 },
  roleBtn:     { flex: 1, padding: 12, backgroundColor: '#1E293B', borderRadius: 10, alignItems: 'center', borderWidth: 1.5, borderColor: '#334155' },
  roleBtnActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  roleBtnText: { color: '#94A3B8', fontWeight: '600', fontSize: 13 },
  btn:         { backgroundColor: '#3B82F6', borderRadius: 12, padding: 18, alignItems: 'center' },
  btnText:     { color: '#FFF', fontWeight: '700', fontSize: 16 },
});

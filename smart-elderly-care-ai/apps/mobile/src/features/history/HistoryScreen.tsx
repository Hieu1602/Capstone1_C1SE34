// HistoryScreen.tsx – Xem lại nhật ký y tế & lịch sử sự kiện
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Tab = 'vitals' | 'incidents';

export default function HistoryScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('vitals');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <View style={styles.header}>
        <Text style={styles.title}>Lịch sử</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['vitals', 'incidents'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'vitals' ? 'Sinh hiệu' : 'Sự kiện'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.placeholder}>
          {activeTab === 'vitals'
            ? 'Biểu đồ lịch sử sinh hiệu theo ngày/tuần/tháng'
            : 'Danh sách sự kiện đã qua theo thời gian'}
        </Text>
        <Text style={styles.placeholderSub}>
          (Sẽ được triển khai với dữ liệu thực từ API)
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  title:  { color: '#F8FAFC', fontSize: 20, fontWeight: '700' },
  tabs:   { flexDirection: 'row', padding: 16, gap: 8 },
  tab:    { flex: 1, padding: 10, borderRadius: 10, backgroundColor: '#1E293B', alignItems: 'center' },
  tabActive: { backgroundColor: '#3B82F6' },
  tabText:   { color: '#64748B', fontWeight: '600' },
  tabTextActive: { color: '#FFF' },
  placeholder:    { color: '#94A3B8', fontSize: 16, textAlign: 'center', marginTop: 60 },
  placeholderSub: { color: '#475569', fontSize: 13, textAlign: 'center', marginTop: 8 },
});

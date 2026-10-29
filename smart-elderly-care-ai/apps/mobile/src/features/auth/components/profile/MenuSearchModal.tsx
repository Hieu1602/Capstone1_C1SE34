import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SlideRightModal } from '../settings/SlideRightModal';

export interface SearchableMenuItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'health' | 'device' | 'settings' | 'support' | 'account';
  categoryLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  badge?: string;
  badgeBg?: string;
  keywords: string[];
  onPress: () => void;
}

interface MenuSearchModalProps {
  visible: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  colors: any;
  items: SearchableMenuItem[];
}

// Remove Vietnamese accents for fast fuzzy search
function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export const MenuSearchModal: React.FC<MenuSearchModalProps> = ({
  visible,
  onClose,
  isDarkMode,
  colors,
  items,
}) => {
  const [keyword, setKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'Tất cả' },
    { id: 'health', label: 'Sức khỏe & Y tế' },
    { id: 'device', label: 'Thiết bị & Nhà' },
    { id: 'settings', label: 'Cài đặt' },
    { id: 'support', label: 'Hỗ trợ' },
  ];

  const filteredItems = useMemo(() => {
    const rawSearch = keyword.trim();
    const cleanSearch = removeVietnameseTones(rawSearch);

    return items.filter((item) => {
      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }

      if (!cleanSearch) return true;

      const titleClean = removeVietnameseTones(item.title);
      const subtitleClean = removeVietnameseTones(item.subtitle);
      const categoryClean = removeVietnameseTones(item.categoryLabel);
      const keywordsMatch = item.keywords.some((k) =>
        removeVietnameseTones(k).includes(cleanSearch)
      );

      return (
        titleClean.includes(cleanSearch) ||
        subtitleClean.includes(cleanSearch) ||
        categoryClean.includes(cleanSearch) ||
        keywordsMatch
      );
    });
  }, [items, keyword, selectedCategory]);

  const handleSelectItem = (item: SearchableMenuItem) => {
    onClose();
    setTimeout(() => {
      item.onPress();
    }, 150);
  };

  const handleClear = () => {
    setKeyword('');
  };

  return (
    <SlideRightModal visible={visible} onClose={onClose} isDarkMode={isDarkMode}>
      <View
        style={[
          styles.container,
          isDarkMode && { backgroundColor: colors.background || '#0F172A' },
        ]}
      >
        {/* Header Search Bar */}
        <View
          style={[
            styles.headerRow,
            isDarkMode && {
              backgroundColor: colors.card || '#1E293B',
              borderBottomColor: colors.border || '#334155',
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.backBtn,
              isDarkMode && { backgroundColor: 'rgba(255,255,255,0.08)' },
            ]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color={isDarkMode ? '#F8FAFC' : '#1E293B'}
            />
          </TouchableOpacity>

          <View
            style={[
              styles.searchBar,
              isDarkMode && {
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderColor: '#334155',
              },
            ]}
          >
            <Ionicons
              name="search"
              size={18}
              color={isDarkMode ? '#94A3B8' : '#64748B'}
            />
            <TextInput
              style={[
                styles.searchInput,
                isDarkMode && { color: '#F8FAFC' },
              ]}
              placeholder="Tìm kiếm tính năng, cài đặt..."
              placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
              value={keyword}
              onChangeText={setKeyword}
              autoFocus
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {keyword.length > 0 && (
              <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={isDarkMode ? '#94A3B8' : '#94A3B8'}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Category Pills */}
        <View style={styles.categoryContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={categories}
            keyExtractor={(cat) => cat.id}
            contentContainerStyle={styles.categoryContent}
            renderItem={({ item: cat }) => {
              const active = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  style={[
                    styles.categoryPill,
                    active && styles.categoryPillActive,
                    isDarkMode && !active && {
                      backgroundColor: colors.card || '#1E293B',
                      borderColor: '#334155',
                    },
                    isDarkMode && active && {
                      backgroundColor: '#2563EB',
                      borderColor: '#2563EB',
                    },
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.categoryPillText,
                      active && styles.categoryPillTextActive,
                      isDarkMode && !active && { color: '#94A3B8' },
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* Results List */}
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            keyword.trim() ? (
              <Text
                style={[
                  styles.resultCount,
                  isDarkMode && { color: '#94A3B8' },
                ]}
              >
                Tìm thấy {filteredItems.length} kết quả
              </Text>
            ) : undefined
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View
                style={[
                  styles.emptyIconBox,
                  isDarkMode && { backgroundColor: 'rgba(255,255,255,0.05)' },
                ]}
              >
                <Ionicons
                  name="search-outline"
                  size={42}
                  color={isDarkMode ? '#64748B' : '#94A3B8'}
                />
              </View>
              <Text
                style={[
                  styles.emptyTitle,
                  isDarkMode && { color: '#F8FAFC' },
                ]}
              >
                Không tìm thấy tính năng
              </Text>
              <Text
                style={[
                  styles.emptySub,
                  isDarkMode && { color: '#94A3B8' },
                ]}
              >
                Không có kết quả phù hợp với "{keyword}".{'\n'}Thử tìm với từ khóa khác như "bệnh án", "thuốc", "camera", "mật khẩu".
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.itemCard,
                isDarkMode && {
                  backgroundColor: colors.card || '#1E293B',
                  borderColor: colors.border || '#334155',
                },
              ]}
              activeOpacity={0.7}
              onPress={() => handleSelectItem(item)}
            >
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: item.iconBg },
                ]}
              >
                <Ionicons name={item.icon} size={22} color={item.iconColor} />
              </View>

              <View style={styles.itemContent}>
                <View style={styles.titleRow}>
                  <Text
                    style={[
                      styles.itemTitle,
                      isDarkMode && { color: '#F8FAFC' },
                    ]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  {item.badge && (
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: item.badgeBg || '#E0F2FE' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          { color: item.iconColor },
                        ]}
                      >
                        {item.badge}
                      </Text>
                    </View>
                  )}
                </View>

                <Text
                  style={[
                    styles.itemSub,
                    isDarkMode && { color: '#94A3B8' },
                  ]}
                  numberOfLines={1}
                >
                  {item.subtitle}
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={18}
                color={isDarkMode ? '#64748B' : '#94A3B8'}
              />
            </TouchableOpacity>
          )}
        />
      </View>
    </SlideRightModal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 12 : 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 0,
  },
  categoryContainer: {
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  categoryContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryPillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 8,
  },
  resultCount: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 6,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemContent: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  itemSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});

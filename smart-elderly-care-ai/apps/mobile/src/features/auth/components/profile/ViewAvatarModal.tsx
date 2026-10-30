import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../../theme/colors';

interface ViewAvatarModalProps {
  visible: boolean;
  avatarUri: string | null;
  displayName: string;
  isDarkMode: boolean;
  onClose: () => void;
  onEditAvatar: () => void;
}

const { width } = Dimensions.get('window');
const AVATAR_SIZE = Math.min(width * 0.72, 280);

export const ViewAvatarModal: React.FC<ViewAvatarModalProps> = ({
  visible,
  avatarUri,
  displayName,
  isDarkMode,
  onClose,
  onEditAvatar,
}) => {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        {/* Container nội dung */}
        <Pressable
          style={[
            styles.card,
            isDarkMode && { backgroundColor: '#111827', borderColor: '#374151' },
          ]}
          onPress={() => {}}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.headerTitle,
                  isDarkMode && { color: '#F9FAFB' },
                ]}
              >
                Ảnh đại diện
              </Text>
              <Text
                style={[
                  styles.headerSubtitle,
                  isDarkMode && { color: '#9CA3AF' },
                ]}
              >
                Chế độ xem (Chỉ đọc)
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.closeButton,
                isDarkMode && { backgroundColor: '#1F2937' },
              ]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Ionicons
                name="close"
                size={22}
                color={isDarkMode ? '#F9FAFB' : '#4B5563'}
              />
            </TouchableOpacity>
          </View>

          {/* Vùng hiển thị Avatar lớn để xem */}
          <View style={styles.avatarPreviewContainer}>
            <View
              style={[
                styles.avatarCircleLarge,
                { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
                isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151' },
              ]}
            >
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={[
                    styles.avatarImage,
                    { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
                  ]}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.placeholderContainer}>
                  <Ionicons
                    name="person"
                    size={AVATAR_SIZE * 0.5}
                    color={isDarkMode ? '#4B5563' : '#CBD5E1'}
                  />
                  <Text style={styles.placeholderText}>Chưa có ảnh đại diện</Text>
                </View>
              )}
            </View>

            <Text
              style={[
                styles.displayNameText,
                isDarkMode && { color: '#F9FAFB' },
              ]}
            >
              {displayName}
            </Text>
          </View>

          {/* Nút hành động: Chỉ khi bấm nút này mới cho phép Chỉnh sửa */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => {
                onClose();
                onEditAvatar();
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="camera" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.editButtonText}>Chỉnh sửa ảnh đại diện</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.cancelButton,
                isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151' },
              ]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.cancelButtonText,
                  isDarkMode && { color: '#E5E7EB' },
                ]}
              >
                Đóng
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPreviewContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  avatarCircleLarge: {
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
  },
  displayNameText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    textAlign: 'center',
  },
  actionsContainer: {
    width: '100%',
    marginTop: 20,
    gap: 10,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary || '#FF6B35',
    paddingVertical: 13,
    borderRadius: 14,
    shadowColor: Colors.primary || '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cancelButtonText: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '600',
  },
});


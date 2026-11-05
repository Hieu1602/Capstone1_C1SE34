import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '../../../../theme/colors';

interface HouseJoinCodeModalProps {
  visible: boolean;
  onClose: () => void;
  onJoinSuccess: () => void;
  onJoin: (code: string) => Promise<any>;
  isDarkMode: boolean;
  colors: {
    bgCard: string;
    borderCol: string;
    textTitle: string;
    textSub: string;
  };
}

export const HouseJoinCodeModal: React.FC<HouseJoinCodeModalProps> = ({
  visible,
  onClose,
  onJoinSuccess,
  onJoin,
  isDarkMode,
  colors: { bgCard, borderCol, textTitle, textSub },
}) => {
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePaste = async () => {
    try {
      let text = '';
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        text = await navigator.clipboard.readText();
      } else {
        text = await Clipboard.getStringAsync();
      }
      if (text && text.trim()) {
        setCode(text.trim());
        setErrorMsg(null);
      }
    } catch {
      // ignore
    }
  };

  const handleJoin = async () => {
    const cleanCode = code.trim();
    if (!cleanCode) {
      setErrorMsg('Vui lòng nhập mã mời hoặc dán liên kết.');
      return;
    }
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await onJoin(cleanCode);
      setCode('');
      onClose();
      onJoinSuccess();
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        'Không tìm thấy căn nhà phù hợp với mã mời này. Vui lòng kiểm tra lại.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: bgCard, borderColor: borderCol }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="link" size={22} color="#6366F1" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: textTitle }]}>
                Tham gia căn nhà
              </Text>
              <Text style={[styles.sub, { color: textSub }]}>
                Nhập mã mời hoặc dán link tham gia
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={18} color={textSub} />
            </TouchableOpacity>
          </View>

          {/* Description */}
          <Text style={[styles.descText, { color: textSub }]}>
            Nhập mã mời dạng <Text style={{ fontWeight: '700', color: Colors.primary }}>CARE-XXXX</Text> hoặc dán toàn bộ đường link liên kết mời mà Chủ hộ đã gửi cho bạn.
          </Text>

          {/* Input Box */}
          <View
            style={[
              styles.inputBox,
              {
                backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                borderColor: errorMsg ? '#EF4444' : borderCol,
              },
            ]}
          >
            <Ionicons name="key-outline" size={20} color={textSub} />
            <TextInput
              style={[styles.input, { color: textTitle }]}
              placeholder="VD: CARE-8869 hoặc https://smartcare.vn/..."
              placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
              value={code}
              onChangeText={(t) => {
                setCode(t);
                if (errorMsg) setErrorMsg(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleJoin}
            />
            {code.length > 0 ? (
              <TouchableOpacity onPress={() => setCode('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.pasteMiniBtn} onPress={handlePaste} activeOpacity={0.7}>
                <Ionicons name="clipboard-outline" size={13} color="#6366F1" />
                <Text style={styles.pasteMiniText}>Dán</Text>
              </TouchableOpacity>
            )}
          </View>

          {errorMsg && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={14} color="#EF4444" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: borderCol }]}
              onPress={onClose}
              activeOpacity={0.7}
              disabled={isSubmitting}
            >
              <Text style={[styles.cancelBtnText, { color: textSub }]}>Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]}
              onPress={handleJoin}
              activeOpacity={0.8}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                  <Text style={styles.submitBtnText}>Tham gia ngay</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
  },
  sub: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  descText: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  pasteMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  pasteMiniText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366F1',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  submitBtn: {
    flex: 2,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});


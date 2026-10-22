import React from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Modal,
    Pressable,
    ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../../../theme/colors";

interface ProfileEditNameModalProps {
    visible: boolean;
    isDarkMode: boolean;
    draftValue: string;
    setDraftValue: (val: string) => void;
    error: string | null;
    isSaving: boolean;
    onClose: () => void;
    onSave: () => void;
}

export const ProfileEditNameModal: React.FC<ProfileEditNameModalProps> = ({
    visible,
    isDarkMode,
    draftValue,
    setDraftValue,
    error,
    isSaving,
    onClose,
    onSave,
}) => {
    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable
                style={[
                    styles.editorOverlay,
                    isDarkMode && { backgroundColor: "#0B0F19" },
                ]}
                onPress={onClose}
            >
                <Pressable
                    style={[
                        styles.editorSheet,
                        isDarkMode && { backgroundColor: "#0B0F19" },
                    ]}
                    onPress={() => {}}
                >
                    <View style={styles.editorHeader}>
                        <TouchableOpacity
                            style={[
                                styles.editorBackButton,
                                isDarkMode && {
                                    backgroundColor: "#1E293B",
                                    borderColor: "#334155",
                                },
                            ]}
                            onPress={onClose}
                            activeOpacity={0.7}
                            disabled={isSaving}
                        >
                            <Ionicons
                                name="chevron-back-outline"
                                size={24}
                                color={
                                    isDarkMode ? "#F8FAFC" : Colors.textPrimary
                                }
                            />
                        </TouchableOpacity>
                        <Text
                            style={[
                                styles.editorTitle,
                                isDarkMode && { color: "#F8FAFC" },
                            ]}
                        >
                            Chỉnh sửa tên
                        </Text>
                    </View>

                    <View
                        style={[
                            styles.editorCard,
                            isDarkMode && {
                                backgroundColor: "#1E293B",
                                borderColor: "#334155",
                            },
                        ]}
                    >
                        <View style={styles.editorFieldHeader}>
                            <View
                                style={[
                                    styles.editorFieldIconBadge,
                                    isDarkMode && {
                                        backgroundColor:
                                            "rgba(255, 122, 0, 0.16)",
                                    },
                                ]}
                            >
                                <Ionicons
                                    name="person-outline"
                                    size={20}
                                    color={Colors.primary}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={[
                                        styles.editorFieldLabel,
                                        isDarkMode && { color: "#F8FAFC" },
                                    ]}
                                >
                                    Họ và tên
                                </Text>
                            </View>
                        </View>

                        <View
                            style={[
                                styles.editorInputWrap,
                                isDarkMode && {
                                    backgroundColor: "#0F172A",
                                    borderColor: Colors.primary,
                                },
                                error ? { borderColor: Colors.danger } : null,
                            ]}
                        >
                            <TextInput
                                value={draftValue}
                                onChangeText={setDraftValue}
                                style={[
                                    styles.editorInput,
                                    isDarkMode && { color: "#F8FAFC" },
                                ]}
                                placeholder="Nhập tên mới"
                                placeholderTextColor="#94A3B8"
                                autoFocus
                                autoCapitalize="words"
                                keyboardType="default"
                                returnKeyType="done"
                                editable={!isSaving}
                                onSubmitEditing={onSave}
                            />
                            {draftValue.length > 0 && !isSaving && (
                                <TouchableOpacity
                                    onPress={() => setDraftValue("")}
                                    hitSlop={{
                                        top: 8,
                                        bottom: 8,
                                        left: 8,
                                        right: 8,
                                    }}
                                >
                                    <Ionicons
                                        name="close-circle"
                                        size={20}
                                        color={
                                            isDarkMode ? "#64748B" : "#94A3B8"
                                        }
                                    />
                                </TouchableOpacity>
                            )}
                        </View>

                        {error && (
                            <View
                                style={[
                                    styles.editorErrorBox,
                                    isDarkMode && {
                                        backgroundColor:
                                            "rgba(239, 68, 68, 0.15)",
                                        borderColor: "#7F1D1D",
                                    },
                                ]}
                            >
                                <Ionicons
                                    name="alert-circle"
                                    size={18}
                                    color={Colors.danger}
                                />
                                <Text
                                    style={[
                                        styles.editorErrorText,
                                        isDarkMode && { color: "#FCA5A5" },
                                    ]}
                                >
                                    {error}
                                </Text>
                            </View>
                        )}

                        <View style={styles.editorActions}>
                            <TouchableOpacity
                                style={[
                                    styles.editorCancel,
                                    isDarkMode && {
                                        backgroundColor: "#0F172A",
                                        borderColor: "#334155",
                                    },
                                ]}
                                onPress={onClose}
                                activeOpacity={0.8}
                                disabled={isSaving}
                            >
                                <Text
                                    style={[
                                        styles.editorCancelText,
                                        isDarkMode && { color: "#CBD5E1" },
                                    ]}
                                >
                                    Hủy
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.editorSave,
                                    isSaving && { opacity: 0.75 },
                                ]}
                                onPress={onSave}
                                activeOpacity={0.85}
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <ActivityIndicator
                                        size="small"
                                        color="#FFFFFF"
                                    />
                                ) : (
                                    <>
                                        <Ionicons
                                            name="checkmark-circle-outline"
                                            size={18}
                                            color="#FFFFFF"
                                        />
                                        <Text style={styles.editorSaveText}>
                                            Lưu
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    editorOverlay: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    editorSheet: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    editorHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 24,
    },
    editorBackButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#F1F5F9",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 14,
    },
    editorTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#0F172A",
    },
    editorCard: {
        backgroundColor: "#F8FAFC",
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    editorFieldHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginBottom: 14,
    },
    editorFieldIconBadge: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: "#FFF7ED",
        justifyContent: "center",
        alignItems: "center",
    },
    editorFieldLabel: {
        fontSize: 15,
        fontWeight: "700",
        color: "#0F172A",
    },
    editorInputWrap: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderWidth: 1.5,
        borderColor: Colors.primary,
        borderRadius: 14,
        paddingHorizontal: 14,
        height: 52,
    },
    editorInput: {
        flex: 1,
        fontSize: 15,
        color: "#0F172A",
    },
    editorErrorBox: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: "#FEF2F2",
        borderRadius: 12,
        padding: 10,
        marginTop: 10,
        borderWidth: 1,
        borderColor: "#FECACA",
    },
    editorErrorText: {
        fontSize: 13,
        color: "#EF4444",
        flex: 1,
    },
    editorActions: {
        flexDirection: "row",
        gap: 12,
        marginTop: 20,
    },
    editorCancel: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        justifyContent: "center",
        alignItems: "center",
    },
    editorCancelText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#64748B",
    },
    editorSave: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        backgroundColor: Colors.primary,
        flexDirection: "row",
        gap: 8,
        justifyContent: "center",
        alignItems: "center",
    },
    editorSaveText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#FFFFFF",
    },
});

import React, { useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    Pressable,
    Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../../../theme/colors";
import { ProfileEditNameModal } from "./ProfileEditNameModal";
import { validateFullName, sanitizeNameInput } from "../../utils/nameValidation";

interface ProfileInfoModalProps {
    visible: boolean;
    isDarkMode: boolean;
    displayName: string;
    phone: string;
    avatarUri: string | null;
    onClose: () => void;
    onAvatarPress: () => void;
    onChangePasswordPress: () => void;
    onLogoutPress: () => void;
    onSaveName: (newName: string) => Promise<boolean>;
}

export const ProfileInfoModal: React.FC<ProfileInfoModalProps> = ({
    visible,
    isDarkMode,
    displayName,
    phone,
    avatarUri,
    onClose,
    onAvatarPress,
    onChangePasswordPress,
    onLogoutPress,
    onSaveName,
}) => {
    const [isEditingName, setIsEditingName] = useState(false);
    const [draftName, setDraftName] = useState(displayName);
    const [isSavingName, setIsSavingName] = useState(false);
    const [nameError, setNameError] = useState<string | null>(null);

    const handleOpenEditName = () => {
        setDraftName(displayName);
        setNameError(null);
        setIsEditingName(true);
    };

    const handleCloseEditName = () => {
        setIsEditingName(false);
        setNameError(null);
    };

    const handleSaveName = async () => {
        const cleanName = draftName.trim();
        const validation = validateFullName(cleanName);
        if (!validation.isValid) {
            setNameError(validation.message || "Họ và tên không hợp lệ.");
            return;
        }

        setIsSavingName(true);
        setNameError(null);
        try {
            const success = await onSaveName(cleanName);
            if (success) {
                setIsEditingName(false);
            }
        } catch (error: any) {
            setNameError(error?.message || "Không thể cập nhật họ tên.");
        } finally {
            setIsSavingName(false);
        }
    };

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable
                style={[
                    styles.modalOverlay,
                    isDarkMode && { backgroundColor: "#0B0F19" },
                ]}
                onPress={onClose}
            >
                <Pressable
                    style={[
                        styles.userMenuSheet,
                        isDarkMode && { backgroundColor: "#0B0F19" },
                    ]}
                    onPress={() => {}}
                >
                    <TouchableOpacity
                        style={[
                            styles.backButton,
                            styles.userMenuBackButton,
                            isDarkMode && {
                                backgroundColor: "#1E293B",
                                borderColor: "#334155",
                                borderWidth: 1,
                                borderRadius: 18,
                            },
                        ]}
                        onPress={onClose}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name="chevron-back-outline"
                            size={24}
                            color={isDarkMode ? "#F8FAFC" : Colors.textPrimary}
                        />
                    </TouchableOpacity>

                    <View style={styles.avatarContainerLarge}>
                        <TouchableOpacity
                            style={[
                                styles.avatarCircleLarge,
                                isDarkMode && { backgroundColor: "#1E293B" },
                            ]}
                            activeOpacity={0.8}
                            onPress={onAvatarPress}
                        >
                            {avatarUri ? (
                                <Image
                                    source={{ uri: avatarUri }}
                                    style={styles.avatarImageLarge}
                                />
                            ) : (
                                <Ionicons
                                    name="person"
                                    size={42}
                                    color={isDarkMode ? "#64748B" : "#E8EEF5"}
                                />
                            )}
                        </TouchableOpacity>

                        <Text
                            style={[
                                styles.profileNameText,
                                isDarkMode && { color: "#F8FAFC" },
                            ]}
                        >
                            {displayName}
                        </Text>
                    </View>

                    <View
                        style={[
                            styles.profileInfoListCard,
                            isDarkMode && {
                                backgroundColor: "#1E293B",
                                borderColor: "#334155",
                            },
                        ]}
                    >
                        <TouchableOpacity
                            style={[
                                styles.infoRow,
                                isDarkMode && { borderBottomColor: "#334155" },
                            ]}
                            activeOpacity={0.8}
                            onPress={handleOpenEditName}
                        >
                            <View style={styles.infoLeftWrap}>
                                <Ionicons
                                    name="person-outline"
                                    size={22}
                                    color={isDarkMode ? "#94A3B8" : "#1F2937"}
                                />
                                <Text
                                    style={[
                                        styles.infoLabel,
                                        isDarkMode && { color: "#F8FAFC" },
                                    ]}
                                >
                                    Họ và tên
                                </Text>
                            </View>
                            <View style={styles.infoRightWrap}>
                                <Text
                                    style={[
                                        styles.infoValue,
                                        isDarkMode && { color: "#94A3B8" },
                                    ]}
                                >
                                    {displayName}
                                </Text>
                                <Ionicons
                                    name="chevron-forward"
                                    size={18}
                                    color="#94A3B8"
                                />
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.infoRow,
                                isDarkMode && { borderBottomColor: "#334155" },
                            ]}
                            activeOpacity={0.8}
                        >
                            <View style={styles.infoLeftWrap}>
                                <Ionicons
                                    name="call-outline"
                                    size={22}
                                    color={isDarkMode ? "#94A3B8" : "#1F2937"}
                                />
                                <Text
                                    style={[
                                        styles.infoLabel,
                                        isDarkMode && { color: "#F8FAFC" },
                                    ]}
                                >
                                    Số điện thoại
                                </Text>
                            </View>
                            <View style={styles.infoRightWrap}>
                                <Text
                                    style={[
                                        styles.infoValue,
                                        isDarkMode && { color: "#94A3B8" },
                                    ]}
                                >
                                    {phone || "Chưa cập nhật"}
                                </Text>
                                <Ionicons
                                    name="chevron-forward"
                                    size={18}
                                    color="#94A3B8"
                                />
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.infoRow, { borderBottomWidth: 0 }]}
                            activeOpacity={0.8}
                            onPress={onChangePasswordPress}
                        >
                            <View style={styles.infoLeftWrap}>
                                <Ionicons
                                    name="lock-closed-outline"
                                    size={22}
                                    color={isDarkMode ? "#94A3B8" : "#1F2937"}
                                />
                                <Text
                                    style={[
                                        styles.infoLabel,
                                        isDarkMode && { color: "#F8FAFC" },
                                    ]}
                                >
                                    Thay đổi mật khẩu
                                </Text>
                            </View>
                            <Ionicons
                                name="chevron-forward"
                                size={18}
                                color="#94A3B8"
                            />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={styles.logoutButton}
                        activeOpacity={0.9}
                        onPress={onLogoutPress}
                    >
                        <Text style={styles.logoutButtonText}>Đăng xuất</Text>
                    </TouchableOpacity>

                    {/* Modal chỉnh sửa họ tên */}
                    <ProfileEditNameModal
                        visible={isEditingName}
                        isDarkMode={isDarkMode}
                        draftValue={draftName}
                        setDraftValue={(val) => setDraftName(sanitizeNameInput(val))}
                        error={nameError}
                        isSaving={isSavingName}
                        onClose={handleCloseEditName}
                        onSave={handleSaveName}
                    />
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    userMenuSheet: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#F1F5F9",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 8,
    },
    userMenuBackButton: {
        alignSelf: "flex-start",
    },
    avatarContainerLarge: {
        alignItems: "center",
        marginVertical: 20,
    },
    avatarCircleLarge: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: "#F1F5F9",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        borderWidth: 3,
        borderColor: "#FFFFFF",
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 4,
    },
    avatarImageLarge: {
        width: "100%",
        height: "100%",
    },
    profileNameText: {
        fontSize: 20,
        fontWeight: "700",
        color: "#0F172A",
        marginTop: 14,
    },
    profileInfoListCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        marginBottom: 28,
    },
    infoRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#E2E8F0",
    },
    infoLeftWrap: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    infoLabel: {
        fontSize: 15,
        fontWeight: "600",
        color: "#1E293B",
    },
    infoRightWrap: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    infoValue: {
        fontSize: 14.5,
        color: "#64748B",
    },
    logoutButton: {
        backgroundColor: "#FEE2E2",
        borderRadius: 16,
        height: 52,
        justifyContent: "center",
        alignItems: "center",
        marginTop: "auto",
        marginBottom: 24,
    },
    logoutButtonText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#DC2626",
    },
});


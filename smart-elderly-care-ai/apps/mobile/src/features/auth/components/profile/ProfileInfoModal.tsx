import React, { useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    Pressable,
    Image,
    Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../../../theme/colors";
import { SlideRightModal } from "../settings/SlideRightModal";
import { ProfileEditNameModal } from "./ProfileEditNameModal";
import { ProfileEditPhoneModal } from "./ProfileEditPhoneModal";
import { ViewAvatarModal } from "./ViewAvatarModal";
import { validateFullName, sanitizeNameInput } from "../../utils/nameValidation";

interface ProfileInfoModalProps {
    visible: boolean;
    isDarkMode: boolean;
    displayName: string;
    phone: string;
    avatarUri: string | null;
    onClose: () => void;
    onPickFromCamera: () => void;
    onPickFromLibrary: () => void;
    onChangePasswordPress: () => void;
    onLogoutPress: () => void;
    onSaveName: (newName: string) => Promise<boolean>;
    onSavePhone: (newPhone: string, otpCode: string) => Promise<boolean>;
}

export const ProfileInfoModal: React.FC<ProfileInfoModalProps> = ({
    visible,
    isDarkMode,
    displayName,
    phone,
    avatarUri,
    onClose,
    onPickFromCamera,
    onPickFromLibrary,
    onChangePasswordPress,
    onLogoutPress,
    onSaveName,
    onSavePhone,
}) => {
    const [isAvatarPickerVisible, setIsAvatarPickerVisible] = useState(false);
    const [isViewingAvatar, setIsViewingAvatar] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [draftName, setDraftName] = useState(displayName);
    const [isSavingName, setIsSavingName] = useState(false);
    const [nameError, setNameError] = useState<string | null>(null);

    const [isEditingPhone, setIsEditingPhone] = useState(false);

    const handleOpenEditName = () => {
        setDraftName(displayName);
        setNameError(null);
        setIsEditingName(true);
    };

    const executeSaveName = async (cleanName: string) => {
        setIsSavingName(true);
        setNameError(null);
        try {
            const success = await onSaveName(cleanName);
            if (success) {
                setIsEditingName(false);
                Alert.alert("Thành công", "Đã cập nhật họ và tên thành công.");
            }
        } catch (error: any) {
            setNameError(error?.message || "Không thể cập nhật họ tên.");
        } finally {
            setIsSavingName(false);
        }
    };

    const handleSaveName = () => {
        const cleanName = draftName.trim();
        const validation = validateFullName(cleanName);
        if (!validation.isValid) {
            setNameError(validation.message || "Họ và tên không hợp lệ.");
            return;
        }

        Alert.alert(
            "Xác nhận thay đổi",
            `Bạn có chắc chắn muốn cập nhật họ và tên thành "${cleanName}" không?`,
            [
                { text: "Hủy", style: "cancel" },
                { text: "Lưu thay đổi", onPress: () => executeSaveName(cleanName) },
            ]
        );
    };

    const handleCloseEditName = () => {
        const isDirty = draftName.trim() !== (displayName || "").trim();
        if (isDirty) {
            Alert.alert(
                "Thay đổi chưa lưu",
                "Họ và tên đã được chỉnh sửa. Bạn có muốn lưu thay đổi trước khi thoát không?",
                [
                    { text: "Tiếp tục sửa", style: "cancel" },
                    {
                        text: "Không lưu",
                        style: "destructive",
                        onPress: () => {
                            setDraftName(displayName);
                            setNameError(null);
                            setIsEditingName(false);
                        },
                    },
                    {
                        text: "Lưu thay đổi",
                        onPress: () => handleSaveName(),
                    },
                ]
            );
        } else {
            setNameError(null);
            setIsEditingName(false);
        }
    };

    const handleOpenEditPhone = () => {
        setIsEditingPhone(true);
    };

    const handleCloseEditPhone = () => {
        setIsEditingPhone(false);
    };

    return (
        <SlideRightModal visible={visible} onClose={onClose} isDarkMode={isDarkMode}>
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
                        <View style={styles.avatarWrapperLarge}>
                            {/* Chạm vào vòng tròn ảnh hoặc máy ảnh để chọn ảnh / chụp ảnh */}
                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={() => setIsAvatarPickerVisible(true)}
                                style={[
                                    styles.avatarCircleLarge,
                                    isDarkMode && { backgroundColor: "#1E293B" },
                                ]}
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

                            {/* Nút icon máy ảnh */}
                            <TouchableOpacity
                                style={styles.cameraIconBadge}
                                activeOpacity={0.8}
                                onPress={() => setIsAvatarPickerVisible(true)}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                accessibilityLabel="Chỉnh sửa ảnh đại diện"
                            >
                                <Ionicons name="camera" size={14} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        {/* Nút bấm chữ Thay đổi ảnh trực quan */}
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setIsAvatarPickerVisible(true)}
                            style={{ marginTop: 8, paddingHorizontal: 12, paddingVertical: 4 }}
                        >
                            <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.primary }}>
                                Thay đổi ảnh
                            </Text>
                        </TouchableOpacity>

                        <Text
                            style={[
                                styles.profileNameText,
                                { marginTop: 4 },
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
                            onPress={handleOpenEditPhone}
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

                    {/* Modal thay đổi số điện thoại */}
                    <ProfileEditPhoneModal
                        visible={isEditingPhone}
                        isDarkMode={isDarkMode}
                        currentPhone={phone}
                        onClose={handleCloseEditPhone}
                        onSave={onSavePhone}
                    />

                    {/* Modal Xem Ảnh Đại Diện (Chỉ xem, có nút Chỉnh sửa riêng) */}
                    <ViewAvatarModal
                        visible={isViewingAvatar}
                        avatarUri={avatarUri}
                        displayName={displayName}
                        isDarkMode={isDarkMode}
                        onClose={() => setIsViewingAvatar(false)}
                        onEditAvatar={() => setIsAvatarPickerVisible(true)}
                    />

                    {/* Bottom Sheet chọn Chụp ảnh hoặc Chọn từ Thư viện */}
                    {isAvatarPickerVisible && (
                        <Pressable
                            style={styles.avatarPickerOverlay}
                            onPress={() => setIsAvatarPickerVisible(false)}
                        >
                            <Pressable
                                style={[
                                    styles.avatarPickerSheet,
                                    isDarkMode && {
                                        backgroundColor: "#1E293B",
                                        borderColor: "#334155",
                                        borderWidth: 1,
                                    },
                                ]}
                                onPress={(e) => e.stopPropagation()}
                            >
                                <View style={styles.avatarPickerHandle} />
                                <Text
                                    style={[
                                        styles.avatarPickerTitle,
                                        isDarkMode && { color: "#F8FAFC" },
                                    ]}
                                >
                                    Thay đổi ảnh đại diện
                                </Text>

                                <View style={styles.avatarPickerOptions}>
                                    <TouchableOpacity
                                        style={[
                                            styles.avatarPickerRow,
                                            isDarkMode && { borderBottomColor: "#334155" },
                                        ]}
                                        activeOpacity={0.75}
                                        onPress={() => {
                                            setIsAvatarPickerVisible(false);
                                            onPickFromCamera();
                                        }}
                                    >
                                        <Ionicons
                                            name="camera-outline"
                                            size={24}
                                            color={isDarkMode ? "#F8FAFC" : "#111827"}
                                        />
                                        <Text
                                            style={[
                                                styles.avatarPickerText,
                                                isDarkMode && { color: "#F8FAFC" },
                                            ]}
                                        >
                                            Chụp ảnh
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[
                                            styles.avatarPickerRow,
                                            styles.avatarPickerLastRow,
                                        ]}
                                        activeOpacity={0.75}
                                        onPress={() => {
                                            setIsAvatarPickerVisible(false);
                                            onPickFromLibrary();
                                        }}
                                    >
                                        <Ionicons
                                            name="images-outline"
                                            size={24}
                                            color={isDarkMode ? "#F8FAFC" : "#111827"}
                                        />
                                        <Text
                                            style={[
                                                styles.avatarPickerText,
                                                isDarkMode && { color: "#F8FAFC" },
                                            ]}
                                        >
                                            Chọn từ Thư viện
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </Pressable>
                        </Pressable>
                    )}
                </Pressable>
            </Pressable>
        </SlideRightModal>
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
    avatarWrapperLarge: {
        position: "relative",
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
    cameraIconBadge: {
        position: "absolute",
        bottom: 0,
        right: 0,
        backgroundColor: Colors.primary,
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "#FFFFFF",
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    avatarHintText: {
        fontSize: 11,
        color: "#94A3B8",
        marginTop: 4,
    },
    avatarPickerOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.55)",
        justifyContent: "flex-end",
        zIndex: 9999,
    },
    avatarPickerSheet: {
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 34,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 10,
    },
    avatarPickerHandle: {
        width: 36,
        height: 4,
        backgroundColor: "#CBD5E1",
        borderRadius: 2,
        alignSelf: "center",
        marginBottom: 14,
    },
    avatarPickerTitle: {
        fontSize: 17,
        fontWeight: "700",
        color: "#0F172A",
        marginBottom: 12,
        textAlign: "center",
    },
    avatarPickerOptions: {
        width: "100%",
    },
    avatarPickerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#E2E8F0",
    },
    avatarPickerLastRow: {
        borderBottomWidth: 0,
    },
    avatarPickerText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#1E293B",
    },
    changeAvatarLinkText: {
        fontSize: 13,
        color: Colors.primary,
        fontWeight: "700",
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


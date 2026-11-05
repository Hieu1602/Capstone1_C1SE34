// ============================================================================
// BỘ QUY TẮC XÁC THỰC HỌ VÀ TÊN (FULL NAME VALIDATION)
// - Chỉ cho phép chữ cái tiếng Việt và khoảng trắng (không cho số, ký tự đặc biệt)
// - Bắt buộc phải có cả Họ và Tên (tối thiểu 2 từ tách biệt bởi khoảng trắng)
// - Độ dài từ 4 đến 50 ký tự
// - Chặn ký tự vô nghĩa lặp lại và danh sách từ ngữ thô tục / không phù hợp
// ============================================================================

export const VIETNAMESE_NAME_REGEX = /^[\p{L}\s]+$/u;

// Danh sách từ cấm / bậy bạ / tục tĩu tiếng Việt và tiếng Anh
export const BANNED_NAME_WORDS = new Set([
    "dm",
    "dcm",
    "vcl",
    "clgt",
    "buoi",
    "cac",
    "lon",
    "lồn",
    "cặc",
    "buồi",
    "đụ",
    "địt",
    "đĩ",
    "cave",
    "ngu",
    "cho",
    "chó",
    "fuck",
    "shit",
    "bitch",
    "admin",
    "root",
    "test",
    "tester",
    "fake",
    "lua",
    "lừa",
    "khùng",
    "dien",
    "điên",
]);

/**
 * Lọc bỏ mọi ký tự không phải chữ cái và khoảng trắng ngay khi người dùng gõ.
 */
export const sanitizeNameInput = (value: string): string => {
    return value.replace(/[^\p{L}\s]/gu, "");
};

/**
 * Kiểm tra tính hợp lệ của Họ và Tên.
 * Trả về { isValid: boolean, message?: string }
 */
export const validateFullName = (
    fullName: string,
): { isValid: boolean; message?: string } => {
    const trimmed = fullName.trim().replace(/\s+/g, " ");

    if (!trimmed) {
        return {
            isValid: false,
            message: "Vui lòng nhập Họ và tên của bạn.",
        };
    }

    if (/\d/.test(trimmed)) {
        return {
            isValid: false,
            message: "Họ và tên không được chứa chữ số.",
        };
    }

    if (!VIETNAMESE_NAME_REGEX.test(trimmed)) {
        return {
            isValid: false,
            message:
                "Họ và tên chỉ được bao gồm chữ cái và khoảng trắng, không chứa ký tự đặc biệt.",
        };
    }

    if (trimmed.length < 4 || trimmed.length > 50) {
        return {
            isValid: false,
            message: "Họ và tên phải có độ dài từ 4 đến 50 ký tự.",
        };
    }

    const words = trimmed.split(" ").filter(Boolean);
    if (words.length < 2) {
        return {
            isValid: false,
            message:
                "Vui lòng nhập đầy đủ cả Họ và Tên (tối thiểu 2 từ, ví dụ: Nguyễn Văn A).",
        };
    }

    // Kiểm tra ký tự lặp vô nghĩa (ví dụ: aaaa, bbbb, zzzzz)
    for (const w of words) {
        if (/^(.)\1{2,}$/i.test(w)) {
            return {
                isValid: false,
                message:
                    "Họ và tên chứa từ lặp ký tự không hợp lệ. Vui lòng nhập tên thật của bạn.",
            };
        }
    }

    // Kiểm tra từ cấm / bậy bạ
    for (const w of words) {
        if (BANNED_NAME_WORDS.has(w.toLowerCase())) {
            return {
                isValid: false,
                message:
                    "Họ và tên chứa từ ngữ không phù hợp. Vui lòng sử dụng họ và tên thật.",
            };
        }
    }

    return { isValid: true };
};


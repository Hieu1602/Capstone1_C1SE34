/**
 * phoneValidation.ts
 * Tiện ích chuẩn hoá và kiểm tra tính hợp lệ của Số điện thoại (Việt Nam & Quốc tế)
 */

export interface PhoneValidationResult {
    isValid: boolean;
    formattedPhone?: string;
    message?: string;
}

/**
 * Chuẩn hoá số điện thoại về định dạng E.164 chuẩn (+84xxxxxxxxx).
 * Hỗ trợ triệt để các trường hợp:
 * - '0382694409' -> '+84382694409'
 * - '+84 0382694409' -> '+84382694409' (bỏ số 0 thừa sau +84)
 * - '+84382694409' -> '+84382694409'
 * - '84382694409' -> '+84382694409'
 * - 'Admin123' / 'admin' -> giữ nguyên cho tài khoản quản trị
 */
export function normalizePhone(rawPhone: string | null | undefined): string {
    if (!rawPhone || typeof rawPhone !== "string") return "";
    const trimmed = rawPhone.trim();
    if (["admin", "admin123", "root"].includes(trimmed.toLowerCase())) {
        return trimmed;
    }
    let cleaned = trimmed.replace(/[\s().-]/g, "");
    if (!cleaned) return "";

    if (cleaned.startsWith("0084")) {
        cleaned = "+84" + cleaned.slice(4);
    } else if (cleaned.startsWith("84") && cleaned.length >= 11) {
        cleaned = "+" + cleaned;
    }

    if (cleaned.startsWith("+84")) {
        let national = cleaned.slice(3);
        if (national.startsWith("0")) {
            national = national.slice(1);
        }
        return "+84" + national;
    }

    if (cleaned.startsWith("0")) {
        return "+84" + cleaned.slice(1);
    }

    if (!cleaned.startsWith("+")) {
        return "+84" + cleaned;
    }

    return cleaned;
}

export function validatePhoneNumber(rawPhone: string): PhoneValidationResult {
    const formatted = normalizePhone(rawPhone);

    if (!formatted) {
        return {
            isValid: false,
            message: "Vui lòng nhập số điện thoại.",
        };
    }

    // Tài khoản đặc biệt Admin123
    if (["admin", "admin123", "root"].includes(formatted.toLowerCase())) {
        return {
            isValid: true,
            formattedPhone: formatted,
        };
    }

    // Chỉ cho phép chữ số và dấu + ở đầu
    if (!/^\+?[0-9]{9,15}$/.test(formatted)) {
        return {
            isValid: false,
            message: "Số điện thoại chỉ được chứa các chữ số (9 - 11 chữ số).",
        };
    }

    // Kiểm tra độ dài hợp lệ của đầu số Việt Nam (+84xxxxxxxxx có 12 ký tự: +84 và 9 số)
    if (formatted.startsWith("+84")) {
        const localPart = formatted.slice(3);
        if (localPart.length !== 9 && localPart.length !== 10) {
            return {
                isValid: false,
                message: "Số điện thoại Việt Nam hợp lệ cần có 10 chữ số (VD: 0912345678).",
            };
        }
    }

    return {
        isValid: true,
        formattedPhone: formatted,
    };
}

/**
 * Che giấu một phần số điện thoại vì mục đích bảo mật/riêng tư (VD: +84905123456 -> 0905****6)
 */
export function maskPhoneNumber(rawPhone: string | null | undefined, fallback: string = "Chưa cập nhật"): string {
    if (!rawPhone || typeof rawPhone !== "string") {
        return fallback;
    }

    const trimmed = rawPhone.trim().replace(/[\s().-]/g, "");
    if (!trimmed) {
        return fallback;
    }

    // Chuẩn hóa +84 hoặc 84 về dạng 0xxx
    let clean = trimmed;
    if (clean.startsWith("+84")) {
        clean = "0" + clean.slice(3);
    } else if (clean.startsWith("84") && clean.length >= 11) {
        clean = "0" + clean.slice(2);
    }

    if (clean.length <= 5) {
        return clean;
    }

    // 4 số đầu + 4 dấu sao + số cuối (VD: 0905****6)
    const prefix = clean.slice(0, 4);
    const suffix = clean.slice(-1);
    return `${prefix}****${suffix}`;
}

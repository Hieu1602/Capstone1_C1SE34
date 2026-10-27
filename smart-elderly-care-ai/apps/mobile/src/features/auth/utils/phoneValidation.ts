/**
 * phoneValidation.ts
 * Tiện ích chuẩn hoá và kiểm tra tính hợp lệ của Số điện thoại (Việt Nam & Quốc tế)
 */

export interface PhoneValidationResult {
    isValid: boolean;
    formattedPhone?: string;
    message?: string;
}

export function validatePhoneNumber(rawPhone: string): PhoneValidationResult {
    const cleaned = (rawPhone || "").trim().replace(/[\s().-]/g, "");

    if (!cleaned) {
        return {
            isValid: false,
            message: "Vui lòng nhập số điện thoại.",
        };
    }

    // Chỉ cho phép chữ số và dấu + ở đầu
    if (!/^\+?[0-9]{9,15}$/.test(cleaned)) {
        return {
            isValid: false,
            message: "Số điện thoại chỉ được chứa các chữ số (9 - 11 chữ số).",
        };
    }

    // Chuẩn hoá định dạng quốc tế +84
    let formatted = cleaned;
    if (formatted.startsWith("0")) {
        formatted = `+84${formatted.slice(1)}`;
    } else if (!formatted.startsWith("+")) {
        formatted = `+84${formatted}`;
    }

    // Kiểm tra độ dài hợp lệ của đầu số Việt Nam (+84xxxxxxxxx thường có 12 ký tự: +84 và 9 số)
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


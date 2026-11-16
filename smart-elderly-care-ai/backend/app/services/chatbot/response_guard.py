# -*- coding: utf-8 -*-
"""
response_guard.py – Bộ phòng vệ an toàn & Phân loại phạm vi y tế cho Chatbot SECA.
Vị trí: backend/app/services/chatbot/response_guard.py

Chức năng:
1. Intent & Scope Classification: Nhận diện câu hỏi ngoài phạm vi y tế (lập trình, viết code, toán, thơ, giải trí...)
   để từ chối lịch sự, tránh việc RAG nhặt bừa cẩm nang y tế trả lời bừa bãi.
2. Leakage Protection: Ngăn chặn và loại bỏ triệt để việc rò rỉ prompt nội bộ, metadata kỹ thuật (BR-5, CLINICAL CONTEXT).
3. Markdown Normalization: Chuẩn hóa thực thể HTML, khoảng trắng thừa và ký tự escape lỗi.
"""
from __future__ import annotations

import html
import re
import unicodedata
from typing import Tuple


# Từ khóa kỹ thuật / công nghệ / chế tạo / robot / giải trí ngoài phạm vi y tế
NON_MEDICAL_KEYWORDS = [
    # Công nghệ, lập trình
    "code", "lập trình", "viết code", "viết script", "chức năng thêm mới", "tính năng mới",
    "html", "css", "javascript", "python", "fastapi", "react", "flutter", "sql", "git",
    "github", "backend", "frontend", "api", "database", "docker", "thuật toán",
    # Robot, máy móc, cơ khí, phần cứng
    "robot", "tạo robot", "chế tạo", "máy móc", "thiết bị tự động", "lắp ráp",
    "mạch điện", "vi điều khiển", "arduino", "raspberry",
    # Nghệ thuật, văn thơ, giải trí
    "làm thơ", "viết văn", "bài toán", "giải phương trình", "chơi game", "thời tiết hôm nay",
    "giá vàng", "tỷ giá", "chứng khoán", "bóng đá", "vẽ tranh", "chỉnh sửa ảnh", "photoshop"
]

# Các cụm từ tuyệt đối ngoài phạm vi y tế (kể cả khi có lẫn từ khác)
ABSOLUTE_OUT_OF_SCOPE_PHRASES = [
    "tạo robot", "chế tạo robot", "làm robot", "thiết kế robot", "tạo cho tôi robot",
    "viết code", "viết script", "lập trình phần mềm", "giải bài toán", "giải phương trình",
    "làm thơ", "viết văn", "dự báo thời tiết", "tạo game"
]

# Từ khóa y tế bắt buộc để phân biệt (nếu có từ này thì không coi là out-of-scope)
MEDICAL_KEYWORDS = [
    "sức khỏe", "bệnh", "thuốc", "đau", "nhức", "mỏi", "sốt", "tim", "huyết áp",
    "spo2", "đường huyết", "cụ", "ông", "bà", "bác sĩ", "khám", "cấp cứu", "ngã",
    "chóng mặt", "mất ngủ", "ăn kém", "tiêu hóa", "viêm", "khớp", "ngực", "khó thở"
]

# Từ vựng thông dụng tiếng Việt và tiếng Anh dùng để xác thực câu hỏi có nghĩa (ngăn chặn ký tự bậy, spam bàn phím)
COMMON_VOCABULARY = {
    # Đại từ & nhân xưng
    "tôi", "tao", "mình", "bạn", "anh", "chị", "em", "ông", "bà", "cụ", "bố", "mẹ", "ba", "má", "con", "cháu", "bác", "chú", "cô", "dì", "người", "ai",
    # Trợ từ, hư từ, liên từ & từ nghi vấn
    "là", "và", "hoặc", "hay", "nhưng", "mà", "nếu", "thì", "vì", "do", "nên", "được", "bị", "phải", "cần", "có", "không", "chưa", "chẳng", "gì", "sao", "nào", "đâu", "mấy", "bao", "nhiêu", "thế", "như", "đã", "đang", "sẽ", "rồi", "vừa", "mới", "lại", "rất", "quá", "lắm", "hơi", "khá",
    # Động từ thông dụng
    "làm", "đi", "về", "ăn", "uống", "ngủ", "nghỉ", "nằm", "ngồi", "đứng", "dậy", "xem", "cho", "hỏi", "giúp", "chăm", "sóc", "biết", "thấy", "nghe", "nhìn", "bảo", "dặn", "gọi", "đo", "kiểm", "tra",
    # Triệu chứng & bệnh lý
    "đau", "nhức", "mỏi", "sốt", "ho", "sổ", "mũi", "nghẹt", "khó", "thở", "mệt", "ngất", "xỉu", "té", "ngã", "chóng", "mặt", "choáng", "nôn", "buồn", "mửa", "tiêu", "chảy", "táo", "bón", "tiểu", "đái", "ỉa", "da", "ngứa", "dị", "ứng", "viêm", "loét", "khớp", "xương", "cơ", "tim", "mạch", "huyết", "áp", "đường", "máu", "spo2", "oxy", "nhiệt", "độ", "thuốc", "khám", "viện", "bệnh", "sĩ", "tá", "dưỡng",
    # Bộ phận cơ thể
    "đầu", "mắt", "tai", "họng", "răng", "miệng", "cổ", "vai", "gáy", "lưng", "ngực", "bụng", "hông", "tay", "chân", "gối", "ngón", "bàn",
    # Đời sống & dinh dưỡng
    "nước", "cháo", "cơm", "sữa", "canxi", "vitamin", "rau", "thịt", "cá", "muối", "chăn", "mền", "giường", "nhà", "lịch", "hẹn", "tốt", "xấu", "ổn", "nguy", "hiểm",
    # Tiếng Anh thông dụng
    "hello", "hi", "help", "please", "doctor", "hospital", "pain", "sick", "fever", "cough", "pressure", "heart", "fall", "emergency", "what", "how", "why", "can", "is", "are", "my", "he", "she", "grandpa", "grandma"
}

# Tập từ vựng bỏ dấu để nhận diện người cao tuổi gõ không dấu (unaccented Vietnamese)
_UNACCENTED_COMMON_VOCAB: set[str] = set()
for _w in COMMON_VOCABULARY:
    _clean = _w.lower().replace("đ", "d")
    _clean = "".join(c for c in unicodedata.normalize("NFD", _clean) if unicodedata.category(c) != "Mn")
    _UNACCENTED_COMMON_VOCAB.add(_clean.strip())

PROMPT_LEAK_PATTERNS = [
    r"[-=]{3,}\s*MỤC\s*\d*[:\s]*NGUYÊN TẮC BR-5[^\n]*[-=]{3,}?",
    r"[-=]{3,}\s*NGUYÊN TẮC\s*BR-5[^\n]*",
    r"\[CLINICAL CONTEXT\]",
    r"\[HỒ SƠ NGƯỜI CAO TUỔI\]",
    r"\[REAL-TIME SENSOR READINGS\]",
    r"\[DỮ LIỆU SINH HIỆU THỜI GIAN THỰC TỪ THIẾT BỊ\]",
    r"\[RETRIEVED GERIATRIC GUIDELINES\]",
    r"\[TRI THỨC TRÍCH XUẤT TỪ CẨM NANG Y KHOA LÃO KHOA\]",
    r"\[DRAFT RESPONSE FROM AI 1 TO AUDIT\]",
    r"\[BẢN THẢO CÂU TRẢ LỜI TỪ AI 1 CẦN THẨM ĐỊNH\]",
    r"MANDATORY CLINICAL PRINCIPLES",
    r"NGUYÊN TẮC HOẠT ĐỘNG BẮT BUỘC",
]

# Danh mục từ ngữ tục tĩu, chửi thề, xúc phạm (Tiếng Việt, Tiếng Anh & Teencode)
PROFANITY_PHRASES = [
    r"\bđù\s+má\b", r"\bdu\s+ma\b", r"\bá\s+đù\b", r"\ba\s+du\b", r"\bá\s+dù\b",
    r"\bđụ\s+má\b", r"\bđụ\s+mẹ\b", r"\bdu\s+me\b", r"\bđịt\s+mẹ\b", r"\bdit\s+me\b",
    r"\bmẹ\s+mày\b", r"\bcon\s+mẹ\s+mày\b", r"\bmả\s+cha\b", r"\bmẹ\s+kiếp\b",
    r"\btiên\s+sư\b", r"\bvãi\s+lồn\b", r"\bvai\s+lon\b", r"\bvãi\s+cả\s+lồn\b",
    r"\bchó\s+đẻ\b", r"\bcho\s+de\b", r"\bóc\s+chó\b", r"\boc\s+cho\b", r"\bóc\s+lợn\b",
    r"\bngu\s+như\s+bò\b", r"\bđồ\s+chó\b", r"\bthằng\s+chó\b", r"\bcon\s+chó\b",
    r"\bđồ\s+khốn\b", r"\bđồ\s+rác\b", r"\bmất\s+dạy\b", r"\bmat\s+day\b",
    r"\bvô\s+học\b", r"\bvo\s+hoc\b", r"\bsúc\s+vật\b", r"\bsuc\s+vat\b",
    r"\bcon\s+đĩ\b", r"\bcon\s+di\b", r"\bcâm\s+mồm\b", r"\bim\s+mồm\b",
    r"\bđồ\s+lưu\s+manh\b", r"\bbố\s+láo\b", r"\bláo\s+toét\b",
    r"\bson\s+of\s+a\s+bitch\b", r"\bpissed\s+off\b", r"\bmother\s*fucker\b",
]

PROFANITY_WORDS = [
    r"\b(địt|dit|d1t|đ!t|đụ|du|đéo|deo|đếch|dech|đệch)\b",
    r"\b(lồn|lon|l0n|cặc|cac|c@c|buồi|buoi)\b",
    r"\b(đm|dmm|đmm|dm|dcm|đcm|dkm|đkm|đcmm|cmm|cmn|ccmm|vcl|vkl|vl|clgt|đb)\b",
    r"\b(khốn\s+nạn|khon\s+nan)\b",
    r"\b(đĩ|điếm|thằng\s+ranh)\b",
    r"\b(fuck|fucking|fucker|fuk|fck|fvck|wtf|stfu)\b",
    r"\b(shit|bullshit|sh1t|crap)\b",
    r"\b(dick|d1ck|pussy|cunt|twat)\b",
    r"\b(asshole|a\$\$hole|arse|bollocks|wanker|tosser)\b",
    r"\b(bitch|b!tch|bastard|whore|slut)\b",
    r"\b(dumbass|jackass|douchebag)\b",
]

COMPILED_PROFANITY_PATTERNS = [
    re.compile(p, re.IGNORECASE) for p in PROFANITY_PHRASES + PROFANITY_WORDS
]


class ResponseGuard:
    """Bộ kiểm duyệt và bảo vệ phản hồi y tế."""

    @staticmethod
    def normalize_profanity_text(text: str) -> str:
        """Chuẩn hóa ký tự teencode, leetspeak, lặp âm để nhận diện từ tục tĩu."""
        t = text.lower()
        t = re.sub(r"[@]", "a", t)
        t = re.sub(r"[!1]", "i", t)
        t = re.sub(r"[0]", "o", t)
        t = re.sub(r"[\$]", "s", t)
        t = re.sub(r"[\*\.\-_/]", "", t)
        # Rút gọn ký tự lặp (ví dụ: địtttt -> địt, fuuuuck -> fuck, vlll -> vl)
        t = re.sub(r"(.)\1{2,}", r"\1", t)
        return t

    @classmethod
    def is_profane(cls, question: str) -> bool:
        """
        Nhận diện từ ngữ tục tĩu, chửi thề, lăng mạ, teencode hoặc biến thể né lọc.
        Bảo đảm không bắt nhầm thuật ngữ y khoa (ví dụ: cocktail, ung thư vú, chăm sóc).
        """
        q = question.strip()
        if not q:
            return False

        norm = cls.normalize_profanity_text(q)
        q_lower = q.lower()

        for p in COMPILED_PROFANITY_PATTERNS:
            if p.search(norm) or p.search(q_lower):
                return True

        # Kiểm tra thêm biến thể không dấu (unaccented Vietnamese)
        unacc = "".join(
            c for c in unicodedata.normalize("NFD", norm.replace("đ", "d"))
            if unicodedata.category(c) != "Mn"
        )
        for p in COMPILED_PROFANITY_PATTERNS:
            if p.search(unacc):
                return True

        return False

    @staticmethod
    def format_profane_response(language: str = "vi") -> str:
        """Phản hồi lịch sự từ chối ngôn từ thiếu chuẩn mực và yêu cầu giao tiếp lịch sự."""
        if language == "en":
            return (
                "SmartCare Healthcare Assistant does not accept profane, offensive, or inappropriate language.\n\n"
                "Please communicate politely and courteously so that I can provide the best medical guidance and elderly care support."
            )
        return (
            "Dạ, hệ thống Trợ lý Y tế SmartCare không chấp nhận ngôn từ tục tĩu, thô thiển hoặc thiếu chuẩn mực.\n\n"
            "Bạn vui lòng sử dụng ngôn từ lịch sự, văn minh để Bác sĩ Trợ lý Y tế SmartCare có thể hỗ trợ và tư vấn sức khỏe cho người thân chu đáo nhất nhé!"
        )

    @staticmethod
    def is_gibberish_or_spam(question: str, has_resolved_entities: bool = False) -> bool:
        """
        Nhận diện chuỗi ký tự vô nghĩa, gõ nhầm, spam bàn phím hoặc chuỗi không có nghĩa.
        Ví dụ: ".ưef", "12314234235324", "asdfghjk", "????", ".......", "abc xyz".
        Nếu câu đã nhận diện được thực thể y tế (tên thuốc, thiết bị) thì không coi là vô nghĩa.
        """
        if has_resolved_entities:
            return False

        q = question.strip()
        if not q or len(q) < 2:
            return True

        # 1. Dãy số thuần túy (ví dụ: "12314234235324", "9999999")
        if q.isdigit():
            return True

        # 2. Toàn bộ là ký tự đặc biệt / dấu câu (ví dụ: "???", "....", "!!!")
        if not re.search(r"[\w\d]", q, flags=re.UNICODE):
            return True

        # 3. Ký tự lặp lại liên tiếp 4 lần trở lên (ví dụ: "aaaaaaa", ".....")
        if re.match(r"^(.)\1{3,}$", q):
            return True

        # 4. Tách các từ trong câu
        words = re.findall(r"[a-zA-Z\u00C0-\u024F\u1EA0-\u1EF9]+", q.lower())
        if not words:
            # Nếu không có từ nào, kiểm tra xem có phải chỉ số huyết áp "120/80" không
            if re.match(r"^\s*\d{2,3}\s*/\s*\d{2,3}\s*$", q):
                return False
            return True

        # 5. Kiểm tra tính hợp lệ của từ ngữ (Từ vựng tiếng Việt có dấu, không dấu & y tế)
        def _is_valid_word(w: str) -> bool:
            if w in COMMON_VOCABULARY:
                return True
            w_no_acc = "".join(c for c in unicodedata.normalize("NFD", w.replace("đ", "d")) if unicodedata.category(c) != "Mn")
            return w_no_acc in _UNACCENTED_COMMON_VOCAB

        valid_words_count = sum(1 for w in words if _is_valid_word(w))

        # Với câu cực ngắn (1 đến 2 từ), bắt buộc phải có ít nhất 1 từ hợp lệ
        # Ví dụ: ".ưef" -> words=['ưef'], valid=0 -> True (gibberish)
        # "sốt" -> words=['sốt'], valid=1 -> False (hợp lệ)
        # "đau chân" -> words=['đau', 'chân'], valid=2 -> False (hợp lệ)
        if len(words) <= 2:
            return valid_words_count == 0

        # Với câu từ 3 từ trở lên: nếu tỉ lệ từ có nghĩa quá thấp (< 25%) thì coi là spam/keyboard mash
        if (valid_words_count / len(words)) < 0.25:
            return True

        return False

    @staticmethod
    def format_gibberish_response(language: str = "vi") -> str:
        """Phản hồi lịch sự yêu cầu người dùng gửi câu hỏi rõ ràng hơn."""
        if language == "en":
            return (
                "I could not understand the input or characters you provided.\n\n"
                "Please enter a clear question regarding health, symptoms, or elderly care "
                "so that SmartCare AI can assist you effectively."
            )
        return (
            "Dạ, tôi chưa hiểu rõ câu hỏi hoặc dãy ký tự bạn vừa gửi.\n\n"
            "Bạn vui lòng đặt câu hỏi rõ ràng hơn về tình trạng sức khỏe, triệu chứng bệnh lý hoặc "
            "hướng dẫn chăm sóc người cao tuổi để Bác sĩ Trợ lý Y tế SmartCare có thể hỗ trợ bạn chu đáo nhất nhé!"
        )

    @staticmethod
    def is_out_of_scope(question: str) -> bool:
        """
        Xác định xem câu hỏi của người dùng có nằm ngoài phạm vi y tế/chăm sóc lão khoa hay không.
        Ví dụ: "code chức năng thêm mới", "tạo cho tôi robot" -> True.
        """
        q = question.strip().lower()
        if not q:
            return False

        # Kiểm tra cụm từ tuyệt đối ngoài phạm vi
        if any(phrase in q for phrase in ABSOLUTE_OUT_OF_SCOPE_PHRASES):
            return True

        # Kiểm tra xem có từ khóa ngoài phạm vi không
        has_non_medical = any(kw in q for kw in NON_MEDICAL_KEYWORDS)
        if not has_non_medical:
            return False

        # Nếu có từ khóa y tế đi kèm (ví dụ: "chức năng đo nhịp tim"), coi là hợp lệ
        has_medical = any(med in q for med in MEDICAL_KEYWORDS)
        return not has_medical

    @staticmethod
    def format_out_of_scope_response(language: str = "vi") -> str:
        """Thông báo lịch sự và định hướng người dùng về phạm vi hỗ trợ y tế chuyên sâu của SECA."""
        if language == "en":
            return (
                "Hello! I am **SmartCare AI**, an assistant specialized exclusively in **Geriatric Health & Elderly Care**.\n\n"
                "Your request appears to be outside my medical scope (such as software programming, robotics creation, or general non-health topics).\n\n"
                "I am here to assist you with:\n"
                "• **Home care guidance & symptom analysis**: First aid for falls, pressure ulcer prevention, geriatric nutrition.\n"
                "• **Wearable telemetry monitoring**: Real-time heart rate, SpO₂, body temperature, and fall detection alerts.\n"
                "• **Safe medication guidance & doctor visits**: Medication safety rules and coordinating upcoming clinic appointments.\n\n"
                "Please feel free to ask any question regarding the health and well-being of your elderly loved one!"
            )

        return (
            "Dạ, xin chào bạn! Tôi là **Bác sĩ Trợ lý Y tế SmartCare AI**, chuyên gia hỗ trợ **Y tế và Chăm sóc sức khỏe người cao tuổi** trong gia đình.\n\n"
            "Yêu cầu của bạn hiện chưa thuộc phạm vi chuyên môn y tế của tôi (như lập trình phần mềm, viết mã code, chế tạo robot hoặc các lĩnh vực công nghệ ngoài sức khỏe).\n\n"
            "Tôi luôn sẵn sàng đồng hành cùng bạn để:\n"
            "• **Hướng dẫn chăm sóc & sơ cứu tại nhà**: Chăm sóc khi nhức mỏi, chóng mặt, té ngã, chế độ ăn cho bệnh mãn tính.\n"
            "• **Theo dõi sinh hiệu thông minh**: Kiểm tra nhịp tim, SpO₂, thân nhiệt và cảnh báo bất thường từ vòng đeo tay.\n"
            "• **Dùng thuốc an toàn**: Giải thích công dụng, nhắc nhở an toàn thuốc và kết nối lịch khám với bác sĩ gia đình.\n\n"
            "Bạn vui lòng đặt câu hỏi liên quan đến sức khỏe người thân để tôi hỗ trợ chu đáo nhất nhé!"
        )

    @classmethod
    def sanitize_response(cls, text: str) -> str:
        """
        Làm sạch văn bản phản hồi:
        - Unescape HTML entities (&#x67; -> g, &amp; -> &)
        - ẨN TRIỆT ĐỂ SỐ ĐIỆN THOẠI CÁ NHÂN để bảo vệ quyền riêng tư người dùng
        - Xóa bỏ triệt để các vết rò rỉ prompt / metadata hệ thống
        - Chuẩn hóa khoảng trắng và dòng trống thừa
        """
        if not text:
            return ""

        # 1. Unescape HTML
        content = html.unescape(text)

        # 2. Xóa các ký tự escape Markdown thừa không cần thiết
        content = re.sub(r"\\([*_\-#`])", r"\1", content)

        # 3. Ẩn số điện thoại cá nhân (bảo vệ quyền riêng tư người dùng và bác sĩ)
        # Giữ lại số cấp cứu 115 công cộng; ẩn số điện thoại di động/cố định từ 9-11 chữ số
        content = re.sub(
            r"(?i)(?:sđt|số điện thoại|phone|tel)[\s:]*(\+?84|0)?(?:[\s\.\-]?\d){8,11}",
            "Liên hệ qua nút 'Gọi bác sĩ' trên ứng dụng",
            content
        )
        content = re.sub(
            r"(?:\+?84|0)(?:[\s\.\-]?\d){8,11}",
            "[Đã ẩn vì bảo mật - Kết nối qua ứng dụng]",
            content
        )

        # 4. Loại bỏ các đoạn rò rỉ prompt hệ thống
        for pattern in PROMPT_LEAK_PATTERNS:
            content = re.sub(pattern, "", content, flags=re.IGNORECASE)

        # 5. Chuẩn hóa khoảng trắng
        content = re.sub(r"[ \t]+", " ", content)
        content = re.sub(r"\n{3,}", "\n\n", content)

        return content.strip()


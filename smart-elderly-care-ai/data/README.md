# Thư mục Dữ liệu Hệ thống (Datasets) – Smart Elderly Care AI

Thư mục này lưu trữ các bộ dữ liệu video, nhãn dán (labels) và dữ liệu thực nghiệm phục vụ cho việc huấn luyện, kiểm thử và đánh giá mô hình AI phát hiện té ngã trên Edge Gateway (Orange Pi 5).

> ⚠️ **Lưu ý Git:** Thư mục `data/` đã được khai báo trong `.gitignore` để tránh commit các file video dung lượng lớn (~1GB) lên GitHub repository.

---

## 1. Cấu trúc thư mục

```text
smart-elderly-care-ai/data/
├── README.md                          # Tài liệu hướng dẫn sử dụng dữ liệu
├── raw/                               # Dữ liệu video gốc (thực tế)
│   └── GMDCSA-24/                     # Bộ dữ liệu video GMDCSA-24 (Fall Detection)
│       ├── Subject 1/                 # Đối tượng 1 (Thư mục Fall, ADL và nhãn CSV)
│       ├── Subject 2/                 # Đối tượng 2
│       ├── Subject 3/                 # Đối tượng 3
│       ├── Subject 4/                 # Đối tượng 4
│       ├── README.md                  # Tài liệu tác giả bộ dữ liệu
│       └── LICENSE                    # Giấy phép bản quyền (MIT)
└── processed/                         # (Tùy chọn) Video đã cắt tỉa hoặc kết quả trích xuất tọa độ xương Pose
```

---

## 2. Thông tin bộ dữ liệu GMDCSA-24

- **Tên:** GMDCSA-24 (*A Dataset for Human Fall Detection in Videos*)
- **Tác giả:** Ekram Alam et al.
- **Công bố:** Tạp chí *Data in Brief* (2024), DOI: [10.5281/zenodo.13354453](https://doi.org/10.5281/zenodo.13354453)
- **Nguồn:** [GitHub ekramalam/GMDCSA24](https://github.com/ekramalam/GMDCSA24-A-Dataset-for-Human-Fall-Detection-in-Videos)
- **Tổng số video:** ~160 video clip chia đều giữa:
  - **Fall (Té ngã):** Ngã về phía trước, phía sau, sang bên, trượt chân...
  - **ADL (Activities of Daily Living):** Đi bộ, cúi nhặt đồ, ngồi xuống, nằm nghỉ...
- **Điều kiện ánh sáng:** Đủ sáng ban ngày và ánh sáng yếu ban đêm.

---

## 3. Ứng dụng trong đồ án C1SE.34

1. **Mô phỏng nguồn Camera (RTSP / Video Test):** Sử dụng các file video trong `raw/GMDCSA-24/Subject 1/Fall/*.mp4` để nạp vào camera driver của Edge module (`edge/src/drivers/camera_driver.py`) nhằm kiểm thử quy trình phát hiện té ngã tự động.
2. **Đánh giá độ chính xác (Precision / Recall):** Chạy kiểm thử hàng loạt để đo tỷ lệ phát hiện đúng (True Positive) và tỷ lệ báo động nhầm (False Positive) của thuật toán YOLO-Pose + Fall Heuristic.
3. **Báo cáo đồ án tốt nghiệp:** Trích dẫn làm căn cứ thực nghiệm chuẩn khoa học trong thuyết minh đồ án.

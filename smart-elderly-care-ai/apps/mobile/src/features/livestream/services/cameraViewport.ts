/** Tính khung ngang và giới hạn zoom/pan, giữ ảnh 16:9 không bị kéo méo. */
/**
 * @param width Chiều rộng vùng an toàn đã đo.
 * @param height Chiều cao vùng an toàn đã đo.
 * @param controlsVisible Có dành chỗ cho thanh thao tác bên phải hay không.
 * @returns Kích thước khung ngang, góc xoay dự phòng và vùng video vừa màn hình.
 */
export function cameraViewport(
    width: number,
    height: number,
    controlsVisible: boolean,
) {
    const rotated = height > width;
    const landscapeWidth = Math.max(width, height, 1);
    const landscapeHeight = Math.max(Math.min(width, height), 1);
    const railWidth = controlsVisible ? 72 : 0;
    // Chừa khoảng đối xứng để ảnh vẫn nằm giữa toàn màn hình như camera gốc.
    const availableWidth = Math.max(1, landscapeWidth - 2 * (railWidth + 28));
    const videoWidth = Math.min(availableWidth, (landscapeHeight * 16) / 9);
    return {
        rotated,
        width: landscapeWidth,
        height: landscapeHeight,
        left: (width - landscapeWidth) / 2,
        top: (height - landscapeHeight) / 2,
        railWidth,
        videoWidth,
        videoHeight: (videoWidth * 9) / 16,
    };
}

/** @param offset Độ kéo ảnh. @param length Cạnh khung ảnh. @param zoom Hệ số phóng. @returns Độ kéo giới hạn, không để lộ khoảng trống ngoài ảnh. */
export function clampCameraPan(offset: number, length: number, zoom: number) {
    const limit = (length * Math.max(0, zoom - 1)) / 2;
    return Math.max(-limit, Math.min(limit, offset));
}

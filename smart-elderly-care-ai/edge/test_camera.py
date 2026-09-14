# test_camera.py - Test camera connection
import sys, time
from pathlib import Path
import cv2, yaml

config_path = Path(__file__).parent / 'config' / 'config.yaml'
source = 0

if len(sys.argv) > 1:
    arg = sys.argv[1]
    source = int(arg) if arg.isdigit() else arg
elif config_path.exists():
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            cfg = yaml.safe_load(f)
            source = cfg.get('camera', {}).get('source', 0)
    except Exception:
        source = 0

print(f'[*] Dang thu ket noi camera voi source: {source}')
cap = cv2.VideoCapture(source)

if not cap.isOpened():
    print(f'[X] KHONG THE KET NOI CAMERA: {source}')
    print('    - Neu la Webcam USB/Laptop: Thu doi sang 0, 1 hoac 2.')
    print('    - Neu la IP Camera RTSP: Kiem tra dia chi IP, port 554, user/password trong mang LAN.')
    sys.exit(1)

print('[OK] Ket noi camera thanh cong! Dang chup thu 1 frame...')
time.sleep(1)
ret, frame = cap.read()

if ret and frame is not None:
    output_img = Path(__file__).parent / 'test_snapshot.jpg'
    cv2.imwrite(str(output_img), frame)
    h, w, _ = frame.shape
    print(f'[OK] Da chup thanh cong frame anh ({w} x {h}).')
    print(f'[OK] Da luu anh chup thu nghiem tai: {output_img}')
else:
    print('[X] Ket noi thanh cong nhung khong doc duoc frame du lieu.')

cap.release()
print('[*] Hoan tat kiem tra camera.')

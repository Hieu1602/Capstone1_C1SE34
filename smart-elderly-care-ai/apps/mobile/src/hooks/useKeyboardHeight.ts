// Chiều cao bàn phím hiện tại (0 khi ẩn).
// Trên Android, nội dung bên trong <Modal> không tự co lại khi bàn phím mở (softwareKeyboardLayoutMode
// chỉ áp dụng cho cửa sổ chính) -> dùng giá trị này để đẩy khung lên trên bàn phím.
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates?.height || 0));
    const hideSub = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  return height;
}

// navigationHelpers.ts
// Tiện ích chuẩn hóa điều hướng quay lại (Back) từ các màn hình con hoặc Tab

/**
 * Chuẩn hóa thao tác quay lại (Back) trên Header của các màn hình:
 * - Ưu tiên kiểm tra `route?.params?.from`: nếu trước đó vừa mở từ màn hình nguồn (VD: 'Profile')
 *   thì quay lại đúng màn hình nguồn đó thay vì nhảy về Home.
 * - Với Tab Screen (VD: Devices, Alerts), ưu tiên pop lịch sử Tab khi lịch sử khớp để tránh
 *   lưu lại vòng lặp lịch sử và xóa param `from` cũ.
 */
export function handleHeaderBack(
  navigation: any,
  route?: any,
  fallbackScreen: string = 'Home',
  isNestedMainScreen: boolean = false
) {
  const fromScreen = route?.params?.from;

  if (fromScreen) {
    navigation?.setParams?.({ from: undefined });

    const state = navigation?.getState?.();
    const history = state?.history;
    if (Array.isArray(history) && history.length >= 2) {
      const prevItem = history[history.length - 2];
      const prevRoute = state?.routes?.find((r: any) => r.key === prevItem?.key);
      if (prevRoute?.name === fromScreen) {
        navigation.goBack();
        return;
      }
    }

    if (isNestedMainScreen) {
      if (navigation?.canGoBack?.()) {
        navigation.goBack();
      } else {
        navigation?.navigate?.('Main', { screen: fromScreen });
      }
      return;
    }

    navigation?.navigate?.(fromScreen);
    return;
  }

  if (navigation?.canGoBack?.()) {
    navigation.goBack();
  } else if (isNestedMainScreen) {
    navigation?.navigate?.('Main', { screen: fallbackScreen });
  } else {
    navigation?.navigate?.(fallbackScreen);
  }
}

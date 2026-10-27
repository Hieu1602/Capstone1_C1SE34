import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Platform,
    SafeAreaView,
    KeyboardAvoidingView,
    FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { WebView } from "react-native-webview";
import { resolveAddressFromCoords } from "../screens/EmergencySOSScreen";

interface MapLocationPickerModalProps {
    visible: boolean;
    initialCoordinates?: { latitude: number; longitude: number } | null;
    initialAddress?: string;
    onClose: () => void;
    onSelectLocation: (
        address: string,
        coords: { latitude: number; longitude: number },
    ) => void;
}

interface SearchSuggestion {
    name: string;
    description: string;
    lat: number;
    lng: number;
}

const DEFAULT_COORDS = { latitude: 16.0544, longitude: 108.2022 }; // Đà Nẵng trung tâm

export const MapLocationPickerModal: React.FC<MapLocationPickerModalProps> = ({
    visible,
    initialCoordinates,
    initialAddress,
    onClose,
    onSelectLocation,
}) => {
    const [coords, setCoords] = useState<{ latitude: number; longitude: number }>(
        initialCoordinates || DEFAULT_COORDS,
    );
    const [address, setAddress] = useState<string>(initialAddress || "");
    const [isResolving, setIsResolving] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [mapReadyKey, setMapReadyKey] = useState<number>(0);

    const debounceTimerRef = useRef<any>(null);
    const searchDebounceRef = useRef<any>(null);
    const iframeRef = useRef<any>(null);
    const webViewRef = useRef<WebView | null>(null);

    // Khởi tạo tọa độ GPS khi mở modal nếu chưa có
    useEffect(() => {
        if (!visible) return;

        let isMounted = true;
        const initLocation = async () => {
            if (initialCoordinates) {
                setCoords(initialCoordinates);
                if (initialAddress) {
                    setAddress(initialAddress);
                } else {
                    resolveCurrentAddress(
                        initialCoordinates.latitude,
                        initialCoordinates.longitude,
                    );
                }
                return;
            }

            try {
                const { status } =
                    await Location.getForegroundPermissionsAsync();
                let permStatus = status;
                if (permStatus !== "granted") {
                    const req = await Location.requestForegroundPermissionsAsync();
                    permStatus = req.status;
                }
                if (permStatus === "granted") {
                    const pos = await Promise.race([
                        Location.getCurrentPositionAsync({
                            accuracy: Location.Accuracy.Balanced,
                        }),
                        new Promise<null>((r) => setTimeout(() => r(null), 3000)),
                    ]);
                    if (pos && pos.coords && isMounted) {
                        const newCoords = {
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude,
                        };
                        setCoords(newCoords);
                        resolveCurrentAddress(
                            newCoords.latitude,
                            newCoords.longitude,
                        );
                        setMapReadyKey((prev) => prev + 1);
                        return;
                    }
                }
            } catch (err) {
                console.warn("[MapPicker] Could not fetch GPS:", err);
            }

            // Fallback default
            if (isMounted) {
                setCoords(DEFAULT_COORDS);
                resolveCurrentAddress(
                    DEFAULT_COORDS.latitude,
                    DEFAULT_COORDS.longitude,
                );
            }
        };

        void initLocation();

        return () => {
            isMounted = false;
        };
    }, [visible, initialCoordinates]);

    // Dịch ngược tọa độ sang địa chỉ có debounce
    const resolveCurrentAddress = useCallback(
        (lat: number, lng: number) => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }

            setIsResolving(true);
            debounceTimerRef.current = setTimeout(async () => {
                try {
                    const resolved = await resolveAddressFromCoords(lat, lng);
                    setAddress(
                        resolved || `Tọa độ: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
                    );
                } catch {
                    setAddress(`Tọa độ: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
                } finally {
                    setIsResolving(false);
                }
            }, 350);
        },
        [],
    );

    // Lắng nghe message từ bản đồ Web (iframe postMessage)
    useEffect(() => {
        if (Platform.OS !== "web" || !visible) return undefined;

        const handleWebMessage = (event: MessageEvent) => {
            try {
                const data =
                    typeof event.data === "string"
                        ? JSON.parse(event.data)
                        : event.data;
                if (data && data.type === "PIN_MOVED") {
                    const newLat = Number(data.lat);
                    const newLng = Number(data.lng);
                    if (!isNaN(newLat) && !isNaN(newLng)) {
                        setCoords({ latitude: newLat, longitude: newLng });
                        resolveCurrentAddress(newLat, newLng);
                    }
                }
            } catch (_) {}
        };

        window.addEventListener("message", handleWebMessage);
        return () => {
            window.removeEventListener("message", handleWebMessage);
        };
    }, [visible, resolveCurrentAddress]);

    // Lắng nghe message từ Native WebView
    const handleNativeMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data && data.type === "PIN_MOVED") {
                const newLat = Number(data.lat);
                const newLng = Number(data.lng);
                if (!isNaN(newLat) && !isNaN(newLng)) {
                    setCoords({ latitude: newLat, longitude: newLng });
                    resolveCurrentAddress(newLat, newLng);
                }
            }
        } catch (_) {}
    };

    // Tìm kiếm địa điểm bằng Photon Komoot
    const handleSearchChange = (text: string) => {
        setSearchQuery(text);
        if (searchDebounceRef.current) {
            clearTimeout(searchDebounceRef.current);
        }

        if (!text.trim() || text.trim().length < 2) {
            setSuggestions([]);
            return;
        }

        setIsSearching(true);
        searchDebounceRef.current = setTimeout(async () => {
            try {
                const res = await fetch(
                    `https://photon.komoot.io/api/?q=${encodeURIComponent(text.trim())}&limit=5&lang=vi`,
                );
                if (res.ok) {
                    const data = await res.json();
                    const items: SearchSuggestion[] = (data.features || [])
                        .map((f: any) => {
                            const p = f.properties || {};
                            const lat = f.geometry?.coordinates?.[1];
                            const lng = f.geometry?.coordinates?.[0];
                            const name = p.name || p.street || text;
                            const desc = [
                                p.housenumber ? `Số ${p.housenumber}` : "",
                                p.street,
                                p.district || p.locality,
                                p.city,
                                p.country,
                            ]
                                .filter(Boolean)
                                .join(", ");
                            return { name, description: desc, lat, lng };
                        })
                        .filter((item: any) => item.lat && item.lng);
                    setSuggestions(items);
                }
            } catch (e) {
                console.warn("[MapPicker] Search error:", e);
            } finally {
                setIsSearching(false);
            }
        }, 300);
    };

    // Chọn địa điểm từ gợi ý tìm kiếm
    const handleSelectSuggestion = (item: SearchSuggestion) => {
        setSearchQuery("");
        setSuggestions([]);
        const target = { latitude: item.lat, longitude: item.lng };
        setCoords(target);
        setAddress(item.description || item.name);

        // Gửi lệnh pan đến bản đồ
        const command = JSON.stringify({
            type: "PAN_TO",
            lat: item.lat,
            lng: item.lng,
        });

        if (Platform.OS === "web" && iframeRef.current) {
            iframeRef.current.contentWindow?.postMessage(command, "*");
        } else if (webViewRef.current) {
            webViewRef.current.postMessage(command);
        }
    };

    // Nhấn nút GPS quay về vị trí hiện tại của thiết bị
    const handleCurrentGPS = async () => {
        try {
            setIsResolving(true);
            const pos = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });
            if (pos && pos.coords) {
                const target = {
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                };
                setCoords(target);
                resolveCurrentAddress(target.latitude, target.longitude);

                const command = JSON.stringify({
                    type: "PAN_TO",
                    lat: target.latitude,
                    lng: target.longitude,
                });

                if (Platform.OS === "web" && iframeRef.current) {
                    iframeRef.current.contentWindow?.postMessage(command, "*");
                } else if (webViewRef.current) {
                    webViewRef.current.postMessage(command);
                }
            }
        } catch (e) {
            console.warn("[MapPicker] Current GPS error:", e);
        } finally {
            setIsResolving(false);
        }
    };

    // Xác nhận chọn vị trí này
    const handleConfirm = () => {
        const finalAddress =
            address ||
            `Tọa độ: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
        onSelectLocation(finalAddress, coords);
        onClose();
    };

    // HTML nhúng Leaflet Interactive Map
    const leafletHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; font-family: -apple-system, sans-serif; }
    .custom-pin {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var currentLat = ${coords.latitude};
    var currentLng = ${coords.longitude};

    var map = L.map('map', { zoomControl: false }).setView([currentLat, currentLng], 16);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    // Tạo icon ghim đỏ tùy chỉnh
    var redIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    var marker = L.marker([currentLat, currentLng], { draggable: true, icon: redIcon }).addTo(map);

    function notifyParent(lat, lng) {
      var payload = JSON.stringify({ type: 'PIN_MOVED', lat: lat, lng: lng });
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(payload);
      }
      if (window.parent && window.parent.postMessage) {
        window.parent.postMessage(payload, '*');
      }
    }

    marker.on('dragend', function(e) {
      var pos = e.target.getLatLng();
      notifyParent(pos.lat, pos.lng);
    });

    map.on('click', function(e) {
      marker.setLatLng(e.latlng);
      notifyParent(e.latlng.lat, e.latlng.lng);
    });

    window.addEventListener('message', function(event) {
      try {
        var msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (msg && msg.type === 'PAN_TO') {
          map.setView([msg.lat, msg.lng], 16, { animate: true });
          marker.setLatLng([msg.lat, msg.lng]);
        }
      } catch (e) {}
    });
  </script>
</body>
</html>`;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={onClose}
        >
            <SafeAreaView style={styles.container}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    style={styles.container}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={onClose}
                            accessibilityRole="button"
                            accessibilityLabel="Quay lại"
                        >
                            <Ionicons name="arrow-back" size={24} color="#0F172A" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>
                            Chọn vị trí trên bản đồ
                        </Text>
                        <TouchableOpacity
                            style={styles.gpsButton}
                            onPress={handleCurrentGPS}
                            accessibilityRole="button"
                            accessibilityLabel="Vị trí hiện tại của tôi"
                        >
                            <Ionicons
                                name="locate-outline"
                                size={22}
                                color="#FF7A00"
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Thanh tìm kiếm địa điểm */}
                    <View style={styles.searchContainer}>
                        <View style={styles.searchBar}>
                            <Ionicons
                                name="search-outline"
                                size={18}
                                color="#64748B"
                                style={styles.searchIcon}
                            />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Tìm kiếm địa chỉ, bệnh viện, tên đường..."
                                placeholderTextColor="#94A3B8"
                                value={searchQuery}
                                onChangeText={handleSearchChange}
                                returnKeyType="search"
                            />
                            {isSearching ? (
                                <ActivityIndicator
                                    size="small"
                                    color="#FF7A00"
                                    style={{ marginRight: 6 }}
                                />
                            ) : searchQuery.length > 0 ? (
                                <TouchableOpacity
                                    onPress={() => {
                                        setSearchQuery("");
                                        setSuggestions([]);
                                    }}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Ionicons
                                        name="close-circle"
                                        size={18}
                                        color="#94A3B8"
                                    />
                                </TouchableOpacity>
                            ) : null}
                        </View>

                        {/* Dropdown danh sách gợi ý tìm kiếm */}
                        {suggestions.length > 0 && (
                            <View style={styles.suggestionsCard}>
                                <FlatList
                                    data={suggestions}
                                    keyExtractor={(_, idx) => `sug-${idx}`}
                                    keyboardShouldPersistTaps="handled"
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={styles.suggestionItem}
                                            onPress={() =>
                                                handleSelectSuggestion(item)
                                            }
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons
                                                name="location-sharp"
                                                size={18}
                                                color="#FF7A00"
                                                style={{ marginRight: 10 }}
                                            />
                                            <View style={{ flex: 1 }}>
                                                <Text
                                                    style={styles.suggestionName}
                                                    numberOfLines={1}
                                                >
                                                    {item.name}
                                                </Text>
                                                <Text
                                                    style={styles.suggestionDesc}
                                                    numberOfLines={1}
                                                >
                                                    {item.description}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    )}
                                />
                            </View>
                        )}
                    </View>

                    {/* Khu vực Bản đồ Tương tác */}
                    <View style={styles.mapArea}>
                        {Platform.OS === "web" ? (
                            React.createElement("iframe", {
                                key: `map-web-${mapReadyKey}`,
                                ref: iframeRef,
                                srcDoc: leafletHtml,
                                style: {
                                    width: "100%",
                                    height: "100%",
                                    border: "none",
                                },
                                title: "Bản đồ chọn vị trí cấp cứu",
                            })
                        ) : (
                            React.createElement(WebView as any, {
                                key: `map-native-${mapReadyKey}`,
                                ref: webViewRef,
                                originWhitelist: ["*"],
                                source: { html: leafletHtml },
                                onMessage: handleNativeMessage,
                                style: { flex: 1 },
                            })
                        )}

                        {/* Hướng dẫn thao tác ghim */}
                        <View style={styles.hintBadge}>
                            <Ionicons
                                name="hand-left-outline"
                                size={14}
                                color="#FFFFFF"
                            />
                            <Text style={styles.hintBadgeText}>
                                Chạm hoặc kéo ghim đỏ để chọn vị trí chính xác
                            </Text>
                        </View>
                    </View>

                    {/* Bottom Sheet Card thông tin vị trí đã chọn */}
                    <View style={styles.bottomCard}>
                        <View style={styles.addressRow}>
                            <View style={styles.pinIconCircle}>
                                <Ionicons
                                    name="location"
                                    size={22}
                                    color="#FF7A00"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.addressLabel}>
                                    Vị trí cấp cứu đã chọn:
                                </Text>
                                {isResolving ? (
                                    <View style={styles.resolvingRow}>
                                        <ActivityIndicator
                                            size="small"
                                            color="#FF7A00"
                                        />
                                        <Text style={styles.resolvingText}>
                                            Đang xác định địa chỉ...
                                        </Text>
                                    </View>
                                ) : (
                                    <Text
                                        style={styles.addressText}
                                        numberOfLines={2}
                                    >
                                        {address || "Đang lấy địa chỉ..."}
                                    </Text>
                                )}
                                <Text style={styles.coordsText}>
                                    Tọa độ: {coords.latitude.toFixed(5)},{" "}
                                    {coords.longitude.toFixed(5)}
                                </Text>
                            </View>
                        </View>

                        {/* Nút bấm Xác nhận */}
                        <TouchableOpacity
                            style={styles.confirmButton}
                            onPress={handleConfirm}
                            activeOpacity={0.88}
                        >
                            <Ionicons
                                name="checkmark-circle-outline"
                                size={20}
                                color="#FFFFFF"
                                style={{ marginRight: 8 }}
                            />
                            <Text style={styles.confirmButtonText}>
                                Xác nhận vị trí này
                            </Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
        backgroundColor: "#FFFFFF",
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F8FAFC",
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: "700",
        color: "#0F172A",
    },
    gpsButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFF7ED",
    },
    searchContainer: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: "#FFFFFF",
        zIndex: 50,
    },
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F1F5F9",
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 44,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: "#0F172A",
    },
    suggestionsCard: {
        position: "absolute",
        top: 56,
        left: 16,
        right: 16,
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 6,
        maxHeight: 220,
        zIndex: 100,
    },
    suggestionItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
    },
    suggestionName: {
        fontSize: 14,
        fontWeight: "600",
        color: "#0F172A",
    },
    suggestionDesc: {
        fontSize: 12,
        color: "#64748B",
        marginTop: 2,
    },
    mapArea: {
        flex: 1,
        position: "relative",
        backgroundColor: "#E2E8F0",
    },
    hintBadge: {
        position: "absolute",
        top: 12,
        alignSelf: "center",
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(15, 23, 42, 0.82)",
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        gap: 6,
        zIndex: 10,
    },
    hintBadgeText: {
        color: "#FFFFFF",
        fontSize: 12,
        fontWeight: "500",
    },
    bottomCard: {
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: Platform.OS === "ios" ? 28 : 20,
        borderTopWidth: 1,
        borderTopColor: "#F1F5F9",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 10,
    },
    addressRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        marginBottom: 16,
    },
    pinIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "#FFF7ED",
        alignItems: "center",
        justifyContent: "center",
    },
    addressLabel: {
        fontSize: 12,
        fontWeight: "600",
        color: "#64748B",
        textTransform: "uppercase",
        letterSpacing: 0.3,
    },
    addressText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#0F172A",
        marginTop: 2,
        lineHeight: 20,
    },
    resolvingRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 4,
    },
    resolvingText: {
        fontSize: 13,
        color: "#64748B",
        fontStyle: "italic",
    },
    coordsText: {
        fontSize: 12,
        color: "#94A3B8",
        marginTop: 3,
    },
    confirmButton: {
        backgroundColor: "#FF7A00",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 14,
        borderRadius: 26,
        shadowColor: "#EA580C",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
    },
    confirmButtonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "700",
        letterSpacing: 0.2,
    },
});


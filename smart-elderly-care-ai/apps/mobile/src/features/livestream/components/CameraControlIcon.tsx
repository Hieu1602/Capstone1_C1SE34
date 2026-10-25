/**
 * Vẽ bộ icon nét viền dùng cho thao tác camera, ghi hình và đàm thoại.
 */
import React from "react";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Path } from "react-native-svg";

export type CameraControlIconName = React.ComponentProps<
    typeof Ionicons
>["name"];

interface Props {
    name: CameraControlIconName;
    size?: number;
    color: string;
}

/**
 * Chọn hình SVG cho thao tác camera, dùng Ionicons khi chưa có hình riêng.
 * @param props - Tên icon, kích thước và màu nét.
 * @param props.name - Tên thao tác hoặc icon dự phòng.
 * @param props.size - Kích thước hiển thị; mặc định 32.
 * @param props.color - Màu nét và phần tô của icon.
 * @returns Cây giao diện React theo props và theme hiện tại.
 */
export default function CameraControlIcon({ name, size = 32, color }: Props) {
    let shape: React.ReactNode;
    switch (name) {
        case "camera":
            shape = (
                <>
                    <Path d="M3 8h6l2.5-3h9L23 8h6v20H3Z" />
                    <Circle cx={16} cy={18} r={7} />
                    <Path d="M12 18a4 4 0 0 1 4-4" />
                </>
            );
            break;
        case "videocam":
            shape = (
                <>
                    <Circle cx={16} cy={16} r={12} />
                    <Circle
                        cx={16}
                        cy={16}
                        r={6.5}
                        fill={color}
                        stroke="none"
                    />
                </>
            );
            break;
        case "mic":
        case "mic-off":
            shape = (
                <>
                    <Path d="M11 6a5 5 0 0 1 10 0v12a5 5 0 0 1-10 0ZM7 13v5a9 9 0 0 0 18 0v-5M16 27v4M11 31h10" />
                    {name === "mic-off" && <Path d="M3 3 29 31" />}
                </>
            );
            break;
        case "volume-mute":
        case "volume-high-outline":
            shape = (
                <>
                    <Path d="M3 12h6l9-8v24l-9-8H3Z" />
                    {name === "volume-mute" ? (
                        <Path d="m23 12 7 8m0-8-7 8" />
                    ) : (
                        <Path d="M22 9a10 10 0 0 1 0 14M26 5a16 16 0 0 1 0 22" />
                    )}
                </>
            );
            break;
        case "move":
            shape = (
                <>
                    <Circle cx={16} cy={9} r={7} />
                    <Path d="M16 16v9M8 22l-5 7h26l-5-7" />
                </>
            );
            break;
        case "notifications":
            shape = (
                <>
                    <Path d="M8 25V15a8 8 0 0 1 16 0v6M6 28h12M11 24V15M16 1v2M5 5l2 2M27 5l-2 2" />
                    <Path d="M19 25h10m-4-4 4 4-4 4" />
                </>
            );
            break;
        case "play-back-circle-outline":
            shape = (
                <>
                    <Path d="M5 13a12 12 0 1 1 1 12M3 9l2 5 5-2" />
                    <Path d="m13 10 9 6-9 6Z" fill="#F15B67" stroke="none" />
                </>
            );
            break;
        default:
            return <Ionicons name={name} size={size} color={color} />;
    }

    return (
        <Svg
            width={size}
            height={size}
            viewBox="0 0 32 34"
            fill="none"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            accessible={false}
        >
            {shape}
        </Svg>
    );
}

import { Linking } from "react-native";

export default async function downloadVideo(url: string) {
    await Linking.openURL(url);
}

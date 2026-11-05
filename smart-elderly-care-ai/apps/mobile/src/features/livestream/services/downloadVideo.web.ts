export default async function downloadVideo(url: string) {
    const link = document.createElement("a");
    link.href = url;
    link.download = "";
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
}

import fs from "fs";
import path from "path";
import axios from "axios";

async function main() {
  const audioDir = path.resolve(process.cwd(), "public", "audio");
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }

  const text = "Namaste! Welcome to Bang Clinic. Press 1 to book an appointment. Press 0 to exit.";
  const encodedText = encodeURIComponent(text);
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en-IN&client=tw-ob&q=${encodedText}`;

  console.log("Fetching TTS audio from Google Translate API...");
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      Referer: "https://translate.google.com/",
    },
  });

  const targetFile = path.join(audioDir, "welcome.mp3");
  fs.writeFileSync(targetFile, Buffer.from(response.data));
  console.log(`Saved audio file to ${targetFile} (${response.data.byteLength} bytes)`);
}

main().catch((err) => {
  console.error("Failed to generate audio:", err);
  process.exit(1);
});

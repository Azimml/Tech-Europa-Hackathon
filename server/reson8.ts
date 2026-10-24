// Mints a short-lived Reson8 token so the browser can stream the microphone
// straight to Reson8 without ever seeing the API key.
import { config } from "./config.js";

// Words that ordinary speech recognition tends to miss but that matter for
// scam detection. Passed as Reson8 "phrases" (max 250) to bias recognition.
const PHRASES: Record<string, string[]> = {
  en: [
    "police", "detective", "officer", "badge number", "prosecutor", "arrest warrant", "bail", "lawyer",
    "courier", "cash", "jewelry", "gold bars", "savings", "bank account", "PIN", "card number",
    "gift cards", "Google Play", "Amazon gift card", "Western Union", "MoneyGram", "wire transfer",
    "Bitcoin", "crypto", "remote access", "AnyDesk", "TeamViewer", "Microsoft support", "tax office",
    "Social Security", "Erika", "Lena", "grandma", "grandson", "accident", "hospital",
  ],
  de: [
    "Polizei", "Kriminalpolizei", "Staatsanwaltschaft", "Haftbefehl", "Kaution", "Anwalt", "Abholer",
    "Bargeld", "Schmuck", "Goldbarren", "Ersparnisse", "Bankkonto", "PIN", "Überweisung",
    "Gutscheinkarten", "Fernwartung", "Finanzamt", "Erika", "Lena", "Oma", "Enkel", "Unfall", "Krankenhaus",
  ],
};

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function reson8Session(): Promise<{ token: string; url: string }> {
  if (!config.reson8ApiKey) throw new HttpError(503, "RESON8_API_KEY is not set in .env");

  const res = await fetch("https://api.reson8.dev/v1/auth/token", {
    method: "POST",
    headers: { Authorization: `ApiKey ${config.reson8ApiKey}` },
  });
  if (!res.ok) throw new HttpError(502, `Reson8 token request failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new HttpError(502, "Reson8 token response had no access_token");

  const params = new URLSearchParams({
    encoding: "pcm_s16le",
    sample_rate: "16000",
    channels: "1",
    language: config.language,
    diarize: "true",
    max_speakers: "2",
    include_interim: "true",
  });
  const phrases = PHRASES[config.language];
  if (phrases) params.set("phrases", phrases.join(","));

  return { token: body.access_token, url: `wss://api.reson8.dev/v1/speech-to-text/realtime?${params}` };
}

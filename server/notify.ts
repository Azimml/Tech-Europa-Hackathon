// Push notifications through ntfy (https://ntfy.sh): the phone runs the ntfy
// app subscribed to a topic, and we publish to it with one HTTP request.
import { config } from "./config.js";

export interface PushResult {
  delivered: boolean;
  note: string;
}

export async function push(
  topic: string,
  title: string,
  message: string,
  tags: string[] = [],
): Promise<PushResult> {
  if (!topic) return { delivered: false, note: "no ntfy topic configured (shown on dashboard only)" };
  try {
    // JSON publishing goes to the server root and allows UTF-8 in title and message.
    const res = await fetch(config.ntfyServer, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, title, message, tags, priority: 5 }),
    });
    return res.ok
      ? { delivered: true, note: `sent to ntfy topic ${topic}` }
      : { delivered: false, note: `ntfy answered ${res.status}` };
  } catch (err) {
    return { delivered: false, note: `ntfy unreachable: ${(err as Error).message}` };
  }
}

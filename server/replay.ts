// Replays a scripted call through the real pipeline (scorer + agent) without
// audio: for development without a microphone, and as a demo fallback.
import { readFile } from "node:fs/promises";
import { hub, toRole } from "./hub.js";
import { addSegment } from "./pipeline.js";

export interface ScriptedCall {
  id: string;
  title: string;
  label: "scam" | "normal";
  // Stored files use "grandma" for the receiver; built-in calls use "receiver".
  turns: { role: "caller" | "receiver" | "grandma"; text: string }[];
}

const BUILT_IN: ScriptedCall[] = [
  {
    id: "builtin-fake-police",
    title: "Fake police (built-in)",
    label: "scam",
    turns: [
      { role: "receiver", text: "Hello?" },
      { role: "caller", text: "Good evening, is this Mrs. Erika Weber? This is Detective Miller from the Berlin police." },
      { role: "receiver", text: "Yes, that's me. Is something wrong?" },
      { role: "caller", text: "We arrested a gang in your street tonight and found a list with your name and address on it." },
      { role: "receiver", text: "Oh my goodness." },
      { role: "caller", text: "Your savings at the bank are not safe. We believe someone at your bank is working with them." },
      { role: "caller", text: "Please don't tell anyone about this call, not even your daughter, and don't hang up." },
      { role: "receiver", text: "What should I do?" },
      { role: "caller", text: "Withdraw your cash tomorrow and put it together with your jewelry. An officer will come to collect it for safekeeping." },
    ],
  },
  {
    id: "builtin-grandson-lunch",
    title: "Grandson plans lunch (built-in)",
    label: "normal",
    turns: [
      { role: "receiver", text: "Hello?" },
      { role: "caller", text: "Hi Oma, it's Max! Are we still on for lunch on Sunday?" },
      { role: "receiver", text: "Of course, darling. I'm making your favourite soup." },
      { role: "caller", text: "Amazing. I'll take the train, I'll pay you back for last week's ticket too." },
      { role: "receiver", text: "Don't be silly. See you Sunday at one." },
      { role: "caller", text: "See you then, love you!" },
    ],
  },
];

export async function loadScripts(): Promise<ScriptedCall[]> {
  try {
    const raw = await readFile(new URL("../eval/demo-scripts.json", import.meta.url), "utf8");
    const scripts = JSON.parse(raw) as ScriptedCall[];
    if (Array.isArray(scripts) && scripts.length) return [...scripts, ...BUILT_IN];
  } catch {
    // demo-scripts.json not written yet
  }
  return BUILT_IN;
}

let timer: NodeJS.Timeout | null = null;

export function stopReplay(): void {
  if (timer) clearTimeout(timer);
  timer = null;
}

export async function replay(id: string): Promise<boolean> {
  const script = (await loadScripts()).find((s) => s.id === id);
  if (!script) return false;
  stopReplay();
  // Roles are not preset: like a live call, Claude identifies the caller.
  const call = hub.reset();

  let index = 0;
  const next = () => {
    if (hub.call !== call || index >= script.turns.length) {
      timer = null;
      return;
    }
    const turn = script.turns[index++];
    addSegment(toRole(turn.role) === "receiver" ? 0 : 1, turn.text);
    // Roughly the time it takes to say the next line out loud.
    const words = script.turns[index]?.text.split(/\s+/).length ?? 0;
    timer = setTimeout(next, Math.min(5000, Math.max(1500, 700 + words * 280)));
  };
  next();
  return true;
}

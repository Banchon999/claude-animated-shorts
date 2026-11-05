import { writeFileSync, mkdirSync } from "node:fs";
import { events, FPS, TOTAL } from "../src/timeline.ts";
mkdirSync("audio", { recursive: true });
writeFileSync("audio/events.json", JSON.stringify({ fps: FPS, total: TOTAL, events: events() }, null, 1));
console.log("events:", events().length);

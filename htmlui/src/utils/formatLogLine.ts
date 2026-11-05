import { formatTimestamp } from "../core/formatTimestamp";
import type { LogEntry } from "../core/types";

export function formatLogLine(entry: LogEntry): string {
  const { level, ts, msg, mod, ...rest } = entry;
  const parts = JSON.stringify(rest, null, level >= 3 ? 2 : undefined);
  const timespan = formatTimestamp(new Date(ts * 1000));
  const partText = parts === "{}" ? "" : parts;
  return `${timespan} [${mod}] ${msg}${partText ? `\n${partText}` : ""}`;
}

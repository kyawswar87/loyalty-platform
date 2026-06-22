import { z } from "zod";

/**
 * Shared, framework-agnostic helpers for the staff chat assistant.
 *
 * The assistant proxies to an external AI backend that streams answers as
 * Server-Sent Events (`text/event-stream`). Everything here is pure so it can be
 * unit-tested and reused on both the server (proxy route) and the client (widget).
 */

/** Fallback when `CHAT_STREAM_URL` is unset — matches the local AI backend. */
export const DEFAULT_CHAT_STREAM_URL = "http://localhost:8080/api/chat/stream";

/** The upstream SSE endpoint, from env or the local default. */
export function resolveChatStreamUrl(): string {
  return process.env.CHAT_STREAM_URL?.trim() || DEFAULT_CHAT_STREAM_URL;
}

/** Request body the widget sends and the proxy forwards. Single-turn, stateless. */
export const chatRequestSchema = z.object({
  question: z.string().trim().min(1).max(4000),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

/** Sentinel the upstream emits to mark the end of a stream. */
export const SSE_DONE = "[DONE]";

export type SseParseResult = {
  /** Decoded `data:` payloads for each complete event (excludes the DONE sentinel). */
  tokens: string[];
  /** Trailing partial event to prepend to the next chunk. */
  rest: string;
  /** True once the `[DONE]` sentinel was seen. */
  done: boolean;
};

/**
 * Incrementally parse a buffer of SSE text into token payloads.
 *
 * Events are separated by a blank line (`\n\n`); the trailing fragment that is
 * not yet terminated is returned as `rest` to be carried into the next chunk.
 *
 * The payload after `data:` is taken **verbatim** — the leading space is *not*
 * stripped. This upstream uses that single space as content (the word-boundary
 * space): word-starting tokens arrive as `data: generation` while mid-word
 * continuations arrive as `data:riev` (no space). Stripping the space — as the
 * SSE spec's framing rule would — collapses every word boundary
 * (`Icanonlyanswer...`). The accumulated text may therefore have one leading
 * space; trim it at display time. Non-`data:` lines (comments, `event:`, `id:`)
 * are ignored, and the `[DONE]` sentinel is matched after trimming.
 */
export function parseSseBuffer(buffer: string): SseParseResult {
  const tokens: string[] = [];
  let done = false;

  const normalized = buffer.replace(/\r\n/g, "\n");
  const events = normalized.split("\n\n");
  // The final element is whatever comes after the last `\n\n` — an incomplete
  // event (possibly empty). Keep it for the next call.
  const rest = events.pop() ?? "";

  for (const event of events) {
    const dataLines: string[] = [];
    for (const line of event.split("\n")) {
      if (!line.startsWith("data:")) continue;
      dataLines.push(line.slice("data:".length));
    }
    if (dataLines.length === 0) continue;

    const data = dataLines.join("\n");
    if (data.trim() === SSE_DONE) {
      done = true;
      break;
    }
    tokens.push(data);
  }

  return { tokens, rest, done };
}

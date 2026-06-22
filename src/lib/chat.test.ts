import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_CHAT_STREAM_URL,
  chatRequestSchema,
  parseSseBuffer,
  resolveChatStreamUrl,
} from "@/lib/chat";

describe("chatRequestSchema", () => {
  it("accepts and trims a valid question", () => {
    const parsed = chatRequestSchema.safeParse({ question: "  hello?  " });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.question).toBe("hello?");
  });

  it("rejects empty or whitespace-only questions", () => {
    expect(chatRequestSchema.safeParse({ question: "" }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ question: "   " }).success).toBe(false);
  });

  it("rejects a missing question and over-long input", () => {
    expect(chatRequestSchema.safeParse({}).success).toBe(false);
    expect(
      chatRequestSchema.safeParse({ question: "a".repeat(4001) }).success,
    ).toBe(false);
  });
});

describe("parseSseBuffer", () => {
  it("parses a single complete event verbatim", () => {
    const { tokens, rest, done } = parseSseBuffer("data: am\n\n");
    expect(tokens).toEqual([" am"]);
    expect(rest).toBe("");
    expect(done).toBe(false);
  });

  it("preserves the leading space as content (word boundary)", () => {
    // The upstream uses the single post-colon space as the word-boundary space:
    // word-starts carry it, mid-word continuations do not. It must be kept.
    const { tokens } = parseSseBuffer("data: I\n\ndata: am\n\ndata:nesia\n\n");
    expect(tokens).toEqual([" I", " am", "nesia"]);
  });

  it("reconstructs real upstream output with correct spacing", () => {
    // Captured verbatim from the AI backend for "who are you?".
    const stream =
      "data:I\n\ndata: am\n\ndata: a\n\ndata: knowledge\n\ndata:-\n\n" +
      "data:base\n\ndata: assistant\n\ndata:.\n\ndata:[DONE]\n\n";
    const { tokens, done } = parseSseBuffer(stream);
    expect(tokens.join("")).toBe("I am a knowledge-base assistant.");
    expect(done).toBe(true);
  });

  it("returns a trailing partial event as rest", () => {
    const { tokens, rest } = parseSseBuffer("data: done\n\ndata: par");
    expect(tokens).toEqual([" done"]);
    expect(rest).toBe("data: par");
  });

  it("carries a partial event across chunk boundaries", () => {
    const first = parseSseBuffer("data: gen");
    expect(first.tokens).toEqual([]);
    const second = parseSseBuffer(first.rest + "eration\n\n");
    expect(second.tokens).toEqual([" generation"]);
  });

  it("flags [DONE] (with or without a leading space) and stops emitting", () => {
    const { tokens, done } = parseSseBuffer("data: last\n\ndata:[DONE]\n\n");
    expect(tokens).toEqual([" last"]);
    expect(done).toBe(true);
  });

  it("normalizes CRLF line endings", () => {
    const { tokens, done } = parseSseBuffer("data: hi\r\n\r\ndata:[DONE]\r\n\r\n");
    expect(tokens).toEqual([" hi"]);
    expect(done).toBe(true);
  });
});

describe("resolveChatStreamUrl", () => {
  const original = process.env.CHAT_STREAM_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.CHAT_STREAM_URL;
    else process.env.CHAT_STREAM_URL = original;
  });

  it("returns the env value when set", () => {
    process.env.CHAT_STREAM_URL = "https://ai.example.com/stream";
    expect(resolveChatStreamUrl()).toBe("https://ai.example.com/stream");
  });

  it("falls back to the default when unset or blank", () => {
    delete process.env.CHAT_STREAM_URL;
    expect(resolveChatStreamUrl()).toBe(DEFAULT_CHAT_STREAM_URL);
    process.env.CHAT_STREAM_URL = "   ";
    expect(resolveChatStreamUrl()).toBe(DEFAULT_CHAT_STREAM_URL);
  });
});

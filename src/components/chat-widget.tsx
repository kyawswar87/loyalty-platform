"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, Sparkles, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { parseSseBuffer } from "@/lib/chat";

type Message = { id: string; role: "user" | "assistant"; text: string };

/**
 * Floating staff assistant. A launcher button toggles a popover chat panel that
 * streams answers from `POST /api/chat` (a pass-through SSE proxy). History is
 * ephemeral — kept in component state and cleared on reload.
 */
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Keep the latest message in view as tokens stream in.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  // Abort any in-flight stream if the widget unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || streaming) return;

    setError(null);
    setInput("");

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", text: question },
      { id: assistantId, role: "assistant", text: "" },
    ]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error("unavailable");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parsed = parseSseBuffer(buffer);
        buffer = parsed.rest;
        if (parsed.tokens.length > 0) {
          const chunk = parsed.tokens.join("");
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, text: m.text + chunk } : m,
            ),
          );
        }
        if (parsed.done) break;
      }

      // Replace an empty bubble (upstream sent only [DONE]) with a fallback.
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && m.text === ""
            ? { ...m, text: "No response." }
            : m,
        ),
      );
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return; // user stopped; keep partial
      setError("The assistant is unavailable. Please try again.");
      setMessages((prev) =>
        prev.filter((m) => !(m.id === assistantId && m.text === "")),
      );
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  return (
    <>
      {open ? (
        <div className="fixed right-4 bottom-20 z-50 flex h-[28rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border bg-background shadow-lg">
          <header className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Sparkles className="size-3.5" />
              </span>
              <span className="text-sm font-medium">Assistant</span>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
            >
              <X />
            </Button>
          </header>

          <div
            ref={listRef}
            role="log"
            aria-live="polite"
            className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
          >
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ask a question to get started.
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex",
                    m.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {/* The stream's first token can carry a leading space. */}
                    {m.role === "assistant" ? m.text.trimStart() : m.text}
                    {m.role === "assistant" && m.text === "" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                  </div>
                </div>
              ))
            )}
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
          </div>

          <form onSubmit={send} className="flex items-center gap-2 border-t p-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              disabled={streaming}
              aria-label="Message"
              autoComplete="off"
            />
            {streaming ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => abortRef.current?.abort()}
                aria-label="Stop"
              >
                <Square />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim()}
                aria-label="Send"
              >
                <Send />
              </Button>
            )}
          </form>
        </div>
      ) : null}

      <Button
        size="icon-lg"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        aria-expanded={open}
        className="fixed right-4 bottom-4 z-50 rounded-full shadow-lg"
      >
        {open ? <X /> : <MessageCircle />}
      </Button>
    </>
  );
}

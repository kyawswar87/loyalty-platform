import { jsonError } from "@/lib/api";
import { getCurrentUser } from "@/lib/authz";
import { chatRequestSchema, resolveChatStreamUrl } from "@/lib/chat";

export const dynamic = "force-dynamic";

/**
 * POST /api/chat — staff-only streaming proxy to the external AI assistant.
 *
 * The middleware `matcher` excludes `/api`, so the auth gate lives here. On
 * success we pipe the upstream `text/event-stream` straight to the browser
 * untouched, preserving exact SSE framing; the client parses it incrementally.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return jsonError("unauthorized", "Sign in to use the assistant.");
  }

  const json = await req.json().catch(() => null);
  const parsed = chatRequestSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("bad_request", "A non-empty question is required.");
  }

  let upstream: Response;
  try {
    upstream = await fetch(resolveChatStreamUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: parsed.data.question }),
      // Forward client cancellation so aborting the browser request stops upstream.
      signal: req.signal,
    });
  } catch {
    return jsonError("internal", "The assistant is currently unavailable.", 503);
  }

  if (!upstream.ok || !upstream.body) {
    return jsonError("internal", "The assistant is currently unavailable.", 503);
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable proxy buffering so tokens flush as they arrive.
      "X-Accel-Buffering": "no",
    },
  });
}

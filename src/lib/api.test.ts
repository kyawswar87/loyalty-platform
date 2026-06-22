import { describe, expect, it } from "vitest";
import { jsonError, jsonOk } from "@/lib/api";

describe("jsonOk", () => {
  it("defaults to status 200 and returns the data", async () => {
    const res = jsonOk({ hello: "world" });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ hello: "world" });
  });

  it("honors a custom status", () => {
    expect(jsonOk({ created: true }, 201).status).toBe(201);
  });
});

describe("jsonError", () => {
  it("maps known error codes to their default status", () => {
    expect(jsonError("bad_request", "x").status).toBe(400);
    expect(jsonError("unauthorized", "x").status).toBe(401);
    expect(jsonError("forbidden", "x").status).toBe(403);
    expect(jsonError("not_found", "x").status).toBe(404);
    expect(jsonError("conflict", "x").status).toBe(409);
    expect(jsonError("unprocessable", "x").status).toBe(422);
    expect(jsonError("rate_limited", "x").status).toBe(429);
    expect(jsonError("internal", "x").status).toBe(500);
  });

  it("returns the { error: { code, message } } envelope", async () => {
    const res = jsonError("not_found", "customer missing");
    await expect(res.json()).resolves.toEqual({
      error: { code: "not_found", message: "customer missing" },
    });
  });

  it("allows overriding the status (e.g. internal as 503)", () => {
    expect(jsonError("internal", "db down", 503).status).toBe(503);
  });
});

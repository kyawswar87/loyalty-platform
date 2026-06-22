import { NextResponse } from "next/server";

/** Canonical error codes → default HTTP status. */
const ERROR_STATUS = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  unprocessable: 422,
  rate_limited: 429,
  internal: 500,
} as const;

export type ApiErrorCode = keyof typeof ERROR_STATUS;

/** Success envelope. */
export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/** Error envelope: `{ error: { code, message } }` with a sensible status. */
export function jsonError(
  code: ApiErrorCode,
  message: string,
  status?: number,
) {
  return NextResponse.json(
    { error: { code, message } },
    { status: status ?? ERROR_STATUS[code] },
  );
}

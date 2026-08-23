"use client";

/** Client-side fetch helpers. Throw ApiError (with field errors) on failure. */

export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;
  constructor(message: string, status: number, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }
}

async function handle<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // Non-JSON body (e.g. an HTML error page from a proxy/gateway). Fall
      // through with data=null so we still raise an ApiError below instead of
      // an unhandled SyntaxError.
      data = null;
    }
  }
  if (!res.ok) {
    throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status, data?.fields);
  }
  return data as T;
}

export async function apiGet<T>(url: string): Promise<T> {
  return handle<T>(await fetch(url, { headers: { Accept: "application/json" } }));
}

export async function apiSend<T>(url: string, method: string, body?: unknown): Promise<T> {
  return handle<T>(
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

export const apiPost = <T>(url: string, body?: unknown) => apiSend<T>(url, "POST", body);
export const apiPatch = <T>(url: string, body?: unknown) => apiSend<T>(url, "PATCH", body);
export const apiPut = <T>(url: string, body?: unknown) => apiSend<T>(url, "PUT", body);
export const apiDelete = <T>(url: string, body?: unknown) => apiSend<T>(url, "DELETE", body);

/** SWR default fetcher. */
export const swrFetcher = <T>(url: string) => apiGet<T>(url);

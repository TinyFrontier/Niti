export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
    /** Raw `detail` from the response body when it is not a plain string. */
    public detailData?: unknown,
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  formData?: FormData;
  params?: Record<string, string | number | boolean | undefined>;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, formData, params } = options;

  const url = new URL(path, API_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(url, {
    method,
    headers,
    credentials: "include",
    body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });

  if (response.status === 401 && !PUBLIC_PATHS.includes(window.location.pathname)) {
    window.location.assign("/login");
  }

  if (!response.ok) {
    let detail = response.statusText;
    let detailData: unknown;
    try {
      const data = await response.json();
      detailData = data.detail;
      if (typeof data.detail === "string") {
        detail = data.detail;
      } else if (
        data.detail &&
        typeof data.detail === "object" &&
        typeof data.detail.message === "string"
      ) {
        detail = data.detail.message;
      }
    } catch {
      // non-JSON error body — keep statusText
    }
    throw new ApiError(response.status, detail, detailData);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export async function apiFetch<T>(
  path: string,
  { body, headers, ...init }: ApiOptions = {}
): Promise<T> {
  const url = path.startsWith("http") ? path : path.startsWith("/") ? path : `/${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = (await res.json().catch(() => null)) as
    | { data?: T; error?: string; [key: string]: unknown }
    | null;

  if (!res.ok) {
    const errorMsg =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Request failed";
    throw new ApiError(errorMsg, res.status);
  }

  // If response has payload.data, return it; otherwise return the raw payload
  if (payload && typeof payload === "object" && "data" in payload && payload.data !== undefined) {
    return payload.data as T;
  }

  return payload as T;
}

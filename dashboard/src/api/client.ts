const base = (import.meta.env.VITE_DASHBOARD_API_URL || (import.meta.env.DEV ? "/api/dashboard" : "")).replace(/\/$/, "");
function endpoint(path: string) {
  if (base) return base + path;
  const [route, query] = path.split("?", 2);
  const params = new URLSearchParams(query);
  params.set("endpoint", route);
  return "/api/dashboard-data?" + params;
}
export async function request<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const response = await fetch(endpoint(path), { ...options, headers: {
    Authorization: "Bearer " + token, ...(options?.body ? { "Content-Type": "application/json" } : {}),
  } });
  if (!response.ok) {
    const status = response.status;
    throw new Error(status === 401 ? "Access token rejected" : status === 400 ? "The server rejected these values" : `Dashboard API returned ${status}`);
  }
  return response.json() as Promise<T>;
}

export async function stream(path: string, token: string, signal: AbortSignal, receive: (payload: string) => void) {
  const response = await fetch(endpoint(path), { signal, headers: { Authorization: "Bearer " + token } });
  if (!response.ok || !response.body || !response.headers.get("content-type")?.startsWith("text/event-stream")) {
    throw new Error("Live stream unavailable");
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    while (true) {
      const packet = await reader.read();
      if (packet.done) return;
      buffer += packet.value;
      let end = buffer.indexOf("\n\n");
      while (end !== -1) {
        const event = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (event.includes("event: unavailable")) throw new Error("Live data unavailable");
        const line = event.split("\n").find(part => part.startsWith("data:"));
        if (line) receive(line.slice(5).trimStart());
        end = buffer.indexOf("\n\n");
      }
    }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

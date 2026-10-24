export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

const MAX_BODY_BYTES = 32_768;

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  // Next.js may use an internal hostname for Request.url. Host retains the
  // browser-facing authority; deployment proxies provide the external scheme.
  const internalUrl = new URL(request.url);
  const host = request.headers.get("host") || internalUrl.host;
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol ? `${forwardedProtocol}:` : internalUrl.protocol;
  let expectedOrigin: string;
  try {
    if (protocol !== "http:" && protocol !== "https:") throw new Error("Invalid protocol");
    expectedOrigin = new URL(`${protocol}//${host}`).origin;
  } catch {
    throw new ApiError(403, "Diese Anfrage muss von der Spielseite kommen.");
  }
  if (origin !== expectedOrigin) {
    throw new ApiError(403, "Diese Anfrage muss von der Spielseite kommen.");
  }
}

export async function readJson(request: Request, maxBytes = MAX_BODY_BYTES): Promise<unknown> {
  assertSameOrigin(request);
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new ApiError(415, "Bitte JSON mit Content-Type application/json senden.");
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > maxBytes) throw new ApiError(413, "Die Anfrage ist zu groß.");
  if (!request.body) throw new ApiError(400, "Die Anfrage enthält kein JSON.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new ApiError(413, "Die Anfrage ist zu groß.");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "Das JSON ist ungültig.");
  } finally {
    reader.releaseLock();
  }
}

export function jsonResponse(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) return jsonResponse({ error: error.message }, error.status);
  // Upstream messages may contain credentials or internal provider details.
  return jsonResponse({ error: "Die Anfrage konnte nicht verarbeitet werden. Bitte erneut versuchen." }, 500);
}

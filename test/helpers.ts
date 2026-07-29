import type { FetchLike, PulsenoteOptions } from '../src/index.js';
import { Pulsenote } from '../src/index.js';

export interface RecordedRequest {
  url: URL;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  signal: AbortSignal | undefined;
}

export interface MockResponseInit {
  status?: number;
  /** Object bodies are sent as JSON, strings as `text/plain`. */
  body?: unknown;
  headers?: Record<string, string>;
  /** Reject instead of responding, simulating a transport failure. */
  error?: Error;
  /** Never settle until the request's signal aborts. */
  hang?: boolean;
}

type Responder =
  | MockResponseInit
  | MockResponseInit[]
  | ((request: RecordedRequest, attempt: number) => MockResponseInit);

/** A `fetch` double that records every request and replays scripted responses. */
export function createMockFetch(responder: Responder = {}): {
  fetch: FetchLike;
  requests: RecordedRequest[];
} {
  const requests: RecordedRequest[] = [];

  const fetch: FetchLike = async (input, init = {}) => {
    const request: RecordedRequest = {
      url: new URL(input),
      method: init.method ?? 'GET',
      headers: (init.headers as Record<string, string> | undefined) ?? {},
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      signal: init.signal ?? undefined,
    };
    requests.push(request);

    const attempt = requests.length - 1;
    const spec = Array.isArray(responder)
      ? (responder[Math.min(attempt, responder.length - 1)] ?? {})
      : typeof responder === 'function'
        ? responder(request, attempt)
        : responder;

    if (spec.hang) {
      return new Promise<Response>((_resolve, reject) => {
        request.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('The operation was aborted.', 'AbortError')),
          { once: true },
        );
      });
    }

    if (spec.error) throw spec.error;

    const isText = typeof spec.body === 'string';
    const payload =
      spec.body === undefined ? null : isText ? (spec.body as string) : JSON.stringify(spec.body);

    return new Response(payload, {
      status: spec.status ?? 200,
      headers: {
        'content-type': isText ? 'text/plain; charset=utf-8' : 'application/json',
        ...(spec.headers ?? {}),
      },
    });
  };

  return { fetch, requests };
}

/** A client wired to a mock transport, with retry delays collapsed to ~0ms. */
export function createTestClient(
  responder: Responder = {},
  options: PulsenoteOptions = {},
): { client: Pulsenote; requests: RecordedRequest[] } {
  const { fetch, requests } = createMockFetch(responder);

  const client = new Pulsenote({
    apiKey: 'pk_test_key',
    fetch,
    initialRetryDelay: 1,
    maxRetryDelay: 1,
    ...options,
  });

  return { client, requests };
}

export type Fetcher = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export class HttpError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, body: unknown) {
    super(`HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

/**
 * A chainable request builder. Every step returns a NEW builder (immutable), so a shared base
 * (`api.headers({ auth })`) can be reused by many requests without one request's query leaking into
 * another. Nothing is sent until `.send()`.
 */
class RequestBuilder {
  private readonly fetcher: Fetcher;
  private readonly spec: {
    baseUrl: string;
    method: string;
    path: string;
    query: Record<string, string>;
    headers: Record<string, string>;
    body?: unknown;
  };

  constructor(fetcher: Fetcher, spec: RequestBuilder['spec']) {
    this.fetcher = fetcher;
    this.spec = spec;
  }

  private with(patch: Partial<RequestBuilder['spec']>): RequestBuilder {
    return new RequestBuilder(this.fetcher, { ...this.spec, ...patch });
  }

  get(path: string) {
    return this.with({ method: 'GET', path });
  }
  post(path: string, body: unknown) {
    return this.with({ method: 'POST', path, body });
  }
  put(path: string, body: unknown) {
    return this.with({ method: 'PUT', path, body });
  }
  delete(path: string) {
    return this.with({ method: 'DELETE', path });
  }
  query(params: Record<string, string | number | boolean>) {
    const merged = { ...this.spec.query };
    for (const [key, value] of Object.entries(params)) merged[key] = String(value);
    return this.with({ query: merged });
  }
  headers(extra: Record<string, string>) {
    return this.with({ headers: { ...this.spec.headers, ...extra } });
  }

  /** The URL this builder would request — handy in tests and logs. */
  url(): string {
    const base = this.spec.baseUrl.replace(/\/+$/, '');
    const path = this.spec.path.startsWith('/') ? this.spec.path : `/${this.spec.path}`;
    const search = new URLSearchParams(this.spec.query).toString(); // encodes & = ? spaces
    return `${base}${path}${search ? `?${search}` : ''}`;
  }

  async send<T = unknown>(): Promise<T> {
    const { method, headers, body } = this.spec;
    const hasBody = body !== undefined;
    const response = await this.fetcher(this.url(), {
      method,
      headers: hasBody ? { 'Content-Type': 'application/json', ...headers } : headers,
      body: hasBody ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => null); // 204 / non-JSON bodies
    if (!response.ok) throw new HttpError(response.status, data); // fetch itself never rejects on 4xx/5xx
    return data as T;
  }
}

export function createApiClient(baseUrl: string, fetcher: Fetcher) {
  return new RequestBuilder(fetcher, { baseUrl, method: 'GET', path: '/', query: {}, headers: {} });
}

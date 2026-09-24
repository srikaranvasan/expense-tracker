import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createContext, runInContext } from "node:vm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  CACHE_NAME_PREFIX,
  PRIVATE_CACHE_PREFIX,
  SERVICE_WORKER_MESSAGES,
} from "@/offline/pwa/service-worker";

/**
 * Tests for `public/sw.js`.
 *
 * The worker is evaluated **as shipped**, in a sandbox with stand-in Cache and fetch
 * implementations, rather than being reimplemented in TypeScript for testing. A
 * TypeScript copy would be the thing under test and the real file would be the thing that
 * breaks, which for the rule these tests exist to protect — no API response is ever
 * cached — is not an acceptable gap.
 *
 * What is faked: the Cache API, `fetch`, `clients`, and the event objects. What is real:
 * every line of routing and strategy logic in the worker, plus `Request`, `Response` and
 * `Headers` from Node.
 */

const ORIGIN = "https://tracker.test";
const SW_SOURCE = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");

/* ------------------------------------------------------------------ *
 * Cache API stand-in
 * ------------------------------------------------------------------ */

type CacheKey = string;

function requestUrl(input: Request | string): string {
  return typeof input === "string" ? new URL(input, ORIGIN).toString() : input.url;
}

class FakeCache {
  readonly entries = new Map<CacheKey, Response>();

  async match(request: Request | string): Promise<Response | undefined> {
    const hit = this.entries.get(requestUrl(request));
    // Returning the same Response twice would fail on a consumed body, exactly as the
    // real Cache API avoids by handing out a fresh clone each time.
    return hit ? hit.clone() : undefined;
  }

  async put(request: Request | string, response: Response): Promise<void> {
    this.entries.set(requestUrl(request), response);
  }

  async add(request: Request | string): Promise<void> {
    const response = await (globalThis as { __swFetch?: FetchHandler }).__swFetch!(
      typeof request === "string" ? new Request(requestUrl(request)) : request,
    );
    if (!response.ok) throw new Error(`Request failed: ${requestUrl(request)}`);
    await this.put(request, response);
  }

  async delete(request: Request | string): Promise<boolean> {
    return this.entries.delete(requestUrl(request));
  }

  async keys(): Promise<string[]> {
    return [...this.entries.keys()];
  }
}

class FakeCacheStorage {
  readonly stores = new Map<string, FakeCache>();

  async open(name: string): Promise<FakeCache> {
    let cache = this.stores.get(name);
    if (!cache) {
      cache = new FakeCache();
      this.stores.set(name, cache);
    }
    return cache;
  }

  async keys(): Promise<string[]> {
    return [...this.stores.keys()];
  }

  async delete(name: string): Promise<boolean> {
    return this.stores.delete(name);
  }

  async has(name: string): Promise<boolean> {
    return this.stores.has(name);
  }

  async match(request: Request | string): Promise<Response | undefined> {
    for (const cache of this.stores.values()) {
      const hit = await cache.match(request);
      if (hit) return hit;
    }
    return undefined;
  }
}

/* ------------------------------------------------------------------ *
 * Harness
 * ------------------------------------------------------------------ */

type FetchHandler = (request: Request) => Promise<Response>;

type SwInternals = {
  VERSION: string;
  CACHE_PREFIX: string;
  CACHE_NAMES: { shell: string; static: string; pages: string };
  PRECACHE_URLS: string[];
  MESSAGES: Record<string, string>;
  OFFLINE_URL: string;
  decideStrategy: (request: unknown, origin?: string) => string;
  isNavigationRequest: (request: unknown) => boolean;
  isImmutableAsset: (pathname: string) => boolean;
  isPublicAsset: (pathname: string) => boolean;
  isCacheableNavigationResponse: (response: unknown) => boolean;
  isOfflineUrl: (request: unknown) => boolean;
  extractStaticAssetUrls: (html: string) => string[];
  precacheShell: () => Promise<unknown>;
  precacheOfflineAssets: () => Promise<unknown>;
  precacheNestedStylesheetAssets: (urls: string[]) => Promise<unknown>;
  deleteObsoleteCaches: () => Promise<unknown>;
  clearPrivateCaches: () => Promise<unknown>;
};

type Harness = {
  internals: SwInternals;
  caches: FakeCacheStorage;
  skipWaitingCalls: number;
  claimCalls: number;
  setFetch: (handler: FetchHandler) => void;
  fetched: string[];
  install: () => Promise<void>;
  activate: () => Promise<void>;
  navigate: (url: string) => Promise<Response | undefined>;
  request: (url: string, init?: RequestInit) => Promise<Response | undefined>;
  message: (data: unknown) => Promise<unknown[]>;
};

/**
 * Relative URLs are legal inside a worker (they resolve against the worker's scope) but
 * throw in Node, so the sandbox gets a Request that applies the origin first.
 */
function makeSandboxRequest(): typeof Request {
  return class SandboxRequest extends Request {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      super(typeof input === "string" ? new URL(input, ORIGIN).toString() : input, init);
    }
  } as unknown as typeof Request;
}

function loadServiceWorker(): Harness {
  const listeners = new Map<string, Array<(event: unknown) => void>>();
  const cacheStorage = new FakeCacheStorage();
  const fetched: string[] = [];

  let fetchHandler: FetchHandler = async () => {
    throw new TypeError("Failed to fetch");
  };

  const fetchImpl: FetchHandler = async (request) => {
    fetched.push(typeof request === "string" ? request : request.url);
    return fetchHandler(request);
  };

  // FakeCache.add goes through the same handler, so a precache runs against the same
  // network the tests configure.
  (globalThis as { __swFetch?: FetchHandler }).__swFetch = fetchImpl;

  const harness: Partial<Harness> = { skipWaitingCalls: 0, claimCalls: 0 };

  const self = {
    location: { origin: ORIGIN, href: `${ORIGIN}/sw.js` },
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      const existing = listeners.get(type) ?? [];
      existing.push(listener);
      listeners.set(type, existing);
    },
    skipWaiting: () => {
      harness.skipWaitingCalls = (harness.skipWaitingCalls ?? 0) + 1;
    },
    clients: {
      claim: async () => {
        harness.claimCalls = (harness.claimCalls ?? 0) + 1;
      },
    },
  } as Record<string, unknown>;

  const sandbox: Record<string, unknown> = {
    self,
    caches: cacheStorage,
    fetch: fetchImpl,
    Request: makeSandboxRequest(),
    Response,
    Headers,
    URL,
    Promise,
    console,
  };
  sandbox.globalThis = sandbox;

  const context = createContext(sandbox);
  runInContext(SW_SOURCE, context, { filename: "public/sw.js" });

  const internals = (self as { __swInternals?: SwInternals }).__swInternals;
  if (!internals) throw new Error("public/sw.js did not expose __swInternals");

  /** Runs every listener for an event and settles everything it passed to waitUntil. */
  const dispatch = async (type: string, build: (collect: (p: unknown) => void) => unknown) => {
    const pending: unknown[] = [];
    const event = build((promise) => pending.push(promise));

    for (const listener of listeners.get(type) ?? []) listener(event);
    await Promise.all(pending);

    return event;
  };

  const respond = async (request: Request): Promise<Response | undefined> => {
    let responded: Promise<Response> | undefined;

    await dispatch("fetch", (collect) => ({
      request,
      waitUntil: collect,
      respondWith: (value: Promise<Response>) => {
        responded = value;
        collect(value);
      },
    }));

    return responded ? await responded : undefined;
  };

  return {
    internals,
    caches: cacheStorage,
    fetched,
    get skipWaitingCalls() {
      return harness.skipWaitingCalls ?? 0;
    },
    get claimCalls() {
      return harness.claimCalls ?? 0;
    },
    setFetch: (handler) => {
      fetchHandler = handler;
    },
    install: async () => void (await dispatch("install", (collect) => ({ waitUntil: collect }))),
    activate: async () => void (await dispatch("activate", (collect) => ({ waitUntil: collect }))),
    navigate: (url) =>
      respond(new Request(new URL(url, ORIGIN), { headers: { accept: "text/html" } })),
    request: (url, init) => respond(new Request(new URL(url, ORIGIN), init)),
    message: async (data) => {
      const received: unknown[] = [];
      await dispatch("message", (collect) => ({
        data,
        waitUntil: collect,
        ports: [{ postMessage: (value: unknown) => received.push(value) }],
      }));
      return received;
    },
  } as Harness;
}

function htmlResponse(body = "<!doctype html><title>ok</title>", status = 200): Response {
  return new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

/* ------------------------------------------------------------------ *
 * Tests
 * ------------------------------------------------------------------ */

describe("service worker routing", () => {
  let sw: Harness;

  beforeEach(() => {
    sw = loadServiceWorker();
  });

  const strategyFor = (url: string, init?: RequestInit & { navigate?: boolean }) => {
    const request = new Request(new URL(url, ORIGIN), init);
    return sw.internals.decideStrategy(request, ORIGIN);
  };

  describe("API requests are never cached", () => {
    // The single most important rule in the file. A cached push response would tell the
    // client an expense had reached the server when it never left the device.
    it.each([
      "/api/sync/push",
      "/api/sync/pull?cursor=abc",
      "/api/sync/record?id=1",
      "/api/expenses",
      "/api/expenses/shared",
      "/api/settlements",
      "/api/dashboard",
      "/api/auth/session",
      "/api/me",
      "/api/health",
    ])("%s is network-only", (path) => {
      expect(strategyFor(path)).toBe("network-only");
    });

    it("is network-only even when the request looks like a navigation", () => {
      // A hand-crafted Accept header must not be enough to get an API response cached.
      expect(strategyFor("/api/dashboard", { headers: { accept: "text/html" } })).toBe(
        "network-only",
      );
    });

    it("does not intercept an API request at all", async () => {
      sw.setFetch(async () => new Response(JSON.stringify({ data: [] })));

      // No respondWith means the browser handles it: no cache lookup, no stale answer.
      await expect(sw.request("/api/expenses")).resolves.toBeUndefined();
      expect(sw.caches.stores.size).toBe(0);
    });

    it("never stores an API response, even after a successful fetch", async () => {
      sw.setFetch(async () => new Response("{}", { headers: { "content-type": "text/json" } }));

      await sw.request("/api/sync/pull?cursor=abc");

      const names = await sw.caches.keys();
      expect(names).toEqual([]);
    });
  });

  describe("method and origin", () => {
    it.each(["POST", "PUT", "PATCH", "DELETE"])("%s is network-only", (method) => {
      expect(strategyFor("/dashboard", { method })).toBe("network-only");
    });

    it("leaves another origin alone", () => {
      const request = new Request("https://elsewhere.test/style.css");
      expect(sw.internals.decideStrategy(request, ORIGIN)).toBe("network-only");
    });

    it("treats a flight payload request as network-only", () => {
      // Serving a stale RSC payload would render a stale screen inside a fresh app.
      expect(strategyFor("/transactions?_rsc=a1b2")).toBe("network-only");
    });

    it("does not cache on-demand optimised images", () => {
      expect(strategyFor("/_next/image?url=%2Ficons%2Ficon-192.png&w=64&q=75")).toBe(
        "network-only",
      );
    });
  });

  describe("assets", () => {
    it("serves content-hashed build output cache-first", () => {
      expect(strategyFor("/_next/static/chunks/main-abc123.js")).toBe("cache-first");
      expect(sw.internals.isImmutableAsset("/_next/static/css/x.css")).toBe(true);
      expect(sw.internals.isImmutableAsset("/icons/icon.svg")).toBe(false);
    });

    it.each(["/icons/icon-192.png", "/manifest.webmanifest", "/favicon.ico"])(
      "%s is stale-while-revalidate",
      (path) => {
        expect(strategyFor(path)).toBe("stale-while-revalidate");
      },
    );

    it("serves a cached asset without waiting for the network", async () => {
      sw.setFetch(async () => new Response("first", { status: 200 }));
      await sw.request("/icons/icon-192.png");

      sw.setFetch(async () => new Response("second", { status: 200 }));
      const second = await sw.request("/icons/icon-192.png");

      expect(await second!.text()).toBe("first");
    });

    it("returns a cached chunk without a second network call", async () => {
      let calls = 0;
      sw.setFetch(async () => {
        calls += 1;
        return new Response("chunk", { status: 200 });
      });

      await sw.request("/_next/static/chunks/main-abc123.js");
      await sw.request("/_next/static/chunks/main-abc123.js");

      expect(calls).toBe(1);
    });

    it("does not cache a failed asset response", async () => {
      sw.setFetch(async () => new Response("nope", { status: 404 }));

      const response = await sw.request("/_next/static/chunks/missing.js");

      expect(response!.status).toBe(404);
      const cache = await sw.caches.open(sw.internals.CACHE_NAMES.static);
      expect(await cache.keys()).toEqual([]);
    });
  });

  describe("navigation", () => {
    it.each(["/dashboard", "/transactions", "/accounts", "/people", "/login"])(
      "%s uses the navigation strategy",
      (path) => {
        expect(strategyFor(path, { headers: { accept: "text/html" } })).toBe("navigation");
      },
    );

    it("prefers the network when online", async () => {
      sw.setFetch(async () => htmlResponse("<title>fresh</title>"));

      const response = await sw.navigate("/dashboard");

      // Financial figures must be current whenever they can be, so cache-first is wrong
      // here even though it would be faster.
      expect(await response!.text()).toContain("fresh");
    });

    it("falls back to the cached page when the network fails", async () => {
      sw.setFetch(async () => htmlResponse("<title>cached dashboard</title>"));
      await sw.navigate("/dashboard");

      sw.setFetch(async () => {
        throw new TypeError("Failed to fetch");
      });
      const offlineResponse = await sw.navigate("/dashboard");

      expect(await offlineResponse!.text()).toContain("cached dashboard");
    });

    it("redirects to the offline page for a URL that was never visited", async () => {
      sw.setFetch(async (request) =>
        request.url.endsWith("/offline")
          ? htmlResponse("<title>offline page</title>")
          : new Response("", { status: 404 }),
      );
      await sw.install();

      sw.setFetch(async () => {
        throw new TypeError("Failed to fetch");
      });
      const response = await sw.navigate("/accounts/unseen");

      /*
       * A redirect, not the offline document served under /accounts/unseen. Returning the
       * markup directly leaves the App Router hydrating a document for one route while the
       * address bar shows another, which throws a client-side exception and replaces the
       * friendly page with "Application error". Verified in the browser before this
       * changed — see docs/updates/GROUP-16-PWA.md.
       */
      expect(response!.status).toBe(302);
      expect(response!.headers.get("location")).toBe(`${ORIGIN}/offline`);
    });

    it("serves the cached offline page when it is the one being requested", async () => {
      sw.setFetch(async () => htmlResponse("<title>offline page</title>"));
      await sw.install();

      sw.setFetch(async () => {
        throw new TypeError("Failed to fetch");
      });
      const response = await sw.navigate("/offline");

      expect(await response!.text()).toContain("offline page");
    });

    it("does not redirect a failed request for the offline page itself", async () => {
      // Nothing precached. Redirecting here would send the browser to /offline, fail again,
      // and redirect again.
      sw.setFetch(async () => {
        throw new TypeError("Failed to fetch");
      });

      const response = await sw.navigate("/offline");

      expect(response!.status).toBe(503);
      expect(response!.headers.get("location")).toBeNull();
    });

    it("never answers a filtered list with the unfiltered one", async () => {
      sw.setFetch(async () => htmlResponse("<title>all transactions</title>"));
      await sw.navigate("/transactions");

      sw.setFetch(async (request) =>
        request.url.endsWith("/offline")
          ? htmlResponse("<title>offline page</title>")
          : Promise.reject(new TypeError("Failed to fetch")),
      );
      // Serving the unfiltered document under a filtered URL would put a filtered heading
      // over unfiltered figures, which for money is a wrong answer rather than a stale one.
      const filtered = await sw.navigate("/transactions?accountId=abc");

      expect(await filtered!.text()).not.toContain("all transactions");
    });

    it("always produces a response, even with an empty cache", async () => {
      sw.setFetch(async () => {
        throw new TypeError("Failed to fetch");
      });

      // Never a rejected promise: that would surface as the browser's own network error
      // page, which is the thing the offline route exists to avoid.
      const response = await sw.navigate("/dashboard");

      expect(response).toBeDefined();
      expect(response!.status).toBe(302);
    });
  });

  describe("which navigation responses may be stored", () => {
    /**
     * `isCacheableNavigationResponse` only reads `status`, `redirected`, `type` and
     * `headers`, so a literal describes each case far more clearly than constructing a
     * real Response — `redirected` in particular is read-only on a genuine one.
     */
    const shape = (fields: {
      status: number;
      redirected?: boolean;
      type?: string;
      contentType?: string;
    }) => ({
      status: fields.status,
      redirected: fields.redirected ?? false,
      type: fields.type ?? "basic",
      headers: new Headers({ "content-type": fields.contentType ?? "text/html; charset=utf-8" }),
    });

    it("stores a plain 200 HTML document", () => {
      expect(sw.internals.isCacheableNavigationResponse(shape({ status: 200 }))).toBe(true);
    });

    it("refuses a redirected response", () => {
      // fetch() follows redirects, so an unauthenticated /dashboard request resolves to the
      // login document. Storing it under the /dashboard key would serve login as the
      // dashboard from then on.
      expect(
        sw.internals.isCacheableNavigationResponse(shape({ status: 200, redirected: true })),
      ).toBe(false);
    });

    it("refuses a 302", () => {
      expect(sw.internals.isCacheableNavigationResponse(shape({ status: 302 }))).toBe(false);
    });

    it("refuses a 401", () => {
      expect(sw.internals.isCacheableNavigationResponse(shape({ status: 401 }))).toBe(false);
    });

    it("refuses a 500", () => {
      expect(sw.internals.isCacheableNavigationResponse(shape({ status: 500 }))).toBe(false);
    });

    it("refuses an opaque redirect", () => {
      expect(
        sw.internals.isCacheableNavigationResponse(shape({ status: 0, type: "opaqueredirect" })),
      ).toBe(false);
    });

    it("refuses a body that is not HTML", () => {
      expect(
        sw.internals.isCacheableNavigationResponse(
          shape({ status: 200, contentType: "application/json" }),
        ),
      ).toBe(false);
    });

    it("does not cache a login redirect under the requested URL", async () => {
      sw.setFetch(async () => {
        const response = htmlResponse("<title>sign in</title>");
        Object.defineProperty(response, "redirected", { value: true });
        return response;
      });

      await sw.navigate("/dashboard");

      const cache = await sw.caches.open(sw.internals.CACHE_NAMES.pages);
      expect(await cache.keys()).toEqual([]);
    });
  });

  describe("lifecycle", () => {
    it("precaches the offline page and icons on install", async () => {
      sw.setFetch(async () => htmlResponse());

      await sw.install();

      const cache = await sw.caches.open(sw.internals.CACHE_NAMES.shell);
      const keys = await cache.keys();
      expect(keys).toContain(`${ORIGIN}/offline`);
      expect(keys).toContain(`${ORIGIN}/manifest.webmanifest`);
      expect(keys.length).toBe(sw.internals.PRECACHE_URLS.length);
    });

    it("still installs when one precache entry is missing", async () => {
      sw.setFetch(async (request) =>
        request.url.includes("apple-touch-icon")
          ? new Response("", { status: 404 })
          : htmlResponse(),
      );

      await expect(sw.install()).resolves.toBeUndefined();

      const cache = await sw.caches.open(sw.internals.CACHE_NAMES.shell);
      expect(await cache.keys()).toContain(`${ORIGIN}/offline`);
      expect(await cache.keys()).not.toContain(`${ORIGIN}/icons/apple-touch-icon.png`);
    });

    it("refuses to precache a redirected response", async () => {
      // Otherwise an install that happened while signed out would store the login document
      // as the offline page, and the fallback would ask the user to sign in for ever.
      sw.setFetch(async () => {
        const response = htmlResponse("<title>sign in</title>");
        Object.defineProperty(response, "redirected", { value: true });
        return response;
      });

      await sw.install();

      const cache = await sw.caches.open(sw.internals.CACHE_NAMES.shell);
      expect(await cache.keys()).toEqual([]);
    });

    it("caches the scripts the offline page needs to run", async () => {
      // Fetching a document does not fetch its subresources, so without this step /offline
      // is cached while every chunk it references is not: the page renders and is then
      // replaced by Next's client-side error screen.
      const offlineHtml =
        '<!doctype html><html><head><link rel="stylesheet" href="/_next/static/css/app.css"/>' +
        '<script src="/_next/static/chunks/main-abc.js"></script></head><body></body></html>';

      sw.setFetch(async (request) =>
        request.url.endsWith("/offline")
          ? new Response(offlineHtml, { headers: { "content-type": "text/html" } })
          : new Response("asset", { status: 200 }),
      );

      await sw.install();

      const staticCache = await sw.caches.open(sw.internals.CACHE_NAMES.static);
      const keys = await staticCache.keys();
      expect(keys).toContain(`${ORIGIN}/_next/static/css/app.css`);
      expect(keys).toContain(`${ORIGIN}/_next/static/chunks/main-abc.js`);
    });

    it("caches the self-hosted font files referenced from inside the stylesheet", async () => {
      /*
       * The shape below is what a real build produces, and it is not the obvious shape.
       * `next/font` puts no /_next/static/media/ reference in the document at all — only a
       * stylesheet link — and the @font-face rules with the font URLs live inside that
       * stylesheet. Extracting from the HTML alone therefore stops one level short, and the
       * browser's request for each face fails offline.
       *
       * Checked against .next/server/app/offline.html and its stylesheet from
       * `npm run build`; see docs/design-tasks/updates/GROUP-22-TYPOGRAPHY.md.
       */
      const offlineHtml =
        "<!doctype html><html><head>" +
        '<link rel="stylesheet" href="/_next/static/css/app.css"/>' +
        '<script src="/_next/static/chunks/main-abc.js"></script>' +
        "</head><body></body></html>";

      const stylesheet =
        "@font-face{font-family:Space Grotesk;font-weight:600;" +
        "src:url(/_next/static/media/space-grotesk-600.p.woff2) format('woff2')}" +
        "@font-face{font-family:Manrope;font-weight:400;" +
        "src:url(/_next/static/media/manrope-400.p.woff2) format('woff2')}" +
        "@font-face{font-family:IBM Plex Mono;font-weight:500;" +
        "src:url(/_next/static/media/ibm-plex-mono-500.p.woff2) format('woff2')}";

      sw.setFetch(async (request) => {
        if (request.url.endsWith("/offline")) {
          return new Response(offlineHtml, { headers: { "content-type": "text/html" } });
        }
        if (request.url.endsWith("/app.css")) {
          return new Response(stylesheet, { headers: { "content-type": "text/css" } });
        }
        return new Response("asset", { status: 200 });
      });

      await sw.install();

      const keys = await (await sw.caches.open(sw.internals.CACHE_NAMES.static)).keys();
      expect(keys).toContain(`${ORIGIN}/_next/static/media/space-grotesk-600.p.woff2`);
      expect(keys).toContain(`${ORIGIN}/_next/static/media/manrope-400.p.woff2`);
      expect(keys).toContain(`${ORIGIN}/_next/static/media/ibm-plex-mono-500.p.woff2`);
    });

    it("serves a cached font file without going to the network", async () => {
      // Font files live under /_next/static/, so they are immutable and cache-first. If
      // this ever became network-only the precache above would be dead weight.
      expect(
        sw.internals.decideStrategy(
          new Request(new URL("/_next/static/media/manrope-400.p.woff2", ORIGIN)),
          ORIGIN,
        ),
      ).toBe("cache-first");
    });

    it("survives a stylesheet it cannot read", async () => {
      // A font that fails to precache costs the right typeface offline, not the app.
      sw.setFetch(async (request) =>
        request.url.endsWith("/offline")
          ? new Response('<link rel="stylesheet" href="/_next/static/css/app.css"/>', {
              headers: { "content-type": "text/html" },
            })
          : new Response("", { status: 404 }),
      );

      await expect(sw.install()).resolves.toBeUndefined();
    });

    it("extracts asset paths from markup and inline payloads without duplicates", () => {
      const html =
        '<script src="/_next/static/chunks/a.js"></script>' +
        '<link href="/_next/static/css/b.css">' +
        '<script>self.__next_f.push([1,"\\"/_next/static/chunks/c.js\\""])</script>' +
        '<script src="/_next/static/chunks/a.js"></script>';

      expect(sw.internals.extractStaticAssetUrls(html)).toEqual([
        "/_next/static/chunks/a.js",
        "/_next/static/css/b.css",
        "/_next/static/chunks/c.js",
      ]);
    });

    it("does not activate itself on install", async () => {
      sw.setFetch(async () => htmlResponse());

      await sw.install();

      // Swapping the shell under a half-entered expense is exactly what must not happen;
      // the client offers a reload instead.
      expect(sw.skipWaitingCalls).toBe(0);
    });

    it("deletes caches from an older version on activate", async () => {
      await sw.caches.open(`${CACHE_NAME_PREFIX}pages-v0`);
      await sw.caches.open(`${CACHE_NAME_PREFIX}static-v0`);
      await sw.caches.open(sw.internals.CACHE_NAMES.pages);

      await sw.activate();

      const names = await sw.caches.keys();
      expect(names).toEqual([sw.internals.CACHE_NAMES.pages]);
      expect(sw.claimCalls).toBe(1);
    });

    it("leaves caches belonging to other applications alone", async () => {
      await sw.caches.open("some-other-app-cache");

      await sw.activate();

      expect(await sw.caches.has("some-other-app-cache")).toBe(true);
    });

    it("names every cache after the current version", () => {
      for (const name of Object.values(sw.internals.CACHE_NAMES)) {
        expect(name.startsWith(CACHE_NAME_PREFIX)).toBe(true);
        expect(name.endsWith(sw.internals.VERSION)).toBe(true);
      }
    });
  });

  describe("messages", () => {
    it("activates on request", async () => {
      await sw.message({ type: SERVICE_WORKER_MESSAGES.skipWaiting });
      expect(sw.skipWaitingCalls).toBe(1);
    });

    it("clears cached pages but keeps the shell and build output", async () => {
      sw.setFetch(async () => htmlResponse());
      await sw.install();
      await sw.navigate("/dashboard");
      await sw.request("/_next/static/chunks/main.js");

      const acknowledgements = await sw.message({
        type: SERVICE_WORKER_MESSAGES.clearPrivateCaches,
      });

      // Rendered HTML holds balances and descriptions, so it must not outlive the session
      // on a shared device. Icons and chunks hold nothing personal, and dropping them
      // would leave the next user unable to start offline.
      expect(await sw.caches.has(sw.internals.CACHE_NAMES.pages)).toBe(false);
      expect(await sw.caches.has(sw.internals.CACHE_NAMES.shell)).toBe(true);
      expect(await sw.caches.has(sw.internals.CACHE_NAMES.static)).toBe(true);
      expect(acknowledgements).toEqual([{ type: SERVICE_WORKER_MESSAGES.privateCachesCleared }]);
    });

    it("ignores an unknown message", async () => {
      await expect(sw.message({ type: "NOT_A_REAL_MESSAGE" })).resolves.toEqual([]);
      await expect(sw.message(null)).resolves.toEqual([]);
      expect(sw.skipWaitingCalls).toBe(0);
    });
  });

  describe("contract with the client module", () => {
    /*
     * The worker is a classic script and cannot import from src/, so these constants are
     * declared twice. A mismatch would be silent at runtime — the worker would simply
     * ignore a postMessage it did not recognise — which is why it is asserted here.
     */
    it("agrees with src/offline/pwa/service-worker.ts on the message vocabulary", () => {
      expect(sw.internals.MESSAGES).toEqual({
        skipWaiting: SERVICE_WORKER_MESSAGES.skipWaiting,
        clearPrivateCaches: SERVICE_WORKER_MESSAGES.clearPrivateCaches,
        privateCachesCleared: SERVICE_WORKER_MESSAGES.privateCachesCleared,
      });
    });

    it("agrees on the cache name prefixes", () => {
      expect(sw.internals.CACHE_PREFIX).toBe(CACHE_NAME_PREFIX);
      // The client deletes private caches by prefix when no worker is controlling the page.
      expect(sw.internals.CACHE_NAMES.pages.startsWith(PRIVATE_CACHE_PREFIX)).toBe(true);
    });

    it("precaches the offline route the fallback page is served from", () => {
      expect(sw.internals.OFFLINE_URL).toBe("/offline");
      expect(sw.internals.PRECACHE_URLS).toContain("/offline");
    });
  });
});

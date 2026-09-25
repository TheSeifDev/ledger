// Route tests: the real Next.js server against the development database.
//
// Spawns `next start` (requires `npm run build` first), then exercises
// the public HTTP contract: protected routes, redirects, session
// cookies, sign-in/sign-out over /api/auth, and the absence of any
// public sign-up path.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { once } from "node:events";
import net from "node:net";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import {
  closePool,
  getPool,
  provisionFixture,
  resetFixture,
  ROUTES_FIXTURE,
  sessionCookiePairsFrom,
} from "./helpers.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const BUILD_ID = path.join(ROOT, ".next", "BUILD_ID");

let server: ReturnType<typeof spawn> | null = null;
let baseUrl = "";

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

async function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url, { redirect: "manual" });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`server did not become ready at ${url}`);
}

before(async () => {
  if (!existsSync(BUILD_ID)) {
    throw new Error(
      "No production build found (.next/BUILD_ID). Run `npm run build` before the route tests.",
    );
  }

  await resetFixture(ROUTES_FIXTURE);

  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;

  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, BETTER_AUTH_URL: baseUrl },
  });
  server.stdout!.on("data", () => {});
  server.stderr!.on("data", () => {});

  await waitForServer(`${baseUrl}/login`);
});

after(async () => {
  if (server) {
    server.kill("SIGTERM");
    await once(server, "exit").catch(() => {});
    server = null;
  }
  await resetFixture(ROUTES_FIXTURE);
  await closePool();
});

// Better Auth rate-limits /sign-in at 3 requests / 10 s per client IP.
// The test client supplies a distinct x-forwarded-for per call — the
// header Better Auth resolves client IPs from — so the suite is
// deterministic without touching the app's rate-limit configuration.
let clientIpCounter = 1;
function nextClientIp(): string {
  return `198.51.100.${(clientIpCounter++ % 250) + 1}`;
}

async function signInViaHttp(): Promise<{ cookie: string; token: string }> {
  const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: baseUrl,
      "x-forwarded-for": nextClientIp(),
    },
    body: JSON.stringify({
      email: ROUTES_FIXTURE.email,
      password: ROUTES_FIXTURE.password,
    }),
    redirect: "manual",
  });
  const raw = await response.text();
  assert.equal(response.status, 200, raw);
  const cookie = sessionCookiePairsFrom(response);
  assert.ok(cookie, "sign-in must set a session cookie");
  const body = JSON.parse(raw) as { token: string };
  assert.ok(body.token);
  return { cookie, token: body.token };
}

describe("protected routes", () => {
  it("denies /dashboard without a session (redirects to /login)", async () => {
    const response = await fetch(`${baseUrl}/dashboard`, { redirect: "manual" });
    assert.equal(response.status, 307);
    assert.equal(new URL(response.headers.get("location")!, baseUrl).pathname, "/login");
  });

  it("allows /dashboard with a valid session", async () => {
    await provisionFixture(ROUTES_FIXTURE);
    const { cookie } = await signInViaHttp();

    const response = await fetch(`${baseUrl}/dashboard`, {
      headers: { cookie },
      redirect: "manual",
    });
    assert.equal(response.status, 200);
  });
});

describe("redirects", () => {
  it("sends an unauthenticated visitor from / to /login", async () => {
    const response = await fetch(baseUrl, { redirect: "manual" });
    assert.equal(response.status, 307);
    assert.equal(new URL(response.headers.get("location")!, baseUrl).pathname, "/login");
  });

  it("sends an authenticated user from / to /dashboard", async () => {
    await provisionFixture(ROUTES_FIXTURE);
    const { cookie } = await signInViaHttp();

    const response = await fetch(baseUrl, {
      headers: { cookie },
      redirect: "manual",
    });
    assert.equal(response.status, 307);
    assert.equal(new URL(response.headers.get("location")!, baseUrl).pathname, "/dashboard");
  });

  it("redirects an authenticated user away from /login instead of a second form", async () => {
    await provisionFixture(ROUTES_FIXTURE);
    const { cookie } = await signInViaHttp();

    const response = await fetch(`${baseUrl}/login`, {
      headers: { cookie },
      redirect: "manual",
    });
    assert.equal(response.status, 307);
    assert.equal(new URL(response.headers.get("location")!, baseUrl).pathname, "/dashboard");
  });
});

describe("login over HTTP", () => {
  it("rejects invalid credentials without granting a session", async () => {
    await provisionFixture(ROUTES_FIXTURE);

    const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: baseUrl,
        "x-forwarded-for": nextClientIp(),
      },
      body: JSON.stringify({
        email: ROUTES_FIXTURE.email,
        password: "definitely-wrong",
      }),
      redirect: "manual",
    });
    assert.equal(response.status, 401);

    const cookie = sessionCookiePairsFrom(response);
    const dashboard = await fetch(`${baseUrl}/dashboard`, {
      headers: cookie ? { cookie } : {},
      redirect: "manual",
    });
    assert.equal(dashboard.status, 307);
    assert.equal(new URL(dashboard.headers.get("location")!, baseUrl).pathname, "/login");
  });
});

describe("logout over HTTP", () => {
  it("invalidates the session; the old cookie cannot reach protected routes", async () => {
    await provisionFixture(ROUTES_FIXTURE);
    const { cookie, token } = await signInViaHttp();

    let dashboard = await fetch(`${baseUrl}/dashboard`, {
      headers: { cookie },
      redirect: "manual",
    });
    assert.equal(dashboard.status, 200);

    // Better Auth's HTTP contract parses POST bodies as JSON — its own
    // client always sends at least "{}" — so the request must carry one.
    const signOut = await fetch(`${baseUrl}/api/auth/sign-out`, {
      method: "POST",
      headers: { cookie, origin: baseUrl, "content-type": "application/json" },
      body: JSON.stringify({}),
      redirect: "manual",
    });
    assert.ok(signOut.ok, await signOut.text());

    const { rows } = await getPool().query(
      `select count(*)::int as count from "session" where token = $1`,
      [token],
    );
    assert.equal(rows[0].count, 0, "sign-out must delete the session row server-side");

    dashboard = await fetch(`${baseUrl}/dashboard`, {
      headers: { cookie },
      redirect: "manual",
    });
    assert.equal(dashboard.status, 307);
    assert.equal(new URL(dashboard.headers.get("location")!, baseUrl).pathname, "/login");
  });
});

describe("no public account creation", () => {
  it("rejects sign-up attempts at the API level", async () => {
    const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl },
      body: JSON.stringify({
        email: "should-not-exist@ledger.test",
        password: "should-not-matter",
        name: "Rejected",
      }),
      redirect: "manual",
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, "EMAIL_PASSWORD_SIGN_UP_DISABLED");
  });

  it("serves no sign-up, register, or password-reset pages", async () => {
    for (const pathname of ["/signup", "/register", "/forgot-password"]) {
      const response = await fetch(`${baseUrl}${pathname}`, { redirect: "manual" });
      assert.equal(response.status, 404, `${pathname} must not exist`);
    }
  });
});

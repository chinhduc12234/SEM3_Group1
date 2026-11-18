// Run against the local Docker Compose stack. Only synthetic accounts and sessions are used.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const env = Object.fromEntries(readFileSync(new URL("../.env", import.meta.url), "utf8")
  .replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => /^[A-Z0-9_]+=/.test(line))
  .map(line => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]));
const port = Number(env.WEB_PORT || 8080);
assert(Number.isInteger(port) && port >= 1 && port <= 65535);
const root = `http://localhost:${port}`;
const cookieName = "giveaid_refresh";
const email = `auth-check-${randomUUID()}@example.test`;
const password = `Auth1!${randomUUID()}`;
const newPassword = `Auth2!${randomUUID()}`;
const headers = { "X-Requested-With": "GiveAid" };
const cookies = new Set();

async function request(path, status, { body, cookie, token, method = body ? "POST" : "GET", extra = headers } = {}) {
  const response = await fetch(root + path, {
    method,
    headers: {
      ...extra,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.equal(response.status, status, `${method} ${path}`);
  return response;
}

async function session(response) {
  const directive = response.headers.getSetCookie().find(value => value.startsWith(`${cookieName}=`));
  assert(directive && /; httponly\b/i.test(directive) && /; samesite=strict\b/i.test(directive));
  assert(/; path=\/api\/auth(?:;|$)/i.test(directive) && !/; domain=/i.test(directive));
  assert(!/; (?:expires|max-age)=/i.test(directive));
  const { accessToken, user } = await response.json();
  const cookie = directive.split(";", 1)[0];
  cookies.add(cookie);
  return { cookie, accessToken, user };
}

function guid(value) {
  assert.match(value, /^[a-f0-9-]{36}$/i);
  return value;
}

function sql(statement) {
  execFileSync("docker", ["compose", "exec", "-T", "-e", "SQLCMDPASSWORD", "sqlserver",
    "/opt/mssql-tools18/bin/sqlcmd", "-S", "localhost", "-U", "sa", "-C", "-b", "-I", "-d", "GiveAid_Identity", "-Q", statement], {
    env: { ...process.env, SQLCMDPASSWORD: env.SQL_SA_PASSWORD },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

const login = (currentPassword = password) => request("/api/auth/login", 200, {
  body: { email, password: currentPassword },
});
const refresh = (cookie, status = 200) => request("/api/auth/refresh", status, { method: "POST", cookie });
const me = (token, status = 200) => request("/api/auth/me", status, { token });

async function restartIdentity() {
  execFileSync("docker", ["compose", "restart", "identity"], { stdio: "ignore" });
  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await fetch(root + "/health/identity", { signal: AbortSignal.timeout(1500) }).catch(() => null);
    if (response?.ok) return;
    await delay(500);
  }
  throw new Error("Local IdentityService did not return after restart");
}

async function checkApi() {
  await Promise.all([email, `auth-check-concurrent-${randomUUID()}@example.test`].map(address =>
    request("/api/auth/register", 201, { body: { email: address, password, fullName: "Local authentication check" } })));
  await request("/api/auth/login", 401, { body: { email, password: "Wrong-test-password!" } });
  await me(undefined, 401);
  await refresh(`${cookieName}=invalid`, 401);
  await request("/api/auth/refresh", 403, { method: "POST", extra: {} });
  await request("/api/auth/login", 403, { body: { email, password }, extra: { ...headers, "Sec-Fetch-Site": "cross-site" } });

  const first = await session(await login());
  const second = await session(await login());
  if (process.env.GIVEAID_TEST_RESTART_IDENTITY === "1") {
    await restartIdentity();
    await me(second.accessToken);
    console.log("PASS local IdentityService restart: the session remains valid");
  }
  const refreshed = await session(await refresh(second.cookie));
  assert(refreshed.cookie !== second.cookie);
  await refresh(second.cookie, 401);
  await request("/api/organizations", 403, { token: refreshed.accessToken });
  const logout = await request("/api/auth/logout", 204, { method: "POST", cookie: refreshed.cookie, token: first.accessToken });
  assert(logout.headers.getSetCookie().some(value => value.startsWith(`${cookieName}=;`) && /; expires=/i.test(value)));
  await me(refreshed.accessToken, 401);
  await refresh(refreshed.cookie, 401);
  await me(first.accessToken);

  const another = await session(await login());
  await request("/api/auth/password", 400, { token: another.accessToken, body: { currentPassword: "Wrong-test-password!", newPassword } });
  await request("/api/auth/password", 204, { token: another.accessToken, body: { currentPassword: password, newPassword } });
  await me(another.accessToken, 401);
  await me(first.accessToken, 401);
  await refresh(another.cookie, 401);
  await refresh(first.cookie, 401);
  await request("/api/auth/login", 401, { body: { email, password } });

  const expiring = await session(await login(newPassword));
  const claims = JSON.parse(Buffer.from(expiring.accessToken.split(".")[1], "base64url"));
  const sessionId = guid(claims.sid);
  const userId = guid(expiring.user.id);
  sql(`IF NOT EXISTS (SELECT 1 FROM RefreshSessions WHERE Id='${sessionId}' AND UserId='${userId}'
      AND ExpiresAt BETWEEN DATEADD(hour, 11, SYSUTCDATETIME()) AND DATEADD(hour, 12, SYSUTCDATETIME()))
      THROW 51000, 'Unexpected ordinary session lifetime.', 1;
      UPDATE RefreshSessions SET ExpiresAt=DATEADD(second, -1, SYSUTCDATETIME()) WHERE Id='${sessionId}' AND UserId='${userId}';`);
  await refresh(expiring.cookie, 401);
  await me(expiring.accessToken, 401);
  const deactivated = await session(await login(newPassword));
  sql(`UPDATE AspNetUsers SET IsActive=0 WHERE Id='${userId}';`);
  try {
    await refresh(deactivated.cookie, 401);
    await me(deactivated.accessToken, 401);
    await request("/api/auth/login", 401, { body: { email, password: newPassword } });
  } finally {
    sql(`UPDATE AspNetUsers SET IsActive=1 WHERE Id='${userId}';`);
  }
  console.log("PASS API: cookie lifetimes, renewal, protected access, CSRF checks, logout, password change, expiration and deactivation");
}

async function checkBrowser(modulePath) {
  const { chromium } = createRequire(import.meta.url)(resolve(modulePath));
  const profile = mkdtempSync(join(tmpdir(), "giveaid-auth-test-"));
  const options = { channel: "chrome", locale: "en-US", viewport: { width: 1600, height: 900 } };
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, options);
    const page = context.pages()[0];
    await page.route("**/api/auth/refresh", route => route.fulfill({ status: 503 }), { times: 1 });
    await page.goto(root + "/login");
    await page.getByRole("button", { name: "Thử lại" }).click();
    const identifier = page.locator("#login-email");
    const secret = page.locator("#login-password");
    await identifier.waitFor();
    assert.equal(await identifier.getAttribute("autocomplete"), "username");
    assert.equal(await secret.getAttribute("autocomplete"), "current-password");
    assert.equal(await secret.inputValue(), "");
    assert.equal(await page.locator("#login-form input[type=checkbox]").count(), 0);
    for (const width of [1600, 900, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const { x, width: controlWidth } = await identifier.boundingBox();
      assert(x >= 0 && x + controlWidth <= width);
    }
    await page.setViewportSize(options.viewport);
    assert.equal(await identifier.locator("xpath=ancestor::form").getAttribute("method"), "post");
    await identifier.fill(email);
    await secret.fill(newPassword);
    const show = page.getByRole("button", { name: "Hiện mật khẩu" });
    await show.press("Space");
    assert.equal(await secret.getAttribute("type"), "text");
    await show.press("Space");
    assert.equal(await secret.getAttribute("type"), "password");
    const poll = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname === "/hubs/notifications" && response.request().method() === "GET";
    });
    await secret.press("Enter");
    await page.waitForURL(root + "/");
    const connection = await poll;
    assert.equal(connection.status(), 200);
    assert((await connection.request().headerValue("authorization"))?.startsWith("Bearer "));
    assert(!new URL(connection.url()).searchParams.has("access_token"));
    await page.goto(root + "/account/security");
    const current = page.locator("#account-current-password");
    await current.waitFor();
    assert.equal(await current.getAttribute("autocomplete"), "current-password");
    assert.equal(await page.locator("#account-new-password").getAttribute("autocomplete"), "new-password");
    await page.reload();
    await current.waitFor();
    const cookie = (await context.cookies(root + "/api/auth/refresh")).find(value => value.name === cookieName);
    assert(cookie?.httpOnly && cookie.expires === -1);
    const second = await context.newPage();
    await second.goto(root + "/account/security");
    await second.locator("#account-current-password").waitFor();
    await page.getByRole("button", { name: "Đăng xuất" }).first().click();
    await second.waitForURL(root + "/login");
    await second.goto(root + "/register");
    assert.equal(await second.locator("#register-password").getAttribute("autocomplete"), "new-password");
    console.log("PASS Chrome: form semantics, keyboard, retry, session cookie, reload and logout across tabs");
  } finally {
    if (context) {
      await context.request.post(root + "/api/auth/logout", { headers }).catch(() => {});
      await context.close();
    }
    if (resolve(profile).startsWith(resolve(tmpdir()) + sep + "giveaid-auth-test-")) {
      rmSync(profile, { recursive: true, force: true });
    }
  }
}

try {
  await checkApi();
  if (process.env.GIVEAID_PLAYWRIGHT_MODULE) await checkBrowser(process.env.GIVEAID_PLAYWRIGHT_MODULE);
  else console.log("SKIP Chrome: set GIVEAID_PLAYWRIGHT_MODULE to the absolute path of playwright-core");
} finally {
  for (const cookie of cookies) {
    await fetch(root + "/api/auth/logout", { method: "POST", headers: { ...headers, Cookie: cookie } }).catch(() => {});
  }
}

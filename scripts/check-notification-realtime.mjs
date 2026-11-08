// Real SignalR connections through the gateway. No browser credentials or private keys are logged.
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import signalr from "../frontend/node_modules/@microsoft/signalr/dist/cjs/index.js";
const { HubConnectionBuilder, LogLevel } = signalr;
const env = Object.fromEntries(fs.readFileSync(new URL("../.env", import.meta.url), "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter(x => x && !x.startsWith("#") && x.includes("=")).map(x => [x.slice(0, x.indexOf("=")), x.slice(x.indexOf("=") + 1)]));
const root = `http://localhost:${env.WEB_PORT || 8080}`;
const password = "Ga1!" + randomUUID();
const users = [], sessions = [], connections = [], org = randomUUID(), eventIds = [];
const sql = (db, statement) => execFileSync("docker", ["exec", "-e", "SQLCMDPASSWORD", "give-aid-sqlserver-1", "/opt/mssql-tools18/bin/sqlcmd", "-S", "localhost", "-U", "sa", "-C", "-b", "-I", "-d", db, "-Q", statement], { env: { ...process.env, SQLCMDPASSWORD: env.SQL_SA_PASSWORD }, stdio: ["ignore", "pipe", "pipe"] });
async function request(path, body, token) {
  const r = await fetch(root + path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", "X-Requested-With": "GiveAid", ...(token ? { Authorization: "Bearer " + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.ok(r.ok, "HTTP " + r.status + " " + path); return r.json();
}
async function login(email, password) {
  const session = await request("/api/auth/login", { email, password });
  sessions.push(JSON.parse(Buffer.from(session.accessToken.split(".")[1], "base64url")));
  return session;
}
async function register(name) {
  const email = `realtime-${name}-${randomUUID()}@example.test`;
  await request("/api/auth/register", { email, fullName: "Realtime " + name, password });
  const session = await login(email, password); users.push(session.user.id); return session;
}
function connection(token, origin) {
  const c = new HubConnectionBuilder().withUrl(root + "/hubs/notifications", { accessTokenFactory: () => token, headers: { "X-Requested-With": "GiveAid", ...(origin ? { Origin: origin } : {}) } }).configureLogging(LogLevel.None).build();
  connections.push(c); return c;
}
function emit(action, recipient) {
  const event = { eventId: randomUUID(), organizationId: org, applicantUserId: recipient, action, organizationName: "Synthetic realtime test", occurredAt: new Date().toISOString() }; eventIds.push(event.eventId);
  const code = "let s='';for await(const c of process.stdin)s+=c;const x=JSON.parse(s);const r=await fetch('http://notification:8080/internal/notifications/organization-events',{method:'POST',headers:{'Content-Type':'application/json','X-Internal-Key':x.key},body:JSON.stringify(x.event)});if(r.status!==204)throw Error('Event HTTP '+r.status);";
  execFileSync("docker", ["exec", "-i", "give-aid-web-1", "node", "--input-type=module", "-e", code], { input: JSON.stringify({ key: env.INTERNAL_API_KEY, event }), stdio: ["pipe", "pipe", "pipe"] });
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(predicate) { for (let i = 0; i < 60; i++) { if (predicate()) return; await delay(100); } throw Error("Realtime event not received"); }
try {
  const admin = await login(env.ADMIN_EMAIL, env.ADMIN_PASSWORD), owner = await register("owner"), other = await register("other");
  const ac = connection(admin.accessToken), uc = connection(owner.accessToken), oc = connection(other.accessToken);
  let admins = 0, owners = 0, others = 0;
  ac.on("notificationsChanged", (...args) => { assert.equal(args.length, 0); admins++; });
  uc.on("notificationsChanged", (...args) => { assert.equal(args.length, 0); owners++; });
  oc.on("notificationsChanged", () => others++);
  await Promise.all([ac.start(), uc.start(), oc.start()]);
  await assert.rejects(connection("").start());
  await assert.rejects(connection(owner.accessToken, "https://evil.example").start());
  emit("SUBMITTED", owner.user.id);
  await waitFor(() => admins > 0); await delay(300);
  assert.equal(owners, 0); assert.equal(others, 0);
  emit("APPROVE", owner.user.id);
  await waitFor(() => owners > 0); await delay(300);
  assert.equal(others, 0);
  const inbox = await request("/api/notifications", null, owner.accessToken);
  assert.ok(inbox.items.some(x => x.kind === "APPROVE" && x.url === `/organizations/${org}/manage`));
  console.log("PASS: real SignalR gateway connections, admin/owner routing, payload-free invalidation, anonymous denial and cross-origin denial.");
} finally {
  await Promise.allSettled(connections.map(c => c.stop()));
  sql("GiveAid_Notification", `DELETE FROM ReceivedEvents WHERE Id IN (SELECT EventId FROM Notifications WHERE OrganizationId='${org}'); DELETE FROM Notifications WHERE OrganizationId='${org}';`);
  for (const session of sessions) {
    execFileSync("docker", ["exec", "give-aid-redis-1", "redis-cli", "DEL", "auth:session:" + session.sid.replaceAll("-", "")], { stdio: "ignore" });
    sql("GiveAid_Identity", `DELETE FROM RefreshSessions WHERE Id='${session.sid}';`);
  }
  for (const id of users) sql("GiveAid_Identity", `DELETE FROM RefreshSessions WHERE UserId='${id}'; DELETE FROM AspNetUsers WHERE Id='${id}';`);
}

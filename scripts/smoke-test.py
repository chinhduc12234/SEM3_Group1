"""Integration tests against the real gateway + SQL Server. No external dependencies.
Creates uniquely named test accounts (retained for audit), deletes its test products.
Run: python scripts/smoke-test.py [http://localhost:8080]
"""
import base64
import hashlib
import hmac
import json
import pathlib
import sys
import time
import urllib.error
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor

ENV = dict(line.split("=", 1) for line in (pathlib.Path(__file__).resolve().parents[1] / ".env").read_text(encoding="utf-8-sig").splitlines() if line and not line.startswith("#") and "=" in line)
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:" + ENV.get("WEB_PORT", "8080")
passed = 0


def call(method, path, body=None, token=None, cookie=None, protected=True):
    headers = {"Content-Type": "application/json"}
    if protected:
        headers["X-Requested-With"] = "SEM3"
    if token:
        headers["Authorization"] = "Bearer " + token
    if cookie:
        headers["Cookie"] = cookie
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else (b"" if method == "POST" else None), headers=headers, method=method)
    try:
        response = urllib.request.urlopen(req, timeout=20)
    except urllib.error.HTTPError as error:
        response = error
    raw = response.read()
    try:
        data = json.loads(raw) if raw else None
    except json.JSONDecodeError:
        data = None
    return response.status, data, response.headers


def check(name, result, status):
    global passed
    assert result[0] == status, f"{name}: expected {status}, got {result[0]}"
    passed += 1
    print("PASS", name, flush=True)
    return result[1]


def cookie(result):
    return result[2].get("Set-Cookie", "").split(";", 1)[0]


def login(email, password):
    result = call("POST", "/api/auth/login", {"email": email, "password": password})
    return check("login", result, 200), cookie(result)


def signed_token(source, **changes):
    def encode(value):
        return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip("=")
    payload = json.loads(base64.urlsafe_b64decode(source.split(".")[1] + "=="))
    payload.update(changes)
    data = encode({"alg": "HS256", "typ": "JWT"}) + "." + encode(payload)
    signature = base64.urlsafe_b64encode(hmac.new(ENV["JWT_KEY"].encode(), data.encode(), hashlib.sha256).digest()).decode().rstrip("=")
    return data + "." + signature


def main():
    check("identity SQL connection", call("GET", "/health/identity"), 200)
    check("catalog SQL connection", call("GET", "/health/catalog"), 200)
    check("SPA deep link", call("GET", "/admin/users"), 200)
    public = check("public products", call("GET", "/api/products?page=1&pageSize=5"), 200)
    assert len(public["items"]) <= 5 and all(p["isPublished"] for p in public["items"])
    second = check("second page", call("GET", "/api/products?page=2&pageSize=5"), 200)
    assert not set(p["id"] for p in public["items"]) & set(p["id"] for p in second["items"])
    check("invalid page rejected", call("GET", "/api/products?page=0&pageSize=500"), 400)
    check("anonymous users rejected", call("GET", "/api/users"), 401)
    check("internal API hidden", call("GET", "/internal/session"), 404)
    check("CSRF header required", call("POST", "/api/auth/login", {}, protected=False), 403)
    email = f"smoke-{uuid.uuid4().hex[:12]}@example.test"
    password = "Smoke-Test!2026Aa"
    user = check("register always Customer", call("POST", "/api/auth/register", {"email": email, "displayName": "Smoke Test", "password": password, "role": "Admin"}), 201)
    assert user["role"] == "Customer" and "passwordHash" not in user
    check("duplicate email", call("POST", "/api/auth/register", {"email": email.upper(), "displayName": "Smoke Test", "password": password}), 409)
    check("weak password", call("POST", "/api/auth/register", {"email": "weak@example.test", "displayName": "Test", "password": "weak"}), 400)
    check("wrong password", call("POST", "/api/auth/login", {"email": email, "password": "wrong"}), 401)
    customer, refresh = login(email, password)
    token = customer["accessToken"]
    check("current user", call("GET", "/api/auth/me", token=token), 200)
    check("Customer cannot list users", call("GET", "/api/users", token=token), 403)
    product = {"name": "Integration sample", "description": "Temporary smoke test record", "category": "Test", "price": 123000, "isPublished": False}
    check("Customer cannot create products", call("POST", "/api/products", product, token), 403)
    check("tampered JWT rejected", call("GET", "/api/auth/me", token=token[:-8] + "abcdefgh"), 401)
    check("expired JWT rejected", call("GET", "/api/auth/me", token=signed_token(token, exp=int(time.time()) - 120)), 401)
    check("wrong audience rejected", call("GET", "/api/auth/me", token=signed_token(token, aud="wrong")), 401)
    rotated = call("POST", "/api/auth/refresh", cookie=refresh)
    check("refresh rotation", rotated, 200)
    assert "httponly" in rotated[2].get("Set-Cookie").lower() and "samesite=strict" in rotated[2].get("Set-Cookie").lower()
    check("old refresh rejected", call("POST", "/api/auth/refresh", cookie=refresh), 401)
    refresh = cookie(rotated)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: call("POST", "/api/auth/refresh", cookie=refresh), range(2)))
    assert sorted(r[0] for r in results) == [200, 401], "Concurrent refresh must succeed once"
    print("PASS concurrent refresh is single use")
    admin, admin_cookie = login(ENV["ADMIN_EMAIL"], ENV["ADMIN_PASSWORD"])
    admin_token = admin["accessToken"]
    users = check("Admin user pagination", call("GET", "/api/users?page=1&pageSize=5", token=admin_token), 200)
    assert len(users["items"]) <= 5
    check("cannot demote self", call("PATCH", f'/api/users/{admin["user"]["id"]}', {"role": "Customer", "isActive": True}, admin_token), 400)
    check("role allowlist", call("PATCH", f'/api/users/{user["id"]}', {"role": "SuperAdmin", "isActive": True}, admin_token), 400)
    created = check("Admin creates draft", call("POST", "/api/products", product, admin_token), 201)
    path = "/api/products/" + created["id"]
    try:
        check("draft hidden", call("GET", path), 404)
        check("Admin reads draft", call("GET", path, token=admin_token), 200)
        check("negative price rejected", call("PUT", path, {**product, "price": -1}, admin_token), 400)
        check("Admin publishes", call("PUT", path, {**product, "isPublished": True}, admin_token), 200)
        check("public reads published", call("GET", path), 200)
        check("promote account", call("PATCH", f'/api/users/{user["id"]}', {"role": "Admin", "isActive": True}, admin_token), 200)
        promoted, promoted_cookie = login(email, password)
        check("promoted Admin catalog access", call("PUT", path, product, promoted["accessToken"]), 200)
        check("disable account", call("PATCH", f'/api/users/{user["id"]}', {"role": "Customer", "isActive": False}, admin_token), 200)
        check("identity revokes old access", call("GET", "/api/auth/me", token=promoted["accessToken"]), 401)
        check("catalog revokes old access", call("PUT", path, product, promoted["accessToken"]), 401)
        check("disabled refresh denied", call("POST", "/api/auth/refresh", cookie=promoted_cookie), 401)
        check("disabled login denied", call("POST", "/api/auth/login", {"email": email, "password": password}), 401)
        check("reenable account", call("PATCH", f'/api/users/{user["id"]}', {"role": "Customer", "isActive": True}, admin_token), 200)
        customer, refresh = login(email, password)
        check("logout", call("POST", "/api/auth/logout", cookie=refresh), 204)
        check("logout revokes access", call("GET", "/api/auth/me", token=customer["accessToken"]), 401)
        check("logout revokes refresh", call("POST", "/api/auth/refresh", cookie=refresh), 401)
        for _ in range(5):
            check("failed login", call("POST", "/api/auth/login", {"email": email, "password": "wrong"}), 401)
        check("lockout even with correct password", call("POST", "/api/auth/login", {"email": email, "password": password}), 401)
    finally:
        check("cleanup product", call("DELETE", path, token=admin_token), 204)
        call("PATCH", f'/api/users/{user["id"]}', {"role": "Customer", "isActive": False}, admin_token)
        call("POST", "/api/auth/logout", cookie=admin_cookie)
    print(f"SUCCESS: {passed} HTTP assertions plus pagination, token, role and concurrency checks.")


if __name__ == "__main__":
    main()

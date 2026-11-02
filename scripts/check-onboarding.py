"""Local integration checks against the actual gateway, Redis and separate SQL databases.
Run only against the local development stack. Created users/organizations are removed in finally.
"""
import base64
import copy
import concurrent.futures
import http.cookiejar
import json
import os
from pathlib import Path
import secrets
import subprocess
import urllib.request
import urllib.error
import uuid

ROOT = Path(__file__).resolve().parents[1]
ENV = dict(line.split("=", 1) for line in (ROOT / ".env").read_text(encoding="utf-8-sig").splitlines() if line and not line.startswith("#") and "=" in line)
BASE = "http://127.0.0.1:" + ENV.get("WEB_PORT", "8080")
count = 0
users = []
organizations = []
session_ids = set()

class Client:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        self.token = None

    def request(self, path, method="GET", data=None, expected=200, header=True, raw=None, content_type=None):
        global count
        headers = {}
        if header:
            headers["X-Requested-With"] = "GiveAid"
        if self.token:
            headers["Authorization"] = "Bearer " + self.token
        body = raw
        if data is not None:
            body = json.dumps(data).encode()
            headers["Content-Type"] = "application/json"
        if content_type:
            headers["Content-Type"] = content_type
        request = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
        try:
            response = self.opener.open(request, timeout=30)
        except urllib.error.HTTPError as ex:
            response = ex
        content = response.read()
        assert response.code == expected, f"{method} {path}: expected {expected}, got {response.code}: {content[:400]!r}"
        count += 1
        if response.headers.get("Content-Type", "").startswith("application/json") and content:
            return json.loads(content)
        return content

    def login(self, email, password):
        session = self.request("/api/auth/login", "POST", {"email": email, "password": password})
        self.token = session["accessToken"]
        payload = json.loads(base64.urlsafe_b64decode(self.token.split(".")[1] + "==="))
        session_ids.add(str(uuid.UUID(payload["sid"])))
        return session

    def upload(self, organization, kind, payload=None, filename="document.png", expected=200):
        boundary = "GiveAid" + secrets.token_hex(10)
        payload = payload or base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jO9sAAAAASUVORK5CYII=")
        body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"version\"\r\n\r\n{organization['version']}\r\n"
                f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\nContent-Type: image/png\r\n\r\n").encode() + payload + f"\r\n--{boundary}--\r\n".encode()
        return self.request(f"/api/organizations/{organization['id']}/documents/{kind}", "POST", raw=body, content_type="multipart/form-data; boundary=" + boundary, expected=expected)

def sql(database, statement, login="sa", password=None):
    # All identifiers used for cleanup are UUID-validated values returned by the test itself.
    docker_env = dict(os.environ, SQLCMDPASSWORD=password or ENV["SQL_SA_PASSWORD"])
    result = subprocess.run(["docker", "exec", "-e", "SQLCMDPASSWORD", "give-aid-sqlserver-1",
        "/opt/mssql-tools18/bin/sqlcmd", "-S", "localhost", "-U", login, "-C", "-b", "-I", "-d", database, "-h", "-1", "-W", "-Q", statement],
        env=docker_env, capture_output=True, text=True, check=True)
    return result.stdout.strip()

def main():
    global count
    user, other, admin, anonymous = Client(), Client(), Client(), Client()
    password = "Ga1!" + secrets.token_hex(18)
    suffix = secrets.token_hex(6)
    email = f"integration-{suffix}@example.test"
    email2 = f"integration-other-{suffix}@example.test"
    anonymous.request("/api/auth/register", "POST", {"email": email, "password": password, "fullName": "Test User"}, expected=403, header=False)
    user.request("/api/auth/register", "POST", {"email": email, "password": password, "fullName": "Test User", "role": "ADMIN", "roles": ["ADMIN"]}, expected=201)
    first = user.login(email, password); users.append(first["user"]["id"])
    old_cookie_client = Client()
    for cookie in user.jar:
        old_cookie_client.jar.set_cookie(copy.copy(cookie))
    assert first["user"]["roles"] == ["USER"]
    other.request("/api/auth/register", "POST", {"email": email2, "password": password, "fullName": "Other User"}, expected=201)
    second = other.login(email2, password); users.append(second["user"]["id"])
    first_id = str(uuid.UUID(first["user"]["id"])); second_id = str(uuid.UUID(second["user"]["id"]))
    assert sql("GiveAid_Identity", f"SET NOCOUNT ON; SELECT COUNT(DISTINCT PasswordHash) FROM AspNetUsers WHERE Id IN ('{first_id}','{second_id}');") == "2"
    # An altered JWT payload cannot grant administrative access.
    forged = Client()
    parts = user.token.split(".")
    payload = json.loads(base64.urlsafe_b64decode(parts[1] + "==="))
    payload["role"] = "ADMIN"
    parts[1] = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    forged.token = ".".join(parts)
    forged.request("/api/organizations", expected=401)
    user.request("/api/auth/register", "POST", {"email": email, "password": password, "fullName": "Duplicate"}, expected=400)
    anonymous.request("/api/auth/register", "POST", {"email": f"weak-{suffix}@example.test", "password": "abc", "fullName": "Weak"}, expected=400)
    user.request("/api/organizations", expected=403)
    anonymous.request("/api/organizations/mine", expected=401)
    admin_session = admin.login(ENV["ADMIN_EMAIL"], ENV["ADMIN_PASSWORD"])
    assert "ADMIN" in admin_session["user"]["roles"]
    profile = {
        "legalName": "Integration Organization " + suffix, "organizationType": "NGO",
        "registrationNumber": "TEST-" + suffix, "registrationDate": "2020-01-01",
        "registrationAuthority": "Test Issuing Authority", "foundedDate": "2019-01-01",
        "taxCode": "", "address": "Test address with sufficient detail", "province": "Test Province",
        "contactEmail": email, "contactPhone": "0901234567", "website": "",
        "mission": "Integration test organization mission with sufficient description.",
        "representativeName": "Test Representative", "representativeTitle": "Director",
        "representativeBirthDate": "1990-01-01", "representativeEmail": email,
        "representativePhone": "0901234567", "identityType": "CCCD",
        "identityIssuedDate": "2020-01-01", "identityIssuedBy": "Test Authority"
    }
    request = {"profile": profile, "identityNumber": "012345678901", "consent": True, "status": "ACTIVE", "applicantUserId": second["user"]["id"]}
    user.request("/api/organizations", "POST", {**request, "consent": False}, expected=400)
    user.request("/api/organizations", "POST", {**request, "identityNumber": "invalid"}, expected=400)
    for overrides in ({"organizationType": "ADMIN"}, {"representativeBirthDate": "2020-01-01"}, {"contactPhone": "--------"}, {"registrationDate": "2100-01-01"}):
        user.request("/api/organizations", "POST", {**request, "profile": {**profile, **overrides}}, expected=400)
    org = user.request("/api/organizations", "POST", request, expected=201); organizations.append(org["id"])
    assert org["status"] == "DRAFT" and org["applicantUserId"] == first["user"]["id"]
    other.request("/api/organizations/" + org["id"], expected=404)
    user.request("/api/organizations", "POST", request, expected=409)
    user.request("/api/organizations/" + org["id"] + "/submit", "POST", {"version": org["version"]}, expected=400)
    user.upload(org, "REGISTRATION", b"fake executable", expected=400)
    user.upload(org, "REGISTRATION", b"x" * (5 * 1024 * 1024 + 1), expected=400)
    for kind in ("REGISTRATION", "REPRESENTATIVE_ID", "AUTHORIZATION"):
        org = user.upload(org, kind)
    doc = org["documents"][0]
    assert user.request(f"/api/organizations/{org['id']}/documents/{doc['id']}")
    other.request(f"/api/organizations/{org['id']}/documents/{doc['id']}", expected=404)
    pending = user.request(f"/api/organizations/{org['id']}/submit", "POST", {"version": org["version"]})
    assert pending["status"] == "PENDING_REVIEW"
    user.request(f"/api/organizations/{org['id']}", "PUT", {**request, "version": pending["version"]}, expected=409)
    user.request(f"/api/organizations/{org['id']}/review", "POST", {"decision": "APPROVE", "reason": "", "version": pending["version"]}, expected=403)
    admin.request(f"/api/organizations/{org['id']}/review", "POST", {"decision": "REQUEST_CHANGES", "reason": "", "version": pending["version"]}, expected=400)
    changed = admin.request(f"/api/organizations/{org['id']}/review", "POST", {"decision": "REQUEST_CHANGES", "reason": "Please clarify the supporting documents.", "version": pending["version"]})
    assert changed["status"] == "CHANGES_REQUESTED"
    user.request(f"/api/organizations/{org['id']}", "PUT", {**request, "version": org["version"]}, expected=409)
    edited = user.request(f"/api/organizations/{org['id']}", "PUT", {**request, "version": changed["version"]})
    pending = user.request(f"/api/organizations/{org['id']}/submit", "POST", {"version": edited["version"]})
    # Independent clients send concurrent decisions using exactly the same rowversion.
    def approve(_):
        client = Client(); client.token = admin.token
        try:
            return client.request(f"/api/organizations/{org['id']}/review", "POST", {"decision": "APPROVE", "reason": "Reviewed.", "version": pending["version"]})
        except AssertionError as ex:
            assert "got 409" in str(ex), str(ex)
            return None
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(approve, range(2)))
    assert sum(result is not None for result in results) == 1
    active = user.request("/api/organizations/" + org["id"])
    assert active["status"] == "ACTIVE" and any(h["action"] == "APPROVE" for h in active["history"])
    listed = admin.request("/api/organizations?status=ACTIVE&search=" + profile["registrationNumber"])
    assert any(item["id"] == org["id"] for item in listed["items"])
    org_id = str(uuid.UUID(org["id"]))
    owner_id = str(uuid.UUID(first["user"]["id"]))
    assert sql("GiveAid_Organization", f"SET NOCOUNT ON; SELECT COUNT(*) FROM Members WHERE OrganizationId='{org_id}' AND UserId='{owner_id}' AND Role='OWNER';") == "1"
    assert sql("GiveAid_Organization", f"SET NOCOUNT ON; SELECT COUNT(*) FROM Organizations WHERE Id='{org_id}' AND ProtectedIdentityNumber NOT LIKE '%012345678901%';") == "1"
    assert sql("GiveAid_Organization", f"SET NOCOUNT ON; SELECT COUNT(*) FROM Documents WHERE OrganizationId='{org_id}' AND SUBSTRING(ProtectedContent,1,8) <> 0x89504E470D0A1A0A;") == "3"
    assert sql("GiveAid_Identity", f"SET NOCOUNT ON; SELECT COUNT(*) FROM AspNetUsers WHERE Id='{owner_id}' AND PasswordHash IS NOT NULL AND PasswordHash <> '{password}';") == "1"
    try:
        sql("GiveAid_Organization", "SELECT COUNT(*) FROM GiveAid_Identity.dbo.AspNetUsers", "giveaid_organization", ENV["ORGANIZATION_DB_PASSWORD"])
        raise AssertionError("Organization login could access Identity database")
    except subprocess.CalledProcessError:
        count += 1
    try:
        sql("GiveAid_Identity", "SELECT COUNT(*) FROM GiveAid_Organization.dbo.Organizations", "giveaid_identity", ENV["IDENTITY_DB_PASSWORD"])
        raise AssertionError("Identity login could access Organization database")
    except subprocess.CalledProcessError:
        count += 1
    assert sql("GiveAid_Organization", "SET NOCOUNT ON; SELECT HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CREATE TABLE');", "giveaid_organization", ENV["ORGANIZATION_DB_PASSWORD"]) == "0"
    # A rejected dossier cannot create membership or return to the editable state.
    rejected_request = {**request, "profile": {**profile, "registrationNumber": "REJECT-" + suffix}}
    rejected = other.request("/api/organizations", "POST", rejected_request, expected=201)
    organizations.append(rejected["id"])
    for kind in ("REGISTRATION", "REPRESENTATIVE_ID", "AUTHORIZATION"):
        rejected = other.upload(rejected, kind)
    rejected = other.request(f"/api/organizations/{rejected['id']}/submit", "POST", {"version": rejected["version"]})
    rejected = admin.request(f"/api/organizations/{rejected['id']}/review", "POST", {"decision": "REJECT", "reason": "Ineligible test dossier.", "version": rejected["version"]})
    assert rejected["status"] == "REJECTED"
    other.request(f"/api/organizations/{rejected['id']}", "PUT", {**rejected_request, "version": rejected["version"]}, expected=409)
    rejected_id = str(uuid.UUID(rejected["id"]))
    assert sql("GiveAid_Organization", f"SET NOCOUNT ON; SELECT COUNT(*) FROM Members WHERE OrganizationId='{rejected_id}';") == "0"
    self_request = {**request, "profile": {**profile, "registrationNumber": "SELF-" + suffix}}
    self_org = admin.request("/api/organizations", "POST", self_request, expected=201)
    organizations.append(self_org["id"])
    admin.request(f"/api/organizations/{self_org['id']}/review", "POST", {"decision": "APPROVE", "reason": "", "version": self_org["version"]}, expected=403)
    refreshed = user.request("/api/auth/refresh", "POST")
    old_cookie_client.request("/api/auth/refresh", "POST", expected=401)
    user.token = refreshed["accessToken"]
    user.request("/api/auth/logout", "POST", expected=204)
    user.request("/api/organizations/mine", expected=401)
    user.request("/api/auth/refresh", "POST", expected=401)
    new_password = "Ga2!" + secrets.token_hex(18)
    other.request("/api/auth/password", "POST", {"currentPassword": password, "newPassword": new_password}, expected=204)
    other.request("/api/organizations/mine", expected=401)
    anonymous.request("/api/auth/login", "POST", {"email": email2, "password": password}, expected=401)
    other.login(email2, new_password)
    # Account lockout blocks a correct password after five failed attempts.
    for _ in range(5):
        anonymous.request("/api/auth/login", "POST", {"email": email2, "password": "wrong-password"}, expected=401)
    anonymous.request("/api/auth/login", "POST", {"email": email2, "password": new_password}, expected=401)
    print(f"PASS: {count} HTTP/security assertions; role assignment, legal documents, review concurrency, owner creation, session revocation and database isolation.")

def run():
    try:
        main()
    finally:
        for value in session_ids:
            session_id = uuid.UUID(value)
            subprocess.run(["docker", "exec", "give-aid-redis-1", "redis-cli", "DEL", "auth:session:" + session_id.hex], capture_output=True, check=True)
            sql("GiveAid_Identity", f"DELETE FROM RefreshSessions WHERE Id='{session_id}';")
        for value in organizations:
            org_id = str(uuid.UUID(value))
            sql("GiveAid_Organization", f"DELETE FROM Organizations WHERE Id='{org_id}';")
        for value in users:
            user_id = str(uuid.UUID(value))
            sql("GiveAid_Identity", f"DELETE FROM RefreshSessions WHERE UserId='{user_id}'; DELETE FROM AspNetUsers WHERE Id='{user_id}';")

if __name__ == "__main__":
    run()

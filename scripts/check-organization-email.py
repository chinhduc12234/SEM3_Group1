"""Explicit opt-in smoke test: sends six real emails to --recipient, then removes its SQL fixtures.
Use a mailbox you own; this script exercises submit, changes, resubmit, approve and reject via gateway APIs.
"""
import argparse
import importlib.util
import secrets
import time
import uuid
from pathlib import Path

spec = importlib.util.spec_from_file_location("onboarding", Path(__file__).with_name("check-onboarding.py"))
checks = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checks)

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--send-real", action="store_true", required=True)
parser.add_argument("--recipient", required=True)
args = parser.parse_args()
suffix = secrets.token_hex(5)
user, admin = checks.Client(), checks.Client()
organizations = []
user_id = None

def wait_sent(organization_id, expected):
    deadline = time.monotonic() + 90
    while time.monotonic() < deadline:
        result = admin.request("/api/organizations/notifications?organizationId=" + organization_id)
        items = result["items"]
        failure = next((item for item in items if item["lastErrorCode"]), None)
        if failure:
            raise RuntimeError("Email delivery failed: " + failure["lastErrorCode"])
        if len(items) == expected and all(item["state"] == "SENT" for item in items):
            assert all(item["sentAt"] for item in items)
            return
        time.sleep(2)
    raise RuntimeError("Timed out waiting for EmailJS acceptance")

def create_dossier(number):
    profile = {
        "legalName": "Give-AID Email Integration TEST " + number,
        "organizationType": "NGO", "registrationNumber": "EMAIL-TEST-" + suffix + number,
        "registrationDate": "2020-01-01", "registrationAuthority": "Synthetic Test Authority",
        "foundedDate": "2019-01-01", "taxCode": "", "address": "Synthetic test address, no legal validity",
        "province": "Test Province", "contactEmail": "contact@example.test", "contactPhone": "0000000000",
        "website": "", "mission": "Synthetic organization for testing notification delivery, no legal validity.",
        "representativeName": "Synthetic Representative", "representativeTitle": "Director",
        "representativeBirthDate": "1990-01-01", "representativeEmail": "representative@example.test",
        "representativePhone": "0000000000", "identityType": "CCCD",
        "identityIssuedDate": "2020-01-01", "identityIssuedBy": "Synthetic Test Authority"
    }
    org = user.request("/api/organizations", "POST", {"profile": profile, "identityNumber": "000000000001", "consent": True}, expected=201)
    organizations.append(org["id"])
    for kind in ("REGISTRATION", "REPRESENTATIVE_ID", "AUTHORIZATION"):
        org = user.upload(org, kind)
    org = user.request(f"/api/organizations/{org['id']}/submit", "POST", {"version": org["version"]})
    wait_sent(org["id"], 1)
    return org

try:
    admin.login(checks.ENV["ADMIN_EMAIL"], checks.ENV["ADMIN_PASSWORD"])
    password = "Ga1!" + secrets.token_hex(20)
    user.request("/api/auth/register", "POST", {"email": args.recipient, "fullName": "Give-AID Email Integration TEST", "password": password}, expected=201)
    user_id = str(uuid.UUID(user.login(args.recipient, password)["user"]["id"]))
    org = create_dossier("A")
    org = admin.request(f"/api/organizations/{org['id']}/review", "POST", {
        "decision": "REQUEST_CHANGES", "reason": "TEST: Vui long bo sung giay dang ky ro net.\nDay la email kiem tra tich hop.", "version": org["version"]})
    wait_sent(org["id"], 2)
    org = user.request(f"/api/organizations/{org['id']}/submit", "POST", {"version": org["version"]})
    wait_sent(org["id"], 3)
    org = admin.request(f"/api/organizations/{org['id']}/review", "POST", {"decision": "APPROVE", "reason": "TEST: Da kiem tra ho so.", "version": org["version"]})
    assert org["status"] == "ACTIVE"
    wait_sent(org["id"], 4)
    rejected = create_dossier("B")
    rejected = admin.request(f"/api/organizations/{rejected['id']}/review", "POST", {
        "decision": "REJECT", "reason": "TEST: Ho so gia lap khong co gia tri phap ly.", "version": rejected["version"]})
    assert rejected["status"] == "REJECTED"
    wait_sent(rejected["id"], 2)
    # 4 + 2 = six messages: initial submit, changes, resubmit, approve; second submit, reject.
    print("PASS: six real emails accepted by EmailJS; account recipient and all review decisions exercised through gateway APIs.")
finally:
    for session in checks.session_ids:
        session_id = uuid.UUID(session)
        checks.subprocess.run(["docker", "exec", "give-aid-redis-1", "redis-cli", "DEL", "auth:session:" + session_id.hex], capture_output=True, check=True)
        checks.sql("GiveAid_Identity", f"DELETE FROM RefreshSessions WHERE Id='{session_id}';")
    for organization_id in organizations:
        checks.sql("GiveAid_Organization", f"DELETE FROM Organizations WHERE Id='{uuid.UUID(organization_id)}';")
    if user_id:
        checks.sql("GiveAid_Identity", f"DELETE FROM RefreshSessions WHERE UserId='{user_id}'; DELETE FROM AspNetUsers WHERE Id='{user_id}';")

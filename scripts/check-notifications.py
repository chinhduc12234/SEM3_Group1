"""Local SQL/gateway notification checks. Requires EmailJS disabled; no real push tokens used.
Creates synthetic accounts/dossiers, checks outbox recovery, idempotency and tenant isolation.
"""
import importlib.util
import json
import secrets
import subprocess
import time
import uuid
from pathlib import Path

spec = importlib.util.spec_from_file_location("checks", Path(__file__).with_name("check-onboarding.py"))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
users, orgs, event_ids = [], [], []
password = "Ga1!" + secrets.token_hex(18)
suffix = secrets.token_hex(5)
admin, owner, other, anonymous = (m.Client() for _ in range(4))

def wait_for(predicate, label):
    for _ in range(40):
        value = predicate()
        if value:
            return value
        time.sleep(.5)
    raise AssertionError("Timed out: " + label)

def internal(event, expected=204, authorized=True):
    # Secrets travel on stdin, never on a process command line or in logs.
    code = "let s='';for await(const c of process.stdin)s+=c;const x=JSON.parse(s);const r=await fetch('http://notification:8080/internal/notifications/organization-events',{method:'POST',headers:{'Content-Type':'application/json','X-Internal-Key':x.key},body:JSON.stringify(x.event)});process.stdout.write(String(r.status));"
    result = subprocess.run(["docker", "exec", "-i", "give-aid-web-1", "node", "--input-type=module", "-e", code],
        input=json.dumps({"key": m.ENV["INTERNAL_API_KEY"] if authorized else "", "event": event}), capture_output=True, text=True, check=True)
    assert result.stdout == str(expected), ("internal event status", result.stdout)

def register(client, name):
    email = f"notify-{name}-{suffix}@example.test"
    client.request("/api/auth/register", "POST", {"email": email, "fullName": "Notification " + name, "password": password}, expected=201)
    account = client.login(email, password)["user"]
    users.append(str(uuid.UUID(account["id"])))
    return account

def create():
    profile = {"legalName": "Notification Test " + suffix, "organizationType": "NGO", "registrationNumber": "NT-" + secrets.token_hex(6),
        "registrationDate": "2020-01-01", "registrationAuthority": "Synthetic Authority", "foundedDate": "2019-01-01", "taxCode": "",
        "address": "Synthetic address for notification tests", "province": "Test Province", "contactEmail": "contact@example.test", "contactPhone": "0000000000", "website": "",
        "mission": "A synthetic organization for testing notification delivery and account isolation.", "representativeName": "Synthetic Representative", "representativeTitle": "Director",
        "representativeBirthDate": "1990-01-01", "representativeEmail": "representative@example.test", "representativePhone": "0000000000",
        "identityType": "CCCD", "identityIssuedDate": "2020-01-01", "identityIssuedBy": "Synthetic Authority"}
    org = owner.request("/api/organizations", "POST", {"profile": profile, "identityNumber": "000000000001", "consent": True}, expected=201)
    orgs.append(str(uuid.UUID(org["id"])))
    for kind in ("REGISTRATION", "REPRESENTATIVE_ID", "AUTHORIZATION"):
        org = owner.upload(org, kind)
    return org

def own_items(client, oid):
    return [x for x in client.request("/api/notifications")["items"] if oid in x["url"]]

def main():
    assert subprocess.check_output(["docker", "exec", "give-aid-organization-1", "printenv", "EmailJS__Enabled"], text=True).strip().lower() == "false"
    admin.login(m.ENV["ADMIN_EMAIL"], m.ENV["ADMIN_PASSWORD"])
    a, b = register(owner, "owner"), register(other, "other")
    anonymous.request("/api/notifications", expected=401)
    anonymous.request("/api/notifications/unread-count", expected=401)
    config = anonymous.request("/api/notifications/config")
    assert "credential" not in json.dumps(config).lower() and "private_key" not in json.dumps(config).lower()
    anonymous.request("/internal/notifications/organization-events", "POST", {}, expected=404)
    anonymous.request("/hubs/notifications/negotiate?negotiateVersion=1", "POST", expected=401)
    admin.request("/hubs/notifications/negotiate?negotiateVersion=1", "POST")
    assert owner.request("/api/notifications")["totalCount"] == 0

    org = create()
    # Stop just the consumer: the source transaction must still succeed and retain work.
    subprocess.run(["docker", "stop", "give-aid-notification-1"], check=True, capture_output=True)
    try:
        org = owner.request(f"/api/organizations/{org['id']}/submit", "POST", {"version": org["version"]})
        assert m.sql("GiveAid_Organization", f"SET NOCOUNT ON; SELECT COUNT(*) FROM NotificationEvents WHERE OrganizationId='{org['id']}' AND DeliveredAt IS NULL;") == "1"
    finally:
        subprocess.run(["docker", "start", "give-aid-notification-1"], check=True, capture_output=True)
    wait_for(lambda: m.sql("GiveAid_Organization", f"SET NOCOUNT ON; SELECT COUNT(*) FROM NotificationEvents WHERE OrganizationId='{org['id']}' AND DeliveredAt IS NOT NULL;") == "1", "consumer recovery")
    initial = wait_for(lambda: own_items(admin, org["id"]), "admin submitted notification")
    assert len(initial) == 1 and initial[0]["kind"] == "SUBMITTED"
    assert initial[0]["url"] == f"/admin/organizations/{org['id']}"
    assert own_items(owner, org["id"]) == [] and own_items(other, org["id"]) == []
    other.request(f"/api/notifications/{initial[0]['id']}/read", "PUT", expected=404)
    admin.request(f"/api/notifications/{initial[0]['id']}/read", "PUT", header=False, expected=403)
    org = admin.request(f"/api/organizations/{org['id']}/review", "POST", {"decision": "REQUEST_CHANGES", "reason": "Synthetic request for updated documents", "version": org["version"]})
    items = wait_for(lambda: own_items(owner, org["id"]), "changes requested")
    assert len(items) == 1 and items[0]["kind"] == "REQUEST_CHANGES"
    page = owner.request("/api/notifications")
    owner.request("/api/notifications/read-all", "PUT", {"through": "2099-01-01T00:00:00Z"}, expected=400)
    owner.request("/api/notifications/read-all", "PUT", {"through": page["asOf"]}, expected=204)
    assert owner.request("/api/notifications/unread-count")["count"] == 0
    org = owner.request(f"/api/organizations/{org['id']}/submit", "POST", {"version": org["version"]})
    org = admin.request(f"/api/organizations/{org['id']}/review", "POST", {"decision": "APPROVE", "reason": "Synthetic approval", "version": org["version"]})
    approved = wait_for(lambda: next((x for x in own_items(owner, org["id"]) if x["kind"] == "APPROVE"), None), "approval notification")
    assert approved["url"] == f"/organizations/{org['id']}/manage"
    assert owner.request("/api/notifications/unread-count")["count"] == 1
    other.request(f"/api/notifications/{approved['id']}/read", "PUT", expected=404)
    owner.request(f"/api/notifications/{approved['id']}/read", "PUT", expected=204)
    owner.request(f"/api/notifications/{approved['id']}/read", "PUT", expected=204)
    assert owner.request("/api/notifications?unread=true")["totalCount"] == 0
    assert m.sql("GiveAid_Organization", f"SET NOCOUNT ON; SELECT COUNT(*) FROM NotificationEvents WHERE OrganizationId='{org['id']}';") == "4"

    second = create()
    second = owner.request(f"/api/organizations/{second['id']}/submit", "POST", {"version": second["version"]})
    admin.request(f"/api/organizations/{second['id']}/review", "POST", {"decision": "REJECT", "reason": "Synthetic rejection", "version": second["version"]})
    wait_for(lambda: any(x["kind"] == "REJECT" for x in own_items(owner, second["id"])), "rejection notification")

    event = {"eventId": str(uuid.uuid4()), "organizationId": org["id"], "applicantUserId": a["id"], "action": "REJECT", "organizationName": "Synthetic idempotency test", "occurredAt": "2026-11-08T00:00:00Z"}
    event_ids.append(event["eventId"])
    internal(event, authorized=False, expected=401)
    internal(event)
    internal(event)
    internal({**event, "organizationName": "Changed payload"}, expected=409)
    internal({**event, "action": "ARBITRARY"}, expected=400)
    assert m.sql("GiveAid_Notification", f"SET NOCOUNT ON; SELECT COUNT(*) FROM Notifications WHERE EventId='{event['eventId']}';") == "1"
    if config["enabled"]:
        fake_token = "synthetic-notification-token-" + secrets.token_hex(40)
        owner.request("/api/notifications/push-subscriptions", "POST", {"token": "short"}, expected=400)
        owner.request("/api/notifications/push-subscriptions", "POST", {"token": fake_token}, expected=204)
        owner.request("/api/notifications/push-subscriptions", "POST", {"token": fake_token}, expected=204)
        assert m.sql("GiveAid_Notification", f"SET NOCOUNT ON; SELECT COUNT(*) FROM Subscriptions WHERE UserId='{a['id']}' AND IsActive=1 AND ProtectedToken NOT LIKE '%synthetic-notification-token%';") == "1"
        other.request("/api/notifications/push-subscriptions", "POST", {"token": fake_token}, expected=204)
        owner.request("/api/notifications/push-subscriptions/current-session", "DELETE", expected=204)
        assert m.sql("GiveAid_Notification", f"SET NOCOUNT ON; SELECT COUNT(*) FROM Subscriptions WHERE UserId='{b['id']}' AND IsActive=1;") == "1"
        other.request("/api/notifications/push-subscriptions/current-session", "DELETE", expected=204)
    other.request("/api/auth/logout", "POST", expected=204)
    other.request("/api/notifications", expected=401)
    other.request("/hubs/notifications/negotiate?negotiateVersion=1", "POST", expected=401)
    print(f"PASS: {m.count} HTTP assertions + SQL checks; durable recovery, four transitions, idempotency, unread state, scoped access and encrypted session-bound subscriptions.")

try:
    main()
finally:
    # Remove only this run's notifications, including those addressed to the real local admin.
    for oid in orgs:
        m.sql("GiveAid_Notification", f"DELETE FROM ReceivedEvents WHERE Id IN (SELECT EventId FROM Notifications WHERE OrganizationId='{oid}'); DELETE FROM Notifications WHERE OrganizationId='{oid}';")
        m.sql("GiveAid_Organization", f"DELETE FROM Organizations WHERE Id='{oid}';")
    for sid in m.session_ids:
        value = uuid.UUID(sid)
        subprocess.run(["docker", "exec", "give-aid-redis-1", "redis-cli", "DEL", "auth:session:" + value.hex], capture_output=True, check=True)
        m.sql("GiveAid_Identity", f"DELETE FROM RefreshSessions WHERE Id='{value}';")
    for uid in users:
        m.sql("GiveAid_Notification", f"DELETE FROM Subscriptions WHERE UserId='{uid}';")
        m.sql("GiveAid_Identity", f"DELETE FROM RefreshSessions WHERE UserId='{uid}'; DELETE FROM AspNetUsers WHERE Id='{uid}';")

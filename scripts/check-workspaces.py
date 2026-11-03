"""Integration checks for organization workspaces against local SQL/Redis/gateway.
Requires EmailJS__Enabled=false to avoid sending to synthetic test accounts. Cleans only its own fixtures.
"""
import base64
import concurrent.futures
import importlib.util
import json
import secrets
import uuid
from pathlib import Path

spec = importlib.util.spec_from_file_location("checks", Path(__file__).with_name("check-onboarding.py"))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
orgs, users = [], []
suffix = secrets.token_hex(5)
password = "Ga1!" + secrets.token_hex(18)
admin, owner, member, outsider, anonymous = (m.Client() for _ in range(5))

def register(client, name):
    email = f"workspace-{name}-{suffix}@example.test"
    client.request("/api/auth/register", "POST", {"email": email, "fullName": "Workspace " + name, "password": password}, expected=201)
    account = client.login(email, password)["user"]
    users.append(str(uuid.UUID(account["id"])))
    return account

def create(client, name):
    profile = {"legalName": "Workspace Test " + name + suffix, "organizationType": "NGO", "registrationNumber": "WS-" + name + suffix,
        "registrationDate": "2020-01-01", "registrationAuthority": "Synthetic Authority", "foundedDate": "2019-01-01", "taxCode": "",
        "address": "Synthetic address for integration checks", "province": "Test Province", "contactEmail": "contact@example.test", "contactPhone": "0000000000", "website": "",
        "mission": "A synthetic organization for testing memberships and legal changes.", "representativeName": "Synthetic Representative", "representativeTitle": "Director",
        "representativeBirthDate": "1990-01-01", "representativeEmail": "representative@example.test", "representativePhone": "0000000000",
        "identityType": "CCCD", "identityIssuedDate": "2020-01-01", "identityIssuedBy": "Synthetic Authority"}
    org = client.request("/api/organizations", "POST", {"profile": profile, "identityNumber": "000000000001", "consent": True}, expected=201)
    orgs.append(str(uuid.UUID(org["id"])))
    for kind in ("REGISTRATION", "REPRESENTATIVE_ID", "AUTHORIZATION"):
        org = client.upload(org, kind)
    org = client.request(f"/api/organizations/{org['id']}/submit", "POST", {"version": org["version"]})
    return admin.request(f"/api/organizations/{org['id']}/review", "POST", {"decision": "APPROVE", "reason": "Synthetic review", "version": org["version"]})

def multipart(client, path, values, files, expected=201):
    boundary = "GiveAid" + secrets.token_hex(16)
    data = bytearray()
    for key, value in values.items():
        data.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
    for key, (name, content) in files.items():
        data.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"; filename="{name}"\r\nContent-Type: image/png\r\n\r\n'.encode())
        data.extend(content + b"\r\n")
    data.extend(f'--{boundary}--\r\n'.encode())
    return client.request(path, "POST", raw=bytes(data), content_type="multipart/form-data; boundary=" + boundary, expected=expected)

def invitation(client, organization_id):
    return next(x for x in client.request("/api/organizations/invitations/mine") if x["organizationId"] == organization_id)

def main():
    enabled=m.subprocess.check_output(["docker","exec","give-aid-organization-1","printenv","EmailJS__Enabled"],text=True).strip()
    assert enabled.lower() == "false", "Disable live email worker before synthetic integration checks"
    admin.login(m.ENV["ADMIN_EMAIL"], m.ENV["ADMIN_PASSWORD"])
    a, b, c = register(owner,"owner"), register(member,"member"), register(outsider,"other")
    baseline = admin.request("/api/organizations/admin/overview")
    org = create(owner,"A"); second = create(outsider,"B")
    root = f"/api/organizations/{org['id']}/workspace"
    other_root = f"/api/organizations/{second['id']}/workspace"
    anonymous.request(root, expected=401)
    member.request(root, expected=404)
    outsider.request(root, expected=404)
    owner.request(other_root, expected=404)
    workspace = owner.request(root)
    assert workspace["canEdit"] and workspace["canManageMembers"] and workspace["roles"] == ["OWNER"]
    assert workspace["statistics"]["activeMembers"] == 1 and workspace["statistics"]["campaigns"] is None
    assert workspace["statistics"]["donatedAmount"] is None
    assert owner.request("/api/auth/me")["roles"] == ["USER"]
    admin_view = admin.request(root)
    assert not admin_view["canEdit"] and not admin_view["canManageMembers"]
    rights=owner.request(root+"/permissions")
    assert rights["canManageMembers"] and rights["canManageCampaigns"] and rights["canManageFinance"]
    rights=admin.request(root+"/permissions")
    assert rights["canViewFinance"] and not rights["canManageMembers"] and not rights["canManageCampaigns"]
    outsider.request(root+"/permissions",expected=404)
    overview = admin.request("/api/organizations/admin/overview")
    assert overview["activeOrganizations"] == baseline["activeOrganizations"] + 2
    assert overview["activeMemberships"] == baseline["activeMemberships"] + 2
    owner.request("/api/organizations/admin/overview", expected=403)
    profile = {**workspace["profile"], "displayName":"Workspace Display Test", "introduction":"Full introduction for the organization workspace integration test.", "focusAreas":["EDUCATION","HEALTH"]}
    admin.request(root+"/profile","PUT",profile,expected=404)
    invalid = {**profile,"focusAreas":["ADMIN"]}
    owner.request(root+"/profile","PUT",invalid,expected=400)
    saved = owner.request(root+"/profile","PUT",profile)
    owner.request(root+"/profile","PUT",profile,expected=409)
    assert owner.request(f"/api/organizations/{org['id']}")["profile"]["legalName"] == org["profile"]["legalName"]
    listed = admin.request("/api/organizations/admin/directory?focus=EDUCATION&search=" + suffix)
    assert any(x["id"]==org["id"] and x["memberCount"]==1 for x in listed["items"])
    png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfFoAAAAASUVORK5CYII=")
    saved = multipart(owner,root+"/media/logo",{"version":saved["version"]},{"file":("logo.png",png)},expected=200)
    assert owner.request(root+"/media/logo")==png
    outsider.request(root+"/media/logo",expected=404)
    multipart(owner,root+"/media/cover",{"version":saved["version"]},{"file":("fake.png",b"executable")},expected=400)
    # Invitation must be accepted by the exact recipient before membership/roles take effect.
    owner.request(root+"/invitations","POST",{"email":b["email"],"roles":["OWNER"]},expected=400)
    owner.request(root+"/invitations","POST",{"email":m.ENV["ADMIN_EMAIL"],"roles":["STAFF"]},expected=400)
    owner.request(root+"/invitations","POST",{"email":b["email"],"roles":["CAMPAIGN_MANAGER","FINANCE_MANAGER"]},expected=201)
    owner.request(root+"/invitations","POST",{"email":b["email"],"roles":["STAFF"]},expected=409)
    invite = invitation(member,org["id"])
    respond = f"/api/organizations/invitations/{invite['id']}/respond"
    outsider.request(respond,"POST",{"accept":True,"version":invite["version"]},expected=404)
    member.request(root,expected=404)
    member.request(respond,"POST",{"accept":True,"version":invite["version"]})
    member.request(respond,"POST",{"accept":True,"version":invite["version"]},expected=409)
    member_view=member.request(root)
    assert sorted(member_view["roles"])==["CAMPAIGN_MANAGER","FINANCE_MANAGER"] and not member_view["canManageMembers"]
    rights=member.request(root+"/permissions")
    assert rights["canManageCampaigns"] and rights["canManageFinance"] and not rights["canManageMembers"]
    member.request(root+"/profile","PUT",saved,expected=403)
    member.request(root+"/invitations","POST",{"email":c["email"],"roles":["STAFF"]},expected=403)
    member.request(f"/api/organizations/{org['id']}",expected=404)
    member.request(root+"/activity",expected=403)
    members=owner.request(root+"/members")["items"]
    target=next(x for x in members if x["userId"]==b["id"])
    principal=next(x for x in members if "OWNER" in x["roles"])
    assert all(x["email"] is None for x in member.request(root+"/members")["items"])
    owner.request(root+f"/members/{principal['id']}/state","PUT",{"isActive":False,"version":principal["version"]},expected=400)
    owner.request(root+f"/members/{target['id']}/roles","PUT",{"roles":["ADMIN"],"version":target["version"]},expected=400)
    owner.request(root+f"/members/{target['id']}/roles","PUT",{"roles":["ORGANIZATION_MANAGER","CAMPAIGN_MANAGER"],"version":target["version"]})
    owner.request(root+f"/members/{target['id']}/roles","PUT",{"roles":["STAFF"],"version":target["version"]},expected=409)
    # Existing JWT immediately sees updated organization permissions; no JWT role promotion.
    managed=member.request(root)
    assert managed["canEdit"] and not managed["canManageMembers"]
    assert not member.request(root+"/permissions")["canManageFinance"]
    updated=member.request(root+"/profile","PUT",{**managed["profile"],"introduction":"Updated by organization manager with current scoped permission."})
    target=next(x for x in owner.request(root+"/members")["items"] if x["id"]==target["id"])
    owner.request(root+f"/members/{target['id']}/state","PUT",{"isActive":False,"version":target["version"]})
    member.request(root,expected=404)
    target=next(x for x in owner.request(root+"/members")["items"] if x["id"]==target["id"])
    owner.request(root+f"/members/{target['id']}/state","PUT",{"isActive":True,"version":target["version"]})
    # Same person can have a lower role in another organization.
    outsider.request(other_root+"/invitations","POST",{"email":b["email"],"roles":["STAFF"]},expected=201)
    other_invite=invitation(member,second["id"])
    member.request(f"/api/organizations/invitations/{other_invite['id']}/respond","POST",{"accept":True,"version":other_invite["version"]})
    assert member.request(other_root)["roles"]==["STAFF"]
    assert not member.request(other_root+"/permissions")["canManageCampaigns"]
    member.request(other_root+"/profile","PUT",updated,expected=403)
    assert len(member.request("/api/organizations/workspaces/mine"))==2
    # Revocation and expiry cannot be bypassed by reusing a stale invitation version.
    owner.request(root+"/invitations","POST",{"email":c["email"],"roles":["STAFF"]},expected=201)
    pending=invitation(outsider,org["id"])
    owner.request(root+f"/invitations/{pending['id']}/revoke","POST",{"version":pending["version"]})
    outsider.request(f"/api/organizations/invitations/{pending['id']}/respond","POST",{"accept":True,"version":pending["version"]},expected=409)
    owner.request(root+"/invitations","POST",{"email":c["email"],"roles":["STAFF"]},expected=201)
    pending=invitation(outsider,org["id"])
    m.sql("GiveAid_Organization",f"UPDATE Invitations SET ExpiresAt=DATEADD(day,-1,SYSUTCDATETIME()) WHERE Id='{uuid.UUID(pending['id'])}';")
    outsider.request(f"/api/organizations/invitations/{pending['id']}/respond","POST",{"accept":True,"version":pending["version"]},expected=409)
    # Legal updates remain pending until an independent admin approves with the current version.
    org=owner.request(f"/api/organizations/{org['id']}")
    proposal={"profile":{**org["profile"],"legalName":"Amended Legal Name " + suffix},"identityNumber":"000000000002","consent":True,"version":org["version"]}
    values={"proposal":json.dumps(proposal),"reason":"Synthetic legal update for tests"}
    files={key:("document.png",png) for key in ("registration","representativeId","authorization")}
    multipart(member,root+"/legal-changes",values,files,expected=403)
    change=multipart(owner,root+"/legal-changes",values,files)
    multipart(owner,root+"/legal-changes",values,files,expected=409)
    assert owner.request(f"/api/organizations/{org['id']}")["profile"]["legalName"]==org["profile"]["legalName"]
    change_path=root+f"/legal-changes/{change['id']}"
    detail=admin.request(change_path)
    member.request(change_path,expected=403)
    document=detail["documents"][0]
    assert admin.request(change_path+f"/documents/{document['id']}")==png
    outsider.request(change_path,expected=404)
    owner.request(change_path+"/review","POST",{"decision":"APPROVE","reason":"Own review","version":detail["version"]},expected=403)
    admin.request(change_path+"/review","POST",{"decision":"REJECT","reason":"Synthetic rejection","version":detail["version"]})
    assert owner.request(f"/api/organizations/{org['id']}")["profile"]["legalName"]==org["profile"]["legalName"]
    change=multipart(owner,root+"/legal-changes",values,files)
    change_path=root+f"/legal-changes/{change['id']}"
    detail=admin.request(change_path)
    def approve(_):
        client=m.Client();client.token=admin.token
        try:return client.request(change_path+"/review","POST",{"decision":"APPROVE","reason":"Synthetic approval","version":detail["version"]})
        except AssertionError as ex:
            assert "got 409" in str(ex), str(ex)
            return None
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(approve,range(2)))
    assert sum(x is not None for x in results)==1
    final=owner.request(f"/api/organizations/{org['id']}")
    assert final["profile"]["legalName"]==proposal["profile"]["legalName"] and final["identityNumber"]=="000000000002" and final["status"]=="ACTIVE"
    assert owner.request(root)["profile"]["displayName"]==profile["displayName"]
    assert m.sql("GiveAid_Organization",f"SET NOCOUNT ON; SELECT COUNT(*) FROM LegalChanges WHERE Id='{uuid.UUID(change['id'])}' AND ProtectedPreviousDossier IS NOT NULL AND ProtectedRequest NOT LIKE '%000000000002%';")=="1"
    assert owner.request(root+"/activity")["totalCount"]>=10
    assert admin.request(root+"/members")["totalCount"]==2
    print(f"PASS: {m.count} HTTP checks; scoped roles, tenant isolation, invitations, revocation, legal changes, admin oversight and atomic concurrency.")

try:
    main()
finally:
    for session in m.session_ids:
        sid=uuid.UUID(session)
        m.subprocess.run(["docker","exec","give-aid-redis-1","redis-cli","DEL","auth:session:"+sid.hex],capture_output=True,check=True)
        m.sql("GiveAid_Identity",f"DELETE FROM RefreshSessions WHERE Id='{sid}';")
    for oid in orgs:m.sql("GiveAid_Organization",f"DELETE FROM Organizations WHERE Id='{oid}';")
    for uid in users:m.sql("GiveAid_Identity",f"DELETE FROM RefreshSessions WHERE UserId='{uid}'; DELETE FROM AspNetUsers WHERE Id='{uid}';")

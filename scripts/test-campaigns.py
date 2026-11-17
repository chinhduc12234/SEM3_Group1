"""Local integration tests. Uses real HTTP APIs and fresh, clearly named test fixtures.
Run after start-dev.ps1: python scripts/test-campaigns.py
No user data is edited/deleted. Test accounts/organizations/campaigns remain for inspection.
"""
import base64
import json
import os
import pathlib
import secrets
import time
import urllib.error
import urllib.request
import uuid

# Explicit IPv4 matches Compose's 127.0.0.1 bind and avoids Windows IPv6 fallback.
BASE = 'http://127.0.0.1:8080'
CAMPAIGN_BASE = os.environ.get('CAMPAIGN_TEST_BASE', BASE)
ROOT = pathlib.Path(__file__).resolve().parents[1]
RUN = uuid.uuid4().hex[:10]
PASSWORD = 'Test1!' + secrets.token_urlsafe(24)
passed = []

def request(method, path, token=None, body=None, expected=200, raw=None, content_type=None, label=None):
    headers = {'X-Requested-With': 'GiveAid'}
    if token: headers['Authorization'] = 'Bearer ' + token
    if raw is not None:
        data = raw
        headers['Content-Type'] = content_type
    else:
        data = json.dumps(body).encode() if body is not None else None
        if data: headers['Content-Type'] = 'application/json'
    try:
        base = CAMPAIGN_BASE if path.startswith('/api/campaigns') else BASE
        with urllib.request.urlopen(urllib.request.Request(base+path, data=data, headers=headers, method=method), timeout=30) as response:
            status, result = response.status, response.read()
    except urllib.error.HTTPError as error:
        status, result = error.code, error.read()
    assert status == expected, f'{label or path}: expected {expected}, got {status}: {result[:500]!r}'
    if label:
        passed.append(label)
        print('PASS', label)
    try: return json.loads(result)
    except (ValueError, UnicodeDecodeError): return result

def upload(path, token, version, kind=None, name='fixture.pdf', content=b'%PDF-1.4\n% local test fixture\n%%EOF', replace_id=None):
    boundary='test-'+uuid.uuid4().hex
    parts=[]
    for key,value in {'version':version, **({'kind':kind} if kind else {}), **({'replaceId':replace_id} if replace_id else {})}.items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode()+content+b'\r\n')
    parts.append(f'--{boundary}--\r\n'.encode())
    return request('POST',path,token,raw=b''.join(parts),content_type='multipart/form-data; boundary='+boundary)

def account(name):
    email=f'campaign-test-{RUN}-{name}@example.com'
    request('POST','/api/auth/register',body={'email':email,'password':PASSWORD,'fullName':'Campaign Test '+name},expected=201)
    login=request('POST','/api/auth/login',body={'email':email,'password':PASSWORD})
    return {'token':login['accessToken'],'email':email,'id':login['user']['id']}

def organization(owner, admin, suffix, approve=True):
    profile=dict(legalName=f'Campaign TEST {RUN} {suffix}', organizationType='CHARITY',registrationNumber=f'TEST-{RUN}-{suffix}',
      registrationDate='2025-01-01',registrationAuthority='Test authority',foundedDate='2025-01-01',
      address='123 Test Street, test fixture',province='Ha Noi',contactEmail=owner['email'],contactPhone='0900000001',
      mission='Local test organization for campaign integration tests only.',representativeName='Test Representative',
      representativeTitle='Test Owner',representativeBirthDate='1990-01-01',representativeEmail=owner['email'],
      representativePhone='0900000002',identityType='CCCD',identityIssuedDate='2020-01-01',identityIssuedBy='Test authority')
    org=request('POST','/api/organizations',owner['token'],{'profile':profile,'identityNumber':'000000000000','consent':True},201)
    if not approve: return org
    for kind in ['REGISTRATION','REPRESENTATIVE_ID','AUTHORIZATION']:
        org=upload(f"/api/organizations/{org['id']}/documents/{kind}",owner['token'],org['version'])
    org=request('POST',f"/api/organizations/{org['id']}/submit",owner['token'],{'version':org['version']})
    return request('POST',f"/api/organizations/{org['id']}/review",admin,{'decision':'APPROVE','reason':'Local automated test fixture','version':org['version']})

def invite(org, owner, user, roles):
    request('POST',f"/api/organizations/{org}/workspace/invitations",owner['token'],{'email':user['email'],'roles':roles},201)
    invitation=next(i for i in request('GET','/api/organizations/invitations/mine',user['token']) if i['organizationId']==org)
    request('POST',f"/api/organizations/invitations/{invitation['id']}/respond",user['token'],{'accept':True,'version':invitation['version']})

def main():
    env = dict(line.split('=', 1) for line in (ROOT / '.env').read_text(encoding='utf-8-sig').splitlines()
               if '=' in line and not line.startswith('#'))
    admin = request('POST', '/api/auth/login', body={
        'email': os.environ.get('CAMPAIGN_TEST_ADMIN_EMAIL', env['ADMIN_EMAIL']),
        'password': os.environ.get('CAMPAIGN_TEST_ADMIN_PASSWORD', env['ADMIN_PASSWORD']),
    })['accessToken']
    owner, manager, peer, outsider, unassigned = [account(name) for name in ['owner', 'manager', 'peer', 'other-owner', 'unassigned']]
    org = organization(owner, admin, 'A')['id']
    other_org = organization(outsider, admin, 'B')['id']
    invite(org, owner, manager, ['CAMPAIGN_MANAGER'])
    invite(org, owner, peer, ['CAMPAIGN_MANAGER', 'VOLUNTEER_COORDINATOR'])
    invite(org, owner, unassigned, ['CAMPAIGN_MANAGER'])
    invite(other_org, outsider, manager, ['CAMPAIGN_MANAGER'])
    operations, finance = account('operations'), account('finance')
    invite(org, owner, operations, ['VOLUNTEER_COORDINATOR'])
    invite(org, owner, finance, ['FINANCE_MANAGER'])

    mt, ot, pt = manager['token'], owner['token'], peer['token']
    path = '/api/campaigns'
    draft = dict(organizationId=org, campaignType='CAMPAIGN', concept={})
    idea = dict(shortDescription='Learning materials for rural students', primaryGoal='Equip students for school',
                mission='Improve access to learning materials', plannedScale='One school', estimatedBeneficiaries=100)
    ready = dict(draft, title=f'School support {RUN}', cause='EDUCATION',
                 description='Students at the local school need learning materials.',
                 beneficiaryDescription='Students in the local community', location='One school in Ha Noi',
                 concept=idea)
    request('POST', path, body=draft, expected=401, label='Anonymous cannot create')
    request('POST', path, ot, draft, 403, label='Owner without manager role cannot create')
    request('POST', path, mt, {**ready, 'goalAmount': 1000}, 400, label='Draft cannot set a fundraising goal')
    request('POST', path, mt, {**ready, 'volunteerTarget': 10}, 400, label='Draft cannot set a volunteer quota')
    request('POST', path, mt, {**ready, 'startDate': '2027-02-05', 'endDate': '2027-02-01'}, 400,
            label='Reversed dates rejected')

    campaign = request('POST', path, mt, draft, 201, label='Manager saves an incomplete draft')
    assert campaign['status'] == 'DRAFT' and campaign['startDate'] is None and campaign['endDate'] is None
    assert campaign['code'].startswith('GA-') and campaign['concept']['timezone'] == 'Asia/Ho_Chi_Minh'
    url = path + '/' + campaign['id']
    request('GET', url, expected=404, label='Draft is private')
    request('GET', url + '/manage', pt, expected=403, label='Another manager cannot open the draft')
    request('PUT', url, pt, {**ready, 'version': campaign['version']}, 403, label='Another manager cannot edit')
    request('POST', url + '/submit', mt, {'version': campaign['version']}, 400, label='Incomplete draft cannot be submitted')

    legacy_address = {
        'mode': 'LEGACY', 'province': {'code': 1, 'name': 'Thành phố Hà Nội'},
        'district': {'code': 1, 'name': 'Quận Ba Đình'}, 'ward': {'code': 1, 'name': 'Phường Phúc Xá'},
        'detail': 'Nhà văn hóa',
    }
    current_address = {
        'mode': 'CURRENT', 'province': legacy_address['province'], 'district': None,
        'ward': {'code': 4, 'name': 'Phường Ba Đình'}, 'detail': 'Nhà văn hóa',
    }
    request('PUT', url, mt, {**ready, 'version': campaign['version'],
            'concept': {**idea, 'plannedAddress': {**legacy_address, 'district': None}}}, 400,
            label='Legacy ward requires its district')
    campaign = request('PUT', url, mt, {**ready, 'version': campaign['version'],
                       'concept': {**idea, 'plannedAddress': current_address}},
                       label='Current address saves without a district')
    assert campaign['location'] == 'Nhà văn hóa, Phường Ba Đình, Thành phố Hà Nội'
    idea['plannedAddress'] = legacy_address
    campaign = request('PUT', url, mt, {**ready, 'version': campaign['version']}, label='Resume and complete the same draft')
    assert campaign['concept']['primaryGoal'] == idea['primaryGoal'] and campaign['goalAmount'] == 0
    png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')
    campaign = upload(url + '/media', mt, campaign['version'], 'COVER', 'cover.png', png)
    campaign = upload(url + '/media', mt, campaign['version'], 'DOCUMENT')
    assert {m['kind'] for m in campaign['media']} == {'COVER', 'DOCUMENT'}
    for media in campaign['media']:
        request('GET', url + '/media/' + media['id'], expected=401)
        request('GET', url + '/media/' + media['id'], ot)

    stale = campaign['version']
    campaign = request('POST', url + '/submit', mt, {'version': stale}, label='Manager submits the idea without dates or budget')
    assert campaign['status'] == 'PENDING_CONCEPT_APPROVAL'
    version = {'version': campaign['version']}
    request('POST', url + '/submit', mt, version, 409, label='Duplicate submission rejected')
    request('PUT', url, mt, {**ready, **version}, 409, label='Submitted idea cannot be silently changed')
    request('POST', url + '/review', mt, {**version, 'decision': 'APPROVE'}, 403, label='Manager cannot review')
    request('POST', url + '/review', ot, {'version': stale, 'decision': 'APPROVE'}, 409, label='Stale review rejected')
    request('POST', url + '/review', outsider['token'], {**version, 'decision': 'APPROVE'}, 403,
            label='Owner from another organization cannot review')
    inbox = request('GET', f'{path}/organization/{org}?status=PENDING_CONCEPT_APPROVAL', ot)
    assert any(row['id'] == campaign['id'] for row in inbox['items'])
    assert all(row['status'] == 'PENDING_CONCEPT_APPROVAL' for row in inbox['items'])
    owner_view = request('GET', url + '/manage', ot, label='Owner opens submitted idea')
    assert owner_view['concept']['primaryGoal'] == idea['primaryGoal']
    assert owner_view['concept']['plannedAddress'] == legacy_address
    assert owner_view['location'] == 'Nhà văn hóa, Phường Phúc Xá, Quận Ba Đình, Thành phố Hà Nội'
    request('POST', url + '/review', ot, {**version, 'decision': 'REQUEST_CHANGES'}, 400,
            label='A request for changes needs a reason')
    campaign = request('POST', url + '/review', ot, {**version, 'decision': 'REQUEST_CHANGES', 'note': 'Clarify scope'},
                       label='Owner returns the idea for changes')
    assert campaign['status'] == 'NEEDS_REVISION'
    revised = dict(ready, startDate='2027-02-01', endDate='2027-02-03',
                   contactEmail=manager['email'], contactPhone='0900000003',
                   concept={**idea, 'plannedScale': 'One school and 100 students'})
    campaign = request('PUT', url, mt, {**revised, 'version': campaign['version']})
    assert campaign['contactEmail'] == manager['email'] and campaign['contactPhone'] == '0900000003'
    campaign = request('POST', url + '/submit', mt, {'version': campaign['version']}, label='Manager resubmits revised idea')
    campaign = request('POST', url + '/review', ot, {'version': campaign['version'], 'decision': 'APPROVE'},
                       label='Owner approves the concept')
    assert campaign['status'] == 'CONCEPT_APPROVED' and campaign['publishedAt'] is None
    assert [entry['action'] for entry in campaign['reviews'] if entry['action'] in {
        'SUBMIT', 'REQUEST_CHANGES', 'APPROVE',
    }] == ['SUBMIT', 'REQUEST_CHANGES', 'SUBMIT', 'APPROVE']
    request('GET', url, expected=404, label='Concept approval does not publish the campaign')
    assert not request('GET', path + '?search=' + RUN)['items']
    request('DELETE', url, mt, {'version': campaign['version']}, 409, label='Review history cannot be deleted')

    ops, fin = operations['token'], finance['token']
    candidates = request('GET', url + '/assignment-candidates', ot, label='Owner sees active eligible people')
    assert {member['userId'] for member in candidates} == {person['id'] for person in [manager, peer, operations, finance, unassigned]}
    request('GET', url + '/assignment-candidates', mt, expected=403, label='Only Owner can load assignment candidates')
    request('GET', url + '/manage', ops, expected=403, label='Organization role alone cannot open a campaign')
    assignments = [
        {'role': role, 'userId': person['id'], 'isPrimary': True}
        for role, person in [('CAMPAIGN_MANAGER', manager), ('VOLUNTEER_COORDINATOR', operations), ('FINANCE_MANAGER', finance)]
    ]
    assign = {'version': campaign['version'], 'assignments': assignments}
    wrong = [*assignments[:2], {**assignments[2], 'userId': outsider['id']}]
    request('PUT', url + '/assignments', ot, {**assign, 'assignments': wrong}, 400, label='Owner cannot assign a person from another organization')
    request('PUT', url + '/assignments', mt, assign, 403, label='Manager cannot assign department leads')
    helpers = [*assignments, {'role': 'CAMPAIGN_MANAGER', 'userId': peer['id'], 'isPrimary': False}]
    campaign = request('PUT', url + '/assignments', ot, {**assign, 'assignments': helpers}, label='Owner assigns three leads and a helper')
    assert campaign['status'] == 'PLANNING' and len(campaign['assignments']) == 4
    retry = request('PUT', url + '/assignments', ot, {'version': campaign['version'], 'assignments': helpers})
    assert retry['version'] == campaign['version']
    for person in [manager, operations, finance, peer]:
        token = person['token']
        visible = request('GET', f'{path}/organization/{org}?assigned=true', token)
        assert [(row['id'], row['isAssigned']) for row in visible['items']] == [(campaign['id'], True)]
        for attempt in range(20):
            inbox_items = request('GET', '/api/notifications', token)['items']
            matching = [n for n in inbox_items if n['kind'] == 'CAMPAIGN_ASSIGNED' and n['url'].endswith(campaign['id'])]
            if matching:
                break
            time.sleep(0.5)
        assert len(matching) == 1, f'Expected one assignment notification for {person["id"]}'
    passed.append('Assigned users see the campaign and receive one notification each')
    print('PASS', passed[-1])
    request('GET', url, expected=404, label='Assigned campaign remains internal')

    operations_url = url + '/operations'
    view = request('GET', operations_url, ops, label='Operations manager can open the plan')
    days = view['plan']['days']
    assert view['canEdit'] and view['hasAutomaticCalendar']
    assert [day['date'] for day in days] == ['2027-02-01', '2027-02-02', '2027-02-03']
    assert [day['id'] for day in request('GET', operations_url, ops)['plan']['days']] == [day['id'] for day in days]
    assert not request('GET', operations_url, fin)['canEdit']
    request('PUT', operations_url, fin, {'version': view['version'], 'plan': view['plan'], 'confirm': False}, 403,
            label='Finance can read but cannot change operations')
    request('PUT', operations_url, ops, {'version': view['version'], 'plan': view['plan'], 'confirm': True}, 400,
            label='An empty operations plan cannot be confirmed')
    day_id = days[0]['id']
    activity_id, team_id, resource_id = [str(uuid.uuid4()) for _ in range(3)]
    person = operations['id']
    activity = dict(id=activity_id, title='Hand out materials', start='09:00:00', end='10:00:00',
                    location='School hall', tasks='Distribute materials', leadUserId=person,
                    staffNeeded=1, volunteersNeeded=3, teamIds=[team_id], backupUserId=manager['id'])
    day = dict(days[0], title='First day', objective='Support students',
               address={**legacy_address, 'detail': 'School hall'},
               mapPin={'latitude': 21.038, 'longitude': 105.849},
               location='School hall', leadUserId=person, activities=[activity], activitiesDone=True)
    second_address = dict(mode='CURRENT', province={'code': 48, 'name': 'Thành phố Đà Nẵng'},
                          district=None, ward={'code': 20194, 'name': 'Phường Hải Châu'}, detail='Điểm tập kết')
    second_day = dict(days[1], location='Điểm tập kết', address=second_address,
                      mapPin={'latitude': 16.069, 'longitude': 108.221})
    team = dict(id=team_id, name='Logistics', duties='Distribute materials', leadUserId=person,
                staffNeeded=1, volunteersNeeded=3, volunteerSkills='Communication', staffUserIds=[person])
    assert any(category['id'] == 'EVENT_SUPPORT' for category in view['volunteerGroupCategories'])
    group = dict(id=resource_id, categoryId='EVENT_SUPPORT', name='Nhóm 1', volunteerCount=3,
                 dayId=day_id, activityId=activity_id, notes='', teamId=team_id)
    plan = dict(days=[day, second_day], teams=[team], resources=[], volunteerGroups=[group])
    conflicting = dict(plan, days=[dict(day, activities=[activity, dict(activity, id=str(uuid.uuid4()), start='09:30:00')])])
    request('PUT', operations_url, ops, {'version': view['version'], 'plan': conflicting, 'confirm': False}, 400,
            label='A team or member cannot cover overlapping activities')
    saved = request('PUT', operations_url, ops, {'version': view['version'], 'plan': plan, 'confirm': False},
                    label='Operator saves calendar, activities, teams and linked volunteer groups')
    assert len(saved['plan']['days']) == 3 and saved['plan']['days'][0]['activitiesDone']
    assert saved['plan']['days'][0]['location'].startswith('School hall, ')
    assert saved['plan']['days'][1]['address'] == second_address
    assert saved['plan']['days'][1]['mapPin'] == second_day['mapPin']
    assert saved['plan']['days'][0]['activities'][0]['backupUserId'] == manager['id']
    assert saved['plan']['volunteerGroups'][0]['teamId'] == team_id
    wrong_team = dict(plan, volunteerGroups=[dict(group, teamId=str(uuid.uuid4()))])
    request('PUT', operations_url, ops, {'version': saved['version'], 'plan': wrong_team, 'confirm': False}, 400,
            label='Volunteer group must use a team assigned to the activity')
    wrong_category = dict(plan, volunteerGroups=[dict(group, categoryId='INVALID')])
    request('PUT', operations_url, ops, {'version': saved['version'], 'plan': wrong_category, 'confirm': False}, 400,
            label='Volunteer groups must use a category from the catalog')
    over_capacity = dict(plan, volunteerGroups=[group, dict(group, id=str(uuid.uuid4()), activityId=None, volunteerCount=1)])
    request('PUT', operations_url, ops, {'version': saved['version'], 'plan': over_capacity, 'confirm': True}, 400,
            label='All-day and activity-specific groups cannot exceed the team quota')
    extra_day = dict(days[1], id=str(uuid.uuid4()), date='2027-02-04', title='Extra pickup', extraReason='Return borrowed equipment')
    extended = dict(saved['plan'], days=[*saved['plan']['days'], extra_day])
    forged = dict(extended, days=[*saved['plan']['days'], dict(extra_day, extraApprovedAt='2027-02-01T09:00:00Z')])
    request('PUT', operations_url, ops, {'version': saved['version'], 'plan': forged, 'confirm': True}, 400,
            label='Operator cannot self-approve or confirm a plan containing an unapproved extra day')
    pending = request('PUT', operations_url, ops, {'version': saved['version'], 'plan': extended, 'confirm': False},
                      label='Operator can save an extra day with a reason')
    approve_url = operations_url + '/extra-days/' + extra_day['id'] + '/approve'
    request('POST', approve_url, ops, {'version': pending['version']}, 403, label='Only Owner can approve an extra day')
    approved_extension = request('POST', approve_url, ot, {'version': pending['version']}, label='Owner approves the extra day')
    assert approved_extension['plan']['days'][-1]['extraApprovedAt']
    confirmed = request('PUT', operations_url, ops, {'version': approved_extension['version'], 'plan': approved_extension['plan'], 'confirm': True},
                        label='Operator confirms a complete plan')
    owner_plan = request('GET', operations_url, ot)
    assert confirmed['confirmedAt'] and owner_plan['confirmedAt'] == confirmed['confirmedAt']
    confirmer = next(member for member in view['members'] if member['userId'] == person)
    assert confirmed['confirmedByName'] == owner_plan['confirmedByName'] == confirmer['fullName']
    assert owner_plan['plan'] == confirmed['plan'] and not owner_plan['canEdit']
    def list_confirmation():
        rows = request('GET', f'{path}/organization/{org}?assigned=true', fin)['items']
        return next(row['operationsConfirmedAt'] for row in rows if row['id'] == campaign['id'])
    assert list_confirmation() == confirmed['confirmedAt']
    reopened = request('PUT', operations_url, ops, {'version': confirmed['version'], 'plan': confirmed['plan'], 'confirm': False},
                       label='Saving after confirmation returns the plan and its list badge to draft')
    assert reopened['confirmedAt'] is None and reopened['confirmedByName'] is None and list_confirmation() is None
    confirmed = request('PUT', operations_url, ops, {'version': reopened['version'], 'plan': reopened['plan'], 'confirm': True})
    reassigned = [dict(item, userId=peer['id']) if item['role'] == 'VOLUNTEER_COORDINATOR' else item for item in helpers]
    campaign = request('PUT', url + '/assignments', ot, {'version': confirmed['version'], 'assignments': reassigned},
                       label='Owner can replace the operations lead')
    request('GET', operations_url, ops, expected=403, label='Former operations assignee immediately loses access')
    replaced = request('GET', operations_url, pt)
    assert replaced['plan'] == confirmed['plan'] and replaced['canEdit']

    budget_url = url + '/budget'
    finance_queue = f'{path}/organization/{org}?status=PLANNING&assignedRole=FINANCE_MANAGER'
    assert [row['id'] for row in request('GET', finance_queue, fin)['items']] == [campaign['id']]
    request('GET', finance_queue, mt, expected=403, label='Finance queue requires the finance role')
    request('GET', budget_url, ops, expected=403, label='Former assignee cannot read budget')
    budget = request('GET', budget_url, fin, label='Assigned finance manager can start a budget')
    assert budget['canEdit'] and budget['plan'] is None and budget['operationsConfirmed']
    expense = dict(id=str(uuid.uuid4()), name='Truck hire', category='TRANSPORT', quantity=2, unit='vehicles',
                   days=3, unitPrice=2_000_000, activityId=activity_id, notes='')
    funding = [dict(id=str(uuid.uuid4()), name='Organization contribution', amount=2_000_000, confirmed=True, notes=''),
               dict(id=str(uuid.uuid4()), name='Sponsor pledge', amount=1_000_000, confirmed=False, notes='')]
    fundraising = dict(opensOn='2027-01-01', closesOn='2027-01-25', purpose='Transport education materials',
                       categories=['TRANSPORT'], allowOverGoal=False, shortfallPolicy='Reduce trips', publicExplanation='Truck hire for program')
    plan = dict(expenses=[expense], funding=funding, minimumAmount=8_000_000, rationale='Two trucks for three days',
                eventScope=None, fundraising=fundraising)
    payload = dict(version=budget['version'], plan=plan, confirm=False)
    request('PUT', budget_url, ot, payload, 403, label='Owner cannot edit the finance plan')
    request('PUT', budget_url, fin, dict(payload, plan=dict(plan, expenses=[expense, dict(expense, id=str(uuid.uuid4()))])),
            400, label='Duplicate budget expenses are rejected')
    saved_budget = request('PUT', budget_url, fin, payload, label='Finance saves an itemized draft budget')
    assert saved_budget['totals'] == dict(estimated=12_000_000, confirmedFunding=2_000_000,
                                         expectedFunding=1_000_000, fundraisingGoal=10_000_000)
    assert request('GET', budget_url, ot)['plan'] is None
    request('PUT', budget_url, fin, dict(payload, confirm=True), 409, label='Stale budget writes are rejected')
    payload.update(version=saved_budget['version'], confirm=True)
    request('PUT', budget_url, fin, dict(payload, plan=dict(plan, minimumAmount=13_000_000)),
            400, label='Minimum deployment funding cannot exceed the estimate')
    confirmed_budget = request('PUT', budget_url, fin, payload, label='Finance confirms the current budget and fundraising plan')
    owner_budget = request('GET', budget_url, ot)
    assert owner_budget['plan'] == confirmed_budget['plan'] and not owner_budget['canEdit']
    assert request('GET', budget_url, mt)['totals'] == confirmed_budget['totals']
    assert next(row for row in request('GET', finance_queue, fin)['items'])['budgetConfirmedAt'] == confirmed_budget['confirmedAt']
    actual_path = f'{budget_url}/expenses/{expense["id"]}/actual'
    request('PUT', actual_path, pt, dict(version=confirmed_budget['version'], actualAmount=11_500_000), 403,
            label='Operations cannot update actual expenses')
    actual = request('PUT', actual_path, fin, dict(version=confirmed_budget['version'], actualAmount=11_500_000),
                     label='Finance records actual spending on the confirmed budget')
    assert actual['confirmedAt'] == confirmed_budget['confirmedAt']
    assert request('GET', budget_url, ot)['plan']['expenses'][0]['actualAmount'] == 11_500_000
    attendance_path = f'{operations_url}/activities/{activity_id}/attendance'
    counts = dict(staffConfirmed=1, staffPresent=1, volunteersConfirmed=3, volunteersPresent=2)
    request('PUT', attendance_path, pt, dict(version=actual['version'], attendance=dict(counts, volunteersPresent=4)),
            400, label='Attendance cannot exceed the confirmed headcount')
    attendance = request('PUT', attendance_path, pt, dict(version=actual['version'], attendance=counts),
                         label='Operations records actual attendance without resetting approvals')
    assert attendance['confirmedAt'] == replaced['confirmedAt']
    assert request('GET', budget_url, ot)['confirmedAt'] == confirmed_budget['confirmedAt']
    assert request('GET', operations_url, ot)['plan']['days'][0]['activities'][0]['attendance'] == counts

    operations_plan = dict(attendance['plan'], days=[
        dict(day, address=dict(day['address'], detail='Updated school hall')) if day['id'] == day_id else day
        for day in attendance['plan']['days']])
    operations_result = request('PUT', operations_url, pt, dict(version=attendance['version'], plan=operations_plan, confirm=True),
                                label='Operator updates the location of a budgeted deployment day')
    for token in [ot, fin]:
        review_budget = request('GET', budget_url, token)
        assert review_budget['needsReview'] and review_budget['confirmedAt'] is None
    assert request('GET', budget_url, ot)['plan'] is None
    assert request('GET', budget_url, fin)['plan']['expenses'][0]['activityId'] == activity_id
    restored = request('PUT', budget_url, fin, dict(payload, version=operations_result['version']),
                       label='Finance reviews the changed schedule and reconfirms its budget')
    assert restored['confirmedAt'] and not restored['needsReview']
    assert restored['plan']['expenses'][0]['actualAmount'] == 11_500_000

    parent = campaign['id']
    options = request('GET', f'{path}/organization/{org}/parent-options', mt)
    assert any(option['id'] == parent for option in options)
    event = dict(ready, campaignType='EVENT', title=f'School event {RUN}', location='',
                 concept={**idea, 'plannedAddress': None, 'eventFormat': 'ONLINE', 'parentCampaignId': parent,
                          'onlinePlatform': 'Google Meet', 'eventStartTime': '09:00:00',
                          'eventEndTime': '10:30:00'})
    request('POST', path, mt, {**event, 'organizationId': other_org}, 400,
            label='Event cannot link to a campaign from another organization')
    request('POST', path, mt, {**event, 'concept': {**event['concept'], 'eventEndTime': '08:00:00'}}, 400,
            label='Event ending before it starts requires dates that span multiple days')
    request('POST', path, mt, {**event, 'concept': {**event['concept'], 'eventFormat': 'IN_PERSON'}}, 400,
            label='An in-person event cannot specify an online platform')
    event_draft = request('POST', path, mt, event, 201, label='Manager creates an event linked to its campaign')
    assert event_draft['campaignType'] == 'EVENT' and event_draft['concept']['parentCampaignId'] == parent
    event_url = path + '/' + event_draft['id']
    event_draft = request('POST', event_url + '/submit', mt, {'version': event_draft['version']})
    event_review = request('GET', event_url + '/manage', ot, label='Owner sees the online platform and tentative time')
    assert request('GET', event_url + '/related', ot)['parent']['id'] == parent
    assert [child['id'] for child in request('GET', url + '/related', ot)['children']] == [event_draft['id']]
    assert not event_review['location'] and event_review['concept']['onlinePlatform'] == 'Google Meet'
    assert event_review['concept']['eventStartTime'] == '09:00:00' and event_review['concept']['eventEndTime'] == '10:30:00'
    decision = {'version': event_draft['version'], 'decision': 'REJECT'}
    request('POST', event_url + '/review', ot, decision, 400, label='Rejection needs a reason')
    rejected = request('POST', event_url + '/review', ot, {**decision, 'note': 'Venue unavailable'},
                       label='Owner rejects the event idea')
    assert rejected['status'] == 'REJECTED'

    budget = request('GET', budget_url, fin)
    request('POST', url + '/publish', ot, {'version': budget['version']}, 409,
            label='Campaign cannot be published before final approval')
    request('POST', url + '/final/submit', fin, {'version': budget['version']}, 403,
            label='Only assigned campaign managers can submit the final plan')
    qr = upload(url + '/media', fin, budget['version'], 'FUNDRAISING_QR', 'bank-qr.png', png)
    qr_id = next(media['id'] for media in qr['media'] if media['kind'] == 'FUNDRAISING_QR')
    request('POST', url + '/final/submit', mt, {'version': qr['version']}, 409,
            label='Uploading a new QR requires budget reconfirmation before submission')
    receiving = dict(bank=dict(bankName='Fixture Bank', accountHolder='Fixture Holder', accountNumber='123456789',
                               transferNote='School support', qrMediaId=qr_id),
                     goods=dict(acceptedItems='School supplies', address='Private receiving location',
                                receivingHours='08:00–10:00', contact='Fixture contact'))
    untrimmed = dict(receiving, bank=dict(receiving['bank'], bankName='  Fixture Bank  ', accountNumber=' 123456789 '),
                     goods=dict(receiving['goods'], address='  Private receiving location  '))
    plan_with_receiving = dict(restored['plan'], receiving=untrimmed)
    budget = request('PUT', budget_url, fin, dict(version=qr['version'], plan=plan_with_receiving, confirm=True),
                     label='Finance confirms bank transfer, QR and goods receiving details')
    assert request('GET', budget_url, ot)['plan']['receiving'] == receiving
    submitted = request('POST', url + '/final/submit', mt, {'version': budget['version']},
                        label='Campaign manager submits the confirmed plan')
    assert submitted['status'] == 'PENDING_FINAL_REVIEW' and submitted['finalSubmissionId']
    assert request('GET', operations_url, ot)['confirmedAt']
    request('PUT', budget_url, fin, dict(version=submitted['version'], plan=plan_with_receiving, confirm=True), 409,
            label='Budget edits are locked while Owner reviews')
    request('POST', url + '/final/review', ot, dict(version=submitted['version'], submissionId=str(uuid.uuid4()), decision='APPROVE'),
            409, label='Owner must review the current submission snapshot')
    returned = request('POST', url + '/final/review', ot, dict(version=submitted['version'],
                       submissionId=submitted['finalSubmissionId'], decision='REQUEST_CHANGES', revisionArea='BUDGET',
                       note='Confirm the receiving hours'), label='Owner can return only the budget for revision')
    assert returned['status'] == 'PLANNING' and returned['operationsConfirmedAt']
    assert returned['budgetConfirmedAt'] is None and returned['budgetNeedsReview']
    budget = request('PUT', budget_url, fin, dict(version=returned['version'], plan=plan_with_receiving, confirm=True))
    second = request('POST', url + '/final/submit', mt, {'version': budget['version']})
    assert second['finalSubmissionId'] != submitted['finalSubmissionId']
    approved = request('POST', url + '/final/review', ot, dict(version=second['version'],
                       submissionId=second['finalSubmissionId'], decision='APPROVE'), label='Owner approves the resubmitted plan')
    assert approved['status'] == 'FINAL_APPROVED'
    request('GET', url, expected=404, label='Final approval alone does not expose the public page')
    request('POST', url + '/publish', mt, {'version': approved['version']}, 403, label='Only Owner may publish')
    published = request('POST', url + '/publish', ot, {'version': approved['version']},
                        label='Owner publishes the approved campaign')
    assert published['status'] == 'PUBLISHED'
    request('POST', url + '/publish', ot, {'version': approved['version']}, 409,
            label='A retry with the previous version does not publish twice')
    public_view = request('GET', url)
    public_plan = public_view['publicPlan']
    assert public_view['goalAmount'] == 10_000_000 and len(public_plan['days']) == 4
    assert public_view['startDate'] == '2027-02-01' and public_view['endDate'] == '2027-02-04'
    assert public_plan['days'][1]['mapPin'] == second_day['mapPin']
    assert set(public_plan['days'][0]['activities'][0]) == {'title', 'start', 'end', 'location'}
    assert not public_view['reviews'] and not public_view['assignments'] and public_view['finalSubmissionId'] is None
    assert all(media['kind'] in ('COVER', 'GALLERY') for media in public_view['media'])
    assert '123456789' not in json.dumps(public_view) and 'Private receiving location' not in json.dumps(public_view)
    request('GET', url + '/media/' + qr_id, expected=401, label='QR image remains private after publication')
    request('GET', url + '/manage', unassigned['token'], expected=403,
            label='An unassigned manager cannot open a modern published record internally')
    request('GET', budget_url, unassigned['token'], expected=403,
            label='An unassigned manager cannot read the published campaign’s internal bank details')
    request('GET', url + '/media/' + qr_id, unassigned['token'], expected=403,
            label='An unassigned manager cannot retrieve the internal QR')
    assert campaign['id'] not in {item['id'] for item in request('GET', f'{path}/organization/{org}', unassigned['token'])['items']}
    assert request('GET', url + '/media/' + qr_id, fin) == png
    assert request('GET', url + '/media/' + public_view['media'][0]['id']) == png
    paid = request('PUT', actual_path, fin, dict(version=published['version'], actualAmount=11_600_000),
                   label='Finance can continue recording actual expenses after publication')
    assert paid['canRecordActuals'] and not paid['canEdit']
    new_counts = dict(counts, volunteersPresent=3)
    observed = request('PUT', attendance_path, pt, dict(version=paid['version'], attendance=new_counts),
                       label='Assigned operations manager records attendance after publication')
    assert observed['canRecordAttendance'] and not observed['canEdit']
    assert observed['plan']['days'][0]['activities'][0]['attendance'] == new_counts
    request('PUT', operations_url, pt, dict(version=observed['version'], plan=operations_plan, confirm=True), 409,
            label='Published operational plans remain locked')
    assert request('GET', url)['publicPlan'] == public_plan

    disposable = request('POST', path, mt, draft, 201)
    request('DELETE', path + '/' + disposable['id'], mt, {'version': disposable['version']}, 204,
            label='A never-submitted draft can be deleted')
    print(f'\n{len(passed)} checks passed. Test run: {RUN}')


if __name__ == '__main__':
    main()

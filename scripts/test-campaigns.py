"""Local integration tests. Uses real HTTP APIs and fresh, clearly named test fixtures.
Run after start-dev.ps1: python scripts/test-campaigns.py
No user data is edited/deleted. Test accounts/organizations/campaigns remain for inspection.
"""
import base64
import datetime as dt
import json
import pathlib
import secrets
import urllib.error
import urllib.request
import uuid

# Explicit IPv4 matches Compose's 127.0.0.1 bind and avoids Windows IPv6 fallback.
BASE = 'http://127.0.0.1:8080'
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
        with urllib.request.urlopen(urllib.request.Request(BASE+path, data=data, headers=headers, method=method), timeout=30) as response:
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
    env=dict(line.split('=',1) for line in (ROOT/'.env').read_text(encoding='utf-8-sig').splitlines() if '=' in line and not line.startswith('#'))
    admin=request('POST','/api/auth/login',body={'email':env['ADMIN_EMAIL'],'password':env['ADMIN_PASSWORD']})['accessToken']
    owner,manager,staff,other=[account(name) for name in ['owner','manager','staff','other-owner']]
    org=organization(owner,admin,'A')['id']; org_b=organization(other,admin,'B')['id']
    draft_org=organization(owner,admin,'DRAFT',False)['id']
    invite(org,owner,manager,['CAMPAIGN_MANAGER']); invite(org,owner,staff,['STAFF'])
    tomorrow=dt.date.today()+dt.timedelta(days=1)
    payload=dict(organizationId=org,title=f'Campaign TEST {RUN}',description='Test combined campaign to support children and coordinate volunteers.',
      cause='EDUCATION',beneficiaryDescription='Test community of 50 students',goalAmount=5000000,volunteerTarget=10,
      startDate=str(tomorrow),endDate=str(tomorrow+dt.timedelta(days=30)),location='Ha Noi test location',
      contactEmail='campaign-test@example.com',contactPhone='0900000003')
    request('POST','/api/campaigns',body=payload,expected=401,label='Anonymous cannot create')
    for who,name in [(staff,'STAFF'),(owner,'OWNER without manager role'),(other,'Other organization owner')]:
        request('POST','/api/campaigns',who['token'],payload,403,label=name+' cannot create')
    request('POST','/api/campaigns',manager['token'],{**payload,'organizationId':draft_org},403,label='Inactive organization blocked')
    request('POST','/api/campaigns',manager['token'],{**payload,'organizationId':org_b},403,label='Manager cannot create in another organization')
    for key,value in [('title',''),('description','short'),('goalAmount',0),('volunteerTarget',0),('endDate','2020-01-01'),('startDate','2099-01-01'),('contactEmail','invalid'),('campaignType','DONATION')]:
        request('POST','/api/campaigns',manager['token'],{**payload,key:value},400,label='Validate '+key+': '+str(value))
    c=request('POST','/api/campaigns',manager['token'],payload,201,label='Manager creates campaign')
    assert c['campaignType']=='COMBINED' and c['status']=='DRAFT'
    path='/api/campaigns/'+c['id']
    request('GET',path,expected=404,label='Draft hidden from public')
    request('GET',path+'/manage',staff['token'],expected=403,label='Staff cannot read management details')
    request('PUT',path,manager['token'],{**payload,'version':'invalid'},409,label='Stale update rejected')
    c=request('PUT',path,manager['token'],{**payload,'title':payload['title']+' updated','version':c['version']},label='Manager updates draft')
    png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')
    c=upload(path+'/media',manager['token'],c['version'],'COVER','cover.png',png)
    c=upload(path+'/media',manager['token'],c['version'],'DOCUMENT')
    assert len(c['media'])==2
    passed.append('Image and private document upload')
    document=next(m for m in c['media'] if m['kind']=='DOCUMENT')
    request('GET',path+'/media/'+document['id'],expected=401,label='Private document protected before publication')
    stale=c['version']; c=request('POST',path+'/submit',manager['token'],{'version':c['version']},label='Manager submits to Owner')
    request('POST',path+'/submit',manager['token'],{'version':c['version']},409,label='Duplicate submit rejected')
    request('GET',path,expected=404,label='Pending campaign hidden from public')
    for who,label in [(manager,'Manager cannot approve'),(staff,'Staff cannot approve'),(other,'Other Owner cannot approve')]:
        request('POST',path+'/review',who['token'],{'version':c['version'],'decision':'APPROVE'},403,label=label)
    request('POST',path+'/review',owner['token'],{'version':stale,'decision':'APPROVE'},409,label='Stale review rejected')
    request('POST',path+'/review',owner['token'],{'version':c['version'],'decision':'REQUEST_CHANGES','note':''},400,label='Revision needs reason')
    c=request('POST',path+'/review',owner['token'],{'version':c['version'],'decision':'REQUEST_CHANGES','note':'Please clarify plan'},label='Owner requests revision')
    c=request('PUT',path,manager['token'],{**payload,'description':payload['description']+' Revised plan.','version':c['version']},label='Manager revises requested campaign')
    c=request('POST',path+'/submit',manager['token'],{'version':c['version']})
    c=request('POST',path+'/review',owner['token'],{'version':c['version'],'decision':'APPROVE','note':'Approved test'},label='Owner approves')
    c=upload(path+'/media',manager['token'],c['version'],'COVER','replacement.png',png)
    assert len([m for m in c['media'] if m['kind']=='COVER'])==1
    c=upload(path+'/media',manager['token'],c['version'],'GALLERY','gallery.png',png)
    gallery=next(m for m in c['media'] if m['kind']=='GALLERY')
    c=upload(path+'/media',manager['token'],c['version'],'GALLERY','replaced-gallery.png',png,replace_id=gallery['id'])
    assert len([m for m in c['media'] if m['kind']=='GALLERY'])==1
    assert request('GET',path+'/media/'+gallery['id'],label='Published gallery replacement visible via gateway')==png
    passed.append('Replace published cover and add gallery')
    public=request('GET',path,label='Anonymous can view approved campaign')
    assert public['status']=='PUBLISHED' and public['reviews']==[] and all(m['kind']!='DOCUMENT' for m in public['media'])
    request('GET',path+'/media/'+document['id'],expected=401,label='Document remains private after approval')
    public_list=request('GET','/api/campaigns?search='+RUN)
    public_item=next(x for x in public_list['items'] if x['id']==c['id'])
    cover=next(m for m in c['media'] if m['kind']=='COVER')
    assert public_item['coverMediaId']==cover['id']
    assert request('GET',path+'/media/'+cover['id'],label='Published cover available via gateway')==png
    passed.append('Public list includes cover image ID')
    print('PASS Public list includes cover image ID')
    request('PUT',path,manager['token'],{**payload,'contactPhone':'0900000099','version':c['version']},400,label='Published campaign contact phone locked')
    c=request('PUT',path,manager['token'],{**payload,'description':c['description']+' Updated public story.','version':c['version']},label='Manager updates published description')
    assert request('GET',path)['description']==c['description']
    request('POST',path+'/review',owner['token'],{'version':c['version'],'decision':'APPROVE'},409,label='Cannot approve twice')
    c2=request('POST','/api/campaigns',manager['token'],{**payload,'title':'Rejection TEST '+RUN},201)
    p2='/api/campaigns/'+c2['id']; c2=request('POST',p2+'/submit',manager['token'],{'version':c2['version']})
    c2=request('POST',p2+'/review',owner['token'],{'version':c2['version'],'decision':'REJECT','note':'Test rejection'},label='Owner rejects with reason')
    request('GET',p2,expected=404,label='Rejected campaign hidden')
    members=request('GET',f'/api/organizations/{org}/workspace/members',owner['token'])['items']
    member=next(x for x in members if x['userId']==manager['id'])
    request('PUT',f"/api/organizations/{org}/workspace/members/{member['id']}/state",owner['token'],{'version':member['version'],'isActive':False})
    request('POST','/api/campaigns',manager['token'],payload,403,label='Locked member immediately loses create permission')
    member=next(x for x in request('GET',f'/api/organizations/{org}/workspace/members',owner['token'])['items'] if x['id']==member['id'])
    request('PUT',f"/api/organizations/{org}/workspace/members/{member['id']}/state",owner['token'],{'version':member['version'],'isActive':True})
    request('GET','/internal/organizations/'+org+'/campaign-access/'+manager['id'],expected=404,label='Internal permission API not public')
    request('GET','/api/campaigns?page=-1',expected=400,label='Pagination validation')
    print(f'\n{len(passed)} checks passed. Test run: {RUN}. Approved campaign: {BASE}/chien-dich/{c["id"]}')
    report=ROOT/'artifacts'/'campaign-tests.json';report.parent.mkdir(exist_ok=True)
    report.write_text(json.dumps({'run':RUN,'passed':passed,'organizationId':org,'campaignId':c['id']},indent=2))

if __name__=='__main__': main()

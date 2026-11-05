"""HTTP tests for SURVEY_STAFF invitations. Run: python scripts/test-survey-invitations.py
Creates isolated test users/organizations; no campaigns or existing user data are changed.
"""
import importlib.util
import json
from pathlib import Path

spec=importlib.util.spec_from_file_location('campaign_helpers',Path(__file__).with_name('test-campaigns.py'))
h=importlib.util.module_from_spec(spec)
spec.loader.exec_module(h)
r=h.request

def main():
    env=dict(line.split('=',1) for line in (h.ROOT/'.env').read_text(encoding='utf-8-sig').splitlines() if '=' in line and not line.startswith('#'))
    admin=r('POST','/api/auth/login',body={'email':env['ADMIN_EMAIL'],'password':env['ADMIN_PASSWORD']})['accessToken']
    owner,manager,manager2,survey,staff,other,pending,all_roles=[h.account(n) for n in ['survey-owner','survey-manager','survey-manager2','survey-user','survey-staff','survey-other','survey-pending','survey-all-roles']]
    org=h.organization(owner,admin,'SURVEY')['id']
    org_b=h.organization(other,admin,'OTHER')['id']
    h.invite(org,owner,manager,['CAMPAIGN_MANAGER'])
    h.invite(org,owner,manager2,['CAMPAIGN_MANAGER'])
    h.invite(org,owner,staff,['STAFF'])
    base=f'/api/organizations/{org}/workspace'
    def invitations(who): return r('GET',base+'/invitations',who['token'])['items']
    def send(who,user,roles,expected=201,label=None): return r('POST',base+'/invitations',who['token'],{'email':user['email'],'roles':roles},expected,label=label)
    workspace=r('GET',base,manager['token'])
    assert workspace['invitableRoles']==['SURVEY_STAFF'] and not workspace['canManageMembers']
    h.passed.append('Manager workspace advertises survey invitations only')
    workspace=r('GET',base,owner['token'])
    allowed=workspace['invitableRoles']
    assert len(allowed)==6 and 'SURVEY_STAFF' in allowed and 'OWNER' not in allowed and 'ADMIN' not in allowed
    h.passed.append('Owner can invite all six assignable staff roles')
    for role in ['CAMPAIGN_MANAGER','ORGANIZATION_MANAGER','FINANCE_MANAGER','VOLUNTEER_COORDINATOR','STAFF']:
        send(manager,survey,[role],403,'Manager cannot invite '+role)
    send(manager,survey,['SURVEY_STAFF','FINANCE_MANAGER'],403,'Mixed role escalation rejected')
    for role in ['OWNER','ADMIN','survey_staff']:
        send(manager,survey,[role],400,'Reserved or invalid role rejected: '+role)
    send(staff,survey,['SURVEY_STAFF'],403,'Staff cannot invite')
    r('POST',base+'/invitations',body={'email':survey['email'],'roles':['SURVEY_STAFF']},expected=401,label='Anonymous cannot invite')
    r('POST',base+'/invitations',admin,{'email':survey['email'],'roles':['SURVEY_STAFF']},403,label='Platform ADMIN does not bypass organization membership')
    r('POST',f'/api/organizations/{org_b}/workspace/invitations',manager['token'],{'email':survey['email'],'roles':['SURVEY_STAFF']},403,label='Cross-organization invite blocked')
    invitation=send(manager,survey,['SURVEY_STAFF'],label='Manager invites an existing user as survey staff')
    inv=next(x for x in r('GET','/api/organizations/invitations/mine',survey['token']) if x['id']==invitation['id'])
    r('POST',f"/api/organizations/invitations/{inv['id']}/respond",survey['token'],{'accept':True,'version':inv['version']},label='Survey user accepts invitation')
    members=r('GET',base+'/members',owner['token'])['items']
    member=next(x for x in members if x['userId']==survey['id'])
    assert member['roles']==['SURVEY_STAFF'] and member['isActive']
    send(survey,pending,['SURVEY_STAFF'],403,'Survey staff cannot invite others')
    r('PUT',base+f"/members/{member['id']}/roles",manager['token'],{'roles':['CAMPAIGN_MANAGER'],'version':member['version']},403,label='Manager cannot edit existing member roles')
    r('PUT',base+f"/members/{member['id']}/state",manager['token'],{'isActive':False,'version':member['version']},403,label='Manager cannot lock organization members')
    send(owner,all_roles,allowed,label='Owner invites all assignable roles together')
    own_only=invitations(manager)
    assert all(x['id']!=inv['id'] or x['state']=='ACCEPTED' for x in own_only)
    assert not any(x['email']==all_roles['email'] for x in own_only)
    assert invitations(manager2)==[]
    h.passed.append('Managers see only invitations they sent')
    owned=next(x for x in invitations(owner) if x['email']==all_roles['email'])
    r('POST',base+f"/invitations/{owned['id']}/revoke",manager['token'],{'version':owned['version']},403,label='Manager cannot revoke Owner invitation')
    invitation=send(manager,pending,['SURVEY_STAFF'])
    inv=next(x for x in invitations(manager) if x['id']==invitation['id'])
    r('POST',base+f"/invitations/{inv['id']}/revoke",manager2['token'],{'version':inv['version']},403,label='Manager cannot revoke another manager invitation')
    r('POST',base+f"/invitations/{inv['id']}/revoke",manager['token'],{'version':inv['version']},label='Manager revokes own survey invitation')
    # New account is needed because revoked invitations can coexist with a new pending one.
    invitation=send(manager,pending,['SURVEY_STAFF'])
    inv=next(x for x in r('GET','/api/organizations/invitations/mine',pending['token']) if x['id']==invitation['id'])
    mgr=next(x for x in r('GET',base+'/members',owner['token'])['items'] if x['userId']==manager['id'])
    r('PUT',base+f"/members/{mgr['id']}/state",owner['token'],{'isActive':False,'version':mgr['version']})
    send(manager,other,['SURVEY_STAFF'],403,'Locked manager cannot send invitations')
    r('POST',f"/api/organizations/invitations/{inv['id']}/respond",pending['token'],{'accept':True,'version':inv['version']},403,label='Pending invitation cannot bypass inviter lock')
    mgr=next(x for x in r('GET',base+'/members',owner['token'])['items'] if x['userId']==manager['id'])
    r('PUT',base+f"/members/{mgr['id']}/state",owner['token'],{'isActive':True,'version':mgr['version']})
    mgr=next(x for x in r('GET',base+'/members',owner['token'])['items'] if x['userId']==manager['id'])
    r('PUT',base+f"/members/{mgr['id']}/roles",owner['token'],{'roles':['STAFF'],'version':mgr['version']})
    r('POST',f"/api/organizations/invitations/{inv['id']}/respond",pending['token'],{'accept':True,'version':inv['version']},403,label='Pending invitation cannot bypass revoked manager role')
    r('POST',base+f"/invitations/{inv['id']}/revoke",owner['token'],{'version':inv['version']},label='Owner can revoke manager survey invitation')
    # Owner retains authority to assign survey role to an existing member.
    staff_member=next(x for x in r('GET',base+'/members',owner['token'])['items'] if x['userId']==staff['id'])
    r('PUT',base+f"/members/{staff_member['id']}/roles",owner['token'],{'roles':['STAFF','SURVEY_STAFF'],'version':staff_member['version']},label='Owner assigns survey role to existing member')
    result={'run':h.RUN,'passed':h.passed,'organizationId':org}
    output=h.ROOT/'artifacts'/'survey-invitation-tests.json';output.parent.mkdir(exist_ok=True);output.write_text(json.dumps(result,indent=2))
    print(f'{len(h.passed)} checks passed. No test campaigns created.')

if __name__=='__main__': main()

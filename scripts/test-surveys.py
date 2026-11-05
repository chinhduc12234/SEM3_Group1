"""Integration tests for private survey reports through the gateway.
python scripts/test-surveys.py [--ui-fixture]
Creates isolated test organizations/users; never edits existing reports or campaigns.
Optional UI credentials are temporary and written only to gitignored artifacts.
"""
import base64
import datetime as dt
import importlib.util
import json
import struct
import sys
import uuid
import zlib
from pathlib import Path

spec=importlib.util.spec_from_file_location('helpers',Path(__file__).with_name('test-campaigns.py'))
h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
r=h.request
ROOT='/api/campaigns/surveys'

def png():
    def chunk(kind,data): return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',4,3,8,2,0,0,0))+chunk(b'IDAT',zlib.compress((b'\0'+b'\x20\x80\x40'*4)*3))+chunk(b'IEND',b'')

def upload(report,who,files,expected=200,label=None):
    boundary='survey-'+uuid.uuid4().hex
    body=f'--{boundary}\r\nContent-Disposition: form-data; name="version"\r\n\r\n{report["version"]}\r\n'.encode()
    for name,content in files:
        body+=f'--{boundary}\r\nContent-Disposition: form-data; name="files"; filename="{name}"\r\nContent-Type: image/png\r\n\r\n'.encode()+content+b'\r\n'
    body+=f'--{boundary}--\r\n'.encode()
    return r('POST',f'{ROOT}/reports/{report["id"]}/images',who['token'],expected=expected,raw=body,content_type='multipart/form-data; boundary='+boundary,label=label)

def main():
    env=dict(line.split('=',1) for line in (h.ROOT/'.env').read_text(encoding='utf-8-sig').splitlines() if '=' in line and not line.startswith('#'))
    admin=r('POST','/api/auth/login',body={'email':env['ADMIN_EMAIL'],'password':env['ADMIN_PASSWORD']})['accessToken']
    owner,m1,m2,s1,s2,staff,foreign,unassigned=[h.account(n) for n in ['report-owner','report-manager','report-manager2','report-survey','report-survey2','report-staff','report-foreign','report-unassigned']]
    org=h.organization(owner,admin,'REPORTS')['id'];org_b=h.organization(foreign,admin,'REPORTS-B')['id']
    h.invite(org,owner,m1,['CAMPAIGN_MANAGER']);h.invite(org,owner,m2,['CAMPAIGN_MANAGER'])
    h.invite(org,m1,s1,['SURVEY_STAFF']);h.invite(org,m1,s2,['SURVEY_STAFF']);h.invite(org,owner,staff,['STAFF']);h.invite(org,owner,unassigned,['SURVEY_STAFF'])
    body=dict(title='Khảo sát TEST '+h.RUN,province='Hà Nội',ward='Phường thử nghiệm',addressDetail='123 địa chỉ khảo sát thử nghiệm',category='HOUSING',severity='HIGH',affectedHouseholds=12,
      description='Báo cáo thử nghiệm khảo sát thực tế về các hộ dân cần hỗ trợ nhà ở và sinh kế.',proposedSupport='Đề xuất hỗ trợ nhu yếu phẩm và sửa chữa nhà ở.',surveyedAt=str(dt.date.today()))
    create=f'{ROOT}/organizations/{org}/reports'
    r('POST',create,body=body,expected=401,label='Anonymous cannot create survey')
    for who,name in [(owner,'Owner'),(m1,'Manager'),(staff,'Staff')]:
        r('POST',create,who['token'],body,403,label=name+' without SURVEY_STAFF cannot create')
    r('POST',create,admin,body,403,label='Admin has no survey bypass')
    r('POST',f'{ROOT}/organizations/{org_b}/reports',s1['token'],body,403,label='Cross-organization create blocked')
    for key,value in [('title',''),('province',''),('description','short'),('proposedSupport','no'),('affectedHouseholds',-1),('category','INVALID'),('severity','INVALID'),('surveyedAt','2099-01-01')]:
        r('POST',create,s1['token'],{**body,key:value},400,label='Validate '+key)
    report=r('POST',create,s1['token'],{**body,'staffId':s2['id'],'managerId':m2['id'],'organizationId':org_b},201,label='Survey staff creates report')
    assert report['staffId']==s1['id'] and report['organizationId']==org and report['status']=='DRAFT'
    path=f'{ROOT}/reports/{report["id"]}'
    for who,name in [(s2,'Other staff'),(m1,'Manager before submission'),(foreign,'Foreign Owner')]:
        r('GET',path,who['token'],expected=403,label=name+' cannot read private draft')
    r('GET',path,expected=401,label='Report not publicly accessible')
    r('GET',f'{ROOT}/organizations/{org}/reports?mode=mine',s2['token'],label='Other staff own list available')
    r('PUT',path,s2['token'],{**body,'version':report['version']},403,label='Other staff cannot update')
    r('PUT',path,s1['token'],{**body,'version':'stale'},409,label='Stale report edit rejected')
    report=r('PUT',path,s1['token'],{**body,'title':body['title']+' cập nhật','version':report['version']},label='Author edits draft')
    r('POST',path+'/submit',s1['token'],{'version':report['version']},400,label='Submission requires evidence image')
    upload(report,s1,[('script.png',b'<script>alert(1)</script>')],400,'Script disguised as PNG rejected')
    upload(report,s1,[('vector.svg',b'<svg onload="alert(1)"></svg>')],400,'SVG rejected')
    upload(report,s1,[('valid.exe',png())],400,'Executable extension rejected')
    upload(report,s1,[('wrong.jpg',png())],400,'Extension/content mismatch rejected')
    upload(report,s1,[('large.png',b'0'*(5*1024*1024+1))],400,'Image over 5 MB rejected through gateway')
    upload(report,s1,[('valid.png',png()),('bad.png',b'not an image')],400,'Mixed invalid batch rejected atomically')
    assert r('GET',path,s1['token'])['images']==[]
    report=upload(report,s1,[('one.png',png()),('two.png',png()+b'<script>payload</script>')],label='Multiple valid images uploaded together')
    assert len(report['images'])==2
    assert all(image['contentType']=='image/jpeg' and image['fileName'].endswith('.jpg') for image in report['images'])
    imgpath=path+'/images/'+report['images'][0]['id']
    content=r('GET',imgpath,s1['token'],label='Author views image')
    assert content.startswith(b'\xff\xd8') and b'<script>' not in content
    content=r('GET',path+'/images/'+report['images'][1]['id'],s1['token'])
    assert b'<script>' not in content
    for who,name in [(None,'Anonymous'),(s2['token'],'Other staff'),(m1['token'],'Manager before submission')]:
        r('GET',imgpath,who,expected=401 if who is None else 403,label=name+' cannot access private image')
    upload(report,s2,[('another.png',png())],403,'Other staff cannot upload')
    upload(report,s1,[(str(i)+'.png',png()) for i in range(9)],400,'Maximum 10 evidence images enforced')
    old=report['version']
    report=r('DELETE',path+'/images/'+report['images'][0]['id'],s1['token'],{'version':report['version']},label='Author removes image from draft')
    assert len(report['images'])==1
    r('POST',path+'/submit',s1['token'],{'version':old},409,label='Stale submission rejected')
    report=r('POST',path+'/submit',s1['token'],{'version':report['version'],'managerId':m2['id']},label='Send report to server-resolved direct manager')
    assert report['managerId']==m1['id'] and report['status']=='SUBMITTED'
    dashboard=r('GET',f'{ROOT}/organizations/{org}/dashboard',s1['token']);assert dashboard['pending']==1 and dashboard['submitted']==1
    assigned=r('GET',f'{ROOT}/organizations/{org}/reports?mode=review',m1['token']);assert assigned['totalCount']==1
    not_assigned=r('GET',f'{ROOT}/organizations/{org}/reports?mode=review',m2['token']);assert not_assigned['totalCount']==0
    r('GET',path,m2['token'],expected=403,label='Unassigned same-org manager cannot read report')
    r('POST',path+'/review',m2['token'],{'version':report['version'],'decision':'APPROVE'},403,label='Unassigned manager cannot approve')
    r('GET',path+'/images/'+report['images'][0]['id'],m1['token'],label='Assigned manager views evidence')
    r('PUT',path,s1['token'],{**body,'version':report['version']},409,label='Submitted report locked against editing')
    r('DELETE',path,s1['token'],{'version':report['version']},409,label='Submitted report cannot be deleted')
    upload(report,s1,[('locked.png',png())],409,'Submitted evidence locked')
    r('POST',path+'/review',m1['token'],{'version':report['version'],'decision':'REQUEST_CHANGES','note':''},400,label='Revision requires reason')
    report=r('POST',path+'/review',m1['token'],{'version':report['version'],'decision':'REQUEST_CHANGES','note':'Bổ sung thông tin hiện trạng.'},label='Manager requests revision')
    notifications=r('GET',f'{ROOT}/organizations/{org}/notifications',s1['token']);assert notifications['totalCount']==1
    notification=notifications['items'][0]
    r('POST',f'{ROOT}/notifications/{notification["id"]}/read',s2['token'],expected=404,label='Notification IDOR rejected')
    r('POST',f'{ROOT}/notifications/{notification["id"]}/read',s1['token'],expected=204,label='Author marks feedback read')
    report=r('PUT',path,s1['token'],{**body,'description':body['description']+' Đã bổ sung nội dung thực địa.','version':report['version']},label='Author supplements requested report')
    report=upload(report,s1,[('supplement.png',png())],label='Author supplements evidence')
    members=r('GET',f'/api/organizations/{org}/workspace/members',owner['token'])['items'];member=next(x for x in members if x['userId']==s1['id'])
    r('PUT',f'/api/organizations/{org}/workspace/members/{member["id"]}/survey-manager',s1['token'],{'version':member['version'],'surveyManagerUserId':m2['id']},403,label='Survey staff cannot choose own supervisor')
    r('PUT',f'/api/organizations/{org}/workspace/members/{member["id"]}/survey-manager',owner['token'],{'version':member['version'],'surveyManagerUserId':staff['id']},400,label='Supervisor must have CAMPAIGN_MANAGER role')
    r('PUT',f'/api/organizations/{org}/workspace/members/{member["id"]}/survey-manager',owner['token'],{'version':member['version'],'surveyManagerUserId':m2['id']},label='Owner assigns new direct manager')
    report=r('POST',path+'/submit',s1['token'],{'version':report['version']},label='Resubmission goes to current direct manager')
    assert report['managerId']==m2['id']
    r('GET',path,m1['token'],expected=403,label='Former recipient cannot read rerouted report')
    old_notifications=r('GET',f'{ROOT}/organizations/{org}/notifications',m1['token'],label='Former manager notifications exclude rerouted report')
    assert old_notifications['totalCount']==0
    report=r('POST',path+'/review',m2['token'],{'version':report['version'],'decision':'APPROVE','note':'Đã xác minh.'},label='Assigned Campaign Manager accepts report')
    assert report['status']=='APPROVED' and report['reviewedBy']==m2['id']
    r('PUT',path,s1['token'],{**body,'version':report['version']},409,label='Approved report immutable')
    r('DELETE',path,s1['token'],{'version':report['version']},409,label='Approved report cannot be deleted')
    r('POST',path+'/review',m2['token'],{'version':report['version'],'decision':'APPROVE'},409,label='Duplicate approval rejected')
    assert r('GET',f'{ROOT}/organizations/{org}/notifications',s1['token'])['totalCount']==2
    rejected=r('POST',create,s1['token'],body,201);rejected=upload(rejected,s1,[('proof.png',png())]);rejected=r('POST',f'{ROOT}/reports/{rejected["id"]}/submit',s1['token'],{'version':rejected['version']})
    r('POST',f'{ROOT}/reports/{rejected["id"]}/review',m2['token'],{'version':rejected['version'],'decision':'REJECT','note':'Thiếu cơ sở xác minh.'},label='Manager rejects with feedback')
    draft=r('POST',create,s2['token'],body,201);draft=upload(draft,s2,[('delete.png',png())]);delete_path=f'{ROOT}/reports/{draft["id"]}'
    r('DELETE',delete_path,s2['token'],{'version':draft['version']},204,label='Author deletes draft')
    r('GET',delete_path,s2['token'],expected=404,label='Deleted report hidden')
    r('GET',delete_path+'/images/'+draft['images'][0]['id'],s2['token'],expected=404,label='Deleted report evidence inaccessible')
    empty_manager=r('POST',create,unassigned['token'],body,201);empty_manager=upload(empty_manager,unassigned,[('unassigned.png',png())])
    r('POST',f'{ROOT}/reports/{empty_manager["id"]}/submit',unassigned['token'],{'version':empty_manager['version']},400,label='No supervisor cannot submit')
    d=r('GET',f'{ROOT}/organizations/{org}/dashboard',s1['token']);assert d['approved']==1 and d['rejected']==1
    r('GET',f'{ROOT}/organizations/{org}/reports?mode=mine&page=-1',s1['token'],expected=400,label='Survey pagination validation')
    r('GET',f'{ROOT}/organizations/{org}/dashboard?mode=review',staff['token'],expected=403,label='Ordinary staff cannot access manager dashboard')
    r('GET','/internal/organizations/'+org+'/campaign-access/'+s1['id'],expected=404,label='Internal role endpoint hidden by gateway')
    report_output={'run':h.RUN,'passed':h.passed,'organizationId':org,'approvedReportId':report['id']}
    artifacts=h.ROOT/'artifacts';artifacts.mkdir(exist_ok=True)
    (artifacts/'survey-report-tests.json').write_text(json.dumps(report_output,ensure_ascii=False,indent=2),encoding='utf-8')
    if '--ui-fixture' in sys.argv:
        # Optional, temporary local test credentials, removed by the UI test runner after use.
        (artifacts/'survey-ui-fixture.json').write_text(json.dumps({'organizationId':org,'staffEmail':s1['email'],'managerEmail':m2['email'],'password':h.PASSWORD,'approvedReportId':report['id']}))
    print(f'{len(h.passed)} survey checks passed. No campaigns created.')

if __name__=='__main__': main()

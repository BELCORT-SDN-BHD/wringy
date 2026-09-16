import json,zipfile,xml.etree.ElementTree as ET, pathlib,hashlib
root=pathlib.Path(__file__).parent
ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
def col(n):
 s=''
 while n:
  n,r=divmod(n-1,26);s=chr(65+r)+s
 return s
def read(path):
 z=zipfile.ZipFile(path); shared=[]
 if 'xl/sharedStrings.xml' in z.namelist():
  shared=[''.join(x.itertext()) for x in ET.fromstring(z.read('xl/sharedStrings.xml'))]
 sheets={}; count=0; missing=[]; errors=[]
 for i,name in enumerate(['总览','假设','单位经济','保守现金流','基准现金流','扩张现金流','品牌获客回收','敏感性'],1):
  data={}
  for c in ET.fromstring(z.read(f'xl/worksheets/sheet{i}.xml')).findall('.//s:c',ns):
   v=c.find('s:v',ns);f=c.find('s:f',ns);t=c.get('t');val=v.text if v is not None else None
   if t=='e':errors.append((name,c.get('r'),val))
   if f is not None:
    count+=1
    if v is None:missing.append((name,c.get('r')))
   if t=='s' and val is not None:val=shared[int(val)]
   elif t=='inlineStr':val=''.join(c.find('s:is',ns).itertext())
   elif val is not None and t not in ['str','e']:
    try:val=float(val)
    except ValueError:pass
   data[c.get('r')]=val
  sheets[name]=data
 assert not errors,errors
 assert not missing,missing
 return sheets,count
r=json.loads((root/'results.json').read_text())
for idx,case in enumerate(r['scenarios']):
 for mode in ['payment3Percent','collectionLag1Month']:
  cum=0;minimum=0;pay=None;prevRevenue=0
  for m in case['months']:
   cf=m['cashFlow']-(195*m['campaigns'] if mode=='payment3Percent' else m['revenue']-prevRevenue)
   cum+=cf;minimum=min(minimum,cum)
   if m['month']>4 and cum>=0 and pay is None:pay=m['month']
   prevRevenue=m['revenue']
  expected=r['sensitivities'][mode][idx]
  assert abs(cum-expected['cumulative36'])<1e-6
  assert abs(-minimum-expected['peakCashNeed'])<1e-6
  assert pay==expected['paybackMonth']
records=[]
for path in [root/'outputs/financial-model/Wringy-36个月财务模型.xlsx',root/'recalculated/Wringy-36个月财务模型.xlsx']:
 s,count=read(path);checks=0
 for idx,case in enumerate(r['scenarios']):
  data=s[case['name']+'现金流']
  for m in case['months']:
   c=col(m['month']+3)
   for row,key in [(6,'campaigns'),(7,'activeBrands'),(9,'newBrands'),(10,'cac'),(11,'eligibleViews'),(14,'revenue'),(17,'cogs'),(18,'grossProfit'),(21,'contribution'),(24,'operatingResult'),(26,'development'),(27,'launch'),(28,'cashFlow'),(29,'cumulative')]:
    assert abs(data[c+str(row)]-m[key])<1e-6,(path,case['name'],c,row,data[c+str(row)],m[key]);checks+=1
  summary=s['总览'];c=col(idx+4)
  assert summary[c+'6']==(case['paybackMonth'] or '36个月内未回本')
  assert abs(summary[c+'8']-case['peakCashNeed'])<1e-6
  sens=r['sensitivities']['payment3Percent'][idx]
  assert s['敏感性'][c+'45']==(sens['paybackMonth'] or '36个月内未回本')
  assert abs(s['敏感性'][c+'47']-sens['cumulative36'])<1e-6
 for addr,val in [('D6',1500),('D17',14000),('D18',16000),('D19',16000/30000),('D22',-2000),('D24',23)]:assert abs(s['单位经济'][addr]-val)<1e-6
 records.append({'file':str(path.relative_to(root)),'formulaCellsWithCaches':count,'independentMonthlyChecks':checks,'errors':0,'summaryAndSensitivityReconciled':True,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
(root/'cached-verification.json').write_text(json.dumps({'verified':True,'engines':['artifact-tool','bundled LibreOffice headless'],'records':records},ensure_ascii=False,indent=2))
print(json.dumps(records,ensure_ascii=False,indent=2))

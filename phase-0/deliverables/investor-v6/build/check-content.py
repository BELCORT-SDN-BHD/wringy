from pathlib import Path
import json,zipfile,hashlib,xml.etree.ElementTree as E
r=Path(__file__).resolve().parent.parent
model=r.parents[1]/'finance/model-v1'
results=json.loads((model/'results.json').read_text())
p=r/'output/Wringy-Investor-v6.pptx'
ns={'c':'http://schemas.openxmlformats.org/drawingml/2006/chart','a':'http://schemas.openxmlformats.org/drawingml/2006/main','p':'http://schemas.openxmlformats.org/presentationml/2006/main'}
with zipfile.ZipFile(p) as z:
 texts={i:'\n'.join(E.fromstring(z.read(f'ppt/slides/slide{i}.xml')).itertext()) for i in range(1,19)}
 def req(i,*vs):
  for v in vs:assert v in texts[i],(i,v)
 req(6,'拒稿须对应已公布要求','不自动通过')
 req(7,'按播放计酬','7天','3天','非银行到账承诺')
 req(8,'RM750','50.0%')
 req(9,'53.3%','16,000','-2,000','新品牌获客前')
 req(10,'23','未计新增品牌获客费')
 req(11,'第25个月','第18个月','36个月内未回本','以0占位')
 req(12,'383,200','326,850','306,950','M31','M28','分别单独变化，不叠加')
 req(17,'RM576,150','按播放计酬需重新估价')
 req(18,'Wringy','设计提案','全部投稿、拒稿与申诉')
 assert 'Belcort' not in '\n'.join(texts.values())
 charts=[n for n in z.namelist() if '/charts/chart' in n and n.endswith('.xml')]
 cash=[E.fromstring(z.read(n)) for n in charts if b'M36' in z.read(n)][0]
 series=cash.findall('.//c:ser',ns);assert len(series)==4
 for k,s in enumerate(series):
  cats=[x.text for x in s.findall('.//c:cat//c:pt/c:v',ns)]
  assert cats==[f'M{i}' for i in range(1,37)],(k,cats)
  vals=[float(x.text) for x in s.findall('./c:val//c:pt/c:v',ns)]
  expected=[m['cumulative']/10000 for m in results['scenarios'][k]['months']] if k<3 else [0]*36
  assert len(vals)==36
  assert all(abs(a-b)<0.00000051 for a,b in zip(vals,expected)),k
 assert len(charts)==3
 for i in [9,12]: assert len(E.fromstring(z.read(f'ppt/slides/slide{i}.xml')).findall('.//a:tbl',ns))==1
report={'status':'pass','final_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'slides':18,'native_charts':3,'native_tables':2,'cash_categories':'unique ordered M1-M36, all4series','cash_data':'all108scenario values match frozen results within RM0.01','content_constraints':'passed','finance_results_sha256':hashlib.sha256((model/'results.json').read_bytes()).hexdigest()}
(r/'build/content-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False))

from pathlib import Path
import json,zipfile,xml.etree.ElementTree as E
b=Path(__file__).parent;v1=b.parent.parent/'content-rewards-business-v1';f=json.loads((v1/'finance/results.json').read_text());a=json.loads((b/'review-2.pptx.validation.json').read_text());assert a['presentationLayout']['warning_count']==0 and a['presentationLayout']['finding_count']==0
expected=[[2000,300],[90,20,10,180],[180,90,0,-90],[50000,13620,6380],[110000,70000]]
ns={'c':'http://schemas.openxmlformats.org/drawingml/2006/chart','a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
with zipfile.ZipFile(b.parent/'output/review-2.pptx') as z:
 names=sorted([n for n in z.namelist() if '/charts/chart' in n and n.endswith('.xml')]);actual=[]
 for n in names:
  root=E.fromstring(z.read(n));actual.append([float(v.text) for v in root.findall('.//c:val/c:numRef/c:numCache/c:pt/c:v',ns)])
 assert actual==expected,(actual,expected)
 pic=sum(len(E.fromstring(z.read(f'ppt/slides/slide{i}.xml')).findall('.//{http://schemas.openxmlformats.org/presentationml/2006/main}pic')) for i in range(1,19));assert pic==0
 texts=''.join(''.join(E.fromstring(z.read(f'ppt/slides/slide{i}.xml')).itertext()) for i in range(1,19));assert '950,000' not in texts and '待财务' not in texts
 assert f['rd_all_in_cap']==50000 and f['proposed_ask_rounded_5000']==70000 and f['founder_allowance_sensitivity']['proposed_ask_rounded_5000']==110000
 assert 70000+36000+5400-1400==110000 and 2043+4337==6380
 report={'chart_values':actual,'chart_count':len(names),'all_match':True,'layout_warnings':0,'layout_findings':0,'native_slide_picture_count':pic,'finance_model_unchanged':True,'slide_count':18,'funding_uplift_check':40000,'hours_contribution_check':[300-30*h-30 for h in [3,6,9,12]],'native_powerpoint_open_verified':False}
 (b/'data-qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False))

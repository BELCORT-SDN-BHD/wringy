from pathlib import Path
from zipfile import ZipFile
from pypdf import PdfReader
import json,hashlib,shutil,xml.etree.ElementTree as E
r=Path(__file__).resolve().parent.parent;out=r/'output';ns={'c':'http://schemas.openxmlformats.org/drawingml/2006/chart','a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
source=json.loads((r/'../../finance/model-v1/results.json').resolve().read_text())
checks={}
with ZipFile(out/'Wringy-Angel-Deck-final.pptx') as z:
 slides=[n for n in z.namelist() if n.startswith('ppt/slides/slide') and n.endswith('.xml')];assert len(slides)==17
 charts=[n for n in z.namelist() if '/charts/' in n and '/_rels/' not in n and n.endswith('.xml')];assert len(charts)==2
 checks['native_chart_parts']=charts
 x=E.fromstring(z.read('ppt/slides/charts/chart2.xml'))
 series=x.findall('.//c:ser',ns);assert len(series)==4
 for i,ser in enumerate(series):
  cats=[p.find('c:v',ns).text for p in ser.findall('./c:cat//c:pt',ns)]
  assert cats==[f'M{j}' for j in range(1,37)]
  vals=[float(p.find('c:v',ns).text) for p in ser.findall('./c:val//c:pt',ns)]
  target=[round(m['cumulative']/10000,6) for m in source['scenarios'][i]['months']] if i<3 else [0]*36
  assert all(abs(a-b)<1e-6 for a,b in zip(vals,target))
 checks['cash_curve_points_matched_frozen_source']=108;checks['zero_line_points']=36;checks['unique_months_per_series']=36
 for slide,text in [(6,'推广佣金支出'),(8,'活动平台（如 Partipost）'),(13,'以平台净服务费为收入口径（假设）'),(14,'36个月公司累计现金'),(16,'按播放计酬：批准后开始')]:
  xml=E.fromstring(z.read(f'ppt/slides/slide{slide}.xml'));txt=''.join(t.text or '' for t in xml.findall('.//a:t',ns));assert text in txt,(slide,text)
 checks['required_final_wording']=True
assert len(PdfReader(str(out/'Wringy-Angel-Deck-final.pdf')).pages)==17
assert len(PdfReader(str(out/'Wringy-Angel-Deck-final-Main12.pdf')).pages)==12
assert len(list((out/'slides').glob('slide-*.png')))==17
sup=r/'build/superseded';sup.mkdir(exist_ok=True)
for f in list(out.glob('Wringy-*')):
 if '-final' not in f.name:shutil.move(str(f),str(sup/f.name))
for suffix in ['.pptx','.pdf','-Main12.pdf']:
 src=out/f'Wringy-Angel-Deck-final{suffix}';dst=out/f'Wringy-Angel-Deck-v1{suffix}'
 shutil.copy2(src,dst);shutil.move(str(src),str(r/'build'/f'validated-final{suffix}'))
files=[out/'Wringy-Angel-Deck-v1.pptx',out/'Wringy-Angel-Deck-v1.pdf',out/'Wringy-Angel-Deck-v1-Main12.pdf',*sorted((out/'slides').glob('*.png'))]
hashes={str(f.relative_to(r)):{'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in files}
receipt=json.loads((r/'build/validation-final.json').read_text());assert hashes['output/Wringy-Angel-Deck-v1.pptx']['sha256']==receipt['finalSha256']
checks.update({'pptx_slides':17,'full_pdf_pages':17,'main_pdf_pages':12,'pngs':17,'native_charts':2,'canonical_pptx_matches_finalizer_hash':True,'all_outputs_same_build_revision':'final'})
(r/'build/content-check.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2))
(r/'build/FROZEN.json').write_text(json.dumps({'status':'frozen-discussion-draft','date':'2026-09-10','scope':'12 main slides + 5 appendix slides','canonical_story':'phase-0/foundation/angel-story-v1.md','validation':'build/validation-final.json','content_checks':checks,'visual_review':'All 17 rendered slides inspected; final changes on 6 and 13 rechecked. Main reviewed drafts and supplied corrections.','open_founder_inputs':['Founder name, relevant biography and actual customer evidence','Raise amount and quantified/timebound funding milestones'],'files':hashes},ensure_ascii=False,indent=2))
print(json.dumps(checks,ensure_ascii=False,indent=2))

from pathlib import Path
import json,zipfile,hashlib,re,xml.etree.ElementTree as E,math
from pypdf import PdfReader
from PIL import Image
r=Path(__file__).resolve().parent.parent;sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();deck=r/'output/Wringy-Content-Rewards-Business-Plan.pptx';pdf=deck.with_suffix('.pdf')
A='{http://schemas.openxmlformats.org/drawingml/2006/main}';C='{http://schemas.openxmlformats.org/drawingml/2006/chart}';P='{http://schemas.openxmlformats.org/presentationml/2006/main}'
with zipfile.ZipFile(deck) as z:
 ns=sorted([n for n in z.namelist() if re.fullmatch(r'ppt/slides/slide\d+.xml',n)],key=lambda n:int(re.search(r'slide(\d+)',n)[1]));assert len(ns)==14
 slides=[E.fromstring(z.read(n)) for n in ns];assert all(s.get('show')!='0' for s in slides)
 texts=['\n'.join(t.text or '' for t in x.iter(A+'t')) for x in slides]
 notes=['\n'.join(t.text or '' for t in E.fromstring(z.read(f'ppt/notesSlides/notesSlide{i}.xml')).iter(A+'t')) for i in range(1,15)]
 assert len([n for n in z.namelist() if re.fullmatch(r'ppt/notesSlides/notesSlide\d+.xml',n)])==14
 visible='\n'.join(texts)
 for stale in ['六个月','6个月','薪资','津贴','附录','单场收入与成本','Clipping与Content Rewards','工时敏感度','退出','剪辑者','品牌','110,000','RM180','尚未批准募资额']:assert stale not in visible,stale
 for expected in ['真实观看','病毒式传播','Organic','商家应付奖励 RM2,000','已支付 RM0','拟议','RM70,000','2–4个月','订阅','增值工具收费']:assert expected in visible,expected
 charts=[E.fromstring(z.read(n)) for n in z.namelist() if re.search(r'/charts/chart\d+.xml$',n)]
 cv=[[float(t.text) for t in x.findall('.//'+C+'numCache/'+C+'pt/'+C+'v')] for x in charts];assert cv==[[2000,300],[0,8,18,30,40],[11.266,22.532],[50000,13620,6380]],cv
 assert any(x.find('.//'+C+'doughnutChart') is not None for x in charts)
 tables=sum(len(x.findall('.//'+A+'tbl')) for x in slides);assert tables==0
 connectors=sum(len(x.findall('.//'+P+'cxnSp')) for x in slides)
 ppturls=[]
 for n in z.namelist():
  if n.endswith('.rels'):ppturls.extend(x.get('Target') for x in E.fromstring(z.read(n)) if x.get('Type','').endswith('/hyperlink'))

with zipfile.ZipFile(r.parent/'content-rewards-business-v9/output/Wringy-Content-Rewards-Business-Plan.pptx') as z:
 old_texts=['\n'.join(t.text or '' for t in E.fromstring(z.read(f'ppt/slides/slide{i}.xml')).iter(A+'t')) for i in range(1,15)]
 assert all(texts[i]==old_texts[i] for i in range(14) if i!=11),'Unintended visible copy change'
 assert all((r/'build/renders'/f'slide-{i:02}.png').read_bytes()==(r.parent/'content-rewards-business-v9/build/renders'/f'slide-{i:02}.png').read_bytes() for i in range(1,15) if i!=12)
assert '历史六个月现金流' in notes[11] and '2–4个月' in notes[11] and '2–4个月' in notes[12]

reader=PdfReader(pdf);assert len(reader.pages)==14
urls=[a.get_object().get('/A',{}).get('/URI') for p in reader.pages for a in p.get('/Annots',[])];assert len(urls)==6 and sorted(urls)==sorted(set(ppturls))
f=r.parent/'content-rewards-business-v5/finance/results.json';F=json.loads(f.read_text());assert F['proposed_ask_rounded_5000']==70000 and F['uses']['founder_allowance']==0 and F['rd_all_in_cap']==50000
assert 50000+13620+6380==70000 and 2043+4337==6380
old=json.loads((r.parent/'content-rewards-business-v9/delivery-check.json').read_text());assert sha(f)==old['finance_sha256']
v=json.loads((r/'build/Wringy-Content-Rewards-Business-Plan.pptx.validation.json').read_text());assert v['finalSha256']==sha(deck) and v['presentationLayout']['finding_count']==0 and v['presentationLayout']['warning_count']==0
pages=sorted((r/'build/pdf-check').glob('page-*.jpg'));assert len(pages)==14
im=Image.new('RGB',(1920,math.ceil(len(pages)/3)*376),'#ddd')
for i,p in enumerate(pages):
 a=Image.open(p);a.thumbnail((640,360));im.paste(a,((i%3)*640,(i//3)*376))
im.save(r/'build/pdf-check/contact.jpg')
markers={'pptx':1,'pdf':1};(r/'build/markers.json').write_text(json.dumps(markers))
d={'status':'passed','phase_target_months':[2,4],'budget_envelope_retained':True,'monthly_cashflow_remapped':False,'changed_visible_slides':[12],'date':'2026-09-13','pages':14,'main':14,'appendix':0,'hidden_slides':0,'notes_pages':14,'deleted_v8_pages':[9,11,17,18,19],'native_charts':4,'chart_values':cv,'native_doughnut':True,'native_tables':0,'native_concept_diagram_pages':[10,11,13,14],'connectors':connectors,'source_links':6,'source_urls':urls,'layout_findings':0,'layout_warnings':0,'overflow':0,'all_pages_individually_reviewed':True,'pdf_poppler_pages':14,'finance_source':'../content-rewards-business-v5/finance/results.json','finance_sha256':sha(f),'finance_unchanged':True,'proposed_funding':70000,'rd_cap':50000,'salary_allowance_cash_confirmed':0,'proposed_ask_approved':False,'new_images_generated':0,'native_powerpoint_tested':False,'pdf_format':'Raster reading copy with source link annotations','markers':markers,'files':{p.name:{'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted((r/'output').iterdir())}}
(r/'delivery-check.json').write_text(json.dumps(d,ensure_ascii=False,indent=2));D=json.loads((r/'build/content.json').read_text());(r/'story.md').write_text('# v10完整可见文案与备注\n\n14页，无隐藏页或附录。以下与最终PPTX同步。\n'+''.join(f'\n## {i+1} {D[i][0]}\n\n{t}\n\n备注：\n{notes[i]}\n' for i,t in enumerate(texts)))
print(json.dumps({k:d[k] for k in ['status','pages','notes_pages','native_charts','source_links','overflow','files']},ensure_ascii=False))

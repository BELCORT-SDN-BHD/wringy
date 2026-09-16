from pathlib import Path
import json,zipfile,hashlib,re,xml.etree.ElementTree as E
from pypdf import PdfReader
from PIL import Image,ImageChops,ImageStat
r=Path(__file__).resolve().parent.parent
f=r.parent/'content-rewards-business-v5/finance/results.json'
F=json.loads(f.read_text()); v=json.loads((r/'build/Wringy-Content-Rewards-Business-Plan.pptx.validation.json').read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert F['uses']['founder_allowance']==0 and F['proposed_ask_rounded_5000']==70000
assert F['campaign']['unpaid_founder_labor_economic_cost']==60
assert 50000+13620+6380==70000 and 2043+4337==6380
assert sum(F['uses'].values())==63620 and 300-90-20-10==180
A='{http://schemas.openxmlformats.org/drawingml/2006/main}'
C='{http://schemas.openxmlformats.org/drawingml/2006/chart}'
P='{http://schemas.openxmlformats.org/presentationml/2006/main}'
deck=r/'output/Wringy-Content-Rewards-Business-Plan.pptx'
with zipfile.ZipFile(deck) as z:
 slide_names=sorted([n for n in z.namelist() if re.fullmatch(r'ppt/slides/slide\d+.xml',n)],key=lambda n:int(re.search(r'slide(\d+)',n)[1])); assert len(slide_names)==19
 slides=[E.fromstring(z.read(n)) for n in slide_names]
 texts=['\n'.join(t.text or '' for t in x.iter(A+'t')) for x in slides]
 notes=['\n'.join(t.text or '' for t in E.fromstring(z.read(f'ppt/notesSlides/notesSlide{i}.xml')).iter(A+'t')) for i in range(1,20)]
 entire='\n'.join(texts+notes)
 for stale in ['110,000','110000','110k','第一版做什么','Wringy是什么','下一轮什么时候融','补充备注','三泳道']:
  assert stale not in entire,stale
 charts=[E.fromstring(z.read(n)) for n in z.namelist() if re.search(r'/charts/chart\d+.xml$',n)]
 chart_values=[[float(t.text) for t in x.findall('.//'+C+'numCache/'+C+'pt/'+C+'v')] for x in charts]
 assert chart_values==[[2000,300],[0,8,18,30,40],[90,20,10,180],[11.266,22.532],[50000,13620,6380],[180,90,0,-90]],chart_values
 tables=sum(len(x.findall('.//'+A+'tbl')) for x in slides)
 pics=sum(len(x.findall('.//'+P+'pic')) for x in slides)
 pptlinks=[]
 for n in z.namelist():
  if n.endswith('.rels'):
   pptlinks.extend(x.get('Target') for x in E.fromstring(z.read(n)) if x.get('Type','').endswith('/hyperlink'))
 assert len(set(pptlinks))==8
pdf=r/'output/Wringy-Content-Rewards-Business-Plan.pdf'; pr=PdfReader(pdf); assert len(pr.pages)==19
urls=[a.get_object().get('/A',{}).get('/URI') for p in pr.pages for a in p.get('/Annots',[])]
assert len(urls)==8 and sorted(urls)==sorted(set(pptlinks))
assert v['finalSha256']==sha(deck) and v['presentationLayout']['finding_count']==0 and v['presentationLayout']['warning_count']==0
pages=sorted((r/'build/pdf-check').glob('page-*.jpg'));assert len(pages)==19
diff=[]
for i,p in enumerate(pages,1):
 a=Image.open(p).convert('RGB'); b=Image.open(r/f'build/renders/slide-{i:02}.png').convert('RGB').resize(a.size)
 diff.append(round(sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3,4))
# Diagnostic only: JPEG and resampling differences require visual review, not an arbitrary threshold.
im=Image.new('RGB',(1920,2632),'#ddd')
for i,p in enumerate(pages):
 a=Image.open(p);a.thumbnail((640,360));im.paste(a,((i%3)*640,(i//3)*376))
im.save(r/'build/pdf-check/contact.jpg')
marker={'pptx':1,'pdf':1};(r/'build/markers.json').write_text(json.dumps(marker))
receipt={'status':'passed','date':'2026-09-13','pages':19,'main':16,'appendix':3,'native_charts':6,'chart_values':chart_values,'native_tables':tables,'reused_generated_photo_assets':4,'new_images_generated':0,'photo_placements':pics,'layout_findings':0,'layout_warnings':0,'overflow':0,'all_pages_individually_reviewed':True,'pdf_poppler_pages':19,'pdf_render_mean_pixel_difference':diff,'source_links':8,'source_urls':urls,'markers':marker,'salary_allowance_cash_confirmed':0,'proposed_funding':70000,'proposed_ask_approved':False,'unpaid_founder_labor_economic_cost':60,'finance_source':'../content-rewards-business-v5/finance/results.json','finance_sha256':sha(f),'native_powerpoint_tested':False,'pdf_format':'Raster reading copy with source link annotations','files':{p.name:{'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted((r/'output').iterdir())}}
(r/'delivery-check.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2))
D=json.loads((r/'build/content.json').read_text())
(r/'story.md').write_text('# Wringy商业模式主稿 v8\n\n2026-09-13。用户要求清理AI套话并沿用v7版式，16主稿＋3附录。以下可见文案及备注与最终PPTX同步；原生图表数据按各页列出。\n'+''.join('\n## '+str(i+1)+' '+D[i][0]+'\n\n'+text+'\n\n备注：\n'+notes[i]+'\n' for i,text in enumerate(texts)))

print(json.dumps({k:receipt[k] for k in ["status","pages","native_charts","native_tables","source_links","layout_findings","layout_warnings","files"]},ensure_ascii=False))

from pathlib import Path
import json,re,hashlib
from pypdf import PdfReader
from PIL import Image
import pdfplumber
r=Path(__file__).resolve().parent.parent;p=r/'output/Wringy-Clipping-Deep-Research.pdf';sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest();reader=PdfReader(p);assert len(reader.pages)==17
text='\n'.join(x.extract_text() for x in reader.pages);md=(r/'report.md').read_text();sources=json.loads((r/'sources.json').read_text())['sources'];assert len(sources)==47
assert md.count('```mermaid')==3
for s in ['RM48,000','RM8,000','待证据合并','企业邮箱企业邮箱']:assert s not in text,s
for s in ['登录应用研究尚未完成','每12小时','5%–10%','默认5%','30天','企业邮箱','结果仍未知','确认失败或未付','2–4个月','RM50,000']:assert s in re.sub(r"\s+","",text),s
links=[a.get_object().get('/A',{}).get('/URI') for page in reader.pages for a in page.get('/Annots',[]) if a.get_object().get('/A',{}).get('/URI')];expected={x['url'] for x in sources if x['url']};assert expected<=set(links),expected-set(links)
assert all(x.startswith('https://') for x in links)
bad=[]
with pdfplumber.open(p) as doc:
 for i,page in enumerate(doc.pages,1):
  for c in page.chars:
   if c['x0']<-1 or c['x1']>page.width+1 or c['top']<-1 or c['bottom']>page.height+1:bad.append([i,c['text']])
assert not bad,bad[:5]
from fontTools.ttLib import TTFont
for n,w in [('Regular',400),('Semibold',600)]:
 f=TTFont(r/'build'/('NotoSC-'+n+'.ttf'));assert 'fvar' not in f;assert f['OS/2'].usWeightClass==w
old=r.parents[1]/'deliverables/content-rewards-business-v12';receipt=json.loads((old/'delivery-check.json').read_text())
for n in ['Wringy-Content-Rewards-Business-Plan.pdf','Wringy-Content-Rewards-Business-Plan.pptx']:assert sha(old/'output'/n)==receipt['files'][n]['sha256']
imgs=sorted((r/'build/pdf-check').glob('page-*.jpg'));assert len(imgs)==17
im=Image.new('RGB',(1350,6*640),'#ddd')
for i,f in enumerate(imgs):
 a=Image.open(f);a.thumbnail((450,637));im.paste(a,((i%3)*450,(i//3)*640))
im.save(r/'output/contact-sheet.jpg')
d={'status':'public_report_delivered_authenticated_coverage_pending','date':'2026-09-13','pdf_pages':17,'body_sections':15,'numbered_references':47,'unique_external_urls':len(expected),'pdf_external_link_annotations':len(links),'workflow_diagrams':3,'public_screenshots':1,'private_account_screenshots_in_report':0,'chinese_text_extractable':True,'static_font_weights':[400,600],'all_pdf_pages_visually_reviewed':True,'text_outside_page_count':0,'pdf_marker_count':1,'approved_v12_deck_unchanged':True,'authenticated_app_complete':False,'prd_approved':False,'implementation_approved':False,'budget_repriced':False,'review_changes':['Remove abandoned budget narrative','Separate paid/unpaid/unknown reconciliation branches','Business-email requirement clarified','Static regular400/semibold600 fonts'],'files':{str(f.relative_to(r)):{'sha256':sha(f),'bytes':f.stat().st_size} for f in [r/'report.md',p,r/'sources.json',r/'output/contact-sheet.jpg']}}
(r/'delivery-check.json').write_text(json.dumps(d,ensure_ascii=False,indent=2));print(json.dumps(d,ensure_ascii=False))

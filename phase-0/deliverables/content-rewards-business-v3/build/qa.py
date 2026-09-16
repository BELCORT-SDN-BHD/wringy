from pathlib import Path
import json, zipfile, re, hashlib
from lxml import etree as E
from pypdf import PdfReader
root=Path(__file__).resolve().parent.parent
p=root/'output/Wringy-Content-Rewards-Business-Plan.pptx'
z=zipfile.ZipFile(p)
ns={'a':'http://schemas.openxmlformats.org/drawingml/2006/main','c':'http://schemas.openxmlformats.org/drawingml/2006/chart','p':'http://schemas.openxmlformats.org/presentationml/2006/main'}
slides=[n for n in z.namelist() if re.fullmatch(r'ppt/slides/slide\d+.xml',n)]
charts=sorted(n for n in z.namelist() if re.fullmatch(r'.*/charts/chart\d+.xml',n))
values=[[float(v) for v in E.fromstring(z.read(n)).xpath('//c:val/c:numRef/c:numCache/c:pt/c:v/text()',namespaces=ns)] for n in charts]
assert values==[[2000,300],[50000,13620,6380],[110000,70000],[180,90,0,-90]],values
pics=sum(len(E.fromstring(z.read(n)).xpath('//p:pic',namespaces=ns)) for n in slides)
tables=sum(len(E.fromstring(z.read(n)).xpath('//a:tbl',namespaces=ns)) for n in slides)
links=sum(len(E.fromstring(z.read(n)).xpath('//a:hlinkClick',namespaces=ns)) for n in slides)
print("counts",len(slides),pics,tables,links)
assert len(slides)==15 and pics==0 and tables==2
links=len({r.get("Target") for n in z.namelist() if n.startswith("ppt/slides/_rels/") for r in E.fromstring(z.read(n)) if r.get("Type","").endswith("/hyperlink")})
assert links==6
assert 50000+13620+2043+4337==70000
assert 70000+36000+5400-1400==110000
assert 300-90-20-10==180
texts=''.join(''.join(E.fromstring(z.read(n)).xpath('//a:t/text()',namespaces=ns)) for n in slides)
assert '950,000' not in texts and '950k' not in texts
validation=json.loads((root/'build/review-final.pptx.validation.json').read_text())
assert validation['presentationLayout']['warning_count']==0 and validation['presentationLayout']['finding_count']==0
pdf=PdfReader(root/'output/Wringy-Content-Rewards-Business-Plan.pdf')
uris=[a.get_object()['/A']['/URI'] for pg in pdf.pages for a in pg.get('/Annots',[])]
assert len(pdf.pages)==15 and len(uris)==6
r={'status':'passed','date':'2026-09-13','pages':15,'main_slides':12,'appendix_slides':3,'native_charts':4,'chart_values':values,'embedded_chart_workbooks':4,'native_tables':2,'raster_pictures_in_pptx':pics,'pptx_clickable_sources':links,'pdf_clickable_sources':len(uris),'source_urls':uris,'layout_findings':0,'layout_warnings':0,'overflow':0,'visual_review':'All 15 slides individually reviewed at 1920x1080; corrected slide 2 re-reviewed. Final PDF rendered with Poppler.','native_office_execution_verified':False,'pdf_format':'Raster reading copy with clickable source annotations; PPTX contains editable text, diagrams, charts and tables.','finance':'Canonical content-rewards-business-v1 model unchanged; 70k/110k unselected scenarios.','markers':json.loads((root/'build/markers.json').read_text()),'files':{f.name:{'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in (root/'output').iterdir() if f.is_file()}}
(root/'delivery-check.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(r,ensure_ascii=False,indent=2))

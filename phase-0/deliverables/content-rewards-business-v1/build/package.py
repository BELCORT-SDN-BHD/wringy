from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib,shutil,zipfile
b=Path(__file__).parent;o=b.parent/'output'
r=json.loads((b/'final-review.pptx.validation.json').read_text());assert r['presentationLayout']['warning_count']==0 and r['presentationLayout']['finding_count']==0
shutil.copyfile(o/'final-review.pptx',o/'Wringy-Content-Rewards-Business-Plan.pptx')
shutil.copyfile(b/'final-review.pptx.validation.json',b/'Wringy-Content-Rewards-Business-Plan.pptx.validation.json')
for name in ['final-review.pptx','revised-final.pptx']:
 shutil.move(str(o/name),str(b/name))
imgs=sorted((b/'pdf-check').glob('page-*.png'));assert len(imgs)==18
im=Image.new('RGB',(1920,2256),'#ddd')
for i,f in enumerate(imgs):
 a=Image.open(f);im.paste(a,((i%3)*640,(i//3)*376))
im.save(b/'pdf-contact.jpg')
report={'status':'complete','slides':18,'all_slides_visually_reviewed':True,'native_charts':2,'native_tables':3,'native_diagram_slides':[3,4,8,10],'pptx_slide_picture_count':0,'layout_findings':0,'layout_warnings':0,'pdf_pages':18,'pdf_clickable_links':6,'pptx_clickable_links':6,'pdf_render_check':'Poppler all 18 pages','markers':{'pptx':1,'pdf':1},'native_powerpoint_open_verified':False,'notes':'PDF is raster for fidelity, with clickable source annotations; PPTX contains editable native objects.','files':{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in o.iterdir() if f.is_file()}}
(b/'delivery-receipt.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
p=b/'readiness.json';a=json.loads(p.read_text());a.update(status='complete',narrative_source='story.md final',numeric_sources='finance/results.json verified',final_output_stem_proposed='Wringy-Content-Rewards-Business-Plan');p.write_text(json.dumps(a,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))

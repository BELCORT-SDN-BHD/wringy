from pathlib import Path
from PIL import Image
from pypdf import PdfReader
import json,hashlib,zipfile,xml.etree.ElementTree as E
b=Path(__file__).parent;o=b.parent/'output';files=sorted((b/'pdf-check').glob('page-*.png'));assert len(files)==18
im=Image.new('RGB',(1920,2256),'#ddd')
for i,f in enumerate(files):im.paste(Image.open(f),((i%3)*640,(i//3)*376))
im.save(b/'pdf-contact.jpg')
a=json.loads((b/'Wringy-Content-Rewards-Business-Plan.pptx.validation.json').read_text());assert a['presentationLayout']['warning_count']==0
r=PdfReader(o/'Wringy-Content-Rewards-Business-Plan.pdf');assert len(r.pages)==18
annotations=[q.get_object().get('/A',{}).get('/URI') for p in r.pages for q in p.get('/Annots',[])];assert len(annotations)==6
report={'status':'complete','date':'2026-09-13','slides':18,'native_charts':5,'native_chart_owner_slides':[4,5,6,12],'native_tables':2,'native_table_owner_slides':[17],'graph_dominant_slides':[2,3,4,5,6,8,9,10,11,12,13,14,15,16],'raster_picture_count_in_pptx':0,'layout_warnings':0,'layout_findings':0,'slides_visually_checked':list(range(1,19)),'pdf_rendered_pages':18,'pdf_links':6,'pptx_links':6,'markers':json.loads((b/'markers.json').read_text()),'native_powerpoint_open_verified':False,'pdf_format':'Raster slide pages with clickable source annotations','finance_source':'content-rewards-business-v1/finance/results.json, unchanged','files':{p.name:{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in o.iterdir() if p.is_file()}}
(b/'delivery-receipt.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))

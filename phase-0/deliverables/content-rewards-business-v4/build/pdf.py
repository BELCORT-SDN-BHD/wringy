from pathlib import Path
import json,sys
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader,PdfWriter
from pypdf.annotations import Link
renders,out=map(Path,sys.argv[1:3]);links=json.loads(Path(sys.argv[3]).read_text()) if len(sys.argv)>3 else []
pages=sorted(renders.glob('slide-*.png'));assert pages
scratch=out.with_suffix('.unlinked.pdf');out.parent.mkdir(parents=True,exist_ok=True)
c=canvas.Canvas(str(scratch),pagesize=(960,540));c.setTitle('Wringy Content Rewards 商业计划');c.setAuthor('Wringy')
for image in pages:c.drawImage(ImageReader(str(image)),0,0,width=960,height=540);c.showPage()
c.save();writer=PdfWriter(clone_from=str(scratch))
for l in links:
 x,y,w,h=[l[k]*.75 for k in ['x','y','w','h']]
 writer.add_annotation(page_number=l['slide']-1,annotation=Link(rect=(x,540-y-h,x+w,540-y),url=l['url']))
writer.write(out);scratch.unlink();r=PdfReader(out);assert len(r.pages)==len(pages)
actual=[a.get_object().get('/A',{}).get('/URI') for p in r.pages for a in p.get('/Annots',[])];assert sorted(actual)==sorted(l['url'] for l in links)
print(f'PDF: {len(pages)} pages, {len(links)} verified clickable links')

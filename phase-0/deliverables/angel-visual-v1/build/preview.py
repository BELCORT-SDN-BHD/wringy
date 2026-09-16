from pathlib import Path
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader
import sys,json,zipfile
root=Path(__file__).resolve().parent.parent
rev=sys.argv[1]
imgs=sorted((root/'output/slides').glob('slide-*.png'))
assert len(imgs)==3
pdf=root/f'output/Wringy-Angel-Visual-{rev}.pdf'
c=canvas.Canvas(str(pdf),pagesize=(960,540));c.setTitle('Wringy 天使轮视觉样稿');c.setAuthor('Wringy')
for fn in imgs:c.drawImage(ImageReader(str(fn)),0,0,width=960,height=540);c.showPage()
c.save()
assert len(PdfReader(str(pdf)).pages)==3
with zipfile.ZipFile(root/f'output/Wringy-Angel-Visual-{rev}.pptx') as z:
 s=z.read('ppt/slides/slide2.xml').decode()
 assert '创作者' in s and '11,500' in s
 report={'slide_count':3,'pdf_pages':3,'pdf_type':'raster preview of final PPTX renders','native_diagram_shapes':s.count('<p:sp>'),'native_diagram_connectors':s.count('<p:cxnSp>'),'desktop_powerpoint_test':False}
(root/'build/package-summary.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(report)

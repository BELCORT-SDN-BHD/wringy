from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader
import sys
renders=Path(sys.argv[1]); out=Path(sys.argv[2]); pages=sorted(renders.glob('slide-*.png'))
assert pages,'No rendered slides'
out.parent.mkdir(parents=True,exist_ok=True)
c=canvas.Canvas(str(out),pagesize=(960,540));c.setTitle('Wringy 融资与增长计划');c.setAuthor('Wringy')
for image in pages:
 c.drawImage(ImageReader(str(image)),0,0,width=960,height=540)
 c.showPage()
c.save();assert len(PdfReader(str(out)).pages)==len(pages)
print(f'PDF pages: {len(pages)}. PDF uses final PPTX render images; edit original PPTX.')

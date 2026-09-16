from pathlib import Path
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader
import sys,json,zipfile,hashlib
root=Path(__file__).resolve().parent.parent
rev=sys.argv[1]
imgs=sorted((root/'output/slides').glob('slide-*.png'))
assert len(imgs)==17
for suffix,pages in [('',imgs),('-Main12',imgs[:12])]:
 pdf=root/f'output/Wringy-Angel-Deck-{rev}{suffix}.pdf'
 c=canvas.Canvas(str(pdf),pagesize=(960,540));c.setTitle('Wringy 天使投资讨论稿');c.setAuthor('Wringy')
 for fn in pages:c.drawImage(ImageReader(str(fn)),0,0,width=960,height=540);c.showPage()
 c.save();assert len(PdfReader(str(pdf)).pages)==len(pages)
sheet=Image.new('RGB',(1280,6*240),'#e1e3dc')
for i,fn in enumerate(imgs):
 im=Image.open(fn).convert('RGB');im.thumbnail((416,234));sheet.paste(im,((i%3)*426+5,(i//3)*240+3))
sheet.save(root/'build/contact-sheet.png')
with zipfile.ZipFile(root/f'output/Wringy-Angel-Deck-{rev}.pptx') as z:
 slides=[n for n in z.namelist() if n.startswith('ppt/slides/slide') and n.endswith('.xml')];assert len(slides)==17
 report={'slides':17,'main_pdf_pages':12,'full_pdf_pages':17,'pngs':17,'pdf_type':'raster preview of final PPTX renders','native_charts':len([n for n in z.namelist() if ('/charts/' in n and '/_rels/' not in n) and n.endswith('.xml')]),'desktop_powerpoint_test':False}
(root/'build/package-summary.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(report)

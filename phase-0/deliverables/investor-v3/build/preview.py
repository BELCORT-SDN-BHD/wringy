from pathlib import Path
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader
import json, hashlib, zipfile
root=Path(__file__).resolve().parent.parent
imgs=sorted((root/'build/renders').glob('slide-*.png'))
assert len(imgs)==10
pdf=root/'output/Wringy-Investor-v3-Preview.pdf'
c=canvas.Canvas(str(pdf),pagesize=(960,540))
c.setTitle('Wringy 投资讨论稿 v3');c.setAuthor('Wringy')
for fn in imgs:
    c.drawImage(ImageReader(str(fn)),0,0,width=960,height=540);c.showPage()
c.save()
w,h,gap,cols,rows=480,270,16,2,5
sheet=Image.new('RGB',(cols*w+(cols+1)*gap,rows*h+(rows+1)*gap),'white')
for i,fn in enumerate(imgs):
    im=Image.open(fn).convert('RGB');im.thumbnail((w,h),Image.Resampling.LANCZOS)
    sheet.paste(im,(gap+(i%cols)*(w+gap),gap+(i//cols)*(h+gap)))
sheet.save(root/'output/contact-sheet.png')
assert len(PdfReader(str(pdf)).pages)==10
ppt=root/'output/Wringy-Investor-v3.pptx'
with zipfile.ZipFile(ppt) as z:
    slides=[n for n in z.namelist() if n.startswith('ppt/slides/slide') and n.endswith('.xml')]
    charts=[n for n in z.namelist() if '/charts/chart' in n and n.endswith('.xml')]
    assert len(slides)==10
report={'slides':10,'pdf_pages':10,'pdf_type':'raster preview from rendered final PPTX','native_charts':len(charts),'limitations':['No PowerPoint desktop edit-save-reopen test','Product concept screenshot is raster'],'files':{p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [ppt,pdf,root/'output/contact-sheet.png']}}
(root/'build/package-summary.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))

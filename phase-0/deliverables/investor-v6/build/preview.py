from pathlib import Path
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader
import json, hashlib, zipfile
root=Path(__file__).resolve().parent.parent
imgs=sorted((root/'output/slides').glob('slide-*.png'))
assert len(imgs)==18
pdf=root/'output/Wringy-Investor-v6-Preview.pdf'
c=canvas.Canvas(str(pdf),pagesize=(960,540))
c.setTitle('Wringy 投资讨论稿 v6');c.setAuthor('Wringy')
for fn in imgs:
 c.drawImage(ImageReader(str(fn)),0,0,width=960,height=540);c.showPage()
c.save()
w,h,gap,cols=480,270,16,2
sheet=Image.new('RGB',(cols*w+(cols+1)*gap,9*h+10*gap),'white')
for i,fn in enumerate(imgs):
 im=Image.open(fn).convert('RGB');im.thumbnail((w,h),Image.Resampling.LANCZOS)
 sheet.paste(im,(gap+(i%cols)*(w+gap),gap+(i//cols)*(h+gap)))
sheet.save(root/'output/contact-sheet.png')
assert len(PdfReader(str(pdf)).pages)==18
ppt=root/'output/Wringy-Investor-v6.pptx'
with zipfile.ZipFile(ppt) as z:
 slides=[n for n in z.namelist() if n.startswith('ppt/slides/slide') and n.endswith('.xml')]
 charts=[n for n in z.namelist() if '/charts/chart' in n and n.endswith('.xml')]
 assert len(slides)==18
 assert len(charts)>=3
report={'slides':18,'pdf_pages':18,'pdf_type':'raster preview from final PPTX slide renders','native_charts':len(charts),'limitations':['No PowerPoint desktop edit-save-reopen test'],'files':{p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [ppt,pdf,root/'output/contact-sheet.png']}}
(root/'build/package-summary.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))

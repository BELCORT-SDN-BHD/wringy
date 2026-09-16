from pathlib import Path
from PIL import Image, ImageOps
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
import json, hashlib, zipfile
root=Path(__file__).resolve().parent.parent
imgs=sorted((root/'build/renders').glob('slide-*.png'))
assert len(imgs)==17
pdf=root/'output/Wringy-Investor-v2-Preview.pdf'
c=canvas.Canvas(str(pdf),pagesize=(960,540));c.setTitle('Wringy 投资讨论稿 v2（14页主稿+3页附录）');c.setAuthor('Wringy')
for fn in imgs:
    c.drawImage(ImageReader(str(fn)),0,0,width=960,height=540);c.showPage()
c.save()
# Contact sheet is a montage of slide renders, not an authored illustration.
w,h=480,270;gap=18;cols=3;rows=6
sheet=Image.new('RGB',(cols*w+(cols+1)*gap,rows*h+(rows+1)*gap),'#D9DBE1')
for i,fn in enumerate(imgs):
    im=Image.open(fn).convert('RGB');im.thumbnail((w,h),Image.Resampling.LANCZOS)
    sheet.paste(im,(gap+(i%cols)*(w+gap),gap+(i//cols)*(h+gap)))
sheet.save(root/'output/Wringy-Investor-v2-Contact-Sheet.png')
from pypdf import PdfReader
assert len(PdfReader(str(pdf)).pages)==17
ppt=root/'output/Wringy-Investor-v2-Reviewed.pptx'
with zipfile.ZipFile(ppt) as z:
    slides=[n for n in z.namelist() if n.startswith('ppt/slides/slide') and n.endswith('.xml')]
    charts=[n for n in z.namelist() if '/charts/chart' in n and n.endswith('.xml')]
    assert len(slides)==17
    assert len(charts)==2
report={'slides':17,'main_slides':14,'appendix_slides':3,'native_charts':2,'native_table_slides':[10,15,16,17],'pdf_pages':17,'pdf_type':'raster preview from rendered final PPTX','visual_review':'Every slide inspected. Revisions corrected title length, step wrapping, chart units and shared screenshot.','limitations':['No PowerPoint desktop opening/edit-resave test','All business defaults and economics are unapproved examples','Image on slide 5 is static concept, text within screenshot is not editable'], 'files':{p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [ppt,pdf,root/'output/Wringy-Investor-v2-Contact-Sheet.png',root/'content.md']}}
(root/'build/review-summary.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))

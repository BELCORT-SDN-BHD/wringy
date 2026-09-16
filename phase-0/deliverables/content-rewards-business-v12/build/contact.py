from PIL import Image,ImageDraw
from pathlib import Path
import math
b=Path(__file__).parent;files=sorted((b/'renders').glob('slide-*.png'));n=len(files)
for start in range(0,n,6):
 im=Image.new('RGB',(1920,math.ceil(min(6,n-start)/2)*564),'#ddd')
 for k,f in enumerate(files[start:start+6]):
  src=Image.open(f);src.thumbnail((960,540));x=(k%2)*960;y=(k//2)*564;im.paste(src,(x,y));ImageDraw.Draw(im).text((x+10,y+542),str(start+k+1),fill='black')
 im.save(b/f'review-{start//6+1}.jpg')
im=Image.new('RGB',(1920,math.ceil(n/3)*376),'#ddd')
for k,f in enumerate(files):
 src=Image.open(f);src.thumbnail((640,360));x=(k%3)*640;y=(k//3)*376;im.paste(src,(x,y));ImageDraw.Draw(im).text((x+8,y+361),str(k+1),fill='black')
im.save(b.parent/'output/contact-sheet.jpg')

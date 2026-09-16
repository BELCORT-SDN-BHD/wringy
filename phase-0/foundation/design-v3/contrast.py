import json,pathlib
p=pathlib.Path(__file__).parent;t=json.loads((p/'tokens.json').read_text());c=t['colors']
def lum(h):
 r=[int(h[i:i+2],16)/255 for i in [1,3,5]];r=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in r];return sum(x*y for x,y in zip(r,[.2126,.7152,.0722]))
pairs=[('ink','canvas',4.5),('secondary','canvas',4.5),('ink','citron',4.5),('canvas','forest',4.5),('secondary','surface',4.5),('success','canvas',4.5),('error','canvas',4.5),('focus','canvas',3),('secondary','canvas',3),('line','canvas',3),('canvas','citron',4.5)]
out=[]
for a,b,limit in pairs:
 l1,l2=sorted([lum(c[a]),lum(c[b])]);v=(l2+.05)/(l1+.05);out.append({'foreground':a,'background':b,'ratio':round(v,2),'threshold':limit,'passes':v>=limit,'use':'forbidden as text/essential boundary' if v<limit else 'permitted'})
(p/'contrast-report.json').write_text(json.dumps({'method':'sRGB relative luminance; independent Wringy proposal','pairs':out},ensure_ascii=False,indent=2)+'\n')
print(out)

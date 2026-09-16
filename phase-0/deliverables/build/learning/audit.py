import json, re, hashlib, zipfile, sys
from pathlib import Path
from xml.etree import ElementTree as E
here=Path(__file__).resolve().parent
root=here.parent.parent
result=json.loads((here/'result.json').read_text())
source=json.loads((root/'content/whop-learning.json').read_text())
coverage=json.loads((here/'coverage.json').read_text())
ns={'a':'http://schemas.openxmlformats.org/drawingml/2006/main','p':'http://schemas.openxmlformats.org/presentationml/2006/main'}
norm=lambda v:re.sub(r'\s+','',str(v))
checks=[]
with zipfile.ZipFile(result['output']) as z:
 for i,s in enumerate(source['slides'],1):
  slide=E.fromstring(z.read(f'ppt/slides/slide{i}.xml'))
  notes=E.fromstring(z.read(f'ppt/notesSlides/notesSlide{i}.xml'))
  visible=''.join(slide.itertext())
  notetext=''.join(notes.itertext())
  total=norm(visible+notetext)
  required=[s['title'],s.get('takeaway',''),*s.get('body',[]),s.get('example',''),s.get('speaker_notes_zh','')]
  if s.get('table'):required += s['table']['headers']+[v for r in s['table']['rows'] for v in r]
  required += [x['url'] for x in s['sources']]
  missing=[v for v in required if norm(v) not in total]
  assert not missing,(i,missing)
  if i>=41:
   assert len(s['table']['rows'])<=8
   assert all(norm(v) in norm(visible) for r in s['table']['rows'] for v in r)
  connectors=slide.findall('.//p:cxnSp',ns)
  if i in coverage['diagrams']:
   assert len(connectors)==3,(i,'connector count')
   assert all(c.find('.//a:stCxn',ns) is not None and c.find('.//a:endCxn',ns) is not None for c in connectors)
  checks.append({'slide':i,'sourceContentPreserved':True,'editableConnectors':len(connectors)})
 assert len([n for n in z.namelist() if re.fullmatch(r'ppt/slides/slide\d+.xml',n)])==64
 assert len([n for n in z.namelist() if re.fullmatch(r'ppt/slides/charts/chart\d+.xml',n)])==3
report={'output':result['output'],'sha256':hashlib.sha256(Path(result['output']).read_bytes()).hexdigest(),'slideCount':64,'featureCount':len(set(coverage['appendixIDs'])),'nativeTableCount':len(coverage['tables']),'nativeChartCount':3,'checks':checks,'targetApplicationEditTest':'not performed','fontsEmbedded':False}
(here/'content-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='checks'},ensure_ascii=False))

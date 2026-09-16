import json,re,zipfile,hashlib,sys
from pathlib import Path
from decimal import Decimal
from xml.etree import ElementTree as E
here=Path(__file__).resolve().parent
root=here.parent.parent
result=json.loads((here/(sys.argv[1] if len(sys.argv)>1 else 'result.json')).read_text())
source=json.loads((here/'.private/input-snapshot.json').read_text(),parse_float=Decimal)
ns={'a':'http://schemas.openxmlformats.org/drawingml/2006/main','p':'http://schemas.openxmlformats.org/presentationml/2006/main','c':'http://schemas.openxmlformats.org/drawingml/2006/chart'}
norm=lambda x:re.sub(r'\s+','',str(int(x) if isinstance(x,Decimal) and x==x.to_integral_value() else x))
checks=[]
with zipfile.ZipFile(result['output']) as z:
 for i,s in enumerate(source['slides'],1):
  sl=E.fromstring(z.read(f'ppt/slides/slide{i}.xml'))
  notes=E.fromstring(z.read(f'ppt/notesSlides/notesSlide{i}.xml'))
  total=norm(''.join(sl.itertext())+''.join(notes.itertext()))
  required=[s['title'],s['takeaway'],s.get('speaker_notes_zh',''),s.get('example',''),*s.get('body',[]),*[x['url'] for x in s.get('sources',[])]]
  if s.get('table'):required+=s['table']['headers']+[v for row in s['table']['rows'] for v in row]
  assert all(norm(x) in total for x in required),(i,[x for x in required if norm(x) not in total])
  checks.append({'slide':i,'id':s['id'],'contentPreserved':True,'nativeTables':len(sl.findall('.//a:tbl',ns)),'nativeConnectors':len(sl.findall('.//p:cxnSp',ns))})
 chartparts=[n for n in z.namelist() if re.fullmatch(r'ppt/slides/charts/chart\d+.xml',n)]
 assert len(chartparts)==1
 chart=next(s['chart'] for s in source['slides'] if s.get('chart'))
 series=E.fromstring(z.read(chartparts[0])).findall('.//c:ser',ns)
 assert len(series)==3
 for ser,expected in zip(series,chart['series']):
  assert [x.text for x in ser.findall('.//c:cat//c:pt/c:v',ns)]==chart['categories']
  assert [Decimal(x.text)*10000 for x in ser.findall('.//c:val//c:pt/c:v',ns)]==expected['values']
 assert len(source['slides'])==38
report={'output':result['output'],'sha256':hashlib.sha256(Path(result['output']).read_bytes()).hexdigest(),'slideCount':38,'nativeChartCount':1,'exactSourceChartPoints':72,'nativeTableCount':sum(x['nativeTables'] for x in checks),'checks':checks,'fontsEmbedded':False,'targetApplicationEditTest':'not performed'}
(here/'content-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='checks'},ensure_ascii=False))

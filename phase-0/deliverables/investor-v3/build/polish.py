from pathlib import Path
from xml.etree import ElementTree as E
import zipfile,json
root=Path(__file__).resolve().parent.parent
p=root/'build/candidate.pptx';out=root/'build/candidate-polished.pptx'
c=json.loads((root/'../../foundation/design-v2/tokens.json').resolve().read_text())['color']
A='http://schemas.openxmlformats.org/drawingml/2006/main';ns={'a':A}
with zipfile.ZipFile(p) as src,zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as dest:
 for f in src.infolist():
  raw=src.read(f.filename)
  if f.filename.startswith('ppt/slides/slide') and f.filename.endswith('.xml'):
   doc=E.fromstring(raw)
   for tbl in doc.findall('.//a:tbl',ns):
    if f.filename=='ppt/slides/slide9.xml':
     for row in tbl.findall('a:tr',ns):
      cell=row.findall('a:tc',ns)[1]
      for para in cell.findall('.//a:p',ns):
       pp=para.find('a:pPr',ns)
       if pp is None:pp=E.Element(f'{{{A}}}pPr');para.insert(0,pp)
       pp.set('algn','r')
    for tc in tbl.findall('.//a:tc',ns):
     pr=tc.find('a:tcPr',ns)
     if pr is None:pr=E.SubElement(tc,f'{{{A}}}tcPr')
     if f.filename=='ppt/slides/slide9.xml':
      pr.set('marT','57150');pr.set('marB','57150')
     for side in ['lnL','lnR','lnT','lnB']:
      for old in pr.findall('a:'+side,ns):pr.remove(old)
      ln=E.SubElement(pr,f'{{{A}}}{side}',{'w':'6350'})
      if side in ['lnL','lnR','lnT']:E.SubElement(ln,f'{{{A}}}noFill')
      else:E.SubElement(E.SubElement(ln,f'{{{A}}}solidFill'),f'{{{A}}}srgbClr',{'val':c['line'].lstrip('#')})
   raw=E.tostring(doc,encoding='utf-8',xml_declaration=True)
  dest.writestr(f,raw)
print(out)

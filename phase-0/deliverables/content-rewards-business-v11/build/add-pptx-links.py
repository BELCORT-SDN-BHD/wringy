from pathlib import Path
import json,sys,zipfile,xml.etree.ElementTree as E
src,dst,manifest=map(Path,sys.argv[1:4]); links=json.loads(manifest.read_text());assert src!=dst
P='http://schemas.openxmlformats.org/presentationml/2006/main';A='http://schemas.openxmlformats.org/drawingml/2006/main';R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';REL='http://schemas.openxmlformats.org/package/2006/relationships'
for prefix,uri in [('p',P),('a',A),('r',R)]:E.register_namespace(prefix,uri)
with zipfile.ZipFile(src) as z:parts={n:z.read(n) for n in z.namelist()}
for link in links:
 sn=f'ppt/slides/slide{link["slide"]}.xml';rn=f'ppt/slides/_rels/slide{link["slide"]}.xml.rels';s=E.fromstring(parts[sn]);rels=E.fromstring(parts[rn]) if rn in parts else E.Element('{'+REL+'}Relationships')
 target=None
 for sp in s.findall('.//{'+P+'}sp'):
  c=sp.find('./{'+P+'}nvSpPr/{'+P+'}cNvPr')
  if c is not None and c.get('name')==link['name']:target=sp;break
 assert target is not None,link['name']
 rid='rIdSource'+str(len(rels)+1);E.SubElement(rels,'{'+REL+'}Relationship',Id=rid,Type=R+'/hyperlink',Target=link['url'],TargetMode='External')
 runs=target.findall('.//{'+A+'}r');assert runs
 for run in runs:
  pr=run.find('{'+A+'}rPr')
  if pr is None:pr=E.Element('{'+A+'}rPr');run.insert(0,pr)
  E.SubElement(pr,'{'+A+'}hlinkClick',{'{'+R+'}id':rid})
 parts[sn]=E.tostring(s,encoding='utf-8',xml_declaration=True);parts[rn]=E.tostring(rels,encoding='utf-8',xml_declaration=True)
with zipfile.ZipFile(dst,'w',zipfile.ZIP_DEFLATED) as z:
 for n,data in parts.items():z.writestr(n,data)
print(f'Native PPTX source hyperlinks: {len(links)}')

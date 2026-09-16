from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as E
import re,json,hashlib,posixpath,shutil,copy
from pypdf import PdfReader,PdfWriter
r=Path(__file__).resolve().parent.parent;src=r.parent/'angel-deck-v1';out=r/'output';build=r/'build'
original=src/'output/Wringy-Angel-Deck-v1.pptx'
frozen=json.loads((src/'build/FROZEN.json').read_text())
assert hashlib.sha256(original.read_bytes()).hexdigest()==frozen['files']['output/Wringy-Angel-Deck-v1.pptx']['sha256']
ns={'p':'http://schemas.openxmlformats.org/presentationml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships','a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
R='{http://schemas.openxmlformats.org/package/2006/relationships}'
keep=list(range(1,15))+[17];removed=[15,16];remove_parts=set();rows=[]
with ZipFile(original) as z:
 pres=E.fromstring(z.read('ppt/presentation.xml'));ids=pres.find('p:sldIdLst',ns);ordered=list(ids);assert len(ordered)==17
 rels=E.fromstring(z.read('ppt/_rels/presentation.xml.rels'));relmap={e.attrib['Id']:e for e in rels}
 for n in removed:
  el=ordered[n-1];rid=el.attrib['{'+ns['r']+'}id'];rel=relmap[rid];slide=posixpath.normpath(posixpath.join('ppt',rel.attrib['Target'])).lstrip('/');remove_parts.add(slide)
  slide_rels=posixpath.join(posixpath.dirname(slide),'_rels',posixpath.basename(slide)+'.rels');remove_parts.add(slide_rels)
  if slide_rels in z.namelist():
   for child in E.fromstring(z.read(slide_rels)):
    if child.attrib['Type'].endswith('/notesSlide'):
     note=posixpath.normpath(posixpath.join(posixpath.dirname(slide),child.attrib['Target'])).lstrip('/');remove_parts.add(note);remove_parts.add(posixpath.join(posixpath.dirname(note),'_rels',posixpath.basename(note)+'.rels'))
  ids.remove(el);rels.remove(rel)
 # Keep namespaces stable and change only presentation list, relationships, and content-type entries.
 E.register_namespace('p',ns['p']);E.register_namespace('r',ns['r'])
 changes={'ppt/presentation.xml':E.tostring(pres,encoding='utf-8',xml_declaration=True),'ppt/_rels/presentation.xml.rels':E.tostring(rels,encoding='utf-8',xml_declaration=True)}
 ct=E.fromstring(z.read('[Content_Types].xml'))
 for el in list(ct):
  if el.attrib.get('PartName','').lstrip('/') in remove_parts:ct.remove(el)
 E.register_namespace('', 'http://schemas.openxmlformats.org/package/2006/content-types')
 changes['[Content_Types].xml']=E.tostring(ct,encoding='utf-8',xml_declaration=True)
 if 'docProps/app.xml' in z.namelist():changes['docProps/app.xml']=re.sub(rb'(<Slides>)\d+(</Slides>)',rb'\g<1>15\2',z.read('docProps/app.xml'))
 with ZipFile(build/'candidate-v2.pptx','w') as dst:
  for info in z.infolist():
   if info.filename not in remove_parts:dst.writestr(copy.copy(info),changes.get(info.filename,z.read(info.filename)))
 for new,old in enumerate(keep,1):
  sp=posixpath.normpath(posixpath.join('ppt',relmap[ordered[old-1].attrib['{'+ns['r']+'}id']].attrib['Target'])).lstrip('/')
  sx=E.fromstring(z.read(sp));texts=[t.text or '' for t in sx.findall('.//a:t',ns)]
  rows.append({'page':new,'source_page':old,'slide_part':sp,'title':texts[0] if texts else '', 'xml_sha256':hashlib.sha256(z.read(sp)).hexdigest()})
reader=PdfReader(str(src/'output/Wringy-Angel-Deck-v1.pdf'));assert len(reader.pages)==17
writer=PdfWriter()
for old in keep:writer.add_page(reader.pages[old-1])
writer.add_metadata({'/Title':'Wringy 天使轮讨论稿 v2','/Author':'Wringy'})
with (out/'Wringy-Angel-Deck-v2.pdf').open('wb') as f:writer.write(f)
shutil.copy2(src/'output/Wringy-Angel-Deck-v1-Main12.pdf',out/'Wringy-Angel-Deck-v2-Main12.pdf')
for new,old in enumerate(keep,1):shutil.copy2(src/f'output/slides/slide-{old:02}.png',out/f'slides/slide-{new:02}.png')
(build/'source-index.json').write_text(json.dumps({'mapping':rows,'removed_source_pages':removed,'removed_parts':sorted(remove_parts)},ensure_ascii=False,indent=2))
print('Removed original 15/16 and their notes. Mapping 1–14 + 17. PDF15, PNG15, main PDF copied unchanged.')

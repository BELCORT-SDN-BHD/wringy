from pathlib import Path
from zipfile import ZipFile
from pypdf import PdfReader
import json,hashlib,xml.etree.ElementTree as E
r=Path(__file__).resolve().parent.parent;s=r.parent/'angel-deck-v1';out=r/'output';index=json.loads((r/'build/source-index.json').read_text());sha=lambda b:hashlib.sha256(b).hexdigest()
with ZipFile(out/'Wringy-Angel-Deck-v2.pptx') as z,ZipFile(s/'output/Wringy-Angel-Deck-v1.pptx') as old:
 assert len([n for n in z.namelist() if n.startswith('ppt/slides/slide') and n.endswith('.xml')])==15
 for row in index['mapping']:assert z.read(row['slide_part'])==old.read(row['slide_part'])
 for name in index['removed_parts']:assert name not in z.namelist()
 charts=[n for n in z.namelist() if '/charts/' in n and '/_rels/' not in n and n.endswith('.xml')];assert len(charts)==2
 for n in charts:assert z.read(n)==old.read(n)
 ns={'p':'http://schemas.openxmlformats.org/presentationml/2006/main'};assert len(E.fromstring(z.read('ppt/presentation.xml')).find('p:sldIdLst',ns))==15
assert len(PdfReader(str(out/'Wringy-Angel-Deck-v2.pdf')).pages)==15
assert (out/'Wringy-Angel-Deck-v2-Main12.pdf').read_bytes()==(s/'output/Wringy-Angel-Deck-v1-Main12.pdf').read_bytes()
for row in index['mapping']:assert (out/f"slides/slide-{row['page']:02}.png").read_bytes()==(s/f"output/slides/slide-{row['source_page']:02}.png").read_bytes()
files=[f for f in out.rglob('*') if f.is_file()]
report={'status':'frozen','pptx_slides':15,'pdf_pages':15,'main_pdf_pages':12,'native_charts':2,'retained_slide_xml_byte_identical':15,'chart_xml_byte_identical':2,'removed_slides_and_notes_absent':True,'main_pdf_byte_identical':True,'pngs_reused_without_rerender':15,'last_three_reviewed':[13,14,15],'final_slide_original':17,'files':{str(f.relative_to(r)):{'sha256':sha(f.read_bytes()),'bytes':f.stat().st_size} for f in files}}
(r/'build/FROZEN.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
(r/'source-index.md').write_text('# 页面来源\n\n新版页 | 原v1页 | 内容\n---|---|---\n'+'\n'.join(f"{x['page']} | {x['source_page']} | {x['title']}" for x in index['mapping'])+'\n')
print('PASS: 15 slides/PDF pages; 15 unchanged slide XML; 2 unchanged native charts; removed pages and notes absent; main12 PDF byte-identical.')

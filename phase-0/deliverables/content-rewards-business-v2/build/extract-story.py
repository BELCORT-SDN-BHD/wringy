from pathlib import Path
import zipfile,xml.etree.ElementTree as E
b=Path(__file__).parent
with zipfile.ZipFile(b/'draft.pptx') as z:
 pages=[]
 for i in range(1,19):
  root=E.fromstring(z.read(f'ppt/slides/slide{i}.xml'));ns={'a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
  texts=[''.join(t.itertext()) for t in root.findall('.//a:t',ns)]
  notes=E.fromstring(z.read(f'ppt/notesSlides/notesSlide{i}.xml'));nt=[''.join(t.itertext()) for t in notes.findall('.//a:t',ns)]
  pages.append(f'## {i} {texts[0]}\n\n### 页面文字\n'+'\n\n'.join(t for t in texts[1:] if t!=str(i).zfill(2))+'\n\n### 完整叙述与引用\n'+'\n'.join(nt))
(b.parent/'story.md').write_text('# Wringy Content Rewards商业计划 v2\n\n2026-09-13。页面文字及完整备注，以最终构建文件为准。金额沿用v1模型。\n\n'+'\n\n'.join(pages))

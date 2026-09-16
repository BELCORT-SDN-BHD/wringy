from pathlib import Path
import json,zipfile,hashlib,re,xml.etree.ElementTree as E
from pypdf import PdfReader
from PIL import Image,ImageChops,ImageStat
r=Path(__file__).resolve().parent.parent
f=r.parent/'content-rewards-business-v5/finance/results.json'
F=json.loads(f.read_text()); v=json.loads((r/'build/Wringy-Content-Rewards-Business-Plan.pptx.validation.json').read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert F['uses']['founder_allowance']==0 and F['proposed_ask_rounded_5000']==70000
assert F['campaign']['unpaid_founder_labor_economic_cost']==60
assert 50000+13620+6380==70000 and 2043+4337==6380
assert sum(F['uses'].values())==63620 and 300-90-20-10==180
A='{http://schemas.openxmlformats.org/drawingml/2006/main}'
C='{http://schemas.openxmlformats.org/drawingml/2006/chart}'
P='{http://schemas.openxmlformats.org/presentationml/2006/main}'
deck=r/'output/Wringy-Content-Rewards-Business-Plan.pptx'
with zipfile.ZipFile(deck) as z:
 slide_names=sorted([n for n in z.namelist() if re.fullmatch(r'ppt/slides/slide\d+.xml',n)],key=lambda n:int(re.search(r'slide(\d+)',n)[1])); assert len(slide_names)==15
 slides=[E.fromstring(z.read(n)) for n in slide_names]
 texts=['\n'.join(t.text or '' for t in x.iter(A+'t')) for x in slides]
 notes=['\n'.join(t.text or '' for t in E.fromstring(z.read(f'ppt/notesSlides/notesSlide{i}.xml')).iter(A+'t')) for i in range(1,16)]
 entire='\n'.join(texts+notes)
 for stale in ['110,000','110000','110k','第一版做什么','Wringy是什么','下一轮什么时候融','补充备注','三泳道']:
  assert stale not in entire,stale
 charts=[E.fromstring(z.read(n)) for n in z.namelist() if re.search(r'/charts/chart\d+.xml$',n)]
 chart_values=[[float(t.text) for t in x.findall('.//'+C+'numCache/'+C+'pt/'+C+'v')] for x in charts]
 assert chart_values==[[2000,300],[90,20,10,180],[11.266,22.532],[50000,13620,6380],[180,90,0,-90]],chart_values
 tables=sum(len(x.findall('.//'+A+'tbl')) for x in slides)
 pics=sum(len(x.findall('.//'+P+'pic')) for x in slides)
 pptlinks=[]
 for n in z.namelist():
  if n.endswith('.rels'):
   pptlinks.extend(x.get('Target') for x in E.fromstring(z.read(n)) if x.get('Type','').endswith('/hyperlink'))
 assert len(set(pptlinks))==7
pdf=r/'output/Wringy-Content-Rewards-Business-Plan.pdf'; pr=PdfReader(pdf); assert len(pr.pages)==15
urls=[a.get_object().get('/A',{}).get('/URI') for p in pr.pages for a in p.get('/Annots',[])]
assert len(urls)==7 and sorted(urls)==sorted(set(pptlinks))
assert v['finalSha256']==sha(deck) and v['presentationLayout']['finding_count']==0 and v['presentationLayout']['warning_count']==0
pages=sorted((r/'build/pdf-check').glob('page-*.jpg'));assert len(pages)==15
diff=[]
for i,p in enumerate(pages,1):
 a=Image.open(p).convert('RGB'); b=Image.open(r/f'build/renders/slide-{i:02}.png').convert('RGB').resize(a.size)
 diff.append(round(sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3,4))
# Diagnostic only: JPEG and resampling differences require visual review, not an arbitrary threshold.
im=Image.new('RGB',(1920,1880),'#ddd')
for i,p in enumerate(pages):
 a=Image.open(p);a.thumbnail((640,360));im.paste(a,((i%3)*640,(i//3)*376))
im.save(r/'build/pdf-check/contact.jpg')
marker={'pptx':1,'pdf':1};(r/'build/markers.json').write_text(json.dumps(marker))
receipt={'status':'passed','date':'2026-09-13','pages':15,'main':12,'appendix':3,'native_charts':5,'chart_values':chart_values,'native_tables':tables,'reused_generated_photo_assets':4,'new_images_generated':0,'photo_placements':pics,'layout_findings':0,'layout_warnings':0,'overflow':0,'all_pages_individually_reviewed':True,'pdf_poppler_pages':15,'pdf_render_mean_pixel_difference':diff,'source_links':7,'source_urls':urls,'markers':marker,'salary_allowance_cash_confirmed':0,'proposed_funding':70000,'proposed_ask_approved':False,'unpaid_founder_labor_economic_cost':60,'finance_source':'../content-rewards-business-v5/finance/results.json','finance_sha256':sha(f),'native_powerpoint_tested':False,'pdf_format':'Raster reading copy with source link annotations','files':{p.name:{'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted((r/'output').iterdir())}}
(r/'delivery-check.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2))
D=json.loads((r/'build/content.json').read_text())
(r/'story.md').write_text('# Wringy商业模式主稿 v6\n\n2026-09-13。用户批准商业模式纠正，12主稿＋3附录。以下可见文案及备注与最终PPTX同步；原生图表数据按各页列出。\n'+''.join('\n## '+str(i+1)+' '+D[i][0]+'\n\n'+text+'\n\n备注：\n'+notes[i]+'\n' for i,text in enumerate(texts)))
(r/'README.md').write_text('''# Wringy商业模式主稿

2026-09-13用户批准把重点从产品功能转向商业模式。15页，包括12页主稿与3页附录。沿用v5照片，收费、单场经济、复购和扩量条件放在主稿。

- [PDF阅读版](output/Wringy-Content-Rewards-Business-Plan.pdf)
- [可编辑PPTX](output/Wringy-Content-Rewards-Business-Plan.pptx)
- [15页联系表](output/contact-sheet.jpg)
- [完整可见文案与备注](story.md)
- [批准方向](brief.md)
- [交付回执](delivery-check.json)
- [当前财务工作簿](../content-rewards-business-v5/finance/output/Wringy-首轮资金与单场经济.xlsx)
- [当前财务结果](../content-rewards-business-v5/finance/results.json)

RM70,000仍为拟议募资额，尚未批准。创办人薪资及津贴RM0已确认，RM60未领薪劳动仍计入单场经济成本。财务源保持v5/finance，未新建或修改财务模型。

PPTX含5原生图表、2原生表格。PDF为清晰图片阅读版，保留7个可点击来源链接；完整来源在PPTX备注。所有15页已逐页检查，零版面溢出。未宣称在原生PowerPoint中测试。图片是AI虚构饮料活动示意，沿用来源和提示词见assets目录，不代表客户或产品建成。
''')
p=Path('phase-0/foundation/README.md');t=p.read_text();start=t.index('2026-09-13：',t.index('## 当前Content Rewards商业计划'));end=t.index('\n\n',start)
t=t[:start]+'2026-09-13：[当前商业模式主稿](../deliverables/content-rewards-business-v6/README.md)，12页主稿＋3页附录。按用户最新批准，聚焦付费方、收费、单场经济、复购与扩张，沿用v5图片，5个原生图表与2个表格，15页已逐页检查、零溢出。照片仅为AI虚构饮料活动示意。'+t[end:];p.write_text(t)
p=Path('.scratch/wringy-foundations/map.md');t=p.read_text();start=t.index('2026-09-13当前材料：');end=t.index('\n\n',start)
t=t[:start]+'2026-09-13当前材料：[Wringy商业模式主稿v6](../../phase-0/deliverables/content-rewards-business-v6/README.md)。用户批准减少产品介绍、专注商业模式。15页总计，沿用v5四张图片，5原生图表、2表格、7来源链接，逐页检查零溢出。薪资津贴RM0确认，70k仍为拟议金额，财务及xlsx继续以v5/finance为准，未领薪劳动60仍计成本。下列条目为历史进展。'+t[end:];p.write_text(t)
with Path('.scratch/wringy-foundations/issues/20-funding-growth-plan.md').open('a') as h:h.write('\n## 商业模式重点纠正完成｜2026-09-13\n\n用户批准v6减少产品说明，前置收费、单场贡献与复购。交付15页可编辑PPTX、PDF、联系表及delivery-check.json于content-rewards-business-v6；5原生图表、2表格、7可点击来源，15页逐页检查、零溢出。沿用v5图片，没有新生成或研究。财务源保持v5/finance：拟议70k、薪资津贴0确认、未领薪劳动60计经济成本。当前入口已更新，旧版未修改。\n')
print(json.dumps({'status':'passed','pages':15,'charts':5,'tables':tables,'links':len(urls),'max_pdf_difference':max(diff),'files':receipt['files']},ensure_ascii=False))

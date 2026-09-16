from pathlib import Path
import re,json,html,math
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,PageBreak,Table,TableStyle,Image,Flowable
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4
r=Path(__file__).resolve().parent.parent
font=r.parents[1]/'deliverables/brand/showcase/fonts/NotoSansSC.ttf'
for name in ['NotoSC','NotoSC-Bold','NotoSC-Italic','NotoSC-BoldItalic']:pdfmetrics.registerFont(TTFont(name,str(r/'build'/('NotoSC-Semibold.ttf' if 'Bold' in name else 'NotoSC-Regular.ttf'))))
pdfmetrics.registerFontFamily('NotoSC',normal='NotoSC',bold='NotoSC-Bold',italic='NotoSC-Italic',boldItalic='NotoSC-BoldItalic')
W,H=A4;M=49;CW=W-2*M
base=dict(fontName='NotoSC',fontSize=10.5,leading=16,wordWrap='CJK',textColor=colors.HexColor('#252525'),spaceAfter=8)
st={k:ParagraphStyle(k,**{**base,**v}) for k,v in {'body':{},'small':{'fontSize':8.2,'leading':12,'spaceAfter':5},'cell':{'fontSize':9,'leading':13,'spaceAfter':0},'h1':{'fontName':'NotoSC-Bold','fontSize':21,'leading':29,'spaceAfter':17},'h2':{'fontName':'NotoSC-Bold','fontSize':16,'leading':23,'spaceAfter':13},'source':{'fontSize':8.6,'leading':13,'spaceAfter':7}}.items()}
src={x['number']:x for x in json.loads((r/'sources.json').read_text())['sources']}
def inline(s):
 s=re.sub(r'\[([^\]]+)\]\(((?!https?://|#)[^)]+)\)',r'\1',s)
 s=html.escape(s,quote=False)
 s=re.sub(r'\[([^\]]+)\]\(([^)]+)\)',lambda m:('<super><link href="'+html.escape(m[2],quote=True)+'" color="#173D2A">['+m[1]+']</link></super>') if m[1].isdigit() else ('<link href="'+html.escape(m[2],quote=True)+'" color="#173D2A">'+m[1]+'</link>'),s)
 return re.sub(r'\*\*(.+?)\*\*',r'<b>\1</b>',s).replace('`','')
class Diagram(Flowable):
 def __init__(self,n):Flowable.__init__(self);self.n=n;self.width=CW;self.height={1:185,2:250,3:167}[n]
 def draw(self):
  c=self.canv;c.setStrokeColor(colors.HexColor('#718078'));c.setLineWidth(.8)
  def box(t,x,y,w,h=39):
   c.setFillColor(colors.HexColor('#F5F7F5'));c.rect(x,y,w,h,stroke=1,fill=1)
   p=Paragraph(t.replace('\n','<br/>'),ParagraphStyle('d',fontName='NotoSC',fontSize=9.5,leading=13,alignment=1,textColor=colors.HexColor('#173D2A')));_,ph=p.wrap(w-10,h);p.drawOn(c,x+5,y+(h-ph)/2)
  def arrow(x1,y1,x2,y2):
   c.line(x1,y1,x2,y2);a=math.atan2(y2-y1,x2-x1)
   for z in [-.5,.5]:c.line(x2,y2,x2-5*math.cos(a+z),y2-5*math.sin(a+z))
  def label(t,x,y,w=140):
   p=Paragraph(t,st['small']);_,h=p.wrap(w,25);p.drawOn(c,x,y)
  if self.n==1:
   labels=['商家\n目标、素材、预算','运营\n整理规则与配置','商家\n确认活动安排','运营\n内容与计量核验','创作者\n提交链接与账号','创作者\n查看规则并公开发布','工作人员／赞助方\n确认结算','约定付款方\n执行并核对付款','商家\n结果与复购决定'];xs=[0,175,350];ys=[139,78,17];w=147
   for k,t in enumerate(labels):box(t,xs[k%3],ys[k//3],w)
   for a,b in [(0,1),(1,2),(4,3),(5,4),(6,7),(7,8)]:arrow(xs[a%3]+(w if b>a else 0),ys[a//3]+19,xs[b%3]+(0 if b>a else w),ys[b//3]+19)
   arrow(423.5,139,423.5,117);arrow(73.5,78,73.5,56)
  elif self.n==2:
   box('内容合规',0,203,147);box('计量有效性',175,203,147);box('奖励批准',350,203,147);arrow(147,222,175,222);arrow(322,222,350,222)
   box('不符／缺证：理由、补证与复核',0,143,260);arrow(73,203,73,182);arrow(248,203,248,182)
   box('已确认未付奖励',350,143,147);arrow(423,203,423,182)
   box('付款完成',0,77,147);box('付款发起',175,77,147);box('失败或结果未知\n查询／对账',350,77,147);arrow(423,143,248,116);arrow(175,96,147,96);label('成功且核对',155,119);arrow(322,96,350,96)
   box('核对已支付\n转付款完成',0,6,147);box('确认失败或未付\n保留应付款再处理',175,6,147);box('结果仍未知\n继续暂缓，不重付',350,6,147)
   arrow(423,77,423,45);arrow(398,77,248,45);arrow(372,77,73,45)
  else:
   box('已取得观察\n页面／文档／证据',0,111,147);box('可反驳假设\n保留其他解释',175,111,147);box('许可范围测试\n账号／离线／沙盒',350,111,147);arrow(147,130,175,130);arrow(322,130,350,130)
   box('结果：支持、失败、受限或未执行',175,52,322);arrow(423,111,423,91);box('Wringy待决规则\n标明适用范围和缺口',0,4,147);arrow(175,71,147,24)
def page(c,doc):c.setFont('NotoSC',8);c.setFillColor(colors.HexColor('#666666'));c.drawRightString(W-M,25,str(doc.page))
flow=[];dn=0
for sec_i,section in enumerate((r/'report.md').read_text().split('<!--pagebreak-->')):
 if sec_i:flow.append(PageBreak())
 lines=section.strip().splitlines();i=0;pending_anchor='';is_sources='## 来源' in section
 while i<len(lines):
  line=lines[i].strip()
  if not line:i+=1;continue
  if line.startswith('<a id='):
   aid=re.search('id="([^"]+)"',line)[1];pending_anchor='<a name="'+aid+'"/>';i+=1;continue
  if line.startswith('```mermaid'):
   dn+=1;flow.extend([Diagram(dn),Spacer(1,8)]);i+=1
   while i<len(lines) and not lines[i].startswith('```'):i+=1
   i+=1;continue
  if line.startswith('!['):
   f=re.search(r'\]\(([^)]+)\)',line)[1];flow.extend([Image(str(r/f),width=CW,height=CW*720/1280),Spacer(1,7)]);i+=1;continue
  if line.startswith('|'):
   rows=[]
   while i<len(lines) and lines[i].strip().startswith('|'):
    vals=[x.strip() for x in lines[i].strip().strip('|').split('|')]
    if not all(re.fullmatch(r'[-: ]+',x) for x in vals):rows.append([Paragraph(inline(x),st['cell']) for x in vals])
    i+=1
   n=len(rows[0]);weights={3:[.2,.4,.4],4:[.16,.28,.28,.28]}.get(n,[1/n]*n)
   t=Table(rows,colWidths=[CW*x for x in weights],repeatRows=1,hAlign='LEFT');t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#EAF0EB')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),('LINEBELOW',(0,0),(-1,0),.7,colors.HexColor('#718078')),('LINEBELOW',(0,1),(-1,-1),.3,colors.HexColor('#D8DEDA'))]));flow.extend([t,Spacer(1,10)]);continue
  style='h1' if line.startswith('# ') else 'h2' if line.startswith('## ') else 'small' if line.startswith('图') else 'source' if is_sources else 'body'
  flow.append(Paragraph(pending_anchor+inline(re.sub(r'^#{1,2} ','',line)),st[style]));pending_anchor='';i+=1
 if not is_sources:
  ids=list(dict.fromkeys(int(x) for x in re.findall(r'\[(\d+)\]\(',section)))
  if ids:
   notes=[]
   for k in ids:
    x=src[k];url=x['url'] or '#source-'+str(k);notes.append('<link href="'+html.escape(url,quote=True)+'" color="#173D2A">['+str(k)+']</link> '+html.escape(x['title'][:35]))
   flow.append(Paragraph('来源：'+'；'.join(notes)+'。',st['small']))
out=r/'output/Wringy-Clipping-Deep-Research.pdf'
SimpleDocTemplate(str(out),pagesize=A4,leftMargin=M,rightMargin=M,topMargin=43,bottomMargin=44,title='Clipping与参考平台业务机制研究',author='Wringy').build(flow,onFirstPage=page,onLaterPages=page)
print(out)

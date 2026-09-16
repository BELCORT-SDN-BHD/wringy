import json,pathlib,base64,re
P=pathlib.Path(__file__).parent
T=json.loads((P/'tokens.json').read_text())
def source_css():
 css=(P/'tokens.css').read_text()
 return css.replace('url("assets/NotoSansSC.ttf")','url("data:font/ttf;base64,'+base64.b64encode((P/'assets/NotoSansSC.ttf').read_bytes()).decode()+'")')
def canonical_css(css):
 replacements={'font-size:40px':'font-size:var(--type-brandHeading)','font-size:30px':'font-size:var(--type-mobileHeading)','font-size:32px':'font-size:var(--type-objectHeading)','font-size:18px':'font-size:var(--type-body)','font-size:15px':'font-size:var(--type-app)','font-size:13px':'font-size:var(--type-caption)','width:1280px':'width:var(--layout-brandMax)','min-height:900px':'min-height:var(--layout-productExportHeight)','height:900px':'height:var(--layout-productExportHeight)','width:1440px':'width:var(--layout-productExportWidth)','max-width:420px':'max-width:var(--layout-settingsMax)','max-width:800px':'max-width:var(--layout-creatorMax)','min-height:44px':'min-height:var(--layout-controlMin)','border-radius:6px':'border-radius:var(--radius-control)','border-radius:12px':'border-radius:var(--radius-panel)'}
 for a,b in replacements.items():css=css.replace(a,b)
 # CSS custom properties are not valid inside media conditions or @page size.
 css=css.replace('(max-width:480px)','(max-width:'+str(T['layout']['mobileBreakpoint'])+'px)').replace('(max-width:800px)','(max-width:'+str(T['layout']['tabletBreakpoint'])+'px)')
 css=css.replace('size:1280px 900px','size:'+str(T['layout']['brandMax'])+'px '+str(T['layout']['productExportHeight'])+'px')
 return css

def samples(html):
 mapping={'日常好物演示':T['samples']['activity'],'无品牌随行水瓶':T['samples']['product'],'水瓶日常使用演示':T['samples']['workTitle'],'示例创作者 A':T['samples']['creator'],'示例品牌工作区':T['samples']['workspace'],'主体清晰 · 使用过程完整':T['samples']['requirement'],'预览作品 ＋ 内容说明':T['samples']['deliverable'],'概念场景，非真实客户':T['samples']['disclaimer']}
 return re.sub('|'.join(re.escape(x) for x in mapping),lambda m:mapping[m.group()],html)

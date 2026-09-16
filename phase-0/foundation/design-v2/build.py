from pathlib import Path
import json,hashlib,re
P=Path(__file__).parent
T=json.loads((P/'tokens.json').read_text())
sha=hashlib.sha256((P/'tokens.json').read_bytes()).hexdigest()
css=[]
for group in ['color','font','fontSize','fontWeight','lineHeight','letterSpacing','space','radius','border','layout','motion','shadow','zIndex','icon']:
 for key,value in T[group].items(): css.append(f'--{group}-{key}:{value};')
for key,value in T['semantic'].items(): css.append(f'--{key}:var(--{value.replace(".","-")});')
icons={p.stem:re.sub(r'<svg ', '<svg aria-hidden="true" focusable="false" ',p.read_text()).replace('stroke-width="2"','stroke-width="1.5"') for p in (P/'assets').glob('*.svg')}
html=(P/'showcase.template.html').read_text()
html=html.replace('@@TOKENS@@',':root{'+''.join(css)+'}').replace('@@SHA@@',sha).replace('@@TOKENJSON@@',json.dumps(T,ensure_ascii=False).replace('</','<\\/'))
for k,v in icons.items(): html=html.replace('{{'+k+'}}',v)
for k in ['mobileMax','tabletMax']:html=html.replace('@@'+k+'@@',T['breakpoint'][k])
html=html.replace('@@REWARD@@',f'RM{T["example"]["rewardMinor"]/100:,.2f}').replace('@@CAMPAIGN@@',T['example']['campaign']).replace('@@BRAND@@',T['example']['brand'])
html=html.replace('@@SWATCHES@@',''.join(f'<div class="swatch"><div style="background:var(--color-{k})"></div><b>{n}</b><code>{T["color"][k]}</code></div>' for k,n in [('canvas','Paper / 页面'),('ink','Ink / 文字'),('accent','Citron / 操作'),('composition','Stone / 构图'),('muted','Slate / 辅助')]))
(P/'showcase.html').write_text(html)
(P/'tokens.css').write_text('/* Generated from tokens.json SHA256 '+sha+' */\n:root{\n'+'\n'.join(css)+'\n}\n')
print('Generated showcase.html; tokens SHA256',sha)

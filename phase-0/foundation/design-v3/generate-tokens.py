import pathlib,json
p=pathlib.Path(__file__).parent;t=json.loads((p/'tokens.json').read_text());v={**t['colors'],'font-sans':t['font']['sans']}
for k,x in t['space'].items():v['space-'+k]=str(x)+'px'
for k,x in t['radius'].items():v['radius-'+k]=str(x)+'px'
for k,x in t['typography'].items():
 v['type-'+k]=str(x['size'])+'px';v['leading-'+k]=str(x['lineHeight']);v['weight-'+k]=str(x['weight'])
for k,x in t['layout'].items():v['layout-'+k]=str(x)+('' if k=='brandColumns' else 'px')
(p/'tokens.css').write_text('/* GENERATED from tokens.json; edit source and rerun generate-tokens.py. All values are Wringy proposals. */\n:root {\n'+''.join('  --'+k+': '+str(x)+';\n' for k,x in v.items())+'}\n@font-face{font-family:"Noto Sans SC";src:url("assets/NotoSansSC.ttf") format("truetype");font-weight:100 900;font-display:swap;}\n')

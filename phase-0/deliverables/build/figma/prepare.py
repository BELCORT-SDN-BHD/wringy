import json
from pathlib import Path
root=Path('phase-0/deliverables'); p=root/'build/figma'; t=json.loads((root/'brand/tokens.json').read_text())
q=[]
def add(name,code):q.append({'name':name,'code':code})
# Adapted createSemanticTokens helper: incremental <=10 variable creations.
rows=[]
for k,v in t['primitive']['color'].items():rows.append(['Wringy Primitives','color/'+k,'COLOR',v,[]])
for group in ['space','radius','borderWidth','duration','easing','zIndex','breakpoint','fontFamily']:
 for k,v in t['primitive'][group].items():
  scopes={'space':['GAP'],'radius':['CORNER_RADIUS'],'borderWidth':['STROKE_FLOAT'],'fontFamily':['FONT_FAMILY']}.get(group,[])
  rows.append(['Wringy Metrics',group+'/'+k,'FLOAT' if isinstance(v,(float,int)) else 'STRING',v,scopes])
for k,v in t['layout'].items():
 if isinstance(v,(int,float)):rows.append(['Wringy Metrics','layout/'+k,'FLOAT',v,['WIDTH_HEIGHT']])
for mode in ['light','dark']:
 for k,v in t['semantic'][mode].items():
  scope=['TEXT_FILL'] if k.startswith('text.') or k.endswith(('.fg','onPrimary','onSecondary')) else ['STROKE_COLOR'] if k.startswith(('border.','focus.')) else ['FRAME_FILL','SHAPE_FILL']
  rows.append(['Wringy Semantic '+mode.title(),k.replace('.','/'),'COLOR',{'alias':'color/'+v.split('.')[-1][:-1]},scope])
for i in range(0,len(rows),10):
 chunk=rows[i:i+10]
 add('P1 variables '+str(i),'''const cs=await figma.variables.getLocalVariableCollectionsAsync();const vs=await figma.variables.getLocalVariablesAsync();const out=[];
await Promise.all([{family:'Manrope',style:'Regular'},{family:'Noto Sans SC',style:'Regular'}].map(f=>figma.loadFontAsync(f)));
for(const [cn,name,type,raw,scopes] of '''+json.dumps(chunk)+'''){const c=cs.find(x=>x.name===cn);let v=vs.find(x=>x.name===name&&x.variableCollectionId===c.id);if(!v){v=figma.variables.createVariable(name,c,type);let value=raw;if(type==='COLOR'&&typeof raw==='string'){value={r:parseInt(raw.slice(1,3),16)/255,g:parseInt(raw.slice(3,5),16)/255,b:parseInt(raw.slice(5,7),16)/255,a:1};}else if(raw.alias){const a=vs.find(x=>x.name===raw.alias&&x.variableCollectionId===cs.find(c=>c.name==='Wringy Primitives').id);if(!a)throw Error('Missing '+raw.alias);value={type:'VARIABLE_ALIAS',id:a.id};}v.setValueForMode(c.modes[0].modeId,value);v.scopes=scopes;v.setVariableCodeSyntax('WEB','var(--wringy-'+(cn.includes('Semantic')?'':cn.includes('Primitives')?'primitive-':'')+name.replace(/\//g,'-')+')');v.description='Canonical tokens.json; proposed CSS mapping, no application code exists.';}out.push({id:v.id,name:v.name,collection:c.name});}return {variables:out};''')
styles=[]
for lang,family in [('Latin','Manrope'),('Chinese','Noto Sans SC')]:
 for device in ['desktop','mobile']:
  for k,v in t['typography']['styles'].items():
   weight=v['weight']; style='Bold' if weight>=700 else ('SemiBold' if lang=='Latin' else 'Medium') if weight>=600 else 'Regular'
   styles.append([f'Wringy/{lang}/{device}/{k}',family,style,v[device],(v.get('cjkLineHeight',v['lineHeight']) if lang=='Chinese' else v['lineHeight'])*100,0 if lang=='Chinese' else v.get('letterSpacingEm',0)*100])
for i in range(0,len(styles),8):
 add('P1 type styles '+str(i),'''const defs='''+json.dumps(styles[i:i+8])+''';await Promise.all(defs.map(d=>figma.loadFontAsync({family:d[1],style:d[2]})));const existing=await figma.getLocalTextStylesAsync();const out=[];for(const [name,family,weight,size,lh,ls] of defs){let s=existing.find(s=>s.name===name);if(!s){s=figma.createTextStyle();s.name=name;s.fontName={family,style:weight};s.fontSize=size;s.lineHeight={unit:'PERCENT',value:lh};s.letterSpacing={unit:'PERCENT',value:ls};s.description='Derived from canonical typography; Chinese 600 mapped to verified Medium (no SemiBold available).';}out.push({id:s.id,name:s.name});}return {styles:out};''')
add('P1 effects',"const out=[];for(const [name,a,y,r] of [['light/card',.06,2,8],['light/overlay',.16,12,32],['dark/card',0,0,0],['dark/overlay',.4,12,32]]){const s=figma.createEffectStyle();s.name='Wringy/'+name;s.effects=a?[{type:'DROP_SHADOW',color:name.startsWith('light')?{r:24/255,g:37/255,b:33/255,a}:{r:0,g:0,b:0,a},offset:{x:0,y},radius:r,spread:0,visible:true,blendMode:'NORMAL'}]:[];out.push({id:s.id,name:s.name});}return {styles:out};")
(p/'foundation-queue.json').write_text(json.dumps(q,ensure_ascii=False))
print(len(rows),'variables;',len(styles),'text styles;',len(q),'small calls')

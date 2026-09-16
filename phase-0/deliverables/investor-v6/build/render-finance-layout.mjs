import {fs,path,Presentation,PresentationFile,ROOT,BUILD} from './runtime.mjs';
import {text} from './primitives.mjs';
import {deriveIllustration,financeMetadata,fillUnitEconomics,fillMonthlyProfit,fillOperatingBreakEven} from './finance-slides.mjs';
const c=JSON.parse(await fs.readFile(path.resolve(ROOT,'../../foundation/design-v3/tokens.json'))).colors,C={background:c.canvas,surface:c.surface,ink:c.ink,muted:c.secondary,line:c.line};
const d=deriveIllustration(JSON.parse(await fs.readFile(path.join(BUILD,'finance-layout-input.json'))));
if(d.contribution!==750||d.grossProfit!==16000||d.operating!==-2000||d.breakEven!==23)throw Error('Approved illustration mismatch');
const p=Presentation.create({slideSize:{width:1280,height:720}}),metas=financeMetadata(d),fills=[fillUnitEconomics,fillMonthlyProfit,fillOperatingBreakEven];
const box=(left,top,width,height)=>({left,top,width,height});
const tx=(s,v,x,y,w,h,size=28,bold=false,color=C.ink)=>text(s,v,box(x,y,w,h),{size,bold,color});
const line=(s,x,y,w,h=2)=>s.shapes.add({geometry:'rect',position:box(x,y,w,h),fill:C.line,line:{fill:'none',width:0}});
const out=path.join(BUILD,'finance-layout-renders');await fs.mkdir(out,{recursive:true});
for(let i=0;i<3;i++){const m=metas[i],s=p.slides.add();s.background.fill=C.background;tx(s,m.title,64,50,1152,126,48,true);tx(s,m.foot,64,661,1152,45,17,false,C.muted);s.speakerNotes.textFrame.setText(m.note+'\n来源：\n'+m.sources.join('\n'));fills[i]({s,tx,line,C,d});const png=await p.export({slide:s,format:'png',scale:1});await fs.writeFile(path.join(out,m.key+'.png'),new Uint8Array(await png.arrayBuffer()));}
await(await PresentationFile.exportPptx(p)).save(path.join(BUILD,'finance-layout-draft.pptx'));console.log('Approved illustration layout rendered; final model/payback remain pending.');

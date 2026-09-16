import {fs,path,Presentation,PresentationFile,ROOT,BUILD} from './runtime.mjs';
import {text,tabler} from './primitives.mjs';
import {reviewPages,fillReviewRoles,fillReviewTiming,fillReviewAppendix} from './review-slides.mjs';
const c=JSON.parse(await fs.readFile(path.resolve(ROOT,'../../foundation/design-v3/tokens.json'))).colors;
const C={background:c.canvas,ink:c.ink,accent:c.citron,muted:c.secondary,line:c.line};
const p=Presentation.create({slideSize:{width:1280,height:720}});
const box=(left,top,width,height)=>({left,top,width,height});
const tx=(s,v,x,y,w,h,size=28,bold=false,color=C.ink)=>text(s,v,box(x,y,w,h),{size,bold,color});
const line=(s,x,y,w,h=2)=>s.shapes.add({geometry:'rect',position:box(x,y,w,h),fill:C.line,line:{fill:'none',width:0}});
const ico=async(s,name,x,y,size=34)=>tabler(s,path.resolve(ROOT,'../../foundation/design-v2/assets',name+'.svg'),box(x,y,size,size),C.ink);
const fills=[fillReviewRoles,fillReviewTiming,fillReviewAppendix];
const out=path.join(BUILD,'review-renders');await fs.mkdir(out,{recursive:true});
for(let i=0;i<3;i++){const m=reviewPages[i],s=p.slides.add();s.background.fill=C.background;tx(s,m.title,64,50,1152,126,48,true);tx(s,m.foot,64,661,1152,45,17,false,C.muted);s.speakerNotes.textFrame.setText(m.note+'\n来源：\n'+m.sources.join('\n'));await fills[i]({s,tx,line,ico,C});const png=await p.export({slide:s,format:'png',scale:1});await fs.writeFile(path.join(out,m.key+'.png'),new Uint8Array(await png.arrayBuffer()));}
await(await PresentationFile.exportPptx(p)).save(path.join(BUILD,'review-pages-draft.pptx'));
console.log('Research pages drafted. Main deck financial dependency remains locked.');

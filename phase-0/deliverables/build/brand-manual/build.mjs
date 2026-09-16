import fs from 'node:fs/promises';
import path from 'node:path';
import {PresentationFile} from '@oai/artifact-tool';
import {buildPresentation,finalizeBuiltPresentation} from '../renderer/renderer.mjs';
import {Canvas} from '../renderer/runtime.mjs';
const root=path.resolve(import.meta.dirname,'../..'), own=import.meta.dirname;
const input=JSON.parse(await fs.readFile(path.join(root,'content/brand-manual.json'),'utf8'));
const tokens=JSON.parse(await fs.readFile(path.join(root,'brand/tokens.json'),'utf8'));
const c=tokens.primitive.color, font=tokens.primitive.fontFamily;
const final=process.argv.includes('--final');
const custom=new Set([1,2,5,6,7,10,12,13,14,15,16,17,18,19,21,22,23,24,25,26,28,29,30]);
const plan=structuredClone(input);for(let i=0;i<plan.slides.length;i++)if(custom.has(i+1))plan.slides[i].body=[];
plan.slides[0].title='Wringy';
plan.slides[24].layout='statement';delete plan.slides[24].table;delete plan.slides[24].takeaway;plan.slides[24].facts_critical=true;
let assets={};try{assets=JSON.parse(await fs.readFile(path.join(own,'ui-assets.json'),'utf8'));}catch{}
if(final)for(const id of ['BB-21','BB-22','BB-23','BB-24','BB-25'])if(!assets[id]?.path)throw Error('Final requires screenshot handoff '+id);
const built=await buildPresentation(plan,{theme:tokens});
if(built.plan.length!==30)throw Error('Expected exactly 30 slides, got '+built.plan.length);
const p=built.presentation,ctx=new Canvas(1280,720).getContext('2d');
built.requirements.requiredNativeTableOwnerSlides.push(25);built.requirements.requiredNativeTableOwnerSlides.sort((a,b)=>a-b);
function txt(slide,value,x,y,w,h,size=28,color=c.ink,bold=false,family=font.cjk){
 ctx.font=`${bold?'bold ':''}${size}px "${family}"`;const lines=[];
 for(const part of String(value).split('\n')){let line='';for(const ch of part){if(line&&ctx.measureText(line+ch).width>w-16){lines.push(line);line='';}line+=ch;}lines.push(line);}
 if(lines.length*size*1.4+12>h)throw Error('Text overflow '+value.slice(0,40));
 const s=slide.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});s.text=lines.join('\n');s.text.style={typeface:family,fontSize:size,color,bold,autoFit:'none'};return s;
}
function rect(s,x,y,w,h,fill){return s.shapes.add({geometry:'rect',position:{left:x,top:y,width:w,height:h},fill,line:{fill:'none',width:0}});}
async function img(s,file,x,y,w,h,alt){s.images.add({blob:new Uint8Array(await fs.readFile(file)),contentType:'image/png',position:{left:x,top:y,width:w,height:h},fit:'contain',alt});}
function notes(s,n,extra=''){const d=input.slides[n-1];s.speakerNotes.textFrame.setText([d.speaker_notes_zh,...d.sources.map(v=>v.title+'\n'+v.url),extra].filter(Boolean).join('\n\n'));}
function rows(s,items,{x=72,y=210,w=1080,size=32,gap=28,color=c.ink}={}){for(const str of items){ctx.font=`${size}px "${font.cjk}"`;const h=(Math.ceil(ctx.measureText(str).width/(w-16))||1)*size*1.4+16;txt(s,str,x,y,w,h,size,color);y+=h+gap;if(y>648)throw Error('Row stack too tall');}}
for(let n=1;n<=30;n++){
 const s=p.slides.items[n-1],d=input.slides[n-1];notes(s,n);
 if(n===1){
  txt(s,'品牌与设计系统',72,190,520,110,44,c.paper,true);
  // The editorial still life occupies the right. The text remains native.
  await img(s,path.join(root,'assets/generated/brand-editorial.png'),610,180,598,380,'AI 生成的折纸、丝带与笔记本概念静物');
  txt(s,'品牌手册 v1',72,335,490,75,32,c.citron);
  txt(s,'马来西亚品牌与创作者\n合作平台',72,440,500,150,32,c.paper);
  notes(s,n,'图片来源：assets/generated/brand-editorial.png\nAI-generated conceptual illustration, not real customer evidence');
 }else if([2,5].includes(n)){
  txt(s,d.body[0],72,210,1060,190,42,c.ink,true);txt(s,d.body[1],72,462,1000,144,28,c.muted);
 }else if(n===6){
  const labels=['创作有空间','合作有依据','报酬有来由'];const desc=['必要要求与自由发挥分开写。','修改意见对应具体要求。','批准、可提现和到账分别表达。'];
  labels.forEach((v,i)=>{txt(s,String(i+1).padStart(2,'0'),72,220+i*128,100,70,36,c.iris,true,font.latin);txt(s,v,210,220+i*128,320,70,34,c.ink,true);txt(s,desc[i],560,225+i*128,635,100,28);});
 }else if(n===7){
  txt(s,'开放与大胆',72,220,500,90,42,c.iris,true);txt(s,'邀请时开放。\n作品展示保留创意空间。',72,340,510,190,32);
  txt(s,'具体与克制',684,220,500,90,42,c.ink,true);txt(s,'审核意见具体。\n钱款信息清楚，避免煽动。',684,340,510,190,32);
 }else if(n===10){
  await img(s,path.join(root,'assets/generated/brand-logo-concept.png'),655,178,470,470,'Wringy 原始标志概念 v1');
  rows(s,d.body,{x:72,y:220,w:500,size:30,gap:24});notes(s,n,'图像来源：assets/generated/brand-logo-concept.png\nAI 生成的概念来源。保持原图比例，未使用审阅版透明衍生图。');
 }else if(n===12){
  const sw=[['Citron','citron','活力强调'],['Ink','ink','文字与重要操作'],['Paper','paper','阅读背景']];
  sw.forEach(([name,key,role],i)=>{const x=72+i*390;rect(s,x,220,356,210,c[key]);if(key==='paper')rect(s,x,425,356,5,c.mist);txt(s,name,x,460,350,70,34,c.ink,true,font.latin);txt(s,c[key],x,530,350,52,24,c.muted,false,font.latin);txt(s,role,x,590,350,56,26);});
 }else if(n===13){
  rect(s,72,214,350,180,c.iris);txt(s,'Iris',92,238,300,80,48,c.white,true,font.latin);txt(s,c.iris,92,325,300,50,24,c.white,false,font.latin);txt(s,'次级强调与链接',72,445,420,100,32);
  [['审核中','info'],['需要修改','warning'],['提交失败','danger'],['审核已批准','success']].forEach(([label,key],i)=>{rect(s,580,220+i*95,28,40,c[key]);txt(s,label,632,210+i*95,470,70,32,c[key],true);});
  txt(s,'审核状态与资金状态分别显示',72,590,1120,55,26,c.muted);
 }else if(n===14){
  rect(s,72,205,536,315,c.paper);rect(s,652,205,556,315,c.night);
  txt(s,'浅色主题',100,240,460,75,36,c.ink,true);txt(s,'报酬 MYR 150.00 已批准\n尚不可提现',100,344,460,130,28,c.ink);
  txt(s,'深色主题',680,240,500,75,36,c.textDark,true);txt(s,'报酬 MYR 150.00 已批准\n尚不可提现',680,344,490,130,28,c.textDark);
  txt(s,'正文对比目标 4.5:1',72,562,530,70,28);txt(s,'关键图形对比目标 3:1',652,562,556,70,28);
 }else if(n===15){
  txt(s,'创意合作',72,205,1060,112,64,c.ink,true);
  txt(s,'Creative work / Kerjasama',72,323,1120,92,48,c.iris,true,font.latin);
  txt(s,'让要求、审核依据和报酬条件都清楚可读。',72,440,1120,100,32);
  txt(s,'Noto Sans SC  简体中文',72,575,530,60,24,c.muted);txt(s,'Manrope  English / Bahasa Melayu',652,575,556,60,24,c.muted,false,font.latin);
 }else if(n===16){
  const cols=tokens.primitive.space;txt(s,'手机 4 列',72,208,340,65,32,c.ink,true);txt(s,'桌面 12 列',490,208,718,65,32,c.ink,true);
  const mobile={x:72,y:298,w:320,h:190},desk={x:490,y:298,w:718,h:190};
  for(const [f,count] of [[mobile,tokens.layout.gridColumns.mobile],[desk,tokens.layout.gridColumns.desktop]]){rect(s,f.x,f.y,f.w,f.h,c.mist);const gap=8,inner=f.w-32,cw=(inner-gap*(count-1))/count;for(let j=0;j<count;j++)rect(s,f.x+16+j*(cw+gap),f.y+16,cw,f.h-32,c.citron);}
  txt(s,`边距 ${tokens.layout.mobileGutter}px\n触控目标 ${tokens.layout.touchTarget}px`,72,530,340,105,28);
  txt(s,`边距 ${tokens.layout.desktopGutter}px，内容上限 ${tokens.layout.contentMax}px\n控制圆角 ${tokens.primitive.radius.control}px，卡片圆角 ${tokens.primitive.radius.card}px`,490,530,718,105,28);
 }else if(n===17){
  await img(s,path.join(root,'assets/generated/learning-hero.png'),548,200,660,385,'AI 概念：成年人制作内容');rows(s,d.body,{x:72,y:215,w:430,size:28,gap:15});notes(s,n,'图片来源：assets/generated/learning-hero.png\nAI-generated conceptual illustration, not real customer evidence');
 }else if(n===18){
  const a=[['悬停反馈',tokens.primitive.duration.fast],['常规反馈',tokens.primitive.duration.standard],['进入',tokens.primitive.duration.enter],['退出',tokens.primitive.duration.exit]];
  a.forEach(([v,ms],i)=>{const x=72+i*290;txt(s,v,x,240,266,70,30);txt(s,String(ms),x,340,200,125,62,c.iris,true,font.latin);txt(s,'ms',x+180,375,76,65,28,c.muted,false,font.latin);});
  txt(s,'减少动态时即时切换，关键信息完整保留',72,545,1100,70,32);
 }else if(n===19){
  input.component_families.forEach((f,i)=>{const col=Math.floor(i/8),row=i%8;txt(s,`${String(i+1).padStart(2,'0')}  ${f.name_zh}`,72+col*288,205+row*46,278,46,24);});
  txt(s,'每类均记录变体、状态、键盘行为与响应式规则',72,599,1120,56,26,c.muted);
 }else if([21,22,23,24].includes(n)){
  const a=assets[d.id];
  if(a){const mobile=n===22||n===24;if(mobile){await img(s,a.path,758,174,410,470,a.alt??d.title);rows(s,d.body,{x:72,y:245,w:600,size:32,gap:30});}else{await img(s,a.path,320,184,888,448,a.alt??d.title);rows(s,d.body,{x:72,y:234,w:230,size:26,gap:24});}notes(s,n,`实际截图来源：${a.source??a.path}\n本地 HTML/CSS 设计示例，静态截图。不是已上线产品，也不代表 Figma 原生库完成。`);}
  else{rows(s,d.body,{x:72,y:250,w:540,size:32});}
 }else if(n===25){
  txt(s,'独立的未来界面示例\n非首版钱包或实际费率',72,215,680,130,30,c.ink);
  const data=[d.table.headers,...d.table.rows],table=s.tables.add({rows:data.length,columns:2,left:72,top:375,width:670,height:232,columnWidths:[340,330],values:data});
  table.borders.assign({outside:{fill:'none',width:0},insideVertical:{fill:'none',width:0},insideHorizontal:{fill:c.mist,width:1,style:'solid'}});
  for(let r=0;r<data.length;r++){table.rows[r].height=58;for(let j=0;j<2;j++){const cell=table.getCell(r,j);cell.fill=r===0?c.ink:r%2?c.white:c.paper;cell.text.style={typeface:font.cjk,fontSize:26,color:r===0?c.paper:c.ink,bold:r===0};}}
  const a=assets[d.id];if(a){await img(s,a.path,830,174,330,470,a.alt??'独立的未来支付界面示例');notes(s,n,`截图来源：${a.source??a.path}\n本地 HTML/CSS 未来支付示例。左侧金额为原生可编辑表格。`);}
 }else if(n===26){
  const columns=[['作品审核','已提交\n审核中\n通过或修改'],['报酬释放','已批准\n待释放\n可提现'],['提现处理','已发起\n处理中\n到账或异常']];
  columns.forEach(([label,states],i)=>{const x=72+i*390;txt(s,label,x,210,350,80,34,c.iris,true);txt(s,states,x,324,350,200,32);});txt(s,'未来流程示意。结果未知时先核对，避免重复发起。',72,586,1136,66,26,c.muted);
 }else if(n===28){rows(s,d.body,{size:34,gap:28});}
 else if(n===29){
  const labels=[['品牌策略',72,255,260],['视觉参数',444,255,280],['组件与演示',904,255,304]];const nodes=labels.map(([v,x,y,w])=>txt(s,v,x,y,w,100,36,c.ink,true));
  for(let i=0;i<2;i++)s.shapes.connect(nodes[i],nodes[i+1],{kind:'straight',fromSide:'right',toSide:'left',line:{fill:c.iris,width:2},tail:{type:'arrow',width:'med',length:'med'}});
  txt(s,'颜色、字体、间距与语义值统一维护',72,443,1100,90,34);
  txt(s,'本地组件库和品牌手册引用同一套视觉参数',72,555,1100,75,28,c.muted);
 }else if(n===30){rows(s,d.body,{x:72,y:225,w:1100,size:32,color:c.paper,gap:20});}
}
if(final){const result=await finalizeBuiltPresentation(built,{output:path.join(root,'output/03-Wringy品牌与设计系统.pptx'),workspaceDir:root,pdf:true,privateDir:path.join(own,'private')});await fs.writeFile(path.join(own,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
else{await (await PresentationFile.exportPptx(p)).save(path.join(own,'draft.pptx'));const dir=path.join(own,'preview');await fs.mkdir(dir,{recursive:true});for(let i=0;i<30;i++){if([20,21,22,23].includes(i)&&!assets[input.slides[i].id])continue;const v=await p.export({slide:p.slides.items[i],format:'png',scale:1.5});await fs.writeFile(path.join(dir,`slide-${String(i+1).padStart(3,'0')}.png`),new Uint8Array(await v.arrayBuffer()));}console.log('Draft saved; independent slides rendered.');}

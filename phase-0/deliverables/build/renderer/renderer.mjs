import fs from 'node:fs/promises';
import path from 'node:path';
import {Presentation,PresentationFile,FileBlob} from '@oai/artifact-tool';
import {Canvas,verifyFont,helpers,SKILL,PYTHON} from './runtime.mjs';
import {resolveTheme} from './theme.mjs';
import {verifyChineseGlyphs} from './font-coverage.mjs';
export const DEFAULT_THEME={fontFamily:'PingFang SC',background:'#F7F6F2',ink:'#25212D',muted:'#655E70',purple:'#6941D9',lime:'#DFFF70',white:'#FFFFFF',titleSize:48,bodySize:26,tableSize:22};
const layouts=new Set('cover statement image flow compare table chart module catalog closing'.split(' '));
const ctx=new Canvas(1280,720).getContext('2d');
function wrap(value,width,size,font,bold=false){
 ctx.font=`${bold?'bold ':''}${size}px "${font}"`;
 return String(value).split('\n').flatMap(p=>{let line='';const lines=[];for(const ch of p){if(line&&ctx.measureText(line+ch).width>width){lines.push(line);line='';}line+=ch;}lines.push(line);return lines;});
}
function text(slide,value,x,y,w,h,size,t,{bold=false,color=t.ink}={}){
 if(!value)return;
 const family=t.latinFontFamily&&!/[^\x00-\x7F]/.test(String(value))?t.latinFontFamily:t.fontFamily;
 const lines=wrap(value,w-12,size,family,bold);
 if(lines.length*size*1.4+12>h)throw Error(`Text overflow: ${String(value).slice(0,70)} (${lines.length} lines into ${h}px)`);
 const shape=slide.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 shape.text=lines.join('\n');shape.text.style={typeface:family,fontSize:size,bold,color,autoFit:'none'};
 return shape;
}
function background(slide,color,x=0,y=0,w=1280,h=720){return slide.shapes.add({geometry:'rect',position:{left:x,top:y,width:w,height:h},fill:color,line:{fill:'none',width:0}});}
function checkContent(input){
 if(input.language!=='zh-CN'||!input.title||!Array.isArray(input.slides)||!input.slides.length)throw Error('Require title, language zh-CN and nonempty slides');
 const ids=new Set();for(const s of input.slides){if(!s.id||ids.has(s.id)||!s.title||!layouts.has(s.layout))throw Error(`Invalid/duplicate slide ${s.id}`);ids.add(s.id);if(s.body&&!s.body.every(v=>typeof v==='string'))throw Error(`${s.id}: body must contain strings`);if(s.chart&&s.table)throw Error(`${s.id}: split chart and table into separate slides`);if(s.layout==='chart'&&!s.chart)throw Error(`${s.id}: chart data required`);if(s.layout==='table'&&!s.table)throw Error(`${s.id}: table data required`);}
}
function tableParts(s,t){
 const {headers,rows,columnWidths}=s.table;if(!headers?.length||!Array.isArray(rows)||rows.some(r=>r.length!==headers.length))throw Error(`${s.id}: invalid table matrix`);
 const widths=columnWidths??headers.map(()=>1136/headers.length);
 if(widths.length!==headers.length||Math.abs(widths.reduce((a,b)=>a+b,0)-1136)>1)throw Error(`${s.id}: columnWidths must total 1136`);
 const height=r=>Math.max(44,...r.map((v,i)=>wrap(v,widths[i]-24,t.tableSize,t.fontFamily).length*t.tableSize*1.4+20));
 const head=height(headers),limit=s.takeaway?330:402,pages=[];let chunk=[],used=head;
 for(const row of rows){const rh=height(row);if(rh+head>limit)throw Error(`${s.id}: table row too tall; shorten or restructure`);if(chunk.length===8||used+rh>limit){pages.push(chunk);chunk=[];used=head;}chunk.push(row);used+=rh;}if(chunk.length||!rows.length)pages.push(chunk);
 return pages.map((r,i)=>({...s,table:{...s.table,rows:r,_heights:[head,...r.map(height)],columnWidths:widths},_part:i+1,_parts:pages.length}));
}
export function paginate(input,t=DEFAULT_THEME){
 checkContent(input);return input.slides.flatMap(s=>{
 if(s.table)return tableParts(s,t);
 if(s.layout==='catalog'){
 const pages=[];let chunk=[],used=0;const limit=(s.example?546:640)-(s.takeaway?304:190);
 for(const item of s.body??[]){const h=wrap(item,1124,t.tableSize,t.fontFamily).length*t.tableSize*1.4+17;
 if(h>limit)throw Error(`${s.id}: catalog item too long for one slide`);
 if(chunk.length===8||used+h>limit){pages.push(chunk);chunk=[];used=0;}chunk.push(item);used+=h;}
 if(chunk.length||!pages.length)pages.push(chunk);
 return pages.map((body,i)=>({...s,body,_part:i+1,_parts:pages.length}));
 }
 const max=5;
 if((s.body?.length??0)>max){const a=[];for(let i=0;i<s.body.length;i+=max)a.push({...s,body:s.body.slice(i,i+max),_part:i/max+1,_parts:Math.ceil(s.body.length/max)});return a;}
 return [{...s,_part:1,_parts:1}];});
}
async function addAsset(slide,a,frame,base){
 if(!a?.path)throw Error('Asset entry requires local path');
 const ext=path.extname(a.path).toLowerCase(),mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'}[ext];if(!mime)throw Error(`Unsupported image ${a.path}`);
 slide.images.add({blob:new Uint8Array(await fs.readFile(path.resolve(base,a.path))),contentType:mime,alt:a.alt??'',fit:a.fullBleed&&!a.evidence?'cover':'contain',position:frame});
}
export async function buildPresentation(input,{theme={},assets={},assetBase=process.cwd()}={}){
 const t={...DEFAULT_THEME,...resolveTheme(theme)};verifyFont(t.fontFamily);if(t.fontFamily==='Noto Sans SC')verifyChineseGlyphs(JSON.stringify(input));if(t.titleSize<42||t.bodySize<24||t.tableSize<22)throw Error('Minimum font sizes: 42/24/22 px');
 const plan=paginate(input,t),p=Presentation.create({slideSize:{width:1280,height:720}}),tables=[],charts=[];
 for(const [i,s] of plan.entries()){
 const slide=p.slides.add(),a=assets[s.id],dark=['cover','closing','module'].includes(s.layout);slide.background.fill=dark?t.ink:t.background;
 const ink=a?.fullBleed?(a.textColor??t.ink):(dark?t.white:t.ink);let y=190;
 if(a?.fullBleed){if(s.layout!=='cover')throw Error(`${s.id}: fullBleed is cover-only`);await addAsset(slide,a,{left:0,top:0,width:1280,height:720},assetBase);}
 const title=s.title+(s._parts>1?`（${s._part}/${s._parts}）`:'');
 text(slide,title,72,a?.fullBleed?100:60,a?.fullBleed?520:1136,a?.fullBleed?270:140,dark?Math.max(56,t.titleSize):t.titleSize,t,{bold:true,color:ink});
 if(s.takeaway){text(slide,s.takeaway,72,a?.fullBleed?390:200,a?.fullBleed?520:1136,a?.fullBleed?120:86,t.bodySize,t,{color:a?.fullBleed?ink:(dark?t.lime:t.ink)});y=304;}
 const items=s.body??[];
 if(s.diagram){
 if(s.table||s.chart||items.length)throw Error(`${s.id}: diagram must own its content area`);
 const nodes=new Map();for(const n of s.diagram.nodes??[]){const {x,y:ny,width,height}=n;
 if(!n.id||nodes.has(n.id)||!n.text||![x,ny,width,height].every(Number.isFinite)||x<72||ny<y||x+width>1208||ny+height>630)throw Error(`${s.id}: invalid diagram node ${n.id}`);
 const shape=text(slide,n.text,x,ny,width,height,t.bodySize,t,{color:ink});nodes.set(n.id,shape);}
 for(const edge of s.diagram.edges??[]){if(!nodes.has(edge.from)||!nodes.has(edge.to))throw Error(`${s.id}: missing diagram endpoint`);
 slide.shapes.connect(nodes.get(edge.from),nodes.get(edge.to),{kind:'elbow',fromSide:edge.fromSide??'right',toSide:edge.toSide??'left',line:{style:'solid',fill:t.purple,width:2},tail:{type:'arrow',width:'med',length:'med'}});}
 }else if(s.table){
 const data=[s.table.headers,...s.table.rows],height=s.table._heights.reduce((a,b)=>a+b,0);
 const table=slide.tables.add({rows:data.length,columns:data[0].length,left:72,top:y,width:1136,height,columnWidths:s.table.columnWidths,values:data});
 table.borders.assign({outside:{fill:'none',width:0},insideVertical:{fill:'none',width:0},insideHorizontal:{fill:t.rule??'#DDE3D9',width:0.7,style:'solid'}});
 for(let r=0;r<data.length;r++){table.rows[r].height=s.table._heights[r];for(let c=0;c<data[r].length;c++){const cell=table.getCell(r,c);cell.fill=r===0?t.ink:(r%2?t.white:t.background);cell.text.style={typeface:t.fontFamily,fontSize:t.tableSize,color:r===0?t.white:t.ink,bold:r===0};}}
 tables.push(i+1);
 if(items.length)throw Error(`${s.id}: table slide body should be empty; use takeaway or speaker notes`);
 }else if(s.chart){
 const c=s.chart;if(!['bar','line','pie','doughnut','area'].includes(c.type)||!c.categories?.length||!c.series?.length||c.series.some(x=>x.values?.length!==c.categories.length||x.values.some(v=>!Number.isFinite(v))))throw Error(`${s.id}: invalid literal chart data`);
 if(items.length)throw Error(`${s.id}: chart slide body should be empty; use takeaway or notes`);
 const style={typeface:t.fontFamily,fontSize:24,fill:t.ink};
 const ch=slide.charts.add(c.type,{position:{left:72,top:y,width:1136,height:630-y},categories:c.categories,series:c.series.map((v,j)=>({...v,fill:v.fill??(t.chartColors??[t.purple,t.lime,t.muted])[j%(t.chartColors?.length??3)],valuesFormatCode:c.numberFormat??'0.##'})),hasLegend:c.series.length>1,legend:{position:'bottom',textStyle:style},barOptions:c.barOptions??{direction:'column',grouping:'clustered'},chartFill:t.background,plotAreaFill:t.background,xAxis:{numberFormatCode:'General',textStyle:style},yAxis:{numberFormatCode:c.numberFormat??'0.##',textStyle:style},dataLabels:{showValue:true,position:/stacked/i.test(c.barOptions?.grouping??'')?'inEnd':'outEnd',textStyle:style}});
 helpers.applyPresentationChartFont(ch,{fontFamily:t.fontFamily});charts.push(i+1);
 }else if(s.layout==='image'||(a&&!a.fullBleed)){
 if(!a)throw Error(`${s.id}: image asset missing; visual_brief is not an asset`);
 await addAsset(slide,a,{left:548,top:y,width:660,height:630-y},assetBase);
 let top=y;for(const item of items){const h=wrap(item,420,t.bodySize,t.fontFamily).length*t.bodySize*1.4+16;text(slide,item,72,top,420,h,t.bodySize,t,{color:ink});top+=h+16;if(top>640)throw Error(`${s.id}: image caption/body too long`);}
 }else if(s.layout==='compare'){
 if(items.length>2)throw Error(`${s.id}: compare requires at most two body strings`);
 items.forEach((item,j)=>text(slide,item,72+j*580,y,536,310,t.bodySize,t,{color:ink}));
 }else{
 let top=a?.fullBleed?530:y;
 for(const [j,item]of items.entries()){const size=s.layout==='catalog'?t.tableSize:t.bodySize,w=a?.fullBleed?520:(s.layout==='flow'?1060:1136),h=wrap(item,w-12,size,t.fontFamily).length*size*1.4+14;
 if(top+h>(s.example?546:640))throw Error(`${s.id}: body too dense; split slide`);
 if(s.layout==='flow')text(slide,String(j+1).padStart(2,'0'),72,top,64,h,size,t,{bold:true,color:t.purple});
 text(slide,item,s.layout==='flow'?148:72,top,w,h,size,t,{color:ink});top+=h+(s.layout==='catalog'?3:14);}
 }
 if(s.example)text(slide,`例如：${s.example}`,72,558,1136,80,24,t,{color:dark?t.lime:t.muted});
 const sources=s.sources??[];
 if(sources.length&&(s.chart||s.table||s.facts_critical))text(slide,`来源：${sources.map(x=>x.title).join('、')}`,72,666,1050,42,16,t,{color:a?.fullBleed?ink:(dark?t.white:t.muted)});
 text(slide,String(i+1).padStart(2,'0'),1150,666,58,42,16,t,{color:a?.fullBleed?ink:(dark?t.white:t.muted)});
 slide.speakerNotes.textFrame.setText([s.speaker_notes_zh??'',...sources.map(x=>`${x.title}\n${x.url}`),a?.source?`图片来源：${a.source}`:'',a?.ai_generated?'图片为 AI 生成的概念示意，不代表真实事件或产品界面。':''].filter(Boolean).join('\n\n'));
 }
 return {presentation:p,plan,theme:t,requirements:{explicitTotalSlideCount:plan.length,requiredNativeTableOwnerSlides:tables,requiredNativeChartOwnerSlides:charts,materializeLiteralChartWorkbooks:charts.length>0,...(input.tableArithmeticContracts?{tableArithmeticContracts:input.tableArithmeticContracts}:{})}};
}
export async function renderDeck(input,options){
 const {output,workspaceDir=path.dirname(output),pdf=false,...buildOptions}=options;
 if(!path.isAbsolute(output)||!path.isAbsolute(workspaceDir))throw Error('Absolute output and workspaceDir required');
 const built=await buildPresentation(input,buildOptions);
 return finalizeBuiltPresentation(built,{output,workspaceDir,pdf});
}
export async function finalizeBuiltPresentation(built,{output,workspaceDir,pdf=false,privateDir=path.join(workspaceDir,'.private')}){
 const tmp=await fs.mkdtemp(path.join(await fs.mkdir(privateDir,{recursive:true}).then(()=>privateDir),'render-'));
 await fs.mkdir(path.dirname(output),{recursive:true});const candidatePath=path.join(tmp,'candidate.pptx');
 await (await PresentationFile.exportPptx(built.presentation)).save(candidatePath);
 await helpers.finalizePresentation({...built.requirements,workspaceDir,candidatePath,finalPath:output,pythonExecutable:PYTHON,integrityValidatorPath:`${SKILL}/container_tools/inspect_presentation_package_integrity.py`,layoutValidatorPath:`${SKILL}/container_tools/inspect_presentation_layout_geometry.py`,layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit',...built.requirements.requiredNativeTableOwnerSlides.flatMap(n=>['--require-native-table-slide',String(n)])],fontPolicy:{basis:'design',families:[built.theme.fontFamily,...(built.theme.latinFontFamily?[built.theme.latinFontFamily]:[])]},verifyArtifactToolImport:true,receiptPath:path.join(tmp,'validation.json')});
 const final=await PresentationFile.importPptx(await FileBlob.load(output));const previewDir=path.join(tmp,'slides');await fs.mkdir(previewDir);
 const images=[];for(let i=0;i<built.plan.length;i++){const slide=final.slides.items[i];const preview=await final.export({slide,format:'png',scale:1.5});const bytes=new Uint8Array(await preview.arrayBuffer());const file=path.join(previewDir,`slide-${String(i+1).padStart(3,'0')}.png`);await fs.writeFile(file,bytes);images.push(bytes);}
 let pdfPath=null;if(pdf){const {PDFDocument}=await import('pdf-lib');const doc=await PDFDocument.create();for(const bytes of images){const im=await doc.embedPng(bytes);const page=doc.addPage([960,540]);page.drawImage(im,{x:0,y:0,width:960,height:540});}pdfPath=output.replace(/\.pptx$/i,'.pdf');await fs.writeFile(pdfPath,await doc.save(),{flag:'wx'});}
 const result={output,pdfPath,previewDir,slideCount:built.plan.length,slideMap:built.plan.map((s,i)=>({number:i+1,id:s.id,part:s._part,feature_ids:s.feature_ids??[]})),validation:path.join(tmp,'validation.json')};await fs.writeFile(path.join(tmp,'result.json'),JSON.stringify(result,null,2));return result;
}

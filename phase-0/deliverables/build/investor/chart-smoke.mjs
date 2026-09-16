import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {Presentation} from '../renderer/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';
import {Canvas,helpers} from '../renderer/runtime.mjs';
import {resolveTheme} from '../renderer/theme.mjs';
import {verifyChineseGlyphs} from '../renderer/font-coverage.mjs';
import {finalizeBuiltPresentation} from '../renderer/renderer.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
const raw=await fs.readFile(path.join(root,'content/wringy-investor.json'),'utf8'),source=JSON.parse(raw);
source.slides=source.slides.filter(s=>s.id==='INV25');
const tokens=JSON.parse(await fs.readFile(path.join(root,'brand/tokens.json'),'utf8')),theme=resolveTheme(tokens);
verifyChineseGlyphs(JSON.stringify(source));
const assets={INV01:[{path:path.join(root,'assets/generated/investor-hero.png'),alt:'创作者合作的抽象概念场景',ai_generated:true,fullBleed:true}]};
try{Object.assign(assets,JSON.parse(await fs.readFile(path.join(root,'content/investor-assets.json'),'utf8')));}catch{}
await fs.writeFile(path.join(root,'content/investor-assets.json'),JSON.stringify(assets,null,2));
await fs.writeFile(path.join(here,'.private/chart-smoke-input.json'),raw);
const p=Presentation.create({slideSize:{width:1280,height:720}}),ctx=new Canvas(1280,720).getContext('2d');
const tables=[],charts=[],diagrams=[],chartAdapters=[];
function lines(v,w,size,bold=false,font=theme.fontFamily){
 ctx.font=`${bold?'bold ':''}${size}px "${font}"`;
 return String(v).split('\n').flatMap(paragraph=>{
  const result=[];let line='';
  for(const token of paragraph.match(/[A-Za-z0-9]+(?:[.,%/-][A-Za-z0-9]+)*|./gu)??[]){
   if(line&&ctx.measureText(line+token).width>w){
    if(/^[，。、；：？！）】》”％]/u.test(token)){const tail=line.match(/[A-Za-z0-9]+(?:[.,%/-][A-Za-z0-9]+)*$/)?.[0]??Array.from(line).slice(-2).join('');result.push(line.slice(0,-tail.length));line=tail;}
    else{result.push(line.trimEnd());line='';}
   }
   line+=token;
  }
  result.push(line.trimEnd());return result;
 });
}
function box(sl,v,x,y,w,h,size=26,color=theme.ink,bold=false){if(!v)return;const font=/[^\x00-\x7F]/.test(v)?theme.fontFamily:theme.latinFontFamily;const ls=lines(v,w-14,size,bold,font);if(ls.length*size*1.32+12>h)throw Error(`${sl._id}: overflow ${v.slice(0,70)}; ${ls.length} lines need ${ls.length*size*1.32+12}, have ${h}`);const q=sl.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});q.text=ls.join('\n');q.text.style={typeface:font,fontSize:size,bold,color,autoFit:'none'};return q;}
function rect(sl,x,y,w,h,fill){return sl.shapes.add({geometry:'rect',position:{left:x,top:y,width:w,height:h},fill,line:{fill:'none',width:0}});}
async function picture(sl,a,x,y,w,h){sl.images.add({blob:new Uint8Array(await fs.readFile(a.path)),contentType:a.path.endsWith('.webp')?'image/webp':'image/png',alt:a.alt,fit:a.fullBleed?'cover':'contain',position:{left:x,top:y,width:w,height:h}});}
function body(sl,items,x,y,w,bottom,size=28,color=theme.ink){let top=y;for(const v of items){const h=lines(v,w-14,size).length*size*1.32+14;box(sl,v,x,top,w,h,size,color);top+=h+15;}if(top-15>bottom)throw Error(`${sl._id}: body ends at ${top-15} below ${bottom}`);}
function table(sl,s){
 const headers=s.table.headers,rows=s.table.rows.map(r=>r.map(v=>s.id==='INV12'?String(v).replace('RM1.8m','RM180万').replace('RM18m','RM1800万').replace('RM126m','RM1.26亿'):v)),n=headers.length;if(rows.length>8)throw Error(`${s.id}: pagination required`);
 const widths=({INV08:[200,180,130,642],INV16:[350,230,572],INV18:[190,370,592],INV21:[240,120,400,392],INV23:[340,330,482],INV26:[380,250,272,250],APP01:[250,490,412],APP06:[440,244,234,234],APP08:[260,540,352]})[s.id]??({3:[340,430,382],4:[252,300,300,300],5:[210,210,252,240,240]})[n];
 if(!widths)throw Error(`${s.id}: unsupported table columns`);
 const size=rows.length>=6?23:24;
 const rowHeight=r=>Math.max(50,...r.map((v,j)=>lines(String(v),widths[j]-26,size).length*size*1.32+18));
 const heights=[rowHeight(headers),...rows.map(rowHeight)],height=heights.reduce((a,b)=>a+b,0);
 if(height>388)throw Error(`${s.id}: table height ${height}; requires layout adjustment`);
 const t=sl.tables.add({rows:rows.length+1,columns:n,left:64,top:204,width:1152,height,columnWidths:widths,values:[headers,...rows]});
 t.borders.assign({outside:{fill:'none',width:0},insideVertical:{fill:'none',width:0},insideHorizontal:{fill:theme.rule,width:.7,style:'solid'}});
 for(let r=0;r<=rows.length;r++){t.rows[r].height=heights[r];for(let c=0;c<n;c++){const cell=t.getCell(r,c);cell.fill=r===0?theme.ink:r%2?theme.white:theme.background;cell.text.style={typeface:theme.fontFamily,fontSize:size,color:r===0?theme.white:theme.ink,bold:r===0};}}
 tables.push(p.slides.items.length);
}
const flowLabels={INV03:['明确产品\n与内容要求','寻找合适\n的创作者','沟通修改\n与验收依据','确认费用\n与付款状态'],INV05:['简报：\n要求与创作空间','提交：\n作品版本与补充说明','审核：\n依据、报酬与下一步'],INV06:['发布简报\n与报酬规则','确认创作者预算\n和平台费','提交作品并审核\n记录应付报酬','品牌经银行\n或支付商直接出款','核对付款证明\n与结果'],INV11:['背景：消费者\n在线交易多大？','预算：哪些内容\n支出可承接？','触达：哪些独立\n品牌能签约？'],INV17:['核对品牌最近\n的真实采购。','把需求写成\n可验收简报。','邀请匹配任务\n的创作者。','记录交付，再争取\n下一次活动。']};
function flow(sl,s){
 const items=flowLabels[s.id]??s.body,n=items.length,w=(1152-(n-1)*28)/n;
 const shapes=items.map((v,j)=>{box(sl,String(j+1).padStart(2,'0'),64+j*(w+28),228,w,52,28,theme.purple,true);return box(sl,v,64+j*(w+28),300,w,192,n===5?24:28);});
 for(let j=1;j<n;j++)sl.shapes.connect(shapes[j-1],shapes[j],{kind:'straight',fromSide:'right',toSide:'left',line:{fill:theme.purple,width:2},tail:{type:'arrow',width:'med',length:'med'}});
 diagrams.push({slide:p.slides.items.length,connectors:n-1});
}
for(const [idx,s]of source.slides.entries()){
 const sl=p.slides.add();sl._id=s.id;sl.background.fill=theme.background;
 const notes=[s.takeaway,s.speaker_notes_zh,...s.body,s.example,...(s.sources??[]).map(x=>`${x.title}\n${x.url}`)];
 const dark=s.layout==='cover'||s.layout==='closing';
 if(s.layout==='cover'){
  await picture(sl,assets.INV01[0],0,0,1280,720);box(sl,s.title,64,122,610,140,92,theme.white,true);box(sl,s.takeaway,64,310,630,130,38,theme.lime);box(sl,s.example,64,568,650,70,26,theme.white);notes.push('本页图片为 AI 生成的概念场景，不代表现有客户、合作或已上线产品。');
 }else{
  if(dark)sl.background.fill=theme.ink;
  box(sl,s.title,64,40,1152,84,44,dark?theme.white:theme.ink,true);
  const takeaway=s.id==='INV25'?s.takeaway.replace('纵轴MYR，','纵轴MYR万，'):s.takeaway;
  box(sl,takeaway,64,132,1152,68,25,dark?theme.lime:theme.ink);
  if(s.table)table(sl,s);
  else if(s.chart){
   const c=s.chart,scale=10000,st={typeface:theme.fontFamily,fontSize:23,fill:theme.ink};
   const categories=[...c.categories];
   const series=c.series.map((r,j)=>({name:r.name,values:r.values.map(v=>Number((v/scale).toFixed(8))),line:{fill:theme.chartColors[j%4],width:3,style:'solid'},marker:{symbol:'none'},valuesFormatCode:'0.00'}));
   const chart=sl.charts.add('line',{position:{left:64,top:208,width:1152,height:378},categories,series,hasLegend:true,legend:{position:'bottom',textStyle:st},lineOptions:{smooth:false},chartFill:theme.background,plotAreaFill:theme.background,xAxis:{textStyle:{...st,fontSize:21},numberFormatCode:'General'},yAxis:{textStyle:st,numberFormatCode:'0',title:{text:'MYR万',textStyle:st},min:-100,max:Math.ceil(Math.max(...series.flatMap(x=>x.values))/100)*100,majorUnit:100,majorGridlines:{fill:theme.rule,width:1,style:'solid'}},dataLabels:{showValue:false}});
   helpers.applyPresentationChartFont(chart,{fontFamily:theme.fontFamily});charts.push(idx+1);
   chartAdapters.push({slide:s.id,scale,originalCategories:c.categories,displayCategories:categories,originalSeries:c.series});
   notes.push('金额单位：图中每1万MYR＝10,000MYR。\n'+c.categories.map((m,i)=>`${m}：${c.series.map(r=>`${r.name} ${r.values[i]} MYR`).join('；')}`).join('\n'));
  }else if(assets[s.id]?.length){
   const a=assets[s.id];for(const [j,im]of a.entries()){await picture(sl,im,64+j*582,208,570,330);notes.push(im.source?`图片来源：${im.source}`:'');}
   const conceptNodes=['简报','提交','审核'].map((v,j)=>box(sl,v,64+j*390,546,340,51,26));
   for(let j=1;j<3;j++)sl.shapes.connect(conceptNodes[j-1],conceptNodes[j],{kind:'straight',fromSide:'right',toSide:'left',line:{fill:theme.purple,width:2},tail:{type:'arrow',width:'med',length:'med'}});
   diagrams.push({slide:idx+1,connectors:2});notes.push('工作台截图为产品概念，所示品牌、活动、金额及状态均为示例数据；不代表已上线产品或真实交易。');
  }else if(s.layout==='flow'&&!['INV15','INV20'].includes(s.id))flow(sl,s);
  else body(sl,s.body,64,220,1152,574,29,dark?theme.white:theme.ink);
  if(s.example)box(sl,s.example.replace(/\s+/g,' '),64,607,1152,70,23,dark?theme.lime:theme.muted);
 }
 const footer=(s.sources??[]).slice(0,2).map(x=>x.title.replace(/ — .*/,''));
 if(footer.length)box(sl,'来源：'+footer.join('、')+(s.sources.length>2?'等':''),64,682,1090,32,13,theme.muted);
 box(sl,String(idx+1).padStart(2,'0'),1154,682,62,32,13,dark?theme.white:theme.muted);
 sl.speakerNotes.textFrame.setText(notes.filter(Boolean).join('\n\n'));
}
let version=1,output=path.join(root,'build/investor/.private/chart-test-output/chart-smoke.pptx');while(true){try{await fs.access(output);output=path.join(root,`build/investor/.private/chart-test-output/chart-smoke-v${++version}.pptx`);}catch{break;}}
const coverage={sourceSha256:createHash('sha256').update(raw).digest('hex'),count:source.slides.length,ids:source.slides.map(x=>x.id),tables,charts,diagrams,chartAdapters};
await fs.writeFile(path.join(here,'chart-smoke-coverage.json'),JSON.stringify(coverage,null,2));
const built={presentation:p,plan:source.slides,theme,requirements:{explicitTotalSlideCount:source.slides.length,requiredNativeTableOwnerSlides:tables,requiredNativeChartOwnerSlides:charts,materializeLiteralChartWorkbooks:true}};
const result=await finalizeBuiltPresentation(built,{output,workspaceDir:root,privateDir:path.join(here,'.private'),pdf:true});
await fs.writeFile(path.join(here,'chart-smoke-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));

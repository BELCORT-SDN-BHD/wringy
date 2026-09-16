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
const source=JSON.parse(await fs.readFile(path.join(root,'content/whop-learning.json'),'utf8'));
const theme=resolveTheme(JSON.parse(await fs.readFile(path.join(root,'brand/tokens.json'),'utf8')));
verifyChineseGlyphs(JSON.stringify(source));
const allAssets=JSON.parse(await fs.readFile(path.join(root,'assets/whop-assets.json'),'utf8')).assets;
const mappings={S09:[5,6],S11:[2,3],S13:[4],S15:[7],S16:[8],S17:[1],S20:[15],S21:[14],S25:[13],S26:[12],S29:[10],S30:[11],S32:[9]};
const assets={S01:[{path:path.join(root,'assets/generated/learning-hero.png'),alt:'创作者共同制作内容的概念场景',ai_generated:true,fullBleed:true}]};
for(const [id,nums]of Object.entries(mappings))assets[id]=nums.map(n=>{const a=allAssets[n-1];return {asset_id:a.asset_id,path:a.local_path,alt:a.title_zh,source:a.canonical_mobbin_url,evidence:true,visible_elements:a.actual_visible_elements};});
await fs.writeFile(path.join(root,'content/learning-assets.json'),JSON.stringify(assets,null,2));
const p=Presentation.create({slideSize:{width:1280,height:720}}),ctx=new Canvas(1280,720).getContext('2d');
const tables=[],charts=[],diagrams=[],records=[];
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
function body(sl,items,x,y,w,bottom,size=28){let top=y;for(const v of items){const h=lines(v,w-14,size).length*size*1.32+14;box(sl,v,x,top,w,h,size);top+=h+15;}if(top-15>bottom)throw Error(`${sl._id}: body ends at ${top-15} below ${bottom}`);}
function nativeTable(sl,s,top,width=1152,left=64,appendix=false){
 let headers=s.table.headers,rows=s.table.rows,tracks;
 if(s.id==='S20'){headers=['内容形式','计酬方式'];rows=rows.map(r=>r[0]==='音乐或标识类活动'?['音乐或标识\n类活动',r[1]]:r);}
 if(s.id==='S32'){headers=['路线','处理方','结果'];rows=[['平台退款\n案件','买家、\n商家与\n平台','决定后\n再看退款\n执行'],['银行拒付','持卡人、\n发卡行与\n商家证据','发卡行\n决定及\n资金结果']];}
 if(s.id==='S25')rows=rows.map(r=>r[0]==='商家推荐伙伴'?['商家推荐\n伙伴',r[1]]:r[0]==='合作分成'?[r[0],'约定的扣费后\n交易金额']:r);
 if(appendix){headers=[headers[1],headers[2],headers[0]];rows=rows.map(r=>[r[1],r[2],r[0]]);tracks=[270,700,182];}
 else if(width<600)tracks=headers.length===2?[width*.48,width*.52]:headers.map(()=>width/headers.length);
 else tracks=headers.length===2?[350,width-350]:[340,430,width-770];
 const size=appendix?23:25;const heights=[Math.max(48,...headers.map((v,j)=>lines(v,tracks[j]-26,size,true).length*size*1.32+18)),...rows.map(r=>Math.max(appendix?52:54,...r.map((v,j)=>lines(String(v),tracks[j]-26,size).length*size*1.32+18)))];
 const total=heights.reduce((a,b)=>a+b,0);if(top+total>654)throw Error(`${s.id}: table too tall ${top+total}`);
 const t=sl.tables.add({rows:rows.length+1,columns:headers.length,left,top,width,height:total,columnWidths:tracks,values:[headers,...rows]});t.borders.assign({outside:{fill:'none',width:0},insideVertical:{fill:'none',width:0},insideHorizontal:{fill:theme.rule,width:.7,style:'solid'}});
 for(let r=0;r<=rows.length;r++){t.rows[r].height=heights[r];for(let c=0;c<headers.length;c++){const cell=t.getCell(r,c);cell.fill=r===0?theme.ink:(r%2?theme.white:theme.background);cell.text.style={typeface:theme.fontFamily,fontSize:size,color:r===0?theme.white:theme.ink,bold:r===0};}}
 tables.push(p.slides.items.length);return total;
}
const flowLabels={
 S02:['经营者\n上架商品','买家付款\n并获得交付','推广和广告\n带来客户','奖励与销售款\n进入资金流程'],
 S10:['资料与交付内容\n先对应','发布状态控制\n新买家入口','既有会员仍有\n历史记录','有相关记录时\n删除会受限'],
 S12:['付款失败\n进入欠费','提醒客户更新\n付款方式','文档描述五天内\n自动重试','访问是否保留\n取决于设置'],
 S14:['核对购买\n所用邮箱','查看商品是否\n包含该群','确认会员\n权益有效','处理外部绑定\n或再同步'],
 S24:['目标可以是内容、\n互动或本地任务','按每份毛奖励\n乘名额安排资金','执行者提交证据，\n后台人工审批','有在途提交时，\n取消需先处理'],
 S36:['先选对\n要操作的生意','重要动作\n先预览再确认','生成媒体\n要等文件就绪','建议步骤记录\n不等于业务完成'],
 S37:['品牌先采购\n合格内容','获授权后\n可用于广告','推广链接可能\n带来合格订单','奖励、媒体费、\n佣金分别记录']
};
function chain(sl,s){const n=s.body.length,w=(1152-(n-1)*36)/n;const shapes=(flowLabels[s.id]??s.body).map((v,j)=>{box(sl,String(j+1).padStart(2,'0'),64+j*(w+36),220,w,52,28,theme.purple,true);return box(sl,v,64+j*(w+36),290,w,190,28);});for(let j=1;j<n;j++)sl.shapes.connect(shapes[j-1],shapes[j],{kind:'straight',fromSide:'right',toSide:'left',line:{fill:theme.purple,width:2},tail:{type:'arrow',width:'med',length:'med'}});diagrams.push(p.slides.items.length);}
const imageCaptions={S17:'商品店面示例',S20:'Whop内嵌版界面示例；截图采集日期未知。\n现行规则以适用CR条款为准。',S21:'Whop内嵌版界面示例；截图采集日期未知。\n现行规则以适用CR条款为准。',S26:'推广链接示例；非蓝图收益',S30:'尚无提现记录的界面示例',S32:'平台售后案件；非银行拒付界面'};
const imageNotes={S09:'图示为团队角色及邀请权限，不是商品编辑界面。',S11:'图示是套餐选择和购前问题界面，不表示付款已成功。',S13:'图示是课程管理预览，不是学员完成学习的证明。',S16:'图示案件仍需要商家回应，不表示已经退款。',S17:'图示是商品店面，不是搜索结果页；用于观察介绍、价格及购买入口。',S20:'图示为 Whop 内的内容奖励发现页，捕获日期未知；当前 CR 合作以适用条款为准。',S21:'图示展示活动规则与投稿入口，不表示投稿已审批或奖励到账。',S29:'图示含待处理交易和补充经营资料提示，不证明全部余额已可提现。',S30:'图示为尚无提现记录的页面，不是成功到账凭证。',S32:'图示属于平台售后案件，不是发卡行拒付处理界面。'};
for(const [idx,s]of source.slides.entries()){
 const sl=p.slides.add();sl._id=s.id;sl.background.fill=theme.background;const a=assets[s.id]??[],appendix=idx>=40;
 const retainedNotes=[s.speaker_notes_zh,...s.body,s.example,...(s.table?[s.table.headers.join('；')]:[]),...(s.sources??[]).map(x=>`${x.title}\n${x.url}`)];
 const example=s.id==='S40'?'练习：Aina 获批视频奖励后申请提现。\n答：品牌买内容，CR 按活动规则计酬，Whop 处理相关资金；\n银行到账还要看出款结果。':s.id==='S26'?'教学假设：Whop利润 RM2 ×\n蓝图奖励10%＝RM0.20。\n基数不是订单价。':s.id==='S20'?'原创新作可按篇付款；剪辑活动可按有效观看计酬，具体看活动。':s.example?.replace(/\s+/g,' ');
 if(s.layout==='cover'){
 await picture(sl,a[0],0,0,1280,720);box(sl,s.title,64,100,560,190,60,theme.ink,true);box(sl,s.takeaway,64,340,540,110,30);body(sl,s.body,64,490,540,680,24);
 }else{
 box(sl,s.title,64,40,1152,80,44,theme.ink,true);
 if(!appendix)box(sl,s.takeaway,64,131,1152,64,26);
 if(appendix){retainedNotes.push(s.takeaway);nativeTable(sl,s,162,1152,64,true);}
 else if(a.length===2){
 await picture(sl,a[0],64,202,554,376);await picture(sl,a[1],662,202,554,376);
 box(sl,a[0].alt,64,578,554,44,23,theme.muted);box(sl,a[1].alt,662,578,554,44,23,theme.muted);
 }else if(a.length===1){
 const longCaption=['S20','S21'].includes(s.id);
 await picture(sl,a[0],494,202,722,longCaption?410:436);
 if(imageCaptions[s.id])box(sl,imageCaptions[s.id],494,longCaption?615:642,722,longCaption?61:36,18,theme.muted);
 if(s.table){nativeTable(sl,s,218,406,64,false);}else body(sl,s.body,64,218,396,538,25);
 if(s.example){box(sl,example,64,554,396,112,23,theme.muted);}
 }else if(s.chart){
 body(sl,s.body,64,216,430,546,26);
 const c=s.chart,stack=c.type==='stacked_bar',st={typeface:theme.fontFamily,fontSize:24,fill:theme.ink};
 const ch=sl.charts.add('bar',{position:{left:534,top:218,width:682,height:338},categories:c.categories,series:c.series.map((r,j)=>({...r,name:stack?`${r.name} RM${r.values[0]}`:r.name,fill:j===0?theme.ink:theme.purple,valuesFormatCode:'"RM"0'})),hasLegend:stack,legend:{position:'bottom',textStyle:st},barOptions:{direction:stack?'bar':'column',grouping:stack?'stacked':'clustered'},chartFill:theme.background,plotAreaFill:theme.background,xAxis:{textStyle:st,numberFormatCode:'General'},yAxis:{textStyle:st,numberFormatCode:'"RM"0',...(stack?{min:0,max:c.series.reduce((a,r)=>a+r.values[0],0),majorUnit:c.series.reduce((a,r)=>a+r.values[0],0)/2}:{})},dataLabels:{showValue:!stack,position:stack?'center':'outEnd',textStyle:{...st,fill:stack?theme.white:theme.ink}}});helpers.applyPresentationChartFont(ch,{fontFamily:theme.fontFamily});charts.push(idx+1);
 }else if(s.table){nativeTable(sl,s,214);}
 else if(s.layout==='flow'&&!['S23','S38'].includes(s.id)){chain(sl,s);}
 else if(s.layout==='module'){
 rect(sl,64,220,14,308,theme.lime);body(sl,s.body,110,226,1080,552,30);
 }else{body(sl,s.body,64,218,1152,s.example?550:654,30);}
 if(s.example&&!a.length){box(sl,example,64,s.id==='S40'?552:579,1152,s.id==='S40'?116:92,24,theme.muted);}
 if(s.example&&a.length===2)box(sl,example,64,625,1152,49,23,theme.muted);
 }
 const sourceText=s.sources?.length?`来源：${s.sources.slice(0,2).map(x=>x.title).join('、')}${s.sources.length>2?'等':''}`:'';
 if(s.layout!=='cover')box(sl,sourceText,64,678,1090,34,14,theme.muted);box(sl,String(idx+1).padStart(2,'0'),1154,678,62,34,14,theme.muted);
 for(const im of a){if(im.source)retainedNotes.push(`图片来源：${im.source}`);if(im.ai_generated)retainedNotes.push('本页图片为 AI 生成的概念场景，不代表真实客户、事件或产品界面。');}
 if(imageNotes[s.id])retainedNotes.push(imageNotes[s.id]);
 sl.speakerNotes.textFrame.setText(retainedNotes.filter(Boolean).join('\n\n'));
 records.push({number:idx+1,id:s.id,assets:a.map(x=>x.asset_id??'learning-hero'),feature_ids:s.feature_ids,bodyInNotes:a.length===2});
}
if(p.slides.items.length!==64)throw Error('Expected exactly 64 slides');
const features=[...new Set(source.slides.flatMap(s=>s.feature_ids))];if(features.length!==168)throw Error(`Expected 168 feature IDs; got ${features.length}`);
const appendixIDs=source.slides.slice(40).flatMap(s=>s.table.rows.map(r=>r[0]));if(new Set(appendixIDs).size!==168)throw Error('Appendix feature coverage incomplete');
let version=1;let output=path.join(root,'output/01-读懂Whop.pptx');try{await fs.access(output);do{output=path.join(root,`output/01-读懂Whop-v${++version}.pptx`);try{await fs.access(output);}catch{break;}}while(true);}catch{}
const built={presentation:p,plan:source.slides,theme,requirements:{explicitTotalSlideCount:64,requiredNativeTableOwnerSlides:tables,requiredNativeChartOwnerSlides:charts,materializeLiteralChartWorkbooks:true}};
await fs.writeFile(path.join(here,'coverage.json'),JSON.stringify({sourceSha256:createHash('sha256').update(JSON.stringify(source)).digest('hex'),count:64,featureCount:168,appendixIDs,records,tables,charts,diagrams},null,2));
const result=await finalizeBuiltPresentation(built,{output,workspaceDir:root,privateDir:path.join(here,'.private'),pdf:true});
await fs.writeFile(path.join(here,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));

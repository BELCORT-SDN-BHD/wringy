import {fs,path,Presentation,PresentationFile,ROOT,BUILD,FONT,sha} from './runtime.mjs';
import {text,image,tabler} from './primitives.mjs';
import sharp from 'sharp';
import {marketChart,budgetChart,BUDGET_TOTAL} from './evidence.mjs';
const draft=process.argv.includes('--draft');
const canonical=path.resolve(ROOT,'../../foundation/design-v3/tokens.json');
let C,tokenSource,tokenHash;
try {const raw=await fs.readFile(canonical);const t=JSON.parse(raw);const c=t.color??t.colors; if(!c)throw Error('Canonical color structure requires mapping');C={background:c.canvas??c.background??c.white,surface:c.surface??c.neutral,ink:c.ink,accent:c.accent??c.citron,forest:c.forest??c.deepForest,muted:c.muted??c.secondary,line:c.line};for(const k of ['background','surface','ink','accent','muted','line'])if(typeof C[k]!=='string')throw Error('Missing canonical color '+k);tokenSource=canonical;tokenHash=sha(raw);}catch(e){if(!draft)throw e; const raw=await fs.readFile(path.join(BUILD,'draft-palette.json'));C=JSON.parse(raw);tokenSource='main-authorized-draft-only';tokenHash=sha(raw);}
const p=Presentation.create({slideSize:{width:1280,height:720}});
const notes=JSON.parse(await fs.readFile(path.join(BUILD,'notes.json')));
const iconDir=path.resolve(ROOT,'../../foundation/design-v2/assets');
const records=[],usedAssets=new Set(),pending=[];
const box=(left,top,width,height)=>({left,top,width,height});
function tx(s,v,x,y,w,h,size=28,bold=false,color=C.ink){return text(s,v,box(x,y,w,h),{size,bold,color});}
function page(n,title,foot='',bg=C.background){const s=p.slides.add();s.background.fill=bg;if(title)tx(s,title,64,50,1152,140,48,true);if(foot)tx(s,foot,64,663,1149,44,17,false,C.muted);s.speakerNotes.textFrame.setText(notes[n-1].text+'\n\n来源：\n'+notes[n-1].sources.join('\n'));records.push({slide:n,title});return s;}
async function asset(s,role,file,x,y,w,h,alt,fit='contain',crop=undefined){
 try{let bytes=await fs.readFile(file);const sourceHash=sha(bytes);if(crop){const meta=await sharp(bytes).metadata();const left=Math.round(meta.width*crop.left),top=Math.round(meta.height*crop.top),width=Math.round(meta.width*(1-crop.left-crop.right)),height=Math.round(meta.height*(1-crop.top-crop.bottom));bytes=await sharp(bytes).extract({left,top,width,height}).png().toBuffer();await fs.writeFile(path.join(BUILD,role+'-crop.png'),bytes);}const hash=sha(bytes);if(usedAssets.has(hash))throw Error('Image reused: '+file);usedAssets.add(hash);image(s,{bytes,alt},box(x,y,w,h),fit);records.at(-1).assets??=[];records.at(-1).assets.push({role,path:file,sha256:hash,sourceHash,alt,crop});s.speakerNotes.textFrame.setText(notes[records.at(-1).slide-1].text+'\n\n来源：\n'+notes[records.at(-1).slide-1].sources.join('\n')+'\n图片：'+records.at(-1).assets.map(a=>a.path+'。'+a.alt).join('\n'));}catch(e){if(!draft)throw e;pending.push({role,file});tx(s,'产品概念图待接入',x,y+h/2-20,w,50,28,false,C.muted);}
}
async function ico(s,name,x,y,size=38){await tabler(s,path.join(iconDir,name+'.svg'),box(x,y,size,size),C.ink);}
// Native lines only within explicitly requested process, attribution and scope diagrams.
function line(s,x,y,w,h=1,color=C.line){s.shapes.add({geometry:'rect',position:box(x,y,w,h),fill:color,line:{fill:'none',width:0}});}
{
 const s=page(1,'','马来西亚起步 · 方案阶段 · 2026.09');
 tx(s,'Wringy',64,70,520,115,82,true);tx(s,'从品牌合作起步的\n东南亚创作者商业平台',64,221,540,150,43,true);
 tx(s,'拟从 Creator Rewards 起步，\n让品牌与创作者在同一处\n推进内容合作。',67,417,530,135,27);
 await asset(s,'coverPhoto',path.join(ROOT,'assets/creator-studio.png'),651,82,565,424,'AI生成概念场景，非真实客户或团队');
 tx(s,'概念场景，非真实客户',655,521,550,40,18,false,C.muted);tx(s,'wringy.com',68,593,490,36,22,false,C.muted);
}
{
 const s=page(2,'内容合作中的反复核对','问题假设，尚待客户访谈验证');
 await ico(s,'inbox',64,235,45);tx(s,'品牌',124,231,425,55,32,true);tx(s,'作品交齐了吗？\n哪里还需要修改？',64,320,510,134,37);
 await ico(s,'users',699,235,45);tx(s,'创作者',759,231,440,55,32,true);tx(s,'这条内容合格了吗？\n报酬何时支付？',699,320,510,134,37);
 tx(s,'当要求、作品和付款记录分散在聊天与表格中，\n双方要反复核对同一件事。',64,542,1130,99,28);
}
{
 const s=page(3,'Creator Rewards：同一份合作记录','首发方向讨论稿 · 具体奖励规则待定 · 产品概念，非上线能力');
 tx(s,'让品牌与创作者\n知道下一步',64,213,475,106,32,true);
 tx(s,'品牌发布活动，说明\n内容要求与奖励条件。',64,336,365,112,29);tx(s,'创作者提交作品，查看\n审核结果与报酬状态。',64,485,365,105,29);
 tx(s,'产品概念 · 模拟内容',64,605,460,35,21,true,C.muted);
 await asset(s,'activityConcept',path.resolve(ROOT,'../../foundation/design-v3/assets/deck-activity-focus.png'),560,170,650,480,'原创Wringy活动要求概念聚焦图，模拟内容');
}
{
 const s=page(4,'产品演示合作示例','示例流程 · 邀请制与固定按帖奖励尚未批准 · 照片为概念场景，非真实客户');
 await asset(s,'campaignPhoto',path.join(ROOT,'assets/bottle-craft-detail.png'),64,219,414,311,'AI生成产品演示概念，非真实客户');
 tx(s,'先确认作品与规则，发布后再核对奖励与实际付款。',64,548,450,82,25);
 const progress=[['提交预览作品','作品内容和规则先说清楚'],['发布前审核','按反馈修改，再进入发布步骤'],['提交发布链接','创作者发布后提供对应证据'],['最终审核与奖励资格','确认资格不等于已经付款'],['核对实际付款结果','以实际付款记录为准']];
 progress.forEach(([title,detail],i)=>{tx(s,String(i+1).padStart(2,'0'),572,204+i*85,52,41,26,true);tx(s,title,640,201+i*85,573,46,28,true);tx(s,detail,640,246+i*85,574,37,21,false,C.muted);});

}
{
 const s=page(5,'下一次合作，有记录可依','产品判断 · 复购与运营效果尚待验证 · 产品概念');
 tx(s,'先围绕具体内容需求\n组织合作。',854,201,360,92,27);
 await asset(s,'recordConcept',path.resolve(ROOT,'../../foundation/design-v3/assets/deck-review-focus.png'),64,170,720,475,'原创Wringy审核记录概念聚焦图，模拟内容');
 tx(s,'留存此前的约定',854,320,358,47,29,true);tx(s,'交付要求\n审核结果\n报酬状态',854,394,358,145,30);tx(s,'以重复合作积累经营关系。',854,568,362,68,23);
}
{
 const s=page(6,'活动服务费与创作者报酬','建议模式 · 定价尚待采购验证 · 图示为经济归属，资金路径未定');
 tx(s,'品牌的活动支出',64,221,460,60,34,true);
 line(s,91,319,1105,1);line(s,361,319,1,38);line(s,952,319,1,38);
 tx(s,'活动服务费',64,393,520,55,36,true);tx(s,'拟向品牌按活动收费，\n创作者不另付平台服务费。',64,464,525,95,27);
 tx(s,'创作者报酬',704,393,510,55,36,true);tx(s,'归创作者，支付路径待定。\n不计入 Wringy 收入。',704,464,510,95,27);
 tx(s,'活动服务收入 − 审核、支持及支付等直接成本 ＝ 单场贡献',64,592,1150,49,25,true);
}
{
 const s=page(7,'视频正成为电商的交易入口','来源：Google／Temasek／Bain，2025年估算。电商规模是市场背景，不等于Wringy收入空间。');
 tx(s,'25%',64,212,553,119,92,true);tx(s,'东南亚视频电商占电商交易额',67,346,642,47,27);
 marketChart(s,C,box(57,413,735,176));
 tx(s,'75%为100%−25%的图表余项',67,605,715,35,19,false,C.muted);
 tx(s,'US$200亿',856,230,361,87,53,true);tx(s,'马来西亚全部电商\n2025年交易额估算',859,335,350,97,27);tx(s,'从马来西亚品牌合作切入，\n寻找持续采购的客户。',859,499,355,129,24);
}
{
 const s=page(8,'完整创作者商业平台的扩展方向','扩展方向讨论稿 · 客户数量、采购频次与定价尚待验证');
 tx(s,'拟议第一步',64,220,365,42,24,false,C.muted);tx(s,'Creator\nRewards',64,277,365,140,46,true);tx(s,'品牌需求与创作者内容',64,449,365,48,26);
 line(s,450,287,1,252);
 tx(s,'长期方向',506,218,650,45,26,true);
 const capabilities=[['店铺与数字产品','file-text'],['会员与内容交付','list-check'],['交易及日常经营','adjustments-horizontal']];
 for(let i=0;i<capabilities.length;i++){await ico(s,capabilities[i][1],510,291+i*72,33);tx(s,capabilities[i][0],565,286+i*72,616,47,28);}
 tx(s,'逐步进入更多东南亚市场',506,521,696,45,27);
 tx(s,'首发服务收入空间：付费品牌数 × 年采购活动数 × 每场服务费',64,593,1150,45,25,true);
}
{
 const s=page(9,'创始人主导，Belcort开发','执行安排 · 具体资源与交付协议待落实');
 tx(s,'Wringy',64,254,490,75,54,true);tx(s,'定义产品，招募品牌与创作者，\n负责合作运营及验收。',64,378,535,115,29);
 tx(s,'Belcort',711,254,505,75,54,true);tx(s,'技术评估、开发、测试和交接，\n以及拟约定的维护。',711,378,505,115,29);
 tx(s,'Belcort为创始人自有公司。Wringy不自聘工程团队。',64,569,1151,65,29,true);
}
{
 const s=page(10,'18个月零收入规划：RM576,150','零收入规划情景，非正式融资额或Belcort报价；税费与交易成本待补。');
 tx(s,'基准资金规划（MYR）',64,211,768,41,23,false,C.muted);
 budgetChart(s,C,box(46,265,807,336));
 tx(s,'前4个月建设\n随后14个月运营',904,217,311,102,29,true);
 tx(s,'融资金额与结构\n另行确定',904,333,311,85,26,true);
 tx(s,'计划换来的成果',904,445,311,46,25,true);tx(s,'完成首版、开展付费合作，\n验证复购与履约成本。',904,503,312,110,23);
 tx(s,'期待与投资伙伴共同推进马来西亚首发。',64,609,1150,44,25);
}
await fs.mkdir(path.join(BUILD,'draft-renders'),{recursive:true});
await fs.writeFile(path.join(BUILD,'records.json'),JSON.stringify({tokenSource,tokenHash,draft,pending,slides:records,budgetTotal:BUDGET_TOTAL},null,2));
const out=path.join(BUILD,draft?'candidate-draft.pptx':'candidate.pptx');await(await PresentationFile.exportPptx(p)).save(out);console.log('Exported',out);
for(let i=0;i<10;i++){const bytes=await p.export({slide:p.slides.items[i],format:'png',scale:1});await fs.writeFile(path.join(BUILD,'draft-renders',`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await bytes.arrayBuffer()));console.log('Draft rendered',i+1);}
console.log(JSON.stringify({pending,tokenSource}));

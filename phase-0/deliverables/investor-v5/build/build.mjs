import sharp from 'sharp';
import {fs,path,Presentation,PresentationFile,ROOT,BUILD,sha} from './runtime.mjs';
import {text,image,tabler} from './primitives.mjs';
import {marketChart,budgetChart,BUDGET_TOTAL,MARKET} from './evidence.mjs';
const canonical=path.resolve(ROOT,'../../foundation/design-v3/tokens.json'),raw=await fs.readFile(canonical),c=JSON.parse(raw).colors;
const C={background:c.canvas,surface:c.surface,ink:c.ink,accent:c.citron,forest:c.forest,muted:c.secondary,line:c.line};
const p=Presentation.create({slideSize:{width:1280,height:720}}),records=[],notes=[];
const box=(left,top,width,height)=>({left,top,width,height});
const tx=(s,v,x,y,w,h,size=28,bold=false,color=C.ink)=>text(s,v,box(x,y,w,h),{size,bold,color});
function page(n,title,foot,note,sources=[]){const s=p.slides.add();s.background.fill=C.background;if(title)tx(s,title,64,50,1152,126,48,true);tx(s,foot,64,661,1149,45,17,false,C.muted);notes.push({slide:n,text:note,sources});s.speakerNotes.textFrame.setText(note+'\n\n来源：\n'+sources.join('\n'));records.push({slide:n,title});return s;}
function line(s,x,y,w,h=2,color=C.line){s.shapes.add({geometry:'rect',position:box(x,y,w,h),fill:color,line:{fill:'none',width:0}});}
async function photo(s,file,x,y,w,h,alt){image(s,{bytes:await sharp(await fs.readFile(file)).png().toBuffer(),alt},box(x,y,w,h),'contain');notes.at(-1).sources.push(file);s.speakerNotes.textFrame.setText(notes.at(-1).text+'\n来源：\n'+notes.at(-1).sources.join('\n'));}
async function ico(s,name,x,y,size=34){await tabler(s,path.resolve(ROOT,'../../foundation/design-v2/assets',name+'.svg'),box(x,y,size,size),C.ink);}
const framing='phase-0/foundation/business-model-v2.md';
{
const s=page(1,'','马来西亚起步 · 商业方案讨论稿 · 2026.09','Wringy定位为按效果付费的创作者分发网络。首先以Creator Rewards连接品牌预算与创作者合格内容成果。此为商业叙事，不代表产品已上线。',[framing]);
tx(s,'Wringy',64,70,530,115,82,true);tx(s,'按效果付费的\n创作者分发网络',64,222,550,142,46,true);tx(s,'品牌设定预算与目标。\n创作者传播内容，按合格成果获酬。',67,427,550,115,27);
await photo(s,path.resolve(ROOT,'../investor-v4/assets/creator-studio.png'),666,82,550,423,'AI生成概念场景，非真实客户');tx(s,'概念场景，非真实客户',670,522,530,35,18,false,C.muted);tx(s,'wringy.com',68,593,490,36,22,false,C.muted);
}
{
const s=page(2,'品牌需要分发，创作者需要收入','问题假设 · 需求强度、采购意愿与创作者收益尚待验证','以下是需要访谈与付费试点验证的问题假设，不是客户原话、调研结论或已验证牵引力。',[framing]);
tx(s,'品牌／商家／主播',64,226,565,52,33,true);tx(s,'有产品与原始内容，\n如何持续触达合适受众？',64,318,550,120,36);tx(s,'要验证：是否愿意为\n可核验的内容传播持续采购。',64,504,540,104,27);
tx(s,'创作者／剪辑者',706,226,510,52,33,true);tx(s,'会制作和传播内容，\n如何获得明确的赚钱机会？',706,318,510,120,36);tx(s,'要验证：奖励能否覆盖投入，\n并吸引创作者持续参与。',706,504,510,104,27);
}
{
const s=page(3,'Wringy 的业务与经济流','拟议模式 · 合格播放不等于销售 · 规则与数据可得性待验证','品牌设置预算、目标与限制。Wringy负责匹配、成果核验及结算记录。创作者制作传播内容，按核准成果获得奖励。图示为经济归属，不表示托管、代收或具体付款路径。',[framing]);
const xs=[64,482,900],ws=[330,330,316];
for(let i=0;i<3;i++)await ico(s,['inbox','adjustments-horizontal','users'][i],xs[i]+5,168,32);
['品牌／商家／主播','Wringy','创作者／剪辑者'].forEach((v,i)=>tx(s,v,xs[i],210,ws[i],55,34,true));
['奖励预算与目标\n受众、内容与期限限制','匹配创作者\n核验合格播放／约定成果\n形成结算记录','剪辑或制作内容\n发布到约定渠道\n获得核准奖励'].forEach((v,i)=>tx(s,v,xs[i],300,ws[i],161,26));
line(s,398,324,69);tx(s,'›',431,287,42,65,48,true);line(s,816,324,68);tx(s,'›',848,287,42,65,48,true);
line(s,64,491,1152);tx(s,'品牌活动支出',64,531,316,45,27,true);tx(s,'=',401,527,54,54,36,true);tx(s,'+',832,527,54,54,36,true);tx(s,'平台费',483,521,316,48,33,true);tx(s,'核准创作者奖励 × 费率',483,575,358,43,24);tx(s,'创作者奖励',900,521,316,48,33,true);tx(s,'按核准成果计算',900,575,316,43,24);
}
{
const s=page(4,'马来西亚商家的剪辑推广活动','假设示例 · Shopee／TikTok 为店铺或发布渠道示例，非合作伙伴或已接入能力','虚构马来西亚商家拥有Shopee或TikTok店铺，提供自己已授权的直播或视频素材。Clipfarming指多人剪辑并分发原始内容。示例费率RM5/1000合格播放，个人50000合格播放可得RM250，须在活动与个人上限内。合格播放指约定期间、受众、内容规则内且排除重复及作弊的播放。合格播放不等于销售，数据接口和规则可执行性尚待验证。',[framing]);
const rows=[['商家提供授权素材','自有直播／产品视频，说明店铺与推广目标'],['创作者剪辑并发布','多人制作不同片段，面向约定受众传播'],['核验合格播放','按期间、受众与内容规则，排除重复和作弊'],['按成果计算奖励','每 1,000 次合格播放 RM5（示例费率）']];rows.forEach(([a,b],i)=>{tx(s,String(i+1).padStart(2,'0'),64,199+i*96,70,48,31,true);tx(s,a,151,197+i*96,1060,49,31,true);tx(s,b,151,246+i*96,1050,42,24,false,C.muted);});
tx(s,'个人示例：50,000 次合格播放 = RM250 奖励（须在限额内）',64,603,1152,43,26,true);
}
{
const s=page(5,'真实机制：TJR 剪辑奖励活动','来源：Reach 托管的 Whop 活动页与 TJR 规则页，2026-09-10核查 · 非经审计回报证明','活动标题为TJR $23,100 Weekly Clipping Campaign，由Reach组织并托管在Whop。活动标示$1/1K views，平台包括TikTok、Instagram、YouTube。组织者规则要求最低5000播放及至少50%英语目标国家受众，不允许操纵播放。金额为美元。动态花费与总播放数未采用。本页证明机制存在，不代表Wringy客户或合作关系，也不证明经审计投资回报。',['https://b4e0vdqv6zgqeqj4pfgm.apps.whop.com/discover/820b27b6-33e6-4b89-973b-c19865a3bf80','https://reachclipping.com/TJR']);
await photo(s,path.join(ROOT,'assets/tjr-original.jpg'),64,202,550,309,'Reach公开TJR活动原始宣传图；图示23000与活动页标题23100不同');
notes.at(-1).sources.push('https://pub-5d81aca719874567bd04db2d865626a0.r2.dev/TJR/thumb-mtbtb6f8-as94y1.jpg');notes.at(-1).text+=' 原始宣传图写$23000，活动页标题写$23100，保留原图并列示差异，不将预算金额用于回报计算。';s.speakerNotes.textFrame.setText(notes.at(-1).text+'\n来源：\n'+notes.at(-1).sources.join('\n'));
tx(s,'原图金额$23,000，活动页标题$23,100',64,522,565,35,18,false,C.muted);
tx(s,'TJR $23,100 Weekly\nClipping Campaign',669,204,547,99,32,true);tx(s,'$1 / 1K views',669,332,547,66,44,true);tx(s,'TikTok、Instagram、YouTube',669,419,547,46,25);tx(s,'受众门槛与反作弊规则',669,488,547,46,27,true);
line(s,64,565,1152);tx(s,'原始内容',64,591,226,45,27,true);tx(s,'多人剪辑发布',354,591,256,45,27,true);tx(s,'核验合格播放',669,591,258,45,27,true);tx(s,'计算奖励',1000,591,216,45,27,true);
}
{
const s=page(6,'单场收入：奖励之外收取平台费','纯示例，非定价承诺 · 15%按核准奖励另计 · 未赚取预算不计平台收入','纯算例：创作者奖励预算RM10000，示例单价RM5/1000合格播放，2000000合格播放使预算全部赚取。平台费=核准奖励10000×15%=1500，由品牌在奖励之外承担。品牌总支出11500，创作者所得10000，Wringy平台收入1500。费率未定，未赚取预算不计收入，未承诺托管或付款方式。',[framing]);
tx(s,'奖励预算 RM10,000 全部赚取的情景',64,206,1152,50,30,true);tx(s,'200万次合格播放 × RM5／千次 = RM10,000 奖励',64,273,1152,51,27);
[['品牌总支出（未计税）','RM11,500'],['创作者所得','RM10,000'],['Wringy 收入','RM1,500']].forEach(([a,b],i)=>{let x=64+i*403;tx(s,a,x,382,350,46,28);tx(s,b,x,445,375,83,53,true);});
tx(s,'平台费 = 核准奖励 RM10,000 × 15% = RM1,500',64,584,1152,50,29,true);
}
{
const s=page(7,'单场贡献：平台收入减直接成本','纯示例 · 单场贡献未扣固定经营费用，不等于净利润','示例直接变动成本RM600，包含实际承担的审核、支持、数据、支付与异常损失等全部变动成本，未验证且不是供应商报价。收入1500−600=900单场贡献。固定经营成本未扣除。敏感性：成本600/1200/1500对应贡献900/300/0。漏检作弊可能造成无效奖励及争议损失，严格核验也增加成本。不得将600再次作为固定预算中的同笔支出重复计入。',[framing]);
[['平台收入','RM1,500'],['变动成本','− RM600'],['单场贡献','RM900']].forEach(([a,b],i)=>{let x=64+i*403;tx(s,a,x,227,350,45,28);tx(s,b,x,294,375,83,55,true);});
tx(s,'成本敏感性',64,429,350,46,29,true);tx(s,'成本 RM600 / RM1,200 / RM1,500',64,498,632,47,28);tx(s,'贡献 RM900 / RM300 / RM0',64,556,632,47,28);
tx(s,'盈利取决于',851,428,365,46,29,true);tx(s,'核验、支持、计量、支付\n及异常损失的合计成本。',851,497,365,103,26);
}
{
const s=page(8,'复购品牌与持续参与的创作者','增长假设 · 尚无经核验复购、留存或规模化数据','假设品牌获得可核验的合格分发后重复采购，创作者在收益合理时持续参与。试点测量品牌复购率、每月活动数、活跃创作者与次月参与率、核准奖励、每千次合格播放总成本、审核成本和作弊／争议损失。不声称网络效应已经成立。',[framing]);
tx(s,'品牌需求',64,221,544,48,34,true);tx(s,'如果合格分发值得采购，\n品牌会重复开活动。',64,309,544,110,31);tx(s,'观察：复购率、月活动数、\n每千次合格播放总成本。',64,484,544,112,27);
tx(s,'创作者供给',710,221,506,48,34,true);tx(s,'如果收入覆盖创作投入，\n创作者会再次参与。',710,309,506,110,31);tx(s,'观察：活跃人数、次月参与率、\n人均核准奖励与审核成本。',710,484,506,112,27);
}
{
const s=page(9,'视频电商的市场背景','来源：Google／Temasek／Bain，2025年估算 · 两项地域口径不同，不相乘，非Wringy收入空间','2025年估算东南亚视频电商占电商交易额25%，75%为算术余项。马来西亚全部电商GMV估算US$20 billion=US$200亿。两项不可相乘，也不是创作者奖励市场或Wringy收入空间。',[MARKET.regionalSource,MARKET.malaysiaSource]);
tx(s,'25%',64,212,553,119,92,true);tx(s,'东南亚视频电商占电商交易额',67,346,700,47,27);marketChart(s,C,box(57,413,735,176));tx(s,'75%为100%−25%的图表余项',67,605,715,35,19,false,C.muted);tx(s,'US$200亿',856,230,361,87,53,true);tx(s,'马来西亚全部电商\n2025年交易额估算',859,335,350,97,27);tx(s,'马来西亚是拟议起点，\n品牌需求仍须付费试点验证。',859,499,355,129,24);
}
{
const s=page(10,'收入规模的算式','数学情景，非预测 · 需求与4亿次播放供给未验证 · 成本随规模另测','月平台收入=活跃付费品牌数×每品牌每月活动数×每场核准奖励×费率。示例100×2×10000×15%=300000MYR。对应200场/月、2000000MYR核准奖励，按RM5/1000需400000000合格播放/月。这些规模和数据可得性完全未验证。仅计算Rewards平台服务收入，不是利润，未加入未来商业工具费用。成本随规模另测，不假设RM600在200场时仍成立。',[framing]);
const f=[['活跃品牌','100'],['月活动／品牌','× 2'],['核准奖励／场','× RM10,000'],['平台费率','× 15%']];f.forEach(([a,b],i)=>{const x=64+i*291;tx(s,a,x,225,275,45,24);tx(s,b,x,299,285,72,i===2?36:52,true);});
line(s,64,407,1152);tx(s,'RM300,000／月',64,451,865,103,69,true);tx(s,'示例平台服务收入',67,573,650,43,28);tx(s,'每月200场活动\nRM200万核准奖励\n4亿次合格播放',891,469,325,123,24);
}
{
const s=page(11,'第一阶段 Rewards，随后扩展商业工具','后续均为收入假设 · 上线范围、收费及支付能力未定 · 不把交易额计作平台收入','第一阶段拟以按合格成果奖励的Creator Rewards验证品牌付费与创作者供给。未来参考Whop式完整商业平台：支付及交易服务、店铺和数字产品、课程与会员。候选收入杠杆为交易服务费、订阅、工具服务费。均非已上线能力、承诺路线图或已验证收入。对同一交易仅按最终约定费用确认收入，不叠加重复计算。',['https://whop.com/',framing]);
tx(s,'第一阶段',64,212,345,43,25,false,C.muted);tx(s,'Creator\nRewards',64,278,357,135,48,true);tx(s,'合格成果奖励\n按核准奖励比例收费',64,460,358,102,28);line(s,452,222,2,368);
tx(s,'未来 Whop 式商业平台',510,208,706,49,32,true);const a=[['支付与交易服务','可能收取净交易服务费','external-link'],['店铺与数字产品','可能收取订阅或工具服务费','inbox'],['课程与内容交付','可能收取工具或交易服务费','file-text'],['会员经营','可能收取订阅或交易服务费','users']];for(let i=0;i<a.length;i++){const [u,v,icon]=a[i];await ico(s,icon,510,288+i*82,32);tx(s,u,562,280+i*82,654,43,27,true);tx(s,v,562,325+i*82,654,37,22,false,C.muted);}notes.at(-1).sources.push('phase-0/foundation/design-v2/assets/ (Tabler Icons, MIT)');

}
{
const s=page(12,'资金规划参考：RM576,150','原按帖方案预算锚点；按播放计酬需重新估价 · 非正式融资额或报价，税费与交易成本待补','保留历史固定获批帖MVP的18个月零收入基准：189750开发含预备金+216000商业运营18个月+70000上线后技术14个月+50000获客启动+50400非开发15%缓冲=576150。前4个月建设、后14个月运营。此预算不是按播放/KPI计酬方案的有效报价。新增数据接入、合格判断、反作弊、奖励重算等须重新估价。完整Whop扩展未包含。融资金额与结构另定。',['phase-0/foundation/belcort-handoff-v1.md',framing]);
tx(s,'原按帖方案 · 18个月零收入规划（MYR）',64,211,785,41,23,false,C.muted);budgetChart(s,C,box(46,265,807,336));tx(s,'原方案：',904,217,311,45,27,true);tx(s,'4个月建设\n14个月上线后运营',904,271,311,97,26);tx(s,'新模式须重估',904,405,311,45,28,true);tx(s,'数据与合格判断\n反作弊与奖励重算',904,463,311,105,25);tx(s,'完整商业平台扩展另计，融资金额与结构待重新核定。',64,609,1150,44,25);
}
notes[2].sources.push('phase-0/foundation/design-v2/assets/ (Tabler Icons, MIT)');
for(let i=0;i<notes.length;i++)p.slides.items[i].speakerNotes.textFrame.setText(notes[i].text+'\n\n来源：\n'+notes[i].sources.join('\n'));
await fs.mkdir(path.join(BUILD,'draft-renders'),{recursive:true});
await fs.writeFile(path.join(BUILD,'notes.json'),JSON.stringify(notes,null,2));
await fs.writeFile(path.join(BUILD,'records.json'),JSON.stringify({tokenSource:canonical,tokenHash:sha(raw),slides:records,budgetTotal:BUDGET_TOTAL},null,2));
await fs.writeFile(path.join(ROOT,'story.md'),'# Wringy 投资讨论稿 v5\n\n仅调整投资叙事，不更改冻结PRD。以主任务业务口径为准。\n\n'+notes.map((n,i)=>`## ${i+1}. ${records[i].title||'Wringy'}\n\n${n.text}\n\n来源：${n.sources.join('\n')}\n`).join('\n'));
await(await PresentationFile.exportPptx(p)).save(path.join(BUILD,'candidate.pptx'));
for(let i=0;i<12;i++){const b=await p.export({slide:p.slides.items[i],format:'png',scale:1});await fs.writeFile(path.join(BUILD,'draft-renders',`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await b.arrayBuffer()));console.log('Rendered draft',i+1);}

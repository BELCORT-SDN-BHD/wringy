import {fs,path,Presentation,PresentationFile,ROOT,BUILD,FONT,applyPresentationChartFont} from './runtime.mjs';
import {cover,business,product} from './approved-pages.mjs';
import {loadFinance,fillMonthlyProfit,fillCashPayback} from './finance.mjs';
import {finish} from './export.mjs';
const tokenPath=path.resolve(ROOT,'../../foundation/design-v3/tokens.json');const c=JSON.parse(await fs.readFile(tokenPath,'utf8')).colors;
const C={...c,background:c.canvas,accent:c.citron,muted:c.secondary};
const model=await loadFinance(fs,path,ROOT),u=model.results.unit;
const p=Presentation.create({slideSize:{width:1280,height:720}}),records=[];
const bytes=new Uint8Array(await fs.readFile(path.join(ROOT,'assets/cover-hero.png')));
const box=(left,top,width,height)=>({left,top,width,height});
const fmt=n=>new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(n);
function tx(s,v,x,y,w,h,size=28,bold=false,color=C.ink){const a=s.shapes.add({geometry:'textbox',name:v,position:box(x,y,w,h),fill:'none',line:{fill:'none',width:0}});a.text=v;a.text.style={typeface:FONT,fontSize:size,bold,color,autoFit:'none',verticalAlignment:'top'};return a;}
function shape(s,name,x,y,w,h,fill=C.canvas){return s.shapes.add({name,geometry:'rect',position:box(x,y,w,h),fill,line:{fill:'none',width:0}});}
function line(s,x,y,w,h=2,color=C.line){return shape(s,'divider',x,y,w,h,color);}
function arrow(s,a,b,kind='straight'){return s.shapes.connect(a,b,{kind,fromSide:'right',toSide:'left',line:{fill:C.ink,width:2},tail:{type:'arrow',width:'med',length:'med'}});}
function page(note,sources=[]){const s=p.slides.add();s.background.fill=C.canvas;const n=p.slides.items.length;const all=['phase-0/foundation/angel-story-v1.md',...sources];s.speakerNotes.textFrame.setText(note+'\n来源：\n'+all.join('\n'));records.push({slide:n,note,sources:all});return s;}
function title(s,v,sub=''){tx(s,v,52,39,1176,85,51,true);if(sub)tx(s,sub,56,133,1166,43,25,false,C.secondary);}
function foot(s,v){tx(s,v,54,670,1173,37,18,false,C.secondary);}
async function image(s,name,x,y,w,h,fit='contain'){const f=path.join(ROOT,'assets',name);try{const b=await fs.readFile(f);s.images.add({blob:new Uint8Array(b),contentType:'image/png',alt:'Wringy 生成概念插画，非真实客户或已上线产品',position:box(x,y,w,h),fit});}catch(e){if(e.code!=='ENOENT'||!process.argv.includes('--draft'))throw e;tx(s,'主视觉待接入',x+30,y+30,w-60,50,28,false,C.secondary);}}
function table(s,values,x,y,width,rowH,colWidths,{font=25,boldRows=[0]}={}){const t=s.tables.add({rows:values.length,columns:values[0].length,left:x,top:y,width,height:rowH*values.length,columnWidths:colWidths,values});t.styleOptions={headerRow:false,bandedRows:false};t.borders.assign({fill:C.line,width:.5});for(let r=0;r<values.length;r++){t.rows[r].height=rowH;for(let j=0;j<values[0].length;j++){const cell=t.getCell(r,j);cell.fill=r===0?C.surface:C.canvas;cell.text.style={typeface:FONT,fontSize:font,bold:boldRows.includes(r),color:C.ink,autoFit:'none'};}}return t;}
const ctx={page,bytes,box,tx,C,shape,arrow,ROOT};
const businessSrc='phase-0/foundation/business-model-v2.md',reviewSrc='phase-0/foundation/review-design-v1.md';
// 1: preserve accepted cover and add discussion status.
cover(ctx);tx(p.slides.items[0],'天使轮讨论稿',55,44,390,38,22,false,C.secondary);
// 2: image-led problem hypothesis.
{
 const s=page('待验证痛点假设，非访谈原话或真实客户证据。品牌有授权内容时仍需协调素材、多人发布及结果。创作者需要任务、计酬规则与进度。',[businessSrc]);
 title(s,'品牌需要内容分发，创作者需要收入机会');
 await image(s,'problem-distribution.png',456,159,824,487);tx(s,'授权原始素材',504,609,344,38,23,true);tx(s,'多条短视频',956,609,270,38,23,true);
 tx(s,'品牌',56,223,340,59,39,true);tx(s,'协调素材与多人发布\n核对每次传播的结果',56,299,384,105,29);
 tx(s,'创作者',56,463,350,59,39,true);tx(s,'知道做什么、怎么算钱\n以及奖励到了哪一步',56,538,398,104,28);
 foot(s,'待验证痛点假设；生成概念图，非真实客户。');
}
// 3: editable data graphic, regional context only.
{
 const sources=['https://blog.google/company-news/inside-google/around-the-globe/google-asia/sea-economy-2025/','https://blog.google/intl/ms-my/company-news/around-the-globe/2025_11_e-conomy-sea-report-2025-malaysias/'];
 const s=page('2025年估算：视频电商占东南亚电商交易额25%。其他75%为算术余项。马来西亚全部电商GMV约US$20 billion，即US$200亿。两项地域与分母不同，不相乘，不是Wringy可获得市场或收入。',sources);
 title(s,'短视频正在成为商业渠道','2025 年东南亚视频电商背景');
 tx(s,'25%',55,206,663,178,137,true);tx(s,'2025 年估算',469,286,325,55,29,false,C.secondary);tx(s,'东南亚电商交易额来自视频电商',61,401,705,48,28);
 const chart=s.charts.add('bar',{position:box(48,474,738,123),categories:['2025'],series:[{name:'视频电商',values:[.25],fill:C.citron,valuesFormatCode:'0%'},{name:'其他电商',values:[.75],fill:C.line,valuesFormatCode:'0%'}],barOptions:{direction:'bar',grouping:'stacked',overlap:100,gapWidth:35},hasLegend:false,xAxis:{visible:false,tickLabelPosition:'none',line:{fill:'none',width:0},majorGridlines:null},yAxis:{visible:false,min:0,max:1,tickLabelPosition:'none',line:{fill:'none',width:0}},dataLabels:{showValue:true,position:'center',textStyle:{typeface:FONT,fontSize:28,fill:C.ink,bold:true}},chartFill:'none',chartLine:{fill:'none',width:0},plotAreaFill:'none',plotAreaLine:{fill:'none',width:0}});applyPresentationChartFont(chart,{fontFamily:FONT});
 tx(s,'视频电商 25%',64,607,348,41,23,true);tx(s,'其他电商 75%',412,607,350,41,23,false,C.secondary);tx(s,'200亿美元',843,244,385,85,52,true);tx(s,'马来西亚全部电商\n2025 年交易额估算',860,353,355,99,27);tx(s,'本地付费需求\n仍需实际试点验证',860,512,350,99,27,true);
 foot(s,'Google / Temasek / Bain，2025；地域口径不同，不相乘，非 Wringy 收入空间。');
}
// 4 and 5: accepted business / product.
business(ctx);await product(ctx);
// 6: editable substantive proportional cost breakdown.
{
 const s=page('统一说明算例。RM10,000已确认奖励外加15%服务费为RM1,500收入。减变动履约600和活动佣金150，贡献750。贡献未扣固定成本和独立品牌获客费；15%是外加服务费率，非毛利率。',model.sources);
 title(s,'每场活动如何产生收入','RM10,000 已确认创作者奖励，另加假设 15% 平台费');
 tx(s,'RM1,500',54,216,691,115,87,true);tx(s,'平台服务收入',59,341,699,48,30);
 tx(s,'RM750',892,229,336,91,63,true);tx(s,'单场贡献',896,337,330,48,31,true);
 tx(s,'收入分配（RM）',57,398,460,37,23,false,C.secondary);const totalW=1168,x=56,y=444;const vals=[u.variableFulfillment,u.campaignCommission,u.contribution],labels=['变动履约','推广佣金支出','单场贡献'],fills=[C.line,C.secondary,C.citron];let pos=x;
 vals.forEach((v,i)=>{const w=totalW*v/u.revenue;shape(s,labels[i],pos,y,w-4,88,fills[i]);tx(s,fmt(v),pos+10,y+20,w-16,52,i===1?28:34,true,i===1?C.canvas:C.ink);tx(s,labels[i],pos+(i===1?-34:i===2?30:0),y+109,i===1?190:w-25,44,i===1?22:27,true);pos+=w;});
 foot(s,'说明假设。贡献未扣固定费与独立品牌获客费；15% 为奖励外加服务费率，并非毛利率。');
}
// 7: initial customer selection and launch stages.
{
 const s=page('马来西亚首发客户群仍是提案，未确定首批客户。候选商家或内容品牌有已获授权素材及持续推广需求。先聚焦单一垂直客户群，以人工辅助付费试点验证交付与复购。',[businessSrc]);
 title(s,'从马来西亚的一个客户群体开始');
 tx(s,'已有授权素材\n持续需要推广',55,200,704,159,59,true);tx(s,'候选：商家或内容品牌',59,385,725,52,30);tx(s,'首批垂直群体\n尚未选定',900,238,329,113,34,true);
 const labels=['聚焦一个客群','人工辅助付费试点','检查交付与复购'];const xs=[56,465,873];const nodes=xs.map((x,i)=>shape(s,labels[i],x,514,i===2?351:344,95,i===1?C.citron:C.surface));nodes.forEach((n,i)=>tx(s,labels[i],xs[i]+17,539,325,48,i===1?28:30,true));arrow(s,nodes[0],nodes[1]);arrow(s,nodes[1],nodes[2]);
 foot(s,'首发策略假设，非已确认客户、订单或已落地国家。');
}
// 8: neutral alternatives, no unsupported rankings.
{
 const s=page('组织方式的概括，不是逐项功能审计或费用比较。Whop/Content Rewards为已有平台方案；代理商和自行协调存在不同约定方式。Wringy方案尚未上线，拟从本地客户开发与服务流程切入，支付和数据待验证。地域本身不是壁垒。',['phase-0/research/angel-deck-v1/claims.md','https://docs.whop.com/memberships-and-access/third-party-apps/content-rewards','https://docs.whop.com/developer/guides/accept-payments','https://contentrewards.com/','https://gushcloud.com/','https://www.hexafood.com/articles-blogs/hexa-tiktok-affiliate-milestone-campaign-2026/','https://www.partipost.com/']);
 title(s,'客户还有哪些选择');
 const rows=[['Whop / Content Rewards','已有国际业务与内容奖励方案'],['代理服务（如 Gushcloud）','按服务约定组织创作与交付'],['活动平台（如 Partipost）','自助活动创建与专家服务'],['品牌自行协调','沟通、收集证据并核对结果']];
 tx(s,'选择',58,165,495,43,25,true,C.secondary);tx(s,'组织方式',563,165,661,43,25,true,C.secondary);line(s,56,213,1168);
 rows.forEach(([a,b],i)=>{const y=229+i*71;tx(s,a,58,y,496,45,27);tx(s,b,563,y,661,45,27);line(s,56,y+55,1168,1,C.line);});

 tx(s,'Wringy 的拟议切入点',57,541,750,53,34,true);tx(s,'拟以本地客户开发与服务流程切入',57,606,895,49,30,true);tx(s,'能力待验证',958,593,270,50,29,false,C.secondary);
 foot(s,'组织方式概括，非功能或费用排名；本地化本身不是壁垒。Wringy 尚未上线。');
}
// 9: staged evidence, not traction.
{
 const s=page('验证计划，无已完成访谈、付费客户、复购或创作者留存证据。本轮应逐阶段收集付款/复购、合格内容交付、实际审核计量成本，是否扩展取决于证据。',[businessSrc]);
 title(s,'这轮资金要验证的三件事','初始访谈、付费试点，再看重复活动');
 const data=[['01','品牌愿意付费并复购','证据：实际付款与再次开活动'],['02','创作者持续交付合格内容','证据：合格交付与再次参与'],['03','审核与计量成本可控','证据：全量处理分钟与实际账单']];
 data.forEach(([n,a,b],i)=>{const y=205+i*143;tx(s,n,56,y,110,85,57,true,i===1?C.secondary:C.ink);tx(s,a,200,y+4,1028,56,36,true);tx(s,b,202,y+67,1020,43,27,false,C.secondary);});
 foot(s,'验证计划；当前没有经核验的客户、收入或复购数据可用于展示。');
}
// 10: facts only; live founder details can be supplied in founder.json.
{
 const s=page('创始人负责产品与商业。Belcort为创始人自有开发公司，负责技术交付方向。未提供创始人姓名/经历/资源，不编造团队人数或业绩。具体交付范围、报价与资源承诺尚需确认。',['phase-0/foundation/belcort-handoff-v1.md']);
 title(s,'团队与交付能力');
 tx(s,'创始人',56,199,678,100,70,true);tx(s,'产品与商业',61,324,680,60,38,true);tx(s,'客户开发、试点组织与产品验收',61,410,695,90,28);
 tx(s,'Belcort',824,209,403,94,61,true);tx(s,'创始人自有开发公司',828,323,400,93,31,true);tx(s,'技术评估与产品交付',828,433,400,81,28);
 line(s,56,548,1168);tx(s,'创始人姓名、相关经历与客户资源：待本人补充',58,585,1157,55,30,false,C.secondary);
 foot(s,'交付分工已确认；具体范围、报价、排期与资源承诺仍待确认。');
}
// 11: transparent unspecified raise; milestones are outcomes.
{
 const s=page('本轮融资额尚未确认。建议用途为首版开发、品牌与创作者试点、数据与审核验证、运营缓冲。活动数和日程未定。新计量与反作弊开发未报价，旧RM576,150并非本轮融资额。公司现金回本不等于投资人退出。',['phase-0/foundation/belcort-handoff-v1.md',...model.sources]);
 title(s,'本轮融资与里程碑');
 tx(s,'融资金额',56,184,614,63,36);tx(s,'待确认',52,252,663,133,91,true);tx(s,'先把试点与证据做出来',59,409,650,57,32,true);
 tx(s,'资金用途',837,196,390,50,30,true);tx(s,'首版开发\n品牌与创作者试点\n数据与审核验证\n运营缓冲',838,265,389,242,29);
 const labels=['可用试点','首批付费活动','复购与单位成本证据'];const xs=[56,434,813];const widths=[312,312,411];const ns=xs.map((x,i)=>shape(s,labels[i],x,550,widths[i],79,i===1?C.citron:C.surface));ns.forEach((n,i)=>tx(s,labels[i],xs[i]+16,570,widths[i]-20,47,i===2?27:30,true));arrow(s,ns[0],ns[1]);arrow(s,ns[1],ns[2]);
 foot(s,'里程碑提案，时间与数量待确认；新增计量和反作弊开发尚未报价。');
}
// 12: new illustration is supplied by main, not locally synthesized.
{
 const s=page('第一阶段为Rewards，连接品牌活动与创作者合格结果。之后可探索店铺、课程、会员和交易工具。未来范围是假设分期，非上线承诺或已验证网络效应。',[businessSrc]);
 title(s,'从 Rewards 走向创作者商业平台');
 await image(s,'vision-commerce.png',458,155,808,470);tx(s,'后续探索：店铺、课程、会员与交易工具',484,616,744,42,25,true);
 tx(s,'先验证 Rewards',56,215,393,107,40,true);tx(s,'品牌付费\n创作者交付\n复购与成本',58,359,384,166,30);
 foot(s,'未来范围为分期假设，非已上线能力；生成概念图。');
}
// 13: native monthly P&L table.
{
 const s=page('20场月度说明算例。平台服务收入30000；履约销售成本14000包括变动12000及固定2000；毛利16000，53.33%。再扣活动佣金3000和其他固定经营15000，新增品牌获客费前经营-2000。固定履约不重复扣除。净服务费规划口径，非会计判断或税后净利。',model.sources);
 title(s,'每月20场：毛利与经营结果');fillMonthlyProfit({s,tx,line,C,d:model.d});foot(s,'附录｜以平台净服务费为收入口径（假设）；经营结果在新增品牌获客费前，非净利润。');
}
// 14: editable 36-month chart from frozen data.
{
 const s=page('36个月完整融资前累计现金，含4个月建设。保守36个月内未回本、基准M25、扩张M18。公司累计现金首次非负不同于首次单月盈利，更不是投资人退出期。全部活动路径和成本为条件假设。新增计量与反作弊开发当前0占位为尚未报价。',model.sources);
 title(s,'36个月公司累计现金');fillCashPayback({s,tx,line,C,model,applyPresentationChartFont});foot(s,'附录｜税前、融资前条件情景；默认同月收款，非投资人回收期或回本承诺。');
}
// 15: two independent sensitivity changes and peak funding gap.
{
 const s=page('基准现金情景峰值缺口326850。各敏感性单独改变条件，不叠加。支付费按品牌全额11500的3%替代150/场，即345/场，基准公司回本M31。仅延迟一月收服务费，基准M28。新计量反作弊开发追加0只是未报价占位，基准缺口不是完整融资需要。',model.sources);
 title(s,'支付成本与账期改变现金回本');
 const base=model.results.scenarios.find(x=>x.name==='基准'),pay=model.results.sensitivities.payment3Percent.find(x=>x.name==='基准'),lag=model.results.sensitivities.collectionLag1Month.find(x=>x.name==='基准');
 table(s,[['基准情景的单项变化','公司累计现金回本'],['原假设：支付 RM150 / 场，同月收款','第 '+base.paybackMonth+' 个月'],['仅改支付费：品牌全额的 3%','第 '+pay.paybackMonth+' 个月'],['仅改收款：服务费晚 1 个月','第 '+lag.paybackMonth+' 个月']],56,173,1168,77,[853,315],{font:26});
 tx(s,'RM'+fmt(base.peakCashNeed),54,516,706,96,64,true);tx(s,'基准峰值现金缺口',59,614,705,40,26);
 tx(s,'新增计量与反作弊开发\n以 0 占位，尚未报价',812,531,412,102,28,true);
 foot(s,'附录｜两项敏感性分别变化、不叠加；现金缺口不是完整融资需要。');
}
// 16: official contemporary review allocation and CPM timing.
{
 const sources=['https://contentrewards.com/brands-terms','https://contentrewards.com/terms','https://b4e0vdqv6zgqeqj4pfgm.apps.whop.com/pricing/creators'];
 const s=page('2026-09-10核验。品牌人工批准或拒绝内容；CR处理风险与核算，Whop处理充值/身份核验/提现。无自动内容通过；草稿批准不等于公开帖终审。当前CPM为批准后7天计酬，再等待3天；可调整或风险暂停，非银行到账时限。旧48小时自动批准教程不可套用当前条款。',sources);
 title(s,'Content Rewards 的当前审核机制','内容批准、风险核验与付款，各有责任');
 const labels=[['品牌','人工审内容'],['Content Rewards','风险与核算'],['Whop','资金处理']];const xs=[56,468,880];labels.forEach(([a,b],i)=>{shape(s,a,xs[i],221,344,130,i===1?C.citron:C.surface);tx(s,a,xs[i]+16,234,314,45,i===1?27:32,true);tx(s,b,xs[i]+16,295,314,41,28);});
 tx(s,'按播放计酬：批准后开始',60,373,722,43,27,true);tx(s,'7天',53,426,305,105,79,true);tx(s,'+',343,452,71,76,52);tx(s,'3天',425,426,317,105,79,true);tx(s,'计酬',62,555,252,45,30);tx(s,'等待',432,555,267,45,30);
 tx(s,'无自动内容批准',847,431,378,58,35,true);tx(s,'窗口可调整或暂停\n不代表银行到账时限',850,516,372,101,27);
 foot(s,'附录｜2026-09-10 核查官方条款；CPM 指每千次合格播放计酬，旧48小时教程不可套用于新版。');
}
// 17: four independent state dimensions, clearly conceptual.
{
 const s=page('Wringy设计提案，未上线。内容、计量、奖励、付款独立状态。此处同一作品示例为内容最终通过、计量已核验、奖励待结算、付款未发起。规则版本、计入播放快照、证据与处理人可追溯。所有投稿、拒稿、风险与复核的人工分钟进入成本，而非只计已付款稿件。',[reviewSrc]);
 title(s,'同一作品，四类状态分别记录');
 const state=[['内容','最终审核通过'],['计量','播放已核验'],['奖励','待结算'],['付款','未发起']];state.forEach(([a,b],i)=>{const y=177+i*104;tx(s,a,58,y+7,184,64,38,true);tx(s,b,270,y+9,457,60,34,i===3,C.ink);line(s,56,y+84,650);});
 tx(s,'拟让每笔奖励可追溯',814,197,414,92,36,true);tx(s,'规则版本\n计入播放\n证据与处理人',817,308,408,174,30);tx(s,'审核劳动进入成本',816,534,408,63,32,true);
 foot(s,'附录｜概念设计，未上线；奖励确认不等于已付款，创作者应能看到下一步处理人。');
}
if(p.slides.items.length!==17)throw Error('Slide count must be 17');
for(const [n,file] of [[1,'cover-hero.png'],[2,'problem-distribution.png'],[5,'product-triptych.png'],[12,'vision-commerce.png']]){records[n-1].sources.push(path.join(ROOT,'assets',file));p.slides.items[n-1].speakerNotes.textFrame.setText(records[n-1].note+'\n来源：\n'+records[n-1].sources.join('\n'));}
await fs.writeFile(path.join(BUILD,'notes.json'),JSON.stringify(records,null,2));
if(process.argv.includes('--draft')){const dest=path.join(BUILD,'draft');await fs.mkdir(dest,{recursive:true});await(await PresentationFile.exportPptx(p)).save(path.join(BUILD,'layout-draft.pptx'));for(let i=0;i<17;i++){await fs.writeFile(path.join(dest,`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await(await p.export({slide:p.slides.items[i],format:'png',scale:1})).arrayBuffer()));console.log('Draft rendered',i+1);}console.log('Draft complete');}
else await finish(p,process.argv[2]||'v1');

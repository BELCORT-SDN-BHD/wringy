import {fs,path,ROOT,BUILD,PresentationFile,C,FONT,box} from './runtime.mjs';
import {createDeck,page,tx,rule,nativeTable,chart} from './template.mjs';
import {sourceLink} from './links.mjs';
const V1=path.join(ROOT,'../content-rewards-business-v1'),f=JSON.parse(await fs.readFile(path.join(V1,'finance/results.json'),'utf8'));
const story=(await fs.readFile(path.join(ROOT,'story.md'),'utf8')).split(/^## /m).slice(1);
const cap=JSON.parse(await fs.readFile(path.join(ROOT,'../funding-growth-v1/capital-sources.json'),'utf8'));const sprout=cap.sources.find(x=>x.publisher.includes('Sprout')).url;
const U={clipping:'https://clipping.net/brands',cr:'https://contentrewards.com/brands-terms',whop:'https://whop.com/content-rewards-terms-of-service/',mda:'https://malaysiandigitalassociation.org.my/digital-adex-fy-2025/',dosm:'https://www.dosm.gov.my/portal-main/release-content/malaysia-digital-economy-2024',google:'https://blog.google/intl/ms-my/company-news/around-the-globe/2025_11_e-conomy-sea-report-2025-malaysias/'};
const p=createDeck(),links=[];const hidden={visible:false,tickLabelPosition:'none',line:{fill:'none',width:0}},axis={textStyle:{typeface:FONT,fontSize:22,fill:C['muted-foreground']},line:{fill:C.border,width:1}};
function pg(title,sub='',foot='',sources=[]){const n=p.slides.items.length;return page(p,{title,subtitle:sub,footnote:foot,notes:story[n].split('备注：').slice(1).join('备注：').trim(),sources});}
function text(s,t,x,y,w,h=70,size=28,bold=false,color=C.foreground){return tx(s,t,x,y,w,h,size,bold,color);}
function rect(s,x,y,w,h,fill=C.secondary,line='none'){return s.shapes.add({geometry:'rect',position:box(x,y,w,h),fill,line:{fill:line,width:line==='none'?0:1.5}});}
function node(s,id,label,x,y,w,h=82,{fill='none',size=28,color=C.foreground}={}){const n=s.shapes.add({name:id,geometry:'rect',position:box(x,y,w,h),fill,line:{fill:fill==='none'?C.border:'none',width:1.5}});text(s,label,x+18,y+16,w-36,h-24,size,true,color);return n;}
function link(s,a,b,fromSide='right',toSide='left'){return s.shapes.connect(a,b,{kind:'straight',fromSide,toSide,line:{fill:C.primary,width:2},tail:{type:'arrow',width:'med',length:'med'}});}
function plain(s,id,label,x,y,w,h=70,size=28){const n=rect(s,x,y,w,h,'none');text(s,label,x,y,w,h,size,true,C.primary);return n;}
function note(s,t,y=606,size=24){text(s,t,58,y,1156,64,size,false,C.primary);}
// 1 Minimal proposition, not funding-led
let s=pg('','','商业计划讨论稿 · 2026年9月13日');
text(s,'Wringy',56,76,1168,119,83,true,C.primary);text(s,'把内容奖励模式\n带进马来西亚',58,267,1160,178,61,true);text(s,'让品牌借助本地创作者网络分发内容',61,550,1100,80,31,false,C.primary);
// 2 Overseas reference vs local observation
s=pg('海外已有参考模式，本地采用仍待验证','Wringy的提案：本地内容分发，加上按约核验的奖励','Clipping为官方自述，非独立效果审计。低认知为创办人观察，不代表零竞争、首家或已验证需求。',[U.clipping]);
text(s,'海外参考',58,272,472,61,34,true,C.primary);text(s,'Clipping',58,352,472,65,42,true);text(s,'全托管内容活动\n剪辑者网络参与分发',58,432,492,100,29);
rect(s,628,275,1,283,C.border);
text(s,'马来西亚机会假设',713,272,510,61,34,true,C.primary);text(s,'创办人观察：认知度很低',713,359,510,67,31,true);text(s,'先解释模式与价值\n再验证本地品牌愿不愿付费',713,439,510,102,29);
note(s,'海外有参考，不等于本地已有需求。付费试点与复购是下一步证据。',606,25);
// 3 Concrete fictional product-brand story
s=pg('一家马来西亚品牌，可以这样发起活动','假设一家本地产品品牌，邀请创作者改编它有授权的产品演示','虚构活动示例，非客户案例。发布与观看在外部平台，图示数量不代表实际参与、触达或销量。');
const src=node(s,'source','品牌提供\n产品演示素材',58,348,257,132,{fill:C.primary,color:C['primary-foreground'],size:31});
text(s,'创作者各自制作并发布',390,238,495,61,29,true,C.primary);
const labels=['使用演示','场景剪辑','产品讲解'];const final=node(s,'confirmed','合格内容\n获得确认奖励',980,348,242,132,{fill:C.primary,color:C['primary-foreground'],size:29});
labels.forEach((l,i)=>{const y=309+i*96;const n=node(s,'clip'+i,'创作者'+String.fromCharCode(65+i)+'  '+l,411,y,435,72,{size:28});link(s,src,n);link(s,n,final);});
note(s,'活动先约定要求与奖励预算，品牌与Wringy按约定核对内容。',609,25);
// 4 Distribution proposition, native editable before/after flow
s=pg('品牌希望触达相关受众，创作者获得付费机会','','本地受众相关性与传播效果仍待试点核验。不承诺流量、销量、收益或零作弊。');
text(s,'品牌提供内容与传播目标',58,212,522,61,31,true);text(s,'本地创作者参与发布',700,212,520,61,31,true,C.primary);
const b1=plain(s,'before','品牌',58,375,124,66,33);['授权素材','传播目标','奖励预算'].forEach((a,i)=>{const n=plain(s,'one'+i,a,351,298+i*102,223,62,28);link(s,b1,n);});
rect(s,631,245,1,312,C.border);
const activity=node(s,'activity','内容分发活动\n按约核验奖励',698,337,277,128,{fill:C.primary,color:C['primary-foreground'],size:28});
['创作者A','创作者B','创作者C'].forEach((a,i)=>{const n=plain(s,'participant'+i,a,1061,282+i*111,156,61,28);link(s,activity,n);});
text(s,'素材、规则与交付记录支持活动。创作者看清奖励条件后决定参与。',58,559,1160,58,26);note(s,'关键验证：品牌是否愿为相关受众的内容分发付费，并再次购买？',621,25);
// 5 Focus first, ambition later
s=pg('先做好一次付费合作，再扩展平台','现在聚焦 Content Rewards，未来按客户需要增加能力','未来分支为需求驱动假设，不计首轮研发或收入预测。');
text(s,'第一步',58,246,475,63,30,true,C.primary);text(s,'品牌付费\n创作者交付\n一次可靠的合作',58,346,518,209,45,true,C.primary);
rect(s,649,240,1,337,C.border);text(s,'以后，客户需求决定方向',718,246,499,63,29,true);
const t1=plain(s,'tools','品牌团队工具',718,371,494,65,35),t2=plain(s,'commerce','创作者商业经营',718,498,494,65,35);
text(s,'更多活动与团队协作需求',718,431,494,54,26);text(s,'有真实商品、内容或服务可销售',718,558,494,61,26);
// 6 Context and estimated subset never parallel validated markets
s=pg('本地认知度与首批客群，都需要验证','创办人观察：本地认知度很低。首批品牌细分仍未确定。','宏观数据为MDA FY2025估计，21家代理样本约60%。电商子集容量是假设，不是全部市场、当前客户或收入预测。',[U.mda,U.dosm]);
text(s,'宏观背景',58,240,1100,55,27,true);text(s,'RM2.96bn',58,315,551,85,58,true,C.primary);text(s,'2025 马来西亚\n数字广告支出估算',697,319,526,93,31);
rule(s,58,450,1160);text(s,'电商品牌子集 · 平台费容量假设',58,489,600,66,28,true);text(s,'约 RM22.53m／年',719,481,504,83,40,true,C.primary);text(s,'约6,259个假设采购方 × 年奖励RM24,000 × 15%演示费率',58,578,1160,67,27);
// 7 Revenue after product + opportunity
s=pg('Wringy收取服务费，创作者奖励单独计算','演示：RM2,000已确认奖励 × 外加15%服务费 ＝ RM300平台收入','费率未定。未计税及外部费用，未赚取预算不收本例平台费。拟议品牌直付或经确认外部服务，不自建钱包、不垫付。');
chart(s,'bar',{position:box(53,230,1170,161),categories:['品牌支出'],series:[{name:'创作者奖励',values:[f.campaign.reward_budget_not_company_income],fill:C.primary},{name:'Wringy服务收入',values:[f.campaign.platform_fee_income_illustrative],fill:C.brand}],barOptions:{direction:'bar',grouping:'stacked',overlap:100},hasLegend:false,xAxis:hidden,yAxis:{...hidden,min:0,max:2300}});
text(s,'RM2,000',58,424,691,83,53,true,C.primary);text(s,'RM300',938,424,285,83,53,true,C.primary);text(s,'创作者奖励，非平台收入',58,512,745,65,28);text(s,'Wringy服务收入',938,512,285,65,26);
note(s,'品牌总支出 RM2,300。商业成立还需要品牌复购与可控的交付成本。',605,25);
// 8 Capital builds product and tests, not technical design
s=pg('第一笔资金，支持Beta、市场教育与试点','Prototype、可使用Beta、测试与移交，研发预算上限 RM50,000','Belcort为创办人关联开发公司，非已确认报价或完成状态。须明确关联报价、非受益方验收、源码与账号归属。');
text(s,'六个月规划',58,237,1100,61,28,true,C.primary);
const periods=[['M1–2','解释模式与原型'],['M3','计划Beta验收'],['M3–6','小规模付费试点']];
periods.forEach(([a,b],i)=>{const x=58+i*406;rect(s,x,354,353,10,i===1?C.brand:C.primary);text(s,a,x,291,356,59,33,true,C.primary);text(s,b,x,391,356,76,31,true);});
text(s,'品牌拜访解释模式，并同步验证需求。费用纳入既有预算。',58,513,1160,65,29);note(s,'试点须在Beta验收通过、数据与付款路径就绪后开展。',602,26);
// 9 financial scenario selection not ask
s=pg('六个月验证资金，有两种待选情景','零收入抵扣测算，品牌奖励不占用公司现金','两种情景均未选定。研发含RM5,000内部预留。全款到账起计时，分期到账重算。');
text(s,'基础用途',58,236,602,60,28,true,C.primary);chart(s,'bar',{position:box(51,316,645,131),categories:['基础用途'],series:[{name:'研发',values:[50000],fill:C.primary},{name:'非研发',values:[13620],fill:C['chart-2']},{name:'缓冲及取整',values:[6380],fill:C.brand}],barOptions:{direction:'bar',grouping:'stacked',overlap:100},hasLegend:false,xAxis:hidden,yAxis:{...hidden,min:0,max:70000}});
text(s,'研发 50,000\n非研发 13,620\n缓冲及取整储备 6,380',58,484,617,151,29);
chart(s,'bar',{position:box(737,280,441,250),categories:['含津贴','无津贴'],series:[{name:'RM资金情景',values:[110000,70000],fill:C.primary}],barOptions:{direction:'bar',grouping:'clustered'},hasLegend:false,xAxis:axis,yAxis:{...hidden,min:0,max:130000},dataLabels:{showValue:true,position:'outEnd',textStyle:{typeface:FONT,fontSize:24,fill:C.foreground}}});
text(s,'含津贴：RM6,000／月，共6个月\n无津贴：自行承担生活费尚未确认',739,548,483,87,24,false,C.primary);
//10 evidence gate includes operational capacity
s=pg('先让品牌理解，再取得试用与复购证据','市场教育后，验证独立品牌愿意付费并再次购买','20／3／1为规划目标，不是现有客户或转化率。两阶段不保证两轮融资，下一笔金额与到账均未定。');
const gates=[['理解模式','品牌理解价值与规则'],['付费试用','独立品牌小额付费'],['再次购买','同一品牌复购']];gates.forEach(([a,b],i)=>{const x=58+i*405;text(s,'0'+(i+1),x,253,353,76,54,true,C.primary);rule(s,x,349,351);text(s,a,x,372,353,70,35,true);text(s,b,x,454,353,67,27);});
text(s,'扩大前，还须确认运营有能力可靠审核、交付与结算。',58,543,1160,59,28,true,C.primary);text(s,'试点目标：20次决策人访谈，3个独立付费品牌，至少1个品牌复购。',58,607,1160,47,23);
//11 long-term, strategic fit not giant acquisition valuation
s=pg('早期进入的价值，要靠本地积累形成','机会窗口是待验证判断，品牌关系与交付经验需要逐步建立','这些能力仍待验证。不承诺买方、退出年份或回报。老股转让须有买方与合同许可，上市仅为长期可能。',[sprout]);
const fit=node(s,'fit','潜在战略契合\n营销软件／商业平台',833,348,389,130,{fill:C.primary,color:C['primary-foreground'],size:30});
['本地品牌关系','本地创作者供给','可靠的活动交付经验'].forEach((a,i)=>{const n=plain(s,'cap'+i,a,58,278+i*115,480,74,33);link(s,n,fit);});
note(s,'早进入不自动形成护城河，长期价值仍取决于持续需求与交付。',607,25);
//12 close recurring demand first
s=pg('第一笔资金，验证马来西亚是否愿意采用','','整轮金额未选定，扩张与后续融资取决于验证结果。');
text(s,'从理解模式到付费试点\n验证本地品牌是否愿意持续购买',58,227,1160,160,51,true,C.primary);
text(s,'首轮受控投入',58,452,353,61,32,true);text(s,'后续资金扩大',462,452,355,61,32,true);text(s,'按需求发展平台',868,452,354,61,32,true);
text(s,'Beta、市场教育与付费试点',58,524,353,81,26);text(s,'需求证据与运营产能就绪后扩大',462,524,355,81,26);text(s,'逐步服务品牌与创作者',868,524,354,81,26);
note(s,'Prototype ＋ 可使用Beta，研发上限 RM50,000',622,26);
//13 financial appendix
s=pg('附录：一场活动的经济贡献','服务收入RM300，贡献随人工工时变化','按RM30／小时，数据与收款共RM30。未计异常损失，发生时扣减。未扣获客、固定费用与研发，贡献不是毛利或净利。');
text(s,'经济可变成本',58,240,477,61,29,true,C.primary);text(s,'人工 RM90\n数据 RM20\n收款 RM10',58,321,475,160,33);text(s,'合计 RM120\n经济贡献 RM180',58,498,470,106,32,true,C.primary);
chart(s,'line',{position:box(543,235,674,340),categories:['3小时','6小时','9小时','12小时'],series:[{name:'单场经济贡献RM',values:[180,90,0,-90],line:{fill:C.primary,width:4},fill:C.primary}],hasLegend:false,xAxis:axis,yAxis:{...axis,min:-100,max:200,majorUnit:100},dataLabels:{showValue:true,position:'above',textStyle:{typeface:FONT,fontSize:24,fill:C.foreground}}});
text(s,'RM90人工含RM60未领薪创办人劳动。\n9小时是单场贡献归零，不是公司回本。',546,590,679,61,23,false,C.primary);
//14 two tables reused data only
s=pg('附录：市场与资金推导','市场适配率与预算用量均为假设，财务模型保持不变','经营单位不是2026去重品牌。单价、用量与零津贴待确认。维护不承接研发超额或合同保修，试点现金成本由既有费用池消耗。',[U.dosm]);
text(s,'市场容量假设',58,221,531,43,28,true,C.primary);text(s,'基础资金用途（RM）',664,221,558,43,28,true,C.primary);
nativeTable(s,[['输入','数值'],['2022电商经营单位','78,236'],['活跃调整／适配率','80%／10%（假设）'],['年奖励／服务费率','24,000／15%（假设）'],['年平台费容量','约22.53m'],['年奖励减半后','约11.27m']],{x:56,y:272,width:548,rowH:43,colWidths:[284,264],font:21});
nativeTable(s,[['项目','金额'],['研发含5,000内部预留','50,000'],['地推／运营','4,500／2,400'],['云工具／维护','1,200／1,040'],['法务会计／数据收款','4,000／480'],['基础支出','63,620'],['缓冲／取整储备','2,043／4,337'],['合计','70,000']],{x:662,y:272,width:562,rowH:39,colWidths:[353,209],font:21});
text(s,'含津贴：70,000 ＋ 36,000津贴 ＋ 5,400缓冲 − 1,400取整差 ＝ 110,000',58,608,1160,55,23,true,C.primary);
//15 dedicated sources keeps all links readable
s=pg('附录：来源与假设边界','Clipping核验于9月13日，其余资料沿用9月12日。完整URL见备注。','15%费率、RM5／千次、工时、6个月、客户目标及非研发预算均为假设。尚无已核验Wringy客户、收入或自动化效果。',Object.values(U).concat(sprout));
const sources=[['clipping','Clipping · 全托管品牌活动\nclipping.net/brands',U.clipping],['cr','Content Rewards · 品牌条款\ncontentrewards.com/brands-terms',U.cr],['whop','Whop · 自有奖励计划\nwhop.com/content-rewards-terms-of-service',U.whop],['mda','MDA · FY2025数字广告\nmalaysiandigitalassociation.org.my',U.mda],['dosm','DOSM · 历史经营单位\ndosm.gov.my',U.dosm],['google','Google · 马来西亚电商背景\nblog.google/intl/ms-my',U.google],['sprout','Sprout Social · 收购公告\ninvestors.sproutsocial.com',sprout]];
sources.forEach(([key,label,url],i)=>sourceLink(s,{key,label,url,slideNumber:15,x:58+(i%2)*594,y:233+Math.floor(i/2)*99,w:550,h:88},links));
await fs.writeFile(path.join(BUILD,'source-links.json'),JSON.stringify(links,null,2));await fs.writeFile(path.join(BUILD,'requirements.json'),JSON.stringify({total:15,main:12,appendix:3,charts:[7,9,13],tables:[14],financialSource:'../content-rewards-business-v1/finance/results.json',markers:{pptx:1,pdf:1}},null,2));
await (await PresentationFile.exportPptx(p)).save(path.join(BUILD,'draft.pptx'));console.log('v4: 12 main + 3 appendix exported.');

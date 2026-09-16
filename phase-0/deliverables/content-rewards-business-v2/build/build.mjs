import {fs,path,ROOT,BUILD,PresentationFile,C,FONT,box} from './runtime.mjs';
import {createDeck,page,tx,rule,nativeTable,chart} from './template.mjs';
import {sourceLink} from './links.mjs';
const V1=path.join(ROOT,'../content-rewards-business-v1');
const f=JSON.parse(await fs.readFile(path.join(V1,'finance/results.json'),'utf8'));
const research=JSON.parse(await fs.readFile(path.join(V1,'research/sources.json'),'utf8'));
const old=(await fs.readFile(path.join(V1,'story.md'),'utf8')).split(/^## /m).slice(1);
const cap=JSON.parse(await fs.readFile(path.join(ROOT,'../funding-growth-v1/capital-sources.json'),'utf8'));
const sprout=cap.sources.find(x=>x.publisher.includes('Sprout')).url;
const p=createDeck(),links=[],editorial=[];
const U={whop:'https://whop.com/content-rewards-terms-of-service/',cr:'https://contentrewards.com/brands-terms',creator:'https://contentrewards.com/terms',mda:'https://malaysiandigitalassociation.org.my/digital-adex-fy-2025/',google:'https://blog.google/intl/ms-my/company-news/around-the-globe/2025_11_e-conomy-sea-report-2025-malaysias/',dosm:'https://www.dosm.gov.my/portal-main/release-content/malaysia-digital-economy-2024'};
const axis={textStyle:{typeface:FONT,fontSize:22,fill:C['muted-foreground']},line:{fill:C.border,width:1}};
const hidden={visible:false,tickLabelPosition:'none',line:{fill:'none',width:0}};
function pg(title,sub='',foot='',original=[],sources=[]){
 const notes=original.map(n=>old[n-1]).join('\n\n').split('\n').filter(l=>!l.startsWith('视觉：')&&!l.startsWith('notes：')).join('\n');
 const s=page(p,{title,subtitle:sub,footnote:foot,notes:notes+'\n\n研究于2026-09-12核查，本次为2026-09-13叙事改版。\n财务原模型：content-rewards-business-v1/finance/results.json；finance/inputs.json。',sources});editorial.push({slide:p.slides.items.length,title,subtitle:sub,caveat:foot,original,sources});return s;
}
function text(s,t,x,y,w,h=70,size=27,bold=false,color=C.foreground){return tx(s,t,x,y,w,h,size,bold,color);}
function rect(s,x,y,w,h,fill=C.secondary,line='none'){return s.shapes.add({geometry:'rect',position:box(x,y,w,h),fill,line:{fill:line,width:line==='none'?0:1.5}});}
function node(s,id,label,x,y,w,h=70,{fill='none',size=27,ellipse=false,color=C.foreground}={}){const n=s.shapes.add({name:id,geometry:ellipse?'ellipse':'rect',position:box(x,y,w,h),fill,line:{fill:fill==='none'?C.border:'none',width:1.5}});text(s,label,x+14,y+14,w-28,h-20,size,true,color);return n;}
function link(s,a,b,fromSide='right',toSide='left'){return s.shapes.connect(a,b,{kind:'straight',fromSide,toSide,line:{fill:C.primary,width:2},tail:{type:'arrow',width:'med',length:'med'}});}
function line(s,x,y,w,color=C.border){rule(s,x,y,w,color);}
function note(s,t,y=610,size=23){text(s,t,58,y,1157,60,size,false,C.primary);}
// 1: no unsupported growth visual
let s=pg('Wringy','Content Rewards 商业计划','马来西亚首发 · 融资讨论稿 · 2026年9月13日',[1,2]);
text(s,'让品牌的授权素材\n变成多人创作的内容活动',58,257,1158,176,59,true,C.primary);
text(s,'品牌提供素材与奖励，创作者制作并发布，Wringy组织审核与对账。',60,485,1100,92,29);
note(s,'首期：Prototype ＋ 可使用 Beta，研发预算上限 RM50,000',603,25);
// 2: one brand workload map
s=pg('品牌有素材，活动还需要持续协调','首批品牌假设：有授权长内容、有营销预算，愿意付费试点','定性问题与价值提案待访谈验证，图中节点不代表真实客户或创作者数量。',[2]);
const source=node(s,'brand','品牌\n授权长内容',62,330,222,138,{fill:C.primary,size:31,color:C['primary-foreground']});
const tasks=[['招募',365,241],['讲清规则',365,400],['核对内容',730,241],['确认奖励',730,400]];
const ns=tasks.map(([v,x,y],i)=>node(s,'work'+i,v,x,y,235,80));link(s,source,ns[0]);link(s,source,ns[1]);link(s,ns[0],ns[2]);link(s,ns[1],ns[3]);
text(s,'多人参与，\n交付需可追踪',1010,331,208,119,29,true,C.primary);
note(s,'Wringy拟承担组织与记录，让品牌和创作者使用同一套活动规则。',586);
// 3: branched campaign storyboard, native evidence diagram
s=pg('一份授权素材，一场多人内容活动','拟议 Beta 流程：制作与观看发生在外部社交平台','按约定证据人工核对，不能保证识别全部虚假观看。图示稿件数仅说明流程。',[3,4]);
const src=node(s,'source','授权素材\n与活动规则',58,339,219,133,{fill:C.primary,color:C['primary-foreground'],size:29});
const review=node(s,'review','人工核对\n奖励确认',1005,339,216,133,{fill:C.primary,color:C['primary-foreground'],size:29});
text(s,'参与创作者',371,235,243,59,27,true);text(s,'外部发布的短内容',672,235,293,59,27,true);
for(let i=0;i<3;i++){let y=302+i*107;const creator=node(s,'creator'+i,'剪辑与发布',358,y,225,74,{size:26});const clip=node(s,'clip'+i,'链接＋提交证据',667,y,253,74,{size:25});link(s,src,creator);link(s,creator,clip);link(s,clip,review);}
note(s,'演示：RM5／千次合格播放，赚取 RM2,000 全池需 400,000 次合格播放。',622,22);
// 4: actual chart money allocation
s=pg('品牌的 RM2,300，分成奖励与服务费','演示算例：已确认奖励 RM2,000，外加15%服务费 RM300','未赚取预算不收本例平台费。未计税及另行约定外部费用。播放不等于独立观众、订单或销量。',[3,4]);
chart(s,'bar',{position:box(53,244,1170,175),categories:['品牌支出'],series:[{name:'创作者奖励',values:[2000],fill:C.primary},{name:'Wringy服务费',values:[300],fill:C.brand}],barOptions:{direction:'bar',grouping:'stacked',overlap:100},hasLegend:false,xAxis:hidden,yAxis:{...hidden,min:0,max:2300},dataLabels:{showValue:false}});
text(s,'RM2,000',58,438,650,80,52,true,C.primary);text(s,'RM300',909,438,310,80,52,true,C.primary);text(s,'已确认创作者奖励',58,525,670,61,28);text(s,'平台服务收入',909,525,310,61,28);
note(s,'拟议支付路径待确认：品牌直付或经确认外部服务，不自建钱包、不垫付。',603,23);
// 5: native cost-to-contribution stacked graph, honest fallback from waterfall
s=pg('RM300 服务收入，留下 RM180 单场贡献','经济成本演示：全部审核与申诉劳动按3小时、RM30／小时计','贡献未扣获客、固定费用与研发。未计异常损失，发生时进一步扣减。费率与成本均待验证。',[5,17]);
chart(s,'bar',{position:box(53,244,1170,172),categories:['RM300收入'],series:[{name:'人工',values:[90],fill:C['chart-2']},{name:'数据',values:[20],fill:C.border},{name:'收款',values:[10],fill:C.brand},{name:'经济贡献',values:[180],fill:C.primary}],barOptions:{direction:'bar',grouping:'stacked',overlap:100},hasLegend:false,xAxis:hidden,yAxis:{...hidden,min:0,max:300},dataLabels:{showValue:false}});
const costs=[['人工','RM90'],['数据','RM20'],['收款','RM10'],['经济贡献','RM180 · 60%']];costs.forEach(([a,b],i)=>{const x=58+i*294;rect(s,x,427,28,9,[C['chart-2'],C.border,C.brand,C.primary][i]);text(s,a,x,445,280,48,25);text(s,b,x,498,280,76,i===3?35:40,true,C.primary);});
note(s,'RM90人工包括RM30有偿支持与RM60未领薪创办人劳动，后者是经济成本。',606,23);
// 6: data sensitivity line
s=pg('人工每增加3小时，单场贡献减少 RM90','同一演示活动，服务收入 RM300，人工 RM30／小时，数据与收款共 RM30','劳动含全部投稿审核与申诉。未计异常损失、获客、固定费用及研发。工时与成本为假设。',[5,17]);
chart(s,'line',{position:box(53,229,919,357),categories:['3小时','6小时','9小时','12小时'],series:[{name:'经济贡献（RM）',values:[180,90,0,-90],line:{fill:C.primary,width:4},fill:C.primary}],hasLegend:false,xAxis:axis,yAxis:{...axis,min:-100,max:200,majorUnit:100},dataLabels:{showValue:true,position:'above',textStyle:{typeface:FONT,fontSize:26,fill:C.foreground}}});
text(s,'9小时',1002,293,222,75,46,true,C.primary);text(s,'单场贡献归零\n再多则为负',1002,383,222,129,29);
note(s,'交付试点必须记录每条审核耗时与返工，才能判断可扩大的活动类型。',606,24);
// 7: macro vs bottom-up, separate scales no fake funnel
s=pg('马来西亚有营销预算，首批客户仍需验证','宏观背景与细分容量分别看，不能当作 Wringy 收入','宏观统计：MDA FY2025估计，21家代理样本约60%。Google等2025E。容量为假设，完整输入见附录。',[7,8],[U.mda,U.google,U.dosm]);
text(s,'市场背景',58,240,485,55,27,true);text(s,'RM2.96bn',58,310,530,83,58,true,C.primary);text(s,'2025 马来西亚数字广告支出估算',58,399,523,87,27);text(s,'US$20bn 电商成交额估计',58,527,520,67,27);
rect(s,625,246,2,340,C.border);text(s,'电商品牌切口 · 年平台费容量算例',676,240,548,67,26,true);text(s,'约 RM22.53m',676,332,550,88,53,true,C.primary);text(s,'6,259 适配采购方 × RM24,000 × 15%',676,441,544,86,27);text(s,'年奖励减半：容量约 RM11.27m',676,546,548,75,25);
// 8 outcomes decision rows, native routing not score matrix
s=pg('品牌购买的结果，决定合作方式','这些是不同采购口径，不是效果或价格排名','Wringy为首版提案，暂无最低费用、广告效果优势或竞争壁垒证据。',[9],['https://help.shopify.com/en/manual/promoting-marketing/collabs/creators/payments','https://ads.tiktok.com/resources/help/article/about-working-with-creators-on-tiktok-one-campaigns?lang=en']);
const opts=[['自己管理创作者','自行招募','品牌承担协调、审核与付款'],['委托制作与投放','代理商／网红合作','按具体服务合同采购'],['为归因成交付费','销售联盟推广','佣金依据成交归因'],['组织授权内容活动','Wringy 首版','按约定结果核对多人交付']];
opts.forEach(([a,b,c],i)=>{const y=241+i*98;text(s,a,58,y,337,62,28,true,i===3?C.primary:C.foreground);const aa=rect(s,415,y+25,1,1,'none'),bb=rect(s,496,y+25,1,1,'none');link(s,aa,bb);text(s,b,522,y,355,62,29,true,i===3?C.primary:C.foreground);text(s,c,899,y,320,73,23);if(i<3)line(s,58,y+80,1164);});
// 9 review decision path with hold
s=pg('参考产品把内容审核与付款状态分开','Content Rewards 独立服务，品牌人工审核并处理风险标记','独立服务品牌标准10%／认证8%，含费分母及外部费用不可完整复原。不是Wringy定价。',[6],[U.cr,U.creator,U.whop]);
const submit=node(s,'submit','创作者提交',58,303,222,81);const brand=node(s,'brandreview','品牌逐稿审核',360,303,247,81,{fill:C.primary,color:C['primary-foreground']});const pass=node(s,'pass','通过条件',711,257,211,74);const hold=node(s,'hold','风险／待补证',711,438,211,74);const pay=node(s,'pay','处理奖励',1000,257,222,93,{size:25});const re=node(s,'recheck','暂停并复核',1000,438,222,80,{size:25});
link(s,submit,brand);link(s,brand,pass);link(s,brand,hold);link(s,pass,pay);link(s,hold,re);
note(s,'Whop 自有奖励计划另有条款：费用为实际参与者付款的10%，不能混作同一产品。',594,23);
//10 swimlanes with actual flow rather than cards
s=pg('RM50,000研发上限与Beta范围','首期目标：邀请制、小规模、单一计酬口径的受控活动','上限含RM5,000内部预留，非已确认报价或完成状态。Belcort为关联开发公司，须明确报价、非受益方验收与源码账号归属。',[10,17]);
const lanes=[['品牌',240],['创作者',358],['运营',476]];lanes.forEach(([a,y])=>{text(s,a,58,y+18,126,60,29,true,C.primary);line(s,211,y+101,1010);});
const b1=node(s,'b1','素材／规则',236,246,234,72),b2=node(s,'b2','查看活动',863,246,249,72),c1=node(s,'c1','报名',490,364,190,72),c2=node(s,'c2','发布并提交',743,364,239,72),o1=node(s,'o1','核对证据',743,482,239,72,{fill:C.primary,color:C['primary-foreground']}),o2=node(s,'o2','奖励记录／对账',1020,482,202,72,{size:22});link(s,b1,c1);link(s,c1,c2);link(s,c2,o1,'bottom','top');link(s,o1,o2);link(s,o2,b2,'top','right');
note(s,'保留身份隔离、授权、日志、付款状态及故障恢复。首期排除自动计量、反作弊与钱包。',597,22);
//11 two-sided acquisition not fake forecasts
s=pg('地推找品牌，人工招募创作者','双边招募先在同一场活动相遇','20／3／1是规划目标，不是漏斗转化率或已有客户。关联测试、免费试用与独立付费分别记录。',[11]);
text(s,'品牌侧：可量化试点目标',58,239,750,57,28,true,C.primary);
const a1=node(s,'a1','20次决策人访谈',58,310,330,84,{size:29}),a2=node(s,'a2','3个独立付费品牌',469,310,343,84,{size:29}),a3=node(s,'a3','至少1个品牌复购',893,310,329,84,{size:28});link(s,a1,a2);link(s,a2,a3);
text(s,'创作者侧：先验证参与和交付',58,455,750,59,28,true,C.primary);
const d1=node(s,'d1','招募有发布账号者',58,525,330,78,{size:27}),d2=node(s,'d2','试做并理解规则',469,525,343,78,{size:27}),d3=node(s,'d3','提交合格内容',893,525,329,78,{size:27});link(s,d1,d2);link(s,d2,d3);
//12 money charts 2
s=pg('首轮资金有两种情景，尚未选定','六个月规划，按零收入抵扣测算，品牌奖励不占用公司现金','研发已含内部预留。无津贴情景假设创办人自行负担生活费，尚未确认。全款到账起计时，分期到账重算。',[12,17]);
text(s,'RM70,000 基础用途',58,235,670,60,31,true,C.primary);
chart(s,'bar',{position:box(52,307,675,133),categories:['基础用途'],series:[{name:'研发',values:[50000],fill:C.primary},{name:'非研发',values:[13620],fill:C['chart-2']},{name:'缓冲与取整储备',values:[6380],fill:C.brand}],barOptions:{direction:'bar',grouping:'stacked',overlap:100},hasLegend:false,xAxis:hidden,yAxis:{...hidden,min:0,max:70000}});
text(s,'研发 RM50,000\n非研发 RM13,620\n缓冲与取整储备 RM6,380',58,471,668,134,29);text(s,'RM6,380 ＝ RM2,043缓冲 ＋ RM4,337取整储备',58,611,690,43,20);
text(s,'含津贴的资金增量为 RM40,000',784,235,434,82,29,true,C.primary);
chart(s,'bar',{position:box(778,335,415,198),categories:['含津贴','无津贴'],series:[{name:'六个月资金（RM）',values:[110000,70000],fill:C.primary}],barOptions:{direction:'bar',grouping:'clustered'},hasLegend:false,xAxis:{...axis,textStyle:{typeface:FONT,fontSize:22,fill:C.foreground}},yAxis:{...hidden,min:0,max:125000},dataLabels:{showValue:true,position:'outEnd',textStyle:{typeface:FONT,fontSize:23,fill:C.foreground},numberFormatCode:'0,"k"'}});
text(s,'RM6,000／月津贴，共6个月\n加缓冲与取整差异，明细见附录',784,548,432,82,23);
//13 Gantt native accurately months
s=pg('六个月安排围绕付费与复购验证','规划：M3拟完成Beta验收，数据与付款路径就绪后才开展受控试点','第4个月起评估现金与证据，未到账资金不计跑道。证据或资金不足则缩减、调整或暂停。',[13]);
const gx=354,gw=870,mw=gw/6;
for(let i=0;i<6;i++){text(s,'M'+(i+1),gx+i*mw,232,mw,46,25,true,C.primary);rect(s,gx+i*mw,286,1,289,C.border);}
const gantt=[['品牌拜访',1,6],['原型与范围',1,2],['Beta验收',3,3],['受控试点',3,6],['复购验证',5,6]];
gantt.forEach(([a,start,end],i)=>{const y=291+i*57;text(s,a,58,y,276,46,26,true);rect(s,gx+(start-1)*mw+7,y+2,(end-start+1)*mw-18,33,i===2?C.brand:C.primary);});
note(s,'下一阶段营销门槛：独立付款、复购证据、可记录的全量审核成本与可靠结算。',602,23);
//14 branching roadmap
s=pg('未来业务分支，由实际需求决定','Content Rewards复购是起点，其他模块不计首轮研发与收入','长期假设，跨模块转化与网络效应待验证。同一笔交易不重复计佣。东南亚逐国验证客户与收付可行性。',[14]);
const cr=node(s,'crbase','Content Rewards\n活动服务费',58,331,340,151,{fill:C.primary,color:C['primary-foreground'],size:31});
const bt=node(s,'brandtools','品牌团队工具\n候选：订阅',487,257,299,108,{size:28}),commerce=node(s,'commerce','创作者店铺\n候选：交易费／订阅',487,459,299,108,{size:27});
const module=node(s,'mods','会员／数字产品\n课程／社区／联盟',934,446,288,123,{size:28});link(s,cr,bt);link(s,cr,commerce);link(s,commerce,module);
text(s,'更多活动后的工作需求',934,283,288,91,26,false,C.primary);note(s,'开发门槛：具体客户需求，以及适用的支付、数据与准入能力。',611,23);
//15 strategic fit evidence inputs not valuation headline
s=pg('可交易的价值，来自客户与交付能力','战略并购需真实买方，老股转让与长期上市也无保证','案例不代表Wringy估值、买家意向或回报预测。经营回本不同于退出，增资通常进入公司。',[15],[sprout]);
const fit=node(s,'fit','潜在战略契合\n营销软件／商业平台',839,342,384,112,{fill:C.primary,color:C['primary-foreground'],size:29});
['复购品牌客户','可靠的活动交付','清晰的IP与资产'].forEach((v,i)=>{const a=node(s,'value'+i,v,58,247+i*121,446,80,{size:31});link(s,a,fit);});
text(s,'相邻案例',630,544,193,47,24,true);text(s,'Sprout Social 2023收购Tagger\n公告现金对价 US$140m，补充网红营销能力',839,542,384,98,23);
//16 evidence close with unified progression flat
s=pg('本轮资金，购买三项可核验的证据','Wringy Content Rewards · 先产品与地推，再扩大营销','RM70,000／RM110,000均为讨论情景。零津贴未确认，正式金额仍待报价、津贴与投资条款。',[16]);
const evid=[['真实付款','独立品牌付费活动'],['可靠交付','记录内容、工时与奖励\n追踪争议'],['再次购买','同一品牌复购证据']];
evid.forEach(([a,b],i)=>{let x=58+i*405;text(s,'0'+(i+1),x,252,363,84,63,true,C.primary);line(s,x,356,355);text(s,a,x,381,363,70,36,true);text(s,b,x,473,355,91,26);});
text(s,'研发上限 RM50,000',58,592,530,63,31,true,C.primary);text(s,'六个月资金情景  RM70k ／ RM110k',660,592,560,63,28,true,C.primary);
//17 two native tables, readable appendix with detailed notes
s=pg('附录：市场输入与资金明细','源模型保持不变，以下均为估算口径','经营单位不是去重品牌。非研发单价与零津贴待确认。维护不承接研发超额或合同保修，试点成本从既有费用池消耗。',[8,12,17],[U.dosm]);
text(s,'市场容量假设',58,221,531,43,28,true,C.primary);text(s,'基础资金用途（RM）',664,221,558,43,28,true,C.primary);
nativeTable(s,[['输入','数值'],['2022电商经营单位','78,236'],['活跃调整／适配率','80%／10%（假设）'],['年奖励／服务费率','24,000／15%（假设）'],['年平台费容量','约22.53m'],['年奖励减半后','约11.27m']],{x:56,y:272,width:548,rowH:43,colWidths:[284,264],font:21});
nativeTable(s,[['项目','金额'],['研发含5,000内部预留','50,000'],['地推／运营','4,500／2,400'],['云工具／维护','1,200／1,040'],['法务会计／数据收款','4,000／480'],['基础支出','63,620'],['缓冲／取整储备','2,043／4,337'],['合计','70,000']],{x:662,y:272,width:562,rowH:39,colWidths:[353,209],font:21});
text(s,'含津贴情景：70,000 ＋ 36,000津贴 ＋ 5,400缓冲 − 1,400取整差 ＝ 110,000',58,608,1160,55,23,true,C.primary);
//18 source links
s=pg('附录：来源与假设边界','来源核查于2026年9月12日，完整URL保存在各页备注','15%费率、RM5／千次、工时、6个月、客户目标及非研发预算均为假设。尚无已核验Wringy收入或自动化效果。',[18],Object.values(U).concat(sprout));
const sources=[['cr','Content Rewards · 品牌条款\ncontentrewards.com/brands-terms',U.cr],['whop','Whop · 自有奖励计划\nwhop.com/content-rewards-terms-of-service',U.whop],['mda','MDA · FY2025 数字广告\nmalaysiandigitalassociation.org.my',U.mda],['google','Google · 2025 马来西亚电商\nblog.google/intl/ms-my',U.google],['dosm','DOSM · 历史经营单位\ndosm.gov.my',U.dosm],['sprout','Sprout Social · 收购公告\ninvestors.sproutsocial.com',sprout]];
sources.forEach(([key,label,url],i)=>sourceLink(s,{key,label,url,slideNumber:18,x:58+(i%2)*594,y:255+Math.floor(i/2)*122,w:550,h:97},links));
await fs.writeFile(path.join(BUILD,'source-links.json'),JSON.stringify(links,null,2));
await fs.writeFile(path.join(ROOT,'story.md'),'# Wringy Content Rewards商业计划 v2\n\n2026-09-13 叙事与图示改版。数值沿用v1模型，70k/110k未选定。\n\n'+editorial.map(x=>`## ${x.slide} ${x.title}\n${x.subtitle}\n可见限定：${x.caveat}\n原内容依据：v1/story.md 第${x.original.join('、')}页\n来源：${x.sources.join('\n')}\n`).join('\n'));
await fs.writeFile(path.join(BUILD,'requirements.json'),JSON.stringify({slides:18,chartOwners:[4,5,6,12],tableOwners:[17],graphDominantSlides:[2,3,4,5,6,8,9,10,11,12,13,14,15,16],modelSource:'../content-rewards-business-v1/finance/results.json',markers:{pptx:1,pdf:1}},null,2));
await (await PresentationFile.exportPptx(p)).save(path.join(BUILD,'draft.pptx'));console.log('18 redesigned slides exported.');

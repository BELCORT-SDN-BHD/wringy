import {fs,path,ROOT,BUILD,PresentationFile,C,FONT,box} from './runtime.mjs';
import {createDeck,tx,rule,nativeTable,chart} from './template.mjs';
import {sourceLink} from './links.mjs';
const D=JSON.parse(await fs.readFile(path.join(BUILD,'content.json'))),U=JSON.parse(await fs.readFile(path.join(BUILD,'urls.json'))),F=JSON.parse(await fs.readFile(path.join(ROOT,'../content-rewards-business-v5/finance/results.json')));
if(!F.founder_allowance_policy.confirmed||F.uses.founder_allowance!==0||F.proposed_ask_rounded_5000!==70000)throw Error('Finance contract mismatch');
const p=createDeck(),links=[],assets={};for(const n of ['brand-source','creator-filming','published-content','founder-demo'])assets[n]=await fs.readFile(path.join(ROOT,'assets',n+'.png'));
const muted=C['muted-foreground'],hidden={visible:false,tickLabelPosition:'none',line:{fill:'none',width:0}},axis={textStyle:{typeface:FONT,fontSize:21,fill:muted},line:{fill:C.border,width:1}};
function text(s,t,x,y,w,h=70,size=28,bold=false,color=C.foreground){return tx(s,t,x,y,w,h,size,bold,color);}
function rect(s,x,y,w,h,fill){return s.shapes.add({geometry:'rect',position:box(x,y,w,h),fill,line:{fill:'none',width:0}});}
function photo(s,n,x,y,w,h){return s.images.add({blob:assets[n],contentType:'image/png',fit:'cover',position:box(x,y,w,h),alt:'AI生成的虚构饮料活动示意：'+n});}
function page({title=true,sub=true,foot=true}={}){const i=p.slides.items.length,d=D[i],s=p.slides.add();s.background.fill=C.background;if(title)text(s,d[0],56,39,1168,78,48,true);if(sub)text(s,d[1],58,129,1160,74,27,false,muted);if(foot)text(s,d[3],58,669,1095,30,15,false,muted);text(s,String(i+1).padStart(2,'0'),1171,670,51,27,15,false,muted);s.speakerNotes.textFrame.setText(d[4]+'\n\n'+d[5].join('\n'));return s;}
function caption(s,a,b,x,y,w){text(s,a,x,y,w,44,29,true,C.primary);if(b)text(s,b,x,y+52,w,84,24,false,muted);}
// 1 Full-height photographic hero and forest editorial panel
let s=page({title:false,sub:false,foot:false});photo(s,'brand-source',462,0,818,720);rect(s,0,0,462,720,C.primary);text(s,'Wringy的生意',45,65,381,96,46,true,C['primary-foreground']);text(s,'品牌付费\n创作者传播\n内容',45,228,380,224,50,true,C['primary-foreground']);text(s,'创作者按约获得奖励\nWringy收取服务费',47,488,365,98,27,false,C['primary-foreground']);text(s,'Content Rewards · Malaysia',47,615,380,45,23,false,C.brand);text(s,'AI示意 · 虚构饮料品牌',495,673,650,31,16,true,'#FFFFFF');
// 2 creator photo dominant, sparse rationale
s=page({sub:false});photo(s,'creator-filming',56,149,758,470);text(s,'品牌提供',863,174,359,73,36,true,C.primary);text(s,'授权素材\n活动预算',863,275,359,171,35,true);rule(s,863,483,345);text(s,'让创作者把内容\n带给相关受众',863,516,359,90,27,false,muted);
// 3 single transaction, editable allocation branches
s=page();photo(s,'brand-source',56,223,281,368);text(s,'品牌总支出',385,232,810,50,29);text(s,'RM2,300',385,290,810,94,65,true,C.primary);rule(s,385,414,818);
caption(s,'RM2,000','创作者按约获得奖励',385,445,497);caption(s,'RM300','Wringy服务收入',934,445,284);text(s,'授权素材供创作者制作发布，按约核验奖励。',385,590,822,57,27,false,C.primary);
// 4 recurring per-campaign pricing
s=page();text(s,'已确认奖励',58,230,510,51,28);text(s,'RM2,000 × 15%',58,296,920,98,61,true,C.primary);text(s,'服务费 RM300',880,316,342,75,34,true,C.primary);
chart(s,'bar',{position:box(56,399,1167,116),categories:['品牌支出'],series:[{name:'创作者奖励',values:[2000],fill:C.primary},{name:'外加服务费',values:[300],fill:C.brand}],barOptions:{direction:'bar',grouping:'stacked',overlap:100},hasLegend:false,xAxis:hidden,yAxis:{...hidden,min:0,max:2300}});
text(s,'按活动收费',58,555,550,55,32,true);text(s,'复购带来下一场服务收入',652,555,570,55,30,true);text(s,'处理工时决定服务费能留下多少贡献。',58,610,1164,44,25,false,muted);
// 5 native economic cost and contribution composition
s=page();text(s,'单场经济贡献',58,222,537,54,30);text(s,'RM180',58,293,576,108,74,true,C.primary);text(s,'贡献率 60%',58,420,570,72,40,true,C.primary);text(s,'人工RM90含RM60\n未领薪创办人劳动',58,533,570,91,28,false,muted);
chart(s,'bar',{position:box(648,238,562,128),categories:['服务收入300'],series:[{name:'人工',values:[90],fill:C['chart-2']},{name:'数据',values:[20],fill:'#A2B5AA'},{name:'收款',values:[10],fill:'#D1DBD5'},{name:'经济贡献',values:[180],fill:C.primary}],barOptions:{direction:'bar',grouping:'stacked',overlap:100},hasLegend:false,xAxis:hidden,yAxis:{...hidden,min:0,max:300}});
text(s,'收入 RM300',665,194,541,46,25,false,muted);text(s,'人工 90   数据 20   收款 10',665,391,546,59,28,true);rule(s,665,470,542);text(s,'经济成本 RM120',665,493,546,60,30);text(s,'余下贡献 RM180',665,563,546,62,31,true,C.primary);
// 6 brand repeat purchase, outcome-focused photo composition
s=page({sub:false});photo(s,'published-content',56,151,495,477);text(s,'品牌为何再投一笔预算',607,156,614,78,35,true,C.primary);
caption(s,'事前约定','明确传播目标与合格结果',607,270,614);caption(s,'活动结束','报告发布与核验结果，处理争议',607,430,614);text(s,'品牌根据结果决定是否复购',607,587,614,57,30,true,C.primary);
// 6 macro separated from modeled subset; no false TAM proportions
s=page({sub:false});text(s,'RM2.96bn',58,151,515,96,63,true,C.primary);text(s,'2025 马来西亚数字广告支出估算',579,174,640,61,29);rule(s,58,270,1163);text(s,'电商品牌子集算例',58,300,506,49,29,true);text(s,'约6,259个假设采购方\n× 年奖励RM24,000\n× 15%演示费率',58,371,506,147,31);text(s,'约 RM22.53m / 年',58,551,506,75,40,true,C.primary);
chart(s,'bar',{position:box(616,331,588,273),categories:['年奖励减半','年奖励24,000'],series:[{name:'年平台费容量（RM百万）',values:[11.266,22.532],fill:C.primary}],barOptions:{direction:'bar',grouping:'clustered'},hasLegend:false,xAxis:axis,yAxis:{...hidden,min:0,max:28},dataLabels:{showValue:true,position:'outEnd',textStyle:{fontSize:23,fill:C.primary}}});text(s,'平台费容量假设（RM百万／年）',638,602,570,37,21,false,muted);
// 4 factual comparison with photographic context
s=page();text(s,'Clipping',58,239,698,65,39,true,C.primary);text(s,'品牌购买全托管活动\n团队组织剪辑者网络',58,310,680,94,30);rule(s,58,425,707);text(s,'Content Rewards',58,456,698,65,39,true,C.primary);text(s,'品牌设奖励活动\n创作者投稿参与',58,527,680,94,30);photo(s,'published-content',833,221,390,409);
// 9 photo plus parallel acquisition paths, no conversion funnel
s=page({sub:false});photo(s,'founder-demo',56,150,374,479);text(s,'品牌',478,163,739,47,28,true,C.primary);const brand=['拜访','演示','付费试点','复购'];brand.forEach((t,i)=>{let x=478+i*187;text(s,String(i+1),x,232,171,48,29,true,C.primary);rule(s,x,293,162);text(s,t,x,314,172,60,28,true);});text(s,'创作者',478,415,739,48,28,true,C.primary);text(s,'招募    /    看规则    /    试做与投稿',478,477,739,64,29);text(s,'规划：20次访谈 · 3个付费品牌 · 至少1个复购',478,576,739,58,24,false,C.primary);
// 10 one proposed plan, zero founder cash confirmed
s=page({sub:false});text(s,'拟议',58,157,386,51,29,false,muted);text(s,'RM70,000',58,225,587,105,68,true,C.primary);text(s,'六个月研发与生意试点',58,359,499,69,33);text(s,'创办人薪资及津贴\nRM0，已确认',58,488,499,112,32,true,C.primary);
chart(s,'bar',{position:box(645,203,562,138),categories:['资金用途'],series:[{name:'研发',values:[F.rd_all_in_cap],fill:C.primary},{name:'非研发',values:[F.non_rd_spend_base],fill:C['chart-2']},{name:'储备',values:[F.ending_cash_if_all_rd_cap_spent],fill:C.brand}],barOptions:{direction:'bar',grouping:'stacked',overlap:100},hasLegend:false,xAxis:hidden,yAxis:{...hidden,min:0,max:70000}});caption(s,'50,000  研发','原型与可使用Beta，含5k预留',665,380,557);caption(s,'13,620  非研发','6,380  缓冲与取整储备',665,512,557);
// 11 conditions for expanding the business
s=page();const conditions=[['品牌愿意复购',0],['单场经济可行',1],['运营能够承接',2],['再议营销资金',3]];conditions.forEach(([t,i])=>{const x=58+i*295,y=475-i*63;rect(s,x,y,267,10,i===3?C.brand:C.primary);text(s,String(i+1).padStart(2,'0'),x,y-114,260,56,38,true,C.primary);text(s,t,x,y-50,267,58,28,true);});text(s,'扩量前同时重估获客成本和固定费用。',58,581,1165,67,31,false,C.primary);
// 12 long-term outlook with photo and demand branches, investment exit in note
s=page({sub:false});photo(s,'published-content',56,151,522,477);text(s,'长期经营价值',633,167,590,67,40,true,C.primary);text(s,'复购品牌、本地供给、可靠交付',633,245,590,73,27);rule(s,633,341,589);text(s,'按客户需要增加',633,371,589,53,27,false,muted);text(s,'品牌商业服务\n创作者商业服务',633,437,589,105,34,true);text(s,'潜在战略买方：营销软件、商业平台',633,587,589,52,25,false,C.primary);
// 13 manual-hour sensitivity, not company break-even
s=page();text(s,'人工 RM30／小时',58,268,470,65,33,true,C.primary);text(s,'数据与收款\n合计 RM30／场',58,371,470,107,30);text(s,'9小时\n单场贡献归零',58,522,470,105,33,true,C.primary);
chart(s,'line',{position:box(548,236,662,369),categories:['3小时','6小时','9小时','12小时'],series:[{name:'单场经济贡献RM',values:[180,90,0,-90],line:{fill:C.primary,width:4},fill:C.primary}],hasLegend:false,xAxis:axis,yAxis:{...axis,min:-100,max:200,majorUnit:100},dataLabels:{showValue:true,position:'above',textStyle:{fontSize:24,fill:C.foreground}}});
// 14 readable data appendix
s=page({sub:false});text(s,'市场输入',58,152,530,51,30,true,C.primary);text(s,'资金用途（RM）',665,152,551,51,30,true,C.primary);
nativeTable(s,[['输入','数值'],['2022电商经营单位','78,236'],['活跃／适配率假设','80%／10%'],['年奖励／演示费率','24,000／15%'],['年平台费容量假设','约22.53m']],{x:56,y:222,width:545,rowH:57,colWidths:[300,245],font:23});
nativeTable(s,[['用途','金额'],['研发（含5k预留）','50,000'],['地推／运营','4,500／2,400'],['云工具／维护','1,200／1,040'],['法务会计／数据收款','4,000／480'],['薪资与津贴','0'],['基础支出','63,620']],{x:662,y:222,width:562,rowH:52,colWidths:[355,207],font:22});text(s,'63,620 ＋ 2,043缓冲 ＋ 4,337取整储备 ＝ 70,000',58,606,1160,54,27,true,C.primary);
//15 links
s=page();const sourceRows=[['clipping','Clipping · 品牌活动\nclipping.net/brands'],['cr','Content Rewards · 品牌条款\ncontentrewards.com/brands-terms'],['whop','Whop · 奖励计划\nwhop.com/content-rewards-terms-of-service'],['mda','MDA · 数字广告\nmalaysiandigitalassociation.org.my'],['dosm','DOSM · 电商经营单位\ndosm.gov.my'],['google','Google · 马来西亚电商\nblog.google/intl/ms-my'],['sprout','Sprout Social · 收购公告\ninvestors.sproutsocial.com']];sourceRows.forEach(([key,label],i)=>sourceLink(s,{key,label,url:U[key],slideNumber:15,x:58+(i%2)*594,y:220+Math.floor(i/2)*105,w:550,h:86},links));
await fs.writeFile(path.join(BUILD,'source-links.json'),JSON.stringify(links,null,2));await (await PresentationFile.exportPptx(p)).save(path.join(BUILD,'draft.pptx'));console.log('v6 15 slides, 4 reused photos, 5 native charts, 2 tables');

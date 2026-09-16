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
function page({title=true,sub=true,foot=true,index=null}={}){const i=index??p.slides.items.length,d=D[i],s=p.slides.add();s.background.fill=C.background;if(title)text(s,d[0],56,39,1168,78,48,true);if(sub)text(s,d[1],58,129,1160,74,27,false,muted);if(foot)text(s,d[3],58,669,1095,30,15,false,muted);text(s,String(i+1).padStart(2,'0'),1171,670,51,27,15,false,muted);s.speakerNotes.textFrame.setText(d[4]+'\n\n'+d[5].join('\n'));return s;}
function caption(s,a,b,x,y,w){text(s,a,x,y,w,44,29,true,C.primary);if(b)text(s,b,x,y+52,w,84,24,false,muted);}

const G=JSON.parse(await fs.readFile(path.join(BUILD,'illustrative-ui-data.json')));
function link(s,key,label,page,x=58,y=640,w=370){sourceLink(s,{key,label,url:U[key],slideNumber:page,x,y,w,h:23},links);}
function node(s,label,x,y,w,h=65,{fill=C.background,size=27,color=C.primary,ellipse=false}={}){
 const n=s.shapes.add({geometry:ellipse?'ellipse':'rect',position:box(x,y,w,h),fill,line:{fill:C.primary,width:1.5}});
 n.text=label;n.text.style={typeface:FONT,fontSize:size,bold:true,color,alignment:'center',verticalAlignment:'middle',autoFit:'none'};return n;
}
function connect(s,a,b,{from='right',to='left',kind='elbow'}={}){return s.shapes.connect(a,b,{kind,fromSide:from,toSide:to,line:{fill:C['chart-2'],width:2},tail:{type:'arrow',width:'sm',length:'sm'}});}
let s;
const WHITE='#FFFFFF';
function windowUI(s,role){rect(s,56,211,846,423,C.border);rect(s,58,213,842,419,WHITE);rect(s,58,213,842,51,C.primary);text(s,'Wringy',76,219,203,40,25,true,WHITE);text(s,role,347,222,528,34,22,false,WHITE);}
function aside(s,title,body){text(s,title,948,236,276,117,33,true,C.primary);text(s,body,948,381,276,242,27,false,muted);}
function field(s,label,value,x,y,w){text(s,label,x,y,w,38,23,false,muted);text(s,value,x,y+42,w,68,43,true,C.primary);}
function button(s,label,x,y,w=238){rect(s,x,y,w,49,C.primary);text(s,label,x+14,y+5,w-28,42,23,true,WHITE);}
function brief(){s=page();windowUI(s,'商家简报 · 工作人员协助配置');text(s,'青柠饮料推广',80,283,790,54,35,true);photo(s,'brand-source',80,356,238,248);text(s,'传播目标',350,357,505,36,23,false,muted);text(s,'展示饮用场景与产品特点',350,399,505,65,29,true);rule(s,350,479,518);text(s,'授权素材',350,499,505,39,23,false,muted);text(s,'产品视频、图片与说明',350,543,505,54,28);aside(s,'传播目标\n与素材授权','商家交素材\n团队整理简报');link(s,'clipping','参考：Clipping公开服务说明',2);}
function budget(){s=page({index:2});windowUI(s,'商家确认 · 奖励与预算');text(s,'青柠饮料推广',80,281,790,55,35,true);field(s,'奖励上限','RM2,000',80,363,359);field(s,'每1,000次合格观看','RM5',494,363,371);rule(s,80,491,788);text(s,'满额算例',80,518,330,37,23,false,muted);text(s,'400,000 次合格观看',80,558,780,61,36,true,C.primary);aside(s,'服务费计法','外加服务费提案\n已确认奖励 × 15%\n\n未使用预算不计费。');}
function detail(){s=page();windowUI(s,'内容创作者 · 活动详情');photo(s,'brand-source',80,289,221,317);text(s,'青柠饮料推广',330,283,542,60,35,true);text(s,'RM5 / 1,000次合格观看',330,367,542,57,33,true,C.primary);text(s,'活动奖励上限 RM2,000',330,431,542,47,26);rule(s,330,501,538);text(s,'授权素材与发布要求',330,520,542,39,25);button(s,'查看素材与规则',330,565,263);aside(s,'参与条件\n与报酬','20,000次合格观看\n可对应 RM100\n\n奖励须符合规则\n及活动预算限制。');link(s,'clipper','参考：活动参与说明',4);}
function submit(){s=page();windowUI(s,'内容创作者 · 我的投稿');text(s,'青柠饮料推广',80,283,789,53,35,true);text(s,'公开视频链接',80,340,790,35,23,false,muted);rect(s,80,381,788,50,C.background);text(s,'https://social.example/clip/001',94,387,760,40,24);photo(s,'creator-filming',80,450,110,155);text(s,'片段01 · @lime_demo',219,447,637,39,25,true);field(s,'观看记录 · 待核验','22,000',219,493,301);field(s,'估计奖励','RM110',546,493,307);text(s,'待审核',724,582,141,34,21,true,C.primary);aside(s,'投稿待审核','金额为估算，\n经审核后确认。\n当前尚未付款。');}
function approve(){s=page();windowUI(s,'运营 · 人工核验记录');text(s,'单条投稿核验',80,283,790,56,35,true);text(s,'待核验观看 22,000',80,355,790,49,28);rule(s,80,417,788);field(s,'合格观看','20,000',80,441,360);field(s,'不计奖观看','2,000',495,441,370);text(s,'已确认奖励 RM100',80,570,459,47,28,true,C.primary);text(s,'已支付 RM0',567,570,295,47,28);aside(s,'人工核验结果','按活动规则核验\n不承诺自动识别作弊\n\n奖励已确认\n尚待付款');link(s,'terms','参考：内容创作者条款',6);}
function settle(){s=page();windowUI(s,'商家 · 活动支出示例');text(s,'青柠饮料推广',80,281,790,55,35,true);text(s,'已确认合格观看 400,000',80,344,790,43,25);text(s,'商家应付奖励 RM2,000',80,408,790,45,30,true);text(s,'Wringy服务费 RM300',80,462,790,45,30);chart(s,'bar',{position:box(79,520,790,57),categories:['商家支出'],series:[{name:'奖励',values:[2000],fill:C.primary},{name:'Wringy服务费',values:[300],fill:C.brand}],barOptions:{direction:'bar',grouping:'stacked',overlap:100},hasLegend:false,xAxis:hidden,yAxis:{...hidden,min:0,max:2300}});text(s,'商家活动总支出 RM2,300',80,581,790,43,29,true,C.primary);aside(s,'全活动\n奖励合计','已确认 RM2,000\n已支付 RM0\n待支付 RM2,000\n\n非单条投稿的奖励。');link(s,'payments','参考：奖励与付款说明',7);}
function results(){s=page();rect(s,56,211,1168,423,C.border);rect(s,58,213,1164,419,WHITE);rect(s,58,213,1164,51,C.primary);text(s,'Wringy',76,219,220,40,25,true,WHITE);text(s,'商家 · 结项报告示例',720,222,480,34,22,false,WHITE);text(s,'青柠饮料推广',80,277,790,46,30,true);
text(s,'合格观看',80,333,342,33,21,false,muted);text(s,'400,000',80,366,342,46,34,true,C.primary);text(s,'已支付奖励',436,333,342,33,21,false,muted);text(s,'RM2,000',436,366,342,46,34,true,C.primary);text(s,'Wringy服务费',914,333,279,33,21,false,muted);text(s,'RM300',914,366,279,46,34,true,C.primary);
chart(s,'line',{position:box(80,442,777,135),categories:G.days.map(n=>'第'+n+'天'),series:[{name:'累计合格观看（万次，示意）',values:G.cumulative_qualified_views.map(n=>n/10000),line:{fill:C.primary,width:3},fill:C.primary}],hasLegend:false,xAxis:{...axis,textStyle:{typeface:FONT,fontSize:17,fill:muted}},yAxis:{...axis,min:0,max:40,majorUnit:20,textStyle:{typeface:FONT,fontSize:17,fill:muted}}});text(s,'累计合格观看（万次，示意）',80,415,787,25,18,false,muted);rect(s,80,621,778,6,C.primary);text(s,'奖励预算：RM2,000 / RM2,000',80,588,787,27,18,true,C.primary);
photo(s,'creator-filming',920,435,64,66);text(s,'片段01',1001,432,191,31,21,true);text(s,'已纳入报告',1001,466,191,31,19,false,muted);photo(s,'published-content',920,527,64,66);text(s,'片段02',1001,524,191,31,21,true);text(s,'已纳入报告',1001,558,191,31,19,false,muted);}


// 1 Merchant/creator business, same hero
s=page({title:false,sub:false,foot:false});photo(s,'brand-source',462,0,818,720);rect(s,0,0,462,720,C.primary);text(s,'Wringy商业模式',45,65,381,96,46,true,C['primary-foreground']);text(s,'商家付费推广',45,224,380,85,44,true,C['primary-foreground']);text(s,'Content creator\n（内容创作者）',47,336,374,97,31,true,C['primary-foreground']);text(s,'发布内容，按约获奖励\nWringy收取服务费',47,489,365,98,27,false,C['primary-foreground']);text(s,'Content Rewards · Malaysia',47,615,380,45,23,false,C.brand);text(s,'AI示意 · 虚构饮料商家',495,673,650,31,16,true,'#FFFFFF');
brief();budget();detail();submit();approve();settle();results();
// 9 Market: background and assumed subset retain original chart values
s=page({sub:false});text(s,'RM2.96bn',58,151,515,96,63,true,C.primary);text(s,'2025 马来西亚数字广告支出估算',579,174,640,61,29);rule(s,58,270,1163);text(s,'电商经营者子集算例',58,300,506,49,29,true);text(s,'约6,259个假设采购方\n× 年奖励RM24,000\n× 15%演示费率',58,371,506,147,31);text(s,'约 RM22.53m / 年',58,551,506,75,40,true,C.primary);
chart(s,'bar',{position:box(616,331,588,273),categories:['年奖励减半','年奖励24,000'],series:[{name:'年平台费容量（RM百万）',values:[11.266,22.532],fill:C.primary}],barOptions:{direction:'bar',grouping:'clustered'},hasLegend:false,xAxis:axis,yAxis:{...hidden,min:0,max:28},dataLabels:{showValue:true,position:'outEnd',textStyle:{fontSize:23,fill:C.primary}}});text(s,'平台费容量假设（RM百万／年）',638,602,570,37,21,false,muted);link(s,'mda','来源：MDA 2025数字广告',9,58,640,380);link(s,'dosm','来源：DOSM电商经营单位',9,480,640,400);
// 10 Merchant distribution network, diagram quantities are not supply forecasts
s=page();photo(s,'brand-source',58,248,205,251);text(s,'授权产品素材',58,514,222,45,27,true,C.primary);
const material=node(s,'商家',294,341,132,75,{fill:C.primary,color:WHITE,size:29});
const audience=node(s,'受众观看\n与分享',962,323,230,112,{fill:C.brand,size:32});
const creatorNodes=[['内容创作者 A',237],['内容创作者 B',354],['内容创作者 C',471]].map(([label,y])=>node(s,label,580,y,258,65,{size:25}));
creatorNodes.forEach(n=>{connect(s,material,n);connect(s,n,audience);});text(s,'自然发布',615,176,250,42,25,true,C.primary);text(s,'自然观看（Organic）与分享',497,559,691,41,24,false,muted);text(s,'AI示意',58,567,205,25,16,false,muted);
rule(s,58,610,1161);text(s,'获客：创办人拜访   /   演示活动   /   付费试点   /   再次投放',58,624,1161,37,25,true,C.primary);
// 11 Creator earnings, vertical sequence and photo
s=page({sub:false});photo(s,'creator-filming',56,165,396,454);text(s,'20,000次合格观看',506,160,715,49,35,true,C.primary);text(s,'可对应 RM100 奖励',506,215,715,59,39,true,C.primary);
const earning=['选活动','剪辑发布','提交链接','审核后获得奖励'];let prev=null;
earning.forEach((label,i)=>{let n=node(s,String(i+1),519,302+i*77,49,49,{ellipse:true,fill:i===3?C.brand:C.background,size:23});if(prev)connect(s,prev,n,{from:'bottom',to:'top',kind:'straight'});text(s,label,605,306+i*77,576,46,28,true);prev=n;});
text(s,'招募：创作社群、校园及短视频内容创作者',58,627,1139,35,24,false,muted);
// 12 Funding as editable doughnut, same canonical amounts
s=page({sub:false});text(s,'拟议',58,157,386,51,29,false,muted);text(s,'RM70,000',58,225,587,105,68,true,C.primary);text(s,'六个月研发与付费试点',58,359,499,69,33);text(s,'创办人薪资及津贴\nRM0',58,488,499,112,32,true,C.primary);
chart(s,'doughnut',{position:box(607,161,365,365),categories:['研发','非研发','储备'],series:[{name:'资金用途RM',values:[F.rd_all_in_cap,F.non_rd_spend_base,F.ending_cash_if_all_rd_cap_spent],points:[{idx:0,fill:C.primary},{idx:1,fill:C['chart-2']},{idx:2,fill:C.brand}]}],hasLegend:false,doughnutOptions:{holeSize:70,firstSliceAngle:270}});
text(s,'资金用途',690,320,200,50,27,true,C.primary);rect(s,950,204,16,16,C.primary);rect(s,950,385,16,16,C['chart-2']);rect(s,950,467,16,16,C.brand);text(s,'50,000  研发',976,191,253,47,28,true,C.primary);text(s,'原型与可用Beta\n含5,000内部预留',976,245,253,88,23,false,muted);text(s,'13,620  非研发',976,372,253,47,26,true,C['chart-2']);text(s,'6,380  储备',976,454,253,47,26,true,C.primary);text(s,'储备含缓冲2,043及取整4,337',629,573,576,47,25,false,muted);
// 13 Two financing stages, actual operating conditions
s=page();text(s,'本轮：验证付费、交付与复购',58,228,773,50,33,true,C.primary);
const beta=node(s,'原型与Beta',58,321,218,74,{size:27});const pilot=node(s,'付费活动试点',333,321,250,74,{size:27});const repeat=node(s,'商家再次投放',641,321,250,74,{size:27});connect(s,beta,pilot);connect(s,pilot,repeat);
text(s,'内容创作者提交合格内容\n并按约获得奖励',333,438,549,100,29);text(s,'商家愿意再付费，审核与付款跟得上',58,578,814,46,27,true,C.primary);
rect(s,932,224,2,394,C.border);text(s,'条件成立后',973,226,251,51,28,false,muted);const expand=node(s,'下一轮\n全面扩张',973,302,251,112,{fill:C.brand,size:32});connect(s,repeat,expand,{kind:'straight'});text(s,'增加营销与运营投入\n融资金额尚未确定',973,488,251,106,25,false,muted);
// 14 Audience-specific future tools and possible income
s=page();const core=node(s,'Wringy\n内容奖励业务',58,311,234,109,{fill:C.primary,color:WHITE,size:31});
const merchant=node(s,'商家',402,244,219,67,{size:30});const creator=node(s,'内容创作者',402,463,219,67,{size:30});connect(s,core,merchant);connect(s,core,creator);
text(s,'网店与经营工具',690,238,529,49,33,true,C.primary);text(s,'线上店铺、商品与订单管理',690,299,529,53,27);text(s,'拟议收入：订阅／交易收费',690,365,529,48,26,false,muted);
text(s,'创作工具',690,460,529,49,33,true,C.primary);text(s,'剪辑、内容管理与变现工具',690,519,529,53,27);text(s,'拟议收入：订阅／增值工具收费',690,582,529,47,25,false,muted);
connect(s,merchant,text(s,'',648,258,12,12));connect(s,creator,text(s,'',648,477,12,12));
await fs.writeFile(path.join(BUILD,'source-links.json'),JSON.stringify(links,null,2));await (await PresentationFile.exportPptx(p)).save(path.join(BUILD,'draft.pptx'));console.log('v9 draft:14 slides,4 native charts,4 concept diagrams');

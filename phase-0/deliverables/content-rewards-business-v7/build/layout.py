from pathlib import Path
r=Path(__file__).resolve().parent
old=(r.parent.parent/'content-rewards-business-v6/build/build.mjs').read_text()
head=old.split('// 1 Full-height')[0].replace('foot=true}={}', 'foot=true,index=null}={}').replace('const i=p.slides.items.length,d=D[i]', 'const i=index??p.slides.items.length,d=D[i]')
parts=old.split('// ')
def part(prefix):
 return next('// '+x for x in parts[1:] if x.startswith(prefix))
ui=r"""
const G=JSON.parse(await fs.readFile(path.join(BUILD,'illustrative-ui-data.json')));
let s;
const WHITE='#FFFFFF';
function windowUI(s,role){rect(s,56,211,846,423,C.border);rect(s,58,213,842,419,WHITE);rect(s,58,213,842,51,C.primary);text(s,'Wringy',76,219,203,40,25,true,WHITE);text(s,role,347,222,528,34,22,false,WHITE);}
function aside(s,title,body){text(s,title,948,236,276,117,33,true,C.primary);text(s,body,948,381,276,242,27,false,muted);}
function field(s,label,value,x,y,w){text(s,label,x,y,w,38,23,false,muted);text(s,value,x,y+42,w,68,43,true,C.primary);}
function button(s,label,x,y,w=238){rect(s,x,y,w,49,C.primary);text(s,label,x+14,y+5,w-28,42,23,true,WHITE);}
function brief(){s=page();windowUI(s,'品牌简报 · 工作人员协助配置');text(s,'青柠饮料推广',80,283,790,54,35,true);photo(s,'brand-source',80,356,238,248);text(s,'传播目标',350,357,505,36,23,false,muted);text(s,'展示饮用场景与产品特点',350,399,505,65,29,true);rule(s,350,479,518);text(s,'授权素材',350,499,505,39,23,false,muted);text(s,'产品视频、图片与说明',350,543,505,54,28);aside(s,'先约定\n品牌要什么','品牌交素材\n团队整理简报');}
function budget(){s=page({index:2});windowUI(s,'品牌确认 · 奖励与预算');text(s,'青柠饮料推广',80,281,790,55,35,true);field(s,'奖励上限','RM2,000',80,363,359);field(s,'每1,000次合格观看','RM5',494,363,371);rule(s,80,491,788);text(s,'满额算例',80,518,330,37,23,false,muted);text(s,'400,000 次合格观看',80,558,780,61,36,true,C.primary);aside(s,'先看奖励\n再看服务费','外加服务费提案\n已确认奖励 × 15%\n\n未使用预算不计费。');}
function detail(){s=page();windowUI(s,'剪辑者 · 活动详情');photo(s,'brand-source',80,289,221,317);text(s,'青柠饮料推广',330,283,542,60,35,true);text(s,'RM5 / 1,000次合格观看',330,367,542,57,33,true,C.primary);text(s,'活动奖励上限 RM2,000',330,431,542,47,26);rule(s,330,501,538);text(s,'授权素材与发布要求',330,520,542,39,25);button(s,'查看素材与规则',330,565,263);aside(s,'参与条件\n与报酬','20,000次合格观看\n可对应 RM100\n\n先看规则与预算，\n再决定是否参加。');}
function submit(){s=page();windowUI(s,'剪辑者 · 我的投稿');text(s,'青柠饮料推广',80,283,789,53,35,true);text(s,'公开视频链接',80,340,790,35,23,false,muted);rect(s,80,381,788,50,C.background);text(s,'https://social.example/clip/001',94,387,760,40,24);photo(s,'creator-filming',80,450,110,155);text(s,'片段01 · @lime_demo',219,447,637,39,25,true);field(s,'观看记录 · 待核验','22,000',219,493,301);field(s,'估计奖励','RM110',546,493,307);text(s,'待审核',724,582,141,34,21,true,C.primary);aside(s,'提交链接后\n才开始核验','这里只是估计。\n审核可以调整金额，\n尚未确认或付款。');}
function approve(){s=page();windowUI(s,'运营 · 人工核验记录');text(s,'单条投稿核验',80,283,790,56,35,true);text(s,'待核验观看 22,000',80,355,790,49,28);rule(s,80,417,788);field(s,'合格观看','20,000',80,441,360);field(s,'不计奖观看','2,000',495,441,370);text(s,'已确认奖励 RM100',80,570,459,47,28,true,C.primary);text(s,'已支付 RM0',567,570,295,47,28);aside(s,'确认金额\n保留调整原因','依事前规则核验。\n人工审核不代表\n自动识别作弊。\n\n确认后仍需付款。');}
function settle(){s=page();windowUI(s,'品牌 · 活动支出示例');text(s,'青柠饮料推广',80,281,790,55,35,true);text(s,'已确认合格观看 400,000',80,344,790,43,25);text(s,'品牌应付奖励 RM2,000',80,408,790,45,30,true);text(s,'Wringy服务费 RM300',80,462,790,45,30);chart(s,'bar',{position:box(79,520,790,57),categories:['品牌支出'],series:[{name:'奖励',values:[2000],fill:C.primary},{name:'Wringy服务费',values:[300],fill:C.brand}],barOptions:{direction:'bar',grouping:'stacked',overlap:100},hasLegend:false,xAxis:hidden,yAxis:{...hidden,min:0,max:2300}});text(s,'品牌活动总支出 RM2,300',80,581,790,43,29,true,C.primary);aside(s,'全活动\n奖励合计','已确认 RM2,000\n已支付 RM0\n待支付 RM2,000\n\n非单条投稿的奖励。');}
function results(){s=page();rect(s,56,211,1168,423,C.border);rect(s,58,213,1164,419,WHITE);rect(s,58,213,1164,51,C.primary);text(s,'Wringy',76,219,220,40,25,true,WHITE);text(s,'品牌 · 结项报告示例',720,222,480,34,22,false,WHITE);text(s,'青柠饮料推广',80,277,790,46,30,true);
text(s,'合格观看',80,333,342,33,21,false,muted);text(s,'400,000',80,366,342,46,34,true,C.primary);text(s,'已支付奖励',436,333,342,33,21,false,muted);text(s,'RM2,000',436,366,342,46,34,true,C.primary);text(s,'Wringy服务费',914,333,279,33,21,false,muted);text(s,'RM300',914,366,279,46,34,true,C.primary);
chart(s,'line',{position:box(80,442,777,135),categories:G.days.map(n=>'第'+n+'天'),series:[{name:'累计合格观看（万次，示意）',values:G.cumulative_qualified_views.map(n=>n/10000),line:{fill:C.primary,width:3},fill:C.primary}],hasLegend:false,xAxis:{...axis,textStyle:{typeface:FONT,fontSize:17,fill:muted}},yAxis:{...axis,min:0,max:40,majorUnit:20,textStyle:{typeface:FONT,fontSize:17,fill:muted}}});text(s,'累计合格观看（万次，示意）',80,415,787,25,18,false,muted);rect(s,80,621,778,6,C.primary);text(s,'奖励预算：RM2,000 / RM2,000',80,588,787,27,18,true,C.primary);
photo(s,'creator-filming',920,435,64,66);text(s,'片段01',1001,432,191,31,21,true);text(s,'已纳入报告',1001,466,191,31,19,false,muted);photo(s,'published-content',920,527,64,66);text(s,'片段02',1001,524,191,31,21,true);text(s,'已纳入报告',1001,558,191,31,19,false,muted);}

if(process.argv.includes('--sample')){budget();await (await PresentationFile.exportPptx(p)).save(path.join(BUILD,'ui-sample.pptx'));console.log('Brand budget UI sample ready');}else{
"""
cover=part('1 Full-height').replace('let s=','s=').replace('品牌付费\\n创作者传播\\n内容','品牌付费\\n创作者传播')
cost=part('5 native economic')
market=part('6 macro')
reference=part('4 factual')
brand=r"""// Brand acquisition
s=page({sub:false});photo(s,'founder-demo',56,150,424,477);text(s,'先找有素材和试点预算的品牌',523,155,699,81,33,true,C.primary);const brand=['地推演示','明确目标','付费试点','争取复购'];brand.forEach((t,i)=>{const x=523+i*177;text(s,String(i+1),x,300,160,43,28,true,C.primary);rule(s,x,359,153);text(s,t,x,384,160,80,26,true);});text(s,'规划：20次访谈 / 3个付费品牌 / 至少1个复购',523,525,696,93,27,false,C.primary);
// Clipper earning-opportunity recruitment
s=page({sub:false});photo(s,'creator-filming',56,150,424,477);text(s,'社群、校园创作圈与短视频创作者',523,155,699,81,31,true,C.primary);text(s,'20,000次合格观看可对应 RM100',523,272,699,61,31,true);text(s,'讲解规则与素材，支持第一次合格投稿。',523,368,699,83,29);rule(s,523,480,696);text(s,'有预算的后续活动与可靠付款，\n才有持续参与的理由。',523,521,699,98,29,true,C.primary);
"""
funding=part('10 one proposed');expand=part('11 conditions');exit=part('12 long-term');hours=part('13 manual-hour');tables=part('14 readable').split('//15 links')[0]
tail="""// Source appendix, primary reading paths
s=page();const sourceRows=[['clipping','Clipping 品牌服务\\nclipping.net/brands'],['clipper','Clipping 活动与投稿\\nclipping.net/docs/clippers/campaign-detail'],['payments','Clipping 收益与付款\\nclipping.net/docs/clippers/payments'],['terms','Clipping 剪辑者条款\\nclipping.net / Clipper terms'],['mda','MDA 数字广告\\nmalaysiandigitalassociation.org.my'],['dosm','DOSM 电商经营单位\\ndosm.gov.my'],['cr','Content Rewards 品牌条款\\ncontentrewards.com/brands-terms'],['sprout','Sprout Social 收购公告\\ninvestors.sproutsocial.com']];sourceRows.forEach(([key,label],i)=>sourceLink(s,{key,label,url:U[key],slideNumber:19,x:58+(i%2)*594,y:220+Math.floor(i/2)*105,w:550,h:86},links));
await fs.writeFile(path.join(BUILD,'source-links.json'),JSON.stringify(links,null,2));await (await PresentationFile.exportPptx(p)).save(path.join(BUILD,'draft.pptx'));console.log('v7 draft:19 slides,6 native charts,2 tables,7 concept UI views');}
"""
(r/'build.mjs').write_text(head+ui+cover+'\nbrief();budget();detail();submit();approve();settle();results();\n'+cost+market+reference+brand+funding+expand+exit+hours+tables+tail)
(r/'run-final.mjs').write_text("import {finalize} from './finalize.mjs';\nimport {BUILD,ROOT,path} from './runtime.mjs';\nawait finalize(path.join(BUILD,'linked.pptx'),path.join(ROOT,'output/Wringy-Content-Rewards-Business-Plan.pptx'),{count:19,charts:[7,8,9,10,14,17],tables:[18]});\n")

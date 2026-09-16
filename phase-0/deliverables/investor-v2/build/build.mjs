import fs from 'node:fs/promises';
import path from 'node:path';
import { GlobalFonts } from '@napi-rs/canvas';
import { Presentation, PresentationFile, FileBlob } from '@oai/artifact-tool';
import { finalizePresentation, applyPresentationChartFont } from '${HOME}/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations/container_tools/artifact_tool_utils.mjs';

const ROOT=path.resolve(import.meta.dirname,'..');
const BUILD=import.meta.dirname;
const SKILL='${HOME}/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations';
const PY='${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const FONT='Noto Sans SC';
GlobalFonts.registerFromPath(path.resolve(ROOT,'../brand/showcase/fonts/NotoSansSC.ttf'),FONT);
const tokens=JSON.parse(await fs.readFile(path.resolve(ROOT,'../../foundation/design-tokens-v1.json'),'utf8'));
const C={bg:tokens.color.canvas,ink:tokens.color.ink,blue:tokens.color.accent,muted:tokens.color.muted,rule:tokens.color.line,white:tokens.color.surface};
const p=Presentation.create({slideSize:{width:1280,height:720}});
const records=[];
const copy=new Map();
const refs={
 blueprint:'phase-0/foundation/investor-product-blueprint.md',
 founder:'phase-0/founder-inputs.md',
 map:'phase-0/foundation/product-map.md',
 budget:'phase-0/foundation/belcort-handoff-v1.md',
 googleMY:'https://blog.google/intl/ms-my/company-news/around-the-globe/2025_11_e-conomy-sea-report-2025-malaysias/',
 googleSEA:'https://blog.google/company-news/inside-google/around-the-globe/google-asia/sea-economy-2025/',
 report:'https://services.google.com/fh/files/misc/e_conomy_sea_2025_report.pdf',
 cr:'https://contentrewards.com/',
 pp:'https://www.partipost.com/markets/malaysia',
 yc:'https://www.ycombinator.com/blog/how-to-design-a-better-pitch-deck/',
 seq:'https://sequoiacap.com/article/writing-a-business-plan'
};
function text(s,str,x,y,w,h,size=28,color=C.ink,bold=false){
 if(!copy.has(s))copy.set(s,[]);copy.get(s).push(str);
 const q=s.shapes.add({geometry:'textbox',name:str.slice(0,35),position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 q.text=str;q.text.style={typeface:FONT,fontSize:size,color,bold,autoFit:'none',verticalAlignment:'top'};return q;
}
function slide(title,foot,notes,bg=C.bg){
 const s=p.slides.add();s.background.fill=bg; const n=records.length+1;
 text(s,title,72,52,1136,78,44,C.ink,true);
 text(s,foot,72,644,1080,46,16,C.muted);
 text(s,String(n),1160,644,48,32,16,C.muted);
 s.speakerNotes.textFrame.setText(notes);
 records.push({number:n,title,foot,notes,slide:s});return s;
}
function pair(s,x,y,w,label,body){text(s,label,x,y,w,44,30,C.blue,true);text(s,body,x,y+64,w,146,28);}
function table(s,values,x,y,w,h,widths,size=25){
 if(!copy.has(s))copy.set(s,[]);copy.get(s).push(values.map((r,i)=>'| '+r.join(' | ')+' |'+(i===0?'\n| '+r.map(()=> '---').join(' | ')+' |':'')).join('\n'));
 const t=s.tables.add({rows:values.length,columns:values[0].length,left:x,top:y,width:w,height:h,columnWidths:widths,values});
 t.borders.assign({fill:C.rule,width:0.6,style:'solid'});
 t.cells.block({row:0,column:0,rowCount:values.length,columnCount:values[0].length}).assign({fill:C.bg,textStyle:{typeface:FONT,fontSize:size,color:C.ink},margins:{left:15,right:12,top:12,bottom:12}});
 for(let r=0;r<values.length;r++)t.rows[r].height=h/values.length;
 for(let c=0;c<values[0].length;c++){t.getCell(0,c).fill=C.blue;t.getCell(0,c).text.style={typeface:FONT,fontSize:size,color:C.white,bold:true};}
 return t;
}

// 01 Company purpose. Typography is editable. No fake product screenshot.
{
 const s=p.slides.add();s.background.fill=C.bg;
 text(s,'Wringy',72,110,1050,140,100,C.blue,true);
 text(s,'让品牌与创作者\n把内容合作做成可重复的生意',72,280,1110,150,48,C.ink,true);
 text(s,'马来西亚起步，面向东南亚的创作者商业平台',76,496,1090,48,28);
 text(s,'投资讨论稿   2026.09.10   首发范围与商业模式待验证',76,644,1080,40,16,C.muted);
 text(s,'1',1160,644,48,32,16,C.muted);
 const notes=`建议定位，不是现有产品能力。当前无获批商业模式、客户证明或产品代码。品牌 Wringy、马来西亚起步、长期完整 Whop 对标来自创始人输入。\n来源：${refs.founder}\n${refs.blueprint}\n内容结构参考：${refs.seq}\n${refs.yc}`;
 s.speakerNotes.textFrame.setText(notes);records.push({number:1,title:'Wringy：内容合作与创作者商业',foot:'投资讨论稿，未获批准',notes,slide:s});
}
// 02 Problem hypothesis
{
 const s=slide('内容验收与报酬规则，需要提前讲清楚','问题假设。尚无 Wringy 客户访谈或采购记录支持。',`首批客户尚未选择。以下为可验证问题假设，不能写成客户原话。\n${refs.blueprint}`);
 pair(s,72,198,500,'品牌方','要求反复沟通，作品分散提交。\n确认哪些内容合格后，\n还要逐笔核对报酬。');
 pair(s,696,198,500,'创作者','开拍前，需要知道验收标准。\n提交之后，需要知道审核进度\n和何时能够收到报酬。');
 text(s,'例如：一轮产品演示内容合作，双方能否在开拍前说清“合格”的定义？',72,534,1130,72,28,C.ink,true);
}
// 03 Why now
{
 const s=slide('视频正在成为电商交易的重要入口','来源：Google / Temasek / Bain，2025 年估算。交易额不等于创作者预算或 Wringy 收入。',`2026-09-10重新核查Google发行方网页。马来西亚2025电商GMV预计USD20bn，同比增长21%。区域视频电商预计占电商GMV25%。区域原研究按SEA六国分析，详见报告第15页及本地市场研究。这里只用作背景，不推算可获取市场。\n${refs.googleMY}\n${refs.googleSEA}\n${refs.report}\nphase-0/deliverables/research/sea-market.md`);
 text(s,'25%',72,196,580,140,104,C.blue,true);
 text(s,'2025 年东南亚视频电商\n占电商交易总额的预计比例',78,356,540,110,30);
 text(s,'US$200亿',718,218,490,100,64,C.ink,true);
 text(s,'2025 年马来西亚电商预计交易额\n同比增长 21%',724,356,480,110,28);
 text(s,'下一步要验证：哪些品牌愿意为内容合作管理单独付费。',78,542,1120,56,28,C.ink,true);
}
// 04 Editable concept flow
{
 const s=slide('首发候选：按合格帖子支付固定报酬','建议候选，未冻结。UGC 指创作者按品牌要求制作的原创内容。',`建议第一轮采用邀请制品牌原创UGC、原稿预审后自行发布、最终人工审核及按获批帖子固定付费。CPM按每千次观看计酬属于未来候选，不在建议V1范围内。概念流程，不是实际产品或交易。付款路径、权利、争议机制须在PRD冻结。\n${refs.blueprint}`);
 const a=[['01','接受邀请','邀请制活动\n确认规则与名额'],['02','原稿预审','品牌提出修改\n获准后才可发布'],['03','自行发布','指定平台与账号\n提交公开链接'],['04','最终验收','人工核对作品\n获批后记录奖励'],['05','核对付款','满足条件后付款\n核实支付结果']];
 a.forEach((v,i)=>{const x=72+i*232;text(s,v[0],x,208,198,80,52,C.blue,true);text(s,v[1],x,321,198,46,30,C.ink,true);text(s,v[2],x,399,205,120,24);});
 text(s,'内容获批、符合付款条件、已付款，三者分别记录。',72,555,1136,54,28,C.ink,true);
}
// 05 Experience concept
{
 const s=slide('同一次合作，双方看到同一份履约记录','概念界面与金额示例，未上线。活动、作品与金额均非真实交易。',`截图来源：phase-0/foundation/design-preview.html。截图为静态概念，仅用于状态设计审阅，不是生产产品。概念示例：一家食品品牌计划收集10条产品演示短片，每条验收通过奖励RM100。拍摄、授权、发布及商业披露按活动规则确认。审核通过与支付成功分开记录，不能将页面状态当作银行到账。资金路径未决。\n${refs.blueprint}`);
 text(s,'10 条合格短片',72,214,360,52,32,C.blue,true);
 text(s,'每条 RM100\n奖励预算 RM1,000',72,290,370,110,33,C.ink,true);
 s.images.add({blob:new Uint8Array(await fs.readFile(path.resolve(ROOT,'../../foundation/design-preview-assets/screen-2-desktop.png'))),contentType:'image/png',alt:'Wringy设计草稿真实截图，创作者提交状态，未上线',fit:'contain',position:{left:473,top:166,width:735,height:424}});
 text(s,'预审获准发布\n最终作品获批\n符合付款条件\n支付结果核对',76,452,350,166,27);
 text(s,'设计草稿截图，非实际产品',486,603,710,28,17,C.muted);
}
// 06 Bottom-up opportunity
{
 const s=slide('市场空间要从重复付费的品牌数推导','内部算例，非市场规模、客户预测或报价。年活动次数、预算、费率均待验证。',`算例：每100家全年活跃品牌，每家每年4次，每次奖励RM1000，服务费为奖励的10%，品牌另外承担服务费。奖励流量RM400k，平台服务收入RM40k，未扣直接成本和固定开支。100家不是已获客或可触达客户数。可服务市场仍需合格品牌名单与预算访谈。\n${refs.blueprint}\n市场估算方法参考 https://www.ycombinator.com/blog/practical-design-pitching/`);
 text(s,'每 100 家活跃付费品牌',72,181,1120,64,38,C.ink,true);
 text(s,'100 × 4 次／年 × RM1,000 × 10%',72,278,1130,80,44,C.blue,true);
 text(s,'RM40,000',72,407,640,110,76,C.blue,true);
 text(s,'示例年度服务收入\n对应奖励总额 RM400k',752,426,430,96,28);
 text(s,'当前缺口：符合条件的品牌数量、真实采购预算，以及再次付费的比例。',72,568,1134,50,26);
}
// 07 Native economics chart
{
 const s=slide('每场活动能留下多少，要把人工成本算进去','单场内部算例，非实际利润。奖励 RM1,000，另收服务费 RM100，品牌合计 RM1,100。',`服务费10%仅为算例，品牌另付、创作者不扣平台费。支付成本占位RM20，审核支持1小时×RM60=RM60，争议损失占位RM10，共RM90；服务收入RM100减去RM90，贡献RM10，贡献率10%。贡献未扣开发、获客、固定运营和税费，不是公司净利润。支付准入、费用承担方、收款方式均未决。不是支付商费率。\n${refs.blueprint}`);
 const chart=s.charts.add('bar',{position:{left:64,top:206,width:746,height:357},categories:['支付成本占位','审核与支持','争议损失占位','剩余贡献'],series:[{name:'服务费分解（RM）',values:[20,60,10,10],fill:C.blue,points:[{idx:0,fill:'#B4BBD0'},{idx:1,fill:'#8793B5'},{idx:2,fill:'#D8DCE6'},{idx:3,fill:C.blue}]}],barOptions:{direction:'bar',grouping:'clustered',gapWidth:70},hasLegend:false,xAxis:{visible:true,numberFormatCode:'0',majorGridlines:null,textStyle:{typeface:FONT,fontSize:20,fill:C.muted}},yAxis:{visible:true,textStyle:{typeface:FONT,fontSize:23,fill:C.ink},majorGridlines:null},dataLabels:{showValue:true,position:'outEnd',textStyle:{typeface:FONT,fontSize:24,fill:C.ink}},chartFill:C.bg,plotAreaFill:C.bg});applyPresentationChartFont(chart,{fontFamily:FONT});
 text(s,'RM10',885,241,325,100,66,C.blue,true);
 text(s,'每场示例剩余贡献\n尚未扣固定开支',891,365,310,100,27);
 text(s,'审核若多花 10 分钟，示例贡献便归零。',72,578,1110,50,27,C.ink,true);
}
// 08 GTM
{
 const s=slide('先获得付费活动，再围绕活动招募创作者','建议验证计划，非已建立渠道。首批行业、品牌名单及投入上限待确认。',`建议客群是有持续产品演示内容需求的马来西亚消费品牌，先选一个细分行业。例子是食品饮料，但不表示首批行业已获批准。试点样本与门槛待创始人确认，不能声称拥有创作者社群或付费管道。\n${refs.blueprint}`);
 pair(s,72,205,508,'品牌端先验证采购','从一个细分行业访谈采购者。\n获取真实需求与预算，\n邀请愿意付费的品牌试点。');
 pair(s,708,205,486,'创作者围绕需求加入','按语言、题材和交付能力招募。\n记录合格提交与退出原因，\n再邀请参与下一轮活动。');
 text(s,'首批行业建议从消费品筛选。食品演示仅作候选例子。',72,541,1130,68,30,C.ink,true);
}
// 09 Stage
{
 const s=slide('当前处于方案阶段，商业验证尚未发生','截至 2026.09.10。研究完成、概念完成与真实客户采用必须分开。',`已有创始人方向输入、Whop全12板块公开研究、Content Rewards新版研究、预算蓝图和本轮基础草稿。没有可核验付费或复购证据，没有已上线产品代码或获批商业模型。设计概念不计为traction。\n${refs.founder}\n${refs.map}\n${refs.blueprint}`);
 pair(s,72,200,500,'已有依据','完整平台方向与首发国家。\nWhop / Content Rewards 研究。\n产品基础与预算讨论稿。');
 pair(s,708,200,486,'下一轮需要的证据','实际付款与合格作品交付。\n品牌在约定窗口内再次付费。\n每场人工时间与剩余贡献。');
 text(s,'下一里程碑：把一次付费交付，变成可核验的重复采购。',72,535,1128,78,32,C.blue,true);
}
// 10 Competition
{
 const s=slide('Wringy 需要证明更适合哪类客户','竞品为官网公开能力，非独立性能测试。Wringy 一栏是拟验证方向。',`Content Rewards官网：CPM、per-post、retainer，团队、多品牌、审核和支付公开描述。Partipost Malaysia官网：活动管理、内容审核与批准、本地创作者合作。人工协作是流程比较假设，不代表所有代理商的能力。未使用竞品规模数字或客户logo。\n${refs.cr}\n${refs.pp}\n核查2026-09-10。`);
 table(s,[['方案','已知做法 / 拟议做法','Wringy 要证明什么'],['Content Rewards','多种计酬与活动审核','本地品牌为何愿意迁移'],['Partipost Malaysia','本地创作者活动与内容审核','能否更适合某类重复采购'],['人工协作 / 代理商','流程随服务方而异','是否减少协调成本与争议'],['Wringy（候选）','固定按帖、人工审核、清楚记录','付费、复购及单位成本改善']],72,196,1136,373,[290,408,438],25);
 text(s,'“本地化”需要采购与履约证据，不能直接写成竞争壁垒。',72,589,1130,42,26);
}
// 11 Expansion
{
 const s=slide('长期覆盖完整平台，扩展以重复交易为依据','三阶段为规划建议，不是已批准路线图。完整 12 板块见附录。',`长期方向来自创始人明确授权，范围覆盖整个Whop公开版图。Rewards仅为首发候选。阶段进入条件是建议，不能声称已具网络效应。统一账号、履约与账务记录可作为候选复用基础，具体架构尚未批准。\n${refs.map}\n${refs.blueprint}`);
 pair(s,72,217,340,'01  合作入口','先验证马来西亚\n品牌内容合作。\n条件：付费与复购。');
 pair(s,462,217,340,'02  经营工具','按真实需求扩展\n店铺、会员与推广。\n条件：相邻需求付费。');
 pair(s,854,217,340,'03  区域平台','进入更多东南亚国家，\n逐步覆盖全部板块。\n条件：本地履约可行。');
 text(s,'扩大的依据是可复用的业务能力，以及每个新市场的实际需求。',72,558,1130,62,28,C.ink,true);
}
// 12 Ownership
{
 const s=slide('Wringy 负责商业与产品，Belcort 承接开发','Belcort 为创始人自有的关联公司。未签交付协议、未确认团队配置或报价。',`Belcort关联关系为创始人现场确认。Wringy不自聘开发团队。没有提供可核实的创始人履历或团队交付业绩，故不编造。按项目市场价编列预算不是实际关联交易价格。\n${refs.founder}\n${refs.blueprint}\n${refs.budget}`);
 pair(s,72,201,510,'Wringy','用户与商业选择、试点招募。\n活动规则、审核运营与验收。\n创始人负责最终决策。');
 pair(s,708,201,482,'Belcort','技术评估、实现与测试。\n部署交接及约定的维护。\n资源与价格随范围确认。');
 text(s,'正式交付前明确代码权利、账号归属、里程碑与维护边界。',72,541,1130,70,30,C.blue,true);
}
// 13 Native budget chart
{
 const s=slide('首版技术建设暂估约 RM125k–270k','规划估算，含 15% 开发预备金，非 Belcort 报价。首发范围和第三方准入未确认。',`低1080小时×RM100×1.15=124200。基准1320×125×1.15=189750。高1560×150×1.15=269100。图为千MYR四舍五入至一位小数。需求梳理和核心设计已包含，不能重复计费。假设响应式Web、三角色、单一计酬、人工审核、标准支付接入可获批。排除原生App、完整12模块、持牌自建钱包及保证社交数据接口。计划12–20周非承诺。\n${refs.blueprint}`);
 const chart=s.charts.add('bar',{position:{left:62,top:202,width:697,height:380},categories:['低','基准','高'],series:[{name:'开发预算（千令吉）',values:[124.2,189.75,269.1],fill:C.blue,points:[{idx:0,fill:'#AFB8D3'},{idx:1,fill:C.blue},{idx:2,fill:'#8997BC'}],valuesFormatCode:'0.0'}],barOptions:{direction:'column',grouping:'clustered',gapWidth:105},hasLegend:false,xAxis:{textStyle:{typeface:FONT,fontSize:23,fill:C.ink},majorGridlines:null},yAxis:{visible:true,min:0,max:300,majorUnit:100,numberFormatCode:'0',textStyle:{typeface:FONT,fontSize:19,fill:C.muted},majorGridlines:{fill:C.rule,width:0.5}},dataLabels:{showValue:true,position:'outEnd',textStyle:{typeface:FONT,fontSize:24,fill:C.ink}},chartFill:C.bg,plotAreaFill:C.bg});applyPresentationChartFont(chart,{fontFamily:FONT});
 text(s,'单位：千令吉',76,170,500,32,19,C.muted);
 text(s,'约 RM190k',819,218,389,87,55,C.blue,true);
 text(s,'基准开发预算',825,316,370,43,27);
 text(s,'验收重点\n完整活动与审核流程\n金额、失败与争议可核对\n部署、回退与交接',825,397,370,192,26);
}
// 14 Close
{
 const s=slide('Wringy 的长期方向：东南亚创作者商业平台','投资与试点合作讨论。融资金额、交易条款及首发规则尚未批准。',`邀请投资人与试点品牌讨论验证计划。wringy.com仅为创始人确认品牌域名，不表示产品已上线。不编造联系邮箱或电话。长期整个Whop方向不因首发候选收窄。\n${refs.founder}\n${refs.map}`);
 text(s,'让一次内容合作，\n成为持续经营的起点',72,216,1090,172,60,C.blue,true);
 text(s,'本阶段希望与试点品牌验证付费和复购，\n与投资人讨论达到下一证据里程碑所需的资源。',76,456,1090,104,30);
 text(s,'wringy.com',76,583,1060,42,27,C.ink,true);
}
// A1 Native source and calculation table
{
 const s=slide('附录 A：市场事实与测算边界','资料核查：2026.09.10。来源与详细口径见讲者备注及配套内容稿。',`事实1：Google Malaysia发布于2025-11-28，200亿美元为2025电商GMV预计值。\n${refs.googleMY}\n事实2：Google区域发布于2025-11-11，2025视频电商占比预计25%，报告第15页。\n${refs.googleSEA}\n${refs.report}\n交易额不等于创作者预算。Wringy市场测算为内部算例。100×4×1000=400000奖励流量；再×10%=40000服务收入，费率采用另收口径。`);
 table(s,[['数字','口径','能说明什么'],['US$200 亿','马来西亚，2025 电商交易额估算','当地电商活动基础'],['约 25%','东南亚，2025 视频电商占比估算','视频与交易的关系'],['RM40k / 年','100 家 × 4 场 × RM1k × 10%','收费模型算例，不是市场规模']],72,182,1136,304,[240,496,400],24);
 text(s,'可服务市场仍待建立：合格品牌名单 × 可验证预算 × 可获得的付费比例。',72,529,1130,88,28,C.ink,true);
}
// A2 Complete scope
{
 const s=slide('附录 B：长期完整 12 板块均保留','来自全平台产品总图。规划分类不代表 Whop 内部架构，具体建设顺序未批准。',`${refs.map}\n所有12板块保留，Creator Rewards候选归属品牌与创作者合作。钱包、出款、身份和风险等区域能力仍需单独核验，不能把长期范围写成首发功能承诺。`);
 table(s,[['交易与经营','增长与资金','信任与平台'],['01 账户、团队、店铺与商品','05 商城、发现与信任展示','09 钱包、账务与出款'],['02 结账、订阅与账单','06 品牌与创作者合作','10 身份核验、风险与争议'],['03 会员权益与交付','07 推广联盟、伙伴与分成','11 开发者、应用与企业接入'],['04 客户、客服与经营分析','08 广告与营销归因','12 AI 创业与经营支持']],72,201,1136,350,[379,379,378],23);
 text(s,'首发排序只决定先证明哪条业务链，长期范围保持完整。',72,583,1130,44,27,C.blue,true);
}
// A3 Funding planning from main source only
{
 const s=slide('附录 C：18 个月内部资金规划','零收入假设。前 4 个月建设、后 14 个月运营。非融资请求，未覆盖全部交易相关成本。',`主任务提供的唯一源：${refs.budget}\n基准：开发189750；商业运营18×12000=216000；上线后技术14×5000=70000；启动50000；非开发15%缓冲=(216000+70000+50000)×15%=50400。合计576150，简写约580k。低366850、高869400。开发自身15%已计入，不再重复加。不是Belcort报价，不代表选定招聘人数。需另补交易成本、税费、资金路径、监管咨询与营运净资金需求，扣创始人投入和可信净现金收入后才谈真实融资。与建设加上线后12个月约250k技术费口径不同。`);
 table(s,[['基准用途','令吉 MYR'],['开发（已含开发预备金）','189,750'],['商业与运营（18 个月）','216,000'],['上线后技术（14 个月）','70,000'],['获客试验与启动','50,000'],['非开发支出 15% 缓冲','50,400'],['合计','576,150']],72,179,708,400,[500,208],23);
 text(s,'RM580k',845,215,367,98,64,C.blue,true);
 text(s,'18 个月内部基准\n未选定人员配置',851,337,350,90,27);
 text(s,'交易成本与税费须补报价。\n资金路径确认后，\n再确定融资需求。',851,486,350,109,26);
}

// Extract authored text and table/chart literals into the reusable content source.
let md='# Wringy 投资讨论稿 v2\n\n2026-09-10。14 页主稿 + 3 页附录。所有业务建议、概念流程、费率和金额算例均未获批准。长期完整 Whop 范围保留。\n\n';
for(const r of records){
 md+=`## ${r.number}. ${r.title}\n\n`;

 if(r.number===7)md+='图表数据（单位 RM）：支付成本占位 20；审核支持 60（1小时×RM60）；争议损失占位 10；剩余贡献 10。全部为算例。\n\n';
 if(r.number===13)md+='原生图表数据（千令吉）：低 124.2；基准 189.75；高 269.1。基准图表标签显示189.8，金额采用189,750。\n\n';
 if(r.number===5)md+='图片：设计草案创作者提交页面真实截图。原稿预审通过、自行发布、最终审核中、奖励RM100待确认、付款尚未开始，全部为模拟。\n\n';
 md+=(copy.get(r.slide)||[]).join('\n\n')+'\n\n### 讲者备注、来源与图表数据\n\n'+r.notes+'\n\n';
}
await fs.writeFile(path.join(ROOT,'content.md'),md);
console.log('CONTENT_WRITTEN');
await fs.mkdir(path.join(BUILD,'renders'),{recursive:true});
await fs.writeFile(path.join(ROOT,'design-tokens.json'),JSON.stringify({status:'从设计源读取的演示稿快照，未经批准',canonical:'phase-0/foundation/design-tokens-v1.json',...C,fontFamily:FONT},null,2));
const candidate=path.join(BUILD,'candidate.pptx');
await(await PresentationFile.exportPptx(p)).save(candidate);
console.log('EXPORTED',candidate);
const output=path.join(ROOT,'output','Wringy-Investor-v2-Reviewed.pptx');
await finalizePresentation({workspaceDir:ROOT,candidatePath:candidate,finalPath:output,pythonExecutable:PY,integrityValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit',...[10,15,16,17].flatMap(n=>['--require-native-table-slide',String(n)])],explicitTotalSlideCount:17,requiredNativeTableOwnerSlides:[10,15,16,17],requiredNativeChartOwnerSlides:[7,13],materializeLiteralChartWorkbooks:true,fontPolicy:{basis:'design',families:[FONT]},verifyArtifactToolImport:true,receiptPath:path.join(BUILD,'validation-reviewed.json')});
console.log('FINALIZED',output);
const finalDeck=await PresentationFile.importPptx(await FileBlob.load(output));
for(let i=0;i<17;i++){
 const s=finalDeck.slides.items[i];const png=await finalDeck.export({slide:s,format:'png',scale:1.5});
 await fs.writeFile(path.join(BUILD,'renders',`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await png.arrayBuffer()));
 console.log('RENDERED',i+1);
}
await fs.writeFile(path.join(BUILD,'records.json'),JSON.stringify(records.map(({slide,...r})=>r),null,2));
console.log('DONE');

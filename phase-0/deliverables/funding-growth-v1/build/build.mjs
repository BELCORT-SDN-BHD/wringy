import {fs,path,PresentationFile,ROOT,BUILD,C,FONT,box} from './runtime.mjs';
import {createDeck,page,tx,rule,nativeTable,chart} from './template.mjs';
import {finalize} from './finalize.mjs';
import {render} from './render.mjs';
const f=JSON.parse(await fs.readFile(path.join(ROOT,'finance/results.json'))),fi=JSON.parse(await fs.readFile(path.join(ROOT,'finance/inputs.json'))),market=JSON.parse(await fs.readFile(path.join(ROOT,'inputs/market-sources.json'))),cap=JSON.parse(await fs.readFile(path.join(ROOT,'capital-sources.json')));
const story=(await fs.readFile(path.join(ROOT,'story.md'),'utf8')).split(/^## /m).slice(1),m=market.illustrative_model,mo=m.outputs;
const p=createDeck(),fmt=n=>Math.round(n).toLocaleString('en-US'),rm=n=>'RM'+fmt(n),mil=n=>(n/1e6).toFixed(1),sources=[...market.sources,...cap.sources,...fi.sources];
function pg(title,sub='',foot='',ids=[]){const idx=p.slides.items.length;return page(p,{title,subtitle:sub,footnote:foot,notes:(story[idx]||'').split('\n').filter(line=>!line.startsWith('视觉：')&&!line.startsWith('设计：')&&!line.startsWith('来源notes：')&&!line.startsWith('notes：')).join('\n'),sources:[...sources.filter(s=>ids.includes(s.id)||ids.includes('finance')&&!s.id).map(s=>s.url),'finance/results.json','finance/inputs.json','story.md']});}
function text(s,v,x,y,w,h,size=27,bold=false,color=C.foreground){return tx(s,v,x,y,w,h,size,bold,color);}
function big(s,v,x,y,w=1100,size=72){return text(s,v,x,y,w,size*1.5,size,true,C.primary);}
function note(s,v,y=605,size=24,color=C['muted-foreground']){return text(s,v,58,y,1160,60,size,false,color);}
function rows(s,items,{y=230,gap=115,labelW=260}={}){items.forEach(([a,b],i)=>{text(s,a,58,y+i*gap,labelW,90,29,true,C.primary);text(s,b,75+labelW,y+i*gap,1150-labelW,100,26);if(i<items.length-1)rule(s,58,y+(i+1)*gap-13,1162);});}
const axis={textStyle:{typeface:FONT,fontSize:20,fill:C['muted-foreground']},line:{fill:C.border,width:1}};
// 1
{const s=pg('','','融资讨论方案，2026年9月');big(s,'Wringy',56,67,1100,88);text(s,'融资与增长计划',58,233,1150,104,62,true);text(s,'马来西亚首发，逐步拓展东南亚',61,390,1120,60,30);big(s,'拟融资 '+rm(f.recommended_raise),57,492,1130,58);text(s,'18个月计划',61,583,1100,47,29);}
// 2
{const s=pg('马来西亚有营销预算，视频推动区域电商','','MDA FY2025；Google / Temasek / Bain 2025E。广告支出与成交额均非 Wringy 收入。',['S6','S7','S3','S2']);
 big(s,'RM2.96bn',56,181,745,83);text(s,'马来西亚 2025 年数字广告支出估算',61,303,770,48,29);
 text(s,'21家代理样本约覆盖60%\n总额估算包含直接广告主等支出',61,376,760,92,26,false,C['muted-foreground']);
 big(s,'US$20bn',858,190,370,49);text(s,'马来西亚电商成交额\n2025 年估计',861,281,358,93,26);
 text(s,'约25%  视频电商',60,509,720,55,34,true);text(s,'占东南亚电商成交额（SEA-6）',61,569,720,47,25);
 chart(s,'bar',{position:box(826,451,400,146),categories:['2025'],series:[{name:'视频电商',values:[.25],fill:C.primary},{name:'其余电商',values:[.75],fill:C.border}],barOptions:{direction:'bar',grouping:'stacked',overlap:100},hasLegend:false,xAxis:{visible:false,tickLabelPosition:'none',line:{fill:'none',width:0}},yAxis:{visible:false,min:0,max:1,tickLabelPosition:'none',line:{fill:'none',width:0}},dataLabels:{showValue:false}});}
// 3
{const s=pg('马来西亚电商品牌切口的收入空间','底层假设模型，尚待客户验证','DOSM 2022历史统计；80%活跃调整、10%适配、预算、15%费率及20%服务范围均为假设。',['S4']);
 big(s,'约 RM'+mil(mo.annual_fee_TAM)+'m／年',56,226,1100,76);text(s,'目标客群的平台费容量',60,338,780,50,30);
 rule(s,58,413,1164);big(s,'约 RM'+mil(mo.annual_fee_SAM)+'m／年',57,447,740,53);text(s,'首期服务范围的平台费容量',61,531,765,46,28);
 text(s,'约 '+fmt(mo.target_buyers)+' 个适配采购方\n每年奖励预算 RM24,000\n演示外加平台费 15%',836,229,390,149,26);
 text(s,'首期假设服务其中 20%\n约 '+fmt(mo.serviceable_buyers)+' 个采购方',839,466,382,107,26);note(s,'仅估算电商品牌切口，未覆盖 Wringy 全部长线业务',607,24);}
// 4
{const som=m.som_scenarios.find(x=>x.active_paying_brands===100);const s=pg('100个月活付费品牌的经营体量','第24–36个月的规模讨论目标，非收入预测','容量情景。超出18个月资金期，执行依赖收入、后续资金或缩减范围；RM5和15%均为演示假设。');
 const vals=[['100','当月付费品牌'],['RM2,000','每品牌月奖励'],['RM200,000','月奖励总额'],['RM30,000','月平台收入']];
 vals.forEach(([a,b],i)=>{let x=58+i*295;big(s,a,x,237,278,i===0?58:43);text(s,b,x,321,278,49,24);if(i<3)text(s,i===0?'×':i===1?'=':'×15%',x+231,384,113,43,25,true);});
 rule(s,58,433,1164);big(s,'约4,000万次',57,458,647,51);text(s,'每月合格播放要求（RM5／千次）\n创作者供给及计量能力仍需验证',61,538,683,93,25);
 text(s,'年化 '+rm(som.annualised_fee_run_rate)+'，非年度实收\n即使按当前M13–18支出RM33.5k\n月收入RM30k仍未覆盖成本\n扩大规模后的成本须重估',779,465,445,174,24);}
// 5
{const s=pg('首批客户从有素材、有预算的品牌开始','候选：拥有授权长视频／直播素材，持续需要分发的马来西亚电商品牌','建议目标。首发品类待定，关联内部测试单列；当前无可展示的已核验客户或收入。');
 const stages=[['100–200','去重品牌名单'],['约20位','决策人访谈'],['至少5个','独立品牌付费试点']];stages.forEach(([a,b],i)=>{let x=57+i*400;big(s,a,x,256,380,56);text(s,b,x,353,380,56,28,true);rule(s,x,423,358);});
 text(s,'获客',59,467,165,56,29,true,C.primary);text(s,'创办人及 Belcort 介绍、直接访谈、少量可衡量的试验',232,470,989,82,26);
 text(s,'复购证据',59,572,165,56,29,true,C.primary);text(s,'再次真实付款、可持续奖励预算、全部交付成本',232,573,989,77,26);}
// 6
{const s=pg('本轮拟融资 '+rm(f.recommended_raise),'18个月，按零收入计算','规划方案，未获投资承诺；未来收入未抵扣。融资工具、估值与持股待讨论。');
 chart(s,'bar',{position:box(52,210,1173,123),categories:['融资构成'],series:[{name:'计划支出',values:[f.gross_spend],fill:C.primary},{name:'现金缓冲',values:[f.buffer],fill:C['chart-2']},{name:'取整储备',values:[f.rounding_reserve],fill:C.brand}],barOptions:{direction:'bar',grouping:'stacked',overlap:100},hasLegend:false,xAxis:{visible:false,tickLabelPosition:'none',line:{fill:'none',width:0}},yAxis:{visible:false,min:0,max:f.recommended_raise,tickLabelPosition:'none',line:{fill:'none',width:0}},dataLabels:{showValue:false}});
 [['计划支出',f.gross_spend],['现金缓冲',f.buffer],['取整储备',f.rounding_reserve]].forEach(([a,b],i)=>{let x=59+i*399;text(s,a,x,348,373,45,25);big(s,rm(b),x,403,376,43);});
 text(s,'未动用缓冲：期末 '+rm(f.ending_cash),59,492,1155,56,33,true,C.primary);text(s,'若用完RM118,500应急缓冲，期末余RM41,500',59,553,1155,47,27);note(s,'到账获准启动后计时。现有现金及投入未知，暂按0；品牌奖励池另供',619,23);}
// 7
{const s=pg('每一笔资金的用途','以融资总额 RM950,000 为分母','全部为内部现金预算，待正式含税报价及试点实际用量校正。');
 const uses=[['Belcort产品开发',312000],['创办人及运营审核',222000],['维护、云与基础数据',90000],['获客试验',90000],['专业、行政及交易试点',76000],['未分配现金储备',160000]];
 chart(s,'bar',{position:box(52,209,1168,365),categories:[...uses].reverse().map(x=>x[0]+' '+(x[1]/f.recommended_raise*100).toFixed(1)+'%'),series:[{name:'用途（RM）',values:[...uses].reverse().map(x=>x[1]),fill:C.primary,valuesFormatCode:'"RM"#,##0'}],barOptions:{direction:'bar',grouping:'clustered',gapWidth:55},hasLegend:false,xAxis:{...axis},yAxis:{...axis,min:0,max:400000,majorUnit:100000,numberFormatCode:'0,"k"'},dataLabels:{showValue:true,position:'outEnd',textStyle:{typeface:FONT,fontSize:22,fill:C.foreground},numberFormatCode:'"RM"#,##0'}});
 note(s,'含创办人 RM6,000／月津贴。储备不预付；开发与维护分别约定范围',618,23);}
// 8
{const s=pg('Belcort开发预算约 '+rm(f.development_cost),'2,400小时 × RM130混合时薪，按交付成果验收','内部工时与时薪估算，非正式报价或市场平均。Addvaluez、Zoomo Tech公开价仅作量级参照。',['finance']);
 nativeTable(s,[['首版工作范围','内部估算'],['规则、设计与三类工作区','RM114,400'],['支付集成与结算台账','RM46,800'],['单渠道计量与异常复核','RM93,600'],['验收、部署和移交','RM57,200']],{y:224,rowH:55,colWidths:[895,273],font:25});
 text(s,'Belcort为创办人关联公司',58,517,1160,42,26,true,C.primary);text(s,'合同：独立可比报价、非受益方验收与审批权、验收付款、IP及账号移交',58,562,1160,46,24);
 note(s,'仅单渠道 Creator Rewards；不含完整 Whop、多国收付或原生 App。接口准入待验证',611,23);}
// 9
{const s=pg('18个月按成果释放支出','建议目标，均待验证','完整执行预算，门槛失败重新排期；储备RM160k保留，未来轮未计到账。目标非通行融资门槛。');
 const cols=[['前6个月',f.phases[0].spend,'数据、支付准入\n品牌／创作者／运营闭环\n付款异常验收','首月 RM55,800\n准入失败即停相关工作包'],['第7–12个月',f.phases[1].spend,'至少5个独立品牌付费\n至少2个再次购买\n记录全部投稿成本与争议','以真实付款及完整成本\n检查交付能否持续'],['第13–18个月',f.phases[2].spend,'20个月活付费品牌\n90天复购率 ≥40%\n全部奖励记录可追溯','通过检查再扩大获客\n仅观察期完整客户计复购']];
 cols.forEach(([a,b,c,d],i)=>{let x=58+i*399;text(s,a,x,229,374,47,30,true);big(s,rm(b),x,292,374,48);rule(s,x,376,354);text(s,c,x,402,373,143,25);text(s,d,x,568,373,77,23,false,C['muted-foreground']);});}
// 10
{const s=pg('一轮天使融资，用证据决定下一轮','','管理建议：现金剩9个月更新计划，6个月决定募资或减支；未到账／附条件资金不计可用现金。YC融资指南。',['CAP-01','CAP-02','CAP-03']);
 nativeTable(s,[['阶段','需要的证据','支持的用途'],['本轮天使／种子前\nRM950k','付费、交付与复购','马来西亚单渠道闭环'],['后续种子轮','多批客户复购\n收费与全部履约成本可对账','复制马来西亚销售与交付'],['后续A轮','获客回收、留存与毛利改善\n第二市场验证通过','扩大区域业务']],{y:205,rowH:72,colWidths:[300,505,363],font:25});
 text(s,'多位天使、同轮先后交割，不等于多轮天使',58,509,1162,43,27,true);text(s,'M7–12开始积累复购证据，无需等100个品牌',58,558,1162,41,24);text(s,'M19起无已承诺资金，不默认继续扩张',58,607,1162,41,26,true,C.primary);}
// 11
{const s=pg('东南亚扩张逐国验证','下一国按需求与可行性选择，本轮预算聚焦马来西亚','Google / Temasek / Bain 2025E，ASEAN-10。GMV仅作背景，不将MY模型按GDP或GMV放大。',['S2']);
 big(s,'US$185bn',57,222,643,76);text(s,'2025年东南亚电商成交额',62,335,659,58,28);text(s,'暂无可靠的区域 Creator Rewards\n总预算统计',62,416,677,92,26,false,C['muted-foreground']);
 text(s,'逐国扩张条件',804,225,417,57,32,true,C.primary);text(s,'现有客户有跨国需求\n当地预算与交付已验证\n收付和数据权限可用',809,319,414,188,27);
 rule(s,58,549,1163);note(s,'先扩大奖励活动，再验证商家工具、数字产品与会员业务\n新收入只在验证后加入模型',587,25);}
// 12
{const s=pg('退出路径优先研究战略并购','路径优先级不表示发生概率','不承诺退出年份、估值或倍数；净回款受稀释、债务、税费、交易费与优先权影响。具体安排由本地律师确认。',['CAP-04']);
 rows(s,[['战略并购','营销软件、代理服务或商业平台\n整合复购客户、可靠履约与明确IP'],['老股转让','未来融资或交易中有买方购买现有股份\n须符合合同并取得必要同意'],['远期上市','长期选择，取决于规模、治理及资本市场条件']],{y:213,gap:105,labelW:240});
 text(s,'经营回本、新融资、投资人退出是不同事件',58,548,1161,44,29,true,C.primary);note(s,'增资款通常进入公司；另行购买老股，原股东才收转让款\n分红可提供现金回报，但不代表卖出股权',600,24);}
// 13
{const s=pg('相邻行业已有战略收购案例','','公告及买方完成记录：Sprout Social 2023、Meltwater 2021／2024。',['CAP-05','CAP-06','CAP-07','CAP-08']);
 nativeTable(s,[['已完成交易','公告对价','战略逻辑'],['Sprout Social 收购\nTagger Media（2023）','US$140m\n公告现金对价','网红营销、工作流程\n报告与效果衡量'],['Meltwater 收购\nKlear（2021）','US$17.8m\n现金＋附条件追加对价','连接创作者关系\n效果衡量与全球客户']],{y:197,rowH:111,colWidths:[418,323,427],font:26});
 text(s,'Wringy需建立复购客户、可整合产品与可延续的合作及数据权利',58,550,1165,63,28,true);
 note(s,'地域、规模和模式不同，非估值对标，也无买方意向。Tagger年报调整口径不同\nKlear公告对价不等于全部即时实付现金',616,22);}
// 14
{const s=pg('本轮投资讨论','','18个月预算与业务目标为讨论方案，待双方及正式供应商报价确认；无已核验收入或退出承诺。');
 big(s,'拟融资 '+rm(f.recommended_raise),56,205,1165,76);text(s,'建立马来西亚 Creator Rewards 的可复制商业证据',61,333,1160,76,32,true);
 text(s,'品牌是否复购\n每场服务是否有正贡献\n奖励是否可靠核对与支付',61,451,668,155,31);
 text(s,'共同确认',813,448,410,49,29,true,C.primary);text(s,'金额与交割安排\n估值／持股或可转换条款\n里程碑与股东信息权',816,508,408,145,25);}
// 15
{const s=pg('附录：市场估算输入','历史统计与演示假设分别列明','历史经营单位非2026去重品牌名单；首期比例为服务范围，非成交率。需名单与付费测试，长线业务未计入。',['S4']);
 nativeTable(s,[['输入','数值／属性'],['经营单位','78,236（DOSM 2022）'],['独立活跃调整','80%（假设）'],['产品适配','10%（假设）'],['每品牌年奖励','RM24,000（假设）'],['平台费','15%外加（演示）'],['首期服务比例','20%（假设）']],{x:56,y:216,width:627,rowH:56,colWidths:[296,331],font:24});
 text(s,'目标客群约6,259个',723,218,504,48,28,true,C.primary);text(s,'年奖励 RM150.21m\n年平台费 RM22.53m',727,280,499,95,26);text(s,'首期约1,252个',723,394,504,44,28,true,C.primary);text(s,'年奖励 RM30.04m\n年平台费 RM4.51m',727,453,499,89,26);
 note(s,'单项敏感性：适配率5%或年预算RM12k，年费均降至RM11.27m；仅费率改10%则RM15.02m',617,22);}
// 16
{const s=pg('附录：预算与现金检查','','M1全款到账，分期须重算；品牌预先足额提供奖励，平台不垫付。零收入为压力情景，非免费试点。');
 nativeTable(s,[['18个月用途','RM'],...f.uses.map(x=>[x.name,fmt(x.amount)]),['计划支出合计',fmt(f.gross_spend)]],{x:56,y:145,width:574,rowH:42,colWidths:[370,204],font:22});
 text(s,'零收入下的公司期末现金',674,179,547,55,29,true,C.primary);
 chart(s,'line',{position:box(668,253,554,311),categories:f.monthly.map(x=>'M'+x.month),series:[{name:'期末现金（RM）',values:f.monthly.map(x=>x.ending_cash),line:{fill:C.primary,width:3},fill:C.primary}],hasLegend:false,xAxis:{...axis},yAxis:{...axis,min:0,max:1000000,majorUnit:200000,numberFormatCode:'0.0,,"m"'},dataLabels:{showValue:false}});
 text(s,'M1 RM894.2k   M6 RM538k   M12 RM361k   M18 RM160k',678,580,547,42,18);
 note(s,'储备 RM160k ＝ 缓冲 RM118.5k ＋ 取整 RM41.5k，总融资 RM950k；储备未重复列支',619,22);}
// 17
{const s=pg('附录：未来资金规模如何再估','规划情景，非已核定预算或融资承诺','尚无底层国家、人员或供应商预算，不是下一轮拟募资额；不能把三阶段相加为今天所需资金。',['CAP-01']);
 nativeTable(s,[['未来阶段假设','每月总支出','24个月毛支出'],['种子阶段','RM80k–120k','RM1.92m–2.88m'],['区域阶段','RM250k–400k','RM6.0m–9.6m']],{y:236,rowH:89,colWidths:[352,407,409],font:29});
 text(s,'届时按范围重算',59,539,1100,50,33,true,C.primary);note(s,'支出加明确缓冲，再扣可核实的可用现金与可靠净收入',607,27);}
if(p.slides.items.length!==17)throw Error('17 slides required');
await fs.writeFile(path.join(BUILD,'content-manifest.json'),JSON.stringify({count:17,main:14,appendix:3,charts:[2,6,7,16],tables:[8,10,13,15,16,17],finance:f.recommended_raise},null,2));
const candidate=path.join(BUILD,'candidate-v1.pptx');await(await PresentationFile.exportPptx(p)).save(candidate);
if(process.argv.includes('--draft'))await render(candidate,path.join(BUILD,'renders'),1);
else{const out=path.join(ROOT,'output/Wringy-Funding-Growth-v1-final2.pptx');await finalize(candidate,out,{count:17,charts:[2,6,7,16],tables:[8,10,13,15,16,17]});await render(out,path.join(BUILD,'final-renders'),1.5);}

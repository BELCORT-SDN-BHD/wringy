import {createHash} from 'node:crypto';
import {FONT} from './runtime.mjs';
const fmt=n=>new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(n);
const pct=n=>(n*100).toFixed(1)+'%';
export function deriveIllustration(input){
 const fee=input.rewardBudget*input.feeRate,contribution=fee-input.variableFulfilmentPerActivity-input.variableSellingPerActivity;
 const n=input.monthlyIllustrationActivities,revenue=n*fee,variableFulfil=n*input.variableFulfilmentPerActivity,cogs=variableFulfil+input.monthlyFixedFulfilment,grossProfit=revenue-cogs;
 const marketing=n*input.variableSellingPerActivity,operating=grossProfit-marketing-input.monthlyFixedOpex;
 return {...input,fee,contribution,contributionMargin:contribution/fee,revenue,variableFulfil,cogs,grossProfit,grossMargin:grossProfit/revenue,marketing,operating,operatingMargin:operating/revenue,breakEven:Math.ceil((input.monthlyFixedFulfilment+input.monthlyFixedOpex)/contribution)};
}
export function financeMetadata(d){return [
 {key:'unit-economics',title:'单场经济：平台费与贡献',foot:'20场月度算例的单场假设 · 贡献未扣固定成本及额外新品牌获客成本 · 非预测',note:`说明算例。创作者奖励RM${fmt(d.rewardBudget)}，品牌另付${pct(d.feeRate)}平台费RM${fmt(d.fee)}。品牌总支出RM${fmt(d.rewardBudget+d.fee)}未计税。变动履约RM${fmt(d.variableFulfilmentPerActivity)}、变动活动销售RM${fmt(d.variableSellingPerActivity)}，单场贡献RM${fmt(d.contribution)}，贡献率${pct(d.contributionMargin)}。旧RM900只扣变动履约，不称完整毛利或贡献。固定履约计入月度COGS，未在单场贡献扣除。额外首个品牌获客成本是否发生与金额以最终模型为准。`,sources:['phase-0/finance/model-v1/（最终财务文件待接入）']},
 {key:'monthly-gross-profit',title:'月度20场：毛利为正，经营仍亏损',foot:'净平台服务收入规划口径 · 未扣新品牌获客费 · 非会计认定、净利润或现金回本',note:`20场说明示例：收入${d.revenue}。COGS=变动履约${d.variableFulfil}+固定履约${d.monthlyFixedFulfilment}=${d.cogs}。毛利${d.grossProfit}，毛利率${d.grossMargin}。再扣变动活动营销${d.marketing}与固定Opex${d.monthlyFixedOpex}，经营结果${d.operating}，经营利润率${d.operatingMargin}。固定履约不能再次扣除。本页经营结果不包含额外新品牌CAC、建设启动、回款时间或完整现金流，其口径由最终财务模型定义。`,sources:['phase-0/finance/model-v1/（最终财务文件待接入）']},
 {key:'operating-break-even',title:'固定开支与活动贡献',foot:'独立门槛算例 · 未计额外新品牌获客成本 · 实际现金回本另看建设、启动与回款情景',note:`单场贡献${d.contribution}。固定履约${d.monthlyFixedFulfilment}+固定经营费用${d.monthlyFixedOpex}=${d.monthlyFixedFulfilment+d.monthlyFixedOpex}。月度经营盈亏平衡活动数为向上取整(${d.monthlyFixedFulfilment+d.monthlyFixedOpex}/${d.contribution})=${d.breakEven}。这里将固定履约与固定Opex共同用于盈亏平衡计算，是代数重排，不在月度损益再次扣一次COGS内费用。不含额外首个品牌CAC。活动需维持相同奖励规模、费率与变动成本，并不能保证创作者供给和需求。不是初始投资回收月份。`,sources:['phase-0/finance/model-v1/（最终财务文件待接入）']}
];}
export function fillUnitEconomics({s,tx,line,C,d}){
 tx(s,`奖励 RM${fmt(d.rewardBudget)}，平台费 ${pct(d.feeRate)} 另计`,64,197,1152,47,29,true);
 tx(s,`品牌支出 RM${fmt(d.rewardBudget+d.fee)}（未计税），奖励归创作者`,64,257,1152,44,25);
 const cells=[['平台收入',`RM${fmt(d.fee)}`],['变动履约',`− RM${fmt(d.variableFulfilmentPerActivity)}`],['变动活动销售',`− RM${fmt(d.variableSellingPerActivity)}`],['单场贡献',`RM${fmt(d.contribution)}`]];
 cells.forEach(([a,b],i)=>{const x=64+i*291;tx(s,a,x,371,276,44,27);tx(s,b,x,437,276,75,43,true);});
 line(s,64,549,1152);tx(s,`贡献率 ${pct(d.contributionMargin)}`,64,588,550,50,33,true);tx(s,'固定履约与固定经营费用另计',657,590,559,47,26);
}
export function fillMonthlyProfit({s,tx,line,C,d}){
 const values=[['月度20场示例','MYR'],['平台服务收入',fmt(d.revenue)],['销货成本（履约成本）','− '+fmt(d.cogs)],['毛利',fmt(d.grossProfit)],['变动活动营销','− '+fmt(d.marketing)],['固定经营费用','− '+fmt(d.monthlyFixedOpex)],['经营损益（新品牌获客前）',fmt(d.operating)]];
 const t=s.tables.add({rows:7,columns:2,left:64,top:198,width:748,height:392,columnWidths:[540,208],values});
 t.styleOptions={headerRow:false,bandedRows:false};t.borders.assign({fill:C.line,width:0.5});
 for(let r=0;r<7;r++){t.rows[r].height=56;for(let col=0;col<2;col++){const cell=t.getCell(r,col);cell.fill=r===0?C.surface:C.background;cell.text.style={typeface:FONT,fontSize:25,color:C.ink,bold:[0,3,6].includes(r),alignment:col===1?'right':'left',autoFit:'none'};}}
 tx(s,'毛利率',891,219,325,46,28);tx(s,pct(d.grossMargin),891,285,325,83,62,true);tx(s,'经营利润率',891,421,325,45,28);tx(s,pct(d.operatingMargin),891,479,325,83,56,true);
 tx(s,`履约成本：变动 RM${fmt(d.variableFulfil)} ＋ 固定 RM${fmt(d.monthlyFixedFulfilment)}`,64,610,1152,37,23);
}
export function fillOperatingBreakEven({s,tx,line,C,d}){
 tx(s,`${d.breakEven} 场／月`,64,221,697,119,80,true);tx(s,'未计新增品牌获客费，且单位成本不变',64,372,750,51,30);
 tx(s,`固定履约 RM${fmt(d.monthlyFixedFulfilment)}`,855,231,361,46,26);tx(s,`固定经营 RM${fmt(d.monthlyFixedOpex)}`,855,289,361,46,26);tx(s,`合计 RM${fmt(d.monthlyFixedFulfilment+d.monthlyFixedOpex)}`,855,367,361,47,28,true);
 line(s,64,463,1152);tx(s,`RM${fmt(d.monthlyFixedFulfilment+d.monthlyFixedOpex)} ÷ RM${fmt(d.contribution)}／场，向上取整`,64,502,1152,55,34,true);
 tx(s,'经营不再亏损后，仍须累计现金收回建设与启动投入。',64,588,1152,49,28);
}
export async function loadFinance(fs,path,ROOT){
 const dir=path.resolve(ROOT,'../../finance/model-v1');
 const manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json')));if(manifest.status!=='frozen')throw Error('Finance not frozen');
 for(const file of ['assumptions.json','results.json','outputs/financial-model/Wringy-36个月财务模型.xlsx']){const hash=createHash('sha256').update(await fs.readFile(path.join(dir,file))).digest('hex');if(hash!==manifest.files[file])throw Error('Frozen finance hash mismatch: '+file);}
 const assumptions=JSON.parse(await fs.readFile(path.join(dir,'assumptions.json'))),results=JSON.parse(await fs.readFile(path.join(dir,'results.json'))),v=Object.fromEntries(assumptions.inputs.map(x=>[x.id,x.value]));
 const d=deriveIllustration({rewardBudget:v.reward,feeRate:v.fee,variableFulfilmentPerActivity:v.review+v.data+v.payment+v.exceptions,variableSellingPerActivity:v.commission,monthlyIllustrationActivities:v.example,monthlyFixedFulfilment:v.fulfillFixed,monthlyFixedOpex:v.otherFixed,additionalFirstBrandCAC:v.cac});
 for(const [a,b]of [[d.fee,results.unit.revenue],[d.contribution,results.unit.contribution],[d.grossProfit,results.unit.at20.grossProfit],[d.operating,results.unit.at20.operatingBeforeNewBrandCAC],[d.breakEven,results.unit.breakevenBeforeNewBrandCAC]])if(Math.abs(a-b)>1e-7)throw Error('Finance adapter disagreement');
 return {d,results,assumptions,v,manifest,sources:[path.join(dir,'results.json'),path.join(dir,'assumptions.json'),path.join(dir,'outputs/financial-model/Wringy-36个月财务模型.xlsx')]};
}
export function cashMetadata(model){const {results,v,sources}=model;return [
 {key:'cash-payback',title:'现金回本：三种有条件的情景',foot:'税前、融资前情景 · 基准同月收款 · 未计营运资金差额，实际回本时间未知',
 note:`图表直接读取results.json中36个月累计现金；纵轴RM万元，图表快照保留6位小数（相当于RM0.01），仅清理浮点尾数。月份均从项目开始计，含${v.buildMonths}个月建设期。${results.scenarios.map(s=>`${s.name}：${s.payback}；首次单月经营转正M${s.firstPositiveOperatingMonth}；峰值缺口RM${fmt(s.peakCashNeed)}`).join('。')}。回本为累计现金首次非负，不是首次单月经营不亏。含历史开发锚点RM${fmt(v.dev)}、建设期运营、启动池、每场佣金和M6起新增及流失补充品牌CAC。新计量与反作弊开发未报价，当前0占位，不能当完整融资额。税前利息前融资前，基准收款同月，未计完整营运资金时间差。全部月活动量、获客与流失为假设，不承诺回本。`,sources},
 {key:'cash-assumptions',title:'回本取决于活动量与现金成本',foot:'说明假设，非客户订单 · 两项分别单独变化，不叠加 · 新播放计酬开发仍未报价',note:`活动路径：${model.assumptions.cases.map(c=>`${c.name}M5 ${c.monthlyCampaigns[4]}场至M36 ${c.monthlyCampaigns[35]}场`).join('；')}。峰值缺口取累计现金最低值的相反数，不是完整融资报价。每品牌每月${v.frequency}场、流失${pct(v.churn)}、M6起新品牌含流失替补CAC每个RM${fmt(v.cac)}。M5首批品牌由RM${fmt(v.launch)}启动池覆盖，不重复CAC。基准情景支付费从每场RM${v.payment}改为全品牌资金3%（敏感性假设，非报价）与收款延迟1个月为独立测试，结果直接读取results.json。没有叠加两个敏感性，也不将简单持续品牌CAC回收1个月推广为全部获客回本。`,sources}
];}
export function fillCashPayback({s,tx,line,C,model,applyPresentationChartFont}){
 const {results,v}=model;
 tx(s,`累计净现金（RM万） · 从项目第1个月起算，含${v.buildMonths}个月建设`,64,177,1152,43,25);
 const colors=[C.muted,C.forest,C.ink],categories=Array.from({length:36},(_,i)=>`M${i+1}`);
 const series=results.scenarios.map((a,i)=>({name:a.name,xValues:a.months.map(m=>m.month),values:a.months.map(m=>Number((m.cumulative/10000).toFixed(6))),line:{fill:colors[i],width:3},marker:{symbol:'none'},valuesFormatCode:'0.0'}));
 series.push({name:'回本线（0）',xValues:Array.from({length:36},(_,i)=>i+1),values:Array(36).fill(0),line:{fill:C.line,width:1.5},marker:{symbol:'none'},valuesFormatCode:'0'});
 const chart=s.charts.add('line',{position:{left:54,top:235,width:835,height:350},categories,series,lineOptions:{smooth:false},hasLegend:true,legend:{position:'bottom',textStyle:{typeface:FONT,fontSize:19,fill:C.ink}},xAxis:{visible:true,textStyle:{typeface:FONT,fontSize:11,fill:C.muted},line:{fill:C.line,width:1},tickLabelPosition:'low'},yAxis:{visible:true,min:-50,max:250,majorUnit:50,numberFormatCode:'0',textStyle:{typeface:FONT,fontSize:18,fill:C.muted},majorGridlines:{fill:C.line,width:0.6}},dataLabels:{showValue:false},chartFill:'none',chartLine:{fill:'none',width:0},plotAreaFill:'none',plotAreaLine:{fill:'none',width:0}});
 applyPresentationChartFont(chart,{fontFamily:FONT});
 results.scenarios.forEach((a,i)=>{const y=239+i*117;tx(s,a.name,927,y,289,38,25,true,colors[i]);tx(s,a.paybackMonth?`第${a.paybackMonth}个月`:'36个月内未回本',927,y+43,289,52,a.paybackMonth?37:26,true);});
 tx(s,'新增计量与反作弊开发以0占位，尚待报价。',64,610,1152,43,25,true);
}
export function fillCashAssumptions({s,tx,line,C,model}){
 const {results,assumptions,v}=model;
 const values=[['情景','月活动量：M5 至 M36','经营首次转正','峰值累计缺口'],...results.scenarios.map((a,i)=>[a.name,`${assumptions.cases[i].monthlyCampaigns[4]} 至 ${assumptions.cases[i].monthlyCampaigns[35]} 场`,`项目第${a.firstPositiveOperatingMonth}月`,`RM${fmt(a.peakCashNeed)}`])];
 const t=s.tables.add({rows:4,columns:4,left:64,top:190,width:1152,height:224,columnWidths:[158,372,280,342],values});t.styleOptions={headerRow:false,bandedRows:false};t.borders.assign({fill:C.line,width:.5});
 for(let r=0;r<4;r++){t.rows[r].height=56;for(let col=0;col<4;col++){const a=t.getCell(r,col);a.fill=r===0?C.surface:C.background;a.text.style={typeface:FONT,fontSize:r===0?22:26,bold:r===0||col===0,color:C.ink,autoFit:'none'};}}
 tx(s,`每品牌每月${v.frequency}场，月流失${pct(v.churn)}；M6起新增与替补品牌获客费 RM${fmt(v.cac)}／个`,64,448,1152,45,24);
 const base=results.scenarios.find(a=>a.name==='基准'),p=results.sensitivities.payment3Percent.find(a=>a.name==='基准'),lag=results.sensitivities.collectionLag1Month.find(a=>a.name==='基准');
 tx(s,'独立敏感性：保守情景均36个月内未回本',64,517,1152,43,27,true);
 const ep=results.sensitivities.payment3Percent.find(a=>a.name==='扩张'),el=results.sensitivities.collectionLag1Month.find(a=>a.name==='扩张');
 tx(s,`全品牌资金3%支付费：基准 M${p.paybackMonth}，扩张 M${ep.paybackMonth}`,64,565,1152,35,24);
 tx(s,`晚1个月收款：基准 M${lag.paybackMonth}，扩张 M${el.paybackMonth}`,64,608,1152,35,24);

}

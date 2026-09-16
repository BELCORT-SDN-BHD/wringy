import fs from 'node:fs/promises';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
const base=new URL('.',import.meta.url).pathname;
const out=base+'outputs/funding-growth/';
const wb=Workbook.create();
const summary=wb.worksheets.add('Summary'), cash=wb.worksheets.add('MonthlyCash'), inp=wb.worksheets.add('Inputs');
const fmt='#,##0;(#,##0);"–"';
const data=[
 ['混合开发时薪（RM／小时）',130,'内部估算，非Belcort报价'],
 ['现金缓冲比例',0.15,'对全部支出仅计一次，开发包不另加预备金'],
 ['创办人已承诺资本（RM）',0,'尚未知，按0占位，不表示已承诺0'],
 ['已核实可用公司现金（RM）',0,'当前未有可核实余额，品牌奖励池不计入'],
 ['创办人津贴（RM／月）',6000,'M1–M18，内部规划现金总额'],
 ['运营与审核（M1–M6，RM／月）',3000,'合同支持总预算，包含固定审核及第二复核人'],
 ['运营与审核（M7–M18，RM／月）',8000,'总包现金预算，非已招聘；不再叠加旧固定履约费'],
 ['维护（M7–M18，RM／月）',4000,'保修与支持须正式报价去重；无自聘开发'],
 ['云与基础数据（M1–M6，RM／月）',1000,'测试环境及基础数据占位'],
 ['云与基础数据（M7–M18，RM／月）',3000,'上线基础订阅，非无限量数据服务承诺'],
 ['获客试验（M1–M6，RM／月）',1000,'品牌访谈、招募及素材，不含奖励代收款'],
 ['获客试验（M7–M12，RM／月）',5000,'品牌／创作者招募、试验及转介总池'],
 ['获客试验（M13–M18，RM／月）',9000,'通过复购检查后释放，不再叠加按品牌CAC'],
 ['法务设立与协议（M1一次，RM）',22000,'含关联开发/IP、数据及支付合规专业服务占位'],
 ['会计及公司合规（RM／月）',1000,'M1–M18持续专业服务占位'],
 ['行政与工具（RM／月）',1000,'M1–M18，不含开发、云、审核和会计'],
 ['交易试点直接费（M7–M18，RM／月）',1500,'仅支付费、按量数据、异常损失；不含固定审核'],
 ['募资取整步长（RM）',50000,'最低需求向上取整；差额仍属未分配储备'],
 ['公司收入抵扣（RM／月）',0,'零收入安全法锁定口径，不以未签客户预测抵扣'],
];
const packages=[
 ['规则与外部准入验证',160,1,'数据权限、资金路径及正式范围；未通过即停止'],
 ['产品流程与界面设计',200,2,'仅剩余必要设计，正式报价需扣除确认可复用部分'],
 ['三类工作区与活动流程',520,3,'品牌、创作者、运营；单一计酬模式'],
 ['支付集成与结算台账',360,4,'受许可服务商准入约束，不包括自行托管'],
 ['单渠道合格播放计量',400,5,'CPM新增：窗口、上限、重复数据和回补'],
 ['异常与反作弊复核',320,5,'CPM新增：异常标记、人工裁决、申诉审计'],
 ['质量、安全及端到端验收',280,6,'包括重复结算、权限、失败回退测试'],
 ['部署、移交与培训',160,6,'账号、源码、手册与操作交接'],
];
const inputs={as_of:'2026-09-12',status:'内部预算草案，未报价、未承诺',currency:'MYR',horizon_months:18,month_basis:'M1为融资到账并获准启动后的首月；非承诺日历排期',market:'Malaysia first; SEA long term',revenue_method:'zero revenue safety',drivers:data.map((d,i)=>({name:d[0],value:d[1],basis:d[2],cell:`Inputs!D${i+6}`})),work_packages:packages.map((p,i)=>({name:p[0],hours:p[1],cash_month:p[2],scope:p[3],cell:`Inputs!D${i+29}`})),sources:[{url:'https://addvaluez.com/blog/custom-software-development-cost-malaysia',accessed:'2026-09-12',evidence:'自述客户Web/MVP RM90k–250k；重集成平台RM250k起。仅量级参考。'},{url:'https://www.zoomotech.com.my/blog/why-custom-software-cost-in-malaysia-varies-from-rm30k-to-rm300k/',accessed:'2026-09-12',evidence:'自述简单工具RM15k至完整集成平台RM300k+。仅量级参考。'}]};
await fs.writeFile(base+'inputs.json',JSON.stringify(inputs,null,2));
function val(sh,a,v){sh.getRange(a).values=[[v]];}
function formula(sh,a,f){sh.getRange(a).formulas=[[f]];sh.getRange(a).format.font.color=sh===summary?'#202720':f.includes('!')?'#008040':'#202720';}
function header(sh,a,arr){sh.getRange(a).values=[arr];sh.getRange(a).format={fill:'#29342B',font:{color:'#FFFFFF',bold:true},horizontalAlignment:'center'};}
for(const sh of [summary,cash,inp]){sh.showGridLines=false;sh.tabColor=sh===summary?'#29342B':'#97A58B';const r=sh.getRange(sh===cash?'A1:U40':sh===inp?'A1:H43':'A1:H31');r.format.font={name:'Arial',size:11,color:'#202720'};r.format.rowHeight=25;r.format.verticalAlignment='center';sh.getRange('A1:B43').format.columnWidth=3;}
val(inp,'C2','Wringy 预算输入');inp.getRange('C2').format.font.size=16;
val(inp,'C3','蓝字黄底可改。金额均为RM，全部预算为内部假设。');
header(inp,'C5:D5',['资金与运营假设','数值']);val(inp,'F5','依据与边界');
data.forEach((d,i)=>{val(inp,`C${i+6}`,d[0]);val(inp,`D${i+6}`,d[1]);val(inp,`F${i+6}`,d[2]);});
inp.getRange('D6:D24').format={fill:'#FFF2CC',font:{color:'#0000FF'},numberFormat:fmt};inp.getRange('D7').setNumberFormat('0.0%');
header(inp,'C28:E28',['Belcort工作包','工时','付款月']);val(inp,'G28','范围与排除项');
packages.forEach((p,i)=>{val(inp,`C${i+29}`,p[0]);val(inp,`D${i+29}`,p[1]);val(inp,`E${i+29}`,p[2]);val(inp,`G${i+29}`,p[3]);});
inp.getRange('D29:E36').format={fill:'#FFF2CC',font:{color:'#0000FF'},numberFormat:fmt};
val(inp,'C38','公开开发商价格仅用于量级核对，非Belcort报价，非市场平均。');
val(inp,'C39','Addvaluez：客户Web/MVP RM90k–250k，重集成平台RM250k起。');val(inp,'G39',inputs.sources[0].url);
val(inp,'C40','Zoomo Tech：简单工具RM15k至完整集成平台RM300k+。');val(inp,'G40',inputs.sources[1].url);
val(inp,'C42','M1为资金到账并获准启动首月。付款月仅为现金规划，需合同验收约束。');
inp.getRange('C1:C43').format.columnWidth=53;inp.getRange('D1:E43').format.columnWidth=13;inp.getRange('F1:F43').format.columnWidth=78;inp.getRange('G1:G43').format.columnWidth=77;
inp.getRange('G39:G40').format.wrapText=true;inp.getRange('C39:G40').format.rowHeight=45;inp.freezePanes.freezeRows(5);
val(cash,'C2','Wringy 18个月公司现金计划');cash.getRange('C2').format.font.size=16;
val(cash,'C3','零收入安全法。奖励池隔离。缓冲留在现金，不重复计为计划费用。');
header(cash,'C5:V5',['现金项目／RM','18个月',...Array.from({length:18},(_,i)=>`M${i+1}`)]);
// Header starts C; D is total; months E:V, replace correct full range below.
cash.getRange('C5:V5').values=[['现金项目／RM','18个月',...Array.from({length:18},(_,i)=>`M${i+1}`)]];
cash.getRange('C5:V5').format={fill:'#29342B',font:{color:'#FFFFFF',bold:true},horizontalAlignment:'center'};
const labels={6:'期间序号',7:'开发工作包工时',8:'混合时薪',9:'Belcort开发费',10:'创办人津贴',11:'运营与审核',12:'维护',13:'云与基础数据',14:'获客试验',15:'法务与会计',16:'行政与工具',17:'交易试点直接费',18:'计划现金支出',20:'公司现金收入',21:'期初公司现金',22:'天使融资到账（假设）',23:'创办人承诺资本到账',24:'期末公司现金',26:'融资需求计算',27:'支出总额',28:'15%现金缓冲',29:'已承诺创办人资本',30:'已核实公司现金',31:'最低外部资金需求',32:'本轮建议募资额',33:'取整增加储备',34:'期末总储备',36:'分阶段支出上限',37:'M1–M6',38:'M7–M12',39:'M13–M18'};
for(const [r,l]of Object.entries(labels))val(cash,'C'+r,l);
const col=n=>String.fromCharCode(65+n);
for(let m=1;m<=18;m++){
 const c=col(m+3),prev=col(m+2);val(cash,`${c}6`,m);
 const f={7:`=SUMIFS('Inputs'!$D$29:$D$36,'Inputs'!$E$29:$E$36,${c}$6)`,8:"='Inputs'!$D$6",9:`=${c}7*${c}8`,10:"='Inputs'!$D$10",11:`=IF(${c}$6<=6,'Inputs'!$D$11,'Inputs'!$D$12)`,12:`=IF(${c}$6>=7,'Inputs'!$D$13,0)`,13:`=IF(${c}$6<=6,'Inputs'!$D$14,'Inputs'!$D$15)`,14:`=IF(${c}$6<=6,'Inputs'!$D$16,IF(${c}$6<=12,'Inputs'!$D$17,'Inputs'!$D$18))`,15:`='Inputs'!$D$20+IF(${c}$6=1,'Inputs'!$D$19,0)`,16:"='Inputs'!$D$21",17:`=IF(${c}$6>=7,'Inputs'!$D$22,0)`,18:`=SUM(${c}9:${c}17)`,20:"='Inputs'!$D$24",21:m===1?"='Inputs'!$D$9":`=${prev}24`,22:m===1?'=$D$32':'=0',23:m===1?"='Inputs'!$D$8":'=0',24:`=SUM(${c}20:${c}23)-${c}18`};
 for(const [r,s]of Object.entries(f))formula(cash,c+r,s);
}
for(const r of [7,9,10,11,12,13,14,15,16,17,18,20,22,23])formula(cash,'D'+r,`=SUM(E${r}:V${r})`);
formula(cash,'D8',"='Inputs'!D6");formula(cash,'D21','=E21');formula(cash,'D24','=V24');
const cf={27:'=D18',28:"=D27*'Inputs'!D7",29:"='Inputs'!D8",30:"='Inputs'!D9",31:'=MAX(0,SUM(D27:D28)-D29-D30)',32:"=ROUNDUP(D31/'Inputs'!D23,0)*'Inputs'!D23",33:'=D32-D31',34:'=V24',37:'=SUM(E18:J18)',38:'=SUM(K18:P18)',39:'=SUM(Q18:V18)'};
for(const[r,s]of Object.entries(cf))formula(cash,'D'+r,s);
cash.getRange('C1:C40').format.columnWidth=36;cash.getRange('D1:V40').format.columnWidth=15;cash.getRange('D7:V39').setNumberFormat(fmt);cash.freezePanes.freezeRows(6);cash.freezePanes.freezeColumns(4);
for(const r of [18,24,27,31,32,34]){cash.getRange(`C${r}:V${r}`).format.fill='#EDF0E8';cash.getRange(`C${r}:V${r}`).format.font.bold=true;}
cash.getRange('E24:V24').conditionalFormats.add('cellIs',{operator:'lessThan',formula:0,format:{fill:'#FCE4D6',font:{color:'#C00000'}}});
val(summary,'C2','Wringy 融资与资金用途');summary.getRange('C2').format.font.size=16;
val(summary,'C3','18个月内部预算草案。Malaysia first，Creator Rewards先行。');
header(summary,'C5:D5',['资金需求（RM）','金额']);
const sr={6:['计划支出',27],7:['一次15%现金缓冲',28],8:['减：创办人已承诺资本',29],9:['减：已核实可用公司现金',30],10:['最低外部资金需求',31],11:['本轮建议天使融资',32],12:['取整增加储备',33],13:['18个月末公司现金储备',34]};
for(const[r,[l,t]]of Object.entries(sr)){val(summary,'C'+r,l);formula(summary,'D'+r,`='MonthlyCash'!D${t}`);}
header(summary,'F5:G5',['资金用途（RM）','18个月']);
for(const [i,r]of [9,10,11,12,13,14,15,16,17].entries()){val(summary,'F'+(i+6),labels[r]);formula(summary,'G'+(i+6),`='MonthlyCash'!D${r}`);}
val(summary,'F15','计划支出合计');formula(summary,'G15',"='MonthlyCash'!D18");
header(summary,'C17:D17',['开发估算','金额／工时']);val(summary,'C18','开发总工时');formula(summary,'D18',"='MonthlyCash'!D7");val(summary,'C19','开发混合时薪（RM）');formula(summary,'D19',"='MonthlyCash'!D8");val(summary,'C20','CPM新增范围费用（已含于开发）');formula(summary,'D20',"=('Inputs'!D33+'Inputs'!D34)*'Inputs'!D6");
header(summary,'F17:G17',['分阶段支出上限（RM）','金额']);
for(const[i,r]of [37,38,39].entries()){val(summary,'F'+(i+18),labels[r]);formula(summary,'G'+(i+18),`='MonthlyCash'!D${r}`);}
val(summary,'C23','建议只规划一轮天使融资，按验收释放支出。后续Seed取决于付费复购证据。');
val(summary,'C25','先验证单渠道数据与支付准入，再承诺完整建设；未通过即停止相应工作包。');
val(summary,'C27','收入不抵扣募资。15%服务费仅为商业演示，不是已批准价格。');
val(summary,'C29','运营审核已含固定履约。试点直接费不再计固定审核，品牌奖励由品牌另行提供。');
summary.getRange('C1:C31').format.columnWidth=42;summary.getRange('D1:D31').format.columnWidth=19;summary.getRange('E1:E31').format.columnWidth=4;summary.getRange('F1:F31').format.columnWidth=33;summary.getRange('G1:G31').format.columnWidth=19;
summary.getRange('D6:D20').setNumberFormat(fmt);summary.getRange('G6:G20').setNumberFormat(fmt);
for(const r of [10,11,13]){summary.getRange(`C${r}:D${r}`).format.fill=r===11?'#DEE8B5':'#EDF0E8';summary.getRange(`C${r}:D${r}`).format.font.bold=true;}
wb.recalculate();
const get=(sh,a)=>sh.getRange(a).values[0][0];
const baseline={gross_spend:get(cash,'D27'),buffer:get(cash,'D28'),minimum_raise:get(cash,'D31'),recommended_raise:get(cash,'D32'),ending_cash:get(cash,'V24')};
const tests=[];function check(name,actual,expected){if(Math.abs(actual-expected)>0.01)throw Error(`${name}: ${actual} vs ${expected}`);tests.push({name,actual,expected,pass:true});}
check('independent gross spend',baseline.gross_spend,790000);check('minimum raise',baseline.minimum_raise,908500);check('rounded raise',baseline.recommended_raise,950000);check('ending reserve',baseline.ending_cash,160000);
val(inp,'D6',140);wb.recalculate();check('rate edit propagates gross',get(cash,'D27'),814000);check('rate edit propagates minimum',get(summary,'D10'),936100);val(inp,'D6',130);
val(inp,'D8',100000);wb.recalculate();check('founder capital reduces ask',get(summary,'D10'),808500);val(inp,'D8',0);
val(inp,'E33',7);wb.recalculate();check('package moved to M7',get(cash,'K9'),52000);check('period total unchanged',get(cash,'D27'),790000);val(inp,'E33',5);
val(inp,'D7',0);wb.recalculate();check('zero buffer',get(cash,'D31'),790000);val(inp,'D7',0.15);
wb.recalculate();
const inspection=await wb.inspect({kind:'table',range:'Summary!C5:G20',include:'values,formulas',tableMaxRows:16,tableMaxCols:5,maxChars:12000});await fs.writeFile(base+'inspection.ndjson',inspection.ndjson);
const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:100},summary:'formula error scan'});await fs.writeFile(base+'formula-errors.ndjson',errors.ndjson);
const results={...baseline,currency:'MYR',horizon_months:18,development_hours:2400,development_rate:130,development_cost:312000,cpm_increment_included:93600,founder_committed_capital:0,verified_company_cash:0,revenue_offset:0,rounding_reserve:41500,uses:[9,10,11,12,13,14,15,16,17].map(r=>({name:labels[r],amount:get(cash,'D'+r)})),phases:[37,38,39].map(r=>({name:labels[r],spend:get(cash,'D'+r)})),monthly:Array.from({length:18},(_,i)=>({month:i+1,spend:get(cash,col(i+4)+'18'),ending_cash:get(cash,col(i+4)+'24')})),checks:tests,limitations:['All costs are internal planning assumptions, not vendor quotations.','Artifact Tool recalculation tested; native Microsoft Excel UI not tested.','Full scope, payment/data provider admission and first paying customers remain unverified.']};
await fs.writeFile(base+'results.json',JSON.stringify(results,null,2));
for(const [sh,range,name]of [[summary,'C1:G30','summary'],[cash,'C1:V24','monthlycash'],[cash,'C26:D39','funding-build'],[inp,'C1:F25','inputs-operating'],[inp,'C27:H42','inputs-development']]){const p=await wb.render({sheetName:sh.name,range,scale:1.5,format:'png'});await fs.writeFile(out+name+'.png',new Uint8Array(await p.arrayBuffer()));}
const xlsx=await SpreadsheetFile.exportXlsx(wb);await xlsx.save(out+'Wringy-18个月资金计划.xlsx');
console.log(JSON.stringify({baseline,checks:tests,errorScan:errors.ndjson,output:out+'Wringy-18个月资金计划.xlsx'}));

import fs from 'node:fs/promises';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
const dir=new URL('.',import.meta.url).pathname,out=dir+'output/';
const i=JSON.parse(await fs.readFile(dir+'inputs.json','utf8'));
const r=JSON.parse(await fs.readFile(dir+'results.json','utf8'));
const w=Workbook.create();
const s=w.worksheets.add('Summary'),c=w.worksheets.add('Cash'),u=w.worksheets.add('Campaign'),p=w.worksheets.add('Inputs');
const nf='#,##0;(#,##0);"–"',blue='#0000FF',green='#008040',ink='#263127';
const v=(sh,a,x)=>sh.getRange(a).values=[[x]];
function f(sh,a,x){sh.getRange(a).formulas=[[x]];sh.getRange(a).format.font.color=sh===s?ink:x.includes('!')?green:ink;}
function title(sh,t,desc){v(sh,'C2',t);sh.getRange('C2').format.font.size=16;v(sh,'C3',desc);}
function hdr(sh,a,vs){sh.getRange(a).values=[vs];sh.getRange(a).format={fill:ink,font:{bold:true,color:'#FFFFFF'},horizontalAlignment:'center'};}
for(const sh of [s,c,u,p]){sh.showGridLines=false;sh.getRange('A1:J55').format={font:{name:'Arial',size:11,color:ink},rowHeight:25,verticalAlignment:'center'};sh.getRange('A1:B55').format.columnWidth=3;sh.getRange('C1:C55').format.columnWidth=48;sh.getRange('D1:D55').format.columnWidth=18;sh.getRange('E1:E55').format.columnWidth=3;sh.getRange('F1:F55').format.columnWidth=70;sh.tabColor=sh===s?ink:'#A7B195';}
const ds=[
 ['研发总上限（含内部预备金）',i.rd_all_in_cap,'创办人指定上限；含QA、安全验收、交接，非报价'],
 ['研发内部预备金（上限内）',i.rd_reserve_within_cap,'代理占位；不可在总上限之外再次叠加'],
 ['非研发缓冲比例',i.non_rd_buffer_rate,'只对非研发现金支出计一次'],
 ['创办人薪资及津贴／月（已确认）',i.founder_allowance_base_monthly,i.founder_living_support_status],
 ['',null,''],
 ['地推与交通／月',i.ground_sales_monthly,'内部占位；创办人销售，无付费规模营销'],
 ['付费运营支持小时／试点月',i.paid_operations_hours_per_pilot_month,'含单场支持、招募、异常和独立复核，不另计固定履约'],
 ['付费运营时薪',i.operations_hourly_rate,'内部现金总包估算，非已招聘或报价'],
 ['云与工具／月',i.cloud_tools_monthly,'基础托管、表单及备份，小规模限额'],
 ['维护小时／试点月',i.maintenance_hours_per_pilot_month,'仅依赖更新、监控与备份；不含缺陷修复及保修'],
 ['维护时薪',i.maintenance_hourly_rate,'既有内部假设；不是研发交付工时证明'],
 ['法务设立／试点条款一次费',i.legal_setup,'内部专业服务占位，需报价'],
 ['会计与行政专业服务／月',i.accounting_monthly,'内部总包占位，超出须重算'],
 ['试点数据与付款费池／试点月',i.trial_data_payment_pool_monthly,'单场数据及平台服务费收款成本从此池消耗'],
 ['试点开始月序号',i.pilot_start_month,'内部排期假设；不得以日期替代验收'],
 ['募资向上取整步长',i.rounding_step,'代理提议可供主稿选择，不是已获资金'],
 ['创办人已承诺资本',i.committed_capital,'未知按0，不表示已承诺0；不含无薪劳动'],
 ['已核实公司现金',i.verified_company_cash,'未知按0；不含品牌奖励池'],
 ['每试点月活动数（成本演示）',i.example_campaigns_per_pilot_month,'非客户预测；用来检查试点费用池，不产生收入抵扣'],
 ['单场已确认奖励（非公司收入）',i.campaign.reward_budget,'品牌直接支付奖励；非已签活动'],
 ['奖励外加服务费率',i.campaign.fee_rate_external,'15%仅演示，非Whop费率或已批准Wringy价格'],
 ['单场付费支持小时',i.campaign.paid_manual_hours,'含全部提交、拒绝和异常的平均占位'],
 ['单场创办人无薪小时',i.campaign.unpaid_founder_manual_hours,'计经济成本；零现金不等于免费劳动'],
 ['无薪劳动经济时薪',i.campaign.economic_hourly_rate,'内部替代成本估算'],
 ['单场增量数据费',i.campaign.data_cost,'基础工具外增量；从数据付款费池消耗'],
 ['单场服务费收款成本',i.campaign.payment_cost,'不含创作者奖励转账费；服务商未报价'],
];
title(p,'Content Rewards 输入','蓝字黄底可改。RM；零薪资政策已确认，其余预算与收费仍为估算。');hdr(p,'C5:D5',['输入','数值']);v(p,'F5','依据与边界');
ds.forEach((a,n)=>{v(p,'C'+(n+6),a[0]);v(p,'D'+(n+6),a[1]);v(p,'F'+(n+6),a[2]);});p.getRange('D6:D31').format={fill:'#FFF2CC',font:{color:blue},numberFormat:nf};p.getRange('D8').setNumberFormat('0.0%');p.getRange('D26').setNumberFormat('0.0%');
hdr(p,'C34:I34',['研发现金分配假设','M1','M2','M3','M4','M5','M6']);p.getRange('D35:I35').values=[i.rd_payment_weights];p.getRange('D35:I35').format={fill:'#FFF2CC',font:{color:blue},numberFormat:'0%'};
v(p,'C38','费率比较（仅单场算例）');p.getRange('D38:F38').values=[i.campaign.fee_scenario_rates];p.getRange('D38:F38').format={fill:'#FFF2CC',font:{color:blue},numberFormat:'0%'};
v(p,'C40','人工总工时压力倍数');v(p,'D40',i.campaign.manual_hours_stress_multiplier);p.getRange('D40').format={fill:'#FFF2CC',font:{color:blue},numberFormat:'0.0'};
v(p,'C41','总研发上限保护范围，不保证交付。复用设计资产仍须核实。');v(p,'C43','报价超额时删减或延后非必要功能；不得削减身份权限、证据保留及安全验收。');v(p,'C45','无内部开发、钱包、自动结算或自动反作弊。品牌直付或已批准服务商。');p.freezePanes.freezeRows(5);
p.getRange('E1:E46').format.columnWidth=10;p.getRange('D35:I35').format.horizontalAlignment='center';p.getRange('D38:F38').format.horizontalAlignment='center';
// Cash owns all budget calculations. Campaign demonstrations never generate forecast revenue.
title(c,'六个月资金计划','研发按总上限保守占用。收入按零。M1为获准启动后首月。');hdr(c,'C5:J5',['现金项目／RM','六个月',...Array.from({length:6},(_,j)=>`M${j+1}`)]);
const cl={6:'月序号',7:'研发总额（含QA及内部预备金）',8:'地推与交通',9:'付费运营支持池',10:'云与工具',11:'持续维护（排除缺陷保修）',12:'法务与会计',13:'试点数据与付款费池',14:'创办人津贴',15:'非研发支出',16:'支出合计',18:'收入抵扣',19:'期初公司现金',20:'拟议融资到账',21:'已承诺资本到账',22:'期末公司现金',25:'研发总上限',26:'非研发支出合计',27:'全部支出',28:'非研发现金缓冲',29:'减：已承诺资本',30:'减：已核实现金',31:'基础最低资金需求',32:'基础取整募资建议',33:'取整增加储备',34:'基础期末现金',36:'研发实施额度（内部预备金前）'};
for(const[k,l]of Object.entries(cl))v(c,'C'+k,l);
for(let m=1;m<=6;m++){const cc=String.fromCharCode(68+m),prev=String.fromCharCode(67+m),weight=String.fromCharCode(67+m);v(c,cc+'6',m);const ff={7:`=IF(ISNUMBER('Inputs'!$D$6),'Inputs'!$D$6*'Inputs'!${weight}35,NA())`,8:"='Inputs'!$D$11",9:`=IF(${cc}$6>='Inputs'!$D$20,'Inputs'!$D$12*'Inputs'!$D$13,0)`,10:"='Inputs'!$D$14",11:`=IF(${cc}$6>='Inputs'!$D$20,'Inputs'!$D$15*'Inputs'!$D$16,0)`,12:`='Inputs'!$D$18+IF(${cc}$6=1,'Inputs'!$D$17,0)`,13:`=IF(${cc}$6>='Inputs'!$D$20,'Inputs'!$D$19,0)`,14:"='Inputs'!$D$9",15:`=SUM(${cc}8:${cc}14)`,16:`=${cc}7+${cc}15`,18:'=0',19:m===1?"='Inputs'!$D$23":`=${prev}22`,20:m===1?'=$D$32':'=0',21:m===1?"='Inputs'!$D$22":'=0',22:`=SUM(${cc}18:${cc}21)-${cc}16`};for(const[k,x]of Object.entries(ff))f(c,cc+k,x);}
for(const rr of [7,8,9,10,11,12,13,14,15,16,18,20,21])f(c,'D'+rr,`=SUM(E${rr}:J${rr})`);f(c,'D19','=E19');f(c,'D22','=J22');
const cf={25:'=D7',26:'=D15',27:'=D16',28:"=D26*'Inputs'!D8",29:"='Inputs'!D22",30:"='Inputs'!D23",31:'=MAX(0,D27+D28-D29-D30)',32:"=ROUNDUP(D31/'Inputs'!D21,0)*'Inputs'!D21",33:'=D32-D31',34:'=J22',36:"=D25-'Inputs'!D7"};for(const[k,x]of Object.entries(cf))f(c,'D'+k,x);
c.getRange('D1:J45').format.columnWidth=15;c.getRange('D7:J41').setNumberFormat(nf);c.freezePanes.freezeRows(6);c.freezePanes.freezeColumns(3);
for(const rr of [15,16,22,31,32])c.getRange(`C${rr}:J${rr}`).format.fill='#EEF1E7';
title(u,'单场经济与费用池','奖励由品牌支付。仅经营算例，不构成收入确认或会计毛利判断。');hdr(u,'C5:D5',['单场演示／RM','数值']);
const ul={6:'创作者奖励（非平台收入）',7:'奖励外加服务费率',8:'平台服务费收入（演示）',9:'品牌总支出（未计税）',11:'付费支持小时',12:'创办人无薪小时',13:'付费人工现金成本',14:'无薪劳动经济成本',15:'增量数据成本',16:'服务费收款成本',18:'经济可变成本',19:'经济贡献（固定费前）',20:'经济贡献率',21:'现金可变成本',22:'现金贡献（未扣无薪劳动）',25:'六个月成本演示活动数',26:'消耗的付费运营池',27:'消耗的数据付款费池',28:'上述单场现金成本合计',29:'剩余运营池：招募与异常',30:'剩余数据付款费池',31:'创办人无薪总小时',33:'月固定费用覆盖基数（无津贴）',35:'费率对覆盖固定费所需活动数的影响'};
for(const[k,l]of Object.entries(ul))v(u,'C'+k,l);
const uf={6:"='Inputs'!D25",7:"=IF(ISNUMBER('Inputs'!D26),'Inputs'!D26,NA())",8:'=D6*D7',9:'=D6+D8',11:"='Inputs'!D27",12:"='Inputs'!D28",13:"=D11*'Inputs'!D13",14:"=D12*'Inputs'!D29",15:"='Inputs'!D30",16:"='Inputs'!D31",18:'=SUM(D13:D16)',19:'=D8-D18',20:'=IF(D8=0,"n.a.",D19/D8)',21:'=SUM(D13,D15:D16)',22:'=D8-D21',25:"=(7-'Inputs'!D20)*'Inputs'!D24",26:'=D25*D13',27:'=D25*SUM(D15:D16)',28:'=SUM(D26:D27)',29:"='Cash'!D9-D26",30:"='Cash'!D13-D27",31:'=D25*D12',33:"='Cash'!H15-'Cash'!H14-D21*'Inputs'!D24"};for(const[k,x]of Object.entries(uf))f(u,'D'+k,x);
hdr(u,'C37:F37',['费率情景','费率','经济贡献／场','活动数／月']);for(let j=0;j<3;j++){let row=38+j;v(u,'C'+row,['较低费率演示','基础费率演示','较高费率演示'][j]);f(u,'D'+row,`='Inputs'!${String.fromCharCode(68+j)}38`);f(u,'E'+row,`=$D$6*D${row}-$D$18`);f(u,'F'+row,`=IF(OR(E${row}<=0,$D$33<0),"n.a.",ROUNDUP($D$33/E${row},0))`);}
u.getRange('D6:D40').setNumberFormat(nf);u.getRange('D7').setNumberFormat('0.0%');u.getRange('D20').setNumberFormat('0.0%');u.getRange('D38:D40').setNumberFormat('0%');u.getRange('E37:F40').format.columnWidth=20;u.getRange('E38:F40').setNumberFormat(nf);
v(u,'C57','本算例未计异常损失，发生时进一步扣减。');
v(u,'C59','人工：1小时付费支持＋2小时创办人无薪。');
v(u,'C60','工时涵盖全部提交、拒绝及异常处理。');
v(u,'C61','异常处理工时不等于异常损失赔付。');
v(u,'C63','16场仅作费用池容量演示，不对应3个品牌目标。');
u.getRange('C57:C63').format.wrapText=true;u.getRange('C57:C63').format.rowHeight=42;
u.getRange('C57:G64').format.font={name:'Arial',size:11,color:ink};u.getRange('C57:G64').format.verticalAlignment='center';
v(u,'C43','活动数仅为费用池演示，未预测成交；单场成本不再加进Cash。');v(u,'C45','费用池余额若为负，须减量或重新预算；不掩盖超额。');v(u,'C47','覆盖数量不是回本日期，不含研发、一次法务、缓冲或津贴。');v(u,'C49','固定费按试点月拆分；扩量需额外人工产能及重估固定支出。');
u.getRange('D29:D30').conditionalFormats.add('cellIs',{operator:'lessThan',formula:0,format:{fill:'#FCE4D6',font:{color:'#C00000'}}});
v(u,'C51','基础人工总工时');f(u,'D51','=SUM(D11:D12)');v(u,'C52','人工压力：总工时');f(u,'D52',"=D51*'Inputs'!D40");v(u,'C53','人工压力：经济可变成本');f(u,'D53',"=SUM(D13:D14)*'Inputs'!D40+SUM(D15:D16)");v(u,'C54','人工压力：经济贡献');f(u,'D54','=D8-D53');v(u,'C55','人工压力：贡献率');f(u,'D55','=IF(D8=0,"n.a.",D54/D8)');u.getRange('D51:D54').setNumberFormat(nf);u.getRange('D55').setNumberFormat('0.0%');
title(s,'Content Rewards 首轮资金','六个月。可用beta＋创办人地推。内部预算，未获供应商交付报价。');hdr(s,'C5:D5',['资金用途／RM','基础']);
const su={6:['研发总上限（内含预备金）',25],7:['地推、运营及其他非研发',26],8:['非研发现金缓冲',28],9:['基础资金需求',31],10:['基础取整募资建议',32],11:['基础期末公司现金',34]};for(const[k,[l,t]]of Object.entries(su)){v(s,'C'+k,l);f(s,'D'+k,`='Cash'!D${t}`);}
hdr(s,'F5:G5',['单场演示／RM','金额']);for(const[n,l,t]of [[6,'创作者奖励（非平台收入）',6],[7,'平台服务费收入',8],[8,'经济可变成本',18],[9,'经济贡献（非会计毛利）',19],[10,'现金可变成本',21],[11,'现金贡献（未扣无薪劳动）',22]]){v(s,'F'+n,l);f(s,'G'+n,`='Campaign'!D${t}`);}
v(s,'C19','创办人已确认无需薪资或津贴。单场无薪劳动仍计RM60经济成本。');v(s,'C21','研发RM50,000已包含测试、交接及内部预备金，不另加15%研发缓冲。');v(s,'C23','若报价超过上限，减／延后非必要范围；不得降低安全与可用beta的验收要求。');v(s,'C25','不以假定收入抵扣募资；品牌奖励池不计公司收入或可用现金。');v(s,'C27','试点单场现金成本消耗已列预算池，不额外扣一次贡献成本。');v(s,'C29','单场15%费率仅演示，非已批准定价。没有承诺未来轮金额或回本日期。');
s.getRange('F1:F30').format.columnWidth=40;s.getRange('G1:G30').format.columnWidth=18;s.getRange('D6:D16').setNumberFormat(nf);s.getRange('G6:G11').setNumberFormat(nf);for(const rr of [9,10]){s.getRange(`C${rr}:D${rr}`).format.fill=rr===10?'#DEE8B5':'#EEF1E7';s.getRange(`C${rr}:D${rr}`).format.font.bold=true;}
v(s,'C10','拟议融资总额（待批准）');v(s,'C18','零薪资及津贴政策已确认；RM70,000融资总额尚未批准。');v(c,'C32','拟议融资总额（待批准）');p.getRange('C10:F10').clear({applyTo:'all'});
for(const row of [18,19,21,23,25,27,29]){s.getRange('C'+(row-4)).copyFrom(s.getRange('C'+row),'all');s.getRange('C'+row).clear({applyTo:'contents'});}
w.recalculate();const get=(sh,a)=>sh.getRange(a).values[0][0],tests=[];
function eq(name,actual,expected){if(Math.abs(actual-expected)>0.001)throw Error(`${name}: ${actual} vs ${expected}`);tests.push({name,actual,expected,pass:true});}
eq('base funding need',get(c,'D31'),65663);eq('proposed rounded ask',get(c,'D32'),70000);eq('confirmed zero cash allowance',get(c,'D14'),0);eq('unpaid labor remains economic cost',get(u,'D14'),60);eq('economic contribution',get(u,'D19'),180);eq('cash contribution',get(u,'D22'),240);eq('trial units inside cash pools',get(u,'D28'),960);eq('fixed coverage',get(u,'D33'),1940);eq('fee scenario coverage',get(u,'F39'),11);
eq('total manual hours',get(u,'D51'),3);eq('doubled total manual hours',get(u,'D52'),6);eq('doubled labor contribution',get(u,'D54'),90);eq('doubled labor rate',get(u,'D55'),0.3);
v(p,'D26',0.1);w.recalculate();eq('fee change contribution',get(u,'D19'),80);eq('fee does not offset safety funding',get(c,'D31'),65663);v(p,'D26',0.15);
v(p,'D27',2);w.recalculate();eq('paid hours update cash cost',get(u,'D21'),90);eq('unit costs consume existing ops pool',get(u,'D26'),960);eq('no double add of unit costs',get(c,'D31'),65663);v(p,'D27',1);
v(p,'D6',45000);w.recalculate();eq('rd cap edit no second buffer',get(c,'D31'),60663);v(p,'D6',50000);
v(p,'D26',0);w.recalculate();if(get(u,'D20')!=='n.a.')throw Error('Zero fee ratio guard failed');tests.push({name:'zero fee ratio unavailable',pass:true});v(p,'D26',0.15);
v(p,'D26',null);w.recalculate();if(!String(get(u,'D8')).includes('#N/A'))throw Error('Blank fee must not become zero');tests.push({name:'blank fee exposes missing input',pass:true});v(p,'D26',0.15);
w.recalculate();const er=await w.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:100}});await fs.writeFile(dir+'formula-scan.ndjson',er.ndjson);
const inspect=await w.inspect({kind:'table',range:'Summary!C5:G16',include:'values,formulas',tableMaxRows:12,tableMaxCols:5,maxChars:8000});await fs.writeFile(dir+'inspection.ndjson',inspect.ndjson);
r.status='FORMULAS_VERIFIED_VISUAL_QA_PENDING';r.formula_checks=tests;r.formula_scan=er.ndjson;r.monthly=Array.from({length:6},(_,j)=>({month:j+1,spend:get(c,String.fromCharCode(69+j)+'16'),ending_cash:get(c,String.fromCharCode(69+j)+'22')}));r.xlsx=out+'Wringy-首轮资金与单场经济.xlsx';await fs.writeFile(dir+'results.json',JSON.stringify(r,null,2));
for(const [sh,range,name]of [[s,'C1:G26','summary'],[c,'C1:J22','monthly-cash'],[c,'C24:D37','funding-calculation'],[u,'C1:G33','campaign'],[u,'C35:G64','coverage-scenarios'],[p,'C1:F32','inputs'],[p,'C34:I46','input-schedule']]){const image=await w.render({sheetName:sh.name,range,scale:1.5,format:'png'});await fs.writeFile(out+name+'.png',new Uint8Array(await image.arrayBuffer()));}
const file=await SpreadsheetFile.exportXlsx(w);await file.save(r.xlsx);console.log(JSON.stringify({file:r.xlsx,tests,formula_scan:er.ndjson}));

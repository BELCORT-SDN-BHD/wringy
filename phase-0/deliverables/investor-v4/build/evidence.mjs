import { FONT, applyPresentationChartFont } from './runtime.mjs';
export const BUDGET={currency:'MYR',periodMonths:18,buildMonths:4,operationsMonths:14,revenueAssumption:0,
 labels:['首版开发（含预备金）','商业与运营（18个月）','上线后技术（14个月）','获客试验与启动','非开发支出缓冲'],
 values:[189750,216000,70000,50000,50400],source:'phase-0/foundation/belcort-handoff-v1.md'};
export const BUDGET_TOTAL=BUDGET.values.reduce((a,b)=>a+b,0);
if(BUDGET_TOTAL!==576150||BUDGET.values[4]!==.15*(216000+70000+50000))throw Error('Canonical budget arithmetic failed');
export const MARKET={videoShare:.25,otherShare:.75,year:2025,malaysiaEcommerceUSDBillion:20,
 regionalSource:'https://blog.google/company-news/inside-google/around-the-globe/google-asia/sea-economy-2025/',
 malaysiaSource:'https://blog.google/intl/ms-my/company-news/around-the-globe/2025_11_e-conomy-sea-report-2025-malaysias/'};
export function marketChart(slide,C,position){
 const chart=slide.charts.add('bar',{position,categories:['2025年估算'],
  series:[{name:'视频电商',values:[.25],valuesFormatCode:'0%',fill:C.accent},{name:'其他电商',values:[.75],valuesFormatCode:'0%',fill:C.line}],
  barOptions:{direction:'bar',grouping:'stacked',overlap:100,gapWidth:45},hasLegend:true,
  legend:{position:'bottom',textStyle:{typeface:FONT,fontSize:22,fill:C.ink}},
  xAxis:{visible:false,tickLabelPosition:'none',line:{fill:'none',width:0},majorGridlines:null},yAxis:{visible:false,min:0,max:1,numberFormatCode:'0%',tickLabelPosition:'none',line:{fill:'none',width:0}},
  dataLabels:{showValue:true,position:'center',textStyle:{typeface:FONT,fontSize:30,fill:C.ink,bold:true}},
  chartFill:'none',chartLine:{fill:'none',width:0},plotAreaFill:'none',plotAreaLine:{fill:'none',width:0}});
 applyPresentationChartFont(chart,{fontFamily:FONT});return chart;
}
export function budgetChart(slide,C,position){
 const chart=slide.charts.add('bar',{position,categories:[...BUDGET.labels].reverse(),
  series:[{name:'基准资金规划（MYR）',values:[...BUDGET.values].reverse(),valuesFormatCode:'#,##0',fill:C.accent}],
  barOptions:{direction:'bar',grouping:'clustered',gapWidth:64},hasLegend:false,
  xAxis:{visible:true,textStyle:{typeface:FONT,fontSize:23,fill:C.ink},line:{fill:'none',width:0},majorGridlines:null},
  yAxis:{visible:false,tickLabelPosition:'none',majorGridlines:null,min:0,max:280000,numberFormatCode:'#,##0',line:{fill:'none',width:0}},
  dataLabels:{showValue:true,position:'outEnd',textStyle:{typeface:FONT,fontSize:22,bold:true,fill:C.ink}},
  chartFill:'none',chartLine:{fill:'none',width:0},plotAreaFill:'none',plotAreaLine:{fill:'none',width:0}});
 applyPresentationChartFont(chart,{fontFamily:FONT});return chart;
}

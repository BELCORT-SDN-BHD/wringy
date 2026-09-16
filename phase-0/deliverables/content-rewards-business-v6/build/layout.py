from pathlib import Path
r=Path(__file__).resolve().parent
old=(r.parent.parent/'content-rewards-business-v5/build/build.mjs').read_text()
head=old.split('// 1 Full-height')[0].replace("path.join(ROOT,'finance/results.json')","path.join(ROOT,'../content-rewards-business-v5/finance/results.json')")
def section(n,nextn):
 return old[old.index('// '+str(n)+' '):old.index('// '+str(nextn)+' ')]
s1=section(1,2).replace("'Wringy',45,65,381,96,70","'Wringy的生意',45,65,381,96,46").replace("'品牌与本地\\n创作者的\\n内容合作'","'品牌付费\\n创作者传播\\n内容'").replace("'制作与发布内容\\n按约定结果获得奖励'","'创作者按约获得奖励\\nWringy收取服务费'")
s2=section(2,3).replace("'有产品，有素材'","'品牌提供'").replace("'还需要有人\\n把内容带给\\n相关受众'","'授权素材\\n活动预算'").replace("'不同创作者的表达\\n不同账号的发布'","'让创作者把内容\\n带给相关受众'")
s3="""// 3 single transaction, editable allocation branches
s=page();photo(s,'brand-source',56,223,281,368);text(s,'品牌总支出',385,232,810,50,29);text(s,'RM2,300',385,290,810,94,65,true,C.primary);rule(s,385,414,818);
caption(s,'RM2,000','创作者按约获得奖励',385,445,497);caption(s,'RM300','Wringy服务收入',934,445,284);text(s,'授权素材供创作者制作发布，按约核验奖励。',385,590,822,57,27,false,C.primary);
"""
s4="""// 4 recurring per-campaign pricing
s=page();text(s,'已确认奖励',58,230,510,51,28);text(s,'RM2,000 × 15%',58,296,920,98,61,true,C.primary);text(s,'服务费 RM300',880,316,342,75,34,true,C.primary);
chart(s,'bar',{position:box(56,399,1167,116),categories:['品牌支出'],series:[{name:'创作者奖励',values:[2000],fill:C.primary},{name:'外加服务费',values:[300],fill:C.brand}],barOptions:{direction:'bar',grouping:'stacked',overlap:100},hasLegend:false,xAxis:hidden,yAxis:{...hidden,min:0,max:2300}});
text(s,'按活动收费',58,555,550,55,32,true);text(s,'复购带来下一场服务收入',652,555,570,55,30,true);text(s,'处理工时决定服务费能留下多少贡献。',58,610,1164,44,25,false,muted);
"""
s5="""// 5 native economic cost and contribution composition
s=page();text(s,'单场经济贡献',58,222,537,54,30);text(s,'RM180',58,293,576,108,74,true,C.primary);text(s,'贡献率 60%',58,420,570,72,40,true,C.primary);text(s,'人工RM90含RM60\\n未领薪创办人劳动',58,533,570,91,28,false,muted);
chart(s,'bar',{position:box(648,238,562,128),categories:['服务收入300'],series:[{name:'人工',values:[90],fill:C['chart-2']},{name:'数据',values:[20],fill:'#A2B5AA'},{name:'收款',values:[10],fill:'#D1DBD5'},{name:'经济贡献',values:[180],fill:C.primary}],barOptions:{direction:'bar',grouping:'stacked',overlap:100},hasLegend:false,xAxis:hidden,yAxis:{...hidden,min:0,max:300}});
text(s,'收入 RM300',665,194,541,46,25,false,muted);text(s,'人工 90   数据 20   收款 10',665,391,546,59,28,true);rule(s,665,470,542);text(s,'经济成本 RM120',665,493,546,60,30);text(s,'余下贡献 RM180',665,563,546,62,31,true,C.primary);
"""
s6="""// 6 brand repeat purchase, outcome-focused photo composition
s=page({sub:false});photo(s,'published-content',56,151,495,477);text(s,'品牌为何再投一笔预算',607,156,614,78,35,true,C.primary);
caption(s,'事前约定','明确传播目标与合格结果',607,270,614);caption(s,'活动结束','报告发布与核验结果，处理争议',607,430,614);text(s,'品牌根据结果决定是否复购',607,587,614,57,30,true,C.primary);
"""
s7=section(6,7)
s8=section(4,5).replace("'全托管活动\\n团队组织剪辑者网络'","'品牌购买全托管活动\\n团队组织剪辑者网络'").replace("'品牌设活动\\n创作者投稿与领取奖励'","'品牌设奖励活动\\n创作者投稿参与'")
s9=section(9,10)
s10=section(10,11).replace("'六个月研发与试点'","'六个月研发与生意试点'").replace("'含5,000内部预留'","'原型与可使用Beta，含5k预留'")
s11="""// 11 conditions for expanding the business
s=page();const conditions=[['品牌愿意复购',0],['单场经济可行',1],['运营能够承接',2],['再议营销资金',3]];conditions.forEach(([t,i])=>{const x=58+i*295,y=475-i*63;rect(s,x,y,267,10,i===3?C.brand:C.primary);text(s,String(i+1).padStart(2,'0'),x,y-114,260,56,38,true,C.primary);text(s,t,x,y-50,267,58,28,true);});text(s,'扩量前同时重估获客成本和固定费用。',58,581,1165,67,31,false,C.primary);
"""
s12=section(12,13).replace("'Content Rewards'","'长期经营价值'").replace("'本地活动、品牌关系与创作者供给'","'复购品牌、本地供给、可靠交付'").replace("'品牌活动工具\\n创作者经营工具'","'品牌商业服务\\n创作者商业服务'")
s13="""// 13 manual-hour sensitivity, not company break-even
s=page();text(s,'人工 RM30／小时',58,268,470,65,33,true,C.primary);text(s,'数据与收款\\n合计 RM30／场',58,371,470,107,30);text(s,'9小时\\n单场贡献归零',58,522,470,105,33,true,C.primary);
chart(s,'line',{position:box(548,236,662,369),categories:['3小时','6小时','9小时','12小时'],series:[{name:'单场经济贡献RM',values:[180,90,0,-90],line:{fill:C.primary,width:4},fill:C.primary}],hasLegend:false,xAxis:axis,yAxis:{...axis,min:-100,max:200,majorUnit:100},dataLabels:{showValue:true,position:'above',textStyle:{fontSize:24,fill:C.foreground}}});
"""
tail=old[old.index('// 14 readable'):].replace("v5 15 slides, 4 photos, 4 native charts, 2 tables","v6 15 slides, 4 reused photos, 5 native charts, 2 tables")
(r/'build.mjs').write_text(head+s1+s2+s3+s4+s5+s6+s7+s8+s9+s10+s11+s12+s13+tail)
(r/'run-final.mjs').write_text("import {finalize} from './finalize.mjs';\nimport {BUILD,ROOT,path} from './runtime.mjs';\nawait finalize(path.join(BUILD,'linked.pptx'),path.join(ROOT,'output/Wringy-Content-Rewards-Business-Plan.pptx'),{count:15,charts:[4,5,7,10,13],tables:[14]});\n")

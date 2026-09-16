from pathlib import Path
import json
b=Path(__file__).parent;p=b/'build.mjs';s=p.read_text()
s=s.replace('steps,nativeTable}', 'steps,nativeTable,chart}')
s=s.replace("const research=", "const f=JSON.parse(await fs.readFile(path.join(ROOT,'finance/results.json'),'utf8'));\nconst cap=JSON.parse(await fs.readFile(path.join(ROOT,'../funding-growth-v1/capital-sources.json'),'utf8'));\nconst sprout=cap.sources.find(x=>x.publisher.includes('Sprout')).url;\nconst research=")
a=s.index("steps(s,[{title:'服务收入'");z=s.index("s=pg('参考机制",a)
s=s[:a]+"""chart(s,'bar',{position:box(55,240,1158,268),categories:['服务收入','经济可变成本','单场贡献'],series:[{name:'RM',values:[f.campaign.platform_fee_income_illustrative,f.campaign.economic_variable_cost,f.campaign.economic_contribution],fill:C.primary}],barOptions:{direction:'bar',grouping:'clustered'},hasLegend:false,dataLabels:{showValue:true},xAxis:{visible:true},yAxis:{visible:true,min:0,max:350}});
body(s,'人工 3小时 × RM30 ＋ 数据 RM20 ＋ 收款 RM10 ＝ RM120',523,26,65);
label(s,'贡献 RM180（60%）；人工增至6小时 → RM90（30%）。',579);
"""+s[z:]
a=s.index("body(s,'资金用途：");z=s.index("s=pg('第一轮验证",a)
s=s[:a]+"""chart(s,'bar',{position:box(55,222,1158,112),categories:['基础情景'],series:[{name:'研发',values:[f.rd_all_in_cap],fill:C.primary},{name:'非研发',values:[f.non_rd_spend_base],fill:C['chart-2']},{name:'缓冲与取整储备',values:[f.non_rd_buffer+f.rounding_reserve],fill:C.brand}],barOptions:{direction:'bar',grouping:'stacked',overlap:100},hasLegend:false,xAxis:{visible:false},yAxis:{visible:false,min:0,max:70000}});
body(s,'研发 50,000 ＋ 非研发 13,620 ＋ 缓冲 2,043 ＋ 取整储备 4,337',337,24,58);
tx(s,'RM70,000',58,410,540,77,51,true,C.primary);tx(s,'RM110,000',666,410,540,77,51,true,C.primary);
tx(s,'不含创办人津贴；自行承担生活费尚未确认',58,496,540,75,25);tx(s,'含 RM6,000／月津贴及对应缓冲',666,496,540,75,25);
label(s,'两种讨论情景，均非已选募资额。零收入抵扣；品牌奖励不占公司现金。',581);
tx(s,'研发含RM5,000内部预留；15%外部缓冲仅计非研发。全款到账起计时，分期到账重算。',58,668,1090,38,16,false,C['muted-foreground']);
"""+s[z:]
s=s.replace("title:'第3–4个月',body:'交付 Beta\\n运行受控活动'", "title:'第3个月',body:'计划完成 Beta 验收\\n随后运行受控活动'")
s=s.replace("'战略并购、具备买方的老股转让，以及长期上市可能');", "'战略并购、具备买方的老股转让，以及长期上市可能','',[sprout]);")
s=s.replace("body(s,'研发上限 RM50,000；整轮金额待财务模型汇入。\\n第二轮扩大营销，未来模块随需求推进。',492,29,100);label(s,'RM50,000 不是总募资额；不承诺估值或持股比例。',614);", "body(s,'6个月资金情景：无津贴 RM70,000 ／ 含津贴 RM110,000\\n研发上限 RM50,000；第二轮扩大营销。',492,29,100);label(s,'零津贴需确认；两情景均未选定，待报价、津贴与投资条款确认。',614);")
a=s.index("s=pg('附录：预算");z=s.index("s=pg('附录：来源",a)
s=s[:a]+"""s=pg('附录：预算与单场成本','6个月规划估价；零创办人津贴尚未确认');
nativeTable(s,[['基础资金用途','RM'],['研发（含内部预留5,000）','50,000'],['地推／试点运营','4,500／2,400'],['云工具／持续维护','1,200／1,040'],['法务会计／试点数据收款','4,000／480'],['基础支出','63,620'],['非研发缓冲／取整储备','2,043／4,337'],['合计','70,000']],{x:56,y:237,width:650,rowH:46,colWidths:[445,205],font:22});
tx(s,'单场经济成本',746,243,464,59,31,true,C.primary);tx(s,'1小时有偿＋2小时创办人劳动\\n3小时 × RM30 ＝ RM90\\n数据 RM20 ＋ 收款 RM10\\n贡献：RM300 − RM120 ＝ RM180',746,324,464,210,24);
tx(s,'现金成本由运营与试点费用池消耗，\\n不重复追加；未领薪劳动仍计成本。',746,552,464,79,22);
tx(s,'不垫付奖励。维护不承接研发超额或合同保修。费用池16场是用量测算，非客户或收入预测。\\n贡献未扣获客及固定费用，不是净利率；非研发单价、用量与零津贴均待确认。',58,641,1090,62,18,false,C['muted-foreground']);
"""+s[z:]
s=s.replace("['creator','Content Rewards · 创作者条款\\ncontentrewards.com/terms',urls[2]]", "['sprout','Sprout Social · Tagger 收购公告\\ninvestors.sproutsocial.com',sprout]")
s=s.replace('pendingFinance:[5,12,16,17]','pendingFinance:[]').replace("console.log('Draft 18 slides exported; finance placeholders explicit.');","console.log('18 slides exported with verified model values.');")
p.write_text(s)

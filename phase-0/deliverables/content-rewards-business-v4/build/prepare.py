from pathlib import Path
import shutil
r=Path(__file__).resolve().parent.parent;old=r.parent/'content-rewards-business-v3'
for name in ['runtime.mjs','template.mjs','render.mjs','finalize.mjs','links.mjs','add-pptx-links.py','pdf.py','contact.py','qa.py']:
 shutil.copy2(old/'build'/name,r/'build'/name)
(r/'build/node_modules').symlink_to('${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')
s=(old/'build/build.mjs').read_text()
changes={
"const U={cr:":"const U={clipping:'https://clipping.net/brands',cr:",
"外部事实核验日期：2026-09-12。":"Clipping官方页面核验日期：2026-09-13；其余外部事实沿用2026-09-12。创办人低认知观察不是已验证零竞争。Clipping的CPM是观看奖励或成本单位，不是平台抽成，公开完整费表未知。https://clipping.net/brands\\nhttps://clipping.net/enterprise",
"品牌与创作者的\\n内容合作平台":"把内容奖励模式\\n带进马来西亚",
"第一步：Content Rewards，马来西亚首发":"让品牌借助本地创作者网络分发内容",
"马来西亚是首发地，首批客群还要验证":"本地认知度与首批客群，都需要验证",
"先通过访谈与付费试点，选择最适合的品牌细分":"创办人观察：本地认知度很低。首批品牌细分仍未确定。",
"第一笔资金，做出Beta并开始验证":"第一笔资金，支持Beta、市场教育与试点",
"['M1–2','范围与原型']":"['M1–2','解释模式与原型']",
"['M3–6','受控活动试点']":"['M3–6','小规模付费试点']",
"品牌拜访与需求访谈同步进行":"品牌拜访解释模式，并同步验证需求。费用纳入既有预算。",
"下一阶段营销，建立在真实证据上":"先让品牌理解，再取得试用与复购证据",
"先建立付费、可靠交付与复购证据，再扩大有效的合作":"市场教育后，验证独立品牌愿意付费并再次购买",
"[['独立付款','真实品牌付费'],['可靠交付','内容与奖励可追踪'],['再次购买','同一品牌复购']]":"[['理解模式','品牌理解价值与规则'],['付费试用','独立品牌小额付费'],['再次购买','同一品牌复购']]",
"长期价值，来自能重复发生的合作":"早期进入的价值，要靠本地积累形成",
"逐步积累品牌关系、创作者供给与可靠活动组织能力":"机会窗口是待验证判断，品牌关系与交付经验需要逐步建立",
"['复购品牌关系','能持续交付的创作者','可靠的活动组织']":"['本地品牌关系','本地创作者供给','可靠的活动交付经验']",
"战略价值来自持续合作的能力，不依赖某个买家或退出日期。":"早进入不自动形成护城河，长期价值仍取决于持续需求与交付。",
"先验证品牌会回来，再扩大合作规模":"第一笔资金，验证马来西亚是否愿意采用",
"在马来西亚，验证品牌\\n是否持续购买 Content Rewards":"从理解模式到付费试点\\n验证本地品牌是否愿意持续购买",
"做出Beta并取得需求证据":"Beta、市场教育与付费试点",
"扩大已有证据支持的活动":"需求证据与运营产能就绪后扩大",
"外部事实核验于2026年9月12日，完整URL存于相关页备注":"Clipping核验于9月13日，其余资料沿用9月12日。完整URL见备注。",
"v3: 12 main":"v4: 12 main",
}
for a,b in changes.items():
 assert a in s,a
 s=s.replace(a,b)
a=s.index('// 2 Opportunity');b=s.index('// 3 Concrete',a)
s=s[:a]+'''// 2 Overseas reference vs local observation
s=pg('海外已有参考模式，本地采用仍待验证','Wringy的提案：本地内容分发，加上按约核验的奖励','Clipping为官方自述，非独立效果审计。低认知为创办人观察，不代表零竞争、首家或已验证需求。',[U.clipping]);
text(s,'海外参考',58,272,472,61,34,true,C.primary);text(s,'Clipping',58,352,472,65,42,true);text(s,'全托管内容活动\\n剪辑者网络参与分发',58,432,492,100,29);
rect(s,628,275,1,283,C.border);
text(s,'马来西亚机会假设',713,272,510,61,34,true,C.primary);text(s,'创办人观察：认知度很低',713,359,510,67,31,true);text(s,'先解释模式与价值\\n再验证本地品牌愿不愿付费',713,439,510,102,29);
note(s,'海外有参考，不等于本地已有需求。付费试点与复购是下一步证据。',606,25);
''' + s[b:]
a=s.index('// 4 Before');b=s.index('// 5 Focus',a)
s=s[:a]+'''// 4 Distribution proposition, native editable before/after flow
s=pg('品牌希望触达相关受众，创作者获得付费机会','','本地受众相关性与传播效果仍待试点核验。不承诺流量、销量、收益或零作弊。');
text(s,'品牌提供内容与传播目标',58,212,522,61,31,true);text(s,'本地创作者参与发布',700,212,520,61,31,true,C.primary);
const b1=plain(s,'before','品牌',58,375,124,66,33);['授权素材','传播目标','奖励预算'].forEach((a,i)=>{const n=plain(s,'one'+i,a,351,298+i*102,223,62,28);link(s,b1,n);});
rect(s,631,245,1,312,C.border);
const activity=node(s,'activity','内容分发活动\\n按约核验奖励',698,337,277,128,{fill:C.primary,color:C['primary-foreground'],size:28});
['创作者A','创作者B','创作者C'].forEach((a,i)=>{const n=plain(s,'participant'+i,a,1061,282+i*111,156,61,28);link(s,activity,n);});
text(s,'素材、规则与交付记录支持活动。创作者看清奖励条件后决定参与。',58,559,1160,58,26);note(s,'关键验证：品牌是否愿为相关受众的内容分发付费，并再次购买？',621,25);
''' + s[b:]
s=s.replace("const sources=[['cr'","const sources=[['clipping','Clipping · 全托管品牌活动\\nclipping.net/brands',U.clipping],['cr'")
s=s.replace('y:255+Math.floor(i/2)*122,w:550,h:97','y:233+Math.floor(i/2)*99,w:550,h:88')
(r/'build/build.mjs').write_text(s)
l=(r/'build/links.mjs').read_text().replace('fontSize:25','fontSize:23');(r/'build/links.mjs').write_text(l)
(r/'build/run-final.mjs').write_text("import {finalize} from './finalize.mjs';\nimport {BUILD,ROOT,path} from './runtime.mjs';\nawait finalize(path.join(BUILD,'linked.pptx'),path.join(ROOT,'output/Wringy-Content-Rewards-Business-Plan.pptx'),{count:15,charts:[7,9,13],tables:[14]});\n")
(r/'brief.md').write_text('''# Wringy商业计划 v4

2026-09-13。创办人发现Clipping.net并表示马来西亚认知度低，main解释低认知为创办人观察、海外参考不证明本地需求。创办人回复“可以”，授权更新deck。批准本次叙事修改，不代表费率、市场数据、预算情景或实施方案获批准。

范围：沿用v3品牌、15页结构及原生可编辑图表。以本地内容分发和按约核验奖励为定位，首笔资金支持市场教育、小规模付费试点、复购验证。早期机会需建立品牌关系、本地创作者供给及交付经验，不自动形成护城河。无额外预算。

事实来源：phase-0/research/clipping-v1/findings.md（2026-09-13官方公开页面核查），v1研究与财务结果（2026-09-12）。财务模型、50k研发上限、70k/110k未选定情景均不变。

验收：15页；机会观察与虚构案例可见；无首家/唯一/零竞争断言；CPM不混同平台费；原生图表4、表格2；全页render视觉复查；零溢出；PDF可点击来源；指定共享记录更新。仅v4及获授权窄范围记录可写，不改v3、finance或sources。
''')
# Full story is generated from declared visible strings, with extra notes retained per slide.
oldsections=(old/'story.md').read_text().split('\n## ')[1:]
blocks=s.split("s=pg(")
# Cover declaration uses let s=pg, the same split catches it.
import re,ast
story='# Wringy商业计划 v4：完整可见文案\n\n2026-09-13。12页主稿＋3页附录。用户“可以”授权本次更新；预算、收费与实施仍待确认。Clipping核验日期9月13日，其余事实沿用9月12日。\n'
for i,block in enumerate(blocks[1:],1):
 section=block.split('// ')[0]
 # all quoted visible literals and notes, preserving exact strings; filter internal ids/geometry.
 title=re.match(r"'((?:[^'\\]|\\.)*)'",section).group(1)
 if i==1:title='Wringy'
 story+=f'\n## {i} {title}\n'
 # Derive useful complete visible strings from all text calls and pg first args.
 first=section.split(');',1)[0]
 strs=re.findall(r"'((?:[^'\\]|\\.)*)'",first)
 vis=[]
 for v in strs[:3]:
  if v:vis.append(v.replace('\\n','\n'))
 for m in re.finditer(r"(?:text|note)\(s,'((?:[^'\\]|\\.)*)'",section):vis.append(m.group(1).replace('\\n','\n'))
 story+='\n'.join(dict.fromkeys(vis))+'\n'
 story+='\n备注：'+oldsections[i-1].split('\n',1)[1]+'\n'
 if i in [1,2,4,6,8,10,11,12,15]:story+='补充备注：本次定位为本地内容分发与按约核验奖励的提案。创办人低认知观察不是市场调查或零竞争结论。海外参考不能证明马来西亚需求，下一阶段营销须有付费、复购及可靠运营产能。市场教育纳入原预算，不增加资金。\n'
 if i in [2,7,15]:story+='Clipping参考来源：https://clipping.net/brands ；https://clipping.net/enterprise 。全托管为官方自述，完整品牌平台费表、费基及最低预算未知。CPM是每千次观看成本或奖励，不是平台抽成。\n'
(r/'story.md').write_text(story)
with Path('phase-0/founder-inputs.md').open('a') as h:h.write('\n## 本地内容分发与市场教育叙事批准｜2026-09-13\n\n创办人发现Clipping.net并观察马来西亚对该模式认知度很低。main解释这不是已验证零竞争，海外参考不证明本地需求，首笔资金验证市场教育、小规模付费试点与复购，早期进入需积累本地品牌关系、创作者供给及交付经验。创办人回复“可以”，授权更新商业计划v4。50k研发约束及70k/110k未选定情景不变，不增加预算或批准实施规则。记录见deliverables/content-rewards-business-v4/brief.md。\n')
print('v4 setup, complete story and approval recorded')

from pathlib import Path
import json, re, hashlib

dst = Path(__file__).resolve().parent
src = dst.parents[1] / 'content-rewards-business-v1' / 'finance'
dst.joinpath('output').mkdir(exist_ok=True)
inputs = json.loads((src / 'inputs.json').read_text())
inputs.pop('founder_allowance_sensitivity_monthly')
inputs['founder_living_support_status'] = '创办人已确认无需薪资或津贴；本轮六个月公司现金支出为0。无薪劳动仍计经济成本。'
inputs['founder_allowance_policy_confirmed'] = True
inputs['as_of'] = '2026-09-13'
inputs['source_notes']['founder_policy'] = '2026-09-13本轮用户确认：创办人不需要薪资或津贴。此确认不等于批准RM70,000融资请求。'
inputs['canonical_version'] = 'content-rewards-business-v5/finance'
(dst / 'inputs.json').write_text(json.dumps(inputs, ensure_ascii=False, indent=2))
results = json.loads((src / 'results.json').read_text())
for k in ['founder_allowance_sensitivity', 'formula_checks', 'formula_scan', 'verification']:
    results.pop(k, None)
results['status'] = 'CURRENT_POLICY_UPDATED_WORKBOOK_QA_PENDING'
results['as_of'] = '2026-09-13'
results['founder_allowance_policy'] = {'monthly_cash': 0, 'six_month_cash': 0, 'confirmed': True, 'source': '2026-09-13本轮用户确认'}
results['funding_selection_status'] = '已选择零薪资及津贴政策；RM70,000仍为拟议融资总额，尚未批准募资额'
results['proposed_ask_approved'] = False
results['limits'] = [x for x in results['limits'] if 'Personal living' not in x]
results['xlsx'] = str(dst / 'output' / 'Wringy-首轮资金与单场经济.xlsx')
results['canonical_version'] = inputs['canonical_version']
(dst / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))

b = (src / 'build.mjs').read_text()
b = b.replace("out=dir+'outputs/initial-funding/'", "out=dir+'output/'")
b = b.replace("['创办人津贴／月：基础',i.founder_allowance_base_monthly,i.founder_living_support_status]", "['创办人薪资及津贴／月（已确认）',i.founder_allowance_base_monthly,i.founder_living_support_status]")
b = b.replace("['创办人津贴／月：敏感性',i.founder_allowance_sensitivity_monthly,'仅敏感性，不是已批准薪资']", "['',null,'']")
b = b.replace('蓝字黄底可改。RM；全部非上限项目为内部预算或演示假设。', '蓝字黄底可改。RM；零薪资政策已确认，其余预算与收费仍为估算。')
for old in ["34:'敏感性：六个月创办人津贴',", "35:'敏感性：非研发支出',", "36:'敏感性：非研发缓冲',", "37:'敏感性：资金需求',", "38:'敏感性：取整建议',"]:
    assert old in b
    b = b.replace(old, '')
old = '''34:"='Inputs'!D10*6",35:'=D26-D14+D34',36:"=D35*'Inputs'!D8",37:'=MAX(0,D25+D35+D36-D29-D30)',38:"=ROUNDUP(D37/'Inputs'!D21,0)*'Inputs'!D21",'''
assert old in b
b = b.replace(old, '')
b = b.replace("39:'基础期末现金',41:'研发实施额度（内部预备金前）'", "34:'基础期末现金',36:'研发实施额度（内部预备金前）'")
b = b.replace("39:'=J22',41:", "34:'=J22',36:")
b = b.replace('[15,16,22,31,32,37,38]', '[15,16,22,31,32]')
old = "11:['基础期末公司现金',39],14:['敏感性：创办人津贴六个月',34],15:['敏感性：资金需求',37],16:['敏感性：取整募资建议',38]"
assert old in b
b = b.replace(old, "11:['基础期末公司现金',34]")
b = b.replace("v(s,'C19','零津贴假设个人生活由创办人自筹，尚未确认；上方同时显示每月RM6,000的影响。');", "v(s,'C19','创办人已确认无需薪资或津贴。单场无薪劳动仍计RM60经济成本。');")
b = b.replace('[9,10,15,16]', '[9,10]')
old = "v(s,'C10','零津贴：暂定取整情景');v(s,'C16','含津贴：暂定取整情景');v(s,'C18','两种资金情景均为暂定，尚未选择募资额。');v(c,'C32','零津贴：暂定取整情景');v(c,'C38','含津贴：暂定取整情景');"
assert old in b
b = b.replace(old, "v(s,'C10','拟议融资总额（待批准）');v(s,'C18','零薪资及津贴政策已确认；RM70,000融资总额尚未批准。');v(c,'C32','拟议融资总额（待批准）');p.getRange('C10:F10').clear({applyTo:'all'});")
b = b.replace("eq('allowance sensitivity',get(c,'D37'),107063);", "eq('confirmed zero cash allowance',get(c,'D14'),0);eq('unpaid labor remains economic cost',get(u,'D14'),60);")
b = b.replace("v(p,'D9',6000);w.recalculate();eq('actual allowance edit feeds cash',get(c,'D31'),107063);v(p,'D9',0);\n", '')
b = b.replace("Wringy-Content-Rewards-6个月资金与单场经济.xlsx", "Wringy-首轮资金与单场经济.xlsx")
b = b.replace("[c,'C24:D42','funding-calculation']", "[c,'C24:D37','funding-calculation']")
# Compact the opening summary after removing the salary comparison, preserving all other views.
b = b.replace("w.recalculate();const get=", "for(const row of [18,19,21,23,25,27,29]){s.getRange('C'+(row-4)).copyFrom(s.getRange('C'+row),'all');s.getRange('C'+row).clear({applyTo:'contents'});}\nw.recalculate();const get=")
b = b.replace("[s,'C1:G30','summary']", "[s,'C1:G26','summary']")
assert not any(x in b for x in ['110000', '107063', '6000', '津贴：敏感性', '两种资金情景'])
(dst / 'build.mjs').write_text(b)

note = (src / 'finance-note.md').read_text()
note = note.replace('2026-09-12。', '2026-09-13。', 1)
note = note.replace('**上限不是供应商交付报价或可行性保证。零津贴RM70,000／含每月RM6,000津贴RM110,000为两个暂定融资情景，尚未选择募资额。** 主稿确认的是中间算术，不是研发交付承诺。', '**创办人已确认无需薪资或津贴，六个月公司薪资／津贴现金预算为RM0。RM70,000仍为拟议融资总额，尚未批准。研发RM50,000是上限，不是供应商交付报价或可行性保证。**')
start = note.index('零津贴假设创办人自行承担个人生活')
end = note.index('\n\n', start)
note = note[:start] + '创办人不领取薪资或津贴的现金政策已于本轮确认，新版不保留有薪情景。无薪劳动仍有经济成本：单场创办人2小时×RM30＝RM60，保持计入经济可变成本；它不是已付现金，也不是已承诺投入公司的现金资本。' + note[end:]
note = note.replace('零津贴暂定取整情景', '拟议融资总额（待批准）')
note = note.replace('检查包括独立合计、津贴变更、', '检查包括独立合计、已确认零津贴与无薪劳动成本保留、')
note += '\n\n## 当前来源\n\n本次deck财务来源为`content-rewards-business-v5/finance/inputs.json`、`results.json`及`output/Wringy-首轮资金与单场经济.xlsx`。v1仅作为历史，不更改或替换其文件。数值沿用已核验基础方案，唯一政策变更是创办人零薪资／津贴从未确认假设变为已确认政策。首轮融资额、供应商交付可行性与收费假设未因此获批准。\n'
assert '110,000' not in note and '尚未确认' not in note
(dst / 'finance-note.md').write_text(note)
history = {str(x.relative_to(src)): hashlib.sha256(x.read_bytes()).hexdigest() for x in [src/'inputs.json',src/'results.json',src/'build.mjs',src/'finance-note.md',src/'outputs/initial-funding/Wringy-Content-Rewards-6个月资金与单场经济.xlsx']}
(dst / 'historical-source-hashes.json').write_text(json.dumps(history,ensure_ascii=False,indent=2))
print(json.dumps({'results':str(dst/'results.json'),'funding_need':results['base_funding_need'],'proposed_ask':results['proposed_ask_rounded_5000'],'policy_confirmed':True,'ask_approved':False},ensure_ascii=False))

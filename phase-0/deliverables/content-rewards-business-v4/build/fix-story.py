from pathlib import Path
r=Path(__file__).resolve().parent.parent
s=(r/'story.md').read_text();parts=s.split('\n## ');out=parts[0]
extra={
2:'海外参考：Clipping。全托管内容活动，剪辑者网络参与分发。\n马来西亚机会假设。创办人观察：认知度很低。先解释模式与价值，再验证本地品牌愿不愿付费。',
3:'图示：品牌提供产品演示素材；创作者A 使用演示；创作者B 场景剪辑；创作者C 产品讲解；合格内容获得确认奖励。',
4:'图示：品牌提供授权素材、传播目标、奖励预算；内容分发活动与按约核验奖励连接创作者A／B／C。',
5:'未来分支：品牌团队工具、创作者商业经营。',
7:'原生图表：创作者奖励RM2,000；Wringy服务收入RM300；品牌总支出RM2,300。',
8:'六个月规划：M1–2解释模式与原型；M3计划Beta验收；M3–6小规模付费试点。',
9:'原生图表：研发50,000、非研发13,620、缓冲及取整储备6,380；无津贴70,000、含津贴110,000。',
10:'关卡01 理解模式：品牌理解价值与规则。关卡02 付费试用：独立品牌小额付费。关卡03 再次购买：同一品牌复购。',
11:'图示：本地品牌关系、本地创作者供给、可靠的活动交付经验，汇聚为潜在战略契合：营销软件／商业平台。',
13:'原生图表：3小时180、6小时90、9小时0、12小时−90（RM单场经济贡献）。',
14:'市场表：2022电商经营单位78,236；活跃调整80%／适配率10%（假设）；年奖励24,000／服务费率15%（假设）；年平台费容量约22.53m；年奖励减半约11.27m。\n预算表：研发含5,000内部预留50,000；地推4,500／运营2,400；云工具1,200／维护1,040；法务会计4,000／数据收款480；基础支出63,620；缓冲2,043／取整储备4,337；合计70,000。',
15:'7个可点击官方来源：Clipping全托管品牌活动（clipping.net/brands）；Content Rewards品牌条款（contentrewards.com/brands-terms）；Whop自有奖励计划（whop.com/content-rewards-terms-of-service）；MDA FY2025数字广告（malaysiandigitalassociation.org.my）；DOSM历史经营单位（dosm.gov.my）；Google马来西亚电商背景（blog.google/intl/ms-my）；Sprout Social收购公告（investors.sproutsocial.com）。'}
notes={
1:'定位为拟议本地内容分发与按约核验奖励服务。创作者网络尚需招募，产品尚非已完成Beta。',
2:'Clipping品牌页为官方自述：客户提供目标、素材、平台与预算，其团队负责全托管活动和剪辑者网络。未独立审计传播效果，也未确认Malaysia支持。创办人低认知观察不是市场调查，不主张第一、唯一或零竞争。https://clipping.net/brands （核验2026-09-13）',
3:'虚构示例只解释拟议活动，参与者数量不代表供给规模。内容与观看来自外部平台，按约核验及付款路径仍待准入。',
4:'相关受众的内容传播是购买价值假设。地域真实性、有效观看、计量、审核及履约仍待试点验证，不以翻译界面推定本地效果。https://clipping.net/brands',
5:'未来工具与商业模块需客户需求支持，未计首轮研发范围或本轮收入预测。',
6:'MDA FY2025广告估计仅作宏观背景。DOSM 2022电商经营单位并非2026品牌清单。78,236×80%×10%约6,259；乘年奖励24,000与15%得到约22.53m平台费容量假设，不与2.96bn相加。来源核验2026-09-12：https://malaysiandigitalassociation.org.my/digital-adex-fy-2025/ ；https://www.dosm.gov.my/portal-main/release-content/malaysia-digital-economy-2024',
7:'15%为Wringy演示费率，费基为已确认奖励2,000，非品牌总支出2,300。品牌支出不等于全部经过Wringy。Clipping CPM为每千次观看成本或奖励，其完整平台费表、费基与最低预算未公开于本次所读页面，不能用于推定take rate。https://clipping.net/brands ；https://clipping.net/enterprise （2026-09-13核验）',
8:'RM50,000是创办人研发上限，含5,000内部预留，非已获确认的Belcort报价。市场教育在既有地推与运营预算中安排，不新增费用池。实际研发范围、第三方数据及付款准入仍需核定。',
9:'70k/110k为六个月零收入抵扣的规划情景，未选募资额。创办人无津贴、自担生活费尚未确认。品牌奖励由品牌负担，不垫付。内部研发5k预留包含在50k中，6,380由2,043非研发缓冲与4,337取整储备组成。财务模型为content-rewards-business-v1/finance/results.json。',
10:'理解、付费、复购为证据顺序，不是转化率预测。20访谈、3独立付费品牌、1复购均为规划目标，不能暗示已有客户。后续营销需支付与复购证据，也需可靠审核、交付与结算产能。下一笔资本金额、到账及轮数均未承诺。',
11:'早进入仅是机会假设，不自动形成护城河或品类所有权。战略适配仍需复购与交付证据。相邻案例Sprout Social于2023年公告以US$140m现金对价收购Tagger，并非Wringy估值依据。经营回本不同于股东退出；增资通常进入公司，老股转让对价流向出售股东。https://investors.sproutsocial.com/news/news-details/2023/Sprout-Social-Acquires-Tagger-Media/default.aspx （2026-09-12核验）',
12:'首笔资金用于Beta、模式教育与付费试点，验证本地采用及持续购买。后续资金只在需求证据与运营产能就绪后扩大活动。50k研发约束不代表整轮募资额。',
13:'经济成本人工90含30有偿支持及60未领薪创办人劳动。300−90−20−10=180；人工按30/小时。贡献未扣固定费用、获客与研发，异常损失发生时进一步扣减。9小时贡献归零不是公司盈亏平衡。',
14:'资金总和50,000+13,620+2,043+4,337=70,000。含津贴增量40,000=36,000+5,400−1,400。预算用量为假设，试点现金成本消耗既有费用池，避免重复追加。维护不承担研发超额或合同保修。DOSM公式详见第6页备注。',
15:'Clipping官方页面核验2026-09-13，其余来源沿用2026-09-12。Clipping完整平台费未知，CPM不能视为平台收费率。全部外部来源保留于相关页notes。https://clipping.net/brands ；https://contentrewards.com/brands-terms ；https://whop.com/content-rewards-terms-of-service/ ；https://malaysiandigitalassociation.org.my/digital-adex-fy-2025/ ；https://www.dosm.gov.my/portal-main/release-content/malaysia-digital-economy-2024 ；https://blog.google/intl/ms-my/company-news/around-the-globe/2025_11_e-conomy-sea-report-2025-malaysias/ ；https://investors.sproutsocial.com/news/news-details/2023/Sprout-Social-Acquires-Tagger-Media/default.aspx'}
for i,p in enumerate(parts[1:],1):
 visible=p.split('\n备注：',1)[0]
 out+='\n## '+visible+'\n'+extra.get(i,'')+'\n\n备注：'+notes[i]+'\n'
(r/'story.md').write_text(out)

# Wringy 产品与投资基础稿

**开发交接入口（2026-09-15）：** [Content Rewards交接包](development-handoff-v1.md)。方向与业务规则已确认，Wayfinder已于2026-09-15按首发规划交接范围关闭。下方历史材料不覆盖最新默认规则与全栈方向。

**2026-09-14最新执行顺序：** 先依据官方文档准备TikTok、Instagram／Meta、YouTube与付款接口、模拟数据及内部测试；真实授权和联调放在上线前，不阻塞设计及模拟开发。规格冻结审批独立保留；模拟成功不解除生产数据、资金和准入门槛。见[外部接口内部契约](external-interface-contracts-v1.md)。

**2026-09-14当前交付口径（最新）：** 创办人要求不再考虑预算，专注开发。当前工作不以RM50,000或重新报价为范围／优先级约束，不因成本自行减项。继续Content Rewards首发的三端流程、规则、PRD、架构、开发任务与验收，以产品目标和技术依赖安排顺序；数据与支付可行性仍须验证。下文历史预算及报价文字不作为当前门槛，历史财务材料保留。决定源见[创办人输入](../founder-inputs.md)。

2026-09-10。创始人及Belcort审阅入口。长期目标覆盖完整Whop业务范围，首发讨论围绕Creator Rewards。提案、示例和预算不代表真实客户、已批准规则或上线能力。

**产品语言：** 马来西亚首发采用English／Bahasa Melayu／简体中文；[本地化基础规范](localization-v1.md)。设计系统已补充可切换三语的颜色状态示例，内部设计说明仍为中文。

## 当前接入验证建议

2026-09-14：[数据与付款接入建议](integration-recommendation-v1.md)：优先验证TikTok官方授权与Stripe Connect托管入门／Checkout候选，尚未选定服务商、完成PoC或批准资金操作。

## 当前实施规格草稿

2026-09-14：[技术栈、物理结构与REST接口草稿](implementation-spec-content-rewards-v1.md)已起草，推荐单体React／Fastify／PostgreSQL及Supabase候选。尚未冻结、无迁移或代码；取整、部分报价与结清阶段仍待决。

## 当前架构与开发顺序

2026-09-14：[模块化单体架构草稿](architecture-content-rewards-v2.md)与[九个业务开发切片](development-plan-content-rewards-v1.md)已起草，承接新版PRD。架构、实施与外部服务仍未批准；测试／回退均为计划，不是已执行结果。旧architecture-v1仅作历史参考。

## 当前Content Rewards产品需求

2026-09-14：[新版PRD草稿](prd-content-rewards-v2.md)已形成，以三角色蓝图及核心默认为工作依据，包含逻辑记录、权限、异常与31项未测试验收条件。完整PRD／架构未冻结，不以公司开发预算裁剪本轮需求；供应商与真实资金操作未批准。下方按帖prd-v1保留历史，不作为当前实施依据。

## 三角色流程与页面

2026-09-14：[三角色流程蓝图](three-role-flows-v1.md)已起草，承接已确认核心默认，说明页面、权限、申请预留、审核申诉与付款对账。用户授权继续起草，不等于完整PRD或实施批准；服务时限、数据与付款路径等仍待决。

## 商家活动配置讨论

2026-09-14：[商家活动配置表](campaign-configuration-v1.md)已起草，按商家选择计划与目标的最新决定整理字段、审核及结算影响。核心默认已确认，额外执行细节仍为建议；数据能力、预算分配、资金与付款三项待决，不构成冻结PRD或实施批准。

## 当前Clipping业务机制研究

2026-09-13：[综合研究入口](../research/clipping-deep-v2/README.md)与[17页PDF](../research/clipping-deep-v2/output/Wringy-Clipping-Deep-Research.pdf)已交付。覆盖公开机制、参考平台、数据权限、异常结算及Wringy PRD待决问题，含47项编号来源和3幅流程图。9月14日用户当步批准条款后，新账号可见登录流程已完成，补充见研究入口；真实投稿、审核付款及其他角色仍未实测。9月13日PDF未包含本次补充；研究不是已批准PRD或实施规格，整体里程碑保持进行中。

## 当前Content Rewards商业计划

2026-09-13：用户明确表示“这个deck OK了”。v12演示稿内容与视觉交付已接受。该接受仅覆盖演示稿，不构成实施规格、融资金额或全部预算批准。整体里程碑仍进行中，PRD与架构尚待完成及确认。

2026-09-13：[当前商业计划](../deliverables/content-rewards-business-v12/README.md)，15页主稿。市场拆两页：DOSM统计与80%／10%／月奖励假设推算潜在采购方及约RM150m年奖励支出；50／100／300商家全年持续投放对应180k／360k／1.08m年服务收入。非全国实测市场或首轮预测。4原生图表、15页备注、5来源链接、零溢出；2–4个月目标及70k拟议保持，v5历史财务未改。

创办人确认薪资及津贴RM0。本阶段研发与付费试点验证目标为2–4个月，拟议预算额度RM70,000保持，仍非已批准募资额；研发上限RM50,000含内部RM5,000预留。v5历史六个月现金流尚待按当前阶段目标重排月度安排，并非已重算的2–4个月预测。当前[财务工作簿](../deliverables/content-rewards-business-v5/finance/output/Wringy-首轮资金与单场经济.xlsx)及结果以v5/finance为准，未领薪劳动继续计经济成本。旧版本和津贴情景保留历史，不作为当前提案。具体报价、支付数据准入与实施规格仍待确认。

## 最新产品机制研究

2026-09-11：[Whop机制与Wringy落地详细报告](../research/whop-wringy-blueprint-v1/report.md)及[PDF阅读版](../research/whop-wringy-blueprint-v1/output/pdf/Whop-Wringy-Research-Report.pdf)。重新核验当前Creator Rewards、旧体验差异、费用与审核、MY支付／社交数据，提出邀请制单渠道首版、预算额度、三语旅程和Belcort模块建议。它是研究与决策依据，未批准业务规则、供应商或新版PRD；旧按帖PRD／架构仍待更新。

## 最新视觉与投资材料

**当前设计系统：** 用户2026-09-11最新要求严格使用Linear＋shadcn，仅保留既定配色。[Design System 2.0入口](design-system-v2/README.md)已完成本地设计交付：[打开交互展示](design-system-v2/output/Wringy-Design-System.html)，61个官方组件＋3项指南模式，22项浏览器检查通过；上线能力另计。原design-system-v1手写展示已被本要求替代，不作为正式库；其中[业务状态契约](design-system-v1/domain-states.md)与12板块映射保留作产品语义参考，不冒称shadcn官方业务规则。

**当前天使轮主稿（纠正删页版）：** [10页PDF](../deliverables/angel-deck-v3/output/Wringy-Angel-Deck-v3.pdf)与[可编辑PPTX](../deliverables/angel-deck-v3/output/Wringy-Angel-Deck-v3.pptx)。以12页主稿为基础删除团队与融资两页，保留愿景，全部5页附录移除。原v1及误按17页基准生成的v2保留为历史，不是当前版本。

**天使轮视觉样稿：** [三页PDF](../deliverables/angel-visual-v1/output/Wringy-Angel-Visual-v1.pdf)与[可编辑PPTX](../deliverables/angel-visual-v1/output/Wringy-Angel-Visual-v1.pptx)，包含封面、业务示意图、产品概念画面。2026-09-10用户授权样稿，尚待视觉审阅；不替代完整18页v6或冻结设计系统。

1. 历史商业与财务研究稿：[中文投资PPTX v6](../deliverables/investor-v6/output/Wringy-Investor-v6.pptx)与[PDF预览](../deliverables/investor-v6/output/Wringy-Investor-v6-Preview.pdf)：18页，延续手绘商业故事，加入毛利、三种回本情景、支付费与收款延迟、当前审核机制及设计附录；原执行关系页保持删除。
2. 历史[品牌与组件指南PDF](design-v3/Wringy-visual-guide-v3.pdf)与[本地交互展示](design-v3/showcase.html)：包括字标、字体、颜色、摄影、界面和少量状态示例；新设计工作使用上方Design System 1.0。
3. 历史[详细设计规范](design-v3/brand-components-spec.md)与[设计值](design-v3/tokens.json)：保留来源依据，后续组件使用design-system-v1中的新源。
4. [Mobbin参考核查](../research/visual-v3/README.md)：61个Ramp区块、93张Linear界面的观察与限制，附逐项链接和流程缺步。
5. [YC官方模板核验](../research/yc-deck/source-audit.md)、[十张原图映射](../research/yc-deck/template-mapping.md)与[投资文案](../deliverables/investor-v6/story.md)：以YC问题、方案、商业模式及增长结构为基础，按照最新手绘要求展开商业与盈利说明，未虚构业绩或团队页。

**参考范围仍有缺口。** Mobbin检索数量不是指定Ramp目录65项的完成率，精确版本归属尚未完全核验。Linear的部分流程也有未查看步骤。新稿不冒称完整官方品牌提取，颜色、字体尺寸与交互数值均为Wringy提案。

## 财务与审核设计

- [可编辑36个月Excel](../finance/model-v1/outputs/financial-model/Wringy-36个月财务模型.xlsx)与[口径、假设及核验](../finance/model-v1/README.md)：公司累计回本、单月经营结果、品牌获客回收分开计算。保守36个月内未回本、基准第25月、扩张第18月，均为条件算例。
- [审核机制研究](../research/review-mechanisms-v1/findings.md)与[一手来源](../research/review-mechanisms-v1/source-ledger.md)：区分当前Content Rewards与旧Whop教程，不将旧自动通过规则套入新版。
- [Wringy审核设计依据](review-design-v1.md)：角色、内容／计量／奖励／付款状态、证据、申诉和17项验收草案；未批准实施。

新增播放计量与反作弊开发已纳入上方融资补充材料的内部估算，正式报价仍待确认。此处历史模型不能视为完整融资需求；创作者奖励不属于可供公司使用的现金。实际会计收入总额／净额口径仍需按合同判断。

## 产品、架构与开发基础

最新商业方向见[商业模式依据](business-model-v2.md)。下列按帖UGC产品命题、PRD、架构和预算尚未针对按合格播放／效果模式完成重写与重估，已标明历史候选状态。

- [完整产品总图](product-map.md)：12板块与168项Whop公开功能／边界研究入口，长期范围没有缩减。
- [产品命题](product-thesis.md)：为谁解决问题、首发候选与验证方式。
- [首版PRD](prd-v1.md)：候选流程、业务规则、异常与20项验收。
- [架构基础](architecture-v1.md)：模块、数据、权限和支付依赖。
- [Belcort交接与预算](belcort-handoff-v1.md)：开发估价、运营支出与18个月资金规划。
- [当前Content Rewards研究](../research/cr-v2/Content-Rewards-新版深度研究.md)：版本对照、公开流程与未知项。
- [创始人输入](../founder-inputs.md)：方向与授权的记录。

## 决定与提案的区别

已确认：Wringy、马来西亚起步、SEA长期市场、完整Whop方向、中文deck、创始人自有Belcort负责开发、不自聘工程团队，以及Ramp品牌／Linear后台参考方向。

仍待决定：首批客户细分、首发计酬与收费、活动准入、资金路径、具体设计值、架构选型和预算。新版投资故事以Creator Rewards和合格播放／效果为首发切入。15%收费与成本数字是算例，固定按帖奖励为被本轮叙事替代的历史候选，具体实施规格仍未批准。

还需外部证据：客户付费和复购、支付服务商准入、平台数据权限、正式交付报价、创始人适配性履历和融资诉求。当前deck可作投资讨论材料，不能代替这些证据。

PPT文字与原生数据图表可编辑，产品图片为静态概念图。PPT的PDF是图像式阅读预览，未做桌面PowerPoint编辑回存验证。交互展示仅作用于本地演示，不连接业务或付款。

旧investor-v4与v5已由财务及审核增强版v6替代。旧design-v2与Sequoia结构investor-v3保留为历史；创始人已否定其视觉依据并更换叙事模板。新材料以本页入口为准。历史[投资蓝图](investor-product-blueprint.md)保留开发估价与验证研究，不再作为当前deck结构依据。


**2026-09-14收口审阅入口：** [PRD第10／12节](prd-content-rewards-v2.md#10-观察指标与发布阻塞项)区分已批准五项与剩余待批规则。核心默认保持；文档冻结、模拟验收、生产验证分别完成，当前不把规划交付视为整体里程碑完成。

**2026-09-14五项补充已批准：** 见[默认源](campaign-defaults-v1.md)与[PRD批准边界](prd-content-rewards-v2.md#10-观察指标与发布阻塞项)。仅批准最后展示五行，取整、保留、付款最终阶段等仍待决；整体未冻结，31项验收未执行。


2026-09-15：产品体验访谈后的[全栈推荐稿](full-stack-proposal-v1.md)，包含Next.js前端、Fastify与独立后台任务职责；技术方向已确认并同步实施规格，尚未部署。


## 已安排的开发阶段

[五阶段总地图](milestones/roadmap-v1.md) · [第一阶段三端原型规格](milestones/prototype-spec-v1.md)。先体验原型，再逐步接真实数据与服务；后续阶段详细规格在各阶段开工前完成。


**Wayfinder已结案（2026-09-15）：** 下一开发入口为[首阶段原型规格](milestones/prototype-spec-v1.md)。规划关闭不代表产品已实现；[后续验证/长期模块](milestones/follow-through-v1.md)已明确承接。


[全部当前规格、milestone与开发切片索引](milestones/spec-ticket-index-v1.md)。区分已写规格、后续阶段细化及尚未独立建票的工程切片。

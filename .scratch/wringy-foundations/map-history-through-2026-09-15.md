# Wringy 全平台产品、设计与架构基础地图

Label: wayfinder:map
Status: active

2026-09-14最新：创办人要求忘记预算、专注开发；不再以RM50,000或报价作为范围／优先级约束，不因预算自行减项。当前Content Rewards首版交付终点为可执行的三端流程、规则、PRD、架构、依赖、开发任务与验收；数据／付款可行性仍须验证，以产品目标和依赖排序。历史投资财务不主动修改。决定源：[创办人输入](../../phase-0/founder-inputs.md)。

## Destination

为对标整个Whop的Wringy建立完整产品分板块定义，以及一致的PRD、品牌/设计系统、用户旅程与架构基础。全范围已确认；具体规则与设计逐项记录决定。

## Notes

创始人要求本session先处理design、完整PRD和architecture基础，授权形成这些文档与设计提案。用wayfinder逐项澄清；执行文档制作纳入本图，不把规划授权冒充实施规格批准。使用grilling及domain-modeling记录真实决定。

12板块全部在范围内；不得重新要求先选择单一商业模式。完整范围、开发排序与当地能力可用性分别记录。[产品总图](../../phase-0/foundation/product-map.md)为入口；已有168项详细研究通过总图链接，不重复建立第二套竞品事实。

本地Markdown tracker：每票独立文件，Parent指向本图，Blocked by为依赖；open且阻塞已resolved者可认领，Assignee记录负责人。现场选择只由创始人回答。当前无Git仓库，暂不创建产品代码或部署。

## Decisions so far

- 2026-09-10创始人纠正：以12页主稿为基准删除原10／11，所有5页附录不需要；angel-deck-v3共10页，保留原1–9及12。v2删页解释已被替代。

- 2026-09-10删页更新：angel-deck-v2保留原1–14与17，共15页；删除原支付敏感性与CR审核两页，主稿12页保持不变。

- [天使轮完整视觉稿](issues/17-angel-deck.md)：沿用获认可样稿完成12页主稿+5页附录；团队履历、客户证据、融资额及量化里程碑仍待创始人补充。

- [天使轮三页视觉样稿](issues/16-angel-visual.md)：封面、业务示意图、产品概念画面已交付，等待用户审阅视觉方向；完整v6保留。

- [毛利、回本模型与审核设计](issues/15-finance-review.md)：完成18页investor-v6与可编辑36月模型，纳入获客、支付费及收款延迟；审核研究映射至Wringy设计草案。新增开发未报价，情景不代表预测或获批规则。

- [品牌效果分发与平台盈利叙事改稿](issues/14-business-story.md)：依据创始人手绘图完成investor-v5，删除执行页，解释品牌预算、合格效果、平台收费与盈利，旧按帖基础稿已标待更新。

- [Ramp品牌、Linear后台与经典投资叙事改稿](issues/12-ramp-linear-deck.md)：历史design-v2已被创始人否定参考准确性，Sequoia叙事已由YC替代；文件仅保留历史。

- [完整基础稿与投资演示](issues/11-foundation-package.md)：基础制作已完成，具体商业与设计选择仍待审阅。

- [投资叙事、简洁演示设计与开发预算研究](issues/10-investor-foundation.md)：一手deck指南、逐页蓝图、产品验证映射及Belcort市场价估算已整理；研究结案不代表设计或预算批准。

- [当前Content Rewards与旧内嵌体验比较研究](issues/09-cr-current-research.md)：12项对照与三方流程已研究，版本与实测缺口保留。

- [整个平台作为产品范围](issues/01-product-loop.md)：创始人明确对标整个Whop，替代单一品牌任务切口。
- [创始人输入](../../phase-0/founder-inputs.md)：名称、市场、语言、品牌气质与旧演示撤回。

## Current frontier

2026-09-15原型优先：整体交接方向获创办人“可以”确认，随后要求安排阶段；[五阶段地图](../../phase-0/foundation/milestones/roadmap-v1.md)与[首阶段原型规格](../../phase-0/foundation/milestones/prototype-spec-v1.md)已形成。下一步仅确认原型详细范围/投入后进入开发；后续milestone不另开Wayfinder。尚未开始代码或验收。

2026-09-15交接收尾：[开发交接包](../../phase-0/foundation/development-handoff-v1.md)汇总确认方向、实现顺序与明确延后验证。收尾授权不等于最终交接批准；确认后可关闭规划，不等待产品开发完毕。旧“规则/选型待决”仅历史记录。

2026-09-15状态核查：首发Content Rewards方向、三角色共用设计系统、业务默认和全栈方向已明确，见[默认规则](../../phase-0/foundation/campaign-defaults-v1.md)、[全栈方向](../../phase-0/foundation/full-stack-proposal-v1.md)及[创办人记录](../../phase-0/founder-inputs.md)。此前“取整等仍待决”“选型尚未批准”是历史状态。当前剩余为开发交接收尾：统一PRD/开发计划中的旧表述，按新登录/通知/独立worker架构补齐可执行规格与验收映射，并记录完整规格的最终批准范围。真实接口与支付验证按创办人指示放在上线前，不应等全部产品建完才关闭规划；但尚不能因技术方向批准就宣称交接规格已完整冻结。地图暂保持active（交接收尾），不新增业务讨论。

2026-09-14：[Content Rewards实施规格草稿](../../phase-0/foundation/implementation-spec-content-rewards-v1.md)已补技术栈、物理结构和API候选；存在草稿不等于完成冻结。31项验收未执行，取整、报价及付款终点等待决定；无代码／迁移／供应商开通，整体active。

2026-09-14最新：用户“可以”仅批准最后展示五项，已从创办人记录同步[默认源](../../phase-0/foundation/campaign-defaults-v1.md)及PRD与相关文档；新增A27–A31，31项均未执行。取整、保留、付款结清、跨活动复用及精确部分报价次序仍待决，整体active。下方“新规则未批准”是此前历史状态。

2026-09-14审阅收口：[PRD集中待批规则](../../phase-0/foundation/prd-content-rewards-v2.md#10-观察指标与发布阻塞项)已合并七项审阅意见。核心数值不变，新规则未批准；文档冻结／模拟验收／生产验证三节点分开，整体active。当前技术栈、物理数据结构及完整实施规格仍待补齐。

2026-09-14最新顺序：[外部接口内部契约](../../phase-0/foundation/external-interface-contracts-v1.md)先覆盖TikTok／Instagram／YouTube和付款模拟；真实授权与联调放上线前，不作为设计或模拟开发前置。规格冻结门槛保留。文档已写，代码及测试未执行，整体active。

2026-09-14：[Content Rewards架构](../../phase-0/foundation/architecture-content-rewards-v2.md)与[开发切片计划](../../phase-0/foundation/development-plan-content-rewards-v1.md)已起草，九片追溯PRD全部26项验收；测试尚未执行。整体active，规则冻结、数据／付款可行路径及完整实施规格未完成，不代表代码批准。

2026-09-14：[Content Rewards完整PRD草稿](../../phase-0/foundation/prd-content-rewards-v2.md)已形成，26项业务验收均未测试；默认核心承接已确认记录，新细节、数据准入、付款与结案规则仍待决。用户授权起草不等于冻结；整体active，架构与实施未批准。

2026-09-14：[商家、创作者与运营完整活动流程](../../phase-0/foundation/three-role-flows-v1.md)已形成发现阶段蓝图。承接已确认默认，补齐页面、分权、四种状态和预留对账；用户“好的”授权起草，不扩大为实施批准。整体保持active，数据／付款和申诉尾额等决策未冻结。

2026-09-14：[商家活动配置讨论稿](../../phase-0/foundation/campaign-configuration-v1.md)已形成，用户授权下一步起草，不代表配置默认值获批。覆盖商家目标选择、数据资格、内容权利、预算规则和结算；三项关键待决为数据能力、预算分配、资金付款。地图保持active，PRD／架构尚未冻结。

2026-09-13：[Clipping真实流程与规则研究](issues/21-clipping-deep-research.md)已交付公开综合报告及17页PDF，含47项编号来源和3幅流程图，供Wringy PRD决策。9月14日用户当步批准条款后，新账号可见登录流程已完成并形成补充；真实投稿、审核付款及其他角色仍未实测，9月13日PDF保持历史版本。此项与整体地图保持active，PRD／架构未冻结。已接受的v12演示稿保持不动。

2026-09-13：用户明确表示“这个deck OK了”。v12演示稿内容与视觉交付已接受。该接受仅覆盖演示稿，不构成实施规格、融资金额或全部预算批准。整体里程碑仍进行中，PRD与架构尚待完成及确认。

2026-09-13当前材料：[Wringy商业计划v12](../../phase-0/deliverables/content-rewards-business-v12/README.md)。15页；市场计算与商家数量收入分为两页，统计与假设区别可见。50／100／300家全年情景收入180k／360k／1.08m，非首轮预测。其余13页仅更新页码。4原生图表、15页备注、5来源链接、零溢出，v5财务未修改。下列条目为历史进展。

2026-09-12最新融资范围：创办人要求第一轮仅原型＋地推、第二轮营销。[新方向与两种预算范围](../../phase-0/deliverables/funding-growth-v2/direction.md)已记录，替代下方RM950k作为当前提案的地位。原型是否支持真实活动待回复，6个月和金额均为代理估算；本轮未开始产品代码或重做最终deck。

2026-09-12：[投资人能理解市场与融资安排](issues/20-funding-growth-plan.md)：新增独立融资补充材料，拟融资RM950,000／18个月，包含市场容量假设、Belcort开发、用途、融资阶段和退出案例。最终验收见该项记录。创办人转述产品构想获认可，不代表投资条款或预算批准；研究不改变后续PRD／架构待冻结的状态。

2026-09-11：[Whop机制深研与Wringy蓝图建议](issues/19-whop-blueprint-research.md)研究交付完成：23页中文PDF、59项来源、3幅流程图，含版本差异、MY可行性、首版规则与Belcort模块建议。下一阶段为规则冻结、新PRD与架构；本轮不批准费用、供应商或资金流。

2026-09-11：[完整设计系统](issues/18-design-system.md)本地交付完成。用户最终要求严格Linear＋shadcn、仅沿用配色，当前入口为phase-0/foundation/design-system-v2/README.md。61官方UI源码＋3指南模式，22/22浏览器检查通过；独立HTML离线可用，业务规则及官方无对应专业控件仍按文档标明范围。v1自定义UI只作历史，领域提案仍可引用。

[完整视觉参考核查与YC演示改稿](issues/13-complete-visual-yc.md)由main认领。创始人否定上一版视觉规范准确性，要求通过Mobbin MCP全面查看后总结，并指定YC模板、增加图片和图标。已完成61个Ramp区块、93张Linear界面的有界参考核查，生成design-v3与YC结构investor-v4并逐页审阅；投资稿随后已由上述商业叙事v5替代。指定Ramp目录65项归属未完全核验，票保持open保留这个缺口。[新材料入口](../../phase-0/foundation/README.md)。旧design-v2和Sequoia演示为历史，商业规则仍待决定。

## Not yet specified

- 全板块PRD内的具体规则、数据与状态，按共享旅程逐项展开。
- 当地支付、卡、税务等外部条件及接入可行性，留在对应板块登记而非移出范围。
- 架构候选、容量目标、供应商与开发先后次序；不能由旧成本假设替代决定。

## Out of scope

本轮完成设计系统与本地交互展示，不上线产品、不把旧视觉恢复为定稿。已删除演示的历史地图保留为记录，不是当前交付入口。

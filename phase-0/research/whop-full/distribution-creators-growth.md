# Whop 分发、创作者合作与增长：B05–B08 证据档案

核查日期：**2026-09-10**。只读公开研究，无账号创建、业务 API 调用、广告投放或支付。研究 worker 独立完成，无再委派。先前 phase-0 文档仅作路径提示，下面采用的资料重新读取正文。本文件讨论证据、商业机制与矛盾；**功能清单仅在各模块卡维护**。

## 1. 模块入口与阅读约定

| 候选模块 | 唯一清单 | 交易含义 |
|---|---|---|
| B05 商品发现与评价 | [B05 模块卡](modules/B05.md) | 买家寻找商品，评价降低判断成本 |
| B06 品牌合作与付费任务 | [B06 模块卡](modules/B06.md) | 品牌买内容/分发/任务成果，产生奖励义务 |
| B07 推广、平台伙伴与分成 | [B07 模块卡](modules/B07.md) | 按买家购买或商家活动产生佣金义务 |
| B08 广告与营销归因 | [B08 模块卡](modules/B08.md) | 商家向媒体购买流量，追踪营销效果 |

卡片是**研究候选，不是 Founder 已批准规格或 Whop 实际代码架构**。其中每个功能有稳定 ID、直接来源和状态，切片/验收/指标均是分析建议，未执行测试。所有来源日期均为本次核查日；网页标注的发布日期另列。第一方指来源对其自己的产品负责：Content Rewards Inc 的官方条款是 CR 第一方，但相对 Whop 产品目录属于第三方，不能偷换。

此次扫描所给完整索引的 Ads、CRM、Partners、Bounties、Optional 相关项，下载保存 81 页官方文档正文，重点阅读指南、对象、相关字段及流程，不把 Legacy/Current 重复资源页或 993 个索引链接称为 993 个功能。[本轮可复核文档快照](source-index/distribution-docs-2026-09-10.json)。营销、合同及公告经网页工具重新打开；未把静态页面、示例和实际执行混为同一证据。

API 状态校正（2026-09-10）：[官方索引](https://docs.whop.com/llms.txt)将 `/api-reference/beta` 指为版本化 Current API；[API Stability](https://docs.whop.com/api-reference/stability.md)把 Ads/Ad Campaigns/Ad Groups/Audiences/People/Events/Media/Partners/Social Accounts/Bounty Submissions 列为 Current-only，Products/Bounties 列为两套接口均有，Affiliates/Reviews 列为仍受支持的 Legacy-only。不得由路径中的 beta 推断接口不完整或预发布。与此分开，本文引用的 [Elements Beta](https://docs.whop.com/elements/beta/ads/overview.md)明确标记 SDK `1.0.0-beta.3` 为预发布；[Elements Upcoming](https://docs.whop.com/elements/upcoming/getting-started.md)应按该页面自身成熟度说明判断，不反推底层 API 状态。[校正核查快照](source-index/distribution-stability-2026-09-10.md)。

## 2. 商业关系：增长不是一种收费

**自然分发与付费分发分开。** 官方 2025-05-12 公告说 Discover 原 30% 导流费取消到 0%；广告合同仍定义站内按点击购买搜索等位置。买家 affiliate 的“30% 默认佣金”则付给推广者，是另一条关系。[商城公告](https://web.whop.com/blog/whop-changelog/) · [广告条款](https://whop.com/whop-ads-terms/) · [全局推广佣金](https://docs.whop.com/affiliates/setup-global.md)

**创作者服务不是商品购买分佣。** CR 可以按有效观看、单篇或合作周期付款，Bounty 则按经审批的任务成果付款；两者不要求产生商品订单。B07 买家推荐需要销售触发，Partners 则随被推荐商家的合格经营活动发生。[CR 主页](https://contentrewards.com/) · [Bounties](https://docs.whop.com/developer/bounties/overview.md) · [Partners](https://docs.whop.com/developer/partners/overview.md)

**agency 至少三种含义。** CR 有代理机构下属品牌工作区；Whop Ads 的 agency account 是平台提供的广告账户设施，文档明确不是代运营服务；Partners 的渠道合作则鼓励代理、创作者等引入商家。不能据 agency 一词推导一项统一 Whop 代理订阅或额外服务费。[CR 组织条款 §11](https://b4e0vdqv6zgqeqj4pfgm.apps.whop.com/brands-terms) · [Ads 业务指南](https://docs.whop.com/manage-your-business/growth-marketing/ads.md) · [Partners 介绍](https://whop.com/blog/whop-partners/)

分析：品牌得到可扩展创意供给及分发，创作者得到可比较的报酬机会；但报酬还受到要求、预算、上限、审批、冻结与费用影响。广告购买的是媒体交付；推荐分销购买的是可归因的客户；伙伴计划购买的是商家获取。未来马来西亚平台若共用一个“campaign”对象，应保留这四种义务的差异，不能只换一个活动类型名称。

## 3. 当前 Content Rewards 的主体边界

2026-09-03 Organization Terms 明确由 Content Rewards Inc 运营新网页应用，Whop 是单独公司，负责充值、余额、提现及相关验证；旧 Whop-hosted 活动继续适用原先接受的 Brands Terms。Whop 文档又将它列于 Third Party Apps。**这证明当前公开合同如何划分职责，不证明出售、分拆、股权或完整迁移历史。**[CR 组织条款 Scope/§3](https://b4e0vdqv6zgqeqj4pfgm.apps.whop.com/brands-terms) · [Whop 集成文档](https://docs.whop.com/memberships-and-access/third-party-apps/content-rewards)

当前 CR 品牌标准平台费 10%、Verified 8%；创作者 CPM 扣 10%，按篇/周期预算达到 $5,000 时创作者费为 0%，否则 10%。品牌最低预算 $1,000。另有 Whop 处理费，不是 CR 收入。不能把双边收费简单相加成“Whop 抽预算 20%”，也不能把品牌充值池计入平台营收。[品牌定价](https://b4e0vdqv6zgqeqj4pfgm.apps.whop.com/pricing) · [创作者条款](https://b4e0vdqv6zgqeqj4pfgm.apps.whop.com/terms)

Whop 自己仍有 Content Rewards Program 合同，写按卖家实际支付给参与者金额收 10% Content Reward Fee，并有预算上限/截止时间规则。不能把该费率叠加到新 CR 合同，或替代旧活动原先接受的 Brands Terms。[Whop Program 条款](https://whop.com/content-rewards-terms-of-service/)

权利也是交易内容：CR 条款区分原创内容许可、品牌提供底层素材的作品及周期合作；获批内容有广泛使用权，未获批草稿不授予品牌使用权。未来方案不能只建“视频上传+打款”而忽略许可凭证。[组织条款 §12](https://b4e0vdqv6zgqeqj4pfgm.apps.whop.com/brands-terms)

## 4. Bounties 的独立机制与新业务面

公开任务目标已经超出剪辑，包含互动、自有账号增长、本地激活及数据采集。数据采集契约出现录制要求，直播证明需在 Whop 内完成；不能自行补出外部开发者可完成的端到端工作流。审批也只能在 Whop 后台进行，暂无公开批准/拒绝 API 或 Bounty webhook。[运行指南](https://docs.whop.com/developer/bounties/run-a-bounty-program.md) · [Bounty 对象](https://docs.whop.com/api-reference/beta/bounties/bounty.md)

钱的单位是**每份获批成果毛额**，乘名额形成预算；总池最低 $5，平台费/执行者推荐份额从毛额扣。对象同时披露毛额、标准费率后报价和推荐额；示例值不是全平台收费表。执行者经推荐链接到来可能拿到不同净额；这给获客者激励，也影响执行者真实收益。[运行指南](https://docs.whop.com/developer/bounties/run-a-bounty-program.md) · [金额字段](https://docs.whop.com/api-reference/beta/bounties/bounty.md)

边界警示：开发指南写 escrow/预锁资金；Earnings Terms 则强调金融合作方处理资金、Whop 非任务合同当事方，并不承诺调解履约争议。可把它描述为产品层的资金承诺机制，不能因此认定 Whop 是法律上的托管人或雇主。[Bounty 条款](https://whop.com/earnings-terms/)

## 5. 广告真实深度与测量限制

Meta 是业务文档明确 live 的外部网络；TikTok、Google、Snapchat、X、Reddit 尚标 coming soon。Tracking Integrations 中出现 TikTok/X/Reddit/Pinterest 仅证明可发送测量数据，不等于可从 Whop 投放该网络。[Ads 网络状态](https://docs.whop.com/manage-your-business/growth-marketing/ads.md) · [Tracking Integrations](https://docs.whop.com/manage-your-business/growth-marketing/tracking-integrations.md)

公开 API 已有完整 campaign/group/ad、社交身份、创意、受众及异步失败状态；Elements Beta 还提供嵌入式报表、人员和事件浏览。业务页面对 AI 创意、自有买家相似受众仍标 future，而 API 已描述生成媒体、People/社交互动/相似受众。处理方式是同时记录“API 契约存在”和“业务页面未宣称全面上线”，不武断选择其一。[Ads API](https://docs.whop.com/api-reference/beta/ads/overview.md) · [Audience](https://docs.whop.com/api-reference/beta/audiences/audience.md) · [Elements Beta](https://docs.whop.com/elements/beta/ads/overview.md)

归因不等于增量。Pixel 可以收外部 purchase，但 Whop purchase/ROAS 只计它处理的付款。服务端事件可能存储成功却因身份缺失无法归因。Elements Beta 报表首次/末次触点有 Whop bucket 优先规则；同一订单可在另一广告平台获得不同功劳，不能把多个平台 ROAS 相加。[Pixel](https://docs.whop.com/developer/ads/pixel.md) · [Events API 故障说明](https://docs.whop.com/developer/ads/events-api.md) · [Reporting 模型](https://docs.whop.com/elements/beta/ads/reporting.md)

## 6. 需在总报告保留的矛盾

| 事项 | 直接证据差异 | 本次处理 |
|---|---|---|
| 商城批准 | [2025-05-12 公告](https://web.whop.com/blog/whop-changelog/)称即时；[当前 Publish API](https://docs.whop.com/api-reference/beta/products/publish-product.md)要求 pending_review 和人工通过 | 卡片采用当前契约，不把旧公告当现时保证 |
| CR 自动审批 | [旧公告](https://web.whop.com/blog/whop-changelog/)48小时自动批准；[当前 CR 合同](https://b4e0vdqv6zgqeqj4pfgm.apps.whop.com/brands-terms)人工审批 | 明确版本，不能混写 |
| Partners 基数与期限 | [Earnings Terms](https://whop.com/earnings-terms/)是前六个月 Whop revenue；[当前指南](https://docs.whop.com/developer/partners/overview.md)按四类活动、每关系有效期，其中三类毛利，一类广告支出 | 不承诺固定期限/永久收入；费率与合同须逐关系核对 |
| 广告收费 | [业务指南](https://docs.whop.com/manage-your-business/growth-marketing/ads.md)无平台费；[Ads Terms](https://whop.com/whop-ads-terms/)保留站外加费与站内点击费 | 记录不同表面/合同，未知当前统一加价 |
| 广告功能成熟度 | [业务指南](https://docs.whop.com/manage-your-business/growth-marketing/ads.md)部分 future；[Audience](https://docs.whop.com/api-reference/beta/audiences/audience.md)/[创意 API](https://docs.whop.com/api-reference/beta/ads/overview.md)已列契约 | 按 Stability 区分 Current API；组件预发布与业务界面上线状态分别记录，不由 beta 路径推断 |
| CR 验证 | [主页](https://contentrewards.com/)强验证营销；同页 FAQ 独立验证限选定代理 beta | 不声称所有观看已有独立审计 |
| Bounty 目标修改 | [运行指南](https://docs.whop.com/developer/bounties/run-a-bounty-program.md)同时说创建时声明一次、发布后可改内容包含 goal；[对象](https://docs.whop.com/api-reference/beta/bounties/bounty.md)写创建时声明 | 不把“可随时改目标”写入候选默认能力，等待实际契约验证 |

## 7. 边界与完整性说明

研究者于 2026-09-10 提出的候选归属分类如下；用户授权模块化研究，未批准此具体边界：B01 身份/组织/团队/商品；B02 付款执行；B03 权益交付；B04 通用 CRM/分析/客服；B05 发现评价；B06 活动、投稿、奖励义务；B07 推荐归因与佣金义务；B08 广告活动与归因；B09 账本/转账/提现；B10 验证/风险/退款争议/税政策；B11 开发者契约；B12 AI 工具。所有依赖是所需能力，不是整模块瀑布，也不是 Whop 内部依赖。

特别的重叠：B06 生成“应付奖励”而非自建余额；B07 生成“应付佣金”而非直接定义提现状态；B08 的 People 展示可嵌入 B04，但其营销归因规则仍在 B08。Bounty 平台费率、CR 计酬验证、广告归因可以提供风险信号，争议最终裁决不能由三个模块各说各话。

覆盖缺口：匿名 [Discover](https://whop.com/discover/) 本轮读到营销首页，无法证明全量搜索 UI；评价审核政策有正文，公开 API 主要为读取，写入/申诉后台未测；CR 新旧合同实际接受版本、代理商务协议、所有国家资格和实际账单未取得；Bounties 数据采集与直播客户端未走完；广告站内后台、跨网络真实启动、像素隐私同意/删除、媒体方独立认证未测试。未使用 Mobbin，避免把历史截图作为当前业务规则。

未发现可支持模块净利润、商家平均收入、投放实际回报、平台补贴和网络返点的原始财务材料，因此不做此类数字推断。马来西亚平台的币种、本地付款、身份、税务、数据同意及推广合法性需要后续当地依据；本档案仅交付可研究和拆建的候选业务边界。

# Whop 研究覆盖审计

核对日期：2026-09-10。范围：完整索引核算、业务主模块分类、5 个官方公开页面的边缘业务探测。

**结论：索引核算闭合，实质研究覆盖尚未获证。** 993 条条目全部保留，993 个精确唯一 URL，0 条精确重复，0 条未分配模块；原 4 条显式分类歧义已通过正文复核关闭；跨域归属标为分析性分类，主模块保持不变。本审计读取的是全部索引标题、URL、摘要与章节，不是逐篇打开 993 个正文。JSON 中 989 条为 `indexed_not_body_verified`，4 条为 `body_verified_for_classification`（正文仅用于核对分类依据，不等于 API 实测、可用性认证或已批准产品主张）。不能给四名实质研究员签发“已全覆盖”结论。

## 依据与口径

- 本地固定输入：[官方索引快照](${WRINGY_WORKSPACE}/phase-0/research/whop-full/source-index/docs-llms-2026-09-10.txt)；源入口：[Whop docs llms.txt](https://docs.whop.com/llms.txt)（快照日期 2026-09-10）。
- 输入 SHA-256：`e456b060827eaf4215a08ac2f18275fc6f952beefabce7b44327d916325066fa`。
- 逐条清单：[coverage.json](${WRINGY_WORKSPACE}/phase-0/research/whop-full/source-index/coverage.json)。一条记录对应原索引中的一个 Markdown 链接条目，顺序保持一致；仅精确 URL 去重核算，不假设不同 URL 正文相同。
- 读取完整文件后，以资源功能规则分类全部条目；复核 Optional 全部 112 条、宽泛资源和跨模块例外。主模块只选一个，重要交叉功能与不确定性放在 classification_note。
- 索引已分类 ≠ 页面正文已读 ≠ 功能存在及可用性已核实 ≠ 独立功能数量。API 的对象、动作、事件、指南与不同版本会重复描述同一能力。

## 原索引全部章节

| 原章节 | 链接条目数 |
|---|---:|
| For AI agents | 0 |
| API essentials | 0 |
| Getting started | 9 |
| Payments | 94 |
| Payouts & Money Movement | 48 |
| Ads | 15 |
| CRM | 54 |
| Partners | 1 |
| Chat & engagement | 64 |
| Courses | 28 |
| Identity & accounts | 10 |
| AI & MCP | 12 |
| Apps & developer tools | 46 |
| Stats & reporting | 3 |
| Bounties | 6 |
| SDKs & embedded elements | 145 |
| Whop API reference | 343 |
| OpenAPI specs | 3 |
| Optional | 112 |
| **合计** | **993** |

其中 For AI agents 与 API essentials 是说明性元数据章节，各有 4、7 条说明项目，共 11 条，不算正文条目；其 URL 没有被悄悄当作业务功能。其他标题、段落、SDK 包名、鉴权示例亦不计数。OpenAPI specs 的 3 条链接是正式索引条目，全部保留在 B11，不能当作 3 个功能。

11 条元数据中有 10 次 URL 出现、10 个唯一 URL；其中 5 个不在 993 条正文清单中。它们是机器入口或工具入口，列为明确排除项：

- [https://api.whop.com/api/v1](https://api.whop.com/api/v1)（索引元数据，2026-09-10；未读取服务内容）。
- [https://docs.whop.com/.well-known/skills/index.json](https://docs.whop.com/.well-known/skills/index.json)（索引元数据，2026-09-10；未读取服务内容）。
- [https://docs.whop.com/mcp](https://docs.whop.com/mcp)（索引元数据，2026-09-10；未读取服务内容）。
- [https://mcp.whop.com/mcp](https://mcp.whop.com/mcp)（索引元数据，2026-09-10；未读取服务内容）。
- [https://whop.sh](https://whop.sh)（索引元数据，2026-09-10；未读取服务内容）。

## 主模块分布

| 主模块 | 业务范围 | 索引条目数 |
|---|---|---:|
| B01 | 账户、团队、店铺、商品目录 | 65 |
| B02 | 结账、支付、账单、订阅 | 189 |
| B03 | 交付、社区、课程、实物、服务 | 134 |
| B04 | 客户关系、支持、分析 | 47 |
| B05 | 市场、发现、评论 | 12 |
| B06 | 品牌创作者合作、悬赏 | 20 |
| B07 | 联盟、伙伴 | 28 |
| B08 | 广告、归因 | 100 |
| B09 | 钱包、出款、卡、融资 | 167 |
| B10 | 风险、税、争议 | 102 |
| B11 | 平台、API、开发、SDK、企业 | 106 |
| B12 | AI、业务赋能 | 23 |
| **合计** | | **993** |

## 容易误分的边界

以下只是索引内容的分类判断，来源均为上述 2026-09-10 固定快照及每条 JSON 的原 URL。

- **Optional 不是可忽略业务**：112 条全部入账，包括实物、线下商户、服务、SaaS、平台、Content Rewards、卡风控、税、伙伴和会计集成。SaaS/Platforms 归 B11，实物及服务行业归 B03；行业名字不是单个产品功能。
- **Whop API reference 的 343 条**：342 条是 `/api-reference/beta/`，另 1 条为通用 webhook 指南。按功能拆开，不能统归 B11；beta 路径也不单独证明功能是未发布实验品。
- **Products** 的 CRUD 归 B01；市场搜索、上架/下架及发布事件归 B05。评论归 B05。应用商店开发/安装生态归 B11，消费者应用交付归 B03。
- **Members / Memberships / People / Users** 分别偏 B04 客户关系、B02 订阅（权益操作例外 B03）、B08 营销身份归因、B01 个人身份。广义 People 不与用户账号或付费会员直接合并。
- **宽泛 users API 名称已检查摘要**：List/Register/Delete/Create Challenge 指个人 passkey；Retrieve/Update 指个人设置；Set/List Experiences/List Topics 指通知偏好。不能由标题猜成用户创建、体验目录或主题搜索。
- **宽泛业务例外**：Form Company 归 B12 公司设立；Recommended Actions、AI Chats、AI Media 归 B12；Cards/Swaps/Deposits/Transfers 归 B09；KYC、准备金、暂停连接账户、Calculate Tax 归 B10。
- **Payments/CRM 原章节不是主模块**：联盟佣金归 B07、Shipment 归 B03、争议与 Resolution Center 归 B10。常规退款操作归 B02，客服会话归 B04。Company Token Transactions 暂按社区内积分归 B03，不推定可兑现钱包资金。
- **SDK/Elements 按用途分**：嵌入结账归 B02；广告/Pixel/网站流量表归 B08；钱包及卡归 B09；身份验证与税号归 B10；通用安装/样式/类型归 B11。SearchElement 是聊天搜索，不是市场发现。
- **融资名称须限定**：索引里的融资申请/审批摘要指买家 BNPL（先买后付）资格；归 B09 并注明 B02 交叉，不能推论为商户营运贷款。

## URL 去重与版本风险

- 精确 URL：993 个，无重复。去掉 `.md` 和尾部 `/` 后：993 个；未做网络重定向去重。
- Elements upcoming 共 59 条，其中 56 条存在相同尾路径的 beta 版本；另 3 条没有 beta 对应。两套仍保留为不同 URL，不声称正文完全相同或都已发布。
- 旧版/当前 API、迁移帮助页、同名 Checkout/Fees/Payouts 等不能依据标题自动合并。JSON 对摘要明说已迁移的条目标注了迁移状态，但未跟随重定向。

## 原 4 条歧义的正文复核（2026-09-10）

严格未分类 0 条；本次指定的显式分类歧义剩余 0 条。4 条均保留原主模块，采用有正文依据的分析性归属；跨域性质未被抹除。这不代表其余 989 条已经正文复核。

`body_verified_for_classification` 只表示已读取官方页面正文及其中 OpenAPI 操作/模型来核对分类。不是 Whop 官方模块划分，不是已批准产品需求或功能主张，不证明运行行为、开放范围或可用性。本次未调用业务 API。

| 官方正文（2026-09-10 读取） | 正文依据 | 分析性归属 |
|---|---|---|
| [List Exports](https://docs.whop.com/api-reference/beta/exports/list-exports.md) | 按账户列出异步 CSV 导出任务，支持资源和状态筛选；资源枚举含会员、支付、出款、广告、争议、物流、应用等。 | B04：经营数据导出；次级 B01/B02/B03/B06/B08/B09/B10/B11 随数据域交叉。 |
| [Create Export](https://docs.whop.com/api-reference/beta/exports/create-export.md) | 创建单账户单资源导出；列选择、资源过滤器、时区配置和 pending 状态明确其数据提取流程。创建枚举不含列表/响应中的 ledger_lines、withdrawal_lines。 | B04：跨域报表导出流程；次级同上。不能将可列出资源全部视为可创建资源。 |
| [Retrieve Export](https://docs.whop.com/api-reference/beta/exports/retrieve-export.md) | 查询导出任务状态和下载地址；响应模型有资源、进度和过期字段，说明文件保存 30 天。 | B04：导出结果读取；次级同上。资金只是部分数据来源。 |
| [Pulse Feed](https://docs.whop.com/api-reference/beta/events/retrieve-the-pulse-feed.md) | 无需认证、所有访问者载荷相同的匿名平台资金活动流；字段含类型、金额、粗略位置及按分钟取整时间，事件来自 ledger_line.created。 | B05：公开活动发现/展示；次级 B09 资金来源，交叉 B02/B07/B08/B11 活动类型。社会证明用途是分析推断，正文并未明确该商业目的。 |

正文快照保存在 source-index/ 下，保留官方原文。浏览工具打开失败后，通过直接 HTTPS 读取同一官方 Markdown URL 成功；没有用索引摘要替代正文。以下快照的共同读取日期为 2026-09-10：

- [List Exports 正文快照](${WRINGY_WORKSPACE}/phase-0/research/whop-full/source-index/coverage-body-2026-09-10-list-exports.md)；SHA-256 `c7ffc96f457d9f38df6a2cd83283eb588ce2b00068df2b97329e87448968a12f`。
- [Create Export 正文快照](${WRINGY_WORKSPACE}/phase-0/research/whop-full/source-index/coverage-body-2026-09-10-create-export.md)；SHA-256 `485cb96916dd5b4ba22a808a4d317723ab86c12e465d42303ed327b57fa4b120`。
- [Retrieve Export 正文快照](${WRINGY_WORKSPACE}/phase-0/research/whop-full/source-index/coverage-body-2026-09-10-retrieve-export.md)；SHA-256 `1b18d2f37e2771eb7e03e3ade4d7dade1035d257ae2119f87fc85e7cc7732acf`。
- [Retrieve the pulse feed 正文快照](${WRINGY_WORKSPACE}/phase-0/research/whop-full/source-index/coverage-body-2026-09-10-retrieve-the-pulse-feed.md)；SHA-256 `32edfc4f92275d3a2ae50512a2bd2307c226e24fda877b12275d9d50dbcf60ca`。

## 官方公开页面交叉检查：索引之外或不足以证明的业务

实际打开 5 个不同的官方公开页面；重复读取不增加页数。以下均为 2026-09-10 核对。公开营销描述只作为业务线索，不能替代合同、可用地区、定价或 API 行为核实。

| 官方页面 | 直接观察 | 对索引覆盖的影响 |
|---|---|---|
| [官网](https://whop.com/) | 导航出现远程医疗、零工经济；首页用 Whop AI 创建各类业务。 | 标题/URL/摘要全文中 telehealth、gig 均为 0 命中。行业方案维度缺口；AI 有索引线索，并非完全缺失。 |
| [企业入口](https://whop.com/network/) | 产品导航并列支付、钱包、广告；页面有收益、市场分发与评论相关入口。 | B09 的资产收益、B05 的市场运营需要正文证据；不能只靠支付 API 数量证明覆盖。原 network.whop.com 重定向到此。 |
| [远程医疗方案](https://whop.com/network/solutions/telehealth/) | 页面定位患者付款、订阅、合规，并列收益与发卡工具。 | 索引没有远程医疗专门入口；须查行业边界及服务集成。没有据此认定提供诊疗、医疗系统或特定认证。 |
| [零工经济方案](https://whop.com/network/solutions/gig-economy/) | 标题明确零工即时出款与 1099 compliance，工具区出现收益及品牌虚拟/实体卡。 | 索引对 1099、yield 都是 0 命中；已有 verification/taxes/cards 线索不能替代税表作业、收益产品与品牌卡方案证明。 |
| [Blueprints](https://whop.com/blueprints/) | 公开正文有 Featured/Community blueprints 与“描述后由 Whop AI 构建”的入口。 | 索引已有 blueprint 指南；缺口是具体模板/业务门类清单与运行边界。本次只获得页面外壳，没有据页面中的 0 判定实际模板数量为零。 |

以上“0 命中”仅指本地快照的 993 条标题、URL、摘要，不是对 993 篇正文做否定证明。

## 交给主研究的缺口清单

1. **行业覆盖缺口**：远程医疗、零工经济需进入业务场景层，与实物、服务、软件、活动一起核对；不要只列创作者品类。[官网导航](https://whop.com/)（2026-09-10）。
2. **钱包收益/1099 作业证据不足**：已有钱包、税、验证 API 不等于覆盖收益产品条款或零工税表流程。[零工方案](https://whop.com/network/solutions/gig-economy/)（2026-09-10）。
3. **B06 品牌合作仍薄**：索引只有一条明确 Content Rewards 帮助入口，以及 Bounties 相关资源；不能把普通工作悬赏当作完整品牌—创作者投放系统。[Content Rewards 索引指向](https://docs.whop.com/memberships-and-access/third-party-apps/content-rewards.md)（2026-09-10 索引摘要；正文未核实）。
4. **B12 不应漏掉公司设立、媒体生成与行动建议**：分别已在 [Form Company](https://docs.whop.com/api-reference/beta/accounts/form-company.md)、[Media](https://docs.whop.com/api-reference/beta/media/media.md)、[Recommended Actions](https://docs.whop.com/api-reference/beta/recommended-actions/list-action-chains.md) 的索引摘要中出现（2026-09-10；正文未核实）。特别是 Execute Action Chain 摘要写的是记录客户端动作，不应概括为服务端自动执行完整业务。
5. **实质覆盖仍待合并**：四名研究员应提供已读正文 URL、日期、证据段落与对应模块，再和本 JSON 做差集。本工作没有读取他们的全部成果，不能声明剩余正文未读数量或已读比例。

## 核验与停止边界

- 已验证 993 个源条目的标题、URL、章节与 JSON 逐项同序一致；所有记录满足指定六字段，模块 B01–B12 合法；当前状态分布为 989 条仅索引分类、4 条正文分类复核。章节/模块计数均加总到 993。
- 本工作正文阅读量：索引中的单篇文档 4（仅作分类复核）；索引外官方公开页面 5。其余 989 条仍只读取索引，不能推定其他研究员的阅读状态。不存在“993 篇正文已读”的声明。
- 写入范围为 coverage.json、本报告及 4 个 coverage-body- 前缀官方正文快照；没有修改 sources/、没有初始化 Git、没有再委派、没有进行产品决策。
- 未完成完整站点爬取、公开登录后功能检查、重定向归并或发布状态验证；这是覆盖会计与缺口探测结果，不是全平台完整性认证。

本次增量校验：仅 4 条 JSON 记录的 classification_note/source_status 改动，其余字段及 989 条记录不变；993 条、993 个唯一 URL、全部章节及模块计数保持不变。未新增已批准产品主张。


## 最终交付对账追加记录 — 2026-09-10

本节仅对原独立审计的五项缺口进行最终交付核对，保留上文历史判断与原始证据。核对的是当前本地成果、模块条目编号和引用落点；未重新浏览官方页面、未完整重读四份领域报告、未执行产品测试。“关闭”指遗漏已被成果接住，或未知已明确登记，不是把未知认定为已验证功能，更不是批准建设范围。

| 原缺口 | 已核对的最终落点与来源 | 本次关闭结论 / 保留边界 |
|---|---|---|
| 1. 行业覆盖 | [平台报告九类行业映射](${WRINGY_WORKSPACE}/phase-0/research/whop-full/platform-ai-enterprise.md:11)逐项列课程/教练、服务、实物、市场、零工、付费群、软件、远程健康、活动，并链接各自官方方案；[主入口](${WRINGY_WORKSPACE}/phase-0/research/whop-full/README.md:170)指向该报告。 | **覆盖登记关闭。** 九类映射存在；课程、市场、软件三页正文超时仍有明示。行业属于分析场景映射，不证明临床、招聘、薪资或完整行业系统。 |
| 2. 钱包收益、实体卡及 1099/医疗合规 | [资金报告](${WRINGY_WORKSPACE}/phase-0/research/whop-full/payments-money-trust.md:101)；[B09-F11](${WRINGY_WORKSPACE}/phase-0/research/whop-full/modules/B09.md:25)实体/品牌卡、[B09-F14](${WRINGY_WORKSPACE}/phase-0/research/whop-full/modules/B09.md:28)Treasury；[B10-F14](${WRINGY_WORKSPACE}/phase-0/research/whop-full/modules/B10.md:28)税表与行业合规。保留 [企业钱包](https://whop.com/network/products/payouts/)、[零工](https://whop.com/network/solutions/gig-economy/)、[医疗](https://whop.com/network/solutions/telehealth/)来源。 | **遗漏登记关闭，实质未知保留。** Treasury 与实体/定制卡仅营销或交叉入口；收益资产/资格/申赎、实体卡寄送与地区未核。1099 表型、申报责任/门槛/更正/费用及医疗合规细节未知；不认定税表运营或医疗隐私认证已核实。 |
| 3. B06 品牌合作不应被普通悬赏代替 | [增长报告主体边界](${WRINGY_WORKSPACE}/phase-0/research/whop-full/distribution-creators-growth.md:30)及其 Bounties 独立机制；[B06-F01 至 F08：CR](${WRINGY_WORKSPACE}/phase-0/research/whop-full/modules/B06.md:13)、[B06-F09 至 F15：Bounties](${WRINGY_WORKSPACE}/phase-0/research/whop-full/modules/B06.md:21)。引用 CR 组织条款、Whop CR 集成说明及 Whop Bounty 指南。 | **研究覆盖关闭。** CR 与 Bounties 分别维护合同主体、奖励及审批边界；当前 CR 主体与 Whop 支付角色区分，不推断股权历史，不叠加新旧费用。B06-F13 明列审批仅后台、无公开审批 API 等限制；不宣称全流程实测。 |
| 4. B12 公司设立、媒体生成、建议链 | [B12-F11 公司成立](${WRINGY_WORKSPACE}/phase-0/research/whop-full/modules/B12.md:27)、[B12-F03 媒体生产](${WRINGY_WORKSPACE}/phase-0/research/whop-full/modules/B12.md:19)、[B12-F14 建议链](${WRINGY_WORKSPACE}/phase-0/research/whop-full/modules/B12.md:30)与[平台报告语义限制](${WRINGY_WORKSPACE}/phase-0/research/whop-full/platform-ai-enterprise.md:73)；分别引用 Form Company、Media、List/Execute/Executions 官方文档。 | **条目遗漏与命名误读关闭。** Execute 被限定为分析事件及客户端 redirected 步骤记录，不是服务端业务执行；不能据记录推定商品创建或收款成功。公司与媒体能力保留原卡的 API/营销/第三方、未实测分级。 |
| 5. 领域成果与索引的引用对账 | [citation-crosswalk.json](${WRINGY_WORKSPACE}/phase-0/research/whop-full/source-index/citation-crosswalk.json)及[README 阅读状态说明](${WRINGY_WORKSPACE}/phase-0/research/whop-full/README.md:160)。本次核对 crosswalk 全部 URL、cited_in 文件存在性及其 URL 引用落点。 | **引用账关闭，正文阅读认证未关闭。** 共 993 条、993 个唯一索引 URL；211 条 cited_in_research、782 条 not_cited_in_research。211 仅表示引用出现，不证明逐篇/逐字段阅读，也不覆盖索引外来源；782 不等于未读。 |

验证范围与责任边界：

- 已定位四份领域报告及 12 张模块卡，并逐项核对上表功能 ID 的实际内容与引用；没有把报告中的分析建议当作 Whop 官方架构。
- crosswalk 的 URL 集合与 coverage.json 的 993 个 URL 一致；逐个 cited_in 路径存在，目标文件包含相应 URL（匹配时仅统一 `.md`、末尾斜杠与片段）；0 个引用落点不匹配。该检查证明引用可追踪，不验证引用正文的真伪、时效或阅读深度。
- **上文 989 条 indexed_not_body_verified 始终仅指本独立审计员自己的阅读范围，不是全研究团队的未读数量。** 另外 4 条 body_verified_for_classification 仍只认证本审计的正文分类核对。本次不因其他研究员引用了资料而改变我的阅读状态。
- 此次只追加本节；coverage.json、crosswalk、README、领域报告和模块卡均未修改。未触碰 sources/。原先未知被明确登记后可关闭“遗漏”事项，但仍不能给整个平台签发完整阅读、产品可用或实测通过证明。

### 复核修正后的引用账 — 2026-09-10

补入 B05-F12、B07-F14 与 B04-F11 的直接证据后，汇总者重建交叉表：最终 215 个索引 URL 被四份报告或12卡引用。上节211为修正前快照；993总索引及原分类审计状态不变。新增功能条目使模块清单由166变为168，不改变来源条目数；引用仍不等于正文阅读认证。

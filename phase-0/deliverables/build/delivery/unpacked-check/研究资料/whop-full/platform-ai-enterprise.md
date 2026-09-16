# Whop 开发者、企业平台与 AI 创业业务研究｜B11／B12

核查日期：**2026-09-10**。仅公开研究，无登录、无安装、无账户操作、无付款。结论是马来西亚未来平台的研究型模块候选，**不是已批准规格、不是 Whop 内部业务分部或代码架构**。本文件拥有商业分析、证据解释和覆盖缺口；功能库存的唯一来源是 [B11 开发者平台与企业嵌入模块卡](modules/B11.md) 和 [B12 AI 创业与经营支持模块卡](modules/B12.md)。两卡提供稳定编号、责任边界、成功／失败链、收费、能力依赖和假设验收。

## 1. 最重要的区分：经营场景、平台能力、商业收入不是同一张表

Whop 公开开发者首页明确给出两种模式：**把 Whop 接入自己的软件**，或**开发可在 Whop 内安装的应用**。前者保留自己的产品、域名和用户，后者借助 Whop 商家分发。一个外部 SaaS 只用其结账，不等于它成为 Whop 内的付费群；一个开发者应用被商家安装，也不等于 Whop 拥有该软件。[开发者入口](https://docs.whop.com/developer/start.md)（第一方文档正文，2026-09-10）

官网导航／页脚列出的 coaching & courses、services、physical products、marketplaces、gig economy、paid groups、software、telehealth、events 是**解决方案场景**。例如 telehealth 页复用支付、发票、钱包、卡片和广告叙述，不能据此推出 Whop 自建病历、处方、远程诊疗或马来西亚医疗合规系统。企业官网的客户 logo 同样不能证明某客户购买了所有产品。[官网页脚](https://whop.com/)、[企业入口](https://whop.com/network/)、[Telehealth 正文](https://whop.com/network/solutions/telehealth/)（第一方营销，2026-09-10）

| 9 个解决方案族 | 官方页面与正文状态（2026-09-10） | 对应板块所需能力（分析映射，不是架构） |
|---|---|---|
| 1. Coaching & courses／课程与教练 | [方案页](https://whop.com/network/solutions/coaching-and-courses/)；导航已确认，本轮正文抓取超时 | B01 商品；B02 收费；B03 课程／权益交付；B04 支持；增长可接 B05/B07/B08 |
| 2. Services／服务与代理业务 | [方案正文](https://whop.com/network/solutions/services/)；付款、发票、税和资金工具的营销包装 | B01 服务目录；B02 发票／支付；B03 交付；B04 CRM；B09 资金；B10 税政策 |
| 3. Physical products／实物 DTC | [方案正文](https://whop.com/network/solutions/physical-products/)；定制 checkout、当地支付、MoR 和返现介绍 | B01 商品；B02 支付；B03 交付；B09 资金／卡；B10 争议税政策；外部电商接 B11。不能推出完整供应链软件 |
| 4. Marketplaces／Platforms | [方案页](https://whop.com/network/solutions/marketplaces/)；导航确认，正文超时；平台流程另有已读 docs | B11 平台开发者契约；B01 多主体；B02 收款与费用执行；B09 转账提现；B10 验证；如果有平台发现则 B05 |
| 5. Gig economy／零工经济 | [方案正文](https://whop.com/network/solutions/gig-economy/)；标题有即时付款和美国 1099 合规营销，正文是支付／发票／钱包／卡／广告工具 | B11 外部零工平台接入；B01 工作者主体；B02 收款；B09 付款；B10 身份和税政策；任务奖励如适用接 B06；广告接 B08 |
| 6. Paid groups／付费群 | [方案页](https://whop.com/network/solutions/paid-groups/)；第一方行业介绍 | B01 目录；B02 订阅；B03 会员／群组交付；B04 支持；可接 B05/B07/B08 获客 |
| 7. Software／软件 | [方案页](https://whop.com/network/solutions/software/)；导航已确认，正文超时；接入模式已由 docs 确认 | 自卖软件：B01/B02/B03；外部软件接 Whop 或站内开发者应用：B11；AI 创业工具才是 B12 |
| 8. Telehealth／远程健康服务 | [方案正文](https://whop.com/network/solutions/telehealth/)；患者付款、订阅和通用金融／广告工具 | B01 服务；B02 患者付款／订阅；B09 资金；B10 政策；B11 外部系统接入；广告接 B08。临床记录／处方／诊断不在已证实能力内 |
| 9. Events／活动 | [方案正文](https://whop.com/network/solutions/events/)；高价门票分期、活动前付款和支出返现介绍 | B01 门票商品；B02 付款／分期；B03 活动交付；B09 到账／卡；B10 争议；发现和推广可接 B05/B07/B08 |

**重要边界**：行业落地页不证明独立临床系统、HR／招聘／工时／薪资系统或已认证行业合规。尤其 1099 是美国税务语境，不能据标题认定完整申报服务或 Malaysia 等效合规。九类均可使用 B12 的创业／AI 入口，但这不把它们变成九个 AI 自营业务。具体底层能力是否在特定国家启用，仍须看对应模块证据。

这张表是基于导航与已读正文的分析归类；三个正文抓取超时的页面已逐行标出，不声称逐一测试所有行业方案。官方文档索引另外有 newsletters、brick-and-mortar 等业务模型，首页还有 agency、game、social network、newspaper、trading platform 等 AI 创业方向；它们扩展使用场景，**不能按名称数量认定独立收入线**。[业务索引](https://docs.whop.com/llms.txt)、[当前官网](https://whop.com/)（2026-09-10）

## 2. B11 的商业结构：基础设施、开发者分发、企业接入分别成立

完整功能和生命周期见 [B11-F01–F15](modules/B11.md)。这里不复写端点。

### 平台外软件与关联账户经营

一个外部市场可为卖家建立 connected account，然后选择直接收款或转账。**直接收款**把原支付落在关联账户上，平台获得 application fee，关联账户承担该笔 Whop 费用、退款和争议。**先收后转**则由平台承担原支付费用和争议，再决定转出的金额／时点。手动提现默认从关联账户扣费，配置满足条件时可由平台代付。三者分别是“谁卖”“谁分账”“谁承担提现费”，不能合并成单一平台抽佣率。[关联账户收款](https://docs.whop.com/developer/platforms/collect-payments-for-connected-accounts.md)、[手动提现](https://docs.whop.com/developer/platforms/manual-payouts.md)（第一方正文，2026-09-10）

例如未来马来西亚技能服务市场向买家收取 RM100，并拟保留 RM10，这只是分析案例：B11 保存平台与服务方的收费约定，B02 执行支付，B09 记账与转款，B10 处理验证及争议规则。**RM10 不是 Whop 或未来产品已确定收费，亦不表示当地市场可直接使用同样资金结构。**

验证接入不只是上传身份证：公开指南包含个人／企业验证、托管会话、补资料、身份文档、审核状态及复用已有 Sumsub 验证。后者需要共享安排和一次性 token，部分满足时仍需补步骤。它是第三方审核集成，不是 Whop 为所有用户提供无条件即时通过。[Verification](https://docs.whop.com/developer/verification/overview.md)、[RFI](https://docs.whop.com/developer/verification/rfis.md)（第一方文档／第三方集成，2026-09-10）

### 应用开发者经济与第三方生态

官方应用介绍给出开发者向商家收费的三种模式：安装费、收入分成、按成员规模订阅。文中的 US$500–2,000、10–30%、每成员 US$1 都是**示例**，不是全体开发者受同一费表约束。公开开发者条款确立开发者与用户的独立协议、数据责任及 API 停用风险，但未在本轮正文中给出统一应用发布费或 Whop 应用抽成率。[应用介绍](https://whop.com/blog/whop-app-store/)、[Developer Terms](https://whop.com/tos-developer-api/)（第一方介绍／法律正文，2026-09-10）

因此四种钱不能混为一谈：买家付商家产品费；商家付开发者应用费；关联商家付外部平台服务费；商家或平台付 Whop 金融服务费。第三方应用收入不自动是 Whop 收入，开发者分成也不是 Blueprint 奖励。安装授权同样不是支付授权。应用详情或 Whop 域名上的用户店铺并不能单独证明第一方归属；本轮依据官方 docs、Team Whop 页面及第一方产品公告判别。[应用类型](https://docs.whop.com/whop-apps/what-are-whop-apps.md)、[权限流程](https://docs.whop.com/developer/guides/permissions.md)、[服务条款](https://whop.com/tos)（2026-09-10）

第三方经营连接器呈现不同接入深度：HubSpot 写原生 Payment／Subscription，并可从 deal/contact/quote 发起结账；GoHighLevel 安装到机构子账户并需设为默认付款提供商；QuickBooks 不止导出流水，还描述发票付款、退款、订阅／商品双向同步与提现对账。Zapier 是触发器／动作自动化渠道。**Xero 索引虽说可自动同步，正文实际只有 coming soon**，故不算已上线。[HubSpot](https://docs.whop.com/third-party-integrations/hubspot.md)、[GoHighLevel](https://docs.whop.com/third-party-integrations/gohighlevel.md)、[QuickBooks](https://docs.whop.com/third-party-integrations/quickbooks.md)、[Zapier](https://docs.whop.com/third-party-integrations/zapier.md)、[Xero](https://docs.whop.com/third-party-integrations/xero.md)（第一方文档、连接外部产品，2026-09-10）

### 企业合同与公开价的边界

[当前企业定价](https://whop.com/network/pricing/)写标准方案无设置费和月费，国内卡成功交易 2.7% + US$0.30；另有国际卡、换汇及按启用条件收费。Custom Pricing 列按量／国家定价、Dedicated Account Manager、Dedicated Implementation。可确认“存在企业定制商业渠道”，不能确认合同最低消费、实施是否收费、服务级别、赔偿、客户具体优惠或利润率。（第一方营销价表，2026-09-10）

API／OAuth／嵌入聊天是否有独立用量费、应用发布和审核费用、连接器订阅费，在核查正文中没有足够证据。标准支付方案无月费不能扩展解释成 Whop 所有功能永久免费。公开接口能读取 fee markup 或 payment fee 行，只证明可配置／可观察的费用对象，不披露 Whop 对支付商、模型商或企业客户的内部毛利。[Fee Markup](https://docs.whop.com/api-reference/fee-markups/fee-markup.md)、[支付费用分项](https://docs.whop.com/api-reference/payments/list-payment-fees.md)（API 文档／索引指向，不是实盘数据，2026-09-10）

## 3. B12 的商业结构：创业工具、模板分发、迁移、成立公司和成长项目

完整库存见 [B12-F01–F14](modules/B12.md)。以下区分新名称、经济触发和证据强度。

**Whop AI／CLI／MCP。** Whop AI 发布页当前可见的是视频播放器和“经营用 Cursor”的简短定位，没有足够文字证实所有 agent 能力；网站生成有更完整的官方图文证据。AI Chat API 存在 general/support、会话管理、通知和 token 使用字段，但 token 字段不证明按 token 向用户收费。独立 AI 媒体 API 则明确生成图像／视频从账户余额计费；具体费表和失败退款没有查明。[AI 发布页](https://whop.com/blog/watch/whop-ai/)、[AI Chat](https://docs.whop.com/api-reference/ai-chats/ai-chat.md)、[媒体生成](https://docs.whop.com/api-reference/beta/media/generate-media-asset.md)（营销简述／API-only，2026-09-10）

文档 MCP 负责查资料，API MCP 才操作账户，二者不能混写。API MCP 浏览器登录，连接代表用户而非单一业务；每次调用指定业务，重要操作先准备再确认，参数变化使确认失效；这减少误操作但不缩小授权。Claude Code／Grok 插件说明其请求 admin profile。CLI 可作为终端渠道建站和部署，不是一个另外隐藏的业务数据库。[MCP](https://docs.whop.com/developer/guides/ai_and_mcp.md)、[Claude 插件](https://docs.whop.com/developer/guides/plugins/claude-code.md)、[Grok 插件](https://docs.whop.com/developer/guides/plugins/grok.md)、[CLI](https://docs.whop.com/developer/guides/cli-with-claude.md)（第一方文档，2026-09-10）

**Whop Websites 与 Blueprints。** 2026-08-31 介绍区分独立网站和可安装应用，提供 AI 新建、蓝图部署、已有网站重建、自行开发部署等路径；只加像素又是保留原站点的一条路径。网站介绍称免费建立／托管，但本轮未找到全部容量与超限政策。当前蓝图正文明确：发布者取得部署副本站点销售所产生 **Whop 利润的 10%**，来自 Whop 的份额；不是商家销售额的 10%。Whop 对利润的详细计算、结算／追回机制未知。[Websites 公告](https://whop.com/blog/whop-blueprints/)、[Blueprints 文档](https://docs.whop.com/developer/websites/blueprints.md)（第一方介绍／正文，2026-09-10）

这个模式把“别人使用模板”与“后续交易”连起来，具有分发和获客作用，这是**商业解释**，不是已证明的收入贡献。B12 负责副本与发布者关系，B07 负责推荐归因和佣金义务，B09 负责结算。文档虽把它类比商家推荐，不能把 10% 改成商家推荐宣传的 30%，也不能把两者相加。[蓝图奖励](https://docs.whop.com/developer/websites/blueprints.md)、[Whop Partners 介绍](https://whop.com/blog/whop-partners/)（2026-09-10）

**Whop Migrations。** 官方 2026-06-17 图文已公开 Stripe 卡订阅迁移：先预览、转移准备及排除，再确认执行，报告失败并去重重跑。旧 Stripe 订阅周期末取消、Whop 接管续费；旧平台取消通知仍可能送达。资料转移后变更卡信息不会自动包含。迁移限 active/trialing、带邮箱、至少 US$1 的卡订阅，Link／ACH／SEPA 等不支持，其他平台是未来计划。服务本身收费未知；其降低商家换平台摩擦、带入后续支付量是商业推论。标题“30 秒／单击”不包含全套准备耗时。[迁移正文](https://whop.com/blog/migrations/)（第一方产品图文，2026-09-10）

**公司成立：LLC 及 API 的 C-Corp。** 2026-08-28 公告给出 LLC 首年 US$500、后续 US$100/年，非美国居民 EIN 加急另 US$250。支持没有美国 SSN 的申请人；无需先成立 LLC 才可开始卖货。Form Company API 还列 C-Corp：需额外股权结构和创始人职务，提交返回托管付款 URL，付费后登记，账户字段跟踪进度。不能把 LLC 价格套给 C-Corp，也不能把“提交只需分钟”解释为 EIN 当天完成，更不能称为马来西亚 SSM 注册能力。[LLC 公告](https://whop.com/blog/register-llc/)、[Form Company](https://docs.whop.com/api-reference/beta/accounts/form-company.md)（第一方营销价表／API，2026-09-10）

**University、学校与 WhopX。** University 是 Whop 自己培养商家的教育／支持渠道，不是所有商家卖课的总称。2025-02-14 介绍有免费课程、社群、辅导等；当前 Team Whop 页面仍显示 University 和活动动态，但不能用旧文中的人数、营业时间作为当前承诺。2026-02-19 MSU 案例证明官方把真实创业教学作为合作场景；校方价格、渠道返佣未知。[University 介绍](https://whop.com/blog/what-is-whop-university/)、[当前社区](https://whop.com/whop/)、[MSU 案例](https://whop.com/blog/msu-whop/)（第一方历史介绍／当前可见页面／案例，2026-09-10）

2026-08-26 WhopX 介绍称免费、按 Whop 已处理收入解锁 US$1k／10k／100k／1M 月档位，有聊天、排行、城市活动和较高档位周会；iOS 上线，macOS 和较低档周会仍在计划。它把商家使用支付和成长社交利益关联，可解释为采用／留存机制；没有证据算出对 Whop 收入的贡献。收入窗口、退款／争议如何扣减、资格回落处理未知。[WhopX](https://whop.com/blog/whopx/)（第一方产品介绍，2026-09-10）

**Recommended Action Chains 的语义限制。** 补读 2026-09-06 版本正文后确认：List／Retrieve 给出账户下一步建议链；名为 Execute 的入口当前只记录调用者运行了链，写分析事件及每步 `redirected` 记录，客户端自己沿动作入口完成操作，**不执行服务端业务动作**。Executions 列表描述虽提到服务器执行记录，但不能覆盖 Execute 的明确限制。本报告不把它作为全自主经营执行器，亦不以“点击已记录”证明产品创建或收款成功。[List](https://docs.whop.com/api-reference/beta/recommended-actions/list-action-chains.md)、[Execute](https://docs.whop.com/api-reference/beta/recommended-actions/execute-action-chain.md)、[Executions](https://docs.whop.com/api-reference/beta/recommended-actions/list-recommended-action-executions.md)（API-only，2026-09-10）

## 4. 当前分发渠道如何各司其职

| 渠道 | 分发什么／连接谁 | 收入关联与不能推断的部分 |
|---|---|---|
| 商家 marketplace／Discover | 买家找商家商品 | B05；不能和应用商店抽成混为一谈。[企业入口](https://whop.com/network/) |
| Whop App Store、直接 install link | 开发者工具进入商家业务／成员体验 | B11；开发者收费合同未知统一费率。[App Store](https://docs.whop.com/whop-apps/whop-app-store.md) |
| Blueprint Gallery、商家 Websites | 创业者获得业务副本 | B12＋B07；有 10% Whop 利润奖励文档，不是售卖模板价格。[Blueprints](https://docs.whop.com/developer/websites/blueprints.md) |
| 外部产品嵌入／企业销售／连接器 | 外部软件接支付、钱包、聊天及经营数据 | B11；企业定制价、底层金融事件收费。[接入模式](https://docs.whop.com/developer/start.md)、[定价](https://whop.com/network/pricing/) |
| AI 插件／CLI／文档与开源工具 | 接近开发者／AI 使用者的工作入口 | B11/B12；工具触达不等于用户付费或独立收入线。[AI Tools](https://docs.whop.com/developer/ai/overview.md) |
| Migrations | 已有商家把订阅和后续收款迁入 | B12；独立迁移收费未知。[Migrations](https://whop.com/blog/migrations/) |
| University／校园合作／WhopX | 创业学习、经营者关系、收入资格社群 | B12；可提出获客／留存假说，无已证实转化率。[University](https://whop.com/blog/what-is-whop-university/)、[WhopX](https://whop.com/blog/whopx/) |

以上全部于 2026-09-10 核对，表中商业作用为研究分析，不是增长效果保证。联盟推广和广告仍分别归 B07／B08。

## 5. 证据冲突与生命周期风险登记

| 编号 | 具体差异／限制 | 本报告处理 |
|---|---|---|
| C01 | index 有 current／legacy／beta 以及同资源多路径 | 按产品族归纳；993 链接不等于 993 功能。[索引](https://docs.whop.com/llms.txt) |
| C02 | Elements 页面明确 `1.0.0-beta.3`、pre-release | 标成预发布，不当作全平台稳定 UI。[Getting started](https://docs.whop.com/elements/beta/getting-started.md)、[Payments](https://docs.whop.com/elements/beta/payments/overview.md) |
| C03 | App Views 明说 `verifyUserToken` 示例不能在当前 SDK 运行；Webhook 页说新助手将在下次 release 才有，排错页还引用旧方法 | 保留身份／事件功能族，不承诺文档代码可直接运行。[App Views](https://docs.whop.com/developer/guides/app-views.md)、[Webhook](https://docs.whop.com/developer/guides/webhooks.md)、[排错](https://docs.whop.com/developer/troubleshooting.md) |
| C04 | Xero 索引标题像已上线，正文为 coming soon | 正文优先，仅为覆盖到的未来家族。[Xero](https://docs.whop.com/third-party-integrations/xero.md) |
| C05 | OAuth 文档称 refresh token 撤销立即生效，但 access token 要等其期限；MCP 文档称断开 grant 立即停止 | 不笼统承诺所有凭证即时失效；区分授权通道。[OAuth](https://docs.whop.com/developer/guides/oauth.md)、[MCP](https://docs.whop.com/developer/guides/ai_and_mcp.md) |
| C06 | 普通密钥文档要求保留服务器端；iOS 文档特准 `iap:read` 密钥进包；HubSpot 教程仍要求 All scopes | 保留具体例外与过宽教程风险，不推广为通用规则。[Auth](https://docs.whop.com/developer/guides/auth-scoping.md)、[iOS](https://docs.whop.com/developer/guides/ios/overview.md)、[HubSpot](https://docs.whop.com/third-party-integrations/hubspot.md) |
| C07 | iOS 标题强调 2.7% + 0.30；正文限定美国用 Whop，其他地方回退 StoreKit | 不用于 Malaysia 原生数字商品通用报价，也不把物理商品路径混入。[iOS 正文](https://docs.whop.com/developer/guides/ios/overview.md) |
| C08 | 企业价格页 tax/remittance 显示 2%，docs fees 当前抓取显示 0.5% | 保留冲突交给 B10/B02，总表不自行统一；本分工只引用标准支付和企业报价入口。[价格页](https://whop.com/network/pricing/)、[Fees](https://docs.whop.com/payments-and-billing/fees/fees) |
| C09 | 平台转账文档称平台是原交易 merchant of record；Elements Branding 又要求 Whop 的 MoR 告知 | 交易主体要按实际渠道合同核实，不能推断所有场景同一责任分配。[收款模式](https://docs.whop.com/developer/platforms/collect-payments-for-connected-accounts.md)、[Branding](https://docs.whop.com/elements/beta/payments/branding.md) |
| C10 | 官网页脚 `/terms/` 本轮竟展示用户创建的同名社区，不是法律正文 | 法律核对改用 `/tos` 与 `/tos-developer-api/`；域名＋路径名称不能代替作者验证。[误导路径](https://whop.com/terms/)、[有效法律入口](https://whop.com/tos) |
| C12 | Action Chain Execute 当前只写客户端步骤记录，Executions 列表描述却有服务器执行措辞 | 以 Execute 正文限制为准；不证明自主后台执行。[Execute](https://docs.whop.com/api-reference/beta/recommended-actions/execute-action-chain.md)、[Executions](https://docs.whop.com/api-reference/beta/recommended-actions/list-recommended-action-executions.md) |
| C11 | “一键迁移／分钟注册／业务蓝图”容易被读成无前置条件的完整业务交付 | 以正文的准备、资格、付款和状态约束拆解；营业、盈利、注册完成都需独立事实。[迁移](https://whop.com/blog/migrations/)、[注册](https://whop.com/blog/register-llc/) |

当前日期不等于每个页面发布日期。尤其 University、应用商业化、Whop 4.0 和 2025 changelog 是历史定位证据；本轮只在当前正文能重验的范围内继承。[2025 changelog](https://web.whop.com/blog/whop-changelog/)仍可说明曾经取消 Discover 的 30% 费，但不证明当前应用开发者也享有相同收费规则。（所有行核查：2026-09-10）

## 6. 覆盖账本、遗漏候选及研究方法限制

本轮读取官方 993 链接索引中的全部 developer／API／SDK／AI 家族标题，按产品能力分组，再下载 task-owned `source-index/b11b12-*` 正文快照；重点读接入模式、应用／身份／权限、平台收付款、验证、聊天、Elements、网站、AI、公司成立及连接器正文。**下载不等于逐字审核每个 API 字段**；没有为重复 CRUD 建独立模块。旧报告仅作定位，没有继承未重验的数字。网页资料另从当前首页导航、企业价格／方案、博客 sitemap、公告和法律页交叉检查。

| 已覆盖家族 | 本分工如何承接 |
|---|---|
| API essentials／Getting started／Apps／SDK Elements／Identity | B11 卡；API-only、预发布与旧示例分开 |
| Payments／Payouts／Platforms／Verification | B11 只记外部契约、连接、输入输出；事实归 B02/B09/B10 |
| Chat／Forums／Courses／CRM／Stats／Partners／Ads／Bounties | B11 API／嵌入输出覆盖；本体交给 B03/B04/B06/B07/B08；不重复算成 API 公司另一收入 |
| AI／MCP／CLI／插件／媒体／Websites／Blueprints | B12 卡；媒体仅 API 核实；蓝图收益另连 B07 |
| migrations／LLC & C-Corp／University／WhopX | B12 的完整公开经营支持家族，明确资格与费用未知项 |
| HubSpot／GoHighLevel／QuickBooks／Zapier／Xero | B11；Xero 尚未上线，其他仅文档说明未安装 |

**建议总图额外核查、不得静默遗漏的跨模块家族**：

- 钱包资料暴露 cards、swaps、deposits 和收益／Treasury；本轮只确认嵌入输出，底层资金／卡片／收益产品应由 B09 及 B10 单列完整业务和地区限制。[开发者总览](https://docs.whop.com/developer/start.md)、[Wallet Elements](https://docs.whop.com/elements/beta/wallet/overview.md)
- Ads 不只是后台按钮：有外部广告创建／报告／pixel 安装和事件 API，连接 Shopify、WooCommerce、WordPress、Kajabi、ClickFunnels、GoHighLevel、WebinarJam、iClosed、Calendly。对接面归 B11，广告业务和归因归 B08。[广告正文](https://docs.whop.com/developer/ads/overview.md)、[Pixel](https://docs.whop.com/developer/ads/pixel.md)、[Events API](https://docs.whop.com/developer/ads/events-api.md)
- Bounties 是任务、资金托管、提交、批准发奖励家族；不是所有 Content Rewards 的同义词；官网 Bug bounty 也不可凭标题推断采用同一经济条款。应由 B06/B10 核定。[Bounties](https://docs.whop.com/developer/bounties/overview.md)、[首页 Bug bounty 入口](https://whop.com/)
- API 出现 AI 媒体、C-Corp 与社交账户等表面，不能因主导航暂未强调便漏掉，也不能反向声称有公开成熟 UI。公司成立可提出未来独立服务适配扩展，但不在本轮擅自新增 B13。[Form Company](https://docs.whop.com/api-reference/beta/accounts/form-company.md)、[媒体](https://docs.whop.com/api-reference/beta/media/media.md)、[完整索引](https://docs.whop.com/llms.txt)

**尚未验证**：登录后完整 App Store 名单、每应用所有者／费率与安装后功能；Blueprints 公开 gallery 在文本抓取中只有壳，未得到全量模板清单；Whop AI 发布视频未取得完整可核对 transcript；current/legacy 的每个字段兼容性；企业合同／SLA／开发者结算、注册供应商成本、迁移退款承诺；马来西亚注册实体、当地支付方式、资金保存和特定垂直行业的适用性。上述属于覆盖缺口，不填入推测事实。

本轮无代码建设，因而不把仓库／已批准产品基础缺失当作研究阻断。后续如果建设，两卡首片验收仅是候选：需按用户治理补齐 intent、证据、规格和批准。研究只给出可拆分路径与需要再核查的能力，没有自动批准任何上线、资金或法律服务。

## 7. 汇总者可直接复用的结论

1. **B11 的商业问题是“外部开发者／企业怎样接入、分发、授权和约定费用”**，不是把每个 API 端点变成业务模块。三个模型为外部基础设施接入、站内应用分发、企业定制服务。
2. **B12 的商业问题是“怎样把创业者带到正式业务并持续经营”**；AI／CLI 是操作渠道，网站／蓝图是启动与分发工具，迁移是已有商家转入工具，LLC 是有明确价格的成立服务，University／WhopX 是教育和成长关系。
3. 公开资料能核实收费触发和部分公开费率，不能核实 Whop 内部利润、客户合同或渠道转化。蓝图的“Whop 利润 10%”、开发者举例的“商家收入分成”、平台 application fee、商家推荐佣金是不同的义务与基数。
4. 模块边界依本次正式分工：B01 主体与目录、B02 支付执行、B03 权益交付、B04 数据支持、B05 发现评论、B06 奖励、B07 推荐佣金、B08 广告归因、B09 资金、B10 政策裁决。B11/B12 只调用所需能力，**不是全模块瀑布依赖**。

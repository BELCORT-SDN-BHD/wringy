# Whop 商业、交付与经营运营研究｜B01、B03、B04

研究日期：2026-09-10。中文公开资料研究；无登录、无账号/支付操作、无产品实现。范围为账号/商家/商品、各类交付、顾客运营。**候选模块是为未来马来西亚平台作的分析，不是 Whop 内部架构，也不是已批准开发规格。**

## 唯一功能清单与使用方法

| 模块卡片 | 内容与边界 |
|---|---|
| [B01｜账号、团队、商家与商品目录](modules/B01.md) | 13 个稳定功能编号；涵盖消费者账号生命周期、商家空间、团队权限与商品目录。 |
| [B03｜内容、社群、服务与实物交付](modules/B03.md) | 14 个稳定功能编号；拥有会员访问权益与交付，不把社区平台缩为课程软件。 |
| [B04｜顾客生命周期、客服与经营分析](modules/B04.md) | 12 个稳定功能编号；拥有运营视图与一般客服，引用其他模块的财务/裁定/AI 真相。 |

卡片保留功能清单、正常/异常路径、收入触发、所有权、依赖、候选切片、可检查验收、未知事项。本报告不再复制清单，集中解释业务覆盖及证据冲突。编号可以在未来研究或规格里引用，但不能把勾选项当成 Whop 已通过测试。

## 一、商业结构判断

Whop 的公开商业供给不是单一“售课”。官方开户正文区分**在 Whop 构建、托管、销售**和**只用 Whop 收款、外部交付**两种模式。这决定 B03 应为可组合交付能力：服务商可以不用课程，也可以不用任何站内应用。[开户正文](https://docs.whop.com/launch-your-business)（第一方正文，2026-09-10）

官方概念连接商家、商品、计价方案、会员和体验；消费者可以从多个商家购买，并同时作为某个商家的团队成员。未来划分应让 B01 拥有身份/目录，B02 拥有计费执行，B03 拥有访问权益，B04 拥有顾客运营视图；这属于分析性分工，不是从接口名推定 Whop 的数据库表或组织架构。[Core Concepts](https://docs.whop.com/developer/concepts)（第一方正文，2026-09-10）

卖家条款把商品描述、交付、访问、支持与退货等责任留给卖家；Whop 的 merchant of record 角色在该条款里限于卡网络规则和支付结算。不能因此声称 Whop 是每门课程的供应商、每场活动的主办方或每件实物的仓库。[Seller Terms](https://whop.com/seller-terms/)（第一方法律正文，2026-09-10；不是马来西亚适用法律意见）

### 全商业家族覆盖表（本工人范围及交接）

下列每条只说明官方公开方案所能支持的商业形态；不证明该形态已有独立业务部门、收入分部或充分产品化。均于 2026-09-10 查阅正文。

| 公开家族 | 谁买什么、交付形态与模块落点 | 证据与成熟度边界 |
|---|---|---|
| 付费群组/社群 | 会员购买社群访问；B01 商品＋B03 社群＋B04 运营，可搭免费入口。 | [Paid Groups](https://docs.whop.com/supported-business-models/paid-groups)，第一方操作指南；群组收入不是 Whop 收入。 |
| 教育项目/课程 | 学员购买学习内容或持续课程服务；B03 课程交付与学习状态。 | [Educational Programs](https://docs.whop.com/supported-business-models/educational-programs)，具体课程设置；与当前条款存在无限期访问例子冲突，见下。 |
| 教练/辅导 | 客户申请、预约、购买单次或持续辅导；B04 申请，B03 交付，B02 计费。 | [Coaches](https://docs.whop.com/supported-business-models/coaches)，公开快速启动方案；不证明完整教练排课/健康记录系统。 |
| 机构/专业服务 | 客户买项目或 retainer；B03 私有客户门户或完全外部交付。 | [Agencies](https://docs.whop.com/supported-business-models/agency-services)，具体配置正文；聊天＋文件＋活动不等于完整项目管理。 |
| SaaS/数字工具/软件许可 | 用户购买软件使用权限；B03 访问和外部授权，B11 外部开发者合同。 | [SaaS](https://docs.whop.com/supported-business-models/saas)，官方含许可密钥范式；示例有旧实现痕迹，不能直接复制为现行代码。 |
| 通讯/内容订阅 | 读者买持续内容；Forums 发布及邮件送达，社群可附加。 | [Newsletters](https://docs.whop.com/supported-business-models/newsletters)，正文明确支持仍在改进；未证明完整邮件营销平台。 |
| 活动/直播/线下聚会 | 参与者买活动票或会员含活动；B03 组织与访问。 | [Events](https://docs.whop.com/supported-business-models/events)、[社群活动指导](https://docs.whop.com/supported-business-models/paid-groups)，活动支持改进中；无座位/扫码核验全链证据。 |
| 文件/模板/电子书/素材 | 买家购买下载或资料访问；B03 Files/Content 可独立组合，不强制课程。 | [Consumer Apps](https://docs.whop.com/whop-apps/consumer-apps)，官方列出的应用用途；未核实每个发行者与单独收费。 |
| 直接面向消费者的实物电商 | 买家付商品款，卖家/外部仓配发货；B03 交付追踪，B02 收款。 | [DTC](https://docs.whop.com/supported-business-models/dtc-ecommerce)，明确依赖自定义字段、Zapier/外部履约；不得称完整 Shopify 替代品。 |
| 实体店/线下零售/周边 | 到店买家扫码或手机非接触支付，取得顾客福利；周边通过目录链接的应用。 | [Brick and Mortar](https://docs.whop.com/supported-business-models/brick-and-mortar)，支付地区/设备资格交 B02；Merch Store 仓配方和收费未知。 |
| 平台/市场/零工业务 | 其他平台可组织买卖双方，收付款需要连接账户；B01 经营主体，B02/B09/B10/B11 为主要承接。 | [Platforms](https://docs.whop.com/supported-business-models/platforms)，正文称平台 API 邀请制；[官网](https://whop.com/) 有 Marketplace/Gig economy 方案入口，仅归类不擅自推定开放资格。 |
| 游戏/社交/匿名讨论/健康旅行等应用生态 | 商家安装应用给会员使用；B03 消费入口、B11 开发者契约。 | [Consumer Apps](https://docs.whop.com/whop-apps/consumer-apps)、[App Store](https://docs.whop.com/whop-apps/whop-app-store)，是应用主题/商店分类，不能认作全部自研、自营或独立收费事业部。 |
| Telehealth/交易平台/报刊等官网方案 | 在官网作为可建设类型/解决方案出现；服务交付可能引用 B03，专业合规归 B10。 | [官网](https://whop.com/)、[Telehealth 正文](https://whop.com/network/solutions/telehealth/) 第一方营销；Telehealth 正文主要讲患者付款、发票等支付工具，本轮没有专业病历、处方、临床服务或交易执行的已验证能力，不做医疗/金融可用性推断。 |

消费者发现与评价只引用 B05；奖励活动/投稿/奖励义务交 B06；推荐/佣金义务交 B07；广告活动/归因交 B08；账本/转账/提现交 B09；验证/风险/退款争议裁定/税务政策交 B10；开发者外部契约交 B11；AI 经营工具交 B12。这些家族不在本工人清单中重新展开。**卡余额与消费卡不是本报告研究范围。**

## 二、收入边界：可确认的收费触发与不可推算部分

买家付费购买商品/服务，商家向 Whop 承担适用平台服务费用。公开费页有成功支付的处理费和 Billing 等事件相关费用；B04 卡片仅注明 Billing 作为连接边，不展开 B02 费率表。**没有证据支持按本报告三个模块分别收一次平台费**，也没有证据支持其全部永久免费。[当前费用](https://docs.whop.com/payments-and-billing/fees/fees)、[卖家费用责任](https://whop.com/seller-terms/)（第一方正文，2026-09-10）

本轮未找到足够公开证据核实：每课程/每 GB/每直播分钟/每邮件/每客服席位/每 CRM 联系人的 Whop 独立收费；应用发行者各自合同；物流仓配、会议平台、外部 CRM 与会计软件的实际套餐；各家族收入占比、支付通道成本、客服成本、毛利或净利润。未列价格只能记为**未知**。官网公开规模文案也不是按模块收入或审计利润，本报告不据此估值。[官网](https://whop.com/)、[应用说明](https://docs.whop.com/whop-apps/what-are-whop-apps)（营销/第一方说明，2026-09-10）。

官网行业页交叉核验：[Physical products](https://whop.com/network/solutions/physical-products/) 主打结账、本地付款、MoR 与返现；[Services](https://whop.com/network/solutions/services/) 主打机构收款/税务；[Telehealth](https://whop.com/network/solutions/telehealth/) 主打患者付款与订阅。它们是行业包装的第一方营销正文，不能提升为原生仓储、项目管理或临床软件证据（2026-09-10）。

## 三、关键矛盾及对后续建设的影响

| 差异/限制 | 本轮证据 | 处理结论 |
|---|---|---|
| “终身访问”案例 vs 当前禁止无限期访问 | [教育指南](https://docs.whop.com/supported-business-models/educational-programs) 举 lifetime；[当前卖家条款](https://whop.com/seller-terms/) 明确要求具体期限，禁止 lifetime/perpetual/indefinite。 | 不把旧示例作为当前允许的商品类型；候选切片使用明确期限。法律争议最终由 B10 接续。 |
| 当前角色与截图不同 | [正文](https://docs.whop.com/manage-your-business/team-management/manage-team-roles) 有五预设＋自定义；[角色截图](https://mobbin.com/flows/f77b4751-e924-401a-8aaf-b2cbc551241c) 有 Admin，再改 Operations。 | 记录版本差异，不把截图的 Admin 当当前第六预设。 |
| Xero 标题像已上线 | [Xero 正文](https://docs.whop.com/third-party-integrations/xero) 明确 Coming soon/in development。 | 仅待上线覆盖，不列为可用集成。 |
| 候补批准的付款语义 | [候补指南](https://docs.whop.com/manage-your-business/products/create-waitlist) 简写批准后访问；索引的 approve entry 摘要提及触发 checkout。 | 具体何时扣款/失败如何处理未完成接口正文验证；B04 不能直接授予“已付款”。 |
| 接口路径与状态混杂 | [稳定性正文](https://docs.whop.com/api-reference/stability) 要求新建用 Current；此次无 beta 的 resync-membership-access 返回 404，而 [Current 正文](https://docs.whop.com/api-reference/beta/memberships/resync-membership-access) 可读。 | 不从有无 beta 字样判断成熟度；卡片保留 API-only 标签。 |
| 索引存在不等于正文功能 | [商品删除 Current](https://docs.whop.com/api-reference/beta/products/delete-product) 有关联记录限制；旧正文只泛称删除；索引有 993 个不同 URL，精确 URL 重复数为 0；相同能力在语义、版本或文档层次上重复出现。 | 993 是唯一 URL 数，不是功能数；从现行正文确认约束，未逐端点复制清单。 |
| 外部权限不是统一恢复 | [Resync](https://docs.whop.com/api-reference/beta/memberships/resync-membership-access) 包括 Discord/TradingView，明确排除 Telegram。 | B03 为每个连接器定义异常/恢复，不能共用“重试全部”假设。 |
| 删除账号不等于停掉账单 | [账号删除](https://docs.whop.com/account-settings/account-security/delete-your-account) 要求先取消会员；本轮没有实际执行。 | B01 消费者退出检查要连接 B02/B03，不声称平台替用户完成所有取消和法定数据擦除。 |
| 客服会话不是群聊或退款裁定 | [Support Chats](https://docs.whop.com/developer/guides/chat/support-chats) 描述一客一商家及 open/resolved；[售后中心](https://docs.whop.com/manage-your-business/manage-payments/resolution-center) 有平台决策/申诉。 | B04 一般支持、B03 群聊、B10 裁定分别持有真相；可以放同一工作台。 |
| 报表不是会计利润 | [Analytics](https://docs.whop.com/manage-your-business/manage-business/analytics) 将 MRR/ARR 标为估计且纳入 past-due；其他指标也有估计字样。 | B04 固定口径、B09 提供资金事实；不得用后台收入卡当可提现或 Whop 利润。 |

上述页面均在 2026-09-10 读取；截图来源日期未确认。未证明文档示例的所有限制都在后端实际执行。

## 四、Mobbin FIRST 的新界面证据

先做四种精确流程查询，再核官方正文；其中客服、课程查询为取回完整引用元数据各复取一次，没有扩大到新流程。实际检查了工具返回的图像，不用名称替代观察。

| 精确查询 / 结果 | 实际查看与观察 | 限制 |
|---|---|---|
| Whop seller creates a store and adds a product | 返回 Uvodo 商品创建画面；看到其他产品标识。 | 不相关，排除，不能用作 Whop 商品/库存证据。 |
| Whop seller manages customers and customer support chats → [Support chat details](https://mobbin.com/flows/c80c3358-b3c2-476d-9149-75cd6dcf8968) | 看 1/2/3 共三张；客服列表、会话、关闭按钮、右侧顾客详情及购买项目。 | 不能证明消息发送成功、隐私授权或 AI 回复质量；不记录样本个人联系信息。 |
| Whop creator adds a course and uploads lessons → [Creating a course](https://mobbin.com/flows/db66e97a-c08e-48fa-9665-8b4fe611eadc) | 13 屏中看 1/4/7/10/13；创建入口、章节/课时、上传/嵌入视频、PDF 附件、分时解锁、测验设置、课程卡。 | 不是完整教学或真实上传测试；截图中示例分数/次数不是平台默认。 |
| Whop inviting team members and choosing their role → [Changing a user role](https://mobbin.com/flows/f77b4751-e924-401a-8aaf-b2cbc551241c) | 4 屏中看 1/3/4；团队表、Require 2FA、审计日志、角色修改确认和完成提示。 | 返回的是改角色，不是完整邀请；未实测权限执行。 |

此前六组流程的记录见[先前证据](../whop-features-flows.md)：开户、定价、搜索、退款申请、affiliate、购买。本轮只把它们作为历史指针；没有把旧文中的观察冒称本轮重新查看，新的具体功能以正文和上述三组图补强。发现/评价/affiliate 不归本文拥有。

## 五、来源账本、访问失败与完整性边界

源文本快照共取得 78 个可读官方 Docs URL（两批 61＋16，加移动页 1；包含 Current/Legacy 与迁移页，不等于 78 个独立功能）。

本轮已按目录检查 CRM、Chat & engagement、Courses、Identity & accounts、Stats & reporting、Optional，并读取与三个模块有关的用户指南和接口正文。保存的任务专属源文本：

- [第一批官方正文](source-index/commerce-primary-2026-09-10.json)：业务家族、账号/团队、目录、课程、顾客运营、第三方集成等。
- [补充接口/费用正文](source-index/commerce-extra-2026-09-10.json)：Current 删除/运单/文件、社群管理、课程删除、客服、稳定性、收费。
- [移动访问正文](source-index/commerce-mobile-2026-09-10.json)：iOS、Android、移动浏览器与外部服务步骤。
- [全目录指针](source-index/docs-llms-2026-09-10.txt)：只作发现索引，不作 993 个功能的证据。

公开网页对照包括 [官网营销](https://whop.com/)、[服务条款](https://whop.com/tos/)、[卖家条款](https://whop.com/seller-terms/)、[费用正文](https://docs.whop.com/payments-and-billing/fees/fees)。所有已用事实在卡片/本报告附近有直接 URL，统一核验日 2026-09-10。

访问异常：无 beta 的 resync-membership-access 为 404；推测的 beta leads/create-lead、entries/approve-entry 均 404，未作为正文证据。pricing、fees、changelog 猜测官网路径未取得可用正文；最终费用使用官方 Docs 正文。`https://whop.com/terms/` 实际返回一个用户经营页面，不是法律条款，已排除；法务使用 `/tos/`、`/seller-terms/`。搜索“changelog”还返回 WHOOP 运动设备、第三方应用和商家资料，均未混入 Whop 官方发布记录。

**更新日志覆盖缺口**：本轮没有定位到可验证的统一 Whop 官方 changelog，不能声称某功能在某日上线或最近发布。当前正文核验日不是功能发布日期。Xero 已明确待上线，但其上线计划未知。

**界面覆盖缺口**：移动实机、消费者安全/删除、完整店面发布、课程学习端、预约/活动端、实物发货端、会计连接器未操作。图像只证明部分表单和布局；正文只是官方能力说明。API schema 不证明一般用户能看到按钮、所有地区可用或业务已经规模化。

**归属覆盖缺口**：Whop 官方面向消费者列出的应用不自动等于 Whop 公司自有；Merch Store、互动游戏及其他生态应用的发行者/商业合同需 B11 后续逐项核实。官网 Telehealth 等行业入口不能证明具体医疗或金融功能。

## 六、马来西亚平台如何接续（分析，不是批准）

建议按真实可成交的链路选一条起点，例如“一个本地服务商卖明确期限的文件/社群套餐”，贯通 B01 的准确商品、B02 的测试支付、B03 的真实访问、B04 的问题解决。实物商家也可成为另一条独立起点，但仓配与退货闭环不能假定由平台自动完成。课程、CRM 和物流是不同扩展方向，不必同时建设。

需要的依赖是**能力**，不是“先建完整 B01 再完整 B02”瀑布，也不是 Whop 内部代码依赖图。B04 可从客服界面操作 B10 案件，但不能自行保存第二套裁定状态；B01 可展示 B12 生成的文案，但不拥有 AI 工具实现。此规则已写入三张卡。

研究基础检查：任务目录是只读来源的本地镜像，无产品代码仓库；本轮未取得马来西亚已批准的问题定义、用户证据、领域模型或规格。关闭这个缺口的最低成本是一次聚焦首批商家的发现讨论，再写一页有验收条件的规格；时间取决于客户可接触性，不能以本次公开资料替代。当前只交付研究候选卡，不开展实现、不批准删除、不批准上线。

下一阶段必须独立验证：当地目标客群及支付可用性、语言与时区、隐私/消费者条款、实际物流与退货责任、选择的应用/集成费率。卡片里的验收项和指标都是提案，不是 Whop 经营实测或创始人批准记录。

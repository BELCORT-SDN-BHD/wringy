# Wringy 全模块研究条目—组件映射

2026-09-11 · 来源是本地12份模块研究文件；不是对竞品能力的本轮实时重新核验。

## 计数与解释

本版包含 **103个独立组件族、12/12模块、168/168研究条目映射**。尺寸、颜色和状态没有另算组件。映射采用源文件原编号及原功能文字；其中的Whop/CR名称、费用、期限和提供方描述仅是历史研究记录，**不能据此成为Wringy默认值或产品承诺**。

所有条目为“规范关联”，没有任何一条在此被标成已开发。金融、生态应用及营销候选仅关联可复用界面和边界，不宣称逐一完成专题产品设计。模块字段表示直接使用或公共底座适用范围；下表是逐条追溯依据，不能拿catalog.modules自动生成的广泛适用范围当功能完成证据。

共享底座：shell、sidebar、breadcrumb、button、link、field、form、badge、alert、error-recovery、dialog适用于全部模块；逐条表列主要责任组件，省略重复底座。页面需要的标题、说明、焦点、加载、空态与错误仍必须按components.md组合。

## 实施优先序（设计交接建议）

先B06 Creator Rewards主旅程，并并行验证其B01身份、B09账务、B10风险和B02执行依赖；随后完善买卖及会员链B01–B05；再推进推广、广告、开发和AI。该顺序不批准上线日期、不删除任何模块，受限金融产品不因组件已有规范而自动开通。

## 模块概览与实际缺口

| 模块 | 研究条目/已映射 | 规范层面的缺口与下一步 |
|---|---:|---|
| [B01 账户、团队、店铺与商品](../../research/whop-full/modules/B01.md) | 13/13 | 角色矩阵、账户恢复证明与删除/商品关联限制未冻结；需账号和工作空间完整旅程。 |
| [B02 结账、订阅与账单](../../research/whop-full/modules/B02.md) | 15/15 | 地区/币种/金额/设备/商品类型/续费资格与税费报价须实测；不移植竞品重试天数、Apple费率或金额阈值。 |
| [B03 会员权益与交付](../../research/whop-full/modules/B03.md) | 14/14 | 课程评分/解锁规则、外部群能力、直播留存、仓配接口未落实；生态应用列举不等于每个应用已设计。 |
| [B04 客户、客服与经营分析](../../research/whop-full/modules/B04.md) | 12/12 | 客服与风险案件权限、迁移身份核验、真实导出资源/保留期未冻结；统计分母待接真实数据。 |
| [B05 商城、发现与信任展示](../../research/whop-full/modules/B05.md) | 12/12 | Wringy公开索引与评价治理流程待批准；公开资金活动流只映射展示基础，是否推出与隐私策略未定。 |
| [B06 品牌与创作者合作](../../research/whop-full/modules/B06.md) | 15/15 | 合格播放、数据不可得、预算抢占、费用、窗口、重审与追索均有提案，未批准；Bounties独立规则仍待补。 |
| [B07 推广联盟、伙伴与分成](../../research/whop-full/modules/B07.md) | 14/14 | 各类推荐/非链接分成费基、归因窗口、层级、退款追回及奖励兑换条件未冻结；不沿用竞品比例。 |
| [B08 广告与营销归因](../../research/whop-full/modules/B08.md) | 15/15 | 网络接入、匹配率、像素同意、归因模型、受众数据权限未验证；广告可投不等于该地区已获准。 |
| [B09 钱包、账务与出款](../../research/whop-full/modules/B09.md) | 15/15 | 每种资金产品仅候选交互外壳；当地准入、资金责任、报价与状态适配未知；卡管理/链上签名/收益申赎需要独立深规格。 |
| [B10 身份核验、风险与争议](../../research/whop-full/modules/B10.md) | 14/14 | 当地核验、税务、争议、限制/准备金/追索权限与保留期限须正式政策；本文不构成法律建议或已选供应商。 |
| [B11 开发者、应用与企业接入](../../research/whop-full/modules/B11.md) | 15/15 | 接口/SDK、嵌入/原生容器、令牌刷新、签名重放与真实权限边界未实现；金融组件开放范围需按提供方核实。 |
| [B12 AI创业与经营支持](../../research/whop-full/modules/B12.md) | 14/14 | AI模型、计费、工具权限、迁移合同及公司服务提供方未知；完整建站编辑器、原生客户端和法律申请表需专题设计。 |

## B01 · 账户、团队、店铺与商品

原始依据：[模块研究](../../research/whop-full/modules/B01.md)。下列全为规范关联；本模块整体未完成生产验收。

| 研究ID | 原研究功能（不转为Wringy承诺） | 主要组件族 | 深度/边界 |
|---|---|---|---|
| B01-F01 | 经营开户：创建商家、命名；选择站内构建交付或仅支付处理；后者允许没有内容应用。 | [workspace-switcher](components.md#workspace-switcher)、[form](components.md#form)、[service-application](components.md#service-application) | 候选外壳；地域/提供方/政策和专题流程待验证 |
| B01-F02 | 个人资料：修改邮箱、电话、用户名；控制近似位置展示。不能从“隐藏位置”推出删除位置数据。 | [customer-record](components.md#customer-record)、[text-input](components.md#text-input)、[avatar](components.md#avatar) | 复用界面与领域契约；细则待正式PRD |
| B01-F03 | 账号安全与退出：验证器或短信双重验证；全账号删除确认；删除前先取消会员。删除账号不等于删除一个商家。 | [team-access](components.md#team-access)、[credential](components.md#credential)、[dialog](components.md#dialog) | 复用界面与领域契约；细则待正式PRD |
| B01-F04 | 团队生命周期：邮箱邀请、待接受邀请、角色变更、移除、重新邀请；可要求团队双重验证。 | [team-access](components.md#team-access)、[form](components.md#form)、[notification-inbox](components.md#notification-inbox) | 复用界面与领域契约；细则待正式PRD |
| B01-F05 | 权限：Owner、Operations、Sales、Support、Advertiser 和自定义角色；不同角色对支付、提现、内容、分析的权限不同。截图有审计日志及角色修改确认。 | [team-access](components.md#team-access)、[action-preview](components.md#action-preview)、[event-log](components.md#event-log) | 复用界面与领域契约；细则待正式PRD |
| B01-F06 | 商家资料与多经营空间：个人可购买多个商家的商品并参与经营；商家与连接账户分清，避免把外部社交账号绑定误作子商家。API 允许更新经营资料/偏好。 | [workspace-switcher](components.md#workspace-switcher)、[property-list](components.md#property-list)、[form](components.md#form) | 复用界面与领域契约；细则待正式PRD |
| B01-F07 | 商品编辑：名称、标题、横幅、照片/视频、说明、功能、常见问题；名称与标题的 AI 辅助；商品归属商家。 | [product-editor](components.md#product-editor)、[rich-editor](components.md#rich-editor)、[asset-library](components.md#asset-library) | 复用界面与领域契约；细则待正式PRD |
| B01-F08 | 店面与私有销售：品牌标识、图文展示、类别；代理机构可隐藏客户专属商品并发私有结账链接。公开目录索引和排名交 B05。 | [product-editor](components.md#product-editor)、[image](components.md#image)、[link](components.md#link) | 复用界面与领域契约；细则待正式PRD |
| B01-F09 | 商品组合：一个商品关联多个价格方案与交付体验；免费/高级/VIP 通过商品分层和应用开关实现；纯支付商品可不绑定应用。方案金额与计费由 B02 持有。 | [product-editor](components.md#product-editor)、[price-plan](components.md#price-plan)、[entitlement](components.md#entitlement) | 复用界面与领域契约；细则待正式PRD |
| B01-F10 | 购买入口设置：限参与人数、售前问题、候补入口、购买后跳转；B01 保存展示/配置，候补个案由 B04、结账执行由 B02 管理。 | [product-editor](components.md#product-editor)、[customer-record](components.md#customer-record)、[checkout](components.md#checkout) | 复用界面与领域契约；细则待正式PRD |
| B01-F11 | 内容导航与目录生命周期：按商品预览、应用/分类重命名和排序；发布/取消发布；删除商品受关联记录限制，已有会员、候补、评价或发票不能直接删除。 | [product-editor](components.md#product-editor)、[sidebar](components.md#sidebar)、[action-preview](components.md#action-preview) | 复用界面与领域契约；细则待正式PRD |
| B01-F12 | 法律文件：服务条款、隐私、退货政策、软件许可协议的上传/查看/删除；强制勾选同意开关；结账呈现与凭证交 B02。 | [file-upload](components.md#file-upload)、[file-preview](components.md#file-preview)、[checkbox](components.md#checkbox)、[rule-editor](components.md#rule-editor) | 复用界面与领域契约；细则待正式PRD |
| B01-F13 | 消费者账号恢复及移动连续性：找回购买邮箱/识别重复账号；会员转移由 B03 执行、B04 提供操作入口；iOS/Android 或手机浏览器用同一邮箱访问 Your whops，外部服务仍可能需要独立步骤。 | [customer-record](components.md#customer-record)、[entitlement](components.md#entitlement)、[error-recovery](components.md#error-recovery) | 复用界面与领域契约；细则待正式PRD |

## B02 · 结账、订阅与账单

原始依据：[模块研究](../../research/whop-full/modules/B02.md)。下列全为规范关联；本模块整体未完成生产验收。

| 研究ID | 原研究功能（不转为Wringy承诺） | 主要组件族 | 深度/边界 |
|---|---|---|---|
| B02-F01 | 收费计划：免费、一次性、周期收费、首次费用、试用、有限次数分期；逐期分期收款不同于融资方垫付 | [price-plan](components.md#price-plan)、[money-input](components.md#money-input) | 复用界面与领域契约；细则待正式PRD |
| B02-F02 | 结账入口：独立链接、网站嵌入、一键 Apple Pay/Google Pay/Whop Pay 按钮；品牌颜色、字体、边框与成功跳转 | [checkout](components.md#checkout)、[action-preview](components.md#action-preview) | 复用界面与领域契约；细则待正式PRD |
| B02-F03 | 结账管理：库存/名额、公开或私有链接、候补/购前问题入口、内部名称；调用 B03 权益到期及 B01 商品名额，审批资格由 B10 提供；高额链接另申请 | [checkout](components.md#checkout)、[product-editor](components.md#product-editor)、[customer-record](components.md#customer-record) | 复用界面与领域契约；细则待正式PRD |
| B02-F04 | 付款渠道资格矩阵：卡、银行转账、区域钱包、PayPal、crypto；按买家地区、币种、金额、一次性/续费能力及商家开关显示 | [checkout](components.md#checkout)、[financial-product](components.md#financial-product) | 候选外壳；地域/提供方/政策和专题流程待验证 |
| B02-F05 | 自适应币种：每链接启用、默认关闭、买家可切回原币种、不支持地区回退；只支持一次性；买家本币价格含换汇费 | [money-input](components.md#money-input)、[transfer](components.md#transfer)、[checkout](components.md#checkout) | 复用界面与领域契约；细则待正式PRD |
| B02-F06 | 支付方式保管与以后扣款：先保存再收费、追加认证、订阅绑定方式删除限制；创建扣款不等于扣款成功 | [checkout](components.md#checkout)、[credential](components.md#credential)、[subscription](components.md#subscription) | 复用界面与领域契约；细则待正式PRD |
| B02-F07 | 扣款故障与催收：失败原因、人工重试、自动五天重试、欠费访问开关、提醒、恢复或取消；费用明细接口列于索引，但正文未取得 | [subscription](components.md#subscription)、[error-recovery](components.md#error-recovery)、[notification-inbox](components.md#notification-inbox) | 复用界面与领域契约；细则待正式PRD |
| B02-F08 | 订阅收费后台：延期免费天数、折扣、暂停/恢复收费、期末取消；立即终止访问调用 B03，取消收费与移除访问不同 | [subscription](components.md#subscription)、[entitlement](components.md#entitlement)、[dialog](components.md#dialog) | 复用界面与领域契约；细则待正式PRD |
| B02-F09 | 买家账单门户：续期信息、支付方式、历史账单及收据、自助取消；会员转移入口调用 B03，门户必须登录 | [subscription](components.md#subscription)、[invoice](components.md#invoice)、[checkout](components.md#checkout) | 复用界面与领域契约；细则待正式PRD |
| B02-F10 | 应收账单：新/现有客户、到期日、一次性或订阅、邮件与预览、PDF、筛选状态；逾期提醒、作废；API 支持站外付款标记及无法收回标记 | [invoice](components.md#invoice)、[date-time](components.md#date-time)、[import-export](components.md#import-export) | 复用界面与领域契约；细则待正式PRD |
| B02-F11 | 融资结账呈现：商家申请、合作方跳转审批、每链接选择、金额/国家/币种过滤、拒绝后回到其他方式；融资产品及准备金归 B09/B10 | [financial-product](components.md#financial-product)、[checkout](components.md#checkout)、[reserve](components.md#reserve) | 候选外壳；地域/提供方/政策和专题流程待验证 |
| B02-F12 | Whop 自有 iOS 应用购买：低于 USD 700 一次性订单走 Apple 内购；文档列 30% Apple 费用及 42.86% 加价、最长 75 天待结算、Apple 退款 | [checkout](components.md#checkout)、[financial-product](components.md#financial-product)、[invoice](components.md#invoice) | 候选外壳；地域/提供方/政策和专题流程待验证 |
| B02-F13 | 外部 iOS Checkout SDK：实体商品/现实服务原生 Apple Pay，一次性成功/取消/失败处理；数字内容须按其 StoreKit 路径处理 | [checkout](components.md#checkout)、[entitlement](components.md#entitlement)、[app-connection](components.md#app-connection) | 复用界面与领域契约；细则待正式PRD |
| B02-F14 | 实体销售：iPhone Tap to Pay、产品列表/自定金额、收小费、邮件收据、QR/链接回退；只一次性，必须联网 | [checkout](components.md#checkout)、[money-input](components.md#money-input)、[link](components.md#link) | 复用界面与领域契约；细则待正式PRD |
| B02-F15 | 外部财务同步：QuickBooks 发票附 Whop 付款链接、付款回写、订阅及退款同步、补导、错误重试；与 B09 出款对账协作 | [import-export](components.md#import-export)、[invoice](components.md#invoice)、[ledger](components.md#ledger)、[app-connection](components.md#app-connection) | 复用界面与领域契约；细则待正式PRD |

## B03 · 会员权益与交付

原始依据：[模块研究](../../research/whop-full/modules/B03.md)。下列全为规范关联；本模块整体未完成生产验收。

| 研究ID | 原研究功能（不转为Wringy承诺） | 主要组件族 | 深度/边界 |
|---|---|---|---|
| B03-F01 | 交付容器：应用安装为体验，商品可引用多个体验；应用可重复安装、改名、分类；复制体验是一项 API 能力，不推断所有内容均被深复制。 | [product-editor](components.md#product-editor)、[app-connection](components.md#app-connection)、[entitlement](components.md#entitlement) | 复用界面与领域契约；细则待正式PRD |
| B03-F02 | 访问与找回：凭已购商品访问体验；购买所用邮箱和当前账号不一致时排查重复账号；Discord 连接与重新授权。 | [entitlement](components.md#entitlement)、[customer-record](components.md#customer-record)、[social-connection](components.md#social-connection) | 复用界面与领域契约；细则待正式PRD |
| B03-F03 | 聊天：实时群聊、按主题/会员群体分房；消息支持文字、附件、投票、回复；发言权限、禁词、媒体限制。 | [conversation](components.md#conversation)、[file-upload](components.md#file-upload)、[radio](components.md#radio) | 复用界面与领域契约；细则待正式PRD |
| B03-F04 | 论坛/公告/通讯：帖子、评论、附件、投票、置顶、付费墙；发帖/评论/邮件设置；通讯方案以论坛帖子邮件分发。 | [conversation](components.md#conversation)、[rich-editor](components.md#rich-editor)、[entitlement](components.md#entitlement) | 复用界面与领域契约；细则待正式PRD |
| B03-F05 | 课程编排：课程/模块 → 章节 → 课时；多媒体、视频、文字、PDF、知识检查、测验；顺序完成、视频水印、字幕语言、结业证书；删除课程连同学习进度。 | [course](components.md#course)、[rich-editor](components.md#rich-editor)、[action-preview](components.md#action-preview) | 复用界面与领域契约；细则待正式PRD |
| B03-F06 | 学习过程：视频上传/嵌入、附件、分时解锁；测验分数门槛与尝试次数；进度跟踪、提交评估。截图示例分数不是平台统一要求。 | [course](components.md#course)、[media-player](components.md#media-player)、[file-upload](components.md#file-upload) | 复用界面与领域契约；细则待正式PRD |
| B03-F07 | 富文本与文件：Content 页面作为入门、指南、FAQ；Files 提供模板、电子书、素材/项目文件；底层文件上传有上传目的地及 ready 状态，但底层文件 API 不是完整 Files 应用接口。 | [rich-editor](components.md#rich-editor)、[file-preview](components.md#file-preview)、[asset-library](components.md#asset-library) | 复用界面与领域契约；细则待正式PRD |
| B03-F08 | 活动与直播：活动安排、日历加入、提醒；线下/Zoom/Google Meet/站内直播；可按票收费；付费群指南称直播自动保存。尚未实测录像留存和权限。 | [schedule](components.md#schedule)、[media-player](components.md#media-player)、[notification-inbox](components.md#notification-inbox) | 复用界面与领域契约；细则待正式PRD |
| B03-F09 | 预约与辅导：可用日期/时段、时长、地点或会议链接、说明、每次预约价格；免费或收费一对一；教练申请入口接 B04。 | [schedule](components.md#schedule)、[price-plan](components.md#price-plan) | 复用界面与领域契约；细则待正式PRD |
| B03-F10 | 机构/专业服务：客户专属商品与私有门户；Chat/Files/Events/Content/Calendar 组合交付；也可只收款、在原有工具交付；项目一次付费或长期服务费。 | [fulfillment](components.md#fulfillment)、[conversation](components.md#conversation)、[file-preview](components.md#file-preview) | 复用界面与领域契约；细则待正式PRD |
| B03-F11 | 外部社群/SaaS/工具权限：Discord、TradingView 再同步；Telegram 是邀请式且不参与再同步；SaaS 指南含许可密钥与元数据示例，但旧 SDK/路径混杂。 | [entitlement](components.md#entitlement)、[app-connection](components.md#app-connection)、[credential](components.md#credential) | 复用界面与领域契约；细则待正式PRD |
| B03-F12 | 实物交付：商品及价格选项收集地址/尺寸/颜色；Webhook/Zapier 通知外部履约或第三方仓配；支付关联运单、运单号更新与重查。 | [fulfillment](components.md#fulfillment)、[text-input](components.md#text-input)、[event-log](components.md#event-log) | 复用界面与领域契约；细则待正式PRD |
| B03-F13 | 线下零售与周边：商家使用手机收款后给予顾客专属社群权益；官方方案链接 Merch Store 应用。仅证实组合方案，未核实周边应用开发者、仓配合同或库存能力。 | [fulfillment](components.md#fulfillment)、[entitlement](components.md#entitlement)、[checkout](components.md#checkout) | 复用界面与领域契约；细则待正式PRD |
| B03-F14 | 互动扩展：官方消费者应用页列直播答题、随机视频社交、匿名论坛、抽奖；商店类别还含 AI、交易工具、体育、购物、健康、旅行。视为可安装应用生态，不能全部认作 Whop 自研业务。 | [app-connection](components.md#app-connection)、[entitlement](components.md#entitlement)、[conversation](components.md#conversation) | 基础模式关联；生态/原生/编辑器专题设计未完成 |

## B04 · 客户、客服与经营分析

原始依据：[模块研究](../../research/whop-full/modules/B04.md)。下列全为规范关联；本模块整体未完成生产验收。

| 研究ID | 原研究功能（不转为Wringy承诺） | 主要组件族 | 深度/边界 |
|---|---|---|---|
| B04-F01 | 潜客与候补：免费产品/申请收集线索；必答问题、批准/拒绝、批量准入、导出、DM/邮件联系。不要把候补批准直接当作付款已成功。 | [customer-record](components.md#customer-record)、[form](components.md#form)、[data-table](components.md#data-table) | 复用界面与领域契约；细则待正式PRD |
| B04-F02 | 顾客与会员双视图：用户只列一次、每项会员单列；邮箱/地区/总消费/加入与最近访问、产品方案/状态/取消日期；筛选、导出和联系。 | [customer-record](components.md#customer-record)、[property-list](components.md#property-list)、[subscription](components.md#subscription) | 复用界面与领域契约；细则待正式PRD |
| B04-F03 | 会员运营动作：转移链接、封禁、赠送天数、优惠码、暂停付款、期末取消、立即终止；动作送 B02/B03 执行，不能私改视图冒充完成。 | [customer-record](components.md#customer-record)、[subscription](components.md#subscription)、[entitlement](components.md#entitlement)、[action-preview](components.md#action-preview) | 复用界面与领域契约；细则待正式PRD |
| B04-F04 | 顾客自助：订单/会员详情、续期日、支付方式、历史发票收据、取消和转移；程序可取得需登录的管理链接。 | [subscription](components.md#subscription)、[invoice](components.md#invoice)、[checkout](components.md#checkout) | 复用界面与领域契约；细则待正式PRD |
| B04-F05 | 找回与迁移：按购买邮箱找会员、处理重复账号、生成/领取转移链接；Discord 每项会员一次只连一个账号，重复账号会妨碍绑定。 | [customer-record](components.md#customer-record)、[entitlement](components.md#entitlement) | 复用界面与领域契约；细则待正式PRD |
| B04-F06 | 欠费恢复界面：识别 Past due、提醒改卡、人工重试；官方说明五天重试后仍失败取消；欠费期间能否访问取决设置，成功后恢复。计费规则归 B02。 | [subscription](components.md#subscription)、[error-recovery](components.md#error-recovery) | 复用界面与领域契约；细则待正式PRD |
| B04-F07 | 加入/离开自动消息：开关、姓名/商家变量、媒体、DM 加可选邮件、指定发送团队身份；可用于欢迎、反馈、回流。 | [conversation](components.md#conversation)、[rich-editor](components.md#rich-editor)、[switch](components.md#switch) | 复用界面与领域契约；细则待正式PRD |
| B04-F08 | 商家客服收件箱：一位顾客与一个经营账户的官方会话；open/resolved、列表/筛选/排序，复用已有会话；与群聊和点对点私信不同。截图可见顾客详情及关闭入口。 | [conversation](components.md#conversation)、[list-detail](components.md#list-detail)、[customer-record](components.md#customer-record) | 复用界面与领域契约；细则待正式PRD |
| B04-F09 | 售后工作台（引用 B10）：接受/拒绝/索取信息、证据、自动小额退款阈值、商家回应、平台介入、一次申诉、邮件通知；每付款仅一案、120 天窗口及支付类型例外。裁定/证据/阈值政策归 B10；B02 执行退款，B09 记账。 | [appeal](components.md#appeal)、[risk-case](components.md#risk-case)、[invoice](components.md#invoice) | 复用界面与领域契约；细则待正式PRD |
| B04-F10 | 平台帮助入口（引用 B12）：Whop AI 可见账户相关信息、协助取消/Discord 问题、生成业务洞察；复杂问题转支持团队并通过邮件跟进。不是商家自建 AI 客服能力的证据。 | [ai-workbench](components.md#ai-workbench)、[conversation](components.md#conversation) | 复用界面与领域契约；细则待正式PRD |
| B04-F11 | 分析与导出：可排列指标卡，用户/付款/售后三类；新增/活跃/试用转化、时长/访问、收入/费用/流失/退款；接口支持描述指标结构、聚合及原始行。跨域 CSV 导出可选择单账户资源、列及过滤条件，列出任务并查询 pending/processing/completed/failed/expired 状态、进度与下载地址；文件保存 30 天。可列出/读取资源不等于可创建：ledger_lines、withdrawal_lines 出现在列表/响应资源枚举，但不在 Create 请求资源枚举。 | [metric](components.md#metric)、[chart](components.md#chart)、[import-export](components.md#import-export)、[data-table](components.md#data-table) | 复用界面与领域契约；细则待正式PRD |
| B04-F12 | 外部经营工具：HubSpot 商品同步/交易联系人/付款订阅记录；GoHighLevel 账户级支付连接；QuickBooks 同步、历史导入、模式选择与错误重试；Zapier 事件与动作；追踪平台连接。Xero 明确尚在开发。 | [app-connection](components.md#app-connection)、[import-export](components.md#import-export)、[event-log](components.md#event-log) | 复用界面与领域契约；细则待正式PRD |

## B05 · 商城、发现与信任展示

原始依据：[模块研究](../../research/whop-full/modules/B05.md)。下列全为规范关联；本模块整体未完成生产验收。

| 研究ID | 原研究功能（不转为Wringy承诺） | 主要组件族 | 深度/边界 |
|---|---|---|---|
| B05-F01 | 商家商品列表与公共商城查询分流；公共列表仅返回可见商品 | [product-editor](components.md#product-editor)、[entitlement](components.md#entitlement) | 复用界面与领域契约；细则待正式PRD |
| B05-F02 | 按标题、headline 搜索相关结果；不填查询时按新近收录浏览 | [search](components.md#search)、[product-editor](components.md#product-editor) | 复用界面与领域契约；细则待正式PRD |
| B05-F03 | 类目、一次性/续费方案、价格上下限、标签过滤；续费价作为展示价格口径 | [filter-builder](components.md#filter-builder)、[price-plan](components.md#price-plan) | 复用界面与领域契约；细则待正式PRD |
| B05-F04 | 游标翻页、升降序、创建/发现时间排序；搜索与显式排序不能并用 | [pagination](components.md#pagination)、[data-table](components.md#data-table)、[filter-builder](components.md#filter-builder) | 复用界面与领域契约；细则待正式PRD |
| B05-F05 | 上架前检查 logo、headline、至少一张图片或视频；缺项返回原因 | [product-editor](components.md#product-editor)、[file-upload](components.md#file-upload) | 复用界面与领域契约；细则待正式PRD |
| B05-F06 | 提交后进入 pending_review，平台审核通过才公开 | [review-workbench](components.md#review-workbench)、[badge](components.md#badge) | 复用界面与领域契约；细则待正式PRD |
| B05-F07 | 主动下架进入 not_available；下架不应被解释为取消已购权益 | [product-editor](components.md#product-editor)、[entitlement](components.md#entitlement) | 复用界面与领域契约；细则待正式PRD |
| B05-F08 | 评价含 1–5 星、标题、正文、附件、作者、商品、商家、加入/发布时间 | [review-rating](components.md#review-rating)、[file-upload](components.md#file-upload) | 复用界面与领域契约；细则待正式PRD |
| B05-F09 | 显示是否付费的三态信息：true/false/unknown；不能把所有评价称已购验证 | [review-rating](components.md#review-rating)、[badge](components.md#badge) | 复用界面与领域契约；细则待正式PRD |
| B05-F10 | 按商品、星级与时间读取评价、分页和详情；审核状态 pending/published/removed | [review-rating](components.md#review-rating)、[pagination](components.md#pagination) | 复用界面与领域契约；细则待正式PRD |
| B05-F11 | 评价治理：真实体验、利益关系披露、禁止虚假激励评价；违规举报与执行 | [review-rating](components.md#review-rating)、[risk-case](components.md#risk-case) | 复用界面与领域契约；细则待正式PRD |
| B05-F12 | Pulse Feed 公开平台资金活动流：匿名、无需认证，所有调用者得到相同公开载荷；类型、美元金额、粗略城市/国家及按分钟取整时间，事件来自 ledger_line.created。B05 公开发现/社会证明是分析归属，资金事件来源归 B09；不是账户对账或个体广告归因。 | [ledger](components.md#ledger)、[list-detail](components.md#list-detail)、[text](components.md#text) | 基础模式关联；生态/原生/编辑器专题设计未完成 |

## B06 · 品牌与创作者合作

原始依据：[模块研究](../../research/whop-full/modules/B06.md)。下列全为规范关联；本模块整体未完成生产验收。

| 研究ID | 原研究功能（不转为Wringy承诺） | 主要组件族 | 深度/边界 |
|---|---|---|---|
| B06-F01 | CR 内容形式：Clipping、UGC；创作者页另展示 Music、Logo 活动；与计费模式分开 | [campaign-brief](components.md#campaign-brief)、[asset-library](components.md#asset-library) | Creator Rewards详见五状态线；Bounties单列待定规则 |
| B06-F02 | CR CPM、按篇、周期合作；公开、申请制、私密机会；发现页比较活动 | [campaign-brief](components.md#campaign-brief)、[search](components.md#search)、[filter-builder](components.md#filter-builder) | Creator Rewards详见五状态线；Bounties单列待定规则 |
| B06-F03 | 活动名称、品牌类目、素材、规则、社交平台、预算、千次报价、最低审核门槛、单片上限及可叠固定奖励 | [rule-editor](components.md#rule-editor)、[budget](components.md#budget)、[money-input](components.md#money-input)、[date-time](components.md#date-time) | Creator Rewards详见五状态线；Bounties单列待定规则 |
| B06-F04 | CR 品牌/代理多工作区和 Owner/Admin/Moderator/Member；私密活动隐藏 | [workspace-switcher](components.md#workspace-switcher)、[team-access](components.md#team-access) | Creator Rewards详见五状态线；Bounties单列待定规则 |
| B06-F05 | 可选发布前草稿、修改往返；正式帖子人工审核；草稿通过不等于帖子通过 | [submission](components.md#submission)、[review-workbench](components.md#review-workbench)、[annotation](components.md#annotation) | Creator Rewards详见五状态线；Bounties单列待定规则 |
| B06-F06 | 社交归属验证、表现抓取、风险标记、暂停收益、创作者申诉 | [social-connection](components.md#social-connection)、[measurement](components.md#measurement)、[risk-case](components.md#risk-case)、[appeal](components.md#appeal) | Creator Rewards详见五状态线；Bounties单列待定规则 |
| B06-F07 | CR 审批后计酬/验证冻结/可用余额/提现分阶段；未结算逆转，暂停不抹除已批准应付 | [reward-breakdown](components.md#reward-breakdown)、[creator-progress](components.md#creator-progress)、[payout](components.md#payout) | Creator Rewards详见五状态线；Bounties单列待定规则 |
| B06-F08 | CR 剩余预算退款、待审阻挡、处理费不可退；内容授权与底层素材权利区分 | [budget](components.md#budget)、[appeal](components.md#appeal)、[asset-library](components.md#asset-library) | Creator Rewards详见五状态线；Bounties单列待定规则 |
| B06-F09 | Bounty 目标涵盖剪辑、互动、自有账号增长、UGC、本地活动、数据采集、其他 | [bounty](components.md#bounty)、[rule-editor](components.md#rule-editor) | 独立任务组合；不得套用播放计酬规则 |
| B06-F10 | 按每份获批交付毛额×获胜名额预存；最低总额 $5；账号/个人资金；公开或私密 experience、国家限制 | [bounty](components.md#bounty)、[budget](components.md#budget)、[money-input](components.md#money-input) | 独立任务组合；不得套用播放计酬规则 |
| B06-F11 | 立即/定时/重复任务；各期独立赏金池；发布后金额与名额冻结，个人中选上限 | [bounty](components.md#bounty)、[date-time](components.md#date-time)、[rule-editor](components.md#rule-editor) | 独立任务组合；不得套用播放计酬规则 |
| B06-F12 | 链接/文件/说明投稿；数据采集与直播证据须在 Whop 内完成；不能由公司密钥冒充执行者 | [submission](components.md#submission)、[file-upload](components.md#file-upload)、[media-player](components.md#media-player) | 独立任务组合；不得套用播放计酬规则 |
| B06-F13 | 投稿队列及拒绝原因；审批仅 Whop 后台、无公开审批 API；无 Bounty webhook，外部系统需轮询 | [review-workbench](components.md#review-workbench)、[list-detail](components.md#list-detail)、[worklog](components.md#worklog) | 独立任务组合；不得套用播放计酬规则 |
| B06-F14 | 撤回自己的尝试；取消赏金时处理在途交付后退款；满额完成不能再取消；公开交付证明与讨论/直播关联 | [bounty](components.md#bounty)、[appeal](components.md#appeal)、[conversation](components.md#conversation) | 独立任务组合；不得套用播放计酬规则 |
| B06-F15 | 毛奖励、平台费后报价、执行者推荐分成分别记录；实际锁定费率可使到手额不同 | [reward-breakdown](components.md#reward-breakdown)、[commission](components.md#commission)、[money-input](components.md#money-input) | 独立任务组合；不得套用播放计酬规则 |

## B07 · 推广联盟、伙伴与分成

原始依据：[模块研究](../../research/whop-full/modules/B07.md)。下列全为规范关联；本模块整体未完成生产验收。

| 研究ID | 原研究功能（不转为Wringy承诺） | 主要组件族 | 深度/边界 |
|---|---|---|---|
| B07-F01 | Refer buyers 机会市场：商家、佣金、收入统计、加入、推广素材/专属链接 | [referral](components.md#referral)、[campaign-brief](components.md#campaign-brief)、[asset-library](components.md#asset-library) | 复用界面与领域契约；细则待正式PRD |
| B07-F02 | Global 与 Member 推广费率；文档写全局默认 30%，商家可设置 | [referral](components.md#referral)、[price-plan](components.md#price-plan) | 复用界面与领域契约；细则待正式PRD |
| B07-F03 | 邀请特定用户；按邮箱/用户名/ID，限定产品/方案 | [referral](components.md#referral)、[team-access](components.md#team-access) | 复用界面与领域契约；细则待正式PRD |
| B07-F04 | 固定额/百分比，首次付款/每次续费；单独合作约定 | [referral](components.md#referral)、[rule-editor](components.md#rule-editor)、[money-input](components.md#money-input) | 复用界面与领域契约；细则待正式PRD |
| B07-F05 | 不依赖推荐链接的 revenue share，按交易扣 Whop 费用后的金额分配，支持产品覆盖率 | [referral](components.md#referral)、[commission](components.md#commission) | 复用界面与领域契约；细则待正式PRD |
| B07-F06 | 创建/查找 affiliate、归档恢复、逐方案/分成覆盖设置增删改查 | [referral](components.md#referral)、[property-list](components.md#property-list) | 复用界面与领域契约；细则待正式PRD |
| B07-F07 | 推荐收益看板、30 天等待、退款/争议/欺诈退回佣金 | [commission](components.md#commission)、[wallet](components.md#wallet)、[risk-case](components.md#risk-case) | 复用界面与领域契约；细则待正式PRD |
| B07-F08 | Partners 幂等报名、返回推荐链接、记录报名日期及权限 | [referral](components.md#referral)、[form](components.md#form) | 复用界面与领域契约；细则待正式PRD |
| B07-F09 | 商家/用户推荐关系，一、二级收益，商家 active/removed、开始/到期时间 | [referral](components.md#referral)、[date-time](components.md#date-time) | 复用界面与领域契约；细则待正式PRD |
| B07-F10 | 四种收益来源：产品销售毛利、Whop Ads 支出、余额转账毛利、卡 interchange 毛利 | [commission](components.md#commission)、[metric](components.md#metric) | 复用界面与领域契约；细则待正式PRD |
| B07-F11 | 逐笔收益、费率、结算前空值、取消/追回原因、可用时显示收入与成本行 | [commission](components.md#commission)、[ledger](components.md#ledger) | 复用界面与领域契约；细则待正式PRD |
| B07-F12 | 按日/月/年/近30日/全部排行，匿名榜单与自己的名次分开 | [commission](components.md#commission)、[data-table](components.md#data-table) | 复用界面与领域契约；细则待正式PRD |
| B07-F13 | 商家奖励链接：立即或达量奖励、有效期、兑换名额、进度，奖励类型含广告额度 | [commission](components.md#commission)、[progress](components.md#progress)、[date-time](components.md#date-time) | 复用界面与领域契约；细则待正式PRD |
| B07-F14 | 蓝图部署副本的发布者来源归因与佣金义务：通过副本 whop.site 网站发生的销售自动归因，发布者获得这些销售所产生 **Whop 利润的 10%**，由 Whop 的份额支付，不是 GMV 的 10%，也不额外扣商家销售款。B12 管蓝图/副本来源，B07 管归因及分成义务，B09 管资金结算。 | [blueprint](components.md#blueprint)、[referral](components.md#referral)、[commission](components.md#commission) | 复用界面与领域契约；细则待正式PRD |

## B08 · 广告与营销归因

原始依据：[模块研究](../../research/whop-full/modules/B08.md)。下列全为规范关联；本模块整体未完成生产验收。

| 研究ID | 原研究功能（不转为Wringy承诺） | 主要组件族 | 深度/边界 |
|---|---|---|---|
| B08-F01 | 站内搜索等广告位、每日预算、按点击计费、自动竞价 | [ad-editor](components.md#ad-editor)、[budget](components.md#budget) | 复用界面与领域契约；细则待正式PRD |
| B08-F02 | 外部网络代理账户；Meta 已上线，TikTok/Google/Snapchat/X/Reddit 标 coming soon | [ad-editor](components.md#ad-editor)、[financial-product](components.md#financial-product)、[app-connection](components.md#app-connection) | 候选外壳；地域/提供方/政策和专题流程待验证 |
| B08-F03 | Facebook Page/Instagram 授权，业务单一广告账户、Advertiser 限权、主/备用支付方法 | [social-connection](components.md#social-connection)、[team-access](components.md#team-access)、[checkout](components.md#checkout) | 复用界面与领域契约；细则待正式PRD |
| B08-F04 | Campaign→Ad Group→Ad；目标/预算策略、受众/排期/版位、文案/素材/落地页分层 | [ad-editor](components.md#ad-editor)、[stepper](components.md#stepper) | 复用界面与领域契约；细则待正式PRD |
| B08-F05 | 图片/视频、自有素材、已有社交帖子推广；AI 生成媒体可单独收费，失败退款 | [ad-editor](components.md#ad-editor)、[asset-library](components.md#asset-library)、[ai-workbench](components.md#ai-workbench) | 复用界面与领域契约；细则待正式PRD |
| B08-F06 | 地区、人口、兴趣、设备、语言、版位、优化目标；可省略部分条件由网络优化 | [audience](components.md#audience)、[filter-builder](components.md#filter-builder) | 复用界面与领域契约；细则待正式PRD |
| B08-F07 | CSV、自有 People 条件、视频/表单/Instagram/Facebook 互动受众，包含/排除 | [audience](components.md#audience)、[import-export](components.md#import-export) | 复用界面与领域契约；细则待正式PRD |
| B08-F08 | 相似受众、相似范围；People 可定期刷新或保持快照；异步进度/匹配率/部分失败 | [audience](components.md#audience)、[progress](components.md#progress) | 复用界面与领域契约；细则待正式PRD |
| B08-F09 | 草稿、审核/拒绝、处理/排期/活跃/暂停/结束、缺分组/素材、支付失败；可编辑、复制、删除 | [ad-editor](components.md#ad-editor)、[alert](components.md#alert) | 复用界面与领域契约；细则待正式PRD |
| B08-F10 | Whop Pixel 全漏斗页面、自定义/标准事件，外部 purchase 与 Whop 付款分开；event_id 去重 | [attribution](components.md#attribution)、[event-log](components.md#event-log) | 复用界面与领域契约；细则待正式PRD |
| B08-F11 | 服务端事件与浏览器身份关联，读取 _wuid、携带事件时间/页面及可用身份，传送 Meta CAPI | [attribution](components.md#attribution)、[app-connection](components.md#app-connection) | 复用界面与领域契约；细则待正式PRD |
| B08-F12 | People、原始事件、个人时间线；按来源/行为/设备/地区/购买状态过滤和跳转 | [attribution](components.md#attribution)、[customer-record](components.md#customer-record) | 复用界面与领域契约；细则待正式PRD |
| B08-F13 | 花费、展示、点击、结果、每结果成本、ROAS、日期/时区/层级筛选；首次/末次触点归因 | [attribution](components.md#attribution)、[chart](components.md#chart)、[metric](components.md#metric) | 复用界面与领域契约；细则待正式PRD |
| B08-F14 | 品牌追踪链接可指向商店/结账与方案，统计点击、销售额、转化人数/率 | [referral](components.md#referral)、[attribution](components.md#attribution) | 复用界面与领域契约；细则待正式PRD |
| B08-F15 | 外部分析与漏斗平台接入，事件输入/输出、Pixel 安装检查与故障诊断 | [attribution](components.md#attribution)、[app-connection](components.md#app-connection)、[error-recovery](components.md#error-recovery) | 复用界面与领域契约；细则待正式PRD |

## B09 · 钱包、账务与出款

原始依据：[模块研究](../../research/whop-full/modules/B09.md)。下列全为规范关联；本模块整体未完成生产验收。

| 研究ID | 原研究功能（不转为Wringy承诺） | 主要组件族 | 深度/边界 |
|---|---|---|---|
| B09-F01 | 个人/企业资金视图：可提、待结算、可用日期、准备金明细；银行卡消费与普通银行提现的可用余额规则不同 | [wallet](components.md#wallet)、[reserve](components.md#reserve) | 复用界面与领域契约；细则待正式PRD |
| B09-F02 | 账务活动与财务报告：按日期余额活动、收入表、余额汇总及明细；不是已知 Whop 内部会计分录模型 | [ledger](components.md#ledger)、[import-export](components.md#import-export) | 复用界面与领域契约；细则待正式PRD |
| B09-F03 | 补充资金：先保存支付方式，再平台充值，异步通知确认；充值非营业收入 | [transfer](components.md#transfer)、[checkout](components.md#checkout) | 复用界面与领域契约；细则待正式PRD |
| B09-F04 | 收款目的地管理：新增、多种方式、默认、国家与本币要求；银行、移动钱包、crypto 分渠道资格 | [payout](components.md#payout)、[form](components.md#form) | 复用界面与领域契约；细则待正式PRD |
| B09-F05 | 人工、定期与即时提现：最低金额、保留余额、待审核/处理中/成功/退回跟踪；即时不保证每账户可用 | [payout](components.md#payout)、[date-time](components.md#date-time) | 复用界面与领域契约；细则待正式PRD |
| B09-F06 | 出款报价及取消：短期合作方报价确认后才移动资金；审核中可取消，处理中不可取消，取消退本金及费用 | [payout](components.md#payout)、[action-preview](components.md#action-preview)、[dialog](components.md#dialog) | 仅当前能力允许取消才核对确认；提供方确认才canceled，不新增人工审批；细则待正式PRD |
| B09-F07 | 企业 connected accounts：子账户入驻、自助托管/嵌入出款门户；直收+应用费，或平台先收后转；佣金、奖励、团队付款的资金执行 | [workspace-switcher](components.md#workspace-switcher)、[app-connection](components.md#app-connection)、[payout](components.md#payout) | 复用界面与领域契约；细则待正式PRD |
| B09-F08 | 账户转账与领取链接：转出身份、接收身份、余额/审核条件、失败原因；普通账户是否获准使用须按合同确认 | [transfer](components.md#transfer)、[action-preview](components.md#action-preview) | 复用界面与领域契约；细则待正式PRD |
| B09-F09 | 银行/链上入金：存款指示、crypto 地址/托管入口；crypto 入金最低 $10，入金与购买商品不同 | [transfer](components.md#transfer)、[financial-product](components.md#financial-product) | 候选外壳；地域/提供方/政策和专题流程待验证 |
| B09-F10 | 兑换：报价预览、法币账内中间价转换、钱包 token 兑换、crypto 异步结果；链/币/费用按实际报价 | [transfer](components.md#transfer)、[money-input](components.md#money-input) | 复用界面与领域契约；细则待正式PRD |
| B09-F11 | 发卡与团队预算：申请/批准后虚拟卡、持卡人、额度、PIN/冻结/取消、交易结果；Apple/Google Wallet 消费；实体及定制卡只获企业营销佐证 | [financial-product](components.md#financial-product)、[team-access](components.md#team-access)、[action-preview](components.md#action-preview) | 候选外壳；地域/提供方/政策和专题流程待验证 |
| B09-F12 | 卡奖励与交换费分享：指定商家 cashback；平台通过 API 发卡可获部分 interchange，即卡支付链路中的交换费 | [financial-product](components.md#financial-product)、[commission](components.md#commission) | 候选外壳；地域/提供方/政策和专题流程待验证 |
| B09-F13 | 消费融资接入：与商家自行分期分开；合作方批准、买家还款、商家结算/准备金；维护方法级地区及商品资格 | [financial-product](components.md#financial-product)、[checkout](components.md#checkout)、[reserve](components.md#reserve) | 候选外壳；地域/提供方/政策和专题流程待验证 |
| B09-F14 | Treasury / Earn yield 收益产品候选：给用户余额赚取收益的入口，须独立标识资产、申赎、资格与风险 | [financial-product](components.md#financial-product)、[wallet](components.md#wallet) | 候选外壳；地域/提供方/政策和专题流程待验证 |
| B09-F15 | 自托管稳定币钱包及退出：Privy 钱包、USD/USDT 转换、USDT 换 cbBTC/XAU₮ 经 Relay、交易授权/撤销、私钥导出及相关账户禁用 | [financial-product](components.md#financial-product)、[credential](components.md#credential)、[transfer](components.md#transfer) | 候选外壳；地域/提供方/政策和专题流程待验证 |

## B10 · 身份核验、风险与争议

原始依据：[模块研究](../../research/whop-full/modules/B10.md)。下列全为规范关联；本模块整体未完成生产验收。

| 研究ID | 原研究功能（不转为Wringy承诺） | 主要组件族 | 深度/边界 |
|---|---|---|---|
| B10-F01 | 个人 KYC 与企业 KYB：托管核验页、预填、证件与自拍、状态查询；一个账户可有个人与企业核验 | [verification](components.md#verification)、[file-upload](components.md#file-upload) | 复用界面与领域契约；细则待正式PRD |
| B10-F02 | 核验补件与人工审查：RFI 的文件/文本/日期/电话/地址等要求，逐项补齐、驳回原因、重新提交、状态通知；敏感编号令牌化 | [verification](components.md#verification)、[form](components.md#form)、[file-preview](components.md#file-preview) | 复用界面与领域契约；细则待正式PRD |
| B10-F03 | 核验复用及权限：已有 Sumsub 核验可通过协议允许的 share token 导入；不足则补核，拒绝不能当已通过 | [verification](components.md#verification)、[app-connection](components.md#app-connection) | 复用界面与领域契约；细则待正式PRD |
| B10-F04 | 业务/国家准入政策：禁止或限制类别、制裁地域、按处理商条件审查；融资及卡消费还有独立限制 | [financial-product](components.md#financial-product)、[verification](components.md#verification) | 候选外壳；地域/提供方/政策和专题流程待验证 |
| B10-F05 | 支付健康：30 天窗口及按购买日期两种争议率，7/14/28 天观察窗、退款率、低数据/风险状态、原因分析 | [metric](components.md#metric)、[chart](components.md#chart)、[risk-case](components.md#risk-case) | 复用界面与领域契约；细则待正式PRD |
| B10-F06 | 风险控制生命周期：自动退款阈值、风险附加费、延迟可提、融资暂停、3DS、卡品牌限制，动态收紧/解除 | [risk-case](components.md#risk-case)、[action-preview](components.md#action-preview) | 复用界面与领域契约；细则待正式PRD |
| B10-F07 | 准备金政策：逐笔滚动、固定金额、融资方保留；展示持有来源及释放日期，金额降低/撤销规则 | [reserve](components.md#reserve)、[wallet](components.md#wallet) | 复用界面与领域契约；细则待正式PRD |
| B10-F08 | 退款规则与决定：全额/部分、低额自动退款、特定融资自动退；余额不足须补款；结果交 B02 执行、B09 记账 | [appeal](components.md#appeal)、[invoice](components.md#invoice)、[ledger](components.md#ledger) | 复用界面与领域契约；细则待正式PRD |
| B10-F09 | 平台 Resolution Center：买家按付款开案、附件与聊天、接受/拒绝/补证、七天升级、一次申诉、最终关闭与通知 | [appeal](components.md#appeal)、[conversation](components.md#conversation) | 复用界面与领域契约；细则待正式PRD |
| B10-F10 | 银行拒付处理：早期预警、自动退款防止转拒付、截止日、自动访问/政策证据、人工补证、提交、赢/输结果及资金返还 | [appeal](components.md#appeal)、[date-time](components.md#date-time)、[file-preview](components.md#file-preview) | 复用界面与领域契约；细则待正式PRD |
| B10-F11 | 发卡消费风控与信用风险政策：锁卡/限额/余额拒绝原因、受限商家类别、地址验证、3DS、实时频率限制；外部网络拒绝优先 | [financial-product](components.md#financial-product)、[risk-case](components.md#risk-case) | 候选外壳；地域/提供方/政策和专题流程待验证 |
| B10-F12 | 税务模式及政策：Discover 与直销分开；算税由商家缴、平台代收代缴、商家自理三模式；含税/未税、注册覆盖、退款调税、税务发票与免税材料处理 | [tax-document](components.md#tax-document)、[invoice](components.md#invoice) | 候选外壳；地域/提供方/政策和专题流程待验证 |
| B10-F13 | 举报、限制及退出后资金处理：举报入口、审查、停权、允许的申诉、资金留置/退款/抵扣；永久封禁与一般限制分开 | [risk-case](components.md#risk-case)、[appeal](components.md#appeal)、[reserve](components.md#reserve) | 复用界面与领域契约；细则待正式PRD |
| B10-F14 | 美国税表业务与行业合规候选：零工平台 1099 合规、税表收集/申报/更正操作的边界；医疗付款合规宣称单列 | [tax-document](components.md#tax-document)、[service-application](components.md#service-application) | 候选外壳；地域/提供方/政策和专题流程待验证 |

## B11 · 开发者、应用与企业接入

原始依据：[模块研究](../../research/whop-full/modules/B11.md)。下列全为规范关联；本模块整体未完成生产验收。

| 研究ID | 原研究功能（不转为Wringy承诺） | 主要组件族 | 深度/边界 |
|---|---|---|---|
| B11-F01 | **双接入模式与开发者工作台**：外部产品使用自有域名／用户；站内应用供商家安装；创建应用及账户／应用密钥，环境分离，TypeScript／Python／Ruby SDK。 | [shell](components.md#shell)、[credential](components.md#credential)、[app-connection](components.md#app-connection) | 复用界面与领域契约；细则待正式PRD |
| B11-F02 | **应用发现与安装分发**：应用商店浏览／搜索／趋势，直接安装链接，商家选择目标账户；消费型、经营型及混合型应用。安装一次不等于所有商家共用同一个内容实例。 | [app-connection](components.md#app-connection)、[search](components.md#search) | 复用界面与领域契约；细则待正式PRD |
| B11-F03 | **成员与商家双视图**：Experience 面向成员，可生成多个 experience 实例；Dashboard 面向经营者；深链接、路径配置、预览环境及管理员访问检查。 | [workspace-switcher](components.md#workspace-switcher)、[shell](components.md#shell)、[entitlement](components.md#entitlement) | 复用界面与领域契约；细则待正式PRD |
| B11-F04 | **授权生命周期**：必需／可选权限及用途说明；安装同意；增加权限后重新批准；Authorized apps 管理；未同意新权限时调用失败，可选权限拒绝时降级。 | [app-connection](components.md#app-connection)、[team-access](components.md#team-access) | 复用界面与领域契约；细则待正式PRD |
| B11-F05 | **身份集成与访问控制**：账户密钥、跨安装应用密钥、账户限定用户令牌、iframe 身份、Sign in with Whop；OAuth 登录同意／刷新／撤销；已有用户映射和账户内头像／名称覆盖。 | [app-connection](components.md#app-connection)、[credential](components.md#credential) | 复用界面与领域契约；细则待正式PRD |
| B11-F06 | **站内运行与移动发行**：iframe 与宿主通信、外链／个人资料／购买弹窗；Frosted UI；开发代理；React Native；上传发行包、审核后推广到生产。 | [site-lifecycle](components.md#site-lifecycle)、[app-connection](components.md#app-connection) | 基础模式关联；生态/原生/编辑器专题设计未完成 |
| B11-F07 | **可靠 API 与事件交付**：日期版本、当前／Legacy 资源区分、沙盒、重复请求去重、权限／限流错误；Webhook 配置、签名、测试、投递记录、重试、停用和补查。文件上传含分片与就绪状态。 | [event-log](components.md#event-log)、[file-upload](components.md#file-upload) | 复用界面与领域契约；细则待正式PRD |
| B11-F08 | **外部支付界面接入**：托管／嵌入 checkout、独立支付字段、地址／税号／邮箱／品牌告知、快捷钱包按钮；原生 iOS 付费墙、购买及权益读取。业务成功由服务端支付结果确认。 | [checkout](components.md#checkout)、[app-connection](components.md#app-connection) | 复用界面与领域契约；细则待正式PRD |
| B11-F09 | **平台／市场关联账户**：个人或商家开户关联、外部 metadata、开户完成、面向关联账户创建收款、转账及手动付款，嵌入或托管提现门户。 | [app-connection](components.md#app-connection)、[verification](components.md#verification)、[payout](components.md#payout) | 复用界面与领域契约；细则待正式PRD |
| B11-F10 | **平台收费与费用承担配置**：直接收款 application fee；fee markup 默认／覆盖／删除；平台代付提现费或收款人承担；明确费用、退款和争议归属。 | [price-plan](components.md#price-plan)、[money-input](components.md#money-input)、[payout](components.md#payout) | 复用界面与领域契约；细则待正式PRD |
| B11-F11 | **身份审核接入**：个人 KYC／企业 KYB、托管会话、文档提交、已有 Sumsub 审核共享、审核状态、补资料 RFI、能力是否开通。拥有接入状态，不拥有审核规则。 | [verification](components.md#verification)、[app-connection](components.md#app-connection) | 复用界面与领域契约；细则待正式PRD |
| B11-F12 | **外部钱包与资金组件**：余额／分类／结算中、流水／详情、存入／转出／提现／兑换、卡片和交易、收益及验证入口；组件事件交给宿主处理。组件存在不保证所有地区开通底层能力。 | [wallet](components.md#wallet)、[transfer](components.md#transfer)、[payout](components.md#payout)、[financial-product](components.md#financial-product) | 候选外壳；地域/提供方/政策和专题流程待验证 |
| B11-F13 | **外部社区与增长组件**：频道、私信及列表、客服聊天、主题；应用 API 对接论坛／通知／课程／会员／联盟等；广告创建／报告／付款设置及像素受众／事件／个人轨迹嵌入。 | [conversation](components.md#conversation)、[ad-editor](components.md#ad-editor)、[attribution](components.md#attribution) | 复用界面与领域契约；细则待正式PRD |
| B11-F14 | **外部经营连接器**：HubSpot 原生支付／订阅记录及报价收款；GoHighLevel 机构／子账户付款提供商；QuickBooks 双向商品／订阅／发票及提现对账；Zapier 触发器／动作／自动化；Xero 仅列候选，不计已上线。 | [app-connection](components.md#app-connection)、[import-export](components.md#import-export) | 复用界面与领域契约；细则待正式PRD |
| B11-F15 | **开发者商业化及企业服务**：开发者可向商家售卖安装／订阅／分成方案（营销例子）；企业联系销售、按量／地区报价、专属账户经理与接入协助；第三方服务协议和 API 停用责任。 | [service-application](components.md#service-application)、[price-plan](components.md#price-plan) | 候选外壳；地域/提供方/政策和专题流程待验证 |

## B12 · AI创业与经营支持

原始依据：[模块研究](../../research/whop-full/modules/B12.md)。下列全为规范关联；本模块整体未完成生产验收。

| 研究ID | 原研究功能（不转为Wringy承诺） | 主要组件族 | 深度/边界 |
|---|---|---|---|
| B12-F01 | **Whop AI 创业入口**：官网按创业方向进入；网站工作台通过对话描述业务、创建网站及关联商品／价格、再用对话编辑。官网的行业方向是用例，不是各自一套已验证系统。 | [ai-workbench](components.md#ai-workbench)、[site-lifecycle](components.md#site-lifecycle) | 复用界面与领域契约；细则待正式PRD |
| B12-F02 | **AI 会话管理**：新建／列出／读取／改名／删除、切换关联业务上下文、通知偏好、general／support agent、消息数／token 使用字段；可选定时自动化在资源描述中出现，完整配置界面未证实。 | [ai-workbench](components.md#ai-workbench)、[notification-inbox](components.md#notification-inbox) | 复用界面与领域契约；细则待正式PRD |
| B12-F03 | **AI 媒体生产**：提示词生成图片／视频、异步状态读取、就绪后输出文件供业务使用；按账户余额计费。 | [ai-workbench](components.md#ai-workbench)、[asset-library](components.md#asset-library)、[progress](components.md#progress) | 复用界面与领域契约；细则待正式PRD |
| B12-F04 | **编程助手资料接入**：文档 MCP、完整文档索引、Markdown 正文和可安装技能目录，让外部助手查资料。MCP 是让 AI 连接工具的协议。 | [file-preview](components.md#file-preview)、[search](components.md#search)、[app-connection](components.md#app-connection) | 复用界面与领域契约；细则待正式PRD |
| B12-F05 | **AI 经营工具与确认机制**：账户 API MCP 浏览器授权、多业务逐次选择上下文；财务／凭证／删除操作先预览再确认、参数绑定、重复请求去重；断开／重连及过期处理。Claude Code、Grok Build 插件包装此能力。 | [action-preview](components.md#action-preview)、[ai-workbench](components.md#ai-workbench)、[app-connection](components.md#app-connection) | 复用界面与领域契约；细则待正式PRD |
| B12-F06 | **Whop CLI 创业与发行**：终端登录、创建／关联项目、本地开发、构建部署、管理业务资源；与 Claude 等助手组合；CLI 与 MCP 是并列操作渠道。 | [site-lifecycle](components.md#site-lifecycle)、[credential](components.md#credential)、[event-log](components.md#event-log) | 基础模式关联；生态/原生/编辑器专题设计未完成 |
| B12-F07 | **Whop Websites 托管生命周期**：独立 whop.site 地址，网站列表／编辑／设置／版本，构建发布和旧版恢复；密钥配置、服务端调用授权、运行日志；像素自动跟踪，另加自定义事件。 | [site-lifecycle](components.md#site-lifecycle)、[event-log](components.md#event-log)、[attribution](components.md#attribution) | 基础模式关联；生态/原生/编辑器专题设计未完成 |
| B12-F08 | **Blueprints 业务蓝图与发布者归因**：官方验证／社区发布、趋势／最新／使用排序、预览／使用说明；复制商品、价格、图片、商店样式和可收款网站；目标业务选择、源码克隆、发布者收益归因。 | [blueprint](components.md#blueprint)、[referral](components.md#referral) | 复用界面与领域契约；细则待正式PRD |
| B12-F09 | **已有网站接入**：输入 URL 重建网站与商品；或只在既有网站安装像素、不迁托管；后续使用站点编辑／版本能力。 | [blueprint](components.md#blueprint)、[site-lifecycle](components.md#site-lifecycle)、[attribution](components.md#attribution) | 复用界面与领域契约；细则待正式PRD |
| B12-F10 | **Whop Migrations**：Stripe 连接、迁移预览、支付方式转移协助、排除名单、确认、旧订阅周期末取消、未来续费接管、成功／失败 CSV、重跑跳过已迁移记录。 | [blueprint](components.md#blueprint)、[import-export](components.md#import-export)、[subscription](components.md#subscription) | 复用界面与领域契约；细则待正式PRD |
| B12-F11 | **美国公司成立服务**：可继续个人经营；LLC 申请／共同创始人资料、付款、登记与 EIN；API 增加 C-Corp 及股权／职务字段；门户、CLI、API 入口；申请状态追踪。 | [service-application](components.md#service-application)、[verification](components.md#verification)、[tax-document](components.md#tax-document) | 候选外壳；地域/提供方/政策和专题流程待验证 |
| B12-F12 | **Whop University／创业教育**：课程与资源、经营教学、公告、同行社群、支持和辅导；学校把真实创业作为教学活动。经营者学习与商家卖课是不同关系。 | [course](components.md#course)、[conversation](components.md#conversation)、[schedule](components.md#schedule) | 复用界面与领域契约；细则待正式PRD |
| B12-F13 | **WhopX 创始人成长社区**：按 Whop 实际收入解锁分层聊天、实时排行、城市群／线下活动、较高档位每周交流与回放；登录自动检查资格。 | [service-application](components.md#service-application)、[commission](components.md#commission)、[entitlement](components.md#entitlement) | 候选外壳；地域/提供方/政策和专题流程待验证 |
| B12-F14 | **经营下一步建议链与客户端进度记录**：按账户现状列建议步骤、读取链和已填输入；Execute 当前只写客户端已运行的分析事件及逐步 redirected 记录，不在服务器执行产品／定价／发布动作。 | [stepper](components.md#stepper)、[ai-workbench](components.md#ai-workbench)、[action-preview](components.md#action-preview) | 复用界面与领域契约；细则待正式PRD |

## 交接与检查边界

以catalog稳定id建立设计文件组件名与实现名；先检查五状态线的冲突和失败恢复，再扩展页面。source条目数由读取本地模块表验证，不把168当168个同等工作量需求。每个研究条目保留原来源链接于模块文件中。

本次可验证：JSON可解析、字段齐全、id唯一、每族有选择性的状态、168编号完整且不重复、映射引用存在、12模块计数匹配。未验证：真实交互、屏幕阅读器、浏览器/设备兼容、视觉截图覆盖、真实数据权限、出款凭证和供应商性能。本文与其他三文件是文档交接，不等于可发布组件库。

### 本次已执行的结构校验 · 2026-09-11

已通过本地读取校验：103个组件id唯一，目录字段精确匹配约定结构，48个复合族均有组合/输入/回执补充，12模块中的168个研究编号与原表集合完全一致且无重复；所有组件映射、逐组件锚点及本地文件链接可解析。已核对当前tokens中的触控、动效、warning、按钮、输入、行选择及typography.app路径存在；目录与本文的键盘、无障碍、响应式、动效、用法及禁用示例字段保持同步。未运行交互或视觉测试。

待主任务特别收口：domain-states.md的D12指出B02与B09付款执行职责在现有研究的粒度差异；当前只提出按收款/退款与出款分责的候选，不宣布架构已定。B09受限金融、B03生态应用、B11原生容器、B12完整编辑器等条目虽已关联组件，仍需独立专题规格，不能据168/168映射宣称168项产品设计已全部完成。

### 封闭复核澄清记录 · 2026-09-11

按主任务接受的五项意见同步catalog/components/domain：payable可在授权政策下叠加risk-held且保留义务；R/K的unknown只属读取观察；requires-action的failed要求提供方确认；dialog作为12模块基础且B09-F06明确关联出款取消确认；计量修正影响accruing/pending-settlement时标出金额核对中并阻止新释放。D01/D06仍待规则方法及政策权限批准，没有新增生产能力或商业政策批准。

本轮已执行校验：103个组件结构/唯一ID、48个复合族、168/168原始编号及组件引用、目录与逐组件状态/模块/行为字段同步、本地链接与组件锚点全部通过；dialog覆盖12/12模块，五项澄清的定向文本断言5/5通过。仅文档结构和一致性验证，未运行视觉、交互、提供方接口或生产测试。

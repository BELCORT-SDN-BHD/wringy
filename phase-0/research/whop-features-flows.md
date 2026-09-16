# Whop 功能与生命周期拆解：从成交、交付到留存与增长

访问日期：2026-09-10。研究 worker 独立执行，无进一步委派。本文只写入本文件；未操作真实商家账户、支付或发送消息，未修改 sources/，未初始化 Git。已读取 research 与 orchestration 技能；前期笔记只用于定位，本次重新访问来源。本文是事实研究，不批准任何产品方向，也不要求创始人先选卖家或决定马来西亚方案。

## 结论与证据边界

**推断：Whop 的核心组合是“销售承诺＋收费方案＋持续访问权＋成员关系＋分销激励”。** 官方对象模型把商品连接到多个收费方案和交付体验，再由购买会员关系授予访问权。因此，一个创作者可以把课程、聊天和服务组合为不同层级，而不必让每个交付工具独立收费。例子：免费入门课程与聊天、付费进阶内容、VIP 预约服务；这也是官方商品管理文档的示例，不代表真实卖家收入。[对象模型](https://docs.whop.com/developer/concepts)；[商品管理](https://docs.whop.com/manage-your-business/products/manage-products)

**对“品牌＋创作者”的解释，仍是推断：** 品牌可以承担商品与服务承诺，创作者既可以自己做商家，也可以作为导购推广者或合作伙伴。Whop 官方分别提供公开推广、定制佣金和逐笔分成入口；这些角色不应混成一个“creator”。品牌活动、内容奖励的具体任务验收与费用堆栈属于其他研究分工，本文只保留高层连接，不推算利润、获客成本或佣金回报。[推广与合作入口](https://docs.whop.com/affiliates/promote-your-business)；[官方文档目录中的 Content Rewards 与费用入口](https://docs.whop.com/llms.txt)

证据标记：**观察**＝亲自查看的 Mobbin 抽样截图；**官方**＝当日访问的官方正文所描述能力或规则，未经交易实测；**推断**＝研究者解释其商业作用；**未知**＝本轮未取得证明。截图采集日期未核实，不能把访问日期当作截图日期。官方功能描述也不等于后台可靠性、用户采用率或商业效果证明。

## Mobbin FIRST：七次精确流程检索与实际观察

先发现 Mobbin MCP，再执行下列七次 web 流程搜索，每次最多一条结果。已用原生 image blocks 显示并查看返回预览，没有打印 base64。共六条 Whop 流程、23 张 Whop 抽样预览；Etsy 误匹配不作为证据。没有声称看过流程中的所有屏幕。

| 精确查询 | 命中／实际查看 | 观察及边界 |
| --- | --- | --- |
| `Whop seller onboarding create a store and first product` | [Creating a business](https://mobbin.com/flows/5c01b319-2080-40b5-9a5e-5cf4592f35d1)，18 屏中看 1/5/10/14/18 | 姓名、生日、行业、商家命名，最后到空商品表；可见 Analytics、Users、Payments、Support chats 等入口。不能证明身份验证或提现激活。 |
| `Whop product pricing subscription checkout purchase` | [Editing pricing](https://mobbin.com/flows/bcfd1856-4d43-4755-adda-b69974870981)，11 屏中看 1/4/8/11 | 免费／付费、周期、试用、初始费、库存、取消折扣、等候名单、支付方式开关及预览。支付方式有灰显和申请入口，不能解读为各国均支持。 |
| `Whop member access community course lessons` | [Searching Whop](https://mobbin.com/flows/b662d41a-6762-4422-bfc1-43eb68fcfceb)，6 屏中看 1/4/6 | 实际不是课程学习流程；看到公共内容付费墙和跨 Businesses/People/Experiences/Forums/Chats/DMs 搜索。DM 结果中有商品批准／拒绝消息片段；不能证明审核标准。课程交付改用官方文档核实。 |
| `Whop seller dashboard analytics manage customers` | Etsy Dashboard (seller) | 产品不匹配，排除；卖家分析由官方正文补证。 |
| `Whop cancel subscription request refund` | [Requesting a refund](https://mobbin.com/flows/5044d298-01fa-43ff-8672-ff51294f12bb)，6 屏中看 1/4/6 | 订单账单→原因、至少 50 字符说明、可附证据→已申请→Resolution center。没有观察到取消订阅操作或退款到账。 |
| `Whop affiliate find product get referral link` | [Become an affiliate](https://mobbin.com/flows/e504a115-bbec-4c15-a57f-3da1970c0eee)，3 屏全看 | 推广买家与推荐创作者两个入口，以及分享链接、获酬说明；截图累计金额与人数不是当日经营数据，本文不用。 |
| `Whop buyer purchasing a paid product through checkout` | [Purchasing a product](https://mobbin.com/flows/7fe84cb0-9a69-42ef-a55c-60c71c28c757)，13 屏中看 1/4/7/10/13 | 商品页→月付／一次性选择→试用与银行卡表单→已存卡和优惠码→已加入工作区。工作区可见课程、聊天、活动、文件和带锁入口；并非真实扣款或权限测试。 |

## 功能矩阵：用户、问题、动作、商业作用

以下“商业作用”一列全部是**推断**：描述机制可能影响的收入环节，不声称效果已经发生，也不表示 Whop 对该功能另收费。其余能力为**官方**描述，除特别标记观察。每行直接链接证据。

| 用户／阶段 | 问题与可执行动作 | 商业作用（推断） | 直接证据 | 未知／限制 |
| --- | --- | --- | --- | --- |
| 商家／建店 | 配置店名、标题、描述、logo、图库／视频和分类 | 把承诺变成可购买展示 | [课程业务建店](https://docs.whop.com/supported-business-models/educational-programs) | 自定义域名、完整白标与 SEO 控制未验证 |
| 商家／建商品 | 创建商品、标题与媒体；选择付款后包含的 apps；也可只收款、站外交付 | 同时服务内容商家和已有交付系统 | [创建商品](https://docs.whop.com/manage-your-business/products/create-product) | 站外交付质量不会由“已收款”保证 |
| 商家／收费 | 免费、一次性、订阅；同商品多个方案；试用、币种、付款方式 | 免费引流、一次成交和经常性收入 | [创建商品](https://docs.whop.com/manage-your-business/products/create-product) | 老订阅随改价如何变化未验证 |
| 商家／销售控制 | 库存、隐藏店页、付款前问题、自动到期、成交后跳转；等候名单先填支付资料，批准后收费 | 限量服务、筛选与转化衔接 | [管理商品](https://docs.whop.com/manage-your-business/products/manage-products) | 批准后扣款失败、资料保存期限未验证 |
| 买家／成交 | 观察：比较方案、试用后金额与日期、输入优惠码、选付款方式 | 降低付款步骤阻力 | [购买流程](https://mobbin.com/flows/7fe84cb0-9a69-42ef-a55c-60c71c28c757) | 示例价格和支付按钮不代表统一收费／地区支持 |
| 商家＋成员／分层交付 | 每个商品勾选 apps；免费、Premium、VIP 可包含不同体验；可预览成员视角 | 同一内容系统提供价格阶梯 | [管理商品](https://docs.whop.com/manage-your-business/products/manage-products) | 多商品重叠权限与配置变更通知未实测 |
| 商家／模块组合 | 从 App Store 添加工具，同一 app 可加多次；团队配置设置 | 降低组合交付成本 | [添加 apps](https://docs.whop.com/add-apps) | 第三方费用、停服责任、迁移能力逐 app 未验证 |
| 社群管理员＋成员／互动 | Chat 控制发言、反应及链接／图片；Events 发布事件与链接 | 持续交流与活动提供回访理由 | [添加 apps](https://docs.whop.com/add-apps) | 实际活跃率、审核效果未知 |
| 教师＋学员／课程 | 模块→章节→课时；视频、文本、PDF、多媒体、自测和测验；顺序完成、水印、证书、字幕语言 | 内容可售卖且有学习进程 | [课程功能](https://docs.whop.com/supported-business-models/educational-programs) | 水印不等于防盗录；证书不等于第三方资质 |
| 成员／上手 | Content 欢迎指南、Forums 公告与问答、多个 Chat 讨论区 | 缩短购买后找内容与求助的路径 | [课程业务搭建](https://docs.whop.com/supported-business-models/educational-programs) | 完课率与上手成功率未知 |
| 客服／客户管理 | Users 查看用户；Memberships 按每份购买关系列示；筛选、导出、查看最近访问、联系用户 | 找到流失或高价值用户并处理订单 | [管理用户](https://docs.whop.com/manage-your-business/manage-payments/manage-users) | 数据准确性、导出合规设置未知 |
| 客服／会员调整 | 转移链接、封禁、免费天数、优惠码、暂停收款、取消、立即终止 | 补偿、保留关系与处理滥用 | [管理用户](https://docs.whop.com/manage-your-business/manage-payments/manage-users) | 操作不等于自动退款；角色与审批需按权限判断 |
| 买家／退出 | 网站 Orders 或移动端 Manage Orders 取消；邮件确认；已付周期内保留访问 | 自助退出降低客服摩擦 | [取消订阅](https://docs.whop.com/memberships-and-access/cancellations-and-refunds/cancel-a-subscription) | 退款是另一个流程，受政策约束 |
| 商家＋买家／续费恢复 | 逾期邮件、五天重试、可配置逾期访问；更新支付方式、人工重试，成功后恢复访问 | 回收非主动流失收入 | [失败续费](https://docs.whop.com/payments-and-billing/payment-issues/troubleshoot-failed-payments) | 重试具体时点与回收率未知 |
| 商家／欢迎与挽回 | User joined／User left 自动 DM，可同时邮件；姓名变量、媒体、发送者 | 欢迎、升级销售、退出反馈与回流 | [自动消息](https://docs.whop.com/manage-your-business/growth-marketing/automated-messaging) | 未证明有任意事件、多步骤滴灌或投递保证 |
| 商家／经营分析 | 自选 Users、Payments、Resolution widgets；访问、试用转化、流失、付款状态、推广者、退款 | 发现漏斗与服务问题 | [Analytics](https://docs.whop.com/manage-your-business/manage-business/analytics) | MRR 为估计且含 past-due；不能当现金或净利润 |
| 商家＋推广创作者／分销 | 公开与成员佣金、指定用户百分比／固定额、首笔／持续佣金，系统跟踪与付款 | 用外部受众与成员推荐获客 | [推广业务](https://docs.whop.com/affiliates/promote-your-business) | 归因窗口、跨设备、净新增贡献未知 |
| 推广者／执行与收益 | Marketplace 浏览报价、Become affiliate、View assets 复制链接、Stats、Balance 提现 | 让内容分发者参与销售收益 | [成为推广者](https://docs.whop.com/affiliates/be-an-affiliate) | 销售不是即时可提现；有等待与撤回条件 |
| 商家＋合作伙伴／关系管理 | 可定制伙伴佣金；Revenue Share 提供逐笔分成入口 | 品牌与创作者合作可制度化 | [推广业务](https://docs.whop.com/affiliates/promote-your-business) | 不把分成入口当已验证品牌活动工作流 |
| 客服＋平台／售后 | 理由与证据→商家接受／拒绝／补材料→Whop 介入→一次申诉；小额自动退款设置 | 在银行争议之前解决不满 | [Resolution Center](https://docs.whop.com/manage-your-business/manage-payments/resolution-center) | 处理时长与判决准确率未实测 |
| 团队／分工 | Owner、Operations、Sales、Support、Advertiser 与自定义角色；邀请和可要求双重验证 | 规模化委派运营 | [团队权限](https://docs.whop.com/manage-your-business/team-management/manage-team-roles) | Support 能编辑课程与体验，不能望文生义为只读客服 |
| 开发者／扩展 | account、product、plan、membership、experience、访问授权；自托管 app 嵌入 Whop；API 权限、OAuth 授权与 webhook 事件通知 | 把支付、身份和交付接入自有软件 | [对象模型](https://docs.whop.com/developer/concepts) | API 存在不证明接入质量或所有 app 共用稳定性 |
| 运营／自动化 | Zapier 支持支付成功／失败、会员有效／失效、争议等触发；退款、发票、重试等动作 | 减少重复搬运和恢复工作 | [Zapier](https://docs.whop.com/third-party-integrations/zapier) | 已发现暂停语义冲突；上线前须实测 |
| 客服＋开发者／修复交付 | API 重新计算 Whop 权限、修复 Discord 入群／角色、重发 TradingView 权限，后台日志记录结果 | 处理“付了钱但进不去” | [重同步访问](https://docs.whop.com/api-reference/beta/memberships/resync-membership-access) | Telegram 基于邀请，不由该操作重同步 |
| 平台风控／运营 | Payment health 显示账户控制：准备金、自动退款、结算延迟、融资暂停、额外验证或卡品牌限制 | 限制损失并维护支付能力 | [Payment Controls](https://docs.whop.com/trust-and-safety/account-health/controls) | 这是官方机制说明，非内部后台观察；触发算法、损失率未知 |

## 生命周期失败路径：不能只拆成功购买

| 触发 | 官方描述的处理 | 商业／交付边界 |
| --- | --- | --- |
| 内容权限配置错 | 商家调整商品包含的 apps，并用 Preview as 检查。[商品管理](https://docs.whop.com/manage-your-business/products/manage-products) | **推断：** 正确扣款也可能对应错误交付；配置检查与支付检查要分开。 |
| 已购买但外部工具没开通 | 异步重同步 Whop、Discord、TradingView；结果写会员日志；Telegram 排除。[重同步 API](https://docs.whop.com/api-reference/beta/memberships/resync-membership-access) | **未知：** 人工介入时长、第三方封禁和邀请失效的完整补救。 |
| 续费失败 | Past due→邮件与五天重试；逾期是否保留访问由设置决定；持续失败五天后取消，成功后恢复。[失败续费](https://docs.whop.com/payments-and-billing/payment-issues/troubleshoot-failed-payments) | “付款失败”不自动等于“立刻失去权限”。回收成功率没有公开证据。 |
| 主动退出／被终止 | 买家取消保留本周期；商家 Terminate 立即撤销。[取消](https://docs.whop.com/memberships-and-access/cancellations-and-refunds/cancel-a-subscription)；[商家操作](https://docs.whop.com/manage-your-business/manage-payments/manage-users) | 取消未来收费、立即撤权、退还过去的钱是三个动作。 |
| 临时暂停 | 当前 API 写明暂停周期收款但保留访问。[Pause Membership](https://docs.whop.com/api-reference/beta/memberships/pause-membership) | Zapier 文档写成暂停访问；不能自行假设二者一致，见下节。 |
| 商品不符／没收到／忘记取消 | 观察：退款原因、说明和证据上传。[退款截图](https://mobbin.com/flows/5044d298-01fa-43ff-8672-ff51294f12bb)；官方：每次付款 120 天内一案、商家 7 天回应、未解决则平台介入、可一次申诉。[售后规则](https://docs.whop.com/manage-your-business/manage-payments/resolution-center) | 超时进入平台裁定不等于自动批准；付款方式还有例外。 |
| 推广成交后退款／争议／欺诈 | 佣金等待 30 天；这几种情况佣金退还商家。[推广者规则](https://docs.whop.com/affiliates/be-an-affiliate) | 推广者显示收益不等于最终到账。 |
| 结束推广合作 | 归档链接后新成交不再计佣，但历史成交仍有持续佣金；不支持 sub-affiliates。[推广管理](https://docs.whop.com/affiliates/promote-your-business) | 不能把“删掉推广关系”理解为清零已约定后续分成。 |
| 账户争议风险上升 | 控制按账户设置并持续复核，可能限制支付方式或延迟可提现资金。[风险控制](https://docs.whop.com/trust-and-safety/account-health/controls) | **推断：** 商家成交、交付、退款与资金可用性必须联合看；不计算具体费率。 |

## 资料差异与尚未证明的部分

1. **售后时间表达不同。** Mobbin 确认页写退款请求会在 48 小时内回复；当前官方规则给商家 7 天回应，再由 Whop 介入。可能是不同版本或不同阶段承诺，无法裁定，不能把任何一个当最终到账时限。[截图](https://mobbin.com/flows/5044d298-01fa-43ff-8672-ff51294f12bb)；[当前正文](https://docs.whop.com/manage-your-business/manage-payments/resolution-center)
2. **暂停含义明确冲突。** Zapier 的 Pause Membership 说明为暂停访问；当前会员 API 明确保留访问、停止收款。报告不抹平差异；若实现自动化，应依据实际使用的动作测试权限与账单结果。[Zapier](https://docs.whop.com/third-party-integrations/zapier)；[当前 API](https://docs.whop.com/api-reference/beta/memberships/pause-membership)
3. **数据口径影响解读。** Analytics 的月度经常性收入（MRR）与年度经常性收入（ARR）包括 active 和 past-due，均为估算。扣 Whop 费用后的收入也不是扣除卖家交付成本的净利润。[Analytics](https://docs.whop.com/manage-your-business/manage-business/analytics)
4. **平台运营只得到公开可见面。** 看到审核消息片段，读到平台裁定与账户控制；没观察内部审核队列、质检、客服排班、算法阈值或实际人工成本。不能将导航、按钮或文档承诺包装成内部运营事实。[搜索截图](https://mobbin.com/flows/b662d41a-6762-4422-bfc1-43eb68fcfceb)；[售后](https://docs.whop.com/manage-your-business/manage-payments/resolution-center)；[控制](https://docs.whop.com/trust-and-safety/account-health/controls)
5. **覆盖缺口。** 尚未实测移动端内容消费、完整课程进度、搜索排序、评价可信度、站外集成断连、升级降级按比例计费、取消折扣效果、账户删除后的数据导出、各国商家准入。此次范围不能支持“SEA 均可用”、具体留存提升或可复制经济性的结论。

## 本轮官方正文证据账本

共核读 18 个功能文档页面；另访问官方首页文档入口与 llms.txt 作定位。前三页通过浏览器文本打开，后续通过官方提供的同页 `.md` 表示读取；API 页只采用实际已读摘要与字段说明，不把附带庞大接口规格误称全量审阅。引用均指向相应官方页面。

1. [Add Apps](https://docs.whop.com/add-apps)
2. [Analytics](https://docs.whop.com/manage-your-business/manage-business/analytics)
3. [Educational Programs](https://docs.whop.com/supported-business-models/educational-programs)
4. [Create a Product](https://docs.whop.com/manage-your-business/products/create-product)
5. [Manage Products](https://docs.whop.com/manage-your-business/products/manage-products)
6. [Manage Users](https://docs.whop.com/manage-your-business/manage-payments/manage-users)
7. [Failed Subscription Payments](https://docs.whop.com/payments-and-billing/payment-issues/troubleshoot-failed-payments)
8. [Cancel a Subscription](https://docs.whop.com/memberships-and-access/cancellations-and-refunds/cancel-a-subscription)
9. [Resolution Center](https://docs.whop.com/manage-your-business/manage-payments/resolution-center)
10. [Be an Affiliate](https://docs.whop.com/affiliates/be-an-affiliate)
11. [Promote Your Business](https://docs.whop.com/affiliates/promote-your-business)
12. [Support Chats／自动消息](https://docs.whop.com/manage-your-business/growth-marketing/automated-messaging)
13. [Zapier](https://docs.whop.com/third-party-integrations/zapier)
14. [Resync Membership Access](https://docs.whop.com/api-reference/beta/memberships/resync-membership-access)
15. [Core Concepts](https://docs.whop.com/developer/concepts)
16. [Payment Controls](https://docs.whop.com/trust-and-safety/account-health/controls)
17. [Team Management](https://docs.whop.com/manage-your-business/team-management/manage-team-roles)
18. [Pause Membership](https://docs.whop.com/api-reference/beta/memberships/pause-membership)

给汇总研究者的重点：优先保留“商品—方案—访问权”的连接、失败续费的可配置权限、退款与佣金联动，以及暂停语义冲突。品牌活动与支付费用另由对应研究报告承接；本文未为其填造数字或结论。

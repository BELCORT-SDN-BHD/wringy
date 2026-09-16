# Wringy 马来西亚 Creator Rewards 执行可行性

**建议：有条件推进小规模人工运营 V1；暂不承诺“马来西亚真人有效播放自动结算”。** 首先验证“品牌付款—奖励核准—创作者实际收款”，再增加自动计量。Malaysia first、Belcort 创始人自建、EN/BM/zh-Hans-MY、官方 Linear＋shadcn 设计基础及长期完整 Whop 方向，均为此次任务提供的创始人输入；本研究没有验证其代码实现。此稿是研究建议，不是资金流、法律资格或上线批准。

核验日为 **2026-09-11（马来西亚）**。下文“声明”指官方文档明确说明；“观察”仅指本次直接读到的文档事实，未代表账户实测；“推断/建议”是 Wringy 判断；“未知”须供应商或实测补足。所有来源的标题、日期、范围、章节、矛盾及访问方式见文末和同目录 `malaysia-sources.json`。

## 1. 马来西亚收付：三个资格不能合并

**声明：Whop 的 Malaysia 提现国家名单确实存在，但 Platforms API 明确仅限邀请、需审核业务用途。** 国家覆盖只回答“某类用户可能提现到哪里”；不回答“马来西亚 Wringy 能否作为平台收品牌预算、延后按表现分配给个人创作者”。非美国提现文档要求接受注册地币种的银行账户，并说明换汇；MYR 具体银行、费用、额度、保留款和审核时间仍未知。[M01–M03]

例如，品牌能在 Whop 付卡款，不能据此承诺创作者通过 DuitNow 收取奖励。Whop 本地收款列表未列 FPX/DuitNow；其显示条件还涉及买家 IP、币种和付款类型。营销页的 241+ territories、187+ countries 与文档 200+ 口径不能拼成统一逐国能力证明。[M02,M36,M37]

**建议优先向 Stripe MY 验证 Connect，同时保留 Whop 候选。** Connect 是将平台、客户与收款人资金分配连接起来的服务。Stripe 的 separate charges and transfers（先收款、后分别转账）在 MY 有官方支持，适合候选的一对多奖励结构；但它不是对 Wringy 用途的批准，更不是通用钱包或托管承诺。平台余额承担相应费用、退款、拒付；资金隔离功能是 private preview。MY 到其他 SEA 国家不能沿用美加英等地区的跨境规则。[M04]

| 项目 | 已确认的官方能力/观察 | Wringy 尚需确认或限制 | V1 处理建议 |
|---|---|---|---|
| Whop 平台资格 | Platforms API invite only；列企业与个人连接账户 [M01] | Belcort/Wringy 法人、品牌预算、个人奖励用途是否获邀/接受 | 未取得书面同意，不作为已可用核心路径 |
| Whop MY 提现 | Malaysia 在名单；方法随国家/账户；当地币种转换 [M02,M03] | MYR 银行目的地、身份材料、费率、最低额、冻结/退回责任 | 获批后按具体账户验证；不写“即时必达” |
| Stripe MY 收款→分账 | MY 支持先收后转；可多收款人；平台承担相关损失 [M04] | 创作者身份/业务类型、预算留存期、结算角色、转账用途和预充值来源 | 首轮仅 MY 主体→MY 收款人、MYR；最终结构以批准为准 |
| Stripe FPX | MY 商户/MY 买家/MYR；需 BRN；Connect 支持；独立 `fpx` 余额 [M05,M06] | 具体连接账户能力及分账配置；收款不等于代付 | 一次性品牌付款候选，按源余额对账 |
| FPX 账期与退款 | 非自动循环扣款、无 manual capture；退款异步，原交易60日内发起 [M05] | 失败/退款期间是否还可承担已核准奖励 | 不以付款跳转成功释放预算；收到可靠状态并满足可用资金条件再放行 |
| DuitNow | PayNet 商户需收单伙伴；DOBW、QR、AutoDebit不是同一种产品 [M08,M09] | 伙伴能否支持平台/子商户、资金分配、奖励代付及退款；价格未知 | 购买合适收单/代付服务，首版不直连网络 |
| Stripe“即时出款” | MY 在 Connect 名单，但有合资格借记卡/账户条件 [M38] | 具体外部账户资格、限额、费率 | 不称 DuitNow，不作为默认到账保证 |
| SEA 扩张 | 当前 Stripe 文档跨境支付余额转账有区域边界 [M04] | 每国平台/收款人、币种、银行、税务与合同 | 每增加一国重新过资金流门槛 |

FPX 在总矩阵出现 Subscriptions 支持，并不推翻其“不支持 recurring”：脚注限定 `send_invoice`，即逐次发单并让买家再次付款。[M05,M07] 本研究不将 Network 通用收单价当 Creator Rewards 定价，也不采纳第三方店铺的“Content Rewards Premium”套餐作为官方成本。成本测算先留待报价变量。

## 2. 社交计量：证据能支持到哪一层

OAuth 是创作者授权平台读取指定账号资料的机制；授权不是交出密码。**账号所有权、视频总量、观众地区、独立真人与广告效果是五个不同问题。** 已核对的接口不能共同生成逐观众、跨视频、跨平台的真人去重账本；这是字段范围所支持的推断，不能包装成已实现反作弊。[M10,M14,M16,M17,M20,M23,M24]

| 平台/路径 | 所有权与可取数据 | 地区/真人边界 | 权限、配额与版本门槛 |
|---|---|---|---|
| TikTok Display v2 | `video.list` 授权；query验证视频属于用户；一次至多20个ID；含 `view_count` [M10] | 字段表无观众国家、逐观看者ID；不能由创作者所在地判观众所在地 | 三个v2读取端点各默认600请求/分钟滑窗；正式应用审核需完整网站、条款和演示 [M11,M12] |
| TikTok Research | 研究查询含总播放、`region_code` [M14] | 后者为创作者注册国家；不是MY观众；归档统计可能明显滞后 | 商业用户不符合Research Tools资格；不得作为商用替代 [M13] |
| Instagram 专业账号 | 两种登录路线；账号与媒体Insights；个人账号媒体不在该路径支持范围 [M15] | 账号粉丝/互动受众国家分布不是某条Reel观看地区；人口资料仅部分受众，Top45且有门槛；媒体指标表无country [M16,M17] | 第三方专业账号需Advanced Access/App Review；Instagram Login读数用basic＋manage_insights权限；实际BUC额度/业务验证待查 [M15,M18,M19] |
| YouTube Data v3 | 公共statistics，作者另行授权验证；`videos.list`成本1单位 [M20] | `regionCode`是地区榜单；总播放不证明MY或唯一人 | 现行正文把search/insert另计，其余端点合计默认10000单位/日；扩额需审核 [M25] |
| YouTube Analytics v2 | 当前授权频道；country报表可按视频过滤，含views/engagedViews [M22,M23] | 国家小样本被隐藏，阈值不公开；缺行不是0；没有跨平台真人ID [M24] | Analytics每请求1单位但额度查控制台，不套Data API额度；OAuth验证与用途审批另计 [M24,M26] |

**版本变化会改变“多少钱买到多少观看”的含义。** YouTube 当前 Videos 文档已将 2026-08-24 后所有格式 `viewCount` 定义为播放开始计数，包含自动播放；不能继续套旧版 Shorts 口径。当前 `engagedViews` 也不能自行改名为“30秒真人有效观看”。[M21,M29] Instagram 的教程仍有旧 impressions 示例，端点却明确弃用；实现时须固定版本和指标定义。[M15,M16]

**还有用途与留存门槛。** YouTube 默认限制衍生指标；2026-06-01 附加政策提供经申请/接受修订后的分析及更长统计留存路径，示例包括为品牌建议赞助报酬。故不能说一切分析都禁止，也不能假定 Wringy 已获许可。奖励观看/点赞等互动被明确禁止；创作者制作报酬与买互动需区分，按量结算的具体实现仍待确认。[M27,M28] 原始 API 数据不能为了“审计”无限保留；授权检查、刷新、撤销和删除必须按来源政策设计。[M27]

**建议 V1 只开放一个已验证渠道的邀请制活动。** 若先试 TikTok，定位为本地创作者内容生产与分发，按核准交付固定报酬或有上限的约定奖金；MY地区仅作参与者/内容定位条件。若品牌硬性要求“按该视频MY观看付费”，先验证 YouTube 授权地理报表及用途；TikTok/Instagram证据未补足前不承诺该计费产品。截图或后台导出可作补充证据，不能被人工审核升级成真人认证。

每次核准应保存“来源、视频ID、账号授权、采集时刻、统计窗口、字段定义/版本、数值、缺失原因、证据指纹、审核人、决定及申诉”。例如：10万总播放、账号60% MY粉丝，不允许记成6万实测MY播放；应分别记录两个不同范围的事实，再按预先公布的规则决定是否核准交付。异常增长、重复投稿或截屏不一致只进入人工复查队列，不直接给“刷量已证实”标签。

## 3. 隐私和广告披露的最低基础

马来西亚官方七原则要求告知目的、安全、必要期限、完整性及个人访问/更正。[M30] 建议只存供应商身份验证状态和引用，不自行集中保存身份证/银行凭据；创作者指标、审核证据、账务记录分别设访问范围和保留依据。删除请求不能简单删账，也不能简单拒绝：先按法定账务、合同证据与平台API数据区分，并由本地专业人员确认保留例外。[M27,M30]

DPO（数据保护负责人）指南除人数条件，还列定期系统监测；小规模试点不能仅凭人数断言免除。DBN（数据泄露通知）指南按损害/规模判断，列72小时时钟及不同知悉/确认例子；对适用主体通知另有7日规定。应把发现、确认、评估、通知及提交回执纳入演练，而非只写隐私页。[M31,M32] 使用海外云或支付/KYC服务时需核跨境资料转移；官方已有正式指南入口，但本研究未证明 Wringy 的具体传输依据。[M33,M39]

Content Code 2022 第三部分要求商业合作清楚披露、与推广相同语言、视频内展示，直播定期重复。[M34] V1提供 EN/BM/zh-Hans-MY 披露文案并人工查验；2025咨询稿不当已生效替代版。[M35] 本研究不根据“平台”“广告公司”等名称推断牌照，需由实际主体、合同责任、收付结构和数据用途判断。

## 4. Belcort 自建范围与购买边界

以下为推荐架构，非 Whop 内部实现。先做同一应用内有清晰职责的模块，长期12模块仅预留清晰接口，不先建钱包、发卡、借贷或全SEA支付。

| 自建模块 | 必备记录 | 边界/接口 |
|---|---|---|
| 活动与条款 | Campaign、RuleVersion、预算上限、渠道/时间窗口、语言版本、RightsGrant | 冻结规则后接受投稿；权利/音乐/素材许可与收益规则独立 |
| 创作者与授权 | Creator、SocialConnection、Consent、ProviderAccountRef | 仅保存必要授权及KYC状态；身份核验和银行收集购买供应商托管流程 |
| 投稿与指标 | Submission、MetricSnapshot、Evidence、缺失原因 | `verifyOwnership`、`fetchMetrics`；每渠道能力明确，不强制统一“有效播放” |
| 审核与申诉 | ReviewDecision、ReasonCode、Appeal、AuditEvent | 人工解释、复核、更正留痕；不给未知欺诈算法准确率 |
| 奖励与账务 | RewardAccrual、LedgerEntry、Funding、Refund、PayoutAttempt | 业务核准≠钱已到账；追加更正分录，防重复核准/付款 |
| 供应商与对账 | ProviderEvent、Settlement、ReconciliationException | `createFunding`、`onboardRecipient`、`createPayout`、`refund`、`reconcile` |
| 隐私与运营 | RetentionPolicy、AccessRequest、Incident、ExportAudit | 最小权限、撤销/删除任务、多语言通知；证据删除与审计索引分离 |

供应商适配层是把不同服务接到同一业务接口的薄层：保留 Wringy 自己的活动、奖励、账务ID，另存供应商引用和原始状态；首版实现一个支付商、一个社媒渠道即可。它降低重写业务逻辑的成本，**不保证**身份验证、银行资料或授权可无缝搬家。技术验收必须覆盖重复/乱序通知、断线重试、付款失败和对账差异；测试环境成功仍不证明生产资格。

主要成本驱动为收单比例/固定费、Connect账户/出款费、换汇差价、失败/退回费、退款及争议损失、保留资金占用、每条审核分钟数、申诉率、证据存储、授权维护和客服。公式先采用“每条成本＝审核工时成本＋取证/存储＋支付分摊＋预计申诉/损失”，全部参数标待报价或试点实测；不编造报价或获批日期。

## 5. 八项上线门槛

**状态：以下均为建议验收，尚未执行；不是本轮已通过清单。** 可先开展不涉及真实交易的模拟和经同意的资料样本验证。未来生产交易、申请及对外联系另由主任务取得明确授权。

| 门槛 | 最小验证实验及通过证据 | 失败时的产品决定 |
|---|---|---|
| G1 业务及供应商准入 | 提交实际法人、品牌付款人、创作者类型、服务内容、分账/账期图；所选商书面确认允许该用途、国家与责任。Whop必须含Platforms邀请 [M01,M04] | 只做无资金原型；不以普通商户账号绕过 |
| G2 品牌资金可用 | sandbox覆盖成功、失败、取消、重复回调、异步退款；按MYR最小货币单位核对订单/供应商/账本，差额为0 [M05,M06] | 不释放活动预算；查明可用余额/事件来源 |
| G3 创作者收款及异常 | 获授权后小额生产验真：实际MY个人/企业类型、目的账户、费用/净额、到账回执；另测失败/退回；同奖励重复提交不重复付 | 不向该类创作者承诺收款，或缩窄受邀类型 |
| G4 内容权属与授权 | 少量自愿样本覆盖正确作者、他人视频、重复投稿、删帖、撤权；权属、素材使用权与赞助披露均有可核记录 | 缺证拒收/补件，不代持密码 |
| G5 API生产准入与用途 | 一个渠道完成第三方账号所需审核；记录scope、额度和用途。YouTube含衍生/留存许可判定；自有账号成功不算 [M12,M18,M26–M28] | 保持人工交付试点；无许可不推出API按量结算 |
| G6 计量与地区合同 | 用相同视频/时间窗对比官方后台与接口；覆盖低量、空值、迟到、版本变化。若卖MY观看，必须有该视频该窗口地区证据；金额可重算 | 缺MY证据则不售地域CPM（按千次观看计费）；改固定交付 |
| G7 人工审核、申诉及资金保护 | 用重复URL、证据冲突、异常增长、预算耗尽、撤销决定作桌面演练；另一审核人可复算、申诉留痕；支付总额不超已核准且有资金覆盖额 | 缩小活动/限额；人工风险复核，禁止宣传自动防刷 |
| G8 隐私、披露与可经营成本 | 完成三语告知及赞助标签、数据访问/删除演练、供应商数据清单、DBN演练、DPO/跨境适用性复核；用试点工时和真实报价算单条贡献 | 缺必需合规基础暂停；单位经济不过关则调价/减范围 |

主报告应把 **G1、G3、G5、G6** 作为外部依赖最强的门槛。前端精致度无法补偿它们；现有 Linear＋shadcn 基础可直接服务于清楚显示“待审核、证据不足、已核准、付款处理中、到账/失败”的体验，而非伪装成已自动验证。

## 来源

全部来源访问日期：2026-09-11，时区 Asia/Kuala_Lumpur。未标发布日期者记为 undated。以下编号是本研究固定编号；每项具体证据、范围与限制详见 `malaysia-sources.json`，均为公开第一方来源。

- **M01** Whop，[Connected Accounts](https://docs.whop.com/manage-your-business/manage-payouts/connected-accounts)。日期：undated；章节：Whop platform features; Types of connected accounts。
- **M02** Whop，[Set Up Payouts](https://docs.whop.com/manage-your-business/manage-payouts/set-up-payouts)。日期：undated；章节：Enable withdrawals; Supported countries。
- **M03** Whop，[Payout Methods](https://docs.whop.com/manage-your-business/manage-payouts/payout-methods)。日期：undated；章节：Payout options; International payouts。
- **M04** Stripe，[Create separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers.md?platform=web&integration=custom&ui=elements&api-integration=paymentintents)。日期：undated；章节：Supported regions; Cross-border transfers; Transfer availability; Refunds。
- **M05** Stripe，[FPX payments](https://docs.stripe.com/payments/fpx)。日期：undated；章节：Payment method properties; Business locations; Refunds。
- **M06** Stripe，[Accept an FPX payment](https://docs.stripe.com/payments/fpx/accept-a-payment?payment-ui=elements&web-or-mobile=web)。日期：undated；章节：Payouts and transfers。
- **M07** Stripe，[Payment method support](https://docs.stripe.com/payments/payment-methods/payment-method-support)。日期：undated；章节：Country and currency support; Bank redirects; footnote 7。
- **M08** PayNet，[Overview — DuitNow Pay registration](https://docs.developer.paynet.my/docs/duitnow-pay/registration/overview)。日期：undated；章节：Merchant; Acquirer。
- **M09** PayNet，[Overview — DuitNow Online Banking/Wallets](https://docs.developer.paynet.my/docs/duitNow-online-banking-wallets/introduction/overview)。日期：undated；章节：Merchant Acquirer; Refund; Related Services。
- **M10** TikTok，[Query Videos](https://developers.tiktok.com/docs/en/tiktok-api-v2-video-query)。日期：直接HTTP正文2026-08-24；web检索版本2026-08-19，差异保留。2026-09-11 04:21:31 UTC实时HTTP 200，正文及嵌入publishedAt均指8月24日；HTTP Date是响应时间，非改版日。章节：Overview; Request fields。
- **M11** TikTok，[Rate Limits](https://developers.tiktok.com/docs/en/tiktok-api-v2-rate-limit)。日期：2026-08-04；章节：API limits table。
- **M12** TikTok，[App Review Guidelines](https://developers.tiktok.com/docs/en/app-review-guidelines)。日期：2026-08-04；章节：Website URL; Scopes; App review information。
- **M13** TikTok，[Frequently Asked Questions](https://developers.tiktok.com/docs/en/research-api-faq)。日期：undated；章节：Research Tools eligibility Q6; Usage FAQ Q3。
- **M14** TikTok，[Query Videos](https://developers.tiktok.com/docs/en/research-api-specs-query-videos)。日期：2026-09-01；章节：Condition fields / region_code; Video Object。
- **M15** Meta，[Insights](https://developers.facebook.com/docs/instagram-platform/insights/)。日期：undated；章节：Requirements; Access Level; Limitations。
- **M16** Meta，[Instagram Account Insights](https://developers.facebook.com/docs/instagram-platform/api-reference/instagram-user/insights/)。日期：undated；章节：Limitations; Metrics; Host path parameters。
- **M17** Meta，[Instagram Media Insights](https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights/)。日期：undated；章节：Limitations; Metrics; Requirements。
- **M18** Meta，[App Review for Instagram API](https://developers.facebook.com/docs/instagram-platform/app-review/)。日期：undated；章节：Development scenarios; Complete App Verification。
- **M19** Meta，[Rate Limiting](https://developers.facebook.com/docs/graph-api/overview/rate-limiting/)。日期：undated；章节：Overview; Business Use Case rate limits。
- **M20** Google，[Videos: list](https://developers.google.com/youtube/v3/docs/videos/list)。日期：2026-09-04；章节：Quota impact; id; regionCode。
- **M21** Google，[Videos](https://developers.google.com/youtube/v3/docs/videos)。日期：2026-09-04；章节：statistics.viewCount。
- **M22** Google，[Reports: Query](https://developers.google.com/youtube/analytics/reference/reports/query)。日期：2026-05-11；章节：Authorization; ids; endDate; filters。
- **M23** Google，[YouTube Analytics API: Channel Reports](https://developers.google.com/youtube/analytics/channel_reports)。日期：2026-09-10；章节：User geography / User activity by country。
- **M24** Google，[YouTube Analytics API - Data Model](https://developers.google.com/youtube/analytics/data_model)。日期：2026-09-10；章节：Data anonymization; Quota usage。
- **M25** Google，[Quota and Compliance Audits](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits)。日期：2026-09-04；章节：Main quota allocation; Begin an audit。
- **M26** Google，[Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)。日期：undated；章节：Understand scope use; Preparation; Exceptions。
- **M27** Google，[YouTube API Services - Developer Policies](https://developers.google.com/youtube/terms/developer-policies)。日期：2026-06-24；章节：III.E.4, E.8, F.3, I.14, L。
- **M28** Google，[Additional policies for derived metrics and data storage](https://developers.google.com/youtube/terms/derived-metrics-policy)。日期：2026-06-01；章节：Acceptable metrics; Financial Performance Projections; Data Storage。
- **M29** Google，[Metrics](https://developers.google.com/youtube/analytics/metrics)。日期：2026-08-27；章节：View metrics / engagedViews。
- **M30** JPDP Malaysia，[Principles of Personal Data Protection](https://www.pdp.gov.my/ppdpv1/en/principles-of-personal-data-protection/)。日期：undated；章节：Seven principles。
- **M31** Personal Data Protection Commissioner Malaysia，[Personal Data Protection Guideline — Data Breach Notification](https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2025/08/GP_DBN_ENG.pdf)。日期：2025-02-25；章节：v1.0; §5-9; PDF页7-15。
- **M32** Personal Data Protection Commissioner Malaysia，[Personal Data Protection Guideline — Appointment of Data Protection Officer](https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2025/08/GP_DPO_ENG.pdf)。日期：2025-02-25；章节：Version1.0; §4.2-4.3; PDF页5-6。
- **M33** JPDP Malaysia，[Personal Data Protection Guidelines on Cross-Border Transfer of Personal Data (CBPDT)](https://www.pdp.gov.my/ppdpv1/en/akta/personal-data-protection-guidelines-on-cross-border-transfer-of-personal-data-cbpdt/)。日期：undated；章节：Official guideline download entry。
- **M34** Content Forum Malaysia，[The Malaysian Communications and Multimedia Content Code 2022, Third Edition](https://contentforum.my/wp-content/uploads/2023/05/Content-Code-2022-Third-Edition.pdf)。日期：2022-05-30；章节：Part 3 §6.1-6.3; Part 1 §6。
- **M35** Content Forum Malaysia，[Public Consultation](https://contentforum.my/public-consultation/)。日期：undated；章节：Content Code Review 2025。
- **M36** Whop，[Global Payouts Infrastructure](https://whop.com/network/products/payouts/)。日期：undated；章节：Hero; Your platform toolkit。
- **M37** Whop，[Local Payment Methods](https://docs.whop.com/payments-and-billing/local-payment-methods.md)。日期：undated；章节：Which methods display; Local payment method overview。
- **M38** Stripe，[Instant Payouts for Connect](https://docs.stripe.com/connect/instant-payouts)。日期：undated；章节：Availability; External Account eligibility。
- **M39** JPDP Malaysia，[AKTA 709](https://www.pdp.gov.my/ppdpv1/en/akta709/)。日期：undated；章节：Circular; Guideline; Public Consultation Paper。


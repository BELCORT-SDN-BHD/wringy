# Whop 支付、资金与信任：商业证据与候选模块边界

核验日期：**2026-09-10**。研究 worker 单独完成；遵从本次要求不进一步委派。使用 research 技能，以官方正文为依据。范围只含 B02/B09/B10；没有写代码实现、开户、支付或其他线上操作，没有修改 sources/。这是公开能力研究，**不是已批准建设规格、法律意见或 Whop 内部架构图**。

## 规范功能清单在哪里

| 候选模块 | 规范功能清单 | 功能条目数 |
| --- | --- | --- |
| B02 结账、订阅与账单 | [B02](modules/B02.md) | 15 |
| B09 钱包、资金流与金融产品 | [B09](modules/B09.md) | 15 |
| B10 身份核验、风险、退款争议与税务政策 | [B10](modules/B10.md) | 14 |

这些数是研究者归并后的功能族，不是 Whop 公布的功能数。卡片拥有功能清单、本模块概念、正常/失败流程、费用触发、依赖及未来验收候选；本报告不再重复清单。依赖只表示所需能力，不意味着整个模块必须按顺序完工。

证据标签：**官方操作/开发正文**＝确认页面写了该能力，未实测；**API**＝接口正文存在，未验证权限/开放状态；**Current API 路径**＝`/api-reference/beta` 是当前 API 文档路径，路径名称本身不证明预发布或成熟度；仅有明确产品预发布声明时才如此标注；**营销**＝产品宣传而非合同或效果验证；**专项合同**＝页面发布的规则，不代替具体账户接受的合同；**第三方**＝Whop 文档描述合作产品，不能把其收入和风险全部归 Whop；**未知/冲突**＝不据此作强结论。以下全部链接的访问日期统一为 2026-09-10。

## 商业版图：比商店交易费更宽

**分析：** Whop 对外同时销售交易入口和支付/代付基础设施。企业站提供站外结账及钱包；开发文档允许连接账户直收并收取应用费，或平台先收款再转给连接账户。因此外部平台可以买 Whop 的付款能力而不经营 Whop 商城。文档里的 application fee 是该外部平台向其商家收的费用，不自动属于 Whop。[企业收款](https://docs.whop.com/developer/platforms/collect-payments-for-connected-accounts.md)、[企业支付](https://whop.com/network/products/payments/)

| 商业族 | 钱的方向与收入触发 | 收入证据边界 |
| --- | --- | --- |
| 支付接受与优化 | 买家付商品价；适用方承担成功收款、账单管理、路由及换汇服务费 | 公开价格能说明收费事件，不能推算支付净收入、合作方成本或成功率提升实绩。[定价](https://whop.com/network/pricing/) |
| 发票收款 | 发票正文写买家 5% 服务费，并有转嫁处理费选项 | 两者适用及叠加不清，不能静默合并进标准卡价。[账单](https://docs.whop.com/manage-your-business/manage-payments/send-invoice.md) |
| 企业代付与分账 | 平台充值或收款，按奖励/佣金等义务转给收款人，再外提；提现按方式收费 | 不等于每笔都是商城 GMV；外部平台 application fee 和 Whop 服务费须分开。[企业指南](https://docs.whop.com/developer/platforms/collect-payments-for-connected-accounts.md) |
| 消费融资 | 第三方融资方批准买家并收还款；商家获得按规则结算的货款 | 按融资付款方式收费不证明 Whop 获得所有利息，更不证明自行放贷。[融资目录](https://docs.whop.com/payments-and-billing/financing/all-bnpl-options.md) |
| 发卡与奖励 | 卡用户消费；平台发卡可分享 interchange，合资格消费有 cashback | 交换费分享有官方文本支持；Whop 自留比例、发卡方成本及补贴资金来源未知。[Whop Cards](https://docs.whop.com/whop-finance/cards.md) |
| 数字资产钱包与兑换 | 资金兑换为 USDT，或经 Relay 换 cbBTC/XAU₮；确认前显示交易费用 | 建立/维护钱包无 Whop 费；兑换可含网络、Relay、价差与展示的 Whop 费用，统一费率/净分成未知。[钱包条款](https://whop.com/wallet-terms/) |
| Treasury / Earn yield | 企业页宣传用户余额赚收益、无最低金额 | 具体资产、合作方、资格、申赎、收益率及平台收入均未证实；不能称已核银行储蓄账户。[企业钱包](https://whop.com/network/products/payouts/) |
| 风控/税务 | 按实际认证/预警/争议事件或税务服务收费 | 税金及准备金不是收入；高风险附加费可能存在但并非统一公开。[控制](https://docs.whop.com/trust-and-safety/account-health/controls.md)、[税务](https://docs.whop.com/payments-and-billing/fees/taxes.md) |

商城旧 30% 费取消有[官方更新日志](https://web.whop.com/blog/whop-changelog/)明确说明；不能把“商城免费发现”外推为支付、税务或广告都免费。旧经济报告仍可作定位参考，本报告只对重新核正文的结论负责。

## 金融产品必须分清的六层

1. **法币余额**：通用条款描述由金融合作方为客户持有资金，并声明 Whop Balance 不受美国 FDIC 保险保障；美国合作方提及 Cross River Bank。不是 Whop 本身银行存款业务。[通用条款 §7](https://whop.com/tos/)
2. **自托管数字资产**：钱包专项条款描述 Privy、USDT、Relay 及 cbBTC/XAU₮。这与上项金融合作方持款不同；收到 token 不等于直接收到原生 Bitcoin 或实体黄金。条款还包含授权撤销和私钥移出后相关账户禁用，不只是普通支付方式开关。[钱包条款](https://whop.com/wallet-terms/)
3. **商家自行分期**：按照固定次数逐期收费，商家逐期收到款；未证明有融资方垫付。[结账链接](https://docs.whop.com/manage-your-business/payment-processing/create-checkout-link.md)
4. **买家融资**：目录覆盖 Afterpay/Clearpay、Splitit、Klarna、Sezzle、Zip、ClarityPay、Scalapay、Tamara、SeQura、PayPal 等；定价页另列 Climb。是合作方家庭，不是一个同质 BNPL 功能。Splitit 使用已有信用卡额度，ClarityPay 有期限融资，PayPal 有 Pay in 4 与 Credit；不能一概称无息贷款。Sezzle 有 15 天结算，SeQura 有分段拨款/长准备金，故“商家先收款”不是无条件即时现金。[融资目录](https://docs.whop.com/payments-and-billing/financing/all-bnpl-options.md)、[Splitit](https://docs.whop.com/payments-and-billing/financing/splitit-guide.md)、[SeQura](https://docs.whop.com/payments-and-billing/financing/sequra-guide.md)、[定价目录](https://whop.com/network/pricing/)
5. **Spend Card**：商务卡合同披露抵押品、信用额度、偿付及清算机制；美国合同标记 2026-03-31 生效，定义 Issuer 为 Third National，列当时 0% APR、非美元换汇及跨境费用，并声明 Whop 不自行提供信贷。应标“有抵押的合作方发卡产品”，而非只按营销称普通借记卡，也不推断独立营运资金贷款。国际商务卡亦有专门条款，但不提供足够 Malaysia 开户资格证据。[美国商务卡](https://whop.com/us-card-business-terms/)、[国际商务卡](https://whop.com/intl-card-business-terms/)
6. **余额收益**：首页“Earn yield”及卡页 Treasury“up to 6% APY”入口确实存在，但后者请求返回的是 Set Up Payouts。它证明宣传入口，不证明当前收益率、普遍开放或本金保障。不能把 cashback 当存款利息，也不能把 token 持有当作 Treasury 收益产品。[首页](https://whop.com/network/)、[卡页](https://docs.whop.com/whop-finance/cards.md)、[Treasury 请求](https://docs.whop.com/whop-finance/treasury.md)

返现专项条款比产品页更细：合资格项目列 Whop ads、content rewards、Uber 交通服务，排除 Uber Eats 等非交通服务；一般 5%，每账户每月上限 $50,000，退款/拒付等可冲正，到账前并非既得现金。它没有解释补贴来自交换费还是其他预算。[返现条款](https://whop.com/card-cashback-terms/)

## 地区、结算与移动渠道不能相互替代

| 核验维度 | 正文证据 | 对 Malaysia 研究的含义 |
| --- | --- | --- |
| 买家付款 | 当地方式按买家 IP、币种、金额、收费类型和商家开关决定 | 买家能付不等于卖家可提现，也未发现正文确认 FPX/DuitNow。[当地方式](https://docs.whop.com/payments-and-billing/local-payment-methods.md) |
| 卖家提现 | Malaysia 在提现国家名单；非美商家需接受注册国家币种的银行账户 | 只确认国家名单出现，未确认具体银行、费率、额度、法人资格、MYR 实际结算或即时渠道。[设置](https://docs.whop.com/manage-your-business/manage-payouts/set-up-payouts.md)、[目的地](https://docs.whop.com/manage-your-business/manage-payouts/payout-methods.md) |
| 待结算资金使用 | 卡消费、即时提现及广告可用 pending；普通银行提现及账户转账要求结算后资金 | 不把一个余额数字当所有用途的可用额度，审查会关闭即时选项。[卡](https://docs.whop.com/whop-finance/cards.md)、[出款方式](https://docs.whop.com/manage-your-business/manage-payouts/payout-methods.md) |
| 融资 | 看买家所在地和币种，也要商家申请与业务审核；只一次性 | “全球支付”不能证明 Malaysia 买家有目录中每种融资，也不能证明 Malaysia 商家能获批。[申请](https://docs.whop.com/payments-and-billing/financing/apply.md) |
| Whop 自有 iOS app | 文档列 USD 700 以下一次性走 Apple 内购，Apple 收 30%，展示加价 42.86%；订阅及较高金额走 Whop web；Apple 退款与最长 75 天待结算 | 是 Whop 自身公布路径，不证明各地区所有应用可以复用同一规则。[自有 iOS](https://docs.whop.com/payments-and-billing/fees/in-app-ios-purchases.md) |
| 外部 iOS SDK | 原生 Apple Pay 指导限实体商品/现实服务，文档报价 2.7%+$0.30；数字内容另走 StoreKit | 与 Whop 自有 iOS 内购不同，不套用其金额门槛。[开发指南](https://docs.whop.com/developer/guides/ios/accept-one-time-payments.md) |
| Tap to Pay / POS | 需要 iPhone XS+、iOS18+、联网；商家地址限澳/加/波兰/英/美；一次性，产品或自定金额、小费、QR 回退 | Malaysia 不在支持列表，即使 Apple 在当地提供相关技术也不能推断 Whop 能收。[Tap to Pay](https://docs.whop.com/payments-and-billing/tap-to-pay.md) |
| 税务 | 代算与代缴的覆盖不同；有些地区需卖家自行注册、申报 | 未核 Malaysia SST、电子发票、支付牌照；本研究不据 Whop 跨境营销给当地法律结论。[税务](https://docs.whop.com/payments-and-billing/fees/taxes.md) |

## 冲突与过度推断防线

| 事项 | 当日一手证据差异 | 本研究采用的处理 |
| --- | --- | --- |
| MoR（特定交易责任下的登记商户） | 卖家条款 §1 讲卡网络/结算 MoR，§6A 讲仅税务模式的 MoR；企业转账指南又称平台为原付款 MoR | 按卡网络、结算、税务、供货、平台收费路线分别记录，具体合同含义待确认。[卖家条款](https://whop.com/seller-terms/)、[企业两路线](https://docs.whop.com/developer/platforms/collect-payments-for-connected-accounts.md) |
| 平台裁决 | 卖家条款 §5 限定对商品争议的裁决权限；Resolution Center 描述七天后平台决定及申诉 | 卡片记录实际公开流程主张，不宣称已确定合同授权范围。[条款](https://whop.com/seller-terms/)、[案件](https://docs.whop.com/manage-your-business/manage-payments/resolution-center.md) |
| 争议率 | 健康文档提 1.5% 且区分方法/窗口，卖家合同列滚动90天低于1%，融资申请有另外门槛 | 不复制成统一阈值；未来配置需有渠道、统计窗口、合同版本。[健康](https://docs.whop.com/trust-and-safety/account-health/payment-health.md)、[合同](https://whop.com/seller-terms/)、[融资](https://docs.whop.com/payments-and-billing/financing/apply.md) |
| 资金保留 | 停权帮助页120天、一般准备金合同最长180天、SeQura约12个月 | 不挑一个数字宣称所有钱届时可提。[停权](https://docs.whop.com/trust-and-safety/suspensions/account-suspensions.md)、[准备金](https://docs.whop.com/trust-and-safety/account-health/reserves.md) |
| 转账 | 通用条款限制非商品交易 P2P 与个人 Balance 转赠；企业指南/API 提供 transfers/claim links；钱包专项条款对钱包范围优先 | 按账户、业务目的与专项协议保留能力，不宣传通用任意转账。[通用](https://whop.com/tos/)、[钱包](https://whop.com/wallet-terms/)、[Transfer](https://docs.whop.com/api-reference/beta/transfers/create-transfer.md) |
| crypto 退款 | 当地支付说明可从余额退款；Resolution Center 对 Coinbase Commerce 不支持；钱包条款称链上兑换/转账不可撤销退款 | 商品退款资金动作、链上交易回滚及平台案件资格是三个不同概念，也可能涉及旧连接路线。[当地方式](https://docs.whop.com/payments-and-billing/local-payment-methods.md)、[案件](https://docs.whop.com/manage-your-business/manage-payments/resolution-center.md)、[钱包](https://whop.com/wallet-terms/) |
| 费率 | 当地方式正文 ACH 0.8% 封顶$5、iDEAL 2.5%+€0.80；企业定价 ACH 1.5%封顶$5、iDEAL 1.5%+€0.80 | 不重复旧报告整张费表，也不挑便宜值；实际账单/签约报价才可用于成本模型。[当地方式](https://docs.whop.com/payments-and-billing/local-payment-methods.md)、[定价](https://whop.com/network/pricing/) |
| 税务地域 | 帮助页代缴描述美国州与领地、EU/UK；卖家条款写目前18个美国州、UK及EU | 不宣称全美或全球代缴已核实；交易适用名单仍缺。[税务](https://docs.whop.com/payments-and-billing/fees/taxes.md)、[合同](https://whop.com/seller-terms/) |
| 终身商品 | 定价帮助页用 lifetime access，卖家条款要求明确期限并禁止 lifetime/perpetual | 一次性付款不应自动等同永久权益；B02 提供收费事实，B03 权益期限受 B10 政策约束。[定价说明](https://docs.whop.com/manage-your-business/payment-processing/set-up-pricing.md)、[合同](https://whop.com/seller-terms/) |
| Xero | 索引描述可同步，但正文写 Coming soon | 仅未来连接候选，不写已上线。[Xero](https://docs.whop.com/third-party-integrations/xero.md) |
| 付款费用接口 | 完整索引有 list-payment-fees，本次 .md 请求404 | B02-F07 标为索引线索，未把该接口写成已核正文。[接口 URL](https://docs.whop.com/api-reference/payments/list-payment-fees.md) |
| Treasury | 卡页有收益率入口，但目标正文返回提现说明 | 收益族保留在 B09-F14，标营销/缺口，不删去也不填补产品细节。[卡](https://docs.whop.com/whop-finance/cards.md)、[请求](https://docs.whop.com/whop-finance/treasury.md) |

## 模块关系与建设价值（分析）

B01 提供身份/组织/团队/商品目录；B02 持有收费计划及执行；B03 持有会员访问与交付；B04 持有 CRM 视图和通用支持；B06/B07 持有奖励/佣金义务；B08 持有广告义务；B09 记录资金及执行转移；B10 持有核验、风险、纠纷与税务政策；B11 持有外部接口契约。UI 可以跨模块，但不要复制原始事实。

例：一个 RM100 课程买家退款，客服 B04 可以发起案件，但裁决应来自 B10；B02 执行退款，B09 记录资金，B03 决定并执行访问变更。RM100 仅是未来产品的假设例子，不代表已测试 Whop MYR 交易。卡返现产品奖励义务在[总图责任表](README.md)归 B09，B10 管资格与滥用审查；这是研究候选划分，不代表创始人已批准架构。

推荐的首轮研究后切片是模拟的一次性付款→可追溯账务→退款/出款失败处理。其价值是先验证财务事实不会在各模块相互矛盾；不是先把 B02/B09/B10 全部做完。发卡、收益、金融抵押、加密资产及当地渠道应分别决定，不捆绑进首轮。每卡都有带 ID 的假设验收，未取得 Founder 批准，不开始实现。

## 覆盖审计与证据留存

扫描给定完整索引的 Payments、Payouts & Money Movement、相关 Current API 家族（路径含 `/beta`）及 Optional 帮助族；去重按业务族归并，未把993个链接当993个功能。下载71个相关官方正文地址，另12个补充地址中11个成功、1个404；Treasury 额外请求返回别页。**下载数不等于逐行审阅数**：主要操作页核读正文，冗长API只核功能语义及相关生命周期，不穷举重复 schema。

本轮亦打开企业首页/支付/钱包/定价、更新日志、通用及卖家条款、Wallet/Spend Card 专项条款入口、美国/国际商务卡及返现条款。企业 Platforms 导航点击工具报 Internal Error，未据此认定网站故障；连接账户开发指南补足流程证据。没有验证美国/国际个人卡全部子条款、授权使用者及隐私子条款的细则。

任务专属快照：

- [71页正文与地址](source-index/money-trust-docs-2026-09-10.json)
- [补充正文及404记录](source-index/money-trust-extra-2026-09-10.json)
- [Treasury 请求返回正文](source-index/money-trust-treasury-2026-09-10.md)

剩余覆盖缺口：Treasury 真实产品及资产；独立商家融资/营运资金产品；发卡完整地区/伙伴资格；个人与商务账户专项条款差异；实际处理商、国家与税务合同；完整付款渠道清单及方法级结算保证；Android/外部数字内购完整流程；Legacy API 与 Current API 的迁移差异（不从路径推断成熟度）。公开文本不足以证明这些“没有”，这里只能说本轮未核。

经济未知：实际收入分部、支付成本、交换费和利差自留、cashback补贴、贷款损失、税务成本、风控坏账、GMV与出款重叠、企业议价均未披露。不使用第三方营收估值，也不以价格乘平台宣传交易量推算真实利润。

### 行业营销覆盖补充（2026-09-10 正文核验）

[Gig economy](https://whop.com/network/solutions/gig-economy/)明确宣传 1099 compliance、Earn yield、定制品牌虚拟及实体卡。[Telehealth](https://whop.com/network/solutions/telehealth/)宣传病人付款、订阅和自动合规。已分别纳入 B10-F14、B09-F11/F14。仅核营销，尚不能确认美国税表类型、由谁申报、收集/发放/更正/扣缴流程及费用；更不能推断 HIPAA/BAA、保险理赔、诊所执照验证已实现。收益与实体卡资格缺口不因重复营销而消失。

<a id="tax-fee-conflict"></a>

### 税务服务费冲突：2% 与 0.5%

[税务帮助页](https://docs.whop.com/payments-and-billing/fees/taxes.md)、[企业价格页](https://whop.com/network/pricing/)及本 worker 保存的 [Fees 正文快照](source-index/money-trust-docs-2026-09-10.json)显示税务服务 2%；[平台报告 C08](platform-ai-enterprise.md)记录其抓取的 [Fees](https://docs.whop.com/payments-and-billing/fees/fees)为 0.5%。这是跨来源/抓取结果未解决的差异，不认定任何一个为所有账户的统一税务费率，也不把税务 0.5% 与 Billing 0.5% 混同。需核对应页面版本、适用服务和账户报价；本次仅登记冲突并交叉链接，不改其他 worker 的证据。

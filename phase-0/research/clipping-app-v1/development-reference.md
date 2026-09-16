# Wringy Content Rewards 开发参考（持续研究草稿）

更新：2026-09-13。**不是已批准 PRD、开发承诺或验收标准。** 本文件只整理证据与待决事项，后续可持续补充认证应用实测发现。

## 证据边界

- **Observed/UI（实测）**：已观察认证 onboarding 首屏及公开营销页面。必须注明是哪一种。
- **Documented（文档）**：Clipping 官方说明的规则；尚不等于当前账号实际体验。
- **Wringy proposal（提案）**：建议设计，尚未批准；不能冒充竞品行为。
- **未知／待测**：没有证据的交互或规则，不补猜测。
- 认证探索目前停在接受条款前，等待当步确认；未点击 Continue。不得写成已完成 onboarding。
- 文档截图不是认证应用截图；公开品牌仪表板是营销示意，不是可验证的客户业绩。

直接依据：[本轮实测记录](README.md)、[公开 UI 证据报告](../clipping-ui-v1/findings.md)、[机制与条款报告](../clipping-v1/findings.md)。认证截图与访问记录见本轮实测记录。

## 1. 入驻 onboarding

**Observed/UI：** [认证入口](https://clipping.net/auth/onboarding) 标题为 Let's set up your profile；Username 来自 Discord 且当前不可编辑；bio 是多行简介。Continue 同时接受三份条款／政策，尚未点击。证据：`screenshots/01-onboarding.png`、`01-onboarding-ax.txt`，见 README。

**未知／待测：** bio 是否必填、长度限制、提交校验、下一屏、返回后保存、重复提交、失败重试；不推定 Discord 是唯一登录方式。

**Wringy proposal：** 分开表达身份资料与条款同意；标明必填字段和失败原因。

**待决：** 登录方式、最低必要资料、年龄／地区资格、同意记录保存方式及条款版本；不得直接套用竞品合同。

## 2. 社交账号绑定与验证

**Documented：** [Accounts](https://clipping.net/docs/clippers/accounts) 描述选择平台与账号名、把五位代码放入指定资料位置、请求检查；至少一个 Verified 账号才能投稿。状态为 Verified／Pending／Error／Expired。不是已证明采用 OAuth。

**未知／待测：** 真实对话框、校验耗时、重试限制、过期原因、多账号切换、删除确认及重新验证体验。

**Wringy proposal：** 显示账号、平台、验证状态、下一步动作；验证失败不只给红色提示。

**待决：** beta 支持平台、验证机制与数据来源、共享账号限制、账号移除后作品与收益处理；接口可用性未证明。

## 3. 品牌简报与活动配置

**Observed/UI：** [Brands](https://clipping.net/brands) 公开示意为三项指标 → 趋势图 → 预算条 → 短片卡片，见 `../clipping-ui-v1/images/01-brands-public-hero.png`。

**Documented：** 同页明确全托管、无自助配置；品牌提供目标／内容／平台／预算，由团队配置运行。品牌私有创建表单、审批界面和权限未知。

**Wringy proposal：** 品牌简报 → 运营拟定规则及报价 → 品牌确认 → 活动上线；这是辅助服务设计提案。

**待决：** 谁可创建／修改／暂停，何时锁定规则；素材权利、预算来源、剩余奖励处理、费用计提基数及退还条件。CPM 不是平台费率，不能由示意图推出 15%。

## 4. 活动发现与个人首页

**Documented：** [Dashboard](https://clipping.net/docs/clippers/dashboard-home) 区分当前周期已投稿的活动与 Past；仍在运行但当前周期未投稿，也可能归 Past。少于三个活跃活动出现发现入口。

**Documented：** [Campaigns](https://clipping.net/docs/clippers/campaigns) 卡片描述名称、平台、奖励费率及 Active／Paused／Cap Reached；支持搜索筛选。普通活动首次投稿即加入；私有活动完整规则与投稿需批准。

**Observed/UI：** [公开 Campaigns](https://clipping.net/campaigns) 是营销页，不是认证活动列表。

**未知／待测：** 真实卡片与筛选布局、空结果、无资格、暂停和预算耗尽时的按钮行为；不假设必须先点 Join。

**Wringy proposal：** 优先露出奖励单位、适用平台、资格、预算与截止条件；使用同一活动贯穿列表、详情、投稿及结算。

**待决：** 开放／邀请准入、推荐排序、第一批供给招募；首页“活跃”的定义是否采用竞品周期逻辑。

## 5. 详情与投稿

**Documented：** [Submit](https://clipping.net/docs/clippers/campaign-detail) 描述规则／素材参考／赏金／Your clips；先在绑定账号公开发布，再粘贴 URL，检测平台与账号，选择普通或赏金稿并提交；同一稿不能两者兼得。

**Documented：** 错误包括账号不符、重复链接、超出发布时间条件和缺少指定声音；资格提示可引导补齐付款资料、账号验证或私有访问条件。

**未知／待测：** 真实提交弹窗、成功反馈、链接规范化、处理中状态、异常后是否可重试、同一稿跨活动限制。

**Wringy proposal：** 明确“外部发布 → 提交链接”，不要画成已具备自动发帖；成功后落到同一作品记录。

**待决：** 素材授权范围、最低播放量、内容规则、重复投稿范围、规则修改后旧稿处理；竞品常见 1,000／25,000 门槛不是 Wringy 默认值。

## 6. 指标采集与审核

**Documented：** [Clips](https://clipping.net/docs/clippers/clips) 是跨活动作品库；顶部统计随筛选改变。主要状态 Tracking／Stopped／Banned；Paid／Bounty 为可叠加标签，不是一条互斥流程。

**Documented：** [Payments](https://clipping.net/docs/clippers/payments) 说明复核内容质量、合规与公开状态；估算可因移除／不合格下降。Tracking 不代表已经最终获批付款。

**未知／待测：** 数据更新时间、采集失败提示、审核理由呈现、申诉入口、操作日志；公开声明不能证明反作弊准确率。

**Wringy proposal：** 分开显示观测播放、合格播放、估算奖励及审核结果；显示最后更新时间和排除原因。运营审核界面为自有提案。

**待决：** 计量来源、采集频率、预算封顶规则、异常证据、人工责任与申诉窗口；地域／语言受众价值如何验证，而非只翻译界面。

## 7. 收益、结算与付款资料

**Documented：** [Payments](https://clipping.net/docs/clippers/payments) 说明按活动展示作品数、合格播放、普通／赏金／合计与门槛状态；汇总 Estimated／Pending／Paid。新增方法为 PayPal 或 Ethereum USDC／USDT，按活动指定。

**Documented：** [Clipper 条款](https://clipping.net/policies/clipper-terms-and-conditions) 经前报告核查：赞助方关闭周期 → 员工审核 → 赞助方批准 → 付款；无固定关闭时间、无随时提现。不得把文档简述画成固定到账承诺。

**未知／待测：** 实际收益表、零收益、未达门槛、扣减解释、付款失败／重发／争议状态。MYR 和马来西亚支持未确认。

**Wringy proposal：** 区分奖励估算、待批准金额、应付与实付；提供结算依据和付款记录。不要未经决定加入即时提现按钮。

**待决：** 本地支付路径、手续费承担、币种与舍入、结算周期、资金托管责任、退款／争议、税务资料；奖励预算与 Wringy 收费分别核算。

## 8. 设置与资料管理

**Observed/UI：** 公开文档导航有 Settings，但认证设置页尚未观察。

**Documented：** [Settings 官方链接](https://clipping.net/docs/clippers/settings) 已在导航出现，正文未在本轮检查；不据此断言存在通知、密码、注销等功能。

**Wringy proposal：** 先列候选范围：个人资料、绑定账号、付款资料、同意记录、帮助入口；真实 beta 范围待定。

**待决／待测：** 哪些信息允许修改、修改是否重新验证、账号关闭／资料删除及收益保留；全部仍需证据或产品决定。

## 后续实测补充与研发边界

- 逐页追加：访问日期、真实 URL、截图路径、进入动作、观察到的状态、未执行动作；不要覆盖旧证据的时间范围。
- 优先补：onboarding 下一屏、真实导航、活动列表／详情、投稿前置阻断、作品库、收益与设置；没有观察到的状态继续保留“待测”。
- 各提案统一检查：加载／空态／失败／成功／无权限／外部服务不可用；这是检查清单，不是竞品已有行为。
- Founder 当前方向：Content Rewards 优先，Prototype＋可用 beta 研发上限 RM50,000；后续模块另议。
- 以上不证明完整自动采集、反作弊或付款基础设施能在上限内实现；可讨论人工配置／审核，但需 Belcort 报价与接口验证。
- 本文件是研究输入；业务决定获确认后才进入正式规格，不能以本草稿直接判定开发验收。

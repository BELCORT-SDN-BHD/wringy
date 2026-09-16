# Content Rewards 当前产品流程证据

核查日期：2026-09-10。范围：官方公开文字与公开入口；未观察登录后 UI，未创建账号、发帖、付款或委派。先读 `phase-0/research/creator-rewards-official-flows.md`，旧记录只作定位线索。本文是研究证据，不是 Wringy 产品决定或获批规格。资金、条款解释与结算时序由另一研究分工处理。

## 15 项实质发现

1. **最新已找到的编号发布仍是 V2，不等于已证明 V2 是最新运行版本。** 官方 Articles 的 Changelog 展示 2026-08-19「V2 is here」；按该日期之后定向检索未找到更新编号。9 月 3 日的官方政策比它新，但政策更新不等于软件发布。[S1][S2][S6]
2. **旧、新体验并存。** 9 月隐私政策明确区分 Whop 内嵌体验与独立 CR web application，旧活动/提交仍有在前者运行，新活动/提交在后者。不能以 `apps.whop.com` 域名或 Whop 登录判断流程版本。[S6，开头]
3. **组织成为活动归属。** 发布文称多个 Whop experience 可归一个 organization；代理商下挂品牌。当前代理商页也描述每品牌独立活动、预算、设置。例如两个客户品牌不再只是两套无法切换的安装实例。[S2，One brand…][S7，Can I run campaigns for more than one client?]
4. **当前公开角色有四种。** Owner 全权；Admin 管团队/活动/账单/审核；Moderator 管活动、审核和封禁，不管理角色或组织设置；Member 只读。组织可有多个 Owner，最后一个不能移除。**权限冲突：** 8 月发布文称只有 Owner 能任命 Admin/Owner，9 月 §11 则允许 Owner/Admin 授予或变更角色；没有实测证据消解。[S4，§11][S2，Roles…]
5. **三种活动模型公开存在。** CPM 是按每千次观看；per-post 是按获批帖子；retainer 是按周期交付约定帖子数。发布文称 per-post 已结束早期 beta、向所有品牌开放；retainer 可设周/双周/月、周期数、各平台交付和创作者人数。这里只确认配置概念。[S3，Flexible/Which payout models…][S2，Retainers]
6. **可见性与报名门槛要分别看。** 首页列 public、application-only、private；创作者 FAQ 说有的直接加入，有的先申请。组织 §11 明确 private 不进 Discover，也不可匿名查看；不能从三种宣传名称推断实际表单是单选还是两个独立开关。[S3][S5，How do I join…][S4，§11.3]
7. **活动配置已有模板、草稿和定时启动。** 发布文列四类常见模板、保存草稿、指定启动日，并列申请人数上限、审核截止与逾期自动拒绝申请。这里的自动拒绝对象是申请，不能混成作品自动审核；四个模板的名字未公开核实。[S2，Campaign configuration]
8. **素材不止外部链接。** 发布文列视频、图片、品牌素材、PSD、PDF 文件，以及理想创作者描述/类型。旧 Whop 教程主要描述 Asset links。上传大小、权限、下载入口未验证。[S2，Campaign configuration][S10，Creating…/FAQ]
9. **发布前审核是独立可选阶段。** 所有活动类型都可启用：上传未发布视频 → 审批/拒绝/要求修改 → 多轮内联讨论；发布文补充版本与批准发布账号。草稿批准不等于发布后帖子最终批准，例如发布时漏加要求的披露仍可被拒。[S4，§7][S8，§8][S2，Approve content…]
10. **当前公开注册入口不足以证明完整 onboarding。** Creators 的 Create Account 指向 `/signup`，此次读取转到 `/?signin=1`；首页 Launch a Campaign 指向 `/book-a-demo`。政策写登录由 Whop 提供，但具体品牌/创作者资料字段和首次引导顺序尚未验证。[S5][S11][S12][S6，§4.5]
11. **社交连接机制现在有较明确的官方文字。** 隐私 §3.2 列官方 API 授权连接，或在提供时把验证码放简介验证。§4 说明读取所有权/分析数据，不代发；Instagram 要专业账号，Facebook 要管理的 Page，另列 TikTok、YouTube、X（受 API 可用性限制）。这是政策声明，不是逐平台连接成功证明。[S6，§3.2、§4.1–4.3]
12. **创作者提交与结果查看有公开流程描述。** Discover 找活动 → 直接加入或申请 → 按要求在社交平台发帖 → 提交链接 → 品牌审核；Creators 页承诺集中查看 views、earnings、payouts，并列常见拒绝原因。FAQ 的提交时限交由时序分工核对；不能把营销示例数值当账号真实数据。[S5，Transparent/FAQ]
13. **普通内容审核与风险争议不是同一个操作者。** 创作者条款 §7/§9/§10：先风险评分分流，品牌审核；风险标记不等于自动拒绝。CR 处理 flag 申诉，但不能代品牌批准/拒绝；普通拒绝争议可由支持团队协调，品牌决定是否改判。[S8，§7、§9–10]
14. **报表公开边界比“有 analytics”具体。** 代理商 FAQ 列 views、approved submissions、likes、comments、effective CPM，按活动/平台/日拆分，支持 CSV 和分享实时分析链接。8 月发布日还缺批量批准/拒绝及 creators/submissions CSV，但 analytics export 当时可用。当前营销页未证明前两项已补齐，也未证明仍缺。[S7，What reporting…][S2，What is not here yet]
15. **集成有证据，面向品牌开发者的公开 API 尚无证据。** 官方确认 Whop 登录、社交只读连接、可选 Discord 关联；未找到 CR 自有 API endpoint、webhook、鉴权或限流文档。不能把“使用社交平台 API”写成“客户可用 CR API”。首页独立观看验证在 FAQ 明确是部分代理商 beta，不能按标题宣传视为全部开放。[S6，§4][S3，How do I know…]

## 按角色的步骤图（文字证据重组，不是界面点击顺序）

| 角色 | 有依据的步骤 | 边界/出处 |
|---|---|---|
| 品牌 Owner/Admin | 登录 → 组织/品牌工作区 → 邀请团队并分配角色 → 配置活动模型、要求、素材与参与方式 → 草稿/定时启动 → 审申请 → 管活动及结果 | 第 3–8 项；确切创建向导顺序未知；资金交接另文 |
| 代理商 | 单一登录 → 客户品牌工作区 → 分品牌运行上述流程 → 按活动/平台/日看结果 → 导出或分享分析链接 | 第 3、4、14 项；客户只读链接的授权机制未知 |
| 创作者 | Whop 登录 →（适用时）连接/验证社交账号 → Discover/活动入口 → 加入或申请 → 若启用预审则上传草稿、修订、获准 → 自行发布 → 提交链接 → 查看审核与表现 | 第 6、9–12 项；账号连接与申请的强制前后关系未知 |
| Moderator | 看申请/提交 → 草稿反馈或修改要求 → 最终帖子批准/拒绝 → 必要时标记风险/封禁 → 看报告 | 第 4、7、9、13、14 项；不可把草稿状态、申请状态、帖子状态合并 |
| CR 支持/风险审查员 | 接收风险申诉 → 查看理由和证据 → 裁定 flag；普通拒绝争议协调品牌 | 第 13 项；后台队列、分派、审计字段未公开实测 |
| Member | 查看获授权的组织数据 | 第 4 项；具体页面可见范围未知 |

## 对旧 Whop/Mobbin 的证据边界

2025-05-14 Whop 教程仍可读：Earn → Add app → Content Rewards → 配置 → 入金后活动可见；活动详情 See submissions 下为 Pending/Approved/Flagged/Rejected，批准/拒绝有确认。[S10，Creating…、Checking…] 这些是旧教程文字，不是本次界面观察。旧文还有 48 小时自动批准，与当前人工审核描述不同，不应搬进新版流程。

此前记录的 Mobbin 流程是主研究者的预览观察，本文没有重新检查全部屏幕，也没有确认其采集版本/日期。可保留作旧提交形态线索，不能拿它证明当前组织、retainer、申请或预审界面。原记录见 `phase-0/research/creator-rewards-official-flows.md`。

公开 Discover 本次列有真实命名活动及 Join Campaign/Preview 链接；抽取的 Yomi Denzel preview 路径可读且 Join Campaign 仍指 Whop。它证明公开入口共存，不证明参与后落在哪一版产品。[S9][S13]

## 未解决问题与可移交核查

- 发布覆盖：文章索引和两组定向检索未找到 8 月 19 日之后 changelog；`/sitemap.xml`、`/help` 本次工具返回 Internal Error。这是访问/检索局限，不是证明没有帮助中心或新版本。
- 权限：9 月政策与 8 月发布文的 Admin 授权边界冲突，交主研究实际 UI 核查。首页也显示 Member，与发布文仅列三角色不同。
- 模板四个名称、模型创建字段和默认值、申请表问题/接受通知、private 邀请办法、时区与定时启动编辑、素材上传限制均未获公开逐步说明。
- 预审版本保留和指定发布账号的强制行为只有发布文/政策证据；无法确认当前按钮标签、失败提示与不同模型例外。
- 批量审核、创作者/提交 CSV 当前是否补回未定。分析导出声明不能替代这两项。
- 社交授权失败/撤销后重连、creator analytics 筛选与历史粒度、审核员后台/API 均未实测。政策允许 OAuth 与简介验证码，不能把某一方式推为唯一方式。
- 代理商 FAQ 写有审核窗口，但组织条款说 Pending 保留到手动操作；具体超时后产品动作不明，交时序分工与主研究核查，不推断自动批准。

## 来源目录

全部访问于 2026-09-10。页面无发布日期者明确标记未标注；章节用于定位，未伪造锚点。机器可读来源与核查记录见 `product-sources.json`。

- S1 Content Rewards Inc., [Articles](https://contentrewards.com/articles)，日期未标注；Changelog。
- S2 Content Rewards Inc., [V2 is here](https://contentrewards.com/articles/v2-is-here)，2026-08-19；Roles that are actually yours / One brand, however many Whop installs / Retainers / Approve content before it gets posted / Campaign configuration / What is not here yet。
- S3 Content Rewards Inc., [Content Rewards](https://contentrewards.com/)，日期未标注；Flexible / Teams / FAQs。
- S4 Content Rewards Inc., [Organization Terms of Service](https://contentrewards.com/brands-terms)，更新 2026-09-03；§§5–8、11。
- S5 Content Rewards Inc., [For creators](https://contentrewards.com/creators)，日期未标注；Transparent / FAQs / Create Account。
- S6 Content Rewards Inc., [Privacy Policy](https://contentrewards.com/privacy-policy)，更新 2026-09-03；开头、§§3.2、4。
- S7 Content Rewards Inc., [For agencies](https://contentrewards.com/agencies)，日期未标注；The platform for all your campaigns / FAQs。
- S8 Content Rewards Inc., [Creator Terms of Service](https://contentrewards.com/terms)，更新 2026-09-03；§§7–10。
- S9 Content Rewards Inc., [Discover Campaigns](https://contentrewards.com/discover)，日期未标注；Featured campaigns。
- S10 Whop / East，审核 Keisha Singleton，[How to set up Whop Content Rewards](https://whop.com/blog/set-up-content-rewards/)，2025-05-14；Creating a content reward on Whop / Checking your content reward submissions / FAQ。
- S11 Content Rewards Inc., [signup](https://contentrewards.com/signup)，日期未标注；重定向至 `https://contentrewards.com/?signin=1`。
- S12 Content Rewards Inc., [Book a demo](https://contentrewards.com/book-a-demo)，日期未标注；首页 Launch a Campaign 的链接目标。
- S13 Content Rewards Inc., [Yomi Denzel campaign preview](https://contentrewards.com/discover/14f743b2-c5ca-4f3e-8c0d-3010c485005d)，日期未标注；Join Campaign。

## 主研究者实际 UI 观察（独立归因）

以下是主研究者于 **2026-09-10** 使用 CUA 观察三处公开屏幕后传入的结果；本 worker 未重复查看截图。它们属于 **main_actual_ui_observation**，与上文 source_prose 分开：

- [首页](https://contentrewards.com/) 的 Launch a Campaign 与 See a Demo 均进入 [Book a demo](https://contentrewards.com/book-a-demo)，不是已验证的自助建活动表单。
- [Discover](https://contentrewards.com/discover) 实际界面有 All / UGC / Clipping、Search / Filter；排序为 Newest、Highest Budget、Highest Available Budget、Highest CPM、Most Paid Out、Most Creators。
- Lovable 预览先打开弹窗，Open full campaign 进入 [Lovable 活动详情](https://contentrewards.com/discover/ecbd7fec-6f39-4081-aa18-1756f0ae73e9)。页面显示 YouTube / Instagram / TikTok 各 $1/1k、minimum 0.99、maximum 1000、参考素材、Top Earners、Views/Submissions 图。这些数值只描述该实例，不是所有活动默认值。
- 同一活动 Join Campaign 的已观察链接为 `https://whop.com/experiences/exp_T1NluLUJL7I2lN/campaigns/ecbd7fec-6f39-4081-aa18-1756f0ae73e9`。没有加入；多个 Discover 卡片也通向 Whop。不能声称所有流程已经完全迁离 Whop。
- [signup](https://contentrewards.com/signup) 跳到 `https://contentrewards.com/?signin=1`，实际显示首页 email modal；未输入 email、未接受条款。登录后 dashboard 和自助配置流程仍未知。

来源：主研究者本轮直接回报（2026-09-10，三处公开屏幕）；未提供本地产物截图路径。因此这些结果可归因给主研究者，但不伪装成本 worker 的截图验证。

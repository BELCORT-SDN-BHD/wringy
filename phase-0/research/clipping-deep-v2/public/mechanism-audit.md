# Clipping.net 公开业务机制审计

Clipping 的公开材料支持把它理解为「品牌委托运营、创作者外部发帖、平台计量和复核、品牌批准后结算」的内容分发业务。对 Wringy Malaysia Content Rewards beta，最值得研究的是责任分配和结算边界，而不是照着营销页承诺自动反作弊或即时到账。[1](https://clipping.net/brands)[2](https://clipping.net/enterprise)[3](https://clipping.net/docs/clippers/payments)

## 证据口径与适用范围

核查日期为 **2026-09-13，Asia/Kuala_Lumpur**。以下区分四种证据：**官方条款**是网站对权利义务的陈述；**官方文档**是其描述的产品行为；**官方营销**是销售说法或示意；**审计判断／未知**是本报告的推论或证据缺口。前三种都不等于后台已经验证。此次可直接核实的是公开页面存在这些文字；没有独立核实实际付款、风控效果、审批执行或马来西亚准入。

研究范围包括官方文档、法律政策、品牌／企业／活动页面及少量用于交叉核对的官方博客。未操作任何已登录浏览器、注册、联系表单、账号、投稿或支付流程。网页检索可能使用近期缓存；访问日不等于源站更新时间。未标更新日的页面不能排出可靠的版本先后。部分折叠内容只返回标题，未读取的答案不作为证据。没有完整覆盖所有私有活动、品牌合同、Discord 规则或后台实现。

研究授权允许只读查看官方联系页面，禁止发送询问或提交表单。主任务于 2026-09-13 直接读取合作申请页并提供文字与行号，本文据此更新该页证据；本研究工作者未亲自重复打开，也未填写或发送。

旧资料仅作为指针：`phase-0/research/clipping-v1/findings.md` 与 `phase-0/research/clipping-app-v1/development-reference.md`。本报告没有更改旧资料，也不把其中认证体验当作本轮实测。研究已获授权；本文件不是 Wringy 的已批准规格、法律文本或开发验收标准。当前共享目录不是 Git 仓库；本次只新增指定研究文件，不建立实现分支。

## 一、相较旧研究的关键补充

| 面向业务的发现 | 本轮结论与边界 | 证据 |
|---|---|---|
| 创作者确有公开申诉期限 | AUP 写明处罚后 30 天内可申诉。旧稿「本次未见明确限时申诉机制」不能继续作为目前的总判断；回复期限、付款争议是否适用仍未知 | C01，[4](https://clipping.net/policies/acceptable-use-policy) §5 |
| 招募团队会改变创作者实收 | Teams 文档写队长抽成 5%–10%，默认 5%，调整作用于后续付款周期；这不是品牌平台费率 | C02，[5](https://clipping.net/docs/clippers/teams) |
| 观看数据不是已证实的秒级更新 | Welcome 写 12 小时刷新；品牌／企业页说每日更新又称 live。旧稿的采集频率未知可补成「文档频率已知，执行未验证」 | C03，[6](https://clipping.net/docs/clippers/introduction)[1](https://clipping.net/brands)[2](https://clipping.net/enterprise) |
| 已有防重复和时间阻断的文档线索 | Submit 列出重复 URL、账号不符、发布时间限制、缺少声音等错误，但没有阈值和时间戳算法 | C04，[7](https://clipping.net/docs/clippers/campaign-detail) |
| 公开“可随时取消”未说明如何退款 | 活动营销页有 Cancel anytime；一般条款提到退款政策，却未提供计算规则 | C05，[8](https://clipping.net/campaigns)[9](https://clipping.net/policies/terms-of-service) |
| 合作申请入口有最低预算 | 主任务直接读取官方表单，确认最低预算 $5,000；这是合作申请入口门槛，不能当成所有品牌合同的统一下限 | C06，[10](https://clipping.net/contact?type=partnership)，主任务直接读取第 108–137 行 |

**变化性质：** 两份旧研究与本次均为同一天。上表主要是研究覆盖增加和结论修正，没有版本快照证据证明 Clipping 在两次研究之间发布了产品更新。Payments 明说旧支付方式为历史兼容，这支持存在过支付选项迁移，但迁移时间未知。[3](https://clipping.net/docs/clippers/payments)

## 二、谁承担什么责任

| 角色 | 官方描述的动作 | 尚不能确认的权力／责任 |
|---|---|---|
| 品牌／赞助方 | 提供目标、素材、平台和预算，批准上线方案；结算时批准金额 | 谁实际持有预付资金；是否可单方面追溯改价；不批准时如何到期处理 |
| Clipping 运营团队 | 配置、招募网络、运行与优化；付款前检查内容；处理付款 | 是否垫资；审核证据格式；谁批准退款；内部双人复核 |
| 企业客户成员 | Enterprise 宣称多人可发起活动、审稿和看分析 | 席位之间是否有管理员、财务、只读之分；能否越过平台审核 |
| 创作者 | 在自己的绑定账号发公开帖子，再提交链接 | 承诺固定工作量与否；实际身份核验流程；非本人账号纠纷处理 |
| 队长 | 可提供指导、素材和简报，获得成员付款的佣金 | 是否承担版权审查、代付、连带欺诈或申诉责任；文档未赋予这些责任 |
| 审核人员 | 可将稿件移出活动；付款前复核 | 审稿与最终付款批准是否同一个人；利益冲突如何隔离 |
| 社交平台／付款服务方 | 提供指标或执行付款的外部服务 | 中断后的补数、重付和赔偿责任，未形成可验证的操作承诺 |

本表的品牌与运营依据 [1](https://clipping.net/brands)[3](https://clipping.net/docs/clippers/payments)；企业席位依据 [2](https://clipping.net/enterprise)；创作者投稿依据 [7](https://clipping.net/docs/clippers/campaign-detail)[11](https://clipping.net/docs/clippers/accounts)；队长依据 [5](https://clipping.net/docs/clippers/teams)；审核状态依据 [12](https://clipping.net/docs/clippers/clips)；外部服务边界依据 [9](https://clipping.net/policies/terms-of-service)。这是从分散说明整理的责任图，不是已验证的后台权限表。（C07）

**全托管与客户权限可以同时存在。** 品牌页明确无自助配置，企业页又允许员工发起与审阅；2026-01-08 发布公告则把品牌动作叫作 Request Campaign／Request Bounty。合理解释可能是客户发起需求、团队承接，或不同客户层级享有不同权限；公开资料不能选定哪一种。不能据此推导“品牌从不操作”或“所有品牌都可独立上线”。[1](https://clipping.net/brands)[2](https://clipping.net/enterprise)[13](https://clipping.net/blog/welcome-to-clipping-bot)（C08）

## 三、准入、账号与内容资格

### 人与账号的门槛

Clipper 条款要求年满 18 岁且达到所在地成年年龄，合法居住于其运营地区；禁止换 Discord 身份开多个 Clipper 账号。允许绑定多个社交账号，但活动可另设每平台数量限制。条款举英语受众活动需至少一半受众来自英语国家；这不是马来西亚受众规则，也不是后台国家识别算法。[14](https://clipping.net/policies/clipper-terms-and-conditions) §1–4（C09）

Accounts 文档描述五位代码验证资料页所有权，至少一个账号 Verified 才可投稿；删除绑定保留既有收益，阻止该账号的新稿追踪，可重新加入。**不应把“既有收益保留”扩大成旧稿必定继续采集或一定付款。** 同时，AUP 描述社交平台 OAuth，Clipper 条款写 Discord OAuth；两者与代码验证的关系未说明。OAuth 是第三方授权协议，知道登录方式并不证明可以读取受众地域或所有分析指标。[11](https://clipping.net/docs/clippers/accounts)[4](https://clipping.net/policies/acceptable-use-policy)[14](https://clipping.net/policies/clipper-terms-and-conditions)（C10）

普通活动第一次投稿即加入；私有活动在批准前隐藏完整规则及投稿入口。首页“无需申请”因此只适合概括一般入口，不能覆盖所有活动。没有公开证据确认 Malaysia 创作者、马来西亚品牌、MYR 或本地银行付款均受支持。[15](https://clipping.net/docs/clippers/campaigns)[16](https://clipping.net/)[14](https://clipping.net/policies/clipper-terms-and-conditions)（C11）

### 内容、权利与投稿阻断

| 问题 | 官方公开边界 | 必须保留的未知 |
|---|---|---|
| 发什么内容 | 活动详情定义品牌、最低播放、时长、声音、账号和受众条件 | 无统一最短秒数、字幕语言或必备话题标签规则可套用所有活动 |
| 如何投稿 | 自己先公开发帖，再提交 URL；平台检测来源平台和账号 | 不证明自动发布、上传原片托管或各平台 API 已获批准 |
| 重复与过期 | 对重复 URL、账号错配、age cutoff、缺声给出错误 | 短链归一化、跨活动／跨账号重复、轻微改剪相似度、具体截止时间 |
| 普通与赏金 | 同一稿二选一；纯赏金活动要求标签，赏金进度另计 | 是否允许后改标签、多个赏金同时满足、赏金门槛与普通门槛如何合并 |

以上为 Submit 文档说明，未测试真实错误或按钮。（C04、C12，[7](https://clipping.net/docs/clippers/campaign-detail)）

一般条款要求提交者拥有或获得内容权利；保留创作者所有权，授予平台处理许可。AUP 另外要求版权许可、广告披露、内容真实、隐私和平台规范合规。其 FTC／COPPA 引用是美国监管框架，不构成 Wringy 的马来西亚适用性判断。[9](https://clipping.net/policies/terms-of-service)[4](https://clipping.net/policies/acceptable-use-policy)（C13）

**授权链缺口：** 品牌交出素材，并不能单凭营销页证明音乐、肖像、商标、活动后保留、跨平台分发、二次投放和品牌再利用都已获授权。未找到公开的品牌素材担保、权利转授范围、侵权通知与反通知时限、授权撤销后奖励处理规则。对 Wringy，先明确每个用途由谁授权，再谈可用的奖励形式；例如把餐厅宣传片里的商业音乐剪到另一平台，所需授权不能由“品牌给了视频”一句带过。

## 四、播放门槛、计量与所有关键时间

### 奖励的计算单位

Welcome 描述固定观看费率与按观看份额分奖池；常见单帖门槛 1,000、个人在活动内合计门槛通常 25,000，但以该活动规则为准。YouTube 使用其称为 engaged views 的指标，官方解释与观看时长相关，可能低于公开原始播放数。[6](https://clipping.net/docs/clippers/introduction)（C14）

审计计算示例：若约定每 100,000 次奖励 RM40，且有 250,000 次已确认可付观看，则封顶、佣金和手续费前为 RM100。这里币种与数字是解释 Wringy 决策的假设，不是竞品报价。CPM 表示每千次观看成本；每 100,000 次 RM40 等于每千次 RM0.40。不能把奖励率或队长佣金当成平台收费比例。（C15，纯算术）

门槛是“达标后哪些观看进入计算”的规则，不等于一律只付超出门槛的部分。未明确的边界包括：恰好 25,000 是否视为达标、不同周期累计能否结转、被禁稿是否影响分奖池分母、移除后份额是否重新分配、零合格参与者如何处理。当前文档给出结构，不能推导所有舍入与合并算法。[3](https://clipping.net/docs/clippers/payments)[6](https://clipping.net/docs/clippers/introduction)[7](https://clipping.net/docs/clippers/campaign-detail)（C16，缺口）

### 时间轴不能压缩成一个“截止日期”

| 时间点／条件 | 文档能支持什么 | 没有公开答案的边界 |
|---|---|---|
| 账号注册／团队归属 | 推荐链接打开后 7 天内注册会自动归入团队 | 跨设备归因、重复链接优先权、过期瞬间处理 |
| 外部发帖时间 | 先发后交；提交可能受 age cutoff 限制 | 使用平台创建时间还是抓取时间；修改后重发是否重置 |
| 提交时间 | 提交后开始追踪 | 首次读数含不含提交前已有观看；不等于“提交前播放全部不付” |
| 指标采样时间 | Welcome 写每 12 小时刷新 | 调度时区、最大延迟、失败补采、数据回落与重复采样处理 |
| 活动结束 | 有固定期限或预算耗尽两类 | 已收稿是否继续计算尾部增长、暂停是否延长、预算补充是否重开 |
| 周期关闭 | 由赞助方决定，无固定期限 | 不能从页面“还剩几天”推定付款日；新旧周期的稿件归属未知 |
| 付款资料取值 | 使用周期关闭时在册资料 | 关闭后、发送前修正能否生效；资料快照是否可见 |
| 审核与批准 | 金额需工作人员和赞助方批准 | 审核、批准、实际发送与到账之间各无明确最长时限 |
| 内容保留 | 帖子须保持公开直至收款 | 平台误删、临时限制、恢复公开能否补救；到账后授权保留期限另不明 |

团队时间据 [5](https://clipping.net/docs/clippers/teams)；投稿时间据 [7](https://clipping.net/docs/clippers/campaign-detail)；采样据 [6](https://clipping.net/docs/clippers/introduction)；活动结束据 [15](https://clipping.net/docs/clippers/campaigns)；周期与资料快照据 [14](https://clipping.net/policies/clipper-terms-and-conditions) §5；审批与公开保留据 [3](https://clipping.net/docs/clippers/payments)。表内后一列是审计问题，不是对后台行为的断言。（C17）

Dashboard 的 Past 还可能包含“活动仍在运行，但个人本周期未投稿”的活动。因此过去活动、活动已结束、周期结束、已付款不是同一个概念。[17](https://clipping.net/docs/clippers/dashboard-home)（C18）

## 五、预算、封顶与定价

活动营销页明确按每 100,000 次观看定价，声称总支出有硬上限，爆款也不会让客户超过预算，并写可随时取消。Campaigns 文档显示 Active、Paused、Cap Reached 等状态。**可核实的是承诺和状态名称，不能核实封顶算法。**[8](https://clipping.net/campaigns)[15](https://clipping.net/docs/clippers/campaigns)（C19）

至少需要分别讨论活动总预算、单稿观看上限、赏金上限和个人收益上限。条款提到 view ceiling 与赏金特殊上限，但没有证明这四种上限都有可配置字段，或给出它们的计算先后。平台是否预留预算、按什么时间排序、各平台币种如何合并、普通奖与赏金是否共用余额，仍未知。[14](https://clipping.net/policies/clipper-terms-and-conditions) §5（C20）

**例子：** 假设剩余 RM100，两条稿在一次延迟采样中分别新增 RM80 的奖励。若品牌绝不超支，两人不可能都获得完整的 RM80，除非有人补足 RM60。需要选择按时间先后、比例分摊、平台承担等明确方案。Clipping 的公开“硬上限”不能告诉 Wringy 采用哪种方案，也不证明创作者已经预见减款。

品牌页展示 $45／100k、$25,000 预算、$0.41 平均 CPM 等数值；没有明确这些数值分别含哪些管理费、处理费、奖励或税。Enterprise 仅说明按量定制价格。由它们不能计算平台毛利或推定 15% 抽成。[1](https://clipping.net/brands)[2](https://clipping.net/enterprise)（C21）

同一营销示意还列出 13.1M verified views 与 $16,200 budget used。若假设期间和计费基数完全相同，算术为 13,100,000 ÷ 1,000 × $0.41＝$5,371，而非 $16,200；但页面没有建立这一相同口径前提。故这些数字应作为营销示意处理，不能据此证明真实账目不一致，更不能推断欺诈。品牌 FAQ 的预算／观看费率／封顶解释也不等于完整管理费表。页面的 live 与每日更新应分别理解为界面宣传与指标刷新说法，后台频率仍未实测。[1](https://clipping.net/brands)（C38）

直接访问候选 `/pricing` 未取得正文，检索也没有取得独立完整费表；这不能证明收费表不存在。主任务随后直接读取官方合作申请页第 108–137 行，确认最低预算为 $5,000。证据现已由搜索摘要升级为主任务直接公开页面观察，但其适用范围仅为合作申请入口，不能推出所有品牌合同、全部活动或最终收费的统一下限。[10](https://clipping.net/contact?type=partnership)（C06、C22）

公开表单还要求姓名、企业邮箱、推广对象、相关链接、素材类型、时间安排和预算，并明确企业邮箱不接受 Gmail／Yahoo。它可作为品牌需求收集的公开证据；不证明提交后自动开户、活动自动批准、资金已经入账或品牌私有后台字段。主任务未输入或发送，故服务器是否实际校验这些限制仍未测试。[10](https://clipping.net/contact?type=partnership)（C39）

## 六、审核、反作弊与申诉

### 可公开支持的控制与不能推定的能力

Rules 的八项折叠正文现已由主任务逐项展开，本研究工作者已读取其脱敏记录，补齐了原先仅有标题的缺口。简要规则如下：[18](https://clipping.net/docs/clippers/rules)（C23）

- 禁止买播放、机器人粉丝、互刷观看群及自动点赞。
- 受众必须符合活动要求；英语受众活动例子为至少 50% 来自英语国家。
- 错误声音、错误创作者、缺少品牌提及或离题内容会移除。
- 点赞及其他被追踪的互动指标须保持可见。
- 低投入、明显自动化或低质量帖子会移除。
- 每个帖子对应一条剪辑，不得在**同一账号**重发相同内容；这句话不证明跨账号重发一律允许或禁止。
- 帖子须保持公开直到实际收到付款；提前变私密、删除或仅好友可见可能失去资格。
- 工作人员有权移除违规者；该段仍未解释与 AUP 申诉程序的衔接。

这些是公开规则文字，不提供精确 AI 阈值、相似度算法或独立检测准确率。逐项依据见[八项规则展开记录](${WRINGY_WORKSPACE}/phase-0/research/clipping-deep-v2/browser/07-rules-all-eight-expanded-ax.txt)，对应行 61、174、287、400、513、627、740、821；本文未复制完整正文。

Clipper 条款禁止虚增互动、购买粉丝或互动、viewbot、绕过账号限制等，保留封禁、没收及追缴既付奖励权。低质量、自动化或低投入内容可移除；但没有给出通用质量分数、模型置信度或作弊判定阈值。[14](https://clipping.net/policies/clipper-terms-and-conditions) §4、6–7（C24）

品牌页声称每稿扫描、AI 检测、异常峰值标记及人工检查；这是供应商自述。没有独立混淆矩阵、测试样本、准确率、误报率、召回率、地区覆盖或真实付款审计。也未证明 AI 检测直接决定拒付、由何模型执行、工作人员必须复核每次封禁，或可从公开播放读数识别每名观众身份。[1](https://clipping.net/brands)（C25）

**分析：** 一条本地餐厅视频被大账号转发后突然爆红，曲线可能与买量都表现为快速上涨。峰值足以触发调查，却不足以单独证明作弊。Wringy 不能把“不规则曲线”包装成“AI 已确认假流量”，也不能从“英语观众”推导“马来西亚真实潜在顾客”。这不是竞品检测失败的实证，而是指标含义的边界。

### 审核状态与付款状态

Clips 文档把 Tracking／Stopped／Banned 作为主状态；Paid／Bounty 是可叠加标签。Stopped 可能来自周期结束或不再满足规则，Banned 表示被审核人员移出活动。文档把 Tracking 简写为进入下一次付款，但 Payments 仍要求最终审批；不能把追踪中当成无条件应付债权，也不能把 Paid 标签当作到账银行凭证。[12](https://clipping.net/docs/clippers/clips)[3](https://clipping.net/docs/clippers/payments)（C26）

未见公开承诺提供逐稿证据包、审核理由代码、复核人、检测时间、采样来源或历史金额变更记录。没有证据说明“全部人工审稿”“AI 自动通过后免复核”或“固定 24 小时审核”。（C27，范围限定缺口）

### 申诉有期限，但程序衔接不明

AUP §5 适用于创作者、客户与管理员，描述警告、内容移除、暂时停权、永久终止等处理，并允许处罚后 **30 天内**提交附有证据的申诉。举报材料包括日期、用户名、链接及截图；提供通用联络邮箱。但未给出专门的申诉表单、回执时间、裁决最长时限、独立复核者或胜诉后返款程序。[4](https://clipping.net/policies/acceptable-use-policy)（C01）

与 Clipper 条款“工作人员决定为最终决定”的关系需要澄清：可能指复核后的最终决定，也可能存在政策文字未同步。较新条款并未在所读内容里明确废止 AUP 申诉段落，不能靠日期就判定申诉已被取消。30 天是申请窗口，绝不是保证 30 天内结案；隐私政策的数据请求 30 天时限也不能移用到付款争议。[14](https://clipping.net/policies/clipper-terms-and-conditions)[4](https://clipping.net/policies/acceptable-use-policy)[19](https://clipping.net/policies/privacy-policy)（C28）

## 七、结算、失败、退款与追缴

Clipper 条款规定赞助方关闭付款周期，再经审查与付款表批准批量处理；没有固定关周期时间、提款按钮或按需提前领取机制。显示收益是估计，最终金额可能经复核、上限或赞助方调整。首页的 Cash out 与自动到账文案不能代替这套条件。[14](https://clipping.net/policies/clipper-terms-and-conditions) §5、[16](https://clipping.net/)（C29）

Payments 文档当前允许新增 PayPal、Ethereum 主网 USDC／USDT，每活动固定一种；其他旧方式保留为历史兼容。账表区分普通、赏金、总额、门槛与 estimated／pending／paid，团队行还显示毛额、队长佣金和净额。发送到已失去访问权的有效旧账户不能补发；链上付款不可逆。[3](https://clipping.net/docs/clippers/payments)（C30）

| 情形 | 已知边界 | 未公开或未验证的补救机制 |
|---|---|---|
| 缺少付款资料 | 投稿资格可能阻断 | 关周期时缺资料是否延后、作废或保留到下轮 |
| 有效旧 PayPal／遗失钱包 | 文档称不能重发 | 平台自身录错或非用户过失如何认定 |
| 错链、错地址 | 只支持 Ethereum 主网，强调不可逆 | 地址格式、链检测、验证转账是否存在 |
| PayPal 拒收／退回／冻结 | 所读文档无专门失败规则 | 重试次数、费用、重发资格、申领超时 |
| 部分批量付款失败 | 条款说同批支付 | 成功与失败成员是否单独重跑；防重复付款如何实现 |
| 支付服务超时、回调丢失 | 一般条款承认外部服务可能失败 | 谁对账、何时更正界面、如何证明最终到账 |
| 赞助方拖延或拒绝批准 | 批准是付款前置条件 | 平台是否垫付、争议仲裁、最长拖延期限 |
| 付款前帖子被删／变私密 | 可失去资格，包括活动结束以后 | 恢复公开能否恢复收益；非自愿下架例外 |
| 付款后发现作弊 | 条款保留追回权 | 追回对象、通知时限、证据、扣回顺序、队长佣金是否回冲 |
| 品牌取消或余额未花完 | 营销写可取消 | 退还剩余资金、服务费不退范围、已赚未付优先级和退款到账时限 |

付款资料与公开保留据 [3](https://clipping.net/docs/clippers/payments)[7](https://clipping.net/docs/clippers/campaign-detail)；周期和追缴据 [14](https://clipping.net/policies/clipper-terms-and-conditions)；外部服务据 [9](https://clipping.net/policies/terms-of-service)；取消据 [8](https://clipping.net/campaigns)。这些缺口均未通过实际失败测试确认。（C31）

**费用与税：** Clipper 条款写支付处理费可能适用、税务由收款者负责。主页的 PayPal “no fees”未解释是免平台费还是免所有处理费，更不能覆盖队长抽成。汇兑、跨境费、链上费承担者、金额舍入、负余额及税务资料要求未形成可复核的统一规则。[14](https://clipping.net/policies/clipper-terms-and-conditions)[16](https://clipping.net/)[5](https://clipping.net/docs/clippers/teams)（C32）

**退款不是创作者提款，也不是反作弊追回。** 一般条款仅要求用户了解退款与取消政策；本轮未在所读政策、品牌／企业页及定向检索取得可执行的品牌退款明细。不能写“绝不退款”“未使用预算全退”或“Clipping 保管资金于托管账户”。这里“托管账户”指资金由独立安排保管，不是品牌页所说的全托管运营。[9](https://clipping.net/policies/terms-of-service)（C33）

## 八、团队佣金与数据责任

Teams 是可选机制：队长率限定 5%–10%，默认 5%，后续周期生效；成员页面不显示费率，文档建议向队长询问或付款后查看毛额、扣佣和净额。推荐链接在打开后 7 天内注册自动归队；当前页面没有退出或移除成员按钮，变更需支持或队长协调。[5](https://clipping.net/docs/clippers/teams)（C02）

这为 Wringy 提出两类待决事项：一是佣金同意是否在加入前可见，二是退出后哪些周期仍扣佣。例如用户在周四点击招募链接、周日注册，可能并未主动点击“加入团队”，却进入带佣金的关系；若要采用类似招募机制，应先明确用户知情与退出安排。不能由队长能改佣金推出其能审核作品或批准付款。

隐私政策声称收集内容元数据、播放／互动／受众数据、设备安全信息及支付资料，也声称权限控制、加密和审计。DPA 将 Clipping 称为处理者、用户称为控制者，包含 72 小时安全事件通知及 30 天数据权利请求回应等承诺。它们不是独立认证、实测时限或马来西亚数据合规意见。[19](https://clipping.net/policies/privacy-policy)[20](https://clipping.net/policies/data-processing-agreement)（C34）

公开政策未明确列出本次可核实的全部子处理商、各类数据保存天数、品牌／队长可见付款资料范围、风控证据留存期限、账号删除与未付款记录的冲突解决。Settings 文档能补证资料、简介和活动历史，但没有足够证据确认完整注销／删除流程；隐私权利存在不等于已验证自助删除按钮。[19](https://clipping.net/policies/privacy-policy)[20](https://clipping.net/policies/data-processing-agreement)[21](https://clipping.net/docs/clippers/settings)（C35）

## 九、带日期的不一致与解释限度

以下不一致均在 **2026-09-13** 查见。除写明的发布日期外，不能推定另一页面更旧或更新。

| 主题 | 两边的说法 | 适当结论 |
|---|---|---|
| 申诉 | AUP 2026-01-01：30 天窗口；Clipper Terms 2026-05-27：工作人员最终决定 | 存在解释张力，不能删除申诉，也不能保证翻案 |
| 播放更新 | 无日期 Welcome：12 小时；无日期企业／品牌页：每日、实时；一般条款 2026-01-01：每日 | 可能是显示与采样不同层次；实时性未验证 |
| 奖励门槛 | 2026-02-14 收益博客写默认 100k、标准 50k，并用单稿例子；当前文档写单稿 1k／合计通常 25k | 文档与活动实际规则优先用于产品描述，不能设一个全站默认值 |
| 团队费率 | 同一收益博客：0%–10%；无日期 Teams：5%–10% | 不能支持当前可设 0%；更新时间和实际校验待验证 |
| 支付选项 | 2026-01-08 公告、2026-02-14 博客及 2026-05-27 条款列更多方式；Payments 只允许新增三种 | Payments 明确解释历史兼容，但不能断言旧方式仍可付款 |
| 登录和账号授权 | AUP：各社交平台 OAuth；Clipper Terms：Discord OAuth；Accounts：资料代码 | 可能混写登录、所有权与数据授权；不证明各平台完整授权 |
| 开放准入 | 首页无需申请、点击加入；Campaigns 首次投稿加入且有私有准入 | 营销省略条件，不代表私有活动已开放 |
| 全托管 | 品牌页无自助；Enterprise 席位可启动／审核；公告写需求申请 | 权限或客户层级差异尚无证据 |
| 赏金 | 活动营销／旧博客描述额外奖励；Submit 明确单稿普通与赏金二选一 | 不把“额外”解读成同稿双重计费 |
| 付款条件 | Welcome 开头说无须等待批准，同页后文与 Payments 仍有审核；Payments 描述活动结束，条款区分付款周期 | 不能承诺发布即赚、活动倒计时结束即到款 |
| 费用 | 首页无手续费；条款处理费可能适用；Teams 扣佣 | 不同费项可能同时成立，净到手规则待说明 |

各行分别对应 C28、C03、C36、C37、C30、C10、C11、C08、C12、C29、C32；来源见 [1](https://clipping.net/brands)–[7](https://clipping.net/docs/clippers/campaign-detail)、[13](https://clipping.net/blog/welcome-to-clipping-bot)–[16](https://clipping.net/)、[22](https://clipping.net/blog/how-much-do-clippers-make)。这是文字比对，不是声称发现后台漏洞。

## 十、对 Wringy Malaysia beta 的研究输入

建议先把以下问题写成可选择的业务规则，再决定界面和开发范围。**建议尚未批准，不等于 Clipping 已有这些机制。** 以小范围真实活动验证可减少猜测；例如一间餐厅、一个允许发布的平台、一份明确素材授权、一套固定的计量与结算规则，比同时复制四个平台和多个奖励模型更容易看清履约成本。这是基于上述公开缺口的范围建议，不是已证明可在某预算内交付的报价。

| 需要决定的问题 | 为什么影响首轮真实交易 | 最少需要补什么证据 |
|---|---|---|
| 品牌买什么“合格观看” | 全球播放数不能替代马来西亚目标客群 | 实際可取得的指标字段、平台权限与误差样本 |
| 谁为素材权利签字 | 投诉下架会同时影响内容和奖励 | 品牌素材许可、创作者再加工／发布范围 |
| 谁可以参加 | 年龄、地域、账号和支付可用性不同 | Malaysia 服务资格、收付款准入与验证方式 |
| 达标和计价如何组合 | 单稿与累计门槛混淆直接产生争议 | 两三份边界算例，包括未达标和恰好达标 |
| 哪个时间点决定计费 | 延迟提交、采集延迟、周期切换会改金额 | 发布／提交／采样／截账时间定义及时区 |
| 最后一点预算怎么分 | 支出封顶与创作者估算可发生冲突 | 同时越界、迟到指标、删除后释放预算的算例 |
| 品牌何时必须批准 | 无期限的批准权让创作者无法预期收款 | 审核、反对、补证和付款最长期限 |
| 失败的钱如何重发 | 失败不能被标成成功，也不能重复付款 | 支付服务状态、回执、对账与人工处理流程 |
| 误判怎么纠正 | 扣款与封禁需要证据和责任人 | 通知内容、申诉期限、复核者、改判后的补发 |
| 取消后先付谁 | 未用预算、已赚未付和服务费不同 | 品牌合同退款公式与创作者奖励优先级 |
| 是否需要队长 | 佣金增加同意、归属与退出复杂度 | 真实招募价值和创作者对扣佣的接受程度 |
| 什么需要保留和删除 | 对账、申诉和隐私请求可能冲突 | 必要资料清单、保存期限、各角色可见范围 |

本轮没有证明 Wringy 已具备自动采集、完整反作弊、本地支付或上述责任制度；也没有得出“复制此产品即可在 RM50,000 内交付”的结论。马来西亚法律、支付服务准入和真实品牌合同应独立研究，不可把美国式政策文字直接迁入。

## 十一、未解决问题与后续验证边界

**公开材料仍缺的关键答案：** 国家服务清单；品牌收费全表；预付／后付及资金持有人；活动编辑和规则版本锁定；预算分配顺序；每帖／每人／每周期的上限组合；跨周期观看与收益结转；采集故障补数；内容授权再利用范围；AI 输入和误判统计；审批时限；付款失败重试；退款和追缴争议；团队离开后的佣金处理；数据留存与权限细分。（U01–U16，详见 sources.json）

认证界面可以补证实际按钮、字段、解释文字和当前状态，但不能单靠界面证明风控准确率、托管资金、跨租户隔离或支付重试可靠性。真实付款证据、平台数据权限、服务合同和事件记录属于另一种验证。继续认证探索由主任务处理；本文不改变其授权范围。

主任务另报告认证门槛后的侧栏可见 Teams 等入口；这不是本轮公开研究的独立实测，也不能证明该账号能进入团队功能或拥有品牌／管理员权限。Teams 与 Settings 的本报告结论仅以公开文档为依据。本轮已读取主任务保存的品牌页及展开 FAQ 文本记录，作为公开页面的补充证据；未操作其浏览器，也未把未查看的 PNG 截图写成亲自验证。

本地补充证据：[品牌示意文字](${WRINGY_WORKSPACE}/phase-0/research/clipping-deep-v2/browser/02-brands-public-ax.txt:30)、[费用 FAQ 展开记录](${WRINGY_WORKSPACE}/phase-0/research/clipping-deep-v2/browser/05-brands-cost-faq-ax.txt)、[核验 FAQ 展开记录](${WRINGY_WORKSPACE}/phase-0/research/clipping-deep-v2/browser/06-brands-verification-faq-ax.txt)。它们支持 C38 的文字核对，不证明实际客户财务或反作弊准确率。

**本轮可交付的确定性：** 原报告的申诉缺口已经找到官方补充；团队佣金、12 小时采样说明、付款资料取值时点、支付历史兼容、品牌取消文案及多份政策之间的不一致均已建立可追溯引用。后台执行和商业条款完整性继续保留未知。

## 来源与版本

以下来源统一访问于 2026-09-13；发布者为 CLIPPING／Clipping.net。没有标注日期的页面记为“无公开日期”，不把搜索引擎相对时间当发布日期。机器可读索引、精确 URL、证据等级、段落位置与论点映射见同目录 sources.json。

1. [For Brands](https://clipping.net/brands)，无公开日期；官方营销。
2. [Enterprise](https://clipping.net/enterprise)，无公开日期；官方营销。
3. [Payments](https://clipping.net/docs/clippers/payments)，无公开日期；官方文档。
4. [Acceptable Use Policy](https://clipping.net/policies/acceptable-use-policy)，更新 2026-01-01；官方政策。
5. [Teams](https://clipping.net/docs/clippers/teams)，无公开日期；官方文档。
6. [Welcome](https://clipping.net/docs/clippers/introduction)，无公开日期；官方文档。
7. [Submit](https://clipping.net/docs/clippers/campaign-detail)，无公开日期；官方文档。
8. [Run a Clipping Campaign](https://clipping.net/campaigns)，无公开日期；官方营销。
9. [Terms of Service](https://clipping.net/policies/terms-of-service)，更新 2026-01-01；官方条款。
10. [Partnership contact entry](https://clipping.net/contact?type=partnership)，无公开日期；主任务于 2026-09-13 直接读取第 108–137 行，提供最低预算与表单字段观察；未输入或发送。本研究工作者未重复打开。
11. [Accounts](https://clipping.net/docs/clippers/accounts)，无公开日期；官方文档。
12. [Clips](https://clipping.net/docs/clippers/clips)，无公开日期；官方文档。
13. [Introducing the CLIPPING Web Dashboard](https://clipping.net/blog/welcome-to-clipping-bot)，发布 2026-01-08；官方发布公告。
14. [Clipper Terms & Conditions](https://clipping.net/policies/clipper-terms-and-conditions)，更新 2026-05-27；官方条款。
15. [Campaigns documentation](https://clipping.net/docs/clippers/campaigns)，无公开日期；官方文档。
16. [Clipping homepage](https://clipping.net/)，无公开日期；官方营销。
17. [Dashboard](https://clipping.net/docs/clippers/dashboard-home)，无公开日期；官方文档。
18. [Rules](https://clipping.net/docs/clippers/rules)，无公开日期；官方文档，主任务逐项展开全部八项，研究工作者读取脱敏保存记录，正文缺口已补齐。
19. [Privacy Policy](https://clipping.net/policies/privacy-policy)，更新 2026-01-01；官方政策。
20. [Data Processing Agreement](https://clipping.net/policies/data-processing-agreement)，更新 2026-01-01；官方协议。
21. [Settings](https://clipping.net/docs/clippers/settings)，无公开日期；官方文档。
22. [How Much Do Clippers Make?](https://clipping.net/blog/how-much-do-clippers-make)，发布 2026-02-14；官方博客，用于识别旧口径。
23. [Get Paid to Clip](https://clipping.net/clip)，无公开日期；官方营销，计算器明确只是估计，不是收益保证。
24. [Documentation home](https://clipping.net/docs)，无公开日期；文档导航来源。
25. [Getting Started for Clippers](https://clipping.net/docs/clippers/getting-started)，无公开日期；官方文档，复核注册／外部发布／审核顺序。
26. [Quick Start](https://clipping.net/docs/getting-started)，无公开日期；入口补查，未从该页提取新的机制结论。

独立定价页候选 `https://clipping.net/pricing` 未取得正文；Welcome 的 Previous Analytics 链接访问失败。它们记录为访问缺口，不是肯定证据。检索范围和失败记录在 sources.json 中保留。

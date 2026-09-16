# Clipping新账号登录实测补充

日期：2026-09-14。观察与操作：主审；本文件依据保存的界面证据及主审完整观察转录整理。**已完成新账号可见范围的入门和页面探索，未完成投稿、审核、申诉或真实付款测试。**

本补充独立于[2026-09-13综合报告](../report.md)及[17页PDF](../output/Wringy-Clipping-Deep-Research.pdf)；两份历史文件未改，PDF不包含本次实测。用户在此前条款问题说明后，于操作当时明确批准入门及相关条款接受。主审随后完成入门；此前“未接受条款、停在入门首屏”已不是当前状态。这不构成对平台条款适用性或研究方法合法性的判断，也不扩大为私有接口或后台探测授权。

## 1. 证据如何阅读

08–26包括界面文字及部分截图；**13、17、19、21、25、26的文字是差异或无变化提示，不是完整页面快照**。其完整事实使用[28号主审观察转录](28-main-walkthrough-observations.md)，不从缺失文字反推。活动外链规则由[27号直接阅读记录](27-campaign-brief-observation.md)补足。截图仅链接必要的非私密视图，本补充不复制账号姓名、邮箱、头像或付款资料。

欢迎导览包含示例用户、收入、活动数量、费率及支付方式宣传。它们不是当前账户数据，也不是独立验证的运营统计。尤其不能以导览中的211活动、77.6K创作者、357.1B观看或Zelle文案替代当前目录和添加收款界面的观察。

## 2. 实际入门路径

**简介留空并Continue → 社交账号步骤（查看Add后Skip）→ 收款步骤（查看后不填写）→ Complete Setup → 四步欢迎导览 → Dashboard。**

|步骤|实际观察与结果|证据|
|---|---|---|
|个人简介|留空仍能Continue；这次账号无需先补简介。用户名及Discord来源的旧观察不等于可修改验证|[完整操作转录](28-main-walkthrough-observations.md)|
|社交账号|Add弹窗列YouTube、Instagram、TikTok、X；输入用户名或链接，提示提交后生成验证码。未提交，因此未观察实际验证过程；Skip成功|[08](08-social-onboarding.txt)、[09](09-add-social-dialog.txt)、[弹窗截图](09-add-social-dialog.png)|
|收款设置|页面明确可稍后设置；未添加任何方式仍能完成入门|[10](10-payment-onboarding.txt)|
|PayPal弹窗|要求PayPal Email、First Name、Last Name；空字段时Add method禁用|[11](11-payment-paypal-fields.txt)|
|加密货币选项|实际添加界面仅列PayPal、USDT (ETH)、USDC (ETH)；已查看USDT的Ethereum地址字段，未填写；未检查USDC字段细节|[12](12-payment-usdt-fields.txt)|
|欢迎导览|Welcome、Campaigns、Accounts、Earnings四步后Get Started进入主页；内容为引导及营销示例|[13截图](13-welcome-tour.png)、[14](14-tour-campaigns.png)、[15](15-tour-accounts.png)、[16](16-tour-earnings.png)、[28](28-main-walkthrough-observations.md)|

入门完成不等于具备投稿资格；“账号已建立”“社交身份已验证”“该活动收款条件已满足”是不同状态。

## 3. 从活动目录到投稿门槛

[活动目录](18-campaign-directory.txt)显示“76 campaigns available”，同时包含Active、Paused和Private，**不能称76个正在运行的活动**。卡片有每100K费率、平台、剩余时间、最低观看门槛；Private的Apply for Access指向Discord。未申请访问，也没有验证全部活动可参与。

选取Dr Squatch作为单个可见活动样本。其[详情截图](19-dr-squatch-detail.png)显示ACTIVE、PayPal、21 days left、每100K $50–$65；日期字符串03/09/2026的地区格式不确定，不转写为确定日期。[28号转录](28-main-walkthrough-observations.md)补充两项active bounty：week1 $50/100K、67 clips、442.8K views、15%预算；week2 $65/100K、15 clips、177.6K views、8%预算。这是当日界面快照，非审计业绩，未证明观看均合格或对应款项已付，也不是Wringy定价依据。

活动内可见Current cycle (live)的Estimated payout $0、Pending review无周期、Paid标签及Your Clips 0。点击Upload new clip后，实际出现[Setup required门槛](20-submission-setup-gate.txt)：

- **需要PayPal收款方式**。
- **需要至少一个已关联并验证的YouTube、Instagram或TikTok账号**。

两个条件同时列出，并分别提供设置链接。未满足门槛，因此真正投稿表单、字段校验、提交成功和后续审核都没有测试。全局Add social支持X，不代表这个活动接受X；全局可加USDT/USDC，也不代表这个活动接受它们。

## 4. 活动简报补充了通用规则

活动Requirements链接打开[公开可凭链接阅读的Google文档](https://docs.google.com/document/d/1e7gLjSnjeuNJcOzB7m3mPQ0k3QJVS-PXfH2ZacBELzU/edit)，主审只读并关闭临时标签，未编辑。以下为[27号记录](27-campaign-brief-observation.md)的简述，不复制原文全文：

- TikTok、Instagram、YouTube Shorts；片长15–90秒；week1/week2有素材来源文件夹并链接同一份简报。
- 要求原创剪辑，不能懒惰转载或低质量处理；不允许collab posting。
- 内容至少在线90天；标记品牌和出镜创作者为可选，未标记不能据此拒绝。

**90天是本活动要求，不是全平台规则。** 它比通用“付款前保持公开”更严格；不能因已经付款就推断本活动内容可删除，也不能把“未标记品牌”自动拒绝。规则需要逐层阅读，出现冲突或歧义应要求解释，不能臆造平台的内部优先级算法。

## 5. 新账号各模块的可见状态

|模块|观察|仍未测试|
|---|---|---|
|Dashboard|Your active campaigns为空，有Join a new campaign入口|参与后的主页和统计更新|
|Clips|Total clips、Total views、Engagement均为0；All Clips 0、No Accounts Linked|真实投稿状态、编辑撤回、异常与审核|
|Payments|Est. payout $0为当前周期估计；Pending estimates与Payout history分开，均无记录；没有收款方式|确认奖励、支付失败、到账及对账|
|Teams|没有团队；创建弹窗佣金默认5%，范围5–10%，按成员base payout计算；只看弹窗后取消|团队创建、邀请、实际佣金扣取或发放|
|Accounts|没有已关联账号，可添加社交账号|所有权验证、失效、重连及数据授权|
|Settings|此账号状态Active、Discord OAuth；display name与bio空白；Public profile关闭，说明仅自己可见|公开后的展示与权限、其他角色或账号默认值|

证据：[22付款文字](22-payments-empty.txt)、[22截图](22-payments-empty.png)、[23团队](23-teams-empty.txt)、[24创建弹窗](24-create-team-dialog.txt)、[28完整观察转录](28-main-walkthrough-observations.md)。[17](17-dashboard-empty.txt)、[21](21-clips-empty.txt)、[25](25-accounts-empty.txt)、[26](26-settings.txt)保留为有限差异证据。

观察到的入门与Settings没有语言选择器；不能据此断言整个应用不支持其他语言。账户为空也不能说明该平台没有相应功能。

## 6. 对Wringy的具体建议（全部为待决提案）

|业务问题|Wringy建议|在PRD定案前需要验证|
|马来西亚用户理解规则|入门提供EN／BM／ZH语言偏好，可稍后修改；规则、拒绝原因和奖励状态使用一致译文|用户偏好、维护成本、三语规则出现歧义时的处理方式|
|先看机会还是先交资料|允许先浏览活动、稍后绑定社交账号和收款资料；点击投稿时一次列明该活动缺少的条件|商家接受的来源平台、可验证账号方式及实际付款可行性|
|全局能力与活动资格不同|按活动显示支持平台、收款方式和最低门槛；不能因为账号已绑定就视为全部活动可投|每种条件的证据、失败提示、人工协助与重新验证路径|
|活动规则层级及版本|保存通用规则、活动简报、周期规则的版本和生效时间；投稿关联当时版本；明确保留时长、标记是否必需及例外；变更提示受影响创作者|冲突如何裁定、旧投稿适用版本、商家修改权限、申诉依据|
|估计收入不等于已付款|区分观看估计、内容合规、计量有效性、奖励确认及付款完成；显示周期与更新时间，保留审核及支付凭据|谁批准奖励、谁付款、对账来源、结果未知时如何暂停重复支付|
|以低成本开始|首版可人工协助处理资格与规则问题；先验证真实数据和付款，再承诺自动化|RM50,000研发上限与2–4个月目标下的正式报价、依赖与可交付范围|

例如，创作者可以先用中文查看活动，但投稿前仍须完成该活动需要的账号验证；界面显示RM100估计奖励时，不应同时称其“已赚取并到账”。此例只是Wringy设计建议，不是本次Clipping账号的收益。

## 7. 已完成与尚未覆盖

本次完成条款获当步批准后的入门、新账号导航、一个活动详情及其投稿前门槛、规则外链、支付和团队设置弹窗的观察。**没有添加社交或付款资料，没有创建团队，没有投稿或付款，也没有进入商家或运营审核后台。** 未验证作弊识别、地域精度、实际刷新、审核申诉、预算并发分配、真实到账和失败恢复。

因此，研究状态更新为“公开综合报告已交付；新账号可见登录流程补充已完成；交易及其他角色仍未实测”。这份补充不冻结Wringy PRD、不批准实施、不重算预算，也不把用户对入门条款的确认解释为全部应用测试已经完成。

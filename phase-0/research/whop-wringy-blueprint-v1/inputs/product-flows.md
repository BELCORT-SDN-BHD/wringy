# Whop / Content Rewards 产品流程与 Wringy 建议

核查日：2026-09-11，Asia/Kuala_Lumpur。本文供主报告整合；费用精算归机制研究。编号 P01–P17 对应文末及 `product-sources.json`。**O＝当前公开界面实看，D＝官方文字声明，H＝实际检查的历史截图，I＝分析建议，U＝未知。** O 不代表完成登录后交易，D 不代表功能已实测。

## 结论与边界

新版值得借鉴的是组织归属、活动约定、草稿与成稿分开处理，而非完整复制页面。9月3日政策明确 Whop 内嵌与 CR 网页两种体验共存[P04]。8月19日是本次找到的最新编号发布公告，不能证明线上最新构建号[P01,P16]。品牌导航实际通往首页；`/brands`读取失败，未当成另一个已验证品牌后台。

匿名访问注册入口会回首页邮箱弹窗，品牌启动按钮通往预约演示[P09]；因此“品牌→组织→建活动”仅能作为能力组成，无法声称是实测点击顺序。销售表单问业务、目标和预算，也不等于正式开户必填项[P10]。未注册、登录、加入活动、连接账号、付款或发消息。

两张 Mobbin 图像仅用于旧内嵌参照[P11–P12]；另实看两张当前网页截图，共四张。旧屏幕中的更新时间不是截图采集时间。当前发现页与详情的筛选、外链和客服入口有现场依据，但受众截图等旧投稿字段不能照搬为新版字段。

## 两端旅程与证据粒度矩阵

以下顺序为业务关系整理；只有 O/H 行中的可见字段经过界面核查。D 行字段来自文档，不保证标签、布局、顺序或强制性。

|步骤／角色|对象与字段|状态／下一步|例外与粒度|
|---|---|---|---|
|1 品牌接洽／创作者进入|演示表单：角色、姓名/邮箱/电话、公司/网站、目标、月预算；注册仅邮箱弹窗|接洽或登录入口；角色开户步骤U|O文本[P09–P10]；不能称自助建活动已走通|
|2 品牌／代理商归属|组织→客户品牌→活动；Owner/Admin/Moderator/Member|客户范围隔离；末位Owner不可移除|D[P03,P05]；真实邀请、切换、任命权限U|
|3 品牌配置|内容类别、创作者要求、文件素材、申请名额/截止、预审、预约发布|可存草稿；申请超时可拒绝|D[P01]；申请状态标签、完整创建向导U|
|4 创作者发现|All/UGC/Clipping；搜索；预算档；三种计酬筛选；最高剩余预算等排序|打开预览或加入入口|O[P07]；推荐排序算法U；私密活动不公开为D[P05]|
|5 阅读并参与|详情有平台费率/上下限、预算进度、素材链接；开放加入或先申请|进入活动或等待申请决定|O详情[P08]＋D分支[P02]；样本加入指向Whop，不证明新版申请表|
|6 获取素材／约定|站内Requirements/Description与参考资产|依活动规则制作|D[P05]；站外文件不能替代独立站审核约定；权利须单列|
|7 选发布账号|官方授权或简介验证码；账号种类有限制|连接后核实归属；获准账号用于预审活动|D[P04,P01]；不代发；撤销后停追踪，重连界面U|
|8 条件式草稿预审|原始视频、版本、反馈线程|批准／拒绝／要求修改→新版本|D[P01,P06]；草稿通过不等于成稿付款；文件上限/上传恢复U|
|9 创作者发布／交链接|按活动指定平台发布，提交公开链接|FAQ要求30分钟内提交→人工审稿|D[P02]；H旧表含标题/受众截图/勾选[P12]，新版精确字段U|
|10 品牌审核／平台争议|稿件、适用要求、决定理由；风险案件另行处理|Pending→人工决定；风险申诉另线|D[P05–P06]；暂停不取消已批准稿付款；超时处置有未解口径|
|11 双端看结果|创作者收益明细；品牌按活动/平台/日分析；公开样本观看/投稿图|审稿、收益与外部提款不同状态|D[P01,P03]＋O[P08]；未验证结算到账；旧数值不充当当前收费|
|12 获得帮助|公开组件：人工支持或FAQ；账号/条款通知|拒稿找支持协同品牌；风险申诉交平台|O[P08]＋D[P06]；未发消息，24/7不代表实测响应承诺|

### 旧内嵌创建路径单独保留

当前 Whop 文档仍描述“添加App→填写名称、类型、类别、预算/币种、费率、最低/最高奖励、可选固定奖金、平台、素材和要求→充值→Pending budget转Active”。最低奖励控制进入审核队列；固定奖金叠加观看奖励；外部Google Doc可随时改。全部为**未注明日期的内嵌教程声明**[P13]，不是当前独立站建活动验证，也不是独立按篇模式。

## 关键差异、未知及设计含义

**权利不应藏在素材下载后面。** 当前组织条款区分素材使用许可、批准作品授权及品牌供料作品的归属；未批草稿不能给品牌使用[P05]。这要求 Wringy 将“能审看”和“能拿去投广告”分开定义。Belcort上传参考片不应让创作者误以为可以任意转载；创作者同意修改也不应被界面暗示成无期限商业授权。具体马来西亚合同由合规研究定案，本文不把美国条款当本地答案。

**三个时间问题不能混为一谈。** 申请截止自动拒绝来自公告；成稿人工审核来自当前条款；发帖后交链接是另一时限[P01,P02,P05]。代理商FAQ七日审核窗口与条款持续Pending之间，缺少超时后的确切操作[P03,P05]。帮助组件仅写交链接而省略30分钟，是信息缺项，不是明确推翻[P08]。

**发布控制只约束平台接受投稿。** CR声明不替创作者发帖[P04]。因此公告所谓阻止未审批发布，不能解读成能禁止创作者直接在TikTok发布；较稳妥理解是限制平台投稿资格，实际拦截点U。同样，没有证据支持特定去重算法、版本自动比对算法或推荐权重。

**文档还有两项需保留的冲突。** 公告称仅Owner可任命Admin/Owner，当前组织条款允许Owner/Admin变更角色；不可假定实现已经同步。V2缺投稿/创作者CSV而代理商承诺分析CSV，两者可并存，不足以证明功能补齐[P01,P03,P05]。旧教程外链可改与新版站内要求也有范围区别，不能跨体验直接判定谁覆盖谁[P13,P05]。

通知证据只足以确认公开帮助入口与部分政策通知，无法列完整“申请通过→邮件→推送”的真实事件链。后续若授权账号测试，优先补开户/组织权限、申请转移、草稿版本、账号失联和超时处理。搜索出现的staging帮助页及其他域名未证明是正式当前产品，已排除，避免引入虚构信任分或性能指标。

## Wringy 的12条具体建议（I，待PRD批准）

已采用的方向是 Malaysia first、Creator Rewards先行、长期12模块；Linear＋shadcn设计系统及EN/BM/zh-Hans-MY语言基础按本次创办人指示作为前提。这不证明仓库实现或上游批准文件已验收。本工件是研究输入，不能直接充当开发批准。

|建议|首期可执行流程／验收例子|依据与边界|
|---|---|---|
|W01 让人先选当前工作身份|Belcort选择“为品牌发布任务”；同一人以后可切创作者身份；不必另建登录|借鉴组织归属[P01]；个人与品牌数据边界需PRD|
|W02 单品牌先行、代理商延后|活动明确属于Belcort；审核员看不到另一客户；把审片、改成员、资金操作分权|P05；不照搬有冲突的四角色权限|
|W03 一个活动先选一种购买结果|先在观看量、单条交付中选首发模型；例：十条原创片与十万观看分开说明|P02三模式；建议不同时实现全部周期合同|
|W04 条件做成可回看的约定|参与时保存规则版本；十五秒改三十秒，旧稿仍可找到原约定|P05/P13范围差异启发；竞品有无规则版本U|
|W05 加入前显示资格与责任|卡片提示马来西亚、内容语言、平台、是否先申请、是否预审；不靠长文猜|P02/P07；地区、语言是Wringy新增建议|
|W06 素材与商业使用权同屏|每份素材写来源、可用范围；批准作品前显示品牌再利用权及作品集规则|P05；付费广告期限/费用待法律及商业决策|
|W07 发布前先确认账号|选择账号→检查归属/适用类型→显示将用于哪项活动；失联有“重新连接”动作|P04；只承诺已验证的平台能力|
|W08 预审按需开、版本可追溯|Belcort需先看口播才开启；第2版回复第1版意见；通过后仍交最终链接|P01/P06；简单剪辑活动可不启用预审|
|W09 链接提交可恢复|识别平台与作者后确认；重复链接指回原稿；网络失败保留输入；超时解释可否申诉|P02/P12；去重和恢复是建议，非Whop实测|
|W10 四种审核不共用一个Approved|申请、草稿、成稿、风险案各显示负责人及下一步；拒稿关联具体要求|P01/P05/P06；例如草稿通过仍提示“待发布提交”|
|W11 先做履约看板及有用通知|品牌看待处理/逾期/需修改；创作者看下一动作；BM改稿通知直达对应版本|P03/P08证据启发；事件/渠道为Wringy定义，不仿冒CR现状|
|W12 关活动要交代在途工作|暂停确认框列未审稿/已批准稿；用户能从稿件开启支持案件并看时限|P05/P06；不能把暂停写成自动取消所有义务|

Linear＋shadcn负责统一组件和交互，不能替代业务决定。三语从状态名称、拒绝理由、通知模板到日期同时设计；例如BM通知打开后仍保留用户读过的中文规则版本，不静默切换履约语言。MYR金额与Asia/Kuala_Lumpur截止时间应明确，SEA扩展再引入额外国家配置，不提前造完整国际后台。

## 阻断PRD冻结的问题

1. 首批付费者是否就是Belcort？买曝光还是买可复用成片？要以哪次真实付费意愿/交付访谈验证？
2. 首发开放加入还是逐人申请？是否需要试稿；申请和制作名额何时承诺预算？
3. 哪些活动必须预审？品牌批准草稿后取消，创作者已有制作劳动由谁承担？
4. 成果授权从批准、付款还是交付开始；地域、期限、广告用途、原始文件及作品集怎样约定？
5. 社交平台首发支持哪些账号类型？连接拒绝/失效、联名帖、删帖、改帖、错过提交时限怎样处理？
6. 品牌超时不审由谁接手、能否继续待审；Belcort创办人建造并运营时，平台争议裁定由谁独立复核？
7. 三语约定何者具控制效力？首期支持的响应时间/工作日、私密活动及客户只读分享是否承诺？

以上缺口不是要求暂停研究；主负责人需在产品规格冻结前记录决定、证据和批准。关闭成本粗估：一次60–90分钟决策会加半天规格整理；涉及客户验证、平台授权及合同的部分另需实证，不能靠研究稿替代。

## 面向完整Whop的未来复用

Whop文档将商品、定价方案和交付模块分开[P14–P15,P17]。Wringy可保留账号/组织、媒体资产、访问范围、通知、支持记录的明确归属；Creator Rewards活动、交付与审核留在其业务内。将来课程按购买获得访问，奖励任务按履约取得应付，不能因为都有金额便共用一个“订单已完成”状态。这里仅给边界建议，不增加12模块首期工程量。

## 来源

全部访问日期为2026-09-11；未注明日期不以搜索引擎抓取日期替代。具体章节、证据摘要、矛盾与范围见相邻来源账本。

- [P01] [V2 is here](https://contentrewards.com/articles/v2-is-here)；2026-08-19；declared。章节：Roles; One brand; Pre-approval; Campaign configuration; For creators; What is not here yet。
- [P02] [For creators | Content Rewards](https://contentrewards.com/creators)；未注明日期（undated）；declared。章节：FAQ: joining, submitting, rejected, reviewed; campaign model overview。
- [P03] [For agencies | Content Rewards](https://contentrewards.com/agencies)；未注明日期（undated）；declared。章节：Reporting; Who approves; More than one client。
- [P04] [Privacy policy | Content Rewards](https://contentrewards.com/privacy-policy)；2026-09-03；declared。章节：Opening scope; §§3–4, 7。
- [P05] [Organization terms of service | Content Rewards](https://contentrewards.com/brands-terms)；2026-09-03；declared。章节：Scope; §§5.6,6,7,11,12。
- [P06] [Creator terms of service | Content Rewards](https://contentrewards.com/terms)；2026-09-03；declared。章节：§§8,10,11,12.6,14.3–4,17,23。
- [P07] [Discover Campaigns | Content Rewards](https://contentrewards.com/discover)；未注明日期（undated）；observed。章节：Content style tabs; Filter dropdown; campaign cards。
- [P08] [Boxabl Official Clipping by Clip Farm | Content Rewards](https://contentrewards.com/discover/188c3e39-7850-4896-94df-e7a5be0cfec3)；未注明日期（undated）；observed。章节：Campaign detail; Reference materials; Top earners; Help & support。
- [P09] [Content Rewards — homepage / signup entry](https://contentrewards.com/signup)；未注明日期（undated）；observed。章节：Signup redirect and email modal; brand launch links。
- [P10] [Book a demo | Content Rewards](https://contentrewards.com/book-a-demo)；未注明日期（undated）；observed。章节：Personal Details; Business Info。
- [P11] [Whop — Campaign Details (Mobbin screen)](https://mobbin.com/screens/5e3e2301-d019-406e-86f3-12213069a8ef)；未注明日期（undated）；observed_historical。章节：Campaign Details; Requirements; left navigation。
- [P12] [Whop — submission modal (Mobbin screen)](https://mobbin.com/screens/c525bd50-9f35-4d56-8804-77d9e91012d3)；未注明日期（undated）；observed_historical。章节：Submission checklist modal。
- [P13] [Content Rewards - Whop Docs](https://docs.whop.com/memberships-and-access/third-party-apps/content-rewards)；未注明日期（undated）；declared。章节：Set up your first campaign; fields 1–11; Fund and launch。
- [P14] [Product - Whop Docs](https://docs.whop.com/api-reference/products/product)；未注明日期（undated）；declared。章节：Product definition。
- [P15] [Experience - Whop Docs](https://docs.whop.com/api-reference/experiences/experience)；未注明日期（undated）；declared。章节：Experience definition; products。
- [P16] [Product updates | Content Rewards](https://contentrewards.com/updates)；未注明日期（undated）；observed。章节：Updates cards。
- [P17] [Create plan - Whop Docs](https://docs.whop.com/api-reference/plans/create-plan)；未注明日期（undated）；declared。章节：Opening definition。

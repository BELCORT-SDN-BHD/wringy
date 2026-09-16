# 外部接口内部契约草稿

2026-09-14。最新方向：先按文档准备TikTok、Instagram／Meta、YouTube及付款接口、模拟数据和内部测试，真实授权与联调留到上线前。本文只定义输入输出与预期行为，没有代码、应用创建、API请求或交易。规格冻结审批独立保留；真实验证不再阻塞设计和模拟开发，但仍阻塞相应生产能力开放。

## 1. 小而明确的内部记录

|记录|必要内容|必须区分|
|---|---|---|
|AuthAccount|平台、账号ID、账号类型、授权范围、到期时间、授权状态、账号控制证据引用|控制账号、API授权、素材版权不是同一证明；令牌不出现在界面或日志|
|MediaRef|平台、稳定发布ID、发布账号ID、规范URL、发布时间、投稿ID|同一URL变体仍是一条发布；商家允许时跨平台视频独立封顶已批准；跨活动复用仍待定|
|MetricSnapshot|MediaRef、原始指标名、值或缺失原因、授权范围、覆盖起止、来源时间、observedAt获取时间、平台版本与证据引用|零有实际返回；缺失不是零；获取时间不等于数据覆盖到该时刻|
|PaymentAttempt|稳定obligation ID、attempt ID、币种与整数最小单位金额、提供方引用、状态、事件ID及凭据|义务与尝试分开；平台收款、连接账户转移、银行付款阶段分开|

每项带`fixture`或`live`来源标记及组织／所有者范围，模拟记录不进入真实应付款。不定义可互换的通用views：TikTok的`view_count`、YouTube统计及Meta具体指标保留原名和口径，经活动规则明确映射后才参与奖励核验。无地域字段就标不可用，不能推算马来西亚观看。

## 2. 平台适配边界

TikTok先准备官方授权与视频查询适配：既有主审文档核对支持授权用户视频归属、`video.list`及`view_count`，不是奖励用途批准。YouTube准备视频统计和频道ID读取；频道ID不是当前用户控制权。来源见[已有官方核对](architecture-content-rewards-v2.md)。

Instagram优先拟采用Instagram Login专业账号路线（Business／Creator）。主审完整读取[Meta官方Postman文档](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api)，确认同时介绍两种登录路线及Facebook Graph示例；不能把其中Facebook登录示例直接套到Instagram Login。

“Instagram Login专业账号无需Facebook Page”目前仅由[官方Postman搜索摘要](https://www.postman.com/meta/workspace/instagram/documentation/23987686-9386f468-7714-490f-9bfc-9442db5c8f00)支持。主审读取[Meta直接文档](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/)遇429，Insights页面亦未取得正文。因此详细权限、版本、指标及账户限制保留未知，模拟可体现能力不可用，不能虚构生产权限名或已支持的Insights字段。

## 3. 调用与失败语义

内部只需“读取授权状态、解析发布、获取快照、请求付款、查询付款状态”五类契约，不建设通用SDK或完整OpenAPI。输入包含主体、资源和请求标识；输出为成功结果或明确错误、来源时间及可否重试。

|错误状态|动作／重试条件|
|---|---|
|token_expired／revoked|提示重新授权；不得用旧令牌无限重试|
|insufficient_permission|补足授权后再试，不能当无观看|
|unsupported_account|说明不支持的账号类型；不自动重试|
|rate_limit|遵守提供方等待提示或退避；不换账号绕限|
|temporarily_no_data|保留最后有效值与缺失标识，有限重试；不补零|

模拟“接受链接”必须有同口径基线快照、接受时间及7天截止点；之前观看排除。缺基线保持待接受；不能为了演示顺畅倒填。快照回落或乱序进入复核，不覆盖历史形成负奖励。

## 4. 付款结果不是银行到账的同义词

提供方适配输出pending、success、failure、unknown，并附**作用阶段**及可核对引用。Connect转移成功只证明对应转移，不能直接记创作者银行到账。由已批准结算定义决定哪个阶段足以结束义务；当前尚未定案。

unknown保留义务并阻止新尝试，查询原attempt后再决定；失败仅在已确认该尝试未付时允许评估重试。回调需签名校验、去重和乱序保护，旧pending不覆盖已核实完成。提供方实际验证、准入与责任在上线前完成，不以模拟success代替。

## 5. 模拟样本与验收对应

|样本|内部测试期望|PRD追溯|
|---|---|---|
|正常授权／他人作品|前者返回关联账号，后者拒绝投稿|A03、A10|
|过期／撤权／权限不足|保持未满足资格，提示恢复路径|A03、A14|
|真实零／缺失／限流|三者状态不同；限流不改成零|A14|
|基线已有观看／后续增长|仅计算接受后同口径增量|A11–13|
|无地域字段|地区能力不可用，不补比例|A15|
|重复／乱序样本与申请|不重建投稿、不插队、不重复占用|A10、A16–18|
|付款pending／failure／unknown|分类准确，未知阻止重付|A24、A25|
|付款重复／乱序回调|原义务只结清一次，旧事件不倒退|A24–26|

以上均是待制作的样本与未执行验收，不是测试报告。冻结规格后可按[开发计划](development-plan-content-rewards-v1.md)推进内部实现；上线前再用获授权真实账号、应用与支付环境验证权限、口径、签名及对账。模拟与真实结果分别留证，不混成一项“接入完成”。

五项批准的内部样本验收追加引用PRD A27–A31；这里只更新契约追溯，未制作或执行测试。付款阶段、取整、数据故障次序仍待定。

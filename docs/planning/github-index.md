# GitHub 规格与任务索引

GitHub 原生关系管理执行；本文为迁移时的链接索引。状态请以 issue 为准。

## 三端交互原型：完整流程与验收规格

[阶段规格](https://github.com/BELCORT-SDN-BHD/wringy/issues/1) · [Milestone](https://github.com/BELCORT-SDN-BHD/wringy/milestone/1)

| 用户结果 / 工作交付 | 类型 | 前置 |
|---|---|---|
| [用户能浏览公开活动并进入模拟工作区](https://github.com/BELCORT-SDN-BHD/wringy/issues/2) | 开发／验证 | 无 |
| [商家能配置、预览并模拟发布活动](https://github.com/BELCORT-SDN-BHD/wringy/issues/3) | 开发／验证 | [#2](https://github.com/BELCORT-SDN-BHD/wringy/issues/2) |
| [创作者能提交链接并看懂模拟观看收益](https://github.com/BELCORT-SDN-BHD/wringy/issues/4) | 开发／验证 | [#3](https://github.com/BELCORT-SDN-BHD/wringy/issues/3) |
| [达标后能申请奖励并处理预算不足](https://github.com/BELCORT-SDN-BHD/wringy/issues/5) | 开发／验证 | [#4](https://github.com/BELCORT-SDN-BHD/wringy/issues/4) |
| [商家与运营能审核，创作者能申诉](https://github.com/BELCORT-SDN-BHD/wringy/issues/6) | 开发／验证 | [#5](https://github.com/BELCORT-SDN-BHD/wringy/issues/5) |
| [财务能模拟发放奖励并核对未知付款](https://github.com/BELCORT-SDN-BHD/wringy/issues/7) | 开发／验证 | [#6](https://github.com/BELCORT-SDN-BHD/wringy/issues/6) |
| [各方能看清申请延期、保留期限与结案](https://github.com/BELCORT-SDN-BHD/wringy/issues/8) | 开发／验证 | [#7](https://github.com/BELCORT-SDN-BHD/wringy/issues/7) |
| [创办人能独立重复体验全部主流程和异常](https://github.com/BELCORT-SDN-BHD/wringy/issues/9) | 开发／验证 | [#8](https://github.com/BELCORT-SDN-BHD/wringy/issues/8) |

## 用户登录后能跨浏览器保存活动与投稿

[阶段规格](https://github.com/BELCORT-SDN-BHD/wringy/issues/10) · [Milestone](https://github.com/BELCORT-SDN-BHD/wringy/milestone/2)

| 用户结果 / 工作交付 | 类型 | 前置 |
|---|---|---|
| [内部版本开工前由创办人冻结身份和保存规格](https://github.com/BELCORT-SDN-BHD/wringy/issues/14) | 证据／签核 | [#9](https://github.com/BELCORT-SDN-BHD/wringy/issues/9) |
| [确认原型交接并建立可重复启动的内部环境](https://github.com/BELCORT-SDN-BHD/wringy/issues/16) | 开发／验证 | [#9](https://github.com/BELCORT-SDN-BHD/wringy/issues/9)、[#14](https://github.com/BELCORT-SDN-BHD/wringy/issues/14) |
| [用户用Google登录后能安全刷新和退出](https://github.com/BELCORT-SDN-BHD/wringy/issues/21) | 开发／验证 | [#16](https://github.com/BELCORT-SDN-BHD/wringy/issues/16) |
| [同一用户能在本人和获授权商家组织间切换](https://github.com/BELCORT-SDN-BHD/wringy/issues/26) | 开发／验证 | [#21](https://github.com/BELCORT-SDN-BHD/wringy/issues/21) |
| [用户换设备仍能恢复语言并继续表单](https://github.com/BELCORT-SDN-BHD/wringy/issues/27) | 开发／验证 | [#21](https://github.com/BELCORT-SDN-BHD/wringy/issues/21) |
| [商家保存规则草稿并明确知道为何不能真实发布](https://github.com/BELCORT-SDN-BHD/wringy/issues/29) | 开发／验证 | [#26](https://github.com/BELCORT-SDN-BHD/wringy/issues/26)、[#27](https://github.com/BELCORT-SDN-BHD/wringy/issues/27) |
| [访客能分享公开活动并登录继续参与](https://github.com/BELCORT-SDN-BHD/wringy/issues/31) | 开发／验证 | [#29](https://github.com/BELCORT-SDN-BHD/wringy/issues/29) |
| [创作者提交外部链接后能查回自己的投稿](https://github.com/BELCORT-SDN-BHD/wringy/issues/32) | 开发／验证 | [#31](https://github.com/BELCORT-SDN-BHD/wringy/issues/31)、[#26](https://github.com/BELCORT-SDN-BHD/wringy/issues/26) |
| [保存投稿后通知可靠到达且任务中断可恢复](https://github.com/BELCORT-SDN-BHD/wringy/issues/33) | 开发／验证 | [#32](https://github.com/BELCORT-SDN-BHD/wringy/issues/32)、[#27](https://github.com/BELCORT-SDN-BHD/wringy/issues/27) |
| [内部版本能在预发布环境恢复并保留已存数据](https://github.com/BELCORT-SDN-BHD/wringy/issues/34) | 开发／验证 | [#33](https://github.com/BELCORT-SDN-BHD/wringy/issues/33) |
| [三端能重复完成真实保存内部版的交接验收](https://github.com/BELCORT-SDN-BHD/wringy/issues/35) | 开发／验证 | [#34](https://github.com/BELCORT-SDN-BHD/wringy/issues/34)、[#27](https://github.com/BELCORT-SDN-BHD/wringy/issues/27) |

## 三端在真实数据库上完成全部模拟奖励业务

[阶段规格](https://github.com/BELCORT-SDN-BHD/wringy/issues/11) · [Milestone](https://github.com/BELCORT-SDN-BHD/wringy/milestone/3)

| 用户结果 / 工作交付 | 类型 | 前置 |
|---|---|---|
| [模拟奖励开工前由创办人冻结资金事务规格](https://github.com/BELCORT-SDN-BHD/wringy/issues/36) | 证据／签核 | [#35](https://github.com/BELCORT-SDN-BHD/wringy/issues/35) |
| [创作者在可核验基线后开始固定窗口计量](https://github.com/BELCORT-SDN-BHD/wringy/issues/37) | 开发／验证 | [#35](https://github.com/BELCORT-SDN-BHD/wringy/issues/35)、[#36](https://github.com/BELCORT-SDN-BHD/wringy/issues/36) |
| [创作者看到正确的累计奖励和本次可申请增量](https://github.com/BELCORT-SDN-BHD/wringy/issues/38) | 开发／验证 | [#37](https://github.com/BELCORT-SDN-BHD/wringy/issues/37) |
| [达标申请原子预留且并发争额不超配](https://github.com/BELCORT-SDN-BHD/wringy/issues/42) | 开发／验证 | [#38](https://github.com/BELCORT-SDN-BHD/wringy/issues/38)、[#33](https://github.com/BELCORT-SDN-BHD/wringy/issues/33) |
| [预算不足时创作者确认确切部分金额才预留](https://github.com/BELCORT-SDN-BHD/wringy/issues/43) | 开发／验证 | [#42](https://github.com/BELCORT-SDN-BHD/wringy/issues/42) |
| [候补者收到额度恢复通知后重新申请](https://github.com/BELCORT-SDN-BHD/wringy/issues/45) | 开发／验证 | [#43](https://github.com/BELCORT-SDN-BHD/wringy/issues/43) |
| [内容和计量分别审核并给出可申诉拒绝理由](https://github.com/BELCORT-SDN-BHD/wringy/issues/44) | 开发／验证 | [#42](https://github.com/BELCORT-SDN-BHD/wringy/issues/42) |
| [创作者申诉后保留原预留并获可追溯结论](https://github.com/BELCORT-SDN-BHD/wringy/issues/46) | 开发／验证 | [#44](https://github.com/BELCORT-SDN-BHD/wringy/issues/44)、[#45](https://github.com/BELCORT-SDN-BHD/wringy/issues/45) |
| [受阻创作者获得明确新截止且不多计观看](https://github.com/BELCORT-SDN-BHD/wringy/issues/47) | 开发／验证 | [#46](https://github.com/BELCORT-SDN-BHD/wringy/issues/46)、[#37](https://github.com/BELCORT-SDN-BHD/wringy/issues/37) |
| [审核确认后形成唯一待付义务和准确资金汇总](https://github.com/BELCORT-SDN-BHD/wringy/issues/48) | 开发／验证 | [#46](https://github.com/BELCORT-SDN-BHD/wringy/issues/46) |
| [财务能模拟付款并区分发放与银行到账](https://github.com/BELCORT-SDN-BHD/wringy/issues/49) | 开发／验证 | [#48](https://github.com/BELCORT-SDN-BHD/wringy/issues/48) |
| [付款未知时只查原交易并在确认未付后受控重试](https://github.com/BELCORT-SDN-BHD/wringy/issues/50) | 开发／验证 | [#49](https://github.com/BELCORT-SDN-BHD/wringy/issues/49) |
| [活动报告在结案时保留未清义务和正确内容期限](https://github.com/BELCORT-SDN-BHD/wringy/issues/51) | 开发／验证 | [#47](https://github.com/BELCORT-SDN-BHD/wringy/issues/47)、[#50](https://github.com/BELCORT-SDN-BHD/wringy/issues/50) |
| [运营在统一队列处理异常且通知失败不会丢业务](https://github.com/BELCORT-SDN-BHD/wringy/issues/53) | 开发／验证 | [#51](https://github.com/BELCORT-SDN-BHD/wringy/issues/51)、[#45](https://github.com/BELCORT-SDN-BHD/wringy/issues/45) |
| [三端重复跑通完整模拟业务并证明恢复不重奖](https://github.com/BELCORT-SDN-BHD/wringy/issues/54) | 开发／验证 | [#53](https://github.com/BELCORT-SDN-BHD/wringy/issues/53) |

## 只开放有真实数据和收付款证据的平台能力

[阶段规格](https://github.com/BELCORT-SDN-BHD/wringy/issues/12) · [Milestone](https://github.com/BELCORT-SDN-BHD/wringy/milestone/4)

| 用户结果 / 工作交付 | 类型 | 前置 |
|---|---|---|
| [真实适配开工前由创办人冻结接入规格](https://github.com/BELCORT-SDN-BHD/wringy/issues/17) | 证据／签核 | [#15](https://github.com/BELCORT-SDN-BHD/wringy/issues/15) |
| [提前查明社交数据与支付路径的可行性缺口](https://github.com/BELCORT-SDN-BHD/wringy/issues/15) | 开发／验证 | 无 |
| [取得实际主体及授权测试账号的使用证据](https://github.com/BELCORT-SDN-BHD/wringy/issues/18) | 证据／签核 | [#15](https://github.com/BELCORT-SDN-BHD/wringy/issues/15) |
| [商家和创作者在真实收付款前得到明确责任费用与退款规则](https://github.com/BELCORT-SDN-BHD/wringy/issues/19) | 证据／签核 | [#15](https://github.com/BELCORT-SDN-BHD/wringy/issues/15) |
| [TikTok能力获得可核验的准入结论](https://github.com/BELCORT-SDN-BHD/wringy/issues/22) | 证据／签核 | [#18](https://github.com/BELCORT-SDN-BHD/wringy/issues/18) |
| [Instagram能力获得可核验的准入结论](https://github.com/BELCORT-SDN-BHD/wringy/issues/23) | 证据／签核 | [#18](https://github.com/BELCORT-SDN-BHD/wringy/issues/18) |
| [YouTube能力获得可核验的准入结论](https://github.com/BELCORT-SDN-BHD/wringy/issues/24) | 证据／签核 | [#18](https://github.com/BELCORT-SDN-BHD/wringy/issues/18) |
| [收付款提供方证明指定主体和国家路径可行](https://github.com/BELCORT-SDN-BHD/wringy/issues/25) | 证据／签核 | [#18](https://github.com/BELCORT-SDN-BHD/wringy/issues/18)、[#19](https://github.com/BELCORT-SDN-BHD/wringy/issues/19) |
| [TikTok投稿能读取真实且有来源的合格数据](https://github.com/BELCORT-SDN-BHD/wringy/issues/39) | 开发／验证 | [#22](https://github.com/BELCORT-SDN-BHD/wringy/issues/22)、[#37](https://github.com/BELCORT-SDN-BHD/wringy/issues/37)、[#17](https://github.com/BELCORT-SDN-BHD/wringy/issues/17) |
| [Instagram投稿能读取已核准口径的真实数据](https://github.com/BELCORT-SDN-BHD/wringy/issues/40) | 开发／验证 | [#23](https://github.com/BELCORT-SDN-BHD/wringy/issues/23)、[#37](https://github.com/BELCORT-SDN-BHD/wringy/issues/37)、[#17](https://github.com/BELCORT-SDN-BHD/wringy/issues/17) |
| [YouTube投稿能以独立授权取得可靠计量](https://github.com/BELCORT-SDN-BHD/wringy/issues/41) | 开发／验证 | [#24](https://github.com/BELCORT-SDN-BHD/wringy/issues/24)、[#37](https://github.com/BELCORT-SDN-BHD/wringy/issues/37)、[#17](https://github.com/BELCORT-SDN-BHD/wringy/issues/17) |
| [真实收款资格和备款依据决定活动能否发布](https://github.com/BELCORT-SDN-BHD/wringy/issues/55) | 开发／验证 | [#25](https://github.com/BELCORT-SDN-BHD/wringy/issues/25)、[#54](https://github.com/BELCORT-SDN-BHD/wringy/issues/54)、[#17](https://github.com/BELCORT-SDN-BHD/wringy/issues/17) |
| [提供方回调和查询只结清一次真实付款义务](https://github.com/BELCORT-SDN-BHD/wringy/issues/52) | 开发／验证 | [#25](https://github.com/BELCORT-SDN-BHD/wringy/issues/25)、[#50](https://github.com/BELCORT-SDN-BHD/wringy/issues/50)、[#17](https://github.com/BELCORT-SDN-BHD/wringy/issues/17) |
| [活动剩余可退款金额经核对后沿批准路径退回](https://github.com/BELCORT-SDN-BHD/wringy/issues/57) | 开发／验证 | [#55](https://github.com/BELCORT-SDN-BHD/wringy/issues/55)、[#52](https://github.com/BELCORT-SDN-BHD/wringy/issues/52)、[#51](https://github.com/BELCORT-SDN-BHD/wringy/issues/51)、[#17](https://github.com/BELCORT-SDN-BHD/wringy/issues/17) |
| [数据撤权与隐私处理不会销毁必要资金证据](https://github.com/BELCORT-SDN-BHD/wringy/issues/28) | 证据／签核 | [#22](https://github.com/BELCORT-SDN-BHD/wringy/issues/22)、[#23](https://github.com/BELCORT-SDN-BHD/wringy/issues/23)、[#24](https://github.com/BELCORT-SDN-BHD/wringy/issues/24)、[#25](https://github.com/BELCORT-SDN-BHD/wringy/issues/25) |
| [仅验证通过的真实能力进入发布候选范围](https://github.com/BELCORT-SDN-BHD/wringy/issues/61) | 证据／签核 | [#39](https://github.com/BELCORT-SDN-BHD/wringy/issues/39)、[#40](https://github.com/BELCORT-SDN-BHD/wringy/issues/40)、[#41](https://github.com/BELCORT-SDN-BHD/wringy/issues/41)、[#55](https://github.com/BELCORT-SDN-BHD/wringy/issues/55)、[#52](https://github.com/BELCORT-SDN-BHD/wringy/issues/52)、[#57](https://github.com/BELCORT-SDN-BHD/wringy/issues/57)、[#28](https://github.com/BELCORT-SDN-BHD/wringy/issues/28)、[#54](https://github.com/BELCORT-SDN-BHD/wringy/issues/54) |

## 获邀用户能在可恢复且有人负责的环境试运营

[阶段规格](https://github.com/BELCORT-SDN-BHD/wringy/issues/13) · [Milestone](https://github.com/BELCORT-SDN-BHD/wringy/milestone/5)

| 用户结果 / 工作交付 | 类型 | 前置 |
|---|---|---|
| [试运营实施前由创办人冻结验证与开放规格](https://github.com/BELCORT-SDN-BHD/wringy/issues/56) | 证据／签核 | [#54](https://github.com/BELCORT-SDN-BHD/wringy/issues/54) |
| [试运营参与者和处理负责人有明确范围与承诺](https://github.com/BELCORT-SDN-BHD/wringy/issues/20) | 证据／签核 | [#15](https://github.com/BELCORT-SDN-BHD/wringy/issues/15) |
| [上线前集中复核规则和三语关键披露](https://github.com/BELCORT-SDN-BHD/wringy/issues/30) | 证据／签核 | [#19](https://github.com/BELCORT-SDN-BHD/wringy/issues/19)、[#28](https://github.com/BELCORT-SDN-BHD/wringy/issues/28)、[#20](https://github.com/BELCORT-SDN-BHD/wringy/issues/20) |
| [固定环境混合压力下仍不会超配或越权](https://github.com/BELCORT-SDN-BHD/wringy/issues/58) | 开发／验证 | [#54](https://github.com/BELCORT-SDN-BHD/wringy/issues/54)、[#20](https://github.com/BELCORT-SDN-BHD/wringy/issues/20)、[#56](https://github.com/BELCORT-SDN-BHD/wringy/issues/56) |
| [告警能到达值班人并指导安全处理异常](https://github.com/BELCORT-SDN-BHD/wringy/issues/59) | 开发／验证 | [#53](https://github.com/BELCORT-SDN-BHD/wringy/issues/53)、[#20](https://github.com/BELCORT-SDN-BHD/wringy/issues/20)、[#56](https://github.com/BELCORT-SDN-BHD/wringy/issues/56) |
| [备份恢复与应用回退后仍能查清原付款](https://github.com/BELCORT-SDN-BHD/wringy/issues/60) | 开发／验证 | [#54](https://github.com/BELCORT-SDN-BHD/wringy/issues/54)、[#20](https://github.com/BELCORT-SDN-BHD/wringy/issues/20)、[#56](https://github.com/BELCORT-SDN-BHD/wringy/issues/56) |
| [受邀用户入口和关闭开关能限制真实开放范围](https://github.com/BELCORT-SDN-BHD/wringy/issues/62) | 开发／验证 | [#61](https://github.com/BELCORT-SDN-BHD/wringy/issues/61)、[#54](https://github.com/BELCORT-SDN-BHD/wringy/issues/54)、[#20](https://github.com/BELCORT-SDN-BHD/wringy/issues/20)、[#56](https://github.com/BELCORT-SDN-BHD/wringy/issues/56) |
| [创办人根据完整证据批准具体生产发布](https://github.com/BELCORT-SDN-BHD/wringy/issues/63) | 证据／签核 | [#30](https://github.com/BELCORT-SDN-BHD/wringy/issues/30)、[#58](https://github.com/BELCORT-SDN-BHD/wringy/issues/58)、[#59](https://github.com/BELCORT-SDN-BHD/wringy/issues/59)、[#60](https://github.com/BELCORT-SDN-BHD/wringy/issues/60)、[#62](https://github.com/BELCORT-SDN-BHD/wringy/issues/62) |
| [按批准范围发布并完成首批邀请旅程](https://github.com/BELCORT-SDN-BHD/wringy/issues/64) | 开发／验证 | [#63](https://github.com/BELCORT-SDN-BHD/wringy/issues/63) |
| [用真实试运营结果决定继续修复或扩大开放](https://github.com/BELCORT-SDN-BHD/wringy/issues/65) | 证据／签核 | [#64](https://github.com/BELCORT-SDN-BHD/wringy/issues/64) |


# Content Rewards 资金规则与版本差异

核查基准：2026-09-10。以下是公开合同和产品文档的对照，不是法律意见或真实交易测试。CPM指每千次有效观看计酬；Retainer指按约定周期交付内容并计酬。来源标题、日期、访问方式和对应章节另存 money-sources.json。

## 版本边界

| 层次 | 可用于证明什么 | 不能用于证明什么 |
|---|---|---|
| 2025-05-14 Whop教程 [S1] | 当时发布的嵌入式产品操作与规则 | 当前CR费率、审批与时效 |
| Mobbin Whop嵌入式UI，采集日期/版本未知 [M1] | 主研究者报告的预览：估算奖励、最低观看、投稿状态 | 画面含2026-03-03数据，不是采集日期或版本证据；亦不证明合同、费率、银行到账 |
| 2026-08-19 V2公告 [S2] | 当日公布的版本变化 | 今天仍执行每项旧数值 |
| 2026-09-03 CR条款及当前定价 [S3–S6] | 当前公开合同、收费与结算说明 | 已部署构建编号、私人后台实现、实际接受的旧合同 |

## 14项关键发现

1. **只找到V2公告，不声称“当前版本号就是V2”。** 官方文章索引的Changelog仅列8月19日公告；两轮定向检索未发现更新公告。9月3日是条款更新时间，不是软件发布日期。[S8]

2. **CR与Whop分工且新旧合同并存。** CR运行奖励逻辑，Whop处理资金。新Web条款明确不替换旧Whop嵌入活动接受的合同；不能把Whop项目费再叠加成新CR费。[S5 Scope/§3；S6 §31；S7]

3. **品牌费与创作者费是不同基数。** 当前品牌标准费10%、Verified 8%，最低活动预算$1,000；定价FAQ笼统写10%，需保留表格的Verified例外。创作者费按收入计：CPM固定10%；按篇/周期预算低于$5,000为10%，达到该数为0%。不能直接相加成“预算抽20%”。[S3；S4]

4. **8月费率已与现行定价不同。** V2公告写按篇/周期7%，超过$5,000免；CPM按累计收入由25%降至7%。当前定价改为上一项，并把免收费边界写成“$5,000或以上”。应分别保存历史费率和适用日期。[S2 Improved；S4]

5. **“无其他费用”存在披露冲突。** 品牌定价页表格写无其他费；组织条款§4.2的处理费基数明确为“funded amount”（充值额），约2.7%加小额固定费，充值时单列。V2曾写固定额$0.37并加在预算外；现行条款未给固定额，不能沿用为统一报价。此为CR披露的Whop费，未取得对应支付处理商合同或账单。[S3；S5 §4.2；S2]

6. **V2示例金额有算术问题。** 公告将$10,000的2.7%+$0.37说成约$307；按其明示公式计算应为$270.37。这是复算差异，无法证明真实账单用了哪种基数。[S2；研究者复算]

7. **充值与奖励入账分开。** 活动上线前充值；当前首页说银行转账须先清算。组织条款写按篇/周期在批准投稿时预留预算，CPM随有效观看逐步消耗；不要采用“所有投稿一提交就锁预算”的无依据说法。[S9；S5 §§4.3、5.5]

8. **旧自动批准不能沿用。** 2025教程写AI检查及48小时自动批准；Whop项目合同允许平台在自定期限后自动处理。新CR明确无自动批准，Pending待品牌人工决定；自动风控标记不等于自动拒绝。[S1 FAQ；S7 Seller review；S5 §6.1；S6 §9]

9. **草稿通过不等于最终奖励通过。** 新CR可先审未发布原片并要求修改，发布后的成稿仍可能因不符要求被拒；这是两个审批事件，不能把第一次批准直接当成最终应付。[S5 §7；S6 §8]

10. **结算时钟已改变。** 8月公告称按篇/周期15分钟、CPM三天周期；当前定价写CPM从批准起计酬7天再等待3天，按篇批准后、周期在周期末付款。条款保留验证和风控暂停，不能把“10天”理解为银行到账承诺。[S2 For creators；S4；S6 §7]

11. **免费提现只覆盖到Whop余额这一段。** 创作者定价说明转至Whop余额免费且无最低额；CR条款区分自身应付账本和Whop提款。约3–5工作日/付费即时是CR转述的Whop发起估计，未独立验证具体银行或地区报价。[S4；S6 §§3、7.4、16]

12. **退款先处理待审与应付，再算剩余。** 有Pending不能申请；审核5–7工作日，不是到账保证。先付创作者；CR可酌留未花预算最多20%，并非固定扣总预算20%；Whop处理费不退。向发卡行争议不自动导致永久封禁。[S5 §10]

13. **争议、逆转与封禁应分开记录。** 标记每稿可申诉一次，目标10工作日答复；普通拒稿由品牌决定是否改判。未结算奖励可逆转回预算；已结算不走该逆转流程，但封禁条款仍保留欠款/确认欺诈损失抵扣，不能称余额绝对不可动。[S6 §§10、11、13.4]

14. **旧Whop合同有不同的费用与截止结构。** 发布时余额要覆盖最高奖励和费用；卖家另付实际向参与者支付额的10%。奖励以Whop Credits转移，上限或截止时间先到即停止计酬；该页未见发布日期，不能据它推定Mobbin截图对应活动接受了哪版合同。[S7 Sellers Offers/Payment；Introduction]

## 资金生命周期：分析用拆分，不冒充完整界面

品牌充值 → 可用活动预算 → 奖励预留/逐步消耗 → 审批后验证 → CR可提现应付余额 → 经Whop提款 → 外部到账。

这是依据[S5 §§4–6]、[S6 §16]整理的概念链；不表示每个环节都有独立页面，也不证明银行到账。退款、风控冻结和未结算逆转是旁支。举例：页面显示“Approved”，仍不足以判定创作者的钱已经到银行。

尚缺：当前实际结账明细、费率四舍五入与净毛额公式、旧活动接受的合同副本、完整退款/申诉执行记录和银行到账测试。没有用Mobbin状态标签补造这些信息。

主研究者另报告：当前公开Discover仍有大量Whop体验入口，/signup弹出邮箱登录框，首页Launch campaign进入预约演示。此处只作主研究者提供的边界补充，不是本worker独立浏览证据。**独立CR主体与新Web条款不等于完全替代Whop，也不证明公司出售、分拆或所有权历史。**

## 来源

- [S1] Whop，[How to set up Whop Content Rewards](https://whop.com/blog/set-up-content-rewards/)；2025-05-14；访问2026-09-10。支持章节：Creating a content reward；Content rewards F.A.Q.。
- [S2] Content Rewards Inc，[V2 is here](https://b4e0vdqv6zgqeqj4pfgm.apps.whop.com/articles/v2-is-here)；2026-08-19；访问2026-09-10。支持章节：Retainers；For creators；What costs more；Improved。
- [S3] Content Rewards Inc，[Pricing | Content Rewards](https://b4e0vdqv6zgqeqj4pfgm.apps.whop.com/pricing)；页面未注明日期；访问2026-09-10。支持章节：Get verified and save；Before you ask。
- [S4] Content Rewards Inc，[Creator Pricing | Content Rewards](https://b4e0vdqv6zgqeqj4pfgm.apps.whop.com/pricing/creators)；页面未注明日期；访问2026-09-10。支持章节：How much of my earnings do I keep?；Are there withdrawal fees?；When do I get paid?。
- [S5] Content Rewards Inc，[Organization Terms of Service](https://b4e0vdqv6zgqeqj4pfgm.apps.whop.com/brands-terms)；2026-09-03；访问2026-09-10。支持章节：Scope; legacy experience；3；4；5；6；7；9；10。
- [S6] Content Rewards Inc，[Creator Terms of Service](https://b4e0vdqv6zgqeqj4pfgm.apps.whop.com/terms)；2026-09-03；访问2026-09-10。支持章节：3–8；9–11；13.4；16；31。
- [S7] Whop，[Whop Content Rewards Terms and Conditions](https://whop.com/content-rewards-terms-of-service/)；页面未注明日期；访问2026-09-10。支持章节：Introduction；For Sellers: Offers / Review and approve requests / Payment；For Participants: Payment。
- [S8] Content Rewards Inc，[Articles | Content Rewards](https://contentrewards.com/articles)；页面未注明日期；访问2026-09-10。支持章节：Changelog。
- [S9] Content Rewards Inc，[Content Rewards](https://contentrewards.com/)；页面未注明日期；访问2026-09-10。支持章节：How do I pay for a campaign?。
- [M1] Mobbin，[Content rewards](https://mobbin.com/flows/83ac1dc0-5a6f-4ed0-9cce-0812939f69a9)；采集日期/版本未知（画面可见2026-03-03数据）；访问2026-09-10，主研究者转述，未独立访问。支持章节：Main-reported preview inspection。

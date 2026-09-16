from pathlib import Path
b=Path(__file__).resolve().parent.parent
p=b/'design-system-spec.md';s=p.read_text()
s=s.replace('组件目前为设计说明，不能宣称代码、Figma 或可访问性验收已经完成。','现已交付31类本地HTML/CSS设计参考；具体实现状态以 component-inventory.json 的 stateCoverage 为准，不表示生产应用、原生Figma组件库或完整可访问性验收完成。')
s=s.replace('asset-briefs.md 保留图像槽位，不包含已生成资产。','asset-briefs.md 定义图像槽位；实际本地参考与导出记录见 showcase/manifest.json。')
s=s.replace('当前 worker 仅记录该目标，未操作页面或声称已建库。','Figma成功批次报告4个集合、130个变量，后续配额阻断读回；没有原生组件、文字样式、屏幕或导出。按主会话实时授权已停止Figma调用，交付本地参考替代；不声称原生库完成。')
s=s.replace('批准标签可用 success，但紧邻文字必须写清“尚不可提现”，不可让绿色代替财务事实。','首发品牌直接付款的审核批准标签可用 success，但紧邻报酬文字必须写清“已批准 · 待品牌付款；到账尚未确认”。首发不显示平台钱包或可提现余额；不可让绿色代替财务事实。提现/释放标签只属于第6节明确区分的未来集成路线。')
s=s.replace('本轮未下载、安装或打包字体。','本地参考已打包两家族字体及原始许可证，官方来源与文件哈希见 showcase/fonts/provenance.json；实际浏览器加载检查通过。')
s=s.replace('“创意合作 · 报酬 MYR 148.00 · Kerjasama”','“创意合作 · 报酬 MYR 150.00 · Kerjasama”')
a=s.index('三个独立对象：');z=s.index('活动简报必须包含：',a)
s=s[:a]+'''### 6.1 首发：品牌直接付款，无平台钱包

当前首发模型来自2026-09-10主会话实时意图：品牌直接向创作者付款。Wringy设计参考展示合作与付款记录，不宣称平台持有、释放、托管或划转资金，也不提供平台可提现余额。

- 提交对象：draft → submitted → reviewing → approved / changes-requested / rejected；修改保留版本。通知已读不会改变审核结果。
- 报酬与付款记录：approved（报酬已批准）→ awaiting-brand-payment（等待品牌付款）→ paid-confirmed（有适当证据确认到账）。审核批准和付款确认是独立事实，不能自动联动成已到账。没有到账证据时保持待确认；品牌表示已转出但未确认银行到账时写“品牌已转出，到账待确认”。
- 首发统一示例：已批准报酬 **MYR 150.00**，付款方“示例品牌 A”，付款状态“等待品牌付款”，到账状态“尚未确认”。不扣示例平台费，不出现提现按钮，不称钱包余额。此款项与下节MYR148.00示例是不同情境。

每笔钱显示币种代码MYR及两位小数，而非“150”“RM150+”或含糊“余额”。预计、待审核、已批准、待品牌付款和已确认到账按事实分别显示；未知不能当作0或paid。截图不能证明资金政策或服务已经实现。发生争议、冲正或记录错误时保留原始记录并独立说明，不静默改写收入。

### 6.2 未来集成路线：仅为独立设计参考

只有另行确认服务方、释放规则、账本、费用与真实资金流程后，才可能采用以下状态；这不是首发承诺。页面及金额示例必须显著标“未来集成路线示例 · 首发为品牌直接付款”。

- 集成报酬对象可参考 estimated → pending-review → approved-held → available → reserved-for-payout → paid。approved-held仅说明审核已批准；available仅在服务方/权威账本确认满足释放条件时出现，不由UI或审核结果推断。
- 集成提现对象可参考 confirming → submitted → processing → paid / failed / cancelled / unknown。状态由服务方及权威记录确认；unknown先核对，不能重复发起。失败是否释放预留款项由核实后的账本结果决定。
- 独立虚构例子：款项总额或账户扣减 **MYR 150.00** − 示例服务费 **MYR 2.00** = **预计净到账 MYR 148.00**。必须标“示例，非实际费率”；不可把该费用套用到首发MYR150.00品牌直接付款示例。

未来确认页逐项显示币种、扣减额、费用、净额、收款目标末四位、已知到账预期与确认动作。缺项时阻止确认；未知ETA写“到账时间尚未提供”。服务方仅接受请求写“已提交”，确认转出但未确认银行到账写“已转出，银行到账待确认”，仅在适当到账确认后写“已到账”。扣减、费用、净额分别成行；金额由可信源给出，UI不以二进制浮点决定账务。兑换须另列币种、来源、汇率、费用及报价有效期。

两条路线共用原则：拒绝、账户限制、付款失败与通知失败各自独立；账户受限不等同付款失败，也不抹去可合法查看的历史或申诉入口。

''' + s[z:]
a=s.index('建议 Figma 页面：');z=s.index('## 10. 来源',a)
s=s[:a]+'''### 2026-09-10 实际交付记录

主会话实时授权从配额阻断的Figma构建转为本地HTML/CSS交付，范围为设计参考，不是生产应用。Figma成功批次报告4集合、130变量；最终读回被配额阻断，单个变量ID未恢复。原生文字/效果样式、组件、变体、屏幕及导出均为0。没有重试、绕过或发布库。详见 figma-manifest.json。

本地交付：showcase/index.html、可离线ZIP、31类真实HTML/CSS结构与本地交互，浅深主题、原始标志位图、两家族许可字体、四幅主产品PNG与另列未来集成PNG。逐类 implementationRefs、stateCoverage、variantCoverage 在 component-inventory.json，原有全局状态/变体为规范，不代表全部组合已构建；未来后端状态不属于本地演示实现。

已做检查：31类在浅深主题的62张截图逐类查看；浏览器表单验证与摘要焦点、菜单/页签键盘、dialog Escape与焦点返回、开关Space、14个作品/未来付款状态切换；320/390/768/1440目录响应式及产品屏窄宽视口无页面横向溢出；字体加载、控件标签、图片alt、3px可见焦点、减少动态偏好、无外部请求及无JS运行错误。证据见 showcase/verification-report.json 与 ../assets/ui/verification-report.json。这是冒烟检查，不是完整辅助技术认证。

四幅主图状态：BB21品牌草稿阻止发布且无提交；BB22独立已发布示例审核队列；BB23/BB24创作者MYR150.00已批准待品牌付款；BB25可选为独立未来集成MYR150.00−2.00=148.00。主任务已在实时反馈中确认四主图可用于视觉/状态交接；这不构成生产支付政策、品牌最终注册/市场验证或跨供应商审查批准。

仍未完成：全套读屏测试、200%文字/400%缩放专项、色盲模拟、真人三语审读、商标核查、真实业务安全与支付实现、原生Figma组件库。主任务另行组织独立评审，本工作者没有执行或声称该批准。

初始文本交接检查DS-01至DS-08仍有效：六文件、引用与100对对比、字体来源、31类规范、30页内容与槽位、示例十进制金额及renderer颜色投影。DS-07中的150−2=148仅指未来集成示例；首发直接付款示例为MYR150.00无平台费用。

''' + s[z:]
s=s.replace('未执行渲染、原生组件构建或辅助技术测试；这些不包含在本记录的通过范围。','以上为初始文本阶段记录。后续本地渲染与键盘冒烟结果见第9节2026-09-10实际交付记录；原生组件库与完整辅助技术测试仍未完成。')
p.write_text(s)
p=b/'brand-strategy.md';s=p.read_text();s=s.replace('已提交、已批准、可提现和已到账各自独立。','首发的已提交、已批准、待品牌付款和已确认到账各自独立；可提现仅属于另列的未来集成路线。');s=s.replace('| 批准 | 报酬 MYR 150.00 已批准，尚不可提现。 | Reward of MYR 150.00 approved. Not yet available to withdraw. | Ganjaran MYR 150.00 telah diluluskan. Belum tersedia untuk pengeluaran. |','| 批准（首发品牌直接付款） | 报酬 MYR 150.00 已批准，待品牌付款。到账尚未确认。 | Reward of MYR 150.00 approved. Awaiting payment from the brand. Receipt is not yet confirmed. | Ganjaran MYR 150.00 telah diluluskan. Menunggu bayaran daripada jenama. Penerimaan bayaran belum disahkan. |');s=s.replace('| 提现失败 |','| 提现失败（仅未来集成路线） |');s=s.replace('此处所有金额是示例。','此处所有金额是示例。首发为品牌直接付款、无平台钱包。下表提现失败行仅供未来集成路线，其MYR148.00是另一个MYR150.00减示例费MYR2.00的情境，不套用于首发MYR150.00报酬。');s=s.replace('分辨“已批准”和“可提现”','分辨首发的“已批准”“待品牌付款”和“已确认到账”；若研究未来集成路线，再独立测试“可提现”');p.write_text(s)

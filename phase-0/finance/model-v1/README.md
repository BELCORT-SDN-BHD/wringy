# Wringy 财务模型 v1

2026-09-10，已冻结的说明情景草稿。不是预测或完整资金报价；新计量与反作弊开发未报价。

- [可编辑Excel：36个月、三情景](outputs/financial-model/Wringy-36个月财务模型.xlsx)
- [中文解释：毛利、公司回本、品牌获客回收与限制](财务模型说明.md)
- [输入与口径记录](assumptions.json)
- [逐月结果与敏感性](results.json)
- [Deck交接与最终数字](handoff-final.md)
- [独立数学与缓存核验](cached-verification.json)
- [公式与输入重算核验](verification.json)
- [冻结文件哈希](manifest.json)

核心结果：保守36个月内未回本，基准M25，扩张M18。20场毛利率53.33%，贡献率50%，新增品牌获客成本前经营亏损RM2,000。服务费率15%不是毛利率。

Excel是日常可编辑入口，JSON与中文报告是此冻结版本的记录快照；修改Excel后，发布前需同步更新记录并重新核验。recalculated/仅为捆绑LibreOffice核验副本，交付使用outputs中的原工作簿。

基础源：[商业模式v2](../../foundation/business-model-v2.md)、[历史Belcort预算](../../foundation/belcort-handoff-v1.md)。本次没有修改这些旧基础文件。

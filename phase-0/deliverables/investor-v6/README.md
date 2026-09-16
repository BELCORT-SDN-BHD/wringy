# Wringy investor v6

2026-09-10。18页中文投资讨论稿。仅写入investor-v6，v5保持不变。

## 交付

- `output/Wringy-Investor-v6.pptx`：原生可编辑文字、经济关系图、2张财务表格、3张图表。
- `output/Wringy-Investor-v6-Preview.pdf`：18页最终PPTX渲染预览。
- `output/contact-sheet.png`：全稿缩略图。
- `output/slides/`：18张逐页PNG。
- `story.md`与`build/notes.json`：逐页内容及来源，与PPTX讲者备注同步。

## 来源

财务直接读取`phase-0/finance/model-v1/results.json`及`assumptions.json`，构建时核对冻结`manifest.json`中的两份JSON及Excel哈希。

财务可编辑入口为`phase-0/finance/model-v1/outputs/financial-model/Wringy-36个月财务模型.xlsx`，本任务不复制或修改该模型。净平台收入、销货成本、贡献、固定成本、独立品牌获客费及三情景现金回本保持模型口径。修改财务须先同步模型快照再重建deck。

审核事实采用主任务核查并批准的`phase-0/research/review-mechanisms-v1/deck-brief.md`，提案参考`phase-0/foundation/review-design-v1.md`。当前条款2026-09-03版本无自动通过；旧48小时教程不作为新机制。Wringy四类状态与成本反馈是提案，不是Whop实际界面或已实现能力。

设计沿用`phase-0/foundation/design-v3/tokens.json`、v5照片与TJR原始横幅、Tabler语义图标。TJR原图$23,000与活动标题$23,100差异保留且披露。

## 页序

1定位；2问题假设；3业务经济流；4活动示例；5TJR案例；6审核分工；7按播放计酬时间线；8单场经济；9月度毛利与经营结果；10固定成本覆盖门槛；11三情景累计回本；12现金条件与敏感性；13增长假设；14市场；15规模算式；16未来商业工具；17原方案资金规划参考；18Wringy设计附录。

## 验证与限制

采用artifact-tool与捆绑运行环境，无python-pptx或用户桌面LibreOffice。现金图使用36个唯一M1–M36文字类别，保留3条情景线及零线。图表内嵌工作簿为冻结JSON的数值快照，不取代原财务模型公式。

机器验证、金融数值对照及改动页目检分别记录在`build/validation-final.json`、`build/content-check.json`与`build/visual-review.json`。PDF是图片预览。未做PowerPoint桌面编辑重存测试，Noto Sans SC未嵌入。

回本是附条件的融资前累计现金情景，包含4个月建设；新增计量与反作弊开发0仅占位，未报价。毛利率53.3%为20场净平台服务收入规划口径。单场贡献50%，与服务费15%不同。20场经营亏损RM2,000及23场固定开支门槛均在新增品牌获客费之前；三情景现金流已包含该费用。支付3%与收款延迟敏感性分别单独改变，不叠加。实际回本、最终会计口径与新范围融资需求仍未知。

# Wringy investor v5

2026-09-10。12页中文投资讨论稿。业务来源：`phase-0/foundation/business-model-v2.md`。设计值来源：`phase-0/foundation/design-v3/tokens.json`。仅修改本目录，没有修改冻结PRD或其他基础文件。

## 交付

- `output/Wringy-Investor-v5.pptx`：可编辑文字、业务图与原生图表；第9、12页图表内嵌数据工作簿快照。
- `output/Wringy-Investor-v5-Preview.pdf`：最终PPTX渲染的12页图片预览。
- `output/contact-sheet.png`：全稿缩略图。
- `output/slides/`：逐页PNG。
- `story.md`、`build/notes.json`：逐页叙事与来源，和PPTX讲者备注同步。

## 页序

1. 定位
2. 品牌分发与创作者收入的问题假设
3. 原生可编辑业务关系与经济归属图
4. 马来西亚商家的假设活动
5. Reach的TJR真实剪辑活动
6. RM10,000奖励与另计15%平台费的算例
7. 单场贡献及成本敏感性
8. 品牌复购与创作者持续参与的假设
9. 视频电商市场背景
10. 收入规模的数学情景及其4亿次播放要求
11. Rewards之后的Whop式商业工具
12. 原按帖方案资金规划参考，须为新模式重新估价

## 构建与验证

构建沿用investor-v4的artifact-tool、原生图表数据工作簿封装与字体处理。入口：`build/build.mjs`，终稿检查与导出：`build/finish.mjs`。使用指定bundled Node与Python，无python-pptx，无用户桌面LibreOffice。字体为Noto Sans SC。

验证文件：`build/validation-final.json`、`build/package-summary.json`、`build/content-check.json`、`build/visual-review.json`。未做PowerPoint桌面编辑、保存、重开测试。PDF是预览，编辑应使用PPTX。Noto Sans SC字体未嵌入，接收方字体环境可能影响显示。

## 来源与边界

TJR原始图保留$23,000文字，当前活动页标题为$23,100；差异已在第5页及备注注明。未使用动态累计播放、花费或供应商营销ROI数据。TJR证明活动机制存在，不代表Wringy客户、伙伴或经审计回报。

费用、成本及规模均为数学假设。RM576,150保留旧按帖首版预算的全部五项，未声称覆盖新播放计酬、计量和反作弊范围。未承诺托管、资金路径、自动数据接入或未来工具收费。资产说明见`THIRD-PARTY-NOTICES.md`。

# Wringy 视觉指南 v3

这是有明确研究边界的独立 Wringy 草案。业务模型和生产规范尚未批准。

- `tokens.json`：共用颜色、字体层级、间距、主要布局、断点、动效、固定样例的唯一源。
- `tokens.css`：从源生成，含项目 Noto Sans SC 字体声明。
- `showcase.html`：字体/图片/CSS/脚本内嵌，本地打开；第8页实际队列、搜索、筛选、属性浮层、备注弹窗与限宽设置。
- `Wringy-visual-guide-v3.pdf`：10页打印版。
- `brand-components-spec.md`：中文规则、契约、来源和限制。
- `pattern-references.json`：14条不同来源链接；版本归属未知。
- `assets/product-overview.png`、`review-detail.png`、`creator-progress.png`：完整产品展示图。
- `assets/deck-activity-focus.png`、`deck-review-focus.png`：1000×760聚焦图，无导航和重复照片。
- `verification.json`、`contrast-report.json`：检查结果；`assets/pdf-page-*.png` 为实际PDF栅格化。

## 重建

只在本目录内生成输出；需要本机Python3、bundled Node和Playwright、Chrome headless。依次执行：

1. `python3 generate-tokens.py`
2. `python3 build.py`、`python3 focus.py`
3. bundled Node 执行 `export.cjs`、`export-focus.cjs`
4. `python3 guide.py`
5. bundled Node 执行 `verify.cjs`（导出PDF与检查）
6. `python3 contrast.py`

`complete-tokens.py` 是初始迁移记录，不属于日常重建；不要运行它覆盖已经调整的源。局部图片裁切和打印几何属于指南模板，不是共用产品 token。所有固定活动/产品/主作品名称由 shared.py 根据 tokens.samples 解析；新增样例必须先写源。产品示例为静态出口，真实交互在 showcase 第8页。

## 边界

没有真实客户、作品或交易数据；所有照片是概念场景。不存在真实服务、权限、付款、上传实现。Ramp和Linear模式参考不是完整官方规范，精确capture成员仍未验证。Noto Sans SC嵌入，拉丁Arial/Helvetica仍由系统提供。PDF是固定横向页面；PNG以对应导出画布为准，不是网页响应测试。

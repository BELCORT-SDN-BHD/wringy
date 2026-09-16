# 给Belcort的维护交接

2026-09-11。目标是维护官方Radix/Nova源码和Wringy语义配色，不接手一个自制103族UI库。先读[根合同](README.md)，再查[官方组件映射](component-map.md)。

## 已核对的应用入口

- 工作目录：[app/](app/)，目前是Vite/React工程；配置见[package.json](app/package.json)。
- shadcn配置：[components.json](app/components.json)，当前`style: radix-nova`、`rsc: false`、`iconLibrary: lucide`，UI别名`@/components/ui`。
- 全局样式入口：[src/index.css](app/src/index.css)，由components.json指向。只在这里映射Wringy配色到官方语义颜色，不建立第二份组件CSS。
- 独立展示：[output/Wringy-Design-System.html](output/Wringy-Design-System.html)。开发预览：[localhost:8878](http://localhost:8878)，需本地服务正在运行。

## 从源码导出展示文件

在[app/](app/)目录运行：

```sh
npm ci
npm run export
```

首次恢复依赖需要互联网；已有对应锁文件依赖时直接运行导出即可。`export`按[package.json](app/package.json)先构建，再由[scripts/export.mjs](app/scripts/export.mjs)把构建HTML复制至`../output/Wringy-Design-System.html`。维护应编辑app源码并重新导出，不能手改导出HTML形成第二份实现。

独立HTML用于本地展示；离线可用范围以[浏览器报告](output/browser-verification.json)的离线检查为准，不承诺所有外部功能离线可用。官方文档/Mobbin等链接需要互联网。示例没有生产API、实际认证、计量或付款服务，点击示例不代表完成真实业务。

## 增加或更新组件：一条路径

以下在app目录执行，使用该项目实际包管理器；当前示例使用npm/npx。先读取配置和已安装内容，不能把跨base搜索结果当本项目可安装证明。

```sh
npx --yes shadcn@latest --version
npx --yes shadcn@latest info --json
npx --yes shadcn@latest search @shadcn -t ui -l 100
npx --yes shadcn@latest docs button field dialog
npx --yes shadcn@latest view @shadcn/button
```

读取docs返回的**Radix**页面及源码信息；若返回Base UI，先检查执行目录/配置，不按错误文档实现。新组件用官方CLI添加；更新先比较，记录本次CLI版本和生成源差异，保留依赖锁文件。

```sh
npx --yes shadcn@latest add button --dry-run
npx --yes shadcn@latest add button --diff button.tsx
```

确认差异后再运行正常`add`；不要默认`--overwrite`，更不要下载raw GitHub文件手工替换。业务逻辑写在官方组件外，通过props和子元素组合；组件内部保持官方默认样式。若先前已被手改，先列出差异与来源，由负责工程任务处理，不叠加CSS补丁。更新后检查全局调色映射未被意外重置。

本轮已核对questionnaire.tsx存在，旧form.tsx不存在；Form演示用Field。未来升级Questionnaire仍按对应Radix文档核对安装结果，搜索未列出不证明不可安装。Data Table/Date Picker走官方组合教程；Typography走Typeset；当前表单优先Field/Forms，Radix短反馈用Sonner。官方允许的扩展并不自动扩大本项目“只改配色”的范围。[官方CLI说明](https://ui.shadcn.com/docs/cli)

## 允许与不允许的变更

| 可以 | 不可以 |
|---|---|
| 官方variant、size、受控值、disabled/invalid等props | 新造variant、覆写Button/Badge内部类、复制v1状态皮肤 |
| 采用官方页面/组合模式，Linear参考决定对象层次 | 从截图猜字体/间距源码，宣称完整提取Linear设计系统 |
| 在指定全局CSS映射既有Wringy颜色 | 修改官方半径、字体、阴影、动画、焦点几何，增加Emil缩放/缓动 |
| 官方CLI所需依赖与官方实例组成 | 用社区库或手写控件悄悄填富文本、播放器等缺口 |
| 文案、数据、路由和业务API逻辑 | 把费率、风险、去重或资金执行说成组件自带能力 |

## 验证证据与覆盖边界

1. 实际Radix/Nova安装清单、源文件路径和CLI版本；区分安装条目、组合示例、展示页面与历史映射数。
2. 构建/类型/检查命令及真实结果；预览地址可打开的证据。测试脚本以app实际配置为准。
3. 主要官方控件的键盘、焦点、禁用/无效、异步场景与窄屏验证；配色前景/背景对比检查。
4. 官方基线差异检查：除已登记语义颜色映射外，没有字体、圆角、间距、阴影、动画或内部样式覆盖。
5. 已核对的61个源码文件（含Questionnaire、无legacy Form）与升级后清单的差异；官方无对应能力的明确缺口，以及任何尚未演示/验证的组件列表。

以上列出核验范围，不表示每项均已通过。[浏览器报告](output/browser-verification.json)给出自动化检查时间、逐项结果、截图和限制，应读取其result而不是把文件存在当通过。主任务已通过CUA观察Dialog初始焦点、Escape关闭及回焦；这一人工观察与自动化报告分别记录，不扩展为全部props或组合状态验收。最终验证摘要由主任务补充。业务提案及其未决事项仍在[v1/domain-states.md](../design-system-v1/domain-states.md)，此次仅更换UI执行基线，不重新批准商业政策。

## 文档结构检查记录

五份指定文档已写入；103/103旧需求ID唯一且集合一致，7条Linear引用完整；当前61个UI文件与official-snapshot成员一致（Questionnaire存在、legacy Form不存在）；64个官方目录入口按61个UI对应项＋3个指南解释。含2个历史CLI补充来源的66行索引只是来源对账，不是66个组件。本次检查的115个本地文档、源码与导出/报告链接全部可解析。该记录仅为文档检查，应用运行结果以浏览器报告和主任务最终摘要为准。

## 最终验收 · 2026-09-11

[此前双语版本验证记录](output/verification.json)：类型检查与构建通过，22/22项浏览器检查通过；64个入口在320px无页面横向溢出，独立HTML离线挂载64项并加载内嵌字体。61/61份官方UI源码一致，全局CSS仅31个既有浅色颜色变量与12个具名语义颜色变量变化；CSS其余部分不变。主任务另实测Dialog和命令弹窗打开/关闭。具体状态覆盖以逐项报告为准，不宣称穷尽所有属性组合。

维护源码在[app/](app/)；浏览器测试运行方法见[测试说明](app/tests/README.md)。本轮采用官方双滑块范围示例，其Minimum/Maximum名称配中文上下文；当前封装未暴露单滑块名称接口，不修改官方文件补接口。商业规则仍为提案。

配色细化规则与 Before / After / Why 见[color-policy.md](color-policy.md)；本轮颜色验证与导出摘要见[finalverification.json](output/finalverification.json)。

此前双语版本收口（历史记录，本次未重跑22项）：22/22既有浏览器检查＋6/6颜色/EN-BM局部演示检查通过；最低已测语义文字/图标对比5.30:1。两种语言源码页320px无页面横向溢出，独立HTML离线可用。最终摘要含产物SHA-256及早期失败/重试原因，见[finalverification.json](output/finalverification.json)。

本次三语扩展：仅新增 zh-Hans-MY 草稿文案及现有选择器选项；中文暂按简体处理。首次使用询问语言、设置中更改仅为未来设计说明，未实现。当前专项验证和新HTML哈希见 [localized-verification.json](output/localized-verification.json)；此前22项报告及旧产物哈希保留为历史证据。

三语版本已由主任务验收（2026-09-11）：主任务检查中文截图并接受9/9专项结果。收口时重新计算独立HTML的SHA-256，与当前报告一致，且导出与构建HTML逐字节一致；哈希唯一记录为 [localized-verification.json](output/localized-verification.json) 的 `artifact.sha256`。本次收口仅核对产物与文档，未重跑测试。语言偏好流程规格由主任务维护于 [localization-v1.md](../localization-v1.md)，此处不宣称已有引导流程实现。

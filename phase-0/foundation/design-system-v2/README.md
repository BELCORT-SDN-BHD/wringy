# Wringy设计系统v2 · Linear页面模式＋官方shadcn

2026-09-11。当前用户约束：**组件、状态和设计系统严格采用Linear＋shadcn；仅配色使用已接受的Wringy方案。** 本版承接此范围，替代v1自定义视觉/组件/动效契约的执行地位；v1保持只读历史与业务引用。

## 根合同

2026-09-14创办人确认：商家／投放方、Content creator、运营Admin三种角色共用同一套设计系统。共享颜色、字体、基础组件、交互状态及三语规范；角色差异体现为导航、信息层级、任务流程及操作权限，不另建三套组件皮肤。相同业务状态跨角色保持含义一致；业务权限仍需在服务端执行，不能只靠界面隐藏。此为设计方向确认，不代表三方页面或权限系统已经实现。

| 层次 | 唯一执行依据 | 可以做什么 |
|---|---|---|
| 组件源码、样式与基础行为 | 官方shadcn的Radix/Nova，项目配置见[components.json](app/components.json) | 通过官方CLI取得源码；用官方props、variant和组合示例 |
| 页面结构 | [7张Linear参考记录](reference-contract.md#linear) | 列表、筛选、空结果、设置与创建弹窗的对象关系；不推测专有设计系统 |
| 配色 | app配置指定的全局CSS：[src/index.css](app/src/index.css) | 将既有Wringy颜色映射到官方语义颜色变量；组件内不硬编码色值 |
| 业务语义 | [独立领域规则提案](../design-system-v1/domain-states.md) | 状态文字、服务端事实和数据；不把业务规则归于Linear或shadcn |

保持官方默认几何、字体、字号、圆角、阴影、图标规则、焦点、手势及动画；不迁入v1的44px统一触控尺寸、3px焦点几何、120/180ms时长或Emil自定义缓动。官方预设与生成源码优先；技能是使用辅助，不能据此重新发明动效或第三套UI。布局仅为官方组件编排，可用普通容器定位，不得借布局类覆盖组件内部样式。

不增加自定义Badge/Button/Alert变体，不重建`.wringy-*`组件皮肤；官方无对应能力的富文本、专业播放器、媒体批注等保留明确缺口。官方库自带或声明的依赖允许由CLI安装；这不等于授权任意社区组件库。

## 阅读顺序

1. [reference-contract.md](reference-contract.md)：来源、优先级、7张Linear模式和数量口径。
2. [component-map.md](component-map.md)：官方目录索引、CLI对账和原103需求族迁移。
3. [state-policy.md](state-policy.md)：原生/官方props、组合状态和业务标签边界。
4. [handoff.md](handoff.md)：Belcort按官方源码维护的流程及待验证清单。

## 交付入口与验证

文档覆盖：64个官方总目录入口与61条CLI搜索快照已对账，原103需求族均有去向；这些不是实际安装或上线数量。已读取app配置中的`radix-nova`、CSS路径和别名，并核对当前61个UI源码文件与[来源快照](app/provenance/official-snapshot.json)成员一致，含Questionnaire而无legacy Form；显示及行为验收另计。

- 独立展示文件：[Wringy-Design-System.html](output/Wringy-Design-System.html)。这是导出产物，修改应回到[app/维护源码](app/)，不要直接编辑HTML。
- 重新导出：在app目录运行`npm run export`，生成上述文件。具体步骤见[handoff.md](handoff.md)。
- 开发预览：[localhost:8878](http://localhost:8878)，仅在本地服务运行时可用；分发展示使用独立HTML。
- 官方文档、Mobbin等外部链接需要互联网；本地示例没有生产API、真实认证或付款接入。

主任务已通过CUA界面操作观察到Dialog打开后的焦点及Escape关闭回焦；这是该场景的人工观察，不代表所有浮层或全部props都已验证。自动化范围与结果以[浏览器报告](output/browser-verification.json)的`checkedAt`、`result`、逐项checks及limitations为准；报告文件存在不等于通过，主任务最终核验摘要单独收口。本版不宣称全状态穷尽、像素级复刻Linear或生产完成，商业规则仍为提案。

## 最终验收 · 2026-09-11

[此前双语版本验证记录](output/verification.json)：类型检查与构建通过，22/22项浏览器检查通过；64个入口在320px无页面横向溢出，独立HTML离线挂载64项并加载内嵌字体。61/61份官方UI源码一致，全局CSS仅31个既有浅色颜色变量与12个具名语义颜色变量变化；CSS其余部分不变。主任务另实测Dialog和命令弹窗打开/关闭。具体状态覆盖以逐项报告为准，不宣称穷尽所有属性组合。

维护源码在[app/](app/)；浏览器测试运行方法见[测试说明](app/tests/README.md)。本轮采用官方双滑块范围示例，其Minimum/Maximum名称配中文上下文；当前封装未暴露单滑块名称接口，不修改官方文件补接口。商业规则仍为提案。

配色细化规则与 Before / After / Why 见[color-policy.md](color-policy.md)；本轮颜色验证与导出摘要见[finalverification.json](output/finalverification.json)。

产品语言基础另见[localization-v1.md](../localization-v1.md)；本演示仅在配色示例切换 English / Bahasa Melayu / 简体中文，不代表全平台已翻译。

此前双语版本收口（历史记录，本次未重跑22项）：22/22既有浏览器检查＋6/6颜色/EN-BM局部演示检查通过；最低已测语义文字/图标对比5.30:1。两种语言源码页320px无页面横向溢出，独立HTML离线可用。最终摘要含产物SHA-256及早期失败/重试原因，见[finalverification.json](output/finalverification.json)。

本次三语扩展：仅新增 zh-Hans-MY 草稿文案及现有选择器选项；中文暂按简体处理。首次使用询问语言、设置中更改仅为未来设计说明，未实现。当前专项验证和新HTML哈希见 [localized-verification.json](output/localized-verification.json)；此前22项报告及旧产物哈希保留为历史证据。

三语版本已由主任务验收（2026-09-11）：主任务检查中文截图并接受9/9专项结果。收口时重新计算独立HTML的SHA-256，与当前报告一致，且导出与构建HTML逐字节一致；哈希唯一记录为 [localized-verification.json](output/localized-verification.json) 的 `artifact.sha256`。本次收口仅核对产物与文档，未重跑测试。语言偏好流程规格由主任务维护于 [localization-v1.md](../localization-v1.md)，此处不宣称已有引导流程实现。

## 已批准 Wokiee 标志与品牌迁移交接 · 2026-09-23

[共享品牌源与交接说明](brand/README.md)保存已批准的 Wokiee 标志包、A 字标字体信息及官网消费约定。创办人已要求品牌从 Wringy 改为 Wokiee；完整设计系统与产品更名由另一个主仓库会话处理。本次只建立标志唯一来源，不改变既有配色、字体、组件或产品界面。

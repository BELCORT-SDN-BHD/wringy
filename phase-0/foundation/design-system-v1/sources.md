# 设计依据与可验证边界

访问及查看日期：2026-09-11。本稿是Wringy独立设计系统，不是Ramp或Linear官方库的复制品。

## 本次实际查看的Mobbin图片

| 来源 | 可直接观察 | 采用方式与不能证明的事 |
| --- | --- | --- |
| [Linear筛选入口](https://mobbin.com/screens/ed670cda-0527-4716-a1a6-0159f12c4f42) | 连续列表、工具条、按属性分组的筛选菜单 | 工作区采用清晰对象层级；截图不能证明按键、焦点和关闭行为 |
| [Linear优先级子菜单](https://mobbin.com/screens/2579f037-4e90-4330-ac35-19323ca9828a) | 父菜单保留、子菜单展示属性选项 | 多级选项要保持上下文；不强制Wringy所有选择器使用嵌套菜单 |
| [Linear筛选无结果](https://mobbin.com/screens/90b0ca17-b70a-425c-b28b-ce934231b2b9) | 已选条件仍在、中央说明、清除筛选动作 | 无匹配和首次空白分别设计；不把已有数据说成不存在 |
| [Linear设置核验](https://mobbin.com/screens/39d051e4-a17d-467a-8175-ada50840a5da) | 限宽字段、配置步骤、逐条未核验记录 | 待核验是异步状态，不能标成字段格式错误 |
| [Linear设置处理中反馈](https://mobbin.com/screens/eaeb74cb-3246-4f80-8b0c-7b0156c44a9e) | 原表单保留、右下角核验说明 | 反馈具体说明系统在做什么；截图不能证明Toast计时和读屏播报 |
| [Linear空白创建弹窗](https://mobbin.com/screens/60fb29a7-f5c7-4df0-a7bc-6290d3f0ec93) | 标题、描述、属性、取消入口和单个主动作 | 短任务集中在一个弹窗；不把复杂活动配置全部塞进小弹窗 |
| [Linear已填写创建弹窗](https://mobbin.com/screens/7d2d62c7-8fb9-40d8-bd36-f1a8ff0a860c) | 文本填写后结构稳定，属性处于次级层级 | 保持表单布局，不因内容增长移动主要操作 |
| [Ramp产品展示](https://mobbin.com/sites/sections/6f980550-08bd-41cd-8789-499be8ccd6fc) | 白底大标题、宽松灰色展示面、产品说明和界面片段 | 品牌展示留白充分；不以此推算真实后台控件密度 |
| [Ramp产品族目录](https://mobbin.com/sites/sections/bc483029-6ba0-43c1-b8b8-902ad8297853) | 小图标、短说明、开放排列 | 导航不必每项包一个大卡片；不复制图标商标 |
| [Ramp开发能力区块](https://mobbin.com/sites/sections/b54966b6-e31a-4e18-af6a-80810799c008) | 浅底、三列白色内容块、统一图标位置 | 对等能力可用规整网格；不是每个工作流都适合卡片 |

检索设置表单的结果是异步核验，不是表单错误。未以检索词代替图片观察。本次7张Linear、3张Ramp用于补充既有研究，不与历史数量相加冒充新覆盖率。

历史详细观察：[visual-v3研究入口](../../research/visual-v3/README.md)。该轮记录61个Ramp区块和93张Linear图片；用户指定Ramp目录的精确65项成员关系仍未验证。完整覆盖该目录与完成Wringy独立设计规范是不同事项。

## 行为与无障碍依据

| 来源 | 对本稿的作用 |
| --- | --- |
| [W3C APG组件模式](https://www.w3.org/WAI/ARIA/apg/patterns/) | 使用可识别的组件语义；原生控件优先；复杂控件查对应键盘模式 |
| [W3C Modal Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | 模态内管理焦点、Escape退出、关闭后回到合理位置；破坏性确认优先聚焦安全动作 |
| [W3C Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) | 标签与面板关联；方向键移动；需要等待内容时采用手动激活 |
| [WCAG 2.2快速参考](https://www.w3.org/WAI/WCAG22/quickref/) | 对比度、键盘、焦点可见且不被遮挡、重排、错误识别等验收依据；并非已取得符合性认证 |
| [WCAG目标尺寸最低要求](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | AA最低要求以24×24 CSS像素及例外/间距规则判断；Wringy自行采用44px主要触控目标，不将44px误称为AA唯一要求 |
| [MDN减弱动效](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) | 读取用户系统偏好，取消空间移动；保留理解状态所需的静态反馈 |
| [Emil Design Engineering技能](${HOME}/.agents/skills/emil-design-eng/SKILL.md) | 高效的键盘操作、按压反馈、触屏hover隔离、可中断过渡、Toast细节 |

Emil原文件绝对路径：`${HOME}/.agents/skills/emil-design-eng/SKILL.md`。上方技能属于本地行为依据，不是独立实测报告。静态参考没有时长、曲线或API证据；这些值属于Wringy独立提案。是否使用GPU取决于具体浏览器与页面，不将任意CSS动画一概称为硬件加速。

## 业务来源

- [产品总图](../product-map.md)：12板块、168条功能与边界研究，不是168个同等规模的已批准需求。
- [商业模式](../business-model-v2.md)：Creator Rewards切入及预算／收费分离。
- [审核设计](../review-design-v1.md)：内容、计量、奖励、付款与证据责任。
- [审核机制研究](../../research/review-mechanisms-v1/findings.md)：外部平台事实不能直接变成Wringy规则。
- [创始人输入](../../founder-inputs.md)：本次设计系统制作授权与已认可视觉。

演示人物、活动、数值均为模拟。费率、CPM、审核期限和风险阈值不因进入组件而获得批准。研究页面可能更新，业务冻结时应再核验。

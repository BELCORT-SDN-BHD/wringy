# 参考与来源合同

2026-09-11。用户最新指令高于旧版设计提案：只使用Linear页面模式与官方shadcn；Wringy仅提供已接受的配色。

## 来源优先级

1. 当前范围约束；不因技能允许自定义/社区库而扩大范围。
2. 本项目官方Radix/Nova安装源码与其CLI/依赖锁定记录；官方Radix文档解释API。页面默认跳Base UI时必须切换版本。
3. Linear的已记录页面图样：只决定对象与页面关系，不推导控件源码、键盘时序、精确几何或完整专有设计系统。
4. 旧v1仅保留配色溯源和独立业务契约；v1自行设计的控件矩阵、字体、尺寸、触控最小值和Emil动效不再是执行依据。

组件与底层行为发生疑问时，先核对当前源码和对应官方文档；不以“更精致”为由覆盖官方行为。普通网页布局与业务数据编排不称为新增组件库。

## shadcn官方与本地证据

| 来源 | 本次用途及证据限制 |
|---|---|
| [官方总目录](https://ui.shadcn.com/docs/components) | 本轮网页去重64个入口；菜单随base变化，不等于64个独立源码文件 |
| [Theming](https://ui.shadcn.com/docs/theming) | 用语义变量的背景/前景配对改变颜色；本任务不采用文档允许但用户未要求的字体/半径扩展 |
| [CLI](https://ui.shadcn.com/docs/cli) | search、docs、view、add及dry-run/diff；不手取raw源码替换 |
| [Radix Button](https://ui.shadcn.com/docs/components/radix/button)、[Field](https://ui.shadcn.com/docs/components/radix/field) | 官方组件与原生属性组合；无效/禁用/忙碌不是通用自定义状态枚举 |
| [Radix Dialog](https://ui.shadcn.com/docs/components/radix/dialog)、[Alert Dialog](https://ui.shadcn.com/docs/components/radix/alert-dialog) | 输入任务与重要动作确认分别使用官方结构 |
| [Data Table](https://ui.shadcn.com/docs/components/radix/data-table)、[Date Picker](https://ui.shadcn.com/docs/components/radix/date-picker)、[Typeset](https://ui.shadcn.com/docs/typeset) | 前两项为官方组合指南，后一项为排版指南；不计入UI源码文件数 |
| [Questionnaire](https://ui.shadcn.com/docs/components/radix/questionnaire) | 官方提供Radix版本与安装入口；已在实际文件清单核到questionnaire.tsx，不能因搜索未列而称不支持 |
| [Radix Toast](https://ui.shadcn.com/docs/components/radix/toast)、[Sonner](https://ui.shadcn.com/docs/components/radix/sonner)、[Forms](https://ui.shadcn.com/docs/forms) | Radix Toast页指向Sonner；当前表单走Field；不把legacy Form检索项强做一个空演示 |
| [项目配置](app/components.json) | 已读取radix-nova、lucide、src/index.css和UI别名；与项目内CLI info结果一致 |
| [官方来源快照](app/provenance/official-snapshot.json) | 实施方记录CLI4.21.0、radix-nova来源模板与逐文件摘要；本轮核对文件成员，不当成全部交互验收 |
| [源码基线副本](app/provenance/official-ui/)与[实施方静态检查](app/provenance/verification.json) | 可用于对照官方基线；报告只说明其已检查范围，不证明页面、读屏或实际业务完成 |
| [独立HTML](output/Wringy-Design-System.html)与[维护源app/](app/) | HTML由app的`npm run export`产生，不是另一套手工实现；外部参考链接需要互联网 |
| [自动化浏览器报告](output/browser-verification.json) | 以检查时间、逐项结果与限制确定实际覆盖；报告存在不等于通过，不宣称穷尽所有props/组合状态 |
| [shadcn技能](${HOME}/.agents/skills/shadcn/SKILL.md) | 本轮已读取的操作辅助；与新范围或对应版本官方文档冲突时不据旧示例扩展实现 |

CLI4.21.0初次未配置目录的search返回61项，含form、不含questionnaire；**当前app真实61个TSX文件恰好数量相同，但成员不同**：含questionnaire、不含form。官方总目录将Toast映射为Radix Sonner后，剩下61个对应UI文件＋Data Table/Date Picker/Typography三个指南入口＝64。检索清单、风格专属文件、网页演示完成度必须分开记录。全部成员及文件路径见[component-map.md](component-map.md)。

初次在项目外运行docs得到Base链接，并对data-table报“not found”；随后项目内info确认base=radix，docs返回正确Radix链接。这个诊断证明“未找到注册条目”不能推断“官方没有该指南”。本轮只精选核查文档正文，不声称逐页检查64个API或所有示例。

<a id="linear"></a>

## Linear：7张页面模式记录

以下承接[v1/sources.md的七张Linear记录](../design-system-v1/sources.md)，记录日期2026-09-11；本轮读取其来源与观察，不把历史查看写成本轮重新实测图片交互。仅使用下列Linear条目；该旧文件中的Ramp/Emil来源不进入v2组件或动效依据。

| 模式来源 | 页面采用范围 | 不据此推断 |
|---|---|---|
| [筛选入口](https://mobbin.com/screens/ed670cda-0527-4716-a1a6-0159f12c4f42) | 列表工具条、按属性找条件；由官方DropdownMenu/Checkbox组合 | 菜单键盘与关闭时机 |
| [优先级子菜单](https://mobbin.com/screens/2579f037-4e90-4330-ac35-19323ca9828a) | 有真实层级时保留父项上下文；官方子菜单结构 | 每种选择器都要嵌套 |
| [筛选无结果](https://mobbin.com/screens/90b0ca17-b70a-425c-b28b-ce934231b2b9) | 保留筛选，使用Empty说明与清除动作 | 后端没有对象或请求成功 |
| [设置核验](https://mobbin.com/screens/39d051e4-a17d-467a-8175-ada50840a5da) | 连续字段和核验记录，用Field/Item/Badge呈现 | 待核验是输入格式错误 |
| [设置处理中](https://mobbin.com/screens/eaeb74cb-3246-4f80-8b0c-7b0156c44a9e) | 原表单保留，明确处理提示；使用官方反馈组件 | Toast持续时间、读屏播报或GPU性能 |
| [空白创建弹窗](https://mobbin.com/screens/60fb29a7-f5c7-4df0-a7bc-6290d3f0ec93) | 短任务标题、正文、属性和主次动作；官方Dialog | 完整活动流程都适合弹窗 |
| [已填写创建弹窗](https://mobbin.com/screens/7d2d62c7-8fb9-40d8-bd36-f1a8ff0a860c) | 内容与属性维持清楚层级，延续同一官方Dialog组成 | 官方字体、像素值或状态全量清单 |

不下载或重新分发Mobbin原图，不使用Linear/Ramp商标冒充Wringy品牌，不宣称拥有Linear内部设计系统源文件。页面模式与官方基础组件分别有来源，不能合称“完整克隆Linear”。

## 配色与业务边界

当前颜色映射读[app/src/index.css](app/src/index.css)，来源记录见[palette.json](app/provenance/palette.json)；本文不再复制一份色值表。官方字体、几何和动画保持预设默认。暗色/品牌模式是否开放与验证范围以实施方记录为准，不从旧v1主题说明继承承诺。

业务只链接[v1/domain-states.md](../design-system-v1/domain-states.md)。内容、计量、奖励、付款、风险的独立事实及D01/D06等未决方法不是UI来源，也不属于Linear/shadcn的金融政策。将其文字放入官方Badge/Alert不代表官方提供支付、风控、计量或法律能力。

## 人工观察与运行证据

主任务在本轮CUA界面操作中已观察Dialog的初始焦点、Escape关闭及回到触发点；本记录明确来源为主任务观察，不冒充文档worker重新操作或全设备验证。自动化以[output/browser-verification.json](output/browser-verification.json)为准，最终核验摘要由主任务收口。HTML/源码均为本地组件展示，没有生产API、实际身份核验或资金执行能力。

本轮配色允许的12个新增颜色变量、局部props绑定及Linear图像引用见[color-policy.md](color-policy.md#source-contract)。其余官方CSS与61份组件源码保持不变。

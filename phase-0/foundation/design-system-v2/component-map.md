# 官方组件目录与旧需求映射

2026-09-11。此处是官方来源索引和迁移映射，不是新的103族自研组件库。安装覆盖、页面演示覆盖与本表映射分别计数，不能互相替代。

## 三种数量的口径

- 官方总目录本轮读取去重后为64个文档入口；不把页面子组件、variant、尺寸或状态分别加总。
- CLI 4.21.0本轮 `search @shadcn -t ui -l 100` 返回61个条目。这是指定检索快照，不是所有底层库/样式的最终可安装数，更不是已安装数。
- 旧目录103个需求族全部映射在下表。实际`radix-nova`已核对61个UI源码文件，含questionnaire、不含form；展示入口见[独立HTML](output/Wringy-Design-System.html)，行为覆盖与结果见[浏览器报告](output/browser-verification.json)，不从源码存在推断全部通过。该数字只描述当前文件快照，不锁定未来版本总数。

64与61的集合差：文档独有Data Table、Date Picker、Questionnaire、Toast、Typography；CLI独有form、sonner。Data Table/Date Picker是官方组合指南；Questionnaire已有Radix文档、安装命令和本项目源码，搜索漏列不证明不可安装；Typography转Typeset；Toast在Base UI与Radix Sonner承担同一用途，Radix旧Toast页提示改用Sonner。form保留检索记录，当前表单优先Field和Forms指南。这些差异不是“缺了3个组件”。当前实际目录与[官方来源快照](app/provenance/official-snapshot.json)成员集合一致：将总目录Toast对应为Radix Sonner后，61个UI文件＋3个指南入口（Data Table、Date Picker、Typography）＝64。最初搜索61与实际文件61同数不同成员，不能混用。

## 官方来源索引

每行对照文档/初次搜索与当前app源码；源码存在不表示页面已演示或交互已验收。普通组件链接明确指向Radix版本；Typeset/Forms保留实际入口。注册条目由CLI在app配置下解析为源码，**不手抄GitHub文件、不改造官方样式**。下表列64个总目录入口，再列2个CLI补充来源，仅作去重对账。

| 文档入口 | 初次CLI搜索 | 当前app源码/指南 | 官方源码或组合入口 | 使用边界 |
|---|---|---|---|---|
| [Accordion](https://ui.shadcn.com/docs/components/radix/accordion) | 列出 | [accordion.tsx](app/src/components/ui/accordion.tsx) | `@shadcn/accordion`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Alert](https://ui.shadcn.com/docs/components/radix/alert) | 列出 | [alert.tsx](app/src/components/ui/alert.tsx) | `@shadcn/alert`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Alert Dialog](https://ui.shadcn.com/docs/components/radix/alert-dialog) | 列出 | [alert-dialog.tsx](app/src/components/ui/alert-dialog.tsx) | `@shadcn/alert-dialog`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Aspect Ratio](https://ui.shadcn.com/docs/components/radix/aspect-ratio) | 列出 | [aspect-ratio.tsx](app/src/components/ui/aspect-ratio.tsx) | `@shadcn/aspect-ratio`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Attachment](https://ui.shadcn.com/docs/components/radix/attachment) | 列出 | [attachment.tsx](app/src/components/ui/attachment.tsx) | `@shadcn/attachment`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Avatar](https://ui.shadcn.com/docs/components/radix/avatar) | 列出 | [avatar.tsx](app/src/components/ui/avatar.tsx) | `@shadcn/avatar`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Badge](https://ui.shadcn.com/docs/components/radix/badge) | 列出 | [badge.tsx](app/src/components/ui/badge.tsx) | `@shadcn/badge`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Breadcrumb](https://ui.shadcn.com/docs/components/radix/breadcrumb) | 列出 | [breadcrumb.tsx](app/src/components/ui/breadcrumb.tsx) | `@shadcn/breadcrumb`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Bubble](https://ui.shadcn.com/docs/components/radix/bubble) | 列出 | [bubble.tsx](app/src/components/ui/bubble.tsx) | `@shadcn/bubble`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Button](https://ui.shadcn.com/docs/components/radix/button) | 列出 | [button.tsx](app/src/components/ui/button.tsx) | `@shadcn/button`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Button Group](https://ui.shadcn.com/docs/components/radix/button-group) | 列出 | [button-group.tsx](app/src/components/ui/button-group.tsx) | `@shadcn/button-group`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Calendar](https://ui.shadcn.com/docs/components/radix/calendar) | 列出 | [calendar.tsx](app/src/components/ui/calendar.tsx) | `@shadcn/calendar`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Card](https://ui.shadcn.com/docs/components/radix/card) | 列出 | [card.tsx](app/src/components/ui/card.tsx) | `@shadcn/card`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Carousel](https://ui.shadcn.com/docs/components/radix/carousel) | 列出 | [carousel.tsx](app/src/components/ui/carousel.tsx) | `@shadcn/carousel`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Chart](https://ui.shadcn.com/docs/components/radix/chart) | 列出 | [chart.tsx](app/src/components/ui/chart.tsx) | `@shadcn/chart`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Checkbox](https://ui.shadcn.com/docs/components/radix/checkbox) | 列出 | [checkbox.tsx](app/src/components/ui/checkbox.tsx) | `@shadcn/checkbox`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Collapsible](https://ui.shadcn.com/docs/components/radix/collapsible) | 列出 | [collapsible.tsx](app/src/components/ui/collapsible.tsx) | `@shadcn/collapsible`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Combobox](https://ui.shadcn.com/docs/components/radix/combobox) | 列出 | [combobox.tsx](app/src/components/ui/combobox.tsx) | `@shadcn/combobox`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Command](https://ui.shadcn.com/docs/components/radix/command) | 列出 | [command.tsx](app/src/components/ui/command.tsx) | `@shadcn/command`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Context Menu](https://ui.shadcn.com/docs/components/radix/context-menu) | 列出 | [context-menu.tsx](app/src/components/ui/context-menu.tsx) | `@shadcn/context-menu`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Data Table](https://ui.shadcn.com/docs/components/radix/data-table) | 未列出 | 指南组合 | 官方Data Table指南；Table＋TanStack Table | C：官方组合，不存在本次同名UI检索条目 |
| [Date Picker](https://ui.shadcn.com/docs/components/radix/date-picker) | 未列出 | 指南组合 | 官方Date Picker指南；Calendar＋Popover | C：官方组合，日期/时区业务含义另管 |
| [Dialog](https://ui.shadcn.com/docs/components/radix/dialog) | 列出 | [dialog.tsx](app/src/components/ui/dialog.tsx) | `@shadcn/dialog`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Direction](https://ui.shadcn.com/docs/components/radix/direction) | 列出 | [direction.tsx](app/src/components/ui/direction.tsx) | `@shadcn/direction`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Drawer](https://ui.shadcn.com/docs/components/radix/drawer) | 列出 | [drawer.tsx](app/src/components/ui/drawer.tsx) | `@shadcn/drawer`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Dropdown Menu](https://ui.shadcn.com/docs/components/radix/dropdown-menu) | 列出 | [dropdown-menu.tsx](app/src/components/ui/dropdown-menu.tsx) | `@shadcn/dropdown-menu`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Empty](https://ui.shadcn.com/docs/components/radix/empty) | 列出 | [empty.tsx](app/src/components/ui/empty.tsx) | `@shadcn/empty`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Field](https://ui.shadcn.com/docs/components/radix/field) | 列出 | [field.tsx](app/src/components/ui/field.tsx) | `@shadcn/field`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Hover Card](https://ui.shadcn.com/docs/components/radix/hover-card) | 列出 | [hover-card.tsx](app/src/components/ui/hover-card.tsx) | `@shadcn/hover-card`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Input](https://ui.shadcn.com/docs/components/radix/input) | 列出 | [input.tsx](app/src/components/ui/input.tsx) | `@shadcn/input`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Input Group](https://ui.shadcn.com/docs/components/radix/input-group) | 列出 | [input-group.tsx](app/src/components/ui/input-group.tsx) | `@shadcn/input-group`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Input OTP](https://ui.shadcn.com/docs/components/radix/input-otp) | 列出 | [input-otp.tsx](app/src/components/ui/input-otp.tsx) | `@shadcn/input-otp`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Item](https://ui.shadcn.com/docs/components/radix/item) | 列出 | [item.tsx](app/src/components/ui/item.tsx) | `@shadcn/item`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Kbd](https://ui.shadcn.com/docs/components/radix/kbd) | 列出 | [kbd.tsx](app/src/components/ui/kbd.tsx) | `@shadcn/kbd`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Label](https://ui.shadcn.com/docs/components/radix/label) | 列出 | [label.tsx](app/src/components/ui/label.tsx) | `@shadcn/label`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Marker](https://ui.shadcn.com/docs/components/radix/marker) | 列出 | [marker.tsx](app/src/components/ui/marker.tsx) | `@shadcn/marker`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Menubar](https://ui.shadcn.com/docs/components/radix/menubar) | 列出 | [menubar.tsx](app/src/components/ui/menubar.tsx) | `@shadcn/menubar`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Message](https://ui.shadcn.com/docs/components/radix/message) | 列出 | [message.tsx](app/src/components/ui/message.tsx) | `@shadcn/message`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Message Scroller](https://ui.shadcn.com/docs/components/radix/message-scroller) | 列出 | [message-scroller.tsx](app/src/components/ui/message-scroller.tsx) | `@shadcn/message-scroller`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Native Select](https://ui.shadcn.com/docs/components/radix/native-select) | 列出 | [native-select.tsx](app/src/components/ui/native-select.tsx) | `@shadcn/native-select`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Navigation Menu](https://ui.shadcn.com/docs/components/radix/navigation-menu) | 列出 | [navigation-menu.tsx](app/src/components/ui/navigation-menu.tsx) | `@shadcn/navigation-menu`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Pagination](https://ui.shadcn.com/docs/components/radix/pagination) | 列出 | [pagination.tsx](app/src/components/ui/pagination.tsx) | `@shadcn/pagination`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Popover](https://ui.shadcn.com/docs/components/radix/popover) | 列出 | [popover.tsx](app/src/components/ui/popover.tsx) | `@shadcn/popover`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Progress](https://ui.shadcn.com/docs/components/radix/progress) | 列出 | [progress.tsx](app/src/components/ui/progress.tsx) | `@shadcn/progress`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Questionnaire](https://ui.shadcn.com/docs/components/radix/questionnaire) | 未列出 | [questionnaire.tsx](app/src/components/ui/questionnaire.tsx) | 官方Radix文档：`add questionnaire` | 已核对questionnaire.tsx；初次搜索遗漏；行为验收另计 |
| [Radio Group](https://ui.shadcn.com/docs/components/radix/radio-group) | 列出 | [radio-group.tsx](app/src/components/ui/radio-group.tsx) | `@shadcn/radio-group`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Resizable](https://ui.shadcn.com/docs/components/radix/resizable) | 列出 | [resizable.tsx](app/src/components/ui/resizable.tsx) | `@shadcn/resizable`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Scroll Area](https://ui.shadcn.com/docs/components/radix/scroll-area) | 列出 | [scroll-area.tsx](app/src/components/ui/scroll-area.tsx) | `@shadcn/scroll-area`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Select](https://ui.shadcn.com/docs/components/radix/select) | 列出 | [select.tsx](app/src/components/ui/select.tsx) | `@shadcn/select`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Separator](https://ui.shadcn.com/docs/components/radix/separator) | 列出 | [separator.tsx](app/src/components/ui/separator.tsx) | `@shadcn/separator`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Sheet](https://ui.shadcn.com/docs/components/radix/sheet) | 列出 | [sheet.tsx](app/src/components/ui/sheet.tsx) | `@shadcn/sheet`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Sidebar](https://ui.shadcn.com/docs/components/radix/sidebar) | 列出 | [sidebar.tsx](app/src/components/ui/sidebar.tsx) | `@shadcn/sidebar`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Skeleton](https://ui.shadcn.com/docs/components/radix/skeleton) | 列出 | [skeleton.tsx](app/src/components/ui/skeleton.tsx) | `@shadcn/skeleton`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Slider](https://ui.shadcn.com/docs/components/radix/slider) | 列出 | [slider.tsx](app/src/components/ui/slider.tsx) | `@shadcn/slider`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Spinner](https://ui.shadcn.com/docs/components/radix/spinner) | 列出 | [spinner.tsx](app/src/components/ui/spinner.tsx) | `@shadcn/spinner`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Switch](https://ui.shadcn.com/docs/components/radix/switch) | 列出 | [switch.tsx](app/src/components/ui/switch.tsx) | `@shadcn/switch`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Table](https://ui.shadcn.com/docs/components/radix/table) | 列出 | [table.tsx](app/src/components/ui/table.tsx) | `@shadcn/table`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Tabs](https://ui.shadcn.com/docs/components/radix/tabs) | 列出 | [tabs.tsx](app/src/components/ui/tabs.tsx) | `@shadcn/tabs`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Textarea](https://ui.shadcn.com/docs/components/radix/textarea) | 列出 | [textarea.tsx](app/src/components/ui/textarea.tsx) | `@shadcn/textarea`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Toast](https://ui.shadcn.com/docs/components/radix/toast) | 未列出 | [sonner.tsx](app/src/components/ui/sonner.tsx) | Base Toast；本项目走`@shadcn/sonner` | Radix Toast已弃用；与Sonner同用途，不算缺失 |
| [Toggle](https://ui.shadcn.com/docs/components/radix/toggle) | 列出 | [toggle.tsx](app/src/components/ui/toggle.tsx) | `@shadcn/toggle`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Toggle Group](https://ui.shadcn.com/docs/components/radix/toggle-group) | 列出 | [toggle-group.tsx](app/src/components/ui/toggle-group.tsx) | `@shadcn/toggle-group`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Tooltip](https://ui.shadcn.com/docs/components/radix/tooltip) | 列出 | [tooltip.tsx](app/src/components/ui/tooltip.tsx) | `@shadcn/tooltip`；CLI在app中解析源码 | Radix/Nova源码已核对存在；行为验收另计 |
| [Typography](https://ui.shadcn.com/docs/typeset) | 未列出 | 指南组合 | Typeset官方排版指南 | 非独立TSX组件；保持官方默认字体与排版 |
| [Form（历史入口）](https://ui.shadcn.com/docs/forms) | 列出 | 无form.tsx；Field替代 | `@shadcn/form`检索记录；Forms/Field指南 | 无legacy form.tsx；Form演示复用Field，不另算组件 |
| [Sonner](https://ui.shadcn.com/docs/components/radix/sonner) | 列出 | [sonner.tsx](app/src/components/ui/sonner.tsx) | `@shadcn/sonner`；CLI在app中解析源码 | 本项目Radix的短暂反馈；不是额外业务组件 |

## 103个旧需求族逐项去向

O＝直接使用官方组件；C＝官方组件/官方示例组合与应用数据；N＝必要HTML内容或配置所选图标，非新增UI库；G＝只能呈现部分内容，缺少等价官方专项能力。G项不私自引入社区库或手工补一个新控件。C不表示官方提供业务流程，亦不表示已实现。

旧视觉、手势、字号、时长与通用状态枚举全部不自动迁入；以本版[state-policy](state-policy.md)及官方基线为准。业务字段与决定仍引用[独立领域契约](../design-system-v1/domain-states.md)，不声称它们是Linear/shadcn金融规则。

| 旧需求ID / 名称 | 归类 | 官方组件或组合 | 保留范围与实际缺口 |
|---|---|---|---|
| `button` · 按钮 | O | [Button](https://ui.shadcn.com/docs/components/radix/button) | 官方variant与size；不覆写按压、圆角或字体 |
| `link` · 链接 | C | [Button](https://ui.shadcn.com/docs/components/radix/button) + [Breadcrumb](https://ui.shadcn.com/docs/components/radix/breadcrumb) + [Navigation Menu](https://ui.shadcn.com/docs/components/radix/navigation-menu) | Radix asChild承载真实a；普通链接保留HTML语义 |
| `icon` · 图标 | N | [Button](https://ui.shadcn.com/docs/components/radix/button) | 使用app配置的lucide和官方data-icon；图标库不是新增shadcn组件 |
| `text` · 文本与标题 | N | [Typography](https://ui.shadcn.com/docs/typeset) | Typeset与语义标题/正文；不沿用v1字号表 |
| `avatar` · 头像与身份标识 | O | [Avatar](https://ui.shadcn.com/docs/components/radix/avatar) | 保留AvatarImage与AvatarFallback |
| `badge` · 状态标签 | O | [Badge](https://ui.shadcn.com/docs/components/radix/badge) | 业务文字作为children；只用官方variant |
| `separator` · 分隔与分组 | O | [Separator](https://ui.shadcn.com/docs/components/radix/separator) | 分隔行为按官方默认 |
| `surface` · 工作面与摘要容器 | C | [Card](https://ui.shadcn.com/docs/components/radix/card) | 使用完整Card结构或官方页面布局；不自建卡片皮肤 |
| `shell` · 应用框架 | C | [Sidebar](https://ui.shadcn.com/docs/components/radix/sidebar) + [Breadcrumb](https://ui.shadcn.com/docs/components/radix/breadcrumb) | 官方Sidebar骨架组合内容区域；Linear用于对象层次 |
| `workspace-switcher` · 工作空间切换 | C | [Sidebar](https://ui.shadcn.com/docs/components/radix/sidebar) + [Dropdown Menu](https://ui.shadcn.com/docs/components/radix/dropdown-menu) + [Avatar](https://ui.shadcn.com/docs/components/radix/avatar) | 官方菜单触发器与工作空间数据；切换逻辑不属于UI库 |
| `sidebar` · 侧栏导航 | O | [Sidebar](https://ui.shadcn.com/docs/components/radix/sidebar) | 采用官方默认几何、折叠和移动行为 |
| `breadcrumb` · 面包屑 | O | [Breadcrumb](https://ui.shadcn.com/docs/components/radix/breadcrumb) | 官方层级与链接组成 |
| `tabs` · 页签 | O | [Tabs](https://ui.shadcn.com/docs/components/radix/tabs) | TabsList/Trigger/Content；默认激活和焦点行为不手改 |
| `command-menu` · 快捷命令面板 | C | [Command](https://ui.shadcn.com/docs/components/radix/command) + [Dialog](https://ui.shadcn.com/docs/components/radix/dialog) | CommandDialog官方组成，不套Emil零时长覆写 |
| `stepper` · 步骤导航 | G | [Questionnaire](https://ui.shadcn.com/docs/components/radix/questionnaire) + [Progress](https://ui.shadcn.com/docs/components/radix/progress) + [Field](https://ui.shadcn.com/docs/components/radix/field) + [Button](https://ui.shadcn.com/docs/components/radix/button) | Questionnaire仅用于官方支持的问答；一般业务步骤不是同等官方组件，页面说明不宣称专用Stepper |
| `pagination` · 分页与继续加载 | C | [Pagination](https://ui.shadcn.com/docs/components/radix/pagination) + [Button](https://ui.shadcn.com/docs/components/radix/button) | 官方分页外观；游标请求与总数来自业务 |
| `search` · 搜索框 | C | [Input Group](https://ui.shadcn.com/docs/components/radix/input-group) + [Command](https://ui.shadcn.com/docs/components/radix/command) | 简单查询用InputGroup；命令搜索用Command，不自画搜索控件 |
| `field` · 字段外壳 | O | [Field](https://ui.shadcn.com/docs/components/radix/field) | FieldGroup/FieldLabel/FieldDescription/FieldError |
| `text-input` · 单行输入 | O | [Input](https://ui.shadcn.com/docs/components/radix/input) | type/email/url/tel等原生支持属性 |
| `textarea` · 多行输入 | O | [Textarea](https://ui.shadcn.com/docs/components/radix/textarea) | 保留默认控件样式与原生输入行为 |
| `number-input` · 数量输入 | C | [Input](https://ui.shadcn.com/docs/components/radix/input) + [Field](https://ui.shadcn.com/docs/components/radix/field) | Input的number或文本录入＋单位；不声称有官方货币/高精度计算器 |
| `money-input` · 金额输入 | C | [Input Group](https://ui.shadcn.com/docs/components/radix/input-group) + [Field](https://ui.shadcn.com/docs/components/radix/field) + [Native Select](https://ui.shadcn.com/docs/components/radix/native-select) | 输入与币种展示组合；精度/报价由业务，样式无扩展 |
| `checkbox` · 复选框 | C | [Checkbox](https://ui.shadcn.com/docs/components/radix/checkbox) + [Field](https://ui.shadcn.com/docs/components/radix/field) | checked为boolean或indeterminate；组用FieldSet |
| `radio` · 单选组 | C | [Radio Group](https://ui.shadcn.com/docs/components/radix/radio-group) + [Field](https://ui.shadcn.com/docs/components/radix/field) | RadioGroupItem与字段标签；不改成自制单选卡 |
| `switch` · 即时开关 | C | [Switch](https://ui.shadcn.com/docs/components/radix/switch) + [Field](https://ui.shadcn.com/docs/components/radix/field) | checked/onCheckedChange及disabled按官方API |
| `select` · 选择器 | C | [Select](https://ui.shadcn.com/docs/components/radix/select) + [Combobox](https://ui.shadcn.com/docs/components/radix/combobox) + [Native Select](https://ui.shadcn.com/docs/components/radix/native-select) | 按需求选对应官方实现；Radix Select不伪加multiple |
| `segmented-control` · 分段选择 | O | [Toggle Group](https://ui.shadcn.com/docs/components/radix/toggle-group) | 使用官方single/multiple模式；不循环自画Button选中态 |
| `date-time` · 日期时间选择 | C | [Date Picker](https://ui.shadcn.com/docs/components/radix/date-picker) + [Calendar](https://ui.shadcn.com/docs/components/radix/calendar) + [Input](https://ui.shadcn.com/docs/components/radix/input) + [Native Select](https://ui.shadcn.com/docs/components/radix/native-select) | 官方Date Picker组合；时间/时区为字段与业务值，不重写日历交互 |
| `slider` · 范围滑杆 | O | [Slider](https://ui.shadcn.com/docs/components/radix/slider) | Radix数组value；范围与步长通过官方props |
| `file-upload` · 文件上传 | G | [Input](https://ui.shadcn.com/docs/components/radix/input) + [Attachment](https://ui.shadcn.com/docs/components/radix/attachment) + [Progress](https://ui.shadcn.com/docs/components/radix/progress) | Input type=file与附件展示；完整上传/断点续传服务不由shadcn提供 |
| `rich-editor` · 富文本编辑器 | G | [Textarea](https://ui.shadcn.com/docs/components/radix/textarea) + [Field](https://ui.shadcn.com/docs/components/radix/field) | 当前仅官方文本输入组合；不把Textarea称为富文本编辑器，完整富文本需求保留缺口 |
| `form` · 表单提交容器 | C | [Field](https://ui.shadcn.com/docs/components/radix/field) + [Input](https://ui.shadcn.com/docs/components/radix/input) + [Button](https://ui.shadcn.com/docs/components/radix/button) + [Spinner](https://ui.shadcn.com/docs/components/radix/spinner) | 现代Field体系配官方Forms指南；不新建表单状态库 |
| `filter-builder` · 筛选条件组 | C | [Dropdown Menu](https://ui.shadcn.com/docs/components/radix/dropdown-menu) + [Checkbox](https://ui.shadcn.com/docs/components/radix/checkbox) + [Badge](https://ui.shadcn.com/docs/components/radix/badge) + [Button](https://ui.shadcn.com/docs/components/radix/button) | Linear筛选结构以官方菜单组合；条件表达式由业务 |
| `data-table` · 数据表格 | C | [Data Table](https://ui.shadcn.com/docs/components/radix/data-table) + [Table](https://ui.shadcn.com/docs/components/radix/table) + [Checkbox](https://ui.shadcn.com/docs/components/radix/checkbox) + [Dropdown Menu](https://ui.shadcn.com/docs/components/radix/dropdown-menu) | 官方TanStack Table教程组合，不是单独CLI UI条目 |
| `list-detail` · 列表与详情 | C | [Table](https://ui.shadcn.com/docs/components/radix/table) + [Item](https://ui.shadcn.com/docs/components/radix/item) + [Separator](https://ui.shadcn.com/docs/components/radix/separator) + [Sheet](https://ui.shadcn.com/docs/components/radix/sheet) | Linear列表/详情模式用官方底座；路由和数据选择由应用 |
| `property-list` · 属性清单 | C | [Item](https://ui.shadcn.com/docs/components/radix/item) + [Separator](https://ui.shadcn.com/docs/components/radix/separator) + [Input](https://ui.shadcn.com/docs/components/radix/input) | 标签和值为数据；编辑用官方Input，非自制属性组件库 |
| `metric` · 指标摘要 | C | [Card](https://ui.shadcn.com/docs/components/radix/card) | 官方Card装数据及文字；指标计算由业务 |
| `chart` · 图表 | O | [Chart](https://ui.shadcn.com/docs/components/radix/chart) | 官方Chart及其依赖；数据定义不属于UI样式 |
| `progress` · 进度指示 | C | [Progress](https://ui.shadcn.com/docs/components/radix/progress) + [Spinner](https://ui.shadcn.com/docs/components/radix/spinner) | 有确定值用Progress，否则用Spinner；不编造进度 |
| `skeleton` · 骨架占位 | O | [Skeleton](https://ui.shadcn.com/docs/components/radix/skeleton) | 官方占位组件及默认动画 |
| `empty-state` · 空状态 | C | [Empty](https://ui.shadcn.com/docs/components/radix/empty) + [Button](https://ui.shadcn.com/docs/components/radix/button) | EmptyHeader/Title/Description/Content，按原因提供文字 |
| `alert` · 持久提示 | O | [Alert](https://ui.shadcn.com/docs/components/radix/alert) | 官方Alert与variant；不增加自制warning皮肤 |
| `toast` · 短暂反馈 | O | [Sonner](https://ui.shadcn.com/docs/components/radix/sonner) | Radix用Sonner；不混入Base Toast |
| `notification-inbox` · 通知收件箱 | C | [Item](https://ui.shadcn.com/docs/components/radix/item) + [Badge](https://ui.shadcn.com/docs/components/radix/badge) + [Tabs](https://ui.shadcn.com/docs/components/radix/tabs) + [Scroll Area](https://ui.shadcn.com/docs/components/radix/scroll-area) | 通知数据组合；已读/已处理不是官方状态 |
| `error-recovery` · 错误恢复面 | C | [Alert](https://ui.shadcn.com/docs/components/radix/alert) + [Button](https://ui.shadcn.com/docs/components/radix/button) | 原因/重试文字与业务动作，不新造Error组件皮肤 |
| `tooltip` · 说明提示 | O | [Tooltip](https://ui.shadcn.com/docs/components/radix/tooltip) | 官方延迟、焦点、Portal与默认动效 |
| `popover` · 锚定浮层 | O | [Popover](https://ui.shadcn.com/docs/components/radix/popover) | 官方触发器、定位与关闭行为 |
| `menu` · 操作菜单 | C | [Dropdown Menu](https://ui.shadcn.com/docs/components/radix/dropdown-menu) + [Context Menu](https://ui.shadcn.com/docs/components/radix/context-menu) | 按触发场景选择官方菜单；条目包含在Group内 |
| `dialog` · 模态对话框 | C | [Dialog](https://ui.shadcn.com/docs/components/radix/dialog) + [Alert Dialog](https://ui.shadcn.com/docs/components/radix/alert-dialog) | 输入任务用Dialog；明确重要动作确认用AlertDialog，适用全模块 |
| `drawer` · 抽屉 | C | [Sheet](https://ui.shadcn.com/docs/components/radix/sheet) + [Drawer](https://ui.shadcn.com/docs/components/radix/drawer) | 侧面板用Sheet，底部面板用Drawer；不自行发明手势 |
| `image` · 图片与缩略图 | N | [Aspect Ratio](https://ui.shadcn.com/docs/components/radix/aspect-ratio) | 原生img＋AspectRatio；无自制图片控件与动画 |
| `media-player` · 媒体播放器 | G | [Aspect Ratio](https://ui.shadcn.com/docs/components/radix/aspect-ratio) | 原生audio/video controls可展示；官方无完整专业播放器/外部平台适配器 |
| `file-preview` · 文件预览与下载 | G | [Attachment](https://ui.shadcn.com/docs/components/radix/attachment) + [Button](https://ui.shadcn.com/docs/components/radix/button) | Attachment展示附件，下载为链接；文档渲染器能力另列缺口 |
| `annotation` · 媒体批注 | G | [Message](https://ui.shadcn.com/docs/components/radix/message) + [Textarea](https://ui.shadcn.com/docs/components/radix/textarea) + [Button](https://ui.shadcn.com/docs/components/radix/button) | 可列批注记录；官方无媒体坐标/时间点批注编辑器 |
| `asset-library` · 素材库与选择 | C | [Item](https://ui.shadcn.com/docs/components/radix/item) + [Attachment](https://ui.shadcn.com/docs/components/radix/attachment) + [Checkbox](https://ui.shadcn.com/docs/components/radix/checkbox) | 官方集合、附件及选择控件组合；授权记录仍业务数据 |
| `campaign-brief` · 奖励活动详情 | C | [Card](https://ui.shadcn.com/docs/components/radix/card) + [Item](https://ui.shadcn.com/docs/components/radix/item) + [Badge](https://ui.shadcn.com/docs/components/radix/badge) + [Button](https://ui.shadcn.com/docs/components/radix/button) | 活动目标和条款是内容；不增加Campaign组件样式族 |
| `rule-editor` · 活动规则与版本 | C | [Field](https://ui.shadcn.com/docs/components/radix/field) + [Textarea](https://ui.shadcn.com/docs/components/radix/textarea) + [Input](https://ui.shadcn.com/docs/components/radix/input) + [Table](https://ui.shadcn.com/docs/components/radix/table) | 版本与规则由应用；无新建规则编辑控件 |
| `budget` · 奖励预算面板 | C | [Card](https://ui.shadcn.com/docs/components/radix/card) + [Progress](https://ui.shadcn.com/docs/components/radix/progress) + [Table](https://ui.shadcn.com/docs/components/radix/table) + [Badge](https://ui.shadcn.com/docs/components/radix/badge) | 预算金额与受限原因通过官方组件显示 |
| `submission` · 投稿与公开链接提交 | C | [Field](https://ui.shadcn.com/docs/components/radix/field) + [Input](https://ui.shadcn.com/docs/components/radix/input) + [Attachment](https://ui.shadcn.com/docs/components/radix/attachment) + [Button](https://ui.shadcn.com/docs/components/radix/button) | 提交数据/重复检测由服务；UI仅官方字段组合 |
| `review-workbench` · 内容审核工作台 | C | [Table](https://ui.shadcn.com/docs/components/radix/table) + [Sheet](https://ui.shadcn.com/docs/components/radix/sheet) + [Field](https://ui.shadcn.com/docs/components/radix/field) + [Textarea](https://ui.shadcn.com/docs/components/radix/textarea) + [Badge](https://ui.shadcn.com/docs/components/radix/badge) | Linear列表/详情结构；决定与证据来自业务 |
| `measurement` · 计量快照与核算 | C | [Table](https://ui.shadcn.com/docs/components/radix/table) + [Chart](https://ui.shadcn.com/docs/components/radix/chart) + [Alert](https://ui.shadcn.com/docs/components/radix/alert) + [Badge](https://ui.shadcn.com/docs/components/radix/badge) | 计量、修正和来源是业务信息，不宣称官方计量组件 |
| `reward-breakdown` · 奖励拆解 | C | [Table](https://ui.shadcn.com/docs/components/radix/table) + [Item](https://ui.shadcn.com/docs/components/radix/item) + [Badge](https://ui.shadcn.com/docs/components/radix/badge) + [Alert](https://ui.shadcn.com/docs/components/radix/alert) | 五条事实线分别标注；风险限制不改Badge行为 |
| `creator-progress` · 创作者进度 | C | [Item](https://ui.shadcn.com/docs/components/radix/item) + [Badge](https://ui.shadcn.com/docs/components/radix/badge) + [Alert](https://ui.shadcn.com/docs/components/radix/alert) + [Button](https://ui.shadcn.com/docs/components/radix/button) | 步骤说明与下一动作组合；没有新增通用进度状态机 |
| `bounty` · 独立任务与名额 | C | [Card](https://ui.shadcn.com/docs/components/radix/card) + [Field](https://ui.shadcn.com/docs/components/radix/field) + [Table](https://ui.shadcn.com/docs/components/radix/table) + [Badge](https://ui.shadcn.com/docs/components/radix/badge) | 独立业务规则，复用同一官方控件 |
| `worklog` · 审核工作量与成本 | C | [Input](https://ui.shadcn.com/docs/components/radix/input) + [Field](https://ui.shadcn.com/docs/components/radix/field) + [Table](https://ui.shadcn.com/docs/components/radix/table) | 工时/成本字段组合，不增加计时组件样式 |
| `social-connection` · 社交账号与数据授权 | C | [Item](https://ui.shadcn.com/docs/components/radix/item) + [Avatar](https://ui.shadcn.com/docs/components/radix/avatar) + [Badge](https://ui.shadcn.com/docs/components/radix/badge) + [Button](https://ui.shadcn.com/docs/components/radix/button) | 授权状态与连接动作来自应用；不宣称平台集成已完成 |
| `product-editor` · 商品与店面编排 | C | [Field](https://ui.shadcn.com/docs/components/radix/field) + [Input](https://ui.shadcn.com/docs/components/radix/input) + [Textarea](https://ui.shadcn.com/docs/components/radix/textarea) + [Attachment](https://ui.shadcn.com/docs/components/radix/attachment) | 官方表单与媒体附件；不含未有官方对应的可视化建店编辑器 |
| `team-access` · 团队、邀请与权限 | C | [Table](https://ui.shadcn.com/docs/components/radix/table) + [Checkbox](https://ui.shadcn.com/docs/components/radix/checkbox) + [Select](https://ui.shadcn.com/docs/components/radix/select) + [Alert Dialog](https://ui.shadcn.com/docs/components/radix/alert-dialog) | 权限数据与具体确认；不覆写原生禁用与选择行为 |
| `checkout` · 结账摘要与付款入口 | C | [Field](https://ui.shadcn.com/docs/components/radix/field) + [Radio Group](https://ui.shadcn.com/docs/components/radix/radio-group) + [Item](https://ui.shadcn.com/docs/components/radix/item) + [Button](https://ui.shadcn.com/docs/components/radix/button) + [Spinner](https://ui.shadcn.com/docs/components/radix/spinner) | 官方表单只呈现付款数据；不提供支付执行能力 |
| `price-plan` · 价格方案 | C | [Radio Group](https://ui.shadcn.com/docs/components/radix/radio-group) + [Card](https://ui.shadcn.com/docs/components/radix/card) + [Field](https://ui.shadcn.com/docs/components/radix/field) | 沿官方RadioGroup/字段模式呈现计划，无自制价格卡选择器 |
| `subscription` · 订阅与权益摘要 | C | [Item](https://ui.shadcn.com/docs/components/radix/item) + [Table](https://ui.shadcn.com/docs/components/radix/table) + [Badge](https://ui.shadcn.com/docs/components/radix/badge) + [Alert Dialog](https://ui.shadcn.com/docs/components/radix/alert-dialog) | 账单/访问状态是领域文字，不映射为UI success枚举 |
| `invoice` · 账单与收据 | C | [Table](https://ui.shadcn.com/docs/components/radix/table) + [Item](https://ui.shadcn.com/docs/components/radix/item) + [Button](https://ui.shadcn.com/docs/components/radix/button) | 单据数据和下载；无发票或税务规则归属shadcn |
| `entitlement` · 会员访问与交付门槛 | C | [Item](https://ui.shadcn.com/docs/components/radix/item) + [Badge](https://ui.shadcn.com/docs/components/radix/badge) + [Alert](https://ui.shadcn.com/docs/components/radix/alert) + [Button](https://ui.shadcn.com/docs/components/radix/button) | 权限检查与外部同步由业务；Badge只显示结果 |
| `course` · 课程目录与学习任务 | C | [Sidebar](https://ui.shadcn.com/docs/components/radix/sidebar) + [Accordion](https://ui.shadcn.com/docs/components/radix/accordion) + [Progress](https://ui.shadcn.com/docs/components/radix/progress) | 课程导航和进度用官方组件；课件播放器/测验执行不是UI库能力 |
| `conversation` · 对话、帖子与讨论 | C | [Message Scroller](https://ui.shadcn.com/docs/components/radix/message-scroller) + [Message](https://ui.shadcn.com/docs/components/radix/message) + [Bubble](https://ui.shadcn.com/docs/components/radix/bubble) + [Attachment](https://ui.shadcn.com/docs/components/radix/attachment) + [Marker](https://ui.shadcn.com/docs/components/radix/marker) | 官方聊天组合；不自写气泡或滚动跟随 |
| `schedule` · 活动与预约 | C | [Calendar](https://ui.shadcn.com/docs/components/radix/calendar) + [Date Picker](https://ui.shadcn.com/docs/components/radix/date-picker) + [Field](https://ui.shadcn.com/docs/components/radix/field) | 预约数据来自服务；日历选择不代表订位 |
| `fulfillment` · 实物与服务履约 | C | [Item](https://ui.shadcn.com/docs/components/radix/item) + [Badge](https://ui.shadcn.com/docs/components/radix/badge) + [Table](https://ui.shadcn.com/docs/components/radix/table) | 履约里程碑为内容，不增加物流步骤组件 |
| `customer-record` · 客户与候补工作台 | C | [Item](https://ui.shadcn.com/docs/components/radix/item) + [Table](https://ui.shadcn.com/docs/components/radix/table) + [Tabs](https://ui.shadcn.com/docs/components/radix/tabs) | 客户/会员不同关系以官方集合组合 |
| `review-rating` · 评价与信任展示 | G | [Field](https://ui.shadcn.com/docs/components/radix/field) + [Radio Group](https://ui.shadcn.com/docs/components/radix/radio-group) + [Attachment](https://ui.shadcn.com/docs/components/radix/attachment) + [Item](https://ui.shadcn.com/docs/components/radix/item) | 评分可用已标注选项；官方无专门星级Rating控件，不手造控件 |
| `referral` · 推荐与分成关系 | C | [Input Group](https://ui.shadcn.com/docs/components/radix/input-group) + [Item](https://ui.shadcn.com/docs/components/radix/item) + [Table](https://ui.shadcn.com/docs/components/radix/table) | 链接/关系数据及官方复制按钮组合 |
| `commission` · 佣金明细与排行 | C | [Table](https://ui.shadcn.com/docs/components/radix/table) + [Card](https://ui.shadcn.com/docs/components/radix/card) + [Badge](https://ui.shadcn.com/docs/components/radix/badge) | 佣金和排名数据；无官方收益规则 |
| `ad-editor` · 广告层级与排期 | C | [Field](https://ui.shadcn.com/docs/components/radix/field) + [Tabs](https://ui.shadcn.com/docs/components/radix/tabs) + [Input](https://ui.shadcn.com/docs/components/radix/input) + [Attachment](https://ui.shadcn.com/docs/components/radix/attachment) | 广告层级以官方字段/页签组合；投放权限由业务 |
| `audience` · 受众构建与导入 | C | [Field](https://ui.shadcn.com/docs/components/radix/field) + [Checkbox](https://ui.shadcn.com/docs/components/radix/checkbox) + [Table](https://ui.shadcn.com/docs/components/radix/table) + [Progress](https://ui.shadcn.com/docs/components/radix/progress) | 集合条件与导入结果组合；匹配能力不属于UI库 |
| `attribution` · 归因与事件诊断 | C | [Chart](https://ui.shadcn.com/docs/components/radix/chart) + [Table](https://ui.shadcn.com/docs/components/radix/table) + [Tabs](https://ui.shadcn.com/docs/components/radix/tabs) | 官方报表外观；归因模型由业务 |
| `wallet` · 钱包与余额分区 | C | [Card](https://ui.shadcn.com/docs/components/radix/card) + [Table](https://ui.shadcn.com/docs/components/radix/table) + [Badge](https://ui.shadcn.com/docs/components/radix/badge) | 官方容器呈现币种/用途余额；不自建钱包控件或资金逻辑 |
| `ledger` · 账务流水与对账 | C | [Table](https://ui.shadcn.com/docs/components/radix/table) + [Sheet](https://ui.shadcn.com/docs/components/radix/sheet) | 官方表格/详情；账务不可变性来自业务合同 |
| `payout` · 出款与收款目的地 | C | [Field](https://ui.shadcn.com/docs/components/radix/field) + [Item](https://ui.shadcn.com/docs/components/radix/item) + [Alert Dialog](https://ui.shadcn.com/docs/components/radix/alert-dialog) + [Button](https://ui.shadcn.com/docs/components/radix/button) + [Spinner](https://ui.shadcn.com/docs/components/radix/spinner) | 可取消才用官方AlertDialog确认；操作结果由服务，不新增审批流程 |
| `transfer` · 充值、转账与兑换确认 | C | [Field](https://ui.shadcn.com/docs/components/radix/field) + [Native Select](https://ui.shadcn.com/docs/components/radix/native-select) + [Alert Dialog](https://ui.shadcn.com/docs/components/radix/alert-dialog) | 金额、目标及操作确认组合；转换/签名非组件能力 |
| `financial-product` · 受限金融产品入口 | C | [Card](https://ui.shadcn.com/docs/components/radix/card) + [Alert](https://ui.shadcn.com/docs/components/radix/alert) + [Badge](https://ui.shadcn.com/docs/components/radix/badge) | 只展示候选资格及限制；不宣称官方发卡/融资/收益组件 |
| `verification` · 身份核验与补件 | C | [Field](https://ui.shadcn.com/docs/components/radix/field) + [Input](https://ui.shadcn.com/docs/components/radix/input) + [Attachment](https://ui.shadcn.com/docs/components/radix/attachment) + [Badge](https://ui.shadcn.com/docs/components/radix/badge) | 核验字段/结果组合；供应商与准入不属于UI库 |
| `risk-case` · 风险案件与限制 | C | [Table](https://ui.shadcn.com/docs/components/radix/table) + [Sheet](https://ui.shadcn.com/docs/components/radix/sheet) + [Badge](https://ui.shadcn.com/docs/components/radix/badge) + [Alert](https://ui.shadcn.com/docs/components/radix/alert) | 案件、限制及未知均为业务数据；不发明Risk组件皮肤 |
| `appeal` · 复议与争议工作台 | C | [Field](https://ui.shadcn.com/docs/components/radix/field) + [Textarea](https://ui.shadcn.com/docs/components/radix/textarea) + [Attachment](https://ui.shadcn.com/docs/components/radix/attachment) + [Item](https://ui.shadcn.com/docs/components/radix/item) | 案件类型/证据/责任人组合；裁决规则不归Linear/shadcn |
| `reserve` · 限制资金与释放计划 | C | [Table](https://ui.shadcn.com/docs/components/radix/table) + [Badge](https://ui.shadcn.com/docs/components/radix/badge) + [Item](https://ui.shadcn.com/docs/components/radix/item) | 限制额及释放日期为业务记录 |
| `tax-document` · 税务资料与费用政策 | C | [Field](https://ui.shadcn.com/docs/components/radix/field) + [Input](https://ui.shadcn.com/docs/components/radix/input) + [Attachment](https://ui.shadcn.com/docs/components/radix/attachment) + [Table](https://ui.shadcn.com/docs/components/radix/table) | 资料与凭证组件组合，不提供税务判断 |
| `app-connection` · 应用安装与授权 | C | [Item](https://ui.shadcn.com/docs/components/radix/item) + [Checkbox](https://ui.shadcn.com/docs/components/radix/checkbox) + [Field](https://ui.shadcn.com/docs/components/radix/field) + [Alert Dialog](https://ui.shadcn.com/docs/components/radix/alert-dialog) | 权限范围及连接确认；协议执行另属业务 |
| `credential` · 开发凭证管理 | C | [Input Group](https://ui.shadcn.com/docs/components/radix/input-group) + [Table](https://ui.shadcn.com/docs/components/radix/table) + [Alert Dialog](https://ui.shadcn.com/docs/components/radix/alert-dialog) | 凭证展示/复制/撤销组合，秘密不入演示数据 |
| `event-log` · 接口事件与投递日志 | C | [Table](https://ui.shadcn.com/docs/components/radix/table) + [Accordion](https://ui.shadcn.com/docs/components/radix/accordion) | 日志为内容；无自造日志查看控件 |
| `import-export` · 导入、导出与同步任务 | C | [Field](https://ui.shadcn.com/docs/components/radix/field) + [Table](https://ui.shadcn.com/docs/components/radix/table) + [Progress](https://ui.shadcn.com/docs/components/radix/progress) + [Alert](https://ui.shadcn.com/docs/components/radix/alert) | 任务参数与行结果组合；导出服务/保留期限独立 |
| `ai-workbench` · AI会话与生成任务 | C | [Message Scroller](https://ui.shadcn.com/docs/components/radix/message-scroller) + [Message](https://ui.shadcn.com/docs/components/radix/message) + [Bubble](https://ui.shadcn.com/docs/components/radix/bubble) + [Attachment](https://ui.shadcn.com/docs/components/radix/attachment) + [Questionnaire](https://ui.shadcn.com/docs/components/radix/questionnaire) | 官方对话及可用问答模式；模型/工具执行独立 |
| `action-preview` · 代理操作预览与确认 | C | [Alert Dialog](https://ui.shadcn.com/docs/components/radix/alert-dialog) + [Table](https://ui.shadcn.com/docs/components/radix/table) + [Item](https://ui.shadcn.com/docs/components/radix/item) | 具体动作预览确认；不重写AlertDialog行为或引入新审批层 |
| `site-lifecycle` · 网站与版本发布 | C | [Table](https://ui.shadcn.com/docs/components/radix/table) + [Badge](https://ui.shadcn.com/docs/components/radix/badge) + [Alert Dialog](https://ui.shadcn.com/docs/components/radix/alert-dialog) | 版本列表与发布确认组合；完整站点编辑器不在组件覆盖内 |
| `blueprint` · 业务蓝图与迁移向导 | C | [Card](https://ui.shadcn.com/docs/components/radix/card) + [Table](https://ui.shadcn.com/docs/components/radix/table) + [Field](https://ui.shadcn.com/docs/components/radix/field) + [Alert Dialog](https://ui.shadcn.com/docs/components/radix/alert-dialog) | 来源/目标/迁移计划作为数据；不虚构官方迁移组件 |
| `service-application` · 创业服务与成长资格 | C | [Field](https://ui.shadcn.com/docs/components/radix/field) + [Questionnaire](https://ui.shadcn.com/docs/components/radix/questionnaire) + [Attachment](https://ui.shadcn.com/docs/components/radix/attachment) + [Badge](https://ui.shadcn.com/docs/components/radix/badge) | 官方字段与匹配的问答；法律服务及成长资格独立 |

映射分类核对：O 18、C 75、N 3、G 7，合计103；这些是迁移分类，不是新组件数量。旧[12模块/168条研究映射](../design-system-v1/module-coverage.md)保留作业务范围追溯，v2不复制或重新批准其商业规则。

## 展示与报告

维护源为[app/](app/)，独立产物为[output/Wringy-Design-System.html](output/Wringy-Design-System.html)。61个UI文件＋3个指南是来源/入口对账，不是props或组合状态穷尽数。[自动化浏览器报告](output/browser-verification.json)明确实际检查项、结果及限制；外部官方说明链接需联网。应用示例不接生产API。

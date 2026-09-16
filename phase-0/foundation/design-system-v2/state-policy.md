# 状态策略 · 官方Radix/Nova基线

2026-09-11。本表规定如何把应用事实传给官方组件，不建立新的通用状态机。外观、焦点和动画由CLI生成的官方源码承担；不添加统一hover/pressed/error/loading矩阵，更不照搬v1枚举。

## 控件属性和显示

| 需求 | 官方/原生接口 | 使用边界 |
|---|---|---|
| 默认、悬停、按下、键盘焦点 | 组件自带CSS与底层库行为 | 不编写`state="hover"`；不附加按压缩放、0ms键盘覆盖或自定义缓动 |
| 禁用 | 控件`disabled`；Field包装`data-disabled` | 原生禁用阻止操作；只改灰色/`aria-disabled`并不自动禁止点击。不能聚焦的禁用项，原因放可读描述，不只放Tooltip |
| 正在处理 | 应用pending值驱动Button `disabled`＋`Spinner`和明确文字；必要容器`aria-busy` | Button没有`isLoading`/`isPending`属性；`aria-busy`只是无障碍语义，不会自动锁提交。后台刷新不应禁用整页 |
| 输入无效 | Field `data-invalid`；控件`aria-invalid`；`FieldError`关联说明 | 数据错误由表单校验决定，属性使用官方无效样式；不存在给所有组件通用的`error`prop |
| 只读 | 支持它的Input/Textarea使用原生`readOnly` | 仍可读、选取和复制；不等同disabled。不支持readOnly的Select/Checkbox等用已标注的只读文本呈现，不伪造属性或手工控件 |
| Checkbox选中/部分选中 | `checked`、`onCheckedChange`；值为boolean或`"indeterminate"` | 部分选中只表示集合摘要，不是第三种同意；让Radix产生对应`data-state` |
| RadioGroup、Switch | `value/onValueChange`或`checked/onCheckedChange` | 各用本身API，不互换枚举；不覆写方向键/Space行为 |
| Toggle/ToggleGroup | `pressed`或Radix的`type="single"/"multiple"`及value | 不用Base UI的multiple布尔/数组规则替换Radix单选签名；不自画分段按钮 |
| Select | Radix的`value/onValueChange`；SelectItem在SelectGroup内 | Radix Select是单选；需要不同模式用已核实的官方Combobox示例，不添加假的multiple prop |
| Tabs | `value/onValueChange`；TabsList/Trigger/Content | 激活、方向键、Home/End、焦点默认交底层；`activationMode`仅在有明确用途时使用官方API，不自写键盘状态机 |
| Dialog/Sheet/Drawer/Popover/Menu | `open/onOpenChange`及官方Trigger/Content结构 | Radix触发器使用`asChild`；不混用Base的render；Portal、焦点回返、Escape和遮罩按对应组件默认，不宣称所有浮层同一关闭行为 |
| 确认重要动作 | `AlertDialog`＋Title/Description/Cancel/Action | 如服务端确认可取消出款，核对具体付款再请求；不把普通阅读/保存全部变审批。不用额外定时、长按或自制确认层 |
| 加载占位/进度 | `Skeleton`、`Spinner`、`Progress value` | 初读/刷新/真实确定进度由应用选择；不虚构百分比，不用自制闪烁占位 |
| 空结果与持久问题 | `Empty`及`Alert`官方组成 | 无匹配、首次空、暂不可读用文字区分；它们是页面条件，不是所有控件的统一state |
| 短暂反馈 | Radix项目使用`Sonner`及其官方API | 不混入Base Toast；不自建Toast计时/堆叠/手势；关键资金问题仍留页面文字 |
| 头像/附件/对话 | AvatarFallback、Attachment、Message/Bubble/MessageScroller | 使用官方加载/回退与滚动组成，不自写聊天气泡或滚动跟随 |

主要接口依据：[Button](https://ui.shadcn.com/docs/components/radix/button)、[Field](https://ui.shadcn.com/docs/components/radix/field)、[Checkbox](https://www.radix-ui.com/primitives/docs/components/checkbox)、[Select](https://ui.shadcn.com/docs/components/radix/select)、[Tabs](https://www.radix-ui.com/primitives/docs/components/tabs)、[Dialog](https://www.radix-ui.com/primitives/docs/components/dialog)、[Alert Dialog](https://ui.shadcn.com/docs/components/radix/alert-dialog)、[Sonner](https://ui.shadcn.com/docs/components/radix/sonner)。实际生成源码与锁定版本决定可用签名，不能从另一base页面抄props。

## 组合状态不另画一套皮肤

| 组合 | 处理原则 |
|---|---|
| disabled＋busy | busy来自应用请求，disabled阻止重复触发；Spinner和文字保留处理原因；不宣称禁用能保证后端去重 |
| readOnly＋busy | 只读内容保持可读；区域更新时可标busy；不改成disabled来隐藏值 |
| invalid＋focus | 保留`aria-invalid`及错误关联，让官方focus-visible与invalid样式共存；不自定义描边优先级 |
| selected＋focus | 用Tabs/Select/Checkbox本身的受控值，焦点由底层处理；不覆盖内部`data-state`或画第二层选中环 |
| selected＋disabled | 保留已保存值与禁用属性，原因有文字；不能静默改选第一项 |
| 无数据＋读取错误 | 页面用Alert及必要重试；不能把读取失败当Empty无对象，更不能把缺失金额显示0 |
| 浮层内异步写入 | 用官方受控open和表单示例，服务返回后决定是否关闭；失败保留输入和错误，不改焦点锁定代码 |
| 业务risk-held＋payable | 用两个官方Badge和说明分别呈现原义务/限制；它们不是Badge的两种新variant，也不替代服务端allowedActions |
| R/K观察unknown＋旧状态 | 用官方Badge/Alert显示“暂不可得”、最后状态和时间；不推断无风险或零金额，不新增业务终态 |

## 业务与UI的交界

[业务合同](../design-system-v1/domain-states.md)保持独立且为PROPOSED：内容、计量、奖励、付款、风险不能相互推导；官方Badge只显示服务端给出的文字。其D01/D06等未决方法与权限不会因采用官方UI而获批。旧文档的业务证据、去重及责任约束继续作业务参考；旧动效/尺寸/通用控件状态不进入本版。

例如“内容通过”“应付已确认”“风险限制中”“付款结果待核对”可以并列使用官方Badge，解释用官方Alert/Item；不新增`variant="risk-held"`。付款未知先核对原请求、计量修正保留旧金额与核对说明等，是应用服务逻辑，不能称为Linear/shadcn默认功能。

## 验证边界

按实际安装组件逐个验证支持的属性及键盘行为：文本输入、禁用/只读、invalid＋focus、选中＋focus、模态回焦、异步提交与Sonner。仅测试使用到且官方支持的组合；不制造“每组件×全部状态”的虚假覆盖率。对比度测试针对全局配色映射，失败先修色值映射；不以改字体、尺寸或焦点几何掩盖问题。这些要求不等于全部已经运行；实际自动化范围、通过/失败和限制以[浏览器报告](output/browser-verification.json)为准。

主任务已用CUA界面操作观察到Dialog初始焦点和Escape关闭后回到触发点。该人工观察仅覆盖所操作的Dialog场景；不等于所有模态、设备、读屏或全部props通过。[独立展示HTML](output/Wringy-Design-System.html)与[app源码](app/)使用同一实现导出，仍需依据报告区分实际覆盖。无生产API或真实资金动作；重要业务标签仍是独立业务语义。

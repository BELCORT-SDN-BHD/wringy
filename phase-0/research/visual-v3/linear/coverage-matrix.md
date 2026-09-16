# Linear 组件覆盖矩阵

2026-09-10。状态“有图”只表示观察到参考，不表示完整功能/所有状态已覆盖。全量 ID、查询和缺步见 [ledger.json](ledger.json)。

| 类别 | 覆盖结论 | 可核对参考 | 实际观察 | 缺口 / 例外 |
|---|---|---|---|---|
| 应用框架 / 导航 | 有图；多种结构 | [团队列表](https://mobbin.com/screens/9ec39891-cdbb-4d57-b0c6-de43f82c5f4e) | 组织入口与搜索/创建在左上；全局、Workspace、Your teams 分区；当前行中性浅灰；主面板顶栏+次级视图栏。 | 不要把旧版 Active/Backlog 左栏与另一个版本的顶栏标签无注明地拼合。侧栏宽度与折叠行为未测。 |
| issue 列表 / 显示密度 | 有图 | [Display 浮层](https://mobbin.com/screens/815793b1-5c75-43ac-94c7-93380781e337) | 按状态分组，数量/添加入口在组头；字段由 Display 控制；ID/标签/日期不是永远全开。 | 没有 CSS 行高、列宽、字体值；不能把某截图稀疏字段当成移动版。 |
| 看板 | 有图；浅/深 | [浅色看板](https://mobbin.com/screens/fc208a44-dbf9-4f79-b9b0-db57f9840964) | 状态列、列头计数、卡片标题/标签/元信息、Hidden columns；可见悬浮卡片。 | 无拖放操作测试，卡片完整失败/焦点/键盘态未见。 |
| 创建 issue | 有图；流程部分 | [创建弹窗](https://mobbin.com/screens/9ae1ad02-5e59-4079-9eba-21589c0fe211) | 列表保持背景，白色弹窗偏上，标题与描述优先、属性紧凑、底部附件/Create more/创建。 | 10步流程只看1/2/4/7/10；上传过程、部分属性选择、提交中仍缺。 |
| issue 详情 | 有图；两种上下文 | [完整详情](https://mobbin.com/screens/6e105b56-a616-497c-87bc-70fdeaf31048) | 主体标题/说明/附件/子项/链接/Activity/评论；右属性列。 | v2 的另一参考为 Inbox 内详情；不能据此规定所有详情必须挤在列表旁。 |
| 状态选择 | 有图；短流程位置全看 | [状态浮层](https://mobbin.com/screens/744b87f4-4e13-488a-9338-2ca18b39bef1) | 触发器下方列表，状态图形+文字、当前勾选、快捷数字；选择后属性变化。 | 仅静态序列；实际权限、可选状态规则、键盘行为未验证。 |
| 负责人选择 | 有图；短流程位置全看 | [负责人浮层](https://mobbin.com/screens/53aafc60-0736-490f-bd89-40bfb76c8332) | 搜索输入、No assignee、当前勾选、头像+人名。 | 只见少量选项，没有大量人员、无搜索结果、权限过滤证据。 |
| 优先级选择 | 项目编辑有图；issue编辑不足 | [项目优先级](https://mobbin.com/screens/c2cbaff3-1a8d-4fd4-af9a-c5c31533082c) | No priority/Urgent/High/Medium/Low、图标、选中勾和快捷数字。 | 不能把项目 priority 说成 issue 完整编辑证据；issue 仅看到已选 High，另见筛选菜单。 |
| 筛选 | 有图；含空结果 | [组合筛选空态](https://mobbin.com/screens/90b0ca17-b70a-425c-b28b-ce934231b2b9) | 属性主菜单+子菜单；已选条件保留在顶栏；无匹配显示隐藏数量/Clear Filters。 | 筛选是改变可见集合；不可据此借用为业务状态修改。 |
| 全局搜索 | 有图；初始/结果/无结果 | [搜索结果](https://mobbin.com/screens/a2f96ae5-202c-4747-a959-d33d7e5c0f72) | 全页搜索输入、对象分类、图标/标题/时间结果行。 | 没有加载、键盘选择、跨权限搜索证据；不等同命令菜单。 |
| 命令菜单 | 缺开放菜单；教程/帮助有图 | [Command K 教程](https://mobbin.com/screens/1e783aca-8b8e-4ae5-994d-284a8ddae491) | 教程明确展示 Command+K；另有快捷键帮助抽屉。 | 多轮具体查询仍返回 Ask Linear/图标选择器/帮助，全部不能替代开放命令菜单。 |
| 项目概览 | 有图；部分流程 | [项目 Overview](https://mobbin.com/screens/f4cd410f-b1b4-49fe-a247-80071f69ba1e) | 名称/摘要/属性/资源/描述，右侧属性/里程碑/活动；另见最新更新与进度。 | 6步仅1/4/6；Updates 内页未补齐。图表是该对象上下文，不能转成 Wringy 虚构业绩。 |
| 设置 / 表单 | 有图；多个类别 | [偏好设置](https://mobbin.com/screens/aa0b9e71-c5a0-4245-b30a-ee5059de6235) | 独立导航与 Back to app，限宽内容，分组行、标签/辅助文案、右侧输入/开关。 | 不同设置版本导航不同；保存策略/即时保存/失败恢复不能由静态图推断。 |
| 通知 Inbox | 有图；选中/未选中/撤销提示 | [Inbox 详情](https://mobbin.com/screens/beb9d6b3-ec34-46d7-9332-320fcb32a338) | 导航+通知队列+详情+属性，选中行中性突出；另见未选中提示及 Undo toast。 | 7条未读的未选中画面不是空 Inbox；无真实通知零状态或通知递送机制证据。 |
| 对话框 / 破坏性确认 | 有图；两种删除序列位置全看 | [删除 issue 确认](https://mobbin.com/screens/9a1bd072-26d6-493a-a8ad-a779e43dd605) | 遮罩、对象名称、影响、取消和红色动作；删除后保留恢复入口。 | 标签删除另为不可撤销；不能复制30天保留到 Wringy 或声称当前 Linear 政策。 |
| Onboarding | 有图；两份部分流程 | [邀请步骤](https://mobbin.com/screens/ea105d60-40f2-4cfc-9854-c051dca7875b) | 居中一步一主题、少字段、主动作、步骤圆点；邀请有稍后入口；主题有视觉选项。 | 18步尚缺10步；25步尚缺20步；两份结束页不同，版本未知。 |
| Empty | 有图；多语义 | [项目首次空态](https://mobbin.com/screens/5273571d-4f58-410a-97a0-f6018dc8b80f) | 首次无对象有定义/创建/文档；无匹配有清除筛选；未选中有队列统计；模板空态只用文本行。 | 不应强制每类都画大插图；无权限与服务失败未见。 |
| Loading | 未找到 Linear 图 | [排除的 Fabric 结果](https://mobbin.com/screens/46846b8b-226e-4952-a05a-97f5b7bb11a1) | 查询返回 Fabric/Linktree/Uvodo，已逐图查看并排除。 | 不得把其他应用骨架或空白页写成 Linear 加载规范。 |
| Error | 仅必填字段错误 | [Required 错误](https://mobbin.com/screens/5c68cc35-0d93-47ba-b27e-ed4efe90b75c) | 字段下红字，原表单保留。 | 没有网络/上传/服务错误、重试中、权限拒绝证据。 |
| 浅深主题 / 色彩 | 有图；非像素提取 | [深色看板](https://mobbin.com/screens/720724d3-f686-457f-8c00-fa7efa409b12) | 深色有近黑画布、略亮卡片、中性色文字、彩色状态；浅色中主操作偏紫，选中导航灰。 | 浅深看板内容不完全相同，不作逐像素配对；Hex/对比度/准确字体未知。 |
| 字体 / 层级 / 密度 | 有图；仅相对观察 | [密集列表](https://mobbin.com/screens/937fc32e-04c6-4c39-bcd6-17a42b4fe83c) | 标题比行文本更大更重；ID/时间更弱；密度来自紧凑行、轻分隔、属性选择与连续工作面。 | 英文截图不验证中文行高或所用字体；不能提取196/284px等规范数值。 |
| iOS / 网页响应式 | iOS有图；网页窄屏缺失 | [原生 iOS 详情](https://mobbin.com/screens/ed788cb0-3715-4383-9cbd-783d2a55bdf8) | 单栏、标题下可换行属性组、顶部返回、底部评论；通知详情另有底部动作条。 | 不是桌面网页缩小版；不能推断639/1023px断点、网页触控目标或滑动交互。 |

## 流程位置账本

位置以 MCP 返回的1起算编号为准。补查只有 screen ID 完全相同才算补齐；相似图不算。即使所有返回位置已看，也没有操作真实产品。

| 流程 | 总位置 | 原始预览已看 | 同ID补齐 | 仍未看 |
|---|---:|---|---|---|
| [Creating a new issue](https://mobbin.com/flows/3528703d-a543-414c-8f6e-ccf2442bff2f) | 10 | 1, 4, 7, 10 | 2 | 3, 5, 6, 8, 9 |
| [Adding an assignee](https://mobbin.com/flows/0035680b-a877-444a-b27a-b76b38d10853) | 3 | 1, 2, 3 | — | 无；仅返回截图序列 |
| [Creating an issue](https://mobbin.com/flows/b49200b2-cfac-4c16-aae9-55aecdb91d09) | 5 | 1, 3, 5 | — | 2, 4 |
| [Deleting an issue](https://mobbin.com/flows/99ee123c-27b8-4c1b-b2d7-4147d1d36e3b) | 3 | 1, 2, 3 | — | 无；仅返回截图序列 |
| [Deleting a label](https://mobbin.com/flows/2b5cbea5-4e69-479c-a80f-5ce264e94319) | 3 | 1, 2, 3 | — | 无；仅返回截图序列 |
| [Project details](https://mobbin.com/flows/dbc027fe-6642-4cec-912b-0e05b83edca6) | 6 | 1, 4, 6 | — | 2, 3, 5 |
| [Team details](https://mobbin.com/flows/a0735ade-f166-4176-be36-e3c66e384180) | 6 | 1, 4, 6 | 2 | 3, 5 |
| [Onboarding](https://mobbin.com/flows/cbaf58a9-fd84-4afe-b214-e65b24484013) | 18 | 1, 5, 10, 14, 18 | 8, 11, 12 | 2, 3, 4, 6, 7, 9, 13, 15, 16, 17 |
| [Onboarding](https://mobbin.com/flows/64ae582c-747c-4c77-8629-812abcbef186) | 25 | 1, 7, 13, 19, 25 | — | 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24 |
| [Searching shortcuts](https://mobbin.com/flows/7f061cb3-54c7-48de-a070-6c6cde5f443f) | 2 | 1, 2 | — | 无；仅返回截图序列 |
| [Keyboard shortcuts](https://mobbin.com/flows/239089b5-97e5-4698-af22-ae79d337538c) | 3 | 1, 2, 3 | — | 无；仅返回截图序列 |
| [Adding a project status](https://mobbin.com/flows/2bcee4cf-b813-40a1-a7fc-6a6117807d3d) | 6 | 1, 4, 6 | — | 2, 3, 5 |
| [Adding a status](https://mobbin.com/flows/4677eaad-e0aa-4508-8923-bee5b412622d) | 3 | 1, 2, 3 | — | 无；仅返回截图序列 |
| [Changing priority](https://mobbin.com/flows/c18419c2-b333-4aac-9d41-8d7861148655) | 3 | 1, 2, 3 | — | 无；仅返回截图序列 |
| [Creating a view](https://mobbin.com/flows/23c119ec-b9fc-4934-ab4a-107934dd858c) | 8 | 1, 5, 8 | 2, 4 | 3, 6, 7 |
| [Editing profile](https://mobbin.com/flows/df3834ad-cd86-458a-b525-2ad07ff04429) | 5 | 1, 3, 5 | — | 2, 4 |
| [Account settings](https://mobbin.com/flows/8ff79d73-2aa9-4175-a039-3c38031e6e72) | 6 | 1, 4, 6 | — | 2, 3, 5 |
| [Creating an issue (from comment)](https://mobbin.com/flows/8f7ac78d-938d-44b2-a43e-b746bc6beda4) | 4 | 1, 3, 4 | — | 2 |
| [Creating an issue template](https://mobbin.com/flows/3a6f0093-4b1c-413a-8a11-866fd0ac5867) | 6 | 1, 4, 6 | — | 2, 3, 5 |


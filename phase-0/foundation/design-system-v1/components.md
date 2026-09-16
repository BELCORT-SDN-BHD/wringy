# Wringy 组件契约 v1

2026-09-11 · 完整平台设计交接提案 · Creator Rewards 优先。

## 权威、范围与地基

本轮现场指令授权完整设计系统和实用交接，明确沿用已接受的 deck 方向与既有品牌基础值。当前唯一数值源为 [tokens.json](tokens.json)，采用primitive基础值→semantic用途→component组件角色三层；设计扩展已获授权。design-v3仅为品牌来源与历史溯源，见[旧规范](../design-v3/brand-components-spec.md)，不再作为当前组件取值入口。不宣称复制或提取了Ramp官方设计系统；本轮对品牌基础及扩展的授权不自动批准业务机制或生产实现。

产品范围依 [产品总图](../product-map.md)；Creator Rewards依 [商业模式](../business-model-v2.md)和[审核设计](../review-design-v1.md)。B06研究文件中的固定赏金首片是历史研究候选，本轮优先顺序以当前 Creator Rewards 指令为准；Bounties仍独立保留。

基础检查结果：新tokens与品牌来源、全平台地图、168项研究存在；Wringy完整已批准PRD、用户证据、计量合同、当地支付准入、完整架构及逐页实施规格缺失。此次授权允许形成全面设计提案，不形成生产冻结。补齐规则工作坊及样本核对粗估1–3工作日；全平台PRD/页面规格需要另行估量；供应商准入时间未知。当前目录非Git文档镜像，不能声称完成分支、工程测试或跨供应商代码审核。

`specified`仅表示该组件族有本文契约，**不是已实现、已验证或已批准上线**。目录JSON是组件身份、分类、状态及通用接口说明源；本文的逐项行为和复合事件是其配套契约。状态采用可组合维度：如focus可与error并存；不把整表矩阵机械套给静态元素。reward-breakdown/risk-case的unknown是UI观察不可得，不是新增R/K业务状态；risk-held是义务上的限制，cancel-confirmation/canceling是出款界面/请求阶段，不覆盖原资金状态。

## 共用视觉与交互

- 使用semantic.canvas / surface / text / muted / accent / forest角色；按钮使用component.button-background / button-text。semantic.warning与warning-bg为已授权扩展；danger、positive及对应背景分别表达错误和确定成功，均须写清对象。品牌accent不能表示付款成功。
- 字体、空间、圆角引用primitive.font / space / radius，正文使用typography.app；触控目标引用primitive.layout.touch（至少44×44px），按钮高度引用component.button-height。输入边界引用component.input-border，选中行引用component.row-selected。焦点颜色引用semantic.focus；未设token的焦点几何与响应断点以品牌基础文档/实现源为准，不从旧版本推导新路径。
- 场景覆盖320、480、768、800、1440px及200%放大；这些是待实施验收尺寸，不是假称已做截图验证。窄屏不删除原因、金额、币种、责任人和恢复操作。横向数据区域需有说明及键盘滚动路径。
- emil-design-eng用于高频无动画、及时反馈、可打断浮层与减少动态。使用当前primitive.motion.fast / standard / ease，其中ease为已授权Emil自定义曲线；不在各组件内另写曲线。hover仅细指针且支持hover时启用；键盘动作0ms。指针按钮可轻微按压反馈，不能让等待动画阻止下一操作。财务数值不做滚动计数；真实业务状态立即呈现。
- 原生语义优先。焦点可见且不被固定栏遮住；没有权限时不把敏感数据放入隐藏DOM。模态初始焦点放标题或安全输入；短明确表单可聚焦首字段。危险动作不预选确认。

## 状态组合与恢复优先级

1. 权限/作用空间错误优先遮止敏感内容与写操作，提供正确登录或访问路径；不伪装空集合。
2. 已发出且结果未知的操作优先显示“正在核对原请求”，停止再次写入；并保留查询入口。普通加载不能覆盖这一状态。
3. 字段错误、服务错误和版本冲突保留用户输入；以最后服务端确认值为依据，禁止静默覆盖。冲突页可比较新旧值和重新提交。
4. disabled保留原因文字；readonly允许读、选取和复制。原生禁用字段不进入提交值时，数据由明确模型补齐，不能无意删除原值。
5. 可选择集合才有selected；父子全选才有indeterminate；静态图标/文本没有hover或loading强制矩阵。表单success不等于领域结果success。
6. 空值至少分未填写、未知、不适用；远程集合另分首次空、无匹配、未选择、读取失败、无权限。数据过时保留最后确认时间，不冒充最新。

完整组合矩阵见 [领域状态：状态组合](domain-states.md#状态组合的显示与动作优先级)，包含disabled与readonly区别、busy并发、error+focus、selected+focus及risk-held正交关系。

## 事件与数据边界

下列事件名是**提议的界面事件合同**，不是现存API或供应商功能。界面发出意图，领域服务验证后才能反映业务成功。所有写动作附 actorId、workspaceId、objectId、expectedVersion、operationId；只读控件事件不必携带不相关字段。事件只引用证据ID和受控对象，不把银行资料、令牌或媒体正文送入通用分析。业务命令、界面浏览埋点与审计决定分别记录。

响应区分 accepted/pending、confirmed、validation_error、permission_denied、conflict、unknown。未知先查询同一operationId；已确认失败后方可按接口合同重试。重复键只防同一意图重复执行，不代替后端权限、版本和资金约束。取消等待不等于取消服务端交易。关闭弹窗不撤销已发请求。

组合关系：复合组件以基础控件、字段外壳、表单、状态标签、属性清单、持久提示、证据预览和操作历史为公共底座；复杂组件自己的事件载荷与个别恢复规则见下。多域变化只能由各域确认事件联动，页面不可同时乐观写成“通过、可提、到账”。

## Creator Rewards 首要组合与验收情景

| 场景 | 主要组合 | 首要信息和恢复 |
|---|---|---|
| 品牌设活动 | campaign-brief + rule-editor + budget + asset-library + date-time + form | 计量口径、权利、币种、窗口齐全才进入发布预览；预算未知阻止收益承诺 |
| 创作者参与 | campaign-brief + social-connection + submission + creator-progress | 保存接受的规则版和账号；授权不足先补权限；重复链接回原投稿 |
| 品牌终审 | list-detail + review-workbench + media-player + annotation + worklog | 原规则和证据优先；终审与预审分开；拒稿理由可定位，冲突重新读取 |
| 核算奖励 | measurement + reward-breakdown + budget + risk-case | 未知数据不记零；重复观看不重复奖励；风险暂停保留原内容结论 |
| 创作者收款 | creator-progress + wallet + payout + ledger | 可用额按用途读取；报价过期重取；付款未知查询原请求，到账需凭证 |
| 复议与成本 | appeal + conversation + worklog + metric | 品牌拥有内容决定；支持协调；全拒稿仍记录劳动与缺失覆盖率 |

上述情景与 [domain-states.md](domain-states.md) 的转换表共同验收。工程阶段必须逐项演练重复提交、双审核员冲突、数据断连、两稿争预算、风险解除但内容未通过、付款未知、已支付后追索、窄屏键盘和读屏恢复；本次文档检查不能替代这些运行验证。

## 逐组件契约

每族中的variants是用途变体，不以尺寸、色彩或边角形状另计组件。基础与复杂模式都按下列稳定id实现和测试；未列的状态仅在真实需求存在时经源契约补充。

<a id="button"></a>

### button · 按钮

**类别**：基础　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B04、B05、B06、B07、B08、B09、B10、B11、B12

触发一次明确动作；文案用动词和对象。

| 契约项 | 规定 |
|---|---|
| 变体 | 主要、次要、文字、危险 |
| 适用状态 | default、hover、pressed、focus、disabled、loading |
| 行为与恢复 | 处理中保留宽度与名称，锁住同一请求；失败由所在表单展示并恢复操作。 |
| 键盘 | Tab聚焦，Enter/Space激活一次；按键长按不重复发业务命令；busy时保留焦点并阻止重入。 |
| 无障碍 | 原生button；只有图标时提供aria-label；加载保留可访问名称并以status说明，危险含义写进文案。 |
| 响应式 | 320px仍能读完整核心信息；动作触控目标至少primitive.layout.touch；字号不整体缩小。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 |
| 事件（提案） | activate(actionId) |
| 避免 | 同页多个同等主要动作；把点击当业务成功。 |

<a id="link"></a>

### link · 链接

**类别**：基础　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02

前往资源或页面，保留浏览器原生行为。

| 契约项 | 规定 |
|---|---|
| 变体 | 站内、外部、下载 |
| 适用状态 | default、hover、focus、visited、unavailable |
| 行为与恢复 | 新窗口或下载需标明；资源无权访问时给说明，不输出受限地址。 |
| 键盘 | Enter打开；保留Ctrl/Cmd/Shift修饰键、新标签与复制地址；不用Space伪装按钮。 |
| 无障碍 | 使用a及真实目的地址；外链/下载性质在链接文本或描述中说明。 |
| 响应式 | 320px仍能读完整核心信息；动作触控目标至少primitive.layout.touch；字号不整体缩小。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | navigate(href,target) |
| 避免 | 用链接执行付款或删除；拦截所有修饰键。 |

<a id="icon"></a>

### icon · 图标

**类别**：基础　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B04、B05、B06、B07、B08、B09、B10、B11、B12

使用既有 Tabler 描边资产和文字标签。

| 契约项 | 规定 |
|---|---|
| 变体 | 装饰、语义 |
| 适用状态 | default、unavailable |
| 行为与恢复 | 缺图标时保留文本；纯图标动作由按钮承载可访问名称。 |
| 键盘 | 静态内容不进入Tab序列；按钮用Enter/Space，链接用Enter；焦点顺序跟随阅读顺序。 |
| 无障碍 | 语义标签优先；正文用semantic.text / semantic.muted，状态必须带文字；图标装饰时从可访问树隐藏。 |
| 响应式 | 320px仍能读完整核心信息；动作触控目标至少primitive.layout.touch；字号不整体缩小。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | 无独立事件 |
| 避免 | 以图形或颜色作为唯一风险、付款信息。 |

<a id="text"></a>

### text · 文本与标题

**类别**：基础　**成熟度**：specified（规范已写，未实现）　**模块**：B05

建立对象名、正文、来源层级。

| 契约项 | 规定 |
|---|---|
| 变体 | 标题、正文、说明、等宽记录 |
| 适用状态 | default、truncated、masked |
| 行为与恢复 | 长标识允许换行及复制；截断必须有可键盘进入的完整文本。 |
| 键盘 | 静态内容不进入Tab序列；按钮用Enter/Space，链接用Enter；焦点顺序跟随阅读顺序。 |
| 无障碍 | 语义标签优先；正文用semantic.text / semantic.muted，状态必须带文字；图标装饰时从可访问树隐藏。 |
| 响应式 | 320px仍能读完整核心信息；动作触控目标至少primitive.layout.touch；字号不整体缩小。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | expandText(fieldId) |
| 避免 | 关键金额、拒绝理由只放悬浮提示。 |

<a id="avatar"></a>

### avatar · 头像与身份标识

**类别**：基础　**成熟度**：specified（规范已写，未实现）　**模块**：B01

显示人或组织并明确身份类型。

| 契约项 | 规定 |
|---|---|
| 变体 | 个人、组织、身份组 |
| 适用状态 | default、loading、fallback |
| 行为与恢复 | 图片失败回退首字与名称；同名靠组织和角色辨别，不靠照片猜权限。 |
| 键盘 | 静态内容不进入Tab序列；按钮用Enter/Space，链接用Enter；焦点顺序跟随阅读顺序。 |
| 无障碍 | 语义标签优先；正文用semantic.text / semantic.muted，状态必须带文字；图标装饰时从可访问树隐藏。 |
| 响应式 | 320px仍能读完整核心信息；动作触控目标至少primitive.layout.touch；字号不整体缩小。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | openProfile(subjectId) |
| 避免 | 把头像存在当实名认证通过。 |

<a id="badge"></a>

### badge · 状态标签

**类别**：基础　**成熟度**：specified（规范已写，未实现）　**模块**：B05

文字同时写明状态对象，例如内容已通过。

| 契约项 | 规定 |
|---|---|
| 变体 | 中性、成功、错误、待处理 |
| 适用状态 | default、unknown、stale |
| 行为与恢复 | 未知显示未知；需要解释时邻接详情链接，不把静态标签做按钮。 |
| 键盘 | 静态内容不进入Tab序列；按钮用Enter/Space，链接用Enter；焦点顺序跟随阅读顺序。 |
| 无障碍 | 语义标签优先；正文用semantic.text / semantic.muted，状态必须带文字；图标装饰时从可访问树隐藏。 |
| 响应式 | 320px仍能读完整核心信息；动作触控目标至少primitive.layout.touch；字号不整体缩小。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | 无独立事件 |
| 避免 | 一个 Approved 标签代表审核、奖励和付款。 |

<a id="separator"></a>

### separator · 分隔与分组

**类别**：基础　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B04、B05、B06、B07、B08、B09、B10、B11、B12

用间距和装饰线建立相邻内容关系。

| 契约项 | 规定 |
|---|---|
| 变体 | 水平、垂直、带标题 |
| 适用状态 | default |
| 行为与恢复 | 表单组用语义分组及标题，线只作装饰。 |
| 键盘 | 静态内容不进入Tab序列；按钮用Enter/Space，链接用Enter；焦点顺序跟随阅读顺序。 |
| 无障碍 | 语义标签优先；正文用semantic.text / semantic.muted，状态必须带文字；图标装饰时从可访问树隐藏。 |
| 响应式 | 320px仍能读完整核心信息；动作触控目标至少primitive.layout.touch；字号不整体缩小。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | 无独立事件 |
| 避免 | 浅分隔线作为唯一输入边界。 |

<a id="surface"></a>

### surface · 工作面与摘要容器

**类别**：基础　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B04、B05、B06、B07、B08、B09、B10、B11、B12

白色工作区、中性次级面及有限品牌章节。

| 契约项 | 规定 |
|---|---|
| 变体 | 连续面、摘要卡、编辑章节 |
| 适用状态 | default |
| 行为与恢复 | 只有真实独立对象才建卡；整卡跳转时避免嵌套交互区。 |
| 键盘 | 静态内容不进入Tab序列；按钮用Enter/Space，链接用Enter；焦点顺序跟随阅读顺序。 |
| 无障碍 | 语义标签优先；正文用semantic.text / semantic.muted，状态必须带文字；图标装饰时从可访问树隐藏。 |
| 响应式 | 320px仍能读完整核心信息；动作触控目标至少primitive.layout.touch；字号不整体缩小。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | 无独立事件 |
| 避免 | 把每个字段装进卡片，或在财务区堆叠装饰。 |

<a id="shell"></a>

### shell · 应用框架

**类别**：导航　**成熟度**：specified（规范已写，未实现）　**模块**：B11

固定当前空间、模块导航与主内容位置。

| 契约项 | 规定 |
|---|---|
| 变体 | 经营、创作者、会员、运营 |
| 适用状态 | default、loading、restricted |
| 行为与恢复 | 切换角色保留各自路径；权限未知先不展示敏感内容。 |
| 键盘 | Tab进入可交互项，Enter激活；集合内方向键规则见个别契约；Esc关闭临时面板并回焦。 |
| 无障碍 | 导航区域有名称；当前位置与选中语义明确；异步路由成功后聚焦主标题并播报页面名。 |
| 响应式 | 窄屏侧栏变可关闭导航；当前空间和返回入口常驻；长标签可换行。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 |
| 事件（提案） | routeChange(workspaceId,path) |
| 避免 | 个人购买、营业收入与创作者奖励混成同一首页余额。 |

<a id="workspace-switcher"></a>

### workspace-switcher · 工作空间切换

**类别**：导航　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B06、B09、B11

明确当前代表谁执行操作。

| 契约项 | 规定 |
|---|---|
| 变体 | 个人、品牌、团队 |
| 适用状态 | default、hover、focus、open、selected、loading、error |
| 行为与恢复 | 脏表单切换前处理未保存内容；成功后清除旧空间缓存与选择。 |
| 键盘 | Enter/Space打开；方向键移动、Enter确认目标、Esc取消；确认前不切实际空间。 |
| 无障碍 | 当前空间有可读名称与类型；切换中播报目标，成功后导航焦点进入新空间主标题。 |
| 响应式 | 窄屏侧栏变可关闭导航；当前空间和返回入口常驻；长标签可换行。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 |
| 事件（提案） | switchWorkspace(targetId,expectedCurrentId) |
| 避免 | 切换名称但仍提交旧组织标识。 |

<a id="sidebar"></a>

### sidebar · 侧栏导航

**类别**：导航　**成熟度**：specified（规范已写，未实现）　**模块**：B01

以模块和真实对象分组，使用稳定名称。

| 契约项 | 规定 |
|---|---|
| 变体 | 展开、折叠 |
| 适用状态 | default、hover、focus、active、expanded、collapsed |
| 行为与恢复 | 当前页标识与未读数分开；折叠后名称仍可读取。 |
| 键盘 | Tab进入可交互项，Enter激活；集合内方向键规则见个别契约；Esc关闭临时面板并回焦。 |
| 无障碍 | 导航区域有名称；当前位置与选中语义明确；异步路由成功后聚焦主标题并播报页面名。 |
| 响应式 | 窄屏侧栏变可关闭导航；当前空间和返回入口常驻；长标签可换行。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 |
| 事件（提案） | navigate(moduleId,path) |
| 避免 | 把未开放金融入口画成可使用。 |

<a id="breadcrumb"></a>

### breadcrumb · 面包屑

**类别**：导航　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B04、B05、B06、B07、B08、B09、B10、B11、B12

帮助返回父集合，当前位置不重复链接。

| 契约项 | 规定 |
|---|---|
| 变体 | 页面层级、对象层级 |
| 适用状态 | default、hover、focus、current |
| 行为与恢复 | 长路径中间收起但可展开；保留当前对象名称。 |
| 键盘 | Tab进入可交互项，Enter激活；集合内方向键规则见个别契约；Esc关闭临时面板并回焦。 |
| 无障碍 | 导航区域有名称；当前位置与选中语义明确；异步路由成功后聚焦主标题并播报页面名。 |
| 响应式 | 窄屏侧栏变可关闭导航；当前空间和返回入口常驻；长标签可换行。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 |
| 事件（提案） | navigateAncestor(path) |
| 避免 | 用面包屑替代浏览历史返回。 |

<a id="tabs"></a>

### tabs · 页签

**类别**：导航　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B04、B05、B06、B07、B08、B09、B10、B11、B12

在同一对象的相关视图切换。

| 契约项 | 规定 |
|---|---|
| 变体 | 局部内容、路由页签 |
| 适用状态 | default、hover、focus、selected、disabled、loading |
| 行为与恢复 | 本地页签方向键移动；远程内容手动确认激活，保留每页筛选。 |
| 键盘 | Tab进入当前页签；方向键移动，Home/End首尾；本地即时内容可自动激活，远程内容用Enter/Space激活。 |
| 无障碍 | tablist/tab/tabpanel配对；路由导航可改用a与aria-current，不混搭两种模式。 |
| 响应式 | 窄屏侧栏变可关闭导航；当前空间和返回入口常驻；长标签可换行。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 |
| 事件（提案） | selectTab(tabId) |
| 避免 | 将不同组织、付费状态用页签隐藏混淆。 |

<a id="command-menu"></a>

### command-menu · 快捷命令面板

**类别**：导航　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B04、B05、B06、B07、B08、B09、B10、B11、B12

搜索命令与对象，显示当前执行空间。

| 契约项 | 规定 |
|---|---|
| 变体 | 导航、已授权操作 |
| 适用状态 | closed、open、querying、empty、error、focused |
| 行为与恢复 | 高频键盘开关无动画；危险命令进入确认预览而非立即执行。 |
| 键盘 | 显式快捷键或按钮打开；方向键选择、Enter进入预览/导航、Esc关闭回焦；不劫持文本输入快捷键。 |
| 无障碍 | 搜索框与命令列表关联；结果按权限过滤；没有匹配时简短播报，不能读出受限标题。 |
| 响应式 | 窄屏侧栏变可关闭导航；当前空间和返回入口常驻；长标签可换行。 |
| 动效 | 高频开关与结果选择均0ms；不得等待入场动画。 |
| 事件（提案） | selectCommand(commandId,scope) |
| 避免 | 搜索索引暴露无权访问对象标题。 |

<a id="stepper"></a>

### stepper · 步骤导航

**类别**：导航　**成熟度**：specified（规范已写，未实现）　**模块**：B08、B12

展示流程进度与可返回步骤。

| 契约项 | 规定 |
|---|---|
| 变体 | 线性、可回访 |
| 适用状态 | current、complete、upcoming、blocked、error |
| 行为与恢复 | 完成只表示该步服务端接受；保留已填值，依赖改变使后续重新检查。 |
| 键盘 | Tab进入可交互项，Enter激活；集合内方向键规则见个别契约；Esc关闭临时面板并回焦。 |
| 无障碍 | 导航区域有名称；当前位置与选中语义明确；异步路由成功后聚焦主标题并播报页面名。 |
| 响应式 | 窄屏侧栏变可关闭导航；当前空间和返回入口常驻；长标签可换行。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 |
| 事件（提案） | requestStep(stepId) |
| 避免 | 把走到最后一步当作出款到账。 |

<a id="pagination"></a>

### pagination · 分页与继续加载

**类别**：导航　**成熟度**：specified（规范已写，未实现）　**模块**：B05

控制集合读取边界并显示已读取范围。

| 契约项 | 规定 |
|---|---|
| 变体 | 页码、游标 |
| 适用状态 | default、hover、focus、loading、disabled、end、error |
| 行为与恢复 | 筛选改变重置游标；加载失败保留旧行及原位置。 |
| 键盘 | Tab进入可交互项，Enter激活；集合内方向键规则见个别契约；Esc关闭临时面板并回焦。 |
| 无障碍 | 导航区域有名称；当前位置与选中语义明确；异步路由成功后聚焦主标题并播报页面名。 |
| 响应式 | 窄屏侧栏变可关闭导航；当前空间和返回入口常驻；长标签可换行。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 |
| 事件（提案） | requestPage(cursor,queryVersion) |
| 避免 | 游标接口虚构总页数；重复追加同一记录。 |

<a id="search"></a>

### search · 搜索框

**类别**：表单　**成熟度**：specified（规范已写，未实现）　**模块**：B05、B06、B11、B12

查询对象，区分未搜索与无结果。

| 契约项 | 规定 |
|---|---|
| 变体 | 即时搜索、提交搜索 |
| 适用状态 | empty、focus、typing、loading、results、no-results、error、disabled |
| 行为与恢复 | 中文输入法组合期间不提交；旧请求回包不得覆盖新词结果。 |
| 键盘 | Tab依字段顺序移动；输入保留原生编辑快捷键；中文输入法组合期不提交；只读值可选择复制。 |
| 无障碍 | label与控件关联；组用fieldset/legend；错误用aria-describedby及aria-invalid；说明不只靠颜色。 |
| 响应式 | 窄屏单列，label在上；软键盘出现后错误与保存可滚动到达；不固定遮挡字段。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 |
| 事件（提案） | search(query,requestId) |
| 避免 | 输入一个字就清空已有内容闪烁。 |

<a id="field"></a>

### field · 字段外壳

**类别**：表单　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B04、B05、B06、B07、B08、B09、B10、B11、B12

组合标签、说明、控件和错误关联。

| 契约项 | 规定 |
|---|---|
| 变体 | 普通、必填、可选 |
| 适用状态 | default、focus、error、disabled、readonly |
| 行为与恢复 | 必填在提交前说明；错误指出如何改，保留内容；只读仍可选取。 |
| 键盘 | Tab依字段顺序移动；输入保留原生编辑快捷键；中文输入法组合期不提交；只读值可选择复制。 |
| 无障碍 | label与控件关联；组用fieldset/legend；错误用aria-describedby及aria-invalid；说明不只靠颜色。 |
| 响应式 | 窄屏单列，label在上；软键盘出现后错误与保存可滚动到达；不固定遮挡字段。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 |
| 事件（提案） | 无独立事件 |
| 避免 | 只用 placeholder 作标签，禁用却不解释。 |

<a id="text-input"></a>

### text-input · 单行输入

**类别**：表单　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B03

编辑短值，使用相应输入键盘与自动填充提示。

| 契约项 | 规定 |
|---|---|
| 变体 | 文本、邮箱、网址、电话 |
| 适用状态 | default、hover、focus、filled、disabled、readonly、error |
| 行为与恢复 | 网址提交保留原文和标准化结果；验证在合适时机，避免逐字报错。 |
| 键盘 | Tab依字段顺序移动；输入保留原生编辑快捷键；中文输入法组合期不提交；只读值可选择复制。 |
| 无障碍 | label与控件关联；组用fieldset/legend；错误用aria-describedby及aria-invalid；说明不只靠颜色。 |
| 响应式 | 窄屏单列，label在上；软键盘出现后错误与保存可滚动到达；不固定遮挡字段。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 |
| 事件（提案） | change(value);commit(value) |
| 避免 | 电话、身份证号当数值去掉前导零。 |

<a id="textarea"></a>

### textarea · 多行输入

**类别**：表单　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B04、B05、B06、B07、B08、B09、B10、B11、B12

填写自然语言，限制来自业务要求。

| 契约项 | 规定 |
|---|---|
| 变体 | 说明、审核理由、备注 |
| 适用状态 | empty、focus、filled、readonly、disabled、error |
| 行为与恢复 | 超长保留输入并说明剩余/超出；自动增长有边界且不遮操作。 |
| 键盘 | Tab依字段顺序移动；输入保留原生编辑快捷键；中文输入法组合期不提交；只读值可选择复制。 |
| 无障碍 | label与控件关联；组用fieldset/legend；错误用aria-describedby及aria-invalid；说明不只靠颜色。 |
| 响应式 | 窄屏单列，label在上；软键盘出现后错误与保存可滚动到达；不固定遮挡字段。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 |
| 事件（提案） | change(text) |
| 避免 | 单按 Enter 提交整张表。 |

<a id="number-input"></a>

### number-input · 数量输入

**类别**：表单　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B04、B05、B06、B07、B08、B09、B10、B11、B12

输入名额、数量或比率并明确单位。

| 契约项 | 规定 |
|---|---|
| 变体 | 整数、小数、百分比 |
| 适用状态 | empty、focus、filled、readonly、disabled、error |
| 行为与恢复 | 步长及范围来自字段契约；允许编辑中间态，滚轮不意外改值。 |
| 键盘 | 保留文本编辑及数字输入；若提供步进按钮则可Tab到达；滚轮不得改值；中文输入组合不提交。 |
| 无障碍 | 单位、最小/最大、精度可读；仅真正实现增减语义时使用spinbutton。 |
| 响应式 | 窄屏单列，label在上；软键盘出现后错误与保存可滚动到达；不固定遮挡字段。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 |
| 事件（提案） | change(raw);commit(decimal,unit) |
| 避免 | 把空输入自动变零；将百分数和小数率混用。 |

<a id="money-input"></a>

### money-input · 金额输入

**类别**：表单　**成熟度**：specified（规范已写，未实现）　**模块**：B02、B06、B07、B09、B11

录入金额、币种和费项用途。

| 契约项 | 规定 |
|---|---|
| 变体 | 单币种、带币种选择 |
| 适用状态 | empty、focus、filled、readonly、disabled、error、quote-stale |
| 行为与恢复 | 内部精确十进制或最小货币单位；换币不擅自换数，重取报价并确认。 |
| 键盘 | Tab依字段顺序移动；输入保留原生编辑快捷键；中文输入法组合期不提交；只读值可选择复制。 |
| 无障碍 | label与控件关联；组用fieldset/legend；错误用aria-describedby及aria-invalid；说明不只靠颜色。 |
| 响应式 | 窄屏单列，label在上；软键盘出现后错误与保存可滚动到达；不固定遮挡字段。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 |
| 事件（提案） | commit(amount,currency,quoteId) |
| 避免 | 使用浮点累计资金；默认所有币种两位小数。 |

<a id="checkbox"></a>

### checkbox · 复选框

**类别**：表单　**成熟度**：specified（规范已写，未实现）　**模块**：B01

表达可同时选取的选项。

| 契约项 | 规定 |
|---|---|
| 变体 | 独立、组、全选 |
| 适用状态 | unchecked、hover、pressed、focus、checked、indeterminate、disabled、error、readonly |
| 行为与恢复 | 全选注明本页或全部查询；部分选中只用于父级汇总。 |
| 键盘 | Tab进入；Space切换；父级mixed激活选全指定范围，再次激活清除；只读时不写入。 |
| 无障碍 | 原生checkbox；父级汇总使用indeterminate/aria-checked=mixed；label与选择范围关联。 |
| 响应式 | 窄屏单列，label在上；软键盘出现后错误与保存可滚动到达；不固定遮挡字段。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 |
| 事件（提案） | change(checked,scope) |
| 避免 | 把条款默认勾选；将 indeterminate 写成第三种用户同意。 |

<a id="radio"></a>

### radio · 单选组

**类别**：表单　**成熟度**：specified（规范已写，未实现）　**模块**：B03

在互斥选项中作一个选择。

| 契约项 | 规定 |
|---|---|
| 变体 | 列表、带说明选项 |
| 适用状态 | unselected、hover、focus、selected、disabled、error、readonly |
| 行为与恢复 | 组有名称；方向键选同组，Tab离组；修改可能影响金额须预览。 |
| 键盘 | Tab进出单选组；方向键切换同组；禁用项跳过；无默认值时首个可用项可获得焦点。 |
| 无障碍 | 原生radio和fieldset/legend；required与错误作用于组，不逐项重复播报。 |
| 响应式 | 窄屏单列，label在上；软键盘出现后错误与保存可滚动到达；不固定遮挡字段。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 |
| 事件（提案） | change(optionId) |
| 避免 | 无法取消的选择用独立复选框伪装。 |

<a id="switch"></a>

### switch · 即时开关

**类别**：表单　**成熟度**：specified（规范已写，未实现）　**模块**：B04

切换立即生效的二态设置。

| 契约项 | 规定 |
|---|---|
| 变体 | 偏好、非危险即时设置 |
| 适用状态 | off、on、hover、pressed、focus、disabled、saving、error |
| 行为与恢复 | 保存失败恢复最后确认状态并解释；加载时不再切换。 |
| 键盘 | Tab聚焦、Space切换；Enter仅按底层控件约定；请求中阻止第二次切换。 |
| 无障碍 | switch语义、aria-checked准确反映当前确认值；标签固定，保存与错误由邻接status说明。 |
| 响应式 | 窄屏单列，label在上；软键盘出现后错误与保存可滚动到达；不固定遮挡字段。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 |
| 事件（提案） | requestToggle(next,version) |
| 避免 | 用开关绕过发布、扣款或删除确认。 |

<a id="select"></a>

### select · 选择器

**类别**：表单　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B04、B05、B06、B07、B08、B09、B10、B11、B12

从明确集合选择，支持动态来源。

| 契约项 | 规定 |
|---|---|
| 变体 | 原生单选、可搜索单选、多选 |
| 适用状态 | closed、open、focus、selected、loading、empty、error、disabled、readonly |
| 行为与恢复 | 方向键移动、Enter选择、Esc关闭；多选显示已选项及移除名称。 |
| 键盘 | 原生选择器保留系统键盘；自定义组合框方向键导航、Enter选择、Esc关闭；输入法组合期间不触发选定。 |
| 无障碍 | 自定义时正确关联combobox/listbox、expanded、active-descendant及选项；远程空态需播报。 |
| 响应式 | 窄屏单列，label在上；软键盘出现后错误与保存可滚动到达；不固定遮挡字段。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 |
| 事件（提案） | change(selectedIds) |
| 避免 | 未知值静默选第一项；隐藏已失效的保存值。 |

<a id="segmented-control"></a>

### segmented-control · 分段选择

**类别**：表单　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B04、B05、B06、B07、B08、B09、B10、B11、B12

少量互斥呈现模式，例如日/月。

| 契约项 | 规定 |
|---|---|
| 变体 | 视图、短选项 |
| 适用状态 | default、hover、focus、selected、disabled |
| 行为与恢复 | 用单选或页签语义按用途选一种；保持标签完整。 |
| 键盘 | Tab依字段顺序移动；输入保留原生编辑快捷键；中文输入法组合期不提交；只读值可选择复制。 |
| 无障碍 | label与控件关联；组用fieldset/legend；错误用aria-describedby及aria-invalid；说明不只靠颜色。 |
| 响应式 | 窄屏单列，label在上；软键盘出现后错误与保存可滚动到达；不固定遮挡字段。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 |
| 事件（提案） | change(mode) |
| 避免 | 把它用于长文本或高风险确认。 |

<a id="date-time"></a>

### date-time · 日期时间选择

**类别**：表单　**成熟度**：specified（规范已写，未实现）　**模块**：B02、B06、B07、B09、B10

定义排期、账期和统计区间。

| 契约项 | 规定 |
|---|---|
| 变体 | 日期、日期区间、时间与时区 |
| 适用状态 | empty、focus、selected、unavailable、error、readonly、disabled |
| 行为与恢复 | 提供文本输入替代日历；起止、含边界规则、时区同时可见。 |
| 键盘 | 文本字段可直接填写；日历方向键移日，Home/End按周、PageUp/Down移月；Enter选择、Esc关闭并回焦。 |
| 无障碍 | 日历网格有年月说明，今日与选中分别表达；不可选日期说明原因；时区字段有独立标签。 |
| 响应式 | 窄屏单列，label在上；软键盘出现后错误与保存可滚动到达；不固定遮挡字段。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 |
| 事件（提案） | commit(start,end,timeZone) |
| 避免 | 把午夜UTC静默解释为用户本地日期。 |

<a id="slider"></a>

### slider · 范围滑杆

**类别**：表单　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B04、B05、B06、B07、B08、B09、B10、B11、B12

探索非精确的连续范围。

| 契约项 | 规定 |
|---|---|
| 变体 | 单值、区间 |
| 适用状态 | default、hover、focus、dragging、disabled、readonly |
| 行为与恢复 | 方向键和Home/End可调；配数值输入，松手提交高成本查询。 |
| 键盘 | 方向键按步长移动，Home/End到边界；区间两个滑块分别可达；数值输入是等价替代。 |
| 无障碍 | 各滑块有名称、min/max/now和含单位的valuetext；上下限不交叉；不用仅拖拽。 |
| 响应式 | 窄屏单列，label在上；软键盘出现后错误与保存可滚动到达；不固定遮挡字段。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 |
| 事件（提案） | preview(value);commit(value) |
| 避免 | 仅靠拖拽录入结算金额。 |

<a id="file-upload"></a>

### file-upload · 文件上传

**类别**：表单　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B03、B05、B06、B10、B11

上传素材或证据，区分传完与可用。

| 契约项 | 规定 |
|---|---|
| 变体 | 单文件、多文件、分片任务 |
| 适用状态 | idle、dragover、validating、uploading、processing、ready、error、canceled |
| 行为与恢复 | 校验类型和限制；失败按文件恢复；服务端就绪才允许引用。 |
| 键盘 | 可聚焦的选择文件按钮调用系统选择器；删除/取消/重试每文件可达；拖拽仅是替代入口。 |
| 无障碍 | 逐文件状态有名称；aria-live汇总阶段变化；不要逐字节播报百分比；说明允许类型和实际大小限制。 |
| 响应式 | 窄屏单列，label在上；软键盘出现后错误与保存可滚动到达；不固定遮挡字段。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 |
| 事件（提案） | add(files);cancel(uploadId);retry(uploadId) |
| 避免 | 拖拽唯一入口；宣称支持未经接口验证的续传。 |

<a id="rich-editor"></a>

### rich-editor · 富文本编辑器

**类别**：表单　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B03、B04

编辑结构化正文并保留可访问层级。

| 契约项 | 规定 |
|---|---|
| 变体 | 商品介绍、内容页、帖子 |
| 适用状态 | empty、focus、editing、saving、saved、error、readonly |
| 行为与恢复 | 工具栏键盘可达；粘贴清理危险内容；自动保存展示时间和冲突。 |
| 键盘 | Tab可离开编辑区域；工具栏方向键导航；保留复制、粘贴、撤销及输入法行为；快捷键可查。 |
| 无障碍 | 有编辑区名称、工具栏名称、格式状态与文档结构；保存状态不能覆盖作者正文。 |
| 响应式 | 窄屏单列，label在上；软键盘出现后错误与保存可滚动到达；不固定遮挡字段。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 |
| 事件（提案） | change(document);save(version) |
| 避免 | 用编辑器渲染不受信任脚本；悄悄覆盖另一人的内容。 |

<a id="form"></a>

### form · 表单提交容器

**类别**：表单　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B04、B07、B09、B10

管理整表校验、保存和重复请求。

| 契约项 | 规定 |
|---|---|
| 变体 | 设置、创建、多步 |
| 适用状态 | pristine、dirty、validating、submitting、success、error、conflict、readonly |
| 行为与恢复 | 先校验再锁请求；错误摘要链接字段；超时未知先查原请求，再决定重试。 |
| 键盘 | Enter仅在符合原生单行表单语义时提交；多行和输入法组合期不提交；失败聚焦错误摘要并可跳回字段。 |
| 无障碍 | 错误摘要与字段一一关联；submitting标busy但不隐藏label；验证成功不重复播报整表。 |
| 响应式 | 窄屏单列，label在上；软键盘出现后错误与保存可滚动到达；不固定遮挡字段。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 |
| 事件（提案） | submit(values,expectedVersion,operationId) |
| 避免 | 双击创建两笔付款；失败清空表单或关闭弹窗。 |

<a id="filter-builder"></a>

### filter-builder · 筛选条件组

**类别**：数据　**成熟度**：specified（规范已写，未实现）　**模块**：B05、B06、B08

明确字段、运算符、值及组合关系。

| 契约项 | 规定 |
|---|---|
| 变体 | 快速筛选、组合条件、保存视图 |
| 适用状态 | default、editing、applied、empty、loading、error |
| 行为与恢复 | 清除只清筛选；改变条件后重置选择并提示；保留可分享的合法条件。 |
| 键盘 | Tab仅进入真实动作；静态表格不冒充可编辑网格；排序与展开有按钮，选择使用原生控件。 |
| 无障碍 | 提供表头、单位、来源与文字替代；仅当前必要结果礼貌播报；不逐行播报后台刷新。 |
| 响应式 | 窄屏先保留名称、状态、金额与下一动作；表格允许标明的横向滚动或等价行详情。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | apply(filterAst);clear();saveView(name) |
| 避免 | 搜索与排序规则冲突时静默忽略条件。 |

<a id="data-table"></a>

### data-table · 数据表格

**类别**：数据　**成熟度**：specified（规范已写，未实现）　**模块**：B04、B05、B07

按列比较同类对象及精确金额。

| 契约项 | 规定 |
|---|---|
| 变体 | 只读、可排序、可选择 |
| 适用状态 | loading、ready、empty、no-results、error、stale、selected、partial-selection |
| 行为与恢复 | 表头说明排序；分页选择范围可见；行操作与行跳转分开。 |
| 键盘 | Tab到排序、选择、链接和行操作；原生表格不用方向键劫持阅读；横向区域可聚焦滚动。 |
| 无障碍 | table/caption/th与列关联；排序有aria-sort；行复选框名称含对象；不轻率改成grid。 |
| 响应式 | 窄屏先保留名称、状态、金额与下一动作；表格允许标明的横向滚动或等价行详情。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | sort(column,direction);select(ids,scope);openRow(id) |
| 避免 | 自动重排使正在操作的行移位；只用颜色标负数。 |

<a id="list-detail"></a>

### list-detail · 列表与详情

**类别**：数据　**成熟度**：specified（规范已写，未实现）　**模块**：B04、B05、B06

高频队列先找对象再处理。

| 契约项 | 规定 |
|---|---|
| 变体 | 并排、独立详情 |
| 适用状态 | loading、empty、no-results、unselected、selected、error、stale |
| 行为与恢复 | 选择写入地址；返回还原筛选滚动；窄屏详情独立显示。 |
| 键盘 | Tab访问行链接/选择按钮及行操作；专用列表方向键仅移动选项，Enter才进入详情；返回恢复原选择。 |
| 无障碍 | 列表有名称；链接用aria-current，选择按钮用aria-pressed；未选择详情提供说明。 |
| 响应式 | 窄屏先保留名称、状态、金额与下一动作；表格允许标明的横向滚动或等价行详情。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | selectObject(id);backToList() |
| 避免 | 所有模块强制三栏；按箭头切行立即保存业务决定。 |

<a id="property-list"></a>

### property-list · 属性清单

**类别**：数据　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B04、B07

以名称和值解释当前对象。

| 契约项 | 规定 |
|---|---|
| 变体 | 只读、单属性编辑 |
| 适用状态 | default、empty、unknown、editing、saving、error、readonly |
| 行为与恢复 | 未知、未填写、不适用分开；单字段保存仍校验对象版本。 |
| 键盘 | Tab仅进入真实动作；静态表格不冒充可编辑网格；排序与展开有按钮，选择使用原生控件。 |
| 无障碍 | 提供表头、单位、来源与文字替代；仅当前必要结果礼貌播报；不逐行播报后台刷新。 |
| 响应式 | 窄屏先保留名称、状态、金额与下一动作；表格允许标明的横向滚动或等价行详情。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | editProperty(key,value,version) |
| 避免 | 在属性标签上藏金额修改入口。 |

<a id="metric"></a>

### metric · 指标摘要

**类别**：数据　**成熟度**：specified（规范已写，未实现）　**模块**：B04、B07、B08、B10

展示指标、口径、期间和比较基础。

| 契约项 | 规定 |
|---|---|
| 变体 | 计数、金额、比率、差值 |
| 适用状态 | loading、ready、zero、unknown、stale、insufficient-sample、error |
| 行为与恢复 | 分母为零时比率不适用；缺失工时显示覆盖率；点击可追溯明细。 |
| 键盘 | Tab仅进入真实动作；静态表格不冒充可编辑网格；排序与展开有按钮，选择使用原生控件。 |
| 无障碍 | 提供表头、单位、来源与文字替代；仅当前必要结果礼貌播报；不逐行播报后台刷新。 |
| 响应式 | 窄屏先保留名称、状态、金额与下一动作；表格允许标明的横向滚动或等价行详情。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | drillDown(metricId,period,definitionVersion) |
| 避免 | 收入、代转奖励、贡献、净利润混称收益。 |

<a id="chart"></a>

### chart · 图表

**类别**：数据　**成熟度**：specified（规范已写，未实现）　**模块**：B04、B08、B10

解释趋势与比较，并提供等价数据表。

| 契约项 | 规定 |
|---|---|
| 变体 | 条形、时间序列、构成 |
| 适用状态 | loading、ready、empty、partial、unknown、error |
| 行为与恢复 | 坐标单位、时区、分母和来源固定可见；缺失留断点。 |
| 键盘 | Tab仅进入真实动作；静态表格不冒充可编辑网格；排序与展开有按钮，选择使用原生控件。 |
| 无障碍 | 提供表头、单位、来源与文字替代；仅当前必要结果礼貌播报；不逐行播报后台刷新。 |
| 响应式 | 窄屏先保留名称、状态、金额与下一动作；表格允许标明的横向滚动或等价行详情。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | inspectPoint(seriesId,key);selectRange(range) |
| 避免 | 用虚构补零连线；用动画滚动金额。 |

<a id="progress"></a>

### progress · 进度指示

**类别**：反馈　**成熟度**：specified（规范已写，未实现）　**模块**：B07、B08、B12

告诉用户正在做什么，是否还能操作。

| 契约项 | 规定 |
|---|---|
| 变体 | 确定进度、不确定等待 |
| 适用状态 | idle、running、paused、complete、error、unknown |
| 行为与恢复 | 有真实总量才显示百分比；完成指处理阶段结束，业务另有状态。 |
| 键盘 | 状态变化不抢焦点；恢复按钮可Tab到达；只在用户提交失败后把焦点送到错误摘要。 |
| 无障碍 | 普通进度用status或progressbar；阻塞错误仅在出现时播报一次；不持续重复读屏。 |
| 响应式 | 提示不遮挡表单和主要动作；窄屏换行保持原因及恢复按钮完整。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | cancel(jobId)仅当任务支持 |
| 避免 | 伪造99%进度或把进度完成当审核通过。 |

<a id="skeleton"></a>

### skeleton · 骨架占位

**类别**：反馈　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B04、B05、B06、B07、B08、B09、B10、B11、B12

首次加载保留即将出现的结构空间。

| 契约项 | 规定 |
|---|---|
| 变体 | 文本行、列表、媒体 |
| 适用状态 | loading |
| 行为与恢复 | 屏幕阅读器只读一次加载说明；刷新时保留旧内容和更新时间。 |
| 键盘 | 状态变化不抢焦点；恢复按钮可Tab到达；只在用户提交失败后把焦点送到错误摘要。 |
| 无障碍 | 普通进度用status或progressbar；阻塞错误仅在出现时播报一次；不持续重复读屏。 |
| 响应式 | 提示不遮挡表单和主要动作；窄屏换行保持原因及恢复按钮完整。 |
| 动效 | 静态占位优先；减少动态时不闪动。 |
| 事件（提案） | 无独立事件 |
| 避免 | 用骨架盖住用户已输入内容；长期无限闪动。 |

<a id="empty-state"></a>

### empty-state · 空状态

**类别**：反馈　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B04、B05、B06、B07、B08、B09、B10、B11、B12

说明为什么为空和能做什么。

| 契约项 | 规定 |
|---|---|
| 变体 | 首次无对象、无匹配、未选择、无权限 |
| 适用状态 | empty、no-results、unselected、restricted |
| 行为与恢复 | 首次给创建入口；无匹配保留过滤；无权限给请求访问路径。 |
| 键盘 | 状态变化不抢焦点；恢复按钮可Tab到达；只在用户提交失败后把焦点送到错误摘要。 |
| 无障碍 | 普通进度用status或progressbar；阻塞错误仅在出现时播报一次；不持续重复读屏。 |
| 响应式 | 提示不遮挡表单和主要动作；窄屏换行保持原因及恢复按钮完整。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | create();clearFilters();requestAccess() |
| 避免 | 所有空状态统一写暂无数据，或以空态遮错误。 |

<a id="alert"></a>

### alert · 持久提示

**类别**：反馈　**成熟度**：specified（规范已写，未实现）　**模块**：B08

解释影响当前任务的事实与恢复动作。

| 契约项 | 规定 |
|---|---|
| 变体 | 信息、成功、警告、错误 |
| 适用状态 | visible、dismissible、actionable |
| 行为与恢复 | 关键错误留在相关区域；服务中断说明受影响范围、最近成功时间。 |
| 键盘 | 状态变化不抢焦点；恢复按钮可Tab到达；只在用户提交失败后把焦点送到错误摘要。 |
| 无障碍 | 普通进度用status或progressbar；阻塞错误仅在出现时播报一次；不持续重复读屏。 |
| 响应式 | 提示不遮挡表单和主要动作；窄屏换行保持原因及恢复按钮完整。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | retry(scope);dismiss(messageId) |
| 避免 | 把长期付款未知只做短暂Toast。 |

<a id="toast"></a>

### toast · 短暂反馈

**类别**：反馈　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B04、B05、B06、B07、B08、B09、B10、B11、B12

报告低风险操作结果，不抢焦点。

| 契约项 | 规定 |
|---|---|
| 变体 | 确认、可撤销提示 |
| 适用状态 | queued、visible、paused、dismissed |
| 行为与恢复 | 聚焦/悬停/页面隐藏暂停计时；撤销只在真实支持且有期限时显示。 |
| 键盘 | 状态变化不抢焦点；恢复按钮可Tab到达；只在用户提交失败后把焦点送到错误摘要。 |
| 无障碍 | 普通进度用status或progressbar；阻塞错误仅在出现时播报一次；不持续重复读屏。 |
| 响应式 | 提示不遮挡表单和主要动作；窄屏换行保持原因及恢复按钮完整。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | undo(operationId);dismiss(id) |
| 避免 | 唯一错误或资金凭证藏在自动消失提示。 |

<a id="notification-inbox"></a>

### notification-inbox · 通知收件箱

**类别**：反馈　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B12

保存需要以后处理的通知。

| 契约项 | 规定 |
|---|---|
| 变体 | 全部、未读、按对象 |
| 适用状态 | loading、unread、read、empty、error、unavailable-target |
| 行为与恢复 | 打开跳到原对象且重新检查权限；已读与已处理分开。 |
| 键盘 | 状态变化不抢焦点；恢复按钮可Tab到达；只在用户提交失败后把焦点送到错误摘要。 |
| 无障碍 | 普通进度用status或progressbar；阻塞错误仅在出现时播报一次；不持续重复读屏。 |
| 响应式 | 提示不遮挡表单和主要动作；窄屏换行保持原因及恢复按钮完整。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | markRead(ids);openTarget(objectId) |
| 避免 | 读通知即视为接受规则或完成付款。 |

<a id="error-recovery"></a>

### error-recovery · 错误恢复面

**类别**：反馈　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B04、B08

区分本地网络、身份和业务失败。

| 契约项 | 规定 |
|---|---|
| 变体 | 断网、服务异常、会话过期、权限变化 |
| 适用状态 | offline、retrying、recovered、unauthorized、unknown |
| 行为与恢复 | 保留非敏感草稿；重登后重新验证空间及请求结果；给支持关联号。 |
| 键盘 | 状态变化不抢焦点；恢复按钮可Tab到达；只在用户提交失败后把焦点送到错误摘要。 |
| 无障碍 | 普通进度用status或progressbar；阻塞错误仅在出现时播报一次；不持续重复读屏。 |
| 响应式 | 提示不遮挡表单和主要动作；窄屏换行保持原因及恢复按钮完整。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | reconnect();reauthenticate();queryOperation(id) |
| 避免 | 断网后自动重放资金命令。 |

<a id="tooltip"></a>

### tooltip · 说明提示

**类别**：浮层　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B04、B05、B06、B07、B08、B09、B10、B11、B12

提供非必需的短补充说明。

| 契约项 | 规定 |
|---|---|
| 变体 | 短说明、图标名称补充 |
| 适用状态 | closed、hover、focus、open |
| 行为与恢复 | 首次悬停稍候、相邻即时；焦点可见且Esc关闭，内容不含交互。 |
| 键盘 | Esc关闭最上层；触发点回焦；菜单方向键，模态Tab循环；无触发点时回到合理后继对象。 |
| 无障碍 | 有标题及名称；模态设置dialog与aria-modal并隔离背景；tooltip只作补充描述。 |
| 响应式 | 依当前布局规则及内容最小宽度适配；视口内留边；长内容内部滚动且操作可达。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 从触发点展开；不从scale(0)开始。 |
| 事件（提案） | 无业务事件 |
| 避免 | 关键政策、错误恢复或唯一按钮名称只在提示里。 |

<a id="popover"></a>

### popover · 锚定浮层

**类别**：浮层　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B04、B05、B06、B07、B08、B09、B10、B11、B12

承载与触发点紧密关联的小任务。

| 契约项 | 规定 |
|---|---|
| 变体 | 属性、日期、短筛选 |
| 适用状态 | closed、open、focus、loading、error |
| 行为与恢复 | 向触发点展开，避开视口边界；关闭回焦；表单脏值遵循表单契约。 |
| 键盘 | Tab按内容顺序；Esc关闭并回到触发点；非模态不锁住整页焦点。 |
| 无障碍 | 触发器关联浮层及expanded；根据真实内容使用dialog或选择器语义，不统一声明菜单。 |
| 响应式 | 依当前布局规则及内容最小宽度适配；视口内留边；长内容内部滚动且操作可达。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 从触发点展开；不从scale(0)开始。 |
| 事件（提案） | openChange(open,reason) |
| 避免 | 长篇审批或多阶段出款塞入小浮层。 |

<a id="menu"></a>

### menu · 操作菜单

**类别**：浮层　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B04、B05、B06、B07、B08、B09、B10、B11、B12

列出针对同一对象的动词动作。

| 契约项 | 规定 |
|---|---|
| 变体 | 对象操作、上下文操作 |
| 适用状态 | closed、open、focused、disabled |
| 行为与恢复 | 方向键/Home/End导航，Enter执行；危险项分组并进入确认。 |
| 键盘 | Enter/Space打开；方向键/Home/End导航；Enter执行、Esc关闭回焦；禁用项可读取原因但不能执行。 |
| 无障碍 | menu/menuitem仅用于动作菜单；标明haspopup/expanded；分组及危险操作有文本。 |
| 响应式 | 依当前布局规则及内容最小宽度适配；视口内留边；长内容内部滚动且操作可达。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 从触发点展开；不从scale(0)开始。 |
| 事件（提案） | selectAction(actionId,objectId) |
| 避免 | 菜单项兼作复选表单而不声明语义。 |

<a id="dialog"></a>

### dialog · 模态对话框

**类别**：浮层　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B04、B05、B06、B07、B08、B09、B10、B11、B12

集中完成一个短任务。

| 契约项 | 规定 |
|---|---|
| 变体 | 编辑、确认、关键决定 |
| 适用状态 | closed、open、submitting、error、conflict |
| 行为与恢复 | 全12模块共用浮层基础；锁背景交互、焦点循环、关闭回焦；未保存时先确认舍弃。出款取消仅在服务端确认可取消时复用确认变体，不新增任意人工审批。 |
| 键盘 | 打开聚焦安全字段或标题；Tab/Shift+Tab在模态循环；Esc按未保存规则关闭；回焦触发点或合理后继。 |
| 无障碍 | dialog有标题和必要说明，aria-modal并隔离背景；复杂正文不全塞aria-describedby。 |
| 响应式 | 依当前布局规则及内容最小宽度适配；视口内留边；长内容内部滚动且操作可达。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 |
| 事件（提案） | confirm(values,operationId);close(reason) |
| 避免 | 失败关闭；默认聚焦不可逆确认。把每个普通操作强制变成审批流程；把确认点击当取消已完成。 |

<a id="drawer"></a>

### drawer · 抽屉

**类别**：浮层　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B04、B05、B06、B07、B08、B09、B10、B11、B12

在保留上下文时查看详情或设置。

| 契约项 | 规定 |
|---|---|
| 变体 | 详情、窄屏筛选 |
| 适用状态 | closed、open、loading、error、dirty |
| 行为与恢复 | 模态型遵循对话框焦点规则；非模态不锁焦点；拖动以外有关闭按钮。 |
| 键盘 | 模态型焦点循环，非模态型可Tab到页面；Esc及明确关闭按钮等价；不依赖滑动手势。 |
| 无障碍 | 模态属性必须和实际背景交互一致；有名称、返回路径及可达关闭按钮。 |
| 响应式 | 依当前布局规则及内容最小宽度适配；视口内留边；长内容内部滚动且操作可达。 |
| 动效 | 键盘触发0ms；指针反馈用primitive.motion.fast / standard及primitive.motion.ease；只动transform/opacity，减少动态时取消位移。 |
| 事件（提案） | openChange(open,reason) |
| 避免 | 只支持手势关闭；软键盘挡住主操作。 |

<a id="image"></a>

### image · 图片与缩略图

**类别**：媒体　**成熟度**：specified（规范已写，未实现）　**模块**：B01

呈现素材并保持预留比例。

| 契约项 | 规定 |
|---|---|
| 变体 | 内容图、证据图、概念摄影 |
| 适用状态 | loading、ready、error、restricted |
| 行为与恢复 | 按内容提供替代文本；原始证据可放大，概念摄影标注非真实客户。 |
| 键盘 | 播放、暂停、放大、下载都有可聚焦控件；不依赖拖拽、鼠标悬停或手势。 |
| 无障碍 | 替代文本、字幕或文本替代按素材实际提供；缺失替代内容标明并提供人工补齐路径。 |
| 响应式 | 预留宽高比；证据完整查看可放大；播放器、批注和说明在窄屏按顺序堆叠。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | openOriginal(assetId) |
| 避免 | 裁掉证据水印；把生成图当真实业绩。 |

<a id="media-player"></a>

### media-player · 媒体播放器

**类别**：媒体　**成熟度**：specified（规范已写，未实现）　**模块**：B03、B06

查看作品、课程与直播回放。

| 契约项 | 规定 |
|---|---|
| 变体 | 视频、音频、嵌入 |
| 适用状态 | loading、ready、playing、paused、buffering、ended、error、restricted |
| 行为与恢复 | 不自动播声；支持字幕、文本替代、可见控件；切版本不沿用错误时间点。 |
| 键盘 | Tab访问播放、暂停、音量、字幕、全屏和进度；进度方向键只在控件聚焦时处理。 |
| 无障碍 | 视频字幕/音频文本替代按实际素材供给；缺失明确标记；不自动出声，控制按钮有可读状态。 |
| 响应式 | 预留宽高比；证据完整查看可放大；播放器、批注和说明在窄屏按顺序堆叠。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | play();pause();seek(seconds,assetVersion) |
| 避免 | 暗示每个外部视频都能下载或有字幕接口。 |

<a id="file-preview"></a>

### file-preview · 文件预览与下载

**类别**：媒体　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B03、B10、B12

说明文件名、类型、大小、来源与可用性。

| 契约项 | 规定 |
|---|---|
| 变体 | 文档、证据、附件 |
| 适用状态 | loading、ready、unsupported、expired、error、restricted |
| 行为与恢复 | 预览失败可在权限允许时下载；链接过期重取；附件保留与对象关系。 |
| 键盘 | 播放、暂停、放大、下载都有可聚焦控件；不依赖拖拽、鼠标悬停或手势。 |
| 无障碍 | 替代文本、字幕或文本替代按素材实际提供；缺失替代内容标明并提供人工补齐路径。 |
| 响应式 | 预留宽高比；证据完整查看可放大；播放器、批注和说明在窄屏按顺序堆叠。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | preview(fileId);requestDownload(fileId) |
| 避免 | 不支持预览就说文件不存在；直出私密长效地址。 |

<a id="annotation"></a>

### annotation · 媒体批注

**类别**：媒体　**成熟度**：specified（规范已写，未实现）　**模块**：B06

把反馈绑定具体媒体版本和位置。

| 契约项 | 规定 |
|---|---|
| 变体 | 时间点、选区、版本评论 |
| 适用状态 | draft、posting、posted、resolved、error、readonly |
| 行为与恢复 | 编辑后另留记录；旧版本批注不会无说明移动到新版。 |
| 键盘 | 播放、暂停、放大、下载都有可聚焦控件；不依赖拖拽、鼠标悬停或手势。 |
| 无障碍 | 替代文本、字幕或文本替代按素材实际提供；缺失替代内容标明并提供人工补齐路径。 |
| 响应式 | 预留宽高比；证据完整查看可放大；播放器、批注和说明在窄屏按顺序堆叠。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | addAnnotation(assetVersion,anchor,text);resolve(id) |
| 避免 | 批注解决当作最终内容通过。 |

<a id="asset-library"></a>

### asset-library · 素材库与选择

**类别**：媒体　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B03、B06、B07、B08、B12

选择可用于当前活动及渠道的媒体。

| 契约项 | 规定 |
|---|---|
| 变体 | 授权素材、个人素材、生成素材 |
| 适用状态 | loading、empty、selected、uploading、error、expired-rights |
| 行为与恢复 | 显示权利来源、用途和期限；过期素材保留历史记录并阻止新使用。 |
| 键盘 | 播放、暂停、放大、下载都有可聚焦控件；不依赖拖拽、鼠标悬停或手势。 |
| 无障碍 | 替代文本、字幕或文本替代按素材实际提供；缺失替代内容标明并提供人工补齐路径。 |
| 响应式 | 预留宽高比；证据完整查看可放大；播放器、批注和说明在窄屏按顺序堆叠。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | selectAsset(assetId,rightsVersion) |
| 避免 | 素材能看见就默认可商用、改编或投广告。 |

<a id="campaign-brief"></a>

### campaign-brief · 奖励活动详情

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B06、B07

Creator Rewards主入口：目标、素材、规则、结果计酬与下一步。

| 契约项 | 规定 |
|---|---|
| 变体 | 公开、申请制、私密 |
| 适用状态 | draft、open、paused、ended、restricted、incomplete-rules |
| 行为与恢复 | 组合规则摘要、预算、日期和参与入口；未确认计量口径只预览，不承诺收益。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | requestJoin(campaignId,ruleVersion) |
| 避免 | 把UGC形式直接当按帖计费；把公开活动当无门槛。 |

<a id="rule-editor"></a>

### rule-editor · 活动规则与版本

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B06、B07

管理适用版本、权利、窗口、单价与启用的上限。

| 契约项 | 规定 |
|---|---|
| 变体 | 草拟、版本比较、参与确认 |
| 适用状态 | draft、invalid、preview、active、superseded、conflict、readonly |
| 行为与恢复 | 发布前展示差异和受影响人；既有提交不静默覆盖；条款接受留版本证据。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | saveRule(version);requestActivate(diff,affectedScope) |
| 避免 | 预填15%为正式价格；把聊天追加要求用于拒稿。 |

<a id="budget"></a>

### budget · 奖励预算面板

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B06、B08

区分预算上限、已占用、已确认义务及可退额。

| 契约项 | 规定 |
|---|---|
| 变体 | 活动预算、单稿上限、任务池 |
| 适用状态 | loading、available、low、exhausted、unknown、held、stale |
| 行为与恢复 | 同期竞争预算只在后端预留成功后确认；短缺给补资或等待路径。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | requestTopUp(amount,currency);inspectObligations(campaignId) |
| 避免 | 余额等于可退额；活动暂停取消已有应付。 |

<a id="submission"></a>

### submission · 投稿与公开链接提交

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B06

记录版本、发布账号、平台链接和所接受规则。

| 契约项 | 规定 |
|---|---|
| 变体 | 草稿、公开帖子、任务证据 |
| 适用状态 | draft、validating、submitting、submitted、duplicate、invalid-link、error、withdrawn |
| 行为与恢复 | 重复帖子给原记录入口；更换媒体或账号要求重新验证，保持旧记录。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | submitEvidence(contentVersion,ruleVersion,accountId,operationId) |
| 避免 | 提交按钮成功动画等于审核通过。 |

<a id="review-workbench"></a>

### review-workbench · 内容审核工作台

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B05、B06

要求逐项核对、媒体批注、决定理由、处理工时。

| 契约项 | 规定 |
|---|---|
| 变体 | 预审、终审、复审 |
| 适用状态 | loading、assigned、reviewing、needs-evidence、decided、conflict、readonly |
| 行为与恢复 | 拒绝绑定具体要求和证据；两人同时决定显示冲突；风险独立侧区。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | recordDecision(stage,decision,ruleVersion,evidenceIds,expectedVersion) |
| 避免 | 管理员代品牌批准；超时自动通过；新要求追溯拒稿。 |

<a id="measurement"></a>

### measurement · 计量快照与核算

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B06

显示原始、剔除、计入、既计入和本次增量。

| 契约项 | 规定 |
|---|---|
| 变体 | 实时观察、待核验、结算快照 |
| 适用状态 | waiting、collecting、unavailable、unverified、verified、correction、window-closed |
| 行为与恢复 | 来源及采集时刻必填；修正关联原快照，correction是correction-required的界面显示别名。已被accruing/pending-settlement引用时标出受影响金额“核对中”，阻止基于该金额的新释放，待已核验调整及授权规则确认；保留原快照和金额，D01/D06方法未决不自动重算。断连显示未知并可重连。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | requestVerify(snapshotId);requestCorrection(baseId,reason,evidenceIds) |
| 避免 | 用实时计数覆盖结算证据；把自报升级为已核验。修正自动抹除旧金额、负数截零或按未批准算法重算；把核对中当风险裁决。 |

<a id="reward-breakdown"></a>

### reward-breakdown · 奖励拆解

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B06

解释资格、计入量、单价、上限、费用及净应付。

| 契约项 | 规定 |
|---|---|
| 变体 | 估算、已确认、调整 |
| 适用状态 | estimating、eligible、accruing、pending-settlement、payable、risk-held、reversed、unknown |
| 行为与恢复 | 组合五状态线与本次怎么算；费用注明承担方。risk-held是独立限制，可在获授权政策下叠加于出款前的payable，保留已确认义务；不改写已付款。unknown仅指UI观察不可得，保留lastKnownState、lastConfirmedAt并查询同一对象恢复，不能推为零。引用待修正快照的accruing/pending-settlement金额标“核对中”，阻止新释放，待核验调整及授权规则；D01/D06仍未决。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | inspectCalculation(rewardId);requestRelease(rewardId,version) |
| 避免 | 把可提现写成已到账；重复向创作者扣算例平台费。把payable限制当义务消失；把未知当零；把已支付改成未支付；未获D06政策许可自动扣回或冲销。 |

<a id="creator-progress"></a>

### creator-progress · 创作者进度

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B06

围绕当前作品展示五条独立状态和下一处理人。

| 契约项 | 规定 |
|---|---|
| 变体 | 参与、投稿、追踪 |
| 适用状态 | needs-action、waiting、blocked、completed、unknown |
| 行为与恢复 | 只给一个当前主动作；等待注明谁负责、已有时间，不发明承诺时限。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | openNextAction(objectId,actionId) |
| 避免 | 用一条绿色完成线暗示全部款项完成。 |

<a id="bounty"></a>

### bounty · 独立任务与名额

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B06

为明确交付及名额组织任务，和播放计酬活动分开。

| 契约项 | 规定 |
|---|---|
| 变体 | 单期、排期、周期候选 |
| 适用状态 | draft、scheduled、open、closed-to-new、reviewing、completed、canceled、underfunded |
| 行为与恢复 | 每期独立预算与提交；取消先核对在途义务，金额变更展示适用范围。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | requestPublish(periodId,version);requestCancel(periodId) |
| 避免 | 沿用竞品最低美元金额、冻结和费率作为Wringy政策。 |

<a id="worklog"></a>

### worklog · 审核工作量与成本

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B06

统计所有投稿、拒稿、申诉及复审劳动。

| 契约项 | 规定 |
|---|---|
| 变体 | 计时、人工补记、聚合 |
| 适用状态 | idle、running、paused、recorded、missing、corrected、error |
| 行为与恢复 | 主动分钟与等待分开；同稿去重但审次累计；成本单位附来源。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | startWork(caseId);recordMinutes(role,category,method);correct(entryId,reason) |
| 避免 | 页面打开时间等于劳动；缺工时补零。 |

<a id="social-connection"></a>

### social-connection · 社交账号与数据授权

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B03、B06、B08

证明投稿账号关系及当前可取得的数据范围。

| 契约项 | 规定 |
|---|---|
| 变体 | 连接、重连、权限检查 |
| 适用状态 | disconnected、authorizing、connected、partial-scope、expired、error、revoked |
| 行为与恢复 | 回跳检查目标账号和空间；断开影响计量须预览；不展示授权凭据。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | connect(platform,scope);reconnect(accountId);requestDisconnect(accountId) |
| 避免 | 连接成功等于平台认可或已具所有指标权限。 |

<a id="product-editor"></a>

### product-editor · 商品与店面编排

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B05

组合媒体、说明、方案引用和交付引用。

| 契约项 | 规定 |
|---|---|
| 变体 | 目录、组合商品、私有销售 |
| 适用状态 | draft、preview、published、unpublished、incomplete、conflict、readonly |
| 行为与恢复 | 发布检查必填与公开范围；下架保留既有购买关系；排序可键盘操作。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | saveProduct(version);requestPublish(visibility);reorder(ids) |
| 避免 | 把商品下架当删除会员；自动复制客户和资金。 |

<a id="team-access"></a>

### team-access · 团队、邀请与权限

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B06、B07、B08、B09、B11

说明谁能在当前组织做什么。

| 契约项 | 规定 |
|---|---|
| 变体 | 邀请、角色矩阵、安全设置 |
| 适用状态 | invited、active、expired、revoked、editing、conflict、restricted |
| 行为与恢复 | 敏感权限变更展示前后差异；过期邀请重新发起；保留操作审计。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | invite(identity,role);requestRoleChange(userId,permissions,version) |
| 避免 | 把前端隐藏当权限执法；跨空间沿用已选用户。 |

<a id="checkout"></a>

### checkout · 结账摘要与付款入口

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B04、B08、B09、B11

商品、名额、付款方式、币种、税费及总价一次核对。

| 契约项 | 规定 |
|---|---|
| 变体 | 一次性、订阅、嵌入 |
| 适用状态 | loading、ready、needs-input、quote-expired、submitting、requires-action、unknown、failed、confirmed |
| 行为与恢复 | 服务端确认支付；外部回跳仅查询；方式不可用给原因及可用替代。requires-action仅在提供方确认认证失败时进入failed；客户端到期或网络超时无确定终态时进入unknown并查询原请求。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | requestPay(orderId,quoteId,operationId);resumePayment(paymentId) |
| 避免 | 前端回跳成功等于付款成功；声称本地支持所有钱包。 |

<a id="price-plan"></a>

### price-plan · 价格方案

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B05、B07、B11

显示首次费、周期、次数及试用后的真实费用。

| 契约项 | 规定 |
|---|---|
| 变体 | 免费、一次性、周期、分期候选 |
| 适用状态 | draft、active、retired、invalid、readonly |
| 行为与恢复 | 金额变化展示生效对象与时间；只用已确认的规则，不默认续订许可。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | selectPlan(planId,version);previewPriceChange(values) |
| 避免 | 把商家分期叫融资；免费试用隐藏后续扣款。 |

<a id="subscription"></a>

### subscription · 订阅与权益摘要

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B02、B04、B12

收费状态与访问权限并排显示。

| 契约项 | 规定 |
|---|---|
| 变体 | 买家门户、经营后台 |
| 适用状态 | active、past-due、paused、cancel-scheduled、canceled、unknown |
| 行为与恢复 | 期末取消写清日期；即时终止访问独立确认；欠费恢复先查付款。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | requestCancel(effectiveAt,version);requestResume(subscriptionId) |
| 避免 | 取消收费立刻默认删访问；套用竞品五天重试。 |

<a id="invoice"></a>

### invoice · 账单与收据

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B02、B04、B10

列明应收、已收、税项和付款凭证来源。

| 契约项 | 规定 |
|---|---|
| 变体 | 应收、收据、税务凭证 |
| 适用状态 | draft、open、overdue、paid、partially-paid、void、uncollectible、unknown |
| 行为与恢复 | 站外收款需单独证据；作废与退款不同；PDF和页面口径一致。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | issue(invoiceId,version);recordExternalPayment(evidenceId) |
| 避免 | 将无法收回当退款；仅邮件发出就显示已付款。 |

<a id="entitlement"></a>

### entitlement · 会员访问与交付门槛

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B04、B05、B11、B12

解释能访问什么及哪些外部步骤尚未完成。

| 契约项 | 规定 |
|---|---|
| 变体 | 已购访问、外部接入、恢复 |
| 适用状态 | checking、granted、locked、expired、pending-sync、failed、unknown |
| 行为与恢复 | 购买确认与外部群同步各自记录；找回用账号关系核对，不显示别人的订单。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | requestAccess(resourceId);retrySync(entitlementId) |
| 避免 | 支付成功必然外部群已开通。 |

<a id="course"></a>

### course · 课程目录与学习任务

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B03、B12

课程模块、章节、媒体和知识检查组合。

| 契约项 | 规定 |
|---|---|
| 变体 | 目录、课时、测验 |
| 适用状态 | locked、available、in-progress、submitted、passed、failed、completed、unknown |
| 行为与恢复 | 尝试次数、门槛按课程版本；学习保存失败保留本地答案并提示。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | saveProgress(lessonId,position);submitAttempt(assessmentId,answers,operationId) |
| 避免 | 用看完视频时间伪造合格；任意设统一及格线。 |

<a id="conversation"></a>

### conversation · 对话、帖子与讨论

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B03、B04、B06、B10、B11、B12

区分客服个案、群聊与公开帖子可见范围。

| 契约项 | 规定 |
|---|---|
| 变体 | 客服、群聊、论坛、公告 |
| 适用状态 | loading、empty、draft、sending、sent、failed、unread、resolved、restricted |
| 行为与恢复 | 发送失败保留草稿并关联原消息重试；解决会话不等于退款或申诉结案。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | sendMessage(conversationId,visibility,body,operationId);resolveConversation(id) |
| 避免 | 默认把内部备注发送给客户；输入中自动发送。 |

<a id="schedule"></a>

### schedule · 活动与预约

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B03、B12

时区、时间、地点与名额共同构成一次预约。

| 契约项 | 规定 |
|---|---|
| 变体 | 直播、线下活动、一对一 |
| 适用状态 | available、selected、reserving、booked、full、rescheduled、canceled、unknown |
| 行为与恢复 | 确认前重查名额；支付和占位状态分开；改期展示原新时间。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | reserve(slotId,version,operationId);requestReschedule(bookingId,slotId) |
| 避免 | 外部日历加入成功即当预订成功。 |

<a id="fulfillment"></a>

### fulfillment · 实物与服务履约

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B03

显示地址、规格、运单或服务交付责任。

| 契约项 | 规定 |
|---|---|
| 变体 | 物流、服务里程碑 |
| 适用状态 | awaiting-details、queued、in-progress、shipped、delivered、exception、unknown |
| 行为与恢复 | 外部来源注明更新时间；异常指向商家或履约方，敏感地址按权限显示。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | updateDelivery(reference,version);reportIssue(orderId) |
| 避免 | 付款成功推断已发货；宣称已有仓配集成。 |

<a id="customer-record"></a>

### customer-record · 客户与候补工作台

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B04、B08

一个客户与多段会员/候补关系分别展示。

| 契约项 | 规定 |
|---|---|
| 变体 | 客户、会员关系、候补 |
| 适用状态 | loading、empty、invited、waiting、approved、denied、restricted |
| 行为与恢复 | 批准候补只给予购买资格；批量操作逐项结果；找回过程不泄露邮箱。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | decideApplication(id,decision,version);requestTransfer(membershipId) |
| 避免 | 候补通过等于付款；把顾客总消费当平台收入。 |

<a id="review-rating"></a>

### review-rating · 评价与信任展示

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B05

星级、正文、附件及付费三态来源可核对。

| 契约项 | 规定 |
|---|---|
| 变体 | 评价列表、撰写、治理 |
| 适用状态 | draft、pending、published、removed、paid、unpaid、unknown |
| 行为与恢复 | 评价发布与付费关系两维；举报给案件入口；编辑留更新日期。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | submitReview(productId,body,rating);reportReview(id,reason) |
| 避免 | 未知评价标已购验证；公开资金流当个人业绩。 |

<a id="referral"></a>

### referral · 推荐与分成关系

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B07、B08、B12

定义关系、适用商品、期限、费基和版本。

| 契约项 | 规定 |
|---|---|
| 变体 | 推广链接、邀请、非链接分成 |
| 适用状态 | invited、active、expired、archived、revoked、unknown |
| 行为与恢复 | 归因证据链接交易；复制推广链接反馈成功；关系变更不回改历史佣金。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | joinProgram(programId,version);createReferral(scope);archiveRelation(id) |
| 避免 | 推荐与无链接收入分成混算；默认竞品30%。 |

<a id="commission"></a>

### commission · 佣金明细与排行

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B06、B07、B09、B12

拆解归因、计费基数、费率、费用及资金状态。

| 契约项 | 规定 |
|---|---|
| 变体 | 逐笔收益、排行、兑换奖励 |
| 适用状态 | estimating、pending、available、reversed、unknown、qualified、redeemed |
| 行为与恢复 | 结算前空值显示待确认；匿名排行不泄露他人身份；自己的名次另列。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | inspectCommission(id);requestRedeem(offerId,operationId) |
| 避免 | 利润分成写成GMV比例；排行榜当可提现证明。 |

<a id="ad-editor"></a>

### ad-editor · 广告层级与排期

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B08、B11

目标、受众、素材、版位和预算按层级编排。

| 契约项 | 规定 |
|---|---|
| 变体 | 活动、广告组、广告 |
| 适用状态 | draft、incomplete、in-review、rejected、scheduled、active、paused、ended、error |
| 行为与恢复 | 发布前显示继承与覆盖；外部拒绝保留原理由；素材权利独立检查。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | saveAd(level,id,version);requestPublish(adId);requestPause(adId) |
| 避免 | 未来广告网络标已连接；复制自动启动花费。 |

<a id="audience"></a>

### audience · 受众构建与导入

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B08

展示来源、包含/排除条件、快照或持续更新。

| 契约项 | 规定 |
|---|---|
| 变体 | 条件集合、名单导入、相似受众候选 |
| 适用状态 | draft、validating、processing、ready、partial、failed、stale |
| 行为与恢复 | 行级导入错误可下载脱敏报告；匹配率须有分母；删除影响预览。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | buildAudience(source,filters,mode);retryRows(jobId,rowIds) |
| 避免 | 把估计受众数当实际触达；默认可分享个人名单。 |

<a id="attribution"></a>

### attribution · 归因与事件诊断

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B08、B11、B12

区分浏览器事件、外部购买声明和确认付款。

| 契约项 | 规定 |
|---|---|
| 变体 | 广告报告、事件流、像素检查 |
| 适用状态 | waiting、receiving、duplicate、delayed、partial、unknown、error |
| 行为与恢复 | 事件去重；显示窗口、模型及来源；ROAS不能暗示利润。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | inspectEvent(eventId);compareModel(model,window);testConnection(id) |
| 避免 | 末次触点即因果证明；同一事件多通道累计销售。 |

<a id="wallet"></a>

### wallet · 钱包与余额分区

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B07、B09、B10、B11

按币种分开总账余额、待结算、限制额和可操作额。

| 契约项 | 规定 |
|---|---|
| 变体 | 个人、企业、用途可用额 |
| 适用状态 | loading、ready、zero、unknown、restricted、stale |
| 行为与恢复 | 提现、消费、转账可用额由各能力返回；来源与更新时间可展开。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | inspectBalance(currency,purpose);requestAction(purpose) |
| 避免 | available等于balance；多币种直接相加。 |

<a id="ledger"></a>

### ledger · 账务流水与对账

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B02、B05、B07、B09、B10

保留金额、方向、币种、业务来源与外部凭证关系。

| 契约项 | 规定 |
|---|---|
| 变体 | 流水、关联明细、对账 |
| 适用状态 | loading、empty、posted、pending、adjusted、unmatched、unknown、error |
| 行为与恢复 | 退款/逆转新增关联记录；对账差异不得隐藏；充值与收入分开。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | inspectEntry(id);reconcile(reference,evidenceId) |
| 避免 | 改写历史流水使总数好看；认为表格就是完整账本实现。 |

<a id="payout"></a>

### payout · 出款与收款目的地

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B06、B09、B11

核对收款人、方式、净额、费用和执行结果。

| 契约项 | 规定 |
|---|---|
| 变体 | 目的地、报价、进度 |
| 适用状态 | incomplete、validating、quoted、quote-expired、initiated、processing、unknown、failed、confirmed、returned、requires-action、cancel-confirmation、canceling、canceled |
| 行为与恢复 | 报价过期重新确认；未知先查原请求。requires-action仅凭提供方确认认证失败进入failed，客户端到期/网络超时无终态仍为unknown。仅服务端确认当前阶段可取消时打开dialog确认变体，显示原付款、金额、收款人及实际费用影响；确认后请求取消，保留原付款状态与canceling请求标记，提供方确认才显示canceled。这不是新增人工审批。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | requestQuote(destinationId,amount);confirmPayout(quoteId,operationId); requestCancel(payoutId,expectedVersion,operationId)（确认可取消并经dialog后；同一取消意图复用operationId） |
| 避免 | 服务商受理等于银行到账；超时重新打款。把取消点击当资金已退；结果未知时重复付款或重复取消；按客户端倒计时宣判认证失败。 |

<a id="transfer"></a>

### transfer · 充值、转账与兑换确认

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B02、B09、B11

说明资金从哪里到哪里，汇率、链网络或费用。

| 契约项 | 规定 |
|---|---|
| 变体 | 充值、转账、换汇、领取链接 |
| 适用状态 | draft、quoted、expired、confirming、processing、unknown、completed、failed |
| 行为与恢复 | 收款身份与币种完整核对；外部授权后查询结果；不能凭客户端完成记账。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | requestQuote(source,target,amount);confirmTransfer(quoteId,operationId) |
| 避免 | 把入金当购买；默认数字资产和法币可互换。 |

<a id="financial-product"></a>

### financial-product · 受限金融产品入口

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B02、B08、B09、B10、B11

展示资格来源、产品种类和实际开放范围。

| 契约项 | 规定 |
|---|---|
| 变体 | 发卡、融资、收益产品、数字资产 |
| 适用状态 | unverified、unavailable、eligible、application-pending、active、restricted、closed |
| 行为与恢复 | 未验证提供方与地区时只展示研究候选；每类产品另有正式合同才能开放动作。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | checkCapability(product,region,currency);requestApplication(productId) |
| 避免 | 把收益产品叫存款；虚构保本、实时到账或当地可用。 |

<a id="verification"></a>

### verification · 身份核验与补件

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B10、B11、B12

核验对象、所需材料、处理方和能力结果分开。

| 契约项 | 规定 |
|---|---|
| 变体 | 个人、企业、补件 |
| 适用状态 | not-started、in-progress、submitted、needs-info、verified、rejected、expired、unknown |
| 行为与恢复 | 补件逐项状态；敏感资料最小展示；核验通过仍重查具体金融能力。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | startVerification(subjectId,type);submitRequirements(caseId,items,operationId) |
| 避免 | 公司通过即个人通过；采用尚未选定供应商名称做默认。 |

<a id="risk-case"></a>

### risk-case · 风险案件与限制

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B04、B05、B06、B07、B10

显示事实、辅助信号、决定与影响操作。

| 契约项 | 规定 |
|---|---|
| 变体 | 疑点、复核、限制处置 |
| 适用状态 | clear、flagged、reviewing、needs-evidence、appealing、cleared、maintained、unknown |
| 行为与恢复 | 分数不可作最终理由；内容决定不变；限制释放有审计和原案件关联。获授权政策可对出款前payable叠加risk-held而保留义务；D05/D06权限仍待确认。unknown仅为UI观察不可得，保留lastKnownState、lastConfirmedAt及已有案件/限制，重新读取同一caseId恢复，不新增风险业务状态。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | flag(objectId,evidenceIds);recordRiskDecision(caseId,decision,version) |
| 避免 | risk hold等于拒稿或欺诈成立；客服越权解除资金限制。把unknown解释为clear、无风险或解除限制；恢复读取就自动清案。 |

<a id="appeal"></a>

### appeal · 复议与争议工作台

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B04、B06、B10

按案件类型呈现参与者、证据、期限和决定权。

| 契约项 | 规定 |
|---|---|
| 变体 | 内容复议、平台退款案、银行拒付 |
| 适用状态 | draft、submitted、needs-evidence、awaiting-owner、decided、closed、expired |
| 行为与恢复 | 品牌拒稿仍交品牌；退款决定交执行模块；银行期限按原通知时区。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | submitAppeal(originalDecisionId,evidenceIds);respond(caseId,version) |
| 避免 | 给所有案件套同样次数、七天时限或裁决者。 |

<a id="reserve"></a>

### reserve · 限制资金与释放计划

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B02、B09、B10

展示限制金额、来源规则、预计日期及实际释放。

| 契约项 | 规定 |
|---|---|
| 变体 | 滚动准备金、固定限制、风险留置 |
| 适用状态 | active、partially-released、released、extended、unknown |
| 行为与恢复 | 预计日期不保证到账；规则变更记录通知及影响范围；与账本关联。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | inspectHold(holdId);requestReview(holdId) |
| 避免 | 限制额消失就当打款；多限制重复减余额。 |

<a id="tax-document"></a>

### tax-document · 税务资料与费用政策

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B10、B12

展示征税模式、责任方、地区和文件用途。

| 契约项 | 规定 |
|---|---|
| 变体 | 税号、税项说明、申报文件候选 |
| 适用状态 | missing、draft、submitted、validated、needs-correction、expired、unavailable |
| 行为与恢复 | 未知税额不默认0；退款调税关联原凭证；本地规则待验证。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | submitTaxInfo(scope,documentVersion);requestCorrection(documentId) |
| 避免 | 把美国税表/公司服务直接移植马来西亚。 |

<a id="app-connection"></a>

### app-connection · 应用安装与授权

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B02、B03、B04、B08、B09、B10、B11、B12

显示目标空间、用途、必需/可选权限及数据范围。

| 契约项 | 规定 |
|---|---|
| 变体 | 安装、OAuth授权、连接器 |
| 适用状态 | not-installed、consent、connecting、connected、partial、expired、revoked、error |
| 行为与恢复 | 新增权限重新同意；拒绝可选权限可降级；解绑显示后续影响。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | requestInstall(appId,workspaceId,scopes);revoke(connectionId) |
| 避免 | 一次授权让所有商家共用数据；把文档接口当账户操作权。 |

<a id="credential"></a>

### credential · 开发凭证管理

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B09、B11、B12

分开测试/生产、账户/应用作用域。

| 契约项 | 规定 |
|---|---|
| 变体 | 密钥、令牌、环境配置 |
| 适用状态 | masked、revealed、creating、active、expired、revoked、error |
| 行为与恢复 | 仅创建时展示完整密钥的行为须后端支持；复制、轮换、撤销明确作用域。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | createCredential(scope,environment);requestRotate(id);requestRevoke(id) |
| 避免 | 真实密钥进入日志、导出或通用分析事件。 |

<a id="event-log"></a>

### event-log · 接口事件与投递日志

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B03、B04、B08、B11、B12

排查投递、业务处理和补查三种结果。

| 契约项 | 规定 |
|---|---|
| 变体 | 请求日志、Webhook、运行日志 |
| 适用状态 | queued、processing、delivered、failed、retrying、rate-limited、unknown |
| 行为与恢复 | 脱敏载荷；重放前说明目标和去重标识；已投递不当业务成功。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | inspectDelivery(id);requestRetry(id,operationId) |
| 避免 | 日志中暴露凭据；重复事件重复履约。 |

<a id="import-export"></a>

### import-export · 导入、导出与同步任务

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B02、B04、B08、B09、B11、B12

选择空间、范围、字段并查看逐项结果。

| 契约项 | 规定 |
|---|---|
| 变体 | 导入、导出、连接同步 |
| 适用状态 | configuring、preview、queued、processing、partial、completed、failed、expired、canceled |
| 行为与恢复 | 失败只重跑失败项且服务端去重；导出下载重新检查权限；给实际保留期限。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | previewJob(scope);confirmJob(previewId,operationId);retryItems(jobId,ids) |
| 避免 | 列表里存在资源就声称能创建导出；复制客户到错误空间。 |

<a id="ai-workbench"></a>

### ai-workbench · AI会话与生成任务

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B04、B08、B12

明确上下文、草稿输出、来源和可执行范围。

| 契约项 | 规定 |
|---|---|
| 变体 | 会话、媒体生成、经营建议 |
| 适用状态 | idle、generating、streaming、ready、stopped、partial、failed、unknown |
| 行为与恢复 | 停止生成不等于退费；失败保留已生成草稿；资料指令不能覆盖用户授权。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | sendPrompt(contextId,prompt,operationId);stopGeneration(jobId) |
| 避免 | 生成内容标客户事实；显示token数推断收费。 |

<a id="action-preview"></a>

### action-preview · 代理操作预览与确认

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B02、B03、B04、B09、B10、B12

确认前展示对象、参数、影响、费用及目标空间。

| 契约项 | 规定 |
|---|---|
| 变体 | 资金、权限、发布、删除 |
| 适用状态 | proposed、reviewing、confirmed、executing、expired、unknown、failed、completed |
| 行为与恢复 | 确认绑定参数摘要与版本；参数变更重新确认；执行后查询真实结果。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | confirmAction(previewId,parameterHash,operationId) |
| 避免 | 一次同意永久授权后续操作；聊天回复当服务端完成。 |

<a id="site-lifecycle"></a>

### site-lifecycle · 网站与版本发布

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B11、B12

区分工作稿、预览和线上版本。

| 契约项 | 规定 |
|---|---|
| 变体 | 编辑、预览、发布、恢复 |
| 适用状态 | draft、building、preview-ready、publishing、live、failed、rollback-pending |
| 行为与恢复 | 发布目标及变更可核对；失败保留现在线上版本；恢复说明数据边界。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | requestBuild(version);requestPublish(buildId);requestRestore(version) |
| 避免 | 恢复网站代码等于撤销已发生订单。 |

<a id="blueprint"></a>

### blueprint · 业务蓝图与迁移向导

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B07、B12

确认来源、目标、复制范围和不可迁移对象。

| 契约项 | 规定 |
|---|---|
| 变体 | 蓝图复制、配置导入、订阅迁移 |
| 适用状态 | selecting、preview、blocked、confirmed、running、partial、completed、failed |
| 行为与恢复 | 预览逐项包含/排除；迁移订阅需独立执行计划和原系统证据；不复制资金。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | previewMigration(source,target,scope);confirmMigration(planId,operationId) |
| 避免 | 把网址重建等于迁移数据库；重跑重复收费或取消。 |

<a id="service-application"></a>

### service-application · 创业服务与成长资格

**类别**：业务复合　**成熟度**：specified（规范已写，未实现）　**模块**：B01、B10、B11、B12

区别申请服务、法律实体申请和按业绩解锁的权益。

| 契约项 | 规定 |
|---|---|
| 变体 | 辅导申请、企业接入、公司成立候选、成长社群 |
| 适用状态 | unverified、available、applying、needs-info、under-review、qualified、not-qualified、unknown |
| 行为与恢复 | 资格读取有期间及来源；资料不足显示补件；人工服务给真实下一联系人。 |
| 键盘 | 按对象摘要→证据/输入→主操作→历史顺序Tab；内含控件遵循其契约；决定不得绑定单字全局快捷键。 |
| 无障碍 | 对象、作用空间、当前状态、下一责任人均为可读文本；受限证据不进入DOM或通用导出。 |
| 响应式 | 桌面按任务用连续面或列表详情；窄屏先摘要、阻塞原因及下一步，再证据与历史；不裁掉资金字段。 |
| 动效 | 静态内容不动；数值和业务状态立即更新，不滚动计数。 |
| 事件（提案） | submitApplication(serviceId,version);checkEligibility(programId) |
| 避免 | 付申请费等于批准；把美国服务当马来西亚准入。 |


## 复合组件的结构与输入合同

以下是48个复合族的最小组合，不把组合内的小控件重复计数。载荷字段是设计所需事实提案，正式类型与API由各领域实现合同决定；未拥有的事实只引用其ID与确认快照。下表的优先级补充通用组合矩阵，不代替服务端执法。复杂操作事件见各组件条目，所有写事件继承前述operationId、作用空间和版本合同。

| 复合组件 | 组合底座 | 必要输入事实（提案） | 优先级与确认回执约束 |
|---|---|---|---|
| [campaign-brief](#campaign-brief) | [property-list](#property-list)、[rule-editor](#rule-editor)、[budget](#budget)、[asset-library](#asset-library)、[creator-progress](#creator-progress) | campaignId、visibility、format、rewardMode、acceptedRuleVersion | 规则缺失先于参与入口；私密活动不在无权列表泄露名称 |
| [rule-editor](#rule-editor) | [form](#form)、[rich-editor](#rich-editor)、[money-input](#money-input)、[date-time](#date-time)、[checkbox](#checkbox)、[dialog](#dialog) | baseVersion、requirements、rights、window、caps、affectedParticipants | 版本冲突先展示差异；生效成功后才更新参与确认入口 |
| [budget](#budget) | [metric](#metric)、[progress](#progress)、[property-list](#property-list)、[ledger](#ledger)、[alert](#alert) | currency、limit、obligations、reserved、refundable、asOf | 未知或过时预算不能承诺可分配；可退额由资金服务计算 |
| [submission](#submission) | [form](#form)、[social-connection](#social-connection)、[file-upload](#file-upload)、[text-input](#text-input)、[file-preview](#file-preview) | submissionId、contentVersion、postUrl、publishedAt、accountId | 文件processing不等于ready；重复请求返回原投稿而非新建 |
| [review-workbench](#review-workbench) | [list-detail](#list-detail)、[annotation](#annotation)、[media-player](#media-player)、[rule-editor](#rule-editor)、[worklog](#worklog) | stage、assignee、checkResults、evidenceIds、decisionVersion | 并发冲突和缺证阻止决定；内容拒绝动作只由授权品牌确认 |
| [measurement](#measurement) | [data-table](#data-table)、[chart](#chart)、[property-list](#property-list)、[social-connection](#social-connection)、[alert](#alert) | snapshotId、source、capturedAt、window、raw/excluded/included、baseId | 来源未知优先显示；correction-required标出引用它的accruing/pending-settlement受影响金额核对中，阻止新释放，等待核验调整和获批方法，不覆写原记录 |
| [reward-breakdown](#reward-breakdown) | [property-list](#property-list)、[measurement](#measurement)、[budget](#budget)、[risk-case](#risk-case)、[ledger](#ledger) | rewardId、ruleVersion、snapshotIds、gross、feePayer、net、holdIds | 风险限制可按授权政策叠加出款前payable而保留义务；unknown保留最后状态和时间；计量修正的受影响金额核对中，未决方法不自动重算 |
| [creator-progress](#creator-progress) | [stepper](#stepper)、[badge](#badge)、[alert](#alert)、[property-list](#property-list)、[notification-inbox](#notification-inbox) | 五域快照、allowedActions、nextOwner、waitingSince | 按真实阻塞给一个主动作；其他状态仍可展开，不隐去风险 |
| [bounty](#bounty) | [campaign-brief](#campaign-brief)、[submission](#submission)、[budget](#budget)、[date-time](#date-time)、[review-workbench](#review-workbench) | periodId、slots、rewardBasis、deadline、inFlightObligations | 取消先处理在途义务；每期独立去重，禁止套播放窗口 |
| [worklog](#worklog) | [number-input](#number-input)、[date-time](#date-time)、[data-table](#data-table)、[metric](#metric) | caseId、role、category、activeMinutes、method、costOwner、coverage | 缺失与估计分开；修改工时需理由，不覆盖历史修正 |
| [social-connection](#social-connection) | [app-connection](#app-connection)、[avatar](#avatar)、[property-list](#property-list)、[alert](#alert) | platform、accountId、grantedScopes、expiresAt、connectionVersion | 授权回跳必须匹配原空间与账号；部分授权保留可用能力 |
| [product-editor](#product-editor) | [rich-editor](#rich-editor)、[asset-library](#asset-library)、[price-plan](#price-plan)、[entitlement](#entitlement)、[form](#form) | productId、visibility、pricePlanIds、experienceIds、version | 发布检查阻塞缺项；下架成功不删除已购关系 |
| [team-access](#team-access) | [data-table](#data-table)、[checkbox](#checkbox)、[select](#select)、[dialog](#dialog)、[event-log](#event-log) | memberId/inviteId、role、scopes、expiresAt、expectedVersion | 敏感权限改动二次核对影响；前端不能提交超出自己权力的角色 |
| [checkout](#checkout) | [price-plan](#price-plan)、[money-input](#money-input)、[form](#form)、[action-preview](#action-preview)、[error-recovery](#error-recovery) | orderId、quoteId、methodCapability、total、tax、currency | 报价/权限重验；认证只有提供方确认失败才转failed；客户端超时/到期无终态查原paymentId，不自动再扣 |
| [price-plan](#price-plan) | [radio](#radio)、[money-input](#money-input)、[date-time](#date-time)、[property-list](#property-list) | planId、billingType、period、firstCharge、trialEnd、version | 选择不立即收费；价格变更必须显示适用对象与生效日期 |
| [subscription](#subscription) | [property-list](#property-list)、[invoice](#invoice)、[checkout](#checkout)、[entitlement](#entitlement)、[dialog](#dialog) | billingState、accessState、currentPeriodEnd、pendingChange | 先区分取消收费/终止权益；未决付款时不伪造恢复成功 |
| [invoice](#invoice) | [data-table](#data-table)、[property-list](#property-list)、[file-preview](#file-preview)、[tax-document](#tax-document) | invoiceId、lineItems、taxMode、dueDate、paymentRefs | 逾期不等于失败；站外标付需要证据和权限，不作为通道回执 |
| [entitlement](#entitlement) | [property-list](#property-list)、[stepper](#stepper)、[app-connection](#app-connection)、[error-recovery](#error-recovery) | resourceId、membershipId、grantState、externalSyncState | 有付费却无访问先排同步与账号；不再售卖同一权益作为恢复 |
| [course](#course) | [sidebar](#sidebar)、[media-player](#media-player)、[rich-editor](#rich-editor)、[progress](#progress)、[form](#form) | courseVersion、lessonId、unlockRule、attemptId、savedProgress | 先授予访问再载入私密内容；未保存答案不因离开静默丢失 |
| [conversation](#conversation) | [list-detail](#list-detail)、[textarea](#textarea)、[file-upload](#file-upload)、[notification-inbox](#notification-inbox) | conversationId、audience、senderRole、messageId、deliveryState | 公开/内部范围先显示；失败重发复用原消息标识避免重复 |
| [schedule](#schedule) | [date-time](#date-time)、[select](#select)、[checkout](#checkout)、[stepper](#stepper) | slotId、timeZone、capacityVersion、bookingId、paymentRef | 名额锁定失败先返回选时；日历写入与预约确认分开 |
| [fulfillment](#fulfillment) | [property-list](#property-list)、[stepper](#stepper)、[conversation](#conversation)、[event-log](#event-log) | orderId、addressAccessScope、carrierRef、sourceUpdatedAt | 外部状态过时先标来源；物流异常交履约方，不自动退款 |
| [customer-record](#customer-record) | [property-list](#property-list)、[data-table](#data-table)、[subscription](#subscription)、[conversation](#conversation) | customerId、membershipIds、applicationIds、authorizedContact | 客户与会员行不合并计数；批量部分失败逐项显示 |
| [review-rating](#review-rating) | [radio](#radio)、[textarea](#textarea)、[file-upload](#file-upload)、[badge](#badge)、[appeal](#appeal) | reviewId、rating、moderationState、paidTriState、relationshipDisclosure | unknown付费关系必须保留；评价被移除不改变付款记录 |
| [referral](#referral) | [form](#form)、[link](#link)、[rule-editor](#rule-editor)、[property-list](#property-list) | relationId、scope、feeBasis、effectiveRange、ruleVersion | 接受当前条款再建关系；归档不改历史收益 |
| [commission](#commission) | [data-table](#data-table)、[metric](#metric)、[ledger](#ledger)、[referral](#referral) | commissionId、transactionId、attributionEvidence、basis、rateVersion | 未知费基先待确认；排行与可提现收入不合并 |
| [ad-editor](#ad-editor) | [stepper](#stepper)、[budget](#budget)、[audience](#audience)、[asset-library](#asset-library)、[date-time](#date-time) | campaign/adGroup/ad IDs、inheritance、networkCapability、version | 层级缺素材先阻止发布；复制为草稿，不默认开始花费 |
| [audience](#audience) | [filter-builder](#filter-builder)、[import-export](#import-export)、[data-table](#data-table)、[progress](#progress) | sourceConsent、include/exclude、mode、snapshotAt、matchDenominator | 来源权限优先于受众预估；部分失败只重跑有效范围 |
| [attribution](#attribution) | [chart](#chart)、[data-table](#data-table)、[filter-builder](#filter-builder)、[event-log](#event-log) | eventId、eventType、model、window、timeZone、sourceConfidence | 无分母不显示转化率；浏览器和服务端事件合并去重 |
| [wallet](#wallet) | [metric](#metric)、[property-list](#property-list)、[reserve](#reserve)、[ledger](#ledger)、[payout](#payout) | ownerId、currency、balanceByPurpose、asOf、activeHolds | 用途可用额未知禁用对应资金动作；不禁用可读账务 |
| [ledger](#ledger) | [data-table](#data-table)、[property-list](#property-list)、[file-preview](#file-preview)、[import-export](#import-export) | entryId、direction、currency、businessRef、adjustsEntryId | 对账不符优先标记；导出需当前权限，不输出敏感账户细节 |
| [payout](#payout) | [form](#form)、[verification](#verification)、[money-input](#money-input)、[action-preview](#action-preview)、[dialog](#dialog)、[ledger](#ledger) | destinationId、quoteId、net、fees、capability、externalRef、cancelCapability、cancelOperationId | 仅当前可取消才弹dialog核对；请求中保留付款状态，提供方确认才canceled；认证失败须提供方确认，网络/客户端到期不算失败 |
| [transfer](#transfer) | [money-input](#money-input)、[select](#select)、[action-preview](#action-preview)、[event-log](#event-log) | sourceOwner、targetOwner、currencies/network、quoteId | 币种/链/收款人变动使预览失效；到账确认必须真实回执 |
| [financial-product](#financial-product) | [property-list](#property-list)、[verification](#verification)、[action-preview](#action-preview)、[alert](#alert) | productType、providerEvidence、jurisdiction、capabilityStatus | 未核实优先呈现不可用原因；单一组件不能代替卡/融资等专题PRD |
| [verification](#verification) | [form](#form)、[file-upload](#file-upload)、[file-preview](#file-preview)、[stepper](#stepper) | subjectType、requirementsVersion、caseId、statusSource | 个人/企业审核不混；缺件指向具体项，拒绝不自动重开无限申请 |
| [risk-case](#risk-case) | [list-detail](#list-detail)、[property-list](#property-list)、[file-preview](#file-preview)、[appeal](#appeal)、[event-log](#event-log) | caseId、signalSource、decisionVersion、restrictionScope | 证据信号和裁决分列；unknown保留最后状态/时间及限制，不代表无风险；payable限制需获授权政策且不消灭义务 |
| [appeal](#appeal) | [form](#form)、[file-upload](#file-upload)、[conversation](#conversation)、[date-time](#date-time)、[property-list](#property-list) | caseType、originalDecisionId、deadlineSource、nextDecisionOwner | 期限不确定标待确认；不同案型裁决权限分开，退款执行另追踪 |
| [reserve](#reserve) | [metric](#metric)、[ledger](#ledger)、[date-time](#date-time)、[property-list](#property-list) | holdId、ruleVersion、amount、releaseSchedule、actualRelease | 预计日期不可写已释放；重叠限制由领域去重不重复减额 |
| [tax-document](#tax-document) | [form](#form)、[file-upload](#file-upload)、[invoice](#invoice)、[property-list](#property-list) | jurisdiction、taxMode、taxIdMasked、documentVersion | 未知税额先停止最终总价承诺；凭证纠正关联旧版 |
| [app-connection](#app-connection) | [workspace-switcher](#workspace-switcher)、[checkbox](#checkbox)、[credential](#credential)、[alert](#alert) | connectionId、appId、targetWorkspace、required/optionalScopes | 回跳验证防串空间；新增权限待重新授权时旧允许能力按合同降级 |
| [credential](#credential) | [property-list](#property-list)、[dialog](#dialog)、[button](#button)、[event-log](#event-log) | credentialId、scope、environment、expiresAt | 撤销/轮换先说明受影响集成；秘密值不入事件载荷 |
| [event-log](#event-log) | [data-table](#data-table)、[filter-builder](#filter-builder)、[property-list](#property-list)、[file-preview](#file-preview) | requestId、deliveryId、dedupKey、safePayload、handlerResult | 投递成功与业务处理分开；重放动作核对副作用与权限 |
| [import-export](#import-export) | [stepper](#stepper)、[checkbox](#checkbox)、[data-table](#data-table)、[progress](#progress)、[file-preview](#file-preview) | jobId、scope、selectedColumns、previewId、rowResults、expiresAt | 预览/确认绑定范围；部分失败保留成功项，下载过期重新请求 |
| [ai-workbench](#ai-workbench) | [conversation](#conversation)、[asset-library](#asset-library)、[progress](#progress)、[action-preview](#action-preview) | contextId、modelCapability、generationId、sourceRefs、usageStatus | 内容不可信先标草稿；带副作用的建议必须进入参数预览 |
| [action-preview](#action-preview) | [property-list](#property-list)、[data-table](#data-table)、[dialog](#dialog)、[alert](#alert) | previewId、parameterHash、workspaceId、effectScope、expiresAt | 任何参数变化取消旧确认效力；执行未知先查询，不重复执行 |
| [site-lifecycle](#site-lifecycle) | [rich-editor](#rich-editor)、[asset-library](#asset-library)、[event-log](#event-log)、[action-preview](#action-preview) | siteId、draftVersion、buildId、liveVersion、targetDomain | 构建失败保持线上版；发布/恢复需具体用户授权，不由自动保存触发 |
| [blueprint](#blueprint) | [stepper](#stepper)、[import-export](#import-export)、[product-editor](#product-editor)、[action-preview](#action-preview) | sourceId、targetWorkspace、copyScope、migrationPlanId、excludedRows | 配置复制与订阅迁移独立；旧订阅停扣需真实源系统证据 |
| [service-application](#service-application) | [form](#form)、[verification](#verification)、[file-upload](#file-upload)、[stepper](#stepper) | serviceType、jurisdiction、provider、applicationId、eligibilityPeriod | 资格不明先人工核对；提交/付款成功均不代表法律或业务批准 |

# Wringy 品牌与组件离线参考 v1

这是已获准制作的第一版提案，用于设计讨论与实现参考。它不是生产应用，不连接账户、上传服务或付款系统，也不表示商标已注册、定位已被市场验证。

## 打开

解压 `Wringy-Design-Reference-v1.zip` 后双击 `index.html`。所有脚本、图片、Manrope 与 Noto Sans SC 字体都在包内，无需安装依赖或联网。请使用支持原生 dialog 的现代浏览器；本次在桌面 Chrome 验证。首页可切换浅色/深色，浏览31类组件及复制各类HTML模板。

四幅产品示例链接：

- `index.html?screen=UI-BRAND-DESKTOP`：未发布草稿。使用权、修改轮次与审核期限未确认，发布被阻止；尚无提交。
- `index.html?screen=UI-BRAND-MOBILE`：独立的已发布活动审核队列示例。
- `index.html?screen=UI-CREATOR-DESKTOP`：作品已批准，MYR150.00待品牌直接付款，到账未确认。
- `index.html?screen=UI-CREATOR-MOBILE`：同一直接付款状态，无可提现余额。
- `index.html?screen=UI-PAYOUT-CONFIRM`：额外未来集成路线示例，MYR150.00减示例费用MYR2.00，预计净额MYR148.00；不代表首发钱包或实际费率。

链接加 `&theme=dark` 可直接查看深色。所有人物、活动、日期、金额及指标均为示例数据。PNG在包内 `screens/`，桌面1440×1000，移动390×844；长页面正常滚动，截图是一屏视口。

## 复用与范围

`components.js` 提供 Wringy.button、field、badge、facts、steps、nav、reviewRow、campaignCard、payout 等HTML工厂；`styles.css` 提供共享组件类。`catalog.js` 的31个family各含原生HTML模板。`Wringy.mount(id, target)`克隆模板并重映射ID和关联属性，适合排版复用。高级演示控制器包含针对目录ID的逻辑，复制到新上下文后需要适配；本包不是可直接上线的软件组件库。

按钮、输入框、选择器、表单、菜单、页签、原生对话框、开关、日期、文件、导航、表格、通知、审核、报酬等均有实际HTML结构。交互仅改变当前页面演示状态，刷新会复原。文件选择只读取名称/类型/大小，不做上传、安全扫描或内容预览。代码只供可信示例内容使用；生产应用须进行上下文输出编码、权限验证及安全设计。

`implementation-coverage.json`逐类列出本次实际可呈现状态、变体及本地行为；其中部分是静态样本，部分通过交互显示。未覆盖全部规范组合，例如折线图、批量审核、真实服务离线恢复与真实付款重试没有实现。不能把规范中的全局状态列表解读为每类都已实现。

## 唯一token源

工作区规范源是上一级 `brand/tokens.json`。本包的 `tokens.json`、`tokens-data.js`、`tokens.css` 为同一源的冻结投影，禁止分别改色。维护时在工作区修改规范源并运行 `generate.py`，再重新导出本包。当前源哈希见 `token-provenance.json`。Citron、Ink、Paper及Iris未改动。组件布局另由CSS表达；没有声称所有CSS字面量都绑定token。

## 字体与图像

Manrope与Noto Sans SC按SIL Open Font License 1.1随包分发；完整许可证和官方来源/hash见 `fonts/`。CSS使用本地字体，失败时按系统sans-serif回退，中文回退依平台可用字体；正式导出优先使用包内字体。标志使用原始生成概念位图 `images/logo.png`，没有冒充SVG矢量或商标定稿。`images/editorial.png`是创作场景概念图，不是客户证明或真实作品记录。

## 键盘与检查

Tab进入控件；Enter/Space激活按钮与原生选择项；页签左右方向键/Home/End；菜单方向键/Home/End、Escape返回；原生dialog限制模态焦点，Escape关闭并返回触发器。表单错误摘要可聚焦；图片有alt；图表附同值数据表。浅深主题均检查，320/390/768/1440目录宽度无页面横向溢出；数据表在自己的滚动区域内。减少动态效果偏好关闭过渡。

`verification-report.json`记录浏览器冒烟结果，不是WCAG认证或完整读屏审计。已逐类查看62张浅深主题截图；4幅主产品图经主任务视觉/状态复核。独立跨供应商评审由主任务另行负责，本工作者不声称已完成。

## Figma状态

Figma仅成功报告创建4个集合、130个变量；配额阻止后续读回。没有原生组件、文字样式、产品屏或导出。这个离线参考是获授权的交付替代，不表示Figma库完成。详细状态留在工作区 `brand/figma-manifest.json`。

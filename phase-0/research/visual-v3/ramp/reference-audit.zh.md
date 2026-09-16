# Ramp 逐图参考审计（MCP 广域研究）
2026-09-10。研究交付，不是 Wringy 新设计或批准规范。

## 结论与证据边界
实际执行 24 次单类别 MCP 搜索，逐次用 functions.image 显示并查看所有返回图片；得到 **61 个不同 Ramp section ID**。搜索返回的非 Ramp 图片也显示检查，但不纳入 Ramp 视觉事实。完整查询、页码、顺序、图片短链接、去重成员和每图观察见 [coverage-ledger.json](coverage-ledger.json)。

指定目标为 [Ramp capture目录](https://mobbin.com/sites/ramp-ce5fe5e7-4dd5-4bf7-bd90-a4cd4945b4de/c7bdc9b7-d439-4c61-a13a-c35688970d1f/sections)。**不能声称已覆盖该目录65项**：MCP没有capture筛选字段，也不返回capture身份。白底hero外观得到主任务历史观察支持，但该ID的精确capture成员关系未得到本轮重新验证，全部61项均为 notconfirmed。主任务后续纠正：c224来自历史上下文指针；当前sources.json支持capture与hero外观但不含此ID。本worker独立看到了图片，不能标记为当前AX确认。未把颜色/文案相似当作成员关系。

最大风险是把多个捕获版本、多个网站页面、多个轮播状态拼成一个品牌规范。蓝渐变hero和白点阵hero确实都来自Ramp；仅凭MCP不能给它们排年代，不能擅称蓝色必为“旧版”。一些相近构图有不同导航项目、客服入口、裁切、文案或轮播位置，须保留不同ID。

基础核对：本任务仅阅读研究和原规范作勘误，不改设计系统或生产代码。采用 research 技能的原始来源、逐项引用及Markdown记录原则；遵循worker禁止进一步委派。没有用旧稿当作Ramp事实来源。

最终追加的8项逐图记录及分页结果见 [最终库存补查](final-inventory-addendum.zh.md)。最终24次调用、284张返回图、61个Ramp唯一ID；JSON为完整清单。

## 检索覆盖与停止边界
| 类别 | 实际查询页 | 图像覆盖与缺口 |
|---|---|---|
| 导航/mega-menu | navigation bar and expanded mega menu，1–2 | 看到了hero里的完整横向导航；没有真实Ramp展开大菜单。第二页主要跨站且仅重复Ramp FAQ，不能借Jasper菜单补洞。 |
| Hero | hero section，1–2 | 白点阵AI、蓝渐变设备、深绿竞品、合作伙伴照片、公司介绍、教育/小企业、投资账户。第二页新增一张余额预测变体后大多跨站。 |
| 产品/演示 | product features demo section，1–4 | 产品入口、API能力、账户卡、时间线、步骤、UI叠层、编辑正文、资源条和多种案例。第4页Ramp全重复，停止该查询分页。 |
| 客户证据 | customer logos case study testimonials，1–2 | Logo行、数据墙、照片案例、全幅照片证言、深色卡、纯文字、G2评价。第2页仅新增G2，其余跨站或重复。 |
| 集成 | integrations section，1–2 | API能力入口、产品概览、割裂系统拼贴、入门步骤；未见完整Ramp应用集成目录。第2页Ramp无新增。 |
| 定价/比较 | pricing plans comparison table，1–2；pricing，1 | 两种功能表、三列价格卡、Amex表及Mercury比较hero；pricing单词查询实际返回其他Ramp内容，不把它们误标为价格页。 |
| CTA/表单 | call to action email signup form，1–2 | Hero组合邮箱、demo、浅灰footer表单；第2页无Ramp。没有表单错误、加载、成功状态。 |
| 页脚 | footer section，1–2 | 黑底长页脚；浅灰版本由CTA检索获得；第2页无Ramp。 |
| 图像/背景变化 | background imagery illustration section，1 | 补得二维码黄绿下载横条；背景和字体变化同时从全部61图观察，不据查询名称分类。 |

所有搜索响应仍有 has_next_page=true，说明语义搜索库还可继续，不是目标目录全量清单。停止依据是该查询新增Ramp产出耗尽或显著衰减、且所需模式已有实图；不是任意只取五张。没有“全集已穷尽”的结论。后续如主任务得到目录差集，应按缺失ID定向核对；不能用61除65算覆盖率，因为分母分子所属集合不同。

## 观察事实：按模式归组

### 1. 导航和首屏的层级
[白色AI首屏](https://mobbin.com/sites/sections/c224c647-a876-44fc-ad18-ac01acee3004) 顶部是一条纤细白色横栏，左logo，中间小号导航文字/下箭头，右登录与黄绿demo按钮。主标题左对齐，邮箱CTA紧接其下；大部分图像面积留给下方流程示意。点阵不是普通暖灰平涂：细密标记把整页与发票处理画布连接起来，底部活动数字横带补充系统正在工作的意味。静态图片仅证明横带存在，不能证明其更新速度。

[蓝渐变设备首屏](https://mobbin.com/sites/sections/a60fec48-739b-4b6b-b123-94208c79865c) 则是左白字、右大设备的两栏；顶部深色、下部渐白，让灰色客户logo行自然接入下一节。[合作伙伴首屏](https://mobbin.com/sites/sections/120806fe-e3c4-4992-aee7-1f99024cc6ce) 用真人拼贴及黑色按钮，说明并非每个业务页的主行动都必须黄绿。导航上是否出现Partners也不同。没有实际展开菜单图，不推断菜单列数、背景、触发方式或动画。

### 2. 产品展示不是一种卡片模板
[八入口产品目录](https://mobbin.com/sites/sections/bc483029-6ba0-43c1-b8b8-902ad8297853) 是4×2轻量条目，图标方底与文字/箭头组合，整项并未套厚重卡框。[API能力](https://mobbin.com/sites/sections/b54966b6-e31a-4e18-af6a-80810799c008) 是3×2白卡铺在暖灰底；[demo入口](https://mobbin.com/sites/sections/e92c227f-410f-4d47-8f54-4d8945f66ae3) 是左竖右两横的不对称布局；[30天时间线](https://mobbin.com/sites/sections/9087cbfc-878f-4d76-9bfb-627ccfe536d6) 采用节点、水平线和三个同宽内容盒。

[账户管理画布](https://mobbin.com/sites/sections/75817196-44e2-43c6-b104-21039b75d2c9) 使用斜向白卡、细图表、淡紫绿阴影；[AI案例](https://mobbin.com/sites/sections/e3b9fbca-142a-421e-8be8-7ef8e180b86c) 把照片、政策UI和证言交替排在两列。它们共同采用“文字说明产品收益、图形说明操作对象”的关系，但容器、密度和照片比例并不一致。

### 3. 证据有不同强度、不同排法
[Customer Stories目录](https://mobbin.com/sites/sections/8d5e762c-77e0-4cec-b386-4e285906f921) 超大标题之后接logo与照片墙，主故事明显大于次故事。[数据墙](https://mobbin.com/sites/sections/13557a98-696e-456b-87af-a02a906d3e29) 用白/浅蓝交错、品牌名与大数字结合。[纯文字Webflow证言](https://mobbin.com/sites/sections/9c515450-5e8b-4ad0-8c45-fe6be166f9cc) 几乎没有容器；[小企业证言](https://mobbin.com/sites/sections/f94cb20b-8c96-4d62-ac73-7acb482f2767) 则为黑卡轮播。

[Eventbrite照片证言](https://mobbin.com/sites/sections/3478befb-f604-4531-869c-2a25e40e86bd) 让品牌所在场景成为满幅背景，白字叠加遮罩；[G2评价](https://mobbin.com/sites/sections/4bd26ace-d295-46d6-b0af-5e4afd3036ff) 用徽章、星级、引用与署名。图片中的客户/金额是Ramp截图里的营销内容，本研究没有核验其商业真实性或当下有效性，更不能迁移成Wringy业绩。

### 4. 背景色是分工，不是全站单色限制
除白/浅暖灰外，实际图中存在：深绿的[Mercury比较](https://mobbin.com/sites/sections/d5541dd9-5262-4788-aeda-0851057f2a4b)、蓝色的[投资账户展示](https://mobbin.com/sites/sections/03c51e3d-e5f4-4e50-b007-f1d6c8658565)、黑底包浅蓝渐变的[Zola证言](https://mobbin.com/sites/sections/53ec0f09-7b25-45e2-8cec-7efa7fbdfcd8)、深蓝几何的[OpenAI证言](https://mobbin.com/sites/sections/40a22e6f-3abc-4402-bb05-afbd3143c83e)。

黄绿经常是黑字操作按钮，但[移动客户端下载横条](https://mobbin.com/sites/sections/c81b8b72-d3eb-4319-af18-711417e238cb) 使用整条黄绿信息面；[Newsroom](https://mobbin.com/sites/sections/f5c0cabe-f6e3-4495-9125-1df4c09c8848) 用黄绿便签和蓝条纹图片。不能把它定义成“仅CTA色”。全部颜色为肉眼定性描述，本轮没有测量/提取色值，不产生新十六进制数。

### 5. 字体、密度与构图节奏
观察到的主排版是无衬线、较紧的标题、常规字重正文、小号次级说明，靠字号/位置和留白分层。没有证据确认字体名称、字重数值、字距数值或字阶。也不是所有标题同等大：[Customer Stories](https://mobbin.com/sites/sections/8d5e762c-77e0-4cec-b386-4e285906f921) 大幅横向铺开，[What is Ramp](https://mobbin.com/sites/sections/36eff1fa-e3a0-49b3-8657-898cfb13e077) 左标题右密集正文，[页脚](https://mobbin.com/sites/sections/69a25a7e-7012-41e8-8129-9133bdcee565) 则是高密度多列小字。

Newsroom缩略图中的手写便签字是图像内容，不应据此判断站点正文混用手写字体。卡片常见轻圆角、细线，但比例由组件而变；胶囊标签、圆头像、尖角表格和大照片容器不能压成单一圆角值。截图缩放和水印条不属于原站CSS测量基础。

### 6. 定价和行动层级确有版本差异
[功能表A](https://mobbin.com/sites/sections/8a09538c-ffad-4eb6-8100-ccc910872f19) 强调Plus黄绿，[功能表B](https://mobbin.com/sites/sections/537fd731-3f43-4788-b4c7-b7478723c49b) 强调Free黄绿。两图的行文也变了，不能解读为同组件hover切换。[三列套餐](https://mobbin.com/sites/sections/1372a54f-9e88-4179-960c-9765e59d6046) 每列含邮箱输入、动作、分隔线和长功能清单。细边框承担扫描组织，表格绿勾表达功能包含，不等于业务支付成功。

### 7. Footer也是品牌节奏的一部分
[浅灰footer](https://mobbin.com/sites/sections/0addfde9-71dd-4ed4-b744-c5a713e64161) 有上部横链和五列目录、中间横向品牌/行动区、下面法律文字。[深色footer](https://mobbin.com/sites/sections/69a25a7e-7012-41e8-8129-9133bdcee565) 六列开头，法律区更长，邮箱CTA落在最下左侧。两者都不是简短logo+版权行；其业务复杂度不能自动成为Wringy所需目录规模。

## v2 勘误与失效范围
只读取了 [旧规范](../../../foundation/design-v2/brand-components-spec.md) 与 [旧tokens](../../../foundation/design-v2/tokens.json) 作勘误，未修改它们。旧稿已经说明色值与尺寸是独立建议，因此不能说旧稿冒充了官方提取；问题在于参考研究广度不足以支撑其全面品牌归纳。

| 旧内容 | 本次证据纠正 | 对后续规范的要求（尚未实施） |
|---|---|---|
| 参考依赖传入的一张暖白hero观察 | 本轮61张有产品、案例、比较、新闻和footer多种语法 | 参考说明要写明多页/版本覆盖与缺口，而非单页升格全品牌。 |
| 不使用MCP可能返回的“旧蓝渐变” | 蓝渐变实图存在，MCP没有日期/capture，不能自行标旧 | 保留为未确认版本，待目录匹配；用户是否选用蓝色属于另一个设计决定。 |
| 品牌成功标准偏暖白、黑字、黄绿、克制 | 还有深绿/黑/蓝、编辑式正文、照片、非对称UI与大数据墙 | 分开记录基础层、图片层、业务页变体和捕获差异。 |
| 不加渐变、仅轻构图阴影 | 实图有蓝渐变、大设备投影、账户卡彩色阴影 | 可以是Wringy自定限制，不能声称是完整Ramp推导。 |
| 指定Helvetica等字族、76px展示、1320px宽、4px标尺、圆角6/10px | 截图不能验证这些源值 | tokens.font/fontSize/space/radius/layout均保持“提案”，不转成提取事实。 |
| accent及hover/pressed/focus数值 | 静态实图不能验证互动色，未测源色 | tokens.color/semantic不能以本次研究追认；后续须源测量或明确自主适配。 |
| motion120/180ms与低动效规则 | 本轮静态截取只能证明分页控件/浮层/横带外观 | 动效数值是Wringy决策，不能归因Ramp。 |
| Tabler系列图标 | Ramp实图有线图标、实体卡、logo、插图及拼贴emoji | 图标库选型不等于Ramp官方资产识别。 |
| 单一页面底与应用工作区值 | MCP网站section不足以证明Ramp后台应用规范 | 不跨推导成应用组件或Linear结论。 |

## Wringy 适配：仅记录待讨论原则，不进行重设计
可讨论的迁移是信息组织关系，例如“一句主张→一幅可解释的产品流程→可信证据”，或“一个主案例配两个较小案例”。这些是本研究提出的适配候选，不是观察事实、品牌批准或新tokens。Wringy如没有真实客户结果，应在未来deck以已核验客户访谈/概念流程替代业绩墙；不能把Ramplogo和金额当作自己的证据。

本轮不选新颜色、不重画字标、不改UI、不制作deck。可基于已观察模式进行明确受限的Wringy独立适配，不把精确目录补齐设为阻塞；不得称完整官方Ramp提取或跨版本统一规范。

## 逐项图片观察目录
以下每行对应唯一Ramp ID。所有行均已实际看图；所有capture成员关系均notconfirmed，c224仅有历史主任务指针及外观支持。查询出现次数与全部短链接见JSON；每图不确定项也在JSON。

| ID与原始链接 | 实际观察 |
|---|---|
| [c224c647-a876-44fc-ad18-ac01acee3004](https://mobbin.com/sites/sections/c224c647-a876-44fc-ad18-ac01acee3004) | 白底细密点阵；左上单行黑标题 Time is money. Save Both.；邮箱与黄绿按钮连成横向控件；下方大浅灰圆角画布中发票、核验节点和底部活动数字条；顶栏小字横排，未展开菜单。 |
| [7371c5ff-21d4-481c-ac3f-bcb2e402beed](https://mobbin.com/sites/sections/7371c5ff-21d4-481c-ac3f-bcb2e402beed) | 白底 FAQs；Business Account 与 Investment Account 两组；首问展开、多行灰色正文；细横线、右侧方形折叠按钮；第二组有四问。 |
| [27bbba12-f19e-4d64-a4ae-d38eb4204f25](https://mobbin.com/sites/sections/27bbba12-f19e-4d64-a4ae-d38eb4204f25) | 白底 FAQ；两账户分组；首问展开，第二组只两问；与7371文案和行数不同，不合并为同一状态。 |
| [120806fe-e3c4-4992-aee7-1f99024cc6ce](https://mobbin.com/sites/sections/120806fe-e3c4-4992-aee7-1f99024cc6ce) | Become a Ramp Partner 左大标题与黑色主按钮/浅灰次按钮；右侧女性工作照片、俯拍团队照片、橄榄灰色块拼贴，叠细框账户数字；白底。 |
| [d5541dd9-5262-4788-aeda-0851057f2a4b](https://mobbin.com/sites/sections/d5541dd9-5262-4788-aeda-0851057f2a4b) | Ramp vs Mercury 左文字邮箱黄绿CTA；整节深绿底、白字；右浅米底双手递实体卡照片，轻圆角。 |
| [aa950d43-7969-42f3-a11b-f0890c66fdae](https://mobbin.com/sites/sections/aa950d43-7969-42f3-a11b-f0890c66fdae) | 白底 live demo 双栏；左标题、灰说明、邮箱与黄绿预约按钮；底部客户logo；右大幅Reporting屏幕裁切，蓝面积图和指针标注，边缘渐隐。 |
| [aaa4333c-a699-4fbb-9af0-6ec234b82053](https://mobbin.com/sites/sections/aaa4333c-a699-4fbb-9af0-6ec234b82053) | 小企业页：居中两行标题/说明，下面左功能文字右黑色实体卡；极大留白，右下黄绿悬浮标记。 |
| [a60fec48-739b-4b6b-b123-94208c79865c](https://mobbin.com/sites/sections/a60fec48-739b-4b6b-b123-94208c79865c) | 深海军蓝到亮蓝再白色纵向渐变hero；左白色双行标题、评分、邮箱黄绿CTA；右透视显示器、手机与黑卡；底部灰色logo行。 |
| [03c51e3d-e5f4-4e50-b007-f1d6c8658565](https://mobbin.com/sites/sections/03c51e3d-e5f4-4e50-b007-f1d6c8658565) | Investment Account 蓝渐变大幅背景，顶部小黄绿圆点；居中白标题；底部倾斜屏幕溢出裁切，白色浮层卡配黄绿图标与阴影。 |
| [16357375-1402-4490-9be0-0a39d44ad6ff](https://mobbin.com/sites/sections/16357375-1402-4490-9be0-0a39d44ad6ff) | About：白底左黑标题、灰说明、黄绿按钮；右会议室三人工作照片，矩形轻圆角；不是纯软件示意。 |
| [8599110d-9d19-4776-bfe1-80bbcfaa22cd](https://mobbin.com/sites/sections/8599110d-9d19-4776-bfe1-80bbcfaa22cd) | The Ramp Blog 左大标题、右搜索及分类按钮；横向轮播浅灰画布，左文章标题与头像、右浅蓝UI碎片拼贴；下方分页细线及圆箭头。 |
| [354bdc75-5f12-45bb-9511-5cc9a56c600d](https://mobbin.com/sites/sections/354bdc75-5f12-45bb-9511-5cc9a56c600d) | 白底居中预测余额标题、蓝色星状图标；下半页浅蓝面积图和估算浮层；底部细法律胶囊；顶栏含Partners，右下圆形chat。 |
| [f8c96895-298d-47d1-b0d0-545919de6959](https://mobbin.com/sites/sections/f8c96895-298d-47d1-b0d0-545919de6959) | 蓝渐变设备hero，标题/设备与a60相近；截取高度、logo位置与下方留白不同；不同ID保留，不能推断同capture。 |
| [e3e43ab6-3a8a-4669-85c0-998f4dd3ca86](https://mobbin.com/sites/sections/e3e43ab6-3a8a-4669-85c0-998f4dd3ca86) | 余额预测白底与浅蓝面积图，同354主题；顶栏不含Partners，右下黄绿方标，图底部圆角及裁切不同。 |
| [e92c227f-410f-4d47-8f54-4d8945f66ae3](https://mobbin.com/sites/sections/e92c227f-410f-4d47-8f54-4d8945f66ae3) | See how Ramp works：左竖卡含邮箱预约与蓝底设备；右上下两横卡分别UI导览和人物视频；浅灰卡片不等宽组合；底部logo行。 |
| [6f980550-08bd-41cd-8789-499be8ccd6fc](https://mobbin.com/sites/sections/6f980550-08bd-41cd-8789-499be8ccd6fc) | 居中标题；浅暖灰不等宽2列功能卡；左白色审批UI叠卡，右蓝色客服对话和头像；下方集成/全球卡仅见顶部，不能声称看全。 |
| [bc483029-6ba0-43c1-b8b8-902ad8297853](https://mobbin.com/sites/sections/bc483029-6ba0-43c1-b8b8-902ad8297853) | Get to know Ramp：左上标题说明；4列2行八个产品入口，浅灰方图标+微型灰标签+黑说明+箭头，无整块外卡。 |
| [b54966b6-e31a-4e18-af6a-80810799c008](https://mobbin.com/sites/sections/b54966b6-e31a-4e18-af6a-80810799c008) | 暖灰整节；居中Build anything on Ramp；3列2行白色API能力卡，浅蓝小图标、黑标题灰说明；底部文档与Integration Directory文字链接。 |
| [75817196-44e2-43c6-b104-21039b75d2c9](https://mobbin.com/sites/sections/75817196-44e2-43c6-b104-21039b75d2c9) | 白底居中All the control；下方暖灰大画布，左文字右斜向账户卡，淡紫/淡绿阴影与面积图；含Partners顶栏和圆chat。 |
| [9087cbfc-878f-4d76-9bfb-627ccfe536d6](https://mobbin.com/sites/sections/9087cbfc-878f-4d76-9bfb-627ccfe536d6) | 白底30天实施时间线；居中标题；Today/Day5/Day30 三节点横线，下面三张细描边白卡与勾选条目；不是抽象装饰线。 |
| [36eff1fa-e3a0-49b3-8657-898cfb13e077](https://mobbin.com/sites/sections/36eff1fa-e3a0-49b3-8657-898cfb13e077) | What is Ramp? 左大标题，右较大介绍正文与下方双栏小字；白底编辑式排版，无插图无CTA。 |
| [a5a4b003-6f96-4f4b-9c48-1e8617d89091](https://mobbin.com/sites/sections/a5a4b003-6f96-4f4b-9c48-1e8617d89091) | 暖灰底；上方左标题右说明，下方三张白色轻描边数据卡；大号黑数字、紧随小解释。 |
| [e3b9fbca-142a-421e-8be8-7ef8e180b86c](https://mobbin.com/sites/sections/e3b9fbca-142a-421e-8be8-7ef8e180b86c) | 上下交错图文案例；上左办公室视频照片，上右标题/Perplexity证言；下左AI说明及Valence证言，下右浅灰框内政策UI；黑灰两段标题。 |
| [57b9bf6d-253c-4b33-8dff-f26b22a6cedb](https://mobbin.com/sites/sections/57b9bf6d-253c-4b33-8dff-f26b22a6cedb) | Resources：浅灰容器、居中标题；双列三行白色细框资源条，标题/说明与右侧下载小图标；紧凑而非海报卡。 |
| [33350120-d36a-49f2-9a08-c6c93393348d](https://mobbin.com/sites/sections/33350120-d36a-49f2-9a08-c6c93393348d) | Amex对比三理由；左大标题下三等宽暖灰卡，短标题说明在上、底部白色UI截图/手机/蓝色同步浮层；不依赖黄绿。 |
| [cee11f15-afd8-43ce-ae78-1bf7a4170185](https://mobbin.com/sites/sections/cee11f15-afd8-43ce-ae78-1bf7a4170185) | Healthier businesses：居中标题；多列高低错落数据卡与品牌logo，白/浅蓝交替，蓝灰大数字；底部淡出；轮播阶段未知。 |
| [6dd75499-62d4-4742-8986-5403e4df348d](https://mobbin.com/sites/sections/6dd75499-62d4-4742-8986-5403e4df348d) | 教育场景：居中标题与灰说明，下方左政策文案、右白色实体VISA卡；微阴影，白上白。 |
| [dbc0e64c-c40f-4424-aee2-7f853a5a5298](https://mobbin.com/sites/sections/dbc0e64c-c40f-4424-aee2-7f853a5a5298) | 与758同账户斜卡构图；顶栏不含Partners、右下黄绿方标；阴影淡紫绿，不能强制归为仅暖灰。 |
| [13557a98-696e-456b-87af-a02a906d3e29](https://mobbin.com/sites/sections/13557a98-696e-456b-87af-a02a906d3e29) | 另一Healthier businesses数据墙；品牌/数据可见列与cee不同，白浅蓝错列、下方淡出；可能轮播状态或capture差异未定。 |
| [329c945f-4a02-48ca-ab03-3a668e4e4d47](https://mobbin.com/sites/sections/329c945f-4a02-48ca-ab03-3a668e4e4d47) | 浅灰大容器双栏：左四步标题和黄绿Watch video；右01至04纵向步骤，细横线分隔，编号小描边框。 |
| [0eea1e87-ae08-41f8-9c84-2f889d397d39](https://mobbin.com/sites/sections/0eea1e87-ae08-41f8-9c84-2f889d397d39) | Ramp vs Amex 白底比较表：左行名，右Ramp/Amex品牌列，细横线和灰色小正文；无粗框、无彩色整列。 |
| [1f9a6af6-f75c-4b8a-8e0a-bf4e7b36ca41](https://mobbin.com/sites/sections/1f9a6af6-f75c-4b8a-8e0a-bf4e7b36ca41) | 两张等宽细框白卡：左层叠盾牌和阴影，右放射细线+浅蓝Same-day ACH胶囊；底部小法律说明；未显示顶栏。 |
| [f94cb20b-8c96-4d62-ac73-7acb482f2767](https://mobbin.com/sites/sections/f94cb20b-8c96-4d62-ac73-7acb482f2767) | 小企业证言：白底居中标题，黑底白字大卡横向轮播，客户小logo与署名，右侧下一卡裁切、下方圆箭头。 |
| [72d7b9e4-ca4a-4643-8c92-f97a71a70658](https://mobbin.com/sites/sections/72d7b9e4-ca4a-4643-8c92-f97a71a70658) | 与1f9同盾牌/放射线双卡；额外顶栏含Partners与底部法律胶囊、圆chat，裁切不同。 |
| [22fdf389-76be-445b-93c6-9dc5c5e9be62](https://mobbin.com/sites/sections/22fdf389-76be-445b-93c6-9dc5c5e9be62) | 大双栏组合：左暖色握手人物照片，右深绿底白字三项圆勾优点；整块轻圆角。 |
| [40a22e6f-3abc-4402-bb05-afbd3143c83e](https://mobbin.com/sites/sections/40a22e6f-3abc-4402-bb05-afbd3143c83e) | 不等宽双卡；左浅蓝渐变黑卡和绿勾/橙叉浮层标签；右深蓝几何背景OpenAI白字证言；色彩承担业务示意及客户背书。 |
| [66ddb62a-aa1c-48cf-9e17-53cb794efd4e](https://mobbin.com/sites/sections/66ddb62a-aa1c-48cf-9e17-53cb794efd4e) | 浅灰整块：左上标题黄绿按钮；2x2客户证言，logo、公司名、灰标签、正文与署名，底部分隔细线；非统一白卡。 |
| [f5c0cabe-f6e3-4495-9125-1df4c09c8848](https://mobbin.com/sites/sections/f5c0cabe-f6e3-4495-9125-1df4c09c8848) | Newsroom 暖灰底3列文章；图像含黄绿便签手写字、蓝条纹黄绿贴标、Treasury UI；图下小类别和黑标题灰摘要。 |
| [51ab125e-73dc-467c-8011-3a748af04471](https://mobbin.com/sites/sections/51ab125e-73dc-467c-8011-3a748af04471) | 居中媒体标题与下载文字链接；下方3x2浅灰新闻文本卡，小大写来源日期、标题、Read more箭头；无缩略图。 |
| [8d5e762c-77e0-4cec-b386-4e285906f921](https://mobbin.com/sites/sections/8d5e762c-77e0-4cec-b386-4e285906f921) | Customer Stories 超大单行标题；两行密集logo；左一大故事照片、右两列多行较小照片卡，文字有图上覆盖和图下两种；底部See all。 |
| [53ec0f09-7b25-45e2-8cec-7efa7fbdfcd8](https://mobbin.com/sites/sections/53ec0f09-7b25-45e2-8cec-7efa7fbdfcd8) | 黑色整节包围居中浅蓝到白渐变大圆角证言卡；小Zola logo、居中黑证言、署名；不是黑底白字卡。 |
| [3478befb-f604-4531-869c-2a25e40e86bd](https://mobbin.com/sites/sections/3478befb-f604-4531-869c-2a25e40e86bd) | 全宽户外演唱会举手照片，加深遮罩；顶部横向客户logo切换与细线；左白色大证言、署名、文字链接。 |
| [69618a14-bae5-43a7-8997-884965f58cc5](https://mobbin.com/sites/sections/69618a14-bae5-43a7-8997-884965f58cc5) | 横向双栏证言：左暖灰黑正文署名，右校园儿童照片与白KIPP logo；整体轻圆角。 |
| [9c515450-5e8b-4ad0-8c45-fe6be166f9cc](https://mobbin.com/sites/sections/9c515450-5e8b-4ad0-8c45-fe6be166f9cc) | 纯白宽留白证言，居中Webflow彩色logo、黑色多行引语、较小署名；没有外卡边界。 |
| [a039a1a3-52e7-430c-8291-7c16ed0f4078](https://mobbin.com/sites/sections/a039a1a3-52e7-430c-8291-7c16ed0f4078) | 白底客户故事轮播；大幅Barry's工作照片，下方引语署名及黑色故事按钮；右下一故事图裁切，顶部居中标题。 |
| [b5b16367-0324-4627-87db-791011ccde93](https://mobbin.com/sites/sections/b5b16367-0324-4627-87db-791011ccde93) | Systems that never spoke 白底居中标题；多个表格、邮件、政策、聊天窗口、文件图标与曲线连接线散布，含微小彩色emoji；展示割裂流程。 |
| [8a09538c-ffad-4eb6-8100-ccc910872f19](https://mobbin.com/sites/sections/8a09538c-ffad-4eb6-8100-ccc910872f19) | Compare Features：Free/Plus/Enterprise三列；Plus黄绿按钮，Free浅灰，Enterprise黑色；分组横线、绿圆勾、灰小字，右侧折叠箭头。 |
| [537fd731-3f43-4788-b4c7-b7478723c49b](https://mobbin.com/sites/sections/537fd731-3f43-4788-b4c7-b7478723c49b) | Compare Features另一版本：Free黄绿、Plus与Enterprise黑色；功能行文字/旅行行与8a不同；不可合并按钮优先级。 |
| [0addfde9-71dd-4ed4-b744-c5a713e64161](https://mobbin.com/sites/sections/0addfde9-71dd-4ed4-b744-c5a713e64161) | 浅灰长页脚：顶层横链接，下方五列分组；中下logo地址、45,000+文案和邮箱黄绿CTA一行；底部法律小字、商店徽章及社交图标。 |
| [69a25a7e-7012-41e8-8129-9133bdcee565](https://mobbin.com/sites/sections/69a25a7e-7012-41e8-8129-9133bdcee565) | 黑底长页脚：顶部六列小字导航，横线后法律/地址/商店/社交多栏；最下左50,000+与深色邮箱黄绿CTA；和浅灰footer结构明显不同。 |
| [4bd26ace-d295-46d6-b0af-5e4afd3036ff](https://mobbin.com/sites/sections/4bd26ace-d295-46d6-b0af-5e4afd3036ff) | 白底居中客户评价标题；下方三等宽细描边白卡，G2徽章跨卡上沿，星级、黑引语、灰署名；没有大照片。 |
| [1372a54f-9e88-4179-960c-9765e59d6046](https://mobbin.com/sites/sections/1372a54f-9e88-4179-960c-9765e59d6046) | Start for free 三列长价格卡：细边白底，Free/Plus/Enterprise，价格和计费微文案；每列邮箱与按钮，Free黄绿其余黑；下方密集分组勾选功能。 |
| [c81b8b72-d3eb-4319-af18-711417e238cb](https://mobbin.com/sites/sections/c81b8b72-d3eb-4319-af18-711417e238cb) | 白底中的黄绿色宽圆角下载横条，左二维码，右Download Ramp Mobile及App Store/Play Store说明；黄绿可承载整块信息条而非仅按钮。 |

## 未确认项目
Ramp展开导航/mega-menu、完整集成目录、表单校验状态、移动端布局、hover/焦点、动画时序、源字体和精确颜色均未验证。原生MCP图已在会话显示；未下载授权截图，没有本地图片路径。JSON保存工具返回的可渲染短链接，它们可能过期；稳定引用使用section规范链接。后续主任务的精确目录清单应独立存证后与ID交叉核对，不能用人工猜测补齐。


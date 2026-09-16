# 前端与会话审核｜2026-09-15

只读依据：[方案](../../foundation/full-stack-proposal-v1.md)。工具检索无Context7，实际使用web官方源。以下均待批准；未开账号、部署、发消息或验证运行性能。

1. **双后端不是必要前提。** 事实：[Next.js](https://nextjs.org/docs/app/guides/backend-for-frontend)支持业务HTTP入口，服务器页面可直接调用数据层；函数托管限制不能直接套用于常驻部署。推断：本项目仅网页，优先考虑Next.js单业务后端＋独立worker；减少一次网络调用、令牌转交和部署协调。Fastify可独立扩容、隔离页面负载，但增加服务与故障点。建议将“推荐组合”改成条件决策，业务模块与框架分离，两案均保留后台任务。最小验收：选定方案跑登录→申请→审核及SSE重连，再按既定300活跃用户负载测量；容量优势目前未验证。

2. **会话刷新需明确唯一责任。** 事实：[SSR客户端](https://supabase.com/docs/guides/auth/server-side/nextjs)区分令牌读取和身份验证；[Google流程](https://supabase.com/docs/guides/auth/social-login/auth-google)要求回调兑换授权码及跳转白名单。建议在“请求边界”指定Next.js负责cookie刷新，Fastify仅接收访问令牌并验证身份、查组织权限，拒绝代理传入角色；仅启用Google，关闭其他登录入口。最小验收：过期刷新、多标签并发、伪造身份、跨组织请求及非Google登录均覆盖。

3. **退出与防伪造不能只靠SDK。** 事实：[退出文档](https://supabase.com/docs/guides/auth/signout)说明旧访问令牌在到期前仍有效；[Next.js](https://nextjs.org/docs/app/guides/data-security)的Origin检查针对Server Actions。建议补充退出作用域及撤销生效窗口；资金操作核验有效会话，不能只验签。cookie限定app主机、Secure及SameSite=Lax；cookie写接口另设Origin防伪造检查，不假设代理自动继承。最小验收：退出后重放旧令牌、外站提交、恶意回调跳转。

4. **公开页也可能泄漏登录态。** 事实：[Supabase](https://supabase.com/docs/guides/auth/server-side/advanced-guide)警告刷新响应被共享缓存会串号。建议补缓存矩阵：公开活动缓存路径不刷新会话，不混入个人状态；私有读取及登录响应全链路private/no-store，刷新cookie和缓存头完整传递，请求级创建客户端。最小验收：账号A刷新后账号B经同一代理访问，无A的cookie、余额；退出再后退不显示旧私有数据，公开缓存仍可命中。

5. **shadcn支持迁移，不保证现有组件兼容。** 事实：[配置文档](https://ui.shadcn.com/docs/components-json)提供服务器组件开关、样式路径和导入别名。建议将“复用”补为迁移清单：核对tokens、Tailwind版本、浏览器API及客户端边界；不全站客户端化。最小验收：迁移活动卡、表单、弹窗，检查三语言、移动端键盘操作及服务器渲染后无界面不一致警告。现有组件逐项兼容性未验证。

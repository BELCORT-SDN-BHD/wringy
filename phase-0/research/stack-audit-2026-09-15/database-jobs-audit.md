# 数据库与任务审核｜2026-09-15

已读 `phase-0/foundation/full-stack-proposal-v1.md`。Context7工具检索为空，实际使用web官方源；未委派、开账号、部署或发消息。以下均为待批准建议，未做集成实测。最大风险：任务重试被误当成付款恰好一次。

1. **同库可保留，但需锁版本。** 事实：[pg-boss](https://pgboss.io/)要求PostgreSQL≥13；当前[包声明](https://raw.githubusercontent.com/timgit/pg-boss/master/package.json)为12.32.0、Node≥22.12，不只约束CommonJS。[PG官方](https://www.postgresql.org/docs/current/sql-listen.html)已列13为不受支持。推断/改文：修正“运行版本”条，选受支持交集；同库独立队列schema，迁移与运行权限分开。验收：记录实际PG、Node及锁包版本，以目标权限完成建队列、投递、消费和升级回滚演练。

2. **同库不自动等于同事务。** 事实：[事务接口](https://pgboss.io/api/adapters)允许通过`db.executeSql`在现有事务入队。推断/改文：在“任务单独运行”保留outbox（待发送事件表）；relay将入队与标记已投递放进同一pg连接事务，消费端仍以业务唯一键去重。若仅为可靠入队，直接同事务send可作为简化备选，勿并建两条路径。验收：业务回滚无事件；relay提交前后崩溃，最终无漏任务、无重复业务效果。

3. **连接预算必须算监听。** 事实：[Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres)常驻服务优先直连，IPv4-only用session池；[连接限制](https://supabase.com/docs/guides/database/connecting-to-postgres/pooling-and-limits)包含平台服务。推断/改文：补API、worker、专用监听及平台余量总预算；监听不用transaction池。验收：从目标运行网络验证DNS/IP、TLS及重连，双副本压力下无连接耗尽。

4. **横扩与SSE有条件保留。** 事实：[worker](https://pgboss.io/api/workers)本地并发随副本相乘，全局组并发也可能短暂超限；可选LISTEN需专用会话，轮询仍兜底。[LISTEN](https://www.postgresql.org/docs/current/sql-listen.html)断连失去注册。推断/改文：队列唤醒与页面刷新分开；SSE保留，重连先提交LISTEN再读状态，逐用户授权；并发限制不能代替付款锁或平台速率限额。验收：双worker崩溃恢复、双API跨实例通知、最终代理无缓冲、断网补读及轮询降级；正常状态5秒内可见。

5. **禁止exactly-once付款推导。** 事实：[Stripe](https://docs.stripe.com/api/idempotent_requests)同键返回原结果含500；键至少24小时后可清理，清理后重用会新建请求。推断/改文：补永久业务付款唯一键、固定参数与服务商交易ID；未知状态查询对账，过保留期禁盲重发。验收：模拟付款成功但响应丢失、落库前崩溃、重复回调和键过期，均不产生第二笔付款或重复账本分录。

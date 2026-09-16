# 部署与运营复核

2026-09-15。已读 `phase-0/foundation/full-stack-proposal-v1.md`；Context7工具检索为空，改用web官方源。遵守worker不再委派规则。最大风险：把供应商支持误当作部署及恢复已验证。以下均未实测，推荐未批准；未开账号、部署或发消息，主规格未改。

1. **私有API需补公网回调路径。** 事实：[新加坡可选](https://render.com/docs/regions)；[内网要求同区域、同workspace](https://render.com/docs/private-network)；[private服务无公网入口，worker不能接收入站请求](https://render.com/docs/private-services)。推断/改文：“请求边界”补Next.js公网回调→Fastify，原始请求体和签名头原样转发。无视频上传继续不设存储/转码服务，禁止新增视频代理下载。最小验收：外网不能直连API；投稿仅传链接、元数据；视频请求体被拒。

2. **SSE与扩容要一起验。** 事实：[Next.js要求全链路无缓冲及多实例版本协调](https://nextjs.org/docs/app/guides/self-hosting)；[Render自动扩容需Pro以上，仅按CPU/内存](https://render.com/docs/scaling)。推断/改文：“扩容验收”补同构建产物、deploymentId、使用Server Actions时统一密钥；补SSE心跳、断开取消上游、连接数及队列年龄告警，注明积压不会直接触发扩容。最小验收：双web/API、300活跃用户下逐条到达；滚动发布后重连、缓存失效，仍满足原5秒目标；缩容无连接泄漏。

3. **邮件重试有时间边界。** 事实：[Resend去重键仅保留24小时](https://resend.com/docs/dashboard/emails/idempotency-keys)；[回调可能重复、乱序](https://resend.com/docs/webhooks/introduction)，[验签必须用原始体](https://resend.com/docs/webhooks/verify-webhooks-requests)。推断/改文：“通知”补长期发送记录、超24小时未知结果先核对、退信抑制及域名验证门槛。最小验收：重放、乱序不倒退状态；超窗未知邮件不自动重发；退信可查可处理。

4. **不停机发布不保证任务不中断。** 事实：[Render终止宽限默认30秒，最高可配300秒](https://render.com/docs/deploys)；[回滚不还原共享环境组值](https://render.com/docs/rollbacks)。推断/改文：“运营恢复”补停止领任务、排空/重领、三服务兼容发布顺序、固定镜像摘要与配置记录、恢复时限和负责人；无需视频存储，不为临时文件挂持久盘。最小验收：强停worker后任务恢复且副作用不重复；旧版本配当前配置恢复成功，记录耗时。

5. **Sentry可候选，不能代替存活监测。** 事实：[官方仓库提供Next.js和Node SDK](https://github.com/getsentry/sentry-javascript)；当前Sentry指南直读失败，Fastify精确版本组合未核实。推断/改文：“监控”补浏览器、API、worker分别初始化，版本标记、源码映射、脱敏和采样；另设服务探活、worker心跳及积压告警。最小验收：三端故障均定位到版本/源码且无敏感字段；worker卡住但不抛错时仍告警，运营能按记录恢复。

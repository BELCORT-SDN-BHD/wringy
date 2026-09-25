# Wringy

Content Rewards 平台：商家发布活动，创作者按有效观看获得奖励。先在马来西亚开展业务，界面支持 English、Bahasa Melayu、简体中文。

## 从这里开始

- [产品蓝图：愿景、用户、核心旅程与成功指标](docs/PRD.md)
- [技术蓝图：现状、已接受目标与系统边界](docs/ARCHITECTURE.md)
- [全阶段规格与任务分类](docs/planning/README.md)
- [全部规格和票据链接](docs/planning/github-index.md)
- [Projects 看板](https://github.com/orgs/BELCORT-SDN-BHD/projects/2)
- [开发任务](https://github.com/BELCORT-SDN-BHD/wringy/issues)
- [五个开发阶段](https://github.com/BELCORT-SDN-BHD/wringy/milestones)
- [产品与基础文档](phase-0/foundation/README.md)
- [业务行为与 A01–A40 验收来源](phase-0/foundation/prd-content-rewards-v2.md)
- [设计系统](phase-0/foundation/design-system-v2/README.md)
- [技术方向决策依据](phase-0/foundation/full-stack-proposal-v1.md)
- [业务规则与默认值](phase-0/foundation/campaign-defaults-v1.md)
- [公开迁移说明](docs/publication-scope.md)

## 开发顺序

三端交互原型 → 可保存数据的内部版本 → 完整业务模拟 Beta → 真实接口接入 → 小范围试运营。

外部服务可行性验证尽早并行。只有经过验收的能力才开放给真实用户。当前仓库是产品基础、设计系统和开发规划；不是已上线的业务应用。

PRD 与 Architecture 是长期蓝图，文件头保留维护关注点；Wayfinder / to-spec 接受决定后原位更新，再进入 to-tickets。具体业务值由活动默认规则维护，详细交付与验收留在阶段 specs，不向蓝图追加任务历史。

GitHub Issues 是任务状态的唯一来源。历史 `.scratch` 文档仅供追溯；详细规格与业务规则在版本控制中维护，关联规格 issue 记录执行、变更和验收。开始开发前检查任务的原生依赖及批准记录。

## Internal build (M2)

M2-01（[#16](https://github.com/BELCORT-SDN-BHD/wringy/issues/16)）在同一个 pnpm 工作区里建立可保存数据的内部版本骨架。它没有登录（M2-02 起），不部署，只读取数据库里的夹具活动（fixture）和后台任务健康状态。

| 进程 | 位置 | 本地地址 | 说明 |
|---|---|---|---|
| web | [`apps/web`](apps/web/README.md) | `127.0.0.1:3100` | M1 演示原型，加上内部版本页 `/internal`（服务端组件，经 API 读取） |
| api | [`apps/api`](apps/api/README.md) | `127.0.0.1:3200` | Fastify，只供 web 服务端调用；以只读运行账号 `wringy_api_login` 访问数据库 |
| worker | [`apps/worker`](apps/worker/README.md) | 无 HTTP | pg-boss；进程心跳与队列往返，运行账号 `wringy_worker_login` |
| PostgreSQL 17 | [`packages/db`](packages/db/README.md) | `127.0.0.1:54329` | 本地为 embedded PostgreSQL（不需要 Docker，数据在 `.local/pg`）；CI 为 `postgres:17` 服务 |

Node 固定为 24.21.0：根目录 `.npmrc` 的 `use-node-version` 让 pnpm 自己下载并使用该版本，本机的 `node` 可以更旧。环境变量只写名称，见 [`.env.example`](.env.example)、`apps/api/.env.example`、`apps/worker/.env.example`；值只放在不入库的 `.env` 文件里。

**启动顺序**（首次；以后从 `pnpm db:start` 开始）：

```bash
pnpm install
pnpm db:start            # embedded PostgreSQL 17，打印各账号的本地 URL
# 根目录 .env：WRINGY_ENV=local，DATABASE_URL_MIGRATOR 用 db:start 打印的迁移账号 URL
pnpm db:bootstrap        # 只需一次：角色、登录账号、数据库 wringy
pnpm db:platform-bootstrap --stub-auth   # 只需一次：非超级用户 wringy_platform_admin、
                         # 桩 auth.sessions 与 platform.session_is_live（--stub-auth 只在 local/ci 接受）
pnpm db:migrate          # pg-boss schema，再执行全部 SQL 迁移（迁移账号）；重复执行不改变任何东西
pnpm db:env              # 写入环境标记 ops.environment（local 允许夹具）
pnpm db:seed:fixtures    # 两个夹具组织、三个夹具活动
pnpm db:allowlist add <你的 Google 邮箱> --reason "<原因>" --by "<你的名字>"
                         # 谁可以第一次登录内部版本（裁决 D13）；remove/list 同一个命令
# apps/api/.env、apps/worker/.env：从各自的 .env.example 复制，填 WRINGY_ENV=local 与 db:start 打印的运行账号 URL；
#   api 另需 SUPABASE_URL、SUPABASE_PUBLISHABLE_KEY 与 SESSION_LIVENESS（本地用 auth_server：
#   应用库是 embedded 集群，不是 Supabase 项目库，只有 auth_server 适配器答得出“会话还活着吗”）
# apps/web/.env.local：WRINGY_ENV=local，API_INTERNAL_URL=http://127.0.0.1:3200（Next 从应用目录读取 .env*）；
#   要走真实 Google 登录再加 WRINGY_APP_MODE=internal 与 SUPABASE_URL、SUPABASE_PUBLISHABLE_KEY、
#   APP_ORIGIN=http://127.0.0.1:3100（不填 WRINGY_APP_MODE 就是 M1 演示版本，上面三个都不需要）
pnpm dev                 # web、api、worker 一起启动
# 填了 WRINGY_APP_MODE=internal：打开 http://127.0.0.1:3100/internal，先登录再看数据。
# 没填（M1 演示版本）：打开 http://127.0.0.1:3100/ 看演示；此时 /internal 的两块 M2-01 数据
#   不带令牌去读 API，而自 M2-02 起每个 /internal/* 路由都在认证钩子之后（R8），所以 API 答 401，
#   页面只显示一个“出错了”提示。这是预期的，不是回归（docs/m2-internal/known-issues.md）。
pnpm db:stop
```

内部版本的登录走 Supabase Auth 的 Google 提供方，密钥只有可公开的 `sb_publishable_…`；
真实登录的一次性演练见 [docs/m2-internal/m2-02-real-login-runbook.md](docs/m2-internal/m2-02-real-login-runbook.md)。
`WRINGY_APP_MODE=internal` 会让 `apps/web/src/proxy.ts` 接管路由，`/` 以外的演示页面都变成内部版本的
not-found，所以 M1 演示套件自己把 `WRINGY_APP_MODE=demo` 写在 webServer 上，不受本机 `.env.local` 影响。

api 与 worker 的 `dev` 脚本用 Node 自带的监视模式加 tsx 加载器（`node --watch --import tsx`）。原先的 `tsx watch` 在 Windows 上经 `pnpm -r --parallel run dev` 启动时没有任何输出（2026-09-23 在本机复现：12 秒内 0 行；改用 `node --watch --import tsx` 后 `pnpm dev` 25 秒内 api、worker、web 各 7 行）。原因在 `pnpm run` 经 shell 启动 `tsx watch` 这一层，未进一步确认；`pnpm exec tsx watch` 同样的命令有输出。Node 的监视模式偶尔会在启动时因 `node_modules` 里的文件报一次“Change detected”并重启一次，无害。

**检查命令**（CI 的 [App checks](.github/workflows/app.yml) 运行同样的命令）：

```bash
pnpm lint && pnpm typecheck && pnpm test   # 各工作区的 lint、类型、单元测试
pnpm test:int                # 真实 PostgreSQL 17 集成测试：设置 TEST_DATABASE_URL（超级用户 URL）时用该集群，否则每个套件自起一个临时 embedded 集群
pnpm depcruise               # 依赖方向检查；还会植入四个违规文件，必须都被拒绝
pnpm check:supabase-scope    # 只有 apps/web/src/lib/auth/supabase-server.ts 能 import @supabase/*，
                             # 且其中每个 createServerClient( 都在函数体内（不能有模块级客户端）
pnpm check:acceptance        # 验收映射：每个 M2 测试全名带 M2-AC，M2-AC01 与 M2-AC02 每个子项
                             # 都有测试或验收记录行
pnpm build                   # 全部构建（web 为 standalone 输出）
pnpm canary                  # 密钥金丝雀：用金丝雀值构建 web/api/worker，检查产物与日志中不出现任何金丝雀值
pnpm --filter web e2e        # M1 演示套件（Playwright，3 个视口）
pnpm e2e:internal            # M2 内部版本套件：自行启动数据库、api、worker 与 web，全部真实
```

证据截图默认写到被忽略的目录；设置 `WRINGY_EVIDENCE_SHOTS=1` 才会刷新受版本控制的截图（`WRINGY_EVIDENCE_SHOTS=1 pnpm e2e:internal` 写入 `docs/m2-internal/screenshots`）。验收证据记录在 [docs/m2-internal/acceptance-record.md](docs/m2-internal/acceptance-record.md)。

镜像：`apps/web`、`apps/api`、`apps/worker` 各有一个 Dockerfile，都以仓库根目录为构建上下文（`docker build -f apps/<app>/Dockerfile .`），由 CI 的 `images` 作业构建与冒烟运行，不推送；api 镜像同时带迁移文件，供每次发布前运行一次 `node /migrate/dist/migrate.js`（见 [apps/api/README.md](apps/api/README.md)）。

## 克隆后的代理工具设置

仓库自带两个代理的 Matt Pocock 技能、Codex 的 graphify 技能与钩子（`.agents/skills`、`.codex/hooks.json`），以及 Claude Code 的 graphify 钩子（`.claude/settings.json`）。Git 钩子和合并驱动只存在于本机的 `.git`，每个克隆都要自己安装：

1. `pip install --upgrade graphifyy`，然后在仓库根目录运行 `graphify hook install`：安装 post-commit / post-checkout 钩子，并注册 `.gitattributes` 引用的 `graph.json` 合并驱动。
2. Claude Code 使用全局技能：`graphify install` 只写入用户主目录（`~/.claude/skills/graphify` 与 `~/.claude/CLAUDE.md`），不改动仓库。
3. Codex 首次发现 `.codex/hooks.json` 时会弹出信任提示，需在 Codex 应用中批准。

知识图谱在 `graphify-out/`；用法规则见 [AGENTS.md](AGENTS.md) 的 graphify 一节。

## 本地设计系统

已有组件展示在 `phase-0/foundation/design-system-v2/app`，按其中 package.json 的脚本安装和启动。它是参考组件库，不是商家/创作者/运营三端业务原型。

## 权利与素材

公开可读不等于授予本项目开源许可；本次没有代创办人选择开源许可证。第三方组件遵循各自许可。外部产品截图和下载的参考报告不随源码重新分发，研究保留引用链接。

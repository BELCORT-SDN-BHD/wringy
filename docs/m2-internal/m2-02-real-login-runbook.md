# M2-02 真实登录走查手册（创办人专用）— Real rows of M2-AC02

票：[M2-02 / #21](https://github.com/BELCORT-SDN-BHD/wringy/issues/21)。规格明文："真实测试凭据缺失须列阻塞，模拟结果不能关闭本票"
（M2-AC02/3）。自动化测试用的是本地假冒的 Supabase Auth（`apps/web/tests/e2e-internal/fake-auth/`），它证明代码逻辑，
不证明"真实 Google 账号能登进来"。下面这几步只能由人用真实 Google 测试账号做；做完把结果按第 4 节记进
[acceptance-record.md](acceptance-record.md) 的 M2-AC02 Real 行（或把截图丢给 agent 让它记）。

设计依据：[m2-02-code-review.md](m2-02-code-review.md) §3 请求流程；测试清单：[kickoff-package.md](kickoff-package.md) §4.9 的 Real 行。

## 1. 准备（agent 已在 2026-09-25 做好的部分）

| 项 | 状态 |
|---|---|
| Supabase dev 项目：只开 Google、ES256、Site URL `http://127.0.0.1:3100`、Redirect `http://127.0.0.1:3100/auth/callback` | 前三项已由 agent 用接口核实；后两项按 #21 清单第 3 节由你填写，走查第一步会验证 |
| Google OAuth dev client 的 test users | `.env.vendors` 的 `GOOGLE_TEST_USER_EMAILS` 里的 4 个账号 |
| 本机允许名单（tester allowlist，D13） | 这 4 个账号已用 `pnpm db:allowlist add … --reason "M2-02 real login walk" --by orchestrator` 加进本机数据库（`pnpm db:allowlist list` 可看） |
| 本机环境文件 | `apps/api/.env` 已追加 `SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY`、`SESSION_LIVENESS=auth_server`；`apps/web/.env.local` 已生成（`WRINGY_APP_MODE=internal`、`APP_ORIGIN=http://127.0.0.1:3100` 等）。两个文件都不入库 |

如果 dev 项目的 Site URL / Redirect 不是上面的值，第一步会在 Supabase 那里报 redirect 无效；在控制台改好再来。

## 2. 启动本机内部版（三个终端）

```sh
pnpm db:start            # 若已在跑会提示；数据在 .local/pg
pnpm db:bootstrap        # 幂等；顺带装 platform.session_is_live 和本机 auth 桩
pnpm db:migrate          # 迁移头应为 0009_sign_in_allowlist
pnpm db:seed:fixtures    # 演示活动
pnpm --filter api dev    # 终端 1，127.0.0.1:3200
pnpm --filter worker dev # 终端 2
pnpm --filter web build && pnpm --filter web start   # 终端 3，127.0.0.1:3100（用 start 而不是 dev，和 CI 一致）
```

浏览器打开 `http://127.0.0.1:3100/` 应自动跳到 `/internal`，再跳到 `/internal/sign-in`（内部版登录页）。

## 3. 走查步骤（每步截图，文件名按括号内命名，放到 `docs/m2-internal/screenshots/real/`）

按 §4.9 的 Real 行，一步对应一行。用两个不同的浏览器（例如 Chrome 和 Edge，或 Chrome 正常窗口 + 另一个 Chrome 用户配置；
不要用同一浏览器的无痕窗口混淆），下面叫 A 和 B。

| # | Real 行 | 做什么 | 期望看到什么 | 截图 |
|---|---|---|---|---|
| 1 | **login**：真实 Google 登录并回到原页 | 在 A 打开 `http://127.0.0.1:3100/internal?x=1`（带个参数方便看回跳）→ 点"使用 Google 继续"→ 选允许名单里的测试账号 → 同意 | 回到 `/internal?x=1`，页面顶部显示"已登录：<你的邮箱>"，演示活动和后台任务卡片正常显示 | `real-01-login.png`（登录后页面） |
| 2 | **scopes**：Google 只要姓名/邮箱/头像 | 第 1 步 Google 的同意页（或用未同意过的账号重做）| 同意页只列"查看您的电子邮件地址 / 查看您的个人资料信息"，**没有** YouTube 相关条目（agent 已核实 Supabase 发出的请求只有 `scope=email profile`，这一步是用你的眼睛再确认一次） | `real-02-consent.png` |
| 3 | **refresh**：两个标签页同时刷新都保持登录 | 在 A 里开第二个标签页也打开 `/internal`，两个标签页同时按 F5 几次 | 两个都仍显示"已登录"，没有被踢回登录页 | `real-03-two-tabs.png` |
| 4 | **bridge**：服务器能查到真实会话存活 | 在 A 的 `/internal` 点"检查会话"按钮 | 页面出现"会话有效"的结果条（`probe=ok`）。这证明 Fastify 通过真实 Supabase 的 `/auth/v1/user` 确认了会话（Mechanism B） | `real-04-probe-ok.png` |
| 5 | **scope**：退出只作用于当前设备 | 在 B 用同一个账号也登录；然后在 A 点"退出" | A 到"已退出此设备；其他设备上的登录不受影响"页；回到 B 刷新，B 仍是登录状态，B 点"检查会话"仍是"会话有效" | `real-05a-signed-out.png`、`real-05b-other-device-ok.png` |
| 6 | **cancel**：取消登录有可见结果 | 在 A 重新点"使用 Google 继续"，在 Google 页面点"取消"或直接选择不同意 | 回到登录页，显示"登录已取消" | `real-06-cancelled.png` |
| 7 | **not_allowed**：不在允许名单的账号被挡 | 用一个真实但**不在**名单里的 Google 账号登录 | 回到登录页，显示中性的"内部版本，暂未开放"类文案，不显示任何数据 | `real-07-not-allowed.png` |
| 8 | **back button**：退出后后退键看不到私有数据 | 第 5 步退出后在 A 按浏览器后退 | 不显示"已登录"和活动数据（会回到登录页） | `real-08-back.png` |
| 9 | **stale**：重复使用刷新令牌会结束会话 | 需要脚本抓令牌，人工做不到 | 记为 **NOT EXECUTED（需脚本）**；API 集成测试覆盖了逻辑（模拟） | — |
| 10 | **三种语言** | 在登录页右上/设置切换 ms-MY 和 zh-Hans-MY 各截一张登录页 | 三语文案齐全 | `real-10-ms.png`、`real-10-zh.png` |

顺序建议：1 → 2（同一次）→ 3 → 4 → 5 → 8 → 6 → 7 → 10。全程约 15 分钟。

## 4. 记录方式

每一步一行，写进 `acceptance-record.md` 的 "M2-AC02 Real rows" 表：验收ID、版本（当时 `git rev-parse --short=7 HEAD`）、环境（"本机 + Supabase dev 项目；真实 Google 账号"）、
步骤、期望、实际、时间、截图路径、未决项。没做的步骤写 **NOT EXECUTED** 和原因。不要把账号密码、`sb_secret_`、数据库密码贴进任何地方。

## 5. 出错时

- 点 Google 后报 `redirect_uri_mismatch`：Google client 的 Authorized redirect URI 没填 `https://<dev-ref>.supabase.co/auth/v1/callback`（清单第 2 节第 5 步）。
- Supabase 报 redirect 无效：dev 项目 Site URL / Redirect URLs 不是 `http://127.0.0.1:3100` / `…/auth/callback`。
- 登录后显示"内部版本暂未开放"（not_allowed）：该邮箱不在本机允许名单，`pnpm db:allowlist add <email> --reason … --by …` 后重登。
- 页面显示"无法连接 API"：终端 1 的 api 没起来，或 `apps/api/.env` 缺新变量（api 启动日志会点名缺哪个）。
- 想看服务端怎么判断的：终端 1 的 api 日志只记路径和错误码，不记令牌。

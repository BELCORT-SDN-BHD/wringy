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

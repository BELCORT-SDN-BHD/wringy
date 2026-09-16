# Wringy

Content Rewards 平台：商家发布活动，创作者按有效观看获得奖励。先在马来西亚开展业务，界面支持 English、Bahasa Melayu、简体中文。

## 从这里开始

- [全阶段规格与任务分类](docs/planning/README.md)
- [Projects 看板](https://github.com/orgs/BELCORT-SDN-BHD/projects/2)
- [开发任务](https://github.com/BELCORT-SDN-BHD/wringy/issues)
- [五个开发阶段](https://github.com/BELCORT-SDN-BHD/wringy/milestones)
- [产品与基础文档](phase-0/foundation/README.md)
- [产品规格](phase-0/foundation/prd-content-rewards-v2.md)
- [设计系统](phase-0/foundation/design-system-v2/README.md)
- [技术方向](phase-0/foundation/full-stack-proposal-v1.md)
- [业务规则与默认值](phase-0/foundation/campaign-defaults-v1.md)
- [公开迁移说明](docs/publication-scope.md)

## 开发顺序

三端交互原型 → 可保存数据的内部版本 → 完整业务模拟 Beta → 真实接口接入 → 小范围试运营。

外部服务可行性验证尽早并行。只有经过验收的能力才开放给真实用户。当前仓库是产品基础、设计系统和开发规划；不是已上线的业务应用。

GitHub Issues 是任务状态的唯一来源。历史 `.scratch` 文档仅供追溯；详细规格与业务规则在版本控制中维护，关联规格 issue 记录执行、变更和验收。开始开发前检查任务的原生依赖及批准记录。

## 本地设计系统

已有组件展示在 `phase-0/foundation/design-system-v2/app`，按其中 package.json 的脚本安装和启动。它是参考组件库，不是商家/创作者/运营三端业务原型。

## 权利与素材

公开可读不等于授予本项目开源许可；本次没有代创办人选择开源许可证。第三方组件遵循各自许可。外部产品截图和下载的参考报告不随源码重新分发，研究保留引用链接。

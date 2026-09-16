# 浏览器检查

在 app 目录安装依赖：`npm ci`。默认使用已安装的 Google Chrome。

1. `npm run dev -- --host 127.0.0.1 --port 8878`
2. 在另一终端执行 `npm run export`，生成最新离线页面。
3. `npm run test:browser`

没有 Chrome 时，运行 `npx playwright install chromium`，再用 `PLAYWRIGHT_BROWSER=chromium npm run test:browser`。

报告及桌面、窄屏、离线截图写入 `../output/`。`npm run verify:source` 对照保留的官方源码快照，验证 61 个组件未改动、全局 CSS 仅改变颜色变量。

Slider 使用官方双滑块，并检查 Radix 的 Minimum / Maximum 名称与 FieldSet 上下文。官方当前封装未暴露单滑块命名入口，未通过修改源码或 DOM 绕过。

颜色专项：`node tests/color-allocation.cjs`。先导出最新HTML；使用同一 Chrome / PLAYWRIGHT_BROWSER 配置，可用 BASE_URL 指定开发地址。检查43个实际变量、角色文字/图标对比、灰色选择/悬停、320px源码页和离线示例，写入 `localized-verification.json` 及 localized-source 截图；旧 `color-verification.json` 保留为历史记录。

稳定构建预览：`npm run preview -- --host 127.0.0.1 --port 8879`，随后 `BASE_URL=http://127.0.0.1:8879 npm run test:browser`。用于避免开发服务器重新优化依赖时的页面重载；Tabs检查等待实际选中状态再断言。

颜色专项同时验证 en-MY / ms-MY / zh-Hans-MY 切换及三份文案键一致、局部 lang、批准不等于付款/未知不等于零、三种语言颜色角色一致、各语言320px无页面溢出及离线选择。发布构建可能将六位十六进制颜色缩为三位；测试先归一化，不修改产品颜色。

本次仅运行颜色/语言专项，保留此前22项浏览器报告，不将其视为本次重跑。当前报告记录独立HTML的SHA-256；中文样例截图为 `../output/localized-chinese-sample.png`。

# Wokiee — approved logo package / 已批准品牌标志文件包

Production package prepared 2026-09-23 from the founder-approved symbol, wordmark A and combined proof. No artwork regeneration, replacement font, website change or publication.

本文件包依据已批准的手掌星形图标、A 版字标与组合稿制作。没有重新生成图案、替换字体、修改网站或发布上线。

## Choose a file / 如何选用

| Folder / 文件夹 | Use / 用途 |
|---|---|
| `svg/` | Scalable outlined artwork for web, design and print. Black for light backgrounds; white for dark backgrounds. / 可无限缩放的路径矢量图。浅色背景用黑版，深色背景用白版。 |
| `png/black/`, `png/white/` | Transparent images, ready for presentations and other tools. / 透明背景图片，适用于演示文稿及一般工具。 |
| `pdf/` | Three black vector artwork files for handing off to a printer or designer; color space is RGB. / 三款黑色矢量稿，供印刷或设计交接；色彩空间为 RGB。 |
| `icons/` | Website favicon, Apple/Android icons and social avatar. / 浏览器、手机及社交头像。 |
| `sources/` | Original references, extracted alpha masks, path masters, reproducible build script and fidelity report. / 原始参考、透明度蒙版、路径母版、可复现制作脚本及保真报告。 |

`horizontal` = complete approved combination / 完整横向组合。

`symbol` = hand and star / 手掌与星形图标。

`wordmark` = Wokiee lettering / Wokiee 字标。

`black` / `white` = artwork color, not background / 图案颜色，不是背景颜色。

The wordmark is custom outlined artwork in this package, **not a named font**. Keep its letter shapes and spacing together; do not retype it with a substitute font.

本包字标为独立轮廓图形，**不是某款可指定名称的字体**。请整体使用，不要用其他字体重新输入或改动字间距。

## Sizes and spacing / 尺寸与留白

- Horizontal and wordmark PNG widths: 320, 640, 1280, 2560 px. The horizontal canvas is 1403:324; wordmark canvas is 529:122. / 横向组合与字标宽度均提供四档，按比例使用。
- Symbol PNGs: padded square 32, 64, 128, 256, 512, 1024 px. The unpadded symbol SVG retains its original 1006:1183 crop; `symbol-square` adds space around it. / 图标 PNG 为留白方形；普通图标 SVG 保留原裁切比例，square 版增加外围留白。
- Approved lockup coordinate system: symbol box 276 × 324, wordmark box 1041 × 240 at (362, 84), gap 86, common lower edge y=324. These include the same source crop padding as the approved proof. / 组合尺寸和间距严格沿用批准稿，不要分别拉伸、移动或重排。
- Practical starting minimums: horizontal 160 CSS px wide, standalone wordmark 100 px wide, symbol 24 px high. Inspect on the actual background and screen. 16 px favicon is supplied for compatibility and naturally loses fine detail. These are production recommendations, not a new approved design rule. / 建议最小显示宽度：组合 160 px、字标 100 px；图标高度 24 px。16 px 浏览器图标仅作兼容用途，细节会自然减少；请在实际界面检查。这些是制作建议，并非新增已批准设计规范。
- Suggested clear space: at least ¼ of symbol height around a lockup or symbol, and ¼ of wordmark height around a wordmark. Keep unrelated text or edges out of that space. This is a recommendation; icon tiles use their supplied padding. / 建议外围安全留白：组合或图标为图标高度的 ¼，独立字标为字标高度的 ¼；图标方块使用自带留白。
- On high-density screens, use a PNG at least 2× its displayed width, or use SVG. / 高清屏优先 SVG，或使用显示宽度至少两倍的 PNG。

## Icons / 图标

`favicon.svg` and `favicon.ico` have transparent backgrounds. ICO includes 16, 32 and 48 px. Apple touch icon (180 px), Android icons (192 / 512 px) and social avatar (1024 px) have an intentional opaque white square background with the black approved symbol. Do not confuse these with transparent artwork.

浏览器图标为透明背景；Apple、Android 与社交头像为黑图案搭配不透明白色方形底，这是有意的用途区分。

## Fidelity and limitations / 保真与限制

All production SVGs contain real path outlines; PDFs contain vector paths, not embedded image substitutes. Transparent artwork has no checkerboard or white rectangle. White versions have exactly the same contours as black versions.

全部 SVG 为真实路径，PDF 为矢量图形，没有以包裹图片冒充矢量。透明稿没有棋盘格或白色矩形底。白版与黑版使用完全相同的轮廓。

The original supplied assets were rasters. Potrace traced their silhouettes deterministically after 4× interpolation, with no manual drawing, weight adjustment or morphological alteration. This is a close vector approximation, **not a claim to recover the original author's exact Bézier curves**. Wordmark A was a screenshot with a baked checkerboard; edge opacity was reconstructed using the same method as the approved proof. Its cropped source resolution is only 529 × 122 px. `sources/validation.json` reports source hashes, silhouette overlap and exact composition geometry.

原始素材为位图。本包通过确定性轮廓追踪生成矢量，没有手工重画、调整粗细或膨胀收缩。它是高保真矢量近似，**不声称还原最初作者的精确曲线**。A 字标参考为带棋盘格的截图，边缘透明度沿用批准稿的提取方式；裁切后分辨率只有 529 × 122 px。保真指标、原图校验值和组合坐标见验证报告。

The contact sheet is a presentation preview, not a logo export. Source references preserve their original backgrounds and are not intended for placement in a design.

联系表用于预览，原图仅供溯源；实际使用请选择 SVG 或 PNG 成品。

## Rebuild / 重新导出

Dependencies: Python 3, Pillow, Potrace 1.16, `rsvg-convert` (librsvg); the preview defaults to macOS Helvetica when available, otherwise Pillow’s bundled font. Pass `--preview-font /path/to/font.ttf` to choose contact-sheet labels explicitly. This affects the contact sheet only, never logo lettering. From this package directory run:

```sh
python3 sources/build_package.py
```

Run the command from this package directory, or use an absolute path to the script. It recreates exports, validates SVG paths / PNG transparency / ICO sizes / PDF image absence, writes `manifest.json`, and creates `Wokiee-Logo-Package.zip` alongside this folder. Original source hashes must match or the build stops. Manifest entries include SHA-256 for every other packaged file; the manifest does not hash itself.

在本文件包目录运行上述命令，或指定脚本完整路径。脚本会导出、验证并生成清单与旁边的 ZIP；原图校验不一致或包内原图缺失会停止。预览标签字体可用 `--preview-font` 指定，不影响标志路径。

Rebuild portability: packaged source references are required; no sibling workspace is consulted. The supplied exports remain the approved artifacts. Rebuilding with different renderer/font versions may change output bytes (PDF metadata and contact-sheet labels in particular); verify geometry/fidelity and review regenerated manifests rather than assuming byte-identical exports.

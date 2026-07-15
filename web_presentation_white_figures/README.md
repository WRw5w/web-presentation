# Auto Research Web Presentation · White Edition

这是组会汇报的独立白色版网页演示，共 31 张 PPT 式页面。第 1 页是西南石油大学正式扉页，使用官网官方校标，标注汇报人张程晰、指导教师王志文、邮箱 `3183879036@qq.com`，并补充英文题目；第 2–15 页从公开榜单结果进入长期运行、Agent 生命周期、原生 AIDE、ForeAgent 增量分支和三张候选锦标赛页。

第 16–28 页不再重复 ForeAgent 算法，而是按“预测信号是否存在 → 能力边界在哪里 → 是否产生系统收益 → 如何受限接回项目”审计论文证据。第 16、18、26 页分别使用本地矢量图 `07-paper-audit-map.svg`、`08-preference-evidence-chain.svg`、`09-paper-to-system-contract.svg`；完整叙事与数字口径见 [`../materials/notes/后半段论文叙事重构.md`](../materials/notes/后半段论文叙事重构.md)。第 29–30 页是暑期科研与算法竞赛规划，第 31 页是校级视觉致谢页。V1 固定保留在 `../web_presentation/`，两套版本互不覆盖。

## 打开方式

直接用 Chrome 打开本目录的 `index.html`。页面是固定 1600×900 的 16:9 舞台，会自动适配当前窗口。

## 演示控制

- `Space` / `→`：只推进保留的少量镜头，结束后翻到下一页；Loop、Agent 架构、生命周期、AIDE 与 ForeAgent 只保留第一次放大，Scheduler 不设自动放大；第 13–15、16–28、29–30 页均作为完整 PPT 页面直接翻页。
- `Shift+Space` / `←`：回退镜头或上一页。
- `Esc`：把当前流程图恢复到第一镜头；总览开启时用于关闭总览。
- `R`：回到当前预设镜头。
- `O`：打开或关闭页面总览。
- `F`：浏览器全屏。
- `Home` / `End`：跳到第一页 / 最后一页。
- 在可缩放流程图区域内可滚轮缩放、拖动平移、双击节点聚焦。图片原生拖拽已禁用，因此从 SVG、截图或空白区域起拖都使用同一自由镜头；ForeAgent 页在进入时播放 Improve → 黄色 Predict-then-Verify → 真实执行的增量动画，减动画/导出模式直接显示最终态。

页面与镜头可由 URL 固定，例如：

```text
index.html?slide=5&camera=2&reducedMotion=1
```

## 视觉回归截图

```powershell
.\render-review.ps1
.\render-review.ps1 -IncludeCameras
.\render-review.ps1 -Width 1440 -Height 900
```

逐页验收记录见 `VISUAL_QA.md`。

## 技术边界

- 页面不依赖 Google Fonts、Mermaid、CDN 或登录态，断网也可运行。
- 首页与致谢页使用本地 `assets/swpu-official-logo.png`，来源为西南石油大学官网首页的官方横向校标，不再使用自绘校徽。
- 白色主题由 `white-theme.css` 独立覆盖；`style.css` 和 `script.js` 保留与深色版相同的布局与交互基线。
- 论文段三张新增 SVG 均为本地静态资产；页面不依赖在线字体、在线图表或远程论文截图。
- `materials/` 只作为输入素材区；生成截图放在项目 `tmp/screenshots/` 下。
- 成绩页使用 `materials/images/05_official_leaderboard_20260712.png` 作为官方截图证据，固定口径为 2026-07-12 官方榜单截图，不表达实时排名。

# Visual QA · White Edition

核验日期：2026-07-13  
核验基线：本机 Chrome 无头真实渲染，主尺寸 1600×900。

## 逐页复盘结论

| 页 | 页面 | 结论 |
|---:|---|---|
| 01 | 西南石油大学正式扉页 | 通过；官网官方横向校标已放大，新增英文题目与邮箱 `3183879036@qq.com`，中英文层级和五栏信息在 1600×900 下无溢出。 |
| 02–09 | 叙事封面、榜单、系统主线、起点、Loop、Scheduler、架构、生命周期 | 通过；第 5 页将两条关键聊天截图按顺序拼接，Autoresearch 与后续分工均完整可见；第 6 页完整嵌入 1280×4408 轮询长图，并与下方流程拉开约一个方块的横向间距；预设镜头保持精简。 |
| 10 | 原生 AIDE 闭环 | 通过；仅出现 Draft / Debug / Improve → 真实执行 → 反馈 → Journal，不提前出现 ForeAgent。 |
| 11 | 搜索矛盾 | 通过；候选生成快与真实验证慢的矛盾承接自然。 |
| 12 | ForeAgent 增量分支 | 通过；复用原生 AIDE 架构，Improve 高亮，黄色连接线从分支长出，Predict-then-Verify 方块回接真实执行。 |
| 13 | 一次生成 m=10 个候选 | 通过；右侧候选卡已脱离旧候选云样式，标题、两行圆点和输入证据三段对齐稳定，不依赖镜头平移。 |
| 14 | Pairwise World Model 比较与排序 | 通过；高/低置信度、晋级/双方保留、淘汰轮次与排序 Journal 同屏可读。 |
| 15 | Top-1 真实训练/验证 | 通过；Top-1、真实 evaluator、Journal 写回和边界说明分层清楚。 |
| 16 | 论文证据审计总图 | 通过；明确后半段只审计“信号、边界、系统收益”，不再重复第 13–15 页算法。 |
| 17 | 执行瓶颈 | 通过；`up to 9h` 与秒级预判分开表述，保留“最终候选仍需执行”的口径。 |
| 18 | 偏好证据链 | 通过；`26 → 1,329 → 895 → 18,438` 与真实执行标签 provenance 同屏可读。 |
| 19 | 输入语义 | 通过；五组消融数字和“可信事实 → 对齐语义 → LLM 推理”关系明确。 |
| 20 | 信号存在 | 通过；`61.5%` 同时与随机、复杂度启发式和 GPT-5.1 对照，明确不是榜单分或裁判准确率。 |
| 21 | 局部能力边界 | 通过；Thinking、N=5 退化、Spearman 与置信度门控组成完整论证。 |
| 22 | Validation–Test Gap | 通过；“测试集真理”不再拆字，三种成本与强度不同的信号层级清楚。 |
| 23 | 证据推出控制策略 | 通过；三行证据直接推出 Pairwise、`c=.7`、`m=10 / k=1`，没有重复锦标赛演示。 |
| 24 | Agent 价值链 | **待修正文案并复拍**；当前页面仍显示 `+6pp`，论文 Table 13 实际为 `69.5% → 73.9%`，即绝对 `+4.4 pp`、相对约 `+6.3%`。`3.2×` 探索与 `6×` 收敛口径保持不变。 |
| 25 | 外推边界 | 通过；5 个任务、3 次运行、12 小时预算与四项限制分区完整。 |
| 26 | 受限接入契约 | 通过；推理平面与执行控制面权限清晰，真实 evaluator 保留最终裁决权。 |
| 27 | 四层创新 | 通过；四象限完整适配单页，已移除五组预设镜头。 |
| 28 | 总结与暑期规划转场 | 通过；结论句、四个关键词和 `NEXT / SUMMER PLAN` 完整。 |
| 29 | 优化 Auto Research 架构 | 通过；两级教师判断、深入研究、跟随新方向、保留平台与 Kaggle 实践形成完整决策图。 |
| 30 | 算法竞赛与时间安排 | 通过；暑假日程、7 月 29 日辽宁邀请赛、银奖目标和 8 月区域赛名额三分支同屏可读。 |
| 31 | 致谢 | 通过；复用放大的官网官方横向校标，新增 `THANK YOU FOR YOUR ATTENTION` 与邮箱，作为 End 最终页。 |

## 镜头与动画

| 页面 | 镜头数 | 结论 |
|---:|---:|---|
| 05 起点图 | 4 | 全图后按讲述顺序聚焦；保留王老师 idea、标准化评测和手搓 Loop。 |
| 06 Loop 图 | 2 | 全图 + 第一次放大，后续由讲者手动缩放/拖动。 |
| 07 Scheduler | 1 | 只保留完整全图，证据卡独立悬浮。 |
| 08–10 | 各 2 | 全图 + 唯一一次放大；第 09 页生命周期图首次放大为 3×，之后手动拖动；第 10 页是原生 AIDE。 |
| 12 ForeAgent | 2 | 全图 + 创新分支聚焦；进入页时黄色分支可重播，reducedMotion/export 直接最终态。 |

候选锦标赛第 13–15 页没有 `data-zoomable`，空格/右方向键直接翻页。
论文证据与系统收束第 16–28 页没有 `data-zoomable`，每页都是完整 PPT 构图。
暑期规划第 29–30 页同样没有 `data-zoomable`，两张流程图均以完整 PPT 页面直接翻页。

## 自动检查

- `node --check web_presentation_white/script.js`：通过。
- `node --check web_presentation_white/test-interactions.mjs`：通过。
- DOM 布局审计：`slideCount=31`、`status=pass`、`issues=[]`。
- CDP 交互回归：通过；覆盖新扉页字段、空格/右键顺序、AIDE 无 ForeAgent、ForeAgent 普通动画与 reducedMotion/export 最终态、滚轮缩放、手动拖动、三页锦标赛、重构后的第 16–28 页、两页暑期规划、致谢、总览、Home/End（31 → 1）。
- 批量渲染已完成 31 个 1600×900 全局页面和 15 个保留镜头状态；DOM 审计 `slideCount=31`、`status=pass`、`issues=[]`，无 CDN、Mermaid 或登录态依赖。

## 截图证据

- 31 页终版总览：[contact-sheet-31.png](../tmp/screenshots/paper_narrative_final_31/contact-sheet-31.png)
- 论文证据审计总图：[slide-16.png](../tmp/screenshots/paper_narrative_final_31/slide-16.png)
- 偏好证据链：[slide-18.png](../tmp/screenshots/paper_narrative_final_31/slide-18.png)
- 证据推出控制策略：[slide-23.png](../tmp/screenshots/paper_narrative_final_31/slide-23.png)
- 外推边界：[slide-25.png](../tmp/screenshots/paper_narrative_final_31/slide-25.png)
- 论文到项目的受限接入契约：[slide-26.png](../tmp/screenshots/paper_narrative_final_31/slide-26.png)
- AIDE 全图 / 唯一放大：[slide-10-camera-01.png](../tmp/screenshots/paper_narrative_final_31/cameras/slide-10-camera-01.png)、[slide-10-camera-02.png](../tmp/screenshots/paper_narrative_final_31/cameras/slide-10-camera-02.png)
- ForeAgent 最终全图 / 创新分支聚焦：[slide-12.png](../tmp/screenshots/paper_narrative_final_31/slide-12.png)、[slide-12-camera-02.png](../tmp/screenshots/paper_narrative_final_31/cameras/slide-12-camera-02.png)
- 三张候选锦标赛：[slide-13.png](../tmp/screenshots/paper_narrative_final_31/slide-13.png)、[slide-14.png](../tmp/screenshots/paper_narrative_final_31/slide-14.png)、[slide-15.png](../tmp/screenshots/paper_narrative_final_31/slide-15.png)
- Auto Research / 算法竞赛规划与致谢：[slide-29.png](../tmp/screenshots/paper_narrative_final_31/slide-29.png)、[slide-30.png](../tmp/screenshots/paper_narrative_final_31/slide-30.png)、[slide-31.png](../tmp/screenshots/paper_narrative_final_31/slide-31.png)

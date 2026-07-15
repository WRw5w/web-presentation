const port = Number(process.argv[2] || 9229);
const base = `http://127.0.0.1:${port}`;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForJson(path, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}${path}`);
      if (response.ok) return response.json();
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw new Error(`Chrome DevTools did not become ready: ${lastError || 'timeout'}`);
}

const pages = await waitForJson('/json/list');
const page = pages.find(item => item.type === 'page' && item.url.includes('web_presentation_white/index.html'));
if (!page) throw new Error('Presentation page was not found in Chrome DevTools targets.');

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 1;
const pending = new Map();
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(JSON.stringify(message.error)));
  else resolve(message.result);
});

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP command timed out: ${method}`));
    }, 3000);
    pending.set(id, {
      resolve: value => { clearTimeout(timer); resolve(value); },
      reject: error => { clearTimeout(timer); reject(error); }
    });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Evaluation failed';
    throw new Error(detail);
  }
  return result.result.value;
}

async function press(key, code = key) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
  await sleep(80);
}

async function drag(fromX, fromY, toX, toY) {
  await evaluate(`(() => {
    const surface = document.querySelector('.slide.active [data-zoomable]');
    const nativeCapture = surface.setPointerCapture;
    surface.setPointerCapture = () => {};
    const init = { bubbles: true, cancelable: true, pointerId: 41, pointerType: 'mouse', button: 0 };
    surface.dispatchEvent(new PointerEvent('pointerdown', { ...init, clientX: ${fromX}, clientY: ${fromY}, buttons: 1 }));
    surface.dispatchEvent(new PointerEvent('pointermove', { ...init, clientX: ${toX}, clientY: ${toY}, buttons: 1 }));
    surface.dispatchEvent(new PointerEvent('pointerup', { ...init, clientX: ${toX}, clientY: ${toY}, buttons: 0 }));
    surface.setPointerCapture = nativeCapture;
  })()`);
  await sleep(120);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await send('Runtime.enable');

let deckReady = false;
for (let attempt = 0; attempt < 50; attempt += 1) {
  deckReady = await evaluate(`document.documentElement?.dataset?.ready === 'true'`).catch(() => false);
  if (deckReady) break;
  await sleep(100);
}
assert(deckReady, 'Deck did not reach ready state within five seconds.');

const layoutAudit = await evaluate(`window.deckAudit()`);
assert(layoutAudit.slideCount === 31, `Layout audit expected 31 slides, got ${layoutAudit.slideCount}.`);
assert(layoutAudit.status === 'pass', `Layout audit failed: ${JSON.stringify(layoutAudit.issues)}.`);

const initial = await evaluate(`({
  slide: Number(document.getElementById('deck').dataset.currentSlide),
  badge: document.querySelector('.slide.active .camera-badge')?.textContent,
  overviewHidden: document.getElementById('overview').hidden,
  ready: document.documentElement.dataset.ready
})`);
assert(initial.ready === 'true', 'Deck did not reach ready state.');
assert(initial.slide === 6, `Expected slide 6, got ${initial.slide}.`);
assert(initial.badge?.startsWith('镜头 1/2'), `Expected camera 1/2, got ${initial.badge}.`);

const nativeDragGuard = await evaluate(`(() => {
  const surface = document.querySelector('.slide.active [data-zoomable]');
  const images = [...surface.querySelectorAll('.diagram-world img')];
  const event = new DragEvent('dragstart', { bubbles: true, cancelable: true });
  const dispatchAllowed = images[0]?.dispatchEvent(event);
  return {
    allImagesNotDraggable: images.length > 0 && images.every(img => img.draggable === false),
    dragStartPrevented: dispatchAllowed === false && event.defaultPrevented
  };
})()`);
assert(nativeDragGuard.allImagesNotDraggable, 'Every image in the zoom world should disable native browser dragging.');
assert(nativeDragGuard.dragStartPrevented, 'The zoom surface should prevent native dragstart events.');

await press(' ', 'Space');
const afterSpace = await evaluate(`({
  slide: Number(document.getElementById('deck').dataset.currentSlide),
  badge: document.querySelector('.slide.active .camera-badge')?.textContent
})`);
assert(afterSpace.slide === 6, 'Space should advance the camera before changing slides.');
assert(afterSpace.badge?.startsWith('镜头 2/2'), `Expected camera 2/2, got ${afterSpace.badge}.`);

const loopTransformBeforeDrag = await evaluate(`document.querySelector('.slide.active .diagram-world')?.style.transform`);
await drag(630, 450, 700, 500);
const loopDrag = await evaluate(`({
  badge: document.querySelector('.slide.active .camera-badge')?.textContent,
  transform: document.querySelector('.slide.active .diagram-world')?.style.transform
})`);
assert(loopDrag.badge?.startsWith('自由镜头'), `Dragging from the SVG should enable free camera, got ${loopDrag.badge}.`);
assert(loopDrag.transform !== loopTransformBeforeDrag, 'Dragging from the SVG image should move the diagram world.');

await press('Escape', 'Escape');
const afterEscape = await evaluate(`document.querySelector('.slide.active .camera-badge')?.textContent`);
assert(afterEscape?.startsWith('镜头 1/2'), 'Escape should reset the active zoom flow to its first camera.');

await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 720, y: 450, deltaX: 0, deltaY: -180 });
await sleep(120);
const afterWheel = await evaluate(`document.querySelector('.slide.active .camera-badge')?.textContent`);
assert(afterWheel?.startsWith('自由镜头'), `Wheel should enable free zoom, got ${afterWheel}.`);
await press('r', 'KeyR');
assert((await evaluate(`document.querySelector('.slide.active .camera-badge')?.textContent`))?.startsWith('镜头 1/2'), 'R should restore the preset camera.');

await press(' ', 'Space');
await press(' ', 'Space');
const scheduler = await evaluate(`({
  slide: Number(document.getElementById('deck').dataset.currentSlide),
  badge: document.querySelector('.slide.active .camera-badge')?.textContent
})`);
assert(scheduler.slide === 7, `Expected slide 7 after Loop cameras, got ${scheduler.slide}.`);
assert(scheduler.badge?.startsWith('镜头 1/1'), `Scheduler should expose only its full view, got ${scheduler.badge}.`);

const schedulerTransformBeforeDrag = await evaluate(`document.querySelector('.slide.active .diagram-world')?.style.transform`);
await drag(1180, 500, 1240, 540);
const schedulerDrag = await evaluate(`({
  badge: document.querySelector('.slide.active .camera-badge')?.textContent,
  transform: document.querySelector('.slide.active .diagram-world')?.style.transform
})`);
assert(schedulerDrag.badge?.startsWith('自由镜头'), `Dragging over the evidence area should enable free camera, got ${schedulerDrag.badge}.`);
assert(schedulerDrag.transform !== schedulerTransformBeforeDrag, 'Dragging over the evidence area should move the diagram world.');
await press('r', 'KeyR');

await press(' ', 'Space');
const architecture = await evaluate(`({
  slide: Number(document.getElementById('deck').dataset.currentSlide),
  badge: document.querySelector('.slide.active .camera-badge')?.textContent,
  floating: Boolean(document.querySelector('.slide.active [data-zoomable] > .floating-evidence')),
  nested: Boolean(document.querySelector('.slide.active .diagram-world .floating-evidence'))
})`);
assert(architecture.slide === 8, `Expected slide 8 after Scheduler, got ${architecture.slide}.`);
assert(architecture.badge?.startsWith('镜头 1/2'), `Architecture should expose camera 1/2, got ${architecture.badge}.`);
assert(!architecture.floating && !architecture.nested, 'Architecture evidence should be removed from this slide.');
await press(' ', 'Space');
assert((await evaluate(`document.querySelector('.slide.active .camera-badge')?.textContent`))?.startsWith('镜头 2/2'), 'Architecture should have one preset zoom.');

await press(' ', 'Space');
const lifecycle = await evaluate(`({
  slide: Number(document.getElementById('deck').dataset.currentSlide),
  badge: document.querySelector('.slide.active .camera-badge')?.textContent
})`);
assert(lifecycle.slide === 9, `Expected slide 9 after Architecture, got ${lifecycle.slide}.`);
assert(lifecycle.badge?.startsWith('镜头 1/2'), `Lifecycle should expose camera 1/2, got ${lifecycle.badge}.`);
await press(' ', 'Space');
assert((await evaluate(`document.querySelector('.slide.active .camera-badge')?.textContent`))?.startsWith('镜头 2/2'), 'Lifecycle should have one preset zoom.');

await press(' ', 'Space');
const aide = await evaluate(`({
  slide: Number(document.getElementById('deck').dataset.currentSlide),
  badge: document.querySelector('.slide.active .camera-badge')?.textContent,
  hasForeAgent: document.querySelector('.slide.active .foreagent-node') !== null,
  text: document.querySelector('.slide.active .aide-world')?.textContent || ''
})`);
assert(aide.slide === 10, `Expected slide 10 after Lifecycle, got ${aide.slide}.`);
assert(aide.badge?.startsWith('镜头 1/2'), `AIDE should expose camera 1/2, got ${aide.badge}.`);
assert(!aide.hasForeAgent && !/ForeAgent|Predict-then-Verify/i.test(aide.text), 'Native AIDE page must not reveal ForeAgent early.');
await press(' ', 'Space');
assert((await evaluate(`document.querySelector('.slide.active .camera-badge')?.textContent`))?.startsWith('镜头 2/2'), 'AIDE should have one preset zoom.');

await press(' ', 'Space');
assert(await evaluate(`Number(document.getElementById('deck').dataset.currentSlide)`) === 11, 'AIDE should then advance to the contradiction page.');
await press(' ', 'Space');
const foreagent = await evaluate(`({
  slide: Number(document.getElementById('deck').dataset.currentSlide),
  hasBranch: document.querySelector('.slide.active [data-foreagent] .fore-branch') !== null,
  hasNode: document.querySelector('.slide.active .foreagent-node') !== null,
  ready: document.querySelector('.slide.active [data-foreagent]')?.classList.contains('foreagent-ready')
})`);
assert(foreagent.slide === 12, `Expected slide 12 for ForeAgent increment, got ${foreagent.slide}.`);
assert(foreagent.hasBranch && foreagent.hasNode, 'ForeAgent page should reuse the AIDE graph and add a branch/node.');
await sleep(1300);
assert(await evaluate(`document.querySelector('.slide.active [data-foreagent]')?.classList.contains('foreagent-ready')`), 'ForeAgent animation should reach final state.');
await press(' ', 'Space');
assert((await evaluate(`document.querySelector('.slide.active .camera-badge')?.textContent`))?.startsWith('镜头 2/2'), 'ForeAgent should expose one innovation focus camera.');
await press(' ', 'Space');

const tournamentGeneration = await evaluate(`({
  slide: Number(document.getElementById('deck').dataset.currentSlide),
  title: document.querySelector('.slide.active h2')?.textContent,
  candidates: document.querySelectorAll('.slide.active .large-candidate-cloud .candidate-dots i').length,
  zoomable: Boolean(document.querySelector('.slide.active [data-zoomable]'))
})`);
assert(tournamentGeneration.slide === 13, `Expected slide 13 generation page, got ${tournamentGeneration.slide}.`);
assert(tournamentGeneration.candidates === 10, 'Generation page should show exactly ten candidates.');
assert(!tournamentGeneration.zoomable, 'Tournament pages should be complete PPT pages without camera panning.');
await press(' ', 'Space');
const tournamentPairwise = await evaluate(`({
  slide: Number(document.getElementById('deck').dataset.currentSlide),
  title: document.querySelector('.slide.active h2')?.textContent,
  matches: document.querySelectorAll('.slide.active .match-stack .match').length,
  ranking: Boolean(document.querySelector('.slide.active .ranking-board'))
})`);
assert(tournamentPairwise.slide === 14, `Expected slide 14 pairwise page, got ${tournamentPairwise.slide}.`);
assert(tournamentPairwise.matches === 3 && tournamentPairwise.ranking, 'Pairwise page should show comparisons and an auditable ranking.');
await press(' ', 'Space');
const tournamentVerify = await evaluate(`({
  slide: Number(document.getElementById('deck').dataset.currentSlide),
  title: document.querySelector('.slide.active h2')?.textContent,
  cards: document.querySelectorAll('.slide.active .verify-card').length,
  boundary: document.querySelector('.slide.active .verify-boundary')?.textContent
})`);
assert(tournamentVerify.slide === 15, `Expected slide 15 verify page, got ${tournamentVerify.slide}.`);
assert(tournamentVerify.cards === 3 && /真实 evaluator/.test(tournamentVerify.boundary), 'Verify page should separate Top-1, real execution and Journal.');

const expectedPaperTitles = [
  '算法已经讲完；现在审计它是否值得相信',
  '最贵的不是提出方案，而是证明方案有效',
  '预测能力不是靠自评，而是由真实执行轨迹标注',
  '它判断的是方案与数据是否匹配',
  '61.5% 不是裁判准确率，而是低成本排序信号',
  '它适合 Pairwise，不适合一次排完整个榜',
  '真实执行更强，但 validation 仍不等于测试集真理',
  '所以方法只能是 Predict-then-Verify',
  '价值链不是省一次训练，而是把预算换成更宽探索',
  '结果有价值，但证据覆盖仍然有限',
  'ForeAgent 只拥有预算分配权，不拥有最终裁决权',
  'ForeAgent 只补最后一块；系统贡献来自四层闭环',
  '证据驱动的机器学习实验系统'
];
const paperSequence = [];
for (let index = 0; index < expectedPaperTitles.length; index += 1) {
  if (index === 0) await press(' ', 'Space');
  else await press('ArrowRight', 'ArrowRight');
  const state = await evaluate(`({
    slide: Number(document.getElementById('deck').dataset.currentSlide),
    title: document.querySelector('.slide.active')?.dataset.title,
    zoomable: Boolean(document.querySelector('.slide.active [data-zoomable]'))
  })`);
  assert(state.slide === 16 + index, `Paper sequence expected slide ${16 + index}, got ${state.slide}.`);
  assert(state.title === expectedPaperTitles[index], `Paper sequence title mismatch on slide ${16 + index}: ${state.title}.`);
  assert(!state.zoomable, `Paper/system slide ${16 + index} should advance as a complete PPT page without camera presets.`);
  paperSequence.push(state);
}

const paperEvidence = await evaluate(`(() => {
  const slides = [...document.querySelectorAll('.slide')];
  return {
    auditImage: slides[15].querySelector('.audit-map-frame img')?.getAttribute('src'),
    evidenceImage: slides[17].querySelector('.evidence-chain-frame img')?.getAttribute('src'),
    designRows: slides[22].querySelectorAll('.design-proof-row').length,
    resultCards: slides[23].querySelectorAll('.result-triptych article').length,
    limitRows: slides[24].querySelectorAll('.limit-list article').length,
    contractImage: slides[25].querySelector('.contract-map-frame img')?.getAttribute('src'),
    innovationCards: slides[26].querySelectorAll('.innovation-card').length,
    hasSummerBridge: Boolean(slides[27].querySelector('.conclusion-next')),
    zoomables: slides.slice(15, 28).filter(slide => slide.querySelector('[data-zoomable]')).length
  };
})()`);
assert(paperEvidence.auditImage === 'assets/flows/07-paper-audit-map.svg', `Paper audit image mismatch: ${paperEvidence.auditImage}.`);
assert(paperEvidence.evidenceImage === 'assets/flows/08-preference-evidence-chain.svg', `Preference evidence image mismatch: ${paperEvidence.evidenceImage}.`);
assert(paperEvidence.designRows === 3, `Evidence-derived design should show three proof rows, got ${paperEvidence.designRows}.`);
assert(paperEvidence.resultCards === 3, `System value slide should show three distinct outcomes, got ${paperEvidence.resultCards}.`);
assert(paperEvidence.limitRows === 4, `External-validity slide should show four limits, got ${paperEvidence.limitRows}.`);
assert(paperEvidence.contractImage === 'assets/flows/09-paper-to-system-contract.svg', `Integration contract image mismatch: ${paperEvidence.contractImage}.`);
assert(paperEvidence.innovationCards === 4, `Innovation synthesis should show four layers, got ${paperEvidence.innovationCards}.`);
assert(paperEvidence.hasSummerBridge, 'Conclusion should bridge into the summer plan.');
assert(paperEvidence.zoomables === 0, `Slides 16–28 should not add camera panning, found ${paperEvidence.zoomables} zoomable surfaces.`);

await press('o', 'KeyO');
assert(await evaluate(`document.getElementById('overview').hidden`) === false, 'O should open slide overview.');
await press('Escape', 'Escape');
assert(await evaluate(`document.getElementById('overview').hidden`) === true, 'Escape should close slide overview.');

const summerPlan = await evaluate(`(() => {
  const slides = [...document.querySelectorAll('.slide')];
  const research = slides[28];
  const competition = slides[29];
  return {
    researchTitle: research.querySelector('h2')?.textContent,
    researchNodes: research.querySelectorAll('.summer-node').length,
    researchZoomable: Boolean(research.querySelector('[data-zoomable]')),
    competitionTitle: competition.querySelector('h2')?.textContent,
    quotaOptions: competition.querySelectorAll('.quota-options > div').length,
    competitionZoomable: Boolean(competition.querySelector('[data-zoomable]'))
  };
})()`);
assert(summerPlan.researchNodes === 7, `Research plan should show seven decision nodes, got ${summerPlan.researchNodes}.`);
assert(!summerPlan.researchZoomable && !summerPlan.competitionZoomable, 'Summer plan pages should be complete PPT pages without camera panning.');
assert(summerPlan.quotaOptions === 3, `Competition plan should show three quota outcomes, got ${summerPlan.quotaOptions}.`);

await press('End', 'End');
const acknowledgements = await evaluate(`({
  slide: Number(document.getElementById('deck').dataset.currentSlide),
  title: document.querySelector('.slide.active .thanks-center h1')?.textContent,
  english: document.querySelector('.slide.active .thanks-title-en')?.textContent,
  teacher: document.querySelector('.slide.active .thanks-subtitle')?.textContent,
  email: document.querySelector('.slide.active .thanks-email')?.textContent,
  logo: document.querySelector('.slide.active .swpu-official-logo')?.getAttribute('src')
})`);
assert(acknowledgements.slide === 31, `End should jump to slide 31, got ${acknowledgements.slide}.`);
assert(acknowledgements.title === '感谢聆听', `Acknowledgements title mismatch: ${acknowledgements.title}.`);
assert(acknowledgements.english === 'THANK YOU FOR YOUR ATTENTION', `Acknowledgements English title mismatch: ${acknowledgements.english}.`);
assert(/王志文/.test(acknowledgements.teacher || ''), 'Acknowledgements should thank 王志文老师.');
assert(acknowledgements.email === '3183879036@qq.com', `Acknowledgements email mismatch: ${acknowledgements.email}.`);
assert(acknowledgements.logo === 'assets/swpu-official-logo.png', `Acknowledgements official logo mismatch: ${acknowledgements.logo}.`);
await press('Home', 'Home');
assert(await evaluate(`Number(document.getElementById('deck').dataset.currentSlide)`) === 1, 'Home should jump to slide 1.');
const homeCover = await evaluate(`({
  slideCount: document.querySelectorAll('.slide').length,
  school: document.querySelector('.slide.active .swpu-official-logo')?.alt,
  logo: document.querySelector('.slide.active .swpu-official-logo')?.getAttribute('src'),
  english: document.querySelector('.slide.active .institution-title-en')?.textContent,
  teacher: [...document.querySelectorAll('.slide.active .institution-details div')]
    .find(item => item.querySelector('span')?.textContent === '指导教师')
    ?.querySelector('strong')?.textContent,
  email: document.querySelector('.slide.active .institution-email strong')?.textContent,
  title: document.querySelector('.slide.active .institution-title-block h1')?.textContent
})`);
assert(homeCover.slideCount === 31, `Expected 31 slides, got ${homeCover.slideCount}.`);
assert(homeCover.school === '西南石油大学官方校标', `Institution cover school mismatch: ${homeCover.school}.`);
assert(homeCover.logo === 'assets/swpu-official-logo.png', `Institution cover official logo mismatch: ${homeCover.logo}.`);
assert(/Pre-Execution Prediction/.test(homeCover.english || ''), `Institution cover English title mismatch: ${homeCover.english}.`);
assert(homeCover.teacher === '王志文', `Institution cover teacher mismatch: ${homeCover.teacher}.`);
assert(homeCover.email === '3183879036@qq.com', `Institution cover email mismatch: ${homeCover.email}.`);
assert(/从自动刷榜.*到.*执行前预测/.test(homeCover.title || ''), `Institution cover title mismatch: ${homeCover.title}.`);

const reducedMotionUrl = await evaluate(`(() => {
  const url = new URL(location.href);
  url.search = '?slide=12&camera=1&reducedMotion=1&export=1&noHistory=1&rev=reduced-motion-regression';
  return url.href;
})()`);
await send('Page.enable');
await send('Page.navigate', { url: reducedMotionUrl });
let reducedReady = false;
for (let attempt = 0; attempt < 50; attempt += 1) {
  reducedReady = await evaluate(`document.documentElement?.dataset?.ready === 'true'`).catch(() => false);
  if (reducedReady) break;
  await sleep(100);
}
const reducedForeagent = await evaluate(`({
  slide: Number(document.getElementById('deck').dataset.currentSlide),
  ready: document.querySelector('.slide.active [data-foreagent]')?.classList.contains('foreagent-ready'),
  reducedMotion: document.documentElement.dataset.reducedMotion,
  exportMode: document.documentElement.dataset.export
})`);
assert(reducedReady && reducedForeagent.slide === 12, 'Reduced-motion export should open directly on ForeAgent slide 12.');
assert(reducedForeagent.ready, 'Reduced-motion/export mode should show the final ForeAgent highlight state immediately.');
assert(reducedForeagent.reducedMotion === 'true' && reducedForeagent.exportMode === 'true', 'Reduced-motion/export flags should be active.');

const summary = {
  status: 'pass',
  slideCount: 31,
  layoutAudit,
  initial,
  nativeDragGuard,
  loopDrag,
  schedulerDrag,
  aide,
  foreagent,
  tournamentGeneration,
  tournamentPairwise,
  tournamentVerify,
  paperSequence,
  paperEvidence,
  summerPlan,
  acknowledgements,
  homeCover,
  reducedForeagent,
  overview: 'open-close pass',
  endHome: '31 -> 1 pass'
};
console.log(JSON.stringify(summary));

await send('Browser.close').catch(() => {});
socket.close();

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ═════════ AI 직원 프로필 (상태·기록은 Neon DB에서 온다) ═════════
// agent가 있는 직원은 실제 Claude Code 에이전트(.claude/agents), isNew는 구상 단계 직원
const NEW_QA = { q: '아직 실제로 일하나요?', a: '아직은 구상 단계 직원이에요. 품질팀 3명처럼 Claude Code 에이전트로 만들면 실제 데이터를 받아 일할 수 있어요.' };
const STAFF = [
  {
    id: 'quality', name: '품질분석가', team: '품질팀', floor: 3, x: -5.2, agent: 'quality-analyst', color: '#3b82f6', hair: '#2b2118',
    summary: '“무엇이 얼마나 발생했는가”를 숫자로만 정리해요. 원인은 원인분석가에게 넘겨요.',
    tasks: ['불량코드별 발생건수·불량률 집계', '파레토 분석 (누적 80% 핵심불량 ★)', '등급별 분포 (치명·중대·경미)', '라인·금형·교대조 교차분석', '이상치 탐지'],
    input: '생산일지, 불량발생대장, 불량코드표', output: '집계표 · 파레토 · TOP5 · 이상치 목록',
    links: ['cause', 'cost'],
    qa: [
      { q: '어떤 데이터를 주면 돼요?', a: '생산일지와 불량발생대장(Excel 또는 CSV)을 주시면 돼요. 불량코드표도 있으면 등급과 4M 정의를 대조해서 더 정확하게 정리해요.' },
      { q: '파레토 분석이 뭐예요?', a: '불량코드를 많이 발생한 순서로 줄 세우고, 누적 80%까지를 핵심불량(★)으로 표시해요. 몇 가지 불량이 전체의 대부분을 차지하는지 한눈에 보여요.' },
      { q: '원인도 알려 줘요?', a: '원인은 제 담당이 아니에요. 저는 숫자만 정리하고, “왜 그런지”는 원인분석가에게 TOP5와 이상치를 넘겨서 맡겨요.' }
    ]
  },
  {
    id: 'cause', name: '원인분석가', team: '품질팀', floor: 3, x: -2.0, agent: 'cause-analyst', color: '#8b5cf6', hair: '#121212',
    summary: '“왜 발생했는가”를 4M 틀로 구조화하고, 5Why로 근본원인까지 파고들어요.',
    tasks: ['핵심불량·이상치를 4M(사람·설비·재료·방법)에 매핑', '5Why로 근본원인 추적', '특성요인도 정리', '근본원인 확신도(상·중·하) 표시', '단기·중장기 개선방안 제시'],
    input: '품질분석가의 집계·TOP5·이상치, 불량코드표', output: '4M 매트릭스 · 확신도 · 개선방안',
    links: ['quality', 'reporter'],
    qa: [
      { q: '4M이 뭐예요?', a: '사람(Man)·설비(Machine)·재료(Material)·방법(Method) 네 가지예요. 예를 들어 특정 교대조에 불량이 몰리면 사람, 캐비티마다 편차가 크면 설비 쪽부터 살펴봐요.' },
      { q: '확신도는 왜 표시해요?', a: '데이터로 확인된 원인과 아직 가설인 원인을 구분하려고요. “상”은 데이터로 뒷받침된 원인, “하”는 추가 확인이 필요한 가설이라는 뜻이에요.' },
      { q: '개선방안도 주나요?', a: '네. 바로 할 수 있는 단기 조치와 설비·공정 변경 같은 중장기 대책을 나눠서 드려요.' }
    ]
  },
  {
    id: 'reporter', name: '보고서작성자', team: '품질팀', floor: 3, x: 1.2, agent: 'quality-reporter', color: '#14b8a6', hair: '#3a2a1c',
    summary: '두 분석가의 결과를 한국몰드 표준 양식의 경영진 보고서로 편집해요.',
    tasks: ['분석 결과 취합 · 수치 일치 확인', '표준 양식(표지·목차·요약·현황·분석·원인·개선방안·기대효과) 구성', 'Word(.docx) 또는 PowerPoint(.pptx) 문서 생성'],
    input: '품질분석가 집계, 원인분석가 4M 결과', output: '품질이슈분석보고서 (.docx / .pptx)',
    links: ['quality', 'cause'],
    qa: [
      { q: '보고서는 어떤 순서로 만들어요?', a: '표지 → 목차 → 요약 → 현황 → 분석 → 원인 → 개선방안 → 기대효과 순서예요. 한국몰드 표준 양식 그대로 맞춰요.' },
      { q: '새로 분석도 해 줘요?', a: '아니요, 저는 편집만 해요. 숫자와 판단은 두 분석가가 낸 그대로 옮기고, 서로 맞지 않는 수치가 있으면 표시해 둬요.' },
      { q: '파일은 어떤 형식이에요?', a: '기본은 Word(.docx)예요. 발표용이 필요하면 PowerPoint(.pptx)로도 만들어요.' }
    ]
  },
  {
    id: 'production', name: '생산관리 담당', team: '원가팀', floor: 2, x: -5.2, isNew: true, color: '#22c55e', hair: '#1c1c1c',
    summary: '생산계획 대비 실적과 설비 가동 현황을 챙겨요. 원가 계산의 기초 데이터를 만들어요.',
    tasks: ['생산계획 대비 실적 집계', '공정·설비별 가동률', '납기 준수율 관리', '월간 생산관리 보고서 작성'],
    input: '생산계획, 생산일지, 설비 가동 기록', output: '실적표 · 가동률 · 월간 생산 보고서',
    links: ['cost'],
    qa: [
      { q: '가동률은 어떻게 봐요?', a: '설비가 돌 수 있었던 시간 중 실제로 생산한 시간의 비율이에요. 금형 교체·고장·대기 시간을 나눠서 어디서 시간이 새는지 보여 드려요.' },
      { q: '원가팀이랑 무슨 관계예요?', a: '제가 정리한 실적과 가동 시간이 원가분석가의 가공비 계산 기초가 돼요. 가동률이 떨어지면 개당 원가가 올라가요.' },
      NEW_QA
    ]
  },
  {
    id: 'cost', name: '원가분석가', team: '원가팀', floor: 2, x: -2.0, isNew: true, color: '#f59e0b', hair: '#2b2118',
    summary: '제품 하나를 만드는 데 실제로 얼마가 드는지 계산하고, 어디서 비용이 새는지 찾아요.',
    tasks: ['제품별 원가 산출 (재료비·가공비·금형상각비·경비)', '표준원가 대비 실제원가 차이 분석', '불량 손실비용 환산', '원가 절감 포인트 정리'],
    input: '생산 실적, 수지 단가표, 설비 시간당 가공비, 불량 집계', output: '제품별 원가표 · 원가차이 분석',
    links: ['production', 'quality', 'quote'],
    qa: [
      { q: '원가는 어떻게 계산해요?', a: '재료비(수지 사용량 × 단가, 스크랩 포함) + 가공비(사이클타임 × 설비 시간당 가공비) + 금형상각비 + 경비를 더해요. 그다음 표준원가와 비교해서 차이가 큰 항목을 찾아요.' },
      { q: '불량이 원가에 얼마나 영향을 줘요?', a: '품질분석가가 집계한 불량 수량에 개당 원가를 곱해서 손실 금액으로 바꿔 드려요. 어떤 불량부터 잡아야 비용이 가장 많이 줄어드는지 보여요.' },
      NEW_QA
    ]
  },
  {
    id: 'quote', name: '견적담당', team: '원가팀', floor: 2, x: 1.2, isNew: true, color: '#ef4444', hair: '#121212',
    summary: '신규 사출품과 금형의 견적 단가를 근거 있게 산출해요.',
    tasks: ['신규 사출품 견적 단가 산출', '금형비 견적', '수지 단가 변동 시 견적 갱신', '견적 대비 실제원가 비교'],
    input: '도면·사양, 원가분석가의 원가표, 수지 단가', output: '견적서 · 견적 근거표',
    links: ['cost'],
    qa: [
      { q: '견적은 어떻게 내요?', a: '예상 사이클타임·캐비티 수·수지 사용량으로 개당 원가를 추정하고, 금형비와 관리비·이익을 더해 단가를 정해요.' },
      { q: '견적이 실제와 맞는지 확인해요?', a: '네. 양산이 시작되면 원가분석가의 실제원가와 견적을 비교하고, 차이가 큰 항목은 다음 견적에 반영해요.' },
      NEW_QA
    ]
  }
];
const FLOORS = [
  { n: 3, name: '3F 품질팀', en: 'QUALITY TEAM', color: '#3b82f6' },
  { n: 2, name: '2F 원가팀', en: 'COST TEAM', color: '#f59e0b' },
  { n: 1, name: '1F 로비·회의실', en: 'LOBBY · MEETING', color: '#ec4899' }
];
const byId = Object.fromEntries(STAFF.map(s => [s.id, s]));

// ═════════ 치수 ═════════
const W = 16, D = 10, FLOOR_H = 4.6, SLAB = 0.35, WALL_H = FLOOR_H - SLAB - 0.05, SEAT_Z = -1.6;
const floorY = n => (n - 1) * FLOOR_H;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ═════════ 렌더러 ═════════
const $ = id => document.getElementById(id);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch (e) {
  $('loading').textContent = '이 브라우저에서는 3D 화면을 표시할 수 없어요. (WebGL 미지원)';
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
$('scene').appendChild(renderer.domElement);
const labelRenderer = new CSS2DRenderer({ element: $('labels') });

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060a18);
scene.fog = new THREE.Fog(0x050914, 55, 110);
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 300);
const VIEW_ALL = { pos: new THREE.Vector3(25, 20, 31), target: new THREE.Vector3(0, 6.4, 0) };
camera.position.copy(VIEW_ALL.pos);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(VIEW_ALL.target);
controls.enableDamping = true;
controls.maxPolarAngle = 1.45;
controls.minDistance = 5;
controls.maxDistance = 75;
controls.autoRotateSpeed = 0.6;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.8, 0.55, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ═════════ 조명 ═════════
scene.add(new THREE.AmbientLight(0x8090c0, 0.5));
scene.add(new THREE.HemisphereLight(0xd3ddff, 0x0c1228, 1.0));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(12, 30, 18);
scene.add(sun);

// ═════════ 재료 · 도우미 ═════════
function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const neon = (hex, k = 2.4) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), toneMapped: false });
const M = {
  slab: new THREE.MeshStandardMaterial({ color: 0x0e1530, roughness: 0.5, metalness: 0.4 }),
  white: new THREE.MeshStandardMaterial({ color: 0xe9eef7, roughness: 0.35, metalness: 0.05 }),
  chair: new THREE.MeshStandardMaterial({ color: 0x2a3456, roughness: 0.6 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x1a2036, roughness: 0.5, metalness: 0.3 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x8a94b4, roughness: 0.3, metalness: 0.8 }),
  pot: new THREE.MeshStandardMaterial({ color: 0xdfe5ee, roughness: 0.5 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x2f9e6a, roughness: 0.7 }),
  skin: new THREE.MeshStandardMaterial({ color: 0xf1c9a1, roughness: 0.8 }),
  eye: new THREE.MeshStandardMaterial({ color: 0x15151a })
};

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const redraw = (...args) => { g.clearRect(0, 0, w, h); draw(g, w, h, ...args); tex.needsUpdate = true; };
  redraw();
  // 웹폰트가 늦게 도착하면 글자를 다시 그린다
  document.fonts?.ready.then(() => redraw());
  return { tex, redraw };
}
const FONT = '"Noto Sans KR", "Malgun Gothic", sans-serif';

function add(mesh, parent, x = 0, y = 0, z = 0) {
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}
const box = (w, h, d, mat, parent, x, y, z) => add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), parent, x, y, z);
const cyl = (rt, rb, h, mat, parent, x, y, z, seg = 24) => add(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat), parent, x, y, z);
function plane(w, h, mat, parent, x, y, z, ry = 0) {
  const m = add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat), parent, x, y, z);
  m.rotation.y = ry;
  return m;
}
function el(tag, cls, html = '') {
  const d = document.createElement(tag);
  if (cls) d.className = cls;
  d.innerHTML = html;
  return d;
}
const labelsByFloor = { 1: [], 2: [], 3: [] };
function label(node, floor, parent, x, y, z) {
  const o = new CSS2DObject(node);
  add(o, parent, x, y, z);
  labelsByFloor[floor].push(o);
  return o;
}
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ═════════ 바닥 무대 ═════════
{
  const glow = canvasTex(512, 512, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(70,100,255,.55)');
    grd.addColorStop(0.45, 'rgba(60,80,220,.18)');
    grd.addColorStop(1, 'rgba(40,60,200,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });
  const disc = plane(48, 48, new THREE.MeshBasicMaterial({ map: glow.tex, transparent: true, depthWrite: false }), scene, 0, -0.6, 0);
  disc.rotation.x = -Math.PI / 2;
  for (const [r, k] of [[13.5, 1.6], [17, 0.8]]) {
    const ring = add(new THREE.Mesh(new THREE.RingGeometry(r, r + 0.06, 128), neon(0x4f6bff, k)), scene, 0, -0.55, 0);
    ring.rotation.x = -Math.PI / 2;
  }
}

// ═════════ 층 만들기 ═════════
const tileTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#1b2448'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(150,175,255,.13)'; g.lineWidth = 2;
  g.strokeRect(1, 1, w - 2, h - 2);
}).tex;
tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;
tileTex.repeat.set(8, 5);
const floorMat = new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.32, metalness: 0.25 });

function cityTex(seed) {
  const r = rng(seed);
  return canvasTex(1024, 270, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#0a1233'); grd.addColorStop(1, '#101c4a');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (let x = 6; x < w; x += 15) {
      const tall = 60 + r() * 200;
      for (let y = h - 8; y > h - tall; y -= 13) {
        const p = r();
        g.fillStyle = p < 0.12 ? 'rgba(255,226,150,.85)' : p < 0.3 ? 'rgba(150,190,255,.55)' : 'rgba(40,60,130,.55)';
        g.fillRect(x, y, 8, 7);
      }
    }
    g.fillStyle = 'rgba(120,150,255,.35)';
    for (let x = 0; x < w; x += 128) g.fillRect(x, 0, 3, h); // 창틀
  }).tex;
}

function sign(text, sub, color, wpx = 1024, hpx = 200) {
  return canvasTex(wpx, hpx, (g, w, h) => {
    g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 24;
    g.fillStyle = '#ffffff';
    g.font = `700 ${Math.round(h * 0.42)}px ${FONT}`;
    g.fillText(text, 20, sub ? h * 0.36 : h / 2);
    if (sub) {
      g.shadowBlur = 0; g.fillStyle = color;
      g.font = `500 ${Math.round(h * 0.2)}px ${FONT}`;
      g.fillText(sub, 24, h * 0.8);
    }
  }).tex;
}

const floors = {};
const occluders = []; // 이름표가 바닥판 뒤에 가려졌는지 확인할 때 쓴다
for (const f of FLOORS) {
  const g = new THREE.Group();
  g.position.y = floorY(f.n);
  scene.add(g);
  floors[f.n] = g;

  occluders.push(box(W, SLAB, D, M.slab, g, 0, -SLAB / 2, 0));
  const top = plane(W, D, floorMat, g, 0, 0.002, 0);
  top.rotation.x = -Math.PI / 2;

  // 벽: 뒤·왼쪽은 도시 야경이 비치는 유리
  plane(W, WALL_H, new THREE.MeshBasicMaterial({ map: cityTex(f.n * 7) }), g, 0, WALL_H / 2, -D / 2);
  plane(D, WALL_H, new THREE.MeshBasicMaterial({ map: cityTex(f.n * 13) }), g, -W / 2, WALL_H / 2, 0, Math.PI / 2);

  // 네온 테두리
  const nm = neon(f.color, 2.6);
  const t = 0.07;
  for (const y of [0.01, -SLAB]) {
    box(W, t, t, nm, g, 0, y, D / 2);
    box(t, t, D, nm, g, W / 2, y, 0);
  }
  box(W, t, t, nm, g, 0, -SLAB, -D / 2);
  box(t, t, D, nm, g, -W / 2, -SLAB, 0);
  box(W, t, t, neon(0x4f6bff, 1.6), g, 0, WALL_H, -D / 2 + 0.02);
  box(t, t, D, neon(0x4f6bff, 1.6), g, -W / 2 + 0.02, WALL_H, 0);
  // 기둥
  for (const [px, pz] of [[W / 2, D / 2], [-W / 2, D / 2], [W / 2, -D / 2]]) {
    box(0.16, FLOOR_H - SLAB, 0.16, M.dark, g, px, (FLOOR_H - SLAB) / 2, pz);
    box(0.05, FLOOR_H - SLAB, 0.05, neon(0x6d8bff, 1.4), g, px - Math.sign(px) * 0.1, (FLOOR_H - SLAB) / 2, pz - Math.sign(pz) * 0.1);
  }

  // 층 간판
  const sgn = plane(3.6, 0.7, new THREE.MeshBasicMaterial({ map: sign(f.name, f.en, f.color), transparent: true, toneMapped: false }), g, -5.6, 3.55, -D / 2 + 0.03);
  sgn.material.color.multiplyScalar(1.4);
  label(el('div', 'floor-tag', `<span>${f.name}</span>`), f.n, g, -W / 2 + 1.4, 0.3, D / 2 + 0.2).element.style.color = f.color;
}

function plant(parent, x, z, s = 1) {
  cyl(0.3 * s, 0.24 * s, 0.55 * s, M.pot, parent, x, 0.275 * s, z);
  const r = rng(Math.round((x + 20) * 100 + z * 7));
  for (let i = 0; i < 5; i++) {
    const leaf = add(new THREE.Mesh(new THREE.ConeGeometry(0.16 * s, 1.0 * s, 5), M.leaf), parent,
      x + (r() - 0.5) * 0.3 * s, 0.95 * s + r() * 0.3 * s, z + (r() - 0.5) * 0.3 * s);
    leaf.rotation.set((r() - 0.5) * 0.9, r() * 3, (r() - 0.5) * 0.9);
  }
}
function chair(parent, x, z, ry = 0) {
  const c = new THREE.Group();
  add(c, parent, x, 0, z);
  c.rotation.y = ry;
  box(0.55, 0.08, 0.52, M.chair, c, 0, 0.48, 0);
  box(0.55, 0.6, 0.07, M.chair, c, 0, 0.82, -0.27);
  cyl(0.04, 0.04, 0.44, M.metal, c, 0, 0.22, 0, 8);
  cyl(0.25, 0.25, 0.03, M.metal, c, 0, 0.02, 0, 16);
  return c;
}
function screenPanel(tex, parent, x, y, z, w, h, ry = 0) {
  box(w + 0.16, h + 0.16, 0.06, M.dark, parent, x, y, z - 0.03 * Math.cos(ry)).rotation.y = ry;
  const m = plane(w, h, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), parent, x, y, z + 0.01, ry);
  m.material.color.setScalar(1.15);
  return m;
}

// ═════════ 층별 꾸미기 ═════════
// 3F 품질팀: 파레토 화면 + 원탁
{
  const g = floors[3];
  const pareto = canvasTex(800, 440, (c, w, h) => {
    c.fillStyle = '#0b1435'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#c7d4ff'; c.font = `700 34px ${FONT}`; c.fillText('10월 불량 파레토', 30, 52);
    const vals = [38, 24, 14, 9, 6, 5], names = ['싱크', '웰드', '미성형', '버', '기포', '기타'];
    const bw = 90, base = h - 60, sum = vals.reduce((a, b) => a + b);
    let acc = 0;
    const pts = [];
    vals.forEach((v, i) => {
      const x = 60 + i * 120, bh = v / 40 * 260;
      c.fillStyle = i < 3 ? '#4f7bff' : '#2a3a78'; c.fillRect(x, base - bh, bw, bh);
      c.fillStyle = '#8d97bb'; c.font = `500 22px ${FONT}`; c.fillText(names[i], x + 18, base + 32);
      acc += v; pts.push([x + bw / 2, base - acc / sum * 300]);
    });
    c.strokeStyle = '#ffb547'; c.lineWidth = 4; c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
    c.setLineDash([8, 8]); c.strokeStyle = 'rgba(255,181,71,.5)'; c.beginPath();
    c.moveTo(40, base - 0.8 * 300); c.lineTo(w - 20, base - 0.8 * 300); c.stroke();
  });
  screenPanel(pareto.tex, g, 5.0, 2.3, -D / 2 + 0.06, 3.6, 2.0);
  cyl(0.85, 0.85, 0.06, M.white, g, 5.2, 0.76, 1.8, 40);
  cyl(0.08, 0.14, 0.74, M.metal, g, 5.2, 0.37, 1.8);
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2 + 0.5;
    chair(g, 5.2 + Math.cos(a) * 1.3, 1.8 + Math.sin(a) * 1.3, -a - Math.PI / 2);
  }
  plant(g, 7.2, 4.2); plant(g, -7.2, -4.2); plant(g, 3.2, -4.2, 0.8);
}
// 2F 원가팀: 서버랙 + 원가 추이 화면
const leds = [];
{
  const g = floors[2];
  const trend = canvasTex(640, 400, (c, w, h) => {
    c.fillStyle = '#0b1435'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffd89a'; c.font = `700 32px ${FONT}`; c.fillText('제품 원가 추이', 26, 50);
    const v = [100, 103, 101, 106, 104, 109], base = h - 50;
    c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 1;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(30, 100 + i * 60); c.lineTo(w - 20, 100 + i * 60); c.stroke(); }
    c.strokeStyle = '#ffb547'; c.lineWidth = 5; c.beginPath();
    v.forEach((y, i) => { const x = 50 + i * 108, yy = base - (y - 95) * 18; i ? c.lineTo(x, yy) : c.moveTo(x, yy); });
    c.stroke();
    c.fillStyle = '#8d97bb'; c.font = `500 20px ${FONT}`;
    ['5월', '6월', '7월', '8월', '9월', '10월'].forEach((m, i) => c.fillText(m, 36 + i * 108, h - 14));
  });
  screenPanel(trend.tex, g, 3.6, 2.3, -D / 2 + 0.06, 2.8, 1.75);
  for (const rx of [5.9, 7.0]) {
    box(0.95, 2.4, 0.9, M.dark, g, rx, 1.2, -4.2);
    for (let r = 0; r < 9; r++) {
      const led = box(0.5, 0.04, 0.02, neon(r % 3 ? 0x22c55e : 0x3b82f6, 2), g, rx, 0.4 + r * 0.22, -3.74);
      leds.push(led);
    }
  }
  plant(g, 7.2, 4.2); plant(g, -7.2, -4.2); plant(g, 4.6, 3.6, 0.8);
}
// 1F 로비·회의실: 안내데스크 + 회의 테이블 + 회의 화면
const holograms = [];
let meetingScreen;
{
  const g = floors[1];
  box(3.2, 1.05, 0.9, M.white, g, -4.6, 0.525, 2.6);
  box(3.2, 0.05, 0.03, neon(0xec4899, 2.6), g, -4.6, 0.85, 3.07);
  const logo = plane(5.4, 1.1, new THREE.MeshBasicMaterial({ map: sign('KOREA MOLD', '한국몰드 AI 타워', '#ec4899', 1024, 210), transparent: true, toneMapped: false }), g, -4.4, 2.4, -D / 2 + 0.04);
  logo.material.color.setScalar(1.8);
  // 엘리베이터
  box(0.06, 2.6, 1.9, M.metal, g, -W / 2 + 0.05, 1.3, 1.2);
  box(0.07, 2.7, 0.06, neon(0x6d8bff, 1.8), g, -W / 2 + 0.06, 1.35, 0.22);
  box(0.07, 2.7, 0.06, neon(0x6d8bff, 1.8), g, -W / 2 + 0.06, 1.35, 2.18);

  const tx = 2.6, tz = 0.6;
  const tableTop = cyl(1, 1, 0.08, M.white, g, tx, 0.78, tz, 48);
  tableTop.scale.set(2.3, 1, 1.2);
  cyl(0.18, 0.3, 0.74, M.metal, g, tx, 0.37, tz);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + Math.PI / 8;
    const cx = tx + Math.cos(a) * 3.0, cz = tz + Math.sin(a) * 1.85;
    chair(g, cx, cz, -a - Math.PI / 2);
    // 회의 참석자 홀로그램 (회의 기록을 재생할 때만 보인다)
    const holo = new THREE.Group();
    add(holo, g, cx, 0, cz);
    holo.visible = false;
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, toneMapped: false });
    add(new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.32, 4, 12), mat), holo, 0, 0.95, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), mat), holo, 0, 1.55, 0);
    holograms.push({ group: holo, mat });
  }
  meetingScreen = canvasTex(900, 420, (c, w, h, title = '', who = '') => {
    c.fillStyle = '#120a2e'; c.fillRect(0, 0, w, h);
    const grd = c.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, 'rgba(236,72,153,.25)'); grd.addColorStop(1, 'rgba(109,139,255,.2)');
    c.fillStyle = grd; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff'; c.font = `700 52px ${FONT}`; c.fillText('AI 회의실', 40, 90);
    c.font = `500 30px ${FONT}`; c.fillStyle = title ? '#ffd0ea' : '#8d97bb';
    c.fillText(title || '지금은 회의가 없어요', 40, 190);
    if (who) { c.fillStyle = '#c7d2ff'; c.font = `500 26px ${FONT}`; c.fillText(who, 40, 250); }
  });
  screenPanel(meetingScreen.tex, g, 3.4, 2.3, -D / 2 + 0.06, 4.2, 1.96);
  plant(g, 7.2, 4.2); plant(g, -7.2, -4.2); plant(g, 6.8, -4.0, 0.8); plant(g, -2.5, 3.6, 0.8);
}

// ═════════ AI 직원 자리 ═════════
const actors = {};
const stations = [];
const tagEls = {};
for (const s of STAFF) {
  const g = floors[s.floor];
  const st = new THREE.Group();
  add(st, g, s.x, 0, SEAT_Z);
  stations.push(st);

  chair(st, 0, -0.05);
  box(1.7, 0.06, 0.8, M.white, st, 0, 0.76, 0.75);
  box(0.05, 0.73, 0.74, M.white, st, -0.8, 0.37, 0.75);
  box(0.05, 0.73, 0.74, M.white, st, 0.8, 0.37, 0.75);
  box(0.8, 0.48, 0.04, M.dark, st, 0, 1.2, 1.0);
  const screenMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const scr = plane(0.74, 0.42, screenMat, st, 0, 1.2, 0.975, Math.PI);
  scr.renderOrder = 1;
  box(0.06, 0.2, 0.06, M.dark, st, 0, 0.88, 1.0);
  box(0.5, 0.025, 0.16, M.dark, st, 0, 0.8, 0.5);
  cyl(0.05, 0.045, 0.1, new THREE.MeshStandardMaterial({ color: s.color }), st, 0.6, 0.84, 0.55, 12);

  // 사람 (+z 쪽, 카메라를 바라본다)
  const shirt = new THREE.MeshStandardMaterial({ color: s.color, roughness: 0.6, emissive: new THREE.Color(s.color), emissiveIntensity: 0 });
  const body = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.34, 4, 14), shirt), st, 0, 0.95, 0);
  const head = new THREE.Group();
  add(head, st, 0, 1.6, 0);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 18), M.skin), head);
  const hair = add(new THREE.Mesh(new THREE.SphereGeometry(0.235, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: s.hair, roughness: 0.9 })), head);
  hair.rotation.x = -0.35;
  for (const ex of [-0.075, 0.075]) add(new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), M.eye), head, ex, 0, 0.205);
  const arms = [-1, 1].map(side => {
    const pivot = new THREE.Group();
    add(pivot, st, side * 0.31, 1.2, 0.02);
    pivot.rotation.x = -1.15;
    add(new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.36, 4, 10), shirt), pivot, 0, -0.24, 0);
    return pivot;
  });

  const ring = add(new THREE.Mesh(new THREE.RingGeometry(0.66, 0.78, 48),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(s.color).multiplyScalar(2.2), transparent: true, opacity: 0, toneMapped: false, side: THREE.DoubleSide })), st, 0, 0.02, 0.3);
  ring.rotation.x = -Math.PI / 2;

  const tag = el('div', 'tag', `<span class="badge" style="background:${s.color}">${s.floor}F</span><span class="st"></span>${s.name}`);
  tag.addEventListener('click', () => select(s.id));
  tag.addEventListener('pointerdown', e => e.stopPropagation());
  label(tag, s.floor, st, 0, 2.35, 0);
  tagEls[s.id] = tag;

  st.traverse(o => { o.userData.staffId = s.id; });
  actors[s.id] = { st, body, head, arms, shirt, ring, screenMat, status: 'idle', phase: Math.random() * 6.28, flashUntil: 0 };
}
function setStatus(id, status) {
  const a = actors[id];
  a.status = status;
  const c = new THREE.Color(byId[id].color).lerp(new THREE.Color(0xffffff), 0.35);
  a.screenMat.color.copy(status === 'work' ? c.multiplyScalar(1.6) : new THREE.Color(0x1c2442));
  tagEls[id].querySelector('.st').classList.toggle('work', status === 'work');
}
const headPos = id => actors[id].st.localToWorld(new THREE.Vector3(0, 1.7, 0));

// ═════════ 카메라 이동 ═════════
let tween = null;
let follow = null; // 따라갈 지점 (Vector3 또는 함수)
function flyTo(pos, target, dur = 1000) {
  follow = null;
  tween = { fromP: camera.position.clone(), fromT: controls.target.clone(), toP: pos.clone(), toT: target.clone(), t0: performance.now(), dur: reduceMotion ? 1 : dur };
}
controls.addEventListener('start', () => { tween = null; follow = null; });

let currentFloor = 'all';
let topView = false;
function floorView(f) {
  if (f === 'all') {
    return topView
      ? { pos: new THREE.Vector3(0.01, 44, 0.5), target: new THREE.Vector3(0, floorY(3), 0) }
      : VIEW_ALL;
  }
  const y = floorY(f);
  return topView
    ? { pos: new THREE.Vector3(0.01, y + 24, 0.5), target: new THREE.Vector3(0, y, 0) }
    : { pos: new THREE.Vector3(16, y + 11.5, 20), target: new THREE.Vector3(0, y + 1.2, 0) };
}
function setFloor(f, fly = true) {
  currentFloor = f;
  for (const { n } of FLOORS) {
    const show = f === 'all' || n <= f;
    floors[n].visible = show;
    for (const o of labelsByFloor[n]) o.visible = show;
  }
  for (const b of $('floor-chips').children) b.classList.toggle('active', String(b.dataset.floor) === String(f));
  if (fly) { const v = floorView(f); flyTo(v.pos, v.target); }
}

// ═════════ 상단 조작 ═════════
{
  const chips = $('floor-chips');
  const all = el('button', 'pill active', '전체 타워');
  all.dataset.floor = 'all';
  chips.appendChild(all);
  for (const f of FLOORS) {
    const b = el('button', 'pill', `<span class="dot" style="background:${f.color}"></span>${f.name}`);
    b.dataset.floor = f.n;
    chips.appendChild(b);
  }
  chips.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    stopReplay();
    setFloor(b.dataset.floor === 'all' ? 'all' : Number(b.dataset.floor));
  });
  $('btn-top').addEventListener('click', () => {
    topView = !topView;
    $('btn-top').setAttribute('aria-pressed', String(topView));
    const v = floorView(currentFloor);
    flyTo(v.pos, v.target);
  });
  $('chk-rotate').addEventListener('change', e => { controls.autoRotate = e.target.checked; });
}

// ═════════ 데이터 (Neon) ═════════
let data = null;
let selectedDate = null;
const timeFmt = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false });
const dayFmt = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short' });
const hhmm = iso => timeFmt.format(new Date(iso));
const dayLabel = ymd => dayFmt.format(new Date(ymd + 'T12:00:00+09:00')).replace(/\.\s?/g, '/').replace(/\/\s*\(/, '(').replace(/\/$/, '');
const nameOf = id => byId[id]?.name ?? id;
function describe(a) {
  if (a.kind === '전달') return `${nameOf(a.staff_id)} → ${nameOf(a.to_staff_id)} · ${a.title}`;
  if (a.kind === '요청') return `${a.requested_by ? a.requested_by + ' → ' : ''}${nameOf(a.staff_id)} · ${a.title}`;
  return `${nameOf(a.staff_id)} · ${a.title}`;
}

async function load(date) {
  const q = date ? `?date=${encodeURIComponent(date)}` : '';
  try {
    const res = await fetch(`/api/office${q}`, { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || res.statusText);
    data = json;
    selectedDate = json.date;
    for (const st of json.staff) if (actors[st.id]) setStatus(st.id, st.status);
    renderDates();
    if (!replaying) renderTicker();
    renderMonitor();
    renderReports();
    if (panelOpenId) renderPanelLog(panelOpenId);
    return true;
  } catch (e) {
    console.error(e);
    setTicker('연결 오류', 'DB에서 업무 기록을 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.');
    return false;
  }
}

function renderDates() {
  const sel = $('sel-date');
  const list = [...data.dates];
  if (!list.some(d => d.date === data.today)) list.unshift({ date: data.today, count: 0 });
  if (!list.some(d => d.date === selectedDate)) list.push({ date: selectedDate, count: data.activities.length });
  list.sort((a, b) => b.date.localeCompare(a.date));
  sel.innerHTML = list.map(d => `<option value="${d.date}"${d.date === selectedDate ? ' selected' : ''}>${dayLabel(d.date)}${d.date === data.today ? ' 오늘' : ''} · ${d.count}건</option>`).join('');
}
$('sel-date').addEventListener('change', e => { stopReplay(); load(e.target.value); });

function setTicker(head, text, replay = false) {
  const t = $('ticker');
  t.classList.toggle('replaying', replay);
  t.innerHTML = `<b>${esc(head)}</b><span>${esc(text)}</span>`;
}
function renderTicker() {
  const a = data?.latest;
  if (a) setTicker('지금', `${hhmm(a.at)} ${describe(a)}`);
  else setTicker('지금', '아직 업무 기록이 없어요.');
}

// ═════════ 업무 흐름 재생 ═════════
const packets = [];
const packetGeo = new THREE.OctahedronGeometry(0.2);
let replaying = false;
let replayToken = 0;
function launchPacket(fromId, toId, color) {
  const p0 = headPos(fromId), p3 = headPos(toId);
  const out = new THREE.Vector3(0, 1.6, 3.8);
  const curve = new THREE.CubicBezierCurve3(p0, p0.clone().add(out), p3.clone().add(out), p3);
  const mesh = add(new THREE.Mesh(packetGeo, neon(color, 3)), scene);
  const trail = add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.02, 6, false),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, opacity: 0.6, toneMapped: false })), scene);
  const pk = { curve, mesh, trail, t0: performance.now(), dur: reduceMotion ? 10 : 1900, to: toId };
  packets.push(pk);
  return pk;
}
function showMeeting(a) {
  const ids = a ? (a.participants?.length ? a.participants : [a.staff_id]) : [];
  holograms.forEach((h, i) => {
    const id = ids[i];
    h.group.visible = Boolean(id);
    if (id) h.mat.color.copy(new THREE.Color(byId[id].color).lerp(new THREE.Color(0xffffff), 0.3).multiplyScalar(1.5));
  });
  meetingScreen.redraw(a ? a.title : '', a ? '참석: ' + ids.map(nameOf).join(', ') : '');
}
function flash(id) { actors[id].flashUntil = performance.now() + 1800; }

function playStep(a) {
  const followOn = $('chk-follow').checked;
  // 이 장면에 나오는 가장 높은 층까지만 보여 준다 (위층 바닥판이 시야를 가리지 않게)
  const topFloor = a.kind === '회의' ? 1 : Math.max(byId[a.staff_id].floor, byId[a.to_staff_id]?.floor ?? 0);
  setFloor(followOn ? topFloor : 'all', false);
  if (a.kind === '회의') {
    showMeeting(a);
    if (followOn) follow = new THREE.Vector3(2.6, floorY(1) + 1.2, 0.6);
    return;
  }
  flash(a.staff_id);
  if (a.kind === '전달' && a.to_staff_id && actors[a.to_staff_id]) {
    const pk = launchPacket(a.staff_id, a.to_staff_id, byId[a.staff_id].color);
    if (followOn) follow = () => pk.mesh.position;
  } else if (followOn) {
    follow = headPos(a.staff_id);
  }
}
async function startReplay() {
  if (!data?.activities.length) { toast('이 날짜에는 재생할 기록이 없어요.'); return; }
  const token = ++replayToken;
  replaying = true;
  $('btn-replay').textContent = '■ 재생 멈춤';
  closePanel();
  setFloor('all', false);
  if ($('chk-follow').checked) {
    const first = data.activities[0];
    const target = first.kind === '회의' ? new THREE.Vector3(2.6, 1.2, 0.6) : headPos(first.staff_id);
    flyTo(target.clone().add(new THREE.Vector3(10, 7.5, 13)), target, 900);
    await wait(900);
  }
  const list = data.activities;
  for (let i = 0; i < list.length && token === replayToken; i++) {
    const a = list[i];
    setTicker(`재생 ${i + 1}/${list.length}`, `${hhmm(a.at)} ${describe(a)}`, true);
    playStep(a);
    await wait(a.kind === '회의' ? 3200 : 2500);
    if (a.kind === '회의') showMeeting(null);
  }
  if (token === replayToken) stopReplay();
}
function stopReplay() {
  if (!replaying) return;
  replayToken++;
  replaying = false;
  follow = null;
  showMeeting(null);
  $('btn-replay').textContent = '▶ 업무 흐름 재생';
  renderTicker();
}
const wait = ms => new Promise(r => setTimeout(r, ms));
$('btn-replay').addEventListener('click', () => (replaying ? stopReplay() : startReplay()));

// ═════════ 직원 패널 ═════════
const panel = $('panel');
let panelOpenId = null;
let typing = null;
function select(id) {
  const s = byId[id];
  stopReplay();
  // 위층을 숨겨야 아래층 직원에게 카메라가 다가갈 수 있다
  setFloor(s.floor, false);
  panelOpenId = id;
  document.body.classList.add('panel-open');
  for (const [k, t] of Object.entries(tagEls)) t.classList.toggle('active', k === id);
  renderPanel(s);
  panel.classList.add('open');
  flash(id);
  const head = headPos(id);
  if (innerWidth <= 760) {
    // 아래쪽 패널에 가리지 않도록 직원이 화면 위쪽에 오게 한다
    const target = head.clone().add(new THREE.Vector3(0, -4.5, 0));
    flyTo(target.clone().add(new THREE.Vector3(0.6, 7, 9.5)), target);
  } else {
    // 오른쪽 패널을 피해 직원이 화면 왼쪽에 오도록 시선을 오른쪽으로 비튼다
    const target = head.clone().add(new THREE.Vector3(1.9, -0.4, -0.8));
    flyTo(target.clone().add(new THREE.Vector3(3.2, 3.4, 8)), target);
  }
}
function closePanel() {
  panelOpenId = null;
  clearInterval(typing);
  panel.classList.remove('open');
  document.body.classList.remove('panel-open');
  for (const t of Object.values(tagEls)) t.classList.remove('active');
}
function renderPanel(s) {
  clearInterval(typing);
  panel.innerHTML = `
    <header>
      <div class="avatar" style="background:${s.color}">${s.name[0]}</div>
      <div>
        <h2>${s.name}</h2>
        <div class="meta">
          <span class="chipx">${s.floor}F ${s.team}</span>
          ${s.agent ? `<span class="chipx code">${s.agent}</span>` : '<span class="chipx">구상 단계</span>'}
          <span class="status" id="p-status"></span>
        </div>
      </div>
      <button class="close" aria-label="닫기">×</button>
    </header>
    <div class="body">
      <h3>지금 하는 일</h3>
      <div class="now" id="p-now"></div>
      <h3>역할</h3>
      <p>${s.summary}</p>
      <h3>하는 일</h3>
      <ul class="tasks">${s.tasks.map(t => `<li>${t}</li>`).join('')}</ul>
      <h3>받는 것 → 내놓는 것</h3>
      <dl class="io"><dt>입력</dt><dd>${s.input}</dd><dt>출력</dt><dd>${s.output}</dd></dl>
      <h3>같이 일하는 동료</h3>
      <div class="links">${s.links.map(l => `<button class="link" data-link="${l}"><span class="dot" style="background:${byId[l].color}"></span>${byId[l].name}</button>`).join('')}</div>
      ${s.isNew ? '<div class="notice">원가팀 직원은 아직 구상 단계예요. 품질팀처럼 Claude Code 에이전트로 만들면 실제 업무를 맡길 수 있어요.</div>' : ''}
      <h3 id="p-log-title">업무 기록</h3>
      <ul class="mini-log" id="p-log"></ul>
      <div style="margin-top:10px"><button class="link" id="p-request">＋ ${s.name}에게 업무 지시</button></div>
      <h3>대화해 보기</h3>
      <div class="chat" id="chat"><div class="msg ai">안녕하세요, ${s.name}예요. 궁금한 걸 골라 보세요.</div></div>
      <div class="questions">${s.qa.map((x, i) => `<button class="q" data-q="${i}">${x.q}</button>`).join('')}</div>
      <p class="muted small" style="margin-top:8px">대화는 데모예요. 미리 정해 둔 답변만 보여 줘요.</p>
    </div>`;
  panel.querySelector('.close').addEventListener('click', closePanel);
  panel.querySelector('#p-request').addEventListener('click', () => openRequest(s.id));
  for (const b of panel.querySelectorAll('[data-link]')) b.addEventListener('click', () => select(b.dataset.link));
  for (const b of panel.querySelectorAll('[data-q]')) b.addEventListener('click', () => ask(s, Number(b.dataset.q), b));
  renderPanelLog(s.id);
}
function renderPanelLog(id) {
  const st = data?.staff.find(x => x.id === id);
  const status = actors[id].status;
  const ps = panel.querySelector('#p-status');
  if (!ps) return;
  ps.className = 'status' + (status === 'work' ? ' work' : '');
  ps.textContent = status === 'work' ? '근무 중' : '대기';
  panel.querySelector('#p-now').innerHTML = `${status === 'work' ? '⌨️' : '☕'} ${esc(st?.current_task || '불러오는 중…')}`;
  const mine = (data?.activities || []).filter(a => a.staff_id === id || a.to_staff_id === id || a.participants?.includes(id));
  panel.querySelector('#p-log-title').textContent = `업무 기록 · ${selectedDate ? dayLabel(selectedDate) : ''}`;
  panel.querySelector('#p-log').innerHTML = mine.length
    ? mine.slice(-6).reverse().map(a => `<li><time>${hhmm(a.at)}</time><span class="kind ${a.kind}">${a.kind}</span><span>${esc(describe(a))}</span></li>`).join('')
    : '<li class="muted">이 날짜에는 기록이 없어요.</li>';
}
function ask(s, i, btn) {
  const chat = panel.querySelector('#chat');
  const qs = [...panel.querySelectorAll('.q')];
  const { q, a } = s.qa[i];
  chat.insertAdjacentHTML('beforeend', `<div class="msg me">${esc(q)}</div>`);
  const reply = el('div', 'msg ai');
  chat.appendChild(reply);
  btn.disabled = true;
  const body = panel.querySelector('.body');
  const down = () => { body.scrollTop = body.scrollHeight; };
  if (reduceMotion) { reply.textContent = a; down(); return; }
  const was = qs.map(b => b.disabled);
  qs.forEach(b => { b.disabled = true; });
  let n = 0;
  clearInterval(typing);
  typing = setInterval(() => {
    n += 2;
    reply.textContent = a.slice(0, n);
    down();
    if (n >= a.length) { clearInterval(typing); qs.forEach((b, k) => { b.disabled = was[k]; }); }
  }, 22);
}

// ═════════ 업무 지시 (DB에 쓰기) ═════════
const dlg = $('dlg-request');
$('req-staff').innerHTML = STAFF.map(s => `<option value="${s.id}">${s.floor}F ${s.name}</option>`).join('');
function openRequest(id) {
  if (id) $('req-staff').value = id;
  $('req-error').hidden = true;
  $('form-request').reset();
  if (id) $('req-staff').value = id;
  dlg.showModal();
}
$('btn-request').addEventListener('click', () => openRequest(panelOpenId));
$('req-cancel').addEventListener('click', () => dlg.close());
$('form-request').addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const body = Object.fromEntries(fd);
  $('req-submit').disabled = true;
  try {
    const res = await fetch('/api/activities', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || '저장하지 못했어요.');
    dlg.close();
    toast(`${nameOf(body.staff_id)}에게 업무 지시를 기록했어요.`);
    stopReplay();
    await load(data?.today);
    select(body.staff_id);
  } catch (err) {
    $('req-error').textContent = err.message;
    $('req-error').hidden = false;
  } finally {
    $('req-submit').disabled = false;
  }
});

// ═════════ 모니터링 · 보고함 ═════════
function renderMonitor() {
  if (!data) return;
  $('monitor-date').innerHTML = `${dayLabel(selectedDate)} 기준${data.activities.some(a => a.is_sample) ? ' <span class="sample">예시 데이터 포함</span>' : ''}`;
  $('staff-cards').innerHTML = STAFF.map(s => {
    const st = data.staff.find(x => x.id === s.id);
    const work = st?.status === 'work';
    return `<button class="card" data-id="${s.id}">
      <div class="top"><div class="avatar" style="background:${s.color}">${s.name[0]}</div>
        <div><b>${s.name}</b><div class="muted small">${s.floor}F ${s.team}</div></div></div>
      <div class="task">${esc(st?.current_task || '-')}</div>
      <div class="foot"><span class="status${work ? ' work' : ''}">${work ? '근무 중' : '대기'}</span>
        <span>${st ? hhmm(st.updated_at) + ' 갱신' : ''}</span></div>
    </button>`;
  }).join('');
  const tl = $('timeline');
  tl.innerHTML = data.activities.length
    ? data.activities.map((a, i) => `<li><button data-i="${i}"><time>${hhmm(a.at)}</time><span class="kind ${a.kind}">${a.kind}</span>
        <span class="what">${esc(a.title)}</span><span class="who">${esc(a.kind === '전달' ? `${nameOf(a.staff_id)} → ${nameOf(a.to_staff_id)}` : a.kind === '회의' ? `${a.participants.length}명 참석` : nameOf(a.staff_id))}</span></button></li>`).join('')
    : '<li class="empty">이 날짜에는 업무 기록이 없어요.</li>';
}
$('staff-cards').addEventListener('click', e => {
  const b = e.target.closest('[data-id]');
  if (b) { setView('tower'); select(b.dataset.id); }
});
$('timeline').addEventListener('click', e => {
  const b = e.target.closest('[data-i]');
  if (!b) return;
  const a = data.activities[Number(b.dataset.i)];
  setView('tower');
  closePanel();
  setTicker(hhmm(a.at), describe(a));
  playStep(a);
  if (a.kind === '회의') setTimeout(() => showMeeting(null), 4000);
  if (!$('chk-follow').checked) {
    const t = a.kind === '회의' ? new THREE.Vector3(2.6, 1.2, 0.6) : headPos(a.staff_id);
    flyTo(t.clone().add(new THREE.Vector3(10, 7.5, 13)), t);
  }
});
function renderReports() {
  if (!data) return;
  $('report-list').innerHTML = data.reports.length
    ? data.reports.map(r => `<div class="report"><div class="fmt ${esc(r.format)}">${esc(r.format).toUpperCase()}</div>
        <div class="info"><b>${esc(r.title)}</b><p>${esc(r.summary)}</p></div>
        <div class="when">${dayLabel(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(r.created_at)))}<br>${esc(nameOf(r.staff_id))}${r.is_sample ? '<br><span class="sample">예시</span>' : ''}</div></div>`).join('')
    : '<div class="empty">아직 완성된 보고서가 없어요.</div>';
}

let view = 'tower';
function setView(v) {
  view = v;
  for (const b of document.querySelectorAll('.tabs button')) b.setAttribute('aria-selected', String(b.dataset.view === v));
  $('view-monitor').hidden = v !== 'monitor';
  $('view-reports').hidden = v !== 'reports';
  $('controls').hidden = v !== 'tower';
  $('labels').hidden = v !== 'tower';
  if (v !== 'tower') { closePanel(); stopReplay(); }
}
document.querySelector('.tabs').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) setView(b.dataset.view);
});

// ═════════ 기타 UI ═════════
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2600);
}
function tickClock() {
  const now = new Date();
  const d = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' }).formatToParts(now);
  const wd = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(now);
  const m = d.find(p => p.type === 'month').value, day = d.find(p => p.type === 'day').value;
  $('clock').textContent = `${m}/${day}(${wd}) ${timeFmt.format(now)}`;
}
tickClock();
setInterval(tickClock, 10000);
addEventListener('keydown', e => { if (e.key === 'Escape' && !dlg.open) { closePanel(); stopReplay(); } });
// 다른 사람이 남긴 지시도 보이도록 30초마다 새로 읽는다
setInterval(() => { if (!replaying && !dlg.open && document.visibilityState === 'visible') load(selectedDate); }, 30000);

// ═════════ 클릭 · 호버 ═════════
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let hovered = null;
let downAt = null;
function pick(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const visible = stations.filter(s => s.parent.visible);
  const hit = raycaster.intersectObjects(visible, true)[0];
  return hit ? hit.object.userData.staffId : null;
}
renderer.domElement.addEventListener('pointerdown', e => { downAt = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 6) return;
  const id = pick(e);
  if (id) { stopReplay(); select(id); }
});
renderer.domElement.addEventListener('pointermove', e => {
  if (downAt || e.pointerType === 'touch') return;
  hovered = pick(e);
  renderer.domElement.style.cursor = hovered ? 'pointer' : '';
});

// ═════════ 크기 ═════════
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  labelRenderer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 50 : 32;
  // 왼쪽 위 조작 버튼에 타워가 가리지 않도록 화면 중심을 옮긴다
  if (w > 760) camera.setViewOffset(w, h, -Math.min(190, w * 0.13), -20, w, h);
  else camera.setViewOffset(w, h, 0, -h * 0.13, w, h);
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ═════════ 이름표 가림 처리 ═════════
// CSS 이름표는 3D 물체에 가려지지 않으므로, 직원이 바닥판 뒤에 가려지면 이름표도 숨긴다
const occRay = new THREE.Raycaster();
const tagWorld = new THREE.Vector3();
function hideBlockedTags() {
  const eye = camera.position;
  const visibleOcc = occluders.filter(o => o.parent.visible);
  for (const s of STAFF) {
    actors[s.id].st.localToWorld(tagWorld.set(0, 1.0, 0)); // 몸통이 보이면 이름표도 보여 준다
    const dir = tagWorld.clone().sub(eye);
    const dist = dir.length();
    occRay.set(eye, dir.normalize());
    occRay.far = dist - 0.2;
    tagEls[s.id].classList.toggle('blocked', occRay.intersectObjects(visibleOcc, false).length > 0);
  }
}

// ═════════ 애니메이션 ═════════
const clock = new THREE.Clock();
let frameNo = 0;
function frame() {
  requestAnimationFrame(frame);
  const t = clock.getElapsedTime();
  const now = performance.now();
  const motion = reduceMotion ? 0 : 1;

  if (tween) {
    const k = Math.min(1, (now - tween.t0) / tween.dur);
    const e = 1 - Math.pow(1 - k, 3);
    camera.position.lerpVectors(tween.fromP, tween.toP, e);
    controls.target.lerpVectors(tween.fromT, tween.toT, e);
    if (k === 1) tween = null;
  } else if (follow) {
    const goal = typeof follow === 'function' ? follow() : follow;
    const delta = goal.clone().sub(controls.target).multiplyScalar(0.07);
    controls.target.add(delta);
    camera.position.add(delta);
  }
  controls.update();

  for (const s of STAFF) {
    const a = actors[s.id];
    const p = t + a.phase;
    if (a.status === 'work') {
      a.arms[0].rotation.x = -1.15 + Math.sin(p * 14) * 0.06 * motion;
      a.arms[1].rotation.x = -1.15 + Math.sin(p * 14 + 1.7) * 0.06 * motion;
      a.head.rotation.x = 0.12 + Math.sin(p * 1.3) * 0.04 * motion;
      a.head.rotation.y = Math.sin(p * 0.7) * 0.08 * motion;
      a.body.scale.y = 1;
    } else {
      a.arms[0].rotation.x = a.arms[1].rotation.x = -1.0;
      a.body.scale.y = 1 + Math.sin(p * 1.6) * 0.015 * motion;
      a.head.rotation.y = Math.sin(p * 0.45) * 0.5 * motion;
      a.head.rotation.x = -0.05;
    }
    const lit = s.id === panelOpenId || s.id === hovered || now < a.flashUntil;
    a.shirt.emissiveIntensity += ((lit ? 0.35 : 0) - a.shirt.emissiveIntensity) * 0.2;
    const ringGoal = lit ? 0.7 + Math.sin(t * 4) * 0.25 * motion : 0;
    a.ring.material.opacity += (ringGoal - a.ring.material.opacity) * 0.15;
  }

  for (let i = packets.length - 1; i >= 0; i--) {
    const pk = packets[i];
    const k = Math.min(1, (now - pk.t0) / pk.dur);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    pk.mesh.position.copy(pk.curve.getPoint(e));
    pk.mesh.rotation.y = t * 4;
    if (k === 1) {
      scene.remove(pk.mesh, pk.trail);
      pk.trail.geometry.dispose();
      packets.splice(i, 1);
      flash(pk.to);
    }
  }

  if (motion && Math.random() < 0.08) {
    const led = leds[(Math.random() * leds.length) | 0];
    led.visible = !led.visible;
  }
  for (const h of holograms) if (h.group.visible) h.mat.opacity = 0.45 + Math.sin(t * 5) * 0.15 * motion;
  if (++frameNo % 6 === 0) hideBlockedTags();

  if (view === 'tower') {
    composer.render();
    labelRenderer.render(scene, camera);
  }
}

setFloor('all', false);
for (const s of STAFF) setStatus(s.id, 'idle');
frame();
window.__officeReady = true;
$('loading').classList.add('done');
load();

// Membuat demo/city-demo.html: satu berkas mandiri berisi adegan kota 3D (kode yang sama dengan aplikasi) dan dua peta.
// Hanya three.js yang dimuat dari CDN. Jalankan: node scripts/build-demo.mjs
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "package.json"));
const ts = require("typescript");
const THREE_VERSION = JSON.parse(readFileSync(join(root, "../node_modules/three/package.json"), "utf8")).version;

const strip = (file) => {
  const js = ts.transpileModule(readFileSync(join(root, file), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, verbatimModuleSyntax: false } }).outputText;
  return js
    .split("\n")
    .filter((l) => !/^import .* from "\.{1,2}\//.test(l) && !/^import .* from "three/.test(l))
    .map((l) => l.replace(/^export (?=(const|function|class|let) )/, ""))
    .filter((l) => !/^export \{/.test(l))
    .join("\n");
};

const code = ["src/lib/palette.ts", "src/lib/scene/geometry.ts", "src/lib/scene/roadgraph.ts", "src/lib/scene/props.ts", "src/lib/scene/themes.ts", "src/lib/scene/places.ts", "src/lib/scene/clock.ts", "src/lib/scene/scenery.ts", "src/lib/scene/assign.ts", "src/lib/scene/fabric.ts", "src/lib/scene/construction.ts", "src/lib/scene/textures.ts", "src/lib/scene/landmarks.ts", "src/lib/scene/life.ts", "src/lib/scene/civic.ts", "src/lib/scene/CityScene.ts"].map(strip).join("\n");
const maps = {
  "SCBD, Jakarta": JSON.parse(readFileSync(join(root, "public/maps/scbd-jakarta.city.json"), "utf8")),
  "Malioboro, Yogyakarta": JSON.parse(readFileSync(join(root, "public/maps/malioboro-jogja.city.json"), "utf8")),
};

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nusastakes · living city demo</title>
<style>
  :root { --ink:#0f1633; --soft:#5b6486; --accent:#3f6bff; --glass:rgba(255,255,255,.8); }
  * { box-sizing: border-box; }
  html, body { margin:0; height:100%; overflow:hidden; background:#eef1fb; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color:var(--ink); }
  canvas { position:fixed; inset:0; width:100%; height:100%; display:block; touch-action:none; cursor:grab; }
  .card { position:fixed; background:var(--glass); backdrop-filter:blur(14px); border:1px solid rgba(255,255,255,.85); border-radius:18px; box-shadow:0 18px 40px -22px rgba(40,60,140,.35); padding:14px 16px; }
  h1 { margin:0; font-size:16px; } h2 { margin:0 0 8px; font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--soft); }
  p { margin:4px 0 0; font-size:12px; color:var(--soft); line-height:1.45; }
  #left { position:fixed; left:16px; top:16px; bottom:16px; width:340px; max-width:calc(100vw - 32px); display:flex; flex-direction:column; gap:10px; pointer-events:none; }
  #left .card { position:static; pointer-events:auto; } #console { overflow:auto; min-height:0; }
  #panel { right:16px; top:16px; bottom:16px; width:300px; max-width:calc(100vw - 32px); overflow:auto; }
  .themes { display:flex; gap:8px; flex-wrap:wrap; margin:6px 0 10px; } .themes button { width:auto; padding:6px 10px; display:flex; align-items:center; gap:6px; } .themes button.on { outline:2px solid var(--accent); }
  .themes i { width:12px; height:12px; border-radius:50%; display:inline-block; }
  .works label { display:flex; gap:8px; align-items:flex-start; font-size:12px; margin:7px 0; line-height:1.3; cursor:pointer; } .works label.locked { opacity:.5; cursor:not-allowed; } .works b { display:block; font-weight:600; } .works span { color:var(--soft); font-size:11px; }
  .btns { display:grid; grid-template-columns:1fr 1fr; gap:7px; }
  button { font:inherit; font-size:12px; font-weight:600; padding:9px 10px; border-radius:12px; border:1px solid rgba(15,22,51,.08); background:rgba(255,255,255,.9); color:var(--ink); cursor:pointer; text-align:left; line-height:1.25; transition:transform .1s, background .1s; }
  button:hover { background:#fff; transform:translateY(-1px); } button:active { transform:none; }
  button small { display:block; font-weight:500; color:var(--soft); font-size:10.5px; margin-top:2px; }
  button.wide { grid-column:1 / -1; } button.primary { background:var(--accent); color:#fff; border-color:transparent; } button.primary small { color:#dbe4ff; }
  .row { margin:10px 0; } .row label { display:flex; justify-content:space-between; font-size:13px; font-weight:600; align-items:center; }
  .dot { width:9px; height:9px; border-radius:50%; display:inline-block; margin-right:6px; }
  input[type=range] { width:100%; accent-color:var(--accent); }
  .tog { display:flex; gap:14px; margin:12px 0 4px; font-size:12px; color:var(--soft); } .tog label { display:flex; align-items:center; gap:6px; cursor:pointer; }
  select { width:100%; padding:8px 10px; border-radius:12px; border:1px solid rgba(15,22,51,.12); background:rgba(255,255,255,.85); font:inherit; font-size:13px; }
  #log { margin:10px 0 0; padding:0; list-style:none; font-size:11.5px; color:var(--soft); }
  #log li { padding:5px 0; border-top:1px solid rgba(15,22,51,.06); display:flex; gap:8px; } #log b { color:var(--ink); font-weight:600; } #log time { opacity:.6; flex:none; }
  #labels, #floaters { position:fixed; inset:0; pointer-events:none; overflow:hidden; }
  .lab { position:absolute; left:0; top:0; padding:4px 10px; border-radius:99px; background:rgba(255,255,255,.85); border:1px solid rgba(255,255,255,.7); font-size:11px; font-weight:600; color:#334; box-shadow:0 4px 16px -6px rgba(40,60,140,.35); white-space:nowrap; }
  .lab i { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px; }
  .chip { position:absolute; left:0; top:0; padding:5px 11px; border-radius:99px; background:#fff; border:2px solid var(--c); font-size:11.5px; font-weight:700; color:var(--ink); box-shadow:0 8px 22px -8px rgba(15,22,51,.35); white-space:nowrap; }
  .chip::after { content:""; position:absolute; left:50%; bottom:-7px; width:10px; height:10px; background:#fff; border-right:2px solid var(--c); border-bottom:2px solid var(--c); transform:translateX(-50%) rotate(45deg); }
  .legend { display:flex; flex-wrap:wrap; gap:6px 12px; margin-top:8px; font-size:11px; color:var(--soft); } .legend span { display:flex; align-items:center; gap:5px; }
  #clockbar { position:fixed; left:372px; right:332px; top:16px; display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:8px 12px; padding:10px 14px; }
  @media (max-width:760px){ #clockbar{ left:12px; right:12px; } }
  #clockbar .t { font: 600 22px/1 ui-monospace, SFMono-Regular, Menlo, monospace; } #clockbar .ph { font-size:11px; color:var(--soft); margin-top:3px; }
  #clockbar button { width:auto; padding:5px 9px; font-size:11px; } #clockbar button.on { background:var(--accent); color:#fff; }
  #econ { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-top:10px; } #econ div { background:rgba(255,255,255,.85); border-radius:10px; padding:6px 8px; font-size:10.5px; color:var(--soft); } #econ b { display:block; font-size:15px; color:var(--ink); }
  #inspect { position:fixed; left:50%; bottom:52px; transform:translateX(-50%); display:none; max-width:360px; padding:10px 14px; font-size:12px; } #inspect b { display:block; font-size:13px; }
  #hint { position:fixed; left:50%; bottom:14px; transform:translateX(-50%); font-size:11px; color:var(--soft); background:rgba(255,255,255,.7); padding:6px 12px; border-radius:99px; backdrop-filter:blur(8px); white-space:nowrap; }
  @media (max-width:760px){ #panel{ display:none; } #left{ top:auto; max-height:52vh; } #title{ display:none; } #hint{ display:none; } }
</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/"}}</script>
</head>
<body>
<canvas id="c" aria-label="3D city"></canvas>
<div id="labels"></div>
<div id="floaters"></div>
<div id="left"><div class="card" id="title"><h1>Nusastakes · living city demo</h1><p>Real streets and buildings (Overture Maps, OpenStreetMap). The city starts as empty land and is built by the funds in it. Everything that moves is something that happened with the money: trucks carry funds, crowds gather for the mayor's events.</p></div>
<div class="card" id="console">
  <h2>What the mayor and residents do</h2>
  <div class="btns">
    <button data-ev="t1" class="primary">Rebalance<small>Plaza → Lending · 1,200 AUSD</small></button>
    <button data-ev="t2">Rebalance<small>Lending → Vault · 800 AUSD</small></button>
    <button data-ev="dep">Resident deposits<small>+500 AUSD arrives</small></button>
    <button data-ev="wd">Resident withdraws<small>−300 AUSD leaves</small></button>
    <button data-ev="fest">Mayor's event<small>Crowd gathers at Vault district</small></button>
    <button data-ev="fee">Collect mayor fee<small>Coins pop at the Plaza</small></button>
    <button data-ev="prop">AI Analyst proposes<small>Waits for mayor approval</small></button>
    <button data-ev="appr" id="appr" disabled>Mayor approves<small>Runs the proposal</small></button>
    <button data-ev="sat" class="wide">Satpam guard: evacuate Lending district<small>Sirens, crowd disperses, funds go back to the Plaza</small></button>
  </div>
  <div class="tog"><label><input type="checkbox" id="auto" checked> Autoplay</label><label><input type="checkbox" id="follow" checked> Camera follows</label></div>
  <div class="row"><label><span>City activity</span><b id="actv">100%</b></label><input id="act" type="range" min="0" max="150" value="100"></div>
  <h2 style="margin-top:12px">City life today (simulated)</h2>
  <div id="econ"></div>
  <ul id="log"></ul>
</div></div>
<div class="card" id="panel">
  <h2>City</h2>
  <select id="map"></select>
  <h2 style="margin-top:14px">Funds in the city</h2>
  <div class="row"><label><span id="lvl">City</span><b id="funds"></b></label><input id="sf" type="range" min="0" max="100" value="86"></div>
  <button id="regrow" class="wide" style="width:100%">Rebuild from zero<small>The city starts as empty land and grows with the funds</small></button>
  <h2 style="margin-top:14px">Where the money is</h2>
  <div class="row"><label><span><span class="dot" style="background:#9aa6cf"></span>Plaza (idle)</span><b id="v0"></b></label><input id="s0" type="range" min="0" max="100" value="16"></div>
  <div class="row"><label><span><span class="dot" style="background:#3f6bff"></span>Lending district</span><b id="v1"></b></label><input id="s1" type="range" min="0" max="100" value="58"></div>
  <div class="row"><label><span><span class="dot" style="background:#7a5cff"></span>Vault district</span><b id="v2"></b></label><input id="s2" type="range" min="0" max="100" value="26"></div>
  <p>Funds decide how much of the city is built: it starts as empty land and cranes raise buildings as deposits come in. Move the district sliders and trucks carry the difference.</p>
  <h2 style="margin-top:14px">City design · the mayor's touch</h2>
  <p>Looks only: no effect on returns. The mayor picks a theme and which civic works to build; bigger cities unlock more.</p>
  <div class="themes" id="themes"></div>
  <div class="works" id="works"></div>
  <div class="legend"><span><i class="dot" style="background:#10b981"></i>deposit</span><span><i class="dot" style="background:#f59e0b"></i>withdrawal</span><span><i class="dot" style="background:#3f6bff"></i>rebalance</span><span><i class="dot" style="background:#7a5cff"></i>proposal</span><span><i class="dot" style="background:#ef4444"></i>Satpam</span></div>
</div>
<div class="card" id="clockbar"><div><div class="t" id="ctime">06:36</div><div class="ph" id="cphase">Dawn</div></div>
  <div style="display:flex;gap:4px"><button data-sp="0">❚❚</button><button data-sp="16" class="on">1×</button><button data-sp="4">4×</button><button data-sp="1">16×</button></div>
  <div style="display:flex;gap:4px"><button data-h="7.2">Morning rush</button><button data-h="12.2">Lunch</button><button data-h="18.3">Evening</button><button data-h="21.5">Night</button></div></div>
<div class="card" id="inspect"><b id="ititle"></b><span id="idetail"></span></div>
<div id="hint">Drag to rotate · scroll to zoom · click a car, bus, cart or person to see what they are doing · sample data, no real money</div>
<script type="module">
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { VignetteShader } from "three/addons/shaders/VignetteShader.js";
${code}

const MAPS = ${JSON.stringify(maps)};
const KINDS = [
  { id: "idle", kind: "idle", label: "Plaza" },
  { id: "lend", kind: "lending", label: "Lending district" },
  { id: "vault", kind: "vault", label: "Vault district" },
];
// Dana kota (AUSD) dari slider: skala log yang sama dengan developmentOf, 0..60.000.
const fundsOf = (v) => Math.round(40 * (Math.exp((v / 100) * Math.log(1501)) - 1));
const levelOf = (d) => (d < 0.02 ? 'Empty land' : d < 0.2 ? 'Hamlet' : d < 0.45 ? 'Town' : d < 0.7 ? 'City' : 'Metropolis');
let TOTAL = fundsOf(86);
const TONE_CSS = { blue: "#3f6bff", green: "#10b981", amber: "#f59e0b", red: "#ef4444", violet: "#7a5cff", gold: "#f5b301" };
const $ = (id) => document.getElementById(id);
const canvas = $("c");

// Label distrik (tetap) dan pin kejadian (bergerak)
const labelEls = new Map();
for (const k of KINDS) {
  const el = document.createElement("div");
  el.className = "lab"; el.style.opacity = "0";
  el.innerHTML = '<i class="dot" style="background:' + DISTRICT_COLORS[k.kind] + '"></i>' + k.label;
  $("labels").appendChild(el); labelEls.set(k.id, el);
}
const chips = new Map();
const scene = new CityScene(canvas, {
  onLabels: (labels) => { for (const l of labels) { const el = labelEls.get(l.id); if (!el) continue; el.style.transform = "translate(" + l.x.toFixed(1) + "px," + l.y.toFixed(1) + "px) translate(-50%,-100%)"; el.style.opacity = l.visible ? "1" : "0"; } },
  onSelect: (id) => scene.setSelected(id),
  onTick: (tk) => {
    $("ctime").textContent = tk.time; $("cphase").textContent = tk.phase;
    const s = tk.stats;
    $("econ").innerHTML = [["vehicles", s.vehicles], ["people", s.people], ["buses", s.buses + " · " + s.riders + " riding"], ["trips", s.tripsToday], ["deliveries", s.deliveriesToday], ["bus riders", s.busRidersToday], ["street vendors", s.vendors], ["night stalls", s.stallsOpen], ["sales", s.salesToday]].map(([k, v]) => "<div><b>" + v + "</b>" + k + "</div>").join("");
  },
  onInspect: (info) => {
    const el = $("inspect");
    if (!info) { el.style.display = "none"; return; }
    el.style.display = "block"; $("ititle").textContent = info.title; $("idetail").textContent = info.detail;
  },
  onFloaters: (items) => {
    const seen = new Set();
    for (const f of items) {
      seen.add(f.id);
      let el = chips.get(f.id);
      if (!el) { el = document.createElement("div"); el.className = "chip"; el.style.setProperty("--c", TONE_CSS[f.tone]); el.textContent = f.text; $("floaters").appendChild(el); chips.set(f.id, el); }
      el.style.transform = "translate(" + f.x.toFixed(1) + "px," + (f.y - 8).toFixed(1) + "px) translate(-50%,-100%)";
      el.style.opacity = f.visible ? "1" : "0";
    }
    for (const [id, el] of chips) if (!seen.has(id)) { el.remove(); chips.delete(id); }
  },
});
scene.setViewShift(0);
window.__scene = scene;

// Alokasi
const sliders = [0, 1, 2].map((i) => $("s" + i));
const weightsNow = () => { const raw = sliders.map((s) => Number(s.value)); const sum = raw.reduce((a, b) => a + b, 0) || 1; return raw.map((v) => v / sum); };
let lastW = weightsNow();
function apply() {
  const w = weightsNow();
  w.forEach((x, i) => { $("v" + i).textContent = Math.round(x * 100) + "%"; });
  scene.setDistricts(KINDS.map((k, i) => ({ id: k.id, kind: k.kind, label: k.label, weight: w[i], assets: w[i] * TOTAL, apyBps: 320, simulated: false })));
  $("funds").textContent = TOTAL.toLocaleString("en-US") + " AUSD";
  $("lvl").textContent = "Level · " + levelOf(developmentOf(TOTAL));
}
$("sf").addEventListener("input", () => { TOTAL = fundsOf(Number($("sf").value)); apply(); });
$("regrow").addEventListener("click", () => { load(); log("The city is founded again from empty land"); });
let debounce = 0;
sliders.forEach((s) => s.addEventListener("input", () => {
  apply();
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    const w = weightsNow();
    const diffs = w.map((x, i) => x - lastW[i]);
    const from = diffs.map((d, i) => [d, i]).filter(([d]) => d < -0.01).sort((a, b) => a[0] - b[0])[0];
    const to = diffs.map((d, i) => [d, i]).filter(([d]) => d > 0.01).sort((a, b) => b[0] - a[0])[0];
    if (from && to) run({ type: "transfer", from: KINDS[from[1]].id, to: KINDS[to[1]].id, amount: Math.round(-from[0] * TOTAL) }, "Rebalance " + KINDS[from[1]].label + " → " + KINDS[to[1]].label + " · " + Math.round(-from[0] * TOTAL).toLocaleString("en-US") + " AUSD");
    lastW = w;
  }, 700);
}));
const mapSel = $("map");
for (const name of Object.keys(MAPS)) mapSel.add(new Option(name, name));
const load = () => { scene.setMap(MAPS[mapSel.value]); scene.setCityLabel(mapSel.value); apply(); };
mapSel.addEventListener("change", load);
load();

// Kejadian
const logEl = $("log");
function log(text) {
  const li = document.createElement("li");
  li.innerHTML = "<time>" + new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + "</time><b>" + text + "</b>";
  logEl.prepend(li);
  while (logEl.children.length > 6) logEl.lastChild.remove();
}
function run(ev, text, focus) {
  scene.emit(ev);
  log(text);
  const target = focus ?? (ev.type === "transfer" ? ev.to : ev.at ?? "idle");
  if ($("follow").checked) scene.focusDistrict(target);
}
let pendingProposal = null;
const ACTIONS = {
  t1: () => run({ type: "transfer", from: "idle", to: "lend", amount: 1200 }, "Mayor rebalances Plaza → Lending · 1,200 AUSD"),
  t2: () => run({ type: "transfer", from: "lend", to: "vault", amount: 800 }, "Mayor rebalances Lending → Vault · 800 AUSD"),
  dep: () => run({ type: "deposit", amount: 500 }, "Resident deposits 500 AUSD", "idle"),
  wd: () => run({ type: "withdraw", amount: 300 }, "Resident withdraws 300 AUSD", "idle"),
  fest: () => run({ type: "festival", at: "vault", label: "Mayor's event · Vault district" }, "Mayor hosts an event at the Vault district"),
  fee: () => run({ type: "harvest", amount: 12.4 }, "Mayor collects 12.4 AUSD in fees", "idle"),
  prop: () => { pendingProposal = "p" + Date.now(); $("appr").disabled = false; run({ type: "propose", id: pendingProposal, from: "lend", to: "vault", amount: 1500 }, "AI Analyst proposes Lending → Vault · 1,500 AUSD"); },
  appr: () => { if (!pendingProposal) return; run({ type: "approve", id: pendingProposal }, "Mayor approves the Analyst's proposal", "vault"); pendingProposal = null; $("appr").disabled = true; },
  sat: () => run({ type: "alert", at: "lend", amount: 900, label: "Satpam: evacuating Lending district" }, "Satpam guard evacuates the Lending district"),
};
document.querySelectorAll("button[data-ev]").forEach((b) => b.addEventListener("click", () => ACTIONS[b.dataset.ev]()));
$("act").addEventListener("input", (e) => { const v = Number(e.target.value); $("actv").textContent = v + "%"; scene.setActivity(v / 100); });

// Desain kota: tema dan karya sipil pilihan walikota (hanya tampilan)
const style = { theme: "classic", works: ["banner", "fountain", "flowers"] };
function renderDesign() {
  const dev = developmentOf(TOTAL);
  $("themes").innerHTML = THEME_IDS.map((id) => '<button data-theme="' + id + '" class="' + (style.theme === id ? "on" : "") + '"><i style="background:' + THEMES[id].swatch + '"></i>' + THEMES[id].label + "</button>").join("");
  $("works").innerHTML = WORKS.map((w) => {
    const open = dev >= w.unlockAt;
    return '<label class="' + (open ? "" : "locked") + '"><input type="checkbox" data-work="' + w.id + '" ' + (style.works.includes(w.id) ? "checked" : "") + (open ? "" : " disabled") + '><div><b>' + w.label + '</b><span>' + (open ? w.blurb : "Unlocks at about " + fundsForDevelopment(w.unlockAt).toLocaleString("en-US") + " AUSD") + "</span></div></label>";
  }).join("");
  scene.setStyle({ theme: style.theme, works: [...style.works] });
}
$("themes").addEventListener("click", (e) => { const b = e.target.closest("button[data-theme]"); if (!b) return; style.theme = b.dataset.theme; renderDesign(); log("Mayor picks the " + THEMES[style.theme].label + " theme"); });
$("works").addEventListener("change", (e) => { const w = e.target.dataset.work; if (!w) return; style.works = e.target.checked ? [...style.works, w] : style.works.filter((x) => x !== w); renderDesign(); log("Mayor " + (e.target.checked ? "orders" : "removes") + ": " + WORKS.find((q) => q.id === w).label); });
$("sf").addEventListener("input", renderDesign);
renderDesign();

// Jam kota: kecepatan dan lompat ke waktu tertentu
document.querySelectorAll("#clockbar button[data-sp]").forEach((b) => b.addEventListener("click", () => {
  const sp = Number(b.dataset.sp);
  scene.setClockPaused(sp === 0);
  if (sp > 0) scene.setClockSpeed(sp);
  document.querySelectorAll("#clockbar button[data-sp]").forEach((x) => x.classList.toggle("on", x === b));
}));
document.querySelectorAll("#clockbar button[data-h]").forEach((b) => b.addEventListener("click", () => { scene.setHour(Number(b.dataset.h)); log("Jump to " + b.textContent.toLowerCase()); }));
$("inspect").addEventListener("click", () => { scene.clearInspect(); $("inspect").style.display = "none"; });

// Mode otomatis: kota hidup sendiri
const script = ["t1", "dep", "fest", "t2", "fee", "prop", "appr", "wd", "sat", "t1"];
let step = 0;
setInterval(() => {
  if (!$("auto").checked) return;
  const key = script[step++ % script.length];
  if (key === "appr" && !pendingProposal) return;
  ACTIONS[key]();
}, 11000);
setTimeout(() => { if ($("auto").checked) ACTIONS.t1(); }, 16000);
</script>
</body>
</html>`;

mkdirSync(join(root, "demo"), { recursive: true });
const out = join(root, "demo/city-demo.html");
writeFileSync(out, html);
console.log(`ditulis ${out} (${(html.length / 1024).toFixed(0)} KB, three@${THREE_VERSION})`);

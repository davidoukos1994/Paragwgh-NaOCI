const DEFAULT_TANKS = [
  { id: 'Z2', tag: 'D-07-02', kv: 'KV7007', maxM: '7.50', tnPerM: '13.54', currentM: '7.50' },
  { id: 'Z1', tag: 'D-07-01', kv: 'KV7006', maxM: '8.65', tnPerM: '11.63', currentM: '8.10' },
  { id: 'Z3', tag: 'D-07-03', kv: 'KV7008', maxM: '7.50', tnPerM: '13.54', currentM: '0.86' },
  { id: 'D2', tag: 'D-07-05', kv: 'KV7002', maxM: '6.20', tnPerM: '11.63', currentM: '4.12' },
  { id: 'D3', tag: 'D-07-06', kv: 'KV7003', maxM: '6.20', tnPerM: '11.63', currentM: '0.18' },
  { id: 'D1', tag: 'D-07-04', kv: 'KV7001', maxM: '6.20', tnPerM: '11.63', currentM: '0.00' },
];

const STORAGE_KEY = 'hypochlorite-storage-v2';
const els = {
  production: document.getElementById('production'),
  startTime: document.getElementById('startTime'),
  activeTank: document.getElementById('activeTank'),
  tankGrid: document.getElementById('tankGrid'),
  summary: document.getElementById('summary'),
  resetBtn: document.getElementById('resetBtn'),
};

let state = loadState();

function nowLocalInputValue() {
  const d = new Date();
  d.setSeconds(0, 0);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch (_) {}
  }
  return {
    production: '6824',
    startTime: nowLocalInputValue(),
    activeTank: 'D1',
    tanks: DEFAULT_TANKS.map(t => ({...t})),
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function toNumber(value) {
  if (typeof value === 'number') return value;
  const normalized = String(value ?? '').replace(',', '.').trim();
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

function fmt(num, digits = 2) {
  if (!Number.isFinite(num)) return '-';
  return num.toLocaleString('el-GR', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function fmtHours(hours) {
  if (!Number.isFinite(hours)) return '-';
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const days = Math.floor(totalMinutes / 1440);
  const h = Math.floor((totalMinutes % 1440) / 60);
  const m = totalMinutes % 60;
  if (days > 0) return `${days} μέρες ${h} ώρες ${m} λεπτά`;
  return `${h} ώρες ${m} λεπτά`;
}

function fmtDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('el-GR', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function tankCalc(t) {
  const maxM = Math.max(0, toNumber(t.maxM));
  const currentM = Math.max(0, toNumber(t.currentM));
  const tnPerM = Math.max(0, toNumber(t.tnPerM));
  const maxTn = maxM * tnPerM;
  const currentTn = Math.min(currentM, maxM) * tnPerM;
  const realCurrentTn = currentM * tnPerM;
  const remainingTn = Math.max(0, maxTn - currentTn);
  const productionTnHr = toNumber(state.production) / 1000;
  const hours = productionTnHr > 0 ? remainingTn / productionTnHr : NaN;
  const start = new Date(state.startTime);
  const finish = Number.isFinite(hours) ? new Date(start.getTime() + hours * 3600 * 1000) : null;
  const percent = maxTn > 0 ? Math.min(100, Math.max(0, realCurrentTn / maxTn * 100)) : 0;
  return { maxM, currentM, tnPerM, maxTn, currentTn, realCurrentTn, remainingTn, productionTnHr, hours, finish, percent };
}

function buildStaticUI() {
  els.production.value = state.production;
  els.startTime.value = state.startTime || nowLocalInputValue();
  els.production.setAttribute('inputmode', 'decimal');

  els.activeTank.innerHTML = state.tanks.map(t => `<option value="${t.id}">${t.id}</option>`).join('');
  els.activeTank.value = state.activeTank;

  els.summary.innerHTML = `
    <div class="summary-card"><b>Παραγωγή</b><span data-summary="production"></span></div>
    <div class="summary-card"><b>Γεμίζει τώρα</b><span data-summary="active"></span></div>
    <div class="summary-card"><b>Χρόνος για τη δεξαμενή</b><span data-summary="activeHours"></span></div>
    <div class="summary-card"><b>Η δεξαμενή γεμίζει στις</b><span data-summary="activeFinish"></span></div>
    <div class="summary-card"><b>Σύνολο που έχεις τώρα</b><span data-summary="totalCurrent"></span></div>
    <div class="summary-card"><b>Συνολική χωρητικότητα</b><span data-summary="totalMax"></span></div>
    <div class="summary-card"><b>Λείπουν συνολικά</b><span data-summary="totalRemaining"></span></div>
    <div class="summary-card important"><b>Όλες γεμίζουν στις</b><span data-summary="allFinish"></span></div>
  `;

  els.tankGrid.innerHTML = state.tanks.map((t, idx) => `
    <article class="tank-card" data-card="${idx}">
      <div class="valve"><div class="valve-icon"></div><small>${t.kv}</small><div class="valve-line"></div></div>
      <div class="tank-visual">
        <div class="fill" data-fill="${idx}"></div>
        <div class="tank-text">
          <div class="name">${t.id}</div>
          <div class="tag">${t.tag}</div>
          <div class="tn"><span data-out="${idx}:currentTn"></span><br>tn NaOCl</div>
          <div class="m"><span data-out="${idx}:currentM"></span> m</div>
        </div>
      </div>
      <div class="fields">
        <label>Max m <input data-idx="${idx}" data-field="maxM" type="text" inputmode="decimal" value="${t.maxM}"></label>
        <label>Πραγματικά m τώρα <input data-idx="${idx}" data-field="currentM" type="text" inputmode="decimal" value="${t.currentM}"></label>
        <label>tn / m <input data-idx="${idx}" data-field="tnPerM" type="text" inputmode="decimal" value="${t.tnPerM}" readonly></label>
      </div>
      <div class="result">
        Max: <strong data-out="${idx}:maxTn"></strong><br>
        Λείπουν: <strong data-out="${idx}:remainingTn"></strong><br>
        Αν γεμίσει μόνη της: <strong data-out="${idx}:hours"></strong><br>
        Γεμίζει: <strong data-out="${idx}:finish"></strong>
      </div>
    </article>
  `).join('');

  els.production.addEventListener('input', e => { state.production = e.target.value; updateCalculations(); });
  els.startTime.addEventListener('input', e => { state.startTime = e.target.value; updateCalculations(); });
  els.activeTank.addEventListener('change', e => { state.activeTank = e.target.value; updateCalculations(); });
  els.tankGrid.addEventListener('input', e => {
    const input = e.target.closest('[data-field]');
    if (!input) return;
    const i = Number(input.dataset.idx);
    const field = input.dataset.field;
    state.tanks[i][field] = input.value;
    updateCalculations();
  });
  els.resetBtn.addEventListener('click', () => {
    if (confirm('Να γίνει reset στις αρχικές τιμές;')) {
      localStorage.removeItem(STORAGE_KEY);
      state = loadState();
      buildStaticUI();
    }
  });

  updateCalculations();
}

function setText(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}

function updateCalculations() {
  saveState();
  const active = state.tanks.find(t => t.id === state.activeTank) || state.tanks[0];
  const ac = tankCalc(active);
  const calcs = state.tanks.map(tankCalc);
  const totalCurrent = calcs.reduce((sum, c) => sum + c.realCurrentTn, 0);
  const totalMax = calcs.reduce((sum, c) => sum + c.maxTn, 0);
  const totalRemaining = calcs.reduce((sum, c) => sum + c.remainingTn, 0);
  const productionTnHr = toNumber(state.production) / 1000;
  const allHours = productionTnHr > 0 ? totalRemaining / productionTnHr : NaN;
  const start = new Date(state.startTime);
  const allFinish = Number.isFinite(allHours) ? new Date(start.getTime() + allHours * 3600 * 1000) : null;

  setText('[data-summary="production"]', `${fmt(toNumber(state.production), 0)} kg/hr`);
  setText('[data-summary="active"]', active.id);
  setText('[data-summary="activeHours"]', fmtHours(ac.hours));
  setText('[data-summary="activeFinish"]', fmtDate(ac.finish));
  setText('[data-summary="totalCurrent"]', `${fmt(totalCurrent)} tn`);
  setText('[data-summary="totalMax"]', `${fmt(totalMax)} tn`);
  setText('[data-summary="totalRemaining"]', `${fmt(totalRemaining)} tn`);
  setText('[data-summary="allFinish"]', `${fmtDate(allFinish)} (${fmtHours(allHours)})`);

  state.tanks.forEach((t, idx) => {
    const c = calcs[idx];
    const card = document.querySelector(`[data-card="${idx}"]`);
    if (card) card.classList.toggle('active', t.id === state.activeTank);
    const fill = document.querySelector(`[data-fill="${idx}"]`);
    if (fill) fill.style.height = `${c.percent}%`;
    setText(`[data-out="${idx}:currentTn"]`, fmt(c.realCurrentTn, 1));
    setText(`[data-out="${idx}:currentM"]`, fmt(c.currentM, 2));
    setText(`[data-out="${idx}:maxTn"]`, `${fmt(c.maxTn)} tn`);
    setText(`[data-out="${idx}:remainingTn"]`, `${fmt(c.remainingTn)} tn`);
    setText(`[data-out="${idx}:hours"]`, fmtHours(c.hours));
    setText(`[data-out="${idx}:finish"]`, fmtDate(c.finish));
  });
}

buildStaticUI();

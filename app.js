const DEFAULT_TANKS = [
  { id: 'Z2', tag: 'D-07-02', kv: 'KV7007', maxM: '7.50', tnPerM: '13.54', currentM: '7.50', order: '' },
  { id: 'Z1', tag: 'D-07-01', kv: 'KV7006', maxM: '8.65', tnPerM: '11.63', currentM: '8.65', order: '' },
  { id: 'Z3', tag: 'D-07-03', kv: 'KV7008', maxM: '7.50', tnPerM: '13.54', currentM: '0.86', order: '3' },
  { id: 'D2', tag: 'D-07-05', kv: 'KV7002', maxM: '6.20', tnPerM: '11.63', currentM: '0.98', order: '2' },
  { id: 'D3', tag: 'D-07-06', kv: 'KV7003', maxM: '6.20', tnPerM: '11.63', currentM: '6.20', order: '' },
  { id: 'D1', tag: 'D-07-04', kv: 'KV7001', maxM: '6.20', tnPerM: '11.63', currentM: '0.98', order: '1' },
];

const STORAGE_KEY = 'hypochlorite-storage-v4-sequence';
const els = {
  production: document.getElementById('production'),
  startTime: document.getElementById('startTime'),
  activeTank: document.getElementById('activeTank'),
  tankGrid: document.getElementById('tankGrid'),
  summary: document.getElementById('summary'),
  sequenceTable: document.getElementById('sequenceTable'),
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
    try {
      const parsed = JSON.parse(saved);
      parsed.tanks = parsed.tanks.map((t, i) => ({...DEFAULT_TANKS[i], ...t}));
      return parsed;
    } catch (_) {}
  }
  return { production: '6824', startTime: nowLocalInputValue(), activeTank: 'D1', tanks: DEFAULT_TANKS.map(t => ({...t})) };
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function toNumber(value) {
  const text = String(value ?? '').replace(',', '.').trim();
  if (text === '' || text === '.' || text === ',') return 0;
  const num = Number(text);
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
  return date.toLocaleString('el-GR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function tankCalc(t) {
  const maxM = Math.max(0, toNumber(t.maxM));
  const currentM = Math.max(0, toNumber(t.currentM));
  const tnPerM = Math.max(0, toNumber(t.tnPerM));
  const maxTn = maxM * tnPerM;
  const currentTn = currentM * tnPerM;
  const currentForRemaining = Math.min(currentM, maxM) * tnPerM;
  const remainingTn = Math.max(0, maxTn - currentForRemaining);
  const productionTnHr = toNumber(state.production) / 1000;
  const hours = productionTnHr > 0 ? remainingTn / productionTnHr : NaN;
  const start = new Date(state.startTime);
  const finish = Number.isFinite(hours) ? new Date(start.getTime() + hours * 3600 * 1000) : null;
  const percent = maxTn > 0 ? Math.min(100, Math.max(0, currentTn / maxTn * 100)) : 0;
  const order = Number.parseInt(String(t.order || '').trim(), 10);
  return { maxM, currentM, tnPerM, maxTn, currentTn, remainingTn, hours, finish, percent, order: Number.isFinite(order) ? order : null };
}

function sequenceCalcs(calcs) {
  const start = new Date(state.startTime);
  let elapsed = 0;
  const selected = state.tanks
    .map((tank, idx) => ({ tank, idx, calc: calcs[idx] }))
    .filter(x => x.calc.remainingTn > 0 && x.calc.order !== null && x.calc.order > 0)
    .sort((a, b) => a.calc.order - b.calc.order || a.idx - b.idx);

  return selected.map(item => {
    const startAt = new Date(start.getTime() + elapsed * 3600 * 1000);
    elapsed += Number.isFinite(item.calc.hours) ? item.calc.hours : 0;
    const finishAt = new Date(start.getTime() + elapsed * 3600 * 1000);
    return { ...item, startAt, finishAt, elapsed };
  });
}

function buildStaticUI() {
  els.production.value = state.production;
  els.startTime.value = state.startTime || nowLocalInputValue();
  els.activeTank.innerHTML = state.tanks.map(t => `<option value="${t.id}">${t.id}</option>`).join('');
  els.activeTank.value = state.activeTank;

  els.summary.innerHTML = `
    <div class="summary-card"><b>Παραγωγή</b><span data-summary="production"></span></div>
    <div class="summary-card"><b>Σύνολο τώρα</b><span data-summary="totalCurrent"></span></div>
    <div class="summary-card"><b>Συνολικό max</b><span data-summary="totalMax"></span></div>
    <div class="summary-card"><b>Λείπουν συνολικά</b><span data-summary="totalRemaining"></span></div>
    <div class="summary-card"><b>Γεμίζει τώρα</b><span data-summary="active"></span></div>
    <div class="summary-card"><b>Χρόνος για αυτή</b><span data-summary="activeHours"></span></div>
    <div class="summary-card"><b>Αυτή γεμίζει στις</b><span data-summary="activeFinish"></span></div>
    <div class="summary-card important"><b>Με τη σειρά: όλες γεμίζουν στις</b><span data-summary="seqFinish"></span></div>
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
        <label>Σειρά γεμίσματος <input data-idx="${idx}" data-field="order" type="text" inputmode="numeric" autocomplete="off" value="${t.order || ''}" placeholder="π.χ. 1"></label>
        <label>Max m <input data-idx="${idx}" data-field="maxM" type="text" inputmode="decimal" autocomplete="off" value="${t.maxM}"></label>
        <label>Πραγματικά m τώρα <input data-idx="${idx}" data-field="currentM" type="text" inputmode="decimal" autocomplete="off" value="${t.currentM}"></label>
        <button class="max-btn" type="button" data-max="${idx}">MAX / Γεμάτη</button>
        <label>tn / m <input data-idx="${idx}" data-field="tnPerM" type="text" inputmode="decimal" autocomplete="off" value="${t.tnPerM}"></label>
      </div>
      <div class="result">
        Max: <strong data-out="${idx}:maxTn"></strong><br>
        Λείπουν: <strong data-out="${idx}:remainingTn"></strong><br>
        Αν γεμίσει μόνη της: <strong data-out="${idx}:hours"></strong><br>
        Μόνη της γεμίζει: <strong data-out="${idx}:finish"></strong><br>
        Με τη σειρά γεμίζει: <strong data-out="${idx}:seqFinish"></strong>
      </div>
    </article>
  `).join('');

  els.production.addEventListener('input', e => { state.production = e.target.value; updateCalculations(); });
  els.startTime.addEventListener('input', e => { state.startTime = e.target.value; updateCalculations(); });
  els.activeTank.addEventListener('change', e => { state.activeTank = e.target.value; updateCalculations(); });
  els.tankGrid.addEventListener('input', e => {
    const input = e.target.closest('[data-field]');
    if (!input) return;
    state.tanks[Number(input.dataset.idx)][input.dataset.field] = input.value;
    updateCalculations();
  });
  els.tankGrid.addEventListener('click', e => {
    const btn = e.target.closest('[data-max]');
    if (!btn) return;
    const i = Number(btn.dataset.max);
    state.tanks[i].currentM = state.tanks[i].maxM;
    state.tanks[i].order = '';
    const cm = els.tankGrid.querySelector(`input[data-idx="${i}"][data-field="currentM"]`);
    const ord = els.tankGrid.querySelector(`input[data-idx="${i}"][data-field="order"]`);
    if (cm) cm.value = state.tanks[i].currentM;
    if (ord) ord.value = '';
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
  const seq = sequenceCalcs(calcs);
  const seqFinish = seq.length ? seq[seq.length - 1].finishAt : new Date(state.startTime);
  const seqHours = seq.length ? seq[seq.length - 1].elapsed : 0;
  const seqFinishByIndex = Object.fromEntries(seq.map(x => [x.idx, x]));

  const totalCurrent = calcs.reduce((sum, c) => sum + c.currentTn, 0);
  const totalMax = calcs.reduce((sum, c) => sum + c.maxTn, 0);
  const totalRemaining = calcs.reduce((sum, c) => sum + c.remainingTn, 0);

  setText('[data-summary="production"]', `${fmt(toNumber(state.production), 0)} kg/hr`);
  setText('[data-summary="active"]', active.id);
  setText('[data-summary="activeHours"]', fmtHours(ac.hours));
  setText('[data-summary="activeFinish"]', fmtDate(ac.finish));
  setText('[data-summary="totalCurrent"]', `${fmt(totalCurrent)} tn`);
  setText('[data-summary="totalMax"]', `${fmt(totalMax)} tn`);
  setText('[data-summary="totalRemaining"]', `${fmt(totalRemaining)} tn`);
  setText('[data-summary="seqFinish"]', seq.length ? `${fmtDate(seqFinish)} (${fmtHours(seqHours)})` : 'Δεν έχεις βάλει σειρά σε άδεια δεξαμενή');

  if (els.sequenceTable) {
    els.sequenceTable.innerHTML = seq.length ? `
      <h2>Σειρά γεμίσματος</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>Σειρά</th><th>Δεξαμενή</th><th>Λείπουν tn</th><th>Χρόνος</th><th>Ξεκινάει</th><th>Γεμίζει</th></tr></thead>
        <tbody>${seq.map(x => `<tr><td>${x.calc.order}</td><td>${x.tank.id}</td><td>${fmt(x.calc.remainingTn)}</td><td>${fmtHours(x.calc.hours)}</td><td>${fmtDate(x.startAt)}</td><td><b>${fmtDate(x.finishAt)}</b></td></tr>`).join('')}</tbody>
      </table></div>
    ` : `<h2>Σειρά γεμίσματος</h2><p>Βάλε 1, 2, 3... στο πεδίο <b>Σειρά γεμίσματος</b> στις άδειες δεξαμενές.</p>`;
  }

  state.tanks.forEach((t, idx) => {
    const c = calcs[idx];
    const card = document.querySelector(`[data-card="${idx}"]`);
    if (card) {
      card.classList.toggle('active', t.id === state.activeTank);
      card.classList.toggle('full', c.remainingTn === 0 && c.maxTn > 0);
    }
    const fill = document.querySelector(`[data-fill="${idx}"]`);
    if (fill) fill.style.height = `${c.percent}%`;
    setText(`[data-out="${idx}:currentTn"]`, fmt(c.currentTn, 1));
    setText(`[data-out="${idx}:currentM"]`, fmt(c.currentM, 2));
    setText(`[data-out="${idx}:maxTn"]`, `${fmt(c.maxTn)} tn`);
    setText(`[data-out="${idx}:remainingTn"]`, `${fmt(c.remainingTn)} tn`);
    setText(`[data-out="${idx}:hours"]`, fmtHours(c.hours));
    setText(`[data-out="${idx}:finish"]`, fmtDate(c.finish));
    const seqItem = seqFinishByIndex[idx];
    let seqText = '-';
    if (c.remainingTn === 0 && c.maxTn > 0) seqText = 'Γεμάτη';
    else if (seqItem) seqText = fmtDate(seqItem.finishAt);
    else if (c.remainingTn > 0) seqText = 'Βάλε σειρά';
    setText(`[data-out="${idx}:seqFinish"]`, seqText);
  });
}

buildStaticUI();

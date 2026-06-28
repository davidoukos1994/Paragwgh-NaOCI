const DEFAULT_TANKS = [
  { id: 'Z2', tag: 'D-07-02', kv: 'KV7007', maxM: 7.50, tnPerM: 13.54, currentM: 7.50 },
  { id: 'Z1', tag: 'D-07-01', kv: 'KV7006', maxM: 8.65, tnPerM: 11.63, currentM: 8.10 },
  { id: 'Z3', tag: 'D-07-03', kv: 'KV7008', maxM: 7.50, tnPerM: 13.54, currentM: 0.86 },
  { id: 'D2', tag: 'D-07-05', kv: 'KV7002', maxM: 6.20, tnPerM: 11.63, currentM: 4.12 },
  { id: 'D3', tag: 'D-07-06', kv: 'KV7003', maxM: 6.20, tnPerM: 11.63, currentM: 0.18 },
  { id: 'D1', tag: 'D-07-04', kv: 'KV7001', maxM: 6.20, tnPerM: 11.63, currentM: 0.00 },
];

const STORAGE_KEY = 'hypochlorite-storage-v1';
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
    production: 6824,
    startTime: nowLocalInputValue(),
    activeTank: 'D1',
    tanks: DEFAULT_TANKS,
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function fmt(num, digits = 2) {
  if (!Number.isFinite(num)) return '-';
  return num.toLocaleString('el-GR', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function fmtHours(hours) {
  if (!Number.isFinite(hours)) return '-';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h} ώρες ${m} λεπτά`;
}

function fmtDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('el-GR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function tankCalc(t) {
  const maxTn = Math.max(0, Number(t.maxM) || 0) * (Number(t.tnPerM) || 0);
  const currentTn = Math.max(0, Number(t.currentM) || 0) * (Number(t.tnPerM) || 0);
  const remainingTn = Math.max(0, maxTn - currentTn);
  const productionTnHr = (Number(state.production) || 0) / 1000;
  const hours = productionTnHr > 0 ? remainingTn / productionTnHr : NaN;
  const start = new Date(state.startTime);
  const finish = Number.isFinite(hours) ? new Date(start.getTime() + hours * 3600 * 1000) : null;
  const percent = maxTn > 0 ? Math.min(100, Math.max(0, currentTn / maxTn * 100)) : 0;
  return { maxTn, currentTn, remainingTn, productionTnHr, hours, finish, percent };
}

function render() {
  saveState();
  els.production.value = state.production;
  els.startTime.value = state.startTime;

  els.activeTank.innerHTML = state.tanks.map(t => `<option value="${t.id}" ${t.id === state.activeTank ? 'selected' : ''}>${t.id}</option>`).join('');

  const active = state.tanks.find(t => t.id === state.activeTank) || state.tanks[0];
  const ac = tankCalc(active);
  const totalTn = state.tanks.reduce((sum, t) => sum + tankCalc(t).currentTn, 0);
  const totalMax = state.tanks.reduce((sum, t) => sum + tankCalc(t).maxTn, 0);

  els.summary.innerHTML = `
    <div class="summary-card"><b>Παραγωγή</b><span>${fmt(Number(state.production), 0)} kg/hr</span></div>
    <div class="summary-card"><b>Γεμίζει τώρα</b><span>${active.id}</span></div>
    <div class="summary-card"><b>Χρόνος για γέμισμα</b><span>${fmtHours(ac.hours)}</span></div>
    <div class="summary-card"><b>Γεμίζει στις</b><span>${fmtDate(ac.finish)}</span></div>
    <div class="summary-card"><b>Υπόλοιπο στη ${active.id}</b><span>${fmt(ac.remainingTn)} tn</span></div>
    <div class="summary-card"><b>Σύνολο μέσα</b><span>${fmt(totalTn)} tn</span></div>
    <div class="summary-card"><b>Συνολικό max</b><span>${fmt(totalMax)} tn</span></div>
    <div class="summary-card"><b>Πληρότητα εγκατάστασης</b><span>${totalMax ? fmt(totalTn / totalMax * 100, 1) : '-'}%</span></div>
  `;

  els.tankGrid.innerHTML = state.tanks.map((t, idx) => {
    const c = tankCalc(t);
    return `
      <article class="tank-card ${t.id === state.activeTank ? 'active' : ''}">
        <div class="valve"><div class="valve-icon"></div><small>${t.kv}</small><div class="valve-line"></div></div>
        <div class="tank-visual">
          <div class="fill" style="height:${c.percent}%"></div>
          <div class="tank-text">
            <div class="name">${t.id}</div>
            <div class="tag">${t.tag}</div>
            <div class="tn">${fmt(c.currentTn, 1)}<br>tn NaOCl</div>
            <div class="m">${fmt(Number(t.currentM), 2)} m</div>
          </div>
        </div>
        <div class="fields">
          <label>Max m <input data-idx="${idx}" data-field="maxM" type="number" step="0.01" value="${t.maxM}"></label>
          <label>Πραγματικά m τώρα <input data-idx="${idx}" data-field="currentM" type="number" step="0.01" value="${t.currentM}"></label>
          <label>tn / m <input data-idx="${idx}" data-field="tnPerM" type="number" step="0.01" value="${t.tnPerM}" readonly title="Σταθερή τιμή δεξαμενής"></label>
        </div>
        <div class="result">
          Max: <strong>${fmt(c.maxTn)} tn</strong><br>
          Λείπουν: <strong>${fmt(c.remainingTn)} tn</strong><br>
          Χρόνος: <strong>${fmtHours(c.hours)}</strong><br>
          Γεμίζει: <strong>${fmtDate(c.finish)}</strong>
        </div>
      </article>
    `;
  }).join('');

  document.querySelectorAll('[data-field]').forEach(input => {
    input.addEventListener('input', e => {
      const i = Number(e.target.dataset.idx);
      const field = e.target.dataset.field;
      state.tanks[i][field] = Number(e.target.value);
      render();
    });
  });
}

els.production.addEventListener('input', e => { state.production = Number(e.target.value); render(); });
els.startTime.addEventListener('input', e => { state.startTime = e.target.value; render(); });
els.activeTank.addEventListener('change', e => { state.activeTank = e.target.value; render(); });
els.resetBtn.addEventListener('click', () => {
  if (confirm('Να γίνει reset στις αρχικές τιμές;')) {
    localStorage.removeItem(STORAGE_KEY);
    state = loadState();
    render();
  }
});

render();

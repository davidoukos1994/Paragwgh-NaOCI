const defaultTanks = [
  {id:'Z2', code:'D-07-02', maxM:7.50, m:7.50, tnm:13.54, order:''},
  {id:'Z1', code:'D-07-01', maxM:8.65, m:8.10, tnm:11.63, order:''},
  {id:'Z3', code:'D-07-03', maxM:7.50, m:0.86, tnm:13.54, order:1},
  {id:'D2', code:'D-07-05', maxM:6.20, m:4.12, tnm:11.63, order:2},
  {id:'D3', code:'D-07-06', maxM:6.20, m:0.18, tnm:11.63, order:3},
  {id:'D1', code:'D-07-04', maxM:6.20, m:0.00, tnm:11.63, order:4},
];
let state = load() || {production:6824, startTime:toLocalInput(new Date()), tanks:defaultTanks};

function qs(id){return document.getElementById(id)}
function num(v){ if(v === '' || v === null || v === undefined) return 0; return Number(String(v).replace(',', '.')) || 0; }
function fmt(n,d=2){ return Number(n).toLocaleString('el-GR',{minimumFractionDigits:d,maximumFractionDigits:d}); }
function toLocalInput(date){ const z=new Date(date.getTime()-date.getTimezoneOffset()*60000); return z.toISOString().slice(0,16); }
function dateFmt(date){ return date.toLocaleString('el-GR',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
function dur(hours){ if(!isFinite(hours)||hours<=0) return '0ω 00λ'; const h=Math.floor(hours); const m=Math.round((hours-h)*60); return `${h}ω ${String(m).padStart(2,'0')}λ`; }
function save(){ localStorage.setItem('hypo-v4', JSON.stringify(state)); }
function load(){ try{return JSON.parse(localStorage.getItem('hypo-v4'));}catch(e){return null;} }

function tankCalc(t){
  const maxT = Math.max(0, num(t.maxM) * num(t.tnm));
  const curM = Math.min(Math.max(0,num(t.m)), Math.max(0,num(t.maxM)));
  const curT = Math.max(0, curM * num(t.tnm));
  const missT = Math.max(0, maxT - curT);
  const pct = maxT > 0 ? Math.min(100, (curT/maxT)*100) : 0;
  const hours = state.production > 0 ? missT / (state.production/1000) : 0;
  return {maxT, curM, curT, missT, pct, hours};
}

function render(){
  qs('production').value = state.production;
  qs('startTime').value = state.startTime;
  const root = qs('tanks'); root.innerHTML='';
  state.tanks.forEach((t,i)=>{
    const c=tankCalc(t);
    const card=document.createElement('article'); card.className='tank-card';
    card.innerHTML=`
      <div class="tank-title"><span>${t.id}</span><span>${t.code}</span></div>
      <div class="tank-layout">
        <div class="tank-visual">
          ${Array.from({length:9},(_,k)=>`<div class="mark" style="bottom:${(k+1)*10}%"></div>`).join('')}
          <div class="fill" style="height:${c.pct}%"></div>
          <div class="tank-text"><div>${t.id}</div><div>${fmt(c.curT,1)} tn</div><div>${fmt(c.curM,2)} m</div></div>
        </div>
        <div class="fields">
          <label>Max m<input data-i="${i}" data-k="maxM" type="number" step="0.01" inputmode="decimal" value="${t.maxM}"></label>
          <label>Πραγματικά m<input data-i="${i}" data-k="m" type="number" step="0.01" inputmode="decimal" value="${t.m}"></label>
          <label>tn / m<input data-i="${i}" data-k="tnm" type="number" step="0.01" inputmode="decimal" value="${t.tnm}"></label>
          <label>Σειρά<input data-i="${i}" data-k="order" type="number" step="1" inputmode="numeric" value="${t.order}"></label>
          <div class="small-btns"><button class="maxbtn" data-max="${i}" type="button">MAX</button><button class="emptybtn" data-empty="${i}" type="button">EMPTY</button></div>
          <div class="results">
            Τώρα: <b>${fmt(c.curT,2)} tn</b><br>
            Λείπουν: <b>${fmt(c.missT,2)} tn</b><br>
            Χρόνος μόνη της: <b>${dur(c.hours)}</b><br>
            Πλήρωση: <b>${fmt(c.pct,1)}%</b>
          </div>
        </div>
      </div>`;
    root.appendChild(card);
  });
  attachEvents();
  updateSchedule();
}

function attachEvents(){
  document.querySelectorAll('input[data-i]').forEach(inp=>{
    inp.addEventListener('input', e=>{
      const i=Number(e.target.dataset.i), k=e.target.dataset.k;
      state.tanks[i][k] = k==='order' ? e.target.value : e.target.value;
      save(); updateSchedule(); updateCardVisual(i);
    });
  });
  document.querySelectorAll('[data-max]').forEach(btn=>btn.onclick=()=>{ const i=Number(btn.dataset.max); state.tanks[i].m=state.tanks[i].maxM; save(); render(); });
  document.querySelectorAll('[data-empty]').forEach(btn=>btn.onclick=()=>{ const i=Number(btn.dataset.empty); state.tanks[i].m=0; save(); render(); });
}
function updateCardVisual(i){ render(); }

function updateSchedule(){
  const prod=num(qs('production').value); state.production=prod;
  state.startTime=qs('startTime').value || toLocalInput(new Date());
  const start = new Date(state.startTime);
  const calcs = state.tanks.map(t=>({...t, calc:tankCalc(t)}));
  const totalNow = calcs.reduce((s,t)=>s+t.calc.curT,0);
  const totalMax = calcs.reduce((s,t)=>s+t.calc.maxT,0);
  const totalMissing = calcs.reduce((s,t)=>s+t.calc.missT,0);
  qs('totalNow').textContent = `${fmt(totalNow,2)} tn`;
  qs('totalMax').textContent = `${fmt(totalMax,2)} tn`;
  qs('totalMissing').textContent = `${fmt(totalMissing,2)} tn`;
  const ordered = calcs.filter(t=>num(t.order)>0 && t.calc.missT>0.0001).sort((a,b)=>num(a.order)-num(b.order));
  let elapsed=0; let rows=[];
  for(const t of ordered){
    const h = prod>0 ? t.calc.missT/(prod/1000) : 0;
    const end = new Date(start.getTime() + (elapsed+h)*3600000);
    rows.push({id:t.id, order:num(t.order), miss:t.calc.missT, h, end});
    elapsed += h;
  }
  qs('allFullTime').textContent = rows.length ? `${dateFmt(rows[rows.length-1].end)} (${dur(elapsed)})` : 'Όλα γεμάτα / χωρίς σειρά';
  const sch=qs('schedule');
  sch.innerHTML = '<div class="schedule-row"><span>Σειρά</span><span>Δεξαμενή</span><span>Λείπουν</span><span>Γεμίζει στις</span></div>' +
    (rows.length ? rows.map(r=>`<div class="schedule-row"><span class="badge">${r.order}</span><span>${r.id} — ${dur(r.h)}</span><span>${fmt(r.miss,2)} tn</span><span>${dateFmt(r.end)}</span></div>`).join('') : '<p>Βάλε σειρά γεμίσματος στις άδειες δεξαμενές.</p>');
  save();
}

qs('production').addEventListener('input', updateSchedule);
qs('startTime').addEventListener('input', updateSchedule);
qs('nowBtn').onclick=()=>{state.startTime=toLocalInput(new Date()); save(); render();};
qs('saveBtn').onclick=()=>{save(); alert('Αποθηκεύτηκε στη συσκευή.');};
qs('resetBtn').onclick=()=>{ if(confirm('Να γίνει reset στα αρχικά δεδομένα;')){localStorage.removeItem('hypo-v4'); state={production:6824,startTime:toLocalInput(new Date()),tanks:defaultTanks}; render(); }};
if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{})); }
render();

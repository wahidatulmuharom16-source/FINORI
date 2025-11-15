// -------------------- Data & Config --------------------
const STORAGE_KEY = 'finance_app_v3';
const THEME_KEY = 'finance_app_theme';
let state = {
  transactions: [], // {id, desc, amount, type, category, date}
  categories: [
    {id:'makan', name:'Makan', emoji:'🍔', color:'#ffd6e8'},
    {id:'transport', name:'Transport', emoji:'🚌', color:'#d8e9ff'},
    {id:'hiburan', name:'Hiburan', emoji:'🎬', color:'#f3d9ff'},
    {id:'tagihan', name:'Tagihan', emoji:'💡', color:'#ffd8b3'},
    {id:'belanja', name:'Belanja', emoji:'🛍️', color:'#f1d9ff'},
    {id:'tabungan', name:'Tabungan', emoji:'🏦', color:'#d4f8d4'},
    {id:'lainnya', name:'Lainnya', emoji:'✨', color:'#e0c1f6'}
  ],
  goal: 0
};

// -------------------- Storage --------------------
function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw){
    try{ const p = JSON.parse(raw); Object.assign(state, p); }
    catch(e){ console.warn('state parse err', e) }
  } else {
    // sample data
    state.transactions = [
      {id: id(), desc:'gaji ✨', amount:12000000, type:'income', category:'tabungan', date: todayOffset(-10) },
      {id: id(), desc:'makan 🍔', amount:250000, type:'expense', category:'makan', date: todayOffset(-5) }
    ];
    saveState();
  }
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

// -------------------- Utils --------------------
function id(){ return Math.random().toString(36).slice(2,9); }
function formatIDR(n){ return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n||0)); }
function todayOffset(offset=0){ const d=new Date(); d.setDate(d.getDate()+offset); return d.toISOString().slice(0,10); }
function parseDate(s){ return new Date(s+'T00:00:00'); }

// -------------------- Page Init --------------------
document.addEventListener('DOMContentLoaded', ()=> {
  loadState();
  applySavedTheme();            // apply theme early
  attachGlobalHandlers();
  const page = document.body.dataset.page;
  if(page === 'home') initHome();
  if(page === 'transaksi') initTransaksi();
  if(page === 'laporan') initLaporan();
});

// -------------------- Global UI --------------------
function attachGlobalHandlers(){
  // theme toggle(s)
  const themeBtns = document.querySelectorAll('#themeToggle');
  themeBtns.forEach(b=>b?.addEventListener('click', toggleTheme));

  // hide music button(s) because user requested audio removed
  document.querySelectorAll('#musicBtn').forEach(b=>{
    if(b && b.style) b.style.display = 'none';
  });

  // prefill date inputs if any
  document.querySelectorAll('input[type="date"]').forEach(inp=>{
    if(!inp.value) inp.value = todayOffset(0);
  });
}

// Theme persistence across pages
function toggleTheme(){
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  updateThemeButtons(isDark);
}
function applySavedTheme(){
  const t = localStorage.getItem(THEME_KEY) || 'light';
  if(t === 'dark') document.body.classList.add('dark');
  else document.body.classList.remove('dark');
  updateThemeButtons(t === 'dark');
}
function updateThemeButtons(isDark){
  document.querySelectorAll('#themeToggle').forEach(b=>{
    if(!b) return;
    b.textContent = isDark ? '☀️' : '🌙';
  });
}

// -------------------- HOME PAGE --------------------
function initHome(){
  renderHomeSummary();
  renderHomeGoal();
  renderHomeRecent();

  document.getElementById('homeSaveGoal')?.addEventListener('click', ()=>{
    const v = Number(document.getElementById('homeGoalInput').value || 0);
    state.goal = v; saveState(); renderHomeGoal(); renderHomeSummary();
  });
}

function renderHomeSummary(){
  const inc = sumByType('income'), exp = sumByType('expense'), bal = inc - exp;
  const elInc = document.getElementById('sumIncome'), elExp = document.getElementById('sumExpense'), elBal = document.getElementById('sumBalance');
  if(elInc) elInc.textContent = formatIDR(inc);
  if(elExp) elExp.textContent = formatIDR(exp);
  if(elBal) elBal.textContent = formatIDR(bal);

  // goal progress
  const goalText = document.getElementById('homeGoalText'), progEl = document.getElementById('homeProgress');
  if(goalText && progEl){
    if(state.goal && state.goal>0){
      const percent = Math.min(100, Math.max(0, (bal/state.goal)*100 ));
      goalText.textContent = `Progres: ${percent.toFixed(1)}% dari ${formatIDR(state.goal)}`;
      progEl.style.width = percent + '%';
      progEl.style.background = percent>=100 ? 'linear-gradient(90deg,#7EE787,#28a745)' : '';
    } else {
      goalText.textContent = 'Belum ada target.';
      progEl.style.width = '0%';
    }
  }
}

function renderHomeGoal(){ const inp = document.getElementById('homeGoalInput'); if(inp) inp.value = state.goal || ''; }

// recent
function renderHomeRecent(){
  const list = document.getElementById('homeRecent');
  if(!list) return;
  list.innerHTML = '';
  const last = [...state.transactions].sort((a,b)=> parseDate(b.date)-parseDate(a.date)).slice(0,5);
  last.forEach(tx=>{
    const li = document.createElement('li');
    li.innerHTML = `${categoryEmoji(tx.category)} ${tx.desc} - <b>${formatIDR(tx.amount)}</b>`;
    list.appendChild(li);
  });
}

// -------------------- TRANSAKSI PAGE --------------------
function initTransaksi(){
  // populate categories
  const catSel = document.getElementById('txCategory');
  if(catSel){
    catSel.innerHTML = '';
    state.categories.forEach(c=>{
      const o = document.createElement('option'); o.value=c.id; o.textContent = `${c.emoji} ${c.name}`; catSel.appendChild(o);
    });
  }

  // form submit
  const form = document.getElementById('txForm');
  if(form){
    form.addEventListener('submit', (e)=>{
      e.preventDefault();
      const idField = form.dataset.editId;
      const desc = document.getElementById('txDesc').value.trim();
      const amount = Number(document.getElementById('txAmount').value || 0);
      const type = document.getElementById('txType').value;
      const category = document.getElementById('txCategory').value;
      const date = document.getElementById('txDate').value || todayOffset();

      if(!desc || !amount) return alert('Isi deskripsi dan jumlah.');

      if(idField){
        // update
        const idx = state.transactions.findIndex(t=>t.id===idField);
        if(idx>=0){ state.transactions[idx] = { id:idField, desc, amount, type, category, date }; }
        delete form.dataset.editId;
      } else {
        state.transactions.unshift({ id: id(), desc, amount, type, category, date });
      }
      saveState();
      form.reset();
      document.querySelectorAll('input[type="date"]').forEach(inp=> inp.value = todayOffset());
      renderTxList();
    });
  }

  const resetBtn = document.getElementById('txReset');
  if(resetBtn) resetBtn.addEventListener('click', ()=>{
    const f = document.getElementById('txForm'); if(f){ delete f.dataset.editId; f.reset(); const d = document.getElementById('txDate'); if(d) d.value = todayOffset(); }
  });

  // search/filter/sort
  const searchEl = document.getElementById('search');
  if(searchEl) searchEl.addEventListener('input', renderTxList);
  const filterEl = document.getElementById('filterType');
  if(filterEl) filterEl.addEventListener('change', renderTxList);
  const sortEl = document.getElementById('sortBy');
  if(sortEl) sortEl.addEventListener('change', renderTxList);

  // export
  const exportBtn = document.getElementById('exportCSV');
  if(exportBtn) exportBtn.addEventListener('click', exportCSV);

  // modal controls (if modal exists)
  const modalClose = document.getElementById('modalClose');
  if(modalClose) modalClose.addEventListener('click', closeModal);
  const modalEdit = document.getElementById('modalEdit');
  if(modalEdit) modalEdit.addEventListener('click', ()=> {
    const id = document.getElementById('modal')?.dataset.txid;
    if(id){ openEditTx(id); closeModal(); }
  });
  const modalDelete = document.getElementById('modalDelete');
  if(modalDelete) modalDelete.addEventListener('click', ()=> {
    const id = document.getElementById('modal')?.dataset.txid;
    if(id && confirm('Hapus transaksi ini?')) { state.transactions = state.transactions.filter(t=>t.id!==id); saveState(); closeModal(); renderTxList(); }
  });

  renderTxList();
}

function renderTxList(){
  const listEl = document.getElementById('txList');
  if(!listEl) return;
  const q = (document.getElementById('search')?.value||'').toLowerCase();
  const filter = document.getElementById('filterType')?.value || 'all';
  const sort = document.getElementById('sortBy')?.value || 'newest';

  let items = [...state.transactions];
  if(filter!=='all') items = items.filter(t=>t.type===filter);
  if(q) items = items.filter(t=> t.desc.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) );

  // sort
  if(sort==='newest') items.sort((a,b)=> parseDate(b.date)-parseDate(a.date));
  if(sort==='amount_desc') items.sort((a,b)=> b.amount - a.amount);
  if(sort==='amount_asc') items.sort((a,b)=> a.amount - b.amount);

  listEl.innerHTML = '';
  items.forEach(tx=>{
    const li = document.createElement('li'); li.className = 'tx-item';
    const cat = state.categories.find(c=>c.id===tx.category) || {color:'#eee', emoji:'' , name: tx.category};
    li.innerHTML = `
      <div class="tx-left">
        <div class="cat-badge" style="background:${cat.color}">${cat.emoji}</div>
        <div>
          <div><strong>${tx.desc}</strong></div>
          <div class="muted small">${tx.date} • ${ (tx.type==='income') ? 'Pemasukan' : 'Pengeluaran' } • ${cat.name || tx.category}</div>
        </div>
      </div>
      <div class="tx-right">
        <div class="amount">${ tx.type==='income' ? '+' : '-' } ${formatIDR(tx.amount)}</div>
        <div style="margin-top:8px">
          <button class="btn ghost" onclick="openModal('${tx.id}')">Detail</button>
        </div>
      </div>
    `;
    listEl.appendChild(li);
  });
}

// modal
function openModal(id){
  const tx = state.transactions.find(t=>t.id===id);
  if(!tx) return;
  const modal = document.getElementById('modal'); if(!modal) return;
  modal.style.display='flex'; modal.dataset.txid = id;
  document.getElementById('modalTitle').textContent = tx.desc;
  document.getElementById('modalBody').innerHTML = `
    <p><b>Jumlah:</b> ${formatIDR(tx.amount)}</p>
    <p><b>Tipe:</b> ${tx.type}</p>
    <p><b>Kategori:</b> ${categoryEmoji(tx.category)} ${categoryName(tx.category)}</p>
    <p><b>Tanggal:</b> ${tx.date}</p>
  `;
}
function closeModal(){ const m = document.getElementById('modal'); if(m){ m.style.display='none'; delete m.dataset.txid; } }

// edit from modal
function openEditTx(id){
  const tx = state.transactions.find(t=>t.id===id);
  if(!tx) return;
  const form = document.getElementById('txForm'); if(!form) return;
  form.dataset.editId = id;
  document.getElementById('txDesc').value = tx.desc;
  document.getElementById('txAmount').value = tx.amount;
  document.getElementById('txType').value = tx.type;
  document.getElementById('txCategory').value = tx.category;
  document.getElementById('txDate').value = tx.date;
}

// -------------------- EXPORT CSV --------------------
function exportCSV(){
  const rows = [['id','date','desc','type','category','amount']];
  state.transactions.forEach(t=> rows.push([t.id,t.date,t.desc,t.type,t.category,t.amount]));
  const csv = rows.map(r=> r.map(cell=> `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `transactions_${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(a.href);
}

// -------------------- LAPORAN PAGE --------------------
function initLaporan(){
  renderLaporanCharts();
  renderYearSummary();
  // redraw on resize
  window.addEventListener('resize', ()=> {
    renderLaporanCharts();
  });
}

// chart instances
let barChart=null, donutChart=null;
function renderLaporanCharts(){
  const monthly = groupByMonth(state.transactions, 6); // last 6 months
  const labels = monthly.map(m=>m.label);
  const incData = monthly.map(m=>m.income);
  const expData = monthly.map(m=>m.expense);

  // bar chart
  const ctx = document.getElementById('barChart');
  if(!ctx) return;
  if(barChart) barChart.destroy();
  barChart = new Chart(ctx, {
    type:'bar',
    data:{
      labels, datasets:[
        { label:'Pemasukan', data:incData, backgroundColor:'#b6f2c6'},
        { label:'Pengeluaran', data:expData, backgroundColor:'#ffd6e8'}
      ]
    },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}} }
  });

  // donut by category
  const catAgg = {};
  state.transactions.forEach(t=> { catAgg[t.category] = (catAgg[t.category]||0) + Math.abs(Number(t.amount)); });
  const catLabels = Object.keys(catAgg).map(k=> categoryName(k));
  const catData = Object.keys(catAgg).map(k=> catAgg[k]);
  const catColors = Object.keys(catAgg).map(k=> (state.categories.find(c=>c.id===k)||{color:'#eee'}).color );

  const ctx2 = document.getElementById('donutChart');
  if(!ctx2) return;
  if(donutChart) donutChart.destroy();
  donutChart = new Chart(ctx2, {
    type:'doughnut',
    data:{ labels:catLabels, datasets:[{ data:catData, backgroundColor:catColors }]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}} }
  });
}

function renderYearSummary(){
  const thisYear = new Date().getFullYear();
  const inc = state.transactions.filter(t=>parseDate(t.date).getFullYear()===thisYear && t.type==='income').reduce((s,t)=>s+t.amount,0);
  const exp = state.transactions.filter(t=>parseDate(t.date).getFullYear()===thisYear && t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const el = document.getElementById('yearSummary');
  if(!el) return;
  el.innerHTML = `<p>Total Pemasukan tahun ${thisYear}: <b>${formatIDR(inc)}</b></p>
                  <p>Total Pengeluaran tahun ${thisYear}: <b>${formatIDR(exp)}</b></p>
                  <p>Saldo: <b>${formatIDR(inc-exp)}</b></p>`;
}

// -------------------- Helpers --------------------
function sumByType(type){ return state.transactions.filter(t=>t.type===type).reduce((s,t)=>s+Number(t.amount),0); }
function categoryEmoji(catId){ const c = state.categories.find(x=>x.id===catId); return c? c.emoji : ''; }
function categoryName(catId){ const c = state.categories.find(x=>x.id===catId); return c? c.name : catId; }

function groupByMonth(transactions, last = 6) {
  const map = {};

  transactions.forEach(t => {
    const d = parseDate(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map[key]) map[key] = { income: 0, expense: 0 };
    if (t.type === 'income') map[key].income += Number(t.amount);
    else map[key].expense += Number(t.amount);
  });

  const now = new Date();
  const months = [];

  for (let i = last - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

    months.push({
      label,
      income: map[key]?.income || 0,
      expense: map[key]?.expense || 0
    });
  }

  return months;
}

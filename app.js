// =============================================
// CATEGORIE DEFAULT
// Usate al primo avvio se non ce ne sono salvate.
// =============================================
const DEFAULT_CATEGORIES = [
  { name: 'Cibo',      color: '#1D9E75' },
  { name: 'Casa',      color: '#378ADD' },
  { name: 'Trasporti', color: '#BA7517' },
  { name: 'Salute',    color: '#D4537E' },
  { name: 'Svago',     color: '#7F77DD' },
  { name: 'Shopping',  color: '#D85A30' },
  { name: 'Bollette',  color: '#888780' },
  { name: 'Altro',     color: '#3B6D11' },
];

// Chiavi localStorage
const STORAGE_KEY  = 'spese_v1';
const BUDGET_KEY   = 'budget_v1';
const CAT_KEY      = 'categorie_v1';

const MONTHS = [
  'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'
];

// =============================================
// STATO
// =============================================
let expenses    = [];
let budgets     = {};
let categories  = [];
let currentDate = new Date();
let pieChart    = null;
let barChart    = null;
let savingsChart = null;

// =============================================
// PERSISTENZA
// =============================================
function loadData() {
  try { expenses   = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch(e) { expenses = []; }
  try { budgets    = JSON.parse(localStorage.getItem(BUDGET_KEY))  || {}; } catch(e) { budgets = {}; }
  try {
    const saved = JSON.parse(localStorage.getItem(CAT_KEY));
    categories = saved && saved.length ? saved : [...DEFAULT_CATEGORIES];
  } catch(e) { categories = [...DEFAULT_CATEGORIES]; }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    localStorage.setItem(BUDGET_KEY,  JSON.stringify(budgets));
    localStorage.setItem(CAT_KEY,     JSON.stringify(categories));
  } catch(e) { console.error('Errore salvataggio:', e); }
}

// =============================================
// UTILITÀ
// =============================================
function getMonthKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function fmt(n) {
  return '€' + Math.abs(n).toFixed(2).replace('.', ',');
}

// Restituisce il colore di una categoria dato il nome
function getCatColor(name) {
  const cat = categories.find(c => c.name === name);
  return cat ? cat.color : '#888780';
}

// Genera colori chiari (bg) e scuri (testo) dal colore hex
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return {r, g, b};
}
function catBg(color) {
  const {r,g,b} = hexToRgb(color);
  return `rgba(${r},${g},${b},0.13)`;
}
function catText(color) {
  const {r,g,b} = hexToRgb(color);
  // Scuriamo il colore per il testo
  return `rgb(${Math.round(r*0.5)},${Math.round(g*0.5)},${Math.round(b*0.5)})`;
}

// Spese del mese corrente, ordinate dalla più recente
function getCurrentMonthExpenses() {
  return expenses
    .filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === currentDate.getMonth() &&
             d.getFullYear() === currentDate.getFullYear();
    })
    .sort((a,b) => new Date(b.date) - new Date(a.date));
}

// =============================================
// GESTIONE TABS
// =============================================
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab[onclick="switchTab('${name}')"]`).classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');

  // Rendiamo i grafici solo quando il tab è visibile
  if (name === 'grafici') renderCharts();
  if (name === 'spese')   renderAllExpenses();
  if (name === 'categorie') renderCatList();
}

// =============================================
// POPOLA I SELECT CATEGORIE
// Aggiorna tutti i <select> categoria nell'app.
// =============================================
function populateCategorySelects() {
  const selects = ['category', 'editCategory', 'filterCat'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const current = el.value;
    if (id === 'filterCat') {
      el.innerHTML = '<option value="">Tutte le categorie</option>';
    } else {
      el.innerHTML = '<option value="">Seleziona categoria</option>';
    }
    categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.name;
      el.appendChild(opt);
    });
    el.value = current; // ripristina la selezione
  });
}

// =============================================
// AZIONI UTENTE
// =============================================
function changeMonth(direction) {
  currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1);
  render();
}

function saveBudget() {
  const val = parseFloat(document.getElementById('budgetInput').value);
  if (isNaN(val) || val < 0) { alert('Inserisci un importo valido.'); return; }
  budgets[getMonthKey(currentDate)] = val;
  saveData();
  render();
}

function addExpense() {
  const desc     = document.getElementById('desc').value.trim();
  const amount   = parseFloat(document.getElementById('amount').value);
  const date     = document.getElementById('date').value;
  const category = document.getElementById('category').value;
  if (!desc || isNaN(amount) || amount <= 0 || !date || !category) {
    alert('Compila tutti i campi correttamente.');
    return;
  }
  expenses.push({ id: Date.now(), desc, amount, date, category });
  saveData();
  document.getElementById('desc').value     = '';
  document.getElementById('amount').value   = '';
  document.getElementById('category').value = '';
  const d = new Date(date);
  currentDate = new Date(d.getFullYear(), d.getMonth(), 1);
  render();
}

function deleteExpense(id) {
  if (!confirm('Eliminare questa spesa?')) return;
  expenses = expenses.filter(e => e.id !== id);
  saveData();
  render();
  renderAllExpenses();
}

// --- MODIFICA SPESA ---

// Apre il modale precompilato con i dati della spesa
function openEditModal(id) {
  const e = expenses.find(x => x.id === id);
  if (!e) return;
  populateCategorySelects();
  document.getElementById('editId').value       = id;
  document.getElementById('editDesc').value     = e.desc;
  document.getElementById('editAmount').value   = e.amount;
  document.getElementById('editDate').value     = e.date;
  document.getElementById('editCategory').value = e.category;
  document.getElementById('editModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('editModal').style.display = 'none';
}

// Salva le modifiche della spesa
function saveEdit() {
  const id       = parseInt(document.getElementById('editId').value);
  const desc     = document.getElementById('editDesc').value.trim();
  const amount   = parseFloat(document.getElementById('editAmount').value);
  const date     = document.getElementById('editDate').value;
  const category = document.getElementById('editCategory').value;
  if (!desc || isNaN(amount) || amount <= 0 || !date || !category) {
    alert('Compila tutti i campi correttamente.');
    return;
  }
  const idx = expenses.findIndex(e => e.id === id);
  if (idx !== -1) {
    expenses[idx] = { id, desc, amount, date, category };
    saveData();
  }
  closeModal();
  render();
  renderAllExpenses();
}

// =============================================
// CATEGORIE PERSONALIZZATE
// =============================================
function addCategory() {
  const name  = document.getElementById('newCatName').value.trim();
  const color = document.getElementById('newCatColor').value;
  if (!name) { alert('Inserisci un nome per la categoria.'); return; }
  if (categories.find(c => c.name.toLowerCase() === name.toLowerCase())) {
    alert('Questa categoria esiste già.');
    return;
  }
  categories.push({ name, color });
  saveData();
  document.getElementById('newCatName').value = '';
  populateCategorySelects();
  renderCatList();
}

function deleteCategory(name) {
  // Controlliamo se ci sono spese che usano questa categoria
  const inUse = expenses.some(e => e.category === name);
  if (inUse) {
    alert('Non puoi eliminare questa categoria perché è usata da alcune spese.');
    return;
  }
  if (!confirm('Eliminare la categoria "' + name + '"?')) return;
  categories = categories.filter(c => c.name !== name);
  saveData();
  populateCategorySelects();
  renderCatList();
}

// Renderizza la lista delle categorie nel tab Categorie
function renderCatList() {
  const el = document.getElementById('catList');
  if (!categories.length) {
    el.innerHTML = '<div class="empty">Nessuna categoria</div>';
    return;
  }
  el.innerHTML = categories.map(c => {
    const isDefault = DEFAULT_CATEGORIES.some(d => d.name === c.name);
    return `
      <div class="cat-manage-item">
        <span class="cat-color-dot" style="background:${c.color}"></span>
        <span class="cat-name">${c.name}</span>
        ${isDefault ? '<span class="cat-default-badge">default</span>' : ''}
        <button class="cat-del-btn" onclick="deleteCategory('${c.name}')" title="Elimina">🗑</button>
      </div>
    `;
  }).join('');
}

// =============================================
// FILTRI (tab Tutte le spese)
// =============================================
function resetFilters() {
  document.getElementById('filterCat').value  = '';
  document.getElementById('filterFrom').value = '';
  document.getElementById('filterTo').value   = '';
  renderAllExpenses();
}

function renderAllExpenses() {
  const cat      = document.getElementById('filterCat').value;
  const fromVal  = document.getElementById('filterFrom').value;
  const toVal    = document.getElementById('filterTo').value;
  const fromDate = fromVal ? new Date(fromVal) : null;
  const toDate   = toVal   ? new Date(toVal)   : null;
  if (toDate) toDate.setHours(23,59,59);

  let filtered = [...expenses].sort((a,b) => new Date(b.date) - new Date(a.date));
  if (cat)      filtered = filtered.filter(e => e.category === cat);
  if (fromDate) filtered = filtered.filter(e => new Date(e.date) >= fromDate);
  if (toDate)   filtered = filtered.filter(e => new Date(e.date) <= toDate);

  const totalFiltrato = filtered.reduce((s,e) => s + e.amount, 0);
  document.getElementById('allExpensesTitle').textContent =
    'Spese trovate: ' + filtered.length + ' — Totale: ' + fmt(totalFiltrato);

  const el = document.getElementById('allExpenseList');
  if (!filtered.length) {
    el.innerHTML = '<div class="empty">Nessuna spesa trovata</div>';
    return;
  }
  el.innerHTML = filtered.map(e => buildExpenseRow(e)).join('');
}

// =============================================
// GRAFICI ANDAMENTO (tab Grafici)
// =============================================
function renderCharts() {
  // Calcoliamo i dati degli ultimi 12 mesi
  const labels   = [];
  const speseDati = [];
  const rispDati  = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const key = getMonthKey(d);
    const meseName = MONTHS[d.getMonth()].slice(0,3) + ' ' + String(d.getFullYear()).slice(2);
    labels.push(meseName);

    // Totale spese del mese
    const meseSpese = expenses
      .filter(e => {
        const ed = new Date(e.date);
        return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear();
      })
      .reduce((s,e) => s + e.amount, 0);

    const meseBudget = budgets[key] || 0;
    const risparmio  = meseBudget - meseSpese; // positivo = risparmio, negativo = sforato

    speseDati.push(parseFloat(meseSpese.toFixed(2)));
    rispDati.push(parseFloat(risparmio.toFixed(2)));
  }

  // --- Grafico spese mensili (barre) ---
  if (barChart) { barChart.destroy(); barChart = null; }
  barChart = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Spese (€)',
        data: speseDati,
        backgroundColor: 'rgba(163, 45, 45, 0.7)',
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { callback: v => '€' + v } }
      }
    }
  });

  // --- Grafico risparmi mensili (linea) ---
  if (savingsChart) { savingsChart.destroy(); savingsChart = null; }
  savingsChart = new Chart(document.getElementById('savingsChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Risparmio (€)',
        data: rispDati,
        borderColor: '#1D9E75',
        backgroundColor: 'rgba(29,158,117,0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: rispDati.map(v => v >= 0 ? '#1D9E75' : '#A32D2D'),
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          ticks: { callback: v => '€' + v },
          // Linea dello zero evidenziata
          grid: { color: ctx => ctx.tick.value === 0 ? '#A32D2D' : '#e0dfd8' }
        }
      }
    }
  });
}

// =============================================
// COSTRUISCE UNA RIGA SPESA (riutilizzabile)
// =============================================
function buildExpenseRow(e) {
  const color   = getCatColor(e.category);
  const bg      = catBg(color);
  const text    = catText(color);
  const d       = new Date(e.date);
  const dateStr = d.toLocaleDateString('it-IT', { day:'2-digit', month:'short', year:'2-digit' });
  return `
    <div class="expense-item">
      <span class="cat-badge" style="background:${bg};color:${text}">${e.category}</span>
      <span class="exp-desc">${e.desc}</span>
      <span class="exp-date">${dateStr}</span>
      <span class="exp-amount">${fmt(e.amount)}</span>
      <div class="action-btns">
        <button class="edit-btn" onclick="openEditModal(${e.id})" title="Modifica">✏️</button>
        <button class="del-btn"  onclick="deleteExpense(${e.id})"  title="Elimina">🗑</button>
      </div>
    </div>
  `;
}

// =============================================
// RENDER PRINCIPALE (Dashboard)
// =============================================
function render() {
  const key    = getMonthKey(currentDate);
  const budget = budgets[key] || 0;
  const list   = getCurrentMonthExpenses();
  const total  = list.reduce((s,e) => s + e.amount, 0);
  const left   = budget - total;

  // Titolo mese
  document.getElementById('monthLabel').textContent =
    MONTHS[currentDate.getMonth()] + ' ' + currentDate.getFullYear();
  document.getElementById('budgetInput').value = budget || '';

  // --- Metriche ---
  document.getElementById('metricBudget').textContent = fmt(budget);
  document.getElementById('metricSpent').textContent  = fmt(total);

  // Rimanente
  const leftEl = document.getElementById('metricLeft');
  leftEl.textContent = (left < 0 ? '-' : '') + fmt(left);
  leftEl.className = 'metric-value ' + (
    budget === 0 ? '' : left < 0 ? 'danger' : left / budget < 0.2 ? 'warn' : 'success'
  );

  // Risparmio del mese (uguale al rimanente quando budget > 0)
  const savEl = document.getElementById('metricSaving');
  if (budget === 0) {
    savEl.textContent = '—';
    savEl.className   = 'metric-value';
  } else if (left >= 0) {
    savEl.textContent = fmt(left);
    savEl.className   = 'metric-value success';
  } else {
    savEl.textContent = '-' + fmt(left);
    savEl.className   = 'metric-value danger';
  }

  // --- Barra progresso ---
  const pct  = budget > 0 ? Math.min((total / budget) * 100, 100) : 0;
  const fill = document.getElementById('progressFill');
  fill.style.width      = pct.toFixed(1) + '%';
  fill.style.background = pct >= 100 ? '#A32D2D' : pct >= 80 ? '#BA7517' : '#1D9E75';
  document.getElementById('progressPct').textContent = budget > 0 ? Math.round(pct) + '%' : '';
  document.getElementById('progressText').textContent =
    budget === 0 ? 'Imposta le entrate mensili in alto' :
    left < 0     ? 'Sforato di ' + fmt(Math.abs(left)) :
                   'Rimanente ' + fmt(left) + ' su ' + fmt(budget);

  // --- Lista spese del mese ---
  const expEl = document.getElementById('expenseList');
  expEl.innerHTML = list.length === 0
    ? '<div class="empty">Nessuna spesa questo mese</div>'
    : list.map(e => buildExpenseRow(e)).join('');

  // --- Grafico torta ---
  const byCat = {};
  list.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
  const cats   = Object.keys(byCat);
  const vals   = cats.map(c => byCat[c]);
  const colors = cats.map(c => getCatColor(c));

  if (pieChart) { pieChart.destroy(); pieChart = null; }
  if (cats.length > 0) {
    pieChart = new Chart(document.getElementById('pieChart'), {
      type: 'doughnut',
      data: {
        labels: cats,
        datasets: [{ data: vals, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ' ' + ctx.label + ': ' + fmt(ctx.raw) +
                           ' (' + Math.round(ctx.raw / total * 100) + '%)'
            }
          }
        },
        cutout: '65%'
      }
    });
  }

  document.getElementById('catLegend').innerHTML = cats.map((c,i) =>
    `<span class="cat-dot">
      <span class="dot" style="background:${colors[i]}"></span>
      ${c} (${Math.round(vals[i]/total*100)}%)
    </span>`
  ).join('');

  // Aggiorna i select categorie
  populateCategorySelects();
}

// =============================================
// INIZIALIZZAZIONE
// =============================================
document.getElementById('date').valueAsDate = new Date();
// Chiudi modale cliccando fuori
document.getElementById('editModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});
loadData();
render();

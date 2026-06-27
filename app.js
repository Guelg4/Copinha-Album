/* =========================================================
   app.js — Álbum Virtual Copinha 2026
   ========================================================= */

/* ── Times & estrutura do álbum ── */
const TIMES = [
  { cod:'BRA', nome:'Brasil',    flag:'🇧🇷', cls:'bra', total:32 },
  { cod:'ARG', nome:'Argentina', flag:'🇦🇷', cls:'arg', total:8  },
  { cod:'GER', nome:'Alemanha',  flag:'🇩🇪', cls:'ger', total:8  },
  { cod:'USA', nome:'EUA',       flag:'🇺🇸', cls:'usa', total:8  },
  { cod:'JPN', nome:'Japão',     flag:'🇯🇵', cls:'jpn', total:8  },
  { cod:'MEX', nome:'México',    flag:'🇲🇽', cls:'mex', total:8  },
  { cod:'ENG', nome:'Inglaterra',flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', cls:'eng', total:8  },
  { cod:'ESP', nome:'Espanha',   flag:'🇪🇸', cls:'esp', total:8  },
  { cod:'CAN', nome:'Canadá',    flag:'🇨🇦', cls:'can', total:8  },
  { cod:'POR', nome:'Portugal',  flag:'🇵🇹', cls:'por', total:8  },
  { cod:'MAR', nome:'Marrocos',  flag:'🇲🇦', cls:'mar', total:8  },
  { cod:'URU', nome:'Uruguai',   flag:'🇺🇾', cls:'uru', total:8  },
  { cod:'FRA', nome:'França',    flag:'🇫🇷', cls:'fra', total:8  },
];

/* Gera lista completa de figurinhas */
function gerarFigurinhas() {
  const lista = [];
  TIMES.forEach(t => {
    for (let i = 1; i <= t.total; i++) {
      lista.push({ id: `${t.cod}-${i}`, cod: t.cod, num: i, torcida: i === t.total });
    }
  });
  return lista;
}
const TODAS_FIGS = gerarFigurinhas(); // [{id, cod, num, torcida}, ...]

const PACOTE_SIZE    = 5;
const HORAS_PACOTE   = 6;
const MS_PACOTE      = HORAS_PACOTE * 60 * 60 * 1000;

/* ── Estado global ── */
let currentUser    = null;
let userDoc        = null; // dados do Firestore
let jogadoresCache = {};   // { 'BRA-1': { nome, foto }, ... }
let currentTab     = 'album';
let timerInterval  = null;

/* =========================================================
   AUTH
   ========================================================= */
auth.onAuthStateChanged(async user => {
  if (user) {
    currentUser = user;
    await loadUserData();
    await loadJogadores();
    hideLoading();
    showScreen('album');
    initUI();
    startPacoteTimer();
  } else {
    currentUser = null;
    hideLoading();
    showScreen('login');
  }
});

async function doLogin() {
  const email = document.getElementById('inp-email').value.trim();
  const pass  = document.getElementById('inp-pass').value;
  const err   = document.getElementById('login-err');
  const btn   = document.getElementById('btn-login');

  if (!email || !pass) { showErr(err, 'Preencha todos os campos.'); return; }

  btn.disabled = true; btn.textContent = 'Entrando…';
  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch(e) {
    showErr(err, traduzirErroAuth(e.code));
    btn.disabled = false; btn.textContent = 'Entrar';
  }
}

async function doRegister() {
  const nome  = document.getElementById('inp-nome').value.trim();
  const email = document.getElementById('inp-reg-email').value.trim();
  const pass  = document.getElementById('inp-reg-pass').value;
  const err   = document.getElementById('reg-err');

  if (!nome || !email || !pass) { showErr(err, 'Preencha todos os campos.'); return; }
  if (pass.length < 6)          { showErr(err, 'Senha deve ter pelo menos 6 caracteres.'); return; }

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    // Cria documento do usuário
    await db.collection('users').doc(cred.user.uid).set({
      nome,
      email,
      figurinhas:  [],   // ids colados
      repetidas:   {},   // { id: quantidade }
      pacotes:     1,    // começa com 1 pacote de boas-vindas
      ultimoPacote: Date.now() - MS_PACOTE,
      criadoEm:    Date.now(),
    });
  } catch(e) {
    showErr(err, traduzirErroAuth(e.code));
  }
}

function doLogout() {
  if (timerInterval) clearInterval(timerInterval);
  auth.signOut();
}

function traduzirErroAuth(code) {
  const map = {
    'auth/user-not-found':    'Usuário não encontrado.',
    'auth/wrong-password':    'Senha incorreta.',
    'auth/invalid-email':     'E-mail inválido.',
    'auth/email-already-in-use': 'E-mail já cadastrado.',
    'auth/weak-password':     'Senha muito fraca.',
    'auth/invalid-credential':'E-mail ou senha incorretos.',
  };
  return map[code] || 'Erro ao autenticar. Tente novamente.';
}

/* =========================================================
   FIRESTORE — dados do usuário
   ========================================================= */
async function loadUserData() {
  const snap = await db.collection('users').doc(currentUser.uid).get();
  if (!snap.exists) {
    // cria doc se não existir (caso raro)
    await db.collection('users').doc(currentUser.uid).set({
      nome: currentUser.displayName || 'Jogador',
      email: currentUser.email,
      figurinhas: [], repetidas: {}, pacotes: 1,
      ultimoPacote: Date.now() - MS_PACOTE,
      criadoEm: Date.now(),
    });
    userDoc = (await db.collection('users').doc(currentUser.uid).get()).data();
  } else {
    userDoc = snap.data();
  }
}

async function saveUserData(updates) {
  await db.collection('users').doc(currentUser.uid).update(updates);
  Object.assign(userDoc, updates);
}

/* ── Jogadores (cadastrados pelo admin) ── */
async function loadJogadores() {
  const snap = await db.collection('jogadores').get();
  jogadoresCache = {};
  snap.forEach(doc => { jogadoresCache[doc.id] = doc.data(); });
}

/* =========================================================
   PACOTES
   ========================================================= */
function calcPacotesDisp() {
  const agora = Date.now();
  const desde = userDoc.ultimoPacote || 0;
  const ganhos = Math.floor((agora - desde) / MS_PACOTE);
  return (userDoc.pacotes || 0) + ganhos;
}

function calcProximoPacote() {
  const desde = userDoc.ultimoPacote || 0;
  const proximo = desde + MS_PACOTE;
  return Math.max(0, proximo - Date.now());
}

function startPacoteTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const pacotesDisp = calcPacotesDisp();
    updatePacoteUI(pacotesDisp);
    if (currentTab === 'pacotes') renderTabPacotes();
  }, 1000);
}

function updatePacoteUI(pacotes) {
  const count = document.getElementById('pacote-count');
  const btn   = document.getElementById('btn-abrir');
  if (count) count.textContent = pacotes;
  if (btn)   btn.disabled = pacotes <= 0;
}

async function abrirPacote() {
  const pacotesDisp = calcPacotesDisp();
  if (pacotesDisp <= 0) return;

  // Calcula quantos foram ganhos por tempo
  const agora  = Date.now();
  const desde  = userDoc.ultimoPacote || 0;
  const ganhos = Math.floor((agora - desde) / MS_PACOTE);
  const novoUltimo = desde + ganhos * MS_PACOTE;

  // Sorteia 5 figurinhas aleatórias
  const sorteadas = sortearFigurinhas(PACOTE_SIZE);

  // Separa novas vs repetidas
  const coladas  = new Set(userDoc.figurinhas || []);
  const repetidas = { ...(userDoc.repetidas || {}) };
  const novaColadas = [...coladas];

  sorteadas.forEach(id => {
    if (coladas.has(id)) {
      repetidas[id] = (repetidas[id] || 0) + 1;
    } else {
      novaColadas.push(id);
    }
  });

  // Salva
  const novosPacotes = Math.max(0, (userDoc.pacotes || 0) + ganhos - 1);
  await saveUserData({
    figurinhas: novaColadas,
    repetidas,
    pacotes: novosPacotes,
    ultimoPacote: novoUltimo,
  });

  // Mostra modal
  renderModalPacote(sorteadas, coladas);
  document.getElementById('modal-pacote').classList.add('open');
  updatePacoteUI(calcPacotesDisp());
  updateProgress();
}

function sortearFigurinhas(n) {
  const pool = [...TODAS_FIGS.map(f => f.id)];
  const result = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool[idx]);
    // Mantém no pool (pode sortear repetida)
  }
  return result;
}

function renderModalPacote(sorteadas, coladasAntes) {
  const container = document.getElementById('pacote-cards');
  container.innerHTML = '';
  sorteadas.forEach(id => {
    const fig      = TODAS_FIGS.find(f => f.id === id);
    const jogador  = jogadoresCache[id] || null;
    const isNova   = !coladasAntes.has(id);
    const time     = TIMES.find(t => t.cod === fig.cod);

    const wrap = document.createElement('div');
    wrap.className = `pacote-card-wrap`;

    const figEl = document.createElement('div');
    figEl.className = `figurinha ${isNova ? 'pacote-card-new' : 'pacote-card-rep'}`;
    figEl.style.aspectRatio = '2/3';
    figEl.innerHTML = buildFigHTML(fig, time, jogador, false);

    const label = document.createElement('div');
    label.className = `pacote-card-label ${isNova ? 'label-new' : 'label-rep'}`;
    label.textContent = isNova ? '✨ Nova!' : '🔁 Repetida';

    wrap.appendChild(figEl);
    wrap.appendChild(label);
    container.appendChild(wrap);
  });
}

function fecharPacote() {
  document.getElementById('modal-pacote').classList.remove('open');
  renderCurrentTab();
}

/* =========================================================
   RENDER — Álbum
   ========================================================= */
function buildFigHTML(fig, time, jogador, showRepBadge) {
  const coladas  = new Set(userDoc.figurinhas || []);
  const reps     = userDoc.repetidas || {};
  const colada   = coladas.has(fig.id);
  const nRep     = reps[fig.id] || 0;

  if (!colada) {
    return `<div class="fig-vazia">
      <span class="fig-vazia-num">${fig.num}</span>
      <span class="fig-vazia-icon">❓</span>
    </div>`;
  }

  const nome = jogador?.nome || 'JOGADOR';
  const foto = jogador?.foto || null;
  const extra = showRepBadge && nRep > 0
    ? `<div class="fig-badge-rep">×${nRep + 1}</div>` : '';

  return `
    <div class="fig-colada">
      <div class="fig-header">
        <span class="fig-cod">${fig.cod} ${fig.num}</span>
        <span class="fig-num">26</span>
      </div>
      <div class="fig-logo">26</div>
      ${foto
        ? `<img class="fig-photo" src="${foto}" alt="${nome}" loading="lazy">`
        : `<div class="fig-photo-placeholder">⚽</div>`
      }
      <div class="fig-footer">
        <div class="fig-nome">${nome}</div>
      </div>
    </div>
    ${extra}`;
}

function renderAlbum() {
  const main = document.getElementById('album-main');
  const coladas = new Set(userDoc.figurinhas || []);

  main.innerHTML = TIMES.map(time => {
    const figs = TODAS_FIGS.filter(f => f.cod === time.cod);
    const coladasTime = figs.filter(f => coladas.has(f.id)).length;
    const pct = Math.round((coladasTime / figs.length) * 100);

    const figsHTML = figs.map(fig => {
      const jogador = jogadoresCache[fig.id] || null;
      const isTorcida = fig.torcida;
      return `<div class="figurinha ${isTorcida ? 'fig-torcida' : ''} team-${time.cls}"
                   onclick="openFig('${fig.id}')" title="${fig.cod} ${fig.num}">
        ${buildFigHTML(fig, time, jogador, true)}
      </div>`;
    }).join('');

    return `<div class="team-section team-${time.cls}">
      <div class="team-section-header">
        <div class="team-section-left">
          <span class="team-flag-emoji">${time.flag}</span>
          <div>
            <div class="team-section-name">${time.nome}</div>
            <div class="team-section-count">${coladasTime}/${figs.length} figurinhas</div>
          </div>
        </div>
        <div class="team-prog">${pct}%</div>
      </div>
      <div class="team-section-body">
        <div class="team-fig-grid">${figsHTML}</div>
      </div>
    </div>`;
  }).join('');
}

function renderTabRepetidas() {
  const main = document.getElementById('album-main');
  const reps = userDoc.repetidas || {};
  const ids  = Object.keys(reps).filter(id => reps[id] > 0);

  if (ids.length === 0) {
    main.innerHTML = `<div class="empty-state">
      <span class="empty-icon">🔁</span>
      Nenhuma figurinha repetida ainda!<br>
      <small style="color:var(--gray2)">Abra mais pacotes para acumular repetidas.</small>
    </div>`;
    return;
  }

  const coladas = new Set(userDoc.figurinhas || []);
  main.innerHTML = `<div class="rep-grid">${ids.map(id => {
    const fig   = TODAS_FIGS.find(f => f.id === id);
    const time  = TIMES.find(t => t.cod === fig.cod);
    const jog   = jogadoresCache[id] || null;
    return `<div class="figurinha team-${time.cls}" onclick="openFig('${id}')">
      ${buildFigHTML(fig, time, jog, true)}
    </div>`;
  }).join('')}</div>`;
}

function renderTabPacotes() {
  const main = document.getElementById('album-main');
  const pacotesDisp = calcPacotesDisp();
  const msRestante  = calcProximoPacote();
  const h = Math.floor(msRestante / 3600000);
  const m = Math.floor((msRestante % 3600000) / 60000);
  const s = Math.floor((msRestante % 60000) / 1000);
  const timer = msRestante > 0
    ? `Próximo pacote em <strong>${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s</strong>`
    : 'Pacote disponível! 🎉';

  const coladas = (userDoc.figurinhas || []).length;
  const total   = TODAS_FIGS.length;

  main.innerHTML = `
    <div class="pacotes-info-card">
      <div class="pacotes-big-num">${pacotesDisp}</div>
      <div class="pacotes-big-label">pacote${pacotesDisp !== 1 ? 's' : ''} disponível${pacotesDisp !== 1 ? 'is' : ''}</div>
      <div class="pacotes-timer">${timer}</div>
    </div>
    <div style="background:rgba(255,255,255,0.04);border-radius:16px;padding:1.25rem;margin-bottom:1rem">
      <div style="font-size:13px;color:var(--gray);margin-bottom:0.5rem">Progresso do álbum</div>
      <div style="font-size:2rem;font-weight:700;color:var(--white)">${coladas}<span style="font-size:1rem;color:var(--gray)"> / ${total}</span></div>
      <div style="margin-top:0.5rem;height:8px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${Math.round(coladas/total*100)}%;background:linear-gradient(90deg,var(--purple),var(--gold));border-radius:4px;transition:width 0.4s"></div>
      </div>
      <div style="font-size:11px;color:var(--gray2);margin-top:4px">${Math.round(coladas/total*100)}% completo</div>
    </div>
    <div style="background:rgba(255,255,255,0.04);border-radius:16px;padding:1.25rem">
      <div style="font-size:13px;color:var(--gray);margin-bottom:0.75rem">Como ganhar pacotes</div>
      <div style="font-size:13px;color:var(--white);line-height:1.7">
        📦 Um novo pacote a cada <strong>6 horas</strong><br>
        🎁 Cada pacote tem <strong>5 figurinhas</strong><br>
        ✨ Figurinhas novas vão direto pro álbum<br>
        🔁 Repetidas ficam separadas
      </div>
    </div>`;
}

/* =========================================================
   NAVEGAÇÃO / UI
   ========================================================= */
function setTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.anav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  renderCurrentTab();
}

function renderCurrentTab() {
  switch (currentTab) {
    case 'album':    renderAlbum();        break;
    case 'repetidas':renderTabRepetidas(); break;
    case 'pacotes':  renderTabPacotes();   break;
  }
}

function initUI() {
  const nome = userDoc.nome || currentUser.email || '?';
  document.getElementById('user-name-label').textContent  = nome;
  document.getElementById('user-email-label').textContent = currentUser.email || '';
  document.getElementById('user-avatar').textContent      = nome.charAt(0).toUpperCase();
  updateProgress();
  updatePacoteUI(calcPacotesDisp());
  renderAlbum();
}

function updateProgress() {
  const coladas = (userDoc.figurinhas || []).length;
  const total   = TODAS_FIGS.length;
  const pct     = total > 0 ? Math.round(coladas / total * 100) : 0;
  document.getElementById('prog-bar').style.width = pct + '%';
  document.getElementById('prog-label').textContent = `${coladas} / ${total} figurinhas — ${pct}%`;
}

function toggleUserMenu() {
  document.getElementById('user-dropdown').classList.toggle('open');
}
document.addEventListener('click', e => {
  const menu = document.getElementById('user-dropdown');
  const av   = document.getElementById('user-avatar');
  if (menu && !menu.contains(e.target) && !av.contains(e.target)) {
    menu.classList.remove('open');
  }
});

/* =========================================================
   MODAL FIGURINHA AMPLIADA
   ========================================================= */
function openFig(id) {
  const fig  = TODAS_FIGS.find(f => f.id === id);
  const time = TIMES.find(t => t.cod === fig.cod);
  const jog  = jogadoresCache[id] || null;
  const coladas = new Set(userDoc.figurinhas || []);
  const colada  = coladas.has(id);
  const nRep    = (userDoc.repetidas || {})[id] || 0;

  const content = document.getElementById('modal-fig-content');
  content.innerHTML = `
    <div class="figurinha team-${time.cls}" style="width:180px;cursor:default">
      ${colada
        ? buildFigHTML(fig, time, jog, false)
        : `<div class="fig-vazia" style="height:270px"><span class="fig-vazia-icon" style="font-size:2.5rem">❓</span><span class="fig-vazia-num" style="font-size:1rem">${fig.cod} ${fig.num}</span><span style="font-size:11px;color:rgba(255,255,255,0.3)">Não colada</span></div>`
      }
    </div>
    ${colada && nRep > 0 ? `<div style="margin-top:8px;font-size:12px;color:var(--gray)">🔁 ${nRep} repetida${nRep > 1 ? 's' : ''}</div>` : ''}
    ${!colada ? '<div style="margin-top:8px;font-size:12px;color:var(--gray2)">Abra pacotes para conseguir esta figurinha</div>' : ''}
  `;
  document.getElementById('modal-fig').classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

/* Fecha modal ao clicar fora */
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => {
    if (e.target === m) m.classList.remove('open');
  });
});

/* =========================================================
   TELAS
   ========================================================= */
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
}
function showLogin()    { showScreen('login'); }
function showRegister() { showScreen('register'); }
function hideLoading()  { document.getElementById('loading-overlay').style.display = 'none'; }
function showErr(el, msg) { el.style.display = 'block'; el.textContent = msg; }

/* Permite Enter nos campos de login */
document.getElementById('inp-pass').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

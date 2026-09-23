// ========================================================
// Dividend Tracker Pro - Multi-User & Mobile Engine
// ========================================================

const USERS_STORAGE_KEY = 'dividend_tracker_users_v2';
const SESSION_STORAGE_KEY = 'dividend_tracker_active_session_v2';

// Données réelles du portefeuille Bourse de Casablanca (CSR, DYT, VCN, T2S, ADI, AKT, TGC)
const SAMPLE_POSITIONS = [
  { id: 'pos_1', company: 'Cosumar', ticker: 'CSR', shares: 5, invested: 925.00, dpa: 10.00, received: 43.28 },
  { id: 'pos_2', company: 'Disty Technologies', ticker: 'DYT', shares: 4, invested: 1408.00, dpa: 19.50, received: 67.50 },
  { id: 'pos_3', company: 'Vicenne', ticker: 'VCN', shares: 3, invested: 1140.00, dpa: 8.44, received: 21.91 },
  { id: 'pos_4', company: 'T2S Group Holding', ticker: 'T2S', shares: 3, invested: 669.00, dpa: 0.00, received: 0.00 },
  { id: 'pos_5', company: 'Alliances', ticker: 'ADI', shares: 2, invested: 730.00, dpa: 4.00, received: 6.92 },
  { id: 'pos_6', company: 'Akdital', ticker: 'AKT', shares: 2, invested: 2294.00, dpa: 14.00, received: 24.23 },
  { id: 'pos_7', company: 'TGCC', ticker: 'TGC', shares: 1, invested: 790.00, dpa: 15.00, received: 12.98 }
];

const SAMPLE_HISTORY = [
  { id: 'h1', date: '2026-07-01', ticker: 'VCN', company: 'Vicenne', amount: 21.91, note: 'Paiement coupon (3 actions)' },
  { id: 'h2', date: '2026-07-07', ticker: 'DYT', company: 'Disty Technologies', amount: 67.50, note: 'Paiement coupon (4 actions)' },
  { id: 'h3', date: '2026-07-31', ticker: 'ADI', company: 'Alliances', amount: 6.92, note: 'Paiement coupon (2 actions)' },
  { id: 'h4', date: '2026-08-03', ticker: 'CSR', company: 'Cosumar', amount: 38.95, note: 'Dividende ordinaire 9 DH (5 actions)' },
  { id: 'h5', date: '2026-08-03', ticker: 'CSR', company: 'Cosumar', amount: 4.33, note: 'Dividende exceptionnel 1 DH (5 actions)' },
  { id: 'h6', date: '2026-08-19', ticker: 'TGC', company: 'TGCC', amount: 12.98, note: 'Paiement coupon (1 action)' },
  { id: 'h7', date: '2026-09-02', ticker: 'AKT', company: 'Akdital', amount: 24.23, note: 'Paiement coupon (2 actions)' }
];

// Palette de couleurs financières
const CHART_COLORS = [
  '#10b981', '#38bdf8', '#818cf8', '#f59e0b', 
  '#ec4899', '#14b8a6', '#a855f7', '#fb923c', 
  '#6366f1', '#22c55e', '#06b6d4', '#eab308'
];

// Global State
let currentUser = null;
let positions = [];
let dividendHistory = [];
let currentCurrency = '€';

// Charts
let barChartIncome = null;
let donutChartCapital = null;
let lineChartProjection = null;

// ========================================================
// 1. Initialisation & Service Worker PWA
// ========================================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initPWA();
  initAuthAndSession();
  initCasaBourseCalendar();

  // Close dropdown on outside click
  window.addEventListener('click', (e) => {
    const dropdown = document.getElementById('userMenuDropdown');
    const toggleBtn = document.getElementById('userMenuToggleBtn');
    if (dropdown && !dropdown.contains(e.target) && !toggleBtn?.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });
});

function initPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => console.log('Service Worker enregistré:', reg.scope))
        .catch((err) => console.log('Échec enregistrement Service Worker:', err));
    });
  }
}

// ========================================================
// 2. Cryptographie & Sécurité (SHA-256)
// ========================================================
async function hashPassword(password) {
  if (!password) return '';
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + "_dividend_salt_2026_sec");
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    // Fallback simple si SubtleCrypto n'est pas dispo
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      hash = ((hash << 5) - hash) + password.charCodeAt(i);
      hash |= 0;
    }
    return 'h_' + Math.abs(hash);
  }
}

// Inscription temporaire en attente de validation OTP
let pendingRegistration = null;

// ========================================================
// 3. Gestion de l'Authentification & Multi-Utilisateurs
// ========================================================
function getAllUsers() {
  try {
    const data = localStorage.getItem(USERS_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveAllUsers(users) {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

function initAuthAndSession() {
  // 1. Liaison et migration automatique de votre portefeuille vers othmaneism@gmail.com
  migrateAndLinkOthmaneAccount();

  // 2. Assurer que le compte démo existe
  ensureDemoUserExists();

  // 3. Setup des champs OTP pour le code à 6 chiffres
  setupOtpInputListeners();

  // 4. Maintien de session : Si l'utilisateur est déjà connecté, garder sa session active lors d'un refresh (F5)
  const activeUserId = localStorage.getItem(SESSION_STORAGE_KEY);
  if (activeUserId) {
    const users = getAllUsers();
    const foundUser = users.find(u => u.id === activeUserId);
    if (foundUser) {
      activateUserSession(foundUser);
      return;
    }
  }

  // 5. Si non connecté ou après déconnexion : afficher l'écran de connexion
  currentUser = null;
  showAuthView();
}

/**
 * Migration & Liaison garantie de votre portefeuille local actuel à votre compte Gmail
 */
function migrateAndLinkOthmaneAccount() {
  const users = getAllUsers();
  let othmaneUser = users.find(u => u.email.toLowerCase() === 'othmaneism@gmail.com');

  const v1Positions = localStorage.getItem('dividend_tracker_positions_v1');
  const v1History = localStorage.getItem('dividend_tracker_history_v1');
  const v1Currency = localStorage.getItem('dividend_tracker_currency_v1') || '€';

  if (!othmaneUser) {
    othmaneUser = {
      id: 'user_othmane_master',
      name: 'Othmane',
      email: 'othmaneism@gmail.com',
      passwordHash: 'MASTER_VERIFIED_ACC',
      currency: v1Currency,
      isVerified: true,
      role: 'owner',
      createdAt: new Date().toISOString()
    };
    users.unshift(othmaneUser);
    saveAllUsers(users);
  }

  // Clés de stockage dédiées à Othmane
  const othmanePosKey = `dividend_user_${othmaneUser.id}_positions`;
  const othmaneHistKey = `dividend_user_${othmaneUser.id}_history`;

  // Synchronisation garantie de la mise à jour officielle BVC Maroc 2026
  const MOROCCO_SYNC_KEY = 'dividend_othmane_morocco_bvc_v2026_sync_v2';
  if (localStorage.getItem(MOROCCO_SYNC_KEY) !== 'done') {
    othmaneUser.currency = 'DH';
    localStorage.setItem(othmanePosKey, JSON.stringify(SAMPLE_POSITIONS));
    localStorage.setItem(othmaneHistKey, JSON.stringify(SAMPLE_HISTORY));
    localStorage.setItem(MOROCCO_SYNC_KEY, 'done');
    saveAllUsers(users);
  } else {
    const prevPositions = localStorage.getItem(othmanePosKey);
    if (!prevPositions) {
      localStorage.setItem(othmanePosKey, JSON.stringify(SAMPLE_POSITIONS));
    }
    const prevHistory = localStorage.getItem(othmaneHistKey);
    if (!prevHistory) {
      localStorage.setItem(othmaneHistKey, JSON.stringify(SAMPLE_HISTORY));
    }
  }
}

function ensureDemoUserExists() {
  const users = getAllUsers();
  const demoExists = users.some(u => u.email === 'demo@dividend.pro');
  if (!demoExists) {
    const demoUser = {
      id: 'user_demo_1',
      name: 'Utilisateur Démo',
      email: 'demo@dividend.pro',
      passwordHash: 'demo',
      currency: '€',
      isVerified: true,
      role: 'demo',
      createdAt: new Date().toISOString()
    };
    users.push(demoUser);
    saveAllUsers(users);

    localStorage.setItem(`dividend_user_${demoUser.id}_positions`, JSON.stringify(SAMPLE_POSITIONS));
    localStorage.setItem(`dividend_user_${demoUser.id}_history`, JSON.stringify(SAMPLE_HISTORY));
  }
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const tabLoginBtn = document.getElementById('tabLoginBtn');
  const tabRegisterBtn = document.getElementById('tabRegisterBtn');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    tabLoginBtn.className = 'flex-1 py-2 rounded-lg bg-slate-800 text-white transition shadow-sm';
    tabRegisterBtn.className = 'flex-1 py-2 rounded-lg text-slate-400 hover:text-white transition';
  } else {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    tabRegisterBtn.className = 'flex-1 py-2 rounded-lg bg-slate-800 text-white transition shadow-sm';
    tabLoginBtn.className = 'flex-1 py-2 rounded-lg text-slate-400 hover:text-white transition';
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pass = document.getElementById('loginPassword').value;

  const users = getAllUsers();
  const hashedInput = await hashPassword(pass);

  // Recherche par email
  const user = users.find(u => u.email.toLowerCase() === email);

  if (!user) {
    showToast('Aucun compte trouvé avec cet email', 'error');
    return;
  }

  // Vérification mot de passe chiffré (ou bypass pour le compte master/démo)
  const isMatch = (user.passwordHash === hashedInput) || 
                  (user.password === pass) || 
                  (user.role === 'owner') ||
                  (user.role === 'demo' && pass === 'demo');

  if (!isMatch) {
    showToast('Mot de passe incorrect', 'error');
    return;
  }

  if (user.isVerified === false) {
    showToast('Veuillez d\'abord valider votre compte par email', 'error');
    return;
  }

  // Si c'est la première connexion du propriétaire, mémoriser définitivement son mot de passe
  if (user.role === 'owner' && user.passwordHash === 'MASTER_VERIFIED_ACC') {
    user.passwordHash = hashedInput;
    user.password = pass;
    saveAllUsers(users);
  }

  activateUserSession(user);
  showToast(`Ravi de vous revoir, ${user.name} !`, 'success');
}

/**
 * Inscription avec Envoi du Code de Validation Email (OTP)
 */
async function handleRegister(event) {
  event.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const password = document.getElementById('regPassword').value;
  const currency = document.getElementById('regCurrency').value || '€';

  const users = getAllUsers();
  if (users.some(u => u.email.toLowerCase() === email && u.isVerified !== false)) {
    showToast('Un compte validé avec cette adresse Gmail existe déjà', 'error');
    return;
  }

  // Génération d'un code OTP sécurisé à 6 chiffres
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const passwordHash = await hashPassword(password);

  // Mémoriser la création en attente
  pendingRegistration = {
    name,
    email,
    passwordHash,
    currency,
    otpCode,
    timestamp: Date.now()
  };

  // Envoi de l'email via le service de messagerie
  if (typeof sendVerificationEmail === 'function') {
    await sendVerificationEmail(email, name, otpCode, "register");
  }

  // Affichage du modal OTP et du code en direct
  document.getElementById('otpTargetEmail').textContent = email;
  const liveOtpEl = document.getElementById('otpCodeLiveDisplay');
  if (liveOtpEl) liveOtpEl.textContent = otpCode;

  clearOtpInputs();
  openModal('verifyOtpModal');

  // Focus sur la première case
  setTimeout(() => {
    const firstInput = document.querySelector('.otp-input[data-idx="0"]');
    if (firstInput) firstInput.focus();
  }, 300);

  // Notification de confirmation
  showToast(`Code de vérification envoyé à ${email} : [ ${otpCode} ]`, 'info');
}

/**
 * Validation du code OTP à 6 chiffres
 */
function handleVerifyOtpCode() {
  if (!pendingRegistration) {
    showToast('Aucune inscription en cours', 'error');
    closeModal('verifyOtpModal');
    return;
  }

  // Concaténer les 6 inputs
  const inputs = document.querySelectorAll('.otp-input');
  let enteredCode = '';
  inputs.forEach(inp => enteredCode += (inp.value || '').trim());

  if (enteredCode.length < 6) {
    showToast('Veuillez saisir les 6 chiffres du code', 'error');
    return;
  }

  if (enteredCode !== pendingRegistration.otpCode) {
    showToast('Code de sécurité incorrect, veuillez réessayer', 'error');
    inputs.forEach(inp => inp.classList.add('border-rose-500'));
    setTimeout(() => {
      inputs.forEach(inp => inp.classList.remove('border-rose-500'));
    }, 1500);
    return;
  }

  // Code validé avec succès !
  const users = getAllUsers();
  const newUser = {
    id: 'user_' + Date.now(),
    name: pendingRegistration.name,
    email: pendingRegistration.email,
    passwordHash: pendingRegistration.passwordHash,
    currency: pendingRegistration.currency,
    isVerified: true,
    role: 'member',
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveAllUsers(users);

  // IMPORTANT : Initialisation 100% VIERGE (0 action) pour le nouvel utilisateur !
  localStorage.setItem(`dividend_user_${newUser.id}_positions`, JSON.stringify([]));
  localStorage.setItem(`dividend_user_${newUser.id}_history`, JSON.stringify([]));

  closeModal('verifyOtpModal');
  pendingRegistration = null;

  activateUserSession(newUser);
  showToast(`Email validé ! Bienvenue sur votre portefeuille, ${newUser.name}.`, 'success');
}

function resendOtpCode() {
  if (!pendingRegistration) return;
  const newCode = Math.floor(100000 + Math.random() * 900000).toString();
  pendingRegistration.otpCode = newCode;
  if (typeof sendVerificationEmail === 'function') {
    sendVerificationEmail(pendingRegistration.email, pendingRegistration.name, newCode, "register");
  }
  const liveOtpEl = document.getElementById('otpCodeLiveDisplay');
  if (liveOtpEl) liveOtpEl.textContent = newCode;

  clearOtpInputs();
  showToast(`Nouveau code envoyé à ${pendingRegistration.email} : [ ${newCode} ]`, 'info');
}

function cancelOtpVerification() {
  pendingRegistration = null;
  closeModal('verifyOtpModal');
  showToast('Inscription annulée', 'info');
}

function clearOtpInputs() {
  document.querySelectorAll('.otp-input').forEach(inp => inp.value = '');
}

/**
 * Gestion ergonomique des 6 cases OTP (saut automatique, touche retour, copier-coller)
 */
function setupOtpInputListeners() {
  const container = document.getElementById('otpInputsContainer');
  if (!container) return;

  const inputs = container.querySelectorAll('.otp-input');
  inputs.forEach((input, idx) => {
    // Saisie d'un chiffre
    input.addEventListener('input', (e) => {
      const val = e.target.value.replace(/[^0-9]/g, '');
      e.target.value = val ? val[val.length - 1] : '';

      if (val && idx < inputs.length - 1) {
        inputs[idx + 1].focus();
      }

      // Si tous les chiffres sont remplis, déclencher la validation auto
      let full = '';
      inputs.forEach(i => full += i.value);
      if (full.length === 6) {
        handleVerifyOtpCode();
      }
    });

    // Gestion de la touche Backspace
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && idx > 0) {
        inputs[idx - 1].focus();
      }
    });

    // Gestion du copier-coller d'un code entier à 6 chiffres
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasteData = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
      if (pasteData.length >= 6) {
        for (let i = 0; i < 6; i++) {
          if (inputs[i]) inputs[i].value = pasteData[i];
        }
        handleVerifyOtpCode();
      }
    });
  });
}

function loginAsDemoUser() {
  const users = getAllUsers();
  const demo = users.find(u => u.email === 'demo@dividend.pro');
  if (demo) {
    activateUserSession(demo);
    showToast('Connecté au Compte Démo (Données de test)', 'info');
  }
}

function loginAsMainUser() {
  migrateAndLinkOthmaneAccount();
  const users = getAllUsers();
  let othmane = users.find(u => u.email.toLowerCase() === 'othmaneism@gmail.com');
  if (othmane) {
    activateUserSession(othmane);
    showToast('Connecté à votre portefeuille', 'success');
  } else if (users.length > 0) {
    activateUserSession(users[0]);
  }
}

function activateUserSession(user) {
  currentUser = user;
  currentCurrency = user.currency || (user.email.toLowerCase() === 'othmaneism@gmail.com' ? 'DH' : '€');
  user.currency = currentCurrency;
  localStorage.setItem(SESSION_STORAGE_KEY, user.id);

  // Hide Auth screen, Show Main App
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('mainAppView').classList.remove('hidden');

  // Update profile headers
  document.getElementById('userNameDisplay').textContent = user.name;
  document.getElementById('userAvatar').textContent = (user.name || 'U').charAt(0).toUpperCase();
  document.getElementById('menuUserFullName').innerHTML = `${escapeHtml(user.name)} <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1"><i class="fa-solid fa-circle-check text-[9px]"></i> Vérifié</span>`;
  document.getElementById('menuUserEmail').textContent = user.email;

  // Currency select
  const currSelect = document.getElementById('currencySelector');
  if (currSelect) {
    currSelect.value = currentCurrency;
    currSelect.onchange = (e) => {
      currentCurrency = e.target.value;
      user.currency = currentCurrency;
      saveCurrentUserData();
      renderAll();
      showToast(`Devise modifiée en ${currentCurrency}`, 'info');
    };
  }

  loadUserData(user.id);
  setDefaultDividendDates();
  renderAll();
}

function handleLogout() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  currentUser = null;
  positions = [];
  dividendHistory = [];

  document.getElementById('userMenuDropdown')?.classList.add('hidden');
  showAuthView();
  showToast('Vous êtes déconnecté', 'info');
}

function showAuthView() {
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('mainAppView').classList.add('hidden');
}

// ========================================================
// 3. Stockage Données Portefeuille Utilisateur Isolé
// ========================================================
function loadUserData(userId) {
  const posKey = `dividend_user_${userId}_positions`;
  const histKey = `dividend_user_${userId}_history`;

  try {
    const savedPos = localStorage.getItem(posKey);
    positions = savedPos ? JSON.parse(savedPos) : [];
  } catch (e) {
    positions = [];
  }

  try {
    const savedHist = localStorage.getItem(histKey);
    dividendHistory = savedHist ? JSON.parse(savedHist) : [];
  } catch (e) {
    dividendHistory = [];
  }
}

function savePositions() {
  if (!currentUser) return;
  localStorage.setItem(`dividend_user_${currentUser.id}_positions`, JSON.stringify(positions));
}

function saveHistory() {
  if (!currentUser) return;
  localStorage.setItem(`dividend_user_${currentUser.id}_history`, JSON.stringify(dividendHistory));
}

function saveCurrentUserData() {
  if (!currentUser) return;
  const users = getAllUsers();
  const idx = users.findIndex(u => u.id === currentUser.id);
  if (idx !== -1) {
    users[idx] = currentUser;
    saveAllUsers(users);
  }
}

function setDefaultDividendDates() {
  const dateInput = document.getElementById('divDate');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
}

// ========================================================
// 4. Calculs Financiers & Métriques
// ========================================================
function calculateMetrics() {
  let totalInvested = 0;
  let totalAnnualIncome = 0;
  let totalReceived = 0;

  positions.forEach(p => {
    const shares = parseFloat(p.shares) || 0;
    const invested = parseFloat(p.invested) || 0;
    const dpa = parseFloat(p.dpa) || 0;
    const received = parseFloat(p.received) || 0;

    const annualIncome = shares * dpa;
    const yoc = invested > 0 ? (annualIncome / invested) * 100 : 0;
    const pending = Math.max(0, annualIncome - received);

    p.annualIncome = annualIncome;
    p.yoc = yoc;
    p.pending = pending;

    totalInvested += invested;
    totalAnnualIncome += annualIncome;
    totalReceived += received;
  });

  const totalPending = Math.max(0, totalAnnualIncome - totalReceived);
  const avgYield = totalInvested > 0 ? (totalAnnualIncome / totalInvested) * 100 : 0;
  const monthlyIncome = totalAnnualIncome / 12;

  // Concentration metrics
  const sortedByIncome = [...positions].sort((a, b) => (b.annualIncome || 0) - (a.annualIncome || 0));
  const top3Income = sortedByIncome.slice(0, 3).reduce((sum, p) => sum + (p.annualIncome || 0), 0);
  const top3Share = totalAnnualIncome > 0 ? (top3Income / totalAnnualIncome) * 100 : 0;
  const largestPayer = sortedByIncome[0] || null;

  return {
    totalInvested,
    totalAnnualIncome,
    totalReceived,
    totalPending,
    avgYield,
    monthlyIncome,
    top3Share,
    largestPayer,
    count: positions.length
  };
}

function renderAll() {
  const metrics = calculateMetrics();
  renderKPIs(metrics);
  renderPositionsTable();
  renderCharts(metrics);
  updateProjection();
  renderHistoryTable();
  populateDropdowns();
}

function renderKPIs(metrics) {
  document.getElementById('kpiTotalInvested').textContent = formatMoney(metrics.totalInvested);
  document.getElementById('kpiTotalPositions').textContent = metrics.count;
  document.getElementById('positionsCountBadge').textContent = `${metrics.count} positions`;

  document.getElementById('kpiAnnualIncome').textContent = formatMoney(metrics.totalAnnualIncome);
  document.getElementById('kpiMonthlyIncome').textContent = formatMoney(metrics.monthlyIncome);
  document.getElementById('kpiAverageYield').textContent = `${metrics.avgYield.toFixed(2)} %`;

  document.getElementById('kpiTotalReceived').textContent = formatMoney(metrics.totalReceived);
  const progressPct = metrics.totalAnnualIncome > 0 
    ? Math.min(100, (metrics.totalReceived / metrics.totalAnnualIncome) * 100) 
    : 0;
  document.getElementById('kpiProgressReceivedBar').style.width = `${progressPct.toFixed(1)}%`;

  document.getElementById('kpiPendingAmount').textContent = formatMoney(metrics.totalPending);
  const pendingPct = metrics.totalAnnualIncome > 0 ? (metrics.totalPending / metrics.totalAnnualIncome) * 100 : 0;
  document.getElementById('kpiPendingPercent').textContent = `${pendingPct.toFixed(1)}% du total annuel`;

  document.getElementById('kpiTop3Share').textContent = `${metrics.top3Share.toFixed(1)} %`;
  if (metrics.largestPayer) {
    const largestPct = metrics.totalAnnualIncome > 0 ? (metrics.largestPayer.annualIncome / metrics.totalAnnualIncome * 100).toFixed(1) : 0;
    document.getElementById('kpiLargestPayer').textContent = `Max: ${metrics.largestPayer.ticker} (${largestPct}%)`;
    document.getElementById('quickTop3Percent').textContent = `${metrics.top3Share.toFixed(1)}% (${metrics.largestPayer.ticker}...)`;
  } else {
    document.getElementById('kpiLargestPayer').textContent = 'Max: -';
    document.getElementById('quickTop3Percent').textContent = '-';
  }

  // Top 1 Invested
  const sortedByInvest = [...positions].sort((a, b) => (b.invested || 0) - (a.invested || 0));
  if (sortedByInvest.length > 0) {
    const top1 = sortedByInvest[0];
    const top1Pct = metrics.totalInvested > 0 ? (top1.invested / metrics.totalInvested * 100).toFixed(1) : 0;
    document.getElementById('quickTop1Invested').textContent = `${top1.ticker} (${top1Pct}%)`;
  } else {
    document.getElementById('quickTop1Invested').textContent = '-';
  }

  const chartBadge = document.getElementById('chartTotalIncomeBadge');
  if (chartBadge) chartBadge.textContent = `Total: ${formatMoney(metrics.totalAnnualIncome)}`;
}

// ========================================================
// 5. Tableau des Positions
// ========================================================
function renderPositionsTable() {
  const tbody = document.getElementById('positionsTableBody');
  const searchFilter = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  tbody.innerHTML = '';

  const filtered = positions.filter(p => 
    p.company.toLowerCase().includes(searchFilter) || 
    p.ticker.toLowerCase().includes(searchFilter)
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="py-8 text-center text-slate-500">
          <i class="fa-solid fa-folder-open text-2xl mb-2 block"></i>
          ${positions.length === 0 ? 'Aucune action dans votre portefeuille. Cliquez sur "+ Action" pour commencer à bâtir votre rente.' : 'Aucun résultat trouvé pour votre recherche.'}
        </td>
      </tr>
    `;
    updateTableFooters(0, 0, 0, 0, 0, 0);
    return;
  }

  let totalShares = 0;
  let totalInvested = 0;
  let totalIncome = 0;
  let totalReceived = 0;
  let totalPending = 0;

  filtered.forEach((pos, index) => {
    totalShares += parseFloat(pos.shares) || 0;
    totalInvested += parseFloat(pos.invested) || 0;
    totalIncome += parseFloat(pos.annualIncome) || 0;
    totalReceived += parseFloat(pos.received) || 0;
    totalPending += parseFloat(pos.pending) || 0;

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-800/40 transition group';
    const isCompleted = pos.pending <= 0.01;

    tr.innerHTML = `
      <td class="py-3 px-4 font-medium text-white flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full inline-block shrink-0" style="background-color: ${CHART_COLORS[index % CHART_COLORS.length]}"></span>
        <span class="truncate max-w-[130px] sm:max-w-[200px]" title="${escapeHtml(pos.company)}">${escapeHtml(pos.company)}</span>
      </td>
      <td class="py-3 px-3">
        <span class="px-2 py-0.5 rounded-md bg-slate-800 text-emerald-400 font-mono font-bold text-xs border border-slate-700">
          ${escapeHtml(pos.ticker)}
        </span>
      </td>
      <td class="py-2.5 px-2 text-right">
        <input type="number" step="any" min="0" value="${pos.shares}" onchange="updatePositionDirectly('${pos.id}', 'shares', this.value)" title="Modifier le nombre d'actions" class="w-16 sm:w-20 text-right bg-slate-800/40 hover:bg-slate-800 focus:bg-slate-800 border border-slate-700/50 focus:border-emerald-500 rounded px-1.5 py-0.5 font-mono text-xs text-white transition focus:outline-none">
      </td>
      <td class="py-2.5 px-2 text-right">
        <input type="number" step="any" min="0" value="${pos.invested}" onchange="updatePositionDirectly('${pos.id}', 'invested', this.value)" title="Modifier le capital investi" class="w-20 sm:w-24 text-right bg-slate-800/40 hover:bg-slate-800 focus:bg-slate-800 border border-slate-700/50 focus:border-emerald-500 rounded px-1.5 py-0.5 font-mono text-xs text-white transition focus:outline-none">
      </td>
      <td class="py-2.5 px-3 text-right font-mono font-bold text-cyan-400">
        ${pos.yoc.toFixed(2)} %
      </td>
      <td class="py-2.5 px-2 text-right">
        <input type="number" step="any" min="0" value="${pos.dpa}" onchange="updatePositionDirectly('${pos.id}', 'dpa', this.value)" title="Modifier le DPA" class="w-16 sm:w-20 text-right bg-slate-800/40 hover:bg-slate-800 focus:bg-slate-800 border border-slate-700/50 focus:border-emerald-500 rounded px-1.5 py-0.5 font-mono text-xs text-slate-200 transition focus:outline-none">
      </td>
      <td class="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
        ${formatMoney(pos.annualIncome)}
      </td>
      <td class="py-2.5 px-2 text-right">
        <input type="number" step="any" min="0" value="${pos.received || 0}" onchange="updatePositionDirectly('${pos.id}', 'received', this.value)" title="Modifier le montant déjà reçu" class="w-16 sm:w-20 text-right bg-slate-800/40 hover:bg-slate-800 focus:bg-slate-800 border border-slate-700/50 focus:border-indigo-500 rounded px-1.5 py-0.5 font-mono text-xs text-indigo-300 transition focus:outline-none">
      </td>
      <td class="py-2.5 px-3 text-right font-mono font-semibold ${isCompleted ? 'text-slate-500' : 'text-amber-400'}">
        ${isCompleted ? '<span class="text-xs text-emerald-500"><i class="fa-solid fa-check"></i> Reçu</span>' : formatMoney(pos.pending)}
      </td>
      <td class="py-3 px-4 text-center">
        <div class="inline-flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
          <button onclick="openBuySharesForTicker('${pos.id}')" title="Acheter / Renforcer" class="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 transition">
            <i class="fa-solid fa-cart-plus text-xs"></i>
          </button>
          <button onclick="openRecordDividendForTicker('${pos.id}')" title="Encaisser un dividende" class="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 transition">
            <i class="fa-solid fa-hand-holding-dollar text-xs"></i>
          </button>
          <button onclick="editPosition('${pos.id}')" title="Modifier" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition">
            <i class="fa-solid fa-pen-to-square text-xs"></i>
          </button>
          <button onclick="deletePosition('${pos.id}')" title="Supprimer" class="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition">
            <i class="fa-solid fa-trash text-xs"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  const avgYield = totalInvested > 0 ? (totalIncome / totalInvested) * 100 : 0;
  updateTableFooters(totalShares, totalInvested, avgYield, totalIncome, totalReceived, totalPending);
}

function updatePositionDirectly(id, field, value) {
  const pos = positions.find(p => p.id === id);
  if (!pos) return;
  const num = parseFloat(value);
  pos[field] = isNaN(num) ? 0 : num;
  savePositions();
  calculateMetrics();
  renderAll();
  showAutoSaveNotice();
}

function showAutoSaveNotice() {
  const badge = document.getElementById('autoSaveBadge');
  if (badge) {
    badge.className = 'text-[11px] font-semibold text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded-full inline-flex items-center gap-1 transition-all shadow-sm';
    badge.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-400"></i> <span>Enregistré automatiquement</span>';
    setTimeout(() => {
      badge.className = 'text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1 transition-all';
      badge.innerHTML = '<i class="fa-solid fa-cloud-arrow-up text-[10px]"></i> <span>Sauvegarde auto active</span>';
    }, 2000);
  }
}

function updateTableFooters(shares, invested, yieldPct, income, received, pending) {
  document.getElementById('footTotalShares').textContent = formatNumber(shares);
  document.getElementById('footTotalInvested').textContent = formatMoney(invested);
  document.getElementById('footAvgYield').textContent = `${yieldPct.toFixed(2)} %`;
  document.getElementById('footTotalIncome').textContent = formatMoney(income);
  document.getElementById('footTotalReceived').textContent = formatMoney(received);
  document.getElementById('footTotalPending').textContent = formatMoney(pending);
}

// ========================================================
// 6. Visualisations Chart.js
// ========================================================
function renderCharts(metrics) {
  if (typeof Chart === 'undefined') return;

  // Chart 1: Bar Chart
  const barCanvas = document.getElementById('barChartIncome');
  if (barCanvas) {
    const labels = positions.map(p => p.ticker);
    const dataValues = positions.map(p => p.annualIncome || 0);
    const bgColors = positions.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

    if (barChartIncome) barChartIncome.destroy();

    barChartIncome = new Chart(barCanvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: `Revenu annuel (${currentCurrency})`,
          data: dataValues,
          backgroundColor: bgColors,
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            borderColor: '#334155',
            borderWidth: 1,
            titleFont: { family: 'Plus Jakarta Sans', size: 12, weight: 'bold' },
            bodyFont: { family: 'JetBrains Mono', size: 12 },
            callbacks: {
              label: function(ctx) {
                const val = ctx.parsed.y || 0;
                const total = metrics.totalAnnualIncome || 1;
                const pct = ((val / total) * 100).toFixed(1);
                return ` ${formatMoney(val)} (${pct}% du revenu)`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 11 } }
          },
          y: {
            grid: { color: '#1e293b' },
            ticks: { 
              color: '#94a3b8', 
              font: { family: 'JetBrains Mono', size: 11 },
              callback: val => `${val} ${currentCurrency}`
            }
          }
        }
      }
    });
  }

  // Chart 2: Donut Chart
  const donutCanvas = document.getElementById('donutChartCapital');
  if (donutCanvas) {
    const labels = positions.map(p => p.ticker);
    const dataValues = positions.map(p => p.invested || 0);
    const bgColors = positions.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

    if (donutChartCapital) donutChartCapital.destroy();

    donutChartCapital = new Chart(donutCanvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: dataValues,
          backgroundColor: bgColors,
          borderColor: '#0f172a',
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#cbd5e1',
              font: { family: 'Plus Jakarta Sans', size: 11 },
              boxWidth: 12,
              padding: 10
            }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            borderColor: '#334155',
            borderWidth: 1,
            titleFont: { family: 'Plus Jakarta Sans', size: 12, weight: 'bold' },
            bodyFont: { family: 'JetBrains Mono', size: 12 },
            callbacks: {
              label: function(ctx) {
                const val = ctx.parsed || 0;
                const total = metrics.totalInvested || 1;
                const pct = ((val / total) * 100).toFixed(1);
                return ` ${formatMoney(val)} (${pct}%)`;
              }
            }
          }
        },
        cutout: '68%'
      }
    });
  }
}

// ========================================================
// 7. Simulateur & Projections (DRIP)
// ========================================================
function updateProjection() {
  const monthlyAdd = parseFloat(document.getElementById('inputMonthlyAdd').value) || 0;
  const newYield = (parseFloat(document.getElementById('inputNewYield').value) || 0) / 100;
  const divGrowth = (parseFloat(document.getElementById('inputDivGrowth').value) || 0) / 100;
  const reinvest = document.getElementById('inputReinvest').checked;

  document.getElementById('labelMonthlyAdd').textContent = `${formatNumber(monthlyAdd)} ${currentCurrency}`;
  document.getElementById('labelNewYield').textContent = `${(newYield * 100).toFixed(2)} %`;
  document.getElementById('labelDivGrowth').textContent = `${(divGrowth * 100).toFixed(2)} %`;

  const metrics = calculateMetrics();
  let currentCapital = metrics.totalInvested;
  let currentIncome = metrics.totalAnnualIncome;

  const yearsToTrack = [5, 10, 20];
  const tableData = {};
  const graphLabels = [];
  const graphIncomeData = [];
  const graphCapitalData = [];

  graphLabels.push('0 an');
  graphIncomeData.push(Math.round(currentIncome));
  graphCapitalData.push(Math.round(currentCapital));

  let totalCapitalAdded = 0;

  for (let year = 1; year <= 20; year++) {
    currentIncome = currentIncome * (1 + divGrowth);
    const yearlyAdd = monthlyAdd * 12;
    totalCapitalAdded += yearlyAdd;
    currentCapital += yearlyAdd;

    const incomeFromAdd = yearlyAdd * newYield;
    currentIncome += incomeFromAdd;

    if (reinvest) {
      currentCapital += currentIncome;
      const incomeFromDrip = currentIncome * newYield;
      currentIncome += incomeFromDrip;
    }

    graphLabels.push(`${year} an${year > 1 ? 's' : ''}`);
    graphIncomeData.push(Math.round(currentIncome));
    graphCapitalData.push(Math.round(currentCapital));

    if (yearsToTrack.includes(year)) {
      tableData[year] = {
        years: year,
        capitalAdded: totalCapitalAdded,
        annualIncome: currentIncome,
        monthlyIncome: currentIncome / 12,
        totalPortfolio: currentCapital
      };
    }
  }

  const tbody = document.getElementById('projectionTableBody');
  tbody.innerHTML = '';

  yearsToTrack.forEach(year => {
    const row = tableData[year];
    if (!row) return;

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-900/60 transition';
    tr.innerHTML = `
      <td class="py-3 px-3 font-semibold text-white flex items-center gap-1.5">
        <i class="fa-solid fa-calendar-check text-emerald-400"></i>
        <span>${year} ans</span>
      </td>
      <td class="py-3 px-3 text-right text-slate-400">${year}</td>
      <td class="py-3 px-3 text-right font-mono text-slate-200">${formatMoney(row.capitalAdded)}</td>
      <td class="py-3 px-3 text-right font-mono font-bold text-emerald-400">${formatMoney(row.annualIncome)}</td>
      <td class="py-3 px-3 text-right font-mono text-cyan-400">${formatMoney(row.monthlyIncome)}</td>
      <td class="py-3 px-3 text-right font-mono font-bold text-white">${formatMoney(row.totalPortfolio)}</td>
    `;
    tbody.appendChild(tr);
  });

  renderProjectionLineChart(graphLabels, graphIncomeData, graphCapitalData);
}

function renderProjectionLineChart(labels, incomeData, capitalData) {
  const lineCanvas = document.getElementById('lineChartProjection');
  if (!lineCanvas || typeof Chart === 'undefined') return;

  if (lineChartProjection) lineChartProjection.destroy();

  lineChartProjection = new Chart(lineCanvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: `Revenu annuel (${currentCurrency})`,
          data: incomeData,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.35,
          yAxisID: 'y'
        },
        {
          label: `Portefeuille estimé (${currentCurrency})`,
          data: capitalData,
          borderColor: '#0284c7',
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          tension: 0.35,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          borderColor: '#334155',
          borderWidth: 1,
          titleFont: { family: 'Plus Jakarta Sans', size: 12, weight: 'bold' },
          bodyFont: { family: 'JetBrains Mono', size: 12 },
          callbacks: {
            label: function(ctx) {
              return ` ${ctx.dataset.label}: ${formatMoney(ctx.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: '#1e293b' },
          ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 10 } }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          grid: { color: '#1e293b' },
          ticks: { 
            color: '#10b981', 
            font: { family: 'JetBrains Mono', size: 10 },
            callback: val => `${val} ${currentCurrency}`
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { 
            color: '#38bdf8', 
            font: { family: 'JetBrains Mono', size: 10 },
            callback: val => `${val} ${currentCurrency}`
          }
        }
      }
    }
  });
}

// ========================================================
// 8. Historique Dividendes
// ========================================================
function renderHistoryTable() {
  const tbody = document.getElementById('dividendsHistoryTableBody');
  tbody.innerHTML = '';

  if (dividendHistory.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-6 text-center text-slate-500">
          Aucun dividende reçu enregistré pour le moment.
        </td>
      </tr>
    `;
    return;
  }

  const sorted = [...dividendHistory].sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted.forEach(item => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-800/40 transition';
    tr.innerHTML = `
      <td class="py-2.5 px-4 font-mono text-slate-400">${item.date || '-'}</td>
      <td class="py-2.5 px-4">
        <span class="font-bold text-white">${escapeHtml(item.company || item.ticker)}</span>
        <span class="text-xs px-1.5 py-0.5 ml-1.5 rounded bg-slate-800 text-slate-300 font-mono">${escapeHtml(item.ticker)}</span>
      </td>
      <td class="py-2.5 px-4 text-right font-mono font-bold text-emerald-400">+ ${formatMoney(item.amount)}</td>
      <td class="py-2.5 px-4 text-slate-400 italic">${escapeHtml(item.note || 'Dividende régulier')}</td>
      <td class="py-2.5 px-4 text-center">
        <button onclick="deleteDividendHistory('${item.id}')" class="p-1 rounded text-slate-500 hover:text-rose-400 transition" title="Supprimer">
          <i class="fa-solid fa-trash text-xs"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function deleteDividendHistory(id) {
  const item = dividendHistory.find(h => h.id === id);
  if (!item) return;

  if (confirm(`Supprimer cet encaissement de ${formatMoney(item.amount)} (${item.ticker}) ?`)) {
    const pos = positions.find(p => p.ticker.toUpperCase() === item.ticker.toUpperCase());
    if (pos) {
      pos.received = Math.max(0, (pos.received || 0) - item.amount);
      savePositions();
    }
    dividendHistory = dividendHistory.filter(h => h.id !== id);
    saveHistory();
    renderAll();
    showToast('Encaissement supprimé', 'info');
  }
}

// ========================================================
// 9. Actions & Modals
// ========================================================
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function resetPositionForm() {
  document.getElementById('editPositionId').value = '';
  document.getElementById('positionModalTitle').innerHTML = '<i class="fa-solid fa-plus-circle text-emerald-400"></i> Ajouter une Position';
  document.getElementById('positionForm').reset();
}

function handleSavePosition(event) {
  event.preventDefault();
  const editId = document.getElementById('editPositionId').value;
  const company = document.getElementById('posCompany').value.trim();
  const ticker = document.getElementById('posTicker').value.trim().toUpperCase();
  const shares = parseFloat(document.getElementById('posShares').value) || 0;
  const invested = parseFloat(document.getElementById('posInvested').value) || 0;
  const dpa = parseFloat(document.getElementById('posDpa').value) || 0;
  const received = parseFloat(document.getElementById('posReceived').value) || 0;

  if (editId) {
    const pos = positions.find(p => p.id === editId);
    if (pos) {
      pos.company = company;
      pos.ticker = ticker;
      pos.shares = shares;
      pos.invested = invested;
      pos.dpa = dpa;
      pos.received = received;
      showToast(`Position ${ticker} modifiée`, 'success');
    }
  } else {
    const newPos = {
      id: 'pos_' + Date.now(),
      company,
      ticker,
      shares,
      invested,
      dpa,
      received
    };
    positions.push(newPos);
    showToast(`Position ${ticker} ajoutée !`, 'success');
  }

  savePositions();
  closeModal('addPositionModal');
  resetPositionForm();
  renderAll();
}

function editPosition(id) {
  const pos = positions.find(p => p.id === id);
  if (!pos) return;

  document.getElementById('editPositionId').value = pos.id;
  document.getElementById('positionModalTitle').innerHTML = `<i class="fa-solid fa-pen-to-square text-emerald-400"></i> Modifier ${escapeHtml(pos.ticker)}`;
  document.getElementById('posCompany').value = pos.company;
  document.getElementById('posTicker').value = pos.ticker;
  document.getElementById('posShares').value = pos.shares;
  document.getElementById('posInvested').value = pos.invested;
  document.getElementById('posDpa').value = pos.dpa;
  document.getElementById('posReceived').value = pos.received || 0;

  openModal('addPositionModal');
}

function deletePosition(id) {
  const pos = positions.find(p => p.id === id);
  if (!pos) return;

  if (confirm(`Supprimer la position ${pos.ticker} (${pos.company}) ?`)) {
    positions = positions.filter(p => p.id !== id);
    savePositions();
    renderAll();
    showToast(`Position ${pos.ticker} supprimée`, 'info');
  }
}

function populateDropdowns() {
  const buySelect = document.getElementById('buyPositionSelect');
  const divSelect = document.getElementById('divPositionSelect');

  if (buySelect) {
    buySelect.innerHTML = positions.map(p => `
      <option value="${p.id}">${escapeHtml(p.ticker)} - ${escapeHtml(p.company)} (${p.shares} actions actuelles)</option>
    `).join('');
  }

  if (divSelect) {
    divSelect.innerHTML = positions.map(p => `
      <option value="${p.id}">${escapeHtml(p.ticker)} - ${escapeHtml(p.company)}</option>
    `).join('');
  }
}

function openBuySharesForTicker(posId) {
  const buySelect = document.getElementById('buyPositionSelect');
  if (buySelect) buySelect.value = posId;
  openModal('buySharesModal');
}

function openRecordDividendForTicker(posId) {
  const divSelect = document.getElementById('divPositionSelect');
  if (divSelect) divSelect.value = posId;
  openModal('recordDividendModal');
}

function calculateBuyTotal() {
  const count = parseFloat(document.getElementById('buySharesCount').value) || 0;
  const price = parseFloat(document.getElementById('buySharePrice').value) || 0;
  const fees = parseFloat(document.getElementById('buyFees').value) || 0;
  const total = (count * price) + fees;
  document.getElementById('buyTotalAmountDisplay').value = formatMoney(total);
}

function handleBuyShares(event) {
  event.preventDefault();
  const posId = document.getElementById('buyPositionSelect').value;
  const count = parseFloat(document.getElementById('buySharesCount').value) || 0;
  const price = parseFloat(document.getElementById('buySharePrice').value) || 0;
  const fees = parseFloat(document.getElementById('buyFees').value) || 0;

  const pos = positions.find(p => p.id === posId);
  if (!pos) {
    showToast('Sélectionnez une position valide', 'error');
    return;
  }

  const addedCost = (count * price) + fees;
  pos.shares = (parseFloat(pos.shares) || 0) + count;
  pos.invested = (parseFloat(pos.invested) || 0) + addedCost;

  savePositions();
  closeModal('buySharesModal');
  document.getElementById('buySharesForm').reset();
  document.getElementById('buyTotalAmountDisplay').value = '0.00';
  renderAll();
  showToast(`Achat enregistré ! +${count} actions ${pos.ticker}`, 'success');
}

function handleRecordDividend(event) {
  event.preventDefault();
  const posId = document.getElementById('divPositionSelect').value;
  const amount = parseFloat(document.getElementById('divAmount').value) || 0;
  const date = document.getElementById('divDate').value;
  const note = document.getElementById('divNote').value.trim();

  const pos = positions.find(p => p.id === posId);
  if (!pos) {
    showToast('Sélectionnez une position valide', 'error');
    return;
  }

  pos.received = (parseFloat(pos.received) || 0) + amount;
  savePositions();

  dividendHistory.push({
    id: 'h_' + Date.now(),
    date: date || new Date().toISOString().split('T')[0],
    ticker: pos.ticker,
    company: pos.company,
    amount: amount,
    note: note || 'Encaissement dividende'
  });
  saveHistory();

  closeModal('recordDividendModal');
  document.getElementById('recordDividendForm').reset();
  setDefaultDividendDates();
  renderAll();
  showToast(`Dividende de ${formatMoney(amount)} enregistré pour ${pos.ticker} !`, 'success');
}

// ========================================================
// 10. Utilitaires & Import / Export
// ========================================================
function toggleDropdown(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('hidden');
}

function scrollToElement(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

function exportDataJSON() {
  if (!currentUser) return;
  const backup = {
    version: '2.0',
    exportDate: new Date().toISOString(),
    user: { name: currentUser.name, email: currentUser.email },
    currency: currentCurrency,
    positions: positions,
    history: dividendHistory
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `dividendes_${currentUser.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();

  showToast('Fichier JSON de sauvegarde téléchargé !', 'success');
}

function importDataJSON(event) {
  if (!currentUser) return;
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.positions && Array.isArray(data.positions)) {
        positions = data.positions;
        savePositions();
      }
      if (data.history && Array.isArray(data.history)) {
        dividendHistory = data.history;
        saveHistory();
      }
      if (data.currency) {
        currentCurrency = data.currency;
        currentUser.currency = currentCurrency;
        saveCurrentUserData();
        document.getElementById('currencySelector').value = currentCurrency;
      }
      renderAll();
      showToast('Portefeuille restauré avec succès !', 'success');
    } catch (err) {
      showToast('Fichier JSON invalide', 'error');
    }
  };
  reader.readAsText(file);
}

function exportPositionsCSV() {
  if (positions.length === 0) {
    showToast('Aucune donnée à exporter', 'info');
    return;
  }

  let csv = 'Société;Ticker;Actions;Investi;YieldOnCost(%);DPA;RevenuAnnuel;Reçu;ÀRecevoir\n';
  positions.forEach(p => {
    csv += `"${p.company}";"${p.ticker}";${p.shares};${p.invested};${p.yoc.toFixed(2)};${p.dpa};${p.annualIncome.toFixed(2)};${(p.received || 0).toFixed(2)};${p.pending.toFixed(2)}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('href', url);
  a.setAttribute('download', `portefeuille_${currentUser.name.replace(/\s+/g, '_')}.csv`);
  document.body.appendChild(a);
  a.click();
  a.remove();
  showToast('Fichier CSV exporté !', 'success');
}

// ========================================================
// Theme Toggle (Light / Dark Mode)
// ========================================================
const THEME_KEY = 'dividend_tracker_theme_v2';

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'dark';
  applyTheme(saved);
}

function applyTheme(theme) {
  const icon = document.getElementById('themeIcon');
  if (theme === 'light') {
    document.documentElement.classList.remove('dark');
    if (icon) {
      icon.className = 'fa-solid fa-moon text-indigo-400';
    }
  } else {
    document.documentElement.classList.add('dark');
    if (icon) {
      icon.className = 'fa-solid fa-sun text-amber-400';
    }
  }
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  const newTheme = isDark ? 'light' : 'dark';
  applyTheme(newTheme);
  
  if (currentUser) {
    const metrics = calculateMetrics();
    renderCharts(metrics);
    updateProjection();
  }
  showToast(`Mode ${newTheme === 'light' ? 'Clair' : 'Sombre'} activé`, 'info');
}

// ========================================================
// Mot de Passe Oublié & Réinitialisation par Code Email
// ========================================================
let pendingPasswordReset = null;

function showForgotPasswordForm() {
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('registerForm').classList.add('hidden');
  document.getElementById('forgotPasswordContainer').classList.remove('hidden');
  document.getElementById('forgotStep1Form').classList.remove('hidden');
  document.getElementById('forgotStep2Form').classList.add('hidden');
  document.getElementById('forgotStep1Form').reset();
}

function cancelForgotPassword() {
  document.getElementById('forgotPasswordContainer').classList.add('hidden');
  document.getElementById('loginForm').classList.remove('hidden');
  pendingPasswordReset = null;
}

async function handleSendResetOtp(event) {
  event.preventDefault();
  const email = document.getElementById('forgotEmail').value.trim().toLowerCase();
  const users = getAllUsers();
  const user = users.find(u => u.email.toLowerCase() === email);

  if (!user) {
    showToast('Aucun compte associé à cette adresse email', 'error');
    return;
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  pendingPasswordReset = {
    email: email,
    otpCode: otpCode,
    user: user
  };

  if (typeof sendVerificationEmail === 'function') {
    await sendVerificationEmail(email, user.name, otpCode, "reset");
  }

  const liveResetEl = document.getElementById('resetCodeLiveDisplay');
  if (liveResetEl) liveResetEl.textContent = otpCode;

  document.getElementById('resetTargetEmailDisplay').textContent = email;
  document.getElementById('forgotStep1Form').classList.add('hidden');
  document.getElementById('forgotStep2Form').classList.remove('hidden');
  document.getElementById('resetInputOtp').value = '';
  document.getElementById('resetNewPass').value = '';
  document.getElementById('resetConfirmPass').value = '';
  document.getElementById('resetInputOtp').focus();

  showToast(`Code de réinitialisation envoyé à ${email} : [ ${otpCode} ]`, 'info');
}

async function handleConfirmNewPassword(event) {
  event.preventDefault();
  if (!pendingPasswordReset) {
    showToast('Session de réinitialisation expirée', 'error');
    cancelForgotPassword();
    return;
  }

  const enteredCode = document.getElementById('resetInputOtp').value.trim();
  const newPass = document.getElementById('resetNewPass').value;
  const confirmPass = document.getElementById('resetConfirmPass').value;

  if (enteredCode !== pendingPasswordReset.otpCode) {
    showToast('Code de réinitialisation incorrect', 'error');
    return;
  }

  if (newPass.length < 4) {
    showToast('Le mot de passe doit comporter au moins 4 caractères', 'error');
    return;
  }

  if (newPass !== confirmPass) {
    showToast('Les deux mots de passe ne correspondent pas', 'error');
    return;
  }

  const newHash = await hashPassword(newPass);
  const users = getAllUsers();
  const uIdx = users.findIndex(u => u.id === pendingPasswordReset.user.id);
  if (uIdx !== -1) {
    users[uIdx].passwordHash = newHash;
    users[uIdx].password = newPass;
    saveAllUsers(users);
  }

  showToast('Mot de passe mis à jour avec succès !', 'success');
  cancelForgotPassword();
  activateUserSession(users[uIdx]);
}

function openChangePasswordModal() {
  document.getElementById('userMenuDropdown')?.classList.add('hidden');
  document.getElementById('changePasswordForm')?.reset();
  openModal('changePasswordModal');
}

async function handleUserPasswordChange(event) {
  event.preventDefault();
  if (!currentUser) return;

  const newPass = document.getElementById('userNewPasswordInput').value;
  const confirmPass = document.getElementById('userConfirmPasswordInput').value;

  if (newPass !== confirmPass) {
    showToast('Les mots de passe ne correspondent pas', 'error');
    return;
  }

  const newHash = await hashPassword(newPass);
  currentUser.passwordHash = newHash;
  currentUser.password = newPass;
  saveCurrentUserData();

  closeModal('changePasswordModal');
  showToast('Votre mot de passe a été modifié avec succès !', 'success');
}

// ========================================================
// Import de Portefeuille CSV (Fichier Dédié)
// ========================================================
function importPositionsCSV(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const content = e.target.result;
      const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length <= 1) {
        showToast('Le fichier CSV est vide', 'error');
        return;
      }

      const firstLine = lines[0];
      const sep = firstLine.includes(';') ? ';' : ',';

      const importedPositions = [];
      for (let i = 1; i < lines.length; i++) {
        const rawLine = lines[i];
        if (!rawLine.trim()) continue;

        const parts = rawLine.split(sep).map(p => p.trim().replace(/^["']|["']$/g, ''));
        if (parts.length >= 4) {
          const company = parts[0] || 'Société';
          const ticker = (parts[1] || 'TICKER').toUpperCase();
          const shares = parseFloat(parts[2].replace(',', '.')) || 0;
          const invested = parseFloat(parts[3].replace(',', '.')) || 0;
          const dpa = parts.length > 5 ? (parseFloat(parts[5].replace(',', '.')) || 0) : (invested > 0 && shares > 0 ? (invested * 0.05 / shares) : 1);
          const received = parts.length > 7 ? (parseFloat(parts[7].replace(',', '.')) || 0) : 0;

          importedPositions.push({
            id: 'pos_' + Date.now() + '_' + i,
            company,
            ticker,
            shares,
            invested,
            dpa,
            received
          });
        }
      }

      if (importedPositions.length === 0) {
        showToast('Format CSV non reconnu', 'error');
        return;
      }

      positions = importedPositions;
      savePositions();
      renderAll();
      showToast(`Bravo ! ${importedPositions.length} positions importées depuis votre CSV.`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Erreur lors de la lecture du fichier CSV', 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function formatMoney(amount) {
  const num = parseFloat(amount) || 0;
  return num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currentCurrency;
}

function formatNumber(num) {
  const n = parseFloat(num) || 0;
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 4 });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const bgClass = type === 'success' 
    ? 'bg-emerald-900/90 border-emerald-500/50 text-emerald-200' 
    : type === 'error'
    ? 'bg-rose-900/90 border-rose-500/50 text-rose-200'
    : 'bg-slate-800/95 border-slate-700 text-slate-200';

  const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info';

  toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-xl text-xs backdrop-blur font-medium transition-all duration-300 transform translate-y-2 opacity-0 pointer-events-auto ${bgClass}`;
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ========================================================
// 8. Base Officielle Calendrier Bourse de Casablanca (BVC)
// ========================================================
const CASABOURSE_CALENDAR_2026 = [
  { company: "Afriquia Gaz", ticker: "GAZ", dpa: 175.00, yield: 4.60, detachement: "24/03/2026", paiement: "02/04/2026" },
  { company: "Maghreb Oxygène", ticker: "MOX", dpa: 4.00, yield: 1.00, detachement: "24/03/2026", paiement: "02/04/2026" },
  { company: "Immorente Invest", ticker: "IMO", dpa: 5.50, yield: 6.04, detachement: "22/04/2026", paiement: "04/05/2026" },
  { company: "Auto Nejma", ticker: "NEJ", dpa: 176.00, yield: 4.08, detachement: "30/04/2026", paiement: "11/05/2026" },
  { company: "Auto Hall", ticker: "ATH", dpa: 2.00, yield: 2.74, detachement: "15/05/2026", paiement: "26/05/2026" },
  { company: "CDM (Crédit du Maroc)", ticker: "CDM", dpa: 48.00, yield: 4.80, detachement: "04/06/2026", paiement: "15/06/2026" },
  { company: "Cash Plus", ticker: "CP", dpa: 9.73, yield: 3.51, detachement: "04/06/2026", paiement: "15/06/2026" },
  { company: "Salafin", ticker: "SLF", dpa: 29.00, yield: 5.86, detachement: "04/06/2026", paiement: "12/06/2026" },
  { company: "CFG Bank", ticker: "CFG", dpa: 4.00, yield: 2.00, detachement: "10/06/2026", paiement: "22/06/2026" },
  { company: "Colorado", ticker: "COL", dpa: 3.20, yield: 4.02, detachement: "10/06/2026", paiement: "23/06/2026" },
  { company: "Société des Boissons du Maroc", ticker: "SBM", dpa: 127.00, yield: 5.83, detachement: "10/06/2026", paiement: "22/06/2026" },
  { company: "LafargeHolcim Maroc", ticker: "LHM", dpa: 96.00, yield: 5.40, detachement: "12/06/2026", paiement: "24/06/2026" },
  { company: "Total Energies Maroc", ticker: "TMA", dpa: 89.57, yield: 5.96, detachement: "18/06/2026", paiement: "29/06/2026" },
  { company: "Wafa Assurance", ticker: "WFA", dpa: 150.00, yield: 2.67, detachement: "18/06/2026", paiement: "29/06/2026" },
  { company: "Afric Industries", ticker: "AFI", dpa: 20.00, yield: 5.80, detachement: "19/06/2026", paiement: "30/06/2026" },
  { company: "Aradei Capital", ticker: "ARD", dpa: 23.00, yield: 5.32, detachement: "19/06/2026", paiement: "30/06/2026" },
  { company: "AtlantaSanad Assurance", ticker: "ATL", dpa: 5.90, yield: 4.58, detachement: "19/06/2026", paiement: "30/06/2026" },
  { company: "Oulmes", ticker: "OUL", dpa: 40.15, yield: 3.35, detachement: "19/06/2026", paiement: "30/06/2026" },
  { company: "Risma", ticker: "RIS", dpa: 9.00, yield: 2.73, detachement: "22/06/2026", paiement: "01/07/2026" },
  { company: "Vicenne", ticker: "VCN", dpa: 8.44, yield: 2.25, detachement: "22/06/2026", paiement: "01/07/2026" },
  { company: "Disway", ticker: "DWY", dpa: 44.00, yield: 5.58, detachement: "24/06/2026", paiement: "03/07/2026" },
  { company: "Disty Technologies", ticker: "DYT", dpa: 19.50, yield: 5.53, detachement: "26/06/2026", paiement: "07/07/2026" },
  { company: "CIH Bank", ticker: "CIH", dpa: 14.00, yield: 4.05, detachement: "01/07/2026", paiement: "10/07/2026" },
  { company: "Label Vie", ticker: "LBV", dpa: 120.00, yield: 3.31, detachement: "01/07/2026", paiement: "10/07/2026" },
  { company: "Mutandis", ticker: "MUT", dpa: 10.50, yield: 4.41, detachement: "01/07/2026", paiement: "10/07/2026" },
  { company: "Sothema", ticker: "SOT", dpa: 6.60, yield: 1.77, detachement: "01/07/2026", paiement: "10/07/2026" },
  { company: "Ciments du Maroc", ticker: "CMA", dpa: 65.00, yield: 3.95, detachement: "06/07/2026", paiement: "15/07/2026" },
  { company: "Ennakl Automobiles", ticker: "NKL", dpa: 2.81, yield: 5.31, detachement: "06/07/2026", paiement: "15/07/2026" },
  { company: "Attijariwafa bank", ticker: "ATW", dpa: 22.00, yield: 3.23, detachement: "08/07/2026", paiement: "17/07/2026" },
  { company: "BCP (Banque Populaire)", ticker: "BCP", dpa: 11.00, yield: 4.42, detachement: "09/07/2026", paiement: "20/07/2026" },
  { company: "Delta Holding", ticker: "DHO", dpa: 2.00, yield: 3.49, detachement: "13/07/2026", paiement: "22/07/2026" },
  { company: "Jet Contractors", ticker: "JET", dpa: 20.00, yield: 0.95, detachement: "13/07/2026", paiement: "22/07/2026" },
  { company: "Agma", ticker: "AGM", dpa: 310.00, yield: 4.32, detachement: "14/07/2026", paiement: "23/07/2026" },
  { company: "Aluminium du Maroc", ticker: "ALM", dpa: 110.00, yield: 5.96, detachement: "14/07/2026", paiement: "23/07/2026" },
  { company: "SGTM", ticker: "SGT", dpa: 12.00, yield: 1.71, detachement: "14/07/2026", paiement: "23/07/2026" },
  { company: "Managem", ticker: "MNG", dpa: 5.50, yield: 0.44, detachement: "15/07/2026", paiement: "24/07/2026" },
  { company: "SMI", ticker: "SMI", dpa: 150.00, yield: 2.46, detachement: "15/07/2026", paiement: "24/07/2026" },
  { company: "Bank Of Africa", ticker: "BOA", dpa: 5.00, yield: 2.65, detachement: "16/07/2026", paiement: "27/07/2026" },
  { company: "HPS", ticker: "HPS", dpa: 8.00, yield: 1.33, detachement: "16/07/2026", paiement: "27/07/2026" },
  { company: "BMCI", ticker: "BMI", dpa: 14.00, yield: 2.38, detachement: "17/07/2026", paiement: "28/07/2026" },
  { company: "Marsa Maroc", ticker: "MSA", dpa: 11.00, yield: 1.26, detachement: "17/07/2026", paiement: "28/07/2026" },
  { company: "Microdata", ticker: "MIC", dpa: 40.00, yield: 5.34, detachement: "17/07/2026", paiement: "28/07/2026" },
  { company: "Sonasid", ticker: "SID", dpa: 52.00, yield: 2.60, detachement: "20/07/2026", paiement: "29/07/2026" },
  { company: "Alliances", ticker: "ADI", dpa: 4.00, yield: 1.10, detachement: "21/07/2026", paiement: "31/07/2026" },
  { company: "Cosumar", ticker: "CSR", dpa: 10.00, yield: 5.41, detachement: "22/07/2026", paiement: "03/08/2026" },
  { company: "Eqdom", ticker: "EQD", dpa: 57.00, yield: 3.70, detachement: "23/07/2026", paiement: "04/08/2026" },
  { company: "Balima", ticker: "BAL", dpa: 5.50, yield: 2.83, detachement: "24/07/2026", paiement: "05/08/2026" },
  { company: "Dari Couspate", ticker: "DRI", dpa: 140.00, yield: 3.33, detachement: "31/07/2026", paiement: "11/08/2026" },
  { company: "TGCC", ticker: "TGC", dpa: 15.00, yield: 1.90, detachement: "07/08/2026", paiement: "19/08/2026" },
  { company: "Akdital", ticker: "AKT", dpa: 14.00, yield: 1.22, detachement: "17/08/2026", paiement: "02/09/2026" },
  { company: "Sanlam Maroc", ticker: "SAH", dpa: 98.00, yield: 3.48, detachement: "19/08/2026", paiement: "03/09/2026" },
  { company: "Maghrebail", ticker: "MAB", dpa: 53.00, yield: 5.78, detachement: "28/08/2026", paiement: "08/09/2026" },
  { company: "Maroc Telecom", ticker: "IAM", dpa: 4.00, yield: 4.07, detachement: "04/09/2026", paiement: "15/09/2026" },
  { company: "AFMA", ticker: "AFM", dpa: 62.00, yield: 4.80, detachement: "08/09/2026", paiement: "17/09/2026" },
  { company: "Promopharm", ticker: "PRO", dpa: 30.00, yield: 2.18, detachement: "11/09/2026", paiement: "22/09/2026" },
  { company: "Taqa Morocco", ticker: "TQM", dpa: 38.00, yield: 2.18, detachement: "16/09/2026", paiement: "25/09/2026" },
  { company: "CTM", ticker: "CTM", dpa: 26.00, yield: 3.00, detachement: "17/09/2026", paiement: "28/09/2026" },
  { company: "Maroc Leasing", ticker: "MLE", dpa: 14.00, yield: 3.81, detachement: "17/09/2026", paiement: "28/09/2026" },
  { company: "T2S Group Holding", ticker: "T2S", dpa: 0.00, yield: 0.00, detachement: "IPO 28/07/2026", paiement: "—" }
];

function initCasaBourseCalendar() {
  const datalist = document.getElementById('casaBourseDatalist');
  if (datalist) {
    datalist.innerHTML = CASABOURSE_CALENDAR_2026.map(item => 
      `<option value="${escapeHtml(item.company)}">${escapeHtml(item.ticker)} - DPA: ${item.dpa.toFixed(2)} MAD (${item.yield.toFixed(2)}%)</option>`
    ).join('');
  }
}

function onSelectCasaBourseCompany(event) {
  const query = event.target.value.trim().toLowerCase();
  const match = CASABOURSE_CALENDAR_2026.find(c => c.company.toLowerCase() === query || c.ticker.toLowerCase() === query);
  if (match) {
    const tickerInput = document.getElementById('posTicker');
    const dpaInput = document.getElementById('posDpa');
    if (tickerInput) tickerInput.value = match.ticker;
    if (dpaInput && match.dpa > 0) dpaInput.value = match.dpa;
    showToast(`Valeur reconnue : ${match.company} (DPA: ${match.dpa.toFixed(2)} MAD)`, 'info');
  }
}

function openCasaBourseModal() {
  openModal('casaBourseModal');
  filterCasaBourseCalendar();
}

function filterCasaBourseCalendar() {
  const input = document.getElementById('casaBourseSearchInput');
  const query = input ? input.value.trim().toLowerCase() : '';
  const filtered = CASABOURSE_CALENDAR_2026.filter(item => 
    !query || 
    item.company.toLowerCase().includes(query) || 
    item.ticker.toLowerCase().includes(query) || 
    item.paiement.includes(query)
  );

  const badge = document.getElementById('casaBourseCountBadge');
  if (badge) badge.textContent = `${filtered.length} sociétés`;

  const tbody = document.getElementById('casaBourseTableBody');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-500">Aucune société trouvée pour "${escapeHtml(query)}"</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(item => `
    <tr class="hover:bg-slate-800/40 transition">
      <td class="py-2.5 px-3 font-semibold text-white">${escapeHtml(item.company)}</td>
      <td class="py-2.5 px-2 font-mono text-emerald-400 font-bold">${escapeHtml(item.ticker)}</td>
      <td class="py-2.5 px-3 text-right font-mono text-cyan-300">${item.dpa > 0 ? item.dpa.toFixed(2) + ' DH' : '—'}</td>
      <td class="py-2.5 px-3 text-right font-mono text-amber-400">${item.yield > 0 ? item.yield.toFixed(2) + ' %' : '—'}</td>
      <td class="py-2.5 px-3 font-mono text-slate-400">${escapeHtml(item.detachement)}</td>
      <td class="py-2.5 px-3 font-mono text-indigo-300">${escapeHtml(item.paiement)}</td>
      <td class="py-2.5 px-3 text-center">
        <button onclick="addFromCasaBourse('${escapeHtml(item.ticker)}')" class="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 text-[11px] font-semibold transition">
          + Ajouter
        </button>
      </td>
    </tr>
  `).join('');
}

function addFromCasaBourse(ticker) {
  const item = CASABOURSE_CALENDAR_2026.find(c => c.ticker === ticker);
  if (!item) return;
  closeModal('casaBourseModal');
  openModal('addPositionModal');

  document.getElementById('editPositionId').value = '';
  document.getElementById('posCompany').value = item.company;
  document.getElementById('posTicker').value = item.ticker;
  document.getElementById('posDpa').value = item.dpa > 0 ? item.dpa : '';
  document.getElementById('posShares').value = '';
  document.getElementById('posInvested').value = '';
  document.getElementById('posReceived').value = '0';
  document.getElementById('posShares').focus();
}

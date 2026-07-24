// ==========================================
// 1. CONFIGURACIÓN E INICIALIZACIÓN SUPABASE
// ==========================================
const SUPABASE_URL = 'https://xleuiecmipaujgsjzmio.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_orLMmUKXkITbz0HQgt0CyQ_sr2Djuc0';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Estado global
let currentUser = null;
let recognition = null;

// ==========================================
// 2. MÓDULO DE AUTENTICACIÓN (LOGIN & SESIÓN)
// ==========================================
async function initAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (session) {
    currentUser = session.user;
    updateAuthUI(true);
  } else {
    updateAuthUI(false);
  }

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    updateAuthUI(!!currentUser);
  });
}

function updateAuthUI(isLoggedIn) {
  const userStatus = document.getElementById('userStatus');
  const authBtn = document.getElementById('authBtn');
  const btnVoice = document.getElementById('btn-voice');
  const loginScreen = document.getElementById('login-screen');
  const mainContent = document.getElementById('main-content');

  if (isLoggedIn && currentUser) {
    if (userStatus) userStatus.textContent = `Usuario: ${currentUser.email}`;
    if (authBtn) {
      authBtn.style.display = 'inline-flex';
      authBtn.classList.add('logged-in');
    }
    if (btnVoice) btnVoice.style.display = 'inline-flex';

    // MOSTRAR APP / OCULTAR LOGIN
    if (loginScreen) loginScreen.style.display = 'none';
    if (mainContent) mainContent.style.display = 'flex';

    loadSurtidores();
    loadVentas();
  } else {
    if (userStatus) userStatus.textContent = 'Usuario: No autenticado';
    if (authBtn) authBtn.style.display = 'none';
    if (btnVoice) btnVoice.style.display = 'none';

    // OCULTAR APP / MOSTRAR LOGIN
    if (loginScreen) loginScreen.style.display = 'flex';
    if (mainContent) mainContent.style.display = 'none';
  }
}

async function loginUser(email, password) {
  try {
    email = email.trim();
    password = password.trim();

    if (!email || !password) {
      alert('Debes ingresar tu email y contraseña.');
      return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      console.error('Error de Supabase Auth:', error);
      alert('Email o contraseña incorrectos.');
      return;
    }

    currentUser = data.user;
    updateAuthUI(true);

  } catch (err) {
    console.error('Error inesperado al iniciar sesión:', err);
    alert('Ocurrió un error al iniciar sesión: ' + err.message);
  }
}

async function logoutUser() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) console.error('Error al salir:', error.message);
}

// ==========================================
// 3. GESTIÓN DE SURTIDORES Y VENTAS (DATABASE)
// ==========================================

async function loadSurtidores() {
  const selectElement = document.getElementById('surtidor-select');
  if (!selectElement) return;

  const { data: surtidores, error } = await supabaseClient
    .from('surtidores')
    .select('*');

  if (error) {
    console.error('Error cargando surtidores:', error);
    selectElement.innerHTML = '<option value="">Error al cargar surtidores</option>';
    return;
  }

  selectElement.innerHTML = '<option value="">Selecciona un surtidor...</option>';
  (surtidores || []).forEach(s => {
    const option = document.createElement('option');
    option.value = s.id;
    option.dataset.combustible = s.combustible || '';
    option.textContent = `Surtidor #${s.numero || s.id} - ${s.combustible}`;
    selectElement.appendChild(option);
  });
}

async function registrarVenta(surtidorId, monto, litros) {
  try {
    const selectElement = document.getElementById('surtidor-select');
    const selectedOption = selectElement?.options[selectElement.selectedIndex];
    const combustible = selectedOption?.dataset?.combustible || null;

    const litrosNum = parseFloat(litros);
    const totalNum = parseFloat(monto);
    const precioNum = litrosNum > 0 ? Number((totalNum / litrosNum).toFixed(2)) : 0;

    const { error } = await supabaseClient
      .from('ventas')
      .insert([
        {
          surtidor_id: surtidorId,
          litros: litrosNum,
          precio: precioNum,
          total: totalNum,
          combustible: combustible,
          usuario_id: currentUser?.id || null,
          fecha: new Date().toISOString()
        }
      ]);

    if (error) throw error;

    alert('¡Venta registrada correctamente!');
    loadVentas();
  } catch (err) {
    console.error('Error registrando venta:', err.message);
    alert('Error al guardar la venta: ' + err.message);
  }
}

async function loadVentas() {
  const container = document.getElementById('tablaHistorial');
  if (!container) return;

  const { data: ventas, error } = await supabaseClient
    .from('ventas')
    .select('*, surtidores(numero, combustible)')
    .order('fecha', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error cargando ventas:', error);
    container.innerHTML = '<tr><td colspan="4" style="text-align:center;">Error al cargar ventas</td></tr>';
    return;
  }

  if (!ventas || ventas.length === 0) {
    container.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay ventas registradas</td></tr>';
    return;
  }

  container.innerHTML = ventas.map(v => `
    <tr>
      <td>${new Date(v.fecha).toLocaleString()}</td>
      <td>Surtidor #${v.surtidores?.numero || v.surtidor_id} (${v.surtidores?.combustible || v.combustible || ''})</td>
      <td>${v.litros} L</td>
      <td>BS ${v.total}</td>
    </tr>
  `).join('');
}

// ==========================================
// 4. INTEGRACIÓN DE RECONOCIMIENTO DE VOZ
// ==========================================
function initVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) return;

  recognition = new SpeechRecognition();
  recognition.lang = 'es-BO';
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => updateVoiceUI(true);
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.toLowerCase();
    procesarComandoVoz(transcript);
  };
  recognition.onerror = () => updateVoiceUI(false);
  recognition.onend = () => updateVoiceUI(false);
}

function procesarComandoVoz(comando) {
  if (comando.includes('actualizar') || comando.includes('cargar ventas')) {
    loadVentas();
    speakText('Actualizando lista de ventas');
  } else if (comando.includes('cerrar sesión') || comando.includes('salir')) {
    logoutUser();
    speakText('Cerrando sesión');
  }
}

function speakText(text) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    window.speechSynthesis.speak(utterance);
  }
}

function toggleVoiceInput() {
  if (!recognition) initVoiceRecognition();
  if (recognition) {
    try {
      recognition.start();
    } catch (e) {
      recognition.stop();
    }
  }
}

function updateVoiceUI(isListening) {
  const btn = document.getElementById('btn-voice');
  if (btn) {
    btn.innerHTML = isListening ? '<i class="fas fa-microphone"></i> Escuchando...' : '<i class="fas fa-microphone"></i> Activar Voz';
    btn.classList.toggle('active', isListening);
  }
}

// ==========================================
// 5. INICIALIZACIÓN Y EVENTOS DEL DOM
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initVoiceRecognition();

  // Evento Login del Formulario
  document.getElementById('login-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    loginUser(email, password);
  });

  document.getElementById('authBtn')?.addEventListener('click', logoutUser);
  document.getElementById('btn-voice')?.addEventListener('click', toggleVoiceInput);

  document.getElementById('venta-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const surtidorId = document.getElementById('surtidor-select').value;
    const monto = document.getElementById('venta-monto').value;
    const litros = document.getElementById('venta-litros').value;

    if (surtidorId && monto && litros) {
      registrarVenta(surtidorId, monto, litros);
      e.target.reset();
    } else {
      alert('Por favor selecciona un surtidor y llena todos los campos.');
    }
  });
});
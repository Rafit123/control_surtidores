// 1. Configuración de Supabase
const SUPABASE_URL = 'https://xleuiecmipaujgsjzmio.supabase.co';
const SUPABASE_KEY = 'sb_publishable_orLMmUKXkITbz0HQgt0CyQ_sr2Djuc0';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM Elements - Autenticación
const loginSection = document.getElementById('loginSection');
const appSection = document.getElementById('appSection');
const formLogin = document.getElementById('formLogin');
const loginError = document.getElementById('loginError');
const btnLogout = document.getElementById('btnLogout');
const btnLoginSubmit = document.getElementById('btnLoginSubmit');

// DOM Elements - Aplicación
const selectSurtidor = document.getElementById('selectSurtidor');
const formVenta = document.getElementById('formVenta');
const btnSubmitVenta = document.getElementById('btnSubmitVenta');
const tablaVentas = document.getElementById('tablaVentas').querySelector('tbody');
const btnVoice = document.getElementById('btnVoice');
const voiceOutput = document.getElementById('voiceOutput');
const statusToast = document.getElementById('statusToast');

// ==========================================
// PERSISTENCIA Y INICIALIZACIÓN
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  const sesionGuardada = localStorage.getItem('usuario_sesion');
  if (sesionGuardada) {
    mostrarAplicacion();
  }
});

function mostrarAplicacion() {
  loginSection.style.display = 'none';
  appSection.style.display = 'block';
  cargarSurtidores();
  cargarVentas();
  iniciarSuscrpcionRealtime();
}

function mostrarToast(mensaje, esError = false) {
  statusToast.textContent = mensaje;
  statusToast.className = esError ? 'toast toast-error' : 'toast toast-success';
  statusToast.style.display = 'block';
  setTimeout(() => {
    statusToast.style.display = 'none';
  }, 4000);
}

// ==========================================
// 2. LÓGICA DE INICIO DE SESIÓN (LOGIN)
// ==========================================

formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.style.display = 'none';
  btnLoginSubmit.disabled = true;
  btnLoginSubmit.textContent = 'Verificando...';

  const userVal = document.getElementById('loginUser').value.trim();
  const passVal = document.getElementById('loginPass').value.trim();

  try {
    const { data, error } = await _supabase
      .from('usuarios')
      .select('*')
      .eq('usuario', userVal)
      .eq('password', passVal);

    if (error) {
      console.error('Error en la consulta de login:', error);
      loginError.textContent = 'Error al conectar con la base de datos.';
      loginError.style.display = 'block';
      return;
    }

    if (data && data.length > 0) {
      localStorage.setItem('usuario_sesion', JSON.stringify(data[0]));
      mostrarAplicacion();
      formLogin.reset();
    } else {
      loginError.textContent = 'Usuario o contraseña incorrectos';
      loginError.style.display = 'block';
    }
  } catch (err) {
    console.error('Excepción en login:', err);
    loginError.textContent = 'Ocurrió un error inesperado.';
    loginError.style.display = 'block';
  } finally {
    btnLoginSubmit.disabled = false;
    btnLoginSubmit.textContent = 'Ingresar';
  }
});

// Cerrar Sesión
btnLogout.addEventListener('click', () => {
  localStorage.removeItem('usuario_sesion');
  appSection.style.display = 'none';
  loginSection.style.display = 'block';
  formLogin.reset();
});

// ==========================================
// 3. CARGAR SURTIDORES
// ==========================================

async function cargarSurtidores() {
  const { data, error } = await _supabase.from('surtidores').select('*');
  
  if (error) {
    console.error('Error cargando surtidores:', error);
    selectSurtidor.innerHTML = '<option value="">Error al cargar surtidores</option>';
    return;
  }

  selectSurtidor.innerHTML = '<option value="">Selecciona un surtidor</option>';
  data.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.dataset.numero = s.numero;
    opt.dataset.combustible = s.combustible;
    opt.textContent = `Surtidor #${s.numero} (${s.combustible})`;
    selectSurtidor.appendChild(opt);
  });
}

// ==========================================
// 4. CARGAR Y MOSTRAR VENTAS
// ==========================================

async function cargarVentas() {
  const { data, error } = await _supabase
    .from('ventas')
    .select('*, surtidores(numero)')
    .order('fecha', { ascending: false });

  if (error) {
    console.error('Error al cargar ventas:', error);
    return;
  }

  tablaVentas.innerHTML = '';
  data.forEach(v => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${v.id}</td>
      <td>${new Date(v.fecha).toLocaleString()}</td>
      <td>#${v.surtidores ? v.surtidores.numero : v.surtidor_id}</td>
      <td>${v.combustible}</td>
      <td>${v.litros} L</td>
      <td><b>Bs. ${parseFloat(v.total).toFixed(2)}</b></td>
    `;
    tablaVentas.appendChild(row);
  });
}

// ==========================================
// 5. REGISTRAR NUEVA VENTA
// ==========================================

formVenta.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  btnSubmitVenta.disabled = true;
  btnSubmitVenta.textContent = 'Guardando...';

  const surtidorId = selectSurtidor.value;
  const selectedOpt = selectSurtidor.options[selectSurtidor.selectedIndex];
  const combustible = selectedOpt.dataset.combustible;
  const litros = parseFloat(document.getElementById('litros').value);
  const precio = parseFloat(document.getElementById('precio').value);
  const total = litros * precio;

  const { error } = await _supabase.from('ventas').insert([
    {
      surtidor_id: surtidorId,
      combustible: combustible,
      litros: litros,
      precio: precio,
      total: total
    }
  ]);

  if (error) {
    mostrarToast('Error al registrar venta: ' + error.message, true);
  } else {
    mostrarToast('✅ Venta registrada con éxito');
    formVenta.reset();
    cargarVentas();
  }

  btnSubmitVenta.disabled = false;
  btnSubmitVenta.textContent = 'Guardar Venta';
});

// ==========================================
// 6. INTEGRACIÓN WEB SPEECH API (VOZ)
// ==========================================

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.lang = 'es-ES';
  recognition.continuous = false;

  btnVoice.addEventListener('click', () => {
    recognition.start();
    voiceOutput.textContent = 'Escuchando...';
  });

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.toLowerCase();
    voiceOutput.textContent = `Escuchado: "${transcript}"`;
    procesarComandoVoz(transcript);
  };

  recognition.onerror = (event) => {
    voiceOutput.textContent = 'Error de voz: ' + event.error;
  };
} else {
  btnVoice.disabled = true;
  voiceOutput.textContent = 'Tu navegador no soporta la Web Speech API.';
}

function procesarComandoVoz(texto) {
  const numeros = texto.match(/\d+(?:[\.,]\d+)?/g);
  
  if (numeros && numeros.length >= 1) {
    document.getElementById('litros').value = parseFloat(numeros[0].replace(',', '.'));
  }
  if (numeros && numeros.length >= 2) {
    document.getElementById('precio').value = parseFloat(numeros[1].replace(',', '.'));
  }

  const matchSurtidor = texto.match(/surtidor\s*(\d+)/i);
  if (matchSurtidor) {
    const numSurtidor = matchSurtidor[1];
    const options = Array.from(selectSurtidor.options);
    const optMatch = options.find(opt => opt.dataset.numero === numSurtidor);
    if (optMatch) {
      selectSurtidor.value = optMatch.value;
    }
  }
}

// ==========================================
// 7. REALTIME DE ALERTAS
// ==========================================

function iniciarSuscrpcionRealtime() {
  _supabase
    .channel('alertas_realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alertas' }, payload => {
      const nuevaAlerta = payload.new;
      mostrarToast(`⚠️ ALERTA EN VIVO: Surtidor ${nuevaAlerta.surtidor_id} - ${nuevaAlerta.tipo}`, true);
    })
    .subscribe();
}
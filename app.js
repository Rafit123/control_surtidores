// 1. Configuración de Supabase (Conexión configurada)
const SUPABASE_URL = 'https://xleuiecmipaujgsjzmio.supabase.co';
const SUPABASE_KEY = 'sb_publishable_orLMmUKXkITbz0HQgt0CyQ_sr2Djuc0';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM Elements
const selectSurtidor = document.getElementById('selectSurtidor');
const formVenta = document.getElementById('formVenta');
const tablaVentas = document.getElementById('tablaVentas').querySelector('tbody');
const btnVoice = document.getElementById('btnVoice');
const voiceOutput = document.getElementById('voiceOutput');

// 2. Cargar Surtidores al inicio
async function cargarSurtidores() {
  const { data, error } = await _supabase.from('surtidores').select('*');
  
  if (error) {
    console.error('Error cargando surtidores:', error);
    selectSurtidor.innerHTML = '<option value="">Error al cargar</option>';
    return;
  }

  selectSurtidor.innerHTML = '<option value="">Selecciona un surtidor</option>';
  data.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.dataset.combustible = s.combustible;
    opt.textContent = `Surtidor #${s.numero} (${s.combustible})`;
    selectSurtidor.appendChild(opt);
  });
}

// 3. Cargar y Mostrar Ventas
async function cargarVentas() {
  const { data, error } = await _supabase
    .from('ventas')
    .select('*, surtidores(numero)')
    .order('fecha', { ascending: false });

  if (error) return console.error('Error al cargar ventas:', error);

  tablaVentas.innerHTML = '';
  data.forEach(v => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${v.id}</td>
      <td>${new Date(v.fecha).toLocaleString()}</td>
      <td>#${v.surtidores ? v.surtidores.numero : v.surtidor_id}</td>
      <td>${v.combustible}</td>
      <td>${v.litros} L</td>
      <td><b>Bs. ${v.total}</b></td>
    `;
    tablaVentas.appendChild(row);
  });
}

// 4. Guardar Venta
formVenta.addEventListener('submit', async (e) => {
  e.preventDefault();
  
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
    alert('Error al registrar venta: ' + error.message);
  } else {
    alert('Venta registrada con éxito');
    formVenta.reset();
    cargarVentas();
  }
});

// 5. Integración Web Speech API (Reconocimiento de voz)
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
    const transcript = event.results[0][0].transcript;
    voiceOutput.textContent = `Escuchado: "${transcript}"`;
  };

  recognition.onerror = (event) => {
    voiceOutput.textContent = 'Error de voz: ' + event.error;
  };
} else {
  btnVoice.disabled = true;
  voiceOutput.textContent = 'Tu navegador no soporta la Web Speech API.';
}

// Inicializar
cargarSurtidores();
cargarVentas();
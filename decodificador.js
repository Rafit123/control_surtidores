// decodificador.js
// Decodifica el byte de estado que manda el hardware del surtidor
// (guardado normalmente en la tabla "decodificaciones_hardware").

// Máscaras de bits para leer los registros
const MASK_COMBUSTIBLE = 0x0F; // Bits 0-3
const MASK_ESTADO      = 0x70; // Bits 4-6
const MASK_ALERTA      = 0x80; // Bit 7

function decodificarRegistroVenta(registroBinario) {
  // 1. Extraer combustible
  const tipoCodigo = registroBinario & MASK_COMBUSTIBLE;
  let combustible = "Desconocido";
  if (tipoCodigo === 1) combustible = "Gasolina Especial";
  if (tipoCodigo === 2) combustible = "Gasolina Premium";
  if (tipoCodigo === 4) combustible = "Diesel";

  // 2. Extraer estado
  const estadoCodigo = (registroBinario & MASK_ESTADO) >> 4;
  let estado = "En Mantenimiento";
  if (estadoCodigo === 1) estado = "Manguera Colgada";
  if (estadoCodigo === 2) estado = "Manguera Descolgada";
  if (estadoCodigo === 4) estado = "Dispensando";

  // 3. Evaluar Alerta
  const tieneAlerta = (registroBinario & MASK_ALERTA) !== 0;

  return {
    combustible: combustible,
    estadoSurtidor: estado,
    alertaCritica: tieneAlerta
  };
}

// Se expone en window para que app.js (u otro script cargado después)
// pueda usar esta función si lo necesita, por ejemplo:
//   const info = window.decodificarRegistroVenta(130);
window.decodificarRegistroVenta = decodificarRegistroVenta;
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const HISTORIAL_PATH = path.join(__dirname, '../data/historial.json');

function leerHistorial() {
  try {
    return JSON.parse(fs.readFileSync(HISTORIAL_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function guardarHistorial(historial) {
  fs.writeFileSync(HISTORIAL_PATH, JSON.stringify(historial, null, 2));
}

async function fetchDolarActual() {
  const apiKey = process.env.EXCHANGE_API_KEY;
  if (!apiKey) throw new Error('Falta la variable de entorno EXCHANGE_API_KEY');

  const res = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/pair/USD/CLP`);
  if (!res.ok) throw new Error(`ExchangeRate-API respondió ${res.status}`);
  const json = await res.json();
  if (json.result !== 'success') throw new Error(`ExchangeRate-API: ${json['error-type']}`);

  const valor = parseFloat(json.conversion_rate.toFixed(2));
  const fecha = new Date().toISOString();
  return { fecha, valor };
}

async function actualizarHistorial() {
  const nuevo = await fetchDolarActual();

  const historial = leerHistorial();
  historial.push(nuevo);

  // Conservar solo los últimos 30 días en puntos (máx 1000 entradas ~ 3 semanas de polling cada 30 min)
  const limite = 60 * 24 * 2; // 2 días de granularidad cada 30 min = 96 entradas; para 30 días de vista diaria conservamos más
  const recortado = historial.slice(-Math.max(limite, 30));
  guardarHistorial(recortado);

  console.log(`[${nuevo.fecha}] USD/CLP actualizado: $${nuevo.valor}`);
  return { nuevo, historial: recortado };
}

// Para el gráfico: agrupar historial por día (último valor del día)
function historialPorDia(historial) {
  const porDia = {};
  for (const entry of historial) {
    const dia = entry.fecha.slice(0, 10);
    porDia[dia] = entry.valor;
  }
  return Object.entries(porDia)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([fecha, valor]) => ({ fecha, valor }));
}

module.exports = { actualizarHistorial, leerHistorial, historialPorDia };

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const HISTORIAL_PATH = path.join(__dirname, '../data/historial.json');

function leerHistorial() {
  try {
    const raw = fs.readFileSync(HISTORIAL_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function guardarHistorial(historial) {
  fs.writeFileSync(HISTORIAL_PATH, JSON.stringify(historial, null, 2));
}

async function fetchDolarHoy() {
  const res = await fetch('https://mindicador.cl/api/dolar');
  if (!res.ok) throw new Error(`Mindicador.cl respondió ${res.status}`);
  const json = await res.json();
  const serie = json.serie;
  if (!serie || serie.length === 0) throw new Error('Serie vacía');

  const hoy = serie[0];
  return { fecha: hoy.fecha.split('T')[0], valor: hoy.valor };
}

async function fetchHistorial30() {
  const res = await fetch('https://mindicador.cl/api/dolar');
  if (!res.ok) throw new Error(`Mindicador.cl respondió ${res.status}`);
  const json = await res.json();
  const serie = json.serie || [];

  return serie
    .slice(0, 30)
    .map(d => ({ fecha: d.fecha.split('T')[0], valor: d.valor }))
    .reverse();
}

async function actualizarHistorial() {
  const datos = await fetchHistorial30();
  guardarHistorial(datos);
  console.log(`[${new Date().toISOString()}] Historial actualizado. ${datos.length} registros.`);
  return datos;
}

module.exports = { actualizarHistorial, leerHistorial };

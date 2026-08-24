const https = require('https');
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

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'usdclp-tracker/1.0' }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON inválido')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function fetchSerieDolar() {
  const json = await httpGet('https://mindicador.cl/api/dolar');
  const serie = json.serie;
  if (!serie || serie.length === 0) throw new Error('mindicador.cl: serie vacía');
  // La serie viene con el dato más reciente primero; usamos la fecha del dato
  // (no la de hoy): en fin de semana la serie trae el valor del viernes y
  // registrarlo con fecha de hoy duplicaría días en el historial
  return serie.map(p => ({
    fecha: p.fecha,
    valor: parseFloat(parseFloat(p.valor).toFixed(2)),
  }));
}

async function actualizarHistorial() {
  const serie = await fetchSerieDolar();
  const nuevo = serie[0];

  let historial = leerHistorial();
  if (historial.length === 0) {
    // Historial vacío (deploy nuevo): sembrar con toda la serie (~30 días)
    // para que los indicadores funcionen desde el primer arranque
    historial = [...serie].reverse();
    console.log(`[Init] Historial sembrado con ${historial.length} días de mindicador.cl`);
  } else {
    historial.push(nuevo);
  }

  const limite = 60 * 24 * 2;
  const recortado = historial.slice(-Math.max(limite, 30));
  guardarHistorial(recortado);

  console.log(`[${nuevo.fecha}] USD/CLP actualizado: $${nuevo.valor}`);
  return { nuevo, historial: recortado };
}

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

const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { actualizarHistorial, leerHistorial, historialPorDia } = require('../services/fetchDolar');
const { analizar } = require('../services/analisis');

const SENALES_PATH = path.join(__dirname, '../data/senales.json');

function leerSenales() {
  try { return JSON.parse(fs.readFileSync(SENALES_PATH, 'utf-8')); } catch { return []; }
}

// Clientes SSE conectados
const sseClients = new Set();

function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(msg); } catch { sseClients.delete(res); }
  }
}

// Exponer broadcast para que server.js lo use
router.broadcast = broadcast;

// SSE — el cliente se suscribe aquí y recibe actualizaciones en tiempo real
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Enviar datos actuales al conectarse
  const historial = leerHistorial();
  const diario = historialPorDia(historial);
  const analisis = analizar(diario);
  if (analisis) res.write(`data: ${JSON.stringify({ valorActual: analisis.precio, historial: diario, analisis })}\n\n`);

  // Heartbeat cada 30s para mantener la conexión viva
  const heartbeat = setInterval(() => { try { res.write(': ping\n\n'); } catch { clearInterval(heartbeat); } }, 30000);

  sseClients.add(res);
  req.on('close', () => { sseClients.delete(res); clearInterval(heartbeat); });
});

router.get('/dolar', async (req, res) => {
  try {
    let historial = leerHistorial();
    if (historial.length === 0) {
      const result = await actualizarHistorial();
      historial = result.historial;
    }
    const diario = historialPorDia(historial);
    const analisis = analizar(diario);
    if (!analisis) return res.status(503).json({ error: 'Sin datos disponibles' });
    res.json({ valorActual: analisis.precio, historial: diario, analisis });
  } catch (e) {
    console.error('[GET /api/dolar]', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post('/actualizar', async (req, res) => {
  try {
    const { historial } = await actualizarHistorial();
    const diario = historialPorDia(historial);
    const analisis = analizar(diario);
    if (analisis) broadcast({ valorActual: analisis.precio, historial: diario, analisis });
    res.json({ ok: true, valorActual: analisis?.precio, analisis });
  } catch (e) {
    console.error('[POST /api/actualizar]', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get('/senales', (req, res) => {
  res.json(leerSenales());
});

module.exports = router;

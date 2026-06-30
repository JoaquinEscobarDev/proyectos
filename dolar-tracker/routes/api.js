const express = require('express');
const router = express.Router();
const { actualizarHistorial, leerHistorial, historialPorDia } = require('../services/fetchDolar');
const { analizar } = require('../services/analisis');
const { leerConfig, guardarConfig } = require('../services/whatsapp');

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
    res.json({ ok: true, valorActual: analisis?.precio, analisis });
  } catch (e) {
    console.error('[POST /api/actualizar]', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get('/alertas', (req, res) => {
  const c = leerConfig();
  res.json({
    numero: c.numero,
    umbralAlto: c.umbralAlto,
    umbralBajo: c.umbralBajo,
    umbralCambio: c.umbralCambio,
    ultimaSenal: c.ultimaSenal
  });
});

router.post('/alertas', (req, res) => {
  try {
    const { numero, apiKey, umbralAlto, umbralBajo, umbralCambio } = req.body;
    const config = leerConfig();
    if (numero      !== undefined) config.numero       = String(numero).trim();
    if (apiKey      !== undefined) config.apiKey       = String(apiKey).trim();
    if (umbralAlto  !== undefined) config.umbralAlto   = parseFloat(umbralAlto)  || 0;
    if (umbralBajo  !== undefined) config.umbralBajo   = parseFloat(umbralBajo)  || 0;
    if (umbralCambio !== undefined) config.umbralCambio = parseFloat(umbralCambio) || 3;
    guardarConfig(config);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

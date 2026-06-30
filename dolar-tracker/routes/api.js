const express = require('express');
const router = express.Router();
const { actualizarHistorial, leerHistorial } = require('../services/fetchDolar');
const { analizar } = require('../services/analisis');
const { leerConfig, guardarConfig } = require('../services/whatsapp');

router.get('/dolar', async (req, res) => {
  try {
    let historial = leerHistorial();
    if (historial.length === 0) {
      historial = await actualizarHistorial();
    }

    const analisis = analizar(historial);
    if (!analisis) return res.status(503).json({ error: 'Sin datos disponibles' });

    res.json({
      valorActual: analisis.precio,
      historial,
      analisis
    });
  } catch (e) {
    console.error('[GET /api/dolar]', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post('/actualizar', async (req, res) => {
  try {
    const historial = await actualizarHistorial();
    const analisis = analizar(historial);
    res.json({ ok: true, registros: historial.length, analisis });
  } catch (e) {
    console.error('[POST /api/actualizar]', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get('/alertas', (req, res) => {
  const config = leerConfig();
  res.json({ numero: config.numero, umbral: config.umbral, ultimaSenal: config.ultimaSenal });
});

router.post('/alertas', (req, res) => {
  try {
    const { numero, apiKey, umbral } = req.body;
    const config = leerConfig();
    if (numero !== undefined) config.numero = String(numero).trim();
    if (apiKey !== undefined) config.apiKey = String(apiKey).trim();
    if (umbral !== undefined) config.umbral = parseFloat(umbral) || 0;
    guardarConfig(config);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

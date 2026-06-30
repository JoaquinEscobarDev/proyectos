const express = require('express');
const router = express.Router();
const { actualizarHistorial, leerHistorial, historialPorDia } = require('../services/fetchDolar');
const { analizar } = require('../services/analisis');

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


module.exports = router;

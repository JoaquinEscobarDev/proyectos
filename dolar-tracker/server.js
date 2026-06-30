require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const path = require('path');

const { actualizarHistorial, leerHistorial, historialPorDia } = require('./services/fetchDolar');
const { analizar } = require('./services/analisis');
const { evaluarCambio, enviarResumenDiario } = require('./services/whatsapp');
const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS: permite que el frontend en Hostinger llame al backend en Render
app.use((req, res, next) => {
  const allowed = process.env.FRONTEND_URL || '*';
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', apiRouter);

// Cada 30 minutos en horario de mercado: Lun-Vie 9:00-18:00 hora Chile
cron.schedule('*/30 9-18 * * 1-5', async () => {
  console.log('[Cron] Actualizando precio de mercado...');
  try {
    const { historial } = await actualizarHistorial();
    const diario = historialPorDia(historial);
    const analisis = analizar(diario);
    if (analisis) await evaluarCambio(analisis);
  } catch (e) {
    console.error('[Cron] Error:', e.message);
  }
}, { timezone: 'America/Santiago' });

// Resumen diario a las 18:00 hora Chile (cierre de mercado)
cron.schedule('0 18 * * 1-5', async () => {
  console.log('[Cron] Enviando resumen diario...');
  try {
    const historial = leerHistorial();
    const diario = historialPorDia(historial);
    const analisis = analizar(diario);
    if (analisis) await enviarResumenDiario(analisis);
  } catch (e) {
    console.error('[Cron] Resumen diario error:', e.message);
  }
}, { timezone: 'America/Santiago' });

app.listen(PORT, async () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  const historial = leerHistorial();
  if (historial.length === 0) {
    console.log('[Init] Cargando precio inicial...');
    try {
      await actualizarHistorial();
    } catch (e) {
      console.error('[Init] Error:', e.message);
    }
  }
});

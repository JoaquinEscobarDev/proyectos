const express = require('express');
const cron = require('node-cron');
const path = require('path');

const { actualizarHistorial, leerHistorial } = require('./services/fetchDolar');
const { analizar } = require('./services/analisis');
const { evaluarAlertas } = require('./services/whatsapp');
const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', apiRouter);

// Scheduler: cada día a las 10:00 AM hora Chile (UTC-3 → 13:00 UTC)
cron.schedule('0 13 * * *', async () => {
  console.log('[Cron] Actualizando dólar...');
  try {
    const historial = await actualizarHistorial();
    const analisis = analizar(historial);
    if (analisis) await evaluarAlertas(analisis);
  } catch (e) {
    console.error('[Cron] Error:', e.message);
  }
}, { timezone: 'America/Santiago' });

app.listen(PORT, async () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);

  // Al iniciar, si no hay historial cacheado lo cargamos
  const historial = leerHistorial();
  if (historial.length === 0) {
    console.log('[Init] Cargando historial inicial...');
    try {
      await actualizarHistorial();
    } catch (e) {
      console.error('[Init] Error cargando historial:', e.message);
    }
  }
});

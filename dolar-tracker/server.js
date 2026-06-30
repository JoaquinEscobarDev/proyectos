require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const { actualizarHistorial, leerHistorial, historialPorDia } = require('./services/fetchDolar');
const { analizar } = require('./services/analisis');
const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

const SENALES_PATH  = path.join(__dirname, 'data/senales.json');
const ESTADO_PATH   = path.join(__dirname, 'data/estado.json');

function leerSenales() {
  try { return JSON.parse(fs.readFileSync(SENALES_PATH, 'utf-8')); } catch { return []; }
}
function guardarSenales(s) { fs.writeFileSync(SENALES_PATH, JSON.stringify(s, null, 2)); }
function leerEstado() {
  try { return JSON.parse(fs.readFileSync(ESTADO_PATH, 'utf-8')); } catch { return { precioApertura: 0, fechaApertura: '' }; }
}
function guardarEstado(e) { fs.writeFileSync(ESTADO_PATH, JSON.stringify(e, null, 2)); }

function registrarSenal(analisis) {
  const senales = leerSenales();
  const ultima = senales[senales.length - 1];
  if (ultima && ultima.senal === analisis.senal) return; // no duplicar si no cambió
  senales.push({
    fecha:     new Date().toISOString(),
    senal:     analisis.senal,
    emoji:     analisis.emoji,
    precio:    analisis.precio,
    rsi:       analisis.rsi,
    score:     analisis.score,
    tendencia: analisis.tendencia,
  });
  guardarSenales(senales.slice(-50)); // conservar últimas 50
}

function actualizarPrecioApertura(precio) {
  const hoy = new Date().toISOString().slice(0, 10);
  const estado = leerEstado();
  if (estado.fechaApertura !== hoy) {
    guardarEstado({ precioApertura: precio, fechaApertura: hoy });
  }
}

// 1. Headers de seguridad (oculta X-Powered-By, añade CSP, HSTS, etc.)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "https://cdn.jsdelivr.net"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "https://api.exchangerate-api.com"],
      imgSrc:     ["'self'", "data:"],
    }
  }
}));

// 2. CORS restringido al dominio del frontend
app.use((req, res, next) => {
  const allowed = process.env.FRONTEND_URL || '*';
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// 3. Rate limiting: máx 60 requests/15 min por IP en toda la API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta en 15 minutos.' }
});

// Rate limiting más estricto para el endpoint de actualización manual
const actualizarLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Límite de actualizaciones manuales alcanzado. Espera 1 minuto.' }
});

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', apiLimiter, apiRouter);
app.use('/api/actualizar', actualizarLimiter);

async function cicloActualizacion() {
  try {
    const { historial } = await actualizarHistorial();
    const diario = historialPorDia(historial);
    const analisis = analizar(diario);
    if (!analisis) return;

    actualizarPrecioApertura(analisis.precio);
    registrarSenal(analisis);

    // Inyectar precio de apertura en el objeto antes de broadcast
    const estado = leerEstado();
    analisis.precioApertura = estado.precioApertura || analisis.precio;

    apiRouter.broadcast({ valorActual: analisis.precio, historial: diario, analisis });
    console.log(`[${new Date().toISOString()}] Broadcast: $${analisis.precio} | ${analisis.senal}`);
  } catch (e) {
    console.error('[Ciclo] Error:', e.message);
  }
}

// Cada 30 min, Lun-Vie 9:00-18:00 hora Chile
cron.schedule('*/30 9-18 * * 1-5', cicloActualizacion, { timezone: 'America/Santiago' });

app.listen(PORT, async () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  const historial = leerHistorial();
  if (historial.length === 0) {
    console.log('[Init] Cargando precio inicial...');
    try { await cicloActualizacion(); } catch (e) { console.error('[Init]', e.message); }
  }
});

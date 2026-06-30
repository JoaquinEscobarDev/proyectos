const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const ALERTAS_PATH = path.join(__dirname, '../config/alertas.json');

function leerConfig() {
  try {
    return JSON.parse(fs.readFileSync(ALERTAS_PATH, 'utf-8'));
  } catch {
    return { numero: '', apiKey: '', umbralAlto: 0, umbralBajo: 0, umbralCambio: 3, ultimaSenal: '', ultimoPrecio: 0, precioApertura: 0 };
  }
}

function guardarConfig(config) {
  fs.writeFileSync(ALERTAS_PATH, JSON.stringify(config, null, 2));
}

async function enviarWhatsApp(numero, apiKey, mensaje) {
  const encoded = encodeURIComponent(mensaje);
  const url = `https://api.callmebot.com/whatsapp.php?phone=${numero}&text=${encoded}&apikey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CallMeBot respondió ${res.status}`);
}

async function enviarMensaje(config, mensaje) {
  if (!config.numero || !config.apiKey) return;
  try {
    await enviarWhatsApp(config.numero, config.apiKey, mensaje);
    console.log(`[WhatsApp] Enviado: ${mensaje}`);
  } catch (e) {
    console.error(`[WhatsApp] Error:`, e.message);
  }
}

// Llamado cada 30 min: evalúa si el precio cambió lo suficiente para alertar
async function evaluarCambio(analisis) {
  const config = leerConfig();
  if (!config.numero || !config.apiKey) return;

  const { precio, senal, emoji, rsi } = analisis;
  const umbral = config.umbralCambio || 3;
  const ultimo = config.ultimoPrecio || 0;
  const cambio = ultimo > 0 ? Math.abs(precio - ultimo) : 0;

  if (ultimo > 0 && cambio >= umbral) {
    const direccion = precio > ultimo ? '📈 Subió' : '📉 Bajó';
    const diff = (precio - ultimo).toFixed(2);
    const signo = diff > 0 ? '+' : '';
    await enviarMensaje(
      config,
      `${direccion} USD/CLP\n💵 Precio: $${precio.toFixed(2)} (${signo}${diff})\n${emoji} Señal: ${senal} | RSI: ${rsi !== null ? rsi.toFixed(1) : 'N/A'}\n${analisis.razon}`
    );
  }

  // Alerta de umbral alto
  if (config.umbralAlto > 0 && precio > config.umbralAlto && ultimo <= config.umbralAlto) {
    await enviarMensaje(config, `⚠️ USD/CLP superó $${config.umbralAlto}: ahora en $${precio.toFixed(2)}`);
  }

  // Alerta de umbral bajo
  if (config.umbralBajo > 0 && precio < config.umbralBajo && ultimo >= config.umbralBajo) {
    await enviarMensaje(config, `✅ USD/CLP bajó de $${config.umbralBajo}: ahora en $${precio.toFixed(2)}`);
  }

  // Cambio de señal técnica
  if (config.ultimaSenal !== senal) {
    await enviarMensaje(
      config,
      `🔔 Señal cambió a ${emoji} ${senal}\n💵 USD/CLP: $${precio.toFixed(2)} | RSI: ${rsi !== null ? rsi.toFixed(1) : 'N/A'}\n${analisis.razon}`
    );
  }

  config.ultimoPrecio = precio;
  config.ultimaSenal = senal;
  guardarConfig(config);
}

// Llamado una vez al día al cierre del mercado: resumen diario
async function enviarResumenDiario(analisis) {
  const config = leerConfig();
  if (!config.numero || !config.apiKey) return;

  const { precio, senal, emoji, rsi, sma7, tendencia, soporte, resistencia } = analisis;
  const apertura = config.precioApertura || precio;
  const variacion = (precio - apertura).toFixed(2);
  const signo = variacion >= 0 ? '+' : '';
  const dir = variacion >= 0 ? '📈' : '📉';

  const msg =
    `📊 RESUMEN DIARIO USD/CLP\n` +
    `${dir} Cierre: $${precio.toFixed(2)} (${signo}${variacion} vs apertura)\n` +
    `${emoji} Señal: ${senal}\n` +
    `📐 RSI: ${rsi !== null ? rsi.toFixed(1) : 'N/A'} | Tendencia: ${tendencia}\n` +
    `📉 Soporte: $${soporte} | 📈 Resistencia: $${resistencia}\n` +
    `SMA7: $${sma7 || '—'}\n` +
    `⚠️ Análisis orientativo, no es asesoría financiera.`;

  await enviarMensaje(config, msg);

  // Guardar precio de cierre como apertura del día siguiente
  config.precioApertura = precio;
  guardarConfig(config);
}

module.exports = { evaluarCambio, enviarResumenDiario, leerConfig, guardarConfig };

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const ALERTAS_PATH = path.join(__dirname, '../config/alertas.json');

function leerConfig() {
  try {
    return JSON.parse(fs.readFileSync(ALERTAS_PATH, 'utf-8'));
  } catch {
    return { numero: '', apiKey: '', umbral: 0, ultimaSenal: '' };
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
  return true;
}

async function evaluarAlertas(analisis) {
  const config = leerConfig();
  if (!config.numero || !config.apiKey) return;

  const { precio, rsi, senal, emoji, soporte, resistencia } = analisis;
  const mensajes = [];

  if (config.umbral > 0 && precio > config.umbral) {
    mensajes.push(
      `⚠️ USD/CLP superó umbral: $${precio.toFixed(0)} (umbral: $${config.umbral})`
    );
  }

  if (config.ultimaSenal && config.ultimaSenal !== senal) {
    mensajes.push(
      `📊 USD/CLP: $${precio.toFixed(2)} | Señal: ${emoji} ${senal} | RSI: ${rsi !== null ? rsi.toFixed(1) : 'N/A'} | ${analisis.razon}`
    );
  }

  for (const msg of mensajes) {
    try {
      await enviarWhatsApp(config.numero, config.apiKey, msg);
      console.log(`[WhatsApp] Alerta enviada: ${msg}`);
    } catch (e) {
      console.error(`[WhatsApp] Error enviando alerta:`, e.message);
    }
  }

  config.ultimaSenal = senal;
  guardarConfig(config);
}

module.exports = { evaluarAlertas, leerConfig, guardarConfig };

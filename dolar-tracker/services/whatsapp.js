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

  if (config.umbral > 0) {
    const ultimoPrecio = config.ultimoPrecio || 0;
    const cruzoArriba = precio > config.umbral && ultimoPrecio <= config.umbral;
    const cruzoAbajo  = precio < config.umbral && ultimoPrecio >= config.umbral;
    if (cruzoArriba) {
      mensajes.push(`⚠️ USD/CLP superó el umbral: $${precio.toFixed(0)} > $${config.umbral}`);
    } else if (cruzoAbajo) {
      mensajes.push(`✅ USD/CLP bajó del umbral: $${precio.toFixed(0)} < $${config.umbral}`);
    }
  }

  // Envía siempre que la señal cambie, o la primera vez que se registra
  if (config.ultimaSenal !== senal) {
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
  config.ultimoPrecio = precio;
  guardarConfig(config);
}

module.exports = { evaluarAlertas, leerConfig, guardarConfig };

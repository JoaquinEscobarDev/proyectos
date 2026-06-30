const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const ALERTAS_PATH = path.join(__dirname, '../config/alertas.json');

function leerConfig() {
  return {
    instanceId:    process.env.GREEN_INSTANCE_ID   || '',
    apiToken:      process.env.GREEN_API_TOKEN      || '',
    groupChatId:   process.env.GREEN_GROUP_CHAT_ID  || '',
    umbralAlto:    parseFloat(process.env.UMBRAL_ALTO)   || 0,
    umbralBajo:    parseFloat(process.env.UMBRAL_BAJO)   || 0,
    umbralCambio:  parseFloat(process.env.UMBRAL_CAMBIO) || 3,
    ...leerEstado()
  };
}

function leerEstado() {
  try {
    return JSON.parse(fs.readFileSync(ALERTAS_PATH, 'utf-8'));
  } catch {
    return { ultimaSenal: '', ultimoPrecio: 0, precioApertura: 0 };
  }
}

function guardarEstado(estado) {
  fs.writeFileSync(ALERTAS_PATH, JSON.stringify(estado, null, 2));
}

async function enviarGreenAPI(instanceId, apiToken, groupChatId, mensaje) {
  const url = `https://api.green-api.com/waInstance${instanceId}/sendMessage/${apiToken}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: groupChatId, message: mensaje })
  });
  if (!res.ok) throw new Error(`Green API respondió ${res.status}`);
}

async function enviarMensaje(config, mensaje) {
  if (!config.instanceId || !config.apiToken || !config.groupChatId) {
    console.log('[WhatsApp] Sin configuración de Green API, omitiendo alerta.');
    return;
  }
  try {
    await enviarGreenAPI(config.instanceId, config.apiToken, config.groupChatId, mensaje);
    console.log(`[WhatsApp] Enviado al grupo: ${mensaje.slice(0, 60)}...`);
  } catch (e) {
    console.error(`[WhatsApp] Error:`, e.message);
  }
}

async function evaluarCambio(analisis) {
  const config = leerConfig();
  const { precio, senal, emoji, rsi } = analisis;
  const umbral = config.umbralCambio;
  const ultimo = config.ultimoPrecio || 0;
  const cambio = ultimo > 0 ? Math.abs(precio - ultimo) : 0;

  if (ultimo > 0 && cambio >= umbral) {
    const direccion = precio > ultimo ? '📈 Subió' : '📉 Bajó';
    const diff = (precio - ultimo).toFixed(2);
    const signo = diff > 0 ? '+' : '';
    await enviarMensaje(config,
      `${direccion} USD/CLP\n💵 Precio: $${precio.toFixed(2)} (${signo}${diff})\n${emoji} Señal: ${senal} | RSI: ${rsi !== null ? rsi.toFixed(1) : 'N/A'}\n${analisis.razon}`
    );
  }

  if (config.umbralAlto > 0 && precio > config.umbralAlto && ultimo <= config.umbralAlto) {
    await enviarMensaje(config, `⚠️ USD/CLP superó $${config.umbralAlto}: ahora en $${precio.toFixed(2)}`);
  }

  if (config.umbralBajo > 0 && precio < config.umbralBajo && ultimo >= config.umbralBajo) {
    await enviarMensaje(config, `✅ USD/CLP bajó de $${config.umbralBajo}: ahora en $${precio.toFixed(2)}`);
  }

  if (config.ultimaSenal !== senal) {
    await enviarMensaje(config,
      `🔔 Señal cambió a ${emoji} ${senal}\n💵 USD/CLP: $${precio.toFixed(2)} | RSI: ${rsi !== null ? rsi.toFixed(1) : 'N/A'}\n${analisis.razon}`
    );
  }

  guardarEstado({ ultimaSenal: senal, ultimoPrecio: precio, precioApertura: config.precioApertura || precio });
}

async function enviarResumenDiario(analisis) {
  const config = leerConfig();
  const { precio, senal, emoji, rsi, sma7, tendencia, soporte, resistencia } = analisis;
  const apertura = config.precioApertura || precio;
  const variacion = (precio - apertura).toFixed(2);
  const signo = variacion >= 0 ? '+' : '';
  const dir = variacion >= 0 ? '📈' : '📉';

  await enviarMensaje(config,
    `📊 RESUMEN DIARIO USD/CLP\n` +
    `${dir} Cierre: $${precio.toFixed(2)} (${signo}${variacion} vs apertura)\n` +
    `${emoji} Señal: ${senal}\n` +
    `📐 RSI: ${rsi !== null ? rsi.toFixed(1) : 'N/A'} | Tendencia: ${tendencia}\n` +
    `📉 Soporte: $${soporte} | 📈 Resistencia: $${resistencia}\n` +
    `SMA7: $${sma7 || '—'}\n` +
    `⚠️ Análisis orientativo, no es asesoría financiera.`
  );

  guardarEstado({ ultimaSenal: senal, ultimoPrecio: precio, precioApertura: precio });
}

module.exports = { evaluarCambio, enviarResumenDiario };

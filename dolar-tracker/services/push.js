const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

const SUBS_PATH = path.join(__dirname, '../data/subscriptions.json');

webpush.setVapidDetails(
  'mailto:' + (process.env.VAPID_EMAIL || 'admin@proyectos.fun'),
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

function leerSubs() {
  try { return JSON.parse(fs.readFileSync(SUBS_PATH, 'utf-8')); } catch { return []; }
}

function guardarSubs(subs) {
  fs.writeFileSync(SUBS_PATH, JSON.stringify(subs, null, 2));
}

function agregarSub(sub) {
  const subs = leerSubs();
  const existe = subs.some(s => s.endpoint === sub.endpoint);
  if (!existe) {
    subs.push(sub);
    guardarSubs(subs);
  }
}

function eliminarSub(endpoint) {
  const subs = leerSubs().filter(s => s.endpoint !== endpoint);
  guardarSubs(subs);
}

async function enviarPush(payload) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  const subs = leerSubs();
  if (subs.length === 0) return;

  const msg = JSON.stringify(payload);
  const resultados = await Promise.allSettled(
    subs.map(sub => webpush.sendNotification(sub, msg).catch(err => {
      // Suscripción expirada o inválida → eliminar
      if (err.statusCode === 404 || err.statusCode === 410) eliminarSub(sub.endpoint);
      throw err;
    }))
  );

  const ok  = resultados.filter(r => r.status === 'fulfilled').length;
  const err = resultados.filter(r => r.status === 'rejected').length;
  console.log(`[Push] Enviado a ${ok}/${subs.length} suscriptores (${err} fallidos)`);
}

module.exports = { agregarSub, enviarPush };

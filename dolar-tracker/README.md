# USD/CLP Tracker

Monitor y análisis técnico del dólar estadounidense frente al peso chileno.

## Stack
- **Backend**: Node.js + Express
- **Frontend**: HTML/CSS/JS vanilla (mobile-first, tema oscuro)
- **Datos**: [Mindicador.cl](https://mindicador.cl) (gratuita, oficial Chile)
- **Alertas**: CallMeBot WhatsApp API
- **Scheduler**: node-cron (actualización diaria 10:00 AM Chile)

## Instalación local

```bash
cd dolar-tracker
npm install
npm start
```

Abrir http://localhost:3000

## Configurar alertas WhatsApp (CallMeBot)

1. Agrega el número **+34 644 59 79 23** a tus contactos de WhatsApp con el nombre "CallMeBot"
2. Envía el mensaje `I allow callmebot to send me messages` a ese número por WhatsApp
3. Recibirás tu **API Key** por WhatsApp en segundos
4. Ingresa tu número (formato internacional, ej: `+56912345678`) y la API Key en la sección de alertas del dashboard

## Deploy en Railway

1. Sube el proyecto a GitHub
2. Ve a [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
3. Selecciona el repositorio `dolar-tracker`
4. Railway detecta automáticamente Node.js y usa `npm start`
5. En Settings → Variables, puedes configurar `PORT` (Railway lo asigna automáticamente)

El archivo `data/historial.json` y `config/alertas.json` persisten en el volumen de Railway. Si no usas volumen persistente, el historial se reconstruye desde Mindicador.cl al reiniciar.

## Indicadores técnicos

| Indicador | Descripción |
|-----------|-------------|
| SMA 7 | Media móvil simple de 7 días |
| SMA 30 | Media móvil simple de 30 días |
| RSI (14) | Relative Strength Index, 14 períodos. >70 sobrecomprado, <30 sobrevendido |
| Momentum | Precio actual vs hace 10 días |
| Soporte | Mínimo del mes |
| Resistencia | Máximo del mes |

## Señales

- 🟢 **COMPRAR**: RSI < 40 + precio cerca del soporte + tendencia alcista o lateral
- 🔴 **VENDER**: RSI > 60 + precio cerca de resistencia + tendencia bajista o lateral  
- 🟡 **ESPERAR**: señales mixtas o datos insuficientes

> ⚠️ Este análisis es orientativo y no constituye asesoría financiera.

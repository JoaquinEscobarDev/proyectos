# 📈 USD/CLP Tracker

> Monitor y análisis técnico del dólar estadounidense frente al peso chileno, en tiempo real.

![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white)
![Chart.js](https://img.shields.io/badge/Chart.js-4.x-FF6384?style=flat-square&logo=chartdotjs&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=flat-square&logo=pwa&logoColor=white)
![Deploy](https://img.shields.io/badge/Deploy-Hostinger-673DE6?style=flat-square)

---

## ✨ Características

| | |
|---|---|
| 📡 **Datos en tiempo real** | Precio USD/CLP actualizado cada 30 min vía ExchangeRate-API |
| 🔄 **SSE (Server-Sent Events)** | El dashboard se actualiza automáticamente sin recargar |
| 🧮 **7 indicadores técnicos** | RSI, SMA, EMA, MACD, Bollinger Bands, Estocástico, ATR |
| 🎯 **Señal por puntuación** | Los indicadores votan → COMPRAR / VENDER / ESPERAR |
| 📋 **Historial de señales** | Registro de cada cambio de señal con precio y score |
| 🌙 **Modo claro/oscuro** | Toggle con preferencia guardada |
| ⏱️ **Countdown** | Cuenta regresiva hasta la próxima actualización |
| 📱 **PWA** | Instalable en el celular como app nativa |
| 📊 **Gráfico RSI** | Panel secundario con niveles de sobrecompra/sobreventa |

---

## 🧮 Motor de análisis técnico

| Indicador | Descripción | Vota |
|-----------|-------------|------|
| **RSI (14)** | Fuerza relativa — sobrevendido <35 / sobrecomprado >65 | ✅ |
| **SMA 7 / SMA 30** | Tendencia por posición del precio vs medias simples | ✅ |
| **EMA 12 / EMA 26** | Base del MACD — medias exponenciales reactivas | — |
| **MACD** | Cruce de EMAs — detecta golden/death cross | ✅ |
| **Bollinger Bands** | Precio en banda inferior/superior (SMA20 ± 2σ) | ✅ |
| **Estocástico (14,3,3)** | %K — sobrevendido <20 / sobrecomprado >80 | ✅ |
| **ATR (14)** | Volatilidad promedio diaria | — |
| **Momentum** | Precio actual vs hace 10 días | ✅ |

### 🎯 Sistema de señal

Cada indicador marcado con ✅ **vota** (+1 alcista / -1 bajista / 0 neutral):

```
Score ≥ +3  →  🟢 COMPRAR
Score ≤ -3  →  🔴 VENDER
Resto       →  🟡 ESPERAR
```

---

## 🚀 Instalación local

```bash
git clone https://github.com/JoaquinEscobarDev/proyectos.git
cd proyectos/dolar-tracker
npm install
cp .env.example .env
# Edita .env con tu API Key de exchangerate-api.com
npm start
```

Abre [http://localhost:3000](http://localhost:3000)

---

## ⚙️ Variables de entorno

| Variable | Descripción | Requerida |
|---|---|---|
| `EXCHANGE_API_KEY` | Key de [exchangerate-api.com](https://www.exchangerate-api.com) (gratis) | ✅ |
| `FRONTEND_URL` | URL del frontend para CORS (ej: `https://proyectos.fun`) | En producción |
| `PORT` | Puerto del servidor (Hostinger lo asigna automáticamente) | No |

---

## 📁 Estructura del proyecto

```
dolar-tracker/
├── server.js               # Express + cron + SSE broadcast
├── package.json
├── render.yaml             # Config de deploy en Render
├── .env.example
├── data/
│   ├── historial.json      # Historial de precios (auto)
│   ├── senales.json        # Historial de señales (auto)
│   └── estado.json         # Precio de apertura del día (auto)
├── services/
│   ├── fetchDolar.js       # Consume ExchangeRate-API
│   └── analisis.js         # Motor técnico (7 indicadores)
├── routes/
│   └── api.js              # GET /api/dolar, /api/stream (SSE), /api/senales
└── public/
    ├── index.html
    ├── style.css           # Tema oscuro/claro, mobile-first
    ├── app.js              # SSE client, charts, countdown
    ├── config.js           # API_BASE para separar frontend/backend
    ├── manifest.json       # PWA manifest
    └── sw.js               # Service Worker
```

---

## 🌐 Deploy en Hostinger

1. Conecta el repo en **Hostinger → Node.js App**
2. Root directory: `dolar-tracker`
3. Entry file: `server.js`
4. Agrega las variables de entorno en el panel
5. Hostinger redespliega automáticamente con cada push a `master`

---

## 📜 Disclaimer

> ⚠️ Este análisis es orientativo y **no constituye asesoría financiera**.  
> Los indicadores técnicos no garantizan resultados. Úsalos como referencia, no como única fuente de decisión.

---

<div align="center">
  Hecho con ☕ · Datos por <a href="https://www.exchangerate-api.com">ExchangeRate-API</a>
</div>

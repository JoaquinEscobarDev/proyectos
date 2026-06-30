// --- Utilidades ---

function sma(valores, periodo) {
  if (valores.length < periodo) return null;
  const slice = valores.slice(-periodo);
  return slice.reduce((a, b) => a + b, 0) / periodo;
}

function ema(valores, periodo) {
  if (valores.length < periodo) return null;
  const k = 2 / (periodo + 1);
  let val = valores.slice(0, periodo).reduce((a, b) => a + b, 0) / periodo;
  for (let i = periodo; i < valores.length; i++) val = valores[i] * k + val * (1 - k);
  return val;
}

function emaArray(valores, periodo) {
  if (valores.length < periodo) return valores.map(() => null);
  const k = 2 / (periodo + 1);
  const result = Array(periodo - 1).fill(null);
  let val = valores.slice(0, periodo).reduce((a, b) => a + b, 0) / periodo;
  result.push(val);
  for (let i = periodo; i < valores.length; i++) {
    val = valores[i] * k + val * (1 - k);
    result.push(val);
  }
  return result;
}

function stddev(valores) {
  const mean = valores.reduce((a, b) => a + b, 0) / valores.length;
  return Math.sqrt(valores.reduce((acc, v) => acc + (v - mean) ** 2, 0) / valores.length);
}

// --- Indicadores ---

function calcularRSI(valores, periodo = 14) {
  if (valores.length < periodo + 1) return null;
  const cambios = [];
  for (let i = 1; i < valores.length; i++) cambios.push(valores[i] - valores[i - 1]);
  const recientes = cambios.slice(-periodo);
  const avgG = recientes.filter(c => c > 0).reduce((a, b) => a + b, 0) / periodo;
  const avgP = recientes.filter(c => c < 0).reduce((a, b) => a + Math.abs(b), 0) / periodo;
  if (avgP === 0) return 100;
  return 100 - 100 / (1 + avgG / avgP);
}

function calcularMACD(valores) {
  if (valores.length < 35) return null;
  const ema12arr = emaArray(valores, 12);
  const ema26arr = emaArray(valores, 26);
  const macdLine = ema12arr.map((e12, i) =>
    e12 !== null && ema26arr[i] !== null ? e12 - ema26arr[i] : null
  );
  const macdValidos = macdLine.filter(v => v !== null);
  if (macdValidos.length < 9) return null;
  const signalVal = ema(macdValidos, 9);
  const macdVal = macdValidos[macdValidos.length - 1];
  const prevMacd = macdValidos[macdValidos.length - 2];
  // Signal line prev (aproximado con EMA9 sin el último punto)
  const prevSignal = ema(macdValidos.slice(0, -1), 9);
  const cruce = prevMacd !== null && prevSignal !== null
    ? (prevMacd < prevSignal && macdVal > signalVal ? 'ALCISTA'
      : prevMacd > prevSignal && macdVal < signalVal ? 'BAJISTA'
      : null)
    : null;
  return {
    macd:      parseFloat(macdVal.toFixed(4)),
    signal:    parseFloat(signalVal.toFixed(4)),
    histogram: parseFloat((macdVal - signalVal).toFixed(4)),
    cruce,
  };
}

function calcularBollinger(valores, periodo = 20, desv = 2) {
  if (valores.length < periodo) return null;
  const slice = valores.slice(-periodo);
  const media = slice.reduce((a, b) => a + b, 0) / periodo;
  const std = stddev(slice);
  return {
    upper:  parseFloat((media + desv * std).toFixed(2)),
    middle: parseFloat(media.toFixed(2)),
    lower:  parseFloat((media - desv * std).toFixed(2)),
    ancho:  parseFloat(((desv * 2 * std / media) * 100).toFixed(2)),
  };
}

function calcularEstocastico(valores, k = 14, d = 3) {
  if (valores.length < k) return null;
  const slice = valores.slice(-k);
  const minK = Math.min(...slice);
  const maxK = Math.max(...slice);
  if (maxK === minK) return { k: 50, d: 50 };
  const kVal = ((valores[valores.length - 1] - minK) / (maxK - minK)) * 100;
  // %D = SMA3 de los últimos %K
  const kValues = [];
  for (let i = k; i <= valores.length; i++) {
    const s = valores.slice(i - k, i);
    const mn = Math.min(...s), mx = Math.max(...s);
    kValues.push(mx === mn ? 50 : ((valores[i - 1] - mn) / (mx - mn)) * 100);
  }
  const dVal = kValues.length >= d
    ? kValues.slice(-d).reduce((a, b) => a + b, 0) / d
    : kVal;
  return {
    k: parseFloat(kVal.toFixed(2)),
    d: parseFloat(dVal.toFixed(2)),
    estado: kVal > 80 ? 'sobrecomprado' : kVal < 20 ? 'sobrevendido' : 'neutral',
  };
}

function calcularATR(valores, periodo = 14) {
  if (valores.length < periodo + 1) return null;
  // Sin datos de high/low, usamos |close[i] - close[i-1]| como True Range
  const tr = [];
  for (let i = 1; i < valores.length; i++) tr.push(Math.abs(valores[i] - valores[i - 1]));
  const atr = tr.slice(-periodo).reduce((a, b) => a + b, 0) / periodo;
  return parseFloat(atr.toFixed(2));
}

function calcularTendencia(precio, sma7, sma30) {
  if (sma7 === null || sma30 === null) return 'LATERAL';
  if (precio > sma7 && sma7 > sma30) return 'ALCISTA';
  if (precio < sma7 && sma7 < sma30) return 'BAJISTA';
  return 'LATERAL';
}

// --- Sistema de puntuación (7 indicadores) ---

function generarSenal({ precio, rsi, tendencia, macd, bollinger, momentum, estocastico }) {
  const votos = [];

  if (rsi !== null) {
    if (rsi < 35)      votos.push({ ind: 'RSI',  voto:  1, texto: `RSI bajo (${rsi.toFixed(1)}) — sobrevendido` });
    else if (rsi > 65) votos.push({ ind: 'RSI',  voto: -1, texto: `RSI alto (${rsi.toFixed(1)}) — sobrecomprado` });
    else               votos.push({ ind: 'RSI',  voto:  0, texto: `RSI neutro (${rsi.toFixed(1)})` });
  }

  if (tendencia === 'ALCISTA')      votos.push({ ind: 'SMA', voto:  1, texto: 'tendencia alcista (precio > SMA7 > SMA30)' });
  else if (tendencia === 'BAJISTA') votos.push({ ind: 'SMA', voto: -1, texto: 'tendencia bajista (precio < SMA7 < SMA30)' });
  else                              votos.push({ ind: 'SMA', voto:  0, texto: 'tendencia lateral' });

  if (macd) {
    if (macd.cruce === 'ALCISTA')      votos.push({ ind: 'MACD', voto:  1, texto: 'cruce alcista MACD (golden cross)' });
    else if (macd.cruce === 'BAJISTA') votos.push({ ind: 'MACD', voto: -1, texto: 'cruce bajista MACD (death cross)' });
    else if (macd.macd > macd.signal)  votos.push({ ind: 'MACD', voto:  1, texto: 'MACD sobre línea de señal' });
    else if (macd.macd < macd.signal)  votos.push({ ind: 'MACD', voto: -1, texto: 'MACD bajo línea de señal' });
    else                               votos.push({ ind: 'MACD', voto:  0, texto: 'MACD neutral' });
  }

  if (bollinger) {
    if (precio <= bollinger.lower * 1.005)      votos.push({ ind: 'BB', voto:  1, texto: `precio en banda inferior Bollinger ($${bollinger.lower})` });
    else if (precio >= bollinger.upper * 0.995) votos.push({ ind: 'BB', voto: -1, texto: `precio en banda superior Bollinger ($${bollinger.upper})` });
    else                                        votos.push({ ind: 'BB', voto:  0, texto: 'precio dentro de bandas de Bollinger' });
  }

  if (momentum !== null) {
    if (momentum > 0)      votos.push({ ind: 'MOM', voto:  1, texto: `momentum positivo (+$${momentum.toFixed(2)})` });
    else if (momentum < 0) votos.push({ ind: 'MOM', voto: -1, texto: `momentum negativo ($${momentum.toFixed(2)})` });
    else                   votos.push({ ind: 'MOM', voto:  0, texto: 'momentum neutro' });
  }

  if (estocastico) {
    if (estocastico.k < 20)      votos.push({ ind: 'ESTO', voto:  1, texto: `Estocástico sobrevendido (%K ${estocastico.k.toFixed(1)})` });
    else if (estocastico.k > 80) votos.push({ ind: 'ESTO', voto: -1, texto: `Estocástico sobrecomprado (%K ${estocastico.k.toFixed(1)})` });
    else                         votos.push({ ind: 'ESTO', voto:  0, texto: `Estocástico neutro (%K ${estocastico.k.toFixed(1)})` });
  }

  const score    = votos.reduce((acc, v) => acc + v.voto, 0);
  const compras  = votos.filter(v => v.voto > 0).map(v => v.texto);
  const ventas   = votos.filter(v => v.voto < 0).map(v => v.texto);
  const total    = votos.length;

  let senal, emoji, razon;

  if (score >= 3) {
    senal = 'COMPRAR';
    emoji = '🟢';
    razon = `${score}/${total} indicadores alcistas: ${compras.join('; ')}.`;
  } else if (score <= -3) {
    senal = 'VENDER';
    emoji = '🔴';
    razon = `${Math.abs(score)}/${total} indicadores bajistas: ${ventas.join('; ')}.`;
  } else {
    senal = 'ESPERAR';
    emoji = '🟡';
    const dir = score > 0 ? `Leve inclinación alcista (${score}/${total})` : score < 0 ? `Leve inclinación bajista (${score}/${total})` : `Señales mixtas (${score}/${total})`;
    razon = `${dir}. Se recomienda esperar confirmación.`;
  }

  return { senal, emoji, razon, score, totalIndicadores: total };
}

// --- RSI array para el gráfico ---
function rsiArray(valores, periodo = 14) {
  if (valores.length < periodo + 1) return valores.map(() => null);
  const result = Array(periodo).fill(null);
  for (let i = periodo; i < valores.length; i++) {
    const cambios = [];
    for (let j = i - periodo + 1; j <= i; j++) cambios.push(valores[j] - valores[j - 1]);
    const avgG = cambios.filter(c => c > 0).reduce((a, b) => a + b, 0) / periodo;
    const avgP = cambios.filter(c => c < 0).reduce((a, b) => a + Math.abs(b), 0) / periodo;
    result.push(avgP === 0 ? 100 : parseFloat((100 - 100 / (1 + avgG / avgP)).toFixed(2)));
  }
  return result;
}

// --- Función principal ---

function analizar(historial) {
  if (!historial || historial.length === 0) return null;
  const valores  = historial.map(d => d.valor);
  const precio   = valores[valores.length - 1];
  const ayer     = valores.length >= 2  ? valores[valores.length - 2]  : null;
  const hace7    = valores.length >= 7  ? valores[valores.length - 7]  : null;
  const hace30   = valores.length >= 30 ? valores[0]                   : null;

  const sma7val   = sma(valores, 7);
  const sma30val  = sma(valores, 30);
  const ema12val  = ema(valores, 12);
  const ema26val  = ema(valores, 26);
  const rsiRaw    = calcularRSI(valores, 14);
  const rsi       = rsiRaw !== null ? parseFloat(rsiRaw.toFixed(2)) : null;
  const macd      = calcularMACD(valores);
  const bollinger = calcularBollinger(valores, 20);
  const estocastico = calcularEstocastico(valores, 14, 3);
  const atr       = calcularATR(valores, 14);
  const soporte   = Math.min(...valores);
  const resistencia = Math.max(...valores);
  const momentum  = valores.length >= 11 ? precio - valores[valores.length - 11] : null;
  const tendencia = calcularTendencia(precio, sma7val, sma30val);

  const r = v => v !== null ? parseFloat(v.toFixed(2)) : null;

  const { senal, emoji, razon, score, totalIndicadores } = generarSenal({
    precio, rsi, tendencia, macd, bollinger, momentum, estocastico
  });

  return {
    precio,
    ayer,
    variacionAyer:  r(ayer    ? ((precio - ayer)   / ayer)   * 100 : null),
    variacion7d:    r(hace7   ? ((precio - hace7)  / hace7)  * 100 : null),
    variacion30d:   r(hace30  ? ((precio - hace30) / hace30) * 100 : null),
    sma7:           r(sma7val),
    sma30:          r(sma30val),
    ema12:          r(ema12val),
    ema26:          r(ema26val),
    rsi,
    rsiArray:       rsiArray(valores, 14),
    estadoRSI:      rsi === null ? 'insuficiente' : rsi > 70 ? 'sobrecomprado' : rsi < 30 ? 'sobrevendido' : 'neutral',
    macd,
    bollinger,
    estocastico,
    atr,
    soporte:        r(soporte),
    resistencia:    r(resistencia),
    momentum:       r(momentum),
    tendencia,
    senal,
    emoji,
    razon,
    score,
    totalIndicadores,
  };
}

module.exports = { analizar };

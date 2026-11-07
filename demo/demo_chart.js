/**
 * Interactive Candlestick Chart Simulation for Demo
 */

(function () {
  const canvas = document.getElementById('candlestickCanvas');
  const ctx = canvas.getContext('2d');
  let candles = [];
  let currentPrice = 67500;
  let activeTimeframe = '15m';

  function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    drawChart();
  }

  window.addEventListener('resize', resizeCanvas);

  // Generate initial candle dataset
  function generateCandles(count = 55, basePrice = 67500) {
    const list = [];
    let p = basePrice;
    const now = Date.now();
    for (let i = count; i >= 0; i--) {
      const time = now - i * 15 * 60 * 1000;
      const trendBias = 0.49; // Slightly bullish
      const change = (Math.random() - trendBias) * (p * 0.006);
      const open = p;
      const close = p + change;
      const high = Math.max(open, close) + Math.random() * (p * 0.003);
      const low = Math.min(open, close) - Math.random() * (p * 0.003);
      const volume = Math.floor(Math.random() * 200 + 40);
      list.push({ time, open, high, low, close, volume });
      p = close;
    }
    return list;
  }

  function drawChart() {
    if (!ctx || candles.length === 0) return;
    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, width, height);

    // Min & Max prices
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    for (const c of candles) {
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
    }

    const pricePadding = (maxPrice - minPrice) * 0.12 || 10;
    minPrice -= pricePadding;
    maxPrice += pricePadding;

    const chartHeight = height - 40;
    const chartWidth = width - 70;

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const gridRows = 6;
    for (let i = 0; i <= gridRows; i++) {
      const y = (chartHeight / gridRows) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();

      // Price labels
      const p = maxPrice - (i / gridRows) * (maxPrice - minPrice);
      ctx.fillStyle = '#64748b';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.fillText(`$${p.toFixed(2)}`, chartWidth + 8, y + 3);
    }

    // Draw candlesticks
    const candleWidth = Math.max(4, (chartWidth / candles.length) * 0.65);
    const gap = chartWidth / candles.length;

    candles.forEach((c, i) => {
      const x = i * gap + gap * 0.5;
      const yOpen = chartHeight - ((c.open - minPrice) / (maxPrice - minPrice)) * chartHeight;
      const yClose = chartHeight - ((c.close - minPrice) / (maxPrice - minPrice)) * chartHeight;
      const yHigh = chartHeight - ((c.high - minPrice) / (maxPrice - minPrice)) * chartHeight;
      const yLow = chartHeight - ((c.low - minPrice) / (maxPrice - minPrice)) * chartHeight;

      const isBull = c.close >= c.open;
      ctx.fillStyle = isBull ? '#10b981' : '#ef4444';
      ctx.strokeStyle = isBull ? '#10b981' : '#ef4444';

      // Wick
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, yHigh);
      ctx.lineTo(x, yLow);
      ctx.stroke();

      // Body
      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    });

    // Current price dashed line
    const lastClose = candles[candles.length - 1].close;
    const yLast = chartHeight - ((lastClose - minPrice) / (maxPrice - minPrice)) * chartHeight;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, yLast);
    ctx.lineTo(chartWidth, yLast);
    ctx.stroke();
    ctx.setLineDash([]);

    // Current price pill on right axis
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(chartWidth + 2, yLast - 10, 65, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`$${lastClose.toFixed(1)}`, chartWidth + 6, yLast + 4);
  }

  // Update live analysis using PredictionEngine
  function updateAIAnalysis() {
    if (typeof PredictionEngine === 'undefined' || typeof TVAI_Overlay === 'undefined') return;

    const analysis = PredictionEngine.analyzeCandles(candles, {
      symbol: 'BTC/USDT',
      timeframe: activeTimeframe
    });

    TVAI_Overlay.updateAnalysis(analysis);
    TVAI_Overlay.setStatus('Demo Simulator Engine (Active)', true);

    // Update page header price
    const lastPrice = candles[candles.length - 1].close;
    const headerPriceEl = document.getElementById('chart-price');
    if (headerPriceEl) {
      headerPriceEl.textContent = `$${lastPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
      headerPriceEl.style.color = analysis.signal === 'BUY' ? '#10b981' : (analysis.signal === 'SELL' ? '#ef4444' : '#f59e0b');
    }
  }

  // Live price tick simulator
  function tick() {
    if (candles.length === 0) return;
    const last = candles[candles.length - 1];
    const delta = (Math.random() - 0.48) * 12;
    last.close += delta;
    if (last.close > last.high) last.high = last.close;
    if (last.close < last.low) last.low = last.close;

    drawChart();
  }

  // Init
  function init() {
    candles = generateCandles(50, 67500);
    resizeCanvas();

    // Init Overlay
    TVAI_Overlay.init(
      // On timeframe change
      (newTf) => {
        activeTimeframe = newTf;
        candles = generateCandles(50, candles[candles.length - 1].close);
        drawChart();
        updateAIAnalysis();
      },
      // On refresh
      () => {
        updateAIAnalysis();
      },
      // On mark levels
      (data) => {
        TVAI_Overlay.drawChartLevels(data);
      }
    );

    updateAIAnalysis();

    // Start tick loop
    setInterval(tick, 1000);
    // Periodically update AI analysis
    setInterval(updateAIAnalysis, 8000);
  }

  window.addEventListener('load', init);
})();


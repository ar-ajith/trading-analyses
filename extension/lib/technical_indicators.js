/**
 * Advanced Technical Indicators & Smart Money Concepts (SMC) Engine
 * Implements logic inspired by Tradelo, PatternSensei, ChartLense, Crypto SignAI, and ChartSense.
 */

const TechnicalIndicators = {
  // Simple Moving Average
  calculateSMA(values, period) {
    if (!values || values.length < period) return [];
    const sma = [];
    let sum = 0;
    for (let i = 0; i < period; i++) sum += values[i];
    sma.push(sum / period);
    for (let i = period; i < values.length; i++) {
      sum = sum - values[i - period] + values[i];
      sma.push(sum / period);
    }
    const padding = new Array(period - 1).fill(null);
    return padding.concat(sma);
  },

  // Exponential Moving Average
  calculateEMA(values, period) {
    if (!values || values.length < period) return [];
    const k = 2 / (period + 1);
    const ema = [];
    let sum = 0;
    for (let i = 0; i < period; i++) sum += values[i];
    let prevEMA = sum / period;
    const padding = new Array(period - 1).fill(null);
    ema.push(prevEMA);
    for (let i = period; i < values.length; i++) {
      const currentEMA = values[i] * k + prevEMA * (1 - k);
      ema.push(currentEMA);
      prevEMA = currentEMA;
    }
    return padding.concat(ema);
  },

  // Relative Strength Index (RSI - 14)
  calculateRSI(closes, period = 14) {
    if (!closes || closes.length <= period) return [];
    const rsi = new Array(period).fill(null);
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));

    for (let i = period + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
    return rsi;
  },

  // MACD (12, 26, 9)
  calculateMACD(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const fastEMA = this.calculateEMA(closes, fastPeriod);
    const slowEMA = this.calculateEMA(closes, slowPeriod);
    const macdLine = [];
    for (let i = 0; i < closes.length; i++) {
      if (fastEMA[i] === null || slowEMA[i] === null) macdLine.push(null);
      else macdLine.push(fastEMA[i] - slowEMA[i]);
    }
    const firstValidIndex = macdLine.findIndex(v => v !== null);
    if (firstValidIndex === -1) return { macd: [], signal: [], histogram: [] };

    const validMACD = macdLine.slice(firstValidIndex);
    const validSignal = this.calculateEMA(validMACD, signalPeriod);
    const signalLine = new Array(firstValidIndex).fill(null).concat(validSignal);
    const histogram = [];
    for (let i = 0; i < closes.length; i++) {
      if (macdLine[i] === null || signalLine[i] === null) histogram.push(null);
      else histogram.push(macdLine[i] - signalLine[i]);
    }
    return { macd: macdLine, signal: signalLine, histogram };
  },

  // Bollinger Bands (20, 2)
  calculateBollingerBands(closes, period = 20, multiplier = 2) {
    const sma = this.calculateSMA(closes, period);
    const upper = [], lower = [];
    for (let i = 0; i < closes.length; i++) {
      if (sma[i] === null) {
        upper.push(null); lower.push(null);
        continue;
      }
      let sumSquares = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sumSquares += Math.pow(closes[j] - sma[i], 2);
      }
      const stdDev = Math.sqrt(sumSquares / period);
      upper.push(sma[i] + multiplier * stdDev);
      lower.push(sma[i] - multiplier * stdDev);
    }
    return { middle: sma, upper, lower };
  },

  // Average True Range (ATR)
  calculateATR(candles, period = 14) {
    if (!candles || candles.length < period + 1) return [];
    const trueRanges = [candles[0].high - candles[0].low];
    for (let i = 1; i < candles.length; i++) {
      const c = candles[i];
      const prevClose = candles[i - 1].close;
      const tr = Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
      trueRanges.push(tr);
    }
    return this.calculateEMA(trueRanges, period);
  },

  // Support & Resistance via Swing Highs/Lows and Pivot Points
  calculateSupportResistance(candles) {
    if (!candles || candles.length < 10) return { supports: [], resistances: [], pivot: 0 };
    const recent = candles.slice(-50);
    const lastCandle = recent[recent.length - 1];
    let highestHigh = -Infinity, lowestLow = Infinity;
    const close = lastCandle.close;

    for (const c of recent) {
      if (c.high > highestHigh) highestHigh = c.high;
      if (c.low < lowestLow) lowestLow = c.low;
    }

    const pivot = (highestHigh + lowestLow + close) / 3;
    const r1 = 2 * pivot - lowestLow;
    const s1 = 2 * pivot - highestHigh;
    const r2 = pivot + (highestHigh - lowestLow);
    const s2 = pivot - (highestHigh - lowestLow);

    return {
      pivot: Number(pivot.toFixed(2)),
      r1: Number(r1.toFixed(2)),
      r2: Number(r2.toFixed(2)),
      s1: Number(s1.toFixed(2)),
      s2: Number(s2.toFixed(2))
    };
  },

  // ==========================================
  // SMART MONEY CONCEPTS (SMC) ENGINE (ChartLense AI)
  // ==========================================

  detectSmartMoneyConcepts(candles) {
    if (!candles || candles.length < 15) return { orderBlocks: [], fvgs: [], sweeps: [], structure: 'NEUTRAL' };

    const orderBlocks = [];
    const fvgs = [];
    const sweeps = [];
    let structure = 'CONSOLIDATING';

    const n = candles.length;
    const lastCandle = candles[n - 1];

    // 1. Fair Value Gaps (FVG / Imbalances)
    // Bullish FVG: Candle i-2 High < Candle i Low
    // Bearish FVG: Candle i-2 Low > Candle i High
    for (let i = n - 15; i < n; i++) {
      if (i >= 2) {
        const c1 = candles[i - 2];
        const c2 = candles[i - 1];
        const c3 = candles[i];

        // Bullish FVG
        if (c3.low > c1.high && c2.close > c2.open) {
          const gapSize = c3.low - c1.high;
          if (gapSize > (c2.close * 0.001)) {
            fvgs.push({
              type: 'BULLISH_FVG',
              top: Number(c3.low.toFixed(2)),
              bottom: Number(c1.high.toFixed(2)),
              mid: Number(((c3.low + c1.high) / 2).toFixed(2)),
              desc: `Bullish Imbalance (FVG) at ${c1.high.toFixed(2)} - ${c3.low.toFixed(2)}`
            });
          }
        }

        // Bearish FVG
        if (c1.low > c3.high && c2.close < c2.open) {
          const gapSize = c1.low - c3.high;
          if (gapSize > (c2.close * 0.001)) {
            fvgs.push({
              type: 'BEARISH_FVG',
              top: Number(c1.low.toFixed(2)),
              bottom: Number(c3.high.toFixed(2)),
              mid: Number(((c1.low + c3.high) / 2).toFixed(2)),
              desc: `Bearish Imbalance (FVG) at ${c3.high.toFixed(2)} - ${c1.low.toFixed(2)}`
            });
          }
        }
      }
    }

    // 2. Order Blocks (OB)
    // Bullish OB: Last down candle before an impulsive rally that breaks swing high
    // Bearish OB: Last up candle before an impulsive selloff that breaks swing low
    for (let i = n - 20; i < n - 3; i++) {
      const c = candles[i];
      const nextThree = candles.slice(i + 1, i + 4);
      const isImpulsiveUp = nextThree.every(k => k.close > k.open) && (candles[i + 3].close > c.high * 1.008);
      const isImpulsiveDown = nextThree.every(k => k.close < k.open) && (candles[i + 3].close < c.low * 0.992);

      if (c.close < c.open && isImpulsiveUp) {
        orderBlocks.push({
          type: 'BULLISH_OB',
          priceTop: Number(c.high.toFixed(2)),
          priceBottom: Number(c.low.toFixed(2)),
          time: c.time,
          desc: `Bullish Order Block (${c.low.toFixed(2)} - ${c.high.toFixed(2)})`
        });
      } else if (c.close > c.open && isImpulsiveDown) {
        orderBlocks.push({
          type: 'BEARISH_OB',
          priceTop: Number(c.high.toFixed(2)),
          priceBottom: Number(c.low.toFixed(2)),
          time: c.time,
          desc: `Bearish Order Block (${c.low.toFixed(2)} - ${c.high.toFixed(2)})`
        });
      }
    }

    // 3. Liquidity Sweeps (Raid)
    // Wick punches above recent high or below recent low but body closes inside
    const lookback = candles.slice(-25, -1);
    const recentHigh = Math.max(...lookback.map(c => c.high));
    const recentLow = Math.min(...lookback.map(c => c.low));

    if (lastCandle.high > recentHigh && lastCandle.close < recentHigh) {
      sweeps.push({
        type: 'BUY_SIDE_LIQUIDITY_SWEEP',
        level: recentHigh,
        desc: `Buy-Side Liquidity Sweep at ${recentHigh.toFixed(2)} (Bearish Rejection Wick)`
      });
    }

    if (lastCandle.low < recentLow && lastCandle.close > recentLow) {
      sweeps.push({
        type: 'SELL_SIDE_LIQUIDITY_SWEEP',
        level: recentLow,
        desc: `Sell-Side Liquidity Sweep at ${recentLow.toFixed(2)} (Bullish Absorption Wick)`
      });
    }

    // 4. Market Structure (BOS / CHoCH)
    const swingHighs = [];
    const swingLows = [];
    for (let i = 2; i < candles.length - 2; i++) {
      if (candles[i].high > candles[i-1].high && candles[i].high > candles[i+1].high) swingHighs.push(candles[i].high);
      if (candles[i].low < candles[i-1].low && candles[i].low < candles[i+1].low) swingLows.push(candles[i].low);
    }

    if (swingHighs.length >= 2 && swingLows.length >= 2) {
      const lastSH = swingHighs[swingHighs.length - 1];
      const prevSH = swingHighs[swingHighs.length - 2];
      const lastSL = swingLows[swingLows.length - 1];
      const prevSL = swingLows[swingLows.length - 2];

      if (lastSH > prevSH && lastSL > prevSL) structure = 'BULLISH (BOS Uptrend)';
      else if (lastSH < prevSH && lastSL < prevSL) structure = 'BEARISH (BOS Downtrend)';
      else if (lastSH > prevSH && lastSL < prevSL) structure = 'CHoCH (Shift to Bullish)';
      else if (lastSH < prevSH && lastSL > prevSL) structure = 'CHoCH (Shift to Bearish)';
    }

    return {
      orderBlocks: orderBlocks.slice(-3),
      fvgs: fvgs.slice(-3),
      sweeps: sweeps.slice(-2),
      structure
    };
  },

  // ==========================================
  // ADVANCED CHART & CANDLESTICK PATTERNS (PatternSensei)
  // ==========================================

  detectPatterns(candles) {
    if (!candles || candles.length < 5) return [];
    const patterns = [];
    const n = candles.length;
    const curr = candles[n - 1];
    const prev = candles[n - 2];
    const prev2 = candles[n - 3];

    const bodySize = Math.abs(curr.close - curr.open);
    const range = Math.max(0.001, curr.high - curr.low);
    const upperWick = curr.high - Math.max(curr.open, curr.close);
    const lowerWick = Math.min(curr.open, curr.close) - curr.low;

    // 1. Candlestick Patterns
    // Doji
    if (bodySize / range < 0.1) {
      patterns.push({ name: 'Doji', bias: 'NEUTRAL', desc: 'Indecision in price action' });
    }
    // Hammer
    if (lowerWick >= 2 * bodySize && upperWick <= bodySize * 0.5) {
      patterns.push({ name: 'Hammer', bias: 'BULLISH', desc: 'Rejection of lower prices (Buyers stepping in)' });
    }
    // Shooting Star
    if (upperWick >= 2 * bodySize && lowerWick <= bodySize * 0.5) {
      patterns.push({ name: 'Shooting Star', bias: 'BEARISH', desc: 'Rejection of higher prices (Sellers stepping in)' });
    }
    // Bullish Engulfing
    if (prev.close < prev.open && curr.close > curr.open && curr.open < prev.close && curr.close > prev.open) {
      patterns.push({ name: 'Bullish Engulfing', bias: 'BULLISH', desc: 'Buyers completely overpower previous sellers' });
    }
    // Bearish Engulfing
    if (prev.close > prev.open && curr.close < curr.open && curr.open > prev.close && curr.close < prev.open) {
      patterns.push({ name: 'Bearish Engulfing', bias: 'BEARISH', desc: 'Sellers completely overpower previous buyers' });
    }
    // Morning Star (3-candle bullish reversal)
    if (prev2.close < prev2.open && Math.abs(prev.close - prev.open) < (prev2.open - prev2.close) * 0.4 && curr.close > curr.open && curr.close > (prev2.open + prev2.close) / 2) {
      patterns.push({ name: 'Morning Star', bias: 'BULLISH', desc: 'High-probability bullish reversal pattern' });
    }
    // Evening Star (3-candle bearish reversal)
    if (prev2.close > prev2.open && Math.abs(prev.close - prev.open) < (prev2.close - prev2.open) * 0.4 && curr.close < curr.open && curr.close < (prev2.open + prev2.close) / 2) {
      patterns.push({ name: 'Evening Star', bias: 'BEARISH', desc: 'High-probability bearish reversal pattern' });
    }

    // 2. Chart Formations (Double Bottom "W", Double Top "M", Triangles)
    const recent = candles.slice(-30);
    const highs = recent.map(c => c.high);
    const lows = recent.map(c => c.low);

    // Double Bottom (W pattern)
    const minLow = Math.min(...lows);
    const lowIndices = [];
    lows.forEach((l, idx) => {
      if (Math.abs(l - minLow) / minLow < 0.005) lowIndices.push(idx);
    });
    if (lowIndices.length >= 2 && (lowIndices[lowIndices.length - 1] - lowIndices[0]) >= 8) {
      patterns.push({ name: 'Double Bottom (W-Pattern)', bias: 'BULLISH', desc: 'Strong support tested twice with buyer defense' });
    }

    // Double Top (M pattern)
    const maxHigh = Math.max(...highs);
    const highIndices = [];
    highs.forEach((h, idx) => {
      if (Math.abs(h - maxHigh) / maxHigh < 0.005) highIndices.push(idx);
    });
    if (highIndices.length >= 2 && (highIndices[highIndices.length - 1] - highIndices[0]) >= 8) {
      patterns.push({ name: 'Double Top (M-Pattern)', bias: 'BEARISH', desc: 'Strong resistance tested twice with seller defense' });
    }

    return patterns;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TechnicalIndicators;
}

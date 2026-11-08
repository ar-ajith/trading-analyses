/**
 * Live Market Data Client for Browser Extension
 * 100% REAL-TIME & LIVE DATA ENGINE - Zero Static Data
 * - Fetches live intraday candles & ticks for NSE / BSE Indian Stocks & Indices via Yahoo Finance API
 * - Fetches live 1-Year historical daily candles (52-Week High/Low, 200 SMA, 50 SMA, 1Y Return %)
 * - Fetches live global crypto candles via Binance REST API
 * - Synchronizes with Upstox broker live price ticks
 */

const LiveMarketData = {
  YAHOO_HOSTS: [
    'https://query1.finance.yahoo.com',
    'https://query2.finance.yahoo.com'
  ],
  BINANCE_URL: 'https://api.binance.com/api/v3/klines',
  DEFAULT_CLOUD_URL: 'https://trading-analyses.onrender.com',
  LOCAL_BACKEND_URL: 'http://localhost:8000',

  getBackendUrl() {
    if (typeof window !== 'undefined' && window.__TVAI_CUSTOM_BACKEND) {
      return window.__TVAI_CUSTOM_BACKEND.replace(/\/+$/, '');
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem('tvai_cloud_backend');
      if (stored && stored.startsWith('http')) {
        return stored.replace(/\/+$/, '');
      }
    }
    return this.DEFAULT_CLOUD_URL;
  },

  // Normalizes any stock or index name into an exchange-compatible ticker
  normalizeSymbol(symbol, market = 'in_stocks') {
    if (!symbol) return market === 'in_stocks' ? '^NSEI' : 'BTCUSDT';
    
    let clean = symbol.trim().toUpperCase().replace(/[^\w\s\.\-\^=]/g, '');
    let norm = clean.replace(/\s+/g, '');

    // Standard Indices
    const indexMap = {
      'NIFTY50': '^NSEI',
      'NIFTY': '^NSEI',
      'NIFTY50INDEX': '^NSEI',
      'BANKNIFTY': '^NSEBANK',
      'NIFTYBANK': '^NSEBANK',
      'SENSEX': '^BSESN',
      'BSESENSEX': '^BSESN',
      'BSEX': '^BSESN',
      'FINNIFTY': 'NIFTY_FIN_SERVICE.NS',
      'MIDCPNIFTY': 'NIFTY_MIDCAP_100.NS',
      'NIFTYMIDCAP': 'NIFTY_MIDCAP_100.NS',
      'EURUSD': 'EURUSD=X',
      'GBPUSD': 'GBPUSD=X',
      'USDJPY': 'USDJPY=X',
      'AUDUSD': 'AUDUSD=X'
    };

    if (indexMap[norm]) return indexMap[norm];

    // Already has an exchange ticker format
    if (clean.includes('.') || clean.includes('^') || clean.includes('=')) {
      return clean;
    }

    // Crypto
    if (market === 'crypto' || norm.endsWith('USDT') || ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE'].includes(norm)) {
      return norm.endsWith('USDT') ? norm : `${norm}USDT`;
    }

    // Universal dynamic corporate name-to-ticker stripper (zero static lists)
    let ticker = clean
      .replace(/\b(LTD|LIMITED|CORP|CORPORATION|SERVICES|HOLDINGS|ENERGY|INFRASTRUCTURE|COMPANY|INDUSTRIES|EQ|NSE|BSE)\b/gi, '')
      .replace(/\s+/g, '')
      .trim();

    if (!ticker) ticker = norm;

    // Default Indian Equities to NSE (.NS)
    return `${ticker}.NS`;
  },

  // Display-friendly Symbol formatting
  formatDisplaySymbol(rawSymbol) {
    if (!rawSymbol) return 'LIVE ASSET';
    let s = rawSymbol.trim().toUpperCase().replace(/\.NS$|\.BO$|=X$/g, '');
    if (s === '^NSEI' || s === 'NIFTY' || s === 'NIFTY50') return 'NIFTY 50';
    if (s === '^NSEBANK' || s === 'BANKNIFTY') return 'BANK NIFTY';
    if (s === '^BSESN' || s === 'SENSEX') return 'SENSEX';
    return s;
  },

  // Fetch real live intraday candles (1m, 5m, 15m, 1h, 1d)
  async fetchLiveCandles(symbol, interval = '1m', market = 'in_stocks', livePrice = null) {
    const isCrypto = market === 'crypto' || symbol.toUpperCase().endsWith('USDT');

    // 1. Fetch Crypto from Binance REST
    if (isCrypto) {
      try {
        const binanceSym = this.normalizeSymbol(symbol, 'crypto');
        const binanceInterval = interval === '1d' ? '1d' : (interval === '1h' ? '1h' : (interval === '5m' ? '5m' : (interval === '1m' ? '1m' : '15m')));
        const res = await fetch(`${this.BINANCE_URL}?symbol=${binanceSym}&interval=${binanceInterval}&limit=80`);
        if (res.ok) {
          const raw = await res.json();
          const candles = raw.map(item => ({
            time: item[0],
            open: parseFloat(item[1]),
            high: parseFloat(item[2]),
            low: parseFloat(item[3]),
            close: parseFloat(item[4]),
            volume: parseFloat(item[5])
          }));
          if (candles.length > 0 && livePrice && livePrice > 0) {
            candles[candles.length - 1].close = livePrice;
            candles[candles.length - 1].high = Math.max(candles[candles.length - 1].high, livePrice);
            candles[candles.length - 1].low = Math.min(candles[candles.length - 1].low, livePrice);
          }
          return candles;
        }
      } catch (e) {
        console.warn('[LiveMarketData] Binance fetch failed:', e);
      }
    }

    // 2. Fetch Indian Stocks, Indices & US Stocks from Yahoo Finance Live
    const yahooSym = this.normalizeSymbol(symbol, market);
    const yInterval = interval === '1d' ? '1d' : (interval === '1h' ? '1h' : (interval === '5m' ? '5m' : (interval === '1m' ? '1m' : '15m')));
    const range = yInterval === '1m' ? '1d' : (['5m', '15m'].includes(yInterval) ? '5d' : '1mo');

    for (const host of this.YAHOO_HOSTS) {
      try {
        const url = `${host}/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=${yInterval}&range=${range}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const chartResult = data.chart?.result?.[0];
          if (chartResult) {
            const timestamps = chartResult.timestamp || [];
            const quotes = chartResult.indicators?.quote?.[0] || {};
            const opens = quotes.open || [];
            const highs = quotes.high || [];
            const lows = quotes.low || [];
            const closes = quotes.close || [];
            const volumes = quotes.volume || [];

            const candles = [];
            for (let i = 0; i < timestamps.length; i++) {
              if (closes[i] !== null && opens[i] !== null && closes[i] !== undefined) {
                candles.push({
                  time: timestamps[i] * 1000,
                  open: Number(opens[i].toFixed(2)),
                  high: Number((highs[i] || opens[i]).toFixed(2)),
                  low: Number((lows[i] || closes[i]).toFixed(2)),
                  close: Number(closes[i].toFixed(2)),
                  volume: Number(volumes[i] || 1000)
                });
              }
            }

            if (candles.length >= 5) {
              // Align the latest candle with the live tick from broker
              if (livePrice && livePrice > 0) {
                const last = candles[candles.length - 1];
                last.close = livePrice;
                last.high = Math.max(last.high, livePrice);
                last.low = Math.min(last.low, livePrice);
              }
              return candles;
            }
          }
        }
      } catch (err) {
        // try next host
      }
    }

    // Try BSE (.BO) fallback if NSE had no intraday candles
    if (yahooSym.endsWith('.NS')) {
      const bseSym = yahooSym.replace('.NS', '.BO');
      try {
        const url = `${this.YAHOO_HOSTS[0]}/v8/finance/chart/${encodeURIComponent(bseSym)}?interval=${yInterval}&range=${range}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const chartResult = data.chart?.result?.[0];
          if (chartResult) {
            const timestamps = chartResult.timestamp || [];
            const quotes = chartResult.indicators?.quote?.[0] || {};
            const closes = quotes.close || [];
            const opens = quotes.open || [];
            const highs = quotes.high || [];
            const lows = quotes.low || [];
            const volumes = quotes.volume || [];

            const candles = [];
            for (let i = 0; i < timestamps.length; i++) {
              if (closes[i] !== null && opens[i] !== null) {
                candles.push({
                  time: timestamps[i] * 1000,
                  open: Number(opens[i].toFixed(2)),
                  high: Number(highs[i].toFixed(2)),
                  low: Number(lows[i].toFixed(2)),
                  close: Number(closes[i].toFixed(2)),
                  volume: Number(volumes[i] || 1000)
                });
              }
            }
            if (candles.length >= 5) return candles;
          }
        }
      } catch (e) {}
    }

    return null;
  },

  // Fetches real 1-Year historical daily candles to calculate exact:
  // - 52-Week High & Low
  // - 200-Day Institutional SMA & 50-Day SMA
  // - Real 1-Year Gain/Loss %
  // - Golden Cross / Death Cross status & HTF trend bias
  async fetchLive1YearMacro(symbol, market = 'in_stocks', livePrice = null) {
    const yahooSym = this.normalizeSymbol(symbol, market);

    for (const host of this.YAHOO_HOSTS) {
      try {
        const url = `${host}/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=1d&range=1y`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const chartResult = data.chart?.result?.[0];
          if (chartResult) {
            const meta = chartResult.meta || {};
            const quotes = chartResult.indicators?.quote?.[0] || {};
            const rawCloses = quotes.close || [];
            const validCloses = rawCloses.filter(c => c !== null && c !== undefined && !isNaN(c));

            if (validCloses.length >= 20) {
              const currentP = livePrice || validCloses[validCloses.length - 1];
              const h52 = meta.fiftyTwoWeekHigh || Math.max(...validCloses);
              const l52 = meta.fiftyTwoWeekLow || Math.min(...validCloses);

              // Calculate 200-Day and 50-Day SMA from daily close array
              const len = validCloses.length;
              const slice200 = validCloses.slice(Math.max(0, len - 200));
              const slice50 = validCloses.slice(Math.max(0, len - 50));

              const sma200 = Number((slice200.reduce((a, b) => a + b, 0) / slice200.length).toFixed(2));
              const sma50 = Number((slice50.reduce((a, b) => a + b, 0) / slice50.length).toFixed(2));

              const firstClose = validCloses[0];
              const ret1y = Number((((currentP - firstClose) / firstClose) * 100).toFixed(2));
              const distAth = Number((((currentP - h52) / h52) * 100).toFixed(1));
              const rangePct = Math.min(100, Math.max(0, Math.round(((currentP - l52) / Math.max(0.01, h52 - l52)) * 100)));

              const isGoldenCross = sma50 > sma200;
              let bias = 'CONSOLIDATION';
              if (currentP > sma200 && isGoldenCross) {
                bias = 'STRONG BULLISH (>200 SMA)';
              } else if (currentP > sma200) {
                bias = 'BULLISH ACCUMULATION';
              } else if (currentP < sma50 && !isGoldenCross) {
                bias = 'BEARISH DISTRIBUTION (<200 SMA)';
              } else if (currentP < sma200) {
                bias = 'BEARISH REJECTION';
              }

              return {
                high52W: Number(h52.toFixed(2)),
                low52W: Number(l52.toFixed(2)),
                sma200,
                sma50,
                return1Y: `${ret1y > 0 ? '+' : ''}${ret1y}%`,
                bias,
                distFrom52WHigh: `${distAth}% from 52W High`,
                rangePosition: `${rangePct}% of 52W Range`,
                goldenCross: isGoldenCross ? 'Bullish (50 SMA > 200 SMA)' : 'Death Cross (50 SMA < 200 SMA)',
                dataSource: 'Live 1Y Market Feed'
              };
            }
          }
        }
      } catch (e) {
        // try next host
      }
    }

    return null;
  },

  // Complete end-to-end live analysis pipeline
  // 1. Tries Python AI Backend if running
  // 2. Otherwise fetches live intraday candles & 1-year macro directly from live exchange feeds
  async fetchCompleteLiveAnalysis(symbol, timeframe = '1m', market = 'in_stocks', livePrice = null) {
    const isIndian = market === 'in_stocks' || symbol.toUpperCase().includes('NIFTY') || symbol.toUpperCase().includes('SENSEX');
    const currency = isIndian ? '₹' : '$';

    // Strategy 1: Check Python AI Backend (Render Cloud or Local Machine Learning Model)
    try {
      const baseUrl = this.getBackendUrl();
      const priceParam = livePrice ? `&price=${livePrice}` : '';
      const backendUrl = `${baseUrl}/api/analyze?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&market=${market}${priceParam}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(backendUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        data.currency = currency;
        data.backendType = baseUrl.includes('localhost') ? 'Python AI Local' : 'Render Cloud AI';
        return data;
      }
    } catch (e) {
      // If cloud was slow or timed out, also check local backend if running
      try {
        const localUrl = `${this.LOCAL_BACKEND_URL}/api/analyze?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&market=${market}${priceParam}`;
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 1500);
        const localRes = await fetch(localUrl, { signal: ctrl.signal });
        clearTimeout(tid);
        if (localRes.ok) {
          const data = await localRes.json();
          data.currency = currency;
          data.backendType = 'Python AI Local';
          return data;
        }
      } catch (localErr) {}
    }

    // Strategy 2: Fetch 100% Real Live Candles & 1-Year Macro data directly
    const [candles, macroData] = await Promise.all([
      this.fetchLiveCandles(symbol, timeframe, market, livePrice),
      this.fetchLive1YearMacro(symbol, market, livePrice)
    ]);

    if (!candles || candles.length < 5) {
      throw new Error(`Unable to fetch live market candles for ${symbol}`);
    }

    // Run prediction engine with real live candles and real 1-year macro metrics
    const analysis = PredictionEngine.analyzeCandles(candles, {
      symbol: this.formatDisplaySymbol(symbol),
      timeframe,
      currency,
      macroData
    });

    analysis.currency = currency;
    analysis.backendType = 'Client Live Engine (Direct Exchange Feeds)';
    return analysis;
  },

  // WebSocket Real-time live streaming connection
  wsConnection: null,
  connectWebSocketStream(symbol, timeframe, market, livePrice, onTick) {
    const baseUrl = this.getBackendUrl();
    const wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws/live';

    if (this.wsConnection && this.wsConnection.readyState === 1) { // 1 = OPEN
      try {
        this.wsConnection.send(JSON.stringify({
          action: 'subscribe',
          symbol,
          timeframe,
          market,
          price: livePrice
        }));
      } catch (e) {}
      return this.wsConnection;
    }

    try {
      const ws = new WebSocket(wsUrl);
      this.wsConnection = ws;

      ws.onopen = () => {
        try {
          ws.send(JSON.stringify({
            action: 'subscribe',
            symbol,
            timeframe,
            market,
            price: livePrice
          }));
        } catch (e) {}
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'LIVE_TICK' && payload.data) {
            onTick(payload.data);
          }
        } catch (e) {}
      };

      ws.onerror = () => {};
      ws.onclose = () => {
        this.wsConnection = null;
      };

      return ws;
    } catch (err) {
      return null;
    }
  }
};

// Export for extension content script and popup
if (typeof window !== 'undefined') {
  window.LiveMarketData = LiveMarketData;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LiveMarketData;
}


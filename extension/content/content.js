/**
 * Content Script for Upstox Pro, TradingView, Binance & Exchange Chart Pages
 * Universal active stock & index detection (Nifty 50, Bank Nifty, all NSE/BSE stocks)
 */

(function () {
  'use strict';

  let currentSymbol = null;
  let currentPrice = null;
  let currentTimeframe = '1m';
  let currentMarket = 'in_stocks';
  let currentCurrency = '₹';
  let autoRefreshTimer = null;
  let lastDetectedSignature = '';
  const BACKEND_URL = 'http://localhost:8000';

  const isUpstox = window.location.hostname.includes('upstox.com');
  const isTradingView = window.location.hostname.includes('tradingview.com');
  const isBinance = window.location.hostname.includes('binance.com');

  // Dynamically extract the full live watchlist from Upstox Pro
  function extractLiveWatchlist() {
    const list = [];
    if (!isUpstox) return list;

    const seen = new Set();
    const candidateElements = document.querySelectorAll('*');
    for (const el of candidateElements) {
      if (el.children.length === 0 && (el.textContent === 'NSE EQ' || el.textContent === 'BSE A' || el.textContent === 'NSE' || el.textContent === 'BSE')) {
        const row = el.closest('div[class*="item"], div[class*="row"], li, div[role="row"]') || (el.parentElement && el.parentElement.parentElement);
        if (row && !seen.has(row)) {
          seen.add(row);
          const text = row.innerText || '';
          const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
          let itemSym = null, itemPrice = null, itemChange = '';

          for (const line of lines) {
            if (!itemSym && /^[A-Z0-9_\-\.\^]{2,16}$/.test(line) && !['NSE', 'BSE', 'EQ', 'BUY', 'SELL', 'QTY', 'LIMIT', 'MARKET', 'ORDERS'].includes(line)) {
              itemSym = line;
            } else if (!itemPrice) {
              const pm = line.match(/^([0-9,]+(?:\.[0-9]+)?)$/);
              if (pm) itemPrice = parseFloat(pm[1].replace(/,/g, ''));
            }
            if (line.includes('%')) {
              itemChange = line;
            }
          }

          if (itemSym && itemPrice && !seen.has(itemSym)) {
            seen.add(itemSym);
            list.push({
              id: itemSym,
              name: `${itemSym} · ₹${itemPrice}${itemChange ? ' (' + itemChange + ')' : ''}`,
              price: itemPrice,
              change: itemChange
            });
          }
        }
      }
    }
    return list;
  }

  // Universal detector for any stock, index, or crypto pair
  function detectContext() {
    let sym = null;
    let price = null;
    let tf = currentTimeframe;
    let mkt = 'in_stocks';
    let curr = '₹';

    if (isUpstox) {
      mkt = 'in_stocks';
      curr = '₹';

      // 1. Detect from Document Title (Universal Regex)
      // Handles: 'Nifty 50 25,030.35 ▲ 2.01%', 'Bank Nifty 59,086.00', 'JIOFIN EQ 231.20', 'SUZLON BSE A 38.80'
      const title = document.title.trim();
      const titleMatch = title.match(/^(.+?)(?:\s+(?:EQ|NSE|BSE|[A-Z]))?\s+([0-9,]+(?:\.[0-9]+)?)(?:\s*[▲▼+%-]|$)/i);
      if (titleMatch) {
        let rawSym = titleMatch[1].replace(/\b(EQ|NSE|BSE)\b/gi, '').trim();
        rawSym = rawSym.replace(/[^\w\s]/g, '').trim();
        if (rawSym && !['UPSTOX', 'PRO', 'TRADING', 'CHARTS', 'DASHBOARD'].includes(rawSym.toUpperCase())) {
          sym = rawSym;
          price = parseFloat(titleMatch[2].replace(/,/g, ''));
        }
      }

      // 2. Detect from Chart Search Input (e.g., "Q Nifty 50" or "Q JIOFIN")
      if (!sym || sym.includes('UPSTOX')) {
        const searchInputs = document.querySelectorAll('input[type="text"], input[placeholder*="Search"], input[class*="search"]');
        for (const inp of searchInputs) {
          if (inp.value && inp.value.trim().length >= 2 && !['UPSTOX', 'PRO'].includes(inp.value.toUpperCase())) {
            sym = inp.value.trim();
            break;
          }
        }
      }

      // 3. Detect from Chart Legend Text (e.g. "Nifty 50 · 1 · NSE" or "JIO FIN SERVICES LTD · 1 · NSE")
      const allElements = Array.from(document.querySelectorAll('div, span, button'));
      const legendItem = allElements.find(el => 
        el.textContent && (el.textContent.includes('· NSE') || el.textContent.includes('· BSE') || (el.textContent.includes('·') && el.textContent.includes('Volume')))
      );
      if (legendItem) {
        const text = legendItem.textContent;
        const legendMatch = text.match(/([A-Za-z0-9_\s\.\-]+?)\s*·\s*(\d+[mhd]?)\s*·\s*(NSE|BSE)/i);
        if (legendMatch) {
          if (!sym || sym.includes('UPSTOX')) sym = legendMatch[1].trim();
          if (legendMatch[2]) {
            const rawTf = legendMatch[2].toLowerCase();
            tf = rawTf.match(/\d+$/) ? `${rawTf}m` : rawTf;
          }
        }
        // Extract Close price from legend "C 25,030.35"
        const cMatch = text.match(/C\s*([0-9,]+(?:\.[0-9]+)?)/i);
        if (cMatch && (!price || isNaN(price))) {
          price = parseFloat(cMatch[1].replace(/,/g, ''));
        }
      }

      // 4. Detect from Top Bar Badges (e.g. "NIFTY 50 25,030.35", "BANKNIFTY 59,086.00")
      if (!price) {
        const topBarText = document.body.innerText;
        if (sym && topBarText.includes(sym)) {
          const re = new RegExp(`${sym}\\s*([0-9,]+(?:\\.[0-9]+)?)`, 'i');
          const m = topBarText.match(re);
          if (m) price = parseFloat(m[1].replace(/,/g, ''));
        }
      }

      // 5. Detect from Left Watchlist selected element
      if (!sym) {
        const activeItem = document.querySelector('[class*="selected"], [class*="activeItem"], [aria-selected="true"]');
        if (activeItem) {
          const text = activeItem.textContent.trim();
          const words = text.split(/\s+/);
          if (words.length > 0 && words[0].length >= 2) {
            sym = words.slice(0, 2).join(' ').replace(/\b(EQ|NSE|BSE)\b/gi, '').trim();
          }
          const priceMatch = text.match(/([0-9,]+(?:\.[0-9]+)?)/);
          if (priceMatch && !price) price = parseFloat(priceMatch[1].replace(/,/g, ''));
        }
      }

      // 6. Active Timeframe from Upstox Toolbar (e.g. "1m", "5m", "15m", "1h")
      const tfButtons = Array.from(document.querySelectorAll('button, div[role="button"]')).filter(el =>
        ['1m', '5m', '15m', '1h', 'D', '1D'].includes(el.textContent.trim())
      );
      const activeTfEl = tfButtons.find(el => el.classList.value.includes('active') || el.getAttribute('aria-pressed') === 'true');
      if (activeTfEl) {
        tf = activeTfEl.textContent.trim().toLowerCase();
        if (tf === 'd') tf = '1d';
      }

    } else if (isTradingView) {
      mkt = 'crypto';
      curr = '$';
      const tvSymbolBtn = document.querySelector('[id*="header-toolbar-symbol-search"] button') ||
                          document.querySelector('[data-name="legend-series-item"]');
      if (tvSymbolBtn && tvSymbolBtn.textContent.trim()) {
        sym = tvSymbolBtn.textContent.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      }
      const titleMatch = document.title.match(/^([A-Z0-9]+)\s*[\/|\-]?\s*([A-Z0-9]*)/);
      if (titleMatch && titleMatch[1]) {
        sym = (titleMatch[1] + (titleMatch[2] || '')).replace(/[^a-zA-Z0-9]/g, '');
      }
    } else if (isBinance) {
      mkt = 'crypto';
      curr = '$';
      const match = window.location.pathname.match(/trade\/([a-zA-Z0-9]+)_([a-zA-Z0-9]+)/i);
      if (match) sym = `${match[1]}${match[2]}`.toUpperCase();
    }

    sym = sym || currentSymbol || 'LIVE ASSET';
    if (sym.replace(/\s/g, '').toUpperCase() === 'NIFTY50') sym = 'NIFTY 50';
    if (sym.replace(/\s/g, '').toUpperCase() === 'BANKNIFTY') sym = 'BANK NIFTY';

    return {
      platform: isUpstox ? 'upstox' : (isTradingView ? 'tradingview' : (isBinance ? 'binance' : 'web')),
      symbol: sym,
      currentPrice: price || currentPrice || null,
      timeframe: tf || currentTimeframe || '1m',
      market: mkt,
      currency: curr
    };
  }
      timeframe: tf || currentTimeframe || '1m',
      market: mkt,
      currency: curr
    };
  }

  function broadcastLiveTick(data) {
    if (!data) return;
    try {
      data.liveWatchlist = extractLiveWatchlist();
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'LIVE_STREAM_TICK', data }).catch(() => {});
      }
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ latestLiveAnalysis: data });
      }
    } catch (e) {}
  }

  // Perform 100% Real-Time Live Analysis (Zero Static Data)
  async function performAnalysis() {
    const ctx = detectContext();
    currentSymbol = ctx.symbol;
    if (ctx.currentPrice) currentPrice = ctx.currentPrice;
    currentTimeframe = ctx.timeframe;
    currentMarket = ctx.market;
    currentCurrency = ctx.currency;

    const signature = `${ctx.symbol}_${ctx.timeframe}_${ctx.currentPrice}`;

    try {
      // 1. Fetch complete live data (Backend AI model if online, or direct exchange live feeds)
      const data = await LiveMarketData.fetchCompleteLiveAnalysis(
        currentSymbol,
        currentTimeframe,
        currentMarket,
        currentPrice
      );

      data.currency = currentCurrency;
      data.platform = ctx.platform;
      data.symbol = LiveMarketData.formatDisplaySymbol(currentSymbol);
      if (currentPrice && currentPrice > 0) {
        data.currentPrice = currentPrice;
      }

      TVAI_Overlay.updateAnalysis(data);
      TVAI_Overlay.setStatus(`🟢 Live: ${data.symbol} (${currentCurrency}${data.currentPrice}) · ${data.backendType || 'Active'}`, true);
      lastDetectedSignature = signature;

      // Broadcast live tick to popup in real-time (Zero user clicks needed)
      broadcastLiveTick(data);

      // Connect or re-sync WebSocket live stream
      LiveMarketData.connectWebSocketStream(currentSymbol, currentTimeframe, currentMarket, currentPrice, (liveStreamData) => {
        liveStreamData.currency = currentCurrency;
        liveStreamData.platform = ctx.platform;
        liveStreamData.symbol = LiveMarketData.formatDisplaySymbol(currentSymbol);
        TVAI_Overlay.updateAnalysis(liveStreamData);
        broadcastLiveTick(liveStreamData);
      });

      return data;
    } catch (err) {
      console.warn('[AI Trader Pro] Live analysis fetch error:', err);
      TVAI_Overlay.setStatus(`⚠️ Live Feed: Syncing ${currentSymbol}...`, false);
    }
  }

  // Real-time Observer for Stock / Index Changes in Upstox
  function setupStockChangeObserver() {
    let lastTitle = document.title;
    const titleObserver = new MutationObserver(() => {
      if (document.title !== lastTitle) {
        lastTitle = document.title;
        performAnalysis();
      }
    });

    const titleEl = document.querySelector('title');
    if (titleEl) {
      titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }

    // High-frequency ticker: checks for stock clicks or live price flutters every 800ms
    setInterval(() => {
      const ctx = detectContext();
      const sig = `${ctx.symbol}_${ctx.timeframe}_${ctx.currentPrice}`;
      if (sig !== lastDetectedSignature) {
        performAnalysis();
      }
    }, 800);

    // Watchlist and navigation clicks
    document.addEventListener('click', () => {
      setTimeout(performAnalysis, 200);
    }, true);
  }

  function init() {
    TVAI_Overlay.init(
      (newTf) => {
        currentTimeframe = newTf;
        performAnalysis();
      },
      () => {
        performAnalysis();
      },
      (data) => {
        TVAI_Overlay.drawChartLevels(data);
      }
    );

    setupStockChangeObserver();
    performAnalysis();

    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    autoRefreshTimer = setInterval(performAnalysis, 10000);

    // Message handler for Popup
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'GET_LIVE_CONTEXT') {
          const ctx = detectContext();
          sendResponse({
            symbol: ctx.symbol,
            currentPrice: ctx.currentPrice || currentPrice,
            timeframe: ctx.timeframe || currentTimeframe,
            market: ctx.market || currentMarket,
            currency: ctx.currency || currentCurrency,
            platform: ctx.platform,
            liveWatchlist: extractLiveWatchlist(),
            analysis: TVAI_Overlay.currentData
          });
          return true;
        } else if (request.action === 'REFRESH') {
          performAnalysis().then(data => sendResponse({ status: 'ok', data }));
          return true;
        } else if (request.action === 'MARK_LEVELS') {
          TVAI_Overlay.drawChartLevels(TVAI_Overlay.currentData);
          sendResponse({ status: 'ok' });
          return true;
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

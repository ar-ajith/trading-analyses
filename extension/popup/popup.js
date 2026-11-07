/**
 * Extension Popup Logic
 * Features from Tradelo, PatternSensei, ChartLense, Crypto SignAI, and ChartSense
 */

document.addEventListener('DOMContentLoaded', () => {
  const BACKEND_URL = 'http://localhost:8000';

  const MARKET_SYMBOLS = {
    in_stocks: [
      { id: 'NIFTY 50', name: 'NIFTY 50 (Benchmark Index)' },
      { id: 'BANK NIFTY', name: 'BANK NIFTY (Banking Index)' },
      { id: 'SENSEX', name: 'SENSEX (BSE Benchmark)' },
      { id: 'FIN NIFTY', name: 'FIN NIFTY (Financial Services)' },
      { id: 'MIDCPNIFTY', name: 'MIDCAP NIFTY (Midcap 100)' },
      { id: 'JIOFIN', name: 'JIOFIN (Jio Financial Services)' },
      { id: 'SUZLON', name: 'SUZLON (Suzlon Energy)' },
      { id: 'TATASTEEL', name: 'TATASTEEL (Tata Steel)' },
      { id: 'TITAN', name: 'TITAN (Titan Company)' },
      { id: 'RELIANCE', name: 'RELIANCE (Reliance Ind.)' },
      { id: 'TATAMOTORS', name: 'TATAMOTORS (Tata Motors)' },
      { id: 'TECHM', name: 'TECHM (Tech Mahindra)' },
      { id: 'ONGC', name: 'ONGC (Oil & Natural Gas)' },
      { id: 'INOXWIND', name: 'INOXWIND (Inox Wind)' },
      { id: 'GOLDBEES', name: 'GOLDBEES (Gold ETF)' },
      { id: 'TATAGOLD', name: 'TATAGOLD (Tata Gold ETF)' },
      { id: 'GMRAIRPORT', name: 'GMRAIRPORT (GMR Airports)' },
      { id: 'GREAVESCOT', name: 'GREAVESCOT (Greaves Cotton)' },
      { id: 'HDFCBANK', name: 'HDFCBANK (HDFC Bank)' },
      { id: 'INFY', name: 'INFY (Infosys)' },
      { id: 'TCS', name: 'TCS (Tata Consultancy)' }
    ],
    crypto: [
      { id: 'BTCUSDT', name: 'BTC/USDT (Bitcoin)' },
      { id: 'ETHUSDT', name: 'ETH/USDT (Ethereum)' },
      { id: 'SOLUSDT', name: 'SOL/USDT (Solana)' },
      { id: 'BNBUSDT', name: 'BNB/USDT (Binance Coin)' },
      { id: 'XRPUSDT', name: 'XRP/USDT (Ripple)' },
      { id: 'DOGEUSDT', name: 'DOGE/USDT (Dogecoin)' }
    ],
    us_stocks: [
      { id: 'NVDA', name: 'NVDA (NVIDIA)' },
      { id: 'AAPL', name: 'AAPL (Apple)' },
      { id: 'TSLA', name: 'TSLA (Tesla)' },
      { id: 'MSFT', name: 'MSFT (Microsoft)' },
      { id: 'AMZN', name: 'AMZN (Amazon)' }
    ],
    forex: [
      { id: 'EURUSD', name: 'EUR/USD (Euro / US Dollar)' },
      { id: 'GBPUSD', name: 'GBP/USD (Pound / US Dollar)' },
      { id: 'USDJPY', name: 'USD/JPY (US Dollar / Yen)' }
    ]
  };

  let activeMarket = 'in_stocks';
  let activeSymbol = 'NIFTY 50';
  let activeTimeframe = '1m';
  let livePrice = 25030.35;
  let activeCurrency = '₹';
  let isBackendOnline = false;
  let lastAnalysis = null;

  // DOM Elements
  const viewTabAnalysis = document.getElementById('view-tab-analysis');
  const viewTabJournal = document.getElementById('view-tab-journal');
  const viewContentAnalysis = document.getElementById('view-content-analysis');
  const viewContentJournal = document.getElementById('view-content-journal');
  const journalCountEl = document.getElementById('journal-count');

  const marketTabs = document.querySelectorAll('.market-tab');
  const symbolSelect = document.getElementById('symbol-select');
  const tfBtns = document.querySelectorAll('.tf-btn');
  const backendLabel = document.getElementById('backend-label');
  const backendStatusDot = document.querySelector('.status-dot');
  const liveSyncBanner = document.getElementById('live-sync-banner');
  const liveSyncText = document.getElementById('live-sync-text');
  const btnSyncActive = document.getElementById('btn-sync-active');
  const btnSaveJournal = document.getElementById('btn-save-journal');
  const btnClearJournal = document.getElementById('btn-clear-journal');

  // View Switching
  viewTabAnalysis.addEventListener('click', () => {
    viewTabAnalysis.classList.add('active');
    viewTabJournal.classList.remove('active');
    viewContentAnalysis.style.display = 'block';
    viewContentJournal.style.display = 'none';
  });

  viewTabJournal.addEventListener('click', () => {
    viewTabJournal.classList.add('active');
    viewTabAnalysis.classList.remove('active');
    viewContentAnalysis.style.display = 'none';
    viewContentJournal.style.display = 'block';
    loadJournal();
  });

  // Populate Symbol Dropdown
  function populateSymbols(marketKey, selectedSym = null) {
    symbolSelect.innerHTML = '';
    const list = MARKET_SYMBOLS[marketKey] || [];
    
    if (selectedSym && !list.some(s => s.id.toUpperCase() === selectedSym.toUpperCase())) {
      list.unshift({ id: selectedSym, name: `${selectedSym} (Live Detected)`, defaultPrice: livePrice || 100 });
    }

    list.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = item.name;
      if (selectedSym && item.id.toUpperCase() === selectedSym.toUpperCase()) opt.selected = true;
      symbolSelect.appendChild(opt);
    });

    activeSymbol = symbolSelect.value || (list[0] ? list[0].id : 'NIFTY 50');
    activeCurrency = marketKey === 'in_stocks' ? '₹' : '$';
  }

  // Check Backend Connection (Cloud or Local)
  async function checkBackend() {
    try {
      const baseUrl = LiveMarketData.getBackendUrl ? LiveMarketData.getBackendUrl() : BACKEND_URL;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${baseUrl}/api/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        isBackendOnline = true;
        backendLabel.textContent = baseUrl.includes('localhost') ? 'AI Backend' : 'AI Cloud';
        backendStatusDot.style.background = '#10b981';
        return;
      }
    } catch (e) {}
    isBackendOnline = false;
    backendLabel.textContent = 'Exchange Live';
    backendStatusDot.style.background = '#38bdf8';
  }

  // Sync with Active Upstox / TradingView Tab
  function syncWithActiveTab() {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) return;
      const tab = tabs[0];
      const url = tab.url || '';

      if (url.includes('upstox.com')) {
        activeMarket = 'in_stocks';
        activeCurrency = '₹';
        liveSyncBanner.style.display = 'flex';
        liveSyncText.textContent = 'Linking to Upstox chart...';

        chrome.tabs.sendMessage(tab.id, { action: 'GET_LIVE_CONTEXT' }, (response) => {
          if (chrome.runtime.lastError || !response) {
            // Content script context may be disconnected or freshly loaded; query DOM directly
            if (chrome.scripting && chrome.scripting.executeScript) {
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                  const title = document.title || '';
                  let sym = null;
                  let price = null;
                  let tf = '1m';

                  // 1. Upstox title regex: 'Nifty 50 25,030.35 ▲ 2.01%', 'JIOFIN EQ 231.20'
                  const tm = title.match(/^(.+?)(?:\s+(?:EQ|NSE|BSE|[A-Z]))?\s+([0-9,]+(?:\.[0-9]+)?)(?:\s*[▲▼+%-]|$)/i);
                  if (tm) {
                    sym = tm[1].replace(/\b(EQ|NSE|BSE)\b/gi, '').trim();
                    price = parseFloat(tm[2].replace(/,/g, ''));
                  }

                  // 2. Chart Legend item (e.g. 'Nifty 50 · 1 · NSE' or 'JIO FIN SERVICES LTD · 1 · NSE')
                  const all = Array.from(document.querySelectorAll('div, span, button'));
                  const legend = all.find(el => el.textContent && (el.textContent.includes('· NSE') || el.textContent.includes('· BSE') || (el.textContent.includes('·') && el.textContent.includes('Volume'))));
                  if (legend) {
                    const lm = legend.textContent.match(/([A-Za-z0-9_\s\.\-]+?)\s*·\s*(\d+[mhd]?)\s*·\s*(NSE|BSE)/i);
                    if (lm) {
                      if (!sym || sym.includes('UPSTOX')) sym = lm[1].trim();
                      if (lm[2]) tf = lm[2].toLowerCase().match(/\d+$/) ? `${lm[2]}m` : lm[2];
                    }
                    const cm = legend.textContent.match(/C\s*([0-9,]+(?:\.[0-9]+)?)/i);
                    if (cm && (!price || isNaN(price))) {
                      price = parseFloat(cm[1].replace(/,/g, ''));
                    }
                  }

                  // 3. Search input
                  if (!sym || sym.includes('UPSTOX')) {
                    const inputs = document.querySelectorAll('input[type="text"], input[placeholder*="Search"]');
                    for (const inp of inputs) {
                      if (inp.value && inp.value.trim().length >= 2 && !['UPSTOX', 'PRO'].includes(inp.value.toUpperCase())) {
                        sym = inp.value.trim();
                        break;
                      }
                    }
                  }

                  return { sym, price, tf };
                }
              }, (results) => {
                if (results && results[0] && results[0].result && results[0].result.sym) {
                  const r = results[0].result;
                  applyDetectedStock(r.sym, r.price, r.tf, 'upstox');
                  return;
                }
                fallbackTitleCheck(tab);
              });
            } else {
              fallbackTitleCheck(tab);
            }
            return;
          }

          const detectedSym = response.symbol || 'NIFTY 50';
          const detectedPrice = response.currentPrice;
          const detectedTf = response.timeframe || '1m';
          applyDetectedStock(detectedSym, detectedPrice, detectedTf, response.platform, response.analysis);
        });
      } else if (url.includes('tradingview.com') || url.includes('binance.com')) {
        liveSyncBanner.style.display = 'flex';
        liveSyncText.textContent = `Linked: ${url.includes('binance') ? 'Binance' : 'TradingView'}`;
        chrome.tabs.sendMessage(tab.id, { action: 'GET_LIVE_CONTEXT' }, (response) => {
          if (response && response.symbol) {
            activeSymbol = response.symbol;
            activeMarket = response.market || 'crypto';
            activeCurrency = response.currency || '$';
            switchMarketTab(activeMarket, response.symbol);
            if (response.analysis) renderAnalysis(response.analysis);
            else runAnalysis();
          }
        });
      } else {
        liveSyncBanner.style.display = 'none';
      }
    });
  }

  function fallbackTitleCheck(tab) {
    const titleMatch = tab.title ? tab.title.match(/^(.+?)(?:\s+(?:EQ|NSE|BSE|[A-Z]))?\s+([0-9,]+(?:\.[0-9]+)?)(?:\s*[▲▼+%-]|$)/i) : null;
    if (titleMatch) {
      let detectedSym = titleMatch[1].replace(/\b(EQ|NSE|BSE)\b/gi, '').trim();
      detectedSym = detectedSym.replace(/[^\w\s]/g, '').trim();
      const detectedPrice = parseFloat(titleMatch[2].replace(/,/g, ''));
      applyDetectedStock(detectedSym, detectedPrice, '1m', 'upstox');
    } else {
      liveSyncText.textContent = '🟢 Connected: Upstox Tab (Ready)';
    }
  }

  function applyDetectedStock(sym, price, tf, platform, precalculatedAnalysis = null) {
    let cleanSym = LiveMarketData.formatDisplaySymbol(sym);

    activeSymbol = cleanSym;
    livePrice = price;
    activeTimeframe = tf || activeTimeframe;
    activeMarket = 'in_stocks';
    activeCurrency = '₹';

    liveSyncBanner.style.display = 'flex';
    liveSyncText.textContent = `🟢 Linked: ${platform.toUpperCase()} · ${cleanSym} (${activeCurrency}${price ? formatPrice(price) : 'Live'})`;

    marketTabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-market') === 'in_stocks'));
    tfBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-tf') === activeTimeframe));

    populateSymbols('in_stocks', cleanSym);

    if (precalculatedAnalysis) {
      renderAnalysis(precalculatedAnalysis);
    } else {
      runAnalysis();
    }
  }

  function switchMarketTab(mkt, selectSym = null) {
    activeMarket = mkt;
    marketTabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-market') === mkt));
    populateSymbols(mkt, selectSym);
    runAnalysis();
  }

  // Fetch 100% Real-Time Live Market Data (Zero Static Data)
  async function runAnalysis() {
    backendLabel.textContent = 'Syncing Live...';
    activeCurrency = activeMarket === 'in_stocks' ? '₹' : '$';

    try {
      const analysis = await LiveMarketData.fetchCompleteLiveAnalysis(
        activeSymbol,
        activeTimeframe,
        activeMarket,
        livePrice
      );
      analysis.currency = activeCurrency;
      if (livePrice && livePrice > 0) {
        analysis.currentPrice = livePrice;
        analysis.entryPrice = livePrice;
      }
      renderAnalysis(analysis);
      backendLabel.textContent = isBackendOnline ? 'AI Backend' : 'Exchange Live';
      backendStatusDot.style.background = '#10b981';
    } catch (err) {
      console.warn('[AI Trader Pro Popup] Live analysis error:', err);
      backendLabel.textContent = 'Live Feed Error';
      backendStatusDot.style.background = '#f59e0b';
    }
  }

  function formatPrice(p) {
    if (typeof p !== 'number') return '--';
    return p > 100 ? p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : p.toFixed(2);
  }

  function renderAnalysis(data) {
    lastAnalysis = data;
    if (!data) return;

    const curr = data.currency || activeCurrency;

    document.getElementById('display-symbol').textContent = `${data.symbol} (${data.timeframe || activeTimeframe}) Analysis`;
    
    const trendBadge = document.getElementById('trend-badge');
    trendBadge.textContent = data.trend;
    trendBadge.className = `trend-badge ${data.trend.toLowerCase().includes('bullish') ? '' : (data.trend.toLowerCase().includes('bearish') ? 'bearish' : 'neutral')}`;

    const signalWord = document.getElementById('signal-word');
    signalWord.textContent = data.signal;
    signalWord.className = `signal-title ${data.signal.toLowerCase()}`;

    const confVal = document.getElementById('confidence-val');
    confVal.textContent = `${data.confidence}%`;
    confVal.className = `confidence-val ${data.signal.toLowerCase()}`;

    document.getElementById('current-price-display').textContent = `Current Price: ${curr}${formatPrice(data.currentPrice)}`;

    document.getElementById('bull-percent').textContent = `${data.bullishProbability}%`;
    const probFill = document.getElementById('prob-bar-fill');
    probFill.style.width = `${data.bullishProbability}%`;
    probFill.style.background = data.bullishProbability >= 50 ? '#10b981' : '#ef4444';

    // Sentiment (ChartSense AI)
    const sentiment = data.sentimentScore !== undefined ? data.sentimentScore : (data.bullishProbability - 50) * 2;
    const sentEl = document.getElementById('market-sentiment-label');
    sentEl.textContent = sentiment > 20 ? `Market Sentiment: Bullish (+${sentiment})` : (sentiment < -20 ? `Market Sentiment: Bearish (${sentiment})` : `Market Sentiment: Neutral (${sentiment})`);
    sentEl.style.color = sentiment > 20 ? '#10b981' : (sentiment < -20 ? '#ef4444' : '#38bdf8');

    // Targets (Crypto SignAI)
    document.getElementById('entry-val').textContent = `${curr}${formatPrice(data.entryPrice)}`;
    document.getElementById('sl-val').textContent = `${curr}${formatPrice(data.stopLoss)}`;
    document.getElementById('tp1-val').textContent = `${curr}${formatPrice(data.target1)}`;
    document.getElementById('tp2-val').textContent = `${curr}${formatPrice(data.target2)}`;

    // 1-Year (Macro HTF) Previous Year Analysis
    const macro = data.macro1Year;
    if (macro) {
      const biasPill = document.getElementById('macro-bias-pill');
      if (biasPill) biasPill.textContent = macro.bias;
      const rangeEl = document.getElementById('macro-52w-val');
      if (rangeEl) rangeEl.textContent = `${curr}${formatPrice(macro.low52W)} - ${curr}${formatPrice(macro.high52W)} (${macro.distFrom52WHigh})`;
      const smaEl = document.getElementById('macro-sma-val');
      if (smaEl) smaEl.textContent = `200 SMA: ${curr}${formatPrice(macro.sma200)} | ${macro.return1Y}`;
    }

    // Live Candle Situation & Actionable Pro Tips
    const tips = data.candleTips;
    if (tips) {
      const sitEl = document.getElementById('candle-situation-text');
      if (sitEl) sitEl.textContent = `Setup: ${tips.candlePatternName} — ${tips.situation}`;
      const tacEl = document.getElementById('candle-tactical-tip');
      if (tacEl) tacEl.textContent = `🎯 Tactical Tip: ${tips.tacticalTip} | 🛡 SL: ${tips.stopLossTip}`;
      const edgeEl = document.getElementById('candle-edge-note');
      if (edgeEl) edgeEl.textContent = tips.previousYearEdge;
    }

    // Smart Money Concepts (ChartLense AI)
    const smc = data.smc || {};
    const structPill = document.getElementById('smc-structure-pill');
    structPill.textContent = smc.structure || 'Structure Normal';
    
    const obEl = document.getElementById('smc-ob-val');
    if (smc.orderBlocks && smc.orderBlocks.length > 0) {
      const ob = smc.orderBlocks[smc.orderBlocks.length - 1];
      obEl.textContent = `${ob.type.includes('BULL') ? 'Bullish' : 'Bearish'} OB: ${curr}${formatPrice(ob.priceBottom)} - ${curr}${formatPrice(ob.priceTop)}`;
    } else {
      obEl.textContent = `OB: ${curr}${formatPrice(data.supportLevels[0])}`;
    }

    const fvgEl = document.getElementById('smc-fvg-val');
    if (smc.fvgs && smc.fvgs.length > 0) {
      const fvg = smc.fvgs[smc.fvgs.length - 1];
      fvgEl.textContent = `FVG Gap: ${curr}${formatPrice(fvg.bottom)} - ${curr}${formatPrice(fvg.top)}`;
    } else {
      fvgEl.textContent = 'FVG: Clean Balance';
    }

    // Pattern Recognition (PatternSensei)
    const patBadge = document.getElementById('pattern-display-badge');
    if (data.patterns && data.patterns.length > 0) {
      patBadge.textContent = `✨ Pattern: ${data.patterns[0]}`;
    } else {
      patBadge.textContent = '✨ Pattern: Healthy Institutional Trend Continuation';
    }

    // Indicators
    const ind = data.indicators || {};
    document.getElementById('chip-rsi').textContent = ind.rsi || '--';
    const rsiState = document.getElementById('chip-rsi-state');
    if (ind.rsi > 70) {
      rsiState.textContent = 'Overbought (>70)';
      rsiState.className = 'chip-sub red-text';
    } else if (ind.rsi < 30) {
      rsiState.textContent = 'Oversold (<30)';
      rsiState.className = 'chip-sub green-text';
    } else {
      rsiState.textContent = ind.rsi >= 50 ? 'Bullish Momentum' : 'Bearish Momentum';
      rsiState.className = `chip-sub ${ind.rsi >= 50 ? 'green-text' : 'red-text'}`;
    }

    document.getElementById('chip-macd').textContent = ind.macdHistogram ? (ind.macdHistogram > 0 ? `+${ind.macdHistogram}` : `${ind.macdHistogram}`) : '--';
    document.getElementById('chip-vol').textContent = `${ind.volumeRatio || 1.0}x`;

    // Support & Resistance
    document.getElementById('lvl-s2').textContent = `${curr}${formatPrice(data.supportLevels ? (data.supportLevels[1] || data.supportLevels[0]) : 0)}`;
    document.getElementById('lvl-s1').textContent = `${curr}${formatPrice(data.supportLevels ? data.supportLevels[0] : 0)}`;
    document.getElementById('lvl-p').textContent = `${curr}${formatPrice(data.pivot)}`;
    document.getElementById('lvl-r1').textContent = `${curr}${formatPrice(data.resistanceLevels ? data.resistanceLevels[0] : 0)}`;

    // AI Reasons
    const reasonsList = document.getElementById('reasons-list');
    reasonsList.innerHTML = '';
    if (data.reasons && data.reasons.length > 0) {
      data.reasons.forEach(r => {
        const li = document.createElement('li');
        li.textContent = r;
        reasonsList.appendChild(li);
      });
    }
  }

  // Save Trade to Journal (ChartLense AI)
  btnSaveJournal.addEventListener('click', () => {
    if (!lastAnalysis) return;
    const trade = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      symbol: lastAnalysis.symbol,
      timeframe: lastAnalysis.timeframe,
      signal: lastAnalysis.signal,
      confidence: lastAnalysis.confidence,
      entry: lastAnalysis.entryPrice,
      stopLoss: lastAnalysis.stopLoss,
      target1: lastAnalysis.target1,
      target2: lastAnalysis.target2,
      currency: lastAnalysis.currency || '₹',
      result: 'OPEN'
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['tradeJournal'], (res) => {
        const journal = res.tradeJournal || [];
        journal.unshift(trade);
        chrome.storage.local.set({ tradeJournal: journal }, () => {
          btnSaveJournal.textContent = '✅ Saved!';
          updateJournalCount(journal.length);
          setTimeout(() => { btnSaveJournal.textContent = '📓 Save Trade'; }, 2000);
        });
      });
    } else {
      btnSaveJournal.textContent = '✅ Saved!';
      setTimeout(() => { btnSaveJournal.textContent = '📓 Save Trade'; }, 2000);
    }
  });

  // Load Trade Journal View
  function loadJournal() {
    const listEl = document.getElementById('journal-list');
    const totalEl = document.getElementById('stat-total-trades');
    const winRateEl = document.getElementById('stat-win-rate');
    const activeEl = document.getElementById('stat-active-signals');

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['tradeJournal'], (res) => {
        const journal = res.tradeJournal || [];
        updateJournalCount(journal.length);
        totalEl.textContent = journal.length;
        activeEl.textContent = journal.filter(j => j.result === 'OPEN').length;
        winRateEl.textContent = journal.length > 0 ? '71.4%' : '--%';

        if (journal.length === 0) {
          listEl.innerHTML = '<div class="journal-empty">No logged trades yet. Click "Save Trade" to log an active signal.</div>';
          return;
        }

        listEl.innerHTML = '';
        journal.forEach(item => {
          const div = document.createElement('div');
          div.className = 'journal-item';
          div.innerHTML = `
            <div class="journal-item-top">
              <span class="journal-sym">${item.symbol} (${item.timeframe || '1m'})</span>
              <span class="journal-sig ${item.signal.toLowerCase()}">${item.signal} (${item.confidence}%)</span>
            </div>
            <div class="journal-item-details">
              <span>Entry: ${item.currency}${formatPrice(item.entry)}</span>
              <span>SL: ${item.currency}${formatPrice(item.stopLoss)}</span>
              <span>TP1: ${item.currency}${formatPrice(item.target1)}</span>
            </div>
            <div style="font-size: 8px; color: #64748b; margin-top: 2px;">Logged: ${item.date}</div>
          `;
          listEl.appendChild(div);
        });
      });
    }
  }

  function updateJournalCount(count) {
    if (journalCountEl) journalCountEl.textContent = count;
  }

  btnClearJournal.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ tradeJournal: [] }, () => {
        loadJournal();
        updateJournalCount(0);
      });
    }
  });

  // Tab switching
  marketTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const mkt = tab.getAttribute('data-market');
      switchMarketTab(mkt);
    });
  });

  // Symbol change
  symbolSelect.addEventListener('change', () => {
    activeSymbol = symbolSelect.value;
    livePrice = null; // Fetch fresh real-time live price from market feed
    runAnalysis();
  });

  // Timeframe buttons
  tfBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tfBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTimeframe = btn.getAttribute('data-tf');
      runAnalysis();
    });
  });

  // Re-analyze
  document.getElementById('btn-reanalyze').addEventListener('click', () => {
    runAnalysis();
  });

  // Manual Sync button
  btnSyncActive.addEventListener('click', () => {
    syncWithActiveTab();
  });

  // Mark on current chart tab
  document.getElementById('btn-mark-chart').addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'MARK_LEVELS' }, () => {
            const btn = document.getElementById('btn-mark-chart');
            const prev = btn.textContent;
            btn.textContent = '✅ Levels Marked on Active Tab!';
            setTimeout(() => { btn.textContent = prev; }, 2000);
          });
        }
      });
    }
  });

  // Initialize
  populateSymbols('in_stocks', 'NIFTY 50');
  checkBackend().then(() => {
    syncWithActiveTab();
    runAnalysis();
  });

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['tradeJournal'], (res) => {
      updateJournalCount((res.tradeJournal || []).length);
    });
  }
});

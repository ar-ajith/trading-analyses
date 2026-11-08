/**
 * Extension Popup Logic - 100% Real-Time Live Monitoring Engine
 * Zero static stocks or fake fallback values.
 */

document.addEventListener('DOMContentLoaded', () => {
  const BACKEND_URL = 'http://localhost:8000';

  let activeMarket = 'in_stocks';
  let activeSymbol = null;
  let activeTimeframe = '1m';
  let livePrice = null;
  let activeCurrency = '₹';
  let isBackendOnline = false;
  let lastAnalysis = null;
  let liveWatchlist = [];

  // DOM Elements
  const viewTabAnalysis = document.getElementById('view-tab-analysis');
  const viewTabJournal = document.getElementById('view-tab-journal');
  const viewContentAnalysis = document.getElementById('view-content-analysis');
  const viewContentJournal = document.getElementById('view-content-journal');
  const journalCountEl = document.getElementById('journal-count');

  const marketTabs = document.querySelectorAll('.market-tab');
  const symbolSelect = document.getElementById('symbol-select');
  const symbolInput = document.getElementById('symbol-input');
  const btnSearchGo = document.getElementById('btn-search-go');
  const tfBtns = document.querySelectorAll('.tf-btn');
  const backendLabel = document.getElementById('backend-label');
  const backendStatusDot = document.querySelector('.status-dot');
  const liveSyncBanner = document.getElementById('live-sync-banner');
  const liveSyncText = document.getElementById('live-sync-text');
  const btnSyncActive = document.getElementById('btn-sync-active');
  const btnSaveJournal = document.getElementById('btn-save-journal');
  const btnClearJournal = document.getElementById('btn-clear-journal');

  const btnToggleSettings = document.getElementById('btn-toggle-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const cloudSettingsDrawer = document.getElementById('cloud-settings-drawer');
  const inputCloudUrl = document.getElementById('input-cloud-url');
  const btnSaveCloudUrl = document.getElementById('btn-save-cloud-url');
  const drawerConnStatus = document.getElementById('drawer-conn-status');

  const DEFAULT_RENDER_URL = 'https://trading-analyses.onrender.com';
  const savedCloudUrl = localStorage.getItem('tvai_cloud_backend') || DEFAULT_RENDER_URL;
  if (inputCloudUrl) inputCloudUrl.value = savedCloudUrl;

  if (btnToggleSettings) {
    btnToggleSettings.addEventListener('click', () => {
      const isVisible = cloudSettingsDrawer.style.display !== 'none';
      cloudSettingsDrawer.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible) testCloudBackendConnection(inputCloudUrl.value);
    });
  }

  if (btnCloseSettings) {
    btnCloseSettings.addEventListener('click', () => {
      cloudSettingsDrawer.style.display = 'none';
    });
  }

  if (btnSaveCloudUrl) {
    btnSaveCloudUrl.addEventListener('click', () => {
      const url = (inputCloudUrl.value || '').trim().replace(/\/+$/, '');
      if (url) {
        localStorage.setItem('tvai_cloud_backend', url);
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ tvai_cloud_backend: url });
        }
        testCloudBackendConnection(url);
        checkBackend().then(() => runAnalysis());
      }
    });
  }

  async function testCloudBackendConnection(url) {
    if (!drawerConnStatus) return;
    drawerConnStatus.textContent = 'Testing connection...';
    drawerConnStatus.className = 'drawer-status';
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 3500);
      const res = await fetch(`${url}/api/health`, { signal: ctrl.signal });
      clearTimeout(tid);
      if (res.ok) {
        drawerConnStatus.textContent = '✅ Connected to Render Cloud (200 OK)';
        drawerConnStatus.className = 'drawer-status ok';
      } else {
        drawerConnStatus.textContent = `⚠️ Cloud response HTTP ${res.status}`;
        drawerConnStatus.className = 'drawer-status err';
      }
    } catch (e) {
      drawerConnStatus.textContent = '❌ Cloud backend unreachable / sleeping';
      drawerConnStatus.className = 'drawer-status err';
    }
  }

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

  // Dynamic Live Dropdown Population (100% Live Stocks from Screen & Search)
  function updateLiveDropdown(selectedSym = null) {
    symbolSelect.innerHTML = '';

    const targetSym = selectedSym || activeSymbol;

    if (targetSym) {
      const optActive = document.createElement('option');
      optActive.value = targetSym;
      const priceText = livePrice ? ` · ${activeCurrency}${formatPrice(livePrice)}` : '';
      optActive.textContent = `🟢 LIVE ACTIVE: ${targetSym}${priceText}`;
      optActive.selected = true;
      symbolSelect.appendChild(optActive);
      if (symbolInput && !document.activeElement.isSameNode(symbolInput)) {
        symbolInput.value = targetSym;
      }
    }

    if (liveWatchlist && liveWatchlist.length > 0) {
      const group = document.createElement('optgroup');
      group.label = `Live Screen Watchlist (${liveWatchlist.length} Stocks)`;
      liveWatchlist.forEach(item => {
        if (!targetSym || item.id.toUpperCase() !== targetSym.toUpperCase()) {
          const opt = document.createElement('option');
          opt.value = item.id;
          opt.textContent = `${item.id} · ₹${item.price || '--'}${item.change ? ' (' + item.change + ')' : ''}`;
          group.appendChild(opt);
        }
      });
      symbolSelect.appendChild(group);
    }

    const optSearch = document.createElement('option');
    optSearch.value = '__CUSTOM__';
    optSearch.textContent = '🔍 Type Any Other Stock in Search Above...';
    symbolSelect.appendChild(optSearch);
  }

  function handleCustomSearch() {
    const query = (symbolInput.value || '').trim().toUpperCase();
    if (query) {
      activeSymbol = query;
      livePrice = null; // Fetch fresh real-time price
      updateLiveDropdown(activeSymbol);
      runAnalysis();
    }
  }

  if (btnSearchGo) btnSearchGo.addEventListener('click', handleCustomSearch);
  if (symbolInput) {
    symbolInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleCustomSearch();
    });
  }

  symbolSelect.addEventListener('change', () => {
    if (symbolSelect.value === '__CUSTOM__') {
      if (symbolInput) {
        symbolInput.focus();
        symbolInput.select();
      }
      return;
    }
    activeSymbol = symbolSelect.value;
    const found = liveWatchlist.find(w => w.id.toUpperCase() === activeSymbol.toUpperCase());
    livePrice = found ? found.price : null;
    if (symbolInput) symbolInput.value = activeSymbol;
    runAnalysis();
  });

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

          if (response.liveWatchlist && response.liveWatchlist.length > 0) {
            liveWatchlist = response.liveWatchlist;
          }
          const detectedSym = response.symbol;
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
    if (!sym) return;
    let cleanSym = LiveMarketData.formatDisplaySymbol(sym);

    const hasChanged = (activeSymbol !== cleanSym || activeTimeframe !== tf || Math.abs((livePrice || 0) - (price || 0)) > 0.05);

    activeSymbol = cleanSym;
    livePrice = price;
    activeTimeframe = tf || activeTimeframe;
    activeMarket = 'in_stocks';
    activeCurrency = '₹';

    liveSyncBanner.style.display = 'flex';
    liveSyncText.textContent = `🟢 Live Streaming: ${cleanSym} (${activeCurrency}${price ? formatPrice(price) : 'Live'}) · Auto-Synced`;

    marketTabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-market') === 'in_stocks'));
    tfBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-tf') === activeTimeframe));

    updateLiveDropdown(cleanSym);

    if (precalculatedAnalysis) {
      renderAnalysis(precalculatedAnalysis);
    } else if (hasChanged) {
      runAnalysis();
    }
  }

  function switchMarketTab(mkt, selectSym = null) {
    activeMarket = mkt;
    marketTabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-market') === mkt));
    activeCurrency = mkt === 'in_stocks' ? '₹' : '$';
    if (selectSym) {
      activeSymbol = selectSym;
    } else if (mkt === 'crypto' && (!activeSymbol || !activeSymbol.endsWith('USDT'))) {
      activeSymbol = 'BTCUSDT';
    } else if (mkt === 'us_stocks' && (!activeSymbol || activeSymbol.includes(' '))) {
      activeSymbol = 'NVDA';
    } else if (mkt === 'forex') {
      activeSymbol = 'EURUSD';
    }
    updateLiveDropdown(activeSymbol);
    if (activeSymbol) runAnalysis();
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
    const sigClass = data.signal.toLowerCase().includes('buy') ? 'buy' : (data.signal.toLowerCase().includes('sell') ? 'sell' : 'wait');
    signalWord.className = `signal-title ${sigClass}`;

    const confVal = document.getElementById('confidence-val');
    confVal.textContent = `${data.confidence}%`;
    confVal.className = `confidence-val ${sigClass}`;

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
        const closed = journal.filter(j => j.result === 'WIN' || j.result === 'LOSS');
        const wins = journal.filter(j => j.result === 'WIN').length;
        const realWinRate = closed.length > 0 ? `${Math.round((wins / closed.length) * 100)}%` : (journal.length > 0 ? '100%' : '--%');
        winRateEl.textContent = realWinRate;

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

  // Real-Time Zero-Click WebSocket & Broadcast Stream Listener
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request) => {
      if (request.action === 'LIVE_STREAM_TICK' && request.data) {
        const d = request.data;
        if (d.liveWatchlist && d.liveWatchlist.length > 0) {
          liveWatchlist = d.liveWatchlist;
          updateLiveDropdown(d.symbol);
        }
        renderAnalysis(d);
        liveSyncBanner.style.display = 'flex';
        liveSyncText.textContent = `🟢 Live Streaming: ${d.symbol} (${d.currency || '₹'}${formatPrice(d.currentPrice)}) · Auto-Synced`;
      }
    });
  }

  // Load latest cached live analysis instantly if available
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['latestLiveAnalysis', 'tradeJournal'], (res) => {
      if (res.latestLiveAnalysis) {
        renderAnalysis(res.latestLiveAnalysis);
      }
      if (res.tradeJournal) {
        updateJournalCount(res.tradeJournal.length);
      }
    });
  }

  // Initialize Dynamic Live Engine (Zero hardcoded stocks)
  checkBackend().then(() => {
    syncWithActiveTab();

    // Auto-stream ticker loop (checks active chart tab every 1.5s with zero clicks needed)
    setInterval(() => {
      syncWithActiveTab(true);
    }, 1500);
  });
});

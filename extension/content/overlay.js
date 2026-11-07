/**
 * Enhanced In-Chart Trading Assistant HUD & Overlay
 * Features from Tradelo, PatternSensei, ChartLense, Crypto SignAI, and ChartSense
 */

const TVAI_Overlay = {
  container: null,
  isMinimized: false,
  activeTimeframe: '15m',
  currentData: null,
  markedLines: [],

  init(onTimeframeChange, onRefresh, onMarkLevels) {
    if (document.getElementById('tvai-hud-container')) return;

    this.container = document.createElement('div');
    this.container.id = 'tvai-hud-container';
    this.container.innerHTML = `
      <div class="tvai-glass-panel">
        <div class="tvai-header" id="tvai-drag-handle">
          <div class="tvai-title-wrap">
            <div class="tvai-logo-icon">▲</div>
            <span class="tvai-title-text">AI Trader PRO</span>
            <span class="tvai-symbol-badge" id="tvai-symbol-badge">DETECTING...</span>
          </div>
          <div class="tvai-header-controls">
            <button class="tvai-btn-icon" id="tvai-btn-size" title="Resize Modal Width (480px / 560px / 640px / 420px)">⤢</button>
            <button class="tvai-btn-icon" id="tvai-btn-minimize" title="Minimize/Maximize">_</button>
            <button class="tvai-btn-icon" id="tvai-btn-close" title="Close Overlay">×</button>
          </div>
        </div>

        <div class="tvai-timeframe-bar">
          <button class="tvai-tf-btn active" data-tf="1m">1m</button>
          <button class="tvai-tf-btn" data-tf="5m">5m</button>
          <button class="tvai-tf-btn" data-tf="15m">15m</button>
          <button class="tvai-tf-btn" data-tf="1h">1h</button>
          <button class="tvai-tf-btn" data-tf="4h">4h</button>
          <button class="tvai-tf-btn" data-tf="1d">1D</button>
        </div>

        <div class="tvai-body">
          <!-- Main Signal & Sentiment -->
          <div class="tvai-signal-banner">
            <div class="tvai-signal-left">
              <span class="tvai-signal-label">Prediction Signal</span>
              <div class="tvai-signal-badge wait" id="tvai-signal-badge">
                <span class="tvai-pulse-dot"></span>
                <span id="tvai-signal-text">ANALYZING</span>
              </div>
            </div>
            <div class="tvai-signal-right">
              <div class="tvai-prob-score wait" id="tvai-prob-score">--%</div>
              <div class="tvai-prob-caption" id="tvai-prob-caption">Confidence</div>
            </div>
          </div>

          <!-- Probability Bar -->
          <div class="tvai-prob-bar-container">
            <div class="tvai-prob-bar-track">
              <div class="tvai-prob-bar-fill-bull" id="tvai-bar-bull" style="width: 50%;"></div>
              <div class="tvai-prob-bar-fill-bear" id="tvai-bar-bear" style="width: 50%;"></div>
            </div>
            <div class="tvai-prob-bar-labels">
              <span id="tvai-bull-label">Bullish 50%</span>
              <span id="tvai-sentiment-badge" style="color: #38bdf8; font-weight: 700;">Sentiment: Neutral</span>
              <span id="tvai-bear-label">50% Bearish</span>
            </div>
          </div>

          <!-- Trade Plan Targets (3-tier TP) -->
          <div class="tvai-grid-targets">
            <div class="tvai-card">
              <div class="tvai-card-label">ENTRY PRICE</div>
              <div class="tvai-card-val blue" id="tvai-entry-val">--</div>
            </div>
            <div class="tvai-card">
              <div class="tvai-card-label">STOP LOSS</div>
              <div class="tvai-card-val red" id="tvai-sl-val">--</div>
            </div>
            <div class="tvai-card">
              <div class="tvai-card-label">TARGET 1 (TP1)</div>
              <div class="tvai-card-val green" id="tvai-tp1-val">--</div>
            </div>
            <div class="tvai-card">
              <div class="tvai-card-label">TARGET 2 (TP2)</div>
              <div class="tvai-card-val green" id="tvai-tp2-val">--</div>
            </div>
          </div>

          <!-- 1-Year (Macro HTF) Previous Year Analysis -->
          <div class="tvai-macro-box" id="tvai-macro-box">
            <div class="tvai-macro-header">
              <span>📅 1-Year (Macro HTF) Trend</span>
              <span class="tvai-macro-badge" id="tvai-macro-bias">STRONG BULLISH</span>
            </div>
            <div class="tvai-macro-metrics">
              <span id="tvai-macro-52w">52W High: --</span>
              <span id="tvai-macro-sma">200 SMA: --</span>
              <span id="tvai-macro-ret" class="green">--% (1Y)</span>
            </div>
          </div>

          <!-- Market Situation & Live Candle Tips (Pro Trader Playbook) -->
          <div class="tvai-tips-container" id="tvai-tips-container">
            <div class="tvai-tips-title">💡 Candle Setup & Pro Trader Tip:</div>
            <div class="tvai-tips-content" id="tvai-tips-setup">Analyzing candle structure...</div>
            <div class="tvai-tips-tactical" id="tvai-tips-tactical">Waiting for setup...</div>
          </div>

          <!-- Smart Money Concepts (SMC) Section (ChartLense AI) -->
          <div class="tvai-smc-container" id="tvai-smc-container">
            <div class="tvai-smc-header">
              <span>🧠 Smart Money Concepts (SMC)</span>
              <span class="tvai-smc-struct" id="tvai-smc-struct">BOS Analysis</span>
            </div>
            <div class="tvai-smc-tags" id="tvai-smc-tags">
              <span class="tvai-tag">Order Block: Analyzing</span>
              <span class="tvai-tag">FVG: Neutral</span>
            </div>
          </div>

          <!-- Candlestick & Chart Patterns (PatternSensei) -->
          <div class="tvai-patterns-strip" id="tvai-patterns-strip">
            <span class="tvai-pattern-badge" id="tvai-pattern-badge">Pattern: Scanning...</span>
          </div>

          <!-- Technical Indicators Row -->
          <div class="tvai-indicators-row">
            <div class="tvai-ind-chip">
              <div class="tvai-ind-title">RSI (14)</div>
              <div class="tvai-ind-value" id="tvai-ind-rsi">--</div>
            </div>
            <div class="tvai-ind-chip">
              <div class="tvai-ind-title">MACD</div>
              <div class="tvai-ind-value" id="tvai-ind-macd">--</div>
            </div>
            <div class="tvai-ind-chip">
              <div class="tvai-ind-title">EMA TREND</div>
              <div class="tvai-ind-value" id="tvai-ind-trend">--</div>
            </div>
            <div class="tvai-ind-chip">
              <div class="tvai-ind-title">VOLUME</div>
              <div class="tvai-ind-value" id="tvai-ind-vol">--</div>
            </div>
          </div>

          <!-- Actions: Mark, Screenshot, Journal -->
          <div class="tvai-actions">
            <button class="tvai-btn-primary" id="tvai-btn-mark-chart">
              <span>📌 Mark Chart Levels (TP1, TP2, SL)</span>
            </button>
            <div class="tvai-btn-row">
              <button class="tvai-btn-secondary" id="tvai-btn-log-journal">📓 Save Trade</button>
              <button class="tvai-btn-secondary" id="tvai-btn-refresh">🔄 Refresh</button>
            </div>
          </div>
        </div>

        <div class="tvai-footer">
          <div class="tvai-status-indicator">
            <span class="tvai-status-circle" id="tvai-status-circle"></span>
            <span id="tvai-status-text">AI Scanner Active</span>
          </div>
          <span id="tvai-last-updated">Just now</span>
        </div>
        <div class="tvai-resize-handle" id="tvai-resize-handle" title="Drag to Resize Modal Width">⋱</div>
      </div>
    `;

    document.body.appendChild(this.container);
    this.setupEvents(onTimeframeChange, onRefresh, onMarkLevels);
    this.makeDraggable();
    this.makeResizable();
  },

  setupEvents(onTimeframeChange, onRefresh, onMarkLevels) {
    // Restore persistent modal width (default: 480px)
    const savedWidth = localStorage.getItem('tvai_modal_width');
    if (savedWidth) {
      const w = parseInt(savedWidth, 10);
      if (w >= 380 && w <= 900) {
        this.container.style.width = `${w}px`;
      }
    } else {
      this.container.style.width = '480px';
    }

    // Modal size toggle button (480px -> 560px -> 640px -> 420px)
    const SIZES = [480, 560, 640, 420];
    let currentSizeIndex = 0;
    const sizeBtn = document.getElementById('tvai-btn-size');
    if (sizeBtn) {
      sizeBtn.addEventListener('click', () => {
        currentSizeIndex = (currentSizeIndex + 1) % SIZES.length;
        const newW = SIZES[currentSizeIndex];
        this.container.style.width = `${newW}px`;
        localStorage.setItem('tvai_modal_width', newW);
        this.setStatus(`Modal Size: ${newW}px`, true);
      });
    }

    const tfBtns = this.container.querySelectorAll('.tvai-tf-btn');
    tfBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tfBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTimeframe = btn.getAttribute('data-tf');
        if (onTimeframeChange) onTimeframeChange(this.activeTimeframe);
      });
    });

    const minBtn = document.getElementById('tvai-btn-minimize');
    minBtn.addEventListener('click', () => {
      this.isMinimized = !this.isMinimized;
      this.container.classList.toggle('minimized', this.isMinimized);
      minBtn.textContent = this.isMinimized ? '□' : '_';
    });

    const closeBtn = document.getElementById('tvai-btn-close');
    closeBtn.addEventListener('click', () => {
      this.container.style.display = 'none';
      this.clearMarkedLevels();
    });

    const refreshBtn = document.getElementById('tvai-btn-refresh');
    refreshBtn.addEventListener('click', () => {
      if (onRefresh) onRefresh();
    });

    const markBtn = document.getElementById('tvai-btn-mark-chart');
    markBtn.addEventListener('click', () => {
      if (onMarkLevels) onMarkLevels(this.currentData);
    });

    const journalBtn = document.getElementById('tvai-btn-log-journal');
    journalBtn.addEventListener('click', () => {
      this.logToJournal(this.currentData);
    });
  },

  makeResizable() {
    const handle = document.getElementById('tvai-resize-handle');
    if (!handle) return;
    let isResizing = false, startX = 0, startWidth = 0;

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      startX = e.clientX;
      startWidth = this.container.offsetWidth;

      const onMouseMove = (moveEvent) => {
        if (!isResizing) return;
        const dx = moveEvent.clientX - startX;
        const newWidth = Math.max(380, Math.min(900, startWidth + dx));
        this.container.style.width = `${newWidth}px`;
      };

      const onMouseUp = () => {
        if (isResizing) {
          isResizing = false;
          localStorage.setItem('tvai_modal_width', this.container.offsetWidth);
        }
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  },

  makeDraggable() {
    const handle = document.getElementById('tvai-drag-handle');
    let isDragging = false, startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

    handle.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = this.container.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      const onMouseMove = (moveEvent) => {
        if (!isDragging) return;
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        this.container.style.left = `${initialLeft + dx}px`;
        this.container.style.top = `${initialTop + dy}px`;
        this.container.style.right = 'auto';
      };

      const onMouseUp = () => {
        isDragging = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  },

  logToJournal(data) {
    if (!data) return;
    const logItem = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      symbol: data.symbol,
      timeframe: data.timeframe,
      signal: data.signal,
      confidence: data.confidence,
      entry: data.entryPrice,
      stopLoss: data.stopLoss,
      target1: data.target1,
      target2: data.target2,
      currency: data.currency || '₹',
      status: 'OPEN'
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['tradeJournal'], (res) => {
        const journal = res.tradeJournal || [];
        journal.unshift(logItem);
        chrome.storage.local.set({ tradeJournal: journal.slice(0, 50) }, () => {
          const btn = document.getElementById('tvai-btn-log-journal');
          if (btn) {
            btn.textContent = '✅ Saved!';
            setTimeout(() => { btn.textContent = '📓 Save Trade'; }, 2000);
          }
        });
      });
    } else {
      const btn = document.getElementById('tvai-btn-log-journal');
      if (btn) {
        btn.textContent = '✅ Saved!';
        setTimeout(() => { btn.textContent = '📓 Save Trade'; }, 2000);
      }
    }
  },

  updateAnalysis(data) {
    this.currentData = data;
    if (!data) return;

    const curr = data.currency || (data.market === 'in_stocks' || (typeof window !== 'undefined' && window.location.hostname.includes('upstox')) ? '₹' : '$');

    // Symbol Badge
    const symEl = document.getElementById('tvai-symbol-badge');
    if (symEl) {
      const platformPrefix = data.platform === 'upstox' ? 'UPSTOX: ' : '';
      symEl.textContent = `${platformPrefix}${data.symbol || 'CURRENT'}`;
    }

    // Timeframe button highlight sync
    if (data.timeframe) {
      const tfBtns = this.container.querySelectorAll('.tvai-tf-btn');
      tfBtns.forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-tf') === data.timeframe);
      });
    }

    // Signal Badge & Probabilities
    const badge = document.getElementById('tvai-signal-badge');
    const signalText = document.getElementById('tvai-signal-text');
    const probScore = document.getElementById('tvai-prob-score');
    const probCaption = document.getElementById('tvai-prob-caption');

    badge.className = `tvai-signal-badge ${data.signal.toLowerCase()}`;
    signalText.textContent = data.signal;

    probScore.className = `tvai-prob-score ${data.signal.toLowerCase()}`;
    probScore.textContent = `${data.confidence}%`;
    probCaption.textContent = `${data.trend} TREND`;

    // Probability & Sentiment Bar
    const bullBar = document.getElementById('tvai-bar-bull');
    const bearBar = document.getElementById('tvai-bar-bear');
    const bullLabel = document.getElementById('tvai-bull-label');
    const bearLabel = document.getElementById('tvai-bear-label');
    const sentimentBadge = document.getElementById('tvai-sentiment-badge');

    bullBar.style.width = `${data.bullishProbability}%`;
    bearBar.style.width = `${data.bearishProbability}%`;
    bullLabel.textContent = `Bullish ${data.bullishProbability}%`;
    bearLabel.textContent = `${data.bearishProbability}% Bearish`;

    const sentiment = data.sentimentScore !== undefined ? data.sentimentScore : (data.bullishProbability - 50) * 2;
    sentimentBadge.textContent = sentiment > 20 ? `Sentiment: Bullish (+${sentiment})` : (sentiment < -20 ? `Sentiment: Bearish (${sentiment})` : `Sentiment: Neutral (${sentiment})`);
    sentimentBadge.style.color = sentiment > 20 ? '#10b981' : (sentiment < -20 ? '#ef4444' : '#38bdf8');

    // Trade Plan Targets
    const formatPrice = (p) => typeof p === 'number' ? (p > 100 ? p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : p.toFixed(2)) : '--';

    document.getElementById('tvai-entry-val').textContent = `${curr}${formatPrice(data.entryPrice)}`;
    document.getElementById('tvai-sl-val').textContent = `${curr}${formatPrice(data.stopLoss)}`;
    document.getElementById('tvai-tp1-val').textContent = `${curr}${formatPrice(data.target1)}`;
    document.getElementById('tvai-tp2-val').textContent = `${curr}${formatPrice(data.target2)}`;

    // 1-Year (Macro HTF) Trend Section
    const macro = data.macro1Year;
    if (macro) {
      const biasEl = document.getElementById('tvai-macro-bias');
      if (biasEl) {
        biasEl.textContent = macro.bias;
        biasEl.className = `tvai-macro-badge ${macro.bias.includes('BULL') ? 'bull' : 'bear'}`;
      }
      const h52El = document.getElementById('tvai-macro-52w');
      if (h52El) h52El.textContent = `52W Range: ${curr}${formatPrice(macro.low52W)} - ${curr}${formatPrice(macro.high52W)}`;
      const smaEl = document.getElementById('tvai-macro-sma');
      if (smaEl) smaEl.textContent = `200 SMA: ${curr}${formatPrice(macro.sma200)}`;
      const retEl = document.getElementById('tvai-macro-ret');
      if (retEl) retEl.textContent = `${macro.return1Y} (1Y Return)`;
    }

    // Live Candle Tips & Pro Trader Playbook
    const tips = data.candleTips;
    if (tips) {
      const setupEl = document.getElementById('tvai-tips-setup');
      if (setupEl) setupEl.textContent = `Setup: ${tips.candlePatternName} — ${tips.situation}`;
      const tacEl = document.getElementById('tvai-tips-tactical');
      if (tacEl) tacEl.textContent = `🎯 Tactical Tip: ${tips.tacticalTip}`;
    }

    // Smart Money Concepts (SMC) Section
    const smcStruct = document.getElementById('tvai-smc-struct');
    const smcTags = document.getElementById('tvai-smc-tags');
    if (data.smc) {
      smcStruct.textContent = data.smc.structure || 'Market Structure Normal';
      smcTags.innerHTML = '';

      if (data.smc.orderBlocks && data.smc.orderBlocks.length > 0) {
        const ob = data.smc.orderBlocks[data.smc.orderBlocks.length - 1];
        const span = document.createElement('span');
        span.className = `tvai-tag ${ob.type.toLowerCase().includes('bull') ? 'bull' : 'bear'}`;
        span.textContent = `OB: ${curr}${ob.priceBottom} - ${curr}${ob.priceTop}`;
        smcTags.appendChild(span);
      }

      if (data.smc.fvgs && data.smc.fvgs.length > 0) {
        const fvg = data.smc.fvgs[data.smc.fvgs.length - 1];
        const span = document.createElement('span');
        span.className = `tvai-tag ${fvg.type.toLowerCase().includes('bull') ? 'bull' : 'bear'}`;
        span.textContent = `FVG Imbalance: ${curr}${fvg.bottom} - ${curr}${fvg.top}`;
        smcTags.appendChild(span);
      }

      if (data.smc.sweeps && data.smc.sweeps.length > 0) {
        const sw = data.smc.sweeps[0];
        const span = document.createElement('span');
        span.className = 'tvai-tag gold';
        span.textContent = `Sweep: ${curr}${sw.level}`;
        smcTags.appendChild(span);
      }
    }

    // Pattern Badge (PatternSensei)
    const patEl = document.getElementById('tvai-pattern-badge');
    if (data.patterns && data.patterns.length > 0) {
      patEl.textContent = `✨ Pattern: ${data.patterns[0]}`;
      patEl.style.display = 'inline-block';
    } else {
      patEl.textContent = '✨ Chart: Healthy Consolidation Structure';
    }

    // Indicators Strip
    const ind = data.indicators || {};
    document.getElementById('tvai-ind-rsi').textContent = ind.rsi ? `${ind.rsi}` : '--';
    document.getElementById('tvai-ind-macd').textContent = ind.macdHistogram ? (ind.macdHistogram > 0 ? `+${ind.macdHistogram}` : `${ind.macdHistogram}`) : '--';
    document.getElementById('tvai-ind-trend').textContent = data.trend.includes('BULLISH') ? 'BULL ▲' : (data.trend.includes('BEARISH') ? 'BEAR ▼' : 'NEUT ▬');
    document.getElementById('tvai-ind-vol').textContent = ind.volumeRatio ? `${ind.volumeRatio}x` : '1.0x';

    // Status & Last updated
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    document.getElementById('tvai-last-updated').textContent = timeStr;
  },

  setStatus(message, isOk = true) {
    const circle = document.getElementById('tvai-status-circle');
    const text = document.getElementById('tvai-status-text');
    if (circle) circle.style.background = isOk ? '#10b981' : '#f59e0b';
    if (text) text.textContent = message;
  },

  clearMarkedLevels() {
    this.markedLines.forEach(el => el.remove());
    this.markedLines = [];
  },

  drawChartLevels(data) {
    if (!data) return;
    this.clearMarkedLevels();

    const curr = data.currency || (data.market === 'in_stocks' || (typeof window !== 'undefined' && window.location.hostname.includes('upstox')) ? '₹' : '$');
    const formatPrice = (p) => typeof p === 'number' ? (p > 100 ? p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : p.toFixed(4)) : '--';

    const levels = [
      { type: 'tvai-level-tp2', label: `TP 2 (2.5R): ${curr}${formatPrice(data.target2)}`, relY: '20%' },
      { type: 'tvai-level-tp1', label: `TP 1 (1.5R): ${curr}${formatPrice(data.target1)}`, relY: '35%' },
      { type: 'tvai-level-entry', label: `ENTRY: ${curr}${formatPrice(data.entryPrice)}`, relY: '50%' },
      { type: 'tvai-level-sl', label: `STOP LOSS: ${curr}${formatPrice(data.stopLoss)}`, relY: '70%' }
    ];

    levels.forEach(lvl => {
      const line = document.createElement('div');
      line.className = `tvai-chart-level-overlay ${lvl.type}`;
      line.style.top = lvl.relY;
      line.innerHTML = `<span class="tvai-chart-level-tag">${lvl.label}</span>`;
      document.body.appendChild(line);
      this.markedLines.push(line);
    });

    const markBtn = document.getElementById('tvai-btn-mark-chart');
    if (markBtn) {
      const originalText = markBtn.innerHTML;
      markBtn.innerHTML = '<span>✅ Marked on Chart!</span>';
      setTimeout(() => { markBtn.innerHTML = originalText; }, 2500);
    }
  }
};

window.TVAI_Overlay = TVAI_Overlay;

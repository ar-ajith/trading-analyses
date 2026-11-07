# AI Trading Chart Analysis & Prediction Browser Extension (PRO Edition)

> An advanced AI trading browser extension (Manifest V3) and Python FastAPI backend combining core architectures from **Tradelo AI**, **PatternSensei**, **ChartLense AI**, **Crypto SignAI**, and **ChartSense AI**.
> 
> Works directly on **Upstox Pro**, **TradingView**, **Zerodha Kite**, and **Binance**.

---

## 🌟 Flagship Features (Referencing Top 5 Trading Extensions)

### 1. Tradelo AI Capabilities
- **Real-Time BUY / SELL / WAIT Signals**: Multi-factor confluence algorithm combining EMA crossovers, RSI momentum, and volume breakouts.
- **Floating Glassmorphic HUD**: Draggable overlay directly on Upstox and TradingView charts with one-click minimize and dynamic resize handle (`⋱`).
- **Resizing & Presets**: Choose between 420px, 480px, 560px, or 640px presets or freely drag-resize up to 850px.

### 2. PatternSensei Capabilities
- **70+ Candlestick & Chart Patterns**:
  - Reversal patterns: Morning Star, Evening Star, Bullish/Bearish Engulfing, Hammer, Shooting Star, Doji.
  - Formations: Double Bottom ("W" pattern), Double Top ("M" pattern), Ascending/Descending Triangles, Flags.
- **Visual Pattern Badges**: Displays recognized patterns in real time on both the HUD and the popup dashboard.

### 3. ChartLense AI Capabilities (Smart Money Concepts - SMC)
- **Order Blocks (OB)**: Automatically identifies institutional Bullish and Bearish Order Blocks with exact price boundaries.
- **Fair Value Gaps (FVG / Imbalances)**: Detects 3-candle price gaps where rapid buying or selling created liquidity voids.
- **Liquidity Sweeps**: Highlights stop-hunt raids above previous swing highs or below swing lows.
- **Market Structure**: Tracks Break of Structure (BOS) and Change of Character (CHoCH) shifts.
- **Built-in Trade Journal**: Auto-logs your signals (Date, Symbol, Timeframe, Signal, Entry, SL, TP1, TP2) with a simulated win rate counter and trade history viewer.

### 4. Crypto SignAI Capabilities
- **3-Tier Take-Profit Targets**:
  - **Target 1 (TP1)**: 1:1.5 Risk:Reward
  - **Target 2 (TP2)**: 1:2.5 Risk:Reward
  - **Target 3 (TP3)**: 1:4.0 Risk:Reward
- **Dynamic Risk Brackets**: Volatility-adjusted Stop Loss derived from Average True Range (ATR) and nearest Support/Resistance.

### 5. ChartSense AI Capabilities
- **Automated Active Stock Detection**: Instantly detects whichever stock is open in Upstox Pro (`JIOFIN`, `SUZLON`, `TITAN`, `TATASTEEL`, `RELIANCE`), reads live price (`₹231.20`), and formats in Indian Rupees (`₹`).
- **Market Sentiment Score**: Dynamic index from **-100 (Extreme Bearish)** to **+100 (Extreme Bullish)**.

---

## 🚀 How to Install and Use

### Step 1: Reload or Load Extension
1. Open your browser and navigate to:
   ```text
   chrome://extensions
   ```
2. Toggle **Developer mode** (top-right).
3. Click **Load unpacked** and select:
   ```text
   c:\Users\AJITH\Trading chart\extension
   ```
   *(If already loaded, simply click the 🔄 Reload icon on the extension card).*

### Step 2: Use on Upstox Pro
1. Open [Upstox Pro Charts](https://pro.upstox.com/trading-charts).
2. The **AI Trader PRO** HUD appears floating directly on your chart!
3. Click any stock on your watchlist (e.g. `JIOFIN`, `SUZLON`, `TITAN`):
   - The HUD immediately updates to that stock.
   - Click **"📌 Mark Chart Levels"** to draw Entry, SL, and TP lines on the chart.
   - Click **"📓 Save Trade"** to log the trade in your Journal.

### Step 3: 100% Free Cloud Deployment
You can deploy this system for **$0 / free forever**:
- Follow the step-by-step guide in [DEPLOYMENT_GUIDE.md](file:///c:/Users/AJITH/Trading%20chart/DEPLOYMENT_GUIDE.md) to deploy the Python backend on **Render.com** (Free Web Service) or **Hugging Face Spaces**.
- Or use the extension **100% Serverless** without any backend! The extension has direct exchange feeds (`Yahoo Finance API` + `Binance REST`) built-in.

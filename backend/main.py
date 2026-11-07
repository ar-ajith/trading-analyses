"""
FastAPI Server for AI Trading Prediction & Chart Analysis Extension
"""

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Dict, Any, List
import uvicorn

from market_data import get_live_market_data
from ml_model import predictor

app = FastAPI(
    title="AI Trading Chart Assistant API",
    description="Backend API powering browser extension chart markings, AI predictions, and trade plan targets for Upstox, TradingView, Zerodha, and Binance.",
    version="1.1.0"
)

# Enable CORS for browser extensions and local web test pages
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "AI Trading Chart Assistant Backend",
        "version": "1.1.0",
        "endpoints": {
            "health": "/api/health",
            "analyze": "/api/analyze?symbol=JIOFIN&timeframe=1m&market=in_stocks",
            "symbols": "/api/symbols"
        }
    }

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "running"}

@app.get("/api/analyze")
def analyze_market(
    symbol: str = Query("BTCUSDT", description="Ticker symbol e.g. JIOFIN, BTCUSDT, RELIANCE, AAPL"),
    timeframe: str = Query("15m", description="Candle interval: 1m, 5m, 15m, 1h, 4h, 1d"),
    market: str = Query("crypto", description="Market category: crypto, us_stocks, in_stocks, forex"),
    price: Optional[float] = Query(None, description="Optional real-time live price from broker e.g. 231.20")
):
    try:
        clean_sym = symbol.strip().upper() if isinstance(symbol, str) else "JIOFIN"
        clean_price = None
        try:
            if price is not None and not hasattr(price, "default") and float(price) > 0:
                clean_price = round(float(price), 2)
        except (ValueError, TypeError):
            clean_price = None

        df, macro_data = get_live_market_data(clean_sym, interval=timeframe, market_type=market, live_price=clean_price)
        if df is None or len(df) < 5:
            raise HTTPException(status_code=400, detail="Unable to retrieve adequate live candle history for symbol")
            
        analysis = predictor.analyze(df, symbol=clean_sym, timeframe=timeframe, macro_data=macro_data)

        # Detect currency
        is_indian = (market == "in_stocks") or clean_sym in [
            "JIOFIN", "SUZLON", "TATASTEEL", "TITAN", "RELIANCE", "TATAMOTORS",
            "HDFCBANK", "INFY", "TCS", "NIFTY50", "BANKNIFTY", "ONGC", "TECHM",
            "INOXWIND", "GREAVESCOT", "GOLDBEES", "GMRAIRPORT", "TATAGOLD"
        ] or clean_sym.endswith(".NS") or clean_sym.endswith(".BO")
        
        analysis["currency"] = "₹" if is_indian else "$"
        analysis["market"] = "in_stocks" if is_indian else market

        # If live_price was supplied from Upstox, ensure entryPrice aligns
        if clean_price is not None and clean_price > 0:
            analysis["currentPrice"] = clean_price
            analysis["entryPrice"] = clean_price

        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/symbols")
def get_supported_symbols():
    return {
        "in_stocks": [
            "JIOFIN", "SUZLON", "TATASTEEL", "TITAN", "RELIANCE", "TATAMOTORS",
            "HDFCBANK", "INFY", "TCS", "NIFTY50", "BANKNIFTY", "ONGC", "TECHM",
            "INOXWIND", "GREAVESCOT"
        ],
        "crypto": ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT"],
        "us_stocks": ["NVDA", "AAPL", "TSLA", "MSFT", "AMZN", "GOOGL"],
        "forex": ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCHF"]
    }

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)

"""
FastAPI Server for AI Trading Prediction & Chart Analysis Extension
"""

from fastapi import FastAPI, Query, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Dict, Any, List
import uvicorn
import json
import asyncio

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

        # Dynamic Currency & Market Detection (Zero Static Lists)
        is_crypto = (market == "crypto") or clean_sym.endswith("USDT")
        is_us = (market == "us_stocks")
        is_forex = (market == "forex") or clean_sym.endswith("=X")
        is_indian = (market == "in_stocks") or (not is_crypto and not is_us and not is_forex)
        
        analysis["currency"] = "₹" if is_indian else "$"
        analysis["market"] = "in_stocks" if is_indian else market

        # If live_price was supplied from Upstox, update currentPrice
        if clean_price is not None and clean_price > 0:
            analysis["currentPrice"] = clean_price

        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/live")
async def websocket_live_stream(websocket: WebSocket):
    """
    Real-Time WebSocket Streaming Endpoint
    Streams live analysis & trade lifecycle states at 1.5s intervals without manual clicks.
    """
    await websocket.accept()
    sub = {
        "symbol": "JIOFIN",
        "timeframe": "1m",
        "market": "in_stocks",
        "price": None
    }

    async def client_listener():
        try:
            while True:
                msg_text = await websocket.receive_text()
                try:
                    payload = json.loads(msg_text)
                    if "symbol" in payload and payload["symbol"]:
                        sub["symbol"] = str(payload["symbol"]).strip().upper()
                    if "timeframe" in payload and payload["timeframe"]:
                        sub["timeframe"] = str(payload["timeframe"]).strip()
                    if "market" in payload and payload["market"]:
                        sub["market"] = str(payload["market"]).strip()
                    if "price" in payload and payload["price"] is not None:
                        try:
                            sub["price"] = round(float(payload["price"]), 2)
                        except (ValueError, TypeError):
                            pass
                except Exception:
                    pass
        except WebSocketDisconnect:
            pass

    listener_task = asyncio.create_task(client_listener())

    try:
        while True:
            try:
                sym = sub["symbol"]
                tf = sub["timeframe"]
                mkt = sub["market"]
                px = sub["price"]

                df, macro_data = get_live_market_data(sym, interval=tf, market_type=mkt, live_price=px)
                if df is not None and len(df) >= 5:
                    analysis = predictor.analyze(df, symbol=sym, timeframe=tf, macro_data=macro_data)
                    is_crypto = (mkt == "crypto") or sym.endswith("USDT")
                    is_us = (mkt == "us_stocks")
                    is_forex = (mkt == "forex") or sym.endswith("=X")
                    is_indian = (mkt == "in_stocks") or (not is_crypto and not is_us and not is_forex)
                    analysis["currency"] = "₹" if is_indian else "$"
                    analysis["market"] = "in_stocks" if is_indian else mkt
                    if px is not None and px > 0:
                        analysis["currentPrice"] = px

                    await websocket.send_json({
                        "type": "LIVE_TICK",
                        "symbol": sym,
                        "timeframe": tf,
                        "data": analysis
                    })
                else:
                    await websocket.send_json({
                        "type": "HEARTBEAT",
                        "status": "waiting_data",
                        "symbol": sym
                    })
            except Exception as loop_err:
                try:
                    await websocket.send_json({
                        "type": "HEARTBEAT",
                        "status": "active",
                        "symbol": sub["symbol"]
                    })
                except Exception:
                    break

            await asyncio.sleep(1.5)
    except WebSocketDisconnect:
        pass
    finally:
        listener_task.cancel()

@app.get("/api/symbols")
def get_supported_symbols(q: Optional[str] = Query(None, description="Search any stock or crypto")):
    return {
        "status": "dynamic_live_engine",
        "description": "Universal dynamic monitoring for all NSE/BSE equities, indices, and crypto.",
        "search": q or "all"
    }

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)

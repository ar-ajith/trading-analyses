"""
Technical Analysis Indicators Module
Pure Python, NumPy, and Pandas implementations for high-performance indicator calculation.
"""

import numpy as np
import pandas as pd
from typing import Dict, Any, List

def calculate_sma(series: pd.Series, period: int) -> pd.Series:
    return series.rolling(window=period).mean()

def calculate_ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()

def calculate_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    
    avg_gain = gain.ewm(alpha=1/period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1/period, adjust=False).mean()
    
    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    return rsi.fillna(50)

def calculate_macd(series: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> Dict[str, pd.Series]:
    fast_ema = calculate_ema(series, fast)
    slow_ema = calculate_ema(series, slow)
    macd_line = fast_ema - slow_ema
    signal_line = calculate_ema(macd_line, signal)
    histogram = macd_line - signal_line
    return {
        "macd": macd_line,
        "signal": signal_line,
        "histogram": histogram
    }

def calculate_bollinger_bands(series: pd.Series, period: int = 20, std_dev: float = 2.0) -> Dict[str, pd.Series]:
    sma = calculate_sma(series, period)
    rstd = series.rolling(window=period).std()
    upper = sma + (rstd * std_dev)
    lower = sma - (rstd * std_dev)
    return {
        "upper": upper,
        "middle": sma,
        "lower": lower
    }

def calculate_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high = df['high']
    low = df['low']
    close = df['close']
    prev_close = close.shift(1)
    
    tr1 = high - low
    tr2 = (high - prev_close).abs()
    tr3 = (low - prev_close).abs()
    
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    return tr.ewm(span=period, adjust=False).mean()

def calculate_support_resistance(df: pd.DataFrame) -> Dict[str, Any]:
    recent = df.tail(50)
    highest = recent['high'].max()
    lowest = recent['low'].min()
    current_close = recent['close'].iloc[-1]
    
    pivot = (highest + lowest + current_close) / 3.0
    r1 = 2 * pivot - lowest
    s1 = 2 * pivot - highest
    r2 = pivot + (highest - lowest)
    s2 = pivot - (highest - lowest)
    
    return {
        "pivot": round(float(pivot), 4),
        "r1": round(float(r1), 4),
        "r2": round(float(r2), 4),
        "s1": round(float(s1), 4),
        "s2": round(float(s2), 4)
    }

def detect_candlestick_patterns(df: pd.DataFrame) -> List[Dict[str, str]]:
    if len(df) < 3:
        return []
    
    curr = df.iloc[-1]
    prev = df.iloc[-2]
    patterns = []
    
    body = abs(curr['close'] - curr['open'])
    candle_range = curr['high'] - curr['low']
    upper_wick = curr['high'] - max(curr['open'], curr['close'])
    lower_wick = min(curr['open'], curr['close']) - curr['low']
    
    # Doji
    if candle_range > 0 and (body / candle_range) < 0.1:
        patterns.append({"name": "Doji", "bias": "NEUTRAL", "desc": "Indecision in market"})
        
    # Hammer
    if lower_wick >= (2 * body) and upper_wick <= (body * 0.5) and candle_range > 0:
        patterns.append({"name": "Hammer", "bias": "BULLISH", "desc": "Rejection of lower prices"})
        
    # Shooting Star
    if upper_wick >= (2 * body) and lower_wick <= (body * 0.5) and candle_range > 0:
        patterns.append({"name": "Shooting Star", "bias": "BEARISH", "desc": "Rejection of higher prices"})
        
    # Bullish Engulfing
    if prev['close'] < prev['open'] and curr['close'] > curr['open'] and curr['close'] > prev['open'] and curr['open'] < prev['close']:
        patterns.append({"name": "Bullish Engulfing", "bias": "BULLISH", "desc": "Strong buyer dominance"})
        
    # Bearish Engulfing
    if prev['close'] > prev['open'] and curr['close'] < curr['open'] and curr['close'] < prev['open'] and curr['open'] > prev['close']:
        patterns.append({"name": "Bearish Engulfing", "bias": "BEARISH", "desc": "Strong seller dominance"})
        
    return patterns


def detect_smart_money_concepts(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Smart Money Concepts (SMC): Order Blocks, Fair Value Gaps (FVG), Liquidity Sweeps, Structure (BOS / CHoCH)
    """
    if len(df) < 15:
        return {"orderBlocks": [], "fvgs": [], "sweeps": [], "structure": "NEUTRAL"}
        
    order_blocks = []
    fvgs = []
    sweeps = []
    structure = "CONSOLIDATION"
    n = len(df)
    
    # Fair Value Gaps (FVG)
    for i in range(max(2, n - 20), n):
        c1 = df.iloc[i - 2]
        c2 = df.iloc[i - 1]
        c3 = df.iloc[i]
        
        # Bullish FVG
        if c3['low'] > c1['high'] and c2['close'] > c2['open']:
            fvgs.append({
                "type": "BULLISH_FVG",
                "top": round(float(c3['low']), 2),
                "bottom": round(float(c1['high']), 2),
                "desc": f"Bullish Imbalance FVG ({round(float(c1['high']), 2)} - {round(float(c3['low']), 2)})"
            })
            
        # Bearish FVG
        if c1['low'] > c3['high'] and c2['close'] < c2['open']:
            fvgs.append({
                "type": "BEARISH_FVG",
                "top": round(float(c1['low']), 2),
                "bottom": round(float(c3['high']), 2),
                "desc": f"Bearish Imbalance FVG ({round(float(c3['high']), 2)} - {round(float(c1['low']), 2)})"
            })
            
    # Order Blocks
    for i in range(max(0, n - 25), n - 3):
        c = df.iloc[i]
        next3 = df.iloc[i + 1:i + 4]
        if c['close'] < c['open'] and (next3['close'] > c['high']).all():
            order_blocks.append({
                "type": "BULLISH_OB",
                "priceTop": round(float(c['high']), 2),
                "priceBottom": round(float(c['low']), 2),
                "desc": f"Bullish OB ({round(float(c['low']), 2)} - {round(float(c['high']), 2)})"
            })
        elif c['close'] > c['open'] and (next3['close'] < c['low']).all():
            order_blocks.append({
                "type": "BEARISH_OB",
                "priceTop": round(float(c['high']), 2),
                "priceBottom": round(float(c['low']), 2),
                "desc": f"Bearish OB ({round(float(c['low']), 2)} - {round(float(c['high']), 2)})"
            })
            
    # Liquidity Sweeps
    recent_20 = df.iloc[-25:-1]
    recent_high = recent_20['high'].max()
    recent_low = recent_20['low'].min()
    last = df.iloc[-1]
    
    if last['high'] > recent_high and last['close'] < recent_high:
        sweeps.append({
            "type": "BUY_SIDE_LIQUIDITY_SWEEP",
            "level": round(float(recent_high), 2),
            "desc": f"Buy-Side Liquidity Raid at {round(float(recent_high), 2)}"
        })
    elif last['low'] < recent_low and last['close'] > recent_low:
        sweeps.append({
            "type": "SELL_SIDE_LIQUIDITY_SWEEP",
            "level": round(float(recent_low), 2),
            "desc": f"Sell-Side Liquidity Raid at {round(float(recent_low), 2)}"
        })
        
    # Structure
    highs = df['high'].rolling(5, center=True).max()
    lows = df['low'].rolling(5, center=True).min()
    recent_sh = df['high'][df['high'] == highs].dropna().tail(2)
    recent_sl = df['low'][df['low'] == lows].dropna().tail(2)
    
    if len(recent_sh) >= 2 and len(recent_sl) >= 2:
        if recent_sh.iloc[-1] > recent_sh.iloc[-2] and recent_sl.iloc[-1] > recent_sl.iloc[-2]:
            structure = "BULLISH (BOS Uptrend)"
        elif recent_sh.iloc[-1] < recent_sh.iloc[-2] and recent_sl.iloc[-1] < recent_sl.iloc[-2]:
            structure = "BEARISH (BOS Downtrend)"
            
    return {
        "orderBlocks": order_blocks[-2:],
        "fvgs": fvgs[-2:],
        "sweeps": sweeps[-1:],
        "structure": structure
    }

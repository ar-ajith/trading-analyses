"""
Machine Learning & Quantitative Signal Prediction Model
Combines Scikit-Learn Ensemble ML with Technical Indicator Confluence Scoring.
"""

import time
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from typing import Dict, Any, List, Optional
from indicators import (
    calculate_ema, calculate_sma, calculate_rsi,
    calculate_macd, calculate_bollinger_bands,
    calculate_atr, calculate_support_resistance,
    detect_candlestick_patterns, detect_smart_money_concepts
)

class TradeLifecycleManager:
    """
    Stateful Trade Lifecycle & Noise Filter
    Prevents 1-minute whipsaws, locks in entry, stop loss, and targets,
    and manages trade states (HOLDING, TP1_HIT, TP2_HIT, SL_HIT).
    """
    def __init__(self):
        self.active_trades: Dict[str, Dict[str, Any]] = {}

    def get_trade_key(self, symbol: str, timeframe: str) -> str:
        clean_sym = symbol.strip().upper().replace(".NS", "").replace(".BO", "").replace("^", "")
        return f"{clean_sym}_{timeframe.lower()}"

    def get_active_trade(self, symbol: str, timeframe: str) -> Optional[Dict[str, Any]]:
        key = self.get_trade_key(symbol, timeframe)
        trade = self.active_trades.get(key)
        if trade:
            # Expire trades older than 4 hours for 1m, or 24 hours for others
            max_age = 14400 if timeframe in ['1m', '5m'] else 86400
            if time.time() - trade.get('start_time', 0) > max_age:
                del self.active_trades[key]
                return None
        return trade

    def register_or_update(
        self,
        symbol: str,
        timeframe: str,
        current_price: float,
        raw_signal: str,
        raw_trend: str,
        confidence: int,
        buffer: float,
        smc: Dict[str, Any]
    ) -> Dict[str, Any]:
        key = self.get_trade_key(symbol, timeframe)
        trade = self.get_active_trade(symbol, timeframe)

        # CASE 1: No active trade exists yet
        if not trade:
            min_conf = 63 if timeframe in ['1m', '5m'] else 60
            if raw_signal in ['BUY', 'SELL'] and confidence >= min_conf:
                direction = raw_signal
                entry_price = round(current_price, 2)
                risk_buf = max(buffer, entry_price * 0.005)
                
                if direction == 'BUY':
                    stop_loss = round(entry_price - risk_buf, 2)
                    risk = max(0.01, entry_price - stop_loss)
                    target1 = round(entry_price + (risk * 1.5), 2)
                    target2 = round(entry_price + (risk * 2.5), 2)
                    target3 = round(entry_price + (risk * 4.0), 2)
                else:
                    stop_loss = round(entry_price + risk_buf, 2)
                    risk = max(0.01, stop_loss - entry_price)
                    target1 = round(entry_price - (risk * 1.5), 2)
                    target2 = round(entry_price - (risk * 2.5), 2)
                    target3 = round(entry_price - (risk * 4.0), 2)

                trade = {
                    "symbol": symbol,
                    "timeframe": timeframe,
                    "direction": direction,
                    "status": "ACTIVE_HOLD",
                    "entry_price": entry_price,
                    "initial_stop_loss": stop_loss,
                    "stop_loss": stop_loss,
                    "target1": target1,
                    "target2": target2,
                    "target3": target3,
                    "start_time": time.time(),
                    "tp1_hit": False,
                    "tp2_hit": False,
                    "trailing_active": False,
                    "highest_price": current_price,
                    "lowest_price": current_price
                }
                self.active_trades[key] = trade
                
                return {
                    "signal": direction,
                    "trend": raw_trend,
                    "status": "ACTIVE_ENTERED",
                    "entry_price": entry_price,
                    "stop_loss": stop_loss,
                    "target1": target1,
                    "target2": target2,
                    "target3": target3,
                    "pnl_pct": 0.0,
                    "lifecycle_msg": f"New {direction} trade initiated at {entry_price}. SL: {stop_loss}, TP1: {target1}."
                }
            else:
                buf = max(buffer, current_price * 0.005)
                return {
                    "signal": "WAIT",
                    "trend": raw_trend,
                    "status": "AWAITING_SETUP",
                    "entry_price": round(current_price, 2),
                    "stop_loss": round(current_price - buf, 2),
                    "target1": round(current_price + (buf * 1.5), 2),
                    "target2": round(current_price + (buf * 2.5), 2),
                    "target3": round(current_price + (buf * 4.0), 2),
                    "pnl_pct": 0.0,
                    "lifecycle_msg": "Awaiting institutional confluence before entering."
                }

        # CASE 2: Active Trade ALREADY Exists! Protect against whipsaw & manage lifecycle
        direction = trade["direction"]
        entry_price = trade["entry_price"]
        stop_loss = trade["stop_loss"]
        target1 = trade["target1"]
        target2 = trade["target2"]
        target3 = trade["target3"]

        trade["highest_price"] = max(trade.get("highest_price", current_price), current_price)
        trade["lowest_price"] = min(trade.get("lowest_price", current_price), current_price)

        pnl_pct = round(((current_price - entry_price) / entry_price) * 100, 2) if direction == 'BUY' else round(((entry_price - current_price) / entry_price) * 100, 2)

        # Check for Structural Invalidation (only on major opposite trend >= 80% + CHoCH)
        is_hard_reversal = (
            (direction == 'BUY' and raw_signal == 'SELL' and confidence >= 80 and 'BEARISH' in smc.get('structure', '')) or
            (direction == 'SELL' and raw_signal == 'BUY' and confidence >= 80 and 'BULLISH' in smc.get('structure', ''))
        )

        if is_hard_reversal:
            del self.active_trades[key]
            return {
                "signal": "REVERSAL_EXIT",
                "trend": raw_trend,
                "status": "REVERSED",
                "entry_price": round(current_price, 2),
                "stop_loss": round(current_price - buffer, 2) if raw_signal == 'BUY' else round(current_price + buffer, 2),
                "target1": round(current_price + buffer * 1.5, 2) if raw_signal == 'BUY' else round(current_price - buffer * 1.5, 2),
                "target2": round(current_price + buffer * 2.5, 2),
                "target3": round(current_price + buffer * 4.0, 2),
                "pnl_pct": pnl_pct,
                "lifecycle_msg": f"Structural trend invalidation detected. Closed previous {direction} position at {current_price}."
            }

        # Check BUY trade lifecycle
        if direction == 'BUY':
            if current_price <= stop_loss:
                del self.active_trades[key]
                return {
                    "signal": "SL HIT (EXIT)",
                    "trend": "BEARISH BREAKDOWN",
                    "status": "STOPPED_OUT",
                    "entry_price": entry_price,
                    "stop_loss": stop_loss,
                    "target1": target1,
                    "target2": target2,
                    "target3": target3,
                    "pnl_pct": pnl_pct,
                    "lifecycle_msg": f"Stop Loss reached at {stop_loss} ({pnl_pct}%). Trade closed. Capital protected."
                }

            if current_price >= target2:
                trade["tp2_hit"] = True
                trade["stop_loss"] = target1
                return {
                    "signal": "BUY (TP2 HIT)",
                    "trend": "STRONG BULLISH EXPANSION",
                    "status": "TP2_HIT",
                    "entry_price": entry_price,
                    "stop_loss": target1,
                    "target1": target1,
                    "target2": target2,
                    "target3": target3,
                    "pnl_pct": pnl_pct,
                    "lifecycle_msg": f"🎯 Target 2 reached at {target2} (+{pnl_pct}%)! Stop Loss trailed to {target1} to secure profit."
                }

            if current_price >= target1:
                trade["tp1_hit"] = True
                trade["trailing_active"] = True
                trade["stop_loss"] = entry_price
                return {
                    "signal": "BUY (TP1 HIT)",
                    "trend": "BULLISH RUNNER",
                    "status": "TP1_HIT",
                    "entry_price": entry_price,
                    "stop_loss": entry_price,
                    "target1": target1,
                    "target2": target2,
                    "target3": target3,
                    "pnl_pct": pnl_pct,
                    "lifecycle_msg": f"🎯 Target 1 hit at {target1} (+{pnl_pct}%)! SL moved to Breakeven ({entry_price}). Risk-free trade active."
                }

            # Normal Pullback / Fluctuation within active trade
            # Do NOT flip to SELL!
            status_desc = "HEALTHY PULLBACK" if current_price < entry_price else "IN PROFIT"
            signal_label = "BUY (HOLDING)" if current_price < entry_price else "BUY (ACTIVE)"
            
            return {
                "signal": signal_label,
                "trend": f"BULLISH ({status_desc})",
                "status": "ACTIVE_HOLD",
                "entry_price": entry_price,
                "stop_loss": trade["stop_loss"],
                "target1": target1,
                "target2": target2,
                "target3": target3,
                "pnl_pct": pnl_pct,
                "lifecycle_msg": f"Holding BUY position entered at {entry_price}. Price at {current_price} ({'+' if pnl_pct>=0 else ''}{pnl_pct}%). Protected above SL {trade['stop_loss']}."
            }

        # Check SELL trade lifecycle (Short)
        else:
            if current_price >= stop_loss:
                del self.active_trades[key]
                return {
                    "signal": "SL HIT (EXIT)",
                    "trend": "BULLISH BREAKOUT",
                    "status": "STOPPED_OUT",
                    "entry_price": entry_price,
                    "stop_loss": stop_loss,
                    "target1": target1,
                    "target2": target2,
                    "target3": target3,
                    "pnl_pct": pnl_pct,
                    "lifecycle_msg": f"Stop Loss reached at {stop_loss} ({pnl_pct}%). Short closed. Capital protected."
                }

            if current_price <= target2:
                trade["tp2_hit"] = True
                trade["stop_loss"] = target1
                return {
                    "signal": "SELL (TP2 HIT)",
                    "trend": "STRONG BEARISH EXPANSION",
                    "status": "TP2_HIT",
                    "entry_price": entry_price,
                    "stop_loss": target1,
                    "target1": target1,
                    "target2": target2,
                    "target3": target3,
                    "pnl_pct": pnl_pct,
                    "lifecycle_msg": f"🎯 Target 2 reached at {target2} (+{pnl_pct}%)! Stop Loss trailed to {target1} to secure profit."
                }

            if current_price <= target1:
                trade["tp1_hit"] = True
                trade["trailing_active"] = True
                trade["stop_loss"] = entry_price
                return {
                    "signal": "SELL (TP1 HIT)",
                    "trend": "BEARISH RUNNER",
                    "status": "TP1_HIT",
                    "entry_price": entry_price,
                    "stop_loss": entry_price,
                    "target1": target1,
                    "target2": target2,
                    "target3": target3,
                    "pnl_pct": pnl_pct,
                    "lifecycle_msg": f"🎯 Target 1 hit at {target1} (+{pnl_pct}%)! SL moved to Breakeven ({entry_price}). Risk-free trade active."
                }

            status_desc = "RELIEF BOUNCE" if current_price > entry_price else "IN PROFIT"
            signal_label = "SELL (HOLDING)" if current_price > entry_price else "SELL (ACTIVE)"
            
            return {
                "signal": signal_label,
                "trend": f"BEARISH ({status_desc})",
                "status": "ACTIVE_HOLD",
                "entry_price": entry_price,
                "stop_loss": trade["stop_loss"],
                "target1": target1,
                "target2": target2,
                "target3": target3,
                "pnl_pct": pnl_pct,
                "lifecycle_msg": f"Holding SELL position entered at {entry_price}. Price at {current_price} ({'+' if pnl_pct>=0 else ''}{pnl_pct}%). Protected below SL {trade['stop_loss']}."
            }

class TradingPredictorML:
    def __init__(self):
        self.model = RandomForestClassifier(n_estimators=60, max_depth=5, random_state=42)
        self.is_trained = False
        self.lifecycle_mgr = TradeLifecycleManager()
        
    def extract_features(self, df: pd.DataFrame) -> pd.DataFrame:
        close = df['close']
        volume = df['volume']
        
        ema9 = calculate_ema(close, 9)
        ema21 = calculate_ema(close, 21)
        ema50 = calculate_ema(close, 50)
        rsi = calculate_rsi(close, 14)
        macd = calculate_macd(close)
        bb = calculate_bollinger_bands(close, 20, 2)
        vol_sma20 = calculate_sma(volume, 20)
        
        feat = pd.DataFrame(index=df.index)
        feat['ema_spread'] = (ema9 - ema21) / close
        feat['price_vs_ema50'] = (close - ema50) / close
        feat['rsi'] = rsi / 100.0
        feat['macd_hist'] = macd['histogram'] / close
        feat['bb_pos'] = (close - bb['lower']) / (bb['upper'] - bb['lower']).replace(0, np.nan)
        feat['vol_ratio'] = volume / vol_sma20.replace(0, np.nan)
        
        return feat.fillna(0)

    def train_baseline(self, df: pd.DataFrame):
        if len(df) < 50:
            return
        
        feat = self.extract_features(df)
        # Target: 1 if close in 3 bars > current close, else 0
        target = (df['close'].shift(-3) > df['close']).astype(int)
        
        # Drop last 3 rows since target is unknown
        X = feat.iloc[:-3]
        y = target.iloc[:-3]
        
        if len(X) > 30 and len(np.unique(y)) > 1:
            self.model.fit(X, y)
            self.is_trained = True

    def analyze(self, df: pd.DataFrame, symbol: str = "BTCUSDT", timeframe: str = "15m", macro_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if len(df) < 10:
            return {"error": "Insufficient candle data for analysis"}
            
        close = df['close']
        volume = df['volume']
        current_price = float(close.iloc[-1])
        
        # Calculate Technical Indicators
        ema9 = calculate_ema(close, 9)
        ema21 = calculate_ema(close, 21)
        ema50 = calculate_ema(close, 50)
        rsi_series = calculate_rsi(close, 14)
        macd = calculate_macd(close)
        bb = calculate_bollinger_bands(close, 20, 2)
        atr_series = calculate_atr(df, 14)
        sr = calculate_support_resistance(df)
        patterns = detect_candlestick_patterns(df)
        
        cur_ema9 = float(ema9.iloc[-1])
        cur_ema21 = float(ema21.iloc[-1])
        cur_ema50 = float(ema50.iloc[-1]) if not pd.isna(ema50.iloc[-1]) else cur_ema21
        cur_rsi = round(float(rsi_series.iloc[-1]), 2)
        cur_macd = round(float(macd['macd'].iloc[-1]), 4)
        cur_signal = round(float(macd['signal'].iloc[-1]), 4)
        cur_hist = round(float(macd['histogram'].iloc[-1]), 4)
        prev_hist = round(float(macd['histogram'].iloc[-2]), 4)
        cur_atr = float(atr_series.iloc[-1]) if not pd.isna(atr_series.iloc[-1]) else current_price * 0.015
        
        vol_sma20 = calculate_sma(volume, 20)
        avg_vol = float(vol_sma20.iloc[-1]) if not pd.isna(vol_sma20.iloc[-1]) and vol_sma20.iloc[-1] > 0 else float(volume.iloc[-1])
        vol_ratio = round(float(volume.iloc[-1] / avg_vol), 2)
        
        # Quantitative Multi-factor Scoring
        bullish_score = 0
        bearish_score = 0
        reasons = []
        
        # Trend check (EMA 9 vs EMA 21)
        if cur_ema9 > cur_ema21:
            bullish_score += 20
            reasons.append("EMA 9 is trading above EMA 21 (Short-term uptrend)")
        else:
            bearish_score += 20
            reasons.append("EMA 9 is trading below EMA 21 (Short-term downtrend)")
            
        if current_price > cur_ema50:
            bullish_score += 10
            reasons.append("Price is positioned above 50 EMA baseline")
        else:
            bearish_score += 10
            reasons.append("Price is positioned below 50 EMA baseline")
            
        # RSI momentum
        if cur_rsi > 50 and cur_rsi <= 70:
            bullish_score += 15
            reasons.append(f"RSI is at {cur_rsi} showing solid bullish momentum")
        elif cur_rsi < 30:
            bullish_score += 20
            reasons.append(f"RSI is oversold at {cur_rsi} (Reversal accumulation)")
        elif cur_rsi >= 30 and cur_rsi <= 50:
            bearish_score += 15
            reasons.append(f"RSI is at {cur_rsi} showing bearish momentum")
        elif cur_rsi > 70:
            bearish_score += 20
            reasons.append(f"RSI is overbought at {cur_rsi} (Distribution / pullback risk)")
            
        # MACD momentum
        if cur_macd > cur_signal and cur_hist > 0:
            bullish_score += 20
            if cur_hist > prev_hist:
                bullish_score += 5
                reasons.append("MACD histogram is positive and expanding upward")
            else:
                reasons.append("MACD is positive in bullish territory")
        elif cur_macd < cur_signal and cur_hist < 0:
            bearish_score += 20
            if cur_hist < prev_hist:
                bearish_score += 5
                reasons.append("MACD histogram is negative and expanding downward")
            else:
                reasons.append("MACD is negative in bearish territory")
                
        # Volume surge
        if vol_ratio > 1.25:
            last_candle = df.iloc[-1]
            if last_candle['close'] > last_candle['open']:
                bullish_score += 15
                reasons.append(f"Volume surge ({vol_ratio}x 20-SMA) on bullish bar")
            else:
                bearish_score += 15
                reasons.append(f"Volume surge ({vol_ratio}x 20-SMA) on selling bar")
                
        # Candlestick patterns
        for p in patterns:
            if p['bias'] == 'BULLISH':
                bullish_score += 10
                reasons.append(f"Detected {p['name']} pattern ({p['desc']})")
            elif p['bias'] == 'BEARISH':
                bearish_score += 10
                reasons.append(f"Detected {p['name']} pattern ({p['desc']})")

        # Train and infer ML model probability
        self.train_baseline(df)
        ml_bullish_prob = 0.5
        if self.is_trained:
            try:
                latest_features = self.extract_features(df).iloc[[-1]]
                probs = self.model.predict_proba(latest_features)[0]
                ml_bullish_prob = float(probs[1]) if len(probs) > 1 else 0.5
            except Exception:
                ml_bullish_prob = 0.5

        # Blended Probability (60% Indicator Score + 40% ML Probability)
        total_score = max(1, bullish_score + bearish_score)
        indicator_bullish_prob = bullish_score / total_score
        
        final_bullish = (0.60 * indicator_bullish_prob) + (0.40 * ml_bullish_prob)
        bullish_pct = int(np.clip(round(final_bullish * 100), 5, 95))
        bearish_pct = 100 - bullish_pct
        
        # Determine Signal & Trend
        if bullish_pct >= 65:
            signal = "BUY"
            trend = "BULLISH"
            confidence = bullish_pct
        elif bearish_pct >= 65:
            signal = "SELL"
            trend = "BEARISH"
            confidence = bearish_pct
        else:
            signal = "WAIT"
            trend = "MILDLY BULLISH" if bullish_pct > 52 else ("MILDLY BEARISH" if bearish_pct > 52 else "NEUTRAL")
            confidence = max(bullish_pct, bearish_pct)
            
        # 1-minute Consistent Hysteresis & Stateful Trade Lifecycle
        buffer = max(cur_atr * 1.2, current_price * 0.005)
        smc = detect_smart_money_concepts(df)
        sentiment_score = int(np.clip((bullish_pct - 50) * 2, -100, 100))

        trade_state = self.lifecycle_mgr.register_or_update(
            symbol=symbol,
            timeframe=timeframe,
            current_price=current_price,
            raw_signal=signal,
            raw_trend=trend,
            confidence=confidence,
            buffer=buffer,
            smc=smc
        )

        final_signal = trade_state["signal"]
        final_trend = trade_state["trend"]
        entry_price = trade_state["entry_price"]
        stop_loss = trade_state["stop_loss"]
        target1 = trade_state["target1"]
        target2 = trade_state["target2"]
        target3 = trade_state["target3"]
        pnl_pct = trade_state["pnl_pct"]
        lifecycle_msg = trade_state["lifecycle_msg"]

        voice_text = f"AI Alert for {symbol}: {final_signal} with {confidence} percent confidence. Entry at {entry_price}, Stop Loss at {stop_loss}, Target at {target1}."
            
        # 1-Year Macro data incorporation
        macro_info = macro_data or {
            "high52W": 0.0, "low52W": 0.0, "sma200": 0.0, "sma50": 0.0,
            "return1Y": "Live", "bias": "MARKET STRUCTURE", "distFrom52WHigh": "--", "goldenCross": "Active"
        }

        # Live Candle Tips
        last_c = df.iloc[-1]
        c_body = abs(last_c['close'] - last_c['open'])
        c_range = max(0.01, last_c['high'] - last_c['low'])
        c_upper = last_c['high'] - max(last_c['open'], last_c['close'])
        c_lower = min(last_c['open'], last_c['close']) - last_c['low']

        if "HOLDING" in final_signal or "ACTIVE" in final_signal or "HIT" in final_signal:
            candle_name = "Active Position Tracking"
            candle_sit = f"Price at {round(current_price, 2)} ({'+' if pnl_pct >= 0 else ''}{pnl_pct}% from entry {entry_price})."
            tactical_tip = lifecycle_msg
        elif last_c['close'] >= last_c['open'] and c_upper < c_body * 0.2:
            candle_name = "Bullish Expansion Bar"
            candle_sit = f"Strong buyer push from {last_c['open']} to {last_c['close']}. Dominant volume."
            tactical_tip = f"Wait for slight pullback towards {round(current_price - buffer*0.5, 2)} before entering. Do not chase high wicks."
        elif last_c['close'] < last_c['open'] and c_lower < c_body * 0.2:
            candle_name = "Bearish Selling Bar"
            candle_sit = f"Aggressive selling from {last_c['open']} down to {last_c['close']}."
            tactical_tip = f"Look for relief bounce towards {round(current_price + buffer*0.5, 2)} for short entry."
        else:
            candle_name = "Consolidation Bar"
            candle_sit = f"Price balancing between {last_c['low']} and {last_c['high']}."
            tactical_tip = f"Wait for clean breakout above {target1} or support test at {stop_loss}."

        candle_tips = {
            "candlePatternName": candle_name,
            "situation": candle_sit,
            "tacticalTip": tactical_tip,
            "stopLossTip": f"Protective Stop Loss active at {stop_loss}",
            "previousYearEdge": f"Macro 1-Year Trend is {macro_info.get('bias', 'Active')}. 200-SMA: {macro_info.get('sma200', '--')}"
        }

        return {
            "timestamp": int(df['timestamp'].iloc[-1]) if 'timestamp' in df else int(pd.Timestamp.now().timestamp() * 1000),
            "symbol": symbol,
            "timeframe": timeframe,
            "currentPrice": round(current_price, 2),
            "signal": final_signal,
            "trend": final_trend,
            "tradeStatus": trade_state["status"],
            "pnlPercent": pnl_pct,
            "confidence": confidence,
            "bullishProbability": bullish_pct,
            "bearishProbability": bearish_pct,
            "sentimentScore": sentiment_score,
            "entryPrice": entry_price,
            "stopLoss": stop_loss,
            "target1": target1,
            "target2": target2,
            "target3": target3,
            "riskRewardRatio": "1:1.5 (T1) · 1:2.5 (T2) · 1:4.0 (T3)",
            "supportLevels": [sr["s1"], sr["s2"]],
            "resistanceLevels": [sr["r1"], sr["r2"]],
            "pivot": sr["pivot"],
            "macro1Year": macro_info,
            "candleTips": candle_tips,
            "indicators": {
                "rsi": cur_rsi,
                "macd": cur_macd,
                "macdSignal": cur_signal,
                "macdHistogram": cur_hist,
                "ema9": round(cur_ema9, 2),
                "ema21": round(cur_ema21, 2),
                "ema50": round(cur_ema50, 2),
                "volumeRatio": vol_ratio,
                "atr": round(cur_atr, 2)
            },
            "smc": smc,
            "reasons": reasons[:5],
            "patterns": [f"{p['name']} ({p['bias']})" for p in patterns],
            "voiceText": voice_text
        }

predictor = TradingPredictorML()


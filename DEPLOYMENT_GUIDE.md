# 🚀 Free Deployment Guide: AI Trading Chart Assistant

Deploy the entire AI Trading Chart Assistant system **100% FREE** with **zero hosting costs**.

---

## 🏗 System Architecture Overview

| Component | Technology | Free Hosting Solution | Cost |
| :--- | :--- | :--- | :--- |
| **Browser Extension** | Chrome Manifest V3 | Runs directly in Chrome / Edge / Brave | **$0 / Free Forever** |
| **Live Market Feeds** | Direct Exchange Feeds | Yahoo Finance API + Binance REST | **$0 / Free Forever** |
| **Python AI / ML Backend** | FastAPI + Scikit-Learn | **Render.com** or **Hugging Face Spaces** | **$0 / Free Tier** |

> [!TIP]
> **Serverless Option (No Cloud Server Needed)**:  
> The extension has a built-in direct exchange client (`LiveMarketData.js`). It can run **100% serverless** directly in your browser without needing to deploy or maintain any cloud backend! If you do want the Python ML Random Forest model hosted in the cloud, follow the 5-minute Render guide below.

---

## ⚡ Method 1: Deploy Python AI Backend on Render.com (Recommended)

[Render.com](https://render.com) offers a **free web service tier** with free automatic SSL (HTTPS).

### Step 1: Push your project to GitHub
1. Open PowerShell in your project folder (`c:\Users\AJITH\Trading chart`):
   ```powershell
   git init
   git add .
   git commit -m "Deploy AI Trading Assistant"
   ```
2. Create a new repository on [github.com](https://github.com/new) (can be Public or Private).
3. Push your code to GitHub:
   ```powershell
   git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO>.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Create Free Web Service on Render
1. Sign up / Log in to [dashboard.render.com](https://dashboard.render.com).
2. Click **New +** &rarr; **Web Service**.
3. Select **Build and deploy from a Git repository** and connect your GitHub repo.
4. Fill in the deployment settings:
   - **Name**: `ai-trading-backend` (or your choice)
   - **Region**: `Singapore` (closest to India / lowest latency)
   - **Branch**: `main`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `uvicorn main:app --app-dir backend --host 0.0.0.0 --port $PORT`
   - **Instance Type**: **Free** ($0.00/mo)
5. Click **Deploy Web Service**!

Render will build and deploy your FastAPI backend in about 2 minutes. You will receive your live cloud HTTPS URL:
`https://ai-trading-backend.onrender.com`

---

## ⚡ Method 2: Deploy on Hugging Face Spaces (24/7 Free Uptime)

Hugging Face Spaces provides 100% free CPU hosting with Docker:

1. Sign up at [huggingface.co](https://huggingface.co).
2. Click your profile icon &rarr; **New Space**.
3. Space Name: `ai-trading-chart-backend`.
4. License: `MIT` / `Apache 2.0`.
5. Select Space SDK: **Docker** &rarr; **Blank**.
6. Select Hardware: **CPU Basic · Free**.
7. Push your repository to the Hugging Face Space git remote or upload files using the web interface.
8. Your Space builds automatically using the included `Dockerfile` and gives you a 24/7 live URL:
   `https://<username>-ai-trading-chart-backend.hf.space`

---

## 🔌 Connecting your Free Cloud URL to the Chrome Extension

Once your backend is deployed:

1. Open your browser with the extension loaded.
2. Press `F12` on any page or on Upstox, go to the **Console** tab, and enter:
   ```javascript
   localStorage.setItem('tvai_cloud_backend', 'https://your-app-name.onrender.com');
   ```
3. Refresh the tab. The extension header badge will now show:
   `🟢 AI Cloud` / `🟢 Connected: AI Backend`
4. If the cloud server ever sleeps or goes offline, the extension **automatically falls back to direct exchange live feeds**, ensuring 100% uninterrupted trading analysis!

---

## 📦 How to Pack & Share the Chrome Extension

You can share your extension with anyone for free without paying Google developer fees:

1. In Chrome, go to `chrome://extensions`.
2. Enable **Developer mode** in the top-right corner.
3. Click **Pack extension**:
   - **Extension root directory**: Browse to `c:\Users\AJITH\Trading chart\extension`
   - Leave private key blank (first time)
4. Chrome creates:
   - `extension.crx` (Installable extension package)
   - `extension.pem` (Your private signing key)
5. Anyone can install this extension by dragging `extension.crx` into Chrome, or by extracting the folder and clicking **Load unpacked**!


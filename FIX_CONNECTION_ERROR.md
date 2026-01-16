# 🔧 URGENT: Update Backend URL

## The Problem
Your frontend (GitHub Pages) is trying to connect to `http://localhost:5000/api`, which only works on your local computer. It needs your Render backend URL instead!

## ✅ Quick Fix (5 minutes)

### Step 1: Get Your Render URL
1. Go to https://dashboard.render.com
2. Click on your `dart-backend` service
3. Look for the URL at the top (something like):
   ```
   https://dart-backend-xxxx.onrender.com
   ```
4. **Copy this URL**

### Step 2: Check if Backend is Live
- In your Render dashboard, check the status
- Should show: ✅ **"Live"** with green dot
- If it says "Build failed" or "Deploying":
  - Click **"Logs"** tab
  - Look for errors
  - Make sure it shows: `Your service is live`

### Step 3: Test Your Backend URL
Open this URL in your browser (replace with YOUR URL):
```
https://dart-backend-xxxx.onrender.com/api/health
```

Should return:
```json
{"status": "healthy"}
```

If this works ✅, proceed to Step 4!
If this fails ❌, check Render logs for errors.

### Step 4: Update config.js

**CRITICAL**: You need to update `config.js` with your Render URL!

Open `config.js` and change line 15 from:
```javascript
BACKEND_URL: 'http://localhost:5000/api',
```

To (use YOUR Render URL):
```javascript
BACKEND_URL: 'https://dart-backend-xxxx.onrender.com/api',
```

**IMPORTANT**: 
- Use `https://` (not http)
- Add `/api` at the end
- No trailing slash

### Step 5: Commit and Push
```bash
git add config.js backend.py
git commit -m "Update backend URL for production deployment"
git push origin main
```

### Step 6: Wait for GitHub Pages
- GitHub Pages auto-deploys (1-2 minutes)
- Visit your site: https://guruprasathm7.github.io/DART
- Connection error should be GONE! ✅

## 🔍 Troubleshooting

### "Service is not live" on Render
**Check Render Logs:**
1. Go to your service on Render
2. Click "Logs" tab
3. Look for errors

**Common Issues:**
- Build still running (wait 3-5 minutes)
- Build failed (check Python version, dependencies)
- Port binding error (fixed in latest commit)

### Backend URL returns 404
Make sure you're using the correct format:
```
https://YOUR-APP-NAME.onrender.com/api/health
```

### Still getting connection error
1. **Check config.js was updated** (view source on GitHub Pages)
2. **Clear browser cache** (Ctrl+F5 or Cmd+Shift+R)
3. **Check browser console** for actual URL being called
4. **Verify Render service is "Live"**

## 📝 What to Send Me

If still not working, send me:
1. ✅ Your Render backend URL
2. ✅ Status in Render dashboard (Live/Failed/Deploying)
3. ✅ Last few lines from Render logs
4. ✅ Any errors in browser console (F12)

## ⚡ Alternative: Use Render's Auto-Deploy

If you want Render to auto-update when you push to GitHub:
1. In Render dashboard → Your service
2. Click "Settings"
3. Under "Build & Deploy"
4. Enable "Auto-Deploy: Yes"
5. Now every push to GitHub auto-deploys both frontend and backend!

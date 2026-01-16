# ✅ Backend Deployment - Quick Checklist

Your DART app is ready for cloud deployment! Follow these steps:

## 📦 What's Been Prepared

✅ `requirements.txt` - Updated with gunicorn
✅ `Procfile` - Tells cloud platforms how to run your app
✅ `render.yaml` - Configuration for Render.com
✅ `config.js` - Frontend configuration (already exists)
✅ `RENDER_DEPLOYMENT.md` - Complete deployment guide

## 🚀 Quick Deployment Steps

### Option 1: Render.com (Recommended - FREE)

1. **Sign up**: https://render.com (use GitHub login)
2. **New Web Service** → Connect `guruprasathM7/DART` repo
3. **Settings**:
   - Build: `pip install -r requirements.txt`
   - Start: `gunicorn backend:app`
   - Free tier
4. **Copy URL** (e.g., `https://dart-backend-xxxx.onrender.com`)
5. **Update config.js**:
   ```javascript
   BACKEND_URL: 'https://dart-backend-xxxx.onrender.com/api'
   ```
6. **Commit & Push** to GitHub
7. **Done!** GitHub Pages auto-deploys

⏱️ **Time**: 10 minutes
💰 **Cost**: FREE (with cold starts)
📖 **Full Guide**: See `RENDER_DEPLOYMENT.md`

### Option 2: Railway.app (Alternative - FREE)

1. **Sign up**: https://railway.app
2. **New Project** → **Deploy from GitHub**
3. **Select** `guruprasathM7/DART` repo
4. **Environment Variables**: None needed
5. **Deploy** → Copy URL
6. **Update config.js** and push

### Option 3: Heroku (Paid - $7/month)

1. Install Heroku CLI
2. `heroku create dart-backend`
3. `git push heroku main`
4. Update config.js with Heroku URL

## ⚡ After Deployment

### Test Your Backend
Visit: `https://your-backend-url.onrender.com/api/health`
Should return: `{"status": "healthy"}`

### Update Frontend
```javascript
// config.js
const CONFIG = {
    BACKEND_URL: 'https://your-backend-url.onrender.com/api'
};
```

### Git Commands
```bash
git add config.js
git commit -m "Configure production backend URL"
git push origin main
```

## ⚠️ Important Notes

### Free Tier (Render/Railway)
- ✅ **Pros**: Completely free
- ⚠️ **Cons**: 30-60 second cold start after 15 min inactivity
- 💡 **Solution**: First request wakes it up, subsequent requests are instant

### Paid Tier ($7/month)
- ✅ Always on
- ✅ No cold starts
- ✅ Better for production

## 🔍 Troubleshooting

**Connection Failed?**
1. Check Render logs for errors
2. Verify `config.js` has correct URL + `/api`
3. Ensure backend shows "Live" status
4. Test health endpoint directly

**CORS Errors?**
- Already configured in backend.py
- Check browser console for details

**Build Failed?**
- Check Python version (3.11 recommended)
- Verify all dependencies in requirements.txt

## 📱 Your Current Setup

- **Frontend**: GitHub Pages → https://guruprasathm7.github.io/DART
- **Backend**: Need to deploy (choose option above)
- **Files Ready**: ✅ All deployment files created

## 🎯 Next: Choose Your Platform

Pick one deployment option above and follow the steps!
Most users choose **Render.com** for the free tier.

Read `RENDER_DEPLOYMENT.md` for detailed instructions.

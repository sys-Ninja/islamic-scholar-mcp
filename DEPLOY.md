# 🚀 نشر Islamic Scholar MCP

## 📋 الخطوات:

### 1️⃣ **Railway (موصى به)**

#### أ. من GitHub:
```bash
# 1. ارفع على GitHub
git init
git add .
git commit -m "Islamic Scholar MCP"
git remote add origin https://github.com/YOUR_USERNAME/islamic-scholar-mcp.git
git push -u origin main

# 2. روح https://railway.app
# 3. New Project → Deploy from GitHub
# 4. اختار الـ repo
```

#### ب. Environment Variables على Railway:
```
AI_PROVIDER=deepseek
AI_API_KEY=sk-xxxxxxxxxxxxx
AI_MODEL=deepseek-chat
```

#### ج. الرابط النهائي:
```
https://islamic-scholar-mcp-production.up.railway.app
```

---

### 2️⃣ **Render.com**

#### أ. من GitHub:
```bash
# 1. ارفع على GitHub (نفس الخطوات فوق)

# 2. روح https://render.com
# 3. New + → Web Service
# 4. Connect GitHub repo
```

#### ب. Settings:
```
Build Command: npm install
Start Command: npm start

Environment Variables:
AI_PROVIDER=deepseek
AI_API_KEY=sk-xxxxxxxxxxxxx
AI_MODEL=deepseek-chat
```

#### ج. الرابط النهائي:
```
https://islamic-scholar-mcp.onrender.com
```

---

## 🔗 استخدام الرابط في mcp.json:

### **الطريقة الجديدة (HTTP MCP):**

```json
{
  "mcpServers": {
    "islamic-scholar": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/client-http",
        "https://islamic-scholar-mcp-production.up.railway.app"
      ],
      "env": {
        "AI_PROVIDER": "deepseek",
        "AI_MODEL": "deepseek-chat"
      },
      "disabled": false,
      "autoApprove": [
        "search_islamweb_fatwas",
        "fetch_islamweb_fatwa",
        "search_dorar_hadiths",
        "fetch_dorar_page",
        "search_islamic_multi",
        "fetch_islamic_page",
        "search_quran_tafsir",
        "write_research_step",
        "read_research_file",
        "clear_research_file",
        "fetch_any_url"
      ]
    }
  }
}
```

---

## 🎯 اختبار API:

### 1. **Health Check:**
```bash
curl https://your-app.railway.app/health
```

### 2. **سؤال شرعي:**
```bash
curl -X POST https://your-app.railway.app/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"ما حكم الصلاة في البيت؟"}'
```

### 3. **Response:**
```json
{
  "success": true,
  "question": "ما حكم الصلاة في البيت؟",
  "answer": "بناءً على المصادر...",
  "sources": [...],
  "aiUsed": true,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

---

## 🔑 الحصول على API Keys:

### **DeepSeek:**
1. روح https://platform.deepseek.com
2. Sign up
3. API Keys → Create new key
4. انسخ الـ key: `sk-xxxxxxxxxxxxx`

### **Google Gemini:**
1. روح https://aistudio.google.com/apikey
2. Create API key
3. انسخ الـ key

---

## 💰 التكلفة:

| **الخدمة** | **المجاني** | **التكلفة** |
|------------|-------------|-------------|
| **Railway** | $5 credit/شهر | كافي لـ 10K requests |
| **Render** | 750 ساعة/شهر | مجاني تمامًا |
| **DeepSeek API** | - | $0.14/مليون token |
| **Gemini API** | 15 req/min | $0.125/مليون token |

**إجمالي:** ~$5-10/شهر لـ 10,000 مستخدم

---

## ✅ الخلاصة:

1. ✅ ارفع على Railway/Render
2. ✅ حط API Key في Environment Variables
3. ✅ خذ الرابط النهائي
4. ✅ استخدمه في mcp.json أو في تطبيقك

# 🕌 Islamic Scholar API

## 🚀 التشغيل المحلي:

```bash
npm install
npm start
```

السيرفر هيشتغل على: `http://localhost:3000`

---

## 📡 API Endpoints:

### 1. **السؤال الشامل** (موصى به)
```bash
POST /api/ask
Content-Type: application/json

{
  "question": "ما حكم الصلاة في البيت؟",
  "limit": 6
}
```

**Response:**
```json
{
  "success": true,
  "question": "ما حكم الصلاة في البيت؟",
  "answer": "📚 إسلام ويب — ...",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

---

### 2. **بحث في إسلام ويب**
```bash
POST /api/search/islamweb
Content-Type: application/json

{
  "query": "الزكاة",
  "limit": 5
}
```

---

### 3. **بحث في الدرر السنية**
```bash
POST /api/search/dorar
Content-Type: application/json

{
  "query": "الصيام",
  "limit": 5
}
```

---

### 4. **جلب فتوى من رابط**
```bash
POST /api/fatwa
Content-Type: application/json

{
  "url": "https://islamweb.net/ar/fatwa/12345"
}
```

---

### 5. **Health Check**
```bash
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "mcp": "running",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

---

## 🌐 النشر على Railway:

### الطريقة 1: من GitHub

1. ارفع الكود على GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/islamic-scholar-api.git
git push -u origin main
```

2. روح https://railway.app
3. اضغط **"New Project"**
4. اختار **"Deploy from GitHub repo"**
5. اختار الـ repo
6. Railway هيكتشف `package.json` ويشغل `npm start` تلقائياً

### الطريقة 2: من CLI

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

---

## 🌐 النشر على Render.com:

1. روح https://render.com
2. اضغط **"New +"** → **"Web Service"**
3. اربط GitHub repo
4. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. اضغط **"Create Web Service"**

---

## 🔗 استخدام API مع DeepSeek/Google AI:

### مثال مع DeepSeek:

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'YOUR_DEEPSEEK_API_KEY',
  baseURL: 'https://api.deepseek.com'
});

async function askIslamic(question) {
  // 1. جلب المصادر من API
  const response = await fetch('https://your-api.railway.app/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question })
  });
  
  const data = await response.json();
  const sources = data.answer;
  
  // 2. إرسال للـ AI مع المصادر
  const completion = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: 'أنت عالم إسلامي. أجب بناءً على المصادر المرفقة فقط.'
      },
      {
        role: 'user',
        content: `السؤال: ${question}\n\nالمصادر:\n${sources}`
      }
    ]
  });
  
  return completion.choices[0].message.content;
}

// الاستخدام
const answer = await askIslamic('ما حكم الصلاة في البيت؟');
console.log(answer);
```

---

### مثال مع Google AI (Gemini):

```javascript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI('YOUR_GOOGLE_API_KEY');

async function askIslamic(question) {
  // 1. جلب المصادر
  const response = await fetch('https://your-api.railway.app/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question })
  });
  
  const data = await response.json();
  const sources = data.answer;
  
  // 2. إرسال لـ Gemini
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
  
  const prompt = `أنت عالم إسلامي. أجب بناءً على المصادر التالية فقط:

السؤال: ${question}

المصادر:
${sources}

الإجابة:`;
  
  const result = await model.generateContent(prompt);
  return result.response.text();
}

// الاستخدام
const answer = await askIslamic('ما حكم الصلاة في البيت؟');
console.log(answer);
```

---

## 📱 مثال تطبيق Android (Kotlin):

```kotlin
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class IslamicAPI {
    private val client = OkHttpClient()
    private val baseUrl = "https://your-api.railway.app"
    
    suspend fun ask(question: String): String {
        val json = JSONObject().apply {
            put("question", question)
            put("limit", 6)
        }
        
        val body = json.toString()
            .toRequestBody("application/json".toMediaType())
        
        val request = Request.Builder()
            .url("$baseUrl/api/ask")
            .post(body)
            .build()
        
        val response = client.newCall(request).execute()
        val responseData = JSONObject(response.body?.string() ?: "{}")
        
        return responseData.getString("answer")
    }
}

// الاستخدام
val api = IslamicAPI()
val answer = api.ask("ما حكم الصلاة في البيت؟")
println(answer)
```

---

## 🎯 الخلاصة:

1. ✅ **API جاهز** - شغله بـ `npm start`
2. ✅ **انشره على Railway/Render** - مجاني
3. ✅ **استخدمه مع DeepSeek/Gemini** - للإجابات الذكية
4. ✅ **اعمل تطبيق Android/ويب** - يكلم الـ API

---

## 💰 التكلفة:

- **Railway:** $5 credit مجاني شهريًا
- **Render:** 750 ساعة مجانية شهريًا
- **DeepSeek API:** $0.14 لكل مليون token
- **Google Gemini:** $0.125 لكل مليون token

**إجمالي:** ~$5-10/شهر لـ 10,000 مستخدم

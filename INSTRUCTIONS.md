# 🚀 تعليمات التشغيل الكاملة

## 📋 المحتويات

1. [التشغيل السريع](#التشغيل-السريع)
2. [الحصول على DeepSeek API Key](#الحصول-على-deepseek-api-key)
3. [تشغيل الموقع محلياً](#تشغيل-الموقع-محلياً)
4. [مشاركة الموقع عالمياً](#مشاركة-الموقع-عالمياً)
5. [استكشاف الأخطاء](#استكشاف-الأخطاء)

---

## 🎯 التشغيل السريع

```bash
# 1. ثبت المكتبات (إذا لم تكن مثبتة)
npm install

# 2. ضع DeepSeek API Key في .env
nano .env

# 3. شغّل الموقع
npm start

# 4. افتح المتصفح
# http://localhost:3000
```

---

## 🔑 الحصول على DeepSeek API Key

### الخطوة 1: التسجيل

1. افتح: https://platform.deepseek.com/
2. اضغط **Sign Up** أو **Register**
3. سجل بالإيميل أو Google/GitHub
4. فعّل الحساب من الإيميل

### الخطوة 2: إنشاء API Key

1. بعد تسجيل الدخول، اذهب إلى **API Keys**
2. اضغط **Create API Key**
3. اختر اسم للـ Key (مثل: "Islamic Scholar")
4. اضغط **Create**
5. **انسخ الـ Key فوراً!** (لن تستطيع رؤيته مرة أخرى)

### الخطوة 3: وضع الـ Key في .env

```bash
# افتح ملف .env
nano .env

# ابحث عن السطر:
AI_API_KEY=your_deepseek_api_key_here

# غيّره إلى:
AI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# احفظ: Ctrl+O ثم Enter ثم Ctrl+X
```

---

## 💻 تشغيل الموقع محلياً

### الطريقة 1: npm start

```bash
npm start
```

### الطريقة 2: استخدام START.sh

```bash
./START.sh
```

### الطريقة 3: node مباشرة

```bash
node server.js
```

---

## 🌍 مشاركة الموقع عالمياً

### الطريقة 1: localtunnel (الأسهل - بدون تسجيل)

```bash
# Terminal 1: شغل السيرفر
npm start

# Terminal 2: شغل localtunnel
npm install -g localtunnel
lt --port 3000
```

**النتيجة:**
```
your url is: https://funny-cat-123.loca.lt
```

**شارك هذا الرابط مع أي حد!**

---

### الطريقة 2: ngrok (احترافي)

```bash
# 1. ثبت ngrok
sudo snap install ngrok

# 2. سجل على ngrok.com واحصل على token
# https://dashboard.ngrok.com/get-started/your-authtoken

# 3. أضف الـ token
ngrok config add-authtoken YOUR_TOKEN_HERE

# 4. Terminal 1: شغل السيرفر
npm start

# 5. Terminal 2: شغل ngrok
ngrok http 3000
```

**النتيجة:**
```
Forwarding: https://abc123.ngrok.io -> http://localhost:3000
```

---

### الطريقة 3: Cloudflare Tunnel (للمحترفين)

```bash
# 1. ثبت cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# 2. Terminal 1: شغل السيرفر
npm start

# 3. Terminal 2: شغل cloudflared
cloudflared tunnel --url http://localhost:3000
```

---

### الطريقة 4: على الشبكة المحلية فقط (WiFi)

```bash
# 1. اعرف IP جهازك
hostname -I | awk '{print $1}'

# مثال: 192.168.1.100

# 2. شغل السيرفر
npm start

# 3. شارك الرابط:
# http://192.168.1.100:3000
```

⚠️ **ملاحظة:** الأجهزة لازم تكون على نفس الـ WiFi

---

## 🐛 استكشاف الأخطاء

### خطأ 1: "AI_API_KEY not configured"

**السبب:** الـ API Key غير موجود أو خاطئ

**الحل:**
```bash
# تأكد من ملف .env
cat .env | grep AI_API_KEY

# يجب أن يكون:
AI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# إذا كان:
AI_API_KEY=your_deepseek_api_key_here

# غيّره:
nano .env
```

---

### خطأ 2: "MCP Client غير متصل"

**السبب:** MCP Server لم يبدأ بشكل صحيح

**الحل:**
```bash
# أعد تشغيل السيرفر
npm start

# إذا استمرت المشكلة، تأكد من المكتبات:
npm install
```

---

### خطأ 3: "Port 3000 already in use"

**السبب:** البورت 3000 مستخدم من برنامج آخر

**الحل:**
```bash
# الطريقة 1: غيّر البورت
echo "PORT=3001" >> .env
npm start

# الطريقة 2: أوقف البرنامج الآخر
lsof -ti:3000 | xargs kill -9
```

---

### خطأ 4: "Failed to launch Chrome"

**السبب:** Puppeteer لا يجد Chrome/Chromium

**الحل:**
```bash
# الطريقة 1: ثبت Chromium
sudo apt-get update
sudo apt-get install chromium-browser

# الطريقة 2: تخطى Puppeteer (مؤقتاً)
PUPPETEER_SKIP_DOWNLOAD=true npm install

# الطريقة 3: حدد مسار Chrome
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
npm start
```

---

### خطأ 5: "Cannot find module 'dotenv'"

**السبب:** مكتبة dotenv غير مثبتة

**الحل:**
```bash
npm install dotenv
```

---

### خطأ 6: "ECONNREFUSED" أو "403 Forbidden"

**السبب:** الموقع المستهدف يحجب الطلبات

**الحل:**
- ✅ Puppeteer Stealth يحل هذه المشكلة تلقائياً
- ✅ إذا استمرت، جرب VPN

---

### خطأ 7: "DeepSeek API rate limit"

**السبب:** تجاوزت حد الطلبات

**الحل:**
```bash
# انتظر دقيقة وأعد المحاولة
# أو ارفع حد الطلبات من لوحة DeepSeek
```

---

## 📊 مراقبة الاستخدام

### عرض Logs

```bash
# شغل السيرفر مع logs مفصلة
npm start

# ستشاهد:
# 📝 Question with MCP: ما حكم الصلاة في البيت؟
# 🔧 استخدام Puppeteer للتجاوز...
# ✅ تم الانتهاء
```

### مراقبة استهلاك DeepSeek

1. افتح: https://platform.deepseek.com/usage
2. شاهد عدد الـ tokens المستخدمة
3. راقب التكلفة

---

## 💰 التكلفة المتوقعة

| الاستخدام | Tokens | التكلفة |
|-----------|--------|---------|
| **سؤال بسيط** | ~5,000 | $0.0007 |
| **سؤال معقد** | ~20,000 | $0.0028 |
| **100 سؤال/يوم** | ~1M | $0.14 |
| **متوسط شهري** | ~10M | **$1.40** |

---

## 🎯 نصائح للأداء الأفضل

### 1. استخدم Caching

```javascript
// في server.js، أضف:
const cache = new Map();

app.post('/api/ask-with-tools', async (req, res) => {
  const { question } = req.body;
  
  // تحقق من الـ cache
  if (cache.has(question)) {
    return res.json(cache.get(question));
  }
  
  // ... باقي الكود
  
  // احفظ في الـ cache
  cache.set(question, result);
});
```

### 2. حدد عدد الأدوات

```javascript
// في system-prompt.md، أضف:
// استخدم 3-5 أدوات فقط لكل سؤال
```

### 3. استخدم Rate Limiting

```bash
npm install express-rate-limit
```

---

## 📚 ملفات مساعدة

- **ابدأ_هنا.md** - تعليمات بالعربي
- **QUICKSTART.md** - تشغيل سريع
- **WEB_SETUP.md** - إعداد مفصل
- **SHARE_GLOBALLY.md** - طرق المشاركة
- **README_WEB.md** - توثيق كامل

---

## 🎉 جاهز!

```bash
# شغّل الموقع
npm start

# افتح المتصفح
http://localhost:3000

# استمتع! 🚀
```

---

**صُنع بـ ❤️ للمسلمين في كل مكان**

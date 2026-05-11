# 🌐 تشغيل الموقع - Islamic Scholar Web UI

## 🚀 خطوات التشغيل السريع

### 1️⃣ تثبيت المكتبات

```bash
cd /home/abdo/Desktop/ludo/islamic-scholar-mcp
npm install
```

### 2️⃣ إعداد DeepSeek API Key

1. سجل على: https://platform.deepseek.com/
2. اذهب إلى **API Keys**
3. انشئ key جديد
4. افتح ملف `.env` وضع الـ key:

```bash
nano .env
```

غيّر السطر:
```
AI_API_KEY=your_deepseek_api_key_here
```

إلى:
```
AI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
```

احفظ بـ `Ctrl+O` ثم `Enter` ثم `Ctrl+X`

### 3️⃣ تشغيل السيرفر

```bash
npm start
```

سيظهر:
```
╔══════════════════════════════════════════╗
║  Islamic Scholar MCP Server              ║
║  Running on: http://localhost:3000       ║
║  AI Provider: deepseek                   ║
║  Model: deepseek-chat                    ║
╚══════════════════════════════════════════╝
✅ MCP Client connected with 11 tools
```

### 4️⃣ افتح الموقع

افتح المتصفح على:
```
http://localhost:3000
```

---

## 🌍 جعل الموقع متاح للجميع (على الشبكة المحلية)

### الطريقة 1: استخدام ngrok (الأسهل)

```bash
# 1. ثبت ngrok
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok

# 2. سجل على ngrok.com واحصل على token
ngrok config add-authtoken YOUR_TOKEN

# 3. شغل ngrok
ngrok http 3000
```

سيعطيك رابط مثل:
```
https://abc123.ngrok.io
```

شارك هذا الرابط مع أي حد!

---

### الطريقة 2: استخدام localtunnel (مجاني بدون تسجيل)

```bash
# 1. ثبت localtunnel
npm install -g localtunnel

# 2. شغله
lt --port 3000
```

سيعطيك رابط مثل:
```
https://funny-cat-123.loca.lt
```

---

### الطريقة 3: على الشبكة المحلية فقط

```bash
# 1. اعرف IP جهازك
ip addr show | grep "inet " | grep -v 127.0.0.1

# مثال: 192.168.1.100

# 2. شارك الرابط:
http://192.168.1.100:3000
```

⚠️ **ملاحظة:** الأجهزة لازم تكون على نفس الشبكة (WiFi)

---

## 🔧 استكشاف الأخطاء

### خطأ: "AI_API_KEY not configured"

✅ **الحل:** تأكد من ملف `.env` وأن الـ key صحيح

### خطأ: "MCP Client غير متصل"

✅ **الحل:** 
```bash
# تأكد من تثبيت المكتبات
npm install

# أعد تشغيل السيرفر
npm start
```

### خطأ: "Failed to launch Chrome"

✅ **الحل:**
```bash
# ثبت Chromium
sudo apt-get install chromium-browser

# أو تخطى Puppeteer مؤقتاً
PUPPETEER_SKIP_DOWNLOAD=true npm install
```

---

## 📊 الميزات

✅ **UI حديث وجميل**
✅ **عرض الأدوات المستخدمة live**
✅ **إحصائيات (عدد الأدوات + المصادر)**
✅ **Streaming للنتائج**
✅ **دعم DeepSeek AI**
✅ **11 أداة بحث إسلامية**

---

## 💰 التكلفة

- **DeepSeek API:** $0.14 لكل مليون token (رخيص جداً!)
- **ngrok Free:** مجاني (محدود)
- **localtunnel:** مجاني 100%

**متوسط التكلفة:** $1-3/شهر فقط!

---

## 🎯 أمثلة أسئلة

- ما حكم الصلاة في البيت؟
- حكم زكاة الذهب
- تفسير آية الكرسي
- حكم صيام يوم الجمعة منفرداً
- ما صحة حديث "من صلى الفجر في جماعة"؟

---

## 📞 الدعم

إذا واجهت مشكلة، تواصل معي!

---

**صُنع بـ ❤️ للمسلمين في كل مكان**

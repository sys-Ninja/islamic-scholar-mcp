#!/bin/bash

# ═══════════════════════════════════════════════════════════════
#  Islamic Scholar Web - Quick Start Script
# ═══════════════════════════════════════════════════════════════

echo "╔══════════════════════════════════════════════════════╗"
echo "║       🕌 الشيخ الرقمي - Islamic Scholar Web         ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  ملف .env غير موجود!"
    echo "📝 جاري إنشاء ملف .env من .env.example..."
    cp .env.example .env
    echo ""
    echo "✅ تم إنشاء ملف .env"
    echo "⚠️  من فضلك افتح ملف .env وضع DeepSeek API Key"
    echo ""
    echo "   nano .env"
    echo ""
    exit 1
fi

# Check if AI_API_KEY is set
if grep -q "your_deepseek_api_key_here" .env; then
    echo "⚠️  DeepSeek API Key غير مُعرّف!"
    echo ""
    echo "📝 الخطوات:"
    echo "   1. سجل على: https://platform.deepseek.com/"
    echo "   2. احصل على API Key"
    echo "   3. افتح ملف .env وضع الـ key:"
    echo ""
    echo "      nano .env"
    echo ""
    exit 1
fi

echo "✅ جاري تشغيل السيرفر..."
echo ""

# Start server
npm start

/**
 * ═══════════════════════════════════════════════════════════
 *  مثال عملي: الشيخ الرقمي - ربط MCP Server مع Anthropic API
 *  example-app.js
 * ═══════════════════════════════════════════════════════════
 *
 *  شغّله هكذا:
 *  ANTHROPIC_API_KEY=sk-... node example-app.js
 */

import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Colors for CLI output ───────────────────────────────────
const C = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

function log(icon, color, msg) {
  console.log(`${color}${icon} ${msg}${C.reset}`);
}

// ─── Load System Prompt ───────────────────────────────────────
const systemPrompt = fs.readFileSync(
  path.join(__dirname, 'prompts', 'system-prompt.md'),
  'utf-8'
);

// ─── Connect to MCP Server ────────────────────────────────────
async function connectMCP() {
  log('🔌', C.cyan, 'جاري الاتصال بـ MCP Server...');

  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.join(__dirname, 'src', 'index.js')],
  });

  const client = new Client({ name: 'islamic-scholar-app', version: '1.0.0' });
  await client.connect(transport);

  log('✅', C.green, 'تم الاتصال بـ Islamic Scholar MCP Server');
  return client;
}

// ─── Convert MCP tools → Anthropic format ────────────────────
function convertTools(mcpTools) {
  return mcpTools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
}

// ─── Scholar Agent Loop ───────────────────────────────────────
async function askScholar(anthropic, mcpClient, anthropicTools, question) {
  console.log();
  log('📿', C.magenta, `السؤال: "${question}"`);
  log('⏳', C.yellow, 'جاري البحث في المصادر الإسلامية...\n');

  const messages = [{ role: 'user', content: question }];
  let stepCount = 0;

  // Agent loop
  while (true) {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',    // أو أي موديل تفضله
      max_tokens: 8000,
      system: systemPrompt,
      tools: anthropicTools,
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });

    // Completed
    if (response.stop_reason === 'end_turn') {
      const finalText = response.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
      return finalText;
    }

    // Execute tools
    const toolUses = response.content.filter((b) => b.type === 'tool_use');
    if (toolUses.length === 0) {
      // No more tools, extract text
      const finalText = response.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
      return finalText || 'لم يتم إنتاج إجابة';
    }

    const toolResults = [];

    for (const toolUse of toolUses) {
      stepCount++;
      const stepEmoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'][stepCount - 1] || `${stepCount}.`;
      log(stepEmoji, C.blue, `تنفيذ: ${toolUse.name}`);

      // Show arguments (truncated)
      const argsStr = JSON.stringify(toolUse.input);
      log('  📥', C.dim, argsStr.slice(0, 100) + (argsStr.length > 100 ? '...' : ''));

      try {
        const result = await mcpClient.callTool({
          name: toolUse.name,
          arguments: toolUse.input,
        });

        const resultText = result.content[0]?.text || '';
        log('  📤', C.dim, resultText.slice(0, 150).replace(/\n/g, ' ') + '...');

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: resultText,
        });
      } catch (err) {
        log('  ❌', C.yellow, `فشل: ${err.message}`);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: `خطأ: ${err.message}`,
          is_error: true,
        });
      }
    }

    messages.push({ role: 'user', content: toolResults });
  }
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌ يجب تعيين ANTHROPIC_API_KEY كـ environment variable');
    console.error('   مثال: ANTHROPIC_API_KEY=sk-ant-... node example-app.js');
    process.exit(1);
  }

  console.log(`${C.bold}${C.green}`);
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║         🕌 الشيخ الرقمي - Islamic Scholar AI     ║');
  console.log('║     بيبحث في إسلام ويب + الدرر السنية + يجاوب  ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(C.reset);

  // Connect MCP
  const mcpClient = await connectMCP();
  const { tools: mcpTools } = await mcpClient.listTools();
  const anthropicTools = convertTools(mcpTools);
  log('🛠️', C.cyan, `${anthropicTools.length} أداة متاحة`);

  // Create Anthropic client
  const anthropic = new Anthropic({ apiKey });

  // Interactive CLI
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = () => {
    console.log();
    rl.question(`${C.bold}${C.cyan}❓ اكتب سؤالك الديني (أو 'خروج' للإنهاء):\n> ${C.reset}`, async (input) => {
      const question = input.trim();
      if (!question || question === 'خروج' || question === 'exit' || question === 'quit') {
        log('👋', C.green, 'إلى اللقاء! السلام عليكم');
        rl.close();
        process.exit(0);
      }

      try {
        const answer = await askScholar(anthropic, mcpClient, anthropicTools, question);
        console.log();
        console.log(`${C.bold}${C.green}═══════════════════════════════════════════════════`);
        console.log('📿 الإجابة:');
        console.log('═══════════════════════════════════════════════════');
        console.log(C.reset + answer);
        console.log(`${C.green}═══════════════════════════════════════════════════${C.reset}`);
      } catch (err) {
        log('❌', C.yellow, `خطأ: ${err.message}`);
      }

      askQuestion();
    });
  };

  askQuestion();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

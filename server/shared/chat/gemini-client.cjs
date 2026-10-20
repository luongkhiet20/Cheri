const { SYSTEM_INSTRUCTION, MODEL_ANSWER_SCHEMA } = require('./chat-policy.cjs');

function chatError(code) {
  const error = new Error(code === 'CHAT_TIMEOUT' ? 'Chat request timed out' : 'Chat provider unavailable');
  error.code = code;
  return error;
}

function createGeminiClient({ env = process.env, loadSdk = () => import('@google/genai'), timeoutMs = 20000 } = {}) {
  let sdkPromise;
  return {
    async generate(request, context) {
      const apiKey = env.GEMINI_API_KEY;
      const model = env.GEMINI_MODEL;
      if (typeof apiKey !== 'string' || !apiKey.trim() || typeof model !== 'string' || !model.trim()) {
        throw chatError('CHAT_UNAVAILABLE');
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      timer.unref?.();
      try {
        sdkPromise ??= Promise.resolve().then(loadSdk);
        const { GoogleGenAI } = await sdkPromise;
        const ai = new GoogleGenAI({ apiKey });
        const contents = request.history.map((entry) => ({
          role: entry.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: entry.text }],
        }));
        contents.push({ role: 'user', parts: [{ text: request.message }] });
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseJsonSchema: MODEL_ANSWER_SCHEMA,
            maxOutputTokens: 1024,
            httpOptions: { timeout: timeoutMs, retryOptions: { attempts: 1 } },
            abortSignal: controller.signal,
          },
        });
        if (controller.signal.aborted) throw chatError('CHAT_TIMEOUT');
        const text = response?.text;
        if (typeof text !== 'string' || !text.trim()) {
          return { status: 'unknown', mode: 'general', reply: '', productIds: [], policyIds: [] };
        }
        try {
          return JSON.parse(text);
        } catch {
          return { status: 'unknown', mode: 'general', reply: '', productIds: [], policyIds: [] };
        }
      } catch (error) {
        if (controller.signal.aborted || error?.name === 'AbortError' || error?.name === 'TimeoutError') {
          throw chatError('CHAT_TIMEOUT');
        }
        throw chatError('CHAT_UNAVAILABLE');
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

module.exports = { createGeminiClient };

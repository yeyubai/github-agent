// LangChain 模型配置 — 通过 OpenAI 兼容接口调用 DeepSeek
import { ChatOpenAI } from "@langchain/openai";

export const model = new ChatOpenAI({
  model: "deepseek-reasoner",
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: "https://api.deepseek.com/v1",
  },
  temperature: 0.7,
  maxTokens: 4096,
  streaming: true,
});

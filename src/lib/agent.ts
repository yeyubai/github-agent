// LangGraph Agent — 带工具确认机制
import { StateGraph, MessagesAnnotation, MemorySaver } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import { interrupt } from "@langchain/langgraph";
import { model } from "./langchain-model";
import { allTools } from "./tools/github-tools";

const toolNode = new ToolNode(allTools);
const checkpointer = new MemorySaver();

const graph = new StateGraph(MessagesAnnotation) as any;

// 节点：模型调用
graph.addNode("agent", async (state: any) => {
  const response = await model.bindTools(allTools).invoke(state.messages);
  return { messages: [response] };
});

// 节点：工具执行（带 interrupt 确认）
graph.addNode("tools", async (state: any) => {
  const lastMsg = state.messages[state.messages.length - 1];
  if (!(lastMsg instanceof AIMessage) || !lastMsg.tool_calls?.length) {
    return { messages: [] };
  }

  // 对每个 tool_call 请求用户确认
  for (const tc of lastMsg.tool_calls) {
    const confirmed = interrupt({
      type: "tool_call",
      tool: tc.name,
      args: tc.args,
      toolCallId: tc.id,
    });

    if (!confirmed) {
      // 用户取消，返回 ToolMessage 标记取消
      return {
        messages: [
          new ToolMessage({
            content: "用户取消了该操作。",
            tool_call_id: tc.id || "",
            name: tc.name || "",
          }),
        ],
      };
    }
  }

  // 用户确认，执行工具
  return toolNode.invoke(state);
});

// 路由逻辑
graph.addEdge("tools", "agent");
graph.addConditionalEdges("agent", (state: any) => {
  const last = state.messages[state.messages.length - 1];
  if (last instanceof AIMessage && last.tool_calls?.length) {
    return "tools";
  }
  return "__end__";
});
graph.setEntryPoint("agent");

export const agent = graph.compile({ checkpointer });

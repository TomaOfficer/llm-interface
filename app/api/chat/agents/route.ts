import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, StreamingTextResponse } from "ai";

import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { SerpAPI } from "langchain/tools";
import { Calculator } from "langchain/tools/calculator";
import { DynamicTool } from "langchain/tools";
import { write_engagement_letter } from "../tools/write-engagement-letter-tool";
import { calculate_fees } from "../tools/fee-calculator";
import { AIMessage, ChatMessage, HumanMessage } from "langchain/schema";
import { BufferMemory, ChatMessageHistory } from "langchain/memory";

export const runtime = "edge";

const convertVercelMessageToLangChainMessage = (message: VercelChatMessage) => {
  if (message.role === "user") {
    return new HumanMessage(message.content);
  } else if (message.role === "assistant") {
    return new AIMessage(message.content);
  } else {
    return new ChatMessage(message.content, message.role);
  }
};

const PREFIX_TEMPLATE = `You are an expert in the United States legal system. Provide advice and answers within the scope of U.S. law, but make it clear that this guidance is not a substitute for professional legal advice.`;

/**
 * This handler initializes and calls an OpenAI Functions agent.
 * See the docs for more information:
 *
 * https://js.langchain.com/docs/modules/agents/agent_types/openai_functions_agent
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    /**
     * We represent intermediate steps as system messages for display purposes,
     * but don't want them in the chat history.
     */
    const messages = (body.messages ?? []).filter(
      (message: VercelChatMessage) =>
        message.role === "user" || message.role === "assistant",
    );
    const returnIntermediateSteps = body.show_intermediate_steps;
    const previousMessages = messages
      .slice(0, -1)
      .map(convertVercelMessageToLangChainMessage);
    const currentMessageContent = messages[messages.length - 1].content;

    // Requires process.env.SERPAPI_API_KEY to be set: https://serpapi.com/
    console.log("Initializing tools...");
    const tools = [
      new Calculator(), 
      new SerpAPI(),
      new DynamicTool({
        name: "FOO",
        description: "call this to get the value of foo. input should be an empty string.",
        func: async () => "baz",
      }),
      new DynamicTool({
        name: "BAR",
        description: "call this to get the value of bar. input should be an empty string.",
        func: async () => "baz1",
      }),
      new DynamicTool({
        name: "EngagementLetter",
        description: "Call this to generate an engagement letter.",
        func: write_engagement_letter,
      }),
      new DynamicTool({
        name: "FeeCalculator",
        description: "Call this to calculate legal issues for the user's law firm.",
        func: calculate_fees,
      })
    ];
    console.log("Tools initialized: ", tools.map(tool => tool.constructor.name));

    const chat = new ChatOpenAI({ modelName: "gpt-4", temperature: 0 });
    console.log("Chat model initialized: ", chat.constructor.name);

    /**
     * The default prompt for the OpenAI functions agent has a placeholder
     * where chat messages get injected - that's why we set "memoryKey" to
     * "chat_history". This will be made clearer and more customizable in the future.
     */
    const executor = await initializeAgentExecutorWithOptions(tools, chat, {
      agentType: "openai-functions",
      verbose: true,
      returnIntermediateSteps,
      memory: new BufferMemory({
        memoryKey: "chat_history",
        chatHistory: new ChatMessageHistory(previousMessages),
        returnMessages: true,
        outputKey: "output",
      }),
      agentArgs: {
        prefix: PREFIX_TEMPLATE,
      },
    });

    const result = await executor.call({
      input: currentMessageContent,
    });

    // Intermediate steps are too complex to stream
    if (returnIntermediateSteps) {
      return NextResponse.json(
        { output: result.output, intermediate_steps: result.intermediateSteps },
        { status: 200 },
      );
    } else {
      /**
       * Agent executors don't support streaming responses (yet!), so stream back the
       * complete response one character at a time with a delay to simluate it.
       */
      const textEncoder = new TextEncoder();
      const fakeStream = new ReadableStream({
        async start(controller) {
          for (const character of result.output) {
            controller.enqueue(textEncoder.encode(character));
            await new Promise((resolve) => setTimeout(resolve, 20));
          }
          controller.close();
        },
      });

      return new StreamingTextResponse(fakeStream);
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
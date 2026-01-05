import { openai } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";
import { getTracer, Laminar } from "@lmnr-ai/lmnr";

import { SYSTEM_PROMPT } from "./system/prompt.ts";
import { tools } from "./tools/index.ts";
import { filterCompatibleMessages } from "./system/filterMessages.ts";
import type { AgentCallbacks } from "../types.ts";

const MODEL_NAME = "gpt-5-mini";

Laminar.initialize({
	projectApiKey: process.env.LMNR_PROJECT_API_KEY,
});

export const runAgent = async (
	userMessage: string,
	conversationHistory: ModelMessage[],
	callbacks: AgentCallbacks,
) => {
	const workingHistory = filterCompatibleMessages(conversationHistory);

	const messages: ModelMessage[] = [
		{ role: "system", content: SYSTEM_PROMPT },
		...workingHistory,
		{ role: "user", content: userMessage },
	];

	let fullResponse = "";

	while (true) {
		const result = streamText({
			model: openai(MODEL_NAME),
			messages,
			tools,
			experimental_telemetry: {
				isEnabled: true,
				tracer: getTracer(),
			},
		});

		let currentText = "";
		let streamError: Error | null = null;

		try {
			for await (const chunk of result.fullStream) {
				if (chunk.type === "text-delta") {
					currentText += chunk.text;

					// UI Callback to show streaming text
					callbacks.onToken(chunk.text);
				}

				if (chunk.type === "tool-call") {
					const input = "input" in chunk ? chunk.input : {};
					// UI Callback to show tool call start
					callbacks.onToolCallStart(chunk.toolName, input);
				}

				if (chunk.type === "tool-result") {
					// SDK executed the tool, notify UI with the result
					// The chunk has an 'output' property in AI SDK v6
					const output = "output" in chunk ? chunk.output : chunk;
					const resultValue =
						typeof output === "string" ? output : JSON.stringify(output);

					// UI Callback to show tool call end
					callbacks.onToolCallEnd(chunk.toolName, resultValue);
				}
			}
		} catch (error) {
			streamError = error as Error;

			// If we have some text, continue processing
			// Otherwise, rethrow if it's not a "no output" error from the sdk
			if (
				!currentText &&
				!streamError.message.includes("No output generated")
			) {
				throw streamError;
			}
		}

		fullResponse += currentText;

		// If stream errored with "no output" and we have no text, try to recover
		if (streamError && !currentText) {
			fullResponse =
				"I apologize, but I wasn't able to generate a response. Could you please try rephrasing your message?";

			// UI Callback to show fallback response
			callbacks.onToken(fullResponse);
			break;
		}

		const finishReason = await result.finishReason;

		// SDK handles tool execution - responseMessages includes both
		// assistant messages (with tool-call) and tool messages (with results)
		const responseMessages = await result.response;
		messages.push(...responseMessages.messages);

		if (finishReason !== "tool-calls") {
			break;
		}
	}

	// UI Callback to show complete response
	callbacks.onComplete(fullResponse);

	// Return messages without the system prompt - it's always added fresh on each call
	// This prevents system prompt duplication when messages are passed back as conversationHistory
	return messages.filter((msg) => msg.role !== "system");
};

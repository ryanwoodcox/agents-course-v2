import {
	generateText,
	stepCountIs,
	tool,
	type ModelMessage,
	type ToolSet,
} from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

import type {
	EvalData,
	SingleTurnResult,
	MultiTurnEvalData,
	MultiTurnResult,
} from "./types.ts";
import { buildMessages, buildMockedTools } from "./utils.ts";
import { SYSTEM_PROMPT } from "../src/agent/system/prompt.ts";

/**
 * Tool definitions for mocked single-turn evaluations.
 * These define the schema the LLM sees without real implementations.
 */
const TOOL_DEFINITIONS: Record<
	string,
	{ description: string; parameters: z.ZodObject<z.ZodRawShape> }
> = {
	// File tools
	readFile: {
		description: "Read the contents of a file at the specified path",
		parameters: z.object({
			path: z.string().describe("The path to the file to read"),
		}),
	},
	writeFile: {
		description: "Write content to a file at the specified path",
		parameters: z.object({
			path: z.string().describe("The path to the file to write"),
			content: z.string().describe("The content to write to the file"),
		}),
	},
	listFiles: {
		description: "List all files in a directory",
		parameters: z.object({
			path: z.string().describe("The directory path to list files from"),
		}),
	},
	deleteFile: {
		description: "Delete a file at the specified path",
		parameters: z.object({
			path: z.string().describe("The path to the file to delete"),
		}),
	},
	// Shell tools
	runCommand: {
		description: "Execute a shell command and return its output",
		parameters: z.object({
			command: z.string().describe("The shell command to execute"),
		}),
	},
};

/**
 * Single-turn executor with mocked tools.
 * Uses predefined tool definitions - tools never execute, only selection is tested.
 */
export const singleTurnWithMocks = async (data: EvalData) => {
	const messages = buildMessages(data);
	const tools: ToolSet = {};

	for (const toolName of data.tools) {
		const def = TOOL_DEFINITIONS[toolName];

		if (def) {
			tools[toolName] = tool({
				description: def.description,
				inputSchema: z.object(def.parameters),
			});
		}
	}

	const { toolCalls } = await generateText({
		model: openai(data.config?.model || "gpt-5-mini"),
		messages,
		tools,
		stopWhen: stepCountIs(1),
		temperature: data.config?.temperature || undefined,
	});

	const calls = toolCalls.map((call) => ({
		toolName: call.toolName,
		args: "args" in call ? call.args : {},
	}));

	const toolNames = calls.map((call) => call.toolName);

	return {
		toolCalls: calls,
		toolNames,
		selectedAny: toolNames.length > 0,
	};
};

/**
 * Multi-turn executor with mocked tools.
 * Runs a complete agent loop with tools returning fixed values.
 */
export const multiTurnWithMocks = async (data: MultiTurnEvalData) => {
	const tools = buildMockedTools(data.mockTools);

	const messages: ModelMessage[] = data.messages ?? [
		{ role: "system", content: SYSTEM_PROMPT },
		{ role: "user", content: data.prompt! },
	];

	const result = await generateText({
		model: openai(data.config?.model ?? "gpt-5-mini"),
		messages,
		tools,
		stopWhen: stepCountIs(data.config?.maxSteps ?? 20),
	});

	const allToolCalls: string[] = [];

	const steps = result.steps.map((step) => {
		const stepToolCalls = (step.toolCalls ?? []).map((tc) => {
			allToolCalls.push(tc.toolName);

			return {
				toolName: tc.toolName,
				args: "args" in tc ? tc.args : {},
			};
		});

		const stepToolResults = (step.toolResults ?? []).map((tr) => ({
			toolName: tr.toolName,
			result: "result" in tr ? tr.result : {},
		}));

		return {
			toolCalls: stepToolCalls.length > 0 ? stepToolCalls : undefined,
			toolResults: stepToolResults.length > 0 ? stepToolResults : undefined,
			text: step.text || undefined,
		};
	});

	const toolsUsed = [new Set(allToolCalls)];

	return {
		text: result.text,
		steps,
		toolsUsed,
		toolCallOrder: allToolCalls,
	};
};

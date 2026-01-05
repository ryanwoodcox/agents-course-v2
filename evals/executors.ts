import { generateText, stepCountIs, tool, type ToolSet } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

import type {
	EvalData,
	SingleTurnResult,
	MultiTurnEvalData,
	MultiTurnResult,
} from "./types.ts";
import { buildMessages } from "./utils.ts";

const TOOL_DEFINITIONS: any = {
	readFile: {
		description: "Read the contents of a file at the specified path",
		parameters: {
			path: z.string().describe("The path to the file that you want to read"),
		},
	},
	writeFile: {
		description: "Write content to the file at the specified path",
		parameters: {
			path: z
				.string()
				.describe("The path to the file that you want to write to"),
			content: z
				.string()
				.describe("The content that you want to write to the file"),
		},
	},
	listFiles: {
		description: "List all the files in a directory",
		parameters: {
			path: z
				.string()
				.describe("The directory in which you want to list the files"),
		},
	},
	deleteFile: {
		description: "Delete the file at the specified path",
		parameters: {
			path: z.string().describe("The path to the file that you want to delete"),
		},
	},
	runCommand: {
		description: "Execute a shell command and return its output",
		parameters: {
			command: z
				.string()
				.describe("The shell command that you want to execute"),
		},
	},
};

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

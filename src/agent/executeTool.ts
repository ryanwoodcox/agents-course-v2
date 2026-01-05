import { tools } from "./tools/index.ts";

export type ToolName = keyof typeof tools;

export const executeTool = async (
	name: string,
	args: Record<string, unknown>,
) => {
	const tool = tools[name as ToolName];

	if (!tool) {
		return `Unknown tool: ${name}`;
	}

	const execute = tool.execute;

	if (!execute) {
		// Provider tools (like webSearch) are executed by OpenAI, not us
		return `Provider tool ${name} - executed by model provider`;
	}

	const result = await execute(args as any, {
		toolCallId: "",
		messages: [],
	});

	return String(result);
};

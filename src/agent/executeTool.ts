import { tools } from './tools/index.ts';

export type ToolName = keyof typeof tools;

export const executeTool = async (
  name: ToolName,
  args: Record<string, unknown>
) => {
  const tool = tools[name];

  if (!tool) {
    throw new Error(
      `Sorry, this tool isn't ready yet, use something else or better yet, let the user know and ask them what you should do next.`
    );
  }

  const execute = tool.execute!;

  const result = await execute(args as any, {
    toolCallId: '',
    messages: [],
  });

  return String(result);
};

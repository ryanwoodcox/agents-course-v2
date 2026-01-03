import { tool } from 'ai';
import { z } from 'zod';

export const dateTimeTool = tool({
  description:
    'return the current date and time. Useful for when you need the current date and time.',
  inputSchema: z.object({}),
  execute: async () => {
    return new Date().toISOString();
  },
});

import { evaluate } from "@lmnr-ai/lmnr";

import { toolOrderCorrect, toolsAvoided, llmJudge } from "./evaluators.ts";
import { multiTurnWithMocks } from "./executors.ts";
import type {
	MultiTurnTarget,
	MultiTurnEvalData,
	MultiTurnResult,
	MultiTurnDatasetEntry,
} from "./types.ts";
import dataset from "./data/agent-multiturn.json" with { type: "json" };

const executor = async (data: MultiTurnEvalData) => {
	return multiTurnWithMocks(data);
};

evaluate({
	data: dataset as unknown as Array<{
		data: MultiTurnEvalData;
		target: MultiTurnTarget;
	}>,
	executor,
	evaluators: {
		outputQuality: async (output: any, target: any) => {
			if (!target) return 1;

			return llmJudge(output, target);
		},
	},
	config: {
		projectApiKey: process.env.LMNR_API_KEY,
	},
	groupName: "agent-multiturn",
});

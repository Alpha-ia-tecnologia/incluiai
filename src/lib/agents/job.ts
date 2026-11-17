import { aiGate } from "./capabilities";
import { createAgentModel, describeAgentError } from "./model";
import { namesInScope } from "./names-in-scope";
import { recordDeepSeekUse } from "../audit";
import { createJobRunner } from "./job-core";

export const runAiJob = createJobRunner({ gate: aiGate, names: namesInScope, chain: createAgentModel, describeError: describeAgentError, recordDeepSeekUse });

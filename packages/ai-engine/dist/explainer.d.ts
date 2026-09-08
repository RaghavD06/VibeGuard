import { NormalizedFinding, AIExplanation } from '@maverick006/types';
export interface ExplanationOptions {
    apiKey?: string;
    model?: string;
    codeContext?: string;
}
/**
 * Generates contextual explanations for deterministic security findings using NVIDIA NIM.
 * Operates as an optional advisory module; returns deterministic scanner guidance if API key is missing.
 */
export declare class ContextualExplainer {
    private ai;
    private defaultModel;
    constructor(apiKey?: string);
    /**
     * Generates a contextual explanation and remediation strategy for a given finding.
     */
    explainFinding(finding: NormalizedFinding, options?: ExplanationOptions): Promise<AIExplanation>;
    /**
     * Complete pre-AI secret redaction to ensure credentials never leak into prompt context.
     */
    maskSecrets(text: string): string;
    private buildPrompt;
    private parseAIResponse;
    private generateFallbackExplanation;
}
//# sourceMappingURL=explainer.d.ts.map
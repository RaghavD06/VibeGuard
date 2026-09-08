"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextualExplainer = void 0;
const openai_1 = __importDefault(require("openai"));
/**
 * Generates contextual explanations for deterministic security findings using NVIDIA NIM.
 * Operates as an optional advisory module; returns deterministic scanner guidance if API key is missing.
 */
class ContextualExplainer {
    ai = null;
    defaultModel = 'meta/llama-3.2-11b-vision-instruct'; // Fast, capable NIM model
    constructor(apiKey) {
        const key = apiKey || process.env.NVIDIA_API_KEY;
        if (key) {
            this.ai = new openai_1.default({
                apiKey: key,
                baseURL: 'https://integrate.api.nvidia.com/v1',
            });
        }
    }
    /**
     * Generates a contextual explanation and remediation strategy for a given finding.
     */
    async explainFinding(finding, options = {}) {
        const client = options.apiKey
            ? new openai_1.default({ apiKey: options.apiKey, baseURL: 'https://integrate.api.nvidia.com/v1' })
            : this.ai;
        if (!client) {
            // Deterministic fallback when no AI API key is configured
            return this.generateFallbackExplanation(finding);
        }
        try {
            const modelName = options.model || this.defaultModel;
            // MASK ALL SECRETS BEFORE SENDING TO MODEL
            const safeContext = this.maskSecrets(options.codeContext || '').slice(0, 2000); // 2000 chars max context
            const safeFinding = { ...finding, codeSnippet: this.maskSecrets(finding.codeSnippet || '') };
            const prompt = this.buildPrompt(safeFinding, safeContext);
            const completion = await client.chat.completions.create({
                model: modelName,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.2,
                max_tokens: 1024,
            });
            const text = completion.choices[0]?.message?.content || "";
            return this.parseAIResponse(finding.scanId || 'unknown', text);
        }
        catch (error) {
            console.warn('AI explanation failed, reverting to deterministic guidance:', error.message);
            return this.generateFallbackExplanation(finding, 'FAILED');
        }
    }
    /**
     * Complete pre-AI secret redaction to ensure credentials never leak into prompt context.
     */
    maskSecrets(text) {
        if (!text)
            return text;
        let masked = text;
        // Mask Private Keys
        masked = masked.replace(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, '[MASKED_PRIVATE_KEY]');
        // Mask AWS Access Keys
        masked = masked.replace(/\b(AKIA|ASIA|AROA)[0-9A-Z]{16}\b/g, '$1[MASKED_AWS_KEY]');
        // Mask Database Connection Strings (Postgres, MySQL, Mongo, Redis)
        masked = masked.replace(/(?:postgres|postgresql|mysql|mongodb|mongodb\+srv|redis):\/\/[^\s"']+/gi, '[MASKED_DATABASE_URL]');
        // Mask Bearer Tokens
        masked = masked.replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [MASKED_BEARER_TOKEN]');
        // Mask JWTs
        masked = masked.replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[MASKED_JWT]');
        // Mask Generic Secrets in code (password = "...", secret: '...', token = "...")
        masked = masked.replace(/(password|secret|token|api[_-]?key|client_secret)["'\s:=]+(["'])(?:(?!\2).)+(\2)/gi, '$1="[MASKED_SECRET]"');
        return masked;
    }
    buildPrompt(finding, codeContext) {
        return `You are VibeGuard, a strict DevSecOps assistant. 
A deterministic security scanner detected this vulnerability:
Title: ${finding.title}
Severity: ${finding.severity}
Scanner: ${finding.scanner}
File: ${finding.file || 'N/A'}
Line: ${finding.line || 'N/A'}
Rule: ${finding.ruleId || 'N/A'}
Description: ${finding.description || 'N/A'}
CWE: ${finding.cwe || 'Unknown'}
OWASP: ${finding.owasp || 'Unknown'}

${codeContext ? `CODE CONTEXT:\n${codeContext}` : ''}
${finding.codeSnippet ? `SNIPPET:\n${finding.codeSnippet}` : ''}

Provide an actionable remediation in pure JSON with no markdown wrapping:
{
  "summary": "1-2 sentence overview of the vulnerability.",
  "details": "Technical explanation of the security risk.",
  "remediation": "Step-by-step guidance to fix the vulnerability.",
  "codeFix": "The patched code snippet to replace the vulnerable lines."
}`;
    }
    parseAIResponse(findingId, text) {
        try {
            let cleanText = text.trim();
            const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleanText = jsonMatch[0];
            }
            const parsed = JSON.parse(cleanText);
            return {
                id: `explain-${Date.now()}`,
                findingId,
                summary: parsed.summary || 'Security advisory generated.',
                details: parsed.details || '',
                remediation: parsed.remediation || '',
                codeFix: parsed.codeFix || undefined,
                modelUsed: this.defaultModel,
                createdAt: new Date(),
                isAiAssisted: true,
                verificationStatus: 'SUGGESTED'
            };
        }
        catch {
            return {
                id: `explain-${Date.now()}`,
                findingId,
                summary: 'Advisory Guidance',
                details: text.slice(0, 500),
                remediation: 'Inspect the flagged file and apply standard security remediations.',
                modelUsed: this.defaultModel,
                createdAt: new Date(),
                isAiAssisted: true,
                verificationStatus: 'SUGGESTED'
            };
        }
    }
    generateFallbackExplanation(finding, state = 'NOT_CONFIGURED') {
        const isFailed = state === 'FAILED';
        return {
            id: `fallback-${Date.now()}`,
            findingId: finding.scanId,
            summary: finding.title || 'Deterministic Security Guidance',
            details: finding.description || 'Vulnerability detected by deterministic security scanner.',
            remediation: finding.remediation || (isFailed
                ? 'AI service was temporarily unreachable. Refer to rule guidance or vendor advisory to resolve.'
                : 'Configure NVIDIA_API_KEY in environment to enable optional AI remediation assistance.'),
            modelUsed: 'deterministic-rules',
            createdAt: new Date(),
            isAiAssisted: false,
            verificationStatus: 'NOT_APPLIED'
        };
    }
}
exports.ContextualExplainer = ContextualExplainer;
//# sourceMappingURL=explainer.js.map
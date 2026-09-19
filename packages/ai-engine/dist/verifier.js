"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RescanVerifier = void 0;
const types_1 = require("@maverick006/types");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
/**
 * Rescan Verification Engine:
 * Validates AI-suggested code fixes by applying them in an isolated workspace
 * and executing the deterministic scanner to verify the vulnerability is actually gone.
 */
class RescanVerifier {
    timeoutMs;
    constructor(timeoutMs = 120_000) {
        this.timeoutMs = timeoutMs;
    }
    async scanWithTimeout(scanner, repositoryPath, scanId) {
        let timer;
        try {
            return await Promise.race([
                scanner.scan({ scanId, repositoryPath }),
                new Promise((_, reject) => {
                    timer = setTimeout(() => reject(new Error('Verification scanner timed out')), this.timeoutMs);
                })
            ]);
        }
        finally {
            if (timer)
                clearTimeout(timer);
        }
    }
    async verifyPatch(request) {
        const { finding, codeFix, originalFileContent, scanner, filePath } = request;
        if (!codeFix || !codeFix.trim() || !originalFileContent || !originalFileContent.trim() || !filePath || filePath.includes('\0')) {
            return {
                originalFinding: finding,
                status: types_1.FindingStatus.NOT_VERIFIED,
                message: 'Both the original file content and proposed replacement are required for an isolated comparison'
            };
        }
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vibeguard-verify-'));
        try {
            const relativeTarget = path.isAbsolute(filePath)
                ? path.basename(filePath)
                : filePath;
            const isolatedFilePath = path.resolve(tempDir, relativeTarget);
            if (!isolatedFilePath.startsWith(tempDir + path.sep)) {
                return {
                    originalFinding: finding,
                    status: types_1.FindingStatus.NOT_VERIFIED,
                    message: 'Verification target must remain inside the isolated workspace'
                };
            }
            await fs.mkdir(path.dirname(isolatedFilePath), { recursive: true });
            const targetRule = (finding.ruleId || finding.title || '').toLowerCase();
            const matchesOriginal = (result) => result.findings.some(f => (f.ruleId || f.title || '').toLowerCase() === targetRule);
            await fs.writeFile(isolatedFilePath, originalFileContent, 'utf8');
            const baseline = await this.scanWithTimeout(scanner, tempDir, `baseline-${Date.now()}`);
            if (!baseline.success || baseline.state !== types_1.ScannerState.SUCCESS || !Array.isArray(baseline.findings) || !matchesOriginal(baseline)) {
                return {
                    originalFinding: finding,
                    status: types_1.FindingStatus.NOT_VERIFIED,
                    message: `${scanner.name} could not reproduce the original finding in the isolated workspace.`
                };
            }
            // Write the proposed replacement only after reproducing the original issue.
            await fs.writeFile(isolatedFilePath, codeFix, 'utf8');
            // Re-run scanner against the isolated workspace
            const rescanResult = await this.scanWithTimeout(scanner, tempDir, `verify-${Date.now()}`);
            if (!rescanResult.success || rescanResult.state !== types_1.ScannerState.SUCCESS || !Array.isArray(rescanResult.findings)) {
                return {
                    originalFinding: finding,
                    status: types_1.FindingStatus.NOT_VERIFIED,
                    message: `Verification could not be completed: ${scanner.name} did not finish successfully.`,
                    reScanResult: rescanResult
                };
            }
            // Check if the original finding still exists
            const stillFails = matchesOriginal(rescanResult);
            if (!stillFails) {
                return {
                    originalFinding: finding,
                    status: types_1.FindingStatus.VERIFIED,
                    message: `${scanner.name} did not find the issue in the isolated proposed file. The repository has not been changed or rescanned.`,
                    reScanResult: rescanResult
                };
            }
            else {
                return {
                    originalFinding: finding,
                    status: types_1.FindingStatus.FAILED_VERIFICATION,
                    message: `Verification failed: ${scanner.name} still flagged the vulnerability after applying the proposed fix.`,
                    reScanResult: rescanResult
                };
            }
        }
        catch (err) {
            return {
                originalFinding: finding,
                status: types_1.FindingStatus.NOT_VERIFIED,
                message: err?.message === 'Verification scanner timed out'
                    ? 'Verification scanner timed out; no result was verified.'
                    : 'Verification scanner failed; no result was verified.'
            };
        }
        finally {
            try {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
            catch { }
        }
    }
}
exports.RescanVerifier = RescanVerifier;
//# sourceMappingURL=verifier.js.map
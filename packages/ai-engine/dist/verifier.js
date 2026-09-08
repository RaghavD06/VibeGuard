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
    async verifyPatch(request) {
        const { finding, codeFix, scanner, filePath } = request;
        if (!codeFix || !codeFix.trim()) {
            return {
                originalFinding: finding,
                status: types_1.FindingStatus.NOT_VERIFIED,
                message: 'No executable code fix provided to verify'
            };
        }
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vibeguard-verify-'));
        try {
            const relativeTarget = path.isAbsolute(filePath)
                ? path.basename(filePath)
                : filePath;
            const isolatedFilePath = path.join(tempDir, relativeTarget);
            await fs.mkdir(path.dirname(isolatedFilePath), { recursive: true });
            // Write the patched file
            await fs.writeFile(isolatedFilePath, codeFix, 'utf8');
            // Re-run scanner against the isolated workspace
            const rescanResult = await scanner.scan({
                scanId: `verify-${Date.now()}`,
                repositoryPath: tempDir
            });
            // Check if the original finding still exists
            const targetRule = (finding.ruleId || finding.title || '').toLowerCase();
            const stillFails = rescanResult.findings.some(f => {
                const rescanRule = (f.ruleId || f.title || '').toLowerCase();
                return rescanRule === targetRule;
            });
            if (!stillFails) {
                return {
                    originalFinding: finding,
                    status: types_1.FindingStatus.VERIFIED,
                    message: `Verification succeeded: ${scanner.name} confirmed the vulnerability is resolved with no new regressions.`,
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
                message: `Verification could not be performed: ${err.message}`
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
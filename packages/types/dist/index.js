"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScannerState = exports.FindingStatus = exports.Confidence = exports.Severity = void 0;
/**
 * Defines the normalized severity levels for security findings.
 */
var Severity;
(function (Severity) {
    Severity["CRITICAL"] = "CRITICAL";
    Severity["HIGH"] = "HIGH";
    Severity["MEDIUM"] = "MEDIUM";
    Severity["LOW"] = "LOW";
    Severity["INFO"] = "INFO";
})(Severity || (exports.Severity = Severity = {}));
/**
 * Defines the confidence level of the scanner finding the vulnerability.
 */
var Confidence;
(function (Confidence) {
    Confidence["HIGH"] = "HIGH";
    Confidence["MEDIUM"] = "MEDIUM";
    Confidence["LOW"] = "LOW";
})(Confidence || (exports.Confidence = Confidence = {}));
/**
 * Defines the status of a finding in the VibeGuard system.
 */
var FindingStatus;
(function (FindingStatus) {
    FindingStatus["OPEN"] = "OPEN";
    FindingStatus["ACKNOWLEDGED"] = "ACKNOWLEDGED";
    FindingStatus["SUGGESTED"] = "SUGGESTED";
    FindingStatus["APPLIED"] = "APPLIED";
    FindingStatus["VERIFIED"] = "VERIFIED";
    FindingStatus["FAILED_VERIFICATION"] = "FAILED_VERIFICATION";
    FindingStatus["NOT_VERIFIED"] = "NOT_VERIFIED";
    FindingStatus["FIXED"] = "FIXED";
    FindingStatus["RESOLVED"] = "RESOLVED";
    FindingStatus["FALSE_POSITIVE"] = "FALSE_POSITIVE";
})(FindingStatus || (exports.FindingStatus = FindingStatus = {}));
/**
 * Explicit operational state for a security scanner.
 */
var ScannerState;
(function (ScannerState) {
    ScannerState["RUNNING"] = "RUNNING";
    ScannerState["SUCCESS"] = "SUCCESS";
    ScannerState["FAILED"] = "FAILED";
    ScannerState["TIMEOUT"] = "TIMEOUT";
    ScannerState["NOT_INSTALLED"] = "NOT_INSTALLED";
    ScannerState["SKIPPED"] = "SKIPPED";
    ScannerState["UNSUPPORTED"] = "UNSUPPORTED";
    ScannerState["EXPERIMENTAL"] = "EXPERIMENTAL";
})(ScannerState || (exports.ScannerState = ScannerState = {}));
//# sourceMappingURL=index.js.map
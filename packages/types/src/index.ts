/**
 * Defines the normalized severity levels for security findings.
 */
export enum Severity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  INFO = 'INFO'
}

/**
 * Defines the confidence level of the scanner finding the vulnerability.
 */
export enum Confidence {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

/**
 * Defines the status of a finding in the VibeGuard system.
 */
export enum FindingStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  SUGGESTED = 'SUGGESTED',
  APPLIED = 'APPLIED',
  VERIFIED = 'VERIFIED',
  FAILED_VERIFICATION = 'FAILED_VERIFICATION',
  NOT_VERIFIED = 'NOT_VERIFIED',
  FIXED = 'FIXED',
  RESOLVED = 'RESOLVED',
  FALSE_POSITIVE = 'FALSE_POSITIVE'
}

/**
 * Explicit operational state for a security scanner.
 */
export enum ScannerState {
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  TIMEOUT = 'TIMEOUT',
  NOT_INSTALLED = 'NOT_INSTALLED',
  SKIPPED = 'SKIPPED',
  UNSUPPORTED = 'UNSUPPORTED',
  EXPERIMENTAL = 'EXPERIMENTAL'
}

/**
 * Coverage matrix across security domains.
 */
export interface ScannerCoverage {
  code: boolean;
  dependencies: boolean;
  secrets: boolean;
  containers: boolean;
  iac: boolean;
  web: boolean;
  cloud: boolean;
}

/**
 * Detailed breakdown of score deductions.
 */
export interface ScoreDeductions {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  totalDeductions: number;
}

/**
 * Deterministic, reproducible security posture score.
 */
export interface DeterministicScore {
  score: number; // 0 to 100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  deductions: ScoreDeductions;
  breakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  coverage: ScannerCoverage;
  explanation: string[];
}

/**
 * The core normalized finding model.
 * Every vulnerability finding should be converted into this structure.
 */
export interface NormalizedFinding {
  id?: string;
  scanId?: string;
  scanner: string;
  scannerVersion?: string;
  ruleId?: string;
  title: string;
  description: string;
  severity: Severity;
  confidence?: Confidence;
  category?: string;
  owasp?: string;
  cwe?: string;
  file?: string;
  line?: number;
  column?: number;
  codeSnippet?: string;
  fingerprint?: string;
  package?: string;
  packageVersion?: string;
  fixedVersion?: string;
  container?: string;
  image?: string;
  remediation?: string;
  references?: string[];
  status?: FindingStatus;
  createdAt?: Date;
}

/**
 * Input configuration provided to a scanner when starting a scan.
 */
export interface ScanInput {
  scanId: string;
  repositoryPath: string;
  targetUrl?: string;
  options?: Record<string, any>;
}

/**
 * The standard output format expected from any SecurityScanner adapter.
 */
export interface ScannerResult {
  scanner: string;
  success: boolean;
  state?: ScannerState;
  reason?: string;
  durationMs?: number;
  findings: NormalizedFinding[];
  rawOutput?: string;
  error?: string;
  startTime: Date;
  endTime: Date;
}

export interface AIExplanation {
  id: string;
  findingId?: string;
  summary: string;
  details: string;
  remediation: string;
  codeFix?: string;
  modelUsed: string;
  createdAt: Date;
  isAiAssisted?: boolean;
  verificationStatus?: 'NOT_APPLIED' | 'SUGGESTED' | 'APPLIED' | 'VERIFIED' | 'FAILED_VERIFICATION';
}

export type UserRole = 'OWNER' | 'MEMBER';

export interface UserProfile {
  id: string;
  email: string;
  name?: string | null;
  createdAt: string | Date;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface AiRemediationRequest {
  findingId: string;
  codeContext?: string;
}

export interface RescanVerificationRequest {
  findingId: string;
  codeFix: string;
  filePath?: string;
}


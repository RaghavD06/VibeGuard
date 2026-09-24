import chalk from 'chalk';
import readline from 'readline';

export type StatusKind = 'success' | 'warning' | 'error' | 'info' | 'muted';

const colorEnabled = () => !('NO_COLOR' in process.env);
const unicodeEnabled = () => process.env.VIBEGUARD_ASCII !== '1' && process.env.TERM !== 'dumb';

function paint(color: (value: string) => string, value: string): string {
  return colorEnabled() ? color(value) : value;
}

export const color = {
  brand: (value: string) => paint(chalk.cyan.bold, value),
  success: (value: string) => paint(chalk.green, value),
  warning: (value: string) => paint(chalk.yellow, value),
  error: (value: string) => paint(chalk.red, value),
  critical: (value: string) => paint(chalk.red.bold, value),
  high: (value: string) => paint(chalk.hex('#F97316').bold, value),
  medium: (value: string) => paint(chalk.yellow, value),
  low: (value: string) => paint(chalk.cyan, value),
  strong: (value: string) => paint(chalk.white.bold, value),
  muted: (value: string) => paint(chalk.gray, value)
};

export function glyph(kind: StatusKind): string {
  const unicode = unicodeEnabled();
  if (kind === 'success') return unicode ? '✓' : '[OK]';
  if (kind === 'warning') return unicode ? '⚠' : '[WARN]';
  if (kind === 'error') return unicode ? '✗' : '[ERROR]';
  if (kind === 'info') return unicode ? '•' : '[INFO]';
  return unicode ? '–' : '-';
}

export function divider(width = 48): string {
  return color.muted((unicodeEnabled() ? '─' : '-').repeat(width));
}

export function separator(): string {
  return unicodeEnabled() ? '·' : '|';
}

export function header(title = 'VibeGuard', subtitle?: string): string[] {
  const lines = [color.brand(title), divider()];
  if (subtitle) lines.push(subtitle);
  return lines;
}

export function section(title: string): string[] {
  return ['', color.strong(title), divider()];
}

export function status(kind: StatusKind, message: string): string {
  const marker = glyph(kind);
  const label = `${marker} ${message}`;
  if (kind === 'success') return color.success(label);
  if (kind === 'warning') return color.warning(label);
  if (kind === 'error') return color.error(label);
  if (kind === 'info') return color.low(label);
  return color.muted(label);
}

export const success = (message: string) => status('success', message);
export const warning = (message: string) => status('warning', message);
export const error = (message: string) => status('error', message);
export const info = (message: string) => status('info', message);
export const muted = (message: string) => color.muted(message);

export function row(label: string, value: string, labelWidth = 14): string {
  return `${color.muted(label.padEnd(labelWidth))}${value}`;
}

export function formatDuration(durationMs = 0): string {
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}

export function installHint(scanner: string): string | undefined {
  const hints: Record<string, string> = {
    Semgrep: 'Install Semgrep to enable static code analysis.',
    Gitleaks: 'Install Gitleaks to enable secret scanning.',
    Trivy: 'Install Trivy to enable container scanning.',
    Checkov: 'Install Checkov to enable infrastructure-as-code scanning.',
    'npm-audit': 'Install Node.js and npm to enable dependency scanning.'
  };
  return hints[scanner];
}

export function writeLines(lines: Array<string | undefined>): void {
  for (const line of lines) {
    if (line !== undefined) console.log(line);
  }
}

export async function promptVisible(label: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await new Promise<string>(resolve => rl.question(`${label}\n${unicodeEnabled() ? '›' : '>'} `, resolve));
  } finally {
    rl.close();
  }
}

export async function promptHidden(label: string): Promise<string> {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    return promptVisible(label);
  }

  process.stdout.write(`${label}\n${unicodeEnabled() ? '›' : '>'} `);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  return new Promise<string>((resolve, reject) => {
    let value = '';
    const restore = () => {
      process.stdin.removeListener('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    };
    const onData = (chunk: string | Buffer) => {
      const input = String(chunk);
      for (const char of input) {
        if (char === '\u0003') {
          restore();
          reject(new Error('Authentication cancelled.'));
          return;
        }
        if (char === '\r' || char === '\n') {
          restore();
          resolve(value);
          return;
        }
        if (char === '\u007f' || char === '\b') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
          continue;
        }
        if (char >= ' ') {
          value += char;
          process.stdout.write('*');
        }
      }
    };
    process.stdin.on('data', onData);
  });
}

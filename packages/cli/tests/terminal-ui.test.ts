import { color, divider, glyph, header, separator, status } from '../src/terminal-ui';

describe('terminal UI primitives', () => {
  const originalNoColor = process.env.NO_COLOR;
  const originalAscii = process.env.VIBEGUARD_ASCII;
  const originalTerm = process.env.TERM;

  afterEach(() => {
    if (originalNoColor === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = originalNoColor;
    if (originalAscii === undefined) delete process.env.VIBEGUARD_ASCII;
    else process.env.VIBEGUARD_ASCII = originalAscii;
    if (originalTerm === undefined) delete process.env.TERM;
    else process.env.TERM = originalTerm;
  });

  it('renders a compact reusable header', () => {
    const output = header('VibeGuard', 'Scanning .').join('\n');
    expect(output).toContain('VibeGuard');
    expect(output).toContain('Scanning .');
    expect(output).toContain(divider());
  });

  it('respects NO_COLOR at render time', () => {
    process.env.NO_COLOR = '1';
    expect(color.error('failure')).toBe('failure');
    expect(status('error', 'Scan failed')).not.toMatch(/\u001b\[/);
    expect(status('error', 'Scan failed')).toContain('Scan failed');
  });

  it('uses explicit ASCII status fallbacks', () => {
    process.env.VIBEGUARD_ASCII = '1';
    expect(glyph('success')).toBe('[OK]');
    expect(glyph('warning')).toBe('[WARN]');
    expect(glyph('error')).toBe('[ERROR]');
    expect(separator()).toBe('|');
  });

  it('falls back to ASCII for dumb terminals', () => {
    process.env.TERM = 'dumb';
    expect(glyph('success')).toBe('[OK]');
    expect(divider(4)).toContain('----');
  });
});

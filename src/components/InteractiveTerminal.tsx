'use client';

import {
  useState, useRef, useEffect, useCallback,
  KeyboardEvent,
} from 'react';
import { useRouter } from 'next/navigation';

// ── Types ─────────────────────────────────────────────────────────────────────

type LineType = 'output' | 'error' | 'system' | 'input' | 'success' | 'warn' | 'blank';

interface TermLine {
  id:   number;
  type: LineType;
  text: string;
}

interface Cmd {
  aliases:     string[];
  description: string;
  handler:     (args: string[]) => Promise<TermLine[]> | TermLine[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let _uid = 0;
const mkLine = (text: string, type: LineType = 'output'): TermLine => ({
  id: _uid++, type, text,
});

// ── Boot sequence ─────────────────────────────────────────────────────────────

const BOOT: TermLine[] = [
  mkLine('SENTINEL v1.0.0  —  Reactive IL Protection System', 'system'),
  mkLine('Initializing kernel..................................... OK', 'output'),
  mkLine('Loading Reactive Network bridge......................... OK', 'output'),
  mkLine('Cross-chain event listener: ACTIVE', 'success'),
  mkLine('Uniswap V2 Sync monitor: READY', 'success'),
  mkLine('', 'blank'),
  mkLine('Type  help  to list available commands.', 'warn'),
  mkLine('', 'blank'),
];

// ── Color map ─────────────────────────────────────────────────────────────────

const COLOR: Record<LineType, string> = {
  output:  'text-zinc-400',
  error:   'text-[#FF2D2D]',
  system:  'text-[#00F5FF]',
  input:   'text-[#39FF14]',
  success: 'text-[#39FF14]',
  warn:    'text-[#FFB800]',
  blank:   'text-zinc-800',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function InteractiveTerminal() {
  const router = useRouter();

  const [lines,   setLines]   = useState<TermLine[]>(BOOT);
  const [input,   setInput]   = useState('');
  const [hist,    setHist]    = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [ready,   setReady]   = useState(false);

  // scrollBoxRef scrolls only the terminal div — never the page
  const scrollBoxRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  // Short boot delay before enabling input
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 400);
    return () => clearTimeout(t);
  }, []);

  // Scroll only the terminal's internal div, not the page
  useEffect(() => {
    const box = scrollBoxRef.current;
    if (!box) return;
    box.scrollTop = box.scrollHeight;
  }, [lines]);

  const push = useCallback((incoming: TermLine[]) => {
    setLines(prev => [...prev, ...incoming]);
  }, []);

  // ── Command definitions ───────────────────────────────────────────────────

  const COMMANDS: Cmd[] = [

    {
      aliases: ['help', '?', 'h'],
      description: 'List all commands',
      handler: () => [
        mkLine('', 'blank'),
        mkLine('┌──────────────────────────────────────────────────────┐', 'system'),
        mkLine('│           SENTINEL COMMAND INTERFACE                 │', 'system'),
        mkLine('├───────────────────────────┬──────────────────────────┤', 'system'),
        mkLine('│  deploy sentinel          │  Deploy new contracts    │', 'output'),
        mkLine('│  connect sentinel         │  Connect existing order  │', 'output'),
        mkLine('│  show sentinel            │  Open your dashboard     │', 'output'),
        mkLine('│  status                   │  Network health check    │', 'output'),
        mkLine('│  version                  │  Build info              │', 'output'),
        mkLine('│  clear                    │  Wipe terminal           │', 'output'),
        mkLine('│  help                     │  This menu               │', 'output'),
        mkLine('└───────────────────────────┴──────────────────────────┘', 'system'),
        mkLine('', 'blank'),
        mkLine('Tip: TAB to autocomplete  •  ↑↓ for history', 'warn'),
        mkLine('', 'blank'),
      ],
    },

    {
      aliases: ['deploy sentinel', 'deploy'],
      description: 'Deploy a new IL protection contract pair',
      handler: async () => {
        setTimeout(() => router.push('/protect'), 1400);
        return [
          mkLine('', 'blank'),
          mkLine('> Initiating Sentinel deployment sequence...', 'system'),
          mkLine('  [1/3] Wallet pre-flight check.................. OK', 'output'),
          mkLine('  [2/3] Loading Sepolia network config........... OK', 'output'),
          mkLine('  [3/3] Preparing bytecode artifacts............. OK', 'output'),
          mkLine('', 'blank'),
          mkLine('  Redirecting → Deploy Interface', 'success'),
          mkLine('', 'blank'),
        ];
      },
    },

    {
      aliases: ['connect sentinel', 'connect'],
      description: 'Connect to an existing protection order',
      handler: async () => {
        setTimeout(() => router.push('/protect?tab=connect'), 1400);
        return [
          mkLine('', 'blank'),
          mkLine('> Scanning for existing Sentinel contracts...', 'system'),
          mkLine('  Cross-chain handshake: Sepolia ↔ Lasna........ OK', 'output'),
          mkLine('  Verifying callback proxy address............... OK', 'output'),
          mkLine('', 'blank'),
          mkLine('  Redirecting → Connect Interface', 'success'),
          mkLine('', 'blank'),
        ];
      },
    },

    {
      aliases: ['show sentinel', 'show', 'dashboard', 'dash'],
      description: 'Open the Sentinel dashboard',
      handler: async () => {
        setTimeout(() => router.push('/dashboard'), 1400);
        return [
          mkLine('', 'blank'),
          mkLine('> Fetching Sentinel status...', 'system'),
          mkLine('  Querying on-chain protection orders............ OK', 'output'),
          mkLine('  Building execution history..................... OK', 'output'),
          mkLine('  Rendering position cards....................... OK', 'output'),
          mkLine('', 'blank'),
          mkLine('  Redirecting → Dashboard', 'success'),
          mkLine('', 'blank'),
        ];
      },
    },

    {
      aliases: ['status'],
      description: 'Show network and chain status',
      handler: () => [
        mkLine('', 'blank'),
        mkLine('┌─ NETWORK STATUS ─────────────────────────────────────┐', 'system'),
        mkLine('│  Sepolia Testnet          [ ACTIVE ]  11155111       │', 'success'),
        mkLine('│  Reactive Lasna           [ ACTIVE ]  5318007        │', 'success'),
        mkLine('│  Callback Proxy           [ LOADED ]                 │', 'success'),
        mkLine('│  Uniswap V2 Router        [ READY  ]                 │', 'success'),
        mkLine('│  Event Listener           [ ONLINE ]                 │', 'success'),
        mkLine('│  RPC Latency              < 120ms                    │', 'output'),
        mkLine('└──────────────────────────────────────────────────────┘', 'system'),
        mkLine('', 'blank'),
      ],
    },

    {
      aliases: ['version', '--version', '-v', 'ver'],
      description: 'Show build information',
      handler: () => [
        mkLine('', 'blank'),
        mkLine('  SENTINEL v1.0.0', 'system'),
        mkLine('  Protocol  : UniswapV2 IL Protection', 'output'),
        mkLine('  Network   : Sepolia + Reactive Lasna', 'output'),
        mkLine('  Reactive  : Reactive Network SDK', 'output'),
        mkLine('  Stack     : Next.js 16 · TypeScript · wagmi v2', 'output'),
        mkLine('', 'blank'),
      ],
    },

    {
      aliases: ['clear', 'cls', 'reset'],
      description: 'Clear terminal output',
      handler: () => {
        setLines([]);
        return [];
      },
    },
  ];

  // ── Execute ───────────────────────────────────────────────────────────────

  const execute = useCallback(async (raw: string) => {
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed) return;

    push([mkLine(`sentinel ~$ ${raw}`, 'input')]);

    setHist(h => [raw, ...h.slice(0, 49)]);
    setHistIdx(-1);

    const sorted = [...COMMANDS].sort(
      (a, b) =>
        Math.max(...b.aliases.map(x => x.length)) -
        Math.max(...a.aliases.map(x => x.length))
    );

    const matched = sorted.find(cmd =>
      cmd.aliases.some(
        alias => trimmed === alias || trimmed.startsWith(alias + ' ')
      )
    );

    if (matched) {
      const firstAlias = matched.aliases.find(
        a => trimmed === a || trimmed.startsWith(a + ' ')
      )!;
      const args = trimmed.slice(firstAlias.length).trim().split(' ').filter(Boolean);
      const result = await matched.handler(args);
      push(result);
    } else {
      push([
        mkLine(`  command not found: ${raw}`, 'error'),
        mkLine('  Type  help  to see available commands.', 'warn'),
        mkLine('', 'blank'),
      ]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [push, router]);

  // ── Keyboard ──────────────────────────────────────────────────────────────

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      execute(input);
      setInput('');
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = Math.min(histIdx + 1, hist.length - 1);
      setHistIdx(idx);
      setInput(hist[idx] ?? '');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setInput(idx === -1 ? '' : hist[idx]);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const all = COMMANDS.flatMap(c => c.aliases);
      const match = all.find(a => a.startsWith(input.toLowerCase()));
      if (match) setInput(match);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="w-full max-w-2xl mx-auto select-text"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 bg-[#161616] border border-[#2a2a2a] border-b-0">
        <span className="w-3 h-3 rounded-full bg-[#FF2D2D] opacity-90" />
        <span className="w-3 h-3 rounded-full bg-[#FFB800] opacity-90" />
        <span className="w-3 h-3 rounded-full bg-[#39FF14] opacity-90" />
        <span className="ml-3 text-[10px] font-mono text-[#444] tracking-[0.25em] uppercase">
          SENTINEL — INTERACTIVE TERMINAL
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] text-[#39FF14] tracking-widest">
          <span className="pulse-dot" />
          LIVE
        </span>
      </div>

      {/* Output area — overflow-y-auto here, NOT scrollIntoView on page */}
      <div
        ref={scrollBoxRef}
        className="bg-[#080808] border border-[#2a2a2a] border-t border-t-[#39FF14] p-4 h-72 overflow-y-auto font-mono text-xs leading-relaxed cursor-text"
      >
        {lines.map(l => (
          <div
            key={l.id}
            className={`whitespace-pre-wrap break-words ${COLOR[l.type]}`}
          >
            {l.text || '\u00A0'}
          </div>
        ))}

        {/* Input row */}
        {ready && (
          <div className="flex items-center mt-1">
            <span className="text-[#39FF14] mr-2 flex-shrink-0 select-none">
              sentinel ~$
            </span>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="flex-1 bg-transparent outline-none text-[#39FF14] caret-[#39FF14] placeholder-[#333]"
              placeholder="type a command..."
              aria-label="Terminal input"
            />
            <span className="inline-block w-2 h-3.5 bg-[#39FF14] ml-0.5 animate-blink align-bottom" />
          </div>
        )}
      </div>

      {/* Hint bar */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-[10px] font-mono text-[#444] tracking-widest select-none">
        <span><span className="text-[#555]">TAB</span> — autocomplete</span>
        <span><span className="text-[#555]">↑ ↓</span> — history</span>
        <span><span className="text-[#555]">ENTER</span> — execute</span>
        <span className="ml-auto text-[#2a2a2a]">try: deploy sentinel</span>
      </div>
    </div>
  );
}
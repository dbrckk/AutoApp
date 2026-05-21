import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { VirtualFile } from '../types';
import { Copy, Check } from 'lucide-react';

interface CodeViewerProps {
  file: VirtualFile | null;
}

export function CodeViewer({ file }: CodeViewerProps) {
  const [copied, setCopied] = useState(false);

  if (!file) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center text-gray-400 bg-[#050505] relative overflow-hidden group">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(236,72,153,0.03),transparent)] pointer-events-none group-hover:bg-[radial-gradient(ellipse_at_center,rgba(236,72,153,0.06),transparent)] transition-all duration-700"></div>
        <div className="absolute inset-0 bg-grid-white/[0.01] bg-[size:64px]"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>
        <div className="absolute h-full w-full bg-gradient-to-t from-[#050505] to-transparent bottom-0 z-0"></div>
        <div className="z-10 flex flex-col items-center relative">
          <div className="absolute inset-0 bg-pink-500/10 blur-[80px] rounded-full"></div>
          <div className="w-28 h-28 mb-8 rounded-[2.5rem] bg-gradient-to-tr from-pink-500/10 via-purple-500/10 to-indigo-500/10 border border-white/5 flex items-center justify-center shadow-[0_0_50px_rgba(236,72,153,0.1)] backdrop-blur-xl animate-pulse-slow relative z-10">
            <div className="absolute inset-[2px] bg-[#0a0a0a] rounded-[2.3rem] z-0"></div>
            <svg className="w-12 h-12 text-pink-400/80 drop-shadow-[0_0_10px_rgba(236,72,153,0.5)] relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
            </svg>
          </div>
          <p className="text-[11px] tracking-[0.3em] uppercase font-black bg-clip-text text-transparent bg-gradient-to-r from-gray-300 to-gray-500 font-display">Forge AI Workspace</p>
          <p className="mt-4 text-xs text-gray-500 max-w-sm text-center leading-relaxed font-mono">Select a root module from the explorer to view its source topology, or trigger autonomic synthesis.</p>
        </div>
      </div>
    );
  }

  const handleCopy = () => {
    if (file.content) {
      navigator.clipboard.writeText(file.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getLanguage = (path: string) => {
    if (path.endsWith('.tsx') || path.endsWith('.ts')) return 'typescript';
    if (path.endsWith('.jsx') || path.endsWith('.js')) return 'javascript';
    if (path.endsWith('.css')) return 'css';
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.html')) return 'html';
    return 'plaintext';
  };

  const isImagePlaceholder = file.content.startsWith('https://image.pollinations.ai/');

  return (
    <div className="flex-1 h-full overflow-hidden bg-[#050505] flex flex-col relative group">
      <div className="h-14 bg-gradient-to-b from-[#111] to-[#0a0a0a] border-b border-white/5 flex items-center px-5 shrink-0 overflow-x-auto custom-scrollbar shadow-md z-20">
          <div className="flex items-center text-gray-400 text-[11px] font-mono tracking-widest uppercase">
            <span className="w-2 h-2 rounded-full bg-pink-500 mr-3 shadow-[0_0_8px_rgba(236,72,153,0.8)] animate-pulse"></span>
            <span className="bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 shadow-inner">
              {file.path}
            </span>
          </div>
      </div>
      {!isImagePlaceholder && (
        <button
          onClick={handleCopy}
          className="absolute top-16 right-6 p-2.5 bg-[#1a1a1a]/80 backdrop-blur-md border border-white/10 hover:border-pink-500/50 hover:bg-pink-500/20 text-gray-400 hover:text-pink-300 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-all z-30 hover:scale-110 active:scale-95"
          title="Copy Code"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" /> : <Copy className="w-4 h-4" />}
        </button>
      )}
      <div className="flex-1 overflow-auto custom-scrollbar relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(236,72,153,0.02),transparent)] pointer-events-none"></div>
        {isImagePlaceholder ? (
          <div className="p-8 flex items-center justify-center h-full">
            <img src={file.content} alt={file.path} className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain border border-white/10" />
          </div>
        ) : (
          <SyntaxHighlighter
            language={getLanguage(file.path)}
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              padding: '2.5rem 2rem',
              minHeight: '100%',
              fontSize: '13.5px',
              lineHeight: '1.7',
              fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
              backgroundColor: 'transparent',
              textShadow: '0 0 1px rgba(255,255,255,0.1)'
            }}
            lineNumberStyle={{
              minWidth: '3.5em',
              paddingRight: '2em',
              color: '#333',
              textAlign: 'right',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '12px'
            }}
            showLineNumbers
          >
            {file.content || '// Empty file'}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  );
}

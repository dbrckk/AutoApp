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
      <div className="flex-1 h-full flex flex-col items-center justify-center text-gray-500 bg-[#1e1e1e]">
        <img src="https://image.pollinations.ai/prompt/a%20sleek%20minimalist%20code%20editor%20icon%20dark%20mode?width=128&height=128&nologo=true" alt="Empty" className="w-24 h-24 mb-4 opacity-50 rounded-lg" />
        <p>Select a file to view its contents</p>
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
    <div className="flex-1 h-full overflow-hidden bg-[#1e1e1e] flex flex-col relative group">
      {!isImagePlaceholder && (
        <button
          onClick={handleCopy}
          className="absolute top-4 right-4 p-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-gray-300 rounded shadow-md opacity-0 group-hover:opacity-100 transition-all z-10"
          title="Copy Code"
        >
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
      )}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {isImagePlaceholder ? (
          <div className="p-8 flex items-center justify-center h-full">
            <img src={file.content} alt={file.path} className="max-w-full max-h-full rounded shadow-xl object-contain border border-[#333]" />
          </div>
        ) : (
          <SyntaxHighlighter
            language={getLanguage(file.path)}
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              padding: '1.5rem',
              minHeight: '100%',
              fontSize: '14px',
              fontFamily: 'var(--font-mono, monospace)',
              backgroundColor: 'transparent'
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

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { calculateMeasurements, API_BASE_URL } from '../utils';
import { Send, Bot, User, Trash2, Sparkles, Key, AlertCircle } from 'lucide-react';

const CONCRETE_DENSITY = 2400;
const STEEL_DENSITY = 7850;
const DEFAULT_STEEL_PERCENT = { column: 5, beam: 4, slab: 4, wall: 4 };

const ROLE_LABELS = {
    column: 'Columns', beam: 'Beams', slab: 'Slabs', wall: 'Walls', brick_wall: 'Brick Walls',
    footing_base: 'Footing Base', footing_slope: 'Footing Slope',
};

const CONCRETE_EOL_FACTORS = {
    'Primary material prod': 118.79306,
    'Closed-loop source': 3.21835,
};
const STEEL_EOL_FACTORS = {
    'Primary material production': 3824.09335,
    'Closed-loop source': 1638.74406,
};

const QUICK_PROMPTS = [
    { icon: '📊', label: 'Full Report', prompt: 'Generate a comprehensive sustainability report for this RCC structure. Include carbon footprint summary, material analysis, EOL assessment, and actionable recommendations.' },
    { icon: '🌱', label: 'Green Alternatives', prompt: 'Suggest sustainable alternatives for reducing the carbon footprint of this structure. Consider alternative materials, grades, and construction techniques.' },
    { icon: '♻️', label: 'EOL Strategy', prompt: 'Analyze the current End-of-Life disposal strategy for all materials and recommend the most sustainable EOL approach for each element.' },
    { icon: '📋', label: 'LEED Compliance', prompt: 'Evaluate this structure for LEED/IGBC green building certification. What score could it achieve and what improvements are needed?' },
];

const GROQ_MODEL = 'llama-3.3-70b-versatile';

export default function ChatbotView({ floors, rccSettings, concreteEol, steelEol, concreteGrades, steelGrades, foundation }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('groq_api_key') || '');
    const [showKeyInput, setShowKeyInput] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    // Persist API key to localStorage
    useEffect(() => {
        if (apiKey) {
            localStorage.setItem('groq_api_key', apiKey);
        } else {
            localStorage.removeItem('groq_api_key');
        }
    }, [apiKey]);

    // ── Build context from project data ──
    const projectContext = useMemo(() => {
        const ALL_CONCRETE_ROLES = ['column', 'beam', 'slab', 'wall', 'footing_base', 'footing_slope'];
        const STRUCTURAL_ROLES = ['column', 'beam', 'slab', 'wall'];

        const volumeData = {};
        ALL_CONCRETE_ROLES.forEach(r => { volumeData[r] = { volume: 0 }; });
        [foundation, ...floors].filter(Boolean).forEach(floor => {
            if (!floor?.dxfData) return;
            const floorStats = calculateMeasurements(
                floor.dxfData.layers, floor.config,
                { ...rccSettings, numFloors: 1 }
            );
            if (floorStats.extraWallStats) {
                volumeData.wall.volume += parseFloat(floorStats.extraWallStats.volume);
            }
            floor.dxfData.layers.forEach(layer => {
                const role = floor.config[layer.id]?.role || 'generic';
                const stats = floorStats.byLayer[layer.id];
                if (stats && volumeData[role]) {
                    volumeData[role].volume += parseFloat(stats.volume);
                }
            });
        });

        // Add Topmost Slab
        if (floors.length > 0) {
            const topFloorIdx = floors.length - 1;
            const topFloor = floors[topFloorIdx];
            if (topFloor && topFloor.dxfData) {
                const topFloorStats = calculateMeasurements(
                    topFloor.dxfData.layers, topFloor.config,
                    { ...rccSettings, numFloors: 1 }
                );
                topFloor.dxfData.layers.forEach(layer => {
                    const role = topFloor.config[layer.id]?.role || 'generic';
                    if (role === 'slab') {
                        const stats = topFloorStats.byLayer[layer.id];
                        if (stats && volumeData['slab']) {
                            volumeData['slab'].volume += parseFloat(stats.volume);
                        }
                    }
                });
            }
        }

        const concrete = ALL_CONCRETE_ROLES.map(role => {
            const vol = volumeData[role]?.volume || 0;
            if (vol === 0) return null;
            const massTonnes = (vol * CONCRETE_DENSITY) / 1000;
            const eol = concreteEol?.[role] || 'Primary material prod';
            const carbonFactor = CONCRETE_EOL_FACTORS[eol] ?? 0;
            const co2 = (massTonnes * carbonFactor) / 1000;
            return {
                element: ROLE_LABELS[role], volume: vol, mass: massTonnes,
                grade: concreteGrades?.[role] || 'N/A', eol, carbonFactor, co2
            };
        }).filter(Boolean);

        const steel = STRUCTURAL_ROLES.map(role => {
            const concreteVol = volumeData[role]?.volume || 0;
            if (concreteVol === 0) return null;
            const pct = DEFAULT_STEEL_PERCENT[role] || 0;
            const steelVol = concreteVol * (pct / 100);
            const massTonnes = (steelVol * STEEL_DENSITY) / 1000;
            const eol = steelEol?.[role] || 'Primary material production';
            const carbonFactor = STEEL_EOL_FACTORS[eol] ?? 0;
            const co2 = (massTonnes * carbonFactor) / 1000;
            return {
                element: ROLE_LABELS[role], steelPercent: pct, mass: massTonnes,
                grade: steelGrades?.[role] || 'N/A', eol, carbonFactor, co2
            };
        }).filter(Boolean);

        const concreteCO2 = concrete.reduce((t, r) => t + r.co2, 0);
        const steelCO2 = steel.reduce((t, r) => t + r.co2, 0);

        return {
            concrete, steel,
            totals: { concreteCO2, steelCO2, grandTotal: concreteCO2 + steelCO2 }
        };
    }, [floors, rccSettings, concreteEol, steelEol, concreteGrades, steelGrades]);

    // ── Send message ──
    const sendMessage = useCallback(async (messageText) => {
        const text = messageText || input.trim();
        if (!text || isLoading) return;

        if (!apiKey) {
            setError('Please enter your Groq API key first.');
            setShowKeyInput(true);
            return;
        }

        setError('');
        setInput('');

        const userMsg = { role: 'user', text, timestamp: Date.now() };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        try {
            const res = await fetch(`${API_BASE_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    context: projectContext,
                    provider: 'groq',
                    model: GROQ_MODEL,
                    apiKey,
                    history: messages.map(m => ({ role: m.role, text: m.text })),
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to get response');

            const assistantMsg = { role: 'model', text: data.reply, timestamp: Date.now() };
            setMessages(prev => [...prev, assistantMsg]);
        } catch (err) {
            setError(err.message);
            const errMsg = { role: 'model', text: `⚠️ Error: ${err.message}`, timestamp: Date.now(), isError: true };
            setMessages(prev => [...prev, errMsg]);
        } finally {
            setIsLoading(false);
        }
    }, [input, isLoading, apiKey, projectContext, messages]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    const clearChat = () => { setMessages([]); setError(''); };

    // ── Markdown renderer ──
    const renderMarkdown = (text) => {
        if (!text) return null;
        const lines = text.split('\n');
        const elements = [];
        let inCodeBlock = false;
        let codeLines = [];

        lines.forEach((line, i) => {
            if (line.startsWith('```')) {
                if (inCodeBlock) {
                    elements.push(
                        <pre key={`code-${i}`} className="bg-black/40 rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono text-green-300 border border-slate-700">
                            <code>{codeLines.join('\n')}</code>
                        </pre>
                    );
                    codeLines = []; inCodeBlock = false;
                } else { inCodeBlock = true; }
                return;
            }
            if (inCodeBlock) { codeLines.push(line); return; }

            if (line.startsWith('### ')) {
                elements.push(<h4 key={i} className="text-sm font-bold text-white mt-3 mb-1">{fmt(line.slice(4))}</h4>);
            } else if (line.startsWith('## ')) {
                elements.push(<h3 key={i} className="text-base font-bold text-white mt-4 mb-1">{fmt(line.slice(3))}</h3>);
            } else if (line.startsWith('# ')) {
                elements.push(<h2 key={i} className="text-lg font-bold text-white mt-4 mb-2">{fmt(line.slice(2))}</h2>);
            } else if (line.match(/^\s*[-*]\s/)) {
                const indent = line.match(/^\s*/)[0].length;
                elements.push(
                    <div key={i} className="flex gap-2 my-0.5" style={{ paddingLeft: `${indent * 8 + 8}px` }}>
                        <span className="text-emerald-400 mt-0.5">•</span>
                        <span className="text-slate-300 text-sm">{fmt(line.replace(/^\s*[-*]\s/, ''))}</span>
                    </div>
                );
            } else if (line.match(/^\s*\d+\.\s/)) {
                const num = line.match(/^\s*(\d+)\./)[1];
                elements.push(
                    <div key={i} className="flex gap-2 my-0.5 pl-2">
                        <span className="text-emerald-400 text-sm font-bold min-w-[1.5rem]">{num}.</span>
                        <span className="text-slate-300 text-sm">{fmt(line.replace(/^\s*\d+\.\s/, ''))}</span>
                    </div>
                );
            } else if (line.includes('|') && line.trim().startsWith('|')) {
                if (line.match(/^\|[\s-:|]+\|$/)) return;
                const cells = line.split('|').filter(c => c.trim());
                elements.push(
                    <div key={i} className="flex gap-0 my-0 text-xs font-mono">
                        {cells.map((cell, j) => (
                            <span key={j} className="px-2 py-1 border-b border-slate-700 text-slate-300 flex-1 truncate">{fmt(cell.trim())}</span>
                        ))}
                    </div>
                );
            } else if (line.trim() === '') {
                elements.push(<div key={i} className="h-2" />);
            } else {
                elements.push(<p key={i} className="text-slate-300 text-sm my-0.5">{fmt(line)}</p>);
            }
        });
        return elements;
    };

    const fmt = (text) => {
        const parts = text.split(/(\*\*[^*]+\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
            }
            const codeParts = part.split(/(`[^`]+`)/g);
            return codeParts.map((cp, j) => {
                if (cp.startsWith('`') && cp.endsWith('`')) {
                    return <code key={`${i}-${j}`} className="bg-slate-800 text-emerald-300 px-1 py-0.5 rounded text-xs font-mono">{cp.slice(1, -1)}</code>;
                }
                return cp;
            });
        });
    };

    const hasData = projectContext.concrete.length > 0 || projectContext.steel.length > 0;
    const isReady = !!apiKey;

    return (
        <div className="w-full h-full bg-slate-900 text-slate-200 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
                        <Sparkles size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white">AI Sustainability Advisor</h1>
                        <p className="text-xs text-slate-500">Powered by Groq · {GROQ_MODEL}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* API Key toggle button */}
                    <button
                        onClick={() => setShowKeyInput(!showKeyInput)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition ${apiKey
                            ? 'bg-emerald-900/30 border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/50'
                            : 'bg-amber-900/30 border-amber-500/30 text-amber-300 hover:bg-amber-900/50'
                            }`}
                        title={apiKey ? 'API key configured' : 'Set API key'}
                    >
                        <Key size={13} />
                        {apiKey ? 'Key Set' : 'Set API Key'}
                    </button>

                    <button
                        onClick={clearChat}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition border border-slate-700"
                        title="Clear chat"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* API Key Input (collapsible) */}
            {showKeyInput && (
                <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/50 flex items-center gap-3 shrink-0">
                    <Key size={16} className="text-slate-400 shrink-0" />
                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter your Groq API key..."
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500 transition placeholder:text-slate-500 font-mono"
                    />
                    <a
                        href="https://console.groq.com/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-violet-400 hover:text-violet-300 underline whitespace-nowrap"
                    >
                        Get free key
                    </a>
                    {apiKey && (
                        <button
                            onClick={() => { setApiKey(''); }}
                            className="text-xs text-red-400 hover:text-red-300 whitespace-nowrap"
                        >
                            Clear
                        </button>
                    )}
                </div>
            )}



            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/20 flex items-center justify-center">
                            <Sparkles size={36} className="text-violet-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white mb-2">AI Sustainability Advisor</h2>
                            <p className="text-slate-400 text-sm max-w-md">
                                Generate sustainability reports, get greener alternatives, and analyze your structure's carbon impact.
                            </p>
                        </div>

                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs ${hasData ? 'bg-emerald-900/20 border border-emerald-500/20 text-emerald-300' : 'bg-amber-900/20 border border-amber-500/20 text-amber-300'}`}>
                            {hasData ? (
                                <>
                                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                                    {projectContext.concrete.length + projectContext.steel.length} elements loaded from BOQ
                                </>
                            ) : (
                                <>
                                    <AlertCircle size={14} />
                                    No BOQ data — upload floor plans first
                                </>
                            )}
                        </div>

                        {!apiKey && (
                            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-900/20 border border-amber-500/30 text-amber-300 text-sm">
                                <Key size={14} /> Set your Groq API key to get started →
                                <button onClick={() => setShowKeyInput(true)} className="underline hover:text-amber-200">Add Key</button>
                            </div>
                        )}

                        {hasData && isReady && (
                            <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
                                {QUICK_PROMPTS.map((qp, i) => (
                                    <button
                                        key={i}
                                        onClick={() => sendMessage(qp.prompt)}
                                        className="text-left p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-violet-500/30 hover:bg-slate-800 transition group"
                                    >
                                        <span className="text-lg">{qp.icon}</span>
                                        <p className="text-sm font-medium text-slate-300 group-hover:text-white mt-1">{qp.label}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'model' && (
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 mt-1">
                                <Bot size={16} className="text-white" />
                            </div>
                        )}
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user'
                            ? 'bg-violet-600 text-white rounded-br-sm'
                            : msg.isError
                                ? 'bg-red-900/20 border border-red-500/20 rounded-bl-sm'
                                : 'bg-slate-800/60 border border-slate-700/50 rounded-bl-sm'
                            }`}>
                            {msg.role === 'user' ? (
                                <p className="text-sm">{msg.text}</p>
                            ) : (
                                <div className="prose-sm">{renderMarkdown(msg.text)}</div>
                            )}
                        </div>
                        {msg.role === 'user' && (
                            <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center shrink-0 mt-1">
                                <User size={16} className="text-slate-300" />
                            </div>
                        )}
                    </div>
                ))}

                {isLoading && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0">
                            <Bot size={16} className="text-white" />
                        </div>
                        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl rounded-bl-sm px-4 py-3">
                            <div className="flex gap-1.5 items-center">
                                <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                <span className="text-xs text-slate-500 ml-2">Analyzing with Groq...</span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-800 bg-slate-900 shrink-0">
                {error && (
                    <div className="mb-2 px-3 py-2 bg-red-900/20 border border-red-500/20 rounded-lg text-xs text-red-300 flex items-center gap-2">
                        <AlertCircle size={14} /> {error}
                    </div>
                )}
                <div className="flex gap-2 items-end">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isReady ? "Ask about sustainability, carbon reduction, green alternatives..." : "Set your Groq API key to start chatting..."}
                        disabled={!isReady || isLoading}
                        rows={1}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-violet-500 transition resize-none placeholder:text-slate-500 disabled:opacity-50"
                        style={{ minHeight: '44px', maxHeight: '120px' }}
                    />
                    <button
                        onClick={() => sendMessage()}
                        disabled={!input.trim() || isLoading || !isReady}
                        className="p-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white transition shrink-0"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}

import React, { useState, useRef, useMemo } from 'react';
import { Loader2, Plus, GripVertical, Settings, Settings2, CheckCircle2, Copy, FilePlus, Layers, Trash2, Eye, EyeOff, Upload as UploadIcon, ChevronDown, ChevronRight } from 'lucide-react';
import { ROLE_COLORS, API_BASE_URL } from '../utils';

export default function ProjectDashboard({ floors, setFloors, rccSettings, setRccSettings, onUpload, updateFloorConfig, copyFloor, foundation, setFoundation }) {
    const fileInputRef = useRef(null);
    const [uploadTarget, setUploadTarget] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [expandedFloors, setExpandedFloors] = useState({ 0: true }); // Default first floor open

    // --- File Upload Logic (from Sidebar) ---
    const triggerUpload = (target) => {
        setUploadTarget(target); // e.g., { type: 'floor', index: idx }
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e) => {
        const originalFile = e.target.files[0];
        if (!originalFile || !uploadTarget) return;

        setIsUploading(true);
        try {
            let fileToUpload = originalFile;
            
            // Compress large DXF files using gzip to bypass Vercel's 4.5MB Serverless limit
            if (window.CompressionStream) {
                const ds = new CompressionStream('gzip');
                const compressedStream = originalFile.stream().pipeThrough(ds);
                const reader = compressedStream.getReader();
                const chunks = [];
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                }
                const compressedBlob = new Blob(chunks, { type: 'application/gzip' });
                fileToUpload = new File([compressedBlob], originalFile.name + '.gz', { type: 'application/gzip' });
            }

            const formData = new FormData();
            formData.append('file', fileToUpload);

            // Check if backend is reachable (port 5000)
            const response = await fetch(`${API_BASE_URL}/upload`, {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();

            if (uploadTarget.type === 'foundation') {
                const newConfig = {};
                data.layers.forEach(layer => {
                    // Default foundation layers generic
                    newConfig[layer.id] = { visible: true, color: '#ffffff', role: 'generic' };
                });
                setFoundation({ dxfData: data, config: newConfig });
            } else if (uploadTarget.type === 'floor') {
                onUpload(data, uploadTarget.index);
            } else if (uploadTarget.type === 'columnDetail') {
                updateFloorConfig(uploadTarget.floorIndex, uploadTarget.layerId, { detailDxf: data });
            }

        } catch (err) {
            console.error(err);
            alert(`Upload failed. Cannot connect to backend: ${err.message}`);
        } finally {
            setIsUploading(false);
            setUploadTarget(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="flex h-full bg-slate-900 text-slate-200 overflow-hidden relative">
            {isUploading && (
                <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center">
                    <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
                    <h3 className="text-xl font-bold text-white mb-2">Parsing DXF File...</h3>
                    <p className="text-slate-400 text-sm">Extracting layers and geometry</p>
                </div>
            )}
            {/* Hidden Input for Uploads */}
            <input type="file" accept=".dxf" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

            {/* LEFT PANEL: Setup & Floors */}
            <div className="w-80 flex flex-col border-r border-slate-800 bg-slate-900/50">
                <div className="p-4 border-b border-slate-800">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                        <Settings size={18} className="text-blue-400" />
                        Configuration
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                    {/* Global Settings Group */}
                    <div className="space-y-3 bg-slate-800/40 p-3 rounded-lg border border-slate-700/30">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Project Settings</h3>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] text-slate-500 block mb-1">Unit System</label>
                                <select
                                    value={rccSettings.unitSystem || 'mm'}
                                    onChange={(e) => setRccSettings(p => ({
                                        ...p,
                                        unitSystem: e.target.value,
                                        floorHeight: e.target.value === 'm' ? 5 : 5000,
                                        beamDepth: e.target.value === 'm' ? 0.45 : 450,
                                        slabThickness: e.target.value === 'm' ? 1 : 1000
                                    }))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white outline-none focus:border-blue-500 transition"
                                >
                                    <option value="mm">Millimeters</option>
                                    <option value="m">Meters</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 block mb-1">Total Floors</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={rccSettings.numFloors}
                                    onChange={(e) => setRccSettings(p => ({ ...p, numFloors: parseInt(e.target.value) || 1 }))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white outline-none focus:border-blue-500 transition"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div>
                                <label className="text-[10px] text-slate-500 block mb-1">Floor Height ({rccSettings.unitSystem})</label>
                                <input type="number" value={rccSettings.floorHeight} onChange={(e) => setRccSettings(p => ({ ...p, floorHeight: parseFloat(e.target.value) }))} className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs outline-none" />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 block mb-1">Floor Gap / Offset ({rccSettings.unitSystem})</label>
                                <input type="number" step="0.1" value={rccSettings.floorGap ?? 0.3} onChange={(e) => setRccSettings(p => ({ ...p, floorGap: parseFloat(e.target.value) || 0 }))} className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs outline-none" />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 block mb-1">Stirrup Spacing ({rccSettings.unitSystem})</label>
                                <input type="number" step="0.01" value={rccSettings.stirrupSpacing ?? (rccSettings.unitSystem === 'm' ? 0.15 : 150)} onChange={(e) => setRccSettings(p => ({ ...p, stirrupSpacing: parseFloat(e.target.value) || (rccSettings.unitSystem === 'm' ? 0.15 : 150) }))} className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs outline-none" />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="ar" checked={rccSettings.autoRotate} onChange={(e) => setRccSettings(p => ({ ...p, autoRotate: e.target.checked }))} className="rounded border-slate-700 bg-slate-900" />
                            <label htmlFor="ar" className="text-xs text-slate-400">Auto Rotate View</label>
                        </div>
                    </div>

                    {/* Floor Management */}
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Floor Plans</h3>

                        {/* Foundation Upload */}
                        <div className={`p-2 rounded border ${foundation ? 'border-orange-500/30 bg-orange-500/5' : 'border-slate-700 bg-slate-800/20'} transition-all mb-2`}>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold text-slate-300">Foundation</span>
                                <button
                                    onClick={() => triggerUpload({ type: 'foundation' })}
                                    className="p-1 hover:bg-slate-700 rounded text-orange-400 transition"
                                    title="Upload Foundation DXF"
                                >
                                    <UploadIcon size={14} />
                                </button>
                            </div>
                            <div className="text-[10px] text-slate-500 truncate mb-2">
                                {foundation ? `${foundation.dxfData.layers.length} Layers Loaded` : 'No file uploaded'}
                            </div>

                            {foundation && (
                                <div>
                                    <label className="text-[10px] text-slate-400 block mb-1">Depth Below Floor 1 (m)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-slate-200 outline-none focus:border-orange-500"
                                        value={foundation.depthOffset || 2}
                                        onChange={(e) => setFoundation(prev => ({ ...prev, depthOffset: parseFloat(e.target.value) }))}
                                        step="0.1"
                                    />
                                </div>
                            )}
                        </div>
                        {Array.from({ length: rccSettings.numFloors }).map((_, idx) => {
                            const floorData = floors[idx];
                            const availableSources = floors.map((f, i) => (f && i !== idx ? i : null)).filter((i) => i !== null);

                            return (
                                <div key={idx} className={`p-2 rounded border ${floorData ? 'border-green-500/30 bg-green-500/5' : 'border-slate-700 bg-slate-800/20'} transition-all`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-semibold text-slate-300">Floor {idx + 1}</span>
                                        <button
                                            onClick={() => triggerUpload({ type: 'floor', index: idx })}
                                            className="p-1 hover:bg-slate-700 rounded text-blue-400 transition"
                                            title="Upload DXF"
                                        >
                                            <UploadIcon size={14} />
                                        </button>
                                    </div>
                                    <div className="text-[10px] text-slate-500 truncate">
                                        {floorData ? `${floorData.dxfData.layers.length} Layers Loaded` : 'No file uploaded'}
                                    </div>

                                    {/* Copy From UI */}
                                    {availableSources.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-slate-700/50">
                                            <select
                                                className="w-full bg-slate-900 text-[10px] text-slate-400 border border-slate-700 rounded p-1 outline-none focus:border-blue-500"
                                                defaultValue=""
                                                onChange={(e) => {
                                                    if (e.target.value !== "") {
                                                        const src = parseInt(e.target.value);
                                                        copyFloor(src, idx);
                                                        e.target.value = "";
                                                    }
                                                }}
                                            >
                                                <option value="" disabled>Copy from...</option>
                                                {availableSources.map(srcIdx => (
                                                    <option key={srcIdx} value={srcIdx}>Floor {srcIdx + 1}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* MIDDLE PANEL: Layer Configuration */}
            <div className="flex-1 flex flex-col min-w-0">
                <div className="p-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur z-10 sticky top-0">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                        <Layers size={18} className="text-purple-400" />
                        Layer Mapping
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {/* Foundation Mapping */}
                    {foundation && (
                        <div className="mb-8 border-b border-slate-800 pb-8">
                            <div className="flex items-center gap-2 mb-4 sticky top-0 bg-slate-900 py-2 z-10 border-b border-slate-800">
                                <div className="w-1 h-4 bg-orange-500 rounded-full"></div>
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Foundation / Footing</h3>
                                <span className="text-xs text-slate-500 ml-auto">{foundation.dxfData.layers.length} Layers</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {foundation.dxfData.layers.map(layer => {
                                    const layerConfig = foundation.config[layer.id];
                                    const role = layerConfig.role || 'generic';
                                    const displayColor = ROLE_COLORS[role] || layerConfig.color;

                                    return (
                                        <div key={layer.id} className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 hover:border-slate-600 transition group">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <span className="text-sm font-medium text-slate-200 truncate" title={layer.name}>{layer.name}</span>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const newConfig = { ...foundation.config, [layer.id]: { ...layerConfig, visible: !layerConfig.visible } };
                                                        setFoundation({ ...foundation, config: newConfig });
                                                    }}
                                                    className={`transition ${layerConfig.visible ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-400'}`}
                                                >
                                                    {layerConfig.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                                                </button>
                                            </div>

                                            <div className="space-y-2">
                                                <div>
                                                    <label className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1 block">Role</label>
                                                    <select
                                                        className="bg-slate-800 text-xs text-slate-300 border border-slate-600 rounded p-1.5 w-full focus:ring-1 focus:ring-blue-500 outline-none"
                                                        value={layerConfig.role}
                                                        onChange={(e) => {
                                                            const newConfig = { ...foundation.config, [layer.id]: { ...layerConfig, role: e.target.value } };
                                                            setFoundation({ ...foundation, config: newConfig });
                                                        }}
                                                    >
                                                        <option value="generic">Generic</option>
                                                        <option value="footing_base">Footing Base (Rectangle)</option>
                                                        <option value="footing_slope">Footing Slope (Top Rect)</option>
                                                        <option value="column">Column (Stump)</option>
                                                    </select>

                                                    {/* Conditional Inputs */}
                                                    {(role === 'footing_base' || role === 'footing_slope') && (
                                                        <div className="mt-2 space-y-2">
                                                            <div>
                                                                <label className="text-[10px] text-slate-400 block">Thickness / Height</label>
                                                                <input
                                                                    type="number"
                                                                    className="w-full bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-xs text-slate-200"
                                                                    value={layerConfig.height || (role === 'footing_base' ? 0.5 : 0.5)}
                                                                    onChange={(e) => {
                                                                        const newConfig = { ...foundation.config, [layer.id]: { ...layerConfig, height: parseFloat(e.target.value) } };
                                                                        setFoundation({ ...foundation, config: newConfig });
                                                                    }}
                                                                />
                                                            </div>
                                                            {role === 'footing_base' && (
                                                                <div>
                                                                    <label className="text-[10px] text-slate-400 block">Excavation Depth</label>
                                                                    <input
                                                                        type="number"
                                                                        className="w-full bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-xs text-slate-200"
                                                                        value={layerConfig.depth || (rccSettings.unitSystem === 'm' ? 1.5 : 1500)}
                                                                        onChange={(e) => {
                                                                            const newConfig = { ...foundation.config, [layer.id]: { ...layerConfig, depth: parseFloat(e.target.value) } };
                                                                            setFoundation({ ...foundation, config: newConfig });
                                                                        }}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {(!floors.length || floors.every(f => !f)) && !foundation ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-50">
                            <UploadIcon size={48} className="mb-4" />
                            <p>Upload a DXF file to configure layers</p>
                        </div>
                    ) : (
                        floors.map((floor, fIdx) => {
                            if (!floor || !floor.dxfData) return null;
                            const isExpanded = expandedFloors[fIdx] !== false; // Default open if undefined

                            return (
                                <div key={fIdx} className="mb-8">
                                    <div
                                        className="flex items-center gap-2 mb-4 sticky top-0 bg-slate-900 py-2 z-10 border-b border-slate-800 cursor-pointer hover:bg-slate-800/50 transition px-2 rounded"
                                        onClick={() => setExpandedFloors(prev => ({ ...prev, [fIdx]: !isExpanded }))}
                                    >
                                        {isExpanded ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronRight size={20} className="text-slate-400" />}
                                        <div className="w-1 h-4 bg-purple-500 rounded-full"></div>
                                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Floor {fIdx + 1}</h3>
                                        <span className="text-xs text-slate-500 ml-auto">{floor.dxfData.layers.length} Layers</span>
                                    </div>

                                    {isExpanded && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                            {floor.dxfData.layers.map(layer => {
                                                const layerConfig = floor.config[layer.id];
                                                const role = layerConfig.role || 'generic';
                                                const displayColor = ROLE_COLORS[role] || layerConfig.color;

                                                return (
                                                    <div key={layer.id} className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 hover:border-slate-600 transition group">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                <span className="text-sm font-medium text-slate-200 truncate" title={layer.name}>{layer.name}</span>
                                                            </div>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    updateFloorConfig(fIdx, layer.id, { visible: !layerConfig.visible });
                                                                }}
                                                                className={`transition ${layerConfig.visible ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-400'}`}
                                                            >
                                                                {layerConfig.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                                                            </button>
                                                        </div>

                                                        <div className="space-y-2" onClick={e => e.stopPropagation()}>
                                                            <div>
                                                                <label className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1 block">Role</label>
                                                                <select
                                                                    className="bg-slate-800 text-xs text-slate-300 border border-slate-600 rounded p-1.5 w-full focus:ring-1 focus:ring-blue-500 outline-none"
                                                                    value={layerConfig.role}
                                                                    onChange={(e) => updateFloorConfig(fIdx, layer.id, { role: e.target.value })}
                                                                >
                                                                    <option value="generic">Generic (Decoration)</option>
                                                                    <option value="column">Column (Yellow)</option>
                                                                    <option value="beam">Beam (Green)</option>
                                                                    <option value="slab">Slab (Blue)</option>
                                                                    <option value="wall">Wall (Red)</option>
                                                                    <option value="brick_wall">Brick Wall (Orange)</option>
                                                                    <option value="window">Window (Cyan)</option>
                                                                    <option value="door">Door (Brown)</option>
                                                                    <option value="wc">WC (Purple)</option>
                                                                </select>

                                                                {/* Conditional Inputs */}
                                                                {role === 'column' && (
                                                                    <div className="mt-3 p-2 bg-slate-900/50 rounded border border-slate-700">
                                                                        <div className="flex items-center justify-between mb-1">
                                                                            <span className="text-[10px] text-slate-400 font-bold uppercase">Column Details</span>
                                                                            {layerConfig.detailDxf && (
                                                                                <button
                                                                                    className="text-[10px] text-red-400 hover:text-red-300 transition"
                                                                                    onClick={() => updateFloorConfig(fIdx, layer.id, { detailDxf: null })}
                                                                                >
                                                                                    Remove
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                        {layerConfig.detailDxf ? (
                                                                            <div className="text-[10px] text-green-400 flex items-center gap-1">
                                                                                <CheckCircle2 size={12} />
                                                                                DXF Attached ({layerConfig.detailDxf.layers.length} layers)
                                                                            </div>
                                                                        ) : (
                                                                            <button
                                                                                className="w-full flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 py-1 rounded transition border border-slate-600"
                                                                                onClick={() => triggerUpload({ type: 'columnDetail', floorIndex: fIdx, layerId: layer.id })}
                                                                            >
                                                                                <UploadIcon size={12} />
                                                                                Upload Detail DXF
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {role === 'wall' && (
                                                                    <div className="mt-2">
                                                                        <label className="text-[10px] text-slate-400 block">Height (m/mm)</label>
                                                                        <input
                                                                            type="number"
                                                                            className="w-full bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-xs text-slate-200"
                                                                            value={layerConfig.extrusion ?? ''}
                                                                            placeholder={`Default: ${rccSettings.floorHeight - rccSettings.beamDepth}`}
                                                                            onChange={(e) => updateFloorConfig(fIdx, layer.id, { extrusion: e.target.value ? parseFloat(e.target.value) : undefined })}
                                                                        />
                                                                    </div>
                                                                )}
                                                                {role === 'beam' && (
                                                                    <div className="mt-2">
                                                                        <label className="text-[10px] text-slate-400 block">Depth (m/mm)</label>
                                                                        <input
                                                                            type="number"
                                                                            className="w-full bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-xs text-slate-200"
                                                                            value={layerConfig.extrusion ?? ''}
                                                                            placeholder={`Default: ${rccSettings.beamDepth}`}
                                                                            onChange={(e) => updateFloorConfig(fIdx, layer.id, { extrusion: e.target.value ? parseFloat(e.target.value) : undefined })}
                                                                        />
                                                                    </div>
                                                                )}
                                                                {role === 'slab' && (
                                                                    <div className="mt-2">
                                                                        <label className="text-[10px] text-slate-400 block">Thickness (m/mm)</label>
                                                                        <input
                                                                            type="number"
                                                                            className="w-full bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-xs text-slate-200"
                                                                            value={layerConfig.extrusion ?? ''}
                                                                            placeholder={`Default: ${rccSettings.slabThickness}`}
                                                                            onChange={(e) => updateFloorConfig(fIdx, layer.id, { extrusion: e.target.value ? parseFloat(e.target.value) : undefined })}
                                                                        />
                                                                    </div>
                                                                )}

                                                                {/* Conditional Inputs for Window/Door */}
                                                                {role === 'window' && (
                                                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                                                        <div>
                                                                            <label className="text-[10px] text-slate-400 block">Height</label>
                                                                            <input
                                                                                type="number"
                                                                                className="w-full bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-xs text-slate-200"
                                                                                value={layerConfig.height || (rccSettings.unitSystem === 'm' ? 2 : 2000)}
                                                                                onChange={(e) => updateFloorConfig(fIdx, layer.id, { height: parseFloat(e.target.value) })}
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label className="text-[10px] text-slate-400 block">Sill</label>
                                                                            <input
                                                                                type="number"
                                                                                className="w-full bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-xs text-slate-200"
                                                                                value={layerConfig.sill || (rccSettings.unitSystem === 'm' ? 1 : 1000)}
                                                                                onChange={(e) => updateFloorConfig(fIdx, layer.id, { sill: parseFloat(e.target.value) })}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {role === 'door' && (
                                                                    <div className="mt-2">
                                                                        <div>
                                                                            <label className="text-[10px] text-slate-400 block">Height</label>
                                                                            <input
                                                                                type="number"
                                                                                className="w-full bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-xs text-slate-200"
                                                                                value={layerConfig.height || (rccSettings.unitSystem === 'm' ? 3 : 3000)}
                                                                                onChange={(e) => updateFloorConfig(fIdx, layer.id, { height: parseFloat(e.target.value) })}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}

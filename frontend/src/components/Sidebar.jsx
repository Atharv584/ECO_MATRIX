import React, { useState, useRef } from 'react';
import { Eye, EyeOff, Layers, Ruler, Upload as UploadIcon, Plus, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../utils';

export default function Sidebar({ floors, updateFloorConfig, measurements, rccSettings, setRccSettings, onUpload }) {
    const [activeTab, setActiveTab] = useState('floors');
    const fileInputRef = useRef(null);
    const [uploadingFloorIndex, setUploadingFloorIndex] = useState(null);

    const triggerUpload = (index) => {
        setUploadingFloorIndex(index);
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file || uploadingFloorIndex === null) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_BASE_URL}/upload`, {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();
            onUpload(data, uploadingFloorIndex);
        } catch (err) {
            console.error(err);
            alert('Upload failed');
        } finally {
            setUploadingFloorIndex(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="w-80 h-full glass-panel flex flex-col z-10 border-r border-glassBorder">
            {/* Hidden Input */}
            <input type="file" accept=".dxf" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

            <div className="p-4 border-b border-glassBorder">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                    ECO-MATRIX
                </h1>
                <div className="flex gap-2 mt-4">
                    <button onClick={() => setActiveTab('floors')} className={`p-2 rounded-lg flex-1 text-xs font-bold transition ${activeTab === 'floors' ? 'bg-blue-500/20 text-blue-300' : 'hover:bg-white/5 text-slate-400'}`}>
                        Floors
                    </button>
                    <button onClick={() => setActiveTab('layers')} className={`p-2 rounded-lg flex-1 text-xs font-bold transition ${activeTab === 'layers' ? 'bg-blue-500/20 text-blue-300' : 'hover:bg-white/5 text-slate-400'}`}>
                        Layers
                    </button>
                    <button onClick={() => setActiveTab('boq')} className={`p-2 rounded-lg flex-1 text-xs font-bold transition ${activeTab === 'boq' ? 'bg-blue-500/20 text-blue-300' : 'hover:bg-white/5 text-slate-400'}`}>
                        BOQ
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {activeTab === 'floors' ? (
                    <div className="space-y-6">
                        {/* Global Settings */}
                        <div className="space-y-3 p-3 bg-slate-800/40 rounded-lg">
                            <h3 className="text-sm font-semibold text-slate-300 mb-2">Global Config</h3>

                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs text-slate-400">Drawing Units</label>
                                <select
                                    value={rccSettings.unitSystem || 'mm'}
                                    onChange={(e) => setRccSettings(p => ({
                                        ...p,
                                        unitSystem: e.target.value,
                                        // Reset defaults based on unit
                                        floorHeight: e.target.value === 'm' ? 3 : 3000,
                                        beamDepth: e.target.value === 'm' ? 0.45 : 450,
                                        slabThickness: e.target.value === 'm' ? 1 : 1000
                                    }))}
                                    className="bg-slate-900 border border-slate-700 rounded p-1 text-xs text-slate-200"
                                >
                                    <option value="mm">Millimeters</option>
                                    <option value="m">Meters</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400">Total Floors</label>
                                <input type="number" min="1" value={rccSettings.numFloors} onChange={(e) => setRccSettings(p => ({ ...p, numFloors: parseInt(e.target.value) || 1 }))} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-slate-200" />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400">Floor Height ({rccSettings.unitSystem === 'm' ? 'm' : 'mm'})</label>
                                <input type="number" value={rccSettings.floorHeight} onChange={(e) => setRccSettings(p => ({ ...p, floorHeight: parseFloat(e.target.value) || 0 }))} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-slate-200" />
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                                <input type="checkbox" checked={rccSettings.autoRotate} onChange={(e) => setRccSettings(p => ({ ...p, autoRotate: e.target.checked }))} />
                                <span className="text-xs text-slate-400">Auto Rotate View</span>
                            </div>
                        </div>

                        {/* Floor Manager */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-slate-300">Floor Plans</h3>
                            {Array.from({ length: rccSettings.numFloors }).map((_, idx) => {
                                const floorData = floors[idx];
                                return (
                                    <div key={idx} className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/50 flex items-center justify-between">
                                        <div>
                                            <div className="text-sm font-medium text-slate-200">Floor {idx + 1}</div>
                                            <div className="text-xs text-slate-500">
                                                {floorData ? `${floorData.dxfData.layers.length} Layers` : 'No file uploaded'}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => triggerUpload(idx)}
                                            className="p-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 rounded transition"
                                            title="Upload DXF"
                                        >
                                            <UploadIcon size={14} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : activeTab === 'layers' ? (
                    <div className="space-y-4">
                        <p className="text-xs text-slate-500 mb-2">Configure layers per floor.</p>
                        {floors.map((floor, fIdx) => {
                            if (!floor || !floor.dxfData) return null;
                            return (
                                <div key={fIdx} className="mb-4">
                                    <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Floor {fIdx + 1} Layers</h4>
                                    {floor.dxfData.layers.map(layer => {
                                        const layerConfig = floor.config[layer.id];
                                        return (
                                            <div key={layer.id} className="flex items-center justify-between mb-2 p-2 bg-slate-800/30 rounded">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <div className="w-3 h-3 rounded-full" style={{ background: layerConfig.color }}></div>
                                                    <span className="text-xs text-slate-300 truncate w-20" title={layer.name}>{layer.name}</span>
                                                </div>
                                                <select
                                                    className="bg-slate-900 text-xs text-slate-400 border border-slate-700 rounded px-1 py-0.5 w-24"
                                                    value={layerConfig.role}
                                                    onChange={(e) => updateFloorConfig(fIdx, layer.id, { role: e.target.value })}
                                                >
                                                    <option value="generic">Generic</option>
                                                    <option value="column">Column</option>
                                                    <option value="beam">Beam</option>
                                                    <option value="slab">Slab</option>
                                                    <option value="wall">Wall</option>
                                                </select>
                                                <button onClick={() => updateFloorConfig(fIdx, layer.id, { visible: !layerConfig.visible })}>
                                                    {layerConfig.visible ? <Eye size={14} className="text-slate-400" /> : <EyeOff size={14} className="text-slate-600" />}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                        {(!floors.length || floors.every(f => !f)) && <div className="text-slate-500 text-sm text-center mt-10">Upload a floor plan first.</div>}
                    </div>
                ) : (
                    <div className="text-slate-300 text-sm p-4 text-center">
                        The BOQ Table is displayed on the main screen for better visibility.
                    </div>
                )}
            </div>
        </div>
    );
}

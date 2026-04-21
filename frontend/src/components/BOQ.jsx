import React, { useMemo } from 'react';
import { calculateMeasurements } from '../utils';

export default function BOQ({ floors, rccSettings }) {
    const boqData = useMemo(() => {
        const summary = {
            column: { count: 0, length: 0, area: 0, volume: 0 },
            beam: { count: 0, length: 0, area: 0, volume: 0 },
            slab: { count: 0, length: 0, area: 0, volume: 0 },
            wall: { count: 0, length: 0, area: 0, volume: 0 },
            generic: { count: 0, length: 0, area: 0, volume: 0 },
        };

        floors.forEach((floor) => {
            if (!floor || !floor.dxfData) return;

            // Recalculate stats for THIS floor using the util
            // We pass numFloors=1 to the util because we are iterating floor by floor here manually
            // BUT wait, utils.js was designed to multiply by numFloors.
            // We should use utils.js on a PER FLOOR basis.
            // So we pass rccSettings override with numFloors: 1.

            const floorStats = calculateMeasurements(
                floor.dxfData.layers,
                floor.config,
                { ...rccSettings, numFloors: 1 }
            );

            // Aggregate by Role
            floor.dxfData.layers.forEach(layer => {
                const role = floor.config[layer.id]?.role || 'generic';
                const stats = floorStats.byLayer[layer.id];

                if (stats && summary[role]) {
                    // stats are strings, parse them
                    summary[role].count += layer.entities.length; // Approximate count
                    summary[role].volume += parseFloat(stats.volume);
                    summary[role].area += parseFloat(stats.area);
                }
            });
        });

        return summary;
    }, [floors, rccSettings]);

    // Helper to format in Meters
    // Input Stats are ALREADY in Meters (from utils.js calculation)
    const fmtVol = (v) => parseFloat(v).toFixed(2);
    const fmtArea = (v) => parseFloat(v).toFixed(2);

    return (
        <div className="absolute top-20 right-4 w-80 bg-slate-800/90 backdrop-blur glass-panel border border-slate-700 rounded-xl p-4 shadow-xl z-20">
            <h2 className="text-lg font-bold text-white mb-4 border-b border-slate-600 pb-2">Bill of Quantities</h2>

            <div className="space-y-4">
                {Object.entries(boqData).map(([role, stats]) => {
                    if (stats.volume === 0 && stats.area === 0) return null;
                    const label = role.charAt(0).toUpperCase() + role.slice(1);
                    return (
                        <div key={role} className="bg-slate-700/50 rounded p-3">
                            <div className="flex justify-between items-center mb-1">
                                <span className={`font-bold text-sm ${role === 'column' ? 'text-yellow-400' : role === 'beam' ? 'text-green-400' : role === 'slab' ? 'text-blue-400' : 'text-red-400'}`}>
                                    {label}s
                                </span>
                                <span className="text-xs text-slate-400">{stats.count} Ent.</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <span className="block text-slate-500">Volume</span>
                                    <span className="text-slate-200 font-mono">{fmtVol(stats.volume)} m³</span>
                                </div>
                                <div>
                                    <span className="block text-slate-500">Area (Plan)</span>
                                    <span className="text-slate-200 font-mono">{fmtArea(stats.area)} m²</span>
                                </div>
                            </div>
                        </div>
                    );
                })}

                <div className="pt-2 border-t border-slate-600 mt-2">
                    <div className="flex justify-between items-center text-sm font-bold text-white">
                        <span>TOTAL CONCRETE</span>
                        <span>{fmtVol(Object.values(boqData).reduce((a, b) => a + b.volume, 0))} m³</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

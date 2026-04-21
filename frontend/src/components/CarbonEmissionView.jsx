import React, { useMemo, useState } from 'react';
import { calculateMeasurements, ROLE_COLORS } from '../utils';
import { Leaf, FileDown, FileText, Building2, Layers, BarChart3 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Density
const CONCRETE_DENSITY = 2400; // kg/m³
const STEEL_DENSITY = 7850;    // kg/m³
const BRICK_DENSITY = 1920;    // kg/m³

const STRUCTURAL_ROLES = ['column', 'beam', 'slab', 'wall'];
const DEFAULT_STEEL_PERCENT = { column: 5, beam: 4, slab: 4, wall: 4 };

// Carbon factors by EOL type (kg CO₂e per tonne) — from spreadsheet
const CONCRETE_EOL_FACTORS = {
    'Primary material prod': 118.79306,
    'Closed-loop source': 3.21835,
};

const STEEL_EOL_FACTORS = {
    'Primary material production': 3824.09335,
    'Closed-loop source': 1638.74406,
};

const ROLE_LABELS = {
    column: 'Columns', beam: 'Beams', slab: 'Slabs', wall: 'Walls', brick_wall: 'Brick Walls',
    footing_base: 'Footing Base', footing_slope: 'Footing Slope',
};

export default function CarbonEmissionView({ floors, rccSettings, concreteEol, steelEol, foundation, setConcreteEol, setSteelEol }) {
    const getStored = (key, defaultVal) => {
        try {
            const saved = localStorage.getItem('ecomatrix_carbon_draft_' + key);
            return saved ? JSON.parse(saved) : defaultVal;
        } catch { return defaultVal; }
    };

    const [steelPercent, setSteelPercent] = useState(() => getStored('steelPercent', DEFAULT_STEEL_PERCENT));

    // Per-element factor overrides (initialized from EOL, but editable)
    const [concreteFactorOverrides, setConcreteFactorOverrides] = useState(() => getStored('concreteFactorOverrides', {}));
    const [steelFactorOverrides, setSteelFactorOverrides] = useState(() => getStored('steelFactorOverrides', {}));

    React.useEffect(() => {
        localStorage.setItem('ecomatrix_carbon_draft_steelPercent', JSON.stringify(steelPercent));
        localStorage.setItem('ecomatrix_carbon_draft_concreteFactorOverrides', JSON.stringify(concreteFactorOverrides));
        localStorage.setItem('ecomatrix_carbon_draft_steelFactorOverrides', JSON.stringify(steelFactorOverrides));
    }, [steelPercent, concreteFactorOverrides, steelFactorOverrides]);

    // Get factor: use override if user edited it, else auto from EOL type
    const getConcreteFactor = (role) => {
        if (concreteFactorOverrides[role] !== undefined) return concreteFactorOverrides[role];
        if (role === 'brick_wall') return 0;
        const eol = concreteEol[role] || 'Primary material prod';
        return CONCRETE_EOL_FACTORS[eol] ?? 0;
    };
    const getSteelFactor = (role) => {
        if (steelFactorOverrides[role] !== undefined) return steelFactorOverrides[role];
        const eol = steelEol[role] || 'Closed-loop source';
        return STEEL_EOL_FACTORS[eol] ?? 0;
    };

    // ── Gather volumes ──
    const volumeData = useMemo(() => {
        const summary = {};
        ['column', 'beam', 'slab', 'wall', 'brick_wall', 'footing_base', 'footing_slope'].forEach(r => {
            summary[r] = { volume: 0 };
        });
        [foundation, ...floors].filter(Boolean).forEach(floor => {
            if (!floor?.dxfData) return;
            const floorStats = calculateMeasurements(
                floor.dxfData.layers, floor.config,
                { ...rccSettings, numFloors: 1 }
            );
            if (floorStats.extraWallStats) {
                summary.wall.volume += parseFloat(floorStats.extraWallStats.volume);
            }
            floor.dxfData.layers.forEach(layer => {
                const role = floor.config[layer.id]?.role || 'generic';
                const stats = floorStats.byLayer[layer.id];
                if (stats && summary[role]) {
                    summary[role].volume += parseFloat(stats.volume);
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
                        if (stats && summary['slab']) {
                            summary['slab'].volume += parseFloat(stats.volume);
                        }
                    }
                });
            }
        }

        return summary;
    }, [floors, rccSettings]);

    const fmt = (v) => v?.toFixed(2) || '0.00';

    const ALL_CONCRETE_ROLES = ['column', 'beam', 'slab', 'wall', 'brick_wall', 'footing_base', 'footing_slope'];
    const concreteRows = ALL_CONCRETE_ROLES.map(role => {
        const vol = volumeData[role]?.volume || 0;
        const massTonnes = (vol * (role === 'brick_wall' ? BRICK_DENSITY : CONCRETE_DENSITY)) / 1000;
        const factor = getConcreteFactor(role);
        const co2Tonnes = (massTonnes * factor) / 1000;
        const eol = concreteEol[role] || 'Primary material prod';
        return { role, vol, massTonnes, factor, co2Tonnes, eol, hasData: vol > 0 };
    });

    const steelRows = STRUCTURAL_ROLES.map(role => {
        const concreteVol = volumeData[role]?.volume || 0;
        const pct = steelPercent[role] || 0;
        const steelVol = concreteVol * (pct / 100);
        const massTonnes = (steelVol * STEEL_DENSITY) / 1000;
        const factor = getSteelFactor(role);
        const co2Tonnes = (massTonnes * factor) / 1000;
        const eol = steelEol[role] || 'Closed-loop source';
        return { role, massTonnes, factor, co2Tonnes, pct, eol, hasData: concreteVol > 0 };
    });

    const totalConcreteCO2 = concreteRows.reduce((t, r) => t + r.co2Tonnes, 0);
    const totalSteelCO2 = steelRows.reduce((t, r) => t + r.co2Tonnes, 0);
    const grandTotal = totalConcreteCO2 + totalSteelCO2;

    const totalConcreteVol = concreteRows.reduce((t, r) => t + r.vol, 0);
    const totalConcreteMass = concreteRows.reduce((t, r) => t + r.massTonnes, 0);
    const totalSteelMass = steelRows.reduce((t, r) => t + r.massTonnes, 0);

    // ── PDF Report Generation ──
    const generatePDF = () => {
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageW = doc.internal.pageSize.getWidth();
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        let y = 15;

        // ── Header ──
        doc.setFillColor(15, 23, 42); // slate-900
        doc.rect(0, 0, pageW, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('ECO-MATRIX', 14, y + 5);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text('Carbon Emission Assessment Report', 14, y + 13);
        doc.setFontSize(9);
        doc.text(`Generated: ${dateStr} at ${timeStr}`, pageW - 14, y + 5, { align: 'right' });
        y = 48;

        // ── Summary Box ──
        doc.setFillColor(240, 253, 244); // green-50
        doc.setDrawColor(34, 197, 94); // green-500
        doc.roundedRect(14, y, pageW - 28, 22, 3, 3, 'FD');
        doc.setFontSize(10);
        doc.setTextColor(22, 101, 52); // green-800
        doc.setFont('helvetica', 'bold');
        doc.text('TOTAL CARBON FOOTPRINT', 20, y + 9);
        doc.setFontSize(14);
        doc.setTextColor(21, 128, 61); // green-700
        const summaryText = `${fmt(grandTotal)} tonnes CO\u2082e`;
        const maxBoxWidth = pageW - 28 - 12; // box width minus padding
        doc.text(summaryText, pageW - 20, y + 14, { align: 'right', maxWidth: maxBoxWidth * 0.55 });
        y += 30;

        // ── Project Overview ──
        doc.setTextColor(30, 41, 59); // slate-800
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('Project Overview', 14, y);
        y += 2;
        doc.setDrawColor(59, 130, 246); // blue-500
        doc.setLineWidth(0.8);
        doc.line(14, y, 60, y);
        y += 6;

        autoTable(doc, {
            startY: y,
            head: [['Parameter', 'Value']],
            body: [
                ['Total Concrete Volume', `${fmt(totalConcreteVol)} m\u00B3`],
                ['Total Concrete Mass', `${fmt(totalConcreteMass)} tonnes`],
                ['Total Steel Mass', `${fmt(totalSteelMass)} tonnes`],
                ['Concrete CO\u2082e', `${fmt(totalConcreteCO2)} tonnes`],
                ['Steel CO\u2082e', `${fmt(totalSteelCO2)} tonnes`],
                ['Grand Total CO\u2082e', `${fmt(grandTotal)} tonnes`],
            ],
            theme: 'grid',
            headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 9 },
            bodyStyles: { fontSize: 9, textColor: [30, 41, 59] },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 }, 1: { cellWidth: 'auto' } },
            tableWidth: 'wrap',
            margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 12;

        // ── Concrete Emissions Table ──
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('Concrete Emissions Breakdown', 14, y);
        y += 2;
        doc.setDrawColor(16, 185, 129); // emerald-500
        doc.line(14, y, 80, y);
        y += 4;

        const concreteBody = concreteRows.filter(r => r.hasData).map(r => [
            ROLE_LABELS[r.role],
            r.eol,
            fmt(r.vol) + ' m\u00B3',
            fmt(r.massTonnes) + ' t',
            r.factor.toFixed(5),
            fmt(r.co2Tonnes) + ' t',
        ]);
        concreteBody.push([
            { content: 'SUBTOTAL', colSpan: 5, styles: { fontStyle: 'bold', fillColor: [209, 250, 229] } },
            { content: fmt(totalConcreteCO2) + ' t', styles: { fontStyle: 'bold', fillColor: [209, 250, 229] } },
        ]);

        autoTable(doc, {
            startY: y,
            head: [['Element', 'End of Life', 'Volume', 'Mass', 'Factor (kg CO\u2082e/t)', 'CO\u2082e']],
            body: concreteBody,
            theme: 'grid',
            headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8, textColor: [30, 41, 59], overflow: 'linebreak' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { cellWidth: 28 },
                1: { cellWidth: 35 },
                2: { cellWidth: 25 },
                3: { cellWidth: 22 },
                4: { cellWidth: 38 },
                5: { cellWidth: 22 },
            },
            tableWidth: 'wrap',
            margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 12;

        // ── Steel Emissions Table ──
        if (y > 240) { doc.addPage(); y = 15; }
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('Steel Reinforcement Emissions Breakdown', 14, y);
        y += 2;
        doc.setDrawColor(249, 115, 22); // orange-500
        doc.line(14, y, 95, y);
        y += 4;

        const steelBody = steelRows.filter(r => r.hasData).map(r => [
            ROLE_LABELS[r.role],
            r.eol,
            r.pct + '%',
            fmt(r.massTonnes) + ' t',
            r.factor.toFixed(5),
            fmt(r.co2Tonnes) + ' t',
        ]);
        steelBody.push([
            { content: 'SUBTOTAL', colSpan: 5, styles: { fontStyle: 'bold', fillColor: [255, 237, 213] } },
            { content: fmt(totalSteelCO2) + ' t', styles: { fontStyle: 'bold', fillColor: [255, 237, 213] } },
        ]);

        autoTable(doc, {
            startY: y,
            head: [['Element', 'End of Life', 'Steel %', 'Mass', 'Factor (kg CO\u2082e/t)', 'CO\u2082e']],
            body: steelBody,
            theme: 'grid',
            headStyles: { fillColor: [234, 88, 12], textColor: 255, fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8, textColor: [30, 41, 59], overflow: 'linebreak' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { cellWidth: 28 },
                1: { cellWidth: 35 },
                2: { cellWidth: 22 },
                3: { cellWidth: 25 },
                4: { cellWidth: 38 },
                5: { cellWidth: 22 },
            },
            tableWidth: 'wrap',
            margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 12;

        // ── Grand Total Box ──
        if (y > 260) { doc.addPage(); y = 15; }
        doc.setFillColor(220, 252, 231); // green-100
        doc.setDrawColor(22, 163, 74); // green-600
        doc.roundedRect(14, y, pageW - 28, 16, 3, 3, 'FD');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 101, 52);
        doc.text('GRAND TOTAL CARBON FOOTPRINT', 20, y + 10);
        doc.setFontSize(12);
        const grandTotalText = `${fmt(grandTotal)} tonnes CO\u2082e`;
        doc.text(grandTotalText, pageW - 20, y + 10, { align: 'right', maxWidth: (pageW - 28) * 0.45 });
        y += 24;

        // ── Footer ──
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(7);
            doc.setTextColor(148, 163, 184);
            doc.text(`ECO-MATRIX Carbon Assessment Report | Page ${i} of ${pageCount}`, pageW / 2, 290, { align: 'center' });
        }

        doc.save(`ECO-MATRIX_Carbon_Report_${now.toISOString().slice(0, 10)}.pdf`);
    };

    return (
        <div className="w-full h-full bg-slate-900 text-slate-200 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 sticky top-0 z-10">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
                        <Leaf size={24} className="text-green-400" />
                        Carbon Emission Estimation
                    </h1>
                    <p className="text-slate-400 text-sm">Carbon factor auto-set from End-of-Life type selected in BOQ tab.</p>
                </div>
                <button
                    onClick={generatePDF}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition text-white border border-emerald-500 shadow-lg shadow-emerald-900/30"
                >
                    <FileDown size={18} />
                    Export PDF Report
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
                {/* Total banner */}
                <div className="bg-green-900/20 border border-green-500/30 p-4 rounded-xl flex items-center justify-between">
                    <span className="font-bold text-green-200">TOTAL CARBON FOOTPRINT</span>
                    <span className="font-mono text-2xl text-white">
                        {fmt(grandTotal)} <span className="text-base text-green-300">tonnes CO₂e</span>
                    </span>
                </div>

                {/* ── Concrete Emissions ── */}
                <section>
                    <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-emerald-500 rounded-full"></span>
                        Concrete Emissions
                    </h2>
                    <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-xs text-slate-500 border-b border-slate-700/50 bg-slate-800/60">
                                    <th className="py-3 px-4 font-medium uppercase tracking-wider">Element</th>
                                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-center">End of Life</th>
                                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">Volume (m³)</th>
                                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">Mass (tonnes)</th>
                                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">Factor (kg CO₂e/t)</th>
                                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">CO₂e (tonnes)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {concreteRows.map(row => {
                                    if (!row.hasData) return null;
                                    const color = ROLE_COLORS[row.role] || '#64748b';
                                    return (
                                        <tr key={row.role} className="border-b border-slate-700/20 last:border-0 hover:bg-slate-700/10 transition">
                                            <td className="py-3 px-4 text-sm font-medium flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }}></div>
                                                {ROLE_LABELS[row.role]}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-center">
                                                <select
                                                    value={row.eol}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setConcreteEol(p => ({ ...p, [row.role]: val }));
                                                        // Reset override when EOL changes to auto-update factor
                                                        setConcreteFactorOverrides(p => {
                                                            const newVars = {...p};
                                                            delete newVars[row.role];
                                                            return newVars;
                                                        });
                                                    }}
                                                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white font-mono outline-none cursor-pointer focus:border-emerald-500 w-32"
                                                >
                                                    {Object.keys(CONCRETE_EOL_FACTORS).map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-right font-mono text-slate-300">{fmt(row.vol)}</td>
                                            <td className="py-3 px-4 text-sm text-right font-mono text-slate-300">{fmt(row.massTonnes)}</td>
                                            <td className="py-3 px-4 text-sm text-right">
                                                <input
                                                    type="number" step="0.001" min="0"
                                                    value={concreteFactorOverrides[row.role] !== undefined ? concreteFactorOverrides[row.role] : row.factor}
                                                    onChange={(e) => setConcreteFactorOverrides(p => ({ ...p, [row.role]: parseFloat(e.target.value) || 0 }))}
                                                    className="w-20 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-right text-white font-mono outline-none focus:border-emerald-500 transition"
                                                />
                                            </td>
                                            <td className="py-3 px-4 text-sm text-right font-mono font-bold text-red-300">{fmt(row.co2Tonnes)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-emerald-900/20 border-t border-emerald-500/30">
                                <tr>
                                    <td className="py-3 px-4 text-sm font-bold text-emerald-200" colSpan={5}>CONCRETE SUBTOTAL</td>
                                    <td className="py-3 px-4 text-right font-mono text-lg font-bold text-white">
                                        {fmt(totalConcreteCO2)} t
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </section>

                {/* ── Steel Emissions ── */}
                <section>
                    <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-orange-500 rounded-full"></span>
                        Steel Reinforcement Emissions
                    </h2>
                    <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-xs text-slate-500 border-b border-slate-700/50 bg-slate-800/60">
                                    <th className="py-3 px-4 font-medium uppercase tracking-wider">Element</th>
                                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-center">End of Life</th>
                                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">Steel %</th>
                                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">Mass (tonnes)</th>
                                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">Factor (kg CO₂e/t)</th>
                                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">CO₂e (tonnes)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {steelRows.map(row => {
                                    if (!row.hasData) return null;
                                    const color = ROLE_COLORS[row.role] || '#64748b';
                                    return (
                                        <tr key={row.role} className="border-b border-slate-700/20 last:border-0 hover:bg-slate-700/10 transition">
                                            <td className="py-3 px-4 text-sm font-medium flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }}></div>
                                                {ROLE_LABELS[row.role]}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-center">
                                                <select
                                                    value={row.eol}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setSteelEol(p => ({ ...p, [row.role]: val }));
                                                        // Reset override
                                                        setSteelFactorOverrides(p => {
                                                            const newVars = {...p};
                                                            delete newVars[row.role];
                                                            return newVars;
                                                        });
                                                    }}
                                                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white font-mono outline-none cursor-pointer focus:border-orange-500 w-32"
                                                >
                                                    {Object.keys(STEEL_EOL_FACTORS).map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <input
                                                        type="number" step="0.5" min="0" max="100"
                                                        value={steelPercent[row.role]}
                                                        onChange={(e) => setSteelPercent(p => ({ ...p, [row.role]: parseFloat(e.target.value) || 0 }))}
                                                        className="w-14 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-right text-white font-mono outline-none focus:border-orange-500 transition"
                                                    />
                                                    <span className="text-[10px] text-slate-500">%</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-right font-mono text-slate-300">{fmt(row.massTonnes)}</td>
                                            <td className="py-3 px-4 text-sm text-right">
                                                <input
                                                    type="number" step="0.001" min="0"
                                                    value={steelFactorOverrides[row.role] !== undefined ? steelFactorOverrides[row.role] : row.factor}
                                                    onChange={(e) => setSteelFactorOverrides(p => ({ ...p, [row.role]: parseFloat(e.target.value) || 0 }))}
                                                    className="w-20 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-right text-white font-mono outline-none focus:border-orange-500 transition"
                                                />
                                            </td>
                                            <td className="py-3 px-4 text-sm text-right font-mono font-bold text-red-300">{fmt(row.co2Tonnes)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-orange-900/20 border-t border-orange-500/30">
                                <tr>
                                    <td className="py-3 px-4 text-sm font-bold text-orange-200" colSpan={5}>STEEL SUBTOTAL</td>
                                    <td className="py-3 px-4 text-right font-mono text-lg font-bold text-white">
                                        {fmt(totalSteelCO2)} t
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </section>

                {/* ── Grand Total ── */}
                <div className="bg-gradient-to-r from-green-900/30 to-red-900/20 border border-green-500/20 p-5 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Leaf size={28} className="text-green-400" />
                        <span className="font-bold text-lg text-white">TOTAL CARBON FOOTPRINT</span>
                    </div>
                    <span className="font-mono text-3xl font-bold text-white">
                        {fmt(grandTotal)} <span className="text-base text-green-300">tonnes CO₂e</span>
                    </span>
                </div>

                {/* ── Report Summary Section ── */}
                <section className="mt-2">
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
                        <FileText size={20} className="text-blue-400" />
                        Report Summary
                    </h2>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                        {/* Stat Cards */}
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Building2 size={16} className="text-blue-400" />
                                <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">Concrete Volume</span>
                            </div>
                            <span className="text-xl font-mono font-bold text-white">{fmt(totalConcreteVol)}</span>
                            <span className="text-xs text-slate-400 ml-1">m³</span>
                        </div>
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Layers size={16} className="text-emerald-400" />
                                <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">Concrete Mass</span>
                            </div>
                            <span className="text-xl font-mono font-bold text-white">{fmt(totalConcreteMass)}</span>
                            <span className="text-xs text-slate-400 ml-1">tonnes</span>
                        </div>
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Layers size={16} className="text-orange-400" />
                                <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">Steel Mass</span>
                            </div>
                            <span className="text-xl font-mono font-bold text-white">{fmt(totalSteelMass)}</span>
                            <span className="text-xs text-slate-400 ml-1">tonnes</span>
                        </div>
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <BarChart3 size={16} className="text-red-400" />
                                <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">Total CO₂e</span>
                            </div>
                            <span className="text-xl font-mono font-bold text-red-300">{fmt(grandTotal)}</span>
                            <span className="text-xs text-slate-400 ml-1">tonnes</span>
                        </div>
                    </div>

                    {/* Element breakdown mini-table */}
                    <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
                        <h3 className="text-sm font-bold text-slate-300 mb-3">Element-wise Breakdown</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Concrete breakdown */}
                            <div>
                                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Concrete</span>
                                <div className="mt-2 space-y-1">
                                    {concreteRows.filter(r => r.hasData).map(r => (
                                        <div key={r.role} className="flex items-center justify-between text-xs py-1 border-b border-slate-700/30 last:border-0">
                                            <span className="text-slate-300">{ROLE_LABELS[r.role]}</span>
                                            <div className="flex items-center gap-3">
                                                <span className="text-slate-500">{r.eol}</span>
                                                <span className="font-mono text-red-300 font-medium w-16 text-right">{fmt(r.co2Tonnes)} t</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Steel breakdown */}
                            <div>
                                <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Steel</span>
                                <div className="mt-2 space-y-1">
                                    {steelRows.filter(r => r.hasData).map(r => (
                                        <div key={r.role} className="flex items-center justify-between text-xs py-1 border-b border-slate-700/30 last:border-0">
                                            <span className="text-slate-300">{ROLE_LABELS[r.role]}</span>
                                            <div className="flex items-center gap-3">
                                                <span className="text-slate-500">{r.eol}</span>
                                                <span className="font-mono text-red-300 font-medium w-16 text-right">{fmt(r.co2Tonnes)} t</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Download button */}
                    <div className="mt-4 flex justify-center">
                        <button
                            onClick={generatePDF}
                            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 rounded-xl text-sm font-bold transition text-white shadow-lg shadow-emerald-900/40 border border-emerald-500/30"
                        >
                            <FileDown size={20} />
                            Download Full PDF Report
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
}

import React, { useMemo, useState } from 'react';
import { calculateMeasurements, ROLE_COLORS } from '../utils';
import { FileDown, Paintbrush, Save, FolderOpen, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

const DEFAULT_RATES = {
    excavation: { rate: 0, unit: '₹/m³', basis: 'volume' },
    wc: { rate: 0, unit: '₹/m²', basis: 'area' },
    window: { rate: 0, unit: '₹/unit', basis: 'count' },
    door: { rate: 0, unit: '₹/unit', basis: 'count' },
};

// Concrete roles (rate comes from grade)
const CONCRETE_ROLES = ['column', 'beam', 'slab', 'wall', 'footing_base', 'footing_slope'];
// Masonry roles
const MASONRY_ROLES = ['brick_wall'];

const DEFAULT_CONCRETE_GRADE_RATES = {
    'M15': 0, 'M20': 0, 'M25': 0, 'M30': 0,
    'M35': 0, 'M40': 0, 'M45': 0, 'M50': 0,
}; // ₹ per m³

// Concrete grades & steel grades
const CONCRETE_GRADES = ['M15', 'M20', 'M25', 'M30', 'M35', 'M40', 'M45', 'M50'];
const STEEL_GRADES = ['Fe415', 'Fe500', 'Fe500D', 'Fe550', 'Fe550D'];

const CONCRETE_EOL_TYPES = ['Primary material prod', 'Closed-loop source'];
const STEEL_EOL_TYPES = ['Primary material production', 'Closed-loop source'];

const STRUCTURAL_ROLES = ['column', 'beam', 'slab', 'wall'];

// Steel reinforcement defaults
const STEEL_ROLES = ['column', 'beam', 'slab', 'wall'];
const DEFAULT_STEEL_PERCENT = { column: 5, beam: 4, slab: 4, wall: 4 };
const STEEL_DENSITY = 7850; // kg per m³ of steel
const DEFAULT_PAINT_RATE = 0; // ₹ per m² (legacy, kept for saved tables)
const DEFAULT_BRICK_RATE = 0; // ₹ per m³
const DEFAULT_EXT_PAINT_RATE = 0; // ₹ per m²
const DEFAULT_INT_PAINT_RATE = 0; // ₹ per m²
const DEFAULT_WATERPROOF_RATE = 0; // ₹ per m²
const DEFAULT_PLASTER_RATE = 0; // ₹ per m²
const DEFAULT_COLUMN_EXPOSURE = 50;
const DEFAULT_STEEL_GRADE_RATES = {
    'Fe415': 0, 'Fe500': 0, 'Fe500D': 0, 'Fe550': 0, 'Fe550D': 0,
}; // ₹ per kg

const COST_TABLE_STORAGE_KEY = 'ecomatrix_cost_tables';

const ROLE_LABELS = {
    column: 'Columns', beam: 'Beams', slab: 'Slabs', wall: 'Walls', brick_wall: 'Brick Walls',
    footing_base: 'Footing Base', footing_slope: 'Footing Slope',
    wc: 'WC / Toilets', window: 'Windows', door: 'Doors',
    excavation: 'Footing Excavation',
};

const DEFAULT_CONCRETE_GRADE_FOR_ROLE = {
    column: 'M15', beam: 'M15', slab: 'M15', wall: 'M15',
    footing_base: 'M15', footing_slope: 'M15',
};
const DEFAULT_STEEL_GRADE_FOR_ROLE = {
    column: 'Fe415', beam: 'Fe415', slab: 'Fe415', wall: 'Fe415',
};
const DEFAULT_EOL_CONCRETE = 'Primary material prod';
const DEFAULT_EOL_STEEL = 'Primary material production';

const selectClass = "bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white font-mono outline-none cursor-pointer appearance-none";

export default function BOQView({ floors, rccSettings, concreteEol, setConcreteEol, steelEol, setSteelEol, foundation }) {
    // Helper to read from local storage
    const getStored = (key, defaultVal) => {
        try {
            const saved = localStorage.getItem('ecomatrix_boq_draft_v2_' + key);
            return saved ? JSON.parse(saved) : defaultVal;
        } catch { return defaultVal; }
    };

    const [fittingRates, setFittingRates] = useState(() => getStored('fitRates', (() => {
        const r = {};
        Object.entries(DEFAULT_RATES).forEach(([k, v]) => { r[k] = v.rate; });
        return r;
    })()));
    const [qtyOverrides, setQtyOverrides] = useState(() => getStored('qtyOverrides', {}));

    // Per-layer grade & EOL selections, keyed by "floorIdx_layerId"
    const [layerConcreteGrades, setLayerConcreteGrades] = useState(() => getStored('layerConcreteGrades', {}));
    const [layerSteelGrades, setLayerSteelGrades] = useState(() => getStored('layerSteelGrades', {}));
    const [layerConcreteEol, setLayerConcreteEol] = useState(() => getStored('layerConcreteEol', {}));
    const [layerSteelEol, setLayerSteelEol] = useState(() => getStored('layerSteelEol', {}));
    const [layerSteelPercent, setLayerSteelPercent] = useState(() => getStored('layerSteelPercent', {}));

    // Global rates (grade-based)
    const [steelGradeRates, setSteelGradeRates] = useState(() => getStored('steelGradeRates', DEFAULT_STEEL_GRADE_RATES));
    const [concreteGradeRates, setConcreteGradeRates] = useState(() => getStored('concreteGradeRates', DEFAULT_CONCRETE_GRADE_RATES));

    const [paintRate, setPaintRate] = useState(() => getStored('paintRate', DEFAULT_PAINT_RATE)); // legacy
    const [brickRate, setBrickRate] = useState(() => getStored('brickRate', DEFAULT_BRICK_RATE));
    const [columnExposure, setColumnExposure] = useState(() => getStored('columnExposure', DEFAULT_COLUMN_EXPOSURE));
    const [extPaintRate, setExtPaintRate] = useState(() => getStored('extPaintRate', DEFAULT_EXT_PAINT_RATE));
    const [intPaintRate, setIntPaintRate] = useState(() => getStored('intPaintRate', DEFAULT_INT_PAINT_RATE));
    const [waterproofRate, setWaterproofRate] = useState(() => getStored('waterproofRate', DEFAULT_WATERPROOF_RATE));
    const [plasterRate, setPlasterRate] = useState(() => getStored('plasterRate', DEFAULT_PLASTER_RATE));

    const [slabTileSize, setSlabTileSize] = useState(() => getStored('slabTileSize', '600x600'));
    const [wcTileSize, setWcTileSize] = useState(() => getStored('wcTileSize', '300x300'));
    const [slabTileRate, setSlabTileRate] = useState(() => getStored('slabTileRate', 0));
    const [slabSkirtingHeight, setSlabSkirtingHeight] = useState(() => getStored('slabSkirtingHeight', 0.1));
    const [slabSkirtingRate, setSlabSkirtingRate] = useState(() => getStored('slabSkirtingRate', 0));
    const [wcTileRate, setWcTileRate] = useState(() => getStored('wcTileRate', 0));
    const [wcSkirtingHeight, setWcSkirtingHeight] = useState(() => getStored('wcSkirtingHeight', 1.2)); // metres
    const [wcSkirtingTileRate, setWcSkirtingTileRate] = useState(() => getStored('wcSkirtingTileRate', 0));
    const [wcPaintRate, setWcPaintRate] = useState(() => getStored('wcPaintRate', 0));
    const [wcWaterproofRate, setWcWaterproofRate] = useState(() => getStored('wcWaterproofRate', 0));

    // Electrical
    const [elecPointsPerFloor, setElecPointsPerFloor] = useState(() => getStored('elecPointsPerFloor', 0));
    const [elecRunningLength, setElecRunningLength] = useState(() => getStored('elecRunningLength', 0));
    const [elecRate, setElecRate] = useState(() => getStored('elecRate', 0));

    // Excavation
    const [excavationRate, setExcavationRate] = useState(() => getStored('excavationRate', 0));

    // Collapsed floor sections
    const [collapsedFloors, setCollapsedFloors] = useState(() => getStored('collapsedFloors', {}));
    const toggleFloor = (idx) => setCollapsedFloors(prev => ({ ...prev, [idx]: !prev[idx] }));

    React.useEffect(() => {
        localStorage.setItem('ecomatrix_boq_draft_v2_fitRates', JSON.stringify(fittingRates));
        localStorage.setItem('ecomatrix_boq_draft_v2_qtyOverrides', JSON.stringify(qtyOverrides));
        localStorage.setItem('ecomatrix_boq_draft_v2_layerConcreteGrades', JSON.stringify(layerConcreteGrades));
        localStorage.setItem('ecomatrix_boq_draft_v2_layerSteelGrades', JSON.stringify(layerSteelGrades));
        localStorage.setItem('ecomatrix_boq_draft_v2_layerConcreteEol', JSON.stringify(layerConcreteEol));
        localStorage.setItem('ecomatrix_boq_draft_v2_layerSteelEol', JSON.stringify(layerSteelEol));
        localStorage.setItem('ecomatrix_boq_draft_v2_layerSteelPercent', JSON.stringify(layerSteelPercent));
        localStorage.setItem('ecomatrix_boq_draft_v2_steelGradeRates', JSON.stringify(steelGradeRates));
        localStorage.setItem('ecomatrix_boq_draft_v2_concreteGradeRates', JSON.stringify(concreteGradeRates));
        localStorage.setItem('ecomatrix_boq_draft_v2_paintRate', JSON.stringify(paintRate));
        localStorage.setItem('ecomatrix_boq_draft_v2_brickRate', JSON.stringify(brickRate));
        localStorage.setItem('ecomatrix_boq_draft_v2_columnExposure', JSON.stringify(columnExposure));
        localStorage.setItem('ecomatrix_boq_draft_v2_slabTileSize', JSON.stringify(slabTileSize));
        localStorage.setItem('ecomatrix_boq_draft_v2_wcTileSize', JSON.stringify(wcTileSize));
        localStorage.setItem('ecomatrix_boq_draft_v2_slabTileRate', JSON.stringify(slabTileRate));
        localStorage.setItem('ecomatrix_boq_draft_v2_slabSkirtingHeight', JSON.stringify(slabSkirtingHeight));
        localStorage.setItem('ecomatrix_boq_draft_v2_slabSkirtingRate', JSON.stringify(slabSkirtingRate));
        localStorage.setItem('ecomatrix_boq_draft_v2_wcTileRate', JSON.stringify(wcTileRate));
        localStorage.setItem('ecomatrix_boq_draft_v2_wcSkirtingHeight', JSON.stringify(wcSkirtingHeight));
        localStorage.setItem('ecomatrix_boq_draft_v2_wcSkirtingTileRate', JSON.stringify(wcSkirtingTileRate));
        localStorage.setItem('ecomatrix_boq_draft_v2_wcPaintRate', JSON.stringify(wcPaintRate));
        localStorage.setItem('ecomatrix_boq_draft_v2_wcWaterproofRate', JSON.stringify(wcWaterproofRate));
        localStorage.setItem('ecomatrix_boq_draft_v2_elecPointsPerFloor', JSON.stringify(elecPointsPerFloor));
        localStorage.setItem('ecomatrix_boq_draft_v2_elecRunningLength', JSON.stringify(elecRunningLength));
        localStorage.setItem('ecomatrix_boq_draft_v2_elecRate', JSON.stringify(elecRate));
        localStorage.setItem('ecomatrix_boq_draft_v2_excavationRate', JSON.stringify(excavationRate));
        localStorage.setItem('ecomatrix_boq_draft_v2_collapsedFloors', JSON.stringify(collapsedFloors));
        localStorage.setItem('ecomatrix_boq_draft_v2_extPaintRate', JSON.stringify(extPaintRate));
        localStorage.setItem('ecomatrix_boq_draft_v2_intPaintRate', JSON.stringify(intPaintRate));
        localStorage.setItem('ecomatrix_boq_draft_v2_waterproofRate', JSON.stringify(waterproofRate));
        localStorage.setItem('ecomatrix_boq_draft_v2_plasterRate', JSON.stringify(plasterRate));
    }, [fittingRates, qtyOverrides, layerConcreteGrades, layerSteelGrades, layerConcreteEol, layerSteelEol, layerSteelPercent, steelGradeRates, concreteGradeRates, paintRate, columnExposure, slabTileSize, wcTileSize, slabTileRate, slabSkirtingHeight, slabSkirtingRate, wcTileRate, collapsedFloors, extPaintRate, intPaintRate, waterproofRate, plasterRate, wcSkirtingHeight, wcSkirtingTileRate, wcPaintRate, wcWaterproofRate, elecPointsPerFloor, elecRunningLength, elecRate, excavationRate]);

    // Bulk assignment state with floor range
    const [bulkConcreteGrade, setBulkConcreteGrade] = useState('');
    const [bulkSteelGrade, setBulkSteelGrade] = useState('');
    const [bulkConcreteFloorFrom, setBulkConcreteFloorFrom] = useState(0);
    const [bulkConcreteFloorTo, setBulkConcreteFloorTo] = useState(0);
    const [bulkSteelFloorFrom, setBulkSteelFloorFrom] = useState(0);
    const [bulkSteelFloorTo, setBulkSteelFloorTo] = useState(0);
    const floorCount = floors.length;

    // ── Cost table save/load ──
    const [savedTables, setSavedTables] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(COST_TABLE_STORAGE_KEY)) || {};
        } catch { return {}; }
    });
    const [saveTableName, setSaveTableName] = useState('');
    const [showSaveInput, setShowSaveInput] = useState(false);

    const saveCostTable = () => {
        const name = saveTableName.trim();
        if (!name) return;
        const table = { fittingRates, concreteGradeRates, steelGradeRates, layerConcreteGrades, layerSteelGrades, layerConcreteEol, layerSteelEol, layerSteelPercent, paintRate, columnExposure };
        const updated = { ...savedTables, [name]: table };
        setSavedTables(updated);
        localStorage.setItem(COST_TABLE_STORAGE_KEY, JSON.stringify(updated));
        setSaveTableName('');
        setShowSaveInput(false);
    };

    const loadCostTable = (name) => {
        const table = savedTables[name];
        if (!table) return;
        if (table.fittingRates) setFittingRates(table.fittingRates);
        if (table.concreteGradeRates) setConcreteGradeRates(table.concreteGradeRates);
        if (table.steelGradeRates) setSteelGradeRates(table.steelGradeRates);
        if (table.layerConcreteGrades) setLayerConcreteGrades(table.layerConcreteGrades);
        if (table.layerSteelGrades) setLayerSteelGrades(table.layerSteelGrades);
        if (table.layerConcreteEol) setLayerConcreteEol(table.layerConcreteEol);
        if (table.layerSteelEol) setLayerSteelEol(table.layerSteelEol);
        if (table.layerSteelPercent) setLayerSteelPercent(table.layerSteelPercent);
        if (table.paintRate !== undefined) setPaintRate(table.paintRate);
        if (table.columnExposure !== undefined) setColumnExposure(table.columnExposure);
    };

    const deleteCostTable = (name) => {
        const updated = { ...savedTables };
        delete updated[name];
        setSavedTables(updated);
        localStorage.setItem(COST_TABLE_STORAGE_KEY, JSON.stringify(updated));
    };

    // ── Build per-floor per-layer detailed breakdown ──
    const { detailedItems, fittingSummary, aggregatedPaint } = useMemo(() => {
        const items = []; // per-floor per-layer structural items
        const fittings = {};
        Object.keys(DEFAULT_RATES).forEach(role => {
            fittings[role] = { count: 0, area: 0, volume: 0 };
        });
        const paintAgg = { slab: 0, wall: 0, brick_wall: 0, beam: 0, column: 0 };

        const allFloors = [];
        if (foundation) allFloors.push({ floor: foundation, floorIdx: 'foundation', defaultName: 'Foundation / Footing' });
        floors.forEach((f, i) => allFloors.push({ floor: f, floorIdx: i, defaultName: `Floor ${i + 1}` }));

        allFloors.forEach(({ floor, floorIdx, defaultName }) => {
            if (!floor || !floor.dxfData) return;

            const floorStats = calculateMeasurements(
                floor.dxfData.layers,
                floor.config,
                { ...rccSettings, numFloors: 1 }
            );

            if (floorStats.extraWallStats && parseFloat(floorStats.extraWallStats.volume) > 0) {
                items.push({
                    floorIdx, floorName: floor.name || defaultName,
                    layerId: '__extra_wall__', layerName: 'Auto Walls',
                    role: 'wall', volume: parseFloat(floorStats.extraWallStats.volume), area: 0, surfaceArea: 0, count: 0,
                });
            }

            if (floorStats.footingExcavationStats && parseFloat(floorStats.footingExcavationStats.volume) > 0) {
                items.push({
                    floorIdx, floorName: floor.name || defaultName,
                    layerId: '__excavation__', layerName: 'Footing Excavation',
                    role: 'excavation', volume: parseFloat(floorStats.footingExcavationStats.volume), area: 0, surfaceArea: 0, count: 0,
                });
            }

            floor.dxfData.layers.forEach(layer => {
                const role = floor.config[layer.id]?.role || 'generic';
                const stats = floorStats.byLayer[layer.id];
                if (!stats) return;

                const volume = parseFloat(stats.volume) || 0;
                const area = parseFloat(stats.area) || 0;
                const totalSA = parseFloat(stats.surfaceArea) || 0;
                const lateralSA = Math.max(0, totalSA - 2 * area);

                if (CONCRETE_ROLES.includes(role) || MASONRY_ROLES.includes(role)) {
                    items.push({
                        floorIdx, floorName: floor.name || defaultName,
                        layerId: layer.id, layerName: layer.name || layer.id,
                        role, volume, area, surfaceArea: lateralSA,
                        count: layer.entities?.length || 0,
                    });
                    // Paint aggregation
                    if (role === 'slab') paintAgg.slab += area;
                    else if (role === 'wall') paintAgg.wall += lateralSA;
                    else if (role === 'brick_wall') paintAgg.brick_wall += lateralSA;
                    else if (role === 'beam') paintAgg.beam += lateralSA;
                    else if (role === 'column') paintAgg.column += lateralSA;
                } else if (fittings[role] !== undefined) {
                    let layerCount = 0;
                    if (role === 'window' || role === 'door') {
                        layer.entities?.forEach(e => {
                            if (e.type === 'HATCH' && e.paths) layerCount += e.paths.length;
                        });
                    } else {
                        layerCount = layer.entities?.length || 0;
                    }
                    fittings[role].count += layerCount;
                    fittings[role].volume += volume;
                    fittings[role].area += area;
                    // Push per-floor fitting items
                    items.push({
                        floorIdx, floorName: floor.name || defaultName,
                        layerId: layer.id, layerName: layer.name || layer.id,
                        role, volume, area, surfaceArea: 0,
                        count: layerCount,
                    });
                }
            });
        });

        // Add Topmost Slab (Roof Slab) based on the top floor's slab layer
        if (floors.length > 0) {
            const topFloorIdx = floors.length - 1;
            const topFloor = floors[topFloorIdx];
            if (topFloor && topFloor.dxfData) {
                const topFloorStats = calculateMeasurements(
                    topFloor.dxfData.layers,
                    topFloor.config,
                    { ...rccSettings, numFloors: 1 }
                );

                topFloor.dxfData.layers.forEach(layer => {
                    const role = topFloor.config[layer.id]?.role || 'generic';
                    if (role === 'slab') {
                        const stats = topFloorStats.byLayer[layer.id];
                        if (stats && parseFloat(stats.volume) > 0) {
                            items.push({
                                floorIdx: floors.length, // Put it after the last floor
                                floorName: 'Topmost / Roof Slab',
                                layerId: `${layer.id}_roof`,
                                layerName: `${layer.name || layer.id} (Roof)`,
                                role: 'slab',
                                volume: parseFloat(stats.volume) || 0,
                                area: parseFloat(stats.area) || 0,
                                surfaceArea: Math.max(0, parseFloat(stats.surfaceArea) - 2 * parseFloat(stats.area)),
                                count: layer.entities?.length || 0,
                            });
                            paintAgg.slab += parseFloat(stats.area) || 0;
                        }
                    }
                });
            }
        }

        return { detailedItems: items, fittingSummary: fittings, aggregatedPaint: paintAgg };
    }, [floors, rccSettings]);

    // ── Helper to get/set per-layer values ──
    const getLayerKey = (floorIdx, layerId) => `${floorIdx}_${layerId}`;

    const getConcreteGrade = (floorIdx, layerId, role) =>
        layerConcreteGrades[getLayerKey(floorIdx, layerId)] || DEFAULT_CONCRETE_GRADE_FOR_ROLE[role] || 'M25';
    const getSteelGrade = (floorIdx, layerId, role) =>
        layerSteelGrades[getLayerKey(floorIdx, layerId)] || DEFAULT_STEEL_GRADE_FOR_ROLE[role] || 'Fe500';
    const getConcreteEolForLayer = (floorIdx, layerId) =>
        layerConcreteEol[getLayerKey(floorIdx, layerId)] || DEFAULT_EOL_CONCRETE;
    const getSteelEolForLayer = (floorIdx, layerId) =>
        layerSteelEol[getLayerKey(floorIdx, layerId)] || DEFAULT_EOL_STEEL;
    const getSteelPctForLayer = (floorIdx, layerId, role) =>
        layerSteelPercent[getLayerKey(floorIdx, layerId)] ?? DEFAULT_STEEL_PERCENT[role] ?? 4;

    const setLayerVal = (setter, floorIdx, layerId, value) => {
        setter(prev => ({ ...prev, [getLayerKey(floorIdx, layerId)]: value }));
    };

    // ── Concrete line items (per-layer, now includes fittings per floor) ──
    const FITTING_ROLES = ['wc', 'window', 'door'];
    const concreteLineItems = detailedItems
        .filter(item => {
            if (FITTING_ROLES.includes(item.role)) {
                return DEFAULT_RATES[item.role].basis === 'area' ? item.area > 0 : item.count > 0;
            }
            return (CONCRETE_ROLES.includes(item.role) || MASONRY_ROLES.includes(item.role) || item.role === 'excavation') && item.volume > 0;
        })
        .map(item => {
            if (FITTING_ROLES.includes(item.role)) {
                const config = DEFAULT_RATES[item.role];
                const rate = fittingRates[item.role] || 0;
                const qtyKey = getLayerKey(item.floorIdx, item.layerId);
                const quantity = config.basis === 'area' ? item.area :
                    (qtyOverrides[qtyKey] !== undefined ? qtyOverrides[qtyKey] : item.count);
                const amount = quantity * rate;
                return { ...item, grade: '-', gradeRate: rate, amount, fittingQty: quantity, fittingConfig: config, isFitting: true };
            }
            if (item.role === 'brick_wall') {
                const gradeRate = brickRate;
                return { ...item, grade: '-', gradeRate, amount: item.volume * gradeRate };
            }
            if (item.role === 'excavation') {
                return { ...item, grade: '-', gradeRate: excavationRate, amount: item.volume * excavationRate };
            }
            const grade = getConcreteGrade(item.floorIdx, item.layerId, item.role);
            const gradeRate = concreteGradeRates[grade] || 0;
            const amount = item.volume * gradeRate;
            return { ...item, grade, gradeRate, amount };
        });

    const fmt = (val) => val?.toFixed(2) || '0.00';
    const fmtCurrency = (val) => '₹ ' + (val || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

    const totalConcreteCost = concreteLineItems.reduce((t, i) => t + i.amount, 0);
    const totalConcreteVolume = concreteLineItems.reduce((t, i) => t + i.volume, 0);

    // ── Helper for exact steel ──
    const checkExactSteel = (item) => {
        if (item.floorIdx === 'foundation') return null;
        const detailDxf = floors[item.floorIdx]?.config?.[item.layerId]?.detailDxf;
        if (!detailDxf) return null;

        let rebarArea = 0;
        let stirrupLength = 0;
        
        const unitSystem = rccSettings.unitSystem || 'mm';
        const scaleToMeters = unitSystem === 'm' ? 1 : 0.001;
        
        detailDxf.layers.forEach(l => {
            const lowerName = l.name.toLowerCase();
            if (lowerName.includes('reinforcement')) {
                l.entities.forEach(ent => {
                    if (ent.type === 'CIRCLE') {
                        const r = ent.radius * scaleToMeters;
                        rebarArea += Math.PI * r * r;
                    }
                });
            }
            if (lowerName.includes('stirup') || lowerName.includes('stirrup')) {
                l.entities.forEach(ent => {
                    let perimeter = 0;
                    if (ent.type === 'LWPOLYLINE') {
                        for (let i = 0; i < ent.points.length - 1; i++) {
                            const dx = ent.points[i+1][0] - ent.points[i][0];
                            const dy = ent.points[i+1][1] - ent.points[i][1];
                            perimeter += Math.sqrt(dx*dx + dy*dy);
                        }
                        if (ent.closed && ent.points.length > 0) {
                            const dx = ent.points[0][0] - ent.points[ent.points.length - 1][0];
                            const dy = ent.points[0][1] - ent.points[ent.points.length - 1][1];
                            perimeter += Math.sqrt(dx*dx + dy*dy);
                        }
                    } else if (ent.type === 'LINE') {
                        const dx = ent.end[0] - ent.start[0];
                        const dy = ent.end[1] - ent.start[1];
                        perimeter += Math.sqrt(dx*dx + dy*dy);
                    }
                    stirrupLength += perimeter * scaleToMeters;
                });
            }
        });

        const floorHeight = rccSettings.floorHeight || (unitSystem === 'm' ? 5 : 5000);
        const spacing = rccSettings.stirrupSpacing || (unitSystem === 'm' ? 0.15 : 150);
        const heightM = floorHeight * scaleToMeters;
        const spacingM = spacing * scaleToMeters;
        
        const stirrupCount = spacingM > 0 ? Math.floor(heightM / spacingM) : 0;
        // Assuming stirrup bar diameter is 8mm (0.008m) -> area = 0.00005026 m2
        const stirrupArea = Math.PI * 0.004 * 0.004; 
        
        const rebarVolPerCol = rebarArea * heightM; 
        const stirrupVolPerCol = stirrupLength * stirrupCount * stirrupArea;
        const totalSteelVolPerCol = rebarVolPerCol + stirrupVolPerCol;
        
        return totalSteelVolPerCol * STEEL_DENSITY * (item.count || 1);
    };

    // ── Steel line items (per-layer for structural roles) ──
    const steelLineItems = detailedItems
        .filter(item => STEEL_ROLES.includes(item.role) && item.volume > 0)
        .map(item => {
            const exactWeight = checkExactSteel(item);
            let steelWeight = 0;
            let pct = getSteelPctForLayer(item.floorIdx, item.layerId, item.role);
            let isExact = false;

            if (exactWeight !== null && exactWeight > 0) {
                steelWeight = exactWeight;
                isExact = true;
            } else {
                const steelVol = item.volume * (pct / 100);
                steelWeight = steelVol * STEEL_DENSITY;
            }

            const grade = getSteelGrade(item.floorIdx, item.layerId, item.role);
            const gradeRate = steelGradeRates[grade] || 0;
            const amount = steelWeight * gradeRate;
            return { ...item, pct, steelWeight, grade, gradeRate, amount, isExact };
        });

    const totalSteelWeight = steelLineItems.reduce((t, i) => t + i.steelWeight, 0);
    const totalSteelCost = steelLineItems.reduce((t, i) => t + i.amount, 0);

    // ── Bulk assignment functions (with floor range support) ──
    const applyBulkConcreteGrade = (grade, roleFilter, fromFloor, toFloor) => {
        const updates = {};
        detailedItems.forEach(item => {
            if (item.floorIdx < fromFloor || item.floorIdx > toFloor) return;
            if (!roleFilter || item.role === roleFilter) {
                updates[getLayerKey(item.floorIdx, item.layerId)] = grade;
            }
        });
        setLayerConcreteGrades(prev => ({ ...prev, ...updates }));
    };

    const applyBulkSteelGrade = (grade, roleFilter, fromFloor, toFloor) => {
        const updates = {};
        detailedItems.filter(i => STEEL_ROLES.includes(i.role)).forEach(item => {
            if (item.floorIdx < fromFloor || item.floorIdx > toFloor) return;
            if (!roleFilter || item.role === roleFilter) {
                updates[getLayerKey(item.floorIdx, item.layerId)] = grade;
            }
        });
        setLayerSteelGrades(prev => ({ ...prev, ...updates }));
    };

    const updateFittingRate = (role, value) => setFittingRates(prev => ({ ...prev, [role]: parseFloat(value) || 0 }));
    const updateQty = (role, value) => setQtyOverrides(prev => ({ ...prev, [role]: parseInt(value) || 0 }));

    // ── Group items by floor for rendering ──
    const groupByFloor = (items) => {
        const groups = {};
        items.forEach(item => {
            const key = item.floorIdx;
            if (!groups[key]) groups[key] = { floorIdx: item.floorIdx, floorName: item.floorName, items: [] };
            groups[key].items.push(item);
        });
        return Object.values(groups).sort((a, b) => a.floorIdx - b.floorIdx);
    };

    const concreteByFloor = groupByFloor(concreteLineItems);
    const steelByFloor = groupByFloor(steelLineItems);

    // ── CSV Export ──
    const generateCSV = () => {
        const rows = [];
        const esc = (v) => {
            const s = String(v ?? '');
            return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
        };

        // Concrete & Fittings
        rows.push('CONCRETE & FITTINGS');
        rows.push(['Floor', 'Layer', 'Role', 'Grade', 'EOL', 'Volume (m³)', 'Rate (₹/m³)', 'Amount (₹)'].map(esc).join(','));
        concreteLineItems.forEach(item => {
            rows.push([
                item.floorName, item.layerName, item.role, item.grade,
                getConcreteEolForLayer(item.floorIdx, item.layerId),
                fmt(item.volume), item.gradeRate, Math.round(item.amount)
            ].map(esc).join(','));
        });
        // Fittings (per-floor)
        concreteLineItems.filter(i => i.isFitting).forEach(item => {
            const qtyLabel = item.fittingConfig.basis === 'area' ? `${fmt(item.fittingQty)} m²` : `${item.fittingQty} nos`;
            rows.push([
                item.floorName, ROLE_LABELS[item.role], item.role, '—', '—',
                qtyLabel, item.gradeRate, Math.round(item.amount)
            ].map(esc).join(','));
        });
        rows.push(['', '', '', '', '', '', 'Concrete Subtotal', Math.round(totalConcreteCost)].map(esc).join(','));
        rows.push('');

        // Steel Reinforcement
        rows.push('STEEL REINFORCEMENT');
        rows.push(['Floor', 'Layer', 'Role', 'Grade', 'EOL', 'Concrete (m³)', 'Steel %', 'Steel (kg)', 'Rate (₹/kg)', 'Amount (₹)'].map(esc).join(','));
        steelLineItems.forEach(item => {
            rows.push([
                item.floorName, item.layerName, item.role, item.grade,
                getSteelEolForLayer(item.floorIdx, item.layerId),
                fmt(item.volume), item.pct, fmt(item.steelWeight),
                item.gradeRate, Math.round(item.amount)
            ].map(esc).join(','));
        });
        rows.push(['', '', '', '', '', '', '', 'Steel Subtotal', '', Math.round(totalSteelCost)].map(esc).join(','));
        rows.push('');

        // Paint Estimate
        const slabCeilingArea = aggregatedPaint.slab;
        const wallPaintArea = aggregatedPaint.wall;
        const paintItems = [
            { label: 'Ceiling (Slab Top)', area: slabCeilingArea },
            { label: 'Walls', area: wallPaintArea },
        ].filter(i => i.area > 0);
        const totalPaintArea = paintItems.reduce((t, i) => t + i.area, 0);
        const totalPaintCost = totalPaintArea * paintRate;

        rows.push('PAINT ESTIMATE');
        rows.push(['Element', 'Paintable Area (m²)', 'Paint Cost (₹)'].map(esc).join(','));
        paintItems.forEach(item => {
            rows.push([item.label, fmt(item.area), Math.round(item.area * paintRate)].map(esc).join(','));
        });
        rows.push(['', 'Paint Subtotal', Math.round(totalPaintCost)].map(esc).join(','));
        rows.push('');

        // Grand Total
        const allWallArea = aggregatedPaint.wall + aggregatedPaint.brick_wall;
        const totalPaintGrand = (allWallArea * extPaintRate) + ((aggregatedPaint.slab + allWallArea) * intPaintRate);
        const waterproofCostGrand = (aggregatedPaint.slab + allWallArea) * waterproofRate + (fittingSummary.wc?.area || 0) * wcWaterproofRate;
        const plasterCostGrand = (aggregatedPaint.slab + allWallArea) * plasterRate;
        const slabFloorArea = aggregatedPaint.slab || 0;
        const wcFloorArea = fittingSummary.wc?.area || 0;
        const netSlabFloorArea = Math.max(0, slabFloorArea - wcFloorArea);
        const internalPerimeter = 4 * Math.sqrt(netSlabFloorArea);
        const internalSkirtingArea = internalPerimeter * slabSkirtingHeight;
        const wcPerimeterGrand = 4 * Math.sqrt(wcFloorArea);
        const wcSkirtingAreaGrand = wcPerimeterGrand * wcSkirtingHeight;
        const wcWallHeight = (rccSettings?.floorHeight || 3);
        const wcPaintAreaGrand = wcPerimeterGrand * Math.max(0, wcWallHeight - wcSkirtingHeight);
        const totalTilingCostGrand = (netSlabFloorArea * slabTileRate) + (internalSkirtingArea * slabSkirtingRate) + (wcFloorArea * wcTileRate) + (wcSkirtingAreaGrand * wcSkirtingTileRate) + (wcPaintAreaGrand * wcPaintRate);
        const numFloors = floors.length || 1;
        const elecCostGrand = elecPointsPerFloor * numFloors * elecRunningLength * elecRate;

        rows.push(['ESTIMATED PROJECT COST', '', Math.round(totalConcreteCost + totalSteelCost + totalPaintGrand + waterproofCostGrand + plasterCostGrand + totalTilingCostGrand + elecCostGrand)].map(esc).join(','));

        const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ECO-MATRIX_BOQ_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="w-full h-full bg-slate-900 text-slate-200 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-900 sticky top-0 z-10">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-1">Cost Estimation</h1>
                        <p className="text-slate-400 text-sm">Concrete, steel reinforcement & project cost — per floor & layer.</p>
                    </div>
                    <button onClick={generateCSV} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition text-white border border-slate-700">
                        <FileDown size={18} />
                        Export CSV
                    </button>
                </div>

                {/* Cost Table Save/Load */}
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {Object.keys(savedTables).length > 0 && (
                        <div className="flex items-center gap-1">
                            <FolderOpen size={14} className="text-slate-500" />
                            <select
                                onChange={(e) => { if (e.target.value) loadCostTable(e.target.value); e.target.value = ''; }}
                                defaultValue=""
                                className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none cursor-pointer"
                            >
                                <option value="" disabled>Load preset…</option>
                                {Object.keys(savedTables).map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                            <select
                                onChange={(e) => { if (e.target.value && confirm(`Delete "${e.target.value}"?`)) deleteCostTable(e.target.value); e.target.value = ''; }}
                                defaultValue=""
                                className="bg-slate-800 border border-red-900/50 rounded px-1.5 py-1 text-xs text-red-400 outline-none cursor-pointer"
                            >
                                <option value="" disabled>🗑</option>
                                {Object.keys(savedTables).map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {showSaveInput ? (
                        <div className="flex items-center gap-1">
                            <input
                                type="text"
                                value={saveTableName}
                                onChange={(e) => setSaveTableName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && saveCostTable()}
                                placeholder="Preset name…"
                                className="bg-slate-800 border border-emerald-600/50 rounded px-2 py-1 text-xs text-white outline-none w-36 placeholder:text-slate-500"
                                autoFocus
                            />
                            <button
                                onClick={saveCostTable}
                                disabled={!saveTableName.trim()}
                                className="px-2 py-1 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 rounded text-xs text-white transition"
                            >Save</button>
                            <button
                                onClick={() => { setShowSaveInput(false); setSaveTableName(''); }}
                                className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-300 transition"
                            >Cancel</button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowSaveInput(true)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs text-emerald-400 border border-slate-700 transition"
                        >
                            <Save size={12} />
                            Save Rates
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">



                {/* ── Total Concrete Volume ── */}
                <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-xl flex items-center justify-between">
                    <span className="font-bold text-blue-200">TOTAL CONCRETE VOLUME</span>
                    <span className="font-mono text-2xl text-white">
                        {fmt(totalConcreteVolume)} <span className="text-base text-blue-300">m³</span>
                    </span>
                </div>

                {/* ── Concrete Cost Table ── */}
                <section>
                    <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-emerald-500 rounded-full"></span>
                        Concrete & Fittings
                    </h2>

                    {/* Per-grade concrete rate editor */}
                    <div className="flex flex-wrap items-center gap-3 mb-3 text-sm">
                        {CONCRETE_GRADES.map(grade => (
                            <div key={grade} className="flex items-center gap-1">
                                <span className="text-slate-400 text-xs font-medium">{grade}:</span>
                                <span className="text-slate-500 text-xs">₹</span>
                                <input
                                    type="number"
                                    value={concreteGradeRates[grade] || 0}
                                    onChange={(e) => setConcreteGradeRates(prev => ({ ...prev, [grade]: parseFloat(e.target.value) || 0 }))}
                                    className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-right text-white font-mono outline-none focus:border-emerald-500 transition"
                                />
                                <span className="text-slate-600 text-[10px]">/m³</span>
                            </div>
                        ))}
                        <div className="flex items-center gap-1 pl-4 border-l border-slate-700">
                            <span className="text-slate-400 text-xs font-medium">Brick Wall:</span>
                            <span className="text-slate-500 text-xs">₹</span>
                            <input
                                type="number"
                                value={brickRate}
                                onChange={(e) => setBrickRate(parseFloat(e.target.value) || 0)}
                                className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-right text-white font-mono outline-none focus:border-emerald-500 transition"
                            />
                            <span className="text-slate-600 text-[10px]">/m³</span>
                        </div>
                        <div className="flex items-center gap-1 pl-4 border-l border-slate-700">
                            <span className="text-slate-400 text-xs font-medium">Excavation:</span>
                            <span className="text-slate-500 text-xs">₹</span>
                            <input
                                type="number"
                                value={excavationRate}
                                onChange={(e) => setExcavationRate(parseFloat(e.target.value) || 0)}
                                className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-right text-white font-mono outline-none focus:border-emerald-500 transition"
                            />
                            <span className="text-slate-600 text-[10px]">/m³</span>
                        </div>
                    </div>

                    {/* Bulk set concrete grade with floor range */}
                    <div className="flex flex-wrap items-center gap-2 mb-3 text-xs bg-slate-800/40 p-2.5 rounded-lg border border-slate-700/40">
                        <span className="text-slate-400 font-medium">Bulk Set:</span>
                        <select
                            value={bulkConcreteGrade}
                            onChange={(e) => setBulkConcreteGrade(e.target.value)}
                            className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none cursor-pointer"
                        >
                            <option value="">Grade…</option>
                            {CONCRETE_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <span className="text-slate-500">Floor</span>
                        <select value={bulkConcreteFloorFrom} onChange={e => setBulkConcreteFloorFrom(Number(e.target.value))} className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none cursor-pointer w-16">
                            {Array.from({ length: floorCount }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}
                        </select>
                        <span className="text-slate-500">to</span>
                        <select value={bulkConcreteFloorTo} onChange={e => setBulkConcreteFloorTo(Number(e.target.value))} className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none cursor-pointer w-16">
                            {Array.from({ length: floorCount }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}
                        </select>
                        {bulkConcreteGrade && (
                            <>
                                <button onClick={() => applyBulkConcreteGrade(bulkConcreteGrade, null, bulkConcreteFloorFrom, bulkConcreteFloorTo)} className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-700 rounded text-emerald-200 transition font-medium">Apply All</button>
                                {['column', 'beam', 'slab', 'wall'].map(r => (
                                    <button key={r} onClick={() => applyBulkConcreteGrade(bulkConcreteGrade, r, bulkConcreteFloorFrom, bulkConcreteFloorTo)} className="px-2 py-1 bg-slate-700/60 hover:bg-slate-700 rounded text-slate-300 transition capitalize">{r}s</button>
                                ))}
                            </>
                        )}
                    </div>

                    <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-xs text-slate-500 border-b border-slate-700/50 bg-slate-800/60">
                                    <th className="py-3 px-4 font-medium uppercase tracking-wider">Floor / Layer</th>
                                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-center">Role</th>
                                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-center">Grade</th>
                                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-center">EOL</th>
                                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">Volume (m³)</th>
                                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">Rate (₹)</th>
                                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">Amount (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {concreteByFloor.map(group => {
                                    const isCollapsed = collapsedFloors[`c_${group.floorIdx}`];
                                    const floorTotal = group.items.reduce((t, i) => t + i.amount, 0);
                                    return (
                                        <React.Fragment key={`cf_${group.floorIdx}`}>
                                            {/* Floor header row */}
                                            <tr
                                                className="bg-slate-800/40 border-b border-slate-700/30 cursor-pointer hover:bg-slate-800/60 transition"
                                                onClick={() => toggleFloor(`c_${group.floorIdx}`)}
                                            >
                                                <td className="py-2 px-4 text-sm font-semibold text-emerald-300 flex items-center gap-2" colSpan={5}>
                                                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                                    {group.floorName}
                                                    <span className="text-slate-500 text-xs font-normal">({group.items.length} layers)</span>
                                                </td>
                                                <td className="py-2 px-4 text-right text-xs text-slate-500 font-mono" colSpan={2}>
                                                    {fmtCurrency(floorTotal)}
                                                </td>
                                            </tr>
                                            {/* Layer rows */}
                                            {!isCollapsed && group.items.map(item => {
                                                const color = ROLE_COLORS[item.role] || '#64748b';
                                                if (item.isFitting) {
                                                    const qtyKey = getLayerKey(item.floorIdx, item.layerId);
                                                    return (
                                                        <tr key={`${item.floorIdx}_${item.layerId}`} className="border-b border-slate-700/20 last:border-0 hover:bg-slate-700/10 transition">
                                                            <td className="py-2 px-4 pl-10 text-sm font-medium flex items-center gap-2">
                                                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }}></div>
                                                                {ROLE_LABELS[item.role]}
                                                            </td>
                                                            <td className="py-2 px-4 text-xs text-center text-slate-500">—</td>
                                                            <td className="py-2 px-4 text-xs text-center text-slate-500">—</td>
                                                            <td className="py-2 px-4 text-xs text-center text-slate-500">—</td>
                                                            <td className="py-2 px-4 text-sm text-right text-slate-300 font-mono">
                                                                {item.fittingConfig.basis === 'count' ? (
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <input type="number" min="0"
                                                                            value={item.fittingQty}
                                                                            onChange={(e) => setQtyOverrides(prev => ({ ...prev, [qtyKey]: parseInt(e.target.value) || 0 }))}
                                                                            className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-right text-white font-mono outline-none focus:border-blue-500 transition"
                                                                        />
                                                                        <span className="text-[10px] text-slate-500">nos</span>
                                                                    </div>
                                                                ) : `${fmt(item.fittingQty)} m²`}
                                                            </td>
                                                            <td className="py-2 px-4 text-sm text-right font-mono">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <input type="number"
                                                                        value={fittingRates[item.role]}
                                                                        onChange={(e) => updateFittingRate(item.role, e.target.value)}
                                                                        className="w-20 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-right text-white font-mono outline-none focus:border-emerald-500 transition"
                                                                    />
                                                                    <span className="text-[10px] text-slate-500 w-10">{item.fittingConfig.unit.replace('₹/', '/')}</span>
                                                                </div>
                                                            </td>
                                                            <td className="py-2 px-4 text-sm text-right text-emerald-300 font-mono font-medium">{fmtCurrency(item.amount)}</td>
                                                        </tr>
                                                    );
                                                }
                                                return (
                                                    <tr key={`${item.floorIdx}_${item.layerId}`} className="border-b border-slate-700/20 last:border-0 hover:bg-slate-700/10 transition">
                                                        <td className="py-2 px-4 pl-10 text-sm font-medium flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }}></div>
                                                            <span className="text-slate-300 truncate max-w-[120px]" title={item.layerName}>{item.layerName}</span>
                                                        </td>
                                                        <td className="py-2 px-4 text-xs text-center text-slate-400 capitalize">{item.role}</td>
                                                        <td className="py-2 px-4 text-sm text-center">
                                                            {item.role === 'excavation' || item.role === 'brick_wall' ? <span className="text-slate-500">—</span> : (
                                                                <select
                                                                    value={item.grade}
                                                                    onChange={(e) => setLayerVal(setLayerConcreteGrades, item.floorIdx, item.layerId, e.target.value)}
                                                                    className={selectClass + " focus:border-emerald-500 w-16"}
                                                                >
                                                                    {CONCRETE_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                                                                </select>
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-4 text-sm text-center">
                                                            {item.role === 'excavation' || item.role === 'brick_wall' ? <span className="text-slate-500">—</span> : (
                                                                <select
                                                                    value={getConcreteEolForLayer(item.floorIdx, item.layerId)}
                                                                    onChange={(e) => setLayerVal(setLayerConcreteEol, item.floorIdx, item.layerId, e.target.value)}
                                                                    className={selectClass + " focus:border-emerald-500 w-28 text-[10px]"}
                                                                >
                                                                    {CONCRETE_EOL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                                                </select>
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-4 text-sm text-right text-slate-300 font-mono">{fmt(item.volume)}</td>
                                                        <td className="py-2 px-4 text-sm text-right text-slate-400 font-mono">₹{item.gradeRate.toLocaleString()}/m³</td>
                                                        <td className="py-2 px-4 text-sm text-right text-emerald-300 font-mono font-medium">{fmtCurrency(item.amount)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </React.Fragment>
                                    );
                                })}

                            </tbody>
                            <tfoot className="bg-emerald-900/20 border-t border-emerald-500/30">
                                <tr>
                                    <td className="py-3 px-4 text-sm font-bold text-emerald-200" colSpan={6}>CONCRETE & FITTINGS SUBTOTAL</td>
                                    <td className="py-3 px-4 text-right font-mono text-xl font-bold text-white">
                                        {fmtCurrency(totalConcreteCost)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </section>

                {/* ── Steel Reinforcement Table ── */}
                <section>
                    <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-orange-500 rounded-full"></span>
                        Steel Reinforcement
                    </h2>

                    {/* Per-grade rate editor */}
                    <div className="flex flex-wrap items-center gap-3 mb-3 text-sm">
                        {STEEL_GRADES.map(grade => (
                            <div key={grade} className="flex items-center gap-1">
                                <span className="text-slate-400 text-xs font-medium">{grade}:</span>
                                <span className="text-slate-500 text-xs">₹</span>
                                <input
                                    type="number"
                                    value={steelGradeRates[grade] || 0}
                                    onChange={(e) => setSteelGradeRates(prev => ({ ...prev, [grade]: parseFloat(e.target.value) || 0 }))}
                                    className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-right text-white font-mono outline-none focus:border-orange-500 transition"
                                />
                                <span className="text-slate-600 text-[10px]">/kg</span>
                            </div>
                        ))}
                    </div>

                    {/* Bulk set steel grade with floor range */}
                    <div className="flex flex-wrap items-center gap-2 mb-3 text-xs bg-slate-800/40 p-2.5 rounded-lg border border-slate-700/40">
                        <span className="text-slate-400 font-medium">Bulk Set:</span>
                        <select
                            value={bulkSteelGrade}
                            onChange={(e) => setBulkSteelGrade(e.target.value)}
                            className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none cursor-pointer"
                        >
                            <option value="">Grade…</option>
                            {STEEL_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <span className="text-slate-500">Floor</span>
                        <select value={bulkSteelFloorFrom} onChange={e => setBulkSteelFloorFrom(Number(e.target.value))} className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none cursor-pointer w-16">
                            {Array.from({ length: floorCount }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}
                        </select>
                        <span className="text-slate-500">to</span>
                        <select value={bulkSteelFloorTo} onChange={e => setBulkSteelFloorTo(Number(e.target.value))} className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none cursor-pointer w-16">
                            {Array.from({ length: floorCount }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}
                        </select>
                        {bulkSteelGrade && (
                            <>
                                <button onClick={() => applyBulkSteelGrade(bulkSteelGrade, null, bulkSteelFloorFrom, bulkSteelFloorTo)} className="px-2.5 py-1 bg-orange-800 hover:bg-orange-700 rounded text-orange-200 transition font-medium">Apply All</button>
                                {STEEL_ROLES.map(r => (
                                    <button key={r} onClick={() => applyBulkSteelGrade(bulkSteelGrade, r, bulkSteelFloorFrom, bulkSteelFloorTo)} className="px-2 py-1 bg-slate-700/60 hover:bg-slate-700 rounded text-slate-300 transition capitalize">{r}s</button>
                                ))}
                            </>
                        )}
                    </div>

                    <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-xs text-slate-500 border-b border-slate-700/50 bg-slate-800/60">
                                    <th className="py-3 px-4 font-medium uppercase tracking-wider">Floor / Layer</th>
                                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-center">Role</th>
                                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-center">Grade</th>
                                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-center">EOL</th>
                                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">Concrete (m³)</th>
                                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">Steel %</th>
                                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">Steel (kg)</th>
                                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">Rate (₹/kg)</th>
                                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">Amount (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {steelByFloor.map(group => {
                                    const isCollapsed = collapsedFloors[`s_${group.floorIdx}`];
                                    const floorTotal = group.items.reduce((t, i) => t + i.amount, 0);
                                    return (
                                        <React.Fragment key={`sf_${group.floorIdx}`}>
                                            <tr
                                                className="bg-slate-800/40 border-b border-slate-700/30 cursor-pointer hover:bg-slate-800/60 transition"
                                                onClick={() => toggleFloor(`s_${group.floorIdx}`)}
                                            >
                                                <td className="py-2 px-4 text-sm font-semibold text-orange-300 flex items-center gap-2" colSpan={7}>
                                                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                                    {group.floorName}
                                                    <span className="text-slate-500 text-xs font-normal">({group.items.length} layers)</span>
                                                </td>
                                                <td className="py-2 px-4 text-right text-xs text-slate-500 font-mono" colSpan={2}>
                                                    {fmtCurrency(floorTotal)}
                                                </td>
                                            </tr>
                                            {!isCollapsed && group.items.map(item => {
                                                const color = ROLE_COLORS[item.role] || '#64748b';
                                                return (
                                                    <tr key={`${item.floorIdx}_${item.layerId}_s`} className="border-b border-slate-700/20 last:border-0 hover:bg-slate-700/10 transition">
                                                        <td className="py-2 px-4 pl-10 text-sm font-medium flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }}></div>
                                                            <span className="text-slate-300 truncate max-w-[120px]" title={item.layerName}>{item.layerName}</span>
                                                        </td>
                                                        <td className="py-2 px-4 text-xs text-center text-slate-400 capitalize">{item.role}</td>
                                                        <td className="py-2 px-4 text-sm text-center">
                                                            <select
                                                                value={item.grade}
                                                                onChange={(e) => setLayerVal(setLayerSteelGrades, item.floorIdx, item.layerId, e.target.value)}
                                                                className={selectClass + " focus:border-orange-500 w-20"}
                                                            >
                                                                {STEEL_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                                                            </select>
                                                        </td>
                                                        <td className="py-2 px-4 text-sm text-center">
                                                            <select
                                                                value={getSteelEolForLayer(item.floorIdx, item.layerId)}
                                                                onChange={(e) => setLayerVal(setLayerSteelEol, item.floorIdx, item.layerId, e.target.value)}
                                                                className={selectClass + " focus:border-orange-500 w-28 text-[10px]"}
                                                            >
                                                                {STEEL_EOL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                                            </select>
                                                        </td>
                                                        <td className="py-2 px-4 text-sm text-right text-slate-300 font-mono">{fmt(item.volume)}</td>
                                                        <td className="py-2 px-4 text-sm text-right">
                                                            {item.isExact ? (
                                                                <span className="text-[10px] text-green-400 font-bold bg-green-900/40 px-2 py-1 rounded">Exact DXF</span>
                                                            ) : (
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <input
                                                                        type="number" step="0.5" min="0" max="100"
                                                                        value={item.pct}
                                                                        onChange={(e) => setLayerVal(setLayerSteelPercent, item.floorIdx, item.layerId, parseFloat(e.target.value) || 0)}
                                                                        className="w-14 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-right text-white font-mono outline-none focus:border-orange-500 transition"
                                                                    />
                                                                    <span className="text-[10px] text-slate-500">%</span>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-4 text-sm text-right text-slate-200 font-mono">{fmt(item.steelWeight)}</td>
                                                        <td className="py-2 px-4 text-sm text-right text-slate-400 font-mono">₹{item.gradeRate}</td>
                                                        <td className="py-2 px-4 text-sm text-right text-orange-300 font-mono font-medium">{fmtCurrency(item.amount)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-orange-900/20 border-t border-orange-500/30">
                                <tr>
                                    <td className="py-3 px-4 text-sm font-bold text-orange-200" colSpan={7}>STEEL SUBTOTAL</td>
                                    <td className="py-3 px-4 text-sm text-right text-slate-300 font-mono font-bold">
                                        {fmt(totalSteelWeight)} kg
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono text-xl font-bold text-white">
                                        {fmtCurrency(totalSteelCost)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </section>

                {/* ── Paint, Waterproofing & Plastering Sections ── */}
                {(() => {
                    // Surface areas
                    const allWallArea = aggregatedPaint.wall + aggregatedPaint.brick_wall; // total lateral wall SA
                    // External = half of all walls (outer face only, approx). Users can refine via rate.
                    // We present all wall surface area split into external / internal with separate rates.
                    const externalWallArea = allWallArea; // exposed outer skin — all wall SA
                    const internalCeilingArea = aggregatedPaint.slab; // slab underside / ceiling
                    const internalWallArea = allWallArea;  // inner face of walls

                    // Waterproofing: roof slab top + all external walls
                    const roofSlabArea = aggregatedPaint.slab; // top of slab = same as slab plan area
                    const waterproofArea = roofSlabArea + externalWallArea;

                    // Plastering: internal ceiling + all wall faces (both sides)
                    const plasterArea = internalCeilingArea + allWallArea;

                    const extPaintCost = externalWallArea * extPaintRate;
                    const intPaintCost = (internalCeilingArea + internalWallArea) * intPaintRate;
                    const waterproofCost = waterproofArea * waterproofRate;
                    const plasterCost = plasterArea * plasterRate;

                    const RateInput = ({ label, value, onChange, accent }) => (
                        <div className="flex items-center gap-1">
                            <span className="text-slate-400 text-xs">{label}:</span>
                            <span className="text-slate-500 text-xs">₹</span>
                            <input type="number" value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)}
                                className={`w-20 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-right text-white font-mono outline-none focus:border-${accent}-500 transition`}
                            />
                            <span className="text-slate-500 text-xs">/m²</span>
                        </div>
                    );

                    const SummaryTable = ({ accent, title, rows, total, totalCost }) => (
                        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-xs text-slate-500 border-b border-slate-700/50 bg-slate-800/60">
                                        <th className="py-3 px-4 font-medium uppercase tracking-wider">Element</th>
                                        <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">Area (m²)</th>
                                        <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">Cost (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.filter(r => r.area > 0).map((r, i) => (
                                        <tr key={i} className="border-b border-slate-700/20 last:border-0 hover:bg-slate-700/10 transition">
                                            <td className="py-3 px-4 text-sm font-medium flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color || '#64748b' }}></div>
                                                {r.label}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-right text-slate-300 font-mono">{fmt(r.area)}</td>
                                            <td className={`py-3 px-4 text-sm text-right text-${accent}-300 font-mono font-medium`}>{fmtCurrency(r.cost)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className={`bg-${accent}-900/20 border-t border-${accent}-500/30`}>
                                    <tr>
                                        <td className={`py-3 px-4 text-sm font-bold text-${accent}-200`}>{title} SUBTOTAL</td>
                                        <td className="py-3 px-4 text-sm text-right text-slate-300 font-mono font-bold">{fmt(total)} m²</td>
                                        <td className="py-3 px-4 text-right font-mono text-xl font-bold text-white">{fmtCurrency(totalCost)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    );

                    return (<>
                        {/* External Paint */}
                        <section>
                            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-orange-500 rounded-full"></span>
                                External Paint
                            </h2>
                            <div className="flex flex-wrap items-center gap-4 mb-3">
                                <RateInput label="Ext. Paint Rate" value={extPaintRate} onChange={setExtPaintRate} accent="orange" />
                                <div className="flex items-center gap-1">
                                    <span className="text-slate-400 text-xs">Column Exposure:</span>
                                    <input type="number" min="0" max="100" step="5" value={columnExposure}
                                        onChange={(e) => setColumnExposure(parseFloat(e.target.value) || 0)}
                                        className="w-14 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-right text-white font-mono outline-none focus:border-orange-500 transition"
                                    />
                                    <span className="text-slate-500 text-xs">%</span>
                                </div>
                            </div>
                            <SummaryTable accent="orange" title="EXT. PAINT"
                                rows={[
                                    { label: 'RCC Walls (External Face)', area: aggregatedPaint.wall, color: ROLE_COLORS.wall, cost: aggregatedPaint.wall * extPaintRate },
                                    { label: 'Brick Walls (External Face)', area: aggregatedPaint.brick_wall, color: ROLE_COLORS.brick_wall, cost: aggregatedPaint.brick_wall * extPaintRate },
                                ]}
                                total={externalWallArea}
                                totalCost={extPaintCost}
                            />
                        </section>

                        {/* Internal Paint */}
                        <section>
                            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-purple-500 rounded-full"></span>
                                Internal Paint
                            </h2>
                            <div className="flex flex-wrap items-center gap-4 mb-3">
                                <RateInput label="Int. Paint Rate" value={intPaintRate} onChange={setIntPaintRate} accent="purple" />
                            </div>
                            <SummaryTable accent="purple" title="INT. PAINT"
                                rows={[
                                    { label: 'Ceiling (Slab Underside)', area: internalCeilingArea, color: ROLE_COLORS.slab, cost: internalCeilingArea * intPaintRate },
                                    { label: 'RCC Walls (Internal Face)', area: aggregatedPaint.wall, color: ROLE_COLORS.wall, cost: aggregatedPaint.wall * intPaintRate },
                                    { label: 'Brick Walls (Internal Face)', area: aggregatedPaint.brick_wall, color: ROLE_COLORS.brick_wall, cost: aggregatedPaint.brick_wall * intPaintRate },
                                ]}
                                total={internalCeilingArea + internalWallArea}
                                totalCost={intPaintCost}
                            />
                        </section>

                        {/* Waterproofing */}
                        <section>
                            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-cyan-500 rounded-full"></span>
                                Waterproofing
                            </h2>
                            <div className="flex flex-wrap items-center gap-4 mb-3">
                                <RateInput label="Waterproof Rate" value={waterproofRate} onChange={setWaterproofRate} accent="cyan" />
                            </div>
                            <SummaryTable accent="cyan" title="WATERPROOFING"
                                rows={[
                                    { label: 'Roof Slab (Top Exposed)', area: roofSlabArea, color: ROLE_COLORS.slab, cost: roofSlabArea * waterproofRate },
                                    { label: 'External Walls (Exposed)', area: externalWallArea, color: ROLE_COLORS.wall, cost: externalWallArea * waterproofRate },
                                    { label: 'Washroom (WC) Floor', area: fittingSummary.wc?.area || 0, color: ROLE_COLORS.wc,
                                        cost: (fittingSummary.wc?.area || 0) * wcWaterproofRate, customRate: wcWaterproofRate,
                                        customRateChange: setWcWaterproofRate, customRateAccent: 'cyan' },
                                ]}
                                total={waterproofArea + (fittingSummary.wc?.area || 0)}
                                totalCost={waterproofCost + (fittingSummary.wc?.area || 0) * wcWaterproofRate}
                            />
                        </section>

                        {/* Plastering */}
                        <section>
                            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-amber-500 rounded-full"></span>
                                Plastering
                            </h2>
                            <div className="flex flex-wrap items-center gap-4 mb-3">
                                <RateInput label="Plaster Rate" value={plasterRate} onChange={setPlasterRate} accent="amber" />
                            </div>
                            <SummaryTable accent="amber" title="PLASTERING"
                                rows={[
                                    { label: 'Ceiling (Slab Underside)', area: internalCeilingArea, color: ROLE_COLORS.slab, cost: internalCeilingArea * plasterRate },
                                    { label: 'RCC Walls (Both Faces)', area: aggregatedPaint.wall, color: ROLE_COLORS.wall, cost: aggregatedPaint.wall * plasterRate },
                                    { label: 'Brick Walls (Both Faces)', area: aggregatedPaint.brick_wall, color: ROLE_COLORS.brick_wall, cost: aggregatedPaint.brick_wall * plasterRate },
                                ]}
                                total={plasterArea}
                                totalCost={plasterCost}
                            />
                        </section>
                    </>);
                })()}

                {/* ── Tiling Estimate (Flooring & Skirting) ── */}
                {(() => {
                    const rawSlabFloorArea = aggregatedPaint.slab || 0;
                    const wcFloorArea = fittingSummary.wc?.area || 0;
                    const slabFloorArea = Math.max(0, rawSlabFloorArea - wcFloorArea);
                    if (slabFloorArea === 0 && rawSlabFloorArea === 0) return null;
                    
                    const internalPerimeter = 4 * Math.sqrt(slabFloorArea);
                    const slabSkirtingArea = internalPerimeter * slabSkirtingHeight;

                    const TILE_SIZES = { '300x300': 0.09, '600x600': 0.36, '800x800': 0.64, '1200x600': 0.72 };
                    const slabTileArea = TILE_SIZES[slabTileSize] || 0.36;
                    
                    const slabTileCount = Math.ceil((slabFloorArea * 1.05) / slabTileArea);
                    const slabSkirtingTileCount = Math.ceil((slabSkirtingArea * 1.05) / slabTileArea);
                    
                    const slabTilingCost = slabFloorArea * slabTileRate;
                    const slabSkirtingCost = slabSkirtingArea * slabSkirtingRate;
                    const totalTilingCost = slabTilingCost + slabSkirtingCost;

                    return (
                        <section>
                            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-pink-500 rounded-full"></span>
                                Tiling Estimate (Flooring & Skirting)
                            </h2>
                            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="text-xs text-slate-500 border-b border-slate-700/50 bg-slate-800/60">
                                            <th className="py-3 px-4 font-medium uppercase tracking-wider">Element</th>
                                            <th className="py-3 px-4 font-medium uppercase tracking-wider text-center">Tile Size</th>
                                            <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">Area (m²)</th>
                                            <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">Tiles (+5%)</th>
                                            <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">Rate (₹/m²)</th>
                                            <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">Amount (₹)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-b border-slate-700/20 hover:bg-slate-700/10 transition">
                                            <td className="py-3 px-4 text-sm font-medium flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ROLE_COLORS.slab }}></div>
                                                Flooring
                                            </td>
                                            <td className="py-3 px-4 text-sm text-center">
                                                <select value={slabTileSize} onChange={(e) => setSlabTileSize(e.target.value)}
                                                    className={selectClass + " focus:border-pink-500 w-24"}>
                                                    {Object.keys(TILE_SIZES).map(s => <option key={s} value={s}>{s} mm</option>)}
                                                </select>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-right text-slate-300 font-mono">{fmt(slabFloorArea)}</td>
                                            <td className="py-3 px-4 text-sm text-right text-slate-400 font-mono">{slabTileCount} nos</td>
                                            <td className="py-3 px-4 text-sm text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <span className="text-slate-500 text-xs">₹</span>
                                                    <input type="number" value={slabTileRate} onChange={(e) => setSlabTileRate(parseFloat(e.target.value) || 0)}
                                                        className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-right text-white font-mono outline-none focus:border-pink-500 transition" />
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-right text-pink-300 font-mono font-medium">{fmtCurrency(slabTilingCost)}</td>
                                        </tr>
                                        <tr className="hover:bg-slate-700/10 transition">
                                            <td className="py-3 px-4 text-sm font-medium flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#fbcfe8' }}></div>
                                                Skirting (L × h₁)
                                            </td>
                                            <td className="py-3 px-4 text-sm text-center flex justify-center">
                                                <div className="flex items-center gap-1 border border-slate-700 rounded px-2 py-1 bg-slate-900/50 w-24">
                                                    <span className="text-[10px] text-slate-500">h₁:</span>
                                                    <input type="number" step="0.05" min="0" value={slabSkirtingHeight} onChange={(e) => setSlabSkirtingHeight(parseFloat(e.target.value) || 0)}
                                                        className="bg-transparent text-xs text-center text-white font-mono outline-none w-full" />
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-right text-slate-300 font-mono">{fmt(slabSkirtingArea)}</td>
                                            <td className="py-3 px-4 text-sm text-right text-slate-400 font-mono">{slabSkirtingTileCount} nos</td>
                                            <td className="py-3 px-4 text-sm text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <span className="text-slate-500 text-xs">₹</span>
                                                    <input type="number" value={slabSkirtingRate} onChange={(e) => setSlabSkirtingRate(parseFloat(e.target.value) || 0)}
                                                        className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-right text-white font-mono outline-none focus:border-pink-500 transition" />
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-right text-pink-300 font-mono font-medium">{fmtCurrency(slabSkirtingCost)}</td>
                                        </tr>
                                    </tbody>
                                    <tfoot className="bg-pink-900/20 border-t border-pink-500/30">
                                        <tr>
                                            <td className="py-3 px-4 text-sm font-bold text-pink-200" colSpan={5}>TILING SUBTOTAL</td>
                                            <td className="py-3 px-4 text-right font-mono text-xl font-bold text-white">{fmtCurrency(totalTilingCost)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </section>
                    );
                })()}

                {/* ── WC Finishes: Floor Tiling + Skirting + Paint ── */}
                {(() => {
                    const wcFloorArea = fittingSummary.wc?.area || 0;
                    if (wcFloorArea === 0) return null;
                    const wcPerimeter = 4 * Math.sqrt(wcFloorArea); // L+B+L+B ≈ 4√area
                    const wcSkirtingArea = wcPerimeter * wcSkirtingHeight;
                    const TILE_SIZES = { '300x300': 0.09, '600x600': 0.36, '800x800': 0.64, '1200x600': 0.72 };
                    const wcTileArea = TILE_SIZES[wcTileSize] || 0.09;
                    const wcFloorTileCount = Math.ceil((wcFloorArea * 1.05) / wcTileArea);
                    const wcSkirtingTileCount = Math.ceil((wcSkirtingArea * 1.05) / wcTileArea);
                    const wcFloorTileCost = wcFloorArea * wcTileRate;
                    const wcSkirtingCost = wcSkirtingArea * wcSkirtingTileRate;
                    const wcWallHeight = rccSettings?.floorHeight || 3;
                    const wcPaintArea = wcPerimeter * Math.max(0, wcWallHeight - wcSkirtingHeight);
                    const wcPaintCost = wcPaintArea * wcPaintRate;
                    const wcTotal = wcFloorTileCost + wcSkirtingCost + wcPaintCost;
                    return (
                        <section>
                            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-violet-500 rounded-full"></span>
                                Washroom (WC) Finishes
                            </h2>
                            <div className="flex flex-wrap items-center gap-3 mb-4 text-xs bg-slate-800/40 p-3 rounded-lg border border-slate-700/40">
                                <div className="flex items-center gap-1">
                                    <span className="text-slate-400">Tile Size:</span>
                                    <select value={wcTileSize} onChange={e => setWcTileSize(e.target.value)}
                                        className={selectClass + " focus:border-violet-500 w-24"}>
                                        {Object.keys(TILE_SIZES).map(s => <option key={s} value={s}>{s} mm</option>)}
                                    </select>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-slate-400">Floor Rate:</span><span className="text-slate-500">₹</span>
                                    <input type="number" value={wcTileRate} onChange={e => setWcTileRate(parseFloat(e.target.value) || 0)}
                                        className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-right text-white font-mono outline-none focus:border-violet-500 transition" />
                                    <span className="text-slate-500">/m²</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-slate-400">Dado h₁ (m):</span>
                                    <input type="number" step="0.1" value={wcSkirtingHeight} onChange={e => setWcSkirtingHeight(parseFloat(e.target.value) || 0)}
                                        className="w-14 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-right text-white font-mono outline-none focus:border-violet-500 transition" />
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-slate-400">Dado Rate:</span><span className="text-slate-500">₹</span>
                                    <input type="number" value={wcSkirtingTileRate} onChange={e => setWcSkirtingTileRate(parseFloat(e.target.value) || 0)}
                                        className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-right text-white font-mono outline-none focus:border-violet-500 transition" />
                                    <span className="text-slate-500">/m²</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-slate-400">Paint Rate (above dado):</span><span className="text-slate-500">₹</span>
                                    <input type="number" value={wcPaintRate} onChange={e => setWcPaintRate(parseFloat(e.target.value) || 0)}
                                        className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-right text-white font-mono outline-none focus:border-violet-500 transition" />
                                    <span className="text-slate-500">/m²</span>
                                </div>
                            </div>
                            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="text-xs text-slate-500 border-b border-slate-700/50 bg-slate-800/60">
                                            <th className="py-3 px-4 font-medium uppercase tracking-wider">Element</th>
                                            <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">Area (m²)</th>
                                            <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">Tiles (+5%)</th>
                                            <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">Amount (₹)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-b border-slate-700/20 hover:bg-slate-700/10 transition">
                                            <td className="py-3 px-4 text-sm font-medium flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ background: ROLE_COLORS.wc }}></div>
                                                Floor Tiling (L × B)
                                            </td>
                                            <td className="py-3 px-4 text-sm text-right text-slate-300 font-mono">{fmt(wcFloorArea)}</td>
                                            <td className="py-3 px-4 text-sm text-right text-slate-400 font-mono">{wcFloorTileCount} nos</td>
                                            <td className="py-3 px-4 text-sm text-right text-violet-300 font-mono font-medium">{fmtCurrency(wcFloorTileCost)}</td>
                                        </tr>
                                        <tr className="border-b border-slate-700/20 hover:bg-slate-700/10 transition">
                                            <td className="py-3 px-4 text-sm font-medium flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ background: '#8b5cf6' }}></div>
                                                Dado Tiling (L × h₁)
                                            </td>
                                            <td className="py-3 px-4 text-sm text-right text-slate-300 font-mono">{fmt(wcSkirtingArea)}</td>
                                            <td className="py-3 px-4 text-sm text-right text-slate-400 font-mono">{wcSkirtingTileCount} nos</td>
                                            <td className="py-3 px-4 text-sm text-right text-violet-300 font-mono font-medium">{fmtCurrency(wcSkirtingCost)}</td>
                                        </tr>
                                        <tr className="hover:bg-slate-700/10 transition">
                                            <td className="py-3 px-4 text-sm font-medium flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ background: '#a78bfa' }}></div>
                                                Wall Paint (above h₁)
                                            </td>
                                            <td className="py-3 px-4 text-sm text-right text-slate-300 font-mono">{fmt(wcPaintArea)}</td>
                                            <td className="py-3 px-4 text-sm text-right text-slate-400 font-mono">—</td>
                                            <td className="py-3 px-4 text-sm text-right text-violet-300 font-mono font-medium">{fmtCurrency(wcPaintCost)}</td>
                                        </tr>
                                    </tbody>
                                    <tfoot className="bg-violet-900/20 border-t border-violet-500/30">
                                        <tr>
                                            <td className="py-3 px-4 text-sm font-bold text-violet-200" colSpan={3}>WC FINISHES SUBTOTAL</td>
                                            <td className="py-3 px-4 text-right font-mono text-xl font-bold text-white">{fmtCurrency(wcTotal)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </section>
                    );
                })()}


                {/* ── Electrical Estimate ── */}
                {(() => {
                    const numFloors = floors.length || 1;
                    const totalElecPoints = elecPointsPerFloor * numFloors;
                    const elecCost = totalElecPoints * elecRunningLength * elecRate;
                    return (
                        <section>
                            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-yellow-400 rounded-full"></span>
                                Electrical
                            </h2>
                            <div className="flex flex-wrap items-center gap-3 mb-4 text-xs bg-slate-800/40 p-3 rounded-lg border border-slate-700/40">
                                <div className="flex items-center gap-1">
                                    <span className="text-slate-400">Points / Floor:</span>
                                    <input type="number" value={elecPointsPerFloor} onChange={e => setElecPointsPerFloor(parseFloat(e.target.value) || 0)}
                                        className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-right text-white font-mono outline-none focus:border-yellow-500 transition" />
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-slate-400">Running Length / Point (m):</span>
                                    <input type="number" value={elecRunningLength} onChange={e => setElecRunningLength(parseFloat(e.target.value) || 0)}
                                        className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-right text-white font-mono outline-none focus:border-yellow-500 transition" />
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-slate-400">Rate:</span>
                                    <span className="text-slate-500">₹</span>
                                    <input type="number" value={elecRate} onChange={e => setElecRate(parseFloat(e.target.value) || 0)}
                                        className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-right text-white font-mono outline-none focus:border-yellow-500 transition" />
                                    <span className="text-slate-500">/m</span>
                                </div>
                            </div>
                            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="text-xs text-slate-500 border-b border-slate-700/50 bg-slate-800/60">
                                            <th className="py-3 px-4 font-medium uppercase tracking-wider">Description</th>
                                            <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">Points</th>
                                            <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">Length (m)</th>
                                            <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">Amount (₹)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-b border-slate-700/20 hover:bg-slate-700/10 transition">
                                            <td className="py-3 px-4 text-sm font-medium flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ background: '#facc15' }}></div>
                                                Interior Electrical Lines ({numFloors} floor{numFloors > 1 ? 's' : ''} × {elecPointsPerFloor} points)
                                            </td>
                                            <td className="py-3 px-4 text-sm text-right text-slate-300 font-mono">{totalElecPoints}</td>
                                            <td className="py-3 px-4 text-sm text-right text-slate-400 font-mono">{fmt(totalElecPoints * elecRunningLength)} m</td>
                                            <td className="py-3 px-4 text-sm text-right text-yellow-300 font-mono font-medium">{fmtCurrency(elecCost)}</td>
                                        </tr>
                                    </tbody>
                                    <tfoot className="bg-yellow-900/20 border-t border-yellow-500/30">
                                        <tr>
                                            <td className="py-3 px-4 text-sm font-bold text-yellow-200" colSpan={3}>ELECTRICAL SUBTOTAL</td>
                                            <td className="py-3 px-4 text-right font-mono text-xl font-bold text-white">{fmtCurrency(elecCost)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </section>
                    );
                })()}

                {/* ── Grand Total ── */}
                {(() => {
                    const allWallArea = aggregatedPaint.wall + aggregatedPaint.brick_wall;
                    const totalPaintCost = (allWallArea * extPaintRate) + ((aggregatedPaint.slab + allWallArea) * intPaintRate);
                    const waterproofCostGrand = (aggregatedPaint.slab + allWallArea) * waterproofRate + (fittingSummary.wc?.area || 0) * wcWaterproofRate;
                    const plasterCostGrand = (aggregatedPaint.slab + allWallArea) * plasterRate;
                    const slabFloorArea = aggregatedPaint.slab || 0;
                    const wcFloorArea = fittingSummary.wc?.area || 0;
                    const wcPerimeterGrand = 4 * Math.sqrt(wcFloorArea);
                    const wcSkirtingAreaGrand = wcPerimeterGrand * wcSkirtingHeight;
                    const wcWallHeight = (rccSettings?.floorHeight || 3);
                    const wcPaintAreaGrand = wcPerimeterGrand * Math.max(0, wcWallHeight - wcSkirtingHeight);
                    const totalTilingCost = (slabFloorArea * slabTileRate) + (wcFloorArea * wcTileRate) + (wcSkirtingAreaGrand * wcSkirtingTileRate) + (wcPaintAreaGrand * wcPaintRate);
                    const numFloors = floors.length || 1;
                    const elecCostGrand = elecPointsPerFloor * numFloors * elecRunningLength * elecRate;

                    return (
                        <div className="bg-gradient-to-r from-emerald-900/30 to-orange-900/30 border border-emerald-500/20 p-5 rounded-xl flex items-center justify-between mt-6">
                            <span className="font-bold text-lg text-white">ESTIMATED PROJECT COST</span>
                            <span className="font-mono text-3xl font-bold text-white">
                                {fmtCurrency(totalConcreteCost + totalSteelCost + totalPaintCost + waterproofCostGrand + plasterCostGrand + totalTilingCost + elecCostGrand)}
                            </span>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}

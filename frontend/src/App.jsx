import React, { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import Viewer from './components/Viewer';
import ProjectDashboard from './components/ProjectDashboard';
import BOQView from './components/BOQView';
import CarbonEmissionView from './components/CarbonEmissionView';
import ChatbotView from './components/ChatbotView';
import { aciToHex } from './utils';
import { LayoutDashboard, Box, FileText, Leaf, Sparkles, LogOut } from 'lucide-react';

function App() {
  // Auth state
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('eco_matrix_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [authLoading, setAuthLoading] = useState(false);

  const handleLogin = (userData) => {
    localStorage.setItem('eco_matrix_user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('eco_matrix_user');
    setUser(null);
  };

  // State for multiple floors
  // Each floor: { id: string, name: string, dxfData: object, config: object }
  const [floors, setFloors] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'viewer' | 'boq' | 'carbon' | 'ai'
  const [foundation, setFoundation] = useState(null); // { dxfData, config }

  const getGlobalStored = (key, defaultVal) => {
    try {
        const saved = localStorage.getItem('ecomatrix_app_global_' + key);
        return saved ? JSON.parse(saved) : defaultVal;
    } catch { return defaultVal; }
  };

  // Shared EOL selections (used by BOQ and Carbon tabs)
  const [concreteEol, setConcreteEol] = useState(() => getGlobalStored('concreteEol', {
    column: 'Primary material prod', beam: 'Primary material prod', slab: 'Primary material prod', wall: 'Primary material prod',
    footing_base: 'Primary material prod', footing_slope: 'Primary material prod',
  }));
  const [steelEol, setSteelEol] = useState(() => getGlobalStored('steelEol', {
    column: 'Closed-loop source', beam: 'Closed-loop source', slab: 'Closed-loop source', wall: 'Closed-loop source',
  }));

  useEffect(() => {
     localStorage.setItem('ecomatrix_app_global_concreteEol', JSON.stringify(concreteEol));
     localStorage.setItem('ecomatrix_app_global_steelEol', JSON.stringify(steelEol));
  }, [concreteEol, steelEol]);

  // Global RCC Settings
  const [rccSettings, setRccSettings] = useState({
    numFloors: 1, // Total floors to render (can reuse typical floors)
    unitSystem: 'm', // 'mm' or 'm'
    floorHeight: 5,
    beamDepth: 0.45,
    slabThickness: 1,
    autoRotate: false,
    floorGap: 0.3,
    stirrupSpacing: 0.15 // Default 150mm
  });

  const getRandomColor = () => {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 70%, 60%)`;
  };

  const handleUploadSuccess = (dxfData, floorIndex) => {
    const newFloorConfig = {};
    dxfData.layers.forEach(layer => {
      let color = aciToHex(layer.color);
      if (!color || color === '#ffffff' || color === '#000000' || layer.color === 7) {
        color = getRandomColor();
      }
      newFloorConfig[layer.id] = {
        visible: true,
        color: color,
        role: 'generic'
      };
    });

    setFloors(prev => {
      const newFloors = [...prev];
      // If floor exists, update it, else add it
      if (newFloors[floorIndex]) {
        newFloors[floorIndex] = { ...newFloors[floorIndex], dxfData: dxfData, config: newFloorConfig };
      } else {
        // Ensure we fill gaps if any (though usually sequential)
        newFloors[floorIndex] = { id: `floor-${floorIndex}`, name: `Floor ${floorIndex + 1}`, dxfData: dxfData, config: newFloorConfig };
      }
      return newFloors;
    });
  };

  const updateFloorConfig = (floorIndex, layerId, newConfig) => {
    setFloors(prev => {
      const newFloors = [...prev];
      const floor = newFloors[floorIndex];
      if (floor) {
        floor.config = {
          ...floor.config,
          [layerId]: { ...floor.config[layerId], ...newConfig }
        };
      }
      return newFloors;
    });
  };

  const copyFloorData = (sourceIndex, targetIndex) => {
    setFloors(prev => {
      const newFloors = [...prev];
      const sourceFloor = newFloors[sourceIndex];
      if (!sourceFloor) return prev;

      // Deep clone configuration
      const newConfig = JSON.parse(JSON.stringify(sourceFloor.config));

      newFloors[targetIndex] = {
        ...sourceFloor,
        id: `floor-${targetIndex}`,
        name: `Floor ${targetIndex + 1}`,
        config: newConfig
      };

      return newFloors;
    });
  };

  if (authLoading) {
    return (
      <div className="w-full h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="w-full h-screen bg-slate-900 overflow-hidden font-sans flex flex-col">
      {/* Navigation Bar */}
      <nav className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 z-50">
        <div className="flex items-center gap-2 font-bold text-xl text-white tracking-tight">
          <span className="bg-gradient-to-r from-blue-500 to-cyan-400 w-8 h-8 rounded-lg flex items-center justify-center text-slate-900">
            <Box size={20} strokeWidth={3} />
          </span>
          ECO-MATRIX
        </div>

        <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'dashboard'
              ? 'bg-slate-700 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
          >
            <LayoutDashboard size={16} />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('viewer')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'viewer'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
          >
            <Box size={16} />
            3D Viewer
          </button>
          <button
            onClick={() => setActiveTab('boq')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'boq'
              ? 'bg-green-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
          >
            <FileText size={16} />
            BOQ
          </button>
          <button
            onClick={() => setActiveTab('carbon')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'carbon'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
          >
            <Leaf size={16} />
            Carbon
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'ai'
              ? 'bg-violet-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
          >
            <Sparkles size={16} />
            AI Advisor
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-slate-900 text-xs font-bold">
              {user.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || '?'}
            </div>
            <span className="text-sm text-slate-300 max-w-[120px] truncate hidden sm:block">
              {user.displayName || user.email}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg bg-slate-800 hover:bg-red-900/50 text-slate-400 hover:text-red-300 transition border border-slate-700 hover:border-red-500/30"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden">
        {activeTab === 'dashboard' && (
          <ProjectDashboard
            floors={floors}
            setFloors={setFloors}
            rccSettings={rccSettings}
            setRccSettings={setRccSettings}
            onUpload={handleUploadSuccess}
            updateFloorConfig={updateFloorConfig}
            copyFloor={copyFloorData}
            foundation={foundation}
            setFoundation={setFoundation}
          />
        )}
        {activeTab === 'viewer' && (
          <div className="w-full h-full relative">
            {/* We could add an overlay here if no floors are loaded */}
            {(!floors.length || floors.every(f => !f)) && !foundation && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-black/50 backdrop-blur px-4 py-2 rounded-full text-slate-300 text-sm border border-white/10">
                Tip: Go to Dashboard to upload floor plans first.
              </div>
            )}
            <Viewer
              floors={floors}
              rccSettings={rccSettings}
              foundation={foundation}
            />
          </div>
        )}
        {activeTab === 'boq' && (
          <BOQView
            floors={floors}
            rccSettings={rccSettings}
            foundation={foundation}
            concreteEol={concreteEol}
            setConcreteEol={setConcreteEol}
            steelEol={steelEol}
            setSteelEol={setSteelEol}
          />
        )}
        {activeTab === 'carbon' && (
          <CarbonEmissionView
            floors={floors}
            rccSettings={rccSettings}
            foundation={foundation}
            concreteEol={concreteEol}
            setConcreteEol={setConcreteEol}
            steelEol={steelEol}
            setSteelEol={setSteelEol}
          />
        )}
        {activeTab === 'ai' && (
          <ChatbotView
            floors={floors}
            rccSettings={rccSettings}
            foundation={foundation}
            concreteEol={concreteEol}
            steelEol={steelEol}
          />
        )}
      </main>
    </div>
  );
}

export default App;

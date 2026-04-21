import React, { useRef, useState } from 'react';
import { UploadCloud, File, AlertCircle, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../utils';

export default function Upload({ onUploadSuccess }) {
    const fileInputRef = useRef(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_BASE_URL}/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const data = await response.json();
            onUploadSuccess(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="absolute inset-0 flex items-center justify-center bg-transparent pointer-events-none">
            <div className="pointer-events-auto bg-slate-800/80 backdrop-blur-md p-8 rounded-2xl border border-slate-700 shadow-2xl flex flex-col items-center gap-4 text-center max-w-md w-full mx-4">

                <div className="p-4 bg-blue-500/20 rounded-full">
                    <UploadIcon size={48} className="text-blue-400" />
                </div>

                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                    Upload DXF
                </h2>
                <p className="text-slate-400 text-sm">
                    Select a .dxf file to visualize in 3D.
                </p>

                <input
                    type="file"
                    accept=".dxf"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                />

                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <>
                            <Loader2 className="animate-spin" size={20} />
                            Processing...
                        </>
                    ) : (
                        'Select File'
                    )}
                </button>

                {error && (
                    <div className="text-red-400 text-sm mt-2">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}

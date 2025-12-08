import React, { useState, useEffect, useMemo } from 'react';
// Importaciones de Firebase
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, writeBatch, query, updateDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBLjqzXcFGzKqT5PjLSHbFc2fFmt7qY7yA",
  authDomain: "rowa-e0885.firebaseapp.com",
  projectId: "rowa-e0885",
  storageBucket: "rowa-e0885.firebasestorage.app",
  messagingSenderId: "709936077778",
  appId: "1:709936077778:web:2ec2ad5853f803baac860b"
};

// Inicialización
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- UTILIDADES TÉCNICAS ---

const useExternalScript = (url) => {
    const [ready, setReady] = useState(false);
    useEffect(() => {
        if (window.XLSX) { setReady(true); return; }
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.onload = () => setReady(true);
        document.body.appendChild(script);
        return () => { document.body.removeChild(script); };
    }, [url]);
    return ready;
};

// Función para limpiar encabezados del Excel (quita espacios "basura")
const normalizeKeys = (jsonArray) => {
    return jsonArray.map(obj => {
        const newObj = {};
        Object.keys(obj).forEach(key => {
            const cleanKey = key.trim(); 
            newObj[cleanKey] = obj[key];
        });
        return newObj;
    });
};

// Carga en lotes para no saturar Firebase
const commitBatchInChunks = async (db, collectionRef, dataArray) => {
    const CHUNK_SIZE = 450;
    const chunks = [];
    for (let i = 0; i < dataArray.length; i += CHUNK_SIZE) {
        chunks.push(dataArray.slice(i, i + CHUNK_SIZE));
    }
    for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(data => { const docRef = doc(collectionRef); batch.set(docRef, data); });
        await batch.commit();
    }
};

// --- LÓGICA DE NEGOCIO (PICKING) ---
const pickingUtils = {
    processRepartoGeneral: (datos, config) => {
        const { articulosAExcluir, palabrasAExcluir } = config;
        return datos.reduce((acc, pedido) => {
            const articulo = pedido['Producto'] || '';
            const artUpper = articulo.toUpperCase();
            
            const debeExcluirse = articulosAExcluir.includes(articulo) || 
                                  palabrasAExcluir.some(p => artUpper.includes(p));

            if (!debeExcluirse) {
                const chofer = pedido['Chofer'] || 'Sin Chofer Asignado';
                const cantidad = Number(pedido['Cantidad a Entregar']) || 0;
                if (cantidad > 0) {
                    acc[chofer] = acc[chofer] || {};
                    acc[chofer][articulo] = (acc[chofer][articulo] || 0) + cantidad;
                }
            }
            return acc;
        }, {});
    },
    processKitsYLiquidos: (datos) => {
        const palabrasClave = ['KIT', 'LÍQUIDO', 'CONTROL AUTOMATICO', 'CATALOGO DE PRODUCTO (DESPLEGABLE) AR', 'PORTA FOLLETOS SFL/RP AR', 'REP', 'VALV. DESCOMPRESORA'];
        return datos.reduce((acc, pedido) => {
            const articuloActual = pedido['Producto'] || '';
            if (palabrasClave.some(p => articuloActual.toUpperCase().includes(p))) {
                const chofer = pedido['Chofer'] || 'Sin Chofer Asignado';
                const razonSocial = pedido['Razon Social'] || 'Cliente no especificado';
                const cantidad = Number(pedido['Cantidad a Entregar']) || 0;
                if (cantidad > 0) {
                    acc[chofer] = acc[chofer] || [];
                    acc[chofer].push({ razonSocial, articulo: articuloActual, cantidad });
                }
            }
            return acc;
        }, {});
    },
    processFlexibles: (datos) => {
        return datos.reduce((acc, pedido) => {
            const articuloActual = pedido['Producto'] || '';
            if (articuloActual.toUpperCase().includes('FLEXIBLE')) {
                const chofer = pedido['Chofer'] || 'Sin Chofer Asignado';
                const codigo = pedido['Código Producto'] || 'No especificado';
                const cantidad = Number(pedido['Cantidad a Entregar']) || 0;
                if (cantidad > 0) {
                    acc[chofer] = acc[chofer] || {};
                    const existing = acc[chofer][codigo] || { nombre: articuloActual, cantidad: 0 };
                    acc[chofer][codigo] = { ...existing, cantidad: existing.cantidad + cantidad };
                }
            }
            return acc;
        }, {});
    }
};

// --- COMPONENTE PRINCIPAL ---
function App() {
    const [currentView, setCurrentView] = useState('hub');
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [authError, setAuthError] = useState(null);
    
    const isXlsxReady = useExternalScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, 
            (u) => { setUser(u); setAuthLoading(false); },
            (e) => { console.error(e); setAuthError(e.message); setAuthLoading(false); }
        );
        signInAnonymously(auth).catch(e => {
            console.error(e);
            setAuthError(e.message);
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const renderView = () => {
        if (authLoading) return <div className="flex items-center justify-center min-h-screen"><p>Autenticando...</p></div>;
        if (authError) return <div className="flex items-center justify-center min-h-screen text-red-600"><p>{authError}</p></div>;
        if (!user) return <div className="flex items-center justify-center min-h-screen"><p>Esperando sesión...</p></div>;

        switch (currentView) {
            case 'picking': return <PickingApp onNavigate={setCurrentView} isXlsxReady={isXlsxReady} />;
            case 'reception': return <ReceptionApp onNavigate={setCurrentView} isXlsxReady={isXlsxReady} user={user} />;
            default: return <Hub onNavigate={setCurrentView} />;
        }
    };

    return <div className="bg-gray-100 min-h-screen font-sans">{renderView()}</div>;
}

// --- VISTAS VISUALES ---

function Hub({ onNavigate }) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <h1 className="text-5xl font-bold text-gray-800 mb-4 text-center">¿Qué quieres hacer?</h1>
            <p className="text-xl text-gray-600 mb-12 text-center">Selecciona una herramienta para empezar a trabajar.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
                <AppCard title="Asistente de Picking" description="Carga el archivo desde QM para tener un resumen de lo que se va a cargar." onClick={() => onNavigate('picking')} icon="📦" />
                <AppCard title="Recepción de Mercadería" description="Importa el Excel de planta para verificar la mercadería recibida desde la base de datos." onClick={() => onNavigate('reception')} icon="📋" />
            </div>
        </div>
    );
}

function AppCard({ title, description, onClick, icon }) {
    return (
        <div onClick={onClick} className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col">
            <div className="text-4xl mb-4">{icon}</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{title}</h2>
            <div className="text-gray-600 flex-grow">{description}</div>
        </div>
    );
}

function AppContainer({ title, subtitle, onNavigate, children }) {
    return (
        <div className="container mx-auto p-4 md:p-8 max-w-7xl">
            <button onClick={() => onNavigate('hub')} className="mb-8 bg-white px-4 py-2 rounded-lg shadow hover:bg-gray-200 transition-colors">
                &larr; Volver al Menú
            </button>
            <header className="text-center mb-8">
                <h1 className="text-4xl font-bold text-gray-900">{title}</h1>
                <p className="text-gray-600 mt-2">{subtitle}</p>
            </header>
            {children}
        </div>
    );
}

// Componente FileUpload con Drag & Drop
function FileUpload({ onFileLoad, id, children, disabled }) {
    const [isDragging, setIsDragging] = useState(false);
    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); if(!disabled) setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDrop = (e) => { 
        e.preventDefault(); e.stopPropagation(); setIsDragging(false); 
        if(disabled) return;
        const files = e.dataTransfer.files;
        if(files && files.length > 0) onFileLoad(files[0]);
    };
    return (
        <div 
            className={`bg-white p-6 rounded-2xl shadow-lg mb-8 border-2 border-dashed transition-all duration-300 ${isDragging ? 'border-blue-500 bg-blue-50 scale-[1.02]' : 'border-gray-300'} ${disabled ? 'opacity-50 bg-gray-50' : 'hover:border-blue-500 hover:bg-blue-50 cursor-pointer'}`} 
            onClick={() => !disabled && document.getElementById(id).click()}
            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
        >
            <label className="block text-lg font-medium text-gray-700 text-center pointer-events-none">{isDragging ? '¡Suelta el archivo aquí!' : children}</label>
            <input id={id} type="file" onChange={(e) => e.target.files[0] && onFileLoad(e.target.files[0])} accept=".xlsx, .xls, .csv" disabled={disabled} className="hidden" />
            <p className="text-center text-sm text-gray-500 mt-2 pointer-events-none">{disabled ? 'Procesando...' : 'Arrastra el archivo aquí o haz clic'}</p>
        </div>
    );
}

// --- APP RECEPCIÓN (CONTADOR FIJO, BUSCADOR SCROLLEABLE) ---
function ReceptionApp({ onNavigate, isXlsxReady, user }) {
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isImporting, setIsImporting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState(null);

    useEffect(() => {
        const q = query(collection(db, 'users', user.uid, 'receptionOrders'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            data.sort((a, b) => (parseInt(a.nroOrden) || 0) - (parseInt(b.nroOrden) || 0));
            setOrders(data);
            setIsLoading(false);
        }, (err) => { setError("Error al cargar datos."); setIsLoading(false); });
        return () => unsubscribe();
    }, [user]);

    const filteredOrders = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return orders.filter(o => String(o.nroOrden).toLowerCase().includes(term) || String(o.producto).toLowerCase().includes(term) || String(o.cliente).toLowerCase().includes(term));
    }, [orders, searchTerm]);

    const handleImport = (file) => {
        if (!isXlsxReady) return;
        setIsImporting(true);
        setError(null);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const wb = window.XLSX.read(e.target.result, { type: 'array' });
                let json = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                json = normalizeKeys(json);
                const cleanData = json.map(row => ({
                    nroOrden: row['Nro Orden'] || 'N/A',
                    producto: row['Producto'] || 'N/A',
                    cliente: row['Cliente'] || 'N/A',
                    zona: row['Zona'] || 'N/A',
                    recibido: false
                }));
                await commitBatchInChunks(db, collection(db, 'users', user.uid, 'receptionOrders'), cleanData);
            } catch (err) { setError("Error al importar: " + err.message); } finally { setIsImporting(false); }
        };
        reader.readAsArrayBuffer(file);
    };

    const toggleStatus = async (id, status) => { try { await updateDoc(doc(db, 'users', user.uid, 'receptionOrders', id), { recibido: !status }); } catch (e) { alert("Error al actualizar"); } };
    const clearAll = async () => { if(confirm("¿Estás seguro de borrar todo?")) { setIsLoading(true); const batch = writeBatch(db); orders.forEach(o => batch.delete(doc(db, 'users', user.uid, 'receptionOrders', o.id))); await batch.commit(); } };

    return (
        <AppContainer title="Recepción de Mercadería" subtitle="Base de datos de control de ingresos." onNavigate={onNavigate}>
            <FileUpload onFileLoad={handleImport} id="recFile" disabled={isImporting}>{isImporting ? "Importando..." : "Importar Excel de Planta"}</FileUpload>
            
            {isLoading ? <p className="text-center p-8">Sincronizando...</p> : (
                <>
                    {/* STICKY HEADER: SOLO CONTADOR */}
                    <div className="sticky top-0 z-20 bg-gray-100 pt-2 pb-4">
                        <div className="bg-white p-4 rounded-2xl shadow-lg text-center border border-gray-100">
                            <h3 className="text-lg font-medium text-gray-600">Progreso</h3>
                            <p className="text-3xl font-bold text-gray-800 mt-1">
                                <span className={orders.filter(o=>o.recibido).length === orders.length ? 'text-green-500' : 'text-blue-600'}>
                                    {orders.filter(o=>o.recibido).length}
                                </span>
                                <span className="text-gray-400 mx-2">/</span>
                                {orders.length}
                            </p>
                        </div>
                    </div>

                    {/* BUSCADOR SCROLLEABLE */}
                    <input 
                        className="w-full px-4 py-3 bg-white rounded-2xl shadow-lg focus:ring-2 focus:ring-blue-500 outline-none border border-gray-100 mb-8" 
                        placeholder="Buscar por Orden, Producto o Cliente..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                    />

                    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orden</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th></tr></thead>
                            <tbody className="bg-white divide-y divide-gray-200">{filteredOrders.map(o => (<tr key={o.id} className={o.recibido ? 'bg-green-50' : ''}><td className="px-6 py-4"><input type="checkbox" checked={o.recibido} onChange={() => toggleStatus(o.id, o.recibido)} className="h-5 w-5 text-blue-600 rounded cursor-pointer" /></td><td className="px-6 py-4 text-sm font-bold">{o.nroOrden}</td><td className="px-6 py-4 text-sm">{o.producto}</td><td className="px-6 py-4 text-sm text-gray-500">{o.cliente}</td></tr>))}</tbody>
                        </table>
                        {filteredOrders.length === 0 && <p className="text-center p-6 text-gray-500">No hay datos.</p>}
                    </div>
                    <div className="mt-8 flex justify-center"><button onClick={clearAll} className="bg-red-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-600 shadow-md">Borrar Todo</button></div>
                </>
            )}
        </AppContainer>
    );
}

// --- APP PICKING (CON ORDENAMIENTO DE CANTIDAD Y PESTAÑAS NUEVAS) ---
function PickingApp({ onNavigate, isXlsxReady }) {
    const [data, setData] = useState([]);
    const [view, setView] = useState('reparto');
    
    // Configuración de Filtros y VIPs
    const config = useMemo(() => ({
        // Artículos VIP: Aparecen primero y resaltados
        articulosDestacados: ['PRESURIZADOR TANGO SFL 9 220V T2 AR', 'PRESURIZADOR TANGO SFL 14 220V T2 AR', 'PRESURIZADOR TANGO SFL 20 220V T2 AR', 'PRESURIZADOR TANGO PRESS 20 220V T2 AR','ELECTROBOMBA ELEVADORA INTELIGENT 20 220V AR','ELECTROBOMBA ELEVADORA INTELIGENT 24 220V AR'],
        // Artículos a excluir
        articulosAExcluir: ['AUTORIZACION DE RETIRO POR CUENTA Y ORDEN DE ROWA S.A.'],
        // Palabras clave a excluir
        palabrasAExcluir: ['KIT', 'CONJ', 'DISCO', 'TURBINA', 'CAPACITOR', 'MODULO', 'BOBINADO', 'TAPON', 'PLAQUETA', 'SENSOR', 'LIQUIDO', 'CONTROL AUTOMATICO', 'REP', 'CATALOGO', 'VALV.', 'PORTA FOLLETOS', 'FLEXIBLE']
    }), []);

    const process = (f) => {
        if (!isXlsxReady) return;
        const r = new FileReader();
        r.onload = (e) => {
            const wb = window.XLSX.read(e.target.result, { type: 'array' });
            let json = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            json = normalizeKeys(json);
            setData(json);
        };
        r.readAsArrayBuffer(f);
    };

    const viewContent = useMemo(() => {
        if(data.length === 0) return null;
        if(view==='reparto') return <GenericView data={pickingUtils.processRepartoGeneral(data, config)} type="reparto" highlights={config.articulosDestacados} />;
        if(view==='kits') return <GenericView data={pickingUtils.processKitsYLiquidos(data)} type="kits" />;
        return <GenericView data={pickingUtils.processFlexibles(data)} type="flexibles" />;
    }, [data, view, config]);

    // Pestañas Renombradas
    const tabs = [{ id: 'reparto', label: 'Bombas' }, { id: 'kits', label: 'Kits y Reparaciones' }, { id: 'flexibles', label: 'Flexibles' }];

    return (
        <AppContainer title="Asistente de Picking" subtitle="Organización inteligente de pedidos." onNavigate={onNavigate}>
            <FileUpload onFileLoad={process} id="pickFile">Cargar Archivo QM (Picking)</FileUpload>
            {data.length > 0 && (
                <>
                    <div className="flex justify-center mb-6 shadow-sm rounded-lg overflow-hidden">
                        {tabs.map((tab) => (
                            <button key={tab.id} onClick={() => setView(tab.id)} className={`px-6 py-3 font-medium capitalize border transition-colors ${view === tab.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}>{tab.label}</button>
                        ))}
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-lg min-h-[200px]">{viewContent}</div>
                </>
            )}
        </AppContainer>
    );
}

// --- VISTA GENÉRICA ORDENADA (CANTIDAD + VIP) ---
const GenericView = ({ data, type, highlights = [] }) => {
    const keys = Object.keys(data).sort();
    if(keys.length === 0) return <p className="text-center text-gray-500">No hay datos en esta categoría.</p>;
    const isHighlighted = (name) => highlights.includes(name);

    return (
        <div>
            {keys.map(key => {
                let entries = [];
                if (type === 'reparto') {
                    entries = Object.entries(data[key]).sort((a, b) => {
                        const aHigh = isHighlighted(a[0]);
                        const bHigh = isHighlighted(b[0]);
                        // 1. Prioridad VIP
                        if (aHigh && !bHigh) return -1; 
                        if (!aHigh && bHigh) return 1;
                        // 2. Prioridad Cantidad (Mayor a Menor)
                        return b[1] - a[1];
                    });
                } else {
                    entries = (Array.isArray(data[key]) ? data[key] : Object.values(data[key]));
                    // Ordenar por Cantidad
                    entries.sort((a, b) => (b.cantidad || 0) - (a.cantidad || 0));
                }

                return (
                    <details key={key} className="mb-4 bg-white rounded-lg shadow-sm border border-gray-200 group">
                        <summary className="px-6 py-4 text-lg font-semibold cursor-pointer bg-gray-50 hover:bg-gray-100 flex justify-between items-center">
                            {key}
                            <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <div className="p-4 border-t">
                            <table className="min-w-full">
                                <thead>
                                    <tr className="border-b text-left text-gray-500 text-sm"><th className="py-2">Artículo / Cliente</th><th className="py-2 text-right">Cant.</th></tr>
                                </thead>
                                <tbody>
                                    {type === 'reparto' && entries.map(([k, v]) => {
                                        const destacado = isHighlighted(k);
                                        return (
                                            <tr key={k} className={`border-b last:border-0 ${destacado ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''}`}>
                                                <td className={`py-2 px-2 ${destacado ? 'font-bold text-indigo-900' : ''}`}>{k}</td>
                                                <td className={`py-2 px-2 text-right font-bold ${destacado ? 'text-indigo-900' : ''}`}>{v}</td>
                                            </tr>
                                        );
                                    })}
                                    {type !== 'reparto' && entries.map((i, idx) => (
                                        <tr key={idx} className="border-b last:border-0">
                                            <td className="py-2"><div className="font-medium">{i.articulo || i.nombre}</div>{i.razonSocial ? <div className="text-xs text-gray-500">{i.razonSocial}</div> : <div className="text-xs text-gray-500">Cod: {Object.keys(data[key])[idx] || 'S/D'}</div>}</td>
                                            <td className="py-2 text-right font-bold">{i.cantidad}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </details>
                );
            })}
        </div>
    );
};

export default App;
import React, { useState, useRef, useEffect } from 'react';
// Importaciones de Firebase
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, writeBatch, query, updateDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";


// --- PASO FINAL: Pega aquí tu configuración de Firebase ---
// Reemplaza este objeto con el que copiaste de la consola de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBLjqzXcFGzKqT5PjLSHbFc2fFmt7qY7yA",
  authDomain: "rowa-e0885.firebaseapp.com",
  projectId: "rowa-e0885",
  storageBucket: "rowa-e0885.firebasestorage.app",
  messagingSenderId: "709936077778",
  appId: "1:709936077778:web:2ec2ad5853f803baac860b"
};

// Inicialización de Firebase
let app;
let db;
let auth;

// Se inicializa solo si la configuración es válida
if (firebaseConfig.apiKey !== "TU_API_KEY") {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
}


// --- Lógica de Negocio y Utilidades (Para la App de Picking) ---
const pickingUtils = {
    processRepartoGeneral: (datos, config) => {
        const { articulosAExcluir, palabrasAExcluir } = config;
        return datos.reduce((acc, pedido) => {
            const articuloActual = pedido['Producto'] || '';
            const articuloEnMayusculas = articuloActual.toUpperCase();
            if (!articulosAExcluir.includes(articuloActual) && !palabrasAExcluir.some(p => articuloEnMayusculas.includes(p))) {
                const chofer = pedido['Chofer'] || 'Sin Chofer Asignado';
                const cantidad = Number(pedido['Cantidad a Entregar']) || 0;
                if (cantidad > 0) {
                    acc[chofer] = acc[chofer] || {};
                    acc[chofer][articuloActual] = (acc[chofer][articuloActual] || 0) + cantidad;
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
                    acc[chofer].push([razonSocial, articuloActual, cantidad]);
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

// --- Componente Principal: App ---
function App() {
    const [currentView, setCurrentView] = useState('hub');
    const [isXlsxReady, setIsXlsxReady] = useState(false);
    const [user, setUser] = useState(null);
    const [authError, setAuthError] = useState(null);
    const [isAuthenticating, setIsAuthenticating] = useState(true);

    // Verificación de configuración de Firebase
    if (!app) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-red-50 text-red-800 text-center">
                <h1 className="text-4xl font-bold mb-4">Error de Configuración</h1>
                <p className="text-xl max-w-2xl">La configuración de Firebase no se ha añadido todavía.</p>
                <p className="mt-4 text-lg max-w-2xl">Por favor, abre el archivo <strong>App.jsx</strong>, busca el objeto <code>firebaseConfig</code> y reemplázalo con las credenciales de tu proyecto.</p>
            </div>
        );
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setIsAuthenticating(false);
        }, (error) => {
            console.error("Error en onAuthStateChanged:", error);
            setAuthError(error.message);
            setIsAuthenticating(false);
        });

        signInAnonymously(auth).catch(error => {
            console.error("Error en la autenticación anónima:", error);
            setAuthError(error.message);
            setIsAuthenticating(false);
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (window.XLSX) {
            setIsXlsxReady(true);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        script.async = true;
        script.onload = () => setIsXlsxReady(true);
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    const navigateTo = (view) => setCurrentView(view);

    const renderView = () => {
        if (isAuthenticating) {
            return <div className="flex items-center justify-center min-h-screen"><p>Autenticando...</p></div>;
        }

        if (authError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-red-50 text-red-800 text-center">
                    <h1 className="text-4xl font-bold mb-4">Error de Autenticación</h1>
                    <p className="text-xl max-w-2xl">No se pudo conectar con la base de datos.</p>
                    <p className="mt-4 text-sm max-w-2xl bg-red-100 p-2 rounded">
                        <strong>Detalle del error:</strong> {authError}
                    </p>
                    <p className="mt-4 text-lg max-w-2xl">
                        Por favor, verifica que tu <strong>firebaseConfig</strong> sea correcta y que la <strong>autenticación anónima</strong> esté habilitada en la consola de Firebase.
                    </p>
                </div>
            );
        }

        if (!user) {
            return <div className="flex items-center justify-center min-h-screen"><p>Error: No se pudo obtener el usuario. Refresca la página.</p></div>;
        }

        switch (currentView) {
            case 'picking':
                return <PickingApp onNavigate={navigateTo} isXlsxReady={isXlsxReady} />;
            case 'reception':
                return <ReceptionApp onNavigate={navigateTo} isXlsxReady={isXlsxReady} user={user} />;
            case 'hub':
            default:
                return <Hub onNavigate={navigateTo} />;
        }
    };

    return <div className="bg-gray-100 min-h-screen font-sans">{renderView()}</div>;
}

// --- Componentes del Menú y UI General ---
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
            <BackButton onNavigate={onNavigate} />
            <header className="text-center mb-8">
                <h1 className="text-4xl font-bold text-gray-900">{title}</h1>
                <p className="text-gray-600 mt-2">{subtitle}</p>
            </header>
            {children}
        </div>
    );
}

function BackButton({ onNavigate }) {
    return (
        <button onClick={() => onNavigate('hub')} className="mb-8 bg-white px-4 py-2 rounded-lg shadow hover:bg-gray-200 transition-colors">
            &larr; Volver al Menú
        </button>
    );
}

function FileUpload({ onFileLoad, id, children, disabled }) {
    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg mb-8">
            <label className="block text-lg font-medium text-gray-700 mb-2" htmlFor={id}>
                {children}
            </label>
            <input
                id={id}
                type="file"
                onChange={(e) => {
                    onFileLoad(e.target.files[0]);
                    e.target.value = null; // Permite recargar el mismo archivo
                }}
                accept=".xlsx, .xls"
                disabled={disabled}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
            />
        </div>
    );
}

function DataTable({ headers, data, renderRow }) {
    return (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            {headers.map(h => <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>)}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {data.map(renderRow)}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// --- Componente de la Aplicación de Recepción (con Base de Datos) ---
function ReceptionApp({ onNavigate, isXlsxReady, user }) {
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!user) return;
        
        setIsLoading(true);
        const ordersCollection = collection(db, 'users', user.uid, 'receptionOrders');
        const q = query(ordersCollection);

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const ordersData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })).sort((a, b) => {
                const numA = parseInt(a.nroOrden, 10);
                const numB = parseInt(b.nroOrden, 10);
                return !isNaN(numA) && !isNaN(numB) ? numA - numB : String(a.nroOrden).localeCompare(String(b.nroOrden));
            });
            setOrders(ordersData);
            setIsLoading(false);
        }, (err) => {
            console.error("Error al leer desde Firestore:", err);
            setError("No se pudieron cargar las órdenes desde la base de datos.");
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const handleFileImport = async (file) => {
        if (!file || !isXlsxReady || !user) return;

        setIsImporting(true);
        setError(null);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = window.XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = window.XLSX.utils.sheet_to_json(worksheet);

                const batch = writeBatch(db);
                const ordersCollection = collection(db, 'users', user.uid, 'receptionOrders');

                json.forEach(row => {
                    const newOrder = {
                        nroOrden: row['Nro Orden'] || 'N/A',
                        producto: row['Producto'] || 'N/A',
                        cliente: row['Cliente'] || 'N/A',
                        zona: row['Zona'] || 'N/A',
                        recibido: false
                    };
                    const docRef = doc(ordersCollection);
                    batch.set(docRef, newOrder);
                });

                await batch.commit();
            } catch (err) {
                console.error("Error al importar el archivo:", err);
                setError(`Error al procesar el archivo: ${err.message}`);
            } finally {
                setIsImporting(false);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleTickToggle = async (orderId, currentStatus) => {
        if (!user) return;
        const docRef = doc(db, 'users', user.uid, 'receptionOrders', orderId);
        try {
            await updateDoc(docRef, { recibido: !currentStatus });
        } catch (err) {
            console.error("Error al actualizar la orden:", err);
            setError("No se pudo actualizar el estado de la orden.");
        }
    };
    
    const handleExport = () => {
        if (!isXlsxReady) {
            setError("La librería de Excel no está lista para exportar.");
            return;
        }

        const dataToExport = orders.map(order => ({
            'Estado': order.recibido ? 'Recibido' : 'Pendiente',
            'Nro Orden': order.nroOrden,
            'Producto': order.producto,
            'Cliente': order.cliente,
            'Zona': order.zona,
        }));

        const ws = window.XLSX.utils.json_to_sheet(dataToExport);
        const greenStyle = { fill: { fgColor: { rgb: "C6EFCE" } } };
        const redStyle = { fill: { fgColor: { rgb: "FFC7CE" } } };

        dataToExport.forEach((record, index) => {
            const style = record.Estado === 'Recibido' ? greenStyle : redStyle;
            const range = window.XLSX.utils.decode_range(ws['!ref']);
            for (let col = range.s.c; col <= range.e.c; col++) {
                const cellAddress = window.XLSX.utils.encode_cell({ r: index + 1, c: col });
                if (ws[cellAddress]) ws[cellAddress].s = style;
            }
        });

        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, "Recepción");
        window.XLSX.writeFile(wb, "recepcion_verificada.xlsx");
    };

    const handleClearAllOrders = async () => {
        if (!user || !window.confirm("¿Estás seguro de que quieres borrar TODAS las órdenes de la base de datos? Esta acción no se puede deshacer.")) {
            return;
        }
        
        setIsLoading(true);
        try {
            const batch = writeBatch(db);
            orders.forEach(order => {
                const docRef = doc(db, 'users', user.uid, 'receptionOrders', order.id);
                batch.delete(docRef);
            });
            await batch.commit();
        } catch (err) {
            console.error("Error al borrar las órdenes:", err);
            setError("No se pudieron borrar las órdenes.");
            setIsLoading(false);
        }
    };

    return (
        <AppContainer title="Recepción de Mercadería" subtitle="Importa un Excel para cargar las órdenes en la base de datos." onNavigate={onNavigate}>
            <FileUpload onFileLoad={handleFileImport} id="receptionFile" disabled={isImporting}>
                {isImporting ? "Importando datos..." : "Importar órdenes desde Excel"}
            </FileUpload>

            {isLoading && <p className="p-8 text-center">Cargando datos desde la base de datos...</p>}
            {error && <p className="p-8 text-center text-red-500">{error}</p>}
            
            {!isLoading && !error && orders.length > 0 && (
                <>
                    <DataTable
                        headers={['Recibido', 'Nro Orden', 'Producto', 'Cliente', 'Zona']}
                        data={orders}
                        renderRow={(order) => (
                            <tr key={order.id} className={`${order.recibido ? 'bg-green-100 text-gray-400 line-through' : ''} transition-colors`}>
                                <td className="px-6 py-4"><input type="checkbox" checked={order.recibido} onChange={() => handleTickToggle(order.id, order.recibido)} className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" /></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{order.nroOrden}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{order.producto}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{order.cliente}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{order.zona}</td>
                            </tr>
                        )}
                    />
                    <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
                        <button onClick={handleExport} className="bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 transition-colors shadow-md w-full sm:w-auto">
                            Exportar a Excel
                        </button>
                        <button onClick={handleClearAllOrders} className="bg-red-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-600 transition-colors shadow-md w-full sm:w-auto">
                            Borrar Todas las Órdenes
                        </button>
                    </div>
                </>
            )}
            {!isLoading && !error && orders.length === 0 && <p className="text-center text-gray-500 p-8">No hay órdenes en la base de datos. Importa un archivo para empezar.</p>}
        </AppContainer>
    );
}

// --- Componente de la Aplicación de Picking ---
function PickingApp({ onNavigate, isXlsxReady }) {
    const [datosCargados, setDatosCargados] = useState([]);
    const [activeView, setActiveView] = useState('reparto');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [fileName, setFileName] = useState('');

    const config = {
        articulosAExcluir: ['PRESURIZADOR TANGO SFL 9 220V T2 AR', 'PRESURIZADOR TANGO SFL 14 220V T2 AR', 'PRESURIZADOR TANGO SFL 20 220V T2 AR', 'PRESURIZADOR TANGO PRESS 20 220V T2 AR','ELECTROBOMBA ELEVADORA INTELIGENT 20 220V AR','ELECTROBOMBA ELEVADORA INTELIGENT 24 220V AR', 'AUTORIZACION DE RETIRO POR CUENTA Y ORDEN DE ROWA S.A.'],
        palabrasAExcluir: ['KIT', 'CONJ', 'DISCO', 'TURBINA', 'CAPACITOR', 'MODULO', 'BOBINADO', 'TAPON', 'PLAQUETA', 'SENSOR', 'LIQUIDO', 'CONTROL AUTOMATICO', 'REP', 'CATALOGO DE PRODUCTO (DESPLEGABLE) AR', 'VALV. PLASTICA 1', 'PORTA FOLLETOS SFL/RP AR', 'VALV. DESCOMPRESORA']
    };

    const handleFileLoad = (file) => {
        if (!file) return;
        if (!isXlsxReady) {
            setError("La librería para leer archivos Excel no está lista. Por favor, espera un momento y vuelve a intentarlo.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setFileName(file.name);
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = window.XLSX.read(data, { type: 'array' });
                const dataJSON = window.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                setDatosCargados(dataJSON);
                setActiveView('reparto');
            } catch (err) {
                setError(`Error al procesar el archivo: ${err.message}`);
            } finally {
                setIsLoading(false);
            }
        };
        reader.onerror = () => {
            setError('No se pudo leer el archivo.');
            setIsLoading(false);
        };
        reader.readAsArrayBuffer(file);
    };

    const renderContent = () => {
        if (isLoading) return <div className="text-center p-8">Cargando...</div>;
        if (error) return <div className="text-center p-8 text-red-500">{error}</div>;
        if (datosCargados.length === 0) return <p className="text-center text-gray-500">Esperando archivo para procesar...</p>;

        let processedData, ViewComponent;
        switch (activeView) {
            case 'reparto':
                processedData = pickingUtils.processRepartoGeneral(datosCargados, config);
                ViewComponent = VistaRepartoGeneral;
                break;
            case 'kits':
                processedData = pickingUtils.processKitsYLiquidos(datosCargados);
                ViewComponent = VistaKitsYLiquidos;
                break;
            case 'flexibles':
                processedData = pickingUtils.processFlexibles(datosCargados);
                ViewComponent = VistaFlexibles;
                break;
            default: return null;
        }
        return <ViewComponent data={processedData} />;
    };

    return (
        <AppContainer title="Asistente de Picking" subtitle="Carga tu archivo de Excel para organizar los pedidos." onNavigate={onNavigate}>
            <FileUpload onFileLoad={handleFileLoad} fileName={fileName} id="pickingFile">
                Cargar archivo de picking
            </FileUpload>
            
            {datosCargados.length > 0 && (
                <div className="text-center mb-8">
                    <div className="inline-flex rounded-md shadow-sm">
                        <button onClick={() => setActiveView('reparto')} className={`px-4 py-2 text-sm font-medium border ${activeView === 'reparto' ? 'bg-blue-600 text-white' : 'bg-white text-gray-900'} rounded-l-lg`}>Reparto General</button>
                        <button onClick={() => setActiveView('kits')} className={`px-4 py-2 text-sm font-medium border-t border-b ${activeView === 'kits' ? 'bg-blue-600 text-white' : 'bg-white text-gray-900'}`}>KITS y Reparaciones</button>
                        <button onClick={() => setActiveView('flexibles')} className={`px-4 py-2 text-sm font-medium border ${activeView === 'flexibles' ? 'bg-blue-600 text-white' : 'bg-white text-gray-900'} rounded-r-lg`}>Flexibles</button>
                    </div>
                </div>
            )}
            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg min-h-[100px]">{renderContent()}</div>
        </AppContainer>
    );
}

// --- Sub-componentes de Vistas para Picking ---
function Acordeon({ titulo, children }) {
    return (
        <details className="mb-4 bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
            <summary className="px-6 py-4 text-lg font-semibold cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"><strong>{titulo}</strong></summary>
            <div className="border-t border-gray-200 p-1">{children}</div>
        </details>
    );
}
function TablaSimple({ headers, data }) {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr>{headers.map(h => <th key={h} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>)}</tr></thead><tbody className="bg-white divide-y divide-gray-200">{data.map((row, i) => (<tr key={i}>{row.map((cell, j) => <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{cell}</td>)}</tr>))}</tbody></table>
        </div>
    );
}

function VistaRepartoGeneral({ data }) {
    const choferesOrdenados = Object.keys(data).sort();
    if (choferesOrdenados.length === 0) return <p className="text-center p-4">No se encontraron pedidos para esta vista.</p>;
    return <div>{choferesOrdenados.map(chofer => <Acordeon key={chofer} titulo={chofer}><TablaSimple headers={['Artículo', 'Cantidad Total']} data={Object.entries(data[chofer]).sort()} /></Acordeon>)}</div>;
}
function VistaKitsYLiquidos({ data }) {
    const choferesOrdenados = Object.keys(data).sort();
    if (choferesOrdenados.length === 0) return <p className="text-center p-4">No se encontraron KITS o Reparaciones.</p>;
    return <div>{choferesOrdenados.map(chofer => <Acordeon key={chofer} titulo={`${chofer} (Kits y Reparaciones)`}><TablaSimple headers={['Razón Social', 'Artículo', 'Cantidad']} data={data[chofer].sort((a, b) => a[0].localeCompare(b[0]))} /></Acordeon>)}</div>;
}
function VistaFlexibles({ data }) {
    const choferesOrdenados = Object.keys(data).sort();
    if (choferesOrdenados.length === 0) return <p className="text-center p-4">No se encontraron productos "Flexibles".</p>;
    return <div>{choferesOrdenados.map(chofer => <Acordeon key={chofer} titulo={`${chofer} (Flexibles)`}><TablaSimple headers={['Código Producto', 'Nombre', 'Cantidad']} data={Object.entries(data[chofer]).map(([codigo, {nombre, cantidad}]) => [codigo, nombre, cantidad]).sort()} /></Acordeon>)}</div>;
}

export default App;

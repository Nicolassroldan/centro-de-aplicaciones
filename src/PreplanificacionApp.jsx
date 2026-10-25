// --- MÓDULO: PREPLANIFICACIÓN DE FLETES ---
// La herramienta vive en public/preplanificacion.html (la misma página que se usa en Claude).
// Acá la mostramos dentro del sitio y le damos un guardado en Firebase con la misma forma
// que espera la página: db.doc("pre/plan"), db.doc("geo/c0"), db.collection("geo").get().
import { useState, useEffect, useRef } from 'react';
import { getApp } from 'firebase/app';
import { getFirestore, doc, collection, getDoc, getDocs, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

// "pre/plan" -> colección preplan_pre, documento plan ; "geo/c0" -> preplan_geo / c0
const fs = () => getFirestore(getApp());
const refDoc = (path) => { const [col, id] = path.split('/'); return doc(fs(), 'preplan_' + col, id); };
// Firestore no acepta listas dentro de listas: guardamos cada documento como texto JSON
const pack = (data) => ({ json: JSON.stringify(data), actualizado: Date.now() });
const unpack = (snap) => {
    const exists = snap.exists();
    const raw = exists ? snap.data() : null;
    return { exists, data: () => (raw && raw.json ? JSON.parse(raw.json) : undefined) };
};

const rowaPreplanStore = {
    doc: (path) => ({
        get: async () => unpack(await getDoc(refDoc(path))),
        set: (data) => setDoc(refDoc(path), pack(data)),
        delete: () => deleteDoc(refDoc(path)),
        onSnapshot: (next, error) => onSnapshot(refDoc(path), (s) => next(unpack(s)), error),
    }),
    collection: (path) => ({
        get: async () => {
            const qs = await getDocs(collection(fs(), 'preplan_' + path));
            return { docs: qs.docs.map(unpack) };
        },
    }),
};
if (typeof window !== 'undefined') window.rowaPreplanStore = rowaPreplanStore;

// Se agrega un número distinto en cada carga para que el navegador no muestre una versión vieja guardada
const PAGINA = '/preplanificacion.html?v=' + Date.now();

export default function PreplanificacionApp({ onNavigate }) {
    const [height, setHeight] = useState(900);
    const [aviso, setAviso] = useState(null);
    const frameRef = useRef(null);

    useEffect(() => {
        let t;
        window.rowaPreplanResize = (h) => setHeight(Math.max(400, h));
        window.rowaPreplanToast = (msg) => { setAviso(msg); clearTimeout(t); t = setTimeout(() => setAviso(null), 4500); };
        window.rowaPreplanScrollTop = () => frameRef.current && window.scrollTo({ top: frameRef.current.getBoundingClientRect().top + window.scrollY - 16, behavior: 'smooth' });
        return () => { clearTimeout(t); delete window.rowaPreplanResize; delete window.rowaPreplanToast; delete window.rowaPreplanScrollTop; };
    }, []);

    return (
        <AppContainerPreplan onNavigate={onNavigate}>
            <iframe
                ref={frameRef}
                src={PAGINA}
                title="Preplanificación de fletes"
                scrolling="no"
                style={{ height: height + 'px' }}
                className="w-full border-0 block bg-transparent"
            />
            {aviso && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-5 py-3 rounded-xl shadow-lg text-sm max-w-xl z-50">
                    {aviso}
                </div>
            )}
        </AppContainerPreplan>
    );
}

// Mismo armado que AppContainer en App.jsx (botón de volver + título centrado)
function AppContainerPreplan({ onNavigate, children }) {
    return (
        <div className="container mx-auto p-4 md:p-8 max-w-7xl">
            <button onClick={() => onNavigate('hub')} className="mb-8 bg-white px-4 py-2 rounded-lg shadow hover:bg-gray-200 transition-colors">
                &larr; Volver al Menú
            </button>
            <header className="text-center mb-8">
                <h1 className="text-4xl font-bold text-gray-900">Preplanificación de Fletes</h1>
                <p className="text-gray-600 mt-2">Armado del reparto del día siguiente por zona, con mapa y recorrido desde Rowa Escobar.</p>
            </header>
            {children}
        </div>
    );
}

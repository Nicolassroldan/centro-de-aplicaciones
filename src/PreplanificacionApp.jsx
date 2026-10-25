// --- MÓDULO: PREPLANIFICACIÓN DE FLETES ---
// La herramienta vive en public/preplanificacion.html (la misma página que se usa en Claude).
// Acá la mostramos dentro del sitio y le damos un guardado en Firebase con la misma forma
// que espera la página: db.doc("pre/plan"), db.doc("geo/c0"), db.collection("geo").get().
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

export default function PreplanificacionApp({ onNavigate }) {
    return (
        <div className="flex flex-col h-screen">
            <div className="flex items-center gap-4 px-4 py-2 bg-white shadow-sm">
                <button onClick={() => onNavigate('hub')} className="bg-white px-4 py-2 rounded-lg shadow hover:bg-gray-200 transition-colors">
                    &larr; Volver al Menú
                </button>
                <span className="text-gray-600 text-sm">Preplanificación de fletes</span>
            </div>
            <iframe
                src="/preplanificacion.html"
                title="Preplanificación de fletes"
                className="flex-1 w-full border-0"
            />
        </div>
    );
}

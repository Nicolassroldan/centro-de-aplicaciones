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

// Normalizar claves del JSON
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

// Carga en lotes a Firestore
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

// --- LÓGICA DE NEGOCIO (LOGÍSTICA / FIFO) ---
const logisticsUtils = {
    // Clientes Parciales
    CLIENTES_PARCIALES: new Set([
        '10002', '10003', '10006', '10009', '10012', '10014', '10022', '10023', '10026', '10027', '10028', '10032', '10033', '10040', '10042', '10043', '10050', '10053', '10056', '10057', '10059', '10060', '10066', '10067', '10068', '10076', '10083', '10084', '10089', '10093', '10094', '10096', '10097', '101', '10102', '10104', '10105', '10110', '10113', '10114', '10115', '10116', '10117', '10118', '10119', '10121', '10123', '10125', '10128', '10129', '10136', '10137', '10138', '10140', '10142', '10144', '10147', '10149', '10153', '10159', '10166', '10167', '10169', '10170', '10176', '10178', '10180', '10183', '10186', '10187', '10191', '10193', '10201', '10202', '10204', '10206', '10207', '10211', '10212', '10214', '10215', '10217', '10218', '10223', '10227', '10232', '10235', '10239', '10240', '10241', '10245', '10249', '10251', '10252', '10254', '10257', '10258', '10259', '10263', '10269', '10270', '10272', '10281', '10283', '10285', '10287', '10288', '10289', '10293', '10294', '10295', '103', '10306', '10308', '10309', '10311', '10312', '10316', '10320', '10322', '10323', '10326', '10327', '10331', '10335', '10336', '10339', '10340', '10341', '10342', '10344', '10346', '10349', '10359', '10361', '10364', '10365', '10369', '10371', '10376', '10377', '10378', '10381', '10382', '10383', '10385', '10386', '10388', '10391', '10392', '10395', '10398', '10399', '10403', '10413', '10417', '10419', '10420', '10421', '10424', '10426', '10429', '10430', '10431', '10432', '10433', '10434', '10439', '10440', '10441', '10442', '10446', '10451', '10454', '10455', '10456', '10457', '10458', '10459', '10461', '10466', '10470', '10473', '10475', '10477', '10478', '10479', '10484', '10485', '10486', '10490', '10492', '10494', '10497', '10501', '10502', '10505', '10506', '10510', '10515', '10516', '10519', '10521', '10522', '10523', '10530', '10531', '10537', '10538', '10547', '10549', '10550', '10555', '10556', '10562', '10566', '10569', '10571', '10572', '10579', '10582', '10584', '10585', '10588', '10596', '10597', '10599', '10600', '10601', '10602', '10604', '10606', '10607', '10609', '10612', '10616', '10617', '10620', '10621', '10629', '10633', '10636', '10639', '10640', '10641', '10642', '10643', '10647', '10653', '10661', '10663', '10668', '10677', '10681', '10682', '10684', '10688', '10690', '10695', '10696', '10698', '10704', '10708', '10709', '10710', '10714', '10717', '10718', '10722', '10725', '10726', '10728', '10730', '10731', '10735', '10737', '10738', '10739', '10740', '10741', '10742', '10743', '10744', '10745', '10746', '10747', '10748', '10749', '10750', '10751', '10752', '10753', '10754', '10755', '10756', '10757', '10758', '10759', '10760', '10761', '10762', '10763', '10765', '10766', '10767', '10768', '10769', '10772', '10773', '10774', '10775', '10776', '10777', '10779', '10784', '10785', '10787', '10788', '10791', '10792', '10796', '10803', '10804', '10806', '10807', '10809', '10810', '10811', '10812', '10813', '10814', '10815', '10816', '10817', '10818', '10820', '10821', '10823', '10826', '10829', '10830', '10831', '10833', '10834', '10835', '10836', '10838', '10841', '10843', '10848', '10850', '10851', '10852', '10854', '10856', '10857', '10858', '10863', '10864', '10865', '10866', '10867', '10868', '10869', '10870', '10871', '10874', '10876', '10878', '10880', '10881', '10882', '10885', '10887', '10888', '10889', '10890', '10893', '10894', '10895', '10896', '10904', '10905', '10906', '10907', '10908', '10909', '10913', '10916', '10919', '10920', '10922', '10923', '10924', '10927', '10933', '10934', '10936', '10937', '10939', '10940', '10941', '10942', '10943', '10944', '10945', '10946', '10947', '10949', '10950', '10951', '10952', '10953', '10954', '10955', '10958', '10961', '10962', '10963', '10964', '10968', '10969', '10974', '10975', '10979', '10983', '10984', '10989', '10990', '10993', '10994', '10995', '10996', '10999', '11000', '11003', '11005', '11007', '11009', '11016', '11018', '11019', '11024', '11028', '11038', '11045', '11067', '11097', '11104', '11127', '11147', '11159', '11163', '11175', '11178', '11180', '11230', '11241', '11249', '11250', '11254', '11275', '11278', '11295', '11297', '11307', '11314', '11341', '11352', '11375', '11377', '11386', '11387', '11395', '11413', '11415', '11420', '11428', '11432', '11439', '11442', '11445', '11451', '11454', '11462', '11469', '11472', '11478', '11484', '11497', '11505', '11514', '11520', '11523', '11527', '11551', '11567', '11568', '11644', '11659', '11728', '11800', '11844', '11848', '11854', '11880', '11924', '11927', '11946', '11952', '11974', '12003', '12084', '12086', '12087', '12090', '12092', '12093', '12094', '12095', '12096', '12101', '12102', '12105', '12107', '12108', '12111', '12114', '12116', '12120', '12122', '12125', '12126', '12127', '12128', '12129', '12131', '12132', '12134', '12136', '12156', '12157', '12172', '12199', '12200', '12201', '12202', '12203', '12204', '12205', '12206', '12207', '12208', '12209', '12211', '12212', '12213', '12214', '12215', '12216', '12217', '12224', '12225', '12226', '12230', '12231', '12233', '12234', '12269', '12273', '12274', '12276', '12299', '12349', '12351', '12352', '12354', '12355', '12356', '12357', '12364', '12366', '12378', '12379', '12381', '12386', '12388', '12415', '12418', '12419', '12423', '12426', '12682', '12685', '12693', '12721', '12744', '12745', '12748', '12749', '12750', '12754', '12813', '12814', '12865', '12879', '12890', '12891', '12912', '12916', '12952', '13056', '13082', '13092', '13120', '13124', '13249', '13259', '13262', '13273', '13314', '13348', '13362', '13363', '13384', '13392', '13412', '13440', '13461', '13468', '13480', '13487', '13496', '13501', '13544', '13551', '13556', '13561', '13589', '13619', '13634', '13643', '13647', '13649', '13662', '13664', '13667', '13695', '13700', '13702', '13734', '13739', '13740', '13752', '13793', '13809', '13827', '13833', '13857', '13867', '13893', '13895', '13911', '13914', '13926', '13953', '13954', '13966', '13969', '14020', '14046', '14047', '14073', '14110', '14112', '14118', '14120', '14124', '14129', '14149', '14173', '14190', '14193', '14195', '14204', '14205', '14215', '14217', '14218', '14246', '14272', '14275', '14282', '14293', '14324', '14339', '14343', '14355', '14374', '14391', '14420', '14434', '14445', '14446', '14473', '14475', '14493', '14507', '14529', '14538', '14559', '14604', '14606', '14649', '14697', '14700', '14705', '14767', '14784', '14788', '14793', '14834', '14835', '14844', '14857', '14886', '14888', '14909', '14913', '14997', '14998', '14999', '15004', '15055', '15056', '15061', '15062', '15070', '15142', '15176', '15185', '15216', '15223', '15261', '15273', '15323', '15330', '15362', '15370', '15371', '15373', '15380', '15414', '15417', '15454', '15457', '15466', '15479', '15496', '15511', '15539', '15548', '15562', '15587', '15588', '15591', '15595', '15602', '15611', '15613', '15632', '15641', '15645', '15649', '15657', '15658', '15669', '15671', '15686', '15722', '15765', '15766', '15767', '15780', '15795', '15804', '15829', '15839', '15848', '15851', '15870', '15925', '15927', '15950', '15961', '15988', '15993', '16012', '16047', '16049', '16050', '16054', '16056', '16064', '16066', '16073', '16078', '16079', '16109', '16129', '16165', '16168', '16231', '16255', '16290', '16291', '16311', '16312', '16346', '16351', '16352', '16353', '16409', '16417', '16422', '16426', '16427', '16459', '16485', '16486', '16504', '5']),

    processFIFO: (dataRaw) => {
        // 1. Limpieza y Filtrado
        const data = dataRaw
            .filter(row => {
                const pedido = String(row['Pedido'] || '').toUpperCase();
                return pedido.includes('PTERM') || pedido.includes('CANJE');
            })
            .map(row => {
                const rawTercero = String(row['Tercero'] || '');
                const terceroClean = rawTercero.trim().replace(/^0+/, '');
                const razonSocial = String(row['Razon Social'] || '').toUpperCase();
                const esFalabella = razonSocial.includes('FALABELLA');
                
                // Regla especial Click On / Abasto / Casa Pick
                const esCooperativaForce = razonSocial.includes('CLICK ON') || 
                                           razonSocial.includes('CLICKON') ||
                                           razonSocial.includes('ABASTO') || 
                                           razonSocial.includes('CASA PICK');

                const aceptaParcial = (logisticsUtils.CLIENTES_PARCIALES.has(terceroClean) || esCooperativaForce) && !esFalabella;

                const fechaStr = row['Fecha Pedido'] || '';
                const [day, month, year] = fechaStr.split('/');
                const fechaObj = new Date(`${year}-${month}-${day}`); 

                return {
                    ...row,
                    _terceroClean: terceroClean,
                    _aceptaParcial: aceptaParcial,
                    _fechaObj: fechaObj,
                    _fechaStr: fechaStr,
                    _pedidoId: row['Pedido'],
                    _articulo: row['Articulo'],
                    _descripcion: row['Descripcion'],
                    _pendiente: Number(row['Pendiente'] || 0),
                    _stockRealCalculado: Number(row['Disponible'] || 0)
                };
            });

        data.sort((a, b) => a._fechaObj - b._fechaObj);

        // Inventario Inicial
        const inventario = {};
        data.forEach(row => {
            if (inventario[row._articulo] === undefined) {
                inventario[row._articulo] = row._stockRealCalculado;
            }
        });

        const pedidosMap = new Map();
        data.forEach(row => {
            if (!pedidosMap.has(row._pedidoId)) {
                pedidosMap.set(row._pedidoId, { info: row, items: [] });
            }
            pedidosMap.get(row._pedidoId).items.push(row);
        });

        const resultadosHojaRuta = [];
        const consolidadoLiberacion = {};

        // MOTOR FIFO
        pedidosMap.forEach((pedidoData, pedidoId) => {
            const { info, items } = pedidoData;
            const aceptaParcial = info._aceptaParcial;

            if (aceptaParcial) {
                // PARCIAL
                items.forEach(item => {
                    const art = item._articulo;
                    const cant = item._pendiente;
                    let estado = "";
                    if (cant <= 0) {
                        estado = "✅ Ya Asignado";
                    } else if ((inventario[art] || 0) >= cant) {
                        inventario[art] -= cant;
                        estado = "✅ Listo (Parcial)";
                    } else {
                        estado = `⏳ Falta: ${art}`;
                    }
                    resultadosHojaRuta.push({
                        fecha: item._fechaStr,
                        pedido: pedidoId,
                        cliente: item['Razon Social'],
                        articulo: art,
                        descripcion: item._descripcion,
                        pendiente: cant,
                        estado: estado
                    });
                });
            } else {
                // RÍGIDA
                let faltantes = [];
                items.forEach(item => {
                    const art = item._articulo;
                    const cant = item._pendiente;
                    if (cant > 0 && (inventario[art] || 0) < cant) {
                        faltantes.push(art);
                    }
                });

                if (faltantes.length === 0) {
                    items.forEach(item => {
                        const art = item._articulo;
                        const cant = item._pendiente;
                        if (cant > 0) inventario[art] -= cant;
                        resultadosHojaRuta.push({
                            fecha: item._fechaStr,
                            pedido: pedidoId,
                            cliente: item['Razon Social'],
                            articulo: item._articulo,
                            descripcion: item._descripcion,
                            pendiente: item._pendiente,
                            estado: "✅ Pedido Completo"
                        });
                    });
                } else {
                    // DEMANDA
                    faltantes.forEach(art => {
                        if (!consolidadoLiberacion[art]) {
                            consolidadoLiberacion[art] = { pedidos: new Set(), demandaTotal: 0 };
                        }
                        const itemDelPedido = items.find(i => i._articulo === art);
                        if (itemDelPedido) {
                            consolidadoLiberacion[art].demandaTotal += itemDelPedido._pendiente;
                            consolidadoLiberacion[art].pedidos.add(pedidoId);
                        }
                    });

                    items.forEach(item => {
                        resultadosHojaRuta.push({
                            fecha: item._fechaStr,
                            pedido: pedidoId,
                            cliente: item['Razon Social'],
                            articulo: item._articulo,
                            descripcion: item._descripcion,
                            pendiente: item._pendiente,
                            estado: "🚫 Bloqueado"
                        });
                    });
                }
            }
        });

        const liberationData = Object.entries(consolidadoLiberacion).map(([art, dataObj]) => {
            const ref = data.find(d => d._articulo === art);
            const stockActual = inventario[art] || 0;
            let aProducir = dataObj.demandaTotal - stockActual;
            if (aProducir < 0) aProducir = 0;

            return {
                articulo: art,
                descripcion: ref ? ref._descripcion : '---',
                cantidadPedidos: dataObj.pedidos.size,
                demandaTotal: dataObj.demandaTotal,
                aProducir: aProducir,
                pedidos: Array.from(dataObj.pedidos).join(', ')
            };
        }).sort((a, b) => b.cantidadPedidos - a.cantidadPedidos);

        return { routeSheet: resultadosHojaRuta, liberationData };
    }
};

// --- LÓGICA DE NEGOCIO (PICKING) ---
const pickingUtils = {
    processRepartoGeneral: (datos, config) => {
        const { articulosAExcluir, palabrasAExcluir } = config;
        return datos.reduce((acc, pedido) => {
            const articulo = pedido['Producto'] || '';
            const artUpper = articulo.toUpperCase();
            const debeExcluirse = articulosAExcluir.includes(articulo) || palabrasAExcluir.some(p => artUpper.includes(p));
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

// --- LÓGICA DE NEGOCIO (MANIFIESTOS / YQUADRE2) ---
const manifestUtils = {
    processManifest: (dataRaw, config) => {
        const { articulosDestacados = [], articulosAExcluir = [], palabrasAExcluir = [] } = config;
        const routes = {};

        dataRaw.forEach(row => {
            const modelo = String(row['Descripcion'] || '').trim();
            const modeloUpper = modelo.toUpperCase();

            // Filtro de exclusión (Kits, folletos, etc.)
            const esExcluido = articulosAExcluir.includes(modelo) || 
                               palabrasAExcluir.some(p => modeloUpper.includes(p.toUpperCase()));
            
            if (esExcluido || modelo === '') return; 

            const rutaNombre = String(row['Ruta'] || 'SIN CLASIFICAR').trim();
            const cantidad = Number(row['Cantidad']) || 0;
            const peso = Number(row['Peso']) || 0;

            if (!routes[rutaNombre]) {
                routes[rutaNombre] = {
                    nombre: rutaNombre,
                    acumuladoPeso: 0,
                    detalleProductos: {}
                };
            }

            routes[rutaNombre].acumuladoPeso += peso;
            routes[rutaNombre].detalleProductos[modelo] = (routes[rutaNombre].detalleProductos[modelo] || 0) + cantidad;
        });

        return Object.values(routes).map(r => {
            const productosProcesados = Object.entries(r.detalleProductos)
                .map(([mod, cant]) => ({
                    modelo: mod,
                    cantidad: cant,
                    esDestacado: articulosDestacados.includes(mod)
                }))
                .sort((a, b) => {
                    if (a.esDestacado && !b.esDestacado) return -1;
                    if (!a.esDestacado && b.esDestacado) return 1;
                    return b.cantidad - a.cantidad;
                });

            return {
                ...r,
                productos: productosProcesados,
                totalUnidades: productosProcesados.reduce((acc, p) => acc + p.cantidad, 0)
            };
        }).sort((a, b) => b.acumuladoPeso - a.acumuladoPeso);
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
            case 'logistics': return <LogisticsApp onNavigate={setCurrentView} isXlsxReady={isXlsxReady} />;
            case 'manifest': return <ManifestApp onNavigate={setCurrentView} isXlsxReady={isXlsxReady} />;
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
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 w-full max-w-6xl">
                <AppCard title="Asistente de Picking" description="Resumen de carga por chofer desde QM." onClick={() => onNavigate('picking')} icon="📦" />
                <AppCard title="Recepción de Mercadería" description="Control de ingresos vs Excel de planta." onClick={() => onNavigate('reception')} icon="📋" />
                <AppCard title="Consolidado de Deuda" description="Análisis de pedidos y producción requerida." onClick={() => onNavigate('logistics')} icon="📊" />
                <AppCard 
                    title="Picking a la tarde" 
                    description="Análisis de rutas y pesos." 
                    onClick={() => onNavigate('manifest')} 
                    icon="🚚" 
                />
            </div>
        </div>
    );
}

function AppCard({ title, description, onClick, icon }) {
    return (
        <div onClick={onClick} className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col h-full">
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

// --- APP CONSOLIDADO DE DEUDA (LOGISTICS) ---
function LogisticsApp({ onNavigate, isXlsxReady }) {
    const [routeSheet, setRouteSheet] = useState([]);
    const [liberationData, setLiberationData] = useState([]);
    const [view, setView] = useState('ruta'); 
    const [searchTerm, setSearchTerm] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const processFile = (file) => {
        if (!isXlsxReady) return;
        setIsProcessing(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            const wb = window.XLSX.read(e.target.result, { type: 'array' });
            let json = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: false }); 
            json = normalizeKeys(json);
            
            const { routeSheet, liberationData } = logisticsUtils.processFIFO(json);
            
            setRouteSheet(routeSheet);
            setLiberationData(liberationData);
            setIsProcessing(false);
        };
        reader.readAsArrayBuffer(file);
    };

    // --- NUEVA FUNCIÓN: EXPORTAR A EXCEL REAL ---
    const handleExportExcel = () => {
        if (!liberationData || liberationData.length === 0) return alert("No hay datos");

        // Mapear datos a nombres de columnas bonitos
        const dataToExport = liberationData.map(row => ({
            "Artículo": row.articulo,
            "Descripción": row.descripcion,
            "Pedidos Trabados": row.cantidadPedidos,
            "Demanda Total": row.demandaTotal,
            "Falta Producir": row.aProducir,
            "Detalle Pedidos": row.pedidos
        }));

        const ws = window.XLSX.utils.json_to_sheet(dataToExport);
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, "Consolidado");

        // Ajustar ancho de columnas (Opcional pero recomendado)
        const wscols = [
            {wch: 15}, // Articulo
            {wch: 40}, // Descripcion
            {wch: 15}, // Trabados
            {wch: 15}, // Demanda
            {wch: 15}, // Falta Producir
            {wch: 50}  // Pedidos
        ];
        ws['!cols'] = wscols;

        window.XLSX.writeFile(wb, "Consolidado_Deuda_Rowa.xlsx");
    };

    const filteredRoute = useMemo(() => {
        if (!searchTerm) return routeSheet;
        const term = searchTerm.toUpperCase();
        return routeSheet.filter(r => 
            String(r.pedido).toUpperCase().includes(term) || 
            String(r.cliente).toUpperCase().includes(term)
        );
    }, [routeSheet, searchTerm]);

    return (
        <AppContainer title="Consolidado de Deuda" subtitle="Análisis de pedidos y producción requerida." onNavigate={onNavigate}>
            <FileUpload onFileLoad={processFile} id="logFile" disabled={isProcessing}>
                {isProcessing ? "Procesando..." : "Cargar informe."}
            </FileUpload>

            {routeSheet.length > 0 && (
                <>
                    <div className="flex justify-center mb-6 shadow-sm rounded-lg overflow-hidden">
                        <button onClick={() => setView('ruta')} className={`px-6 py-3 font-medium border ${view === 'ruta' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}>📋 Hoja de Ruta</button>
                        <button onClick={() => setView('liberacion')} className={`px-6 py-3 font-medium border ${view === 'liberacion' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}>🔓 Consolidado Liberación</button>
                    </div>

                    {view === 'ruta' && (
                        <div className="bg-white p-6 rounded-2xl shadow-lg">
                            <input 
                                className="w-full px-4 py-2 border rounded-lg mb-4" 
                                placeholder="🔍 Buscar Cliente o Pedido..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm text-left text-gray-500">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3">Fecha</th>
                                            <th className="px-4 py-3">Pedido</th>
                                            <th className="px-4 py-3">Cliente</th>
                                            <th className="px-4 py-3">Artículo</th>
                                            <th className="px-4 py-3 text-right">Pend.</th>
                                            <th className="px-4 py-3">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRoute.slice(0, 500).map((row, idx) => (
                                            <tr key={idx} className="bg-white border-b hover:bg-gray-50">
                                                <td className="px-4 py-2 whitespace-nowrap">{row.fecha}</td>
                                                <td className="px-4 py-2 font-bold">{row.pedido}</td>
                                                <td className="px-4 py-2">{row.cliente}</td>
                                                <td className="px-4 py-2">{row.articulo} <br/><span className="text-xs text-gray-400">{row.descripcion}</span></td>
                                                <td className="px-4 py-2 text-right">{row.pendiente}</td>
                                                <td className="px-4 py-2">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${row.estado.includes('Listo') || row.estado.includes('Completo') || row.estado.includes('Asignado') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                        {row.estado}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {filteredRoute.length > 500 && <p className="text-center text-xs text-gray-400 mt-4">⚠️ Mostrando primeros 500 registros para mantener fluidez.</p>}
                            </div>
                        </div>
                    )}

                    {view === 'liberacion' && (
                        <div className="bg-white p-6 rounded-2xl shadow-lg">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800">Artículos Críticos</h3>
                                </div>
                                <button 
                                    onClick={handleExportExcel}
                                    className="bg-green-600 text-white px-6 py-2 rounded-lg shadow hover:bg-green-700 transition-colors font-bold flex items-center gap-2"
                                >
                                    📥 Descargar Excel (.xlsx)
                                </button>
                            </div>
                            {liberationData.length === 0 ? <div className="p-8 text-center bg-green-50 rounded-xl text-green-700 font-bold">🎉 ¡No hay bloqueos rígidos!</div> : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm text-left text-gray-500">
                                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3">Artículo</th>
                                                <th className="px-4 py-3">Descripción</th>
                                                <th className="px-4 py-3 text-center">Pedidos Trabados</th>
                                                <th className="px-4 py-3 text-center bg-yellow-50 text-yellow-800 border-b-2 border-yellow-200">Falta Producir</th>
                                                <th className="px-4 py-3">Detalle Pedidos</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {liberationData.map((row, idx) => (
                                                <tr key={idx} className="bg-white border-b hover:bg-gray-50">
                                                    <td className="px-4 py-3 font-bold text-gray-900 align-top">{row.articulo}</td>
                                                    <td className="px-4 py-3 align-top">{row.descripcion}</td>
                                                    <td className="px-4 py-3 text-center align-top">
                                                        <span className="bg-gray-100 text-gray-800 py-1 px-3 rounded-full font-bold">{row.cantidadPedidos}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center bg-yellow-50 font-bold text-red-600 text-lg border-l border-r border-yellow-100 align-top">
                                                        {row.aProducir}
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-gray-600 break-words leading-relaxed w-1/3 align-top">
                                                        {row.pedidos}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </AppContainer>
    );
}

function ManifestApp({ onNavigate, isXlsxReady }) {
    const [summary, setSummary] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);

    const config = useMemo(() => ({
        articulosDestacados: [
            'PRESURIZADOR TANGO SFL 9 220V T2 AR', 
            'PRESURIZADOR TANGO SFL 14 220V T2 AR', 
            'PRESURIZADOR TANGO SFL 20 220V T2 AR', 
            'PRESURIZADOR TANGO PRESS 20 220V T2 AR',
            'ELECTROBOMBA ELEVADORA INTELIGENT 20 220V AR',
            'ELECTROBOMBA ELEVADORA INTELIGENT 24 220V AR'
        ],
        articulosAExcluir: ['AUTORIZACION DE RETIRO POR CUENTA Y ORDEN DE ROWA S.A.'],
        palabrasAExcluir: [
            'KIT', 'CONJ', 'DISCO', 'TURBINA', 'CAPACITOR', 'MODULO', 'BOBINADO', 'TAPON', 'PLAQUETA', 'SENSOR', 'LIQUIDO', 'CONTROL AUTOMATICO', 'REP', 'CATALOGO', 'VALV.', 'PORTA FOLLETOS', 'FLEXIBLE','TUBO', 'FLETES', 'REMERA', 'BUJE', 'TAPA', 'DISTANCIADOR', 'ROTOR', 'BL. MOTOR', 'JERINGA', 'DUCHA', 'DIAFRAGMA', "O'RING", 'CAJA','REMERA','MEMBRETE'
        ]
    }), []);

    const handleFile = (file) => {
        if (!isXlsxReady) return;
        setIsProcessing(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = window.XLSX.read(e.target.result, { type: 'array' });
                let json = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                if (typeof normalizeKeys === 'function') json = normalizeKeys(json);
                const finalData = manifestUtils.processManifest(json, config);
                setSummary(finalData);
            } catch (err) {
                alert("Error al procesar el archivo.");
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // --- NUEVA FUNCIÓN DE EXPORTACIÓN ---
    const handleExportExcel = () => {
        if (!summary || summary.length === 0) return alert("No hay datos para exportar");

        const wb = window.XLSX.utils.book_new();

        summary.forEach(zona => {
            // Preparamos los datos de la hoja
            const tableData = zona.productos.map(p => ({
                "Modelo": p.modelo,
                "Cantidad": p.cantidad
            }));

            // Agregamos un pequeño resumen al final de cada hoja
            tableData.push({}); // Fila vacía
            tableData.push({ "Modelo": "--- RESUMEN DE ZONA ---", "Cantidad": "" });
            tableData.push({ "Modelo": "TOTAL UNIDADES", "Cantidad": zona.totalUnidades });
            tableData.push({ "Modelo": "PESO TOTAL (kg)", "Cantidad": zona.acumuladoPeso });

            const ws = window.XLSX.utils.json_to_sheet(tableData);

            // Ajuste de ancho de columnas para que se vea pro
            ws['!cols'] = [{ wch: 50 }, { wch: 15 }];

            // IMPORTANTE: Excel no permite nombres de hojas de más de 31 caracteres
            // ni ciertos caracteres especiales. Limpiamos el nombre:
            let sheetName = zona.nombre.substring(0, 31).replace(/[:\\/?*[\]]/g, "_");

            window.XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });

        // Descargar el archivo
        const fecha = new Date().toLocaleDateString('es-AR').replace(/\//g, '-');
        window.XLSX.writeFile(wb, `Planilla_Carga_${fecha}.xlsx`);
    };

    return (
        <AppContainer title="Picking a la tarde" subtitle="Análisis de carga por zona." onNavigate={onNavigate}>
            <div className="flex flex-col md:flex-row gap-4 items-center mb-8">
                <div className="flex-grow w-full">
                    <FileUpload onFileLoad={handleFile} id="manFile" disabled={isProcessing}>
                        {isProcessing ? "Procesando..." : "1. Subir Excel"}
                    </FileUpload>
                </div>
                {summary.length > 0 && (
                    <button 
                        onClick={handleExportExcel}
                        className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white font-bold py-8 px-8 rounded-2xl shadow-lg transition-all flex flex-col items-center justify-center gap-2"
                    >
                        <span className="text-3xl">📥</span>
                        2. Descargar Excel por Zonas
                    </button>
                )}
            </div>

            {summary.length > 0 && (
                <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
                    <table className="min-w-full text-left">
                        <thead className="bg-gray-50 text-gray-400 text-xs uppercase font-bold">
                            <tr>
                                <th className="px-6 py-4">Zona / Artículos</th>
                                <th className="px-6 py-4 text-center">Total Unidades</th>
                                <th className="px-6 py-4 text-right">Peso Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {summary.map((zona, i) => (
                                <tr key={i} className="align-top hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <details className="group">
                                            <summary className="font-bold text-blue-700 cursor-pointer flex items-center gap-2">
                                                <span className="group-open:rotate-90 transition-transform">▶</span>
                                                {zona.nombre}
                                            </summary>
                                            <div className="mt-3 ml-6 bg-gray-50 p-2 rounded-lg border border-gray-200">
                                                <ul className="space-y-1">
                                                    {zona.productos.map((p, idx) => (
                                                        <li key={idx} className={`flex justify-between text-sm py-1 px-3 rounded mb-1 ${p.esDestacado ? 'bg-indigo-100 text-indigo-900 font-bold border-l-4 border-indigo-500' : 'border-b last:border-0 border-gray-100'}`}>
                                                            <span>{p.modelo}</span>
                                                            <span className={`font-mono font-bold ${p.esDestacado ? 'text-indigo-900' : 'text-blue-600'}`}>
                                                                {p.cantidad}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </details>
                                    </td>
                                    <td className="px-6 py-4 text-center font-bold text-gray-700 text-lg">
                                        {zona.totalUnidades}
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono font-black text-blue-600">
                                        {zona.acumuladoPeso.toLocaleString()} kg
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </AppContainer>
    );
}

// --- APP RECEPCIÓN (EXISTENTE) ---
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
        return orders.filter(o => 
            String(o.nroOrden).toLowerCase().includes(term) || 
            String(o.producto).toLowerCase().includes(term) || 
            String(o.cliente).toLowerCase().includes(term)
        );
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

    const handleExport = () => {
        if (!isXlsxReady) return alert("El sistema de Excel aún no está listo.");
        if (orders.length === 0) return alert("No hay datos para exportar.");

        const dataExport = orders.map(o => ({
            'Nro Orden': o.nroOrden,
            'Producto': o.producto,
            'Cliente': o.cliente,
            'Zona': o.zona || '-',
            'Estado': o.recibido ? 'RECIBIDO' : 'PENDIENTE'
        }));

        const ws = window.XLSX.utils.json_to_sheet(dataExport);
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, "Recepción");
        const fecha = new Date().toLocaleDateString('es-AR').replace(/\//g, '-');
        window.XLSX.writeFile(wb, `Recepción_${fecha}.xlsx`);
    };

    const toggleStatus = async (id, status) => { try { await updateDoc(doc(db, 'users', user.uid, 'receptionOrders', id), { recibido: !status }); } catch (e) { alert("Error al actualizar"); } };
    const clearAll = async () => { if(window.confirm("¿Estás seguro de borrar todo?")) { setIsLoading(true); const batch = writeBatch(db); orders.forEach(o => batch.delete(doc(db, 'users', user.uid, 'receptionOrders', o.id))); await batch.commit(); } };

    return (
        <AppContainer title="Recepción de Mercadería" subtitle="Base de datos de control de ingresos." onNavigate={onNavigate}>
            <FileUpload onFileLoad={handleImport} id="recFile" disabled={isImporting}>{isImporting ? "Importando..." : "Importar Excel de Planta"}</FileUpload>
            
            {isLoading ? <p className="text-center p-8">Sincronizando...</p> : (
                <>
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

                    <input className="w-full px-4 py-3 bg-white rounded-2xl shadow-lg focus:ring-2 focus:ring-blue-500 outline-none border border-gray-100 mb-8" placeholder="Buscar por Orden, Producto o Cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />

                    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-10">Ok</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orden</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Detalle</th>
                                    <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredOrders.map(o => (
                                    <tr key={o.id} className={o.recibido ? 'bg-green-50 transition-colors' : 'transition-colors'}>
                                        <td className="px-4 py-4"><input type="checkbox" checked={o.recibido} onChange={() => toggleStatus(o.id, o.recibido)} className="h-6 w-6 text-blue-600 rounded cursor-pointer" /></td>
                                        <td className="px-4 py-4 text-sm font-bold align-top">{o.nroOrden}</td>
                                        <td className="px-4 py-4 align-top">
                                            <div className="text-sm text-gray-900 font-medium">{o.producto}</div>
                                            <div className="md:hidden mt-1 text-xs text-gray-500 flex items-center"><span className="mr-1">👤</span> {o.cliente}</div>
                                        </td>
                                        <td className="hidden md:table-cell px-4 py-4 text-sm text-gray-500 align-top">{o.cliente}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredOrders.length === 0 && <p className="text-center p-6 text-gray-500">No hay datos.</p>}
                    </div>
                    
                    <div className="mt-8 flex flex-col md:flex-row justify-center gap-4 pb-8">
                         <button onClick={handleExport} className="bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 shadow-md flex items-center justify-center gap-2"><span>📊</span> Descargar Reporte</button>
                         <button onClick={clearAll} className="bg-red-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-red-600 shadow-md">Borrar Todo</button>
                    </div>
                </>
            )}
        </AppContainer>
    );
}

// --- APP PICKING (EXISTENTE) ---
function PickingApp({ onNavigate, isXlsxReady }) {
    const [data, setData] = useState([]);
    const [view, setView] = useState('reparto');
    
    const config = useMemo(() => ({
        articulosDestacados: ['PRESURIZADOR TANGO SFL 9 220V T2 AR', 'PRESURIZADOR TANGO SFL 14 220V T2 AR', 'PRESURIZADOR TANGO SFL 20 220V T2 AR', 'PRESURIZADOR TANGO PRESS 20 220V T2 AR','ELECTROBOMBA ELEVADORA INTELIGENT 20 220V AR','ELECTROBOMBA ELEVADORA INTELIGENT 24 220V AR'],
        articulosAExcluir: ['AUTORIZACION DE RETIRO POR CUENTA Y ORDEN DE ROWA S.A.'],
        palabrasAExcluir: ['KIT', 'CONJ', 'DISCO', 'TURBINA', 'CAPACITOR', 'MODULO', 'BOBINADO', 'TAPON', 'PLAQUETA', 'SENSOR', 'LIQUIDO', 'CONTROL AUTOMATICO', 'REP', 'CATALOGO', 'VALV.', 'PORTA FOLLETOS', 'FLEXIBLE','TUBO', 'FLETES', 'REMERA', 'BUJE', 'TAPA', 'DISTANCIADOR', 'ROTOR', 'BL. MOTOR', 'JERINGA', 'DUCHA', 'DIAFRAGMA', "O'RING", 'CAJA','REMERA','MEMBRETE']
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



// --- VISTA GENÉRICA ORDENADA ---
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
                        if (aHigh && !bHigh) return -1; 
                        if (!aHigh && bHigh) return 1;
                        return b[1] - a[1];
                    });
                } else {
                    entries = (Array.isArray(data[key]) ? data[key] : Object.values(data[key]));
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
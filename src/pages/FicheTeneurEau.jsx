import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Plus, Trash2, Save, CheckCircle2, AlertTriangle, 
  Droplets, History, X, Clock, PlayCircle, ShieldAlert, PauseCircle, Loader2
} from 'lucide-react';

const gingerBleu = "#1D365A";

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch(e) {
    return 'row-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now();
  }
};

// Ligne vide avec les clés exactes attendues par le Backend (Pydantic)
const createEmptyRow = () => ({
  id: generateId(),
  identifiant: '',
  coteTete: '',
  cotePied: '',
  humide105: '',
  humide150: '',
  sec105: '',
  sec150: '',
  hp105: '',
  hp150: ''
});

const ProgressBar = ({ progress }) => {
  let colorClass = 'bg-orange-500';
  if (progress > 50) colorClass = 'bg-blue-500';
  if (progress === 100) colorClass = 'bg-green-500';

  return (
    <div className="w-full bg-slate-200 rounded-full h-2 mt-2 overflow-hidden border border-slate-300/50">
      <div className={`${colorClass} h-2 rounded-full transition-all duration-500`} style={{ width: `${progress}%` }}></div>
    </div>
  );
};

export default function FicheTeneurEau({ onNavigate, token }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Modals et tiroirs
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Session active
  const [activeDraftId, setActiveDraftId] = useState(generateId());

  // Données de l'en-tête
  const [metaData, setMetaData] = useState({ 
    forage_name: '', 
    date_debut: new Date().toISOString().split('T')[0],
    date_fin: new Date().toISOString().split('T')[0]
  });
  
  // Lignes du tableau
  const [rows, setRows] = useState(() => Array(5).fill(null).map(() => createEmptyRow()));

  const [brouillons, setBrouillons] = useState(() => {
    try {
      const saved = localStorage.getItem('ginger_ft32_brouillons');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('ginger_ft32_brouillons', JSON.stringify(brouillons));
  }, [brouillons]);

  // --- Chargement et Filtrage Métier des Forages ---
  const [foragesDisponibles, setForagesDisponibles] = useState([]);
  const [loadingForages, setLoadingForages] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoadingForages(true);
    fetch('http://127.0.0.1:8072/afficher/forages/', { 
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          // FILTRAGE MÉTIER : On ne garde QUE les forages où la case "teneur_eau" a été cochée (true)
          const foragesEligibles = data.filter(f => f.teneur_eau === true);
          setForagesDisponibles(foragesEligibles);
        } else {
          setForagesDisponibles([]);
        }
      })
      .catch(err => console.error("Erreur chargement forages:", err))
      .finally(() => setLoadingForages(false));
  }, [token]);

  // --- Calcul intelligent de la progression ---
  const calculateProgress = (meta, currentRows) => {
    let score = 0;
    
    // 1. Forage sélectionné (20%)
    if (meta.forage_name && meta.forage_name.trim() !== '') score += 20;
    
    // 2. On évalue le remplissage des lignes du tableau
    const activeRows = currentRows.filter(r => r.identifiant.trim() !== '' || r.humide105 !== '' || r.sec105 !== '');
    
    if (activeRows.length > 0) {
      // On se base sur la première ligne commencée pour jauger l'avancement
      const firstRow = activeRows[0];
      
      if (firstRow.identifiant && firstRow.identifiant.trim() !== '') score += 20;
      if (firstRow.coteTete !== '' || firstRow.cotePied !== '') score += 20;
      if (firstRow.humide105 !== '' || firstRow.humide150 !== '') score += 20;
      if (firstRow.sec105 !== '' || firstRow.sec150 !== '') score += 20;
    }

    return Math.min(score, 100);
  };

  const saveDraftAndCreateNew = () => {
    const progress = calculateProgress(metaData, rows);
    
    if (progress > 0 || metaData.forage_name !== '') {
      setBrouillons(prev => {
        const existingIndex = prev.findIndex(b => b.id === activeDraftId);
        const currentDraft = { 
          id: activeDraftId, metaData, rows, progress, 
          timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        };
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = currentDraft;
          return updated;
        }
        return [currentDraft, ...prev];
      });
    }

    setMetaData({ forage_name: '', date_debut: new Date().toISOString().split('T')[0], date_fin: new Date().toISOString().split('T')[0] });
    setRows(Array(5).fill(null).map(() => createEmptyRow()));
    setActiveDraftId(generateId());
  };

  const resumeDraft = (draftToResume) => {
    saveDraftAndCreateNew();
    setMetaData(draftToResume.metaData);
    setRows(draftToResume.rows);
    setActiveDraftId(draftToResume.id);
    setIsHistoryOpen(false);
  };

  const deleteDraft = (e, draftId) => {
    e.stopPropagation();
    if(window.confirm("Voulez-vous supprimer ce brouillon définitivement ?")) {
      setBrouillons(prev => prev.filter(b => b.id !== draftId));
    }
  };

  // Fonction mathématique pour le Hp(%)
  const calcHp = (h, s) => {
    const valH = parseFloat(String(h).replace(',', '.'));
    const valS = parseFloat(String(s).replace(',', '.'));
    if (!isNaN(valH) && !isNaN(valS) && valS > 0 && valH >= valS) {
      return (((valH - valS) / valS) * 100).toFixed(2);
    }
    return '';
  };

  // Mise à jour d'une cellule avec calcul automatique
  const handleCellChange = (id, field, value) => {
    setRows(prevRows => prevRows.map(row => {
      if (row.id === id) {
        const updatedRow = { ...row, [field]: value };
        // Recalculer automatiquement les Hp(%) concernés
        if (['humide105', 'sec105'].includes(field)) {
          updatedRow.hp105 = calcHp(updatedRow.humide105, updatedRow.sec105);
        }
        if (['humide150', 'sec150'].includes(field)) {
          updatedRow.hp150 = calcHp(updatedRow.humide150, updatedRow.sec150);
        }
        return updatedRow;
      }
      return row;
    }));
  };

  const addRow = () => setRows([...rows, createEmptyRow()]);
  const removeRow = (id) => {
    if (rows.length > 1) setRows(rows.filter(row => row.id !== id));
    else setRows([createEmptyRow()]);
  };

  // --- Sauvegarde Finale vers le Backend PostgreSQL ---
  const confirmAndSave = async () => {
    setShowSaveConfirm(false);
    setLoading(true);

    const validRows = rows.filter(r => r.identifiant.trim() !== '');
    
    // Le payload correspond exactement au schéma Pydantic
    const payload = { 
      forage_name: metaData.forage_name, 
      date_debut: metaData.date_debut ? new Date(metaData.date_debut).toISOString() : null,
      date_fin: metaData.date_fin ? new Date(metaData.date_fin).toISOString() : null,
      mesures: validRows 
    };

    try {
      const response = await fetch('http://127.0.0.1:8072/teneur-eau/', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la sauvegarde sur le serveur');
      }
      
      setBrouillons(prev => prev.filter(b => b.id !== activeDraftId));
      setSuccess(true);
    } catch (error) {
      console.error(error);
      alert("Erreur de communication avec le serveur. Vos données sont conservées en brouillon.");
    } finally {
      setLoading(false);
    }
  };

  const handleSafeExit = () => {
    const progress = calculateProgress(metaData, rows);
    if (progress > 0 || metaData.forage_name !== '') setShowExitConfirm(true);
    else if(onNavigate) onNavigate('DASHBOARD');
  };

  const forceExit = () => {
    saveDraftAndCreateNew();
    if(onNavigate) onNavigate('DASHBOARD');
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center justify-center">
        <div className="bg-white p-10 rounded-2xl shadow-xl border border-slate-200 text-center max-w-md w-full">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle2 size={40} /></div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Fiche Enregistrée !</h2>
          <p className="text-slate-500 mb-8">Les mesures de Teneur en Eau (FT32) ont été sauvegardées avec succès dans la base de données.</p>
          <div className="space-y-3">
            <button onClick={() => { setSuccess(false); saveDraftAndCreateNew(); }} className="w-full font-bold py-3 px-4 rounded-xl text-white transition-all shadow-md bg-blue-600 hover:bg-blue-700">
              Saisir une autre fiche
            </button>
            <button onClick={() => onNavigate && onNavigate('DASHBOARD')} className="w-full font-bold py-3 px-4 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all">
              Retour au tableau de bord
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentProgress = calculateProgress(metaData, rows);
  const isSafeToSubmit = metaData.forage_name.trim() !== '' && currentProgress > 20;

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-[1600px] mx-auto transition-all duration-500">
        
        {/* Navigation */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <button onClick={handleSafeExit} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 font-medium bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors">
            <ArrowLeft size={16} /> Quitter
          </button>
          
          <div className="flex items-center gap-3">
            <button onClick={saveDraftAndCreateNew} className="flex items-center gap-2 bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-colors">
              <Plus size={16} /> Nouvelle Fiche
            </button>
            <button type="button" onClick={() => setIsHistoryOpen(true)} className="flex items-center gap-2 text-sm text-white px-4 py-2 rounded-lg font-bold transition-colors shadow-sm" style={{ backgroundColor: gingerBleu }}>
              <History size={16} />
              <span className="hidden sm:inline">Brouillons</span>
            </button>
          </div>
        </div>

        {/* Titre */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: gingerBleu }}>
            <Droplets className="w-7 h-7 text-blue-500" />
            FT32 - Mesures de teneur en eau
          </h1>
          <p className="text-slate-500 flex items-center gap-2 mt-1">
            Fiche en cours <span className="text-xs font-mono bg-slate-200 text-slate-600 px-2 py-0.5 rounded">{activeDraftId.substring(0,8)}</span>
          </p>
        </div>

        {/* Contenu principal */}
        <div className="flex flex-col lg:flex-row gap-6 items-start relative">
          
          <div className="flex-1 w-full min-w-0 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            
            {/* En-tête : Forage et Dates */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 border-b border-slate-200">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Forage de rattachement *</label>
                <div className="relative">
                  <select 
                    value={metaData.forage_name}
                    onChange={(e) => setMetaData({ ...metaData, forage_name: e.target.value })}
                    disabled={loadingForages || foragesDisponibles.length === 0}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800 shadow-sm cursor-pointer disabled:opacity-50 appearance-none"
                  >
                    <option value="">
                      {foragesDisponibles.length === 0 && !loadingForages 
                        ? "-- Aucun forage éligible --" 
                        : "-- Sélectionner un forage --"}
                    </option>
                    {foragesDisponibles.map((f) => (
                      <option key={f.forage} value={f.forage}>
                        {f.forage}
                      </option>
                    ))}
                  </select>
                  
                  {loadingForages && (
                    <div className="absolute inset-y-0 right-8 flex items-center pointer-events-none">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5 italic">
                  Seuls les forages avec l'option "Teneur en eau" cochée à la saisie sont affichés.
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Date de début</label>
                <input 
                  type="date"
                  value={metaData.date_debut}
                  onChange={(e) => setMetaData({ ...metaData, date_debut: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Date de fin</label>
                <input 
                  type="date"
                  value={metaData.date_fin}
                  onChange={(e) => setMetaData({ ...metaData, date_fin: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 shadow-sm"
                />
              </div>
            </div>

            {/* Le Grand Tableau Type Excel */}
            <div className="p-4 md:p-6">
              <div className="border border-slate-300 rounded-xl overflow-x-auto bg-white shadow-sm">
                <table className="w-full text-xs border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-slate-200 text-slate-700 font-bold border-b border-slate-300">
                      <th rowSpan="3" className="border border-slate-300 py-2 px-3 w-32 text-center align-middle bg-slate-200">Identifiant</th>
                      <th colSpan="2" className="border border-slate-300 py-2 text-center">Cotes (m)</th>
                      <th colSpan="4" className="border border-slate-300 py-2 text-center">Masses (g)</th>
                      <th colSpan="2" className="border border-slate-300 py-2 text-center">Hp(%)</th>
                      <th rowSpan="3" className="border border-slate-300 py-2 px-3 w-12 text-center align-middle"></th>
                    </tr>
                    <tr className="bg-slate-100 text-slate-600 font-semibold text-center uppercase tracking-wider">
                      <th rowSpan="2" className="border border-slate-300 py-1 px-2 w-24 align-middle">Tête</th>
                      <th rowSpan="2" className="border border-slate-300 py-1 px-2 w-24 align-middle">Pied</th>
                      <th colSpan="2" className="border border-slate-300 py-1 px-2 bg-blue-100/50 text-blue-800">Humide</th>
                      <th colSpan="2" className="border border-slate-300 py-1 px-2 bg-yellow-100/50 text-yellow-800">Sec</th>
                      <th rowSpan="2" className="border border-slate-300 py-1 px-2 w-24 bg-green-50 text-green-800 align-middle">105°C</th>
                      <th rowSpan="2" className="border border-slate-300 py-1 px-2 w-24 bg-green-50 text-green-800 align-middle">150°C</th>
                    </tr>
                    <tr className="bg-slate-50 text-center font-semibold text-gray-500">
                      <th className="border border-slate-300 p-1 w-24 text-blue-700">105°C</th>
                      <th className="border border-slate-300 p-1 w-24 text-blue-700">150°C</th>
                      <th className="border border-slate-300 p-1 w-24 text-yellow-700">105°C</th>
                      <th className="border border-slate-300 p-1 w-24 text-yellow-700">150°C</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="hover:bg-blue-50/50 transition-colors">
                        <td className="border border-slate-300 p-0">
                          <input type="text" value={row.identifiant} onChange={(e) => handleCellChange(row.id, 'identifiant', e.target.value)} className="w-full h-10 px-2 outline-none text-center bg-transparent focus:bg-blue-50 focus:ring-inset focus:ring-2 focus:ring-blue-500 text-sm font-bold text-slate-700" placeholder="EST54XXX" />
                        </td>
                        <td className="border border-slate-300 p-0">
                          <input type="number" step="0.01" value={row.coteTete} onChange={(e) => handleCellChange(row.id, 'coteTete', e.target.value)} className="w-full h-10 px-2 outline-none text-center bg-transparent focus:bg-blue-50 focus:ring-inset focus:ring-2 focus:ring-blue-500 text-sm" />
                        </td>
                        <td className="border border-slate-300 p-0">
                          <input type="number" step="0.01" value={row.cotePied} onChange={(e) => handleCellChange(row.id, 'cotePied', e.target.value)} className="w-full h-10 px-2 outline-none text-center bg-transparent focus:bg-blue-50 focus:ring-inset focus:ring-2 focus:ring-blue-500 text-sm" />
                        </td>
                        
                        <td className="border border-slate-300 p-0">
                          <input type="number" step="0.01" value={row.humide105} onChange={(e) => handleCellChange(row.id, 'humide105', e.target.value)} className="w-full h-10 px-2 outline-none text-center bg-blue-50/30 focus:bg-blue-100 focus:ring-inset focus:ring-2 focus:ring-blue-500 text-sm text-blue-900" />
                        </td>
                        <td className="border border-slate-300 p-0">
                          <input type="number" step="0.01" value={row.humide150} onChange={(e) => handleCellChange(row.id, 'humide150', e.target.value)} className="w-full h-10 px-2 outline-none text-center bg-blue-50/30 focus:bg-blue-100 focus:ring-inset focus:ring-2 focus:ring-blue-500 text-sm text-blue-900" />
                        </td>
                        <td className="border border-slate-300 p-0">
                          <input type="number" step="0.01" value={row.sec105} onChange={(e) => handleCellChange(row.id, 'sec105', e.target.value)} className="w-full h-10 px-2 outline-none text-center bg-yellow-50/30 focus:bg-yellow-100 focus:ring-inset focus:ring-2 focus:ring-yellow-500 text-sm text-yellow-900" />
                        </td>
                        <td className="border border-slate-300 p-0">
                          <input type="number" step="0.01" value={row.sec150} onChange={(e) => handleCellChange(row.id, 'sec150', e.target.value)} className="w-full h-10 px-2 outline-none text-center bg-yellow-50/30 focus:bg-yellow-100 focus:ring-inset focus:ring-2 focus:ring-yellow-500 text-sm text-yellow-900" />
                        </td>

                        <td className="border border-slate-300 p-0 bg-green-50/50 align-middle">
                          <input type="text" readOnly value={row.hp105} className="w-full h-full px-2 outline-none text-center bg-transparent text-sm font-bold text-green-700 cursor-default" placeholder="-" />
                        </td>
                        <td className="border border-slate-300 p-0 bg-green-50/50 align-middle">
                          <input type="text" readOnly value={row.hp150} className="w-full h-full px-2 outline-none text-center bg-transparent text-sm font-bold text-green-700 cursor-default" placeholder="-" />
                        </td>

                        <td className="border border-slate-300 p-1 text-center bg-slate-50 align-middle">
                          <button onClick={() => removeRow(row.id)} className="text-slate-400 hover:text-red-600 p-1.5 rounded transition-colors" title="Supprimer la ligne">
                            <Trash2 className="w-4 h-4 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-center">
                <button onClick={addRow} className="flex items-center text-sm text-blue-700 bg-blue-100 hover:bg-blue-200 px-5 py-2.5 rounded-lg font-bold transition-colors shadow-sm">
                  <Plus className="w-5 h-5 mr-2" /> Ajouter une mesure
                </button>
              </div>
            </div>

            {/* Pied de page : Actions */}
            <div className="mt-auto p-4 md:p-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white">
              <div className="flex w-full sm:w-auto gap-3">
                <button type="button" onClick={saveDraftAndCreateNew} className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-6 py-3 rounded-xl font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-all">
                  <PauseCircle size={20} /> Mettre en attente
                </button>
              </div>
              
              <button 
                type="button" 
                onClick={() => setShowSaveConfirm(true)} 
                disabled={loading || !isSafeToSubmit} 
                className="w-full sm:w-auto flex justify-center items-center gap-2 px-8 py-3 rounded-xl font-bold text-white transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                style={{ backgroundColor: isSafeToSubmit ? '#16a34a' : '#94a3b8' }}
              >
                {loading ? <Clock className="animate-spin" size={20} /> : <Save size={20} />}
                Enregistrer la Fiche FT32
              </button>
            </div>
          </div>

          {/* SIDEBAR DES BROUILLONS */}
          {isHistoryOpen && (
            <div className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-sm transition-opacity" onClick={() => setIsHistoryOpen(false)} />
          )}

          <div className={`
            fixed inset-y-0 right-0 z-40 w-full sm:w-96 bg-white shadow-2xl transform transition-transform duration-300 flex flex-col
            lg:relative lg:translate-x-0 lg:w-80 lg:shadow-sm lg:rounded-2xl lg:border lg:border-slate-200 lg:z-10 lg:sticky lg:top-8
            ${isHistoryOpen ? 'translate-x-0' : 'translate-x-full'}
          `}>
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <History size={18} className="text-blue-700" />
                <h3 className="font-bold text-slate-800">Brouillons FT32</h3>
              </div>
              <button type="button" onClick={() => setIsHistoryOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-full p-1 transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-4 space-y-4 flex-1 overflow-y-auto bg-slate-50/50">
              {brouillons.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <p className="text-sm font-medium">Aucun brouillon en cours.</p>
                </div>
              ) : brouillons.map((draft) => (
                <div key={draft.id} className="p-4 border border-slate-200 rounded-xl hover:border-blue-400 bg-white relative overflow-hidden group hover:shadow-md transition-all">
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${draft.progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                  
                  <div className="flex justify-between items-start mb-2 pl-2">
                    <span className="font-bold text-slate-800 text-sm">{draft.metaData.forage_name || 'Sans nom'}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1"><Clock size={10}/> {draft.timestamp}</span>
                      <button type="button" onClick={(e) => deleteDraft(e, draft.id)} className="text-red-400 hover:text-red-600 p-1 rounded">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="pl-2 mb-4">
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-xs text-slate-500 font-medium">Progression</span>
                      <span className="text-xs font-bold text-slate-700">{draft.progress}%</span>
                    </div>
                    <ProgressBar progress={draft.progress} />
                  </div>
                  
                  <button onClick={() => resumeDraft(draft)} className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-600 hover:text-white rounded-lg transition-colors border border-blue-100">
                    <PlayCircle size={16} /> Reprendre
                  </button>
                </div>
              ))}
            </div>
          </div>
          
        </div>
      </div>

      {/* MODALS DE CONFIRMATION */}
      {showSaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}>
              <ShieldAlert size={32} />
            </div>
            <h3 className="text-xl font-bold text-center text-slate-800 mb-2">Envoyer la fiche FT32 ?</h3>
            <p className="text-center text-slate-500 mb-8">Enregistrer la liste des teneurs en eau pour le forage <strong className="text-slate-700">{metaData.forage_name || 'en cours'}</strong> ?</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => setShowSaveConfirm(false)} className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50">Vérifier encore</button>
              <button onClick={confirmAndSave} className="flex-1 px-4 py-3 rounded-xl font-bold text-white shadow-md transition-all" style={{ backgroundColor: '#16a34a' }}>Oui, Envoyer</button>
            </div>
          </div>
        </div>
      )}

      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border-t-4 animate-in zoom-in-95 duration-200" style={{ borderTopColor: '#f97316' }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#ffedd5', color: '#ea580c' }}>
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-bold text-center text-slate-800 mb-2">Sauvegarde automatique</h3>
            <p className="text-center text-slate-500 mb-8">En quittant, cette fiche sera **sauvegardée dans vos brouillons**.</p>
            <div className="flex flex-col sm:flex-row-reverse gap-3">
              <button onClick={forceExit} className="flex-1 px-4 py-3 rounded-xl font-bold text-white shadow-md transition-colors" style={{ backgroundColor: '#f97316' }}>Quitter</button>
              <button onClick={() => setShowExitConfirm(false)} className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50">Rester ici</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
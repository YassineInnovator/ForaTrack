import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Plus, Trash2, Save, CheckCircle2, AlertTriangle, 
  FileSpreadsheet, History, X, Clock, PlayCircle, ShieldAlert, PauseCircle
} from 'lucide-react';

const gingerBleu = "#1D365A";

// Générateur d'ID de secours
const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch(e) {
    return 'row-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now();
  }
};

const createEmptyRow = () => ({
  id: generateId(),
  passe: '', identifiant: '', type_ech: '', nature: '',
  long_toit: '', long_mur: '', code_etat: '',
  support_type: '', support_num: '', remarque: ''
});

const ProgressBar = ({ progress }) => {
  let colorClass = 'bg-orange-500'; // Début
  if (progress > 50) colorClass = 'bg-blue-500'; // En cours
  if (progress === 100) colorClass = 'bg-green-500'; // Prêt

  return (
    <div className="w-full bg-slate-200 rounded-full h-2 mt-2 overflow-hidden border border-slate-300/50">
      <div className={`${colorClass} h-2 rounded-full transition-all duration-500`} style={{ width: `${progress}%` }}></div>
    </div>
  );
};

export default function SampleEntryPage({ onNavigate, token }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Modals et tiroirs
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Session active
  const [activeDraftId, setActiveDraftId] = useState(generateId());

  // Données de la fiche
  const [metaData, setMetaData] = useState({ forage_name: '', date_saisie: new Date().toISOString().split('T')[0] });
  const [rows, setRows] = useState(() => Array(5).fill(null).map(() => createEmptyRow()));

  const [brouillons, setBrouillons] = useState(() => {
    try {
      const saved = localStorage.getItem('ginger_ft06b_brouillons');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('ginger_ft06b_brouillons', JSON.stringify(brouillons));
  }, [brouillons]);

  const calculateProgress = (meta, currentRows) => {
    let score = 0;
    if (meta.forage_name.trim() !== '') score += 20;
    if (meta.date_saisie !== '') score += 10;
    
    const hasValidRow = currentRows.some(r => r.identifiant.trim() !== '' || r.passe.trim() !== '');
    if (hasValidRow) score += 70;

    return score;
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

    setMetaData({ forage_name: '', date_saisie: new Date().toISOString().split('T')[0] });
    setRows(Array(5).fill(null).map(() => createEmptyRow()));
    setActiveDraftId(generateId());
  };

  const resumeDraft = (draftToResume) => {
    const currentProgress = calculateProgress(metaData, rows);
    if ((currentProgress > 0 || metaData.forage_name !== '') && activeDraftId !== draftToResume.id) {
      setBrouillons(prev => {
        const existingIndex = prev.findIndex(b => b.id === activeDraftId);
        const currentDraft = { id: activeDraftId, metaData, rows, progress: currentProgress, timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) };
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = currentDraft;
          return updated;
        }
        return [currentDraft, ...prev];
      });
    }

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

  const handleCellChange = (id, field, value) => {
    setRows(prevRows => prevRows.map(row => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const addRow = () => setRows([...rows, createEmptyRow()]);
  const removeRow = (id) => {
    if (rows.length > 1) setRows(rows.filter(row => row.id !== id));
    else setRows([createEmptyRow()]);
  };

  const confirmAndSave = async () => {
    setShowSaveConfirm(false);
    setLoading(true);

    const validRows = rows.filter(r => r.identifiant.trim() !== '' || r.passe.trim() !== '');
    const payload = { forage_name: metaData.forage_name, echantillons: validRows };

    try {
      const response = await fetch('http://172.20.10.6:8047/echantillons/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Erreur lors de la sauvegarde');

      setBrouillons(prev => prev.filter(b => b.id !== activeDraftId));
      setSuccess(true);
    } catch (error) {
      console.error(error);
      alert("Erreur de connexion au serveur. La sauvegarde a échoué. Vos données sont conservées en brouillon.");
    } finally {
      setLoading(false);
    }
  };

  const handleSafeExit = () => {
    const progress = calculateProgress(metaData, rows);
    if (progress > 0 || metaData.forage_name !== '') setShowExitConfirm(true);
    else onNavigate('DASHBOARD');
  };

  const forceExit = () => {
    saveDraftAndCreateNew();
    onNavigate('DASHBOARD');
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center justify-center">
        <div className="bg-white p-10 rounded-2xl shadow-xl border border-slate-200 text-center max-w-md w-full">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle2 size={40} /></div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Saisie Terminée !</h2>
          <p className="text-slate-500 mb-8">La liste des échantillons a été enregistrée avec succès.</p>
          <div className="space-y-3">
            <button onClick={() => { setSuccess(false); saveDraftAndCreateNew(); }} className="w-full font-bold py-3 px-4 rounded-xl text-white transition-all shadow-md bg-blue-600 hover:bg-blue-700">
              Saisir une autre fiche (FT06b)
            </button>
            <button onClick={() => onNavigate('DASHBOARD')} className="w-full font-bold py-3 px-4 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all">
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
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <button onClick={handleSafeExit} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 font-medium bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors">
            <ArrowLeft size={16} /> Quitter
          </button>
          
          <div className="flex items-center gap-3">
            <button onClick={saveDraftAndCreateNew} className="flex items-center gap-2 bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-colors">
              <Plus size={16} /> Nouvelle Fiche
            </button>
            <button type="button" onClick={() => setIsHistoryOpen(true)} className="lg:hidden flex items-center gap-2 text-sm text-white px-4 py-2 rounded-lg font-bold transition-colors shadow-sm" style={{ backgroundColor: gingerBleu }}>
              <History size={16} />
              <span className="hidden sm:inline">Brouillons</span>
            </button>
          </div>
        </div>

        {/* Titre Page */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: gingerBleu }}>
            <FileSpreadsheet className="w-7 h-7 text-blue-600" />
            Saisie Échantillons (FT06b)
          </h1>
          <p className="text-slate-500 flex items-center gap-2 mt-1">
            Fiche en cours <span className="text-xs font-mono bg-slate-200 text-slate-600 px-2 py-0.5 rounded">{activeDraftId.substring(0,8)}</span>
          </p>
        </div>

        {/* Layout Principal : Zone de Saisie + Sidebar */}
        <div className="flex flex-col lg:flex-row gap-6 items-start relative">
          
          {/* ZONE CENTRALE : SAISIE */}
          <div className="flex-1 w-full min-w-0 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            
            {/* En-tête Métadonnées */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Forage de rattachement *</label>
                <input 
                  type="text" placeholder="Ex: OHZ3012"
                  value={metaData.forage_name}
                  onChange={(e) => setMetaData({ ...metaData, forage_name: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Date Saisie / Prélèvement</label>
                <input 
                  type="date"
                  value={metaData.date_saisie}
                  onChange={(e) => setMetaData({ ...metaData, date_saisie: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                />
              </div>
            </div>

            {/* Le Tableau de saisie (Style Wizard Terrain exact) */}
            <div className="p-4 md:p-6 pt-0">
              <div className="border border-slate-300 rounded-xl overflow-x-auto bg-white">
                <table className="w-full text-xs border-collapse min-w-[1200px]">
                  <thead>
                    <tr className="bg-slate-200 text-slate-700 font-bold border-b border-slate-300">
                      <th rowSpan="2" className="border border-slate-300 py-2 px-3 w-16 text-center">Passe</th>
                      <th rowSpan="2" className="border border-slate-300 py-2 px-3 w-32 text-center">Identifiant</th>
                      <th rowSpan="2" className="border border-slate-300 py-2 px-3 w-24 text-center">Type</th>
                      <th rowSpan="2" className="border border-slate-300 py-2 px-3 w-32 text-center">Nature</th>
                      <th colSpan="2" className="border border-slate-300 py-1 text-center">Longueur forée (m)</th>
                      <th rowSpan="2" className="border border-slate-300 py-2 px-3 w-24 text-center">Code Etat</th>
                      <th colSpan="2" className="border border-slate-300 py-1 text-center">Support</th>
                      <th rowSpan="2" className="border border-slate-300 py-2 px-3 text-center">Remarque</th>
                      <th rowSpan="2" className="border border-slate-300 py-2 px-3 w-12 text-center"></th>
                    </tr>
                    <tr className="bg-slate-100 text-slate-600 font-semibold text-center uppercase tracking-wider">
                      <th className="border border-slate-300 py-1 px-2 w-24">Long. Toit</th>
                      <th className="border border-slate-300 py-1 px-2 w-24">Long. Mur</th>
                      <th className="border border-slate-300 py-1 px-2 w-24">Type</th>
                      <th className="border border-slate-300 py-1 px-2 w-24">N°</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="hover:bg-blue-50/50 transition-colors">
                        <td className="border border-slate-300 p-0"><input type="text" value={row.passe} onChange={(e) => handleCellChange(row.id, 'passe', e.target.value)} className="w-full h-10 px-2 outline-none text-center bg-transparent focus:bg-blue-50 focus:ring-inset focus:ring-2 focus:ring-blue-500 text-xs" /></td>
                        <td className="border border-slate-300 p-0"><input type="text" value={row.identifiant} onChange={(e) => handleCellChange(row.id, 'identifiant', e.target.value)} className="w-full h-10 px-2 outline-none text-center bg-transparent focus:bg-blue-50 focus:ring-inset focus:ring-2 focus:ring-blue-500 text-xs font-mono" /></td>
                        <td className="border border-slate-300 p-0"><input type="text" value={row.type_ech} onChange={(e) => handleCellChange(row.id, 'type_ech', e.target.value)} className="w-full h-10 px-2 outline-none text-center bg-transparent focus:bg-blue-50 focus:ring-inset focus:ring-2 focus:ring-blue-500 text-xs" /></td>
                        <td className="border border-slate-300 p-0"><input type="text" value={row.nature} onChange={(e) => handleCellChange(row.id, 'nature', e.target.value)} className="w-full h-10 px-2 outline-none text-center bg-transparent focus:bg-blue-50 focus:ring-inset focus:ring-2 focus:ring-blue-500 text-xs" /></td>
                        
                        <td className="border border-slate-300 p-0"><input type="number" step="0.01" value={row.long_toit} onChange={(e) => handleCellChange(row.id, 'long_toit', e.target.value)} className="w-full h-10 px-2 outline-none text-center bg-transparent focus:bg-blue-50 focus:ring-inset focus:ring-2 focus:ring-blue-500 text-xs" /></td>
                        <td className="border border-slate-300 p-0"><input type="number" step="0.01" value={row.long_mur} onChange={(e) => handleCellChange(row.id, 'long_mur', e.target.value)} className="w-full h-10 px-2 outline-none text-center bg-transparent focus:bg-blue-50 focus:ring-inset focus:ring-2 focus:ring-blue-500 text-xs" /></td>
                        
                        <td className="border border-slate-300 p-0"><input type="text" value={row.code_etat} onChange={(e) => handleCellChange(row.id, 'code_etat', e.target.value)} className="w-full h-10 px-2 outline-none text-center bg-transparent focus:bg-blue-50 focus:ring-inset focus:ring-2 focus:ring-blue-500 text-xs" /></td>
                        <td className="border border-slate-300 p-0"><input type="text" value={row.support_type} onChange={(e) => handleCellChange(row.id, 'support_type', e.target.value)} className="w-full h-10 px-2 outline-none text-center bg-transparent focus:bg-blue-50 focus:ring-inset focus:ring-2 focus:ring-blue-500 text-xs" /></td>
                        <td className="border border-slate-300 p-0"><input type="text" value={row.support_num} onChange={(e) => handleCellChange(row.id, 'support_num', e.target.value)} className="w-full h-10 px-2 outline-none text-center bg-transparent focus:bg-blue-50 focus:ring-inset focus:ring-2 focus:ring-blue-500 text-xs font-mono" /></td>
                        <td className="border border-slate-300 p-0"><input type="text" value={row.remarque} onChange={(e) => handleCellChange(row.id, 'remarque', e.target.value)} className="w-full h-10 px-2 outline-none text-center bg-transparent focus:bg-blue-50 focus:ring-inset focus:ring-2 focus:ring-blue-500 text-xs" /></td>
                        
                        <td className="border border-slate-300 p-1 text-center bg-slate-50">
                          <button onClick={() => removeRow(row.id)} className="text-slate-400 hover:text-red-600 p-1.5 rounded transition-colors" title="Supprimer la ligne">
                            <Trash2 className="w-4 h-4 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex justify-center">
                <button onClick={addRow} className="flex items-center text-sm text-blue-700 bg-blue-100 hover:bg-blue-200 px-4 py-2 rounded-lg font-bold transition-colors">
                  <Plus className="w-4 h-4 mr-2" /> Ajouter une ligne d'échantillon
                </button>
              </div>
            </div>

            {/* Footer : Boutons d'action */}
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
                Valider et Envoyer (FT06b)
              </button>
            </div>
          </div>

          {/* Overlay sombre pour tablette */}
          {isHistoryOpen && (
            <div className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-sm transition-opacity" onClick={() => setIsHistoryOpen(false)} />
          )}

          {/* SIDEBAR : BROUILLONS */}
          <div className={`
            fixed inset-y-0 right-0 z-40 w-full sm:w-96 bg-white shadow-2xl transform transition-transform duration-300 flex flex-col
            lg:relative lg:translate-x-0 lg:w-80 lg:shadow-sm lg:rounded-2xl lg:border lg:border-slate-200 lg:z-10 lg:sticky lg:top-8
            ${isHistoryOpen ? 'translate-x-0' : 'translate-x-full'}
          `}>
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <History size={18} className="text-blue-700" />
                <h3 className="font-bold text-slate-800">Brouillons Échantillons</h3>
              </div>
              <button type="button" onClick={() => setIsHistoryOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-full p-1 transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-4 space-y-4 flex-1 overflow-y-auto bg-slate-50/50">
              {brouillons.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <p className="text-sm font-medium">Aucun brouillon en cours.</p>
                  <p className="text-xs mt-1">Vos fiches non terminées apparaîtront ici.</p>
                </div>
              ) : brouillons.map((draft) => (
                <div key={draft.id} className="p-4 border border-slate-200 rounded-xl hover:border-blue-400 bg-white relative overflow-hidden group hover:shadow-md transition-all">
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${draft.progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                  
                  <div className="flex justify-between items-start mb-2 pl-2">
                    <span className="font-bold text-slate-800 text-sm">{draft.metaData.forage_name || 'Forage sans nom'}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1"><Clock size={10}/> {draft.timestamp}</span>
                      <button type="button" onClick={(e) => deleteDraft(e, draft.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-colors" title="Supprimer ce brouillon">
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
                  
                  <button 
                    type="button" 
                    onClick={() => resumeDraft(draft)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-600 hover:text-white border border-blue-100 hover:border-blue-600 rounded-lg transition-colors"
                  >
                    <PlayCircle size={16} /> Reprendre cette fiche
                  </button>
                </div>
              ))}
            </div>
          </div>
          
        </div>
      </div>

      {/* MODAL : CONFIRMER L'ENVOI */}
      {showSaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}>
              <ShieldAlert size={32} />
            </div>
            <h3 className="text-xl font-bold text-center text-slate-800 mb-2">Envoyer la fiche FT06b ?</h3>
            <p className="text-center text-slate-500 mb-8">Êtes-vous sûr de vouloir enregistrer définitivement la liste des échantillons pour le forage <strong className="text-slate-700">{metaData.forage_name || 'en cours'}</strong> ?</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => setShowSaveConfirm(false)} className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors">
                Vérifier encore
              </button>
              <button onClick={confirmAndSave} className="flex-1 px-4 py-3 rounded-xl font-bold text-white shadow-md transition-all" style={{ backgroundColor: '#16a34a' }}>
                Oui, Envoyer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL : QUITTER (ANTI-FUITE) */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border-t-4 animate-in zoom-in-95 duration-200" style={{ borderTopColor: '#f97316' }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#ffedd5', color: '#ea580c' }}>
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-bold text-center text-slate-800 mb-2">Sauvegarde automatique</h3>
            <p className="text-center text-slate-500 mb-8">Vous avez commencé à lister des échantillons. En quittant, cette fiche sera **sauvegardée dans vos brouillons**.</p>
            <div className="flex flex-col sm:flex-row-reverse gap-3">
              <button onClick={forceExit} className="flex-1 px-4 py-3 rounded-xl font-bold text-white shadow-md transition-colors" style={{ backgroundColor: '#f97316' }}>
                Quitter et Sauvegarder
              </button>
              <button onClick={() => setShowExitConfirm(false)} className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors">
                Rester ici
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
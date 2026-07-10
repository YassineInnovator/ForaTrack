import React, { useState, useEffect } from 'react';
import { 
  MapPin, Compass, Layers, Hash, CheckCircle2, 
  ChevronRight, ChevronLeft, Save, AlertCircle, FileDigit, Clock, ArrowLeft, Plus,
  History, Copy, X, ShieldAlert, AlertTriangle, PauseCircle, PlayCircle, Trash2
} from 'lucide-react';

const gingerBleu = "#1D365A";
const gingerVert = "#8DC63F";

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

const createEmptyRow = () => ({
  id: generateId(),
  cote: '', gen_num: '', gen_orientee: '',
  plumoses_fines: false, plumoses_gross: false, stries_fines: false, stries: false, strie_patine: false, mixte: false, indeterminee: false,
  remarques: '', gypse: false, bioturbations: false, patine: false,
  mb_dir: '', mb_pen: '', mb_pitch: '', mb_jeu: ''
});

const createEmptyGeneratriceRow = () => ({
  id: generateId(), num_carotte: '', num_generatrice: '', orientation_strati: '', cote_toit: '', cote_mur: '', date_heure_suivi: new Date().toISOString().slice(0, 16)
});

const VertHeader = ({ children, rowSpan, colSpan, className }) => (
  <th rowSpan={rowSpan} colSpan={colSpan} className={`border border-slate-300 align-bottom px-2 py-3 ${className || ''}`}>
    <div className="flex justify-center items-end min-h-[140px]">
      <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }} className="text-[10px] leading-tight text-center font-semibold">
        {children}
      </span>
    </div>
  </th>
);

const CheckCell = ({ row, field, colorClass, onUpdate }) => (
  <td className={`border border-slate-300 text-center font-bold cursor-pointer transition-colors hover:opacity-80 w-10 h-10 ${row[field] ? colorClass : 'bg-white'}`} onClick={() => onUpdate(row.id, field, !row[field])}>
    {row[field] ? 'x' : ''}
  </td>
);

const InputCell = ({ row, field, width = 'w-16', onUpdate }) => (
  <td className="border border-slate-300 p-0">
    <input type="text" value={row[field]} onChange={(e) => onUpdate(row.id, field, e.target.value)} className={`w-full h-10 px-2 outline-none text-center bg-transparent focus:bg-blue-50 focus:ring-inset focus:ring-2 focus:ring-blue-500 ${width} text-xs`} />
  </td>
);

// Composant Barre de Progression
const ProgressBar = ({ progress }) => {
  let color = 'bg-orange-500'; // Début
  if (progress > 50) color = 'bg-blue-500'; // En cours
  if (progress === 100) color = 'bg-green-500'; // Prêt

  return (
    <div className="w-full bg-slate-200 rounded-full h-2 mt-2 overflow-hidden border border-slate-300/50">
      <div className={`${color} h-2 rounded-full transition-all duration-500`} style={{ width: `${progress}%` }}></div>
    </div>
  );
};

export default function FieldWizardPage({ token, onNavigate }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isSafeToSubmit, setIsSafeToSubmit] = useState(false);
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // ID de la session active (pour savoir si on modifie un brouillon existant)
  const [activeDraftId, setActiveDraftId] = useState(generateId());

  // Les données de la fiche en cours
  const [formData, setFormData] = useState({ nom_fichier: '', nom_forage: '', date_foration: '', date_debut_suivi: '', date_fin_suivi: '', orientation_bv: '', type_forage: 'horizontal', azimuth_bv: '', orientation_strati: '', calci: false, teneur_eau: false });
  const [generatriceRows, setGeneratriceRows] = useState(() => Array(5).fill(null).map(() => createEmptyGeneratriceRow()));
  const [tableRows, setTableRows] = useState(() => Array(5).fill(null).map(() => createEmptyRow()));

  // Le Gestionnaire de Brouillons PERSISTANT (Mémoire du navigateur)
  const [brouillons, setBrouillons] = useState(() => {
    try {
      const saved = localStorage.getItem('ginger_brouillons');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Synchronisation automatique : à chaque fois que la liste change, on la grave dans le navigateur
  useEffect(() => {
    localStorage.setItem('ginger_brouillons', JSON.stringify(brouillons));
  }, [brouillons]);

  // --- LOGIQUE DE PROGRESSION ---
  const calculateProgress = (header, gen, struct) => {
    let totalScore = 0;
    let filledScore = 0;

    // 1. En-tête (4 points)
    totalScore += 4;
    if (header.nom_forage) filledScore += 1;
    if (header.date_foration) filledScore += 1;
    if (header.orientation_bv) filledScore += 1;
    if (header.azimuth_bv) filledScore += 1;

    // 2. Génératrices (3 points si au moins 1 ligne bien remplie)
    totalScore += 3;
    const hasValidGen = gen.some(r => r.num_carotte !== '' && r.num_generatrice !== '' && r.cote_toit !== '');
    if (hasValidGen) filledScore += 3;

    // 3. Structures (3 points si au moins 1 ligne renseignée)
    totalScore += 3;
    const hasValidStruct = struct.some(r => r.cote !== '');
    if (hasValidStruct) filledScore += 3;

    return Math.round((filledScore / totalScore) * 100);
  };

  // --- SAUVEGARDER EN BROUILLON ET CRÉER UNE NOUVELLE FICHE ---
  const saveDraftAndCreateNew = () => {
    const progress = calculateProgress(formData, generatriceRows, tableRows);
    
    // On ne sauvegarde un brouillon que s'il y a au moins un truc d'écrit
    if (progress > 0 || formData.nom_forage !== '') {
      setBrouillons(prev => {
        const existingIndex = prev.findIndex(b => b.id === activeDraftId);
        const currentDraft = { 
          id: activeDraftId, formData, generatriceRows, tableRows, progress, 
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

    // On remet la fiche à zéro
    setFormData({ nom_fichier: '', nom_forage: '', date_foration: '', date_debut_suivi: '', date_fin_suivi: '', orientation_bv: '', type_forage: 'horizontal', azimuth_bv: '', orientation_strati: '', calci: false, teneur_eau: false });
    setGeneratriceRows(Array(5).fill(null).map(() => createEmptyGeneratriceRow()));
    setTableRows(Array(5).fill(null).map(() => createEmptyRow()));
    setActiveDraftId(generateId());
    setCurrentStep(1);
  };

  // --- REPRENDRE UN BROUILLON ---
  const resumeDraft = (draftToResume) => {
    // 1. Auto-save la fiche actuelle si elle est commencée
    const currentProgress = calculateProgress(formData, generatriceRows, tableRows);
    if ((currentProgress > 0 || formData.nom_forage !== '') && activeDraftId !== draftToResume.id) {
      setBrouillons(prev => {
        const existingIndex = prev.findIndex(b => b.id === activeDraftId);
        const currentDraft = { id: activeDraftId, formData, generatriceRows, tableRows, progress: currentProgress, timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) };
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = currentDraft;
          return updated;
        }
        return [currentDraft, ...prev];
      });
    }

    // 2. Charger le brouillon sélectionné
    setFormData(draftToResume.formData);
    setGeneratriceRows(draftToResume.generatriceRows);
    setTableRows(draftToResume.tableRows);
    setActiveDraftId(draftToResume.id);
    setCurrentStep(1);
    setIsHistoryOpen(false); // Fermer le panneau sur tablette
  };

  // --- SUPPRIMER UN BROUILLON ---
  const deleteDraft = (e, draftId) => {
    e.stopPropagation(); // Empêche de déclencher le "Reprendre" en cliquant sur la poubelle
    if(window.confirm("Voulez-vous supprimer ce brouillon définitivement ?")) {
      setBrouillons(prev => prev.filter(b => b.id !== draftId));
    }
  };


  // Effets et Handlers classiques
  useEffect(() => {
    if (currentStep === 3) {
      const timer = setTimeout(() => setIsSafeToSubmit(true), 500);
      return () => clearTimeout(timer);
    } else {
      setIsSafeToSubmit(false);
    }
  }, [currentStep]);

  useEffect(() => {
    const date = new Date();
    const annee = date.getFullYear();
    const mois = String(date.getMonth() + 1).padStart(2, '0');
    const numRapportMock = "014"; 
    const forageFormate = formData.nom_forage ? formData.nom_forage.toUpperCase().trim().replace(/\s+/g, '_') : 'SANS_NOM';
    const nomGenere = `GIN${annee}_${mois}_${numRapportMock}_${forageFormate}.xls`;
    
    setFormData(prev => prev.nom_fichier !== nomGenere ? { ...prev, nom_fichier: nomGenere } : prev);
  }, [formData.nom_forage]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const updateTableRow = (id, field, value) => {
    setTableRows(tableRows.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const updateGeneratriceRow = (id, field, value) => {
    setGeneratriceRows(generatriceRows.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 3));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (currentStep < 3 || !isSafeToSubmit) return;
    setShowSaveConfirm(true); 
  };

  const confirmAndSave = async () => {
    setShowSaveConfirm(false);
    setLoading(true);
    
    try {
      const payload = {
        en_tete: formData,
        generatrices: generatriceRows.filter(row => row.num_carotte !== '' || row.num_generatrice !== ''),
        structures: tableRows.filter(row => row.cote !== '')
      };

      const response = await fetch('http://172.20.10.6:8047/releve-terrain/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Erreur serveur");

      // Si le serveur a bien reçu, on supprime ce brouillon de la liste
      setBrouillons(prev => prev.filter(b => b.id !== activeDraftId));
      setSuccess(true);
      
    } catch (error) {
      console.error(error);
      alert("Erreur de connexion au serveur Python. L'API est-elle lancée ? Vos données sont conservées à l'écran en sécurité.");
    } finally {
      setLoading(false);
    }
  };

  const handleSafeExit = () => {
    const progress = calculateProgress(formData, generatriceRows, tableRows);
    if (progress > 0 || formData.nom_forage !== '') {
      setShowExitConfirm(true);
    } else {
      onNavigate('DASHBOARD');
    }
  };

  const forceExit = () => {
    saveDraftAndCreateNew(); // On auto-save en quittant pour ne rien perdre !
    onNavigate('DASHBOARD');
  };

  const OptionCard = ({ name, value, label, currentVal }) => (
    <label className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${currentVal === value ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
      <input type="radio" name={name} value={value} checked={currentVal === value} onChange={handleChange} className="hidden" />
      <span className={`font-semibold text-center text-sm ${currentVal === value ? 'text-blue-700' : 'text-slate-600'}`}>{label}</span>
    </label>
  );

  const renderStep1 = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Nom du Forage *</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 text-slate-400" size={18} />
            <input type="text" name="nom_forage" value={formData.nom_forage} onChange={handleChange} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700" placeholder="Ex: OHZ1000" required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2 flex justify-between">
            <span>Nom du Fichier</span><span className="text-xs text-blue-600 font-bold bg-blue-100 px-2 py-0.5 rounded-full">Généré Auto</span>
          </label>
          <div className="relative opacity-70">
            <FileDigit className="absolute left-3 top-3 text-slate-400" size={18} />
            <input type="text" name="nom_fichier" value={formData.nom_fichier} readOnly className="w-full pl-10 pr-4 py-2.5 bg-slate-200 border border-slate-300 rounded-lg font-mono text-slate-600 font-bold cursor-not-allowed outline-none select-none" />
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 bg-slate-50 rounded-xl border border-slate-200">
        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Date Foration</label><input type="date" name="date_foration" value={formData.date_foration} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none" /></div>
        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Début Suivi</label><input type="date" name="date_debut_suivi" value={formData.date_debut_suivi} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none" /></div>
        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Fin Suivi</label><input type="date" name="date_fin_suivi" value={formData.date_fin_suivi} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none" /></div>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-semibold text-slate-700">Type de Forage</label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <OptionCard name="type_forage" value="horizontal" label="Horizontal" currentVal={formData.type_forage} />
          <OptionCard name="type_forage" value="oblique_m" label="Oblique M." currentVal={formData.type_forage} />
          <OptionCard name="type_forage" value="oblique_d" label="Oblique D." currentVal={formData.type_forage} />
          <OptionCard name="type_forage" value="vertical_m" label="Vertical M." currentVal={formData.type_forage} />
          <OptionCard name="type_forage" value="vertical_d" label="Vertical D." currentVal={formData.type_forage} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-orange-50/50 p-5 rounded-xl border border-orange-100">
        <div>
          <label className="block text-sm font-semibold text-orange-900 mb-2">Orientation BV mesures (°)</label>
          <div className="relative">
            <Compass className="absolute left-3 top-3 text-orange-400" size={18} />
            <input type="text" name="orientation_bv" value={formData.orientation_bv} onChange={handleChange} className="w-full pl-10 pr-4 py-2.5 bg-white border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-slate-700 font-mono" placeholder="Ex: +0,45" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-orange-900 mb-2">Azimuth BV mesures</label>
          <div className="relative">
            <Hash className="absolute left-3 top-3 text-orange-400" size={18} />
            <input type="number" step="1" name="azimuth_bv" value={formData.azimuth_bv} onChange={handleChange} className="w-full pl-10 pr-4 py-2.5 bg-white border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-slate-700 font-mono" placeholder="Ex: 245" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-3">Orientation / Stratigraphie</label>
          <div className="grid grid-cols-3 gap-3">
            <OptionCard name="orientation_strati" value="H" label="Oui (H)" currentVal={formData.orientation_strati} />
            <OptionCard name="orientation_strati" value="O" label="Oui (O)" currentVal={formData.orientation_strati} />
            <OptionCard name="orientation_strati" value="V" label="Non (V)" currentVal={formData.orientation_strati} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
           <label className="flex items-center justify-center gap-3 cursor-pointer p-4 w-full bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-300 transition-colors">
            <input type="checkbox" name="calci" checked={formData.calci} onChange={handleChange} className="w-5 h-5 text-blue-600 rounded" />
            <span className="font-bold text-slate-700 text-sm">Présence Calci</span>
          </label>
          <label className="flex items-center justify-center gap-3 cursor-pointer p-4 w-full bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-300 transition-colors">
            <input type="checkbox" name="teneur_eau" checked={formData.teneur_eau} onChange={handleChange} className="w-5 h-5 text-blue-600 rounded" />
            <span className="font-bold text-slate-700 text-sm">Teneur en eau</span>
          </label>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h4 className="text-sm font-bold text-blue-800 flex items-center gap-2"><Layers size={16} /> Tableau des Génératrices</h4>
          <p className="text-xs text-blue-700 mt-1">Saisissez les différentes carottes et génératrices pour ce forage.</p>
        </div>
        <button type="button" onClick={() => setGeneratriceRows([...generatriceRows, createEmptyGeneratriceRow()])} className="flex items-center justify-center gap-2 text-sm text-blue-700 bg-blue-100 hover:bg-blue-200 px-4 py-2 rounded-lg font-bold transition-colors">
          <Plus size={16} /> Ajouter une ligne
        </button>
      </div>

      <div className="border border-slate-300 rounded-xl overflow-x-auto bg-white">
        <table className="w-full text-xs border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-slate-200 text-slate-700 font-bold border-b border-slate-300">
              <th rowSpan="2" className="border border-slate-300 py-2 px-3 w-24">N° Carotte</th>
              <th rowSpan="2" className="border border-slate-300 py-2 px-3 w-32">N° Génératrice</th>
              <th rowSpan="2" className="border border-slate-300 py-2 px-3 w-28">Orientation<br/>/ strati</th>
              <th colSpan="2" className="border border-slate-300 py-1">Cotes (m)</th>
              <th rowSpan="2" className="border border-slate-300 py-2 px-3 w-48">Date/Heure du suivi géologique</th>
            </tr>
            <tr className="bg-slate-100 text-slate-600 font-semibold text-center uppercase tracking-wider">
              <th className="border border-slate-300 py-1 px-2 w-24">Toit</th>
              <th className="border border-slate-300 py-1 px-2 w-24">Mur</th>
            </tr>
          </thead>
          <tbody>
            {generatriceRows.map((row) => (
              <tr key={row.id} className="hover:bg-blue-50/50 transition-colors">
                <InputCell row={row} field="num_carotte" width="w-full" onUpdate={updateGeneratriceRow} />
                <InputCell row={row} field="num_generatrice" width="w-full" onUpdate={updateGeneratriceRow} />
                <InputCell row={row} field="orientation_strati" width="w-full" onUpdate={updateGeneratriceRow} />
                <InputCell row={row} field="cote_toit" width="w-full" onUpdate={updateGeneratriceRow} />
                <InputCell row={row} field="cote_mur" width="w-full" onUpdate={updateGeneratriceRow} />
                <td className="border border-slate-300 p-0">
                  <input
                    type="datetime-local"
                    value={row.date_heure_suivi}
                    onChange={(e) => updateGeneratriceRow(row.id, 'date_heure_suivi', e.target.value)}
                    className="w-full h-10 px-2 outline-none text-center bg-transparent focus:bg-blue-50 focus:ring-inset focus:ring-2 focus:ring-blue-500 text-xs"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="bg-green-50/50 p-4 rounded-xl border border-green-100 mb-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h4 className="text-sm font-bold text-green-800 flex items-center gap-2"><CheckCircle2 size={16} /> Tableau des Structures Observées</h4>
          <p className="text-xs text-green-700 mt-1">Saisissez les données pour le forage {formData.type_forage}.</p>
        </div>
        <button type="button" onClick={() => setTableRows([...tableRows, createEmptyRow()])} className="flex items-center justify-center gap-2 text-sm text-blue-700 bg-blue-100 hover:bg-blue-200 px-4 py-2 rounded-lg font-bold transition-colors">
          <Plus size={16} /> Ajouter une ligne
        </button>
      </div>

      <div className="border border-slate-300 rounded-xl overflow-x-auto bg-white">
        <table className="w-full text-xs border-collapse min-w-[1200px]">
          <thead>
            <tr className="bg-slate-200 text-slate-700 font-bold border-b border-slate-300">
              <th className="border border-slate-300"></th>
              <th colSpan="2" className="border border-slate-300 py-2">Génératrice</th>
              <th colSpan="7" className="border border-slate-300 py-2">Structures</th>
              <th className="border border-slate-300"></th>
              <th colSpan="3" className="border border-slate-300 py-2">Oxydation</th>
              <th colSpan="4" className="border border-slate-300 py-2">Mesure brute</th>
            </tr>
            <tr className="bg-slate-100 text-slate-600 font-semibold text-center uppercase tracking-wider">
              <th rowSpan="2" className="border border-slate-300 px-2 whitespace-nowrap">Cotes (m)</th>
              <th rowSpan="2" className="border border-slate-300 px-2 w-20">N°</th>
              <VertHeader rowSpan="2" className="bg-slate-50 w-12">Orientée</VertHeader>
              <th colSpan="2" className="border border-slate-300 bg-red-100 text-red-800 py-1">Extension</th>
              <th colSpan="3" className="border border-slate-300 bg-green-100 text-green-800 py-1">Cisaillement</th>
              <VertHeader rowSpan="2" className="bg-blue-100 text-blue-800">Mixte</VertHeader>
              <VertHeader rowSpan="2" className="bg-yellow-100 text-yellow-800">Indéterminée</VertHeader>
              <th rowSpan="2" className="border border-slate-300 px-2">Remarques</th>
              <VertHeader rowSpan="2" className="bg-orange-100 text-orange-900">Gypse</VertHeader>
              <VertHeader rowSpan="2" className="bg-orange-100 text-orange-900">Bioturbations oxydées</VertHeader>
              <VertHeader rowSpan="2" className="bg-orange-100 text-orange-900">Patine d'oxydation</VertHeader>
              <VertHeader rowSpan="2" className="bg-slate-50">Direction</VertHeader>
              <VertHeader rowSpan="2" className="bg-slate-50">Pendage</VertHeader>
              <VertHeader rowSpan="2" className="bg-slate-50">Pitch</VertHeader>
              <VertHeader rowSpan="2" className="bg-slate-50">Jeu</VertHeader>
            </tr>
            <tr className="bg-slate-50 text-center uppercase">
              <VertHeader className="bg-red-50 text-red-800 w-8">Plumoses fines</VertHeader>
              <VertHeader className="bg-red-50 text-red-800 w-8">Plumoses gross.</VertHeader>
              <VertHeader className="bg-green-50 text-green-800 w-8">Stries fines (-)</VertHeader>
              <VertHeader className="bg-green-50 text-green-800 w-8">Stries (+)</VertHeader>
              <VertHeader className="bg-green-50 text-green-800 w-8">Strié patiné (++)</VertHeader>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row) => (
              <tr key={row.id} className="hover:bg-blue-50/50 transition-colors">
                <InputCell row={row} field="cote" width="w-20" onUpdate={updateTableRow} />
                <InputCell row={row} field="gen_num" width="w-20" onUpdate={updateTableRow} />
                <InputCell row={row} field="gen_orientee" width="w-12" onUpdate={updateTableRow} />
                
                <CheckCell row={row} field="plumoses_fines" colorClass="bg-red-500 text-white" onUpdate={updateTableRow} />
                <CheckCell row={row} field="plumoses_gross" colorClass="bg-red-600 text-white" onUpdate={updateTableRow} />
                <CheckCell row={row} field="stries_fines" colorClass="bg-green-400 text-slate-800" onUpdate={updateTableRow} />
                <CheckCell row={row} field="stries" colorClass="bg-green-500 text-white" onUpdate={updateTableRow} />
                <CheckCell row={row} field="strie_patine" colorClass="bg-green-600 text-white" onUpdate={updateTableRow} />
                <CheckCell row={row} field="mixte" colorClass="bg-blue-500 text-white" onUpdate={updateTableRow} />
                <CheckCell row={row} field="indeterminee" colorClass="bg-yellow-400 text-slate-800" onUpdate={updateTableRow} />
                
                <InputCell row={row} field="remarques" width="w-28" onUpdate={updateTableRow} />
                
                <CheckCell row={row} field="gypse" colorClass="bg-amber-600 text-white" onUpdate={updateTableRow} />
                <CheckCell row={row} field="bioturbations" colorClass="bg-amber-600 text-white" onUpdate={updateTableRow} />
                <CheckCell row={row} field="patine" colorClass="bg-amber-600 text-white" onUpdate={updateTableRow} />
                
                <InputCell row={row} field="mb_dir" width="w-10" onUpdate={updateTableRow} />
                <InputCell row={row} field="mb_pen" width="w-10" onUpdate={updateTableRow} />
                <InputCell row={row} field="mb_pitch" width="w-10" onUpdate={updateTableRow} />
                <InputCell row={row} field="mb_jeu" width="w-10" onUpdate={updateTableRow} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center justify-center">
        <div className="bg-white p-10 rounded-2xl shadow-xl border border-slate-100 text-center max-w-md w-full">
          <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle2 size={40} /></div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Saisie Terminée !</h2>
          <p className="text-slate-500 mb-8">L'en-tête et les tableaux ont été enregistrés sur le serveur.</p>
          <div className="space-y-3">
            <button onClick={() => { 
                setSuccess(false); 
                saveDraftAndCreateNew(); // Remet tout à zéro proprement
              }} 
              className="w-full font-bold py-3 px-4 rounded-xl text-white transition-all hover:shadow-lg" style={{ backgroundColor: gingerBleu }}>Saisir un autre relevé
            </button>
            <button onClick={() => onNavigate('DASHBOARD')} className="w-full font-bold py-3 px-4 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all">Retour au tableau de bord</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans">
      <div className={`mx-auto transition-all duration-500 ${currentStep >= 2 ? 'max-w-[1600px]' : 'max-w-6xl'}`}>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <button onClick={handleSafeExit} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 font-medium bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200">
            <ArrowLeft size={16} /> Quitter
          </button>
          
          <div className="flex items-center gap-3">
            {/* BOUTON NOUVELLE FICHE / BROUILLON */}
            <button onClick={saveDraftAndCreateNew} className="flex items-center gap-2 bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-colors">
              <Plus size={16} /> Nouvelle Fiche
            </button>
            {/* BOUTON TIROIR SUR TABLETTE */}
            <button type="button" onClick={() => setIsHistoryOpen(true)} className="lg:hidden flex items-center gap-2 text-sm text-white px-4 py-2 rounded-lg font-bold transition-colors shadow-sm" style={{ backgroundColor: gingerBleu }}>
              <History size={16} />
              <span className="hidden sm:inline">Mes Brouillons</span>
            </button>
          </div>
        </div>
        
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: gingerBleu }}>Saisie Terrain Centralisée</h1>
          <p className="text-slate-500 flex items-center gap-2">
            Fiche en cours <span className="text-xs font-mono bg-slate-200 text-slate-600 px-2 py-0.5 rounded">{activeDraftId.substring(0,8)}</span>
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start relative">
          
          {/* ZONE PRINCIPALE : LE WIZARD */}
          <div className="flex-1 w-full min-w-0 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            
            {/* Barre de navigation des étapes cliquables */}
            <div className="flex flex-col sm:flex-row border-b border-slate-100">
              {['En-tête Forage', 'Tableau Génératrices', 'Tableau des Structures'].map((label, index) => {
                const stepNum = index + 1;
                const isActive = currentStep === stepNum;
                const isPassed = currentStep > stepNum;
                return (
                  <button key={stepNum} type="button" onClick={() => setCurrentStep(stepNum)} className={`flex-1 p-3 sm:p-4 flex items-center justify-start sm:justify-center gap-3 transition-colors cursor-pointer outline-none ${isActive ? 'bg-blue-50/50 border-l-4 sm:border-l-0 sm:border-b-2 border-blue-600 hover:bg-blue-50/50' : 'text-slate-400 hover:bg-slate-50'}`}>
                    <div className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${isActive ? 'bg-blue-600 text-white' : isPassed ? 'bg-green-500 text-white' : 'bg-slate-200'}`}>
                      {isPassed ? <CheckCircle2 size={12} /> : stepNum}
                    </div>
                    <span className={`text-sm font-semibold text-left ${isActive ? 'text-blue-800' : ''}`}>{label}</span>
                  </button>
                );
              })}
            </div>

            <div className="p-4 sm:p-6 md:p-8">
              <form onSubmit={handleSubmit}>
                {currentStep === 1 && renderStep1()}
                {currentStep === 2 && renderStep2()}
                {currentStep === 3 && renderStep3()}

                <div className="mt-10 pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="flex w-full sm:w-auto gap-3">
                    <button type="button" onClick={prevStep} disabled={currentStep === 1} className={`flex-1 sm:flex-none flex justify-center items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${currentStep === 1 ? 'opacity-0 pointer-events-none' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'}`}>
                      <ChevronLeft size={20} /> Précédent
                    </button>
                    {/* BOUTON METTRE EN PAUSE */}
                    <button type="button" onClick={saveDraftAndCreateNew} className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-6 py-3 rounded-xl font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-all border border-blue-200">
                      <PauseCircle size={20} /> Pause
                    </button>
                  </div>

                  {currentStep < 3 ? (
                    <button type="button" onClick={nextStep} className="w-full sm:w-auto flex justify-center items-center gap-2 px-8 py-3 rounded-xl font-bold text-white transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5" style={{ backgroundColor: gingerBleu }}>
                      Suivant <ChevronRight size={20} />
                    </button>
                  ) : (
                    <button type="submit" disabled={loading || !isSafeToSubmit} className="w-full sm:w-auto flex justify-center items-center gap-2 px-8 py-3 rounded-xl font-bold text-white transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: gingerVert }}>
                      {loading ? <Clock className="animate-spin" size={20} /> : <Save size={20} />}
                      Envoyer
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
          
          {/* Overlay sombre pour tablette */}
          {isHistoryOpen && (
            <div className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-sm transition-opacity" onClick={() => setIsHistoryOpen(false)} />
          )}

          {/* ZONE LATÉRALE : BROUILLONS ET HISTORIQUE */}
          <div className={`
            fixed inset-y-0 right-0 z-40 w-full sm:w-96 bg-white shadow-2xl transform transition-transform duration-300 flex flex-col
            lg:relative lg:translate-x-0 lg:w-80 lg:shadow-sm lg:rounded-2xl lg:border lg:border-slate-200 lg:z-10 lg:sticky lg:top-8
            ${isHistoryOpen ? 'translate-x-0' : 'translate-x-full'}
          `}>
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <History size={18} className="text-blue-700" />
                <h3 className="font-bold text-slate-800">Fiches en attente</h3>
              </div>
              <button type="button" onClick={() => setIsHistoryOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-full p-1 transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-4 space-y-4 flex-1 overflow-y-auto bg-slate-50/50">
              {brouillons.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <p className="text-sm font-medium">Aucun brouillon en cours.</p>
                  <p className="text-xs mt-1">Cliquez sur "Pause" ou "Nouvelle fiche" pour mettre un travail de côté.</p>
                </div>
              ) : brouillons.map((draft) => (
                <div key={draft.id} className="p-4 border border-slate-200 rounded-xl hover:border-blue-400 hover:shadow-md transition-all bg-white relative overflow-hidden group">
                  {/* Petit indicateur de status coloré sur le bord gauche */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${draft.progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                  
                  <div className="flex justify-between items-start mb-2 pl-2">
                    <span className="font-bold text-slate-800 text-sm">{draft.formData.nom_forage || 'Forage sans nom'}</span>
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
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-600 hover:text-white rounded-lg transition-colors border border-blue-100 hover:border-blue-600"
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
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4"><ShieldAlert size={32} /></div>
            <h3 className="text-xl font-bold text-center text-slate-800 mb-2">Clôturer et Envoyer ?</h3>
            <p className="text-center text-slate-500 mb-8">Êtes-vous sûr de vouloir envoyer définitivement ce relevé au serveur pour le forage <strong className="text-slate-700">{formData.nom_forage || 'en cours'}</strong> ?</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => setShowSaveConfirm(false)} className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Vérifier encore</button>
              <button onClick={confirmAndSave} className="flex-1 px-4 py-3 rounded-xl font-bold text-white shadow-md hover:shadow-lg transition-all" style={{ backgroundColor: gingerVert }}>Oui, Envoyer</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL : QUITTER (BOUCLIER ANTI-FUITE) */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border-t-4 border-orange-500 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={32} /></div>
            <h3 className="text-xl font-bold text-center text-slate-800 mb-2">Sauvegarde automatique</h3>
            <p className="text-center text-slate-500 mb-8">Vous avez des données en cours. En quittant, cette fiche sera **sauvegardée dans vos brouillons** pour ne rien perdre.</p>
            <div className="flex flex-col sm:flex-row-reverse gap-3">
              <button onClick={forceExit} className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-600 shadow-md transition-colors">Quitter</button>
              <button onClick={() => setShowExitConfirm(false)} className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Rester ici</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
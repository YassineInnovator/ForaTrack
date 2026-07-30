import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, FileType, Folder, CheckSquare, Loader2, CheckCircle } from 'lucide-react';

const gingerVert = "#8DC63F";
const gingerBleu = "#1D365A";

export default function CreateReportPage({ token, onNavigate }) {
  const [foragesDisponibles, setForagesDisponibles] = useState([]);
  const [selectedForages, setSelectedForages] = useState([]); 
  const [format, setFormat] = useState('pdf');
  const [chemin, setChemin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch('http://127.0.0.1:8072/afficher/forages/', { headers: { 'Authorization': `Bearer ${token}` }})
      .then(r => r.json())
      .then(setForagesDisponibles)
      .catch(() => setError("Impossible de charger les forages."));
  }, [token]);

  // CORRECTION : On utilise le "forage" (nom) comme identifiant
  const toggleForage = (nomForage) => {
    setSelectedForages(prev => 
      prev.includes(nomForage) ? prev.filter(f => f !== nomForage) : [...prev, nomForage]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedForages.length === 0) return setError("Veuillez sélectionner au moins un forage.");
    
    setLoading(true);
    setError(null);

    const payload = {
      forages: selectedForages, // Envoi du tableau de noms
      chemin_dossier: chemin || null,
      format: format
    };

    try {
      // Appel à la nouvelle route
      const response = await fetch('http://127.0.0.1:8073/generer-rapport/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Erreur lors de la création du fichier.");
      
      // LA MAGIE DU TÉLÉCHARGEMENT PHYSIQUE
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rapport_Ginger_${format.toUpperCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      setSuccess(true);
      setTimeout(() => onNavigate('DASHBOARD'), 2500); // Retour au dashboard après 2.5s
      
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center justify-center">
        <div className="bg-white p-10 rounded-2xl shadow-xl text-center max-w-md w-full animate-in zoom-in">
          <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle size={40} /></div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Fichier Généré !</h2>
          <p className="text-slate-500 mb-4">Le téléchargement a démarré dans votre navigateur et le fichier a été enregistré sur le serveur.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => onNavigate('DASHBOARD')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 font-medium mb-6 transition-colors">
          <ArrowLeft size={16} /> Retour aux rapports
        </button>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Générateur de Rapport</h2>
          <p className="text-slate-500 mb-8 pb-6 border-b border-slate-100">Créez et exportez un rapport technique pour un ou plusieurs forages.</p>

          <div className="mb-8">
            <label className="block text-sm font-semibold text-slate-700 mb-3">Sélectionnez les forages concernés *</label>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-60 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
              {foragesDisponibles.length === 0 ? <p className="text-sm text-slate-400 p-2">Aucun forage disponible.</p> : null}
              
              {/* CORRECTION DU KEY */}
              {foragesDisponibles.map(f => (
                <label key={f.forage} className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${selectedForages.includes(f.forage) ? 'bg-blue-50 border-blue-500' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                  <input type="checkbox" className="hidden" checked={selectedForages.includes(f.forage)} onChange={() => toggleForage(f.forage)} />
                  <div className={`w-5 h-5 rounded flex items-center justify-center border ${selectedForages.includes(f.forage) ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                    {selectedForages.includes(f.forage) && <CheckSquare size={14} className="text-white" />}
                  </div>
                  <span className="font-bold text-slate-700">{f.forage || 'Sans nom'}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">{selectedForages.length} forage(s) sélectionné(s)</p>
          </div>

          <div className="mb-8">
            <label className="block text-sm font-semibold text-slate-700 mb-3">Format d'exportation souhaité</label>
            <div className="grid grid-cols-2 gap-4">
              <label className={`border-2 rounded-xl p-5 cursor-pointer flex flex-col items-center gap-2 transition-all ${format === 'pdf' ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <input type="radio" name="format" value="pdf" checked={format === 'pdf'} onChange={(e) => setFormat(e.target.value)} className="hidden" />
                <FileType size={32} className={format === 'pdf' ? 'text-red-600' : 'text-slate-400'} />
                <span className="font-bold text-slate-800">Fichier PDF</span>
              </label>
              <label className={`border-2 rounded-xl p-5 cursor-pointer flex flex-col items-center gap-2 transition-all ${format === 'docx' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <input type="radio" name="format" value="docx" checked={format === 'docx'} onChange={(e) => setFormat(e.target.value)} className="hidden" />
                <FileType size={32} className={format === 'docx' ? 'text-blue-600' : 'text-slate-400'} />
                <span className="font-bold text-slate-800">Fichier Word</span>
              </label>
            </div>
          </div>

          <div className="mb-8 bg-slate-50 p-5 rounded-xl border border-slate-200">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1"><Folder size={16}/> Emplacement sur le serveur (Optionnel)</label>
            <p className="text-xs text-slate-500 mb-3">Indiquez le chemin réseau pour sauvegarder une copie physique (ex: C:\Users\Projets).</p>
            <input type="text" value={chemin} onChange={(e) => setChemin(e.target.value)} placeholder="Ex: C:\Users\Projets\ClientX" className="w-full px-4 py-3 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {error && <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-lg font-medium border border-red-200">{error}</div>}

          <button type="submit" disabled={loading} className="w-full text-white font-bold py-4 px-4 rounded-xl flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-70" style={{ backgroundColor: gingerVert }}>
            {loading ? <Loader2 className="animate-spin" /> : <Save />} GÉNÉRER LE FICHIER
          </button>
        </form>
      </div>
    </div>
  );
}
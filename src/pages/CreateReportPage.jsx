import React, { useState, useEffect } from 'react';
import { FileText, Save, Loader2, AlertCircle, CheckCircle, FileType, FolderGit2, Download, MapPin } from 'lucide-react';

const gingerBleu = "#1D365A";
const gingerVert = "#8DC63F";

export default function CreateReportPage({ token, onNavigate }) {
  const [loading, setLoading] = useState(false);
  const [loadingForages, setLoadingForages] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  // Liste des forages récupérés depuis l'API
  const [foragesDisponibles, setForagesDisponibles] = useState([]);

  // État du formulaire
  const [formData, setFormData] = useState({
    forage_id: '',
    forage_nom: '',
    format: '',
    chemin_pdf: '',
  });

  useEffect(() => {
    const fetchForages = async () => {
      try {
        // Remplace l'URL si ta route s'appelle différemment (ex: /forages/)
        const response = await fetch('http://127.0.0.1:8047/afficher/forages/', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error("Impossible de charger les forages");
        
        const data = await response.json();
        setForagesDisponibles(data);
      } catch (err) {
        setError("Erreur de chargement des forages. Avez-vous démarré FastAPI ?");
      } finally {
        setLoadingForages(false);
      }
    };
    
    fetchForages();
  }, [token]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Quand on choisit un forage dans la liste déroulante, on stocke l'ID ET le Nom
  const handleForageSelect = (e) => {
    const selectedId = e.target.value;
    const selectedForage = foragesDisponibles.find(f => f.id === selectedId);
    
    setFormData({
      ...formData,
      forage_id: selectedId,
      forage_nom: selectedForage ? (selectedForage.forage_nom || selectedForage.nom || selectedForage.forage || "Forage inconnu") : ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); // <--- AJOUT CRUCIAL ICI : empêche la page de se recharger !
    setLoading(true);
    setError(null);

    try {
      const payload = {
        forage: formData.forage_nom,
        forage_id: formData.forage_id,
        chemin_pdf: formData.chemin_pdf
      };

      const response = await fetch('http://127.0.0.1:8047/rapports/', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Erreur lors de la création du rapport.");
      }
      
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Erreur de connexion au serveur.");
    } finally {
      setLoading(false);
    }
  };

  // AJOUTE CETTE FONCTION ICI
  const handleDownload = () => {
    // Ceci est un "Mock" (faux téléchargement pour tester l'UI).
    // Plus tard, on appellera une route FastAPI qui renverra le VRAI fichier.
    const contenuFactice = `Ceci est le rapport généré pour le forage : ${formData.forage_nom}`;
    const blob = new Blob([contenuFactice], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    
    // Création d'un lien invisible pour forcer le téléchargement
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rapport_${formData.forage_nom}.${formData.format}`;
    document.body.appendChild(a);
    a.click();
    
    // Nettoyage
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <button 
          onClick={() => onNavigate('DASHBOARD')} 
          className="text-sm text-slate-500 hover:text-slate-800 mb-6 flex items-center gap-1 font-medium transition-colors"
        >
           &larr; Retour au tableau de bord
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          
          {/* En-tête de la carte */}
          <div className="flex items-center gap-4 mb-8 border-b border-slate-200 pb-6">
            <div className="p-4 rounded-xl" style={{ backgroundColor: `${gingerVert}20`, color: gingerVert }}>
              <FileText size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-bold" style={{ color: gingerBleu }}>Générateur de Rapport</h2>
              <p className="text-slate-500 mt-1">Créez et exportez un rapport technique pour un forage existant.</p>
            </div>
          </div>

          {/* ÉCRAN DE SUCCÈS */}
          {success ? (
            <div className="bg-green-50 border border-green-200 p-8 rounded-xl flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-300">
              <CheckCircle size={56} className="text-green-500 mb-4" />
              <h3 className="text-2xl font-bold mb-2 text-green-900">Rapport Enregistré !</h3>
              <p className="text-green-700 mb-8">Le rapport a été lié au forage avec succès dans la base de données.</p>
              
              <div className="flex gap-4 w-full max-w-md">
                {/* MODIFIE LE BOUTON TÉLÉCHARGER ICI */}
                <button 
                  onClick={handleDownload} 
                  className="flex-1 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:shadow-lg transition-all" 
                  style={{ backgroundColor: gingerBleu }}
                >
                  <Download size={20} /> Télécharger (.{formData.format})
                </button>
                <button onClick={() => onNavigate('DASHBOARD')} className="flex-1 bg-white border border-slate-300 text-slate-700 font-bold py-3 px-4 rounded-xl hover:bg-slate-50 transition-all">
                  Terminer
                </button>
              </div>
            </div>
          ) : (
            
            /* FORMULAIRE DE SAISIE */
            <form onSubmit={handleSubmit} className="space-y-8">
              
              {/* Choix du forage (Liste déroulante API) */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Forage ou Campagne concernée *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin size={18} className="text-slate-400" />
                  </div>
                  <select
                    name="forage_id"
                    value={formData.forage_id}
                    onChange={handleForageSelect}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 focus:ring-2 outline-none appearance-none bg-white cursor-pointer"
                    style={{ '--tw-ring-color': gingerVert }}
                    required
                  >
                    <option value="" disabled>-- Sélectionnez un forage dans la base --</option>
                    {loadingForages ? (
                      <option disabled>Chargement des forages en cours...</option>
                    ) : foragesDisponibles.length === 0 ? (
                      <option disabled>Aucun forage trouvé. Créez-en un d'abord !</option>
                    ) : (
                      foragesDisponibles.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.forage_nom || f.nom || f.forage || "Forage inconnu"} (ID: {f.id.substring(0,8)}...)
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Choix du Format (UI Cards) */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Format d'exportation souhaité</label>
                <div className="grid grid-cols-2 gap-4">
                  <label className={`border-2 rounded-xl p-5 flex flex-col items-center gap-3 cursor-pointer transition-all ${formData.format === 'pdf' ? 'border-red-500 bg-red-50 ring-2 ring-red-200 shadow-sm' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <input type="radio" name="format" value="pdf" checked={formData.format === 'pdf'} onChange={handleChange} className="hidden" />
                    <FileType size={32} className={formData.format === 'pdf' ? 'text-red-600' : 'text-slate-400'} />
                    <div className="text-center">
                      <span className={`block font-bold ${formData.format === 'pdf' ? 'text-red-700' : 'text-slate-600'}`}>Fichier PDF</span>
                      <span className="text-xs text-slate-500">Document final non modifiable</span>
                    </div>
                  </label>
                  
                  <label className={`border-2 rounded-xl p-5 flex flex-col items-center gap-3 cursor-pointer transition-all ${formData.format === 'docx' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200 shadow-sm' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <input type="radio" name="format" value="docx" checked={formData.format === 'docx'} onChange={handleChange} className="hidden" />
                    <FileType size={32} className={formData.format === 'docx' ? 'text-blue-600' : 'text-slate-400'} />
                    <div className="text-center">
                      <span className={`block font-bold ${formData.format === 'docx' ? 'text-blue-700' : 'text-slate-600'}`}>Fichier Word</span>
                      <span className="text-xs text-slate-500">Idéal pour éditions manuelles (.docx)</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Chemin Réseau */}
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
                  <FolderGit2 size={18} /> Emplacement sur le serveur (Optionnel)
                </label>
                <p className="text-xs text-slate-500 mb-3">Indiquez le chemin réseau où le fichier final doit être conservé (ex: S:\Projets\ClientX).</p>
                
                <input
                  type="text"
                  name="chemin_pdf"
                  value={formData.chemin_pdf}
                  onChange={handleChange}
                  placeholder="C:\Users\nom\Desktop\Livrables"
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 outline-none font-mono text-sm bg-white"
                  style={{ '--tw-ring-color': gingerVert }}
                />
              </div>

              {/* Messages d'erreur */}
              {error && (
                <div className="bg-red-50 text-red-600 text-sm p-4 rounded-lg flex gap-3 items-start border border-red-100">
                  <AlertCircle size={20} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Bouton de Soumission */}
              <button
                type="submit"
                disabled={loading || !formData.forage_id}
                className="w-full text-white font-bold py-4 px-4 rounded-xl flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                style={{ backgroundColor: gingerVert }}
              >
                {loading ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}
                GÉNÉRER ET ENREGISTRER
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
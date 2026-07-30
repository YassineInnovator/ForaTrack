import React, { useState, useEffect } from 'react';
import { ArrowLeft, Download, Database, CheckCircle2, Clock, FileText, MapPin } from 'lucide-react';

const gingerBleu = "#1D365A";

export default function ReportDetailsPage({ reportId, token, onNavigate }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`http://127.0.0.1:8072/rapports/${reportId}`, { headers: { 'Authorization': `Bearer ${token}` }})
      .then(r => r.json())
      .then(setReport)
      .catch(() => setError("Impossible de charger les détails du rapport."));
  }, [reportId, token]);

  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!report) return <div className="p-8 text-slate-500">Chargement des données du rapport...</div>;

  // Calcul des données pour l'affichage propre
  const numRapport = report.id.substring(0, 8).toUpperCase();
  const typeFichier = report.chemin_pdf?.toLowerCase().endsWith('pdf') ? 'Fichier PDF' : 'Document Word';
  const extension = report.chemin_pdf?.toLowerCase().endsWith('pdf') ? '.pdf' : '.docx';

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* Navigation */}
        <button onClick={() => onNavigate('DASHBOARD')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 font-medium mb-6 transition-colors">
          <ArrowLeft size={16} /> Retour aux rapports
        </button>

        {/* En-tête de la page */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold flex items-center gap-4 mb-2" style={{ color: gingerBleu }}>
              Rapport #{numRapport}
              <span className={`text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1 tracking-wide ${report.date_validation ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                {report.date_validation ? <><CheckCircle2 size={14}/> Validé</> : <><Clock size={14}/> En attente</>}
              </span>
            </h1>
            <p className="text-slate-500">Détail du rapport généré pour les forages spécifiés.</p>
          </div>
          
          <button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-xl font-bold shadow-md transition-all">
            <Download size={18} /> Télécharger le Fichier
          </button>
        </div>

        {/* Carte des informations */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          
          {/* Section Forages */}
          <div className="p-8 border-b border-slate-100">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4" style={{ color: gingerBleu }}>
              <MapPin size={20} className="text-blue-500" /> Forages analysés dans ce document
            </h3>
            {report.forages && report.forages.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {report.forages.map(f => (
                  <span key={f.id} className="bg-blue-50 text-blue-700 border border-blue-200 font-bold px-4 py-2 rounded-lg">
                    {f.forage || 'Forage sans nom'}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-slate-500">Aucun forage n'a été rattaché à ce rapport (Ancienne donnée).</p>
            )}
          </div>

          {/* Section Métadonnées */}
          <div className="p-8 bg-slate-50/50">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-6" style={{ color: gingerBleu }}>
              <Database size={20} className="text-green-500" /> Informations d'exportation
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
              
              {/* Ligne 1 */}
              <div>
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Type de document</span>
                <div className="flex items-center gap-2 font-semibold text-slate-800">
                  <FileText size={16} className="text-slate-400"/> {typeFichier} <span className="text-slate-400 font-normal">({extension})</span>
                </div>
              </div>
              
              <div>
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Statut du rapport</span>
                <span className="font-semibold text-slate-800">{report.date_validation ? 'Définitif (Validé)' : 'Brouillon / À relire'}</span>
              </div>

              {/* Ligne 2 */}
              <div>
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Validé par</span>
                <span className="font-semibold text-slate-800">{report.date_validation ? 'Administrateur Système' : '-'}</span>
              </div>

              <div>
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Date de validation</span>
                <span className="font-semibold text-slate-800">
                  {report.date_validation ? new Date(report.date_validation).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                </span>
              </div>

              {/* Ligne 3 (Pleine largeur) */}
              <div className="md:col-span-2 mt-2">
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Emplacement réseau du fichier</span>
                <div className="bg-white border border-slate-200 rounded-lg p-3 font-mono text-sm text-slate-600 break-all select-all">
                  {report.chemin_pdf || "Aucun chemin d'enregistrement spécifié."}
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { Database, Clock, CheckCircle, Download, FileText, ChevronRight, FolderGit2 } from 'lucide-react';

const gingerBleu = "#1D365A";
const gingerVert = "#8DC63F";

export default function ReportDetailsPage({ reportId, token, onNavigate }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReportDetails = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:8047/rapports/${reportId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setReport(data);
        }
      } catch (error) {
        console.error("Erreur lors du chargement du rapport", error);
      } finally {
        setLoading(false);
      }
    };
    
    if (reportId) fetchReportDetails();
  }, [reportId, token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-500"></div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 text-center">
        <p>Rapport introuvable.</p>
        <button onClick={() => onNavigate('DASHBOARD')} className="text-blue-600 mt-4 underline">Retour</button>
      </div>
    );
  }

  const isValide = report.date_validation != null;

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <button onClick={() => onNavigate('DASHBOARD')} className="text-sm text-slate-500 hover:text-slate-800 mb-6 flex items-center gap-1">
           &larr; Retour aux rapports
        </button>

        {}
        <header className="mb-8 border-b border-slate-200 pb-6 flex justify-between items-end">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold" style={{ color: gingerBleu }}>Rapport : {report.forage}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${isValide ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                {isValide ? <CheckCircle size={14} /> : <Clock size={14} />}
                {isValide ? 'Validé' : 'Généré'}
              </span>
            </div>
            <p className="text-slate-500">Détail du rapport généré pour ce forage spécifique.</p>
          </div>
          <button className="flex items-center gap-2 text-sm text-white px-5 py-2.5 rounded-lg font-bold shadow-sm hover:opacity-90 transition-opacity" style={{ backgroundColor: gingerBleu }}>
            <Download size={18} /> Télécharger le Fichier
          </button>
        </header>

        {}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
           <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-3" style={{ color: gingerBleu }}>
                <Database size={24} style={{ color: gingerVert }} /> Informations d'exportation
              </h2>
           </div>
           
           <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 flex items-start gap-4">
              <div className="p-3 bg-white border border-slate-200 rounded-lg text-slate-400">
                 <FolderGit2 size={32} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-800">Emplacement réseau du fichier</h3>
                {report.chemin_pdf ? (
                  <p className="text-sm font-mono bg-white border border-slate-200 p-2 rounded mt-2 text-slate-600 break-all">
                    {report.chemin_pdf}
                  </p>
                ) : (
                  <p className="text-sm text-slate-500 mt-1 italic">Aucun chemin réseau spécifié lors de la création.</p>
                )}
              </div>
           </div>

           <div className="mt-8 border-t border-slate-100 pt-8">
              <h3 className="text-lg font-semibold mb-4 text-slate-800">Identifiants Système</h3>
              <ul className="text-sm text-slate-500 space-y-2 font-mono">
                <li><strong>ID Rapport :</strong> {report.id}</li>
                <li><strong>ID Forage lié :</strong> {report.forage_id}</li>
              </ul>
           </div>
        </div>
      </div>
    </div>
  );
}
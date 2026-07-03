import React, { useState } from 'react';
import { 
  Database, FolderOpen, Clock, FileWarning, CheckCircle, FileText, ChevronRight, FileType, FilePlus 
} from 'lucide-react';

// --- IMPORTS DES VRAIES PAGES (depuis le dossier src/pages) ---
import LoginPage from './pages/LoginPage';
import CreateReportPage from './pages/CreateReportPage';
import ReportDetailsPage from './pages/ReportDetailsPage';

// ============================================================================
// 🎨 CHARTE GRAPHIQUE & COMPOSANTS PARTAGÉS
// ============================================================================
const gingerBleu = "#1D365A";
const gingerVert = "#8DC63F";

const GingerLogo = () => (
  <div className="flex flex-col">
    <div className="flex items-center text-4xl font-extrabold tracking-tight">
      <span style={{ color: gingerBleu }}>GING</span>
      <span style={{ color: gingerVert }}>E</span>
      <span style={{ color: gingerBleu }}>R</span>
    </div>
    <span style={{ color: gingerBleu }} className="text-sm font-bold tracking-widest uppercase mt-[-4px]">
      CEBTP
    </span>
  </div>
);

// ============================================================================
// 📊 PAGE 2 : DASHBOARD (Sera séparée dans un fichier plus tard)
// ============================================================================
function DashboardPage({ token, onLogout, onNavigate }) {
  // On remplace "mockReports" par un vrai State React
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dès que la page se charge, on va chercher les rapports dans la base de données
  React.useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8046/rapports/', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setReports(data);
        }
      } catch (err) {
        console.error("Erreur de connexion au serveur", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [token]);

  const getStatus = (report) => {
    if (report.date_validation) return { label: 'Validé', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle };
    return { label: 'Généré', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Clock };
  };

  // Petite fonction pour déduire si c'est du PDF ou du WORD selon le chemin saisi
  const getFormat = (chemin) => {
    if (!chemin) return 'PDF';
    return chemin.toLowerCase().endsWith('.docx') ? 'WORD' : 'PDF';
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="mb-10 flex flex-col md:flex-row md:justify-between md:items-end gap-4 border-b border-slate-200 pb-6">
          <div>
            <GingerLogo />
            <p className="text-slate-500 mt-3 font-medium">Tableau de Bord - Rapports & Campagnes</p>
          </div>
          <div className="flex gap-3">
            <button onClick={onLogout} className="text-sm text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 px-5 py-2.5 rounded-full transition-colors font-medium shadow-sm">
              Déconnexion
            </button>
            <button onClick={() => onNavigate('CREATE_REPORT')} className="flex items-center gap-2 text-sm text-white px-5 py-2.5 rounded-full shadow-sm hover:shadow-md transition-all" style={{ backgroundColor: gingerVert }}>
              <FilePlus size={18} /> Nouveau Rapport
            </button>
          </div>
        </header>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-3" style={{ color: gingerBleu }}>
            <FolderOpen size={24} style={{ color: gingerVert }} /> Dossiers de Rapports
          </h2>

          {loading ? (
            <div className="text-center py-10 text-slate-500 flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500 mb-4"></div>
              Chargement de vos rapports...
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
              <p className="text-slate-500 font-medium">Aucun rapport n'a encore été généré.</p>
              <p className="text-sm text-slate-400 mt-1">Cliquez sur "Nouveau Rapport" pour commencer.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {reports.map((report) => {
                const status = getStatus(report);
                const StatusIcon = status.icon;
                return (
                  <div 
                    key={report.id} 
                    onClick={() => onNavigate('REPORT_DETAILS', report.id)}
                    className="border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all bg-white group cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    style={{ borderLeftWidth: '5px', borderLeftColor: report.date_validation ? '#22c55e' : gingerVert }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-slate-50 text-slate-400 group-hover:text-white transition-colors" style={{ backgroundColor: '#f8fafc' }}>
                        <FileText size={24} className="group-hover:text-blue-600 transition-colors" />
                      </div>
                      <div>
                        {/* Affiche le vrai nom du forage stocké en base */}
                        <h3 className="font-bold text-lg" style={{ color: gingerBleu }}>
                          Rapport : {report.forage || "Forage inconnu"}
                        </h3>
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1 ${status.color}`}>
                            <StatusIcon size={12} /> {status.label}
                          </span>
                          
                          {/* Affiche le nom du fichier s'il a été renseigné */}
                          {report.chemin_pdf && (
                            <span className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-1 rounded truncate max-w-[200px]" title={report.chemin_pdf}>
                              {report.chemin_pdf.split('\\').pop().split('/').pop()}
                            </span>
                          )}
                          
                          <span className="text-xs text-slate-500 uppercase flex items-center gap-1">
                             <FileType size={12}/> {getFormat(report.chemin_pdf)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={24} className="text-slate-300 group-hover:text-blue-600 transition-colors" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 🚀 LE CHEF D'ORCHESTRE (Le Routeur Principal)
// ============================================================================
export default function App() {
  const [token, setToken] = useState(null);
  const [currentView, setCurrentView] = useState('DASHBOARD'); 
  const [selectedReportId, setSelectedReportId] = useState(null);

  const handleLoginSuccess = (newToken) => {
    setToken(newToken);
    setCurrentView('DASHBOARD');
  };

  const handleNavigation = (view, reportId = null) => {
    setCurrentView(view);
    if (reportId) setSelectedReportId(reportId);
  };

  // 1. Si pas de token, on affiche la page de connexion importée !
  if (!token) return <LoginPage onLoginSuccess={handleLoginSuccess} />;

  // 2. Le système de navigation ("Routeur")
  switch (currentView) {
    case 'CREATE_REPORT':
      // On affiche la page de création importée (et on lui passe le token pour l'API)
      return <CreateReportPage token={token} onNavigate={handleNavigation} />;
    case 'REPORT_DETAILS':
      return <ReportDetailsPage reportId={selectedReportId} token={token} onNavigate={handleNavigation} />;
    case 'DASHBOARD':
    default:
      return <DashboardPage token={token} onLogout={() => setToken(null)} onNavigate={handleNavigation} />;
  }
}
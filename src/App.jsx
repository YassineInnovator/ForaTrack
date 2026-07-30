import React, { useState, useEffect } from 'react';
import { 
  FileText, Loader2, ChevronRight, Plus, 
  Map, TestTube2, LayoutDashboard, LogOut, FileSpreadsheet, Droplets
} from 'lucide-react';

import LoginPage from './pages/LoginPage';
import CreateReportPage from './pages/CreateReportPage';
import ReportDetailsPage from './pages/ReportDetailsPage';
import FieldWizardPage from './pages/FieldWizardPage';
import SampleEntryPage from './pages/SampleEntryPage';
import FicheTeneurEau from './pages/FicheTeneurEau'; // Ton nouvel import

const gingerBleu = "#1D365A";
const gingerVert = "#8DC63F";

const GingerLogo = ({ onClick }) => (
  <div className="flex flex-col cursor-pointer hover:opacity-80 transition-opacity" onClick={onClick}>
    <div className="flex items-center text-3xl font-extrabold tracking-tight">
      <span style={{ color: gingerBleu }}>GING</span>
      <span style={{ color: gingerVert }}>E</span>
      <span style={{ color: gingerBleu }}>R</span>
    </div>
    <span style={{ color: gingerBleu }} className="text-xs font-bold tracking-widest uppercase mt-[-4px]">
      CEBTP
    </span>
  </div>
);

export default function App() {
  const [token, setToken] = useState(null);
  const [currentView, setCurrentView] = useState('DASHBOARD');
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleNavigation = (view, reportId = null) => {
    if (reportId) setSelectedReportId(reportId);
    setCurrentView(view);
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentView('DASHBOARD');
  };

  useEffect(() => {
    // On ne recharge les rapports que si on est sur le Dashboard
    if (!token || currentView !== 'DASHBOARD') return;
    
    setLoading(true);
    fetch('http://127.0.0.1:8072/rapports/', { headers: { 'Authorization': `Bearer ${token}` }})
      .then(r => {
        if (!r.ok) throw new Error("Erreur serveur");
        return r.json();
      })
      .then(data => setReports(Array.isArray(data) ? data : []))
      .catch(err => console.error("Erreur de fetch:", err))
      .finally(() => setLoading(false));
  }, [token, currentView]);

  if (!token) return <LoginPage onLoginSuccess={setToken} />;

  const DashboardView = () => (
    <div className="max-w-6xl mx-auto p-6 md:p-8 animate-in fade-in duration-300">
      
      {/* SECTION : ACTIONS RAPIDES */}
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2" style={{ color: gingerBleu }}>
        <LayoutDashboard size={24} className="text-blue-500" /> Actions Rapides
      </h2>
      
      {/* NOUVEAUTÉ : On passe en grid-cols-4 sur grand écran pour faire de la place */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        
        {/* Carte : Saisie Terrain */}
        <div onClick={() => handleNavigation('FIELD_WIZARD')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all group">
          <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-orange-600 group-hover:text-white transition-colors">
            <Map size={28} />
          </div>
          <h3 className="font-bold text-lg text-slate-800 mb-1">Saisie Terrain</h3>
          <p className="text-sm text-slate-500">Assistant pour les relevés de forages, génératrices et structures.</p>
        </div>

        {/* Carte : Saisie Échantillons */}
        <div onClick={() => handleNavigation('SAMPLES')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all group">
          <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-600 group-hover:text-white transition-colors">
            <TestTube2 size={28} />
          </div>
          <h3 className="font-bold text-lg text-slate-800 mb-1">Échantillons</h3>
          <p className="text-sm text-slate-500">Saisie déportée et inventaire des échantillons (Fiche FT06b).</p>
        </div>

        {/* NOUVELLE CARTE : Teneur en Eau (FT32) */}
        <div onClick={() => handleNavigation('TENEUR_EAU')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all group">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <Droplets size={28} />
          </div>
          <h3 className="font-bold text-lg text-slate-800 mb-1">Teneur en Eau</h3>
          <p className="text-sm text-slate-500">Calcul automatique des Hp(%) et gestion de la fiche FT32.</p>
        </div>

        {/* Carte : Générer Rapport */}
        <div onClick={() => handleNavigation('CREATE_REPORT')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all group flex flex-col">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-colors relative" style={{ backgroundColor: '#f0fdf4', color: gingerVert }}>
            <FileSpreadsheet size={28} className="group-hover:text-white z-10" />
            <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: gingerVert }}></div>
          </div>
          <h3 className="font-bold text-lg text-slate-800 mb-1">Générer Livrable</h3>
          <p className="text-sm text-slate-500">Créer un rapport d'inspection (PDF/Word).</p>
        </div>

      </div>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: gingerBleu }}>
          <FileText size={24} className="text-blue-500" /> Historique des Livrables
        </h2>
      </div>
      
      <div className="grid gap-4">
        {loading ? (
          <div className="flex justify-center p-10"><Loader2 className="animate-spin text-slate-400" size={32} /></div>
        ) : reports.length === 0 ? (
          <div className="bg-white p-10 text-center rounded-2xl border border-dashed border-slate-300 text-slate-500">
            <p className="text-lg font-semibold mb-2">Aucun livrable généré pour le moment.</p>
            <p className="text-sm">Utilisez le bouton "Générer un Livrable" pour créer votre premier rapport !</p>
          </div>
        ) : (
          reports.map((report) => (
            <div key={report.id} onClick={() => handleNavigation('REPORT_DETAILS', report.id)} className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer hover:border-blue-400 hover:shadow-md transition-all group gap-4">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-slate-50 rounded-xl group-hover:bg-blue-50 transition-colors shrink-0">
                  <FileText className="text-slate-400 group-hover:text-blue-600 transition-colors" size={28} />
                </div>
                <div>
                  <div className="font-extrabold text-xl mb-1 tracking-wide" style={{ color: gingerBleu }}>
                    Rapport #{report.id.substring(0, 8).toUpperCase()}
                  </div>
                  <div className="text-sm text-slate-500 font-medium mb-2">
                    Forages liés : <span className="text-slate-700">{report.forage || 'Aucun'}</span>
                  </div>
                  <span className={`text-xs px-3 py-1 font-bold rounded-full ${report.date_validation ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                    {report.date_validation ? 'Validé (Définitif)' : 'Brouillon / En attente'}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-end sm:justify-center">
                 <button className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0">
                   Voir détails <ChevronRight size={16} />
                 </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
      
      {/* NAVBAR FIXE */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm px-6 py-3 flex justify-between items-center">
        <GingerLogo onClick={() => handleNavigation('DASHBOARD')} />
        
        <div className="flex items-center gap-4">
           {currentView !== 'DASHBOARD' && (
             <button onClick={() => handleNavigation('DASHBOARD')} className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
               Tableau de Bord
             </button>
           )}
           <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 flex items-center gap-2 font-medium text-sm transition-colors px-3 py-2 rounded-lg hover:bg-red-50">
             <LogOut size={18} /> <span className="hidden sm:inline">Déconnexion</span>
           </button>
        </div>
      </nav>

      {/* CONTENU PRINCIPAL DYNAMIQUE */}
      <main className="flex-1">
        {(() => {
          switch (currentView) {
            case 'DASHBOARD': return <DashboardView />;
            case 'REPORT_DETAILS': return <ReportDetailsPage reportId={selectedReportId} token={token} onNavigate={handleNavigation} />;
            case 'CREATE_REPORT': return <CreateReportPage token={token} onNavigate={handleNavigation} />;
            case 'FIELD_WIZARD': return <FieldWizardPage token={token} onNavigate={handleNavigation} />;
            case 'SAMPLES': return <SampleEntryPage token={token} onNavigate={handleNavigation} />;
            case 'TENEUR_EAU': return <FicheTeneurEau token={token} onNavigate={handleNavigation}/>;
            default: return <DashboardView />;
          }
        })()}
      </main>

    </div>
  );
}
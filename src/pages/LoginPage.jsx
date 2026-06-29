import React, { useState } from 'react';
import { Loader2, AlertCircle, Key, User } from 'lucide-react';

// Couleurs de la charte graphique Ginger
const gingerBleu = "#1D365A";
const gingerVert = "#8DC63F";

// Composant Logo intégré à la page (on pourra le séparer plus tard si besoin)
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

export default function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Préparation des données au format attendu par le OAuth2 de FastAPI
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      // Appel au backend (N'oublie pas de mettre 127.0.0.1 si localhost pose problème)
      const response = await fetch('http://127.0.0.1:8000/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Identifiants incorrects ou serveur injoignable.");
      }

      const data = await response.json();
      
      // On fait remonter le token reçu au chef d'orchestre (App.jsx)
      onLoginSuccess(data.access_token);

    } catch (err) {
      setError(err.message || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 font-sans text-slate-800">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-10 max-w-md w-full">
        <div className="flex justify-center mb-8">
          <GingerLogo />
        </div>
        
        <h1 className="text-xl font-semibold text-center mb-2" style={{ color: gingerBleu }}>Portail Géotechnique</h1>
        <p className="text-slate-500 text-center mb-8 text-sm">
          Veuillez vous connecter pour accéder à la base de données.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email / Identifiant</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User size={18} className="text-slate-400" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="nom@groupeginger.com"
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 focus:ring-2 outline-none transition-all"
                style={{ '--tw-ring-color': gingerVert, '--tw-border-color': gingerVert }}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mot de passe</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Key size={18} className="text-slate-400" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 focus:ring-2 outline-none transition-all"
                style={{ '--tw-ring-color': gingerVert, '--tw-border-color': gingerVert }}
                required
              />
            </div>
          </div>
          
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex gap-2 items-start">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full text-white font-bold py-3 px-4 rounded-full flex items-center justify-center gap-2 transition-all hover:shadow-lg disabled:opacity-50 mt-4"
            style={{ backgroundColor: gingerBleu }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : 'SE CONNECTER'}
          </button>
        </form>
      </div>
    </div>
  );
}
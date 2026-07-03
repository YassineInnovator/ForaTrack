import React, { useState } from 'react';
// On importe la page qu'on vient de créer !
import LoginPage from './pages/LoginPage'; 
// import DashboardPage from './pages/DashboardPage'; (On décommentera ça à l'étape suivante)

export default function App() {
  // L'état qui permet de savoir si on est connecté ou non
  const [token, setToken] = useState(null);

  // Cette fonction est passée à la LoginPage. 
  // Quand le login réussit, LoginPage l'appelle avec le nouveau token.
  const handleLoginSuccess = (newToken) => {
    setToken(newToken);
  };

  // Le "Routeur" : on choisit quoi afficher
  if (!token) {
    // 1. Pas de token = on affiche l'écran de connexion
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // 2. On a un token = on affiche la suite (le dashboard)
  // (Pour l'instant, c'est juste un message temporaire pour vérifier que ça marche)
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold text-green-600 mb-4">🎉 Connexion réussie !</h1>
      <p className="text-slate-600">Ton token commence par : <span className="font-mono bg-slate-200 px-2 py-1 rounded">{token.substring(0, 15)}...</span></p>
      <p className="mt-4 text-slate-400 italic">Le vrai Dashboard arrive à la prochaine étape...</p>
    </div>
  );
}
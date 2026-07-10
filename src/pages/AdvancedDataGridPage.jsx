import React, { useState } from 'react';
import { Save, Plus, ArrowLeft } from 'lucide-react';

// Couleurs exactes du fichier Excel pour les cellules
const colors = {
  extension: '#e02828', // Rouge
  cisaillement: '#75d624', // Vert
  mixte: '#2d6ff0', // Bleu
  indeterminee: '#f0e42d', // Jaune
  oxydation: '#c29027' // Marron
};

// Fonction pour générer une ligne vide avec un ID unique
const createEmptyRow = () => ({
  id: crypto.randomUUID(),
  cote: '',
  gen_num: '',
  gen_orientee: '',
  
  // Structures (booléens pour les croix 'x')
  plumoses_fines: false,
  plumoses_gross: false,
  stries_fines: false,
  stries: false,
  strie_patine: false,
  mixte: false,
  indeterminee: false,
  
  remarques: '',
  
  // Oxydation
  gypse: false,
  bioturbations: false,
  patine: false,
  
  // Mesures brutes
  mb_dir: '', mb_pen: '', mb_pitch: '', mb_jeu: '',
  
  // Mesures débasculées
  md_dir: '', md_pen: '', md_pitch: '', md_jeu: ''
});

// Le composant magique pour le texte vertical (sans carambolage)
const VertHeader = ({ children, rowSpan, colSpan, className }) => (
  <th
    rowSpan={rowSpan}
    colSpan={colSpan}
    className={`border border-slate-300 align-bottom px-2 py-3 ${className || ''}`}
  >
    <div className="flex justify-center items-end min-h-[140px]">
      <span
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        className="text-[11px] leading-tight text-center tracking-wide font-semibold"
      >
        {children}
      </span>
    </div>
  </th>
);

// Composant utilitaire pour les cellules cliquables (X)
const CheckCell = ({ checked, colorClass, onToggle }) => (
  <td 
    className={`border border-slate-300 text-center font-bold cursor-pointer transition-colors hover:opacity-80 w-10 h-10 ${checked ? colorClass : 'bg-white'}`}
    onClick={onToggle}
  >
    {checked ? 'x' : ''}
  </td>
);

// Composant utilitaire pour les champs textes
const InputCell = ({ value, width = 'w-16', onUpdate }) => (
  <td className="border border-slate-300 p-0">
    <input
      type="text"
      value={value}
      onChange={(e) => onUpdate(e.target.value)}
      className={`w-full h-10 px-2 outline-none text-center bg-transparent focus:bg-blue-50 focus:ring-inset focus:ring-2 focus:ring-blue-500 ${width} text-xs`}
    />
  </td>
);

export default function AdvancedDataGridPage({ onNavigate }) {
  // 1. INITIALISATION AVEC 5 LIGNES VIDES
  const [rows, setRows] = useState(() => {
    return Array(5).fill(null).map(() => createEmptyRow());
  });

  // 2. FONCTION POUR AJOUTER UNE LIGNE
  const handleAddRow = () => {
    setRows([...rows, createEmptyRow()]);
  };

  // 3. FONCTION POUR METTRE À JOUR UNE CELLULE
  const updateRow = (id, field, value) => {
    setRows(rows.map(row => 
      row.id === id ? { ...row, [field]: value } : row
    ));
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 font-sans text-slate-800 flex flex-col">
      
      {/* En-tête de page */}
      <header className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Saisie Avancée (Tableur)</h1>
          <p className="text-sm text-slate-500">Forage horizontal (-0,61°) et d'azimut N064,45°E</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => onNavigate && onNavigate('DASHBOARD')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors border border-slate-300"
          >
            <ArrowLeft size={18} /> Quitter
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm">
            <Save size={18} /> Enregistrer
          </button>
        </div>
      </header>

      {/* Conteneur du Tableur avec scroll */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto flex-1">
        <table className="w-full text-sm border-collapse min-w-[1200px]">
          
          <thead>
            {/* Ligne 1 : Les grands groupes */}
            <tr className="bg-slate-200 text-slate-700 text-xs font-bold border-b border-slate-300">
              <th colSpan="3" className="border border-slate-300 py-2 uppercase tracking-wide">Génératrice</th>
              <th colSpan="8" className="border border-slate-300 py-2 uppercase tracking-wide">Structures</th>
              <th className="border border-slate-300 bg-slate-100"></th> {/* Colonne Remarques vide en haut */}
              <th colSpan="3" className="border border-slate-300 py-2 uppercase tracking-wide">Oxydation</th>
              <th colSpan="4" className="border border-slate-300 py-2 uppercase tracking-wide">Mesure brute</th>
              <th colSpan="4" className="border border-slate-300 py-2 uppercase tracking-wide">Mesure débasculée Cas 1</th>
            </tr>
            
            {/* Ligne 2 : Les sous-groupes et les textes verticaux */}
            <tr className="bg-slate-100 text-slate-600 text-[11px] font-semibold text-center uppercase tracking-wider">
              <th rowSpan="2" className="border border-slate-300 px-3 py-2 whitespace-nowrap">Cotes (m)</th>
              <th rowSpan="2" className="border border-slate-300 px-3 py-2">N°</th>
              <VertHeader rowSpan="2" className="bg-slate-50 text-slate-600">Orientée</VertHeader>
              
              <th colSpan="2" className="border border-slate-300 bg-red-100 text-red-800 py-2">Extension</th>
              <th colSpan="3" className="border border-slate-300 bg-green-100 text-green-800 py-2">Cisaillement</th>
              
              <VertHeader rowSpan="2" className="bg-blue-100 text-blue-800">Mixte</VertHeader>
              <VertHeader rowSpan="2" className="bg-yellow-100 text-yellow-900">Indéterminée</VertHeader>
              
              <th rowSpan="2" className="border border-slate-300 px-3 py-2 whitespace-nowrap">Remarques</th>
              
              <VertHeader rowSpan="2" className="bg-orange-100 text-orange-900">Gypse</VertHeader>
              <VertHeader rowSpan="2" className="bg-orange-100 text-orange-900">Bioturbations oxydées</VertHeader>
              <VertHeader rowSpan="2" className="bg-orange-100 text-orange-900">Patine d'oxydation</VertHeader>
              
              <VertHeader rowSpan="2" className="bg-slate-50">Direction</VertHeader>
              <VertHeader rowSpan="2" className="bg-slate-50">Pendage</VertHeader>
              <VertHeader rowSpan="2" className="bg-slate-50">Pitch</VertHeader>
              <VertHeader rowSpan="2" className="bg-slate-50">Jeu</VertHeader>
              
              <VertHeader rowSpan="2" className="bg-slate-50">Direction</VertHeader>
              <VertHeader rowSpan="2" className="bg-slate-50">Pendage</VertHeader>
              <VertHeader rowSpan="2" className="bg-slate-50">Pitch</VertHeader>
              <VertHeader rowSpan="2" className="bg-slate-50">Jeu</VertHeader>
            </tr>
            
            {/* Ligne 3 : Les options de structures (Verticales) */}
            <tr className="bg-slate-50 text-[11px] font-semibold text-center uppercase tracking-wider">
              <VertHeader className="bg-red-50 text-red-800 w-10">Plumoses fines</VertHeader>
              <VertHeader className="bg-red-50 text-red-800 w-10">Plumoses grossières</VertHeader>
              
              <VertHeader className="bg-green-50 text-green-800 w-10">Stries fines (-)</VertHeader>
              <VertHeader className="bg-green-50 text-green-800 w-10">Stries (+)</VertHeader>
              <VertHeader className="bg-green-50 text-green-800 w-10">Strié patiné (++)</VertHeader>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-blue-50/50 transition-colors">
                {/* Génératrice */}
                <InputCell value={row.cote} width="w-24" onUpdate={(val) => updateRow(row.id, 'cote', val)} />
                <InputCell value={row.gen_num} width="w-12" onUpdate={(val) => updateRow(row.id, 'gen_num', val)} />
                <InputCell value={row.gen_orientee} width="w-12" onUpdate={(val) => updateRow(row.id, 'gen_orientee', val)} />
                
                {/* Structures */}
                <CheckCell checked={row.plumoses_fines} colorClass="bg-red-500 text-white" onToggle={() => updateRow(row.id, 'plumoses_fines', !row.plumoses_fines)} />
                <CheckCell checked={row.plumoses_gross} colorClass="bg-red-600 text-white" onToggle={() => updateRow(row.id, 'plumoses_gross', !row.plumoses_gross)} />
                
                <CheckCell checked={row.stries_fines} colorClass="bg-green-400 text-slate-800" onToggle={() => updateRow(row.id, 'stries_fines', !row.stries_fines)} />
                <CheckCell checked={row.stries} colorClass="bg-green-500 text-white" onToggle={() => updateRow(row.id, 'stries', !row.stries)} />
                <CheckCell checked={row.strie_patine} colorClass="bg-green-600 text-white" onToggle={() => updateRow(row.id, 'strie_patine', !row.strie_patine)} />
                
                <CheckCell checked={row.mixte} colorClass="bg-blue-500 text-white" onToggle={() => updateRow(row.id, 'mixte', !row.mixte)} />
                <CheckCell checked={row.indeterminee} colorClass="bg-yellow-400 text-slate-800" onToggle={() => updateRow(row.id, 'indeterminee', !row.indeterminee)} />
                
                {/* Remarques */}
                <InputCell value={row.remarques} width="w-32" onUpdate={(val) => updateRow(row.id, 'remarques', val)} />
                
                {/* Oxydation */}
                <CheckCell checked={row.gypse} colorClass="bg-amber-600 text-white" onToggle={() => updateRow(row.id, 'gypse', !row.gypse)} />
                <CheckCell checked={row.bioturbations} colorClass="bg-amber-600 text-white" onToggle={() => updateRow(row.id, 'bioturbations', !row.bioturbations)} />
                <CheckCell checked={row.patine} colorClass="bg-amber-600 text-white" onToggle={() => updateRow(row.id, 'patine', !row.patine)} />
                
                {/* Mesures Brutes */}
                <InputCell value={row.mb_dir} width="w-12" onUpdate={(val) => updateRow(row.id, 'mb_dir', val)} />
                <InputCell value={row.mb_pen} width="w-12" onUpdate={(val) => updateRow(row.id, 'mb_pen', val)} />
                <InputCell value={row.mb_pitch} width="w-12" onUpdate={(val) => updateRow(row.id, 'mb_pitch', val)} />
                <InputCell value={row.mb_jeu} width="w-12" onUpdate={(val) => updateRow(row.id, 'mb_jeu', val)} />
                
                {/* Mesures Débasculées */}
                <InputCell value={row.md_dir} width="w-12" onUpdate={(val) => updateRow(row.id, 'md_dir', val)} />
                <InputCell value={row.md_pen} width="w-12" onUpdate={(val) => updateRow(row.id, 'md_pen', val)} />
                <InputCell value={row.md_pitch} width="w-12" onUpdate={(val) => updateRow(row.id, 'md_pitch', val)} />
                <InputCell value={row.md_jeu} width="w-12" onUpdate={(val) => updateRow(row.id, 'md_jeu', val)} />
              </tr>
            ))}
          </tbody>
        </table>

        {/* Bouton Ajouter Ligne */}
        <div className="p-4 bg-slate-50 border-t border-slate-200">
          <button 
            onClick={handleAddRow}
            className="flex items-center gap-2 text-sm text-blue-700 bg-blue-100 hover:bg-blue-200 px-4 py-2 rounded-lg font-bold transition-colors"
          >
            <Plus size={16} /> Ajouter une ligne
          </button>
        </div>
      </div>
    </div>
  );
}
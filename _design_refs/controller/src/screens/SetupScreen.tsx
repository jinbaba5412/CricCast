import React, { useState } from 'react';
import { ChevronDown, ArrowRight, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SetupScreen() {
  const navigate = useNavigate();
  const [team1, setTeam1] = useState('Eagles');
  const [team2, setTeam2] = useState('Hawks');
  const [toss, setToss] = useState('Eagles');
  const [opt, setOpt] = useState('Bat');
  const [overs, setOvers] = useState(20);

  return (
    <div className="flex flex-col h-screen bg-bg">
      <div className="bg-surface px-4 py-4 flex items-center gap-3 border-b border-surface-raised sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="text-text-muted hover:text-white p-1 -ml-1">
          <ArrowLeft size={24} />
        </button>
        <h1 className="font-display text-2xl tracking-wide pt-1">Match Setup</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        
        {/* Teams Section */}
        <section className="space-y-4">
          <h2 className="text-text-muted text-sm font-semibold uppercase tracking-wider">Teams</h2>
          <div className="flex flex-col gap-3">
            <div className="relative">
              <select value={team1} onChange={(e) => setTeam1(e.target.value)} className="w-full bg-surface-raised border border-surface-raised rounded-xl p-4 appearance-none text-lg outline-none focus:border-primary/50 transition-colors">
                <option value="Eagles">Eagles</option>
                <option value="Tigers">Tigers</option>
                <option value="Bears">Bears</option>
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={20} />
            </div>
            <div className="text-center text-text-muted font-display text-lg">VS</div>
            <div className="relative">
              <select value={team2} onChange={(e) => setTeam2(e.target.value)} className="w-full bg-surface-raised border border-surface-raised rounded-xl p-4 appearance-none text-lg outline-none focus:border-primary/50 transition-colors">
                <option value="Hawks">Hawks</option>
                <option value="Lions">Lions</option>
                <option value="Wolves">Wolves</option>
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={20} />
            </div>
          </div>
        </section>

        {/* Toss Section */}
        <section className="space-y-4">
          <h2 className="text-text-muted text-sm font-semibold uppercase tracking-wider">Toss Details</h2>
          
          <div className="space-y-3">
            <label className="block text-sm text-text-muted">Toss won by</label>
            <div className="flex gap-2">
              <button 
                onClick={() => setToss(team1)} 
                className={`flex-1 py-3 rounded-lg font-medium border transition-all ${toss === team1 ? 'bg-primary/20 border-primary/50 text-white' : 'bg-surface border-surface-raised text-text-muted'}`}
              >
                {team1}
              </button>
              <button 
                onClick={() => setToss(team2)} 
                className={`flex-1 py-3 rounded-lg font-medium border transition-all ${toss === team2 ? 'bg-primary/20 border-primary/50 text-white' : 'bg-surface border-surface-raised text-text-muted'}`}
              >
                {team2}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm text-text-muted">Elected to</label>
            <div className="flex gap-2">
              <button 
                onClick={() => setOpt('Bat')} 
                className={`flex-1 py-3 rounded-lg font-medium border transition-all ${opt === 'Bat' ? 'bg-amber-500/20 border-amber-500/50 text-amber-500' : 'bg-surface border-surface-raised text-text-muted'}`}
              >
                Bat
              </button>
              <button 
                onClick={() => setOpt('Bowl')} 
                className={`flex-1 py-3 rounded-lg font-medium border transition-all ${opt === 'Bowl' ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-500' : 'bg-surface border-surface-raised text-text-muted'}`}
              >
                Bowl
              </button>
            </div>
          </div>
        </section>

        {/* Match Settings */}
        <section className="space-y-4">
          <h2 className="text-text-muted text-sm font-semibold uppercase tracking-wider">Settings</h2>
          <div className="bg-surface-raised rounded-xl p-4 flex justify-between items-center">
            <span className="font-medium">Overs per innings</span>
            <div className="flex items-center gap-4">
              <button onClick={() => setOvers(Math.max(1, overs - 1))} className="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-text-muted hover:text-white">-</button>
              <span className="font-display text-2xl w-8 text-center">{overs}</span>
              <button onClick={() => setOvers(overs + 1)} className="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-text-muted hover:text-white">+</button>
            </div>
          </div>
        </section>

      </div>

      <div className="p-4 border-t border-surface-raised bg-surface shrink-0 pb-safe">
        <button onClick={() => navigate('/live')} className="w-full bg-primary text-bg font-bold tracking-wide py-4 rounded-xl flex items-center justify-center gap-2 uppercase active:scale-95 transition-transform shadow-lg shadow-primary/20">
          Start Match <ArrowRight size={20} />
        </button>
      </div>

      <style>{`
        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 16px); }
      `}</style>
    </div>
  );
}

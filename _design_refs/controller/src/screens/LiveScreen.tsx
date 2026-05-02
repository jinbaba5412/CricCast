import React, { useState } from 'react';
import { Settings, MoreVertical, Undo2, Ban, ChevronDown, Check, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const currentMatch = {
  team1: 'Eagles',
  team2: 'Hawks',
  tossWinner: 'Eagles',
  optedTo: 'bat',
  score: 145,
  wickets: 4,
  overs: 18.2,
  target: null,
  crr: 7.9,
  striker: { name: 'K. Patel', runs: 42, balls: 28, fours: 4, sixes: 1 },
  nonStriker: { name: 'J. Smith', runs: 12, balls: 15, fours: 1, sixes: 0 },
  bowler: { name: 'R. Sharma', overs: 3.2, maidens: 0, runs: 24, wickets: 1 },
  timeline: [
    { ball: '17.1', outcome: '1' },
    { ball: '17.2', outcome: '0' },
    { ball: '17.3', outcome: '4', type: 'boundary' },
    { ball: '17.4', outcome: '1' },
    { ball: '17.5', outcome: 'W', type: 'wicket' },
    { ball: '17.6', outcome: '1' },
  ],
};

export default function LiveScreen() {
  const navigate = useNavigate();
  const [activeDismissal, setActiveDismissal] = useState(false);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [multiMatchOpen, setMultiMatchOpen] = useState(false);
  const [batsmanMenuOpen, setBatsmanMenuOpen] = useState<'striker' | 'nonStriker' | null>(null);
  const [bowlerMenuOpen, setBowlerMenuOpen] = useState(false);
  
  const [isNoBall, setIsNoBall] = useState(false);
  const [isFreeHit, setIsFreeHit] = useState(false);

  // Ergonomic hit trigger pattern from brief
  const hapticFeedback = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  const handleScore = (runs) => {
    hapticFeedback();
    // Action logic placeholder
  };

  return (
    <div className="flex flex-col h-screen bg-bg relative overflow-hidden">
      {/* Broadcast Preview (Locked) */}
      <div className="h-12 bg-black flex items-center justify-center text-xs text-text-muted font-mono tracking-widest shrink-0">
        [ BROADCAST PREVIEW ]
      </div>

      {/* Match Status Strip */}
      <div className="bg-surface px-4 py-3 flex items-center justify-between border-b border-surface-raised shrink-0 relative z-20">
        <div>
          <button onClick={() => setMultiMatchOpen(true)} className="flex items-center gap-1 text-sm text-text-muted font-medium mb-0.5 hover:text-white group outline-none">
            <span>Eagles vs Hawks</span>
            <ChevronDown size={14} className="opacity-50 group-hover:opacity-100" />
          </button>
          <div className="flex items-baseline gap-2 tabular-nums">
            <span className="text-3xl font-display leading-none">{currentMatch.score}-{currentMatch.wickets}</span>
            <span className="text-text-muted">({currentMatch.overs})</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-text-muted mb-0.5 tabular-nums">CRR: {currentMatch.crr}</div>
          <button onClick={() => setOptionsMenuOpen(true)} className="text-primary text-sm font-medium flex items-center gap-1 opacity-80 hover:opacity-100 ml-auto outline-none">
            Options <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* Main Play Area */}
      <div className="flex-1 overflow-y-auto pb-4 flex flex-col gap-2 p-3">
        {/* Batsmen Cards */}
        <div className="grid grid-cols-2 gap-2">
          {/* Striker */}
          <div onClick={() => setBatsmanMenuOpen('striker')} className="bg-indigo-950/40 border-l-2 border-indigo-500 rounded p-3 relative cursor-pointer active:scale-[0.98] transition-transform">
            <div className="flex justify-between items-start mb-2">
              <span className="font-semibold text-white flex items-center gap-1">
                {currentMatch.striker.name} <span className="w-1.5 h-1.5 rounded-full bg-white opacity-40"></span>
              </span>
              <MoreVertical size={16} className="text-text-muted" />
            </div>
            <div className="flex items-end gap-2 tabular-nums">
              <span className="text-2xl font-display">{currentMatch.striker.runs}</span>
              <span className="text-sm text-text-muted pb-0.5">({currentMatch.striker.balls})</span>
            </div>
          </div>
          {/* Non-Striker */}
          <div onClick={() => setBatsmanMenuOpen('nonStriker')} className="bg-surface-raised/50 border-l-2 border-transparent rounded p-3 relative cursor-pointer active:scale-[0.98] transition-transform">
            <div className="flex justify-between items-start mb-2">
              <span className="text-text-muted font-medium">
                {currentMatch.nonStriker.name}
              </span>
              <MoreVertical size={16} className="text-text-muted" />
            </div>
            <div className="flex items-end gap-2 tabular-nums">
              <span className="text-lg font-display text-text-muted">{currentMatch.nonStriker.runs}</span>
              <span className="text-xs text-text-muted pb-0.5">({currentMatch.nonStriker.balls})</span>
            </div>
          </div>
        </div>

        {/* Bowler Card */}
        <div onClick={() => setBowlerMenuOpen(true)} className="bg-emerald-950/20 border-l-2 border-emerald-500 rounded p-3 cursor-pointer mt-1 active:scale-[0.98] transition-transform">
          <div className="flex justify-between items-start mb-2">
            <span className="text-emerald-400 font-medium text-sm flex items-center gap-1">
              BOWLER <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
            </span>
            <MoreVertical size={16} className="text-emerald-500/50" />
          </div>
          <div className="flex justify-between items-end">
            <span className="font-semibold">{currentMatch.bowler.name}</span>
            <div className="tabular-nums text-sm font-mono text-emerald-100/70">
              {currentMatch.bowler.overs}-{currentMatch.bowler.maidens}-{currentMatch.bowler.runs}-{currentMatch.bowler.wickets}
            </div>
          </div>
        </div>

        {/* Over Timeline */}
        <div className="bg-surface rounded p-3 mt-1 flex flex-col gap-2">
          <div className="text-xs text-text-muted font-medium uppercase tracking-wider">This Over</div>
          <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
            {currentMatch.timeline.map((ball, i) => (
              <div 
                key={i} 
                className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-display text-lg
                  ${ball.type === 'boundary' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 
                    ball.type === 'wicket' ? 'bg-coral-500/20 text-coral-400 border border-coral-500/30' : 
                    'bg-surface-raised text-white/80'}`
                }
              >
                {ball.outcome}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scoring Action Grid - Most Important! fixed at bottom */}
      <div className="bg-surface border-t border-surface-raised p-3 shrink-0 flex flex-col gap-3 pb-safe">
        {/* Runs Row */}
        <div className="flex gap-2">
          <button onClick={() => handleScore('0')} className="flex-1 bg-surface-raised text-white text-3xl font-display py-4 rounded-xl active:bg-white/10 active:scale-95 transition-all outline-none">0</button>
          <button onClick={() => handleScore('1')} className="flex-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-3xl font-display py-4 rounded-xl active:bg-emerald-500/20 active:scale-95 transition-all outline-none">1</button>
          <button onClick={() => handleScore('2')} className="flex-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-3xl font-display py-4 rounded-xl active:bg-emerald-500/20 active:scale-95 transition-all outline-none">2</button>
          <button onClick={() => handleScore('3')} className="flex-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-3xl font-display py-4 rounded-xl active:bg-emerald-500/20 active:scale-95 transition-all outline-none">3</button>
          <button onClick={() => handleScore('4')} className="flex-1 bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 text-3xl font-display py-4 rounded-xl active:bg-cyan-600/30 active:scale-95 transition-all outline-none">4</button>
          <button onClick={() => handleScore('6')} className="flex-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-3xl font-display py-4 rounded-xl active:bg-amber-500/30 active:scale-95 transition-all outline-none">6</button>
        </div>
        
        {/* Modifiers Row */}
        <div className="flex gap-2">
          <button 
            onClick={() => { setIsNoBall(!isNoBall); if(!isNoBall) setIsFreeHit(true); }}
            className={`flex-1 border font-medium text-sm py-3 rounded active:scale-95 transition-all outline-none ${
              isNoBall ? 'bg-coral text-white border-coral' : 'bg-surface-raised border-coral/40 text-coral-300 hover:bg-surface-raised/80'
            }`}
          >
            No Ball
          </button>
          <button className="flex-1 bg-surface-raised hover:bg-surface-raised/80 font-medium text-sm py-3 rounded active:scale-95 transition-all outline-none">
            Wide
          </button>
          <button className="flex-1 bg-surface-raised hover:bg-surface-raised/80 font-medium text-sm py-3 rounded active:scale-95 transition-all outline-none">
            Bye
          </button>
          <button className="flex-1 bg-surface-raised hover:bg-surface-raised/80 font-medium text-sm py-3 rounded active:scale-95 transition-all outline-none">
            Leg Bye
          </button>
        </div>

        {/* Free Hit indicator/toggle */}
        {isFreeHit && (
           <button onClick={() => setIsFreeHit(false)} className="w-full bg-amber-500/20 text-amber-500 border border-amber-500 font-bold uppercase tracking-widest text-sm py-2 rounded-xl animate-pulse">
             Free Hit Active
           </button>
        )}

        {/* Critical Row */}
        <div className="flex gap-2 pt-1 border-t border-surface-raised/50">
          <button onClick={() => setActiveDismissal(true)} className={`${currentMatch.timeline.length >= 6 ? 'hidden' : 'flex-2'} bg-coral text-white font-bold tracking-wide py-4 rounded-lg active:bg-coral-600 active:scale-95 transition-all shadow-lg shadow-coral-500/20 outline-none uppercase text-lg`}>
            Wicket
          </button>
          {currentMatch.timeline.length >= 6 && (
            <button className="flex-2 bg-primary text-bg font-bold tracking-wide py-4 rounded-lg active:bg-primary-hover active:scale-95 transition-all shadow-lg shadow-primary/20 outline-none uppercase text-lg">
              End Over
            </button>
          )}
          <button className="flex-1 bg-transparent text-text-muted border border-surface-raised flex items-center justify-center gap-2 font-medium py-4 rounded-lg active:bg-surface-raised active:scale-95 transition-all outline-none">
            <Undo2 size={18} />
            <span className="hidden sm:inline">Undo</span>
          </button>
        </div>
      </div>

      <style>{`
        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 12px); }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .flex-2 { flex: 2; }
      `}</style>

      {/* Modals */}
      {activeDismissal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col justify-end" onClick={(e) => { if (e.target === e.currentTarget) setActiveDismissal(false) }}>
          <div className="bg-surface rounded-t-3xl p-5 transform transition-transform animate-in slide-in-from-bottom border-t border-surface-raised">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-display tracking-wide text-coral-400">Select Dismissal</h3>
              <button onClick={() => setActiveDismissal(false)} className="text-text-muted p-2 active:bg-surface-raised rounded-full">
                <Ban size={20} />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-6">
              {['Bowled', 'Caught', 'LBW', 'Run Out', 'Stumped', 'Hit Wicket'].map(type => (
                <button key={type} className="bg-surface-raised py-4 rounded-xl font-medium active:bg-surface-raised/80 active:scale-95 border border-transparent focus:border-coral/30">
                  {type}
                </button>
              ))}
            </div>
            <button className="w-full py-4 font-medium text-text-muted hover:text-white pb-safe">
              Other Dismissals...
            </button>
          </div>
        </div>
      )}

      {/* Options Menu Modal */}
      {optionsMenuOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col justify-end" onClick={(e) => { if (e.target === e.currentTarget) setOptionsMenuOpen(false) }}>
          <div className="bg-surface rounded-t-3xl p-5 transform transition-transform animate-in slide-in-from-bottom border-t border-surface-raised">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-display tracking-wide">Match Options</h3>
              <button onClick={() => setOptionsMenuOpen(false)} className="text-text-muted p-2 active:bg-surface-raised rounded-full">
                <Ban size={20} />
              </button>
            </div>
            
            <div className="flex flex-col gap-2 pb-safe">
              <button onClick={() => { setOptionsMenuOpen(false); navigate('/teams'); }} className="bg-surface-raised py-4 px-4 rounded-xl font-medium flex justify-between items-center active:bg-surface-raised/80 active:scale-95 transition-all text-left">
                <span>Playing XI Setup</span>
                <Settings size={18} className="text-text-muted" />
              </button>
              <button className="bg-surface-raised py-4 px-4 rounded-xl font-medium flex justify-between items-center active:bg-surface-raised/80 active:scale-95 transition-all text-left">
                <span>Revised Target (DLS)</span>
                <Settings size={18} className="text-text-muted" />
              </button>
              <button className="bg-coral-950/30 text-coral-400 py-4 px-4 rounded-xl font-medium flex justify-between items-center active:bg-coral-950/50 active:scale-95 transition-all text-left mt-2 border border-coral-500/20">
                <span>Abandon Match</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Match Command Palette Modal */}
      {multiMatchOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col pt-12 px-4" onClick={(e) => { if (e.target === e.currentTarget) setMultiMatchOpen(false) }}>
          <div className="bg-surface rounded-2xl p-2 transform transition-transform animate-in slide-in-from-top-4 border border-surface-raised shadow-2xl flex flex-col">
            <div className="p-3 border-b border-surface-raised flex justify-between items-center">
               <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">Switch Match</h3>
               <button onClick={() => setMultiMatchOpen(false)} className="text-text-muted p-1 active:bg-surface-raised rounded-full">
                <Ban size={16} />
              </button>
            </div>
            <div className="flex flex-col py-2">
              <button className="flex items-center justify-between p-3 rounded-lg bg-primary/10 text-primary">
                <div className="text-left">
                  <div className="font-medium">Eagles vs Hawks</div>
                  <div className="text-xs opacity-80 font-mono mt-0.5">Live • 18.2 Ov</div>
                </div>
                <Check size={18} />
              </button>
              <button className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-raised text-white text-left transition-colors">
                <div>
                  <div className="font-medium">Tigers vs Lions</div>
                  <div className="text-xs text-text-muted font-mono mt-0.5">Upcoming • 10:00 AM</div>
                </div>
              </button>
              <div className="h-px bg-surface-raised my-2 mx-3"></div>
              <button onClick={() => { setMultiMatchOpen(false); navigate('/records'); }} className="flex items-center gap-2 p-3 text-sm text-text-muted hover:text-white transition-colors">
                <span>View All Matches</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batsman Menu Modal */}
      {batsmanMenuOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col justify-end" onClick={(e) => { if (e.target === e.currentTarget) setBatsmanMenuOpen(null) }}>
          <div className="bg-surface rounded-t-3xl p-5 transform transition-transform animate-in slide-in-from-bottom border-t border-surface-raised">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-display tracking-wide">
                {batsmanMenuOpen === 'striker' ? currentMatch.striker.name : currentMatch.nonStriker.name}
              </h3>
              <button onClick={() => setBatsmanMenuOpen(null)} className="text-text-muted p-2 active:bg-surface-raised rounded-full">
                <Ban size={20} />
              </button>
            </div>
            
            <div className="flex flex-col gap-2 pb-safe">
              <button className="bg-surface-raised py-4 px-4 rounded-xl font-medium flex justify-between items-center active:bg-surface-raised/80 active:scale-95 transition-all text-left">
                <span>Retire Batter</span>
              </button>
              <button className="bg-surface-raised py-4 px-4 rounded-xl font-medium flex justify-between items-center active:bg-surface-raised/80 active:scale-95 transition-all text-left">
                <span>Swap Strike</span>
              </button>
              <button className="bg-surface-raised py-4 px-4 rounded-xl font-medium flex justify-between items-center active:bg-surface-raised/80 active:scale-95 transition-all text-left">
                <span>Replace Batter (Injury)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bowler Menu Modal */}
      {bowlerMenuOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col justify-end" onClick={(e) => { if (e.target === e.currentTarget) setBowlerMenuOpen(false) }}>
          <div className="bg-surface rounded-t-3xl p-5 transform transition-transform animate-in slide-in-from-bottom border-t border-surface-raised">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-display tracking-wide">{currentMatch.bowler.name}</h3>
              <button onClick={() => setBowlerMenuOpen(false)} className="text-text-muted p-2 active:bg-surface-raised rounded-full">
                <Ban size={20} />
              </button>
            </div>
            
            <div className="flex flex-col gap-2 pb-safe">
              <button className="bg-surface-raised py-4 px-4 rounded-xl font-medium flex justify-between items-center active:bg-surface-raised/80 active:scale-95 transition-all text-left">
                <span>Change Bowler</span>
              </button>
              <button className="bg-surface-raised py-4 px-4 rounded-xl font-medium flex justify-between items-center active:bg-surface-raised/80 active:scale-95 transition-all text-left">
                <span>View Spell Details</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TEAM_EAGLES = [
  { id: 1, name: 'K. Patel', role: 'Captain, Batter' },
  { id: 2, name: 'J. Smith', role: 'Wicketkeeper' },
  { id: 3, name: 'A. Gupta', role: 'Batter' },
  { id: 4, name: 'S. Mitchell', role: 'All-rounder' },
  { id: 5, name: 'P. Kumar', role: 'All-rounder' },
  { id: 6, name: 'D. Warner', role: 'Batter' },
  { id: 7, name: 'M. Ali', role: 'Bowler' },
  { id: 8, name: 'R. Sharma', role: 'Bowler' },
  { id: 9, name: 'J. Hazlewood', role: 'Bowler' },
  { id: 10, name: 'T. Boult', role: 'Bowler' },
  { id: 11, name: 'A. Zampa', role: 'Bowler' },
];

export default function TeamsScreen() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-screen bg-bg">
      <div className="bg-surface px-4 py-4 flex items-center gap-3 border-b border-surface-raised sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="text-text-muted hover:text-white p-1 -ml-1">
          <ArrowLeft size={24} />
        </button>
        <h1 className="font-display text-2xl tracking-wide pt-1">Playing XI</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        
        <div className="flex border-b border-surface-raised mb-4">
          <button className="flex-1 py-3 text-center border-b-2 border-primary text-white font-medium">Eagles</button>
          <button className="flex-1 py-3 text-center border-b-2 border-transparent text-text-muted font-medium hover:text-white">Hawks</button>
        </div>

        <ul className="space-y-2 pb-safe">
          {TEAM_EAGLES.map((player, index) => (
            <li key={player.id} className="flex items-center gap-4 bg-surface-raised/50 p-3 rounded-lg border border-transparent">
              <span className="text-text-muted font-mono text-sm w-6 text-center">{index + 1}</span>
              <div className="flex-1">
                <div className="font-medium text-white">{player.name}</div>
                <div className="text-xs text-text-muted">{player.role}</div>
              </div>
            </li>
          ))}
        </ul>

      </div>

      <style>{`
        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 16px); }
      `}</style>
    </div>
  );
}

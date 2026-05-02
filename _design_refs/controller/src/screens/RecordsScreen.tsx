import React from 'react';
import { ChevronRight, Filter, Settings, Search, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const MOCK_MATCHES = [
  { id: 1, title: 'Eagles vs Hawks', status: 'live', date: 'Today, 14:00', venue: 'North Oval' },
  { id: 2, title: 'Tigers vs Lions', status: 'upcoming', date: 'Tomorrow, 10:00', venue: 'South Ground' },
  { id: 3, title: 'Bears vs Wolves', status: 'completed', date: 'Yesterday', venue: 'East Pitch', result: 'Bears won by 4 wickets' },
];

export default function RecordsScreen() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col h-screen bg-bg">
      <div className="bg-surface px-4 py-4 flex items-center justify-between border-b border-surface-raised sticky top-0 z-10">
        <h1 className="font-display text-2xl tracking-wide">Matches</h1>
        <div className="flex gap-3">
          <button className="text-text-muted hover:text-white"><Search size={20} /></button>
          <button onClick={() => navigate('/setup')} className="text-primary hover:text-primary-hover"><Plus size={24} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {MOCK_MATCHES.map((match) => (
          <Link key={match.id} to={`/live`} className="bg-surface-raised rounded-xl p-4 flex flex-col gap-2 relative active:scale-[0.98] transition-all">
            <div className="flex justify-between items-start">
              <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                match.status === 'live' ? 'bg-coral-500/20 text-coral-400' :
                match.status === 'upcoming' ? 'bg-amber-500/20 text-amber-400' :
                'bg-surface text-text-muted'
              }`}>
                {match.status}
              </span>
              <span className="text-xs text-text-muted font-mono">{match.date}</span>
            </div>
            <h3 className="text-lg font-medium text-white">{match.title}</h3>
            {match.result ? (
              <p className="text-sm text-text-muted">{match.result}</p>
            ) : (
              <p className="text-sm text-text-muted">{match.venue}</p>
            )}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted/50">
              <ChevronRight size={20} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

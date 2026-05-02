import { Moon, Shield, Radio, Activity, Users, Settings, History, X, Search, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Scoring() {
  return (
    <div className="bg-background text-on-background font-body-md text-body-md h-screen w-screen overflow-hidden flex flex-col antialiased selection:bg-primary/30">
      <div className="relative w-full h-full max-w-md mx-auto flex flex-col bg-surface border-x border-outline-variant/30 shadow-2xl">
        <header className="flex-none flex items-center justify-between px-md py-sm bg-surface-container-high border-b border-outline-variant/50 z-20">
          <div className="flex items-center gap-sm">
            <Radio className="w-5 h-5 text-primary" />
            <h1 className="font-h3 text-h3 text-primary tracking-widest uppercase mt-xs">CricCast</h1>
          </div>
          <div className="flex items-center gap-md">
            <div className="flex items-center gap-xs px-sm py-xs bg-secondary/10 rounded-full border border-secondary/20">
              <div className="w-2 h-2 rounded-full bg-secondary animate-pulse"></div>
              <span className="font-body-sm text-body-sm text-secondary uppercase tracking-wide">Local Mode</span>
            </div>
            <button className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-highest transition-colors border border-outline-variant/50">
              <Moon className="w-5 h-5 text-on-surface-variant" />
            </button>
          </div>
        </header>

        <div className="flex-none px-md py-sm bg-surface border-b border-outline-variant/30 relative z-10">
          <button className="w-full flex items-center justify-between bg-surface-container px-md py-sm rounded-lg border border-outline-variant/50 hover:border-primary/50 transition-colors">
            <div className="flex flex-col items-start">
              <span className="font-body-sm text-body-sm text-on-surface-variant uppercase tracking-wider">Current Match</span>
              <span className="font-body-lg text-body-lg text-on-surface">Eagles vs. Thunder • 1st Innings</span>
            </div>
            <ChevronDown className="w-5 h-5 text-on-surface-variant" />
          </button>
        </div>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-md space-y-md pb-[100px]">
          <div className="bg-surface-container-low border border-outline-variant/50 rounded-xl p-md border-l-[3px] border-l-primary shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
            <div className="flex justify-between items-start relative z-10">
              <div className="flex flex-col">
                <span className="font-body-sm text-body-sm text-on-surface-variant uppercase tracking-wider mb-1">Eagles Batting</span>
                <div className="flex items-baseline gap-xs">
                  <span className="font-h1 text-h1 text-on-surface">142</span>
                  <span className="font-h3 text-h3 text-on-surface-variant">/</span>
                  <span className="font-h2 text-h2 text-error">4</span>
                </div>
                <span className="font-body-sm text-body-sm text-on-surface-variant mt-1">CRR: 7.82</span>
              </div>
              <div className="flex flex-col items-end text-right">
                <span className="font-body-sm text-body-sm text-on-surface-variant uppercase tracking-wider mb-1">Overs</span>
                <span className="font-stat-lg text-stat-lg text-on-surface">18.2</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant mt-1">(20.0)</span>
              </div>
            </div>
            <div className="mt-md pt-sm border-t border-outline-variant/30 flex items-center gap-xs">
              <span className="font-body-sm text-body-sm text-on-surface-variant mr-2">This Over:</span>
              <div className="w-8 h-8 rounded bg-surface-container-highest flex items-center justify-center font-stat-md text-stat-md text-on-surface">1</div>
              <div className="w-8 h-8 rounded bg-surface-container-highest flex items-center justify-center font-stat-md text-stat-md text-on-surface">0</div>
              <div className="w-8 h-8 rounded border border-outline-variant border-dashed flex items-center justify-center text-on-surface-variant">-</div>
              <div className="w-8 h-8 rounded border border-outline-variant border-dashed flex items-center justify-center text-on-surface-variant">-</div>
              <div className="w-8 h-8 rounded border border-outline-variant border-dashed flex items-center justify-center text-on-surface-variant">-</div>
              <div className="w-8 h-8 rounded border border-outline-variant border-dashed flex items-center justify-center text-on-surface-variant">-</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-md">
            <div className="bg-surface-container border border-outline-variant/30 rounded-lg p-sm border-l-[3px] border-l-secondary flex flex-col gap-xs">
              <div className="flex justify-between items-center">
                <span className="font-body-sm text-body-sm text-secondary uppercase">Striker</span>
                <Activity className="w-4 h-4 text-secondary" />
              </div>
              <div className="flex justify-between items-baseline">
                <span className="font-body-lg text-body-lg text-on-surface truncate pr-2">S. Sharma</span>
                <span className="font-stat-md text-stat-md text-on-surface">45<span className="text-[12px] text-on-surface-variant ml-1">(31)</span></span>
              </div>
              <div className="w-full h-px bg-outline-variant/30 my-1"></div>
              <div className="flex justify-between items-baseline opacity-60">
                <span className="font-body-sm text-body-sm text-on-surface-variant truncate pr-2">R. Patel</span>
                <span className="font-stat-md text-[14px] text-on-surface">12<span className="text-[10px] ml-1">(8)</span></span>
              </div>
            </div>
            <div className="bg-surface-container border border-outline-variant/30 rounded-lg p-sm border-l-[3px] border-l-tertiary flex flex-col gap-xs">
              <div className="flex justify-between items-center">
                <span className="font-body-sm text-body-sm text-tertiary uppercase">Bowler</span>
                <Activity className="w-4 h-4 text-tertiary" />
              </div>
              <div className="flex justify-between items-baseline">
                <span className="font-body-lg text-body-lg text-on-surface truncate pr-2">A. Khan</span>
                <span className="font-stat-md text-stat-md text-on-surface">2-24</span>
              </div>
              <span className="font-body-sm text-body-sm text-on-surface-variant mt-auto">Overs: 3.2</span>
            </div>
          </div>

          <div className="bg-surface-container border border-outline-variant/50 rounded-xl p-md flex flex-col gap-md">
            <div className="grid grid-cols-4 gap-sm">
              <button className="h-16 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/50 rounded-lg flex flex-col items-center justify-center active:scale-95 transition-transform">
                <span className="font-stat-lg text-stat-lg text-on-surface">0</span>
                <span className="font-body-sm text-[10px] text-on-surface-variant uppercase">Dot</span>
              </button>
              <button className="h-16 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg flex items-center justify-center active:scale-95 transition-transform text-primary">
                <span className="font-stat-lg text-stat-lg">1</span>
              </button>
              <button className="h-16 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg flex items-center justify-center active:scale-95 transition-transform text-primary">
                <span className="font-stat-lg text-stat-lg">2</span>
              </button>
              <button className="h-16 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg flex items-center justify-center active:scale-95 transition-transform text-primary">
                <span className="font-stat-lg text-stat-lg">3</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-sm">
              <button className="h-20 bg-primary hover:bg-primary-fixed border border-primary rounded-lg flex items-center justify-center shadow-lg active:scale-95 transition-all">
                <span className="font-stat-lg text-[40px] text-on-primary">4</span>
              </button>
              <button className="h-20 bg-primary hover:bg-primary-fixed border border-primary rounded-lg flex items-center justify-center shadow-lg active:scale-95 transition-all">
                <span className="font-stat-lg text-[40px] text-on-primary">6</span>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-sm mt-sm border-t border-outline-variant/30 pt-md">
              <button className="h-14 bg-error-container/20 hover:bg-error-container/40 border border-error/50 rounded-lg flex items-center justify-center gap-xs active:scale-95 transition-transform">
                <span className="font-body-md text-body-md font-semibold text-error uppercase tracking-wide">Wicket</span>
              </button>
              <button className="h-14 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/50 rounded-lg flex items-center justify-center gap-xs active:scale-95 transition-transform text-on-surface">
                <span className="font-body-md text-body-md font-medium uppercase tracking-wide">Extra</span>
              </button>
              <button className="h-14 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/50 rounded-lg flex items-center justify-center gap-xs active:scale-95 transition-transform text-on-surface">
                <span className="font-body-md text-body-md font-medium uppercase tracking-wide">Swap</span>
              </button>
            </div>
          </div>
        </main>

        <nav className="absolute bottom-0 left-0 w-full bg-surface-container-high border-t border-outline-variant/30 z-30 pb-safe">
          <div className="flex justify-around items-center h-16">
            <Link to="/dashboard" className="flex flex-col items-center justify-center w-full h-full text-on-surface-variant hover:text-on-surface transition-colors">
              <Users className="mb-1 w-5 h-5" />
              <span className="font-body-sm text-[10px] uppercase tracking-widest">Teams</span>
            </Link>
            <button className="flex flex-col items-center justify-center w-full h-full text-on-surface-variant hover:text-on-surface transition-colors">
              <Settings className="mb-1 w-5 h-5" />
              <span className="font-body-sm text-[10px] uppercase tracking-widest">Setup</span>
            </button>
            <button className="flex flex-col items-center justify-center w-full h-full text-primary relative">
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-full"></div>
              <Activity className="mb-1 w-5 h-5" />
              <span className="font-body-sm text-[10px] uppercase tracking-widest font-bold">Live</span>
            </button>
            <button className="flex flex-col items-center justify-center w-full h-full text-on-surface-variant hover:text-on-surface transition-colors">
              <History className="mb-1 w-5 h-5" />
              <span className="font-body-sm text-[10px] uppercase tracking-widest">Records</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}

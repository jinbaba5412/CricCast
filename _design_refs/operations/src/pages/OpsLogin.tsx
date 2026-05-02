import { Link } from 'react-router-dom';
import { Badge, Lock, Eye, Gauge, Router, UserCog, LogIn } from 'lucide-react';

export default function OpsLogin() {
  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col antialiased">
      <div className="h-1 w-full bg-[#f59e0b]"></div>
      <main className="flex-1 flex w-full">
        <div className="w-full lg:w-1/2 flex items-center justify-center p-margin lg:p-xl relative z-10 bg-surface">
          <div className="w-full max-w-[420px] bg-surface-container rounded-lg p-lg border border-surface-container-highest relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#f59e0b]"></div>
            <div className="mb-lg">
              <h1 className="font-h1 text-h1 text-[#f59e0b] mb-xs uppercase">CricCast</h1>
              <p className="font-body-sm text-body-sm text-outline uppercase tracking-widest">Operations Console</p>
            </div>
            <div className="mb-lg">
              <h2 className="font-h3 text-h3 text-on-surface mb-xs">Secure Access</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">Authorized personnel only. Please verify your credentials.</p>
            </div>
            <form className="space-y-md">
              <div>
                <label className="block font-body-sm text-body-sm text-on-surface-variant mb-xs" htmlFor="admin-id">Operator ID</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-sm text-outline">
                    <Badge className="w-5 h-5" />
                  </span>
                  <input className="w-full bg-surface-container-highest border border-outline-variant rounded py-sm pl-[36px] pr-sm font-body-md text-body-md text-on-surface placeholder-outline focus:outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b] transition-colors" id="admin-id" placeholder="Enter Operator ID" type="text" />
                </div>
              </div>
              <div>
                <label className="block font-body-sm text-body-sm text-on-surface-variant mb-xs" htmlFor="admin-pass">Passcode</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-sm text-outline">
                    <Lock className="w-5 h-5" />
                  </span>
                  <input className="w-full bg-surface-container-highest border border-outline-variant rounded py-sm pl-[36px] pr-sm font-body-md text-body-md text-on-surface placeholder-outline focus:outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b] transition-colors" id="admin-pass" placeholder="••••••••" type="password" />
                  <button className="absolute inset-y-0 right-0 flex items-center pr-sm text-outline hover:text-on-surface transition-colors" type="button">
                    <Eye className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input className="rounded border-outline-variant bg-surface-container-highest text-[#f59e0b] focus:ring-[#f59e0b]" type="checkbox" />
                  <span className="font-body-sm text-body-sm text-on-surface-variant">Remember terminal</span>
                </label>
                <a className="font-body-sm text-body-sm text-[#f59e0b] hover:underline" href="#">Reset Passcode</a>
              </div>
              <Link to="/admin" className="w-full bg-[#f59e0b] text-[#0B0F14] font-body-lg text-body-lg font-semibold py-sm rounded flex items-center justify-center gap-2 hover:bg-[#d97706] transition-colors mt-lg">
                <LogIn className="w-5 h-5" />
                Initialize Session
              </Link>
            </form>
            <div className="mt-lg pt-lg border-t border-surface-container-highest text-center">
              <p className="font-body-sm text-body-sm text-outline">System Status: <span className="text-primary">Online</span> • Server: AP-SOUTH-1</p>
            </div>
          </div>
        </div>
        <div className="hidden lg:flex w-1/2 bg-surface-container-lowest relative items-center justify-center overflow-hidden border-l border-surface-container-highest">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
          <div className="relative z-10 w-full max-w-[500px] p-xl flex flex-col gap-lg">
            <div className="bg-surface-container border border-surface-container-highest rounded-lg p-md flex items-center gap-md opacity-80">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Gauge className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-stat-md text-stat-md text-on-surface">99.9% Uptime</h4>
                <p className="font-body-sm text-body-sm text-outline">All systems operational</p>
              </div>
            </div>
            <div className="bg-surface-container border border-surface-container-highest rounded-lg p-md flex items-center gap-md ml-xl opacity-60">
              <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                <Router className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-stat-md text-stat-md text-on-surface">Live Feeds Active</h4>
                <p className="font-body-sm text-body-sm text-outline">Routing 14 concurrent streams</p>
              </div>
            </div>
            <div className="bg-surface-container border border-[#f59e0b]/30 rounded-lg p-md flex items-center gap-md opacity-100">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#f59e0b] rounded-l-lg"></div>
              <div className="w-10 h-10 rounded-full bg-[#f59e0b]/10 flex items-center justify-center text-[#f59e0b]">
                <UserCog className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-stat-md text-stat-md text-on-surface">Ops Authentication Required</h4>
                <p className="font-body-sm text-body-sm text-outline">Awaiting operator sign-in</p>
              </div>
            </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-80 pointer-events-none"></div>
        </div>
      </main>
    </div>
  );
}

import { Activity, LayoutDashboard, Shield, Users, UserCog, Settings, HelpCircle, Database, AlertTriangle, LineChart, Search, Filter, MoreVertical, Moon, Bell, Command, BarChart2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Admin() {
  return (
    <div className="bg-background text-on-background font-body-md min-h-screen">
      <header className="bg-[#0B0F14]/80 backdrop-blur-md dark:bg-slate-950/80 fixed top-0 right-0 w-full lg:w-[calc(100%-240px)] z-40 border-b border-[#1A2230] dark:border-slate-800 flex justify-between items-center h-16 px-6">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-emerald-500 tracking-widest uppercase font-h2">CricCast</span>
        </div>
        <div className="flex items-center gap-gutter">
          <div className="flex gap-gutter">
            <Link className="text-slate-400 hover:text-emerald-400 font-body-md" to="/dashboard">Live</Link>
            <a className="text-slate-400 hover:text-emerald-400 font-body-md" href="#">Stats</a>
            <a className="text-emerald-500 border-b-2 border-emerald-500 pb-1 font-body-md" href="#">Admin</a>
          </div>
          <div className="flex gap-sm">
            <button className="text-slate-400 hover:bg-emerald-500/5 transition-colors p-sm rounded active:opacity-80">
              <Moon className="w-5 h-5" />
            </button>
            <button className="text-slate-400 hover:bg-emerald-500/5 transition-colors p-sm rounded active:opacity-80">
              <Bell className="w-5 h-5" />
            </button>
            <button className="text-slate-400 hover:bg-emerald-500/5 transition-colors p-sm rounded active:opacity-80">
              <Command className="w-5 h-5" />
            </button>
          </div>
          <Link to="/scoring" className="bg-primary-container text-on-primary-container px-md py-sm rounded font-body-sm hover:opacity-90">Go Live</Link>
          <img alt="User Profile" className="w-8 h-8 rounded-full border border-outline" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBryjjsOcLWBD6JONKXiUVNYrabeLkZQK2D-MWYB0F7IWHhtpisgPaRRdOeEa7_6yHW8R-ZYzgpq-QJmjLyx2NAe-MROU1Gynu0vIYbKoGqEDkz6LVDB5JLjvOTXMhGGwnMpGHJXM86YDSr_3Glv5T8UsAPFpLyHVqUIS69PMgEOuVLlS1X5XR3ReAKll-W3ps-Q3AR6lvHbFmbuCGF9u60xEL1p6IW20vlE8BuJVgVutBQ9OKIScP6lQvvTgv-oZJdJs9rn6eEnj67" />
        </div>
      </header>

      <nav className="bg-[#0B0F14] dark:bg-slate-950 fixed left-0 top-0 h-screen w-[240px] border-r border-[#1A2230] dark:border-slate-800 hidden lg:flex flex-col z-50">
        <div className="p-margin border-b border-[#1A2230] dark:border-slate-800">
          <h1 className="text-xl font-black tracking-tighter text-emerald-500 uppercase font-h2">CricCast</h1>
          <p className="text-outline text-body-sm font-body-sm mt-xs">Command Center</p>
        </div>
        <div className="flex-1 py-margin overflow-y-auto flex flex-col gap-xs">
          <Link className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-slate-200 transition-all font-body-md hover:bg-slate-900/50 hover:text-white" to="/dashboard">
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </Link>
          <Link className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-slate-200 transition-all font-body-md hover:bg-slate-900/50 hover:text-white" to="/scoring">
            <Activity className="w-5 h-5" />
            Live Matches
          </Link>
          <a className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-slate-200 transition-all font-body-md hover:bg-slate-900/50 hover:text-white" href="#">
            <BarChart2 className="w-5 h-5" />
            Player Analytics
          </a>
          <a className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-slate-200 transition-all font-body-md hover:bg-slate-900/50 hover:text-white" href="#">
            <Users className="w-5 h-5" />
            Team Management
          </a>
          <a className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 text-emerald-500 border-l-4 border-emerald-500 font-bold transition-all font-body-md translate-x-1 duration-200" href="#">
            <UserCog className="w-5 h-5" />
            Operations
          </a>
          <a className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-slate-200 transition-all font-body-md hover:bg-slate-900/50 hover:text-white" href="#">
            <Settings className="w-5 h-5" />
            Settings
          </a>
        </div>
        <div className="p-margin border-t border-[#1A2230] dark:border-slate-800">
          <a className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-slate-200 transition-all font-body-md hover:bg-slate-900/50 hover:text-white" href="#">
            <HelpCircle className="w-5 h-5" />
            Help Support
          </a>
        </div>
      </nav>

      <main className="lg:ml-[240px] pt-16 min-h-screen p-margin max-w-7xl mx-auto">
        <div className="mb-lg">
          <h1 className="font-h1 text-h1 text-on-surface">Platform Operations</h1>
          <p className="font-body-md text-body-md text-outline">System health and tenant management command center.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter mb-lg">
          <div className="md:col-span-4 bg-[#11161E] border border-[#1A2230] rounded p-md relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary"></div>
            <div className="flex justify-between items-start mb-md">
              <div>
                <h3 className="font-h3 text-h3 text-on-surface mb-xs">DB Connection</h3>
                <p className="font-body-sm text-body-sm text-outline">Primary Cluster</p>
              </div>
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div className="flex items-end gap-sm">
              <span className="font-stat-lg text-stat-lg text-primary">12ms</span>
              <span className="font-body-sm text-body-sm text-primary mb-xs">latency</span>
            </div>
            <div className="mt-md bg-surface-container rounded-full h-1 overflow-hidden">
              <div className="bg-primary h-full w-[15%]"></div>
            </div>
          </div>

          <div className="md:col-span-4 bg-[#11161E] border border-[#1A2230] rounded p-md relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-error"></div>
            <div className="flex justify-between items-start mb-md">
              <div>
                <h3 className="font-h3 text-h3 text-on-surface mb-xs">Error Rate</h3>
                <p className="font-body-sm text-body-sm text-outline">Last 60 mins</p>
              </div>
              <AlertTriangle className="w-5 h-5 text-error" />
            </div>
            <div className="flex items-end gap-sm">
              <span className="font-stat-lg text-stat-lg text-error">1.2%</span>
              <span className="font-body-sm text-body-sm text-error mb-xs">+0.4%</span>
            </div>
            <div className="mt-md flex gap-xs h-8 items-end">
              <div className="w-full bg-error/20 h-2 rounded-t-sm"></div>
              <div className="w-full bg-error/20 h-3 rounded-t-sm"></div>
              <div className="w-full bg-error/20 h-1 rounded-t-sm"></div>
              <div className="w-full bg-error/40 h-4 rounded-t-sm"></div>
              <div className="w-full bg-error/60 h-6 rounded-t-sm"></div>
              <div className="w-full bg-error h-full rounded-t-sm"></div>
            </div>
          </div>

          <div className="md:col-span-4 bg-[#11161E] border border-[#1A2230] rounded p-md relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-secondary"></div>
            <div className="flex justify-between items-start mb-md">
              <div>
                <h3 className="font-h3 text-h3 text-on-surface mb-xs">Platform MRR</h3>
                <p className="font-body-sm text-body-sm text-outline">Current Month</p>
              </div>
              <LineChart className="w-5 h-5 text-secondary" />
            </div>
            <div className="flex items-end gap-sm">
              <span className="font-stat-lg text-stat-lg text-on-surface">$42.5k</span>
            </div>
            <div className="mt-md h-8 bg-gradient-to-t from-secondary/20 to-transparent rounded-sm border-b border-secondary"></div>
          </div>
        </div>

        <div className="bg-[#11161E] border border-[#1A2230] rounded mb-lg relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-outline-variant"></div>
          <div className="p-md border-b border-[#1A2230] flex justify-between items-center">
            <h2 className="font-h2 text-h2 text-on-surface">Active Tenants</h2>
            <div className="flex gap-sm">
              <div className="relative border border-outline-variant bg-surface rounded flex items-center px-2">
                <Search className="w-4 h-4 text-outline" />
                <input className="bg-transparent border-none py-sm pl-2 pr-md text-body-sm font-body-sm text-on-surface focus:ring-0 w-48" placeholder="Search clubs..." type="text" />
              </div>
              <button className="bg-surface-container border border-outline-variant text-on-surface px-md py-sm rounded font-body-sm hover:bg-surface-container-high flex items-center gap-xs">
                <Filter className="w-4 h-4" /> Filter
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1A2230] bg-[#0B0F14]/50">
                  <th className="p-md font-h3 text-body-sm text-outline tracking-wider">Club Name</th>
                  <th className="p-md font-h3 text-body-sm text-outline tracking-wider">Plan</th>
                  <th className="p-md font-h3 text-body-sm text-outline tracking-wider">Active Matches</th>
                  <th className="p-md font-h3 text-body-sm text-outline tracking-wider">Status</th>
                  <th className="p-md font-h3 text-body-sm text-outline tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="font-body-sm text-body-sm">
                <tr className="border-b border-[#1A2230] hover:bg-[#1A2230] transition-colors">
                  <td className="p-md font-body-md text-on-surface">Mumbai Indians</td>
                  <td className="p-md"><span className="bg-secondary/10 text-secondary px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-secondary/20">Enterprise</span></td>
                  <td className="p-md font-stat-md text-stat-md text-on-surface">2</td>
                  <td className="p-md"><span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-primary/20">Healthy</span></td>
                  <td className="p-md text-right">
                    <button className="text-outline hover:text-on-surface p-xs"><MoreVertical className="w-4 h-4" /></button>
                  </td>
                </tr>
                <tr className="border-b border-[#1A2230] hover:bg-[#1A2230] transition-colors bg-primary/5">
                  <td className="p-md font-body-md text-on-surface">Chennai Super Kings</td>
                  <td className="p-md"><span className="bg-secondary/10 text-secondary px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-secondary/20">Enterprise</span></td>
                  <td className="p-md font-stat-md text-stat-md text-on-surface">1</td>
                  <td className="p-md"><span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-primary/20">Healthy</span></td>
                  <td className="p-md text-right">
                    <button className="text-outline hover:text-on-surface p-xs"><MoreVertical className="w-4 h-4" /></button>
                  </td>
                </tr>
                <tr className="border-b border-[#1A2230] hover:bg-[#1A2230] transition-colors">
                  <td className="p-md font-body-md text-on-surface">Royal Challengers Bangalore</td>
                  <td className="p-md"><span className="bg-outline/10 text-outline-variant px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-outline/20">Pro</span></td>
                  <td className="p-md font-stat-md text-stat-md text-on-surface">0</td>
                  <td className="p-md"><span className="bg-[#f59e0b]/10 text-[#f59e0b] px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-[#f59e0b]/20">Warning - High API Usage</span></td>
                  <td className="p-md text-right">
                    <button className="text-outline hover:text-on-surface p-xs"><MoreVertical className="w-4 h-4" /></button>
                  </td>
                </tr>
                <tr className="hover:bg-[#1A2230] transition-colors">
                  <td className="p-md font-body-md text-on-surface">Delhi Capitals</td>
                  <td className="p-md"><span className="bg-outline/10 text-outline-variant px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-outline/20">Pro</span></td>
                  <td className="p-md font-stat-md text-stat-md text-on-surface">1</td>
                  <td className="p-md"><span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-primary/20">Healthy</span></td>
                  <td className="p-md text-right">
                    <button className="text-outline hover:text-on-surface p-xs"><MoreVertical className="w-4 h-4" /></button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="p-sm border-t border-[#1A2230] flex justify-center">
            <button className="text-outline hover:text-on-surface font-body-sm text-body-sm py-xs px-md">View All Tenants</button>
          </div>
        </div>

        <div className="bg-error/5 border border-error/20 rounded p-md relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-error"></div>
          <h2 className="font-h2 text-h2 text-error mb-xs">Danger Zone</h2>
          <p className="font-body-sm text-body-sm text-on-surface mb-md max-w-2xl">Actions taken here are irreversible and can disrupt service for entire organizations. Proceed with extreme caution.</p>
          <div className="flex items-center justify-between bg-background border border-error/10 p-md rounded-sm">
            <div>
              <h4 className="font-body-md text-body-md text-on-surface font-bold">Suspend Tenant</h4>
              <p className="font-body-sm text-body-sm text-outline">Immediately halt all active matches and revoke API access for a specific organization.</p>
            </div>
            <button className="bg-error text-on-error font-body-sm text-body-sm px-md py-sm rounded hover:opacity-90 transition-opacity">Suspend</button>
          </div>
        </div>
      </main>
    </div>
  );
}

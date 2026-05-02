import { Link } from 'react-router-dom';
import { 
  LayoutDashboard, Activity, Users, Settings, HelpCircle, 
  Search, Moon, Bell, Command, Radio, Calendar, Ticket, 
  DollarSign, ArrowRight, Eye, Edit, Plus, UserCog, BarChart2
} from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex">
      <nav className="hidden lg:flex flex-col h-full z-50 fixed left-0 top-0 w-[240px] border-r border-surface-container-high bg-background font-['Inter'] antialiased tracking-tight">
        <div className="flex flex-col h-full">
          <div className="p-6">
            <div className="flex items-center gap-3">
              <img alt="CricCast Logo" className="w-8 h-8 rounded-full" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC3o9okvZEEr7H2HqeekQvJWLWIeTy7qVl5_Jag59FPyVnik5aAd03XTIlHVn7JLki2vC_CaNfObXjT_E1E3-7IdRb6HXPqj_pa9D9l_DH7KrlWw9qntDwlfoT5boQVhw-XscIPFOzGCzaO1Xy44raXQ1w1EbiwhJX9_-ToI1GaTV_C6Iy3JyuVterXl2uOb7VBPuasRxuzGCSKPsA4qflMVUGx-IphmE5uQmMWMzZ0tqb-Woqy6TzjdHwECESPHKHQ95skjVz9Sb4u" />
              <div>
                <h1 className="text-xl font-black tracking-tighter text-primary-container uppercase leading-none font-h1">CricCast</h1>
                <span className="text-xs text-on-surface-variant">Command Center</span>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1">
              <li>
                <Link className="flex items-center gap-3 px-4 py-3 bg-primary-container/10 text-primary-container border-l-4 border-primary-container font-bold transition-all translate-x-1 duration-200" to="/dashboard">
                  <LayoutDashboard className="w-5 h-5" />
                  Dashboard
                </Link>
              </li>
              <li>
                <Link className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/50 transition-all font-body-md" to="/scoring">
                  <Activity className="w-5 h-5" />
                  Live Matches
                </Link>
              </li>
              <li>
                <a className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/50 transition-all font-body-md" href="#">
                  <BarChart2 className="w-5 h-5" />
                  Player Analytics
                </a>
              </li>
              <li>
                <a className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/50 transition-all font-body-md" href="#">
                  <Users className="w-5 h-5" />
                  Team Management
                </a>
              </li>
              <li>
                <Link className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/50 transition-all font-body-md" to="/admin">
                  <UserCog className="w-5 h-5" />
                  Operations
                </Link>
              </li>
              <li>
                <a className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/50 transition-all font-body-md" href="#">
                  <Settings className="w-5 h-5" />
                  Settings
                </a>
              </li>
            </ul>
          </div>
          <div className="mt-auto border-t border-surface-container-high">
            <a className="flex items-center gap-3 px-4 py-4 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/50 transition-all font-body-md" href="#">
              <HelpCircle className="w-5 h-5" />
              Help Support
            </a>
          </div>
        </div>
      </nav>

      <header className="fixed top-0 right-0 w-full lg:w-[calc(100%-240px)] z-40 bg-background/80 backdrop-blur-md border-b border-surface-container-high flex justify-between items-center h-16 px-6">
        <div className="flex items-center gap-6">
          <div className="lg:hidden text-lg font-bold text-primary-container tracking-widest uppercase font-h2">CricCast</div>
          <div className="hidden md:flex items-center bg-surface-container border border-outline-variant rounded px-3 py-1.5 focus-within:border-primary-container transition-colors">
            <Search className="w-4 h-4 text-on-surface-variant mr-2" />
            <input className="bg-transparent border-none text-on-surface outline-none focus:ring-0 text-sm w-48 placeholder:text-on-surface-variant" placeholder="Search..." type="text" />
          </div>
          <nav className="hidden md:flex items-center gap-6 font-['Inter'] text-[13px]">
            <Link className="text-on-surface-variant hover:text-primary-container transition-colors active:opacity-80" to="/scoring">Live</Link>
            <a className="text-on-surface-variant hover:text-primary-container transition-colors active:opacity-80" href="#">Stats</a>
            <Link className="text-on-surface-variant hover:text-primary-container transition-colors active:opacity-80" to="/admin">Admin</Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/scoring" className="bg-primary-container text-on-primary font-bold px-4 py-2 rounded text-sm hover:bg-primary transition-colors flex items-center gap-2">
            <Radio className="w-4 h-4" />
            Go Live
          </Link>
          <div className="flex items-center gap-2">
            <button className="p-2 text-on-surface-variant hover:bg-primary-container/5 rounded-full transition-colors text-primary">
              <Moon className="w-4 h-4" />
            </button>
            <button className="p-2 text-on-surface-variant hover:bg-primary-container/5 rounded-full transition-colors text-primary relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full"></span>
            </button>
            <button className="p-2 text-on-surface-variant hover:bg-primary-container/5 rounded-full transition-colors text-primary">
              <Command className="w-4 h-4" />
            </button>
          </div>
          <Link to="/login" className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant overflow-hidden cursor-pointer block">
            <img alt="User Profile" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCaQafsFNUiIWb9XmeK0JiztJPnZBbZ2__VqUSmIteu7nwUXA4WKfid5GLgdJFjfNAi99q15tqIFTa_DzfNMcn6ISFMTsYdbbYcIYKCyMeDSF9E2cVMyYpL31Zk9-SNeorJ2Mu3-6F3d4kk3VK0LoZ-ps2V3UheS5WnaGN3qhYHcxHViNZO6tBnfnHbclRmYWbyGvPse3u3pr_T3JLY8lS97AlcCaHJdf0GVfeubXwxtDHmE1K8ymBkzk44pc_v6t-o8mGL9Vd7Y7TQ" />
          </Link>
        </div>
      </header>

      <main className="flex-1 lg:ml-[240px] pt-16 mt-margin px-margin">
        <div className="flex justify-between items-end mb-gutter mt-4">
          <div>
            <h2 className="font-h2 text-h2 text-on-surface">Dashboard Overview</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">Real-time metrics and match status.</p>
          </div>
          <button className="bg-primary-container text-on-primary font-body-md px-6 py-3 rounded hover:bg-primary transition-colors flex items-center gap-2 shadow-sm">
            <Plus className="w-5 h-5" />
            Create New Match
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter mb-lg">
          <div className="bg-surface-container rounded p-gutter border border-surface-container-high border-l-[3px] border-l-primary-container relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-container/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <span className="font-body-md text-body-md text-on-surface-variant">Matches Today</span>
              <Calendar className="w-5 h-5 text-primary-container" />
            </div>
            <div className="flex items-baseline gap-2 relative z-10">
              <span className="font-stat-lg text-stat-lg text-on-surface">12</span>
              <span className="font-body-sm text-body-sm text-primary-container bg-primary-container/10 px-2 py-0.5 rounded-full">+3</span>
            </div>
          </div>

          <div className="bg-surface-container rounded p-gutter border border-surface-container-high border-l-[3px] border-l-secondary relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <span className="font-body-md text-body-md text-on-surface-variant">Active Players</span>
              <Activity className="w-5 h-5 text-secondary" />
            </div>
            <div className="flex items-baseline gap-2 relative z-10">
              <span className="font-stat-lg text-stat-lg text-on-surface">144</span>
              <span className="font-body-sm text-body-sm text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">Stable</span>
            </div>
          </div>

          <div className="bg-surface-container rounded p-gutter border border-surface-container-high border-l-[3px] border-l-tertiary relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-tertiary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <span className="font-body-md text-body-md text-on-surface-variant">Ticket Sales</span>
              <Ticket className="w-5 h-5 text-tertiary" />
            </div>
            <div className="flex items-baseline gap-2 relative z-10">
              <span className="font-stat-lg text-stat-lg text-on-surface">2,850</span>
              <span className="font-body-sm text-body-sm text-primary-container bg-primary-container/10 px-2 py-0.5 rounded-full">+12%</span>
            </div>
          </div>

          <div className="bg-surface-container rounded p-gutter border border-surface-container-high border-l-[3px] border-l-primary-container relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-container/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <span className="font-body-md text-body-md text-on-surface-variant">Est. Revenue</span>
              <DollarSign className="w-5 h-5 text-primary-container" />
            </div>
            <div className="flex items-baseline gap-2 relative z-10">
              <span className="font-stat-lg text-stat-lg text-on-surface">$14.2k</span>
              <span className="font-body-sm text-body-sm text-primary-container bg-primary-container/10 px-2 py-0.5 rounded-full">+5%</span>
            </div>
          </div>
        </div>

        <div className="bg-surface-container rounded border border-surface-container-high overflow-hidden">
          <div className="p-gutter border-b border-surface-container-high flex justify-between items-center bg-surface-container-low">
            <h3 className="font-h3 text-h3 text-on-surface">Recent & Upcoming Matches</h3>
            <button className="text-on-surface-variant hover:text-primary-container text-sm flex items-center gap-1 transition-colors">
              View All <ArrowRight className="w-4 h-4 text-sm" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-container-high bg-surface-container-low/50">
                  <th className="py-3 px-gutter font-body-sm text-[12px] tracking-[0.05em] text-on-surface-variant uppercase">Match ID</th>
                  <th className="py-3 px-gutter font-body-sm text-[12px] tracking-[0.05em] text-on-surface-variant uppercase">Teams</th>
                  <th className="py-3 px-gutter font-body-sm text-[12px] tracking-[0.05em] text-on-surface-variant uppercase">Status</th>
                  <th className="py-3 px-gutter font-body-sm text-[12px] tracking-[0.05em] text-on-surface-variant uppercase">Time</th>
                  <th className="py-3 px-gutter font-body-sm text-[12px] tracking-[0.05em] text-on-surface-variant uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="font-body-sm text-body-sm">
                <tr className="border-b border-surface-container-high hover:bg-surface-container-high/50 transition-colors group">
                  <td className="py-4 px-gutter font-stat-md text-stat-md text-on-surface-variant text-[14px]">#CC-8901</td>
                  <td className="py-4 px-gutter">
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2">
                        <div className="w-8 h-8 rounded-full bg-error-container border border-surface-container flex items-center justify-center text-on-error-container font-bold text-xs">RC</div>
                        <div className="w-8 h-8 rounded-full bg-secondary-container border border-surface-container flex items-center justify-center text-on-secondary-container font-bold text-xs">MI</div>
                      </div>
                      <span className="text-on-surface font-medium">Royals vs Indians</span>
                    </div>
                  </td>
                  <td className="py-4 px-gutter">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-container/10 text-primary-container border border-primary-container/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse"></span>
                      Live
                    </span>
                  </td>
                  <td className="py-4 px-gutter font-stat-md text-[14px] text-on-surface-variant">Now</td>
                  <td className="py-4 px-gutter text-right">
                    <Link to="/scoring" className="inline-flex p-1.5 text-on-surface-variant hover:text-primary-container rounded hover:bg-primary-container/10 transition-colors opacity-0 group-hover:opacity-100">
                      <Eye className="w-5 h-5" />
                    </Link>
                  </td>
                </tr>
                <tr className="border-b border-surface-container-high hover:bg-surface-container-high/50 transition-colors bg-surface-container-low/20 group">
                  <td className="py-4 px-gutter font-stat-md text-stat-md text-on-surface-variant text-[14px]">#CC-8902</td>
                  <td className="py-4 px-gutter">
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2">
                        <div className="w-8 h-8 rounded-full bg-tertiary-container border border-surface-container flex items-center justify-center text-on-tertiary-container font-bold text-xs">CS</div>
                        <div className="w-8 h-8 rounded-full bg-surface-bright border border-surface-container flex items-center justify-center text-on-surface font-bold text-xs">DC</div>
                      </div>
                      <span className="text-on-surface font-medium">Super Kings vs Capitals</span>
                    </div>
                  </td>
                  <td className="py-4 px-gutter">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-secondary/10 text-secondary border border-secondary/20">
                      Scheduled
                    </span>
                  </td>
                  <td className="py-4 px-gutter font-stat-md text-[14px] text-on-surface-variant">18:30 IST</td>
                  <td className="py-4 px-gutter text-right">
                    <button className="p-1.5 text-on-surface-variant hover:text-primary-container rounded hover:bg-primary-container/10 transition-colors opacity-0 group-hover:opacity-100">
                      <Edit className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
                <tr className="hover:bg-surface-container-high/50 transition-colors group">
                  <td className="py-4 px-gutter font-stat-md text-stat-md text-on-surface-variant text-[14px]">#CC-8903</td>
                  <td className="py-4 px-gutter">
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2">
                        <div className="w-8 h-8 rounded-full bg-surface-bright border border-surface-container flex items-center justify-center text-on-surface font-bold text-xs">KK</div>
                        <div className="w-8 h-8 rounded-full bg-primary-container border border-surface-container flex items-center justify-center text-on-primary-container font-bold text-xs">PB</div>
                      </div>
                      <span className="text-on-surface font-medium">Knight Riders vs Kings</span>
                    </div>
                  </td>
                  <td className="py-4 px-gutter">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-secondary/10 text-secondary border border-secondary/20">
                      Scheduled
                    </span>
                  </td>
                  <td className="py-4 px-gutter font-stat-md text-[14px] text-on-surface-variant">20:00 IST</td>
                  <td className="py-4 px-gutter text-right">
                    <button className="p-1.5 text-on-surface-variant hover:text-primary-container rounded hover:bg-primary-container/10 transition-colors opacity-0 group-hover:opacity-100">
                      <Edit className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="h-lg"></div>
      </main>
    </div>
  );
}

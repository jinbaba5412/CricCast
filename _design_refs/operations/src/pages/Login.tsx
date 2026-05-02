import { Link } from 'react-router-dom';
import { Mail, Lock, Moon, Shield } from 'lucide-react';

export default function Login() {
  return (
    <div className="bg-background text-on-background font-body-md text-body-md h-screen w-screen overflow-hidden flex">
      <div className="absolute top-margin right-margin z-50">
        <button aria-label="Toggle theme" className="p-sm rounded bg-surface-container-high border border-outline-variant text-on-surface hover:bg-surface-bright transition-colors">
          <Moon className="w-5 h-5" />
        </button>
      </div>
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-margin sm:px-12 md:px-24 bg-background relative z-10">
        <div className="max-w-md w-full mx-auto">
          <div className="mb-12">
            <h1 className="font-h1 text-h1 text-primary-container uppercase tracking-widest mb-2">CricCast</h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant">Sign in to your Command Center</p>
          </div>
          <form className="space-y-lg">
            <div className="space-y-md">
              <div>
                <label className="block font-body-sm text-body-sm text-on-surface mb-xs" htmlFor="email">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-sm flex items-center pointer-events-none text-on-surface-variant">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input className="block w-full pl-xl py-sm bg-surface-container border border-outline-variant rounded text-on-surface focus:ring-primary-container focus:border-primary-container font-body-md text-body-md placeholder-on-surface-variant/50" id="email" name="email" placeholder="commander@criccast.com" required type="email" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-xs">
                  <label className="block font-body-sm text-body-sm text-on-surface" htmlFor="password">Password</label>
                  <a className="font-body-sm text-body-sm text-primary hover:text-primary-fixed transition-colors" href="#">Forgot password?</a>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-sm flex items-center pointer-events-none text-on-surface-variant">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input className="block w-full pl-xl py-sm bg-surface-container border border-outline-variant rounded text-on-surface focus:ring-primary-container focus:border-primary-container font-body-md text-body-md placeholder-on-surface-variant/50" id="password" name="password" placeholder="••••••••" required type="password" />
                </div>
              </div>
            </div>
            <div className="flex items-center">
              <input className="h-4 w-4 bg-surface-container border-outline-variant rounded text-primary-container focus:ring-primary-container focus:ring-offset-background" id="remember-me" name="remember-me" type="checkbox" />
              <label className="ml-sm block font-body-sm text-body-sm text-on-surface-variant" htmlFor="remember-me">
                Remember me for 30 days
              </label>
            </div>
            <div>
              <Link to="/dashboard" className="w-full flex justify-center items-center py-md px-lg border border-transparent rounded bg-primary-container text-surface font-body-lg text-body-lg font-medium hover:bg-primary transition-colors min-h-[48px] shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                Sign In
              </Link>
            </div>
          </form>
          <div className="mt-lg text-center">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Don't have an account? 
              <Link className="font-medium text-primary hover:text-primary-fixed transition-colors ml-xs" to="/signup">Create account</Link>
            </p>
          </div>
        </div>
      </div>
      <div className="hidden lg:flex lg:w-1/2 relative bg-surface-container-lowest overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-surface-container-lowest/80 to-surface-container-highest/20 mix-blend-multiply"></div>
        <div className="absolute inset-0 flex flex-col justify-center items-center p-xl z-10">
          <div className="w-full max-w-lg bg-surface-container-low border border-outline-variant rounded-lg p-lg shadow-2xl border-l-[3px] border-l-[#10b981] relative overflow-hidden backdrop-blur-sm">
            <div className="absolute top-0 right-0 p-md opacity-20">
              <Shield className="w-24 h-24 text-primary-container" />
            </div>
            <h2 className="font-h2 text-h2 text-on-surface mb-md relative z-10">Performance Data <br /><span className="text-primary-container">At Your Fingertips</span></h2>
            <p className="font-body-md text-body-md text-on-surface-variant mb-lg relative z-10 max-w-sm">Access real-time player analytics, match statistics, and team management tools in one centralized command center.</p>
            <div className="grid grid-cols-2 gap-md relative z-10">
              <div className="bg-surface-container border border-outline-variant rounded p-md">
                <div className="flex items-center text-on-surface-variant mb-xs">
                  <span className="font-body-sm text-body-sm uppercase tracking-wider">Live Metrics</span>
                </div>
                <div className="font-stat-lg text-stat-lg text-primary-container">99.9%</div>
              </div>
              <div className="bg-surface-container border border-outline-variant rounded p-md">
                <div className="flex items-center text-on-surface-variant mb-xs">
                  <span className="font-body-sm text-body-sm uppercase tracking-wider">Latency</span>
                </div>
                <div className="font-stat-lg text-stat-lg text-on-surface">12<span className="text-stat-md ml-xs text-on-surface-variant">ms</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

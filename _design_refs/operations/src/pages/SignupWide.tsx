import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle } from 'lucide-react';

export default function SignupWide() {
  return (
    <div className="bg-background text-on-background antialiased min-h-screen flex flex-col md:flex-row">
      {/* Left Split: Hero Image / Branding */}
      <div className="hidden md:flex flex-col flex-1 relative bg-surface-container-lowest">
        <div className="absolute inset-0 z-0">
          <img alt="Stadium lights" className="w-full h-full object-cover opacity-30 mix-blend-luminosity" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAESGI5PsojZnA31zTbByy_ADy-LgysEGPq4khGHzquFAkx8eIV3vi0Vse4NOwGxeqfo6VyRNaqFgYIKsmX3HEpVC9Wa3qZRobelkfl4FUT_-_HV9BSmqnIIb--H9_pBzNvufWcwZcaBBflcynii5xnsyP2PwwEcIy8lbTp19pYdgy8nKex00PATr3ZdfeCDuW4e1hpGnFrPu9bhYQQdwG_6qLP8zUgD25lwuNExwMRC3K_9QMqNdF78ReVxlDh5fip5lauOGTwpaYG" />
          <div className="absolute inset-0 bg-gradient-to-r from-background to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-transparent to-background"></div>
        </div>
        <div className="relative z-10 flex flex-col h-full p-margin justify-between">
          <div>
            <h1 className="font-h1 text-h1 text-primary tracking-widest uppercase">CricCast</h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant mt-sm">Command Center</p>
          </div>
          <div className="max-w-md">
            <h2 className="font-h2 text-h2 text-on-background mb-sm">Elevate Your Match Day</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant">Professional-grade analytics and live broadcasting tools for cricket clubs of all sizes. Manage your team, track player performance, and engage your fans in real-time.</p>
            <div className="mt-lg flex items-center gap-md">
              <div className="flex -space-x-4">
                <img alt="User Avatar" className="w-10 h-10 rounded-full border-2 border-background object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC6f6IGrrPyc3W_yHEo_c-Vc6xsJSaO5Vvm2KmkWuEzavNkQ2fsa6f8bqqqg1C6dxO0UcKSX6bnkl42J2alosOxqobDxCLvtLGDoZxv_Uk68C7JDHUagDF9V_WlX_tEmBonK3TvuB-OsnEd74ta2fJkwnPKcUgyGhH4xKVwV2o_F9bE5IMAVdA4lmN2yoy2AF_fheXjf8QssIBcXoRgAsfH7i_K-1LLu-xhIgRRCh9MPBDTo_loYtSwzvEhlQreARE2Px1H1UmuZ6sM" />
                <img alt="User Avatar" className="w-10 h-10 rounded-full border-2 border-background object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDKdTWQ9uOiZhvhuFlEAiBlLrury0GVfnlNIM9i-Y-VgZEvBKiicY_XUGXsLeFIyvL_qeIKVltjyl5mCi9T0HR3Rx7clX_klKe0lc6dX-yj3IIx5PudvWECFYdYFS2VT08cn-qyuiuc5kpJHFJHVGXNdUYovHKQ78Pko95j6elMH0udWDfpca8DQxU4Cam7nei59U7ZYJ-90CddGd7b4MGreVof9xIwkIwNouVn2Me-6XgmJy6nY9hKRSXXghZXuVeswg6Z_zQcmag2" />
                <img alt="User Avatar" className="w-10 h-10 rounded-full border-2 border-background object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAYeRE2WjVIActe_kycKGhskZUmBhFFjNLUMINC1-MEKUn6aTNBNwWOl1BfL7TWNikQvuapejdL8t_G0rQd7VOnYxdUKTVMl1iFgJsCs3i_F1qkyYeQUQPuM1t9mfQ88fWltaChDZA0HlfoxX4RxbkTmKIDHgG96oe-8pEAnc_PrKgtrA9xKwyiuB1GRNretGglBjbIxqI6PkWtc4zElBV5kfY8G-DZ0luzxXWGk6gjJ24f4ALd0nv8qKaJtz5EktM7oYCAXTOV_IP6" />
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Join 2,000+ clubs worldwide</p>
            </div>
          </div>
        </div>
      </div>
      {/* Right Split: Form Canvas */}
      <div className="flex-1 flex flex-col justify-center px-margin py-xl bg-background md:max-w-xl z-10 relative">
        <div className="md:hidden mb-lg">
          <h1 className="font-h1 text-h3 text-primary tracking-widest uppercase">CricCast</h1>
        </div>
        <div className="w-full max-w-md mx-auto">
          <h2 className="font-h2 text-h2 text-on-background mb-xs">Start Your Club</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mb-lg">No credit card. Cancel anytime.</p>
          <form className="space-y-lg">
            <div className="space-y-md">
              <div>
                <label className="block font-body-sm text-body-sm text-on-surface-variant mb-xs" htmlFor="clubName">Club Name</label>
                <input className="w-full bg-surface-container border border-outline-variant rounded px-md py-sm font-body-md text-body-md text-on-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-outline-variant/50 transition-colors" id="clubName" name="clubName" placeholder="e.g. Royal Challengers" type="text" />
              </div>
              <div className="grid grid-cols-2 gap-md">
                <div>
                  <label className="block font-body-sm text-body-sm text-on-surface-variant mb-xs" htmlFor="yourName">Your Name</label>
                  <input className="w-full bg-surface-container border border-outline-variant rounded px-md py-sm font-body-md text-body-md text-on-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-outline-variant/50 transition-colors" id="yourName" name="yourName" placeholder="First Last" type="text" />
                </div>
                <div>
                  <label className="block font-body-sm text-body-sm text-on-surface-variant mb-xs" htmlFor="email">Email Address</label>
                  <input className="w-full bg-surface-container border border-outline-variant rounded px-md py-sm font-body-md text-body-md text-on-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-outline-variant/50 transition-colors" id="email" name="email" placeholder="admin@club.com" type="email" />
                </div>
              </div>
              <div>
                <label className="block font-body-sm text-body-sm text-on-surface-variant mb-xs" htmlFor="password">Password</label>
                <input className="w-full bg-surface-container border border-outline-variant rounded px-md py-sm font-body-md text-body-md text-on-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-outline-variant/50 transition-colors" id="password" name="password" placeholder="••••••••" type="password" />
              </div>
            </div>
            <div>
              <label className="block font-body-sm text-body-sm text-on-surface-variant mb-md">Select a Plan</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
                <label className="relative flex flex-col cursor-pointer group">
                  <input className="peer sr-only" name="plan" type="radio" value="free" />
                  <div className="flex-1 bg-surface-container border border-outline-variant rounded-lg p-md transition-colors peer-checked:border-primary peer-checked:bg-primary/10 hover:border-outline">
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg bg-surface-container peer-checked:bg-primary transition-colors"></div>
                    <div className="flex justify-between items-start mb-sm">
                      <span className="font-body-md text-body-md text-on-background font-medium">Free</span>
                      <CheckCircle className="w-4 h-4 text-outline-variant peer-checked:text-primary" />
                    </div>
                    <div className="font-stat-md text-stat-md text-on-background mb-xs">$0<span className="font-body-sm text-body-sm text-on-surface-variant">/mo</span></div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">Basic stats & scoring.</p>
                  </div>
                </label>
                <label className="relative flex flex-col cursor-pointer group">
                  <input defaultChecked className="peer sr-only" name="plan" type="radio" value="pro" />
                  <div className="flex-1 bg-surface-container border border-primary rounded-lg p-md transition-colors bg-primary/10 hover:bg-primary/20">
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg bg-primary"></div>
                    <div className="flex justify-between items-start mb-sm">
                      <span className="font-body-md text-body-md text-primary font-medium">Pro</span>
                      <CheckCircle className="w-4 h-4 text-primary" />
                    </div>
                    <div className="font-stat-md text-stat-md text-on-background mb-xs">$29<span className="font-body-sm text-body-sm text-on-surface-variant">/mo</span></div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">Live streaming & deep analytics.</p>
                  </div>
                </label>
                <label className="relative flex flex-col cursor-pointer group">
                  <input className="peer sr-only" name="plan" type="radio" value="enterprise" />
                  <div className="flex-1 bg-surface-container border border-outline-variant rounded-lg p-md transition-colors peer-checked:border-primary peer-checked:bg-primary/10 hover:border-outline">
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg bg-surface-container peer-checked:bg-primary transition-colors"></div>
                    <div className="flex justify-between items-start mb-sm">
                      <span className="font-body-md text-body-md text-on-background font-medium">Enterprise</span>
                      <CheckCircle className="w-4 h-4 text-outline-variant peer-checked:text-primary" />
                    </div>
                    <div className="font-stat-md text-stat-md text-on-background mb-xs">Custom</div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">Multi-team management.</p>
                  </div>
                </label>
              </div>
            </div>
            <Link to="/dashboard" className="w-full bg-primary text-on-primary font-body-md text-body-md font-medium h-[48px] rounded hover:bg-primary-fixed transition-colors flex items-center justify-center gap-sm">
              Start Your Club
              <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="text-center font-body-sm text-body-sm text-on-surface-variant mt-sm">
              Already have an account? <Link to="/login" className="text-primary hover:text-primary-fixed-dim transition-colors">Log in</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

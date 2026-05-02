import { Link } from 'react-router-dom';
import { ArrowLeft, Check, CheckCircle, Lock, Award, ArrowRight } from 'lucide-react';

export default function SignupMobile() {
  return (
    <div className="bg-background text-on-background font-body-md antialiased min-h-screen flex flex-col selection:bg-primary/20 selection:text-primary">
      <header className="bg-[#0B0F14] dark:bg-[#0B0F14] sticky top-0 border-b border-[#1A2230] flex justify-between items-center w-full px-6 h-16 z-50">
        <div className="flex items-center gap-4">
          <Link to="/login" className="flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-[#1A2230] transition-colors active:opacity-80 duration-150 group">
            <ArrowLeft className="w-5 h-5 text-[#10B981]" />
          </Link>
          <span className="text-xl font-black text-[#10B981] tracking-wider font-h3">CricCast</span>
        </div>
      </header>
      
      <main className="flex-1 flex flex-col w-full max-w-md mx-auto relative z-10">
        <div 
          className="absolute top-0 left-0 w-full h-80 bg-cover bg-center opacity-30 mix-blend-overlay pointer-events-none -z-10" 
          style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuA3XTVuI2aJ7XN2BdjT09umq7qG97UU_FIxL5uWDjF7Je3EC2AxtxrIbfkdzO2AZ6x9iMjstTYBjU9EeDISgkySElYM_9JP186fKFe4CwC5gtudBZT_s5i6NmWxTcIGmJ2aIbDjBFnui4-H1D1DTW15mJtzgv0UaXBZeFIsEoUOjCkHxW3oV9gZ7sY9pnKWMQ1zwR3TZw576l3dbYNXYNBIO7xuhLOOTimZ-2Km8K0UdHJ0QiMurx1leGErcFiUqDxhJ-R9F8aVIZzi')" }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/80 to-background"></div>
        </div>
        
        <div className="px-margin py-lg flex flex-col gap-xl">
          <div className="flex flex-col gap-sm pt-4">
            <h1 className="font-h1 text-h1 text-on-surface uppercase drop-shadow-md">ELEVATE YOUR MATCH DAY</h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-[280px]">Professional grade analytics and club management, built for the modern game.</p>
          </div>

          <div className="bg-surface-container border border-outline-variant rounded-xl p-lg relative overflow-hidden shadow-xl shadow-black/50">
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary"></div>
            <div className="flex flex-col gap-lg">
              <h2 className="font-h2 text-h2 text-on-surface tracking-wide uppercase">START YOUR CLUB</h2>
              <form className="flex flex-col gap-md">
                <div className="flex flex-col gap-xs">
                  <label className="font-body-sm text-body-sm text-on-surface-variant" htmlFor="clubName">Club Name</label>
                  <input className="bg-surface border border-outline-variant rounded px-md py-3 text-on-surface font-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors placeholder:text-outline h-[48px]" id="clubName" placeholder="e.g. Royal Strikers CC" type="text" />
                </div>
                <div className="flex flex-col gap-xs">
                  <label className="font-body-sm text-body-sm text-on-surface-variant" htmlFor="userName">Your Name</label>
                  <input className="bg-surface border border-outline-variant rounded px-md py-3 text-on-surface font-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors placeholder:text-outline h-[48px]" id="userName" placeholder="First & Last Name" type="text" />
                </div>
                <div className="flex flex-col gap-xs">
                  <label className="font-body-sm text-body-sm text-on-surface-variant" htmlFor="email">Email Address</label>
                  <input className="bg-surface border border-outline-variant rounded px-md py-3 text-on-surface font-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors placeholder:text-outline h-[48px]" id="email" placeholder="manager@club.com" type="email" />
                </div>
                <div className="flex flex-col gap-xs">
                  <label className="font-body-sm text-body-sm text-on-surface-variant" htmlFor="password">Password</label>
                  <div className="relative">
                    <input className="w-full bg-surface border border-outline-variant rounded pl-md pr-12 py-3 text-on-surface font-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors placeholder:text-outline h-[48px]" id="password" placeholder="••••••••" type="password" />
                  </div>
                </div>
              </form>
            </div>
          </div>

          <div className="flex flex-col gap-md pt-2">
            <h3 className="font-h3 text-h3 text-on-surface flex items-center gap-2">
              <Award className="text-primary w-5 h-5" />
              SELECT A PLAN
            </h3>
            
            <div className="flex overflow-x-auto gap-md pb-6 snap-x snap-mandatory -mx-margin px-margin pt-2" style={{ scrollbarWidth: 'none' }}>
              <div className="min-w-[240px] w-[240px] bg-surface-container-low border border-outline-variant rounded-xl p-md flex flex-col gap-md snap-center relative opacity-70 scale-95 transition-all">
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-surface-bright rounded-l-xl"></div>
                <div className="flex justify-between items-start">
                  <div className="font-h3 text-h3 text-on-surface">FREE</div>
                  <div className="font-stat-md text-stat-md text-on-surface">$0</div>
                </div>
                <ul className="flex flex-col gap-2 font-body-sm text-body-sm text-on-surface-variant">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-outline" /> 1 Team Managed</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-outline" /> Basic Match Scoring</li>
                </ul>
              </div>

              <div className="min-w-[260px] w-[260px] bg-surface-container border border-primary rounded-xl p-md flex flex-col gap-md snap-center relative shadow-lg shadow-primary/10 scale-100 ring-1 ring-primary/30 z-10">
                <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-primary rounded-l-xl"></div>
                <div className="absolute -top-3 right-4 bg-primary text-on-primary-fixed font-body-sm text-[10px] uppercase font-bold px-2 py-0.5 rounded-full tracking-wider">
                  Most Popular
                </div>
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <div className="font-h3 text-h3 text-primary">PRO</div>
                    <div className="font-body-sm text-body-sm text-on-surface-variant">Billed Annually</div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="font-stat-md text-stat-md text-on-surface">$29<span className="text-sm text-on-surface-variant">/mo</span></div>
                  </div>
                </div>
                <ul className="flex flex-col gap-2 font-body-sm text-body-sm text-on-surface-variant mt-2">
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-primary" /> Unlimited Teams</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-primary" /> Advanced Analytics</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-primary" /> Video Highlights</li>
                </ul>
              </div>

              <div className="min-w-[240px] w-[240px] bg-surface-container-low border border-outline-variant rounded-xl p-md flex flex-col gap-md snap-center relative opacity-70 scale-95 transition-all">
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-secondary rounded-l-xl"></div>
                <div className="flex justify-between items-start">
                  <div className="font-h3 text-h3 text-on-surface">ELITE</div>
                  <div className="font-stat-md text-stat-md text-on-surface">Custom</div>
                </div>
                <ul className="flex flex-col gap-2 font-body-sm text-body-sm text-on-surface-variant">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-outline" /> League Management</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-outline" /> API Access</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-sm pb-8">
            <Link to="/dashboard" className="w-full bg-primary text-on-primary-fixed font-h3 text-h3 py-4 rounded-lg flex justify-center items-center gap-2 hover:opacity-90 transition-opacity active:scale-[0.98] shadow-lg shadow-primary/20 min-h-[56px]">
              START YOUR CLUB
              <ArrowRight className="w-6 h-6" />
            </Link>
            <div className="flex justify-center items-center gap-1.5 mt-2">
              <Lock className="w-4 h-4 text-outline" />
              <p className="font-body-sm text-body-sm text-on-surface-variant">No credit card required to start</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

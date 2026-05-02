/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import OpsLogin from './pages/OpsLogin';
import SignupWide from './pages/SignupWide';
import SignupMobile from './pages/SignupMobile';
import Scoring from './pages/Scoring';
import Admin from './pages/Admin';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/ops-login" element={<OpsLogin />} />
        <Route path="/signup" element={<SignupWide />} />
        <Route path="/signup-mobile" element={<SignupMobile />} />
        <Route path="/scoring" element={<Scoring />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import LiveScreen from './screens/LiveScreen';
import RecordsScreen from './screens/RecordsScreen';
import SetupScreen from './screens/SetupScreen';
import TeamsScreen from './screens/TeamsScreen';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/records" replace />} />
      <Route path="/records" element={<RecordsScreen />} />
      <Route path="/setup" element={<SetupScreen />} />
      <Route path="/teams" element={<TeamsScreen />} />
      <Route path="/live" element={<LiveScreen />} />
    </Routes>
  );
}

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import StudentPage from './pages/StudentPage';
import AdminPage from './pages/AdminPage';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <Routes>
          <Route path="/" element={<StudentPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
        <Analytics />
      </div>
    </Router>
  );
}

export default App;

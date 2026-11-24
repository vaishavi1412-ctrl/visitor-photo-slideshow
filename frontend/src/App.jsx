import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Register from './pages/Register.jsx';
import Returning from './pages/Returning.jsx';
import Upload from './pages/Upload.jsx';
import Success from './pages/Success.jsx';
import Slideshow from './pages/Slideshow.jsx';
import ComingSoon from './pages/ComingSoon.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      {/* Pages that share the navigation bar and footer */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/returning" element={<Returning />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/success" element={<Success />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* The TV screen has no navigation bar */}
      <Route path="/slideshow" element={<Slideshow />} />

      {/* Admin pages are added in the next group */}
      <Route path="/admin/*" element={<ComingSoon title="Admin area" />} />
    </Routes>
  );
}
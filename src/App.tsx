import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Home from './routes/Home';
import Lottery539 from './routes/Lottery539';
import Lotto649 from './routes/Lotto649';
import SuperLotto from './routes/SuperLotto';
import NotFound from './routes/NotFound';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/539" element={<Lottery539 />} />
        <Route path="/lotto649" element={<Lotto649 />} />
        <Route path="/superlotto" element={<SuperLotto />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

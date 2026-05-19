import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { Home } from './pages/Home'
import { CareerRecommend } from './pages/CareerRecommend'

export default function App() {
  return (
    <Router>
      <div>
        <nav style={{
          padding: '16px 24px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          display: 'flex',
          gap: '24px',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
          <Link to="/" style={{ color: 'white', textDecoration: 'none', fontWeight: 600, fontSize: '18px' }}>
            🎯 职业规划知识图谱
          </Link>
          <div style={{ display: 'flex', gap: '16px', marginLeft: 'auto' }}>
            <Link 
              to="/" 
              style={{ 
                color: 'white', 
                textDecoration: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                transition: 'background 0.2s'
              }}
            >
              图谱浏览
            </Link>
            <Link 
              to="/recommend" 
              style={{ 
                color: 'white', 
                textDecoration: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                transition: 'background 0.2s',
                background: 'rgba(255,255,255,0.2)'
              }}
            >
              智能推荐
            </Link>
          </div>
        </nav>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/recommend" element={<CareerRecommend />} />
        </Routes>
      </div>
    </Router>
  )
}

import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

import Login from './pages/Login';
import Pacientes from './pages/Pacientes';
import Sessao from './pages/Sessao';
import Perfil from './pages/Perfil';
import Agenda from './pages/Agenda';

// O "Segurança" da Clínica: Verifica se está logada antes de mostrar a tela
function RotaPrivada({ children }) {
  const [carregando, setCarregando] = useState(true);
  const [autenticado, setAutenticado] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    // Fica escutando o Firebase para ver se tem alguém logado
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAutenticado(true);
      } else {
        setAutenticado(false);
      }
      setCarregando(false);
    });

    return () => unsubscribe();
  }, []);

  // Enquanto o Firebase pensa, mostra essa tela rápida
  if (carregando) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #cde4ff 0%, #d8f5d4 100%)', fontFamily: 'sans-serif' }}>
        <h2 style={{ color: '#2c3e50' }}>Verificando segurança... 🔐</h2>
      </div>
    );
  }

  // Se tem login, mostra a tela (children). Se não tem, manda pro Login (Navigate)
  return autenticado ? children : <Navigate to="/" />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rota Pública (A porta de entrada) */}
        <Route path="/" element={<Login />} />
        
        {/* Rotas Privadas (Só entra com a chave do Firebase) */}
        <Route path="/pacientes" element={<RotaPrivada><Pacientes /></RotaPrivada>} />
        <Route path="/perfil/:id" element={<RotaPrivada><Perfil /></RotaPrivada>} />
        <Route path="/sessao/:id" element={<RotaPrivada><Sessao /></RotaPrivada>} />
        <Route path="/agenda" element={<RotaPrivada><Agenda /></RotaPrivada>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
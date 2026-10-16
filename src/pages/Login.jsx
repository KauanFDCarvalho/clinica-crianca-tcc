import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setErro('');
    try {
      await signInWithEmailAndPassword(auth, email, senha);
      navigate('/pacientes');
    } catch (error) {
      console.error("Detalhes da falha:", error);
      setErro("E-mail ou senha incorretos. Tente novamente.");
    }
  };

  return (
    // O mesmo fundo gradiente calmante para receber
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #cde4ff 0%, #d8f5d4 100%)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '20px', 
      fontFamily: 'sans-serif' 
    }}>
      
      {/* Cartão de Login Arredondado */}
      <div style={{ 
        backgroundColor: 'rgba(255, 255, 255, 0.85)', 
        padding: '50px 40px', 
        borderRadius: '30px', 
        boxShadow: '0 10px 25px rgba(0,0,0,0.05)', 
        width: '100%', 
        maxWidth: '400px',
        textAlign: 'center'
      }}>
        
        {/* Logótipo e Boas-vindas */}
        <div style={{ fontSize: '50px', marginBottom: '10px' }}>✨</div>
        <h1 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '28px' }}>Clínica Criança</h1>
        <p style={{ color: '#64748b', fontSize: '16px', marginBottom: '30px' }}>Bem-vinda de volta!</p>

        {/* Mensagem de Erro (se ela errar a senha) */}
        {erro && (
          <div style={{ color: '#e74c3c', backgroundColor: '#fde8e8', padding: '12px', borderRadius: '15px', marginBottom: '20px', fontSize: '14px', fontWeight: 'bold' }}>
            {erro}
          </div>
        )}

        {/* Formulário de Acesso */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <input 
            type="email" 
            placeholder="E-mail de acesso" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ 
              padding: '16px 20px', 
              borderRadius: '15px', 
              border: '1px solid #cbd5e1', 
              outline: 'none', 
              fontSize: '16px',
              backgroundColor: '#fff',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
            }}
            required
          />
          
          <input 
            type="password" 
            placeholder="Senha" 
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            style={{ 
              padding: '16px 20px', 
              borderRadius: '15px', 
              border: '1px solid #cbd5e1', 
              outline: 'none', 
              fontSize: '16px',
              backgroundColor: '#fff',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
            }}
            required
          />
          
          <button 
            type="submit" 
            style={{ 
              padding: '16px', 
              backgroundColor: '#4ade80', 
              color: '#166534', 
              border: 'none', 
              borderRadius: '15px', 
              fontSize: '18px', 
              fontWeight: 'bold', 
              cursor: 'pointer', 
              boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
              marginTop: '10px'
            }}
          >
            Entrar no Consultório
          </button>
        </form>

      </div>
    </div>
  );
}
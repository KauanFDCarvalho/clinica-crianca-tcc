import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth'; 
import { db, auth, obterNomeColecao, obterNomeProfissional } from '../firebase';
import { useNavigate } from 'react-router-dom';

export default function Pacientes() {
  const [pacientes, setPacientes] = useState([]);
  const [nomeNovoPaciente, setNomeNovoPaciente] = useState('');
  const [colecaoAtual, setColecaoAtual] = useState(obterNomeColecao());
  const [nomeProfissional, setNomeProfissional] = useState(obterNomeProfissional());
  
  const avatares = ['👾', '🤖', '👽', '👻', '🦖', '🐙', '🦄', '🐧', '🐉', '🐸', '🐦‍🔥', '🦉', '🦁', '🐼', '🦊', '🦇', '🐯', '🐰'];
  const [avatarSelecionado, setAvatarSelecionado] = useState(avatares[0]);

  const [editandoId, setEditandoId] = useState(null);
  const [nomeEditado, setNomeEditado] = useState('');
  const [avatarEditado, setAvatarEditado] = useState('');

  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const lidarComRedimensionamento = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', lidarComRedimensionamento);
    return () => window.removeEventListener('resize', lidarComRedimensionamento);
  }, []);

  // Atualiza a gaveta ativa assim que o Firebase confirma quem está logado
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, () => {
      setColecaoAtual(obterNomeColecao());
      setNomeProfissional(obterNomeProfissional());
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, colecaoAtual), (snapshot) => {
      const lista = snapshot.docs.map(documento => ({
        id: documento.id,
        ...documento.data()
      }));
      setPacientes(lista);
    });
    return () => unsubscribe();
  }, [colecaoAtual]);

  const handleSair = () => {
    localStorage.removeItem('clinica_email_ativo');
    signOut(auth).then(() => {
      navigate('/');
    }).catch((error) => {
      console.error("Erro ao sair:", error);
    });
  };

  const adicionarPaciente = async (e) => {
    e.preventDefault();
    if (nomeNovoPaciente.trim() === '') return;
    try {
      await addDoc(collection(db, obterNomeColecao()), {
        nome: nomeNovoPaciente,
        avatar: avatarSelecionado, 
        dataCadastro: new Date().toLocaleDateString('pt-BR')
      });
      setNomeNovoPaciente('');
    } catch (error) {
      console.error("Detalhes da falha:", error);
      alert("Erro ao adicionar paciente.");
    }
  };

  const apagarPaciente = async (id, e) => {
    e.stopPropagation(); 
    const confirmacao = window.confirm("Tem certeza que deseja apagar este paciente e todo o seu histórico?");
    if (confirmacao) {
      await deleteDoc(doc(db, obterNomeColecao(), id));
    }
  };

  const iniciarEdicao = (paciente, e) => {
    e.stopPropagation();
    setEditandoId(paciente.id);
    setNomeEditado(paciente.nome);
    setAvatarEditado(paciente.avatar);
  };

  const salvarEdicao = async (id, e) => {
    e.stopPropagation();
    if (nomeEditado.trim() === '') return;
    await updateDoc(doc(db, obterNomeColecao(), id), {
      nome: nomeEditado,
      avatar: avatarEditado
    });
    setEditandoId(null); 
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #cde4ff 0%, #d8f5d4 100%)', padding: isMobile ? '15px' : '30px', fontFamily: 'sans-serif' }}>
      
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        <header style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: 'center', gap: isMobile ? '20px' : '0', marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ fontSize: '30px' }}>✨</div> 
            <h1 style={{ margin: 0, fontSize: '26px', color: '#2c3e50', fontWeight: 'bold' }}>Clínica Criança</h1>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
            
            <button 
              onClick={() => navigate('/agenda')}
              style={{ 
                display: 'flex', alignItems: 'center', gap: '8px', 
                padding: '8px 20px', 
                backgroundColor: '#3b82f6', color: '#fff', 
                border: 'none', borderRadius: '20px', 
                fontSize: '15px', fontWeight: 'bold', 
                cursor: 'pointer', boxShadow: '0 4px 6px rgba(59, 130, 246, 0.2)',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => !isMobile && (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => !isMobile && (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <span style={{ fontSize: '18px' }}>📅</span> Agenda
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'rgba(255,255,255,0.4)', padding: '5px 15px 5px 5px', borderRadius: '30px' }}>
              <div style={{ width: '35px', height: '35px', borderRadius: '50%', backgroundColor: '#d8c2b5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                👩‍⚕️
              </div>
              <span style={{ fontSize: '16px', color: '#2c3e50', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{nomeProfissional}</span>
            </div>
            
            <button 
              onClick={handleSair}
              style={{ background: 'none', border: 'none', color: '#e74c3c', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', padding: '5px 10px' }}
            >
              Sair
            </button>
          </div>
        </header>

        <h2 style={{ textAlign: 'center', color: '#2c3e50', fontSize: isMobile ? '20px' : '24px', letterSpacing: '1px', marginBottom: '30px' }}>
          SELECIONE O PERFIL DE UM PACIENTE
        </h2>

        <div style={{ display: 'flex', justifyContent: 'center', gap: isMobile ? '20px' : '40px', flexWrap: 'wrap', marginBottom: '30px' }}>
          {pacientes.map(paciente => (
            <div 
              key={paciente.id} 
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}
            >
              {editandoId === paciente.id ? (
                <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', maxWidth: '220px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', justifyContent: 'center' }}>
                    {avatares.map(av => (
                      <span key={av} onClick={() => setAvatarEditado(av)} style={{ cursor: 'pointer', fontSize: '22px', border: avatarEditado === av ? '2px solid #4ade80' : '2px solid transparent', borderRadius: '5px', padding: '2px' }}>
                        {av}
                      </span>
                    ))}
                  </div>
                  <input type="text" value={nomeEditado} onChange={(e) => setNomeEditado(e.target.value)} style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc', width: '100%', textAlign: 'center' }} />
                  <button onClick={(e) => salvarEdicao(paciente.id, e)} style={{ padding: '5px 15px', backgroundColor: '#4ade80', color: '#166534', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>Salvar</button>
                </div>
              ) : (
                <>
                  <div 
                    onClick={() => navigate(`/perfil/${paciente.id}`)}
                    style={{ 
                      width: isMobile ? '100px' : '130px', height: isMobile ? '100px' : '130px', 
                      borderRadius: '50%', 
                      backgroundColor: 'rgba(255,255,255,0.6)', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      fontSize: isMobile ? '50px' : '70px',
                      boxShadow: '0 8px 16px rgba(0,0,0,0.05)',
                      marginBottom: '10px',
                      cursor: 'pointer',
                      transition: 'transform 0.2s'
                    }}
                    onMouseEnter={(e) => !isMobile && (e.currentTarget.style.transform = 'scale(1.05)')}
                    onMouseLeave={(e) => !isMobile && (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    {paciente.avatar}
                  </div>
                  <span style={{ fontSize: isMobile ? '18px' : '20px', color: '#2c3e50', fontWeight: 'bold', marginBottom: '5px' }}>{paciente.nome}</span>
                  
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <span onClick={(e) => iniciarEdicao(paciente, e)} style={{ cursor: 'pointer', fontSize: '16px' }} title="Editar">✏️</span>
                    <span onClick={(e) => apagarPaciente(paciente.id, e)} style={{ cursor: 'pointer', fontSize: '16px' }} title="Apagar">🗑️</span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', color: '#64748b', fontSize: '16px', marginBottom: '20px' }}>
          Clique num perfil para continuar
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: '30px', padding: isMobile ? '20px' : '20px 30px', marginBottom: '20px' }}>
          <form onSubmit={adicionarPaciente} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', gap: '15px', width: '100%', maxWidth: '650px', justifyContent: 'center' }}>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px', backgroundColor: '#fff', padding: '10px 15px', borderRadius: '25px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', maxWidth: isMobile ? '100%' : '400px' }}>
              {avatares.map(av => (
                <span 
                  key={av} 
                  onClick={() => setAvatarSelecionado(av)} 
                  style={{ 
                    cursor: 'pointer', 
                    fontSize: isMobile ? '22px' : '24px', 
                    border: avatarSelecionado === av ? '2px solid #3b82f6' : '2px solid transparent', 
                    borderRadius: '50%', 
                    padding: '2px',
                    transition: 'all 0.2s',
                    backgroundColor: avatarSelecionado === av ? '#eff6ff' : 'transparent'
                  }}
                >
                  {av}
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px', width: isMobile ? '100%' : 'auto' }}>
              <input 
                type="text" 
                placeholder="Nome da criança" 
                value={nomeNovoPaciente}
                onChange={(e) => setNomeNovoPaciente(e.target.value)}
                style={{ padding: '12px 20px', borderRadius: '30px', border: 'none', outline: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', flex: 1, width: isMobile ? '100%' : 'auto', fontSize: '16px' }}
              />
              <button type="submit" style={{ padding: '12px 25px', backgroundColor: '#4ade80', color: '#166534', border: 'none', borderRadius: '30px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', width: isMobile ? '100%' : 'auto' }}>
                Adicionar
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
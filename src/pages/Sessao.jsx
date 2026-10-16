import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { collection, doc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore'; 
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, obterNomeColecao, obterNomeProfissional } from '../firebase';
import { GoogleGenerativeAI, GoogleGenerativeAIFetchError } from '@google/generative-ai';

const DATA_HOJE_PADRAO = new Date().toLocaleDateString('pt-BR');

export default function Sessao() {
  const { id } = useParams(); 
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const horaVindaDaUrl = searchParams.get('hora') || '';

  const [colecaoAtual, setColecaoAtual] = useState(obterNomeColecao());
  const [nomeProfissional, setNomeProfissional] = useState(obterNomeProfissional());
  const [todosPacientes, setTodosPacientes] = useState([]);

  const [nomePaciente, setNomePaciente] = useState('Carregando...');
  const [avatarPaciente, setAvatarPaciente] = useState('👻'); 
  const [emocaoSelecionada, setEmocaoSelecionada] = useState(null);
  const [novaTarefa, setNovaTarefa] = useState('');
  const [rotina, setRotina] = useState([]);
  const [tarefasHistorico, setTarefasHistorico] = useState([]);
  const [historicoPaciente, setHistoricoPaciente] = useState([]);
  const [agendamentosPaciente, setAgendamentosPaciente] = useState([]);
  const [posicaoTabuleiro, setPosicaoTabuleiro] = useState(1); 
  
  const [horaInicio, setHoraInicio] = useState(''); 
  const [horaFim, setHoraFim] = useState(''); 
  const [observacoesSessao, setObservacoesSessao] = useState('');
  
  const [isGravando, setIsGravando] = useState(false);
  const [modalSobreAberto, setModalSobreAberto] = useState(false);
  
  // ESTADOS DA INTELIGÊNCIA ARTIFICIAL
  const [modalIAAberto, setModalIAAberto] = useState(false);
  const [iaUsarEmocao, setIaUsarEmocao] = useState(true);
  const [iaUsarRotina, setIaUsarRotina] = useState(true);
  const [iaUsarAnotacoes, setIaUsarAnotacoes] = useState(false);
  const [historiaGerada, setHistoriaGerada] = useState('');
  const [gerandoHistoria, setGerandoHistoria] = useState(false);

  const reconhecedorRef = useRef(null);
  const textoAnteriorRef = useRef(''); 
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const emocoes = [
    { nome: 'Feliz!', emoji: '😀', cor: '#FFD54F', sombra: '#F5D742' },
    { nome: 'Triste', emoji: '😢', cor: '#90CAF9', sombra: '#64B5F6' },
    { nome: 'Bravo', emoji: '😡', cor: '#FF8A80', sombra: '#FF5252' },
    { nome: 'Cansado', emoji: '😩', cor: '#D1C4E9', sombra: '#B388FF' },
    { nome: 'Calmo', emoji: '😌', cor: '#A5D6A7', sombra: '#81C784' },
    { nome: 'Ansioso', emoji: '😬', cor: '#FFCC80', sombra: '#FFB74D' }
  ];

  const casinhasDoTabuleiro = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  const padronizarTextoTarefa = (texto) => {
    const limpo = texto.trim().replace(/\s+/g, ' ');
    if (!limpo) return '';
    return limpo.charAt(0).toUpperCase() + limpo.slice(1);
  };

  useEffect(() => {
    const lidarComRedimensionamento = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', lidarComRedimensionamento);
    return () => window.removeEventListener('resize', lidarComRedimensionamento);
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, () => {
      setColecaoAtual(obterNomeColecao());
      setNomeProfissional(obterNomeProfissional());
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.lang = 'pt-BR';
      rec.continuous = true; 
      rec.interimResults = true; 

      rec.onresult = (event) => {
        let transcricaoDestaSessao = '';
        for (let i = 0; i < event.results.length; i++) {
          transcricaoDestaSessao += event.results[i][0].transcript;
        }
        const espaco = textoAnteriorRef.current ? ' ' : '';
        setObservacoesSessao(textoAnteriorRef.current + espaco + transcricaoDestaSessao);
      };

      rec.onerror = (event) => {
        console.error("Erro na voz:", event.error);
        setIsGravando(false);
      };
      
      rec.onend = () => {
        setIsGravando(false); 
      }; 
      
      reconhecedorRef.current = rec;
    }

    return () => {
      if (reconhecedorRef.current) {
        reconhecedorRef.current.stop();
      }
    };
  }, []);

  // Trava a rolagem da tela de fundo quando alguma janelinha estiver aberta
  useEffect(() => {
    if (modalSobreAberto || modalIAAberto) {
      document.body.style.overflow = 'hidden'; 
    } else {
      document.body.style.overflow = 'unset';  
    }

    return () => {
      document.body.style.overflow = 'unset'; 
    };
  }, [modalSobreAberto, modalIAAberto]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, colecaoAtual), (snapshot) => {
      const lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setTodosPacientes(lista);

      const dados = lista.find(p => p.id === id);
      if (dados) {
        setNomePaciente(dados.nome);
        setAvatarPaciente(dados.avatar || '👻'); 
        setEmocaoSelecionada(dados.emocaoAtual || null);
        setRotina(dados.rotina || []);
        setPosicaoTabuleiro(dados.posicaoTabuleiro || 1); 
        setHistoricoPaciente(dados.historico || []);
        setAgendamentosPaciente(dados.agendamentos || []);
        
        setObservacoesSessao(dados.observacoesTemp || '');
        setHoraFim(dados.horaFimTemp || '');

        // Ordena os agendamentos de hoje por horário
        const agendamentosHojeOrdenados = (dados.agendamentos || [])
          .filter(a => a.data === DATA_HOJE_PADRAO && a.hora)
          .sort((a, b) => a.hora.localeCompare(b.hora));

        // Prioridade: 1º Horário vindo da Agenda na URL | 2º Horário já em andamento na sessão | 3º Primeiro agendamento pendente de hoje
        const horaEscolhida = horaVindaDaUrl || dados.horaInicioTemp || (agendamentosHojeOrdenados[0]?.hora || '');
        setHoraInicio(horaEscolhida);

        if (horaEscolhida && dados.horaInicioTemp !== horaEscolhida) {
          updateDoc(doc(db, colecaoAtual, id), { horaInicioTemp: horaEscolhida }).catch(() => {});
        }

        if (dados.historico && Array.isArray(dados.historico)) {
          const mapaTarefas = {};
          dados.historico.forEach(sessao => {
            if (sessao.tarefas && Array.isArray(sessao.tarefas)) {
              sessao.tarefas.forEach(t => {
                if (t.texto && t.texto.trim()) {
                  const chave = t.texto.trim().replace(/\s+/g, ' ').toLowerCase();
                  if (!mapaTarefas[chave]) {
                    mapaTarefas[chave] = {
                      label: padronizarTextoTarefa(t.texto),
                      contagem: 0
                    };
                  }
                  mapaTarefas[chave].contagem += 1;
                }
              });
            }
          });

          const listaOrdenada = Object.values(mapaTarefas)
            .sort((a, b) => b.contagem - a.contagem)
            .map(item => item.label);

          setTarefasHistorico(listaOrdenada);
        } else {
          setTarefasHistorico([]);
        }
      }
    });
    return () => unsubscribe();
  }, [id, colecaoAtual, horaVindaDaUrl]);

  // Agendamentos de hoje desta criança (para exibir seletor rápido caso haja mais de 1 no mesmo dia)
  const agendamentosHojeDaCrianca = agendamentosPaciente
    .filter(a => a.data === DATA_HOJE_PADRAO && a.hora)
    .sort((a, b) => a.hora.localeCompare(b.hora));

  // O horário de referência do atendimento atual é SEMPRE o horaInicio ativo na tela
  const horarioConjuntoRef = horaInicio;

  // Busca outras crianças que estão agendadas ou já concluíram sessão hoje neste EXATO horário (horarioConjuntoRef)
  const colegasEmConjunto = horarioConjuntoRef
    ? todosPacientes
        .filter(outro => outro.id !== id)
        .map(outro => {
          const aindaAgendado = (outro.agendamentos || []).some(
            a => a.data === DATA_HOJE_PADRAO && a.hora === horarioConjuntoRef
          );
          const jaConcluidoHojeNesseHorario = (outro.historico || []).some(
            h => h.data && h.data.startsWith(`${DATA_HOJE_PADRAO} - ${horarioConjuntoRef}`)
          );
          if (!aindaAgendado && !jaConcluidoHojeNesseHorario) return null;
          return {
            ...outro,
            aindaAgendado,
            jaConcluido: jaConcluidoHojeNesseHorario && !aindaAgendado
          };
        })
        .filter(Boolean)
    : [];

  const salvarTextoNoBanco = async () => {
    const docRef = doc(db, obterNomeColecao(), id);
    await updateDoc(docRef, { observacoesTemp: observacoesSessao });
  };

  // Só permite alternar para colegas cuja sessão daquele horário ainda NÃO foi encerrada
  const alternarParaColega = async (colega) => {
    if (colega.jaConcluido) return;
    if (isGravando && reconhecedorRef.current) {
      reconhecedorRef.current.stop();
      setIsGravando(false);
    }
    await salvarTextoNoBanco();
    setHistoriaGerada('');
    setModalIAAberto(false);
    navigate(`/sessao/${colega.id}?hora=${encodeURIComponent(horarioConjuntoRef)}`);
  };

  const toggleGravacao = async () => {
    if (!reconhecedorRef.current) {
      alert("Seu navegador restringe o microfone no site, mas você pode usar o teclado do celular!");
      return;
    }
    if (isGravando) {
      reconhecedorRef.current.stop();
      setIsGravando(false);
      await salvarTextoNoBanco();
    } else {
      textoAnteriorRef.current = observacoesSessao; 
      reconhecedorRef.current.start();
      setIsGravando(true);
    }
  };

  const handleMudarHoraInicio = async (val) => {
    setHoraInicio(val);
    await updateDoc(doc(db, obterNomeColecao(), id), { horaInicioTemp: val });
  };

  const handleMudarHoraFim = async (val) => {
    setHoraFim(val);
    await updateDoc(doc(db, obterNomeColecao(), id), { horaFimTemp: val });
  };

  const handleMudarEmocao = async (nomeEmocao) => {
    const docRef = doc(db, obterNomeColecao(), id);
    await updateDoc(docRef, { emocaoAtual: nomeEmocao });
  };

  const adicionarTarefa = async (e) => {
    e.preventDefault();
    const textoPadronizado = padronizarTextoTarefa(novaTarefa);
    if (!textoPadronizado) return;

    const novoId = rotina.reduce((maior, item) => Math.max(maior, Number(item.id) || 0), 0) + 1;
    const novaLista = [...rotina, { id: novoId, texto: textoPadronizado, concluida: false }];
    const docRef = doc(db, obterNomeColecao(), id);
    await updateDoc(docRef, { rotina: novaLista });
    setNovaTarefa('');
  };

  const adicionarTarefaSugerida = async (textoSugerido) => {
    const jaExisteHoje = rotina.some(
      t => t.texto.trim().toLowerCase() === textoSugerido.trim().toLowerCase()
    );
    if (jaExisteHoje) return;

    const novoId = rotina.reduce((maior, item) => Math.max(maior, Number(item.id) || 0), 0) + 1;
    const novaLista = [...rotina, { id: novoId, texto: textoSugerido, concluida: false }];
    const docRef = doc(db, obterNomeColecao(), id);
    await updateDoc(docRef, { rotina: novaLista });
  };

  const alternarTarefa = async (idTarefa) => {
    const rotinaAtualizada = rotina.map(tarefa => 
      tarefa.id === idTarefa ? { ...tarefa, concluida: !tarefa.concluida } : tarefa
    );
    const docRef = doc(db, obterNomeColecao(), id);
    await updateDoc(docRef, { rotina: rotinaAtualizada });
  };

  const removerTarefa = async (idTarefa, e) => {
    e.stopPropagation(); 
    const rotinaAtualizada = rotina.filter(tarefa => tarefa.id !== idTarefa);
    const docRef = doc(db, obterNomeColecao(), id);
    await updateDoc(docRef, { rotina: rotinaAtualizada });
  };

  const moverAvatar = async (novaPosicao) => {
    const docRef = doc(db, obterNomeColecao(), id);
    await updateDoc(docRef, { posicaoTabuleiro: novaPosicao });
  };

  const gerarHistoriaComIA = async () => {
    try {
      setGerandoHistoria(true);
      setHistoriaGerada('');
      
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("A variável VITE_GEMINI_API_KEY não está configurada.");
      }

      const genAI = new GoogleGenerativeAI(apiKey);

      let prompt = `Você é um contador de histórias infantis terapêuticas. Crie uma história lúdica, curta (máximo 3 parágrafos) e acolhedora para uma criança chamada ${nomePaciente}. `;
      
      if (iaUsarEmocao && emocaoSelecionada) {
        prompt += `O personagem principal está se sentindo ${emocaoSelecionada}. Ajude o personagem a acolher essa emoção de forma bonita. `;
      }
      
      if (iaUsarRotina && rotina.length > 0) {
        const tarefasConcluidas = rotina.filter(t => t.concluida).map(t => t.texto).join(", ");
        if (tarefasConcluidas) {
          prompt += `Durante o dia, o personagem conseguiu fazer estas coisas incríveis: ${tarefasConcluidas}. Celebre essas conquistas. `;
        }
      }

      if (iaUsarAnotacoes && observacoesSessao.trim() !== '') {
        prompt += `Incorpore de forma LÚDICA e INDIRETA (usando metáforas de contos de fadas ou animais) este contexto da terapia: "${observacoesSessao}". `;
      }

      prompt += `Termine a história com uma mensagem de segurança, afeto e esperança, mostrando que o personagem é muito amado e forte. Nunca use asteriscos (**) ou formatações markdown. Entregue apenas o texto limpo.`;

      const gerarConteudo = (modelName) =>
        genAI.getGenerativeModel({ model: modelName }).generateContent(prompt);

      let result;
      try {
        result = await gerarConteudo("gemini-3.8-flash");
      } catch (error) {
        if (!(error instanceof GoogleGenerativeAIFetchError) || error.status !== 503) {
          throw error;
        }

        console.warn("Gemini Flash indisponível (503); tentando novamente.");
        await new Promise((resolve) => setTimeout(resolve, 1000));

        try {
          result = await gerarConteudo("gemini-3.8-flash");
        } catch (retryError) {
          if (!(retryError instanceof GoogleGenerativeAIFetchError) || retryError.status !== 503) {
            throw retryError;
          }

          console.warn("Gemini Flash continua sobrecarregado (503); usando Gemini 3.5 Flash-Lite.");
          result = await gerarConteudo("gemini-3.5-flash-lite");
        }
      }

      setHistoriaGerada(result.response.text());
    } catch (error) {
      console.error("Erro ao gerar história:", error);
      if (error instanceof GoogleGenerativeAIFetchError && error.status === 503) {
        setHistoriaGerada("O serviço de IA está temporariamente sobrecarregado. Aguarde um pouco e tente gerar a história novamente.");
      } else {
        setHistoriaGerada("Não foi possível gerar a história. Confira a conexão e a configuração da chave da API e tente novamente.");
      }
    } finally {
      setGerandoHistoria(false);
    }
  };

  const handleEncerrarSessao = async () => {
    const confirmacao = window.confirm("Deseja encerrar esta sessão e salvar no histórico?");
    if (!confirmacao) return;

    // Se já existir uma sessão salva hoje neste mesmo horário para esta criança, avisa antes de duplicar
    if (horaInicio) {
      const jaTemSessaoNesseHorario = historicoPaciente.some(
        h => h.data && h.data.startsWith(`${DATA_HOJE_PADRAO} - ${horaInicio}`)
      );
      if (jaTemSessaoNesseHorario) {
        const confirmarDuplicada = window.confirm(
          `⚠️ Já existe uma sessão concluída hoje às ${horaInicio} para ${nomePaciente}. Deseja salvar mais um registro neste mesmo horário mesmo assim?`
        );
        if (!confirmarDuplicada) return;
      }
    }

    if (isGravando && reconhecedorRef.current) {
      reconhecedorRef.current.stop();
    }

    let dataComHorario = DATA_HOJE_PADRAO;
    if (horaInicio && horaFim) {
      dataComHorario = `${DATA_HOJE_PADRAO} - ${horaInicio} às ${horaFim}`;
    } else if (horaInicio) {
      dataComHorario = `${DATA_HOJE_PADRAO} - A partir das ${horaInicio}`;
    }

    const novoIdSessao = historicoPaciente.reduce(
      (maior, item) => Math.max(maior, Number(item.id) || 0),
      0
    ) + 1;

    // Se a sessão aconteceu em conjunto, registra o nome e avatar dos colegas no histórico do Prontuário
    const nomesColegasConjunto = colegasEmConjunto
      .map(c => `${c.avatar} ${c.nome}`)
      .join(', ');

    const resumoDoDia = {
      id: novoIdSessao,
      data: dataComHorario, 
      emocao: emocaoSelecionada || 'Não informada',
      tarefas: rotina,
      observacoes: observacoesSessao,
      ...(nomesColegasConjunto ? { emConjuntoCom: nomesColegasConjunto } : {})
    };

    // Remove apenas o agendamento correspondente a este horário de hoje
    const agendamentosHoje = agendamentosPaciente.filter(a => a.data === DATA_HOJE_PADRAO);
    const agendamentosRestantes = agendamentosPaciente.filter(a => {
      if (a.data !== DATA_HOJE_PADRAO) return true;
      if (horaInicio) {
        return a.hora !== horaInicio;
      }
      if (agendamentosHoje.length > 1) {
        return a.id !== agendamentosHoje[0].id;
      }
      return false;
    });

    try {
      const docRef = doc(db, obterNomeColecao(), id);
      await updateDoc(docRef, {
        historico: arrayUnion(resumoDoDia),
        agendamentos: agendamentosRestantes,
        emocaoAtual: null,                  
        rotina: [],
        posicaoTabuleiro: 1,
        observacoesTemp: '',
        horaInicioTemp: '',
        horaFimTemp: ''
      });

      // Só oferece ir para o colega se a sessão do colega naquele horário AINDA NÃO foi encerrada
      const colegaAindaAtivo = colegasEmConjunto.find(c => c.aindaAgendado);

      if (colegaAindaAtivo) {
        const irParaColega = window.confirm(
          `Sessão de ${nomePaciente} salva com sucesso!\n\nDeseja ir agora para a sessão em aberto de ${colegaAindaAtivo.nome} (atendimento em conjunto das ${horarioConjuntoRef})?`
        );
        if (irParaColega) {
          navigate(`/sessao/${colegaAindaAtivo.id}?hora=${encodeURIComponent(horarioConjuntoRef)}`);
          return;
        }
      }

      navigate(`/perfil/${id}`); 
    } catch (error) {
      console.error("Detalhes da falha:", error);
      alert("Houve um problema ao encerrar a sessão.");
    }
  };

  const sugestoesDisponiveisHoje = tarefasHistorico.filter(
    sug => !rotina.some(t => t.texto.trim().toLowerCase() === sug.trim().toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #cde4ff 0%, #d8f5d4 100%)', padding: isMobile ? '15px' : '30px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        <div style={{ marginBottom: '15px' }}>
          <button onClick={() => navigate(`/perfil/${id}`)} style={{ background: 'none', border: 'none', color: '#4a5568', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', padding: '0', display: 'flex', alignItems: 'center', gap: '5px' }}>
            ← Voltar ao prontuário
          </button>
        </div>

        <header style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: 'center', gap: isMobile ? '20px' : '0', marginBottom: '40px', backgroundColor: 'rgba(255,255,255,0.6)', padding: '15px 30px', borderRadius: '30px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ fontSize: '24px' }}>✨</div> 
            <h1 style={{ margin: 0, fontSize: '22px', color: '#2c3e50', fontWeight: 'bold' }}>Clínica Criança</h1>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#fff', padding: '5px 15px', borderRadius: '30px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: '24px' }}>{avatarPaciente}</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Perfil do paciente</span>
                <span style={{ fontSize: '14px', color: '#2c3e50', fontWeight: 'bold', textTransform: 'uppercase' }}>{nomePaciente}</span>
              </div>
            </div>

            {/* SÓ APARECE QUANDO O HORÁRIO ATUAL (horaInicio) É EM CONJUNTO COM OUTRA CRIANÇA */}
            {colegasEmConjunto.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#b45309', backgroundColor: '#fef3c7', padding: '4px 10px', borderRadius: '12px' }}>
                  👥 Em conjunto ({horarioConjuntoRef}):
                </span>
                {colegasEmConjunto.map(colega => (
                  colega.jaConcluido ? (
                    <span
                      key={colega.id}
                      style={{
                        backgroundColor: '#dcfce7',
                        border: '1px solid #86efac',
                        color: '#166534',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title={`A sessão de ${colega.nome} neste horário já foi encerrada`}
                    >
                      <span>{colega.avatar}</span>
                      <span>{colega.nome} (✓ Concluída)</span>
                    </span>
                  ) : (
                    <button
                      key={colega.id}
                      type="button"
                      onClick={() => alternarParaColega(colega)}
                      style={{
                        backgroundColor: '#eff6ff',
                        border: '1px solid #93c5fd',
                        color: '#1d4ed8',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title={`Alternar para a sessão em aberto de ${colega.nome}`}
                    >
                      <span>{colega.avatar}</span>
                      <span>{colega.nome} (Alternar)</span>
                    </button>
                  )
                ))}
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: '#d8c2b5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>👩‍⚕️</div>
              <span style={{ fontSize: '16px', color: '#2c3e50', fontWeight: '500' }}>{nomeProfissional}</span>
            </div>
            <span onClick={() => setModalSobreAberto(true)} style={{ fontSize: '15px', color: '#64748b', cursor: 'pointer', fontWeight: 'bold', padding: '5px 10px', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: '15px', transition: 'all 0.2s' }}>
              Sobre
            </span>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '40px', marginBottom: '40px' }}>
          <div>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '22px', color: '#4a5568', fontWeight: 'normal' }}>ROTINA VISUAL</h2>
              <h3 style={{ margin: '5px 0 0 0', fontSize: '26px', color: '#2c3e50' }}>MINHA ROTINA DE HOJE</h3>
            </div>
            <form onSubmit={adicionarTarefa} style={{ display: 'flex', gap: '10px', marginBottom: sugestoesDisponiveisHoje.length > 0 ? '12px' : '20px' }}>
              <input type="text" placeholder="Adicionar nova atividade..." value={novaTarefa} onChange={(e) => setNovaTarefa(e.target.value)} style={{ padding: '15px', flex: 1, borderRadius: '15px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', fontSize: '16px' }} />
              <button type="submit" style={{ padding: '0 25px', backgroundColor: '#4ade80', color: '#166534', border: 'none', borderRadius: '15px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>+</button>
            </form>

            {sugestoesDisponiveisHoje.length > 0 && (
              <div style={{ marginBottom: '20px', backgroundColor: 'rgba(255,255,255,0.55)', padding: '12px 15px', borderRadius: '15px' }}>
                <span style={{ display: 'block', fontSize: '12px', color: '#64748b', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  ⚡ Atividades frequentes de {nomePaciente} (clique para adicionar):
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {sugestoesDisponiveisHoje.slice(0, 8).map((sugestao) => (
                    <button
                      key={sugestao}
                      type="button"
                      onClick={() => adicionarTarefaSugerida(sugestao)}
                      style={{
                        backgroundColor: '#fff',
                        border: '1px solid #cbd5e1',
                        color: '#334155',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                        transition: 'all 0.15s'
                      }}
                    >
                      + {sugestao}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {rotina.map((tarefa) => (
                <div key={tarefa.id} onClick={() => alternarTarefa(tarefa.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', backgroundColor: tarefa.concluida ? '#f0fdf4' : '#ffffff', borderRadius: '15px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', borderLeft: tarefa.concluida ? '6px solid #4ade80' : '6px solid #e2e8f0', transition: 'all 0.2s' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', border: tarefa.concluida ? 'none' : '2px solid #cbd5e1', marginRight: '20px', backgroundColor: tarefa.concluida ? '#4ade80' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '18px', flexShrink: 0 }}>
                      {tarefa.concluida ? '✓' : ''}
                    </div>
                    <span style={{ fontSize: '18px', color: tarefa.concluida ? '#94a3b8' : '#334155', fontWeight: '500', textDecoration: tarefa.concluida ? 'line-through' : 'none' }}>{tarefa.texto}</span>
                  </div>
                  <button onClick={(e) => removerTarefa(tarefa.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#ef4444' }}>🗑️</button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '22px', color: '#4a5568', fontWeight: 'normal' }}>QUADRO DE EMOÇÕES</h2>
              <h3 style={{ margin: '5px 0 0 0', fontSize: '26px', color: '#2c3e50' }}>COMO VOCÊ ESTÁ SE SENTINDO?</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: '20px' }}>
              {emocoes.map((emocao) => (
                <div key={emocao.nome} onClick={() => handleMudarEmocao(emocao.nome)} style={{ textAlign: 'center', cursor: 'pointer', padding: '20px 5px', borderRadius: '25px', backgroundColor: emocaoSelecionada === emocao.nome ? emocao.cor : '#ffffff', border: emocaoSelecionada === emocao.nome ? `4px solid ${emocao.sombra}` : '4px solid transparent', boxShadow: '0 8px 16px rgba(0,0,0,0.05)', transform: emocaoSelecionada === emocao.nome ? 'scale(1.02)' : 'scale(1)', transition: 'all 0.2s' }}>
                  <div style={{ fontSize: isMobile ? '50px' : '60px', marginBottom: '10px' }}>{emocao.emoji}</div>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: isMobile ? '16px' : '18px', color: emocaoSelecionada === emocao.nome ? '#fff' : '#4a5568', textTransform: 'uppercase' }}>{emocao.nome}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: 'rgba(255,255,255,0.7)', padding: isMobile ? '20px' : '30px', borderRadius: '25px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', marginBottom: '40px' }}>
          <h3 style={{ marginTop: 0, textAlign: 'center', color: '#2c3e50', fontSize: '22px' }}>Trilha Terapêutica</h3>
          <p style={{ color: '#64748b', fontSize: '16px', textAlign: 'center' }}>Clique na próxima casa para avançar com o avatar.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'center', marginTop: '30px' }}>
            {casinhasDoTabuleiro.map((casa) => (
              <div key={casa} onClick={() => moverAvatar(casa)} style={{ width: isMobile ? '55px' : '70px', height: isMobile ? '55px' : '70px', borderRadius: '15px', border: posicaoTabuleiro === casa ? '4px solid #4ade80' : '2px dashed #cbd5e1', backgroundColor: posicaoTabuleiro === casa ? '#f0fdf4' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: posicaoTabuleiro === casa ? '30px' : '40px', fontWeight: 'bold', color: '#94a3b8', cursor: 'pointer', transition: 'all 0.2s' }}>
                {posicaoTabuleiro === casa ? avatarPaciente : casa}
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: isMobile ? '20px' : '30px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '25px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ marginBottom: '30px', borderBottom: '2px solid #e2e8f0', paddingBottom: '30px' }}>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '15px', gap: '15px' }}>
              <div>
                <p style={{ margin: '0 0 5px 0', color: '#4a5568', fontWeight: 'bold', fontSize: '18px' }}>Anotações da Sessão</p>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>Registre os detalhes das dinâmicas e o comportamento da criança.</p>
              </div>
              <button onClick={toggleGravacao} style={{ background: isGravando ? '#ef4444' : '#3b82f6', color: 'white', border: 'none', borderRadius: '20px', padding: '10px 20px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                {isGravando ? '🛑 Finalizar Ditado' : '🎙️ Ditar Observações'}
              </button>
            </div>
            <textarea 
              rows="4" 
              placeholder="Ex: Caiu na casa 4 e comentou sobre os pais..." 
              value={observacoesSessao} 
              onChange={(e) => setObservacoesSessao(e.target.value)} 
              onBlur={salvarTextoNoBanco}
              style={{ width: '100%', padding: '15px', borderRadius: '15px', border: isGravando ? '2px solid #3b82f6' : '1px solid #cbd5e1', outline: 'none', fontSize: '16px', resize: 'vertical', boxSizing: 'border-box', backgroundColor: isGravando ? '#eff6ff' : '#fff' }} 
            />
          </div>

          <div style={{ marginBottom: '25px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 10px 0', color: '#4a5568', fontWeight: 'bold', fontSize: '18px' }}>Horário do Atendimento</p>

            {/* Se houver mais de 1 agendamento para hoje (ex: 18:00 e 19:00), mostra botões para escolher qual está atendendo */}
            {agendamentosHojeDaCrianca.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold' }}>Agendados hoje:</span>
                {agendamentosHojeDaCrianca.map(agd => (
                  <button
                    key={agd.id}
                    type="button"
                    onClick={() => handleMudarHoraInicio(agd.hora)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '12px',
                      border: horaInicio === agd.hora ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                      backgroundColor: horaInicio === agd.hora ? '#eff6ff' : '#fff',
                      color: horaInicio === agd.hora ? '#1d4ed8' : '#475569',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    🕒 {agd.hora}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
              <input type="time" value={horaInicio} onChange={(e) => handleMudarHoraInicio(e.target.value)} style={{ padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '16px' }} />
              <input type="time" value={horaFim} onChange={(e) => handleMudarHoraFim(e.target.value)} style={{ padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '16px' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'center', alignItems: 'center', gap: '15px', width: '100%' }}>
            <button onClick={() => setModalIAAberto(true)} style={{ padding: '18px 30px', backgroundColor: '#a855f7', color: 'white', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(168, 85, 247, 0.3)', flex: 1, width: '100%', maxWidth: '300px' }}>
              ✨ Criar História
            </button>
            <button onClick={handleEncerrarSessao} style={{ padding: '18px 30px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(239, 68, 68, 0.3)', flex: 1, width: '100%', maxWidth: '300px' }}>
              Encerrar Sessão
            </button>
          </div>
        </div>
        
        {modalSobreAberto && (
          <div onClick={() => setModalSobreAberto(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#fff', padding: '40px 30px', borderRadius: '25px', width: '100%', maxWidth: '350px', textAlign: 'center', position: 'relative' }}>
              <button onClick={() => setModalSobreAberto(false)} style={{ position: 'absolute', top: '15px', right: '20px', background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#94a3b8' }}>×</button>
              <div style={{ fontSize: '50px', marginBottom: '15px' }}>🧸</div>
              <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50', fontSize: '22px' }}>Clínica Criança</h3>
              <p style={{ margin: '0 0 20px 0', color: '#4a5568', fontSize: '16px', lineHeight: '1.5' }}>
                Desenvolvido com muito ❤️ por <strong>Kauan Carvalho</strong>.
              </p>
            </div>
          </div>
        )}

        {modalIAAberto && (
          <div onClick={() => setModalIAAberto(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '25px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
              <button onClick={() => setModalIAAberto(false)} style={{ position: 'absolute', top: '15px', right: '20px', background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#94a3b8' }}>×</button>
              
              <h3 style={{ margin: '0 0 10px 0', color: '#a855f7', fontSize: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                ✨ História Mágica
              </h3>
              <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '15px' }}>
                Escolha o que a Inteligência Artificial deve incluir na historinha de encerramento do {nomePaciente}.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '15px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '16px', color: '#334155' }}>
                  <input type="checkbox" checked={iaUsarEmocao} onChange={(e) => setIaUsarEmocao(e.target.checked)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                  Usar a emoção do dia ({emocaoSelecionada || 'Nenhuma selecionada'})
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '16px', color: '#334155' }}>
                  <input type="checkbox" checked={iaUsarRotina} onChange={(e) => setIaUsarRotina(e.target.checked)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                  Incluir as tarefas que ele(a) conseguiu cumprir
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '16px', color: '#334155' }}>
                  <input type="checkbox" checked={iaUsarAnotacoes} onChange={(e) => setIaUsarAnotacoes(e.target.checked)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                  Usar minhas anotações ditadas (use com cuidado)
                </label>
              </div>

              {!historiaGerada && !gerandoHistoria && (
                <button onClick={gerarHistoriaComIA} style={{ width: '100%', padding: '15px', backgroundColor: '#a855f7', color: 'white', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(168, 85, 247, 0.2)' }}>
                  Gerar História
                </button>
              )}

              {gerandoHistoria && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#a855f7', fontWeight: 'bold' }}>
                  <span style={{ fontSize: '30px', display: 'block', animation: 'spin 2s linear infinite' }}>🪄</span>
                  Criando a magia...
                </div>
              )}

              {historiaGerada && !gerandoHistoria && (
                <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#fdf4ff', borderRadius: '15px', border: '1px solid #f0abfc' }}>
                  <p style={{ margin: 0, color: '#701a75', fontSize: '16px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{historiaGerada}</p>
                  <button onClick={() => setHistoriaGerada('')} style={{ width: '100%', marginTop: '20px', padding: '10px', backgroundColor: 'transparent', color: '#a855f7', border: '2px solid #a855f7', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
                    Gerar outra versão
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, obterNomeColecao } from '../firebase';
import { GoogleGenerativeAI, GoogleGenerativeAIFetchError } from '@google/generative-ai';

const ANO_ATUAL_PADRAO = String(new Date().getFullYear());
const MES_ATUAL_PADRAO = `${ANO_ATUAL_PADRAO}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

export default function Perfil() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sessaoIdDaAgenda = searchParams.get('sessaoId');
  const horaAgendadaDaAgenda = searchParams.get('horaAgendada');
  const dataAgendadaDaAgenda = searchParams.get('dataAgendada');
  
  const [colecaoAtual, setColecaoAtual] = useState(obterNomeColecao());
  const [paciente, setPaciente] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [abaAtiva, setAbaAtiva] = useState('prontuario'); 

  // ESTADOS DE FILTRO DE PERÍODO
  const [tipoPeriodo, setTipoPeriodo] = useState('todos'); // 'todos' | 'mes' | 'ano' | 'personalizado'
  const [mesSelecionado, setMesSelecionado] = useState(MES_ATUAL_PADRAO);
  const [anoSelecionado, setAnoSelecionado] = useState(ANO_ATUAL_PADRAO);
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');

  // ESTADOS DE INTERAÇÃO DOS GRÁFICOS E ROTINAS
  const [emocaoSelecionadaGrafico, setEmocaoSelecionadaGrafico] = useState(null);
  const [pontoLinhaSelecionado, setPontoLinhaSelecionado] = useState(null);
  const [mostrarTodasSessoesLinha, setMostrarTodasSessoesLinha] = useState(false);
  const [mostrarTodasAtividades, setMostrarTodasAtividades] = useState(false);

  // ESTADOS DO RESUMO COM IA
  const [resumoIA, setResumoIA] = useState('');
  const [gerandoResumoIA, setGerandoResumoIA] = useState(false);

  // PAGINAÇÃO, NOTAS E EDIÇÃO DE SESSÕES PASSADAS
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 5; 
  const [notasExpandidas, setNotasExpandidas] = useState({});
  const [sessaoEditandoId, setSessaoEditandoId] = useState(null);
  const [formEdicaoSessao, setFormEdicaoSessao] = useState({
    dataISO: '',
    horaInicio: '',
    horaFim: '',
    emocao: 'Feliz!',
    observacoes: ''
  });

  // ESTADOS DO FINANCEIRO E MÁSCARAS
  const [editandoFinanceiro, setEditandoFinanceiro] = useState(false);
  const [dadosForm, setDadosForm] = useState({
    responsavel1: '',
    parentesco1: '',
    telefone1: '',
    responsavel2: '',
    parentesco2: '',
    telefone2: '',
    valorSessao: '',
    vencimento: '',
    observacoes: ''
  });

  useEffect(() => {
    const lidarComRedimensionamento = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', lidarComRedimensionamento);
    return () => window.removeEventListener('resize', lidarComRedimensionamento);
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, () => {
      setColecaoAtual(obterNomeColecao());
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    const docRef = doc(db, colecaoAtual, id);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setPaciente(docSnap.data());
      }
    });
    return () => unsubscribe();
  }, [id, colecaoAtual]);

  if (!paciente) return <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'sans-serif' }}>Carregando prontuário...</div>;

  const coresEmocoes = {
    'Feliz!': { bg: '#e8f5e9', text: '#2e7d32', chart: '#FFD54F', border: '#F59E0B', emoji: '😀', nivel: 6 },
    'Feliz': { bg: '#e8f5e9', text: '#2e7d32', chart: '#FFD54F', border: '#F59E0B', emoji: '😀', nivel: 6 },
    'Calmo': { bg: '#f1f8e9', text: '#558b2f', chart: '#A5D6A7', border: '#10B981', emoji: '😌', nivel: 5 },
    'Cansado': { bg: '#f3e5f5', text: '#7b1fa2', chart: '#D1C4E9', border: '#8B5CF6', emoji: '😩', nivel: 4 },
    'Triste': { bg: '#e3f2fd', text: '#1565c0', chart: '#90CAF9', border: '#3B82F6', emoji: '😢', nivel: 3 },
    'Ansioso': { bg: '#fff3e0', text: '#ef6c00', chart: '#FFCC80', border: '#F97316', emoji: '😬', nivel: 2 },
    'Bravo': { bg: '#ffebee', text: '#c62828', chart: '#FF8A80', border: '#EF4444', emoji: '😡', nivel: 1 },
    'Não informada': { bg: '#f5f5f5', text: '#666666', chart: '#cbd5e1', border: '#94a3b8', emoji: '❓', nivel: 3 }
  };

  const opcoesEmocoesEdicao = ['Feliz!', 'Calmo', 'Cansado', 'Triste', 'Ansioso', 'Bravo', 'Não informada'];

  const niveisRegulacao = [
    { nivel: 6, nome: 'Feliz!', emoji: '😀' },
    { nivel: 5, nome: 'Calmo', emoji: '😌' },
    { nivel: 4, nome: 'Cansado', emoji: '😩' },
    { nivel: 3, nome: 'Triste', emoji: '😢' },
    { nivel: 2, nome: 'Ansioso', emoji: '😬' },
    { nivel: 1, nome: 'Bravo', emoji: '😡' }
  ];

  const nomesMeses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const padronizarNomeAtividade = (texto) => {
    const limpo = (texto || '').trim().replace(/\s+/g, ' ');
    if (!limpo) return '';
    return limpo.charAt(0).toUpperCase() + limpo.slice(1).toLowerCase();
  };

  const extrairPartesData = (dataString) => {
    if (!dataString) return null;
    const [dataSo, parteHorario] = dataString.split(' - ');
    const partes = dataSo.split('/');
    if (partes.length !== 3) return null;

    let horaMinuto = 0;
    let minuto = 0;
    if (parteHorario) {
      const matchHora = parteHorario.match(/(\d{2}):(\d{2})/);
      if (matchHora) {
        horaMinuto = Number(matchHora[1]);
        minuto = Number(matchHora[2]);
      }
    }

    return {
      dia: Number(partes[0]),
      mes: Number(partes[1]),
      ano: Number(partes[2]),
      timestamp: new Date(partes[2], partes[1] - 1, partes[0]).getTime(),
      timestampCompleto: new Date(partes[2], partes[1] - 1, partes[0], horaMinuto, minuto).getTime(),
      dataCurta: `${partes[0]}/${partes[1]}`
    };
  };

  const historicoOriginal = paciente.historico ? [...paciente.historico] : [];
  // Ordena da sessão mais recente para a mais antiga considerando a data e hora real da consulta
  const historicoReverso = [...historicoOriginal].sort((a, b) => {
    const infoA = extrairPartesData(a.data);
    const infoB = extrairPartesData(b.data);
    const timeA = infoA ? infoA.timestampCompleto : 0;
    const timeB = infoB ? infoB.timestampCompleto : 0;
    if (timeB !== timeA) return timeB - timeA;
    return (Number(b.id) || 0) - (Number(a.id) || 0);
  });

  const anosDisponiveis = Array.from(
    new Set([
      ANO_ATUAL_PADRAO,
      ...historicoOriginal.map(s => {
        const info = extrairPartesData(s.data);
        return info ? String(info.ano) : null;
      }).filter(Boolean)
    ])
  ).sort((a, b) => b.localeCompare(a));

  // 1º PASSO: Filtra pelo período escolhido
  const sessoesDoPeriodo = historicoReverso.filter(sessao => {
    const info = extrairPartesData(sessao.data);
    if (!info) return false;

    if (tipoPeriodo === 'todos') return true;

    if (tipoPeriodo === 'mes') {
      if (!mesSelecionado) return true;
      const [anoSel, mesSel] = mesSelecionado.split('-').map(Number);
      return info.ano === anoSel && info.mes === mesSel;
    }

    if (tipoPeriodo === 'ano') {
      if (!anoSelecionado) return true;
      return info.ano === Number(anoSelecionado);
    }

    if (tipoPeriodo === 'personalizado') {
      let passouInicio = true;
      let passouFim = true;
      if (filtroDataInicio) {
        const [ano, mes, dia] = filtroDataInicio.split('-');
        passouInicio = info.timestamp >= new Date(ano, mes - 1, dia).getTime();
      }
      if (filtroDataFim) {
        const [ano, mes, dia] = filtroDataFim.split('-');
        passouFim = info.timestamp <= new Date(ano, mes - 1, dia, 23, 59, 59).getTime();
      }
      return passouInicio && passouFim;
    }

    return true;
  });

  const obterTextoPeriodoAtivo = () => {
    if (tipoPeriodo === 'todos') return 'Todo o histórico registrado';
    if (tipoPeriodo === 'mes' && mesSelecionado) {
      const [a, m] = mesSelecionado.split('-').map(Number);
      return `Resumo Mensal: ${nomesMeses[m - 1]} de ${a}`;
    }
    if (tipoPeriodo === 'ano') return `Resumo Anual: Ano de ${anoSelecionado}`;
    if (tipoPeriodo === 'personalizado') {
      const formatarISO = (iso) => iso ? iso.split('-').reverse().join('/') : '...';
      return `Período personalizado: ${formatarISO(filtroDataInicio)} até ${formatarISO(filtroDataFim)}`;
    }
    return 'Período selecionado';
  };

  // Contagem de emoções dentro do período ativo
  const contagemEmocoes = {};
  let totalEmocoesValidas = 0;
  sessoesDoPeriodo.forEach(sessao => {
    let emo = sessao.emocao === 'Feliz' ? 'Feliz!' : sessao.emocao; 
    if (emo && emo !== 'Não informada') {
      contagemEmocoes[emo] = (contagemEmocoes[emo] || 0) + 1;
      totalEmocoesValidas++;
    }
  });
  const maxContagem = Math.max(...Object.values(contagemEmocoes), 1);

  let emocaoPredominante = 'Nenhuma';
  let maiorQtdEmocao = 0;
  Object.entries(contagemEmocoes).forEach(([emo, qtd]) => {
    if (qtd > maiorQtdEmocao) {
      maiorQtdEmocao = qtd;
      emocaoPredominante = emo;
    }
  });

  // Estatísticas compiladas das rotinas diárias (agrupando maiúsculas/minúsculas)
  let totalTarefasPeriodo = 0;
  let tarefasConcluidasPeriodo = 0;
  const mapaFrequenciaTarefas = {};

  sessoesDoPeriodo.forEach(sessao => {
    if (sessao.tarefas && Array.isArray(sessao.tarefas)) {
      sessao.tarefas.forEach(t => {
        totalTarefasPeriodo++;
        if (t.concluida) tarefasConcluidasPeriodo++;
        const chaveNormalizada = (t.texto || '').trim().replace(/\s+/g, ' ').toLowerCase();
        if (chaveNormalizada) {
          if (!mapaFrequenciaTarefas[chaveNormalizada]) {
            mapaFrequenciaTarefas[chaveNormalizada] = { 
              nomeExibicao: padronizarNomeAtividade(t.texto),
              total: 0, 
              concluidas: 0 
            };
          }
          mapaFrequenciaTarefas[chaveNormalizada].total++;
          if (t.concluida) mapaFrequenciaTarefas[chaveNormalizada].concluidas++;
        }
      });
    }
  });

  const taxaSucessoRotina = totalTarefasPeriodo > 0 
    ? Math.round((tarefasConcluidasPeriodo / totalTarefasPeriodo) * 100) 
    : 0;

  const todasAtividadesPeriodo = Object.values(mapaFrequenciaTarefas)
    .sort((a, b) => b.total - a.total);

  const atividadesExibidasNoResumo = mostrarTodasAtividades 
    ? todasAtividadesPeriodo 
    : todasAtividadesPeriodo.slice(0, 5);

  // 2º PASSO: Filtra a listagem detalhada caso uma barra de emoção ou uma consulta da Agenda tenha sido clicada
  const sessoesExibidasNaLista = sessoesDoPeriodo.filter(s => {
    if (sessaoIdDaAgenda && String(s.id) !== String(sessaoIdDaAgenda)) return false;
    if (emocaoSelecionadaGrafico && (s.emocao === 'Feliz' ? 'Feliz!' : s.emocao) !== emocaoSelecionadaGrafico) return false;
    return true;
  });

  const indexUltimoItem = paginaAtual * itensPorPagina;
  const indexPrimeiroItem = indexUltimoItem - itensPorPagina;
  const sessoesDaPagina = sessoesExibidasNaLista.slice(indexPrimeiroItem, indexUltimoItem);
  const totalPaginas = Math.ceil(sessoesExibidasNaLista.length / itensPorPagina);

  // Dados em ordem cronológica (antigo -> recente) para o Gráfico de Linha
  const sessoesCronologicas = [...sessoesDoPeriodo]
    .filter(s => s.emocao && s.emocao !== 'Não informada')
    .reverse();

  const limitePadraoLinha = 10;
  const sessoesParaGraficoLinha = (!mostrarTodasSessoesLinha && sessoesCronologicas.length > limitePadraoLinha)
    ? sessoesCronologicas.slice(-limitePadraoLinha)
    : sessoesCronologicas;

  const montarUrlIniciarSessao = () => {
    const params = new URLSearchParams();
    if (dataAgendadaDaAgenda) params.set('data', dataAgendadaDaAgenda);
    if (horaAgendadaDaAgenda) params.set('hora', horaAgendadaDaAgenda);
    const queryString = params.toString();
    return queryString ? `/sessao/${id}?${queryString}` : `/sessao/${id}`;
  };

  const limparFiltros = () => {
    setTipoPeriodo('todos');
    setFiltroDataInicio('');
    setFiltroDataFim('');
    setEmocaoSelecionadaGrafico(null);
    setPontoLinhaSelecionado(null);
    setMostrarTodasSessoesLinha(false);
    setResumoIA('');
    setSearchParams({});
    setPaginaAtual(1);
  };

  const toggleExpandirNota = (sessaoId) => {
    setNotasExpandidas(prev => ({
      ...prev,
      [sessaoId]: !prev[sessaoId]
    }));
  };

  // --- FUNÇÕES DE EDIÇÃO E EXCLUSÃO DE SESSÕES DO HISTÓRICO ---
  const abrirEdicaoSessao = (sessao) => {
    const [parteData, parteHorario] = (sessao.data || '').split(' - ');
    let dataISO = '';
    if (parteData && parteData.includes('/')) {
      const [d, m, y] = parteData.split('/');
      if (d && m && y) {
        dataISO = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }

    let horaInicio = '';
    let horaFim = '';
    if (parteHorario) {
      const horasEncontradas = parteHorario.match(/\d{2}:\d{2}/g) || [];
      if (parteHorario.startsWith('Até às')) {
        horaFim = horasEncontradas[0] || '';
      } else if (parteHorario.startsWith('A partir das')) {
        horaInicio = horasEncontradas[0] || '';
      } else {
        horaInicio = horasEncontradas[0] || '';
        horaFim = horasEncontradas[1] || '';
      }
    }

    setFormEdicaoSessao({
      dataISO,
      horaInicio,
      horaFim,
      emocao: sessao.emocao === 'Feliz' ? 'Feliz!' : (sessao.emocao || 'Não informada'),
      observacoes: sessao.observacoes || ''
    });
    setSessaoEditandoId(sessao.id);
  };

  const salvarEdicaoSessao = async (sessaoId) => {
    if (!formEdicaoSessao.dataISO) {
      alert("Por favor, informe a data da sessão.");
      return;
    }

    const [ano, mes, dia] = formEdicaoSessao.dataISO.split('-');
    let novaDataFormatada = `${dia}/${mes}/${ano}`;
    if (formEdicaoSessao.horaInicio && formEdicaoSessao.horaFim) {
      novaDataFormatada += ` - ${formEdicaoSessao.horaInicio} às ${formEdicaoSessao.horaFim}`;
    } else if (formEdicaoSessao.horaInicio) {
      novaDataFormatada += ` - A partir das ${formEdicaoSessao.horaInicio}`;
    } else if (formEdicaoSessao.horaFim) {
      novaDataFormatada += ` - Até às ${formEdicaoSessao.horaFim}`;
    }

    try {
      const novaListaHistorico = (paciente.historico || []).map(item => {
        if (String(item.id) !== String(sessaoId)) return item;
        return {
          ...item,
          data: novaDataFormatada,
          emocao: formEdicaoSessao.emocao,
          observacoes: formEdicaoSessao.observacoes.trim()
        };
      });

      const docRef = doc(db, obterNomeColecao(), id);
      await updateDoc(docRef, { historico: novaListaHistorico });
      setSessaoEditandoId(null);
    } catch (error) {
      console.error("Erro ao editar sessão:", error);
      alert("Não foi possível salvar as alterações da sessão.");
    }
  };

  const excluirSessaoHistorico = async (sessao) => {
    const confirmar = window.confirm(`Deseja realmente excluir o registro da sessão de "${sessao.data}" do prontuário?`);
    if (!confirmar) return;

    try {
      const novaListaHistorico = (paciente.historico || []).filter(
        item => String(item.id) !== String(sessao.id)
      );
      const docRef = doc(db, obterNomeColecao(), id);
      await updateDoc(docRef, { historico: novaListaHistorico });

      if (pontoLinhaSelecionado && String(pontoLinhaSelecionado.id) === String(sessao.id)) {
        setPontoLinhaSelecionado(null);
      }
      if (sessaoIdDaAgenda && String(sessaoIdDaAgenda) === String(sessao.id)) {
        setSearchParams({});
      }
    } catch (error) {
      console.error("Erro ao excluir sessão:", error);
      alert("Não foi possível excluir a sessão.");
    }
  };

  const gerarResumoClinicoIA = async () => {
    if (sessoesDoPeriodo.length === 0) return;
    try {
      setGerandoResumoIA(true);
      setResumoIA('');

      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("A variável VITE_GEMINI_API_KEY não está configurada.");
      }

      const genAI = new GoogleGenerativeAI(apiKey);

      const registrosTexto = [...sessoesDoPeriodo].reverse().map(s => {
        const tConcluidas = s.tarefas ? s.tarefas.filter(t => t.concluida).map(t => t.texto).join(', ') : 'Nenhuma';
        const tPendentes = s.tarefas ? s.tarefas.filter(t => !t.concluida).map(t => t.texto).join(', ') : 'Nenhuma';
        const infoConjunto = s.emConjuntoCom ? ` | Atendimento em conjunto com: ${s.emConjuntoCom}` : '';
        return `- Data: ${s.data} | Emoção: ${s.emocao}${infoConjunto} | Tarefas concluídas: (${tConcluidas || 'Nenhuma'}) | Não concluídas: (${tPendentes || 'Nenhuma'}) | Anotações: ${s.observacoes || 'Sem anotações'}`;
      }).join('\n');

      const prompt = `Você é um assistente clínico de psicologia infantil. Analise os registros abaixo do paciente ${paciente.nome} referentes ao período "${obterTextoPeriodoAtivo()}" e escreva um resumo executivo claro e acolhedor em até 2 parágrafos curtos. Destaque a evolução ou oscilação emocional da criança, o engajamento nas rotinas diárias e os principais temas observados nas anotações, facilitando a leitura rápida sem precisar ler dia por dia. Nunca use asteriscos (**) ou formatação markdown.\n\nRegistros:\n${registrosTexto}`;

      const gerarConteudo = (modelName) =>
        genAI.getGenerativeModel({ model: modelName }).generateContent(prompt);

      let result;
      try {
        result = await gerarConteudo("gemini-3.8-flash");
      } catch (error) {
        if (!(error instanceof GoogleGenerativeAIFetchError) || error.status !== 503) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
        try {
          result = await gerarConteudo("gemini-3.8-flash");
        } catch (retryError) {
          if (!(retryError instanceof GoogleGenerativeAIFetchError) || retryError.status !== 503) {
            throw retryError;
          }
          result = await gerarConteudo("gemini-3.5-flash-lite");
        }
      }

      setResumoIA(result.response.text());
    } catch (error) {
      console.error("Erro ao gerar resumo clínico:", error);
      setResumoIA("Não foi possível gerar a síntese automática agora. Você ainda pode consultar o compilado numérico acima.");
    } finally {
      setGerandoResumoIA(false);
    }
  };

  // --- FUNÇÕES DE MÁSCARA ---
  const handleTelefone = (e, campo) => {
    let v = e.target.value.replace(/\D/g, ''); 
    if (v.length > 11) v = v.slice(0, 11); 
    if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    if (v.length > 10) v = `${v.slice(0, 10)}-${v.slice(10)}`;
    setDadosForm({ ...dadosForm, [campo]: v });
  };

  const handleMoeda = (e) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v === '') { setDadosForm({ ...dadosForm, valorSessao: '' }); return; }
    v = (parseInt(v) / 100).toFixed(2).replace('.', ',');
    v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    setDadosForm({ ...dadosForm, valorSessao: `R$ ${v}` });
  };

  const handleDia = (e) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v !== '' && parseInt(v) > 31) v = '31';
    setDadosForm({ ...dadosForm, vencimento: v });
  };

  const iniciarEdicaoFinanceiro = () => {
    setDadosForm({
      responsavel1: paciente.financeiro?.responsavel1 || '',
      parentesco1: paciente.financeiro?.parentesco1 || '',
      telefone1: paciente.financeiro?.telefone1 || '',
      responsavel2: paciente.financeiro?.responsavel2 || '',
      parentesco2: paciente.financeiro?.parentesco2 || '',
      telefone2: paciente.financeiro?.telefone2 || '',
      valorSessao: paciente.financeiro?.valorSessao || '',
      vencimento: paciente.financeiro?.vencimento || '',
      observacoes: paciente.financeiro?.observacoes || ''
    });
    setEditandoFinanceiro(true);
  };

  const salvarFinanceiro = async (e) => {
    e.preventDefault();
    try {
      const docRef = doc(db, obterNomeColecao(), id);
      await updateDoc(docRef, { financeiro: dadosForm });
      setEditandoFinanceiro(false);
    } catch (error) {
      console.error("Detalhes da falha:", error);
      alert("Erro ao salvar os dados.");
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #cde4ff 0%, #d8f5d4 100%)', padding: isMobile ? '15px' : '30px', fontFamily: 'sans-serif' }}>
      
      <div style={{ maxWidth: '850px', margin: '0 auto' }}>
        
        <div style={{ marginBottom: '15px' }}>
          <button onClick={() => navigate('/pacientes')} style={{ background: 'none', border: 'none', color: '#4a5568', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', padding: '0', display: 'flex', alignItems: 'center', gap: '5px' }}>
            ← Voltar aos perfis
          </button>
        </div>

        <header style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: 'center', gap: isMobile ? '15px' : '0', marginBottom: '30px', backgroundColor: 'rgba(255,255,255,0.6)', padding: '15px 30px', borderRadius: '30px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ fontSize: '24px' }}>✨</div> 
            <h1 style={{ margin: 0, fontSize: '22px', color: '#2c3e50', fontWeight: 'bold' }}>Clínica Criança</h1>
          </div>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#4a5568', textAlign: 'center' }}>Prontuário Digital</h2>
          {!isMobile && <div style={{ width: '100px' }}></div>}
        </header>

        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', gap: '20px', marginBottom: '30px', backgroundColor: 'rgba(255,255,255,0.7)', padding: isMobile ? '20px' : '25px', borderRadius: '25px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', textAlign: isMobile ? 'center' : 'left' }}>
          <div style={{ fontSize: '60px', width: '90px', height: '90px', backgroundColor: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', flexShrink: 0 }}>
            {paciente.avatar}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, color: '#2c3e50', fontSize: '26px' }}>{paciente.nome}</h1>
            <p style={{ margin: '5px 0 0 0', color: '#64748b' }}>Acesse o histórico analítico ou inicie um novo atendimento.</p>
            {(horaAgendadaDaAgenda || dataAgendadaDaAgenda) && (
              <span style={{ display: 'inline-block', marginTop: '8px', backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '4px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold' }}>
                🕒 Agendamento selecionado na Agenda: {dataAgendadaDaAgenda ? `${dataAgendadaDaAgenda} ` : ''}{horaAgendadaDaAgenda ? `às ${horaAgendadaDaAgenda}` : ''}
              </span>
            )}
          </div>
          
          <button 
            onClick={() => navigate(montarUrlIniciarSessao())}
            style={{ padding: '15px 30px', backgroundColor: '#4ade80', color: '#166534', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', width: isMobile ? '100%' : 'auto', whiteSpace: 'nowrap' }}
          >
            ▶ Iniciar Sessão
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', backgroundColor: 'rgba(255,255,255,0.4)', padding: '8px', borderRadius: '20px' }}>
          <button 
            onClick={() => setAbaAtiva('prontuario')}
            style={{ flex: 1, padding: '12px', borderRadius: '15px', border: 'none', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: abaAtiva === 'prontuario' ? '#fff' : 'transparent', color: abaAtiva === 'prontuario' ? '#2c3e50' : '#64748b', boxShadow: abaAtiva === 'prontuario' ? '0 4px 6px rgba(0,0,0,0.05)' : 'none' }}
          >
            📊 Prontuário & Evolução
          </button>
          <button 
            onClick={() => setAbaAtiva('financeiro')}
            style={{ flex: 1, padding: '12px', borderRadius: '15px', border: 'none', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: abaAtiva === 'financeiro' ? '#fff' : 'transparent', color: abaAtiva === 'financeiro' ? '#2c3e50' : '#64748b', boxShadow: abaAtiva === 'financeiro' ? '0 4px 6px rgba(0,0,0,0.05)' : 'none' }}
          >
            👨‍👩‍👦 Pais & Acordos
          </button>
        </div>

        {/* ABA 1: PRONTUÁRIO */}
        {abaAtiva === 'prontuario' && (
          <div>
            
            {/* SELETOR DE PERÍODO E BANNER VISÍVEL */}
            <div style={{ backgroundColor: 'rgba(255,255,255,0.85)', padding: isMobile ? '18px' : '25px', borderRadius: '25px', marginBottom: '25px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', color: '#2c3e50', fontSize: '18px' }}>📅 Recorte de Período do Histórico</h3>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Alterne entre visão mensal, anual ou intervalo de datas.</p>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'todos', label: 'Tudo' },
                    { id: 'mes', label: 'Mensal' },
                    { id: 'ano', label: 'Anual' },
                    { id: 'personalizado', label: 'Por Datas' }
                  ].map(opcao => (
                    <button
                      key={opcao.id}
                      onClick={() => {
                        setTipoPeriodo(opcao.id);
                        setEmocaoSelecionadaGrafico(null);
                        setPontoLinhaSelecionado(null);
                        setMostrarTodasSessoesLinha(false);
                        setResumoIA('');
                        setPaginaAtual(1);
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '12px',
                        border: tipoPeriodo === opcao.id ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                        backgroundColor: tipoPeriodo === opcao.id ? '#eff6ff' : '#fff',
                        color: tipoPeriodo === opcao.id ? '#1d4ed8' : '#475569',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    >
                      {opcao.label}
                    </button>
                  ))}
                </div>
              </div>

              {tipoPeriodo === 'mes' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', backgroundColor: '#f8fafc', padding: '12px 15px', borderRadius: '15px' }}>
                  <label style={{ fontWeight: 'bold', color: '#4a5568', fontSize: '14px' }}>Selecione o Mês:</label>
                  <input 
                    type="month" 
                    value={mesSelecionado} 
                    onChange={(e) => { setMesSelecionado(e.target.value); setResumoIA(''); setPaginaAtual(1); }}
                    style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '15px', fontWeight: 'bold', color: '#2c3e50', outline: 'none' }}
                  />
                </div>
              )}

              {tipoPeriodo === 'ano' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', backgroundColor: '#f8fafc', padding: '12px 15px', borderRadius: '15px' }}>
                  <label style={{ fontWeight: 'bold', color: '#4a5568', fontSize: '14px' }}>Selecione o Ano:</label>
                  <select 
                    value={anoSelecionado} 
                    onChange={(e) => { setAnoSelecionado(e.target.value); setResumoIA(''); setPaginaAtual(1); }}
                    style={{ padding: '8px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '15px', fontWeight: 'bold', color: '#2c3e50', outline: 'none', backgroundColor: '#fff', cursor: 'pointer' }}
                  >
                    {anosDisponiveis.map(anoDisp => (
                      <option key={anoDisp} value={anoDisp}>{anoDisp}</option>
                    ))}
                  </select>
                </div>
              )}

              {tipoPeriodo === 'personalizado' && (
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px', marginBottom: '15px', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '15px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', color: '#4a5568', fontWeight: 'bold', marginBottom: '5px', fontSize: '13px' }}>A partir de:</label>
                    <input type="date" value={filtroDataInicio} onChange={(e) => { setFiltroDataInicio(e.target.value); setResumoIA(''); setPaginaAtual(1); }} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', color: '#4a5568', fontWeight: 'bold', marginBottom: '5px', fontSize: '13px' }}>Até:</label>
                    <input type="date" value={filtroDataFim} onChange={(e) => { setFiltroDataFim(e.target.value); setResumoIA(''); setPaginaAtual(1); }} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '12px 18px', borderRadius: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '18px' }}>🔎</span>
                  <strong style={{ color: '#1e3a8a', fontSize: '15px' }}>{obterTextoPeriodoAtivo()}</strong>
                  <span style={{ backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '3px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold' }}>
                    {sessoesDoPeriodo.length} {sessoesDoPeriodo.length === 1 ? 'sessão encontrada' : 'sessões encontradas'}
                  </span>
                </div>
                {tipoPeriodo !== 'todos' && (
                  <button onClick={limparFiltros} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}>
                    Ver todo o histórico
                  </button>
                )}
              </div>
            </div>

            {/* COMPILADO MENSAL / ANUAL DAS ROTINAS DIÁRIAS + IA */}
            {sessoesDoPeriodo.length > 0 && (
              <div style={{ backgroundColor: 'rgba(255,255,255,0.85)', padding: isMobile ? '20px' : '30px', borderRadius: '25px', marginBottom: '30px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: '10px', marginBottom: '20px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', color: '#2c3e50', fontSize: '20px' }}>📋 Resumo Compilado das Rotinas e Sessões</h3>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Visão geral de engajamento para leitura rápida ({obterTextoPeriodoAtivo()}).</p>
                  </div>
                  <button 
                    onClick={gerarResumoClinicoIA} 
                    disabled={gerandoResumoIA}
                    style={{ padding: '10px 18px', backgroundColor: '#a855f7', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: 'bold', fontSize: '14px', cursor: gerandoResumoIA ? 'wait' : 'pointer', boxShadow: '0 4px 10px rgba(168, 85, 247, 0.25)', whiteSpace: 'nowrap' }}
                  >
                    {gerandoResumoIA ? '🪄 Sintetizando período...' : '✨ Gerar Síntese com IA'}
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '15px', marginBottom: '20px' }}>
                  <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Adesão às Rotinas</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
                      <strong style={{ fontSize: '24px', color: '#166534' }}>{taxaSucessoRotina}%</strong>
                      <span style={{ fontSize: '13px', color: '#475569' }}>({tarefasConcluidasPeriodo} de {totalTarefasPeriodo} tarefas)</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', marginTop: '8px', overflow: 'hidden' }}>
                      <div style={{ width: `${taxaSucessoRotina}%`, height: '100%', backgroundColor: '#4ade80', borderRadius: '4px' }} />
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Emoção mais Frequente</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                      <span style={{ fontSize: '26px' }}>{coresEmocoes[emocaoPredominante]?.emoji || '❓'}</span>
                      <div>
                        <strong style={{ display: 'block', fontSize: '18px', color: '#2c3e50' }}>{emocaoPredominante}</strong>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>Em {maiorQtdEmocao} {maiorQtdEmocao === 1 ? 'sessão' : 'sessões'}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Atividades Trabalhadas</span>
                      {todasAtividadesPeriodo.length > 5 && (
                        <button
                          onClick={() => setMostrarTodasAtividades(!mostrarTodasAtividades)}
                          style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', padding: 0 }}
                        >
                          {mostrarTodasAtividades ? 'Ver menos' : `+ Ver todas (${todasAtividadesPeriodo.length})`}
                        </button>
                      )}
                    </div>
                    {atividadesExibidasNoResumo.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                        {atividadesExibidasNoResumo.map((dadosAtiv) => (
                          <span key={dadosAtiv.nomeExibicao} style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: '8px', fontSize: '12px', color: '#334155' }}>
                            {dadosAtiv.nomeExibicao} <strong>({dadosAtiv.concluidas}/{dadosAtiv.total}✓)</strong>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>Sem tarefas registradas.</p>
                    )}
                  </div>
                </div>

                {resumoIA && (
                  <div style={{ padding: '18px', backgroundColor: '#fdf4ff', borderRadius: '16px', border: '1px solid #f0abfc', marginTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ color: '#701a75', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        ✨ Síntese Clínica Gerada para o Período
                      </strong>
                      <button onClick={() => setResumoIA('')} style={{ background: 'none', border: 'none', color: '#86198f', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>Fechar</button>
                    </div>
                    <p style={{ margin: 0, color: '#581c87', fontSize: '15px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{resumoIA}</p>
                  </div>
                )}
              </div>
            )}

            {/* GRÁFICO 1: BARRAS DE EMOÇÕES COM MAIS DETALHES E CLIQUE PARA FILTRAR */}
            {Object.keys(contagemEmocoes).length > 0 && (
              <div style={{ backgroundColor: 'rgba(255,255,255,0.85)', padding: isMobile ? '25px 15px' : '35px 30px', borderRadius: '25px', marginBottom: '30px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                <h3 style={{ textAlign: 'center', color: '#2c3e50', fontSize: isMobile ? '20px' : '22px', margin: '0 0 6px 0' }}>
                  Frequência de Emoções no Período
                </h3>
                <p style={{ textAlign: 'center', color: '#64748b', fontSize: '14px', margin: '0 0 25px 0' }}>
                  💡 Clique em uma barra para investigar <strong>o porquê</strong> dessa emoção e filtrar os dias abaixo.
                </p>

                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: '10px', height: '240px', paddingBottom: '10px' }}>
                  {Object.entries(contagemEmocoes).map(([emo, valor]) => {
                    const infoCor = coresEmocoes[emo] || coresEmocoes['Não informada'];
                    const alturaPorcentagem = Math.round((valor / maxContagem) * 100);
                    const percentualTotal = totalEmocoesValidas > 0 ? Math.round((valor / totalEmocoesValidas) * 100) : 0;
                    const isSelecionada = emocaoSelecionadaGrafico === emo;

                    return (
                      <div 
                        key={emo} 
                        onClick={() => {
                          setEmocaoSelecionadaGrafico(isSelecionada ? null : emo);
                          setPaginaAtual(1);
                        }}
                        title={`Clique para ver detalhes dos dias com a emoção: ${emo}`}
                        style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'center', 
                          justifyContent: 'flex-end', 
                          height: '100%', 
                          flex: 1, 
                          maxWidth: '85px',
                          cursor: 'pointer',
                          padding: '6px',
                          borderRadius: '15px',
                          backgroundColor: isSelecionada ? '#eff6ff' : 'transparent',
                          border: isSelecionada ? '2px solid #3b82f6' : '2px solid transparent',
                          opacity: emocaoSelecionadaGrafico && !isSelecionada ? 0.5 : 1,
                          transition: 'all 0.2s'
                        }}
                      >
                        <span style={{ fontSize: isMobile ? '13px' : '15px', fontWeight: 'bold', color: '#1e293b' }}>
                          {valor}x
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '6px' }}>
                          ({percentualTotal}%)
                        </span>
                        <div style={{ width: '100%', height: '120px', display: 'flex', alignItems: 'flex-end', backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: '10px 10px 0 0', overflow: 'hidden' }}>
                          <div style={{ height: `${alturaPorcentagem}%`, minHeight: '12px', width: '100%', backgroundColor: infoCor.chart, borderRadius: '8px 8px 0 0', transition: 'height 0.4s ease' }} />
                        </div>
                        <div style={{ width: '100%', height: '2px', backgroundColor: '#cbd5e1', margin: '4px 0' }} />
                        <span style={{ fontSize: isMobile ? '24px' : '30px', marginTop: '2px' }}>{infoCor.emoji}</span>
                        <span style={{ fontSize: isMobile ? '10px' : '12px', fontWeight: 'bold', color: '#475569', marginTop: '4px', textAlign: 'center' }}>
                          {emo}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {emocaoSelecionadaGrafico && (
                  <div style={{ marginTop: '20px', padding: '18px', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px solid #cbd5e1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                      <strong style={{ color: '#1e293b', fontSize: '16px' }}>
                        {coresEmocoes[emocaoSelecionadaGrafico]?.emoji} Contexto das sessões com emoção "{emocaoSelecionadaGrafico}" ({sessoesExibidasNaLista.length})
                      </strong>
                      <button 
                        onClick={() => setEmocaoSelecionadaGrafico(null)}
                        style={{ backgroundColor: '#e2e8f0', border: 'none', padding: '5px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', color: '#334155' }}
                      >
                        ✕ Mostrar todas as emoções
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {sessoesExibidasNaLista.map(s => {
                        const tarefasFeitas = s.tarefas ? s.tarefas.filter(t => t.concluida).map(t => t.texto).join(', ') : '';
                        return (
                          <div key={s.id} style={{ backgroundColor: '#fff', padding: '10px 14px', borderRadius: '12px', borderLeft: `4px solid ${coresEmocoes[emocaoSelecionadaGrafico]?.border || '#3b82f6'}`, fontSize: '14px', color: '#334155' }}>
                            <strong>{s.data}:</strong> {s.observacoes ? s.observacoes : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Sem anotação escrita.</span>}
                            {s.emConjuntoCom && (
                              <span style={{ marginLeft: '8px', backgroundColor: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>
                                👥 Com {s.emConjuntoCom}
                              </span>
                            )}
                            {tarefasFeitas && (
                              <div style={{ fontSize: '12px', color: '#166534', marginTop: '4px' }}>
                                ✓ Rotina cumprida: {tarefasFeitas}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* GRÁFICO 2: GRÁFICO DE LINHA COM COLUNA DE EMOÇÕES FIXA E RESPONSIVIDADE INTELIGENTE */}
            {sessoesCronologicas.length > 0 && (
              <div style={{ backgroundColor: 'rgba(255,255,255,0.85)', padding: isMobile ? '22px 12px' : '35px 30px', borderRadius: '25px', marginBottom: '30px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                  <div style={{ textAlign: isMobile ? 'center' : 'left' }}>
                    <h3 style={{ color: '#2c3e50', fontSize: isMobile ? '19px' : '22px', margin: '0 0 4px 0' }}>
                      📈 Curva de Oscilação e Evolução Emocional
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                      Toque em qualquer ponto da linha para abrir o resumo daquele dia.
                    </p>
                  </div>

                  {sessoesCronologicas.length > limitePadraoLinha && (
                    <button
                      onClick={() => setMostrarTodasSessoesLinha(!mostrarTodasSessoesLinha)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '12px',
                        border: '1px solid #3b82f6',
                        backgroundColor: mostrarTodasSessoesLinha ? '#3b82f6' : '#eff6ff',
                        color: mostrarTodasSessoesLinha ? '#fff' : '#1d4ed8',
                        fontWeight: 'bold',
                        fontSize: '12px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {mostrarTodasSessoesLinha 
                        ? `Mostrando todas (${sessoesCronologicas.length}) • Ver últimas ${limitePadraoLinha}` 
                        : `Exibindo últimas ${limitePadraoLinha} • Ver todas (${sessoesCronologicas.length})`}
                    </button>
                  )}
                </div>

                {(() => {
                  const alturaGrafico = 240;
                  const margemTopo = 28;
                  const alturaUtil = 155;
                  const obterYPx = (nivel) => margemTopo + ((6 - nivel) / 5) * alturaUtil;

                  const totalPontos = sessoesParaGraficoLinha.length;
                  const obterXPct = (idx) => {
                    if (totalPontos === 1) return 50;
                    return 8 + (idx / (totalPontos - 1)) * 84;
                  };

                  const precisaRolagem = isMobile ? totalPontos > 5 : totalPontos > 10;
                  const larguraMinimaTrilha = precisaRolagem 
                    ? `${totalPontos * (isMobile ? 62 : 70)}px` 
                    : '100%';

                  const pontosCalculados = sessoesParaGraficoLinha.map((sessao, idx) => {
                    const emoNormalizada = sessao.emocao === 'Feliz' ? 'Feliz!' : sessao.emocao;
                    const infoCor = coresEmocoes[emoNormalizada] || coresEmocoes['Não informada'];
                    const partes = extrairPartesData(sessao.data);
                    return {
                      sessao,
                      emo: emoNormalizada,
                      infoCor,
                      xPct: obterXPct(idx),
                      yPx: obterYPx(infoCor.nivel),
                      labelData: partes ? partes.dataCurta : sessao.data.substring(0, 5)
                    };
                  });

                  const stringPolilinha = pontosCalculados.map(p => `${p.xPct},${p.yPx}`).join(' ');

                  return (
                    <div style={{ display: 'flex', alignItems: 'stretch', border: '1px solid #e2e8f0', borderRadius: '18px', backgroundColor: '#fff', overflow: 'hidden' }}>
                      
                      {/* COLUNA ESQUERDA FIXA: Emoções sempre visíveis */}
                      <div style={{ width: isMobile ? '86px' : '105px', height: `${alturaGrafico}px`, position: 'relative', flexShrink: 0, backgroundColor: '#f8fafc', borderRight: '1px solid #e2e8f0', zIndex: 2 }}>
                        {niveisRegulacao.map(item => (
                          <div
                            key={item.nivel}
                            style={{
                              position: 'absolute',
                              top: `${obterYPx(item.nivel)}px`,
                              left: isMobile ? '6px' : '10px',
                              right: '4px',
                              transform: 'translateY(-50%)',
                              fontSize: isMobile ? '11px' : '12px',
                              fontWeight: 'bold',
                              color: '#475569',
                              whiteSpace: 'nowrap',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <span>{item.emoji}</span>
                            <span>{item.nome}</span>
                          </div>
                        ))}
                      </div>

                      {/* TRILHA DIREITA */}
                      <div style={{ flex: 1, overflowX: 'auto', position: 'relative' }}>
                        <div style={{ width: larguraMinimaTrilha, height: `${alturaGrafico}px`, position: 'relative' }}>
                          
                          <svg 
                            viewBox={`0 0 100 ${alturaGrafico}`} 
                            preserveAspectRatio="none" 
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: `${alturaGrafico}px`, pointerEvents: 'none' }}
                          >
                            {niveisRegulacao.map(item => {
                              const y = obterYPx(item.nivel);
                              return (
                                <line 
                                  key={item.nivel} 
                                  x1="0" 
                                  y1={y} 
                                  x2="100" 
                                  y2={y} 
                                  stroke="#e2e8f0" 
                                  strokeDasharray="4 4" 
                                  strokeWidth="1" 
                                  vectorEffect="non-scaling-stroke" 
                                />
                              );
                            })}

                            {pontosCalculados.length > 1 && (
                              <polyline
                                fill="none"
                                stroke="#3b82f6"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                vectorEffect="non-scaling-stroke"
                                points={stringPolilinha}
                              />
                            )}
                          </svg>

                          {pontosCalculados.map((p, idx) => {
                            const isPontoAtivo = pontoLinhaSelecionado && pontoLinhaSelecionado.id === p.sessao.id;
                            return (
                              <div key={p.sessao.id || idx}>
                                <button
                                  type="button"
                                  onClick={() => setPontoLinhaSelecionado(isPontoAtivo ? null : p.sessao)}
                                  title={`${p.sessao.data} - ${p.emo}`}
                                  style={{
                                    position: 'absolute',
                                    left: `${p.xPct}%`,
                                    top: `${p.yPx}px`,
                                    transform: 'translate(-50%, -50%)',
                                    width: isPontoAtivo ? '30px' : '24px',
                                    height: isPontoAtivo ? '30px' : '24px',
                                    borderRadius: '50%',
                                    backgroundColor: p.infoCor.chart,
                                    border: isPontoAtivo ? '3px solid #1d4ed8' : `2px solid ${p.infoCor.border}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: isPontoAtivo ? '14px' : '12px',
                                    cursor: 'pointer',
                                    padding: 0,
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                    transition: 'all 0.15s',
                                    zIndex: isPontoAtivo ? 3 : 1
                                  }}
                                >
                                  {p.infoCor.emoji}
                                </button>

                                <span
                                  style={{
                                    position: 'absolute',
                                    left: `${p.xPct}%`,
                                    top: '208px',
                                    transform: 'translateX(-50%)',
                                    fontSize: '11px',
                                    fontWeight: isPontoAtivo ? 'bold' : '600',
                                    color: isPontoAtivo ? '#1d4ed8' : '#64748b',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {p.labelData}
                                </span>
                              </div>
                            );
                          })}

                        </div>
                      </div>

                    </div>
                  );
                })()}

                {pontoLinhaSelecionado && (
                  <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#eff6ff', borderRadius: '15px', border: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div>
                      <strong style={{ color: '#1e3a8a', fontSize: '15px', display: 'block', marginBottom: '4px' }}>
                        📌 Sessão de {pontoLinhaSelecionado.data} — Emoção: {pontoLinhaSelecionado.emocao}
                      </strong>
                      {pontoLinhaSelecionado.emConjuntoCom && (
                        <span style={{ display: 'inline-block', marginBottom: '6px', backgroundColor: '#fef3c7', color: '#b45309', padding: '3px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold' }}>
                          👥 Atendimento em conjunto com: {pontoLinhaSelecionado.emConjuntoCom}
                        </span>
                      )}
                      <p style={{ margin: 0, fontSize: '14px', color: '#334155' }}>
                        {pontoLinhaSelecionado.observacoes || 'Sem observações anotadas nesta sessão.'}
                      </p>
                    </div>
                    <button onClick={() => setPontoLinhaSelecionado(null)} style={{ background: 'none', border: 'none', fontSize: '18px', color: '#64748b', cursor: 'pointer' }}>×</button>
                  </div>
                )}
              </div>
            )}

            {/* LISTAGEM DE SESSÕES DO DIA */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
              <h3 style={{ color: '#2c3e50', fontSize: '22px', margin: 0 }}>
                Detalhamento por Dia{' '}
                <span style={{ fontSize: '16px', color: '#64748b', fontWeight: 'normal' }}>
                  ({sessoesExibidasNaLista.length} {sessoesExibidasNaLista.length === 1 ? 'sessão' : 'sessões'})
                </span>
              </h3>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {sessaoIdDaAgenda && (
                  <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📌 Consulta selecionada na Agenda
                    <button onClick={() => setSearchParams({})} style={{ background: 'none', border: 'none', color: '#166534', fontWeight: 'bold', cursor: 'pointer', padding: 0 }} title="Mostrar todas as consultas">✕</button>
                  </span>
                )}

                {emocaoSelecionadaGrafico && (
                  <span style={{ backgroundColor: '#dbeafe', color: '#1e40af', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Filtrando por: {coresEmocoes[emocaoSelecionadaGrafico]?.emoji} {emocaoSelecionadaGrafico}
                    <button onClick={() => setEmocaoSelecionadaGrafico(null)} style={{ background: 'none', border: 'none', color: '#1e40af', fontWeight: 'bold', cursor: 'pointer', padding: 0 }}>✕</button>
                  </span>
                )}
              </div>
            </div>
            
            {sessoesExibidasNaLista.length === 0 ? (
              <p style={{ color: '#64748b', fontStyle: 'italic', backgroundColor: 'rgba(255,255,255,0.7)', padding: '25px', borderRadius: '20px', textAlign: 'center' }}>
                Nenhuma sessão encontrada para este filtro ou período.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {sessoesDaPagina.map((sessao) => {
                  const corDaEmocao = coresEmocoes[sessao.emocao] || coresEmocoes['Não informada'];
                  
                  const isExpandida = notasExpandidas[sessao.id];
                  const textoLongo = sessao.observacoes && sessao.observacoes.length > 150;
                  const textoExibido = (textoLongo && !isExpandida) 
                    ? sessao.observacoes.substring(0, 150) + '...' 
                    : sessao.observacoes;

                  const estaEditandoEstaSessao = String(sessaoEditandoId) === String(sessao.id);

                  return (
                    <div key={sessao.id} style={{ border: 'none', borderRadius: '20px', padding: isMobile ? '20px' : '25px', backgroundColor: 'rgba(255,255,255,0.8)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                      {estaEditandoEstaSessao ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                            <strong style={{ fontSize: '17px', color: '#1e3a8a' }}>✏️ Editando Registro da Sessão</strong>
                            <button onClick={() => setSessaoEditandoId(null)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '18px', cursor: 'pointer' }}>✕</button>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr 1fr 1.2fr', gap: '12px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>Data da Consulta:</label>
                              <input
                                type="date"
                                value={formEdicaoSessao.dataISO}
                                onChange={(e) => setFormEdicaoSessao({ ...formEdicaoSessao, dataISO: e.target.value })}
                                style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>Início:</label>
                              <input
                                type="time"
                                value={formEdicaoSessao.horaInicio}
                                onChange={(e) => setFormEdicaoSessao({ ...formEdicaoSessao, horaInicio: e.target.value })}
                                style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>Término:</label>
                              <input
                                type="time"
                                value={formEdicaoSessao.horaFim}
                                onChange={(e) => setFormEdicaoSessao({ ...formEdicaoSessao, horaFim: e.target.value })}
                                style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>Emoção:</label>
                              <select
                                value={formEdicaoSessao.emocao}
                                onChange={(e) => setFormEdicaoSessao({ ...formEdicaoSessao, emocao: e.target.value })}
                                style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', backgroundColor: '#fff', boxSizing: 'border-box' }}
                              >
                                {opcoesEmocoesEdicao.map(emoOp => (
                                  <option key={emoOp} value={emoOp}>{coresEmocoes[emoOp]?.emoji} {emoOp}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>Anotações da Terapeuta:</label>
                            <textarea
                              rows="4"
                              value={formEdicaoSessao.observacoes}
                              onChange={(e) => setFormEdicaoSessao({ ...formEdicaoSessao, observacoes: e.target.value })}
                              placeholder="Observações da sessão..."
                              style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '15px', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'sans-serif' }}
                            />
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button
                              type="button"
                              onClick={() => setSessaoEditandoId(null)}
                              style={{ padding: '8px 16px', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => salvarEdicaoSessao(sessao.id)}
                              style={{ padding: '8px 20px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}
                            >
                              💾 Salvar Alterações
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '15px', gap: '10px' }}>
                            <strong style={{ fontSize: '18px', color: '#2c3e50' }}>{sessao.data}</strong>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              {sessao.emConjuntoCom && (
                                <span style={{ fontSize: '14px', backgroundColor: '#fef3c7', padding: '6px 14px', borderRadius: '20px', color: '#b45309', fontWeight: 'bold' }}>
                                  👥 Em conjunto com: {sessao.emConjuntoCom}
                                </span>
                              )}
                              <span style={{ fontSize: '16px', backgroundColor: corDaEmocao.bg, padding: '6px 16px', borderRadius: '20px', color: corDaEmocao.text, fontWeight: 'bold' }}>
                                {corDaEmocao.emoji} Emoção: {sessao.emocao}
                              </span>
                              <button
                                onClick={() => abrirEdicaoSessao(sessao)}
                                title="Editar data, horário, emoção ou anotações desta sessão"
                                style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', padding: '6px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                              >
                                ✏️ Editar
                              </button>
                              <button
                                onClick={() => excluirSessaoHistorico(sessao)}
                                title="Excluir esta sessão do prontuário"
                                style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '6px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                          
                          <h4 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#4a5568' }}>Atividades da Rotina:</h4>
                          {sessao.tarefas && sessao.tarefas.length > 0 ? (
                            <ul style={{ margin: 0, paddingLeft: '20px', color: '#334155' }}>
                              {sessao.tarefas.map(tarefa => (
                                <li key={tarefa.id} style={{ textDecoration: tarefa.concluida ? 'line-through' : 'none', color: tarefa.concluida ? '#94a3b8' : '#334155', marginBottom: '6px', fontSize: '16px', wordBreak: 'break-word' }}>
                                  {tarefa.texto} {tarefa.concluida && ' ✓'}
                                </li>
                              ))}
                            </ul>
                          ) : (<p style={{ margin: 0, color: '#94a3b8', fontSize: '15px' }}>Nenhuma atividade registrada neste dia.</p>)}

                          {sessao.observacoes && (
                            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8fafc', borderRadius: '12px', borderLeft: '4px solid #3b82f6' }}>
                              <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
                                📝 Anotações da Terapeuta
                              </h4>
                              <p style={{ margin: 0, fontSize: '16px', color: '#334155', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {textoExibido}
                              </p>
                              {textoLongo && (
                                <button 
                                  onClick={() => toggleExpandirNota(sessao.id)}
                                  style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: 'bold', cursor: 'pointer', padding: '8px 0 0 0', fontSize: '14px', display: 'inline-block' }}
                                >
                                  {isExpandida ? 'Ver menos' : 'Ler mais...'}
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}

                {totalPaginas > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: isMobile ? '8px' : '15px', marginTop: '20px', padding: '10px', flexWrap: 'wrap' }}>
                    <button disabled={paginaAtual === 1} onClick={() => setPaginaAtual(1)} style={{ padding: '10px 15px', backgroundColor: paginaAtual === 1 ? 'transparent' : '#fff', border: paginaAtual === 1 ? '1px solid #cbd5e1' : 'none', borderRadius: '15px', color: paginaAtual === 1 ? '#94a3b8' : '#2c3e50', cursor: paginaAtual === 1 ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>«</button>
                    <button disabled={paginaAtual === 1} onClick={() => setPaginaAtual(prev => prev - 1)} style={{ padding: '10px 15px', backgroundColor: paginaAtual === 1 ? 'transparent' : '#fff', border: paginaAtual === 1 ? '1px solid #cbd5e1' : 'none', borderRadius: '15px', color: paginaAtual === 1 ? '#94a3b8' : '#2c3e50', cursor: paginaAtual === 1 ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>‹</button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#4a5568', fontWeight: 'bold', fontSize: '15px', display: isMobile ? 'none' : 'inline' }}>Pág</span>
                      <select value={paginaAtual} onChange={(e) => setPaginaAtual(Number(e.target.value))} style={{ padding: '8px 12px', borderRadius: '12px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '16px', fontWeight: 'bold', color: '#2c3e50', cursor: 'pointer', outline: 'none' }}>
                        {Array.from({ length: totalPaginas }, (_, i) => i + 1).map(num => (<option key={num} value={num}>{num}</option>))}
                      </select>
                      <span style={{ color: '#4a5568', fontWeight: 'bold', fontSize: '15px' }}>de {totalPaginas}</span>
                    </div>
                    <button disabled={paginaAtual === totalPaginas} onClick={() => setPaginaAtual(prev => prev + 1)} style={{ padding: '10px 15px', backgroundColor: paginaAtual === totalPaginas ? 'transparent' : '#fff', border: paginaAtual === totalPaginas ? '1px solid #cbd5e1' : 'none', borderRadius: '15px', color: paginaAtual === totalPaginas ? '#94a3b8' : '#2c3e50', cursor: paginaAtual === totalPaginas ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>›</button>
                    <button disabled={paginaAtual === totalPaginas} onClick={() => setPaginaAtual(totalPaginas)} style={{ padding: '10px 15px', backgroundColor: paginaAtual === totalPaginas ? 'transparent' : '#fff', border: paginaAtual === totalPaginas ? '1px solid #cbd5e1' : 'none', borderRadius: '15px', color: paginaAtual === totalPaginas ? '#94a3b8' : '#2c3e50', cursor: paginaAtual === totalPaginas ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>»</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ABA 2: FINANCEIRO E RESPONSÁVEIS */}
        {abaAtiva === 'financeiro' && (
          <div style={{ backgroundColor: 'rgba(255,255,255,0.85)', padding: isMobile ? '20px' : '40px', borderRadius: '25px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '22px' }}>Responsáveis e Acordo Financeiro</h3>
              {!editandoFinanceiro && (
                <button onClick={iniciarEdicaoFinanceiro} style={{ padding: '8px 15px', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
                  ✏️ Editar
                </button>
              )}
            </div>

            {editandoFinanceiro ? (
              <form onSubmit={salvarFinanceiro} style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 15px 0', color: '#4a5568', fontSize: '16px' }}>⭐ Contato Principal</h4>
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '15px', marginBottom: '15px' }}>
                    <div style={{ flex: 2 }}>
                      <label style={{ display: 'block', color: '#64748b', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>NOME COMPLETO *</label>
                      <input type="text" placeholder="Ex: Roberto da Silva" value={dadosForm.responsavel1} onChange={(e) => setDadosForm({...dadosForm, responsavel1: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', boxSizing: 'border-box' }} required />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', color: '#64748b', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>PARENTESCO *</label>
                      <input type="text" placeholder="Ex: Pai, Avó..." value={dadosForm.parentesco1} onChange={(e) => setDadosForm({...dadosForm, parentesco1: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', boxSizing: 'border-box' }} required />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#64748b', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>WHATSAPP / TELEFONE *</label>
                    <input type="text" placeholder="(XX) XXXXX-XXXX" value={dadosForm.telefone1} onChange={(e) => handleTelefone(e, 'telefone1')} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', boxSizing: 'border-box' }} required />
                  </div>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 15px 0', color: '#4a5568', fontSize: '16px' }}>Contato Secundário (Opcional)</h4>
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '15px', marginBottom: '15px' }}>
                    <div style={{ flex: 2 }}>
                      <label style={{ display: 'block', color: '#64748b', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>NOME</label>
                      <input type="text" placeholder="Ex: Maria Souza" value={dadosForm.responsavel2} onChange={(e) => setDadosForm({...dadosForm, responsavel2: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', color: '#64748b', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>PARENTESCO</label>
                      <input type="text" placeholder="Ex: Mãe" value={dadosForm.parentesco2} onChange={(e) => setDadosForm({...dadosForm, parentesco2: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#64748b', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>WHATSAPP / TELEFONE</label>
                    <input type="text" placeholder="(XX) XXXXX-XXXX" value={dadosForm.telefone2} onChange={(e) => handleTelefone(e, 'telefone2')} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', boxSizing: 'border-box' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '20px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', color: '#64748b', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>VALOR POR SESSÃO</label>
                    <input type="text" placeholder="R$ 0,00" value={dadosForm.valorSessao} onChange={handleMoeda} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', color: '#64748b', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>DIA DE VENCIMENTO</label>
                    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '0 12px' }}>
                      <span style={{ color: '#94a3b8', marginRight: '5px' }}>Todo dia</span>
                      <input type="text" placeholder="10" value={dadosForm.vencimento} onChange={handleDia} style={{ width: '100%', padding: '12px 0', border: 'none', outline: 'none', fontSize: '15px', backgroundColor: 'transparent' }} />
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', color: '#64748b', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>OBSERVAÇÕES (Dinâmica familiar, acordos, etc)</label>
                  <textarea rows="4" placeholder="Adicione notas importantes..." value={dadosForm.observacoes} onChange={(e) => setDadosForm({...dadosForm, observacoes: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>

                <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button type="button" onClick={() => setEditandoFinanceiro(false)} style={{ padding: '12px 20px', backgroundColor: 'transparent', color: '#64748b', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>Cancelar</button>
                  <button type="submit" style={{ padding: '12px 30px', backgroundColor: '#4ade80', color: '#166534', border: 'none', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>💾 Salvar Dados</button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '30px' }}>
                  <div style={{ flex: 1, backgroundColor: '#f8fafc', padding: '20px', borderRadius: '15px', borderLeft: '4px solid #4ade80' }}>
                    <span style={{ display: 'block', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', marginBottom: '10px' }}>Contato Principal</span>
                    {paciente.financeiro?.responsavel1 ? (
                      <>
                        <strong style={{ display: 'block', fontSize: '18px', color: '#334155', marginBottom: '4px' }}>{paciente.financeiro.responsavel1} <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 'normal' }}>({paciente.financeiro.parentesco1})</span></strong>
                        <span style={{ fontSize: '16px', color: '#4a5568' }}>📞 {paciente.financeiro.telefone1}</span>
                      </>
                    ) : (
                      <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Não preenchido</span>
                    )}
                  </div>
                  <div style={{ flex: 1, backgroundColor: '#f8fafc', padding: '20px', borderRadius: '15px', borderLeft: '4px solid #cbd5e1' }}>
                    <span style={{ display: 'block', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', marginBottom: '10px' }}>Contato Secundário</span>
                    {paciente.financeiro?.responsavel2 ? (
                      <>
                        <strong style={{ display: 'block', fontSize: '18px', color: '#334155', marginBottom: '4px' }}>{paciente.financeiro.responsavel2} <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 'normal' }}>({paciente.financeiro.parentesco2})</span></strong>
                        <span style={{ fontSize: '16px', color: '#4a5568' }}>📞 {paciente.financeiro.telefone2}</span>
                      </>
                    ) : (
                      <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Não preenchido</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', marginBottom: '4px' }}>Valor da Sessão</span>
                    <strong style={{ fontSize: '20px', color: '#2e7d32' }}>{paciente.financeiro?.valorSessao || 'Não definido'}</strong>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', marginBottom: '4px' }}>Vencimento</span>
                    <strong style={{ fontSize: '20px', color: '#334155' }}>{paciente.financeiro?.vencimento ? `Todo dia ${paciente.financeiro.vencimento}` : 'Não definido'}</strong>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                  <span style={{ display: 'block', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', marginBottom: '8px' }}>Observações Gerais</span>
                  <p style={{ margin: 0, fontSize: '16px', color: paciente.financeiro?.observacoes ? '#4a5568' : '#94a3b8', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {paciente.financeiro?.observacoes || 'Nenhuma observação registrada.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
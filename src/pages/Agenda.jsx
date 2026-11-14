import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, doc, updateDoc, arrayRemove } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, obterNomeColecao } from '../firebase';

const DATA_INICIAL_AGENDA = new Date();

export default function Agenda() {
  const navigate = useNavigate();
  const [colecaoAtual, setColecaoAtual] = useState(obterNomeColecao());
  const [pacientes, setPacientes] = useState([]);
  const [dataAtual, setDataAtual] = useState(DATA_INICIAL_AGENDA);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const [modalAberto, setModalAberto] = useState(false);
  const [diaSelecionado, setDiaSelecionado] = useState('');
  const [modoAgendamento, setModoAgendamento] = useState(false); 
  
  const [formAgendamento, setFormAgendamento] = useState({
    pacientesIds: [''],
    hora: '',
    semanasRepeticao: 1
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
    const unsub = onSnapshot(collection(db, colecaoAtual), (snapshot) => {
      const lista = snapshot.docs.map(documento => ({ id: documento.id, ...documento.data() }));
      setPacientes(lista);
    });
    return () => unsub();
  }, [colecaoAtual]);

  // Trava a rolagem da tela de fundo quando a janelinha da agenda abrir
  useEffect(() => {
    if (modalAberto) {
      document.body.style.overflow = 'hidden'; 
    } else {
      document.body.style.overflow = 'unset';  
    }

    return () => {
      document.body.style.overflow = 'unset'; 
    };
  }, [modalAberto]);

  const ano = dataAtual.getFullYear();
  const mes = dataAtual.getMonth();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const primeiroDiaDaSemana = new Date(ano, mes, 1).getDay(); 

  const diasDaSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const nomesDiasSemanaCompletos = [
    'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
    'quinta-feira', 'sexta-feira', 'sábado'
  ];

  const formatarDataBR = (dia) => {
    const d = dia.toString().padStart(2, '0');
    const m = (mes + 1).toString().padStart(2, '0');
    return `${d}/${m}/${ano}`;
  };

  const obterNomeDiaSemanaDeDataBR = (dataStr) => {
    if (!dataStr || !dataStr.includes('/')) return '';
    const [d, m, y] = dataStr.split('/').map(Number);
    const dataObj = new Date(y, m - 1, d);
    return nomesDiasSemanaCompletos[dataObj.getDay()] || '';
  };

  const gerarDatasSemanais = (dataInicialBR, qtdSemanas) => {
    const [d, m, y] = dataInicialBR.split('/').map(Number);
    const datas = [];
    for (let s = 0; s < qtdSemanas; s++) {
      const dataFutura = new Date(y, m - 1, d + s * 7);
      const diaFmt = String(dataFutura.getDate()).padStart(2, '0');
      const mesFmt = String(dataFutura.getMonth() + 1).padStart(2, '0');
      const anoFmt = dataFutura.getFullYear();
      datas.push(`${diaFmt}/${mesFmt}/${anoFmt}`);
    }
    return datas;
  };

  const converterBRParaTimestamp = (dataStr) => {
    if (!dataStr || !dataStr.includes('/')) return 0;
    const [d, m, y] = dataStr.split('/').map(Number);
    return new Date(y, m - 1, d).getTime();
  };

  const mudarMes = (direcao) => {
    setDataAtual(new Date(ano, mes + direcao, 1));
  };

  const verificarSePassou = (dataStr) => {
    if (!dataStr) return false;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const [d, m, y] = dataStr.split('/');
    const dataClicada = new Date(y, m - 1, d);
    return dataClicada < hoje;
  };

  const extrairHorarioSessao = (dataStr) => {
    if (!dataStr || !dataStr.includes(' - ')) return 'Horário não registrado';
    return dataStr.split(' - ')[1];
  };

  const extrairHoraParaOrdenacao = (textoHorario) => {
    if (!textoHorario) return '99:99';
    const match = textoHorario.match(/\d{2}:\d{2}/);
    return match ? match[0] : '99:99';
  };

  const abrirModalDia = (dataString) => {
    setDiaSelecionado(dataString);
    setModoAgendamento(false); 
    setFormAgendamento({ pacientesIds: [''], hora: '', semanasRepeticao: 1 });
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setModoAgendamento(false);
    setFormAgendamento({ pacientesIds: [''], hora: '', semanasRepeticao: 1 });
  };

  const atualizarPacienteNoForm = (index, valor) => {
    const novaLista = [...formAgendamento.pacientesIds];
    novaLista[index] = valor;
    setFormAgendamento({ ...formAgendamento, pacientesIds: novaLista });
  };

  const adicionarCampoCrianca = () => {
    setFormAgendamento({
      ...formAgendamento,
      pacientesIds: [...formAgendamento.pacientesIds, '']
    });
  };

  const removerCampoCrianca = (index) => {
    const novaLista = formAgendamento.pacientesIds.filter((_, i) => i !== index);
    setFormAgendamento({ ...formAgendamento, pacientesIds: novaLista });
  };

  const atendimentosDoDia = [];
  const agendamentosFuturosDoDia = [];

  if (modalAberto) {
    pacientes.forEach(pac => {
      if (pac.historico) {
        pac.historico.forEach(sessao => {
          if (sessao.data && sessao.data.startsWith(diaSelecionado)) {
            const horarioExtraido = extrairHorarioSessao(sessao.data);
            atendimentosDoDia.push({ 
              paciente: pac, 
              sessao, 
              horarioTexto: horarioExtraido,
              horaOrdenacao: extrairHoraParaOrdenacao(horarioExtraido)
            });
          }
        });
      }
      if (pac.agendamentos) {
        pac.agendamentos.forEach(agd => {
          if (agd.data === diaSelecionado) {
            agendamentosFuturosDoDia.push({ 
              paciente: pac, 
              agendamento: agd,
              horaOrdenacao: agd.hora || '99:99'
            });
          }
        });
      }
    });

    agendamentosFuturosDoDia.sort((a, b) => a.horaOrdenacao.localeCompare(b.horaOrdenacao));
    atendimentosDoDia.sort((a, b) => a.horaOrdenacao.localeCompare(b.horaOrdenacao));
  }

  const salvarAgendamento = async (e) => {
    e.preventDefault();

    const idsPreenchidos = formAgendamento.pacientesIds.filter(id => id.trim() !== '');

    if (idsPreenchidos.length === 0 || !formAgendamento.hora) {
      alert("Por favor, selecione pelo menos uma criança e o horário.");
      return;
    }

    if (idsPreenchidos.length !== formAgendamento.pacientesIds.length) {
      alert("Por favor, selecione a criança em todos os campos abertos ou remova o campo vazio.");
      return;
    }

    const idsUnicos = [...new Set(idsPreenchidos)];
    if (idsUnicos.length !== idsPreenchidos.length) {
      alert("Você selecionou a mesma criança mais de uma vez para o mesmo horário.");
      return;
    }

    const qtdSemanas = Number(formAgendamento.semanasRepeticao) || 1;
    const datasParaAgendar = gerarDatasSemanais(diaSelecionado, qtdSemanas);

    const criancaJaAgendadaNoDia = agendamentosFuturosDoDia.find(
      item => idsUnicos.includes(item.paciente.id) && item.agendamento.hora === formAgendamento.hora
    );
    if (criancaJaAgendadaNoDia) {
      alert(`${criancaJaAgendadaNoDia.paciente.nome} já possui um agendamento marcado às ${formAgendamento.hora} neste dia.`);
      return;
    }

    const conflitosNoMesmoHorario = agendamentosFuturosDoDia.filter(
      item => item.agendamento.hora === formAgendamento.hora
    );

    if (conflitosNoMesmoHorario.length > 0) {
      const nomesConflito = conflitosNoMesmoHorario.map(c => c.paciente.nome).join(', ');
      const confirmarConflito = window.confirm(
        `⚠️ Conflito de Horário!\n\nJá existe atendimento marcado às ${formAgendamento.hora} para: ${nomesConflito}.\n\nDeseja agendar no mesmo horário mesmo assim (atendimento em conjunto/grupo)?`
      );
      if (!confirmarConflito) return;
    }

    try {
      const nomeCol = obterNomeColecao();
      await Promise.all(
        idsUnicos.map((pacId) => {
          const pacObj = pacientes.find(p => p.id === pacId);
          const agendamentosAtuais = [...(pacObj?.agendamentos || [])];
          let maiorIdAtual = agendamentosAtuais.reduce(
            (maior, item) => Math.max(maior, Number(item.id) || 0),
            0
          );

          datasParaAgendar.forEach((dataAlvo) => {
            const jaExisteNaData = agendamentosAtuais.some(
              a => a.data === dataAlvo && a.hora === formAgendamento.hora
            );
            if (!jaExisteNaData) {
              maiorIdAtual += 1;
              agendamentosAtuais.push({
                id: maiorIdAtual,
                data: dataAlvo,
                hora: formAgendamento.hora,
                ...(qtdSemanas > 1 ? { recorrente: true } : {})
              });
            }
          });

          const docRef = doc(db, nomeCol, pacId);
          return updateDoc(docRef, {
            agendamentos: agendamentosAtuais
          });
        })
      );
      setModoAgendamento(false); 
      setFormAgendamento({ pacientesIds: [''], hora: '', semanasRepeticao: 1 });
    } catch (error) {
      console.error("Detalhes da falha:", error);
      alert("Houve um erro ao salvar o agendamento.");
    }
  };

  const registrarFaltaAgendamento = async (pacienteObj, agendamentoObj, colegasNomes = []) => {
    const motivoDigitado = window.prompt(
      `Registrar FALTA para ${pacienteObj.nome} em ${agendamentoObj.data} às ${agendamentoObj.hora}.\n\nDeseja anotar o motivo ou observação da falta? (Opcional — deixe em branco se não houver):`,
      ""
    );

    if (motivoDigitado === null) return;

    const novoIdHistorico = (pacienteObj.historico || []).reduce(
      (maior, item) => Math.max(maior, Number(item.id) || 0),
      0
    ) + 1;

    const dataFormatada = agendamentoObj.hora
      ? `${agendamentoObj.data} - A partir das ${agendamentoObj.hora}`
      : agendamentoObj.data;

    const registroFalta = {
      id: novoIdHistorico,
      data: dataFormatada,
      emocao: 'Falta',
      tarefas: [],
      observacoes: motivoDigitado.trim() || 'Paciente não compareceu à sessão agendada.',
      ...(colegasNomes.length > 0 ? { emConjuntoCom: colegasNomes.join(', ') } : {})
    };

    try {
      const docRef = doc(db, obterNomeColecao(), pacienteObj.id);
      await updateDoc(docRef, {
        historico: [...(pacienteObj.historico || []), registroFalta],
        agendamentos: arrayRemove(agendamentoObj)
      });
    } catch (error) {
      console.error("Erro ao registrar falta:", error);
      alert("Não foi possível registrar a falta.");
    }
  };

  const cancelarAgendamento = async (pacienteObj, agendamentoObj) => {
    const tsAlvo = converterBRParaTimestamp(agendamentoObj.data);
    const diaSemanaAlvo = obterNomeDiaSemanaDeDataBR(agendamentoObj.data);

    // Verifica se existem outros agendamentos futuros da mesma criança no mesmo dia da semana e horário
    const outrosDaMesmaSerie = (pacienteObj.agendamentos || []).filter(a => {
      if (a.id === agendamentoObj.id) return false;
      const tsItem = converterBRParaTimestamp(a.data);
      const mesmoDiaSemana = obterNomeDiaSemanaDeDataBR(a.data) === diaSemanaAlvo;
      return tsItem > tsAlvo && mesmoDiaSemana && a.hora === agendamentoObj.hora;
    });

    if (outrosDaMesmaSerie.length > 0) {
      const apagarSerie = window.confirm(
        `${pacienteObj.nome} possui mais ${outrosDaMesmaSerie.length} agendamento(s) futuro(s) toda ${diaSemanaAlvo} às ${agendamentoObj.hora}.\n\nClique em "OK" para desmarcar APENAS o dia ${agendamentoObj.data}.\nSe quiser cancelar também todas as próximas semanas desse horário, clique em "Cancelar" para ver a opção de série.`
      );

      if (!apagarSerie) {
        const confirmarTodaSerie = window.confirm(
          `Deseja desmarcar o dia ${agendamentoObj.data} E todas as ${outrosDaMesmaSerie.length} semanas seguintes de ${pacienteObj.nome} (${diaSemanaAlvo} às ${agendamentoObj.hora})?`
        );
        if (!confirmarTodaSerie) return;

        try {
          const idsParaRemover = new Set([agendamentoObj.id, ...outrosDaMesmaSerie.map(o => o.id)]);
          const novaLista = (pacienteObj.agendamentos || []).filter(a => !idsParaRemover.has(a.id));
          const docRef = doc(db, obterNomeColecao(), pacienteObj.id);
          await updateDoc(docRef, { agendamentos: novaLista });
        } catch (error) {
          console.error("Erro ao desmarcar série:", error);
          alert("Erro ao desmarcar agendamentos.");
        }
        return;
      }
    } else {
      const confirmar = window.confirm("Deseja realmente desmarcar e excluir este agendamento?");
      if (!confirmar) return;
    }

    try {
      const docRef = doc(db, obterNomeColecao(), pacienteObj.id);
      await updateDoc(docRef, {
        agendamentos: arrayRemove(agendamentoObj)
      });
    } catch (error) {
      console.error("Detalhes da falha:", error);
      alert("Erro ao desmarcar.");
    }
  };

  // Agrupa PACIENTES DIFERENTES por horário para só marcar "Em conjunto" quando houver mais de uma criança distinta
  const pacientesUnicosPorHorario = {};
  agendamentosFuturosDoDia.forEach(item => {
    const h = item.agendamento.hora;
    if (h) {
      if (!pacientesUnicosPorHorario[h]) pacientesUnicosPorHorario[h] = new Map();
      pacientesUnicosPorHorario[h].set(item.paciente.id, `${item.paciente.avatar} ${item.paciente.nome}`);
    }
  });
  atendimentosDoDia.forEach(item => {
    const h = item.horaOrdenacao;
    if (h && h !== '99:99') {
      if (!pacientesUnicosPorHorario[h]) pacientesUnicosPorHorario[h] = new Map();
      pacientesUnicosPorHorario[h].set(item.paciente.id, `${item.paciente.avatar} ${item.paciente.nome}`);
    }
  });

  const isDiaModalPassado = verificarSePassou(diaSelecionado);
  const nomeDiaSemanaModal = obterNomeDiaSemanaDeDataBR(diaSelecionado);

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #cde4ff 0%, #d8f5d4 100%)', padding: isMobile ? '10px' : '30px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        <div style={{ marginBottom: '15px' }}>
          <button onClick={() => navigate('/pacientes')} style={{ background: 'none', border: 'none', color: '#4a5568', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', padding: '0', display: 'flex', alignItems: 'center', gap: '5px' }}>
            ← Voltar para Pacientes
          </button>
        </div>

        <header style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: 'center', gap: isMobile ? '15px' : '0', marginBottom: '20px', backgroundColor: 'rgba(255,255,255,0.6)', padding: '15px', borderRadius: '25px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '24px' }}>📅</div> 
            <h1 style={{ margin: 0, fontSize: '22px', color: '#2c3e50', fontWeight: 'bold' }}>Agenda Clínica</h1>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={() => mudarMes(-1)} style={{ padding: '8px 12px', borderRadius: '12px', border: 'none', backgroundColor: '#fff', color: '#4a5568', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', fontSize: '16px' }}>
              {'<'}
            </button>
            
            <input 
              type="month" 
              value={`${ano}-${String(mes + 1).padStart(2, '0')}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-');
                if (y && m) setDataAtual(new Date(y, m - 1, 1));
              }}
              style={{ padding: '8px 10px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: isMobile ? '14px' : '16px', color: '#2c3e50', fontWeight: 'bold', backgroundColor: '#fff', cursor: 'pointer', fontFamily: 'sans-serif' }}
            />

            <button onClick={() => mudarMes(1)} style={{ padding: '8px 12px', borderRadius: '12px', border: 'none', backgroundColor: '#fff', color: '#4a5568', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', fontSize: '16px' }}>
              {'>'}
            </button>
          </div>
        </header>

        <div style={{ backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: '20px', padding: isMobile ? '10px' : '30px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isMobile ? '2px' : '10px', marginBottom: '10px', textAlign: 'center' }}>
              {diasDaSemana.map(dia => (
                <strong key={dia} style={{ color: '#64748b', fontSize: isMobile ? '10px' : '14px', textTransform: 'uppercase' }}>
                  {isMobile ? dia.substring(0, 1) : dia}
                </strong>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isMobile ? '4px' : '10px' }}>
              {Array.from({ length: primeiroDiaDaSemana }).map((_, i) => (
                <div key={`vazio-${i}`} style={{ minHeight: isMobile ? '60px' : '120px', backgroundColor: 'transparent' }} />
              ))}

              {Array.from({ length: diasNoMes }).map((_, index) => {
                const dia = index + 1;
                const dataStringStr = formatarDataBR(dia);
                const isHoje = dia === DATA_INICIAL_AGENDA.getDate() && mes === DATA_INICIAL_AGENDA.getMonth() && ano === DATA_INICIAL_AGENDA.getFullYear();
                const diaPassou = verificarSePassou(dataStringStr);

                const pacientesAtendidos = [];
                const pacientesFaltaram = [];
                const pacientesAgendados = [];

                pacientes.forEach(paciente => {
                  if (paciente.historico) {
                    const teveConcluida = paciente.historico.some(
                      s => s.data && s.data.startsWith(dataStringStr) && s.emocao !== 'Falta'
                    );
                    const teveFalta = paciente.historico.some(
                      s => s.data && s.data.startsWith(dataStringStr) && s.emocao === 'Falta'
                    );
                    if (teveConcluida) pacientesAtendidos.push(paciente);
                    if (teveFalta) pacientesFaltaram.push(paciente);
                  }
                  if (paciente.agendamentos && paciente.agendamentos.some(a => a.data === dataStringStr)) {
                    pacientesAgendados.push(paciente);
                  }
                });

                return (
                  <div 
                    key={dia} 
                    onClick={() => abrirModalDia(dataStringStr)}
                    style={{ 
                      minHeight: isMobile ? '60px' : '120px', 
                      backgroundColor: isHoje ? '#eff6ff' : '#fff', 
                      border: isHoje ? '2px solid #3b82f6' : '1px solid #e2e8f0', 
                      borderRadius: isMobile ? '8px' : '15px', 
                      padding: isMobile ? '4px' : '8px', 
                      display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                    }}
                    onMouseEnter={(e) => !isMobile && (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={(e) => !isMobile && (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    <span style={{ fontWeight: 'bold', color: isHoje ? '#3b82f6' : '#94a3b8', fontSize: isMobile ? '12px' : '14px', marginBottom: isMobile ? '4px' : '8px' }}>
                      {dia}
                    </span>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? '2px' : '6px' }}>
                      {pacientesAtendidos.map(pac => (
                        <div key={`h-${pac.id}`} title={`Concluído: ${pac.nome}`} style={{ position: 'relative' }}>
                          <div style={{ width: isMobile ? '18px' : '30px', height: isMobile ? '18px' : '30px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? '10px' : '18px', border: '1px solid #cbd5e1' }}>{pac.avatar}</div>
                          <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', backgroundColor: '#4ade80', width: isMobile ? '10px' : '14px', height: isMobile ? '10px' : '14px', borderRadius: '50%', border: '1px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? '6px' : '9px', color: '#166534', fontWeight: 'bold' }}>✓</div>
                        </div>
                      ))}
                      {pacientesFaltaram.map(pac => (
                        <div key={`f-${pac.id}`} title={`Falta registrada: ${pac.nome}`} style={{ position: 'relative' }}>
                          <div style={{ width: isMobile ? '18px' : '30px', height: isMobile ? '18px' : '30px', borderRadius: '50%', backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? '10px' : '18px', border: '1px solid #fca5a5' }}>{pac.avatar}</div>
                          <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', backgroundColor: '#ef4444', width: isMobile ? '10px' : '14px', height: isMobile ? '10px' : '14px', borderRadius: '50%', border: '1px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? '6px' : '8px', color: '#fff', fontWeight: 'bold' }}>✕</div>
                        </div>
                      ))}
                      {pacientesAgendados.map(pac => (
                        <div key={`a-${pac.id}`} title={diaPassou ? `Pendente (Não concluído): ${pac.nome}` : `Agendado: ${pac.nome}`} style={{ position: 'relative' }}>
                          <div style={{ width: isMobile ? '18px' : '30px', height: isMobile ? '18px' : '30px', borderRadius: '50%', backgroundColor: diaPassou ? '#fffbeb' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? '10px' : '18px', border: diaPassou ? '1px solid #f59e0b' : '1px solid #3b82f6' }}>{pac.avatar}</div>
                          <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', backgroundColor: diaPassou ? '#f59e0b' : '#3b82f6', width: isMobile ? '10px' : '14px', height: isMobile ? '10px' : '14px', borderRadius: '50%', border: '1px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? '7px' : '9px', color: '#fff', fontWeight: 'bold' }}>{diaPassou ? '!' : '🕒'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {modalAberto && (
          <div 
            onClick={fecharModal}
            style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', boxSizing: 'border-box' }}
          >
            <div 
              onClick={(e) => e.stopPropagation()} 
              style={{ backgroundColor: '#fff', padding: isMobile ? '20px' : '30px', borderRadius: '25px', width: '100%', maxWidth: '520px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', maxHeight: '90vh', overflowY: 'auto', overflowX: 'hidden', boxSizing: 'border-box' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ margin: '0 0 5px 0', color: '#2c3e50', fontSize: '22px' }}>
                    Dia {diaSelecionado} {nomeDiaSemanaModal && <span style={{ fontSize: '15px', color: '#64748b', fontWeight: 'normal' }}>({nomeDiaSemanaModal})</span>}
                  </h3>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                    {isDiaModalPassado ? 'Histórico de atendimentos passados' : 'Listagem de horários e compromissos do dia'}
                  </p>
                </div>
                <button onClick={fecharModal} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#94a3b8' }}>×</button>
              </div>

              {!modoAgendamento ? (
                <div>
                  {agendamentosFuturosDoDia.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: isDiaModalPassado ? '#d97706' : '#3b82f6', fontSize: '14px', textTransform: 'uppercase' }}>
                        {isDiaModalPassado ? '⚠️ Sessões Pendentes (Sem Baixa)' : '🕒 Sessões Agendadas'}
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {agendamentosFuturosDoDia.map(item => {
                          const mapaMesmoHorario = pacientesUnicosPorHorario[item.agendamento.hora];
                          const colegasNomes = [];
                          if (mapaMesmoHorario && mapaMesmoHorario.size > 1) {
                            mapaMesmoHorario.forEach((nomeAvatar, pacId) => {
                              if (pacId !== item.paciente.id) colegasNomes.push(nomeAvatar);
                            });
                          }
                          const emConjunto = colegasNomes.length > 0;

                          return (
                            <div key={item.agendamento.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', padding: '15px', backgroundColor: isDiaModalPassado ? '#fffbeb' : '#eff6ff', borderRadius: '15px', border: isDiaModalPassado ? '1px solid #fde68a' : (emConjunto ? '2px solid #93c5fd' : '1px solid #bfdbfe'), gap: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '26px' }}>{item.paciente.avatar}</span>
                                <div>
                                  <strong style={{ display: 'block', color: isDiaModalPassado ? '#92400e' : '#1e3a8a', fontSize: '16px' }}>{item.paciente.nome}</strong>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                                    <span style={{ backgroundColor: isDiaModalPassado ? '#fef3c7' : '#dbeafe', color: isDiaModalPassado ? '#b45309' : '#1d4ed8', padding: '3px 8px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold' }}>
                                      🕒 {item.agendamento.hora}
                                    </span>
                                    {item.agendamento.recorrente && (
                                      <span style={{ backgroundColor: '#e0e7ff', color: '#4338ca', padding: '3px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' }}>
                                        🔁 Semanal
                                      </span>
                                    )}
                                    {isDiaModalPassado && (
                                      <span style={{ backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d', padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' }}>
                                        ⚠️ Pendente
                                      </span>
                                    )}
                                    {emConjunto && (
                                      <span style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>
                                        👥 Com {colegasNomes.join(', ')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <button
                                  onClick={() => {
                                    fecharModal();
                                    navigate(`/perfil/${item.paciente.id}?dataAgendada=${encodeURIComponent(item.agendamento.data)}&horaAgendada=${encodeURIComponent(item.agendamento.hora)}`);
                                  }}
                                  style={{ backgroundColor: '#fff', border: isDiaModalPassado ? '1px solid #f59e0b' : '1px solid #93c5fd', color: isDiaModalPassado ? '#b45309' : '#1d4ed8', padding: '6px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                  title="Abrir Prontuário para iniciar ou lançar esta sessão na data agendada"
                                >
                                  📂 Prontuário
                                </button>
                                <button
                                  onClick={() => registrarFaltaAgendamento(item.paciente, item.agendamento, colegasNomes)}
                                  style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '6px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                  title="Marcar que o paciente faltou nesta sessão e salvar no histórico"
                                >
                                  🚫 Falta
                                </button>
                                <button onClick={() => cancelarAgendamento(item.paciente, item.agendamento)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#ef4444', padding: '5px' }} title="Desmarcar agendamento">
                                  🗑️
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {atendimentosDoDia.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#166534', fontSize: '14px', textTransform: 'uppercase' }}>✓ Registros do Dia (Concluídas e Faltas)</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {atendimentosDoDia.map(item => {
                          const textoConjunto = item.sessao.emConjuntoCom || '';
                          const isFalta = item.sessao.emocao === 'Falta';

                          return (
                            <div key={item.sessao.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px', backgroundColor: isFalta ? '#fef2f2' : '#f0fdf4', borderRadius: '15px', border: isFalta ? '1px solid #fecaca' : '1px solid #bbf7d0', gap: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '26px' }}>{item.paciente.avatar}</span>
                                <div>
                                  <strong style={{ display: 'block', color: isFalta ? '#991b1b' : '#14532d', fontSize: '16px' }}>{item.paciente.nome}</strong>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                                    <span style={{ backgroundColor: isFalta ? '#fee2e2' : '#dcfce7', color: isFalta ? '#b91c1c' : '#15803d', padding: '3px 8px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold' }}>
                                      🕒 {item.horarioTexto}
                                    </span>
                                    {isFalta ? (
                                      <span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '3px 8px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>
                                        🚫 Falta registrada
                                      </span>
                                    ) : (
                                      <span style={{ color: '#166534', fontSize: '13px', fontWeight: '500' }}>
                                        • Emoção: {item.sessao.emocao}
                                      </span>
                                    )}
                                    {textoConjunto && (
                                      <span style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>
                                        👥 Com {textoConjunto}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => {
                                  fecharModal();
                                  navigate(`/perfil/${item.paciente.id}?sessaoId=${item.sessao.id}`);
                                }}
                                style={{ backgroundColor: '#fff', border: isFalta ? '1px solid #fca5a5' : '1px solid #86efac', color: isFalta ? '#b91c1c' : '#15803d', padding: '6px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                title="Ver especificamente este registro no Prontuário"
                              >
                                📂 {isFalta ? 'Ver falta' : 'Ver consulta'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {atendimentosDoDia.length === 0 && agendamentosFuturosDoDia.length === 0 && (
                    <p style={{ textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', padding: '20px 0' }}>Dia livre. Nenhum registro.</p>
                  )}

                  {!isDiaModalPassado && (
                    <button 
                      onClick={() => setModoAgendamento(true)}
                      style={{ width: '100%', padding: '15px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '15px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', marginTop: '10px', boxShadow: '0 4px 6px rgba(59, 130, 246, 0.2)' }}
                    >
                      ➕ Novo Agendamento
                    </button>
                  )}
                </div>
              ) : (
                <form onSubmit={salvarAgendamento} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px', width: '100%' }}>
                    <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
                      <label style={{ display: 'block', color: '#4a5568', fontWeight: 'bold', marginBottom: '5px', fontSize: '14px' }}>Horário da Sessão:</label>
                      <input 
                        type="time" 
                        value={formAgendamento.hora} 
                        onChange={(e) => setFormAgendamento({...formAgendamento, hora: e.target.value})} 
                        style={{ display: 'block', width: '100%', maxWidth: '100%', minWidth: 0, minHeight: '45px', padding: '10px 12px', borderRadius: '12px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#2c3e50', outline: 'none', fontSize: '15px', boxSizing: 'border-box' }} 
                      />
                    </div>

                    <div style={{ flex: 1.3, minWidth: 0, width: '100%' }}>
                      <label style={{ display: 'block', color: '#4a5568', fontWeight: 'bold', marginBottom: '5px', fontSize: '14px' }}>
                        🔁 Repetição Semanal ({nomeDiaSemanaModal}):
                      </label>
                      <select
                        value={formAgendamento.semanasRepeticao}
                        onChange={(e) => setFormAgendamento({ ...formAgendamento, semanasRepeticao: Number(e.target.value) })}
                        style={{ display: 'block', width: '100%', maxWidth: '100%', minWidth: 0, minHeight: '45px', padding: '10px 12px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', backgroundColor: '#f8fafc', cursor: 'pointer', boxSizing: 'border-box', fontWeight: 'bold', color: '#1e3a8a' }}
                      >
                        <option value={1}>Apenas neste dia ({diaSelecionado})</option>
                        <option value={4}>Toda {nomeDiaSemanaModal} (4 semanas)</option>
                        <option value={8}>Toda {nomeDiaSemanaModal} (8 semanas)</option>
                        <option value={12}>Toda {nomeDiaSemanaModal} (12 semanas)</option>
                      </select>
                    </div>
                  </div>

                  {formAgendamento.semanasRepeticao > 1 && (
                    <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '10px 14px', borderRadius: '12px', fontSize: '12px', color: '#1e40af' }}>
                      ✨ <strong>Automação de Agenda:</strong> O sistema criará automaticamente os agendamentos toda <strong>{nomeDiaSemanaModal}</strong> às <strong>{formAgendamento.hora || '--:--'}</strong> pelas próximas <strong>{formAgendamento.semanasRepeticao} semanas</strong> ({gerarDatasSemanais(diaSelecionado, formAgendamento.semanasRepeticao).slice(0, 3).join(', ')}...).
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', color: '#4a5568', fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>
                      {formAgendamento.pacientesIds.length > 1 ? 'Crianças neste horário (Atendimento em Conjunto):' : 'Paciente:'}
                    </label>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {formAgendamento.pacientesIds.map((pacIdSelecionado, index) => (
                        <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <select 
                            value={pacIdSelecionado} 
                            onChange={(e) => atualizarPacienteNoForm(index, e.target.value)} 
                            style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', backgroundColor: '#f8fafc', cursor: 'pointer' }}
                          >
                            <option value="">Selecione a criança...</option>
                            {pacientes.map(pac => (
                              <option key={pac.id} value={pac.id}>{pac.avatar} {pac.nome}</option>
                            ))}
                          </select>

                          {formAgendamento.pacientesIds.length > 1 && (
                            <button 
                              type="button" 
                              onClick={() => removerCampoCrianca(index)}
                              style={{ padding: '10px 12px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}
                              title="Remover criança"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <button 
                      type="button" 
                      onClick={adicionarCampoCrianca}
                      style={{ marginTop: '10px', background: 'none', border: '1px dashed #3b82f6', color: '#3b82f6', padding: '10px', borderRadius: '12px', width: '100%', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}
                    >
                      + Adicionar outra criança neste mesmo horário
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button 
                      type="button" 
                      onClick={() => {
                        setModoAgendamento(false);
                        setFormAgendamento({ pacientesIds: [''], hora: '', semanasRepeticao: 1 });
                      }} 
                      style={{ flex: 1, padding: '12px', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      style={{ flex: 1, padding: '12px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(59, 130, 246, 0.2)' }}
                    >
                      Confirmar
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
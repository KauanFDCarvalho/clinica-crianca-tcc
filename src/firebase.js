import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAk7oIWNWnTcd1V8G6OKeJ13g-fEYCmoo4",
  authDomain: "digital-consultorio.firebaseapp.com",
  projectId: "digital-consultorio",
  storageBucket: "digital-consultorio.firebasestorage.app",
  messagingSenderId: "145408294904",
  appId: "1:145408294904:web:f07b068f8529ecc681a00d"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Se quiser definir um título exato ("Dra.", "Dr.") para algum e-mail específico, basta colocar aqui:
const NOMES_PERSONALIZADOS = {
  // Exemplo: 'ana@gmail.com': 'Dra. Ana',
  // Exemplo: 'carlos@gmail.com': 'Dr. Carlos',
};

// Guarda o e-mail logado para não perder a referência ao recarregar a página (F5)
onAuthStateChanged(auth, (user) => {
  if (user && user.email) {
    localStorage.setItem('clinica_email_ativo', user.email.toLowerCase());
  } else {
    localStorage.removeItem('clinica_email_ativo');
  }
});

// Cria uma coleção separada no banco de dados para cada usuário logado
export const obterNomeColecao = () => {
  const email = (auth.currentUser?.email || localStorage.getItem('clinica_email_ativo') || '').toLowerCase();
  if (!email) return 'pacientes';

  const prefixo = email.split('@')[0].replace(/[^a-z0-9]/g, '_');
  return `pacientes_${prefixo}`;
};

// Exibe o nome correto do profissional no cabeçalho
export const obterNomeProfissional = () => {
  const email = (auth.currentUser?.email || localStorage.getItem('clinica_email_ativo') || '').toLowerCase();
  if (!email) return 'Profissional';

  // 1º Se o e-mail estiver na lista personalizada acima, usa o nome exato dela
  if (NOMES_PERSONALIZADOS[email]) {
    return NOMES_PERSONALIZADOS[email];
  }

  // 2º Conta principal da Júlia
  if (email.includes('julia')) {
    return 'Dra. Júlia';
  }

  // 3º Sua conta de testes (reconhece se tiver "kauan" ou "teste" no e-mail)
  if (email.includes('kauan') || email.includes('teste')) {
    return 'Dra. Júlia (Teste)';
  }

  // 4º Para qualquer novo usuário (homem ou mulher), extrai o 1º nome do e-mail e usa o título neutro "Psi."
  const parteAntesDoArroba = email.split('@')[0];
  const primeiroNomeCru = parteAntesDoArroba.split(/[._-]/)[0].replace(/[0-9]/g, '');
  if (!primeiroNomeCru) return 'Profissional';

  const nomeFormatado = primeiroNomeCru.charAt(0).toUpperCase() + primeiroNomeCru.slice(1);
  return `Psi. ${nomeFormatado}`;
};
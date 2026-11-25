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

// Guarda UID e e-mail ativos para não perder a referência ao recarregar a página (F5)
onAuthStateChanged(auth, (user) => {
  if (user) {
    localStorage.setItem('clinica_uid_ativo', user.uid);
    if (user.email) {
      localStorage.setItem('clinica_email_ativo', user.email.toLowerCase());
    }
  } else {
    localStorage.removeItem('clinica_uid_ativo');
    localStorage.removeItem('clinica_email_ativo');
  }
});

// Caminho isolado no servidor pelo UID imutável do usuário autenticado
export const obterNomeColecao = () => {
  const uid = auth.currentUser?.uid || localStorage.getItem('clinica_uid_ativo');
  if (!uid) return 'sem_acesso';

  return `profissionais/${uid}/pacientes`;
};

// Exibe identificação neutra do profissional no cabeçalho
export const obterNomeProfissional = () => {
  const email = (auth.currentUser?.email || localStorage.getItem('clinica_email_ativo') || '').toLowerCase();
  if (!email) return 'Profissional';

  if (email.includes('teste') || email.includes('homolog')) {
    return 'Profissional (Teste)';
  }

  const parteAntesDoArroba = email.split('@')[0];
  const primeiroNomeCru = parteAntesDoArroba.split(/[._-]/)[0].replace(/[0-9]/g, '');
  if (!primeiroNomeCru) return 'Profissional';

  const nomeFormatado = primeiroNomeCru.charAt(0).toUpperCase() + primeiroNomeCru.slice(1);
  return `Psi. ${nomeFormatado}`;
};
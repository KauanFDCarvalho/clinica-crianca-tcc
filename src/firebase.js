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

// Muda o nome no cabeçalho para você saber quando está na conta de teste
export const obterNomeProfissional = () => {
  const email = (auth.currentUser?.email || localStorage.getItem('clinica_email_ativo') || '').toLowerCase();
  
  // Se o e-mail tiver "julia", mostra só Dra. Júlia. Nos outros, avisa que é Teste.
  if (email.includes('julia')) {
    return 'Dra. Júlia';
  }
  return 'Dra. Júlia (Teste)';
};
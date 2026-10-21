// Configuração do Firebase (banco de dados na nuvem que junta celular e computador e faz o login).
// Se trocar por null, o app volta ao "modo de teste", salvando só no aparelho.
window.PRONTUARIOS_FIREBASE = {
  apiKey: "AIzaSyAUVEtcVZJBgOu5OUqP_cTeJBbdb7hp2AA",
  authDomain: "prontuarios-cog.firebaseapp.com",
  projectId: "prontuarios-cog",
  storageBucket: "prontuarios-cog.firebasestorage.app",
  messagingSenderId: "848772344721",
  appId: "1:848772344721:web:83a72a09445de6c1918830",
  escola: "principal",
  // Conta principal, que libera os acessos. Fica só o código (SHA-256) do e-mail em minúsculas, para o e-mail não aparecer no site.
  donoHash: "12210f0f24737383c8825280578675ecbde60920e62d07c19f1abdb29b293304"
};

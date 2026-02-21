// hooks/use-auth.ts
// Versão "Mock" simples, sem depender de zustand ou tRPC

export function useAuth() {
  // Retorna sempre um usuário fixo para permitir o uso do app
  const user = { 
    id: 'user-1', 
    name: 'Visitante', 
    email: 'visitante@cinesync.com' 
  };

  const signIn = async () => {
    // Simula um login (não faz nada real)
    console.log("Login simulado");
  };

  const signOut = async () => {
    // Simula um logout
    console.log("Logout simulado");
  };

  return {
    user,
    signIn,
    signOut
  };
}
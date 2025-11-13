import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  studentType?: string;
  planType?: 'free' | 'monthly' | 'annual';
}

interface AuthContextType {
  user: UserProfile | null;
  isLoggedIn: boolean;
  hasProfile: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  saveProfile: (studentType: string) => Promise<void>;
  upgradePlan: (planType: 'monthly' | 'annual') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Função para buscar o perfil do usuário no banco de dados
  const fetchUserProfile = async (session: Session | null) => {
    if (!session?.user) {
      setUser(null);
      return null;
    }

    // 1. Tenta buscar o perfil na tabela 'user_profiles'
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    const baseUser = {
      id: session.user.id,
      email: session.user.email || '',
      name: session.user.user_metadata?.name || 'Usuário',
    };

    if (profileData) {
      setUser({ ...baseUser, ...profileData });
    } else {
      // Se não existir perfil, crie um básico (onboarding)
      const { data: newProfile } = await supabase
        .from('user_profiles')
        .insert({ id: session.user.id, plan_type: 'free' })
        .select()
        .single();
      
      setUser({ ...baseUser, ...newProfile });
    }
  };

  useEffect(() => {
    setIsLoading(true);
    // Pega a sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchUserProfile(session).finally(() => setIsLoading(false));
    });

    // Escuta mudanças (login, logout)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        await fetchUserProfile(session);
        if (event === 'SIGNED_IN') setIsLoading(false);
        if (event === 'SIGNED_OUT') setUser(null);
      }
    );

    return () => authListener.subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
  };

  const signup = async (name: string, email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { name }
      }
    });

    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const saveProfile = async (studentType: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ studentType })
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;
    setUser(prev => prev ? { ...prev, studentType: data.studentType } : null);
  };

  const upgradePlan = async (planType: 'monthly' | 'annual') => {
    if (!user) return;
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ plan_type: planType })
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;
    setUser(prev => prev ? { ...prev, planType: data.plan_type } : null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isLoggedIn: !!user, 
      hasProfile: !!user?.studentType,
      isLoading,
      login, 
      signup, 
      logout,
      saveProfile,
      upgradePlan
    }}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

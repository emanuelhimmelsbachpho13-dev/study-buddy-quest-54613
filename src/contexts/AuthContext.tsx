import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { AuthSession, User } from "@supabase/supabase-js";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  studentType?: string;
  planType?: "free" | "monthly" | "annual";
}

interface AuthContextType {
  user: UserProfile | null;
  isLoggedIn: boolean;
  hasProfile: boolean;
  isLoading: boolean;
  saveProfile: (studentType: string) => Promise<void>;
  upgradePlan: (planType: "monthly" | "annual") => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserProfile = async (session: AuthSession | null): Promise<UserProfile | null> => {
    const authUser: User | null = session?.user ?? null;

    if (!authUser) {
      setUser(null);
      return null;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", authUser.id)
      .single();

    const baseUser = {
      id: authUser.id,
      email: authUser.email || "",
      name: authUser.user_metadata?.name || "Usuário",
    };

    if (profileData) {
      const fullProfile = { ...baseUser, ...profileData };
      setUser(fullProfile);
      return fullProfile;
    } else {
      const { data: newProfile, error: insertError } = await supabase
        .from("user_profiles")
        .insert({ id: authUser.id, plan_type: "free" })
        .select()
        .single();

      if (insertError) {
        console.error("Erro ao criar perfil:", insertError);
        setUser(baseUser as UserProfile);
        return baseUser as UserProfile;
      }

      const fullProfile = { ...baseUser, ...newProfile };
      setUser(fullProfile);
      return fullProfile;
    }
  };

  useEffect(() => {
    setIsLoading(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchUserProfile(session).finally(() => setIsLoading(false));
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      await fetchUserProfile(session);
      setIsLoading(false);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const saveProfile = async (studentType: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("user_profiles")
      .update({ studentType })
      .eq("id", user.id)
      .select()
      .single();

    if (error) throw error;

    setUser((prev) => (prev ? { ...prev, ...data } : null));
  };

  const upgradePlan = async (planType: "monthly" | "annual") => {
    if (!user) return;
    const { data, error } = await supabase
      .from("user_profiles")
      .update({ plan_type: planType })
      .eq("id", user.id)
      .select()
      .single();

    if (error) throw error;

    setUser((prev) => (prev ? { ...prev, ...data } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        hasProfile: !!user?.studentType,
        isLoading,
        saveProfile,
        upgradePlan,
      }}
    >
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

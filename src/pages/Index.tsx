import { useState } from "react";
import { Header } from "@/components/Header";
import { InputForm } from "@/components/InputForm";
import { LoadingState } from "@/components/LoadingState";
import { OnboardingQuiz } from "@/components/OnboardingQuiz";
import { QuizInterface } from "@/components/QuizInterface";
import { ResultsDisplay } from "@/components/ResultsDisplay";
import { useAuth } from "@/contexts/AuthContext";
import jungleBackground from "@/assets/jungle-background.jpg";

interface Question {
  id: number;
  pergunta: string;
  opcoes: string[];
  resposta_correta: string;
}

const Index = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [quizId, setQuizId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const { isLoggedIn, hasProfile } = useAuth();

  const handleGenerate = (result: { quizId: number | null, questions: any[] | null }) => {
    setIsLoading(true);
    setQuestions(null);
    setQuizId(null);

    if (result.quizId) {
      // --- FLUXO LOGADO ---
      setQuizId(result.quizId);
      // Mock para mudar a tela, o QuizInterface buscará os dados reais
      setQuestions([{ id: 1, pergunta: "Carregando quiz...", opcoes: [], resposta_correta: "" }]);
    } else if (result.questions) {
      // --- FLUXO CONVIDADO ---
      setQuizId(null);
      setQuestions(result.questions as Question[]); // Seta as 5 perguntas reais da amostra
    }

    setIsLoading(false);
  };

  const handleLoadNew = () => {
    setQuestions(null);
    setQuizId(null);
    setIsLoading(false);
  };

  const renderContent = () => {
    // O useAuth tem um isLoading. Podemos usá-lo ou o local.
    // Vamos usar o isLoading local para a geração.
    if (isLoading) {
      return <LoadingState />;
    }

    // 1. Usuário logado, sem perfil -> Onboarding
    if (isLoggedIn && !hasProfile) {
      return <OnboardingQuiz />;
    }

    // 2. Temos perguntas E NÃO estamos logados -> Amostra Grátis (CTA)
    if (questions && !isLoggedIn) {
      return <ResultsDisplay questions={questions} />;
    }

    // 3. Temos perguntas E ESTAMOS logados (e com perfil) -> Quiz Real
    if (questions && isLoggedIn && hasProfile) {
      if (!quizId) {
        // Isso pode acontecer se o usuário recarregar a página.
        // Vamos apenas voltar para o InputForm.
        handleLoadNew();
        return <InputForm onGenerate={handleGenerate} />;
      }

      return (
        <QuizInterface
          quizId={quizId} // Passa o ID para o componente buscar os dados reais
          onLoadNew={handleLoadNew}
        />
      );
    }

    // 4. Estado Padrão (Sem perguntas, Logado ou Não) -> Formulário de Input
    // (Isso cobre !isLoggedIn || hasProfile)
    return <InputForm onGenerate={handleGenerate} />;
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{
        backgroundImage: `url(${jungleBackground})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="relative z-10">
        <Header />

        <main className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[calc(100vh-88px)]">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Index;

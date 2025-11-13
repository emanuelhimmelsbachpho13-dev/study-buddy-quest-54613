import { useState } from "react";
import { Header } from "@/components/Header";
import { InputForm } from "@/components/InputForm";
import { LoadingState } from "@/components/LoadingState";
import { ResultsDisplay } from "@/components/ResultsDisplay";
import { QuizInterface } from "@/components/QuizInterface";
import { OnboardingQuiz } from "@/components/OnboardingQuiz";
import { useAuth } from "@/contexts/AuthContext";
import jungleBackground from "@/assets/jungle-background.jpg";

interface Question {
  id: number;
  pergunta: string;
  opcoes?: string[];
  resposta_correta?: string;
}

const Index = () => {
  const { isLoggedIn, hasProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [quizId, setQuizId] = useState<number | null>(null);

  const handleGenerate = (result: { quizId: number | null; questions: Question[] | null }) => {
    setIsLoading(true);
    setQuestions(null);
    setQuizId(null);

    if (result.quizId) {
      // --- FLUXO LOGADO ---
      setQuizId(result.quizId);
      // O mock é só para mudar a tela, o QuizInterface vai buscar os dados
      setQuestions([{ id: 1, pergunta: "Carregando quiz..." }]);
    } else if (result.questions) {
      // --- FLUXO CONVIDADO ---
      setQuizId(null);
      setQuestions(result.questions);
    }

    setIsLoading(false);
  };

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-jungle-bg-start to-jungle-bg-end relative overflow-hidden"
      style={{
        backgroundImage: `url(${jungleBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-br from-jungle-dark/80 to-jungle-medium/70" />
      
      <div className="relative z-10">
        <Header />
        
        <main className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[calc(100vh-88px)]">
          {/* Show onboarding quiz for logged-in users without profile */}
          {isLoggedIn && !hasProfile && <OnboardingQuiz />}
          
          {/* Show input form for non-logged users or logged users with profile */}
          {(!isLoggedIn || hasProfile) && !isLoading && !questions && <InputForm onGenerate={handleGenerate} />}
          
          {/* Show loading state */}
          {isLoading && <LoadingState />}
          
          {/* Show results based on login status */}
          {!isLoading && questions && !isLoggedIn && <ResultsDisplay questions={questions} />}
          {!isLoading && questions && isLoggedIn && hasProfile && (
            <QuizInterface 
              questions={questions} 
              onLoadNew={() => {
                setQuestions(null);
                setIsLoading(false);
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default Index;

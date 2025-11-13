import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { QuizResults } from "./QuizResults";
import { LoadingState } from "@/components/LoadingState";
import { supabase } from "@/lib/supabase";

interface Question {
  id: number;
  pergunta: string;
  opcoes?: string[];
  resposta_correta?: string;
}

interface QuizInterfaceProps {
  quizId: number;
  onLoadNew?: () => void;
}

export const QuizInterface = ({ quizId, onLoadNew }: QuizInterfaceProps) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchQuestions = async () => {
      setIsLoading(true);
      setLoadError(null);
      const { data, error } = await supabase
        .from("questions")
        .select("id, pergunta, opcoes, resposta_correta, ordem")
        .eq("quiz_id", quizId)
        .order("ordem", { ascending: true });

      if (!isMounted) {
        return;
      }

      if (error) {
        console.error("Erro ao carregar quiz:", error);
        setLoadError(error.message || "Erro ao carregar quiz");
        setQuestions([]);
      } else {
        setQuestions(data ?? []);
      }

      setIsLoading(false);
    };

    fetchQuestions();

    return () => {
      isMounted = false;
    };
  }, [quizId]);

  useEffect(() => {
    setCurrentQuestionIndex(0);
    setAnswers({});
    setCurrentAnswer("");
    setIsSubmitted(false);
  }, [quizId]);

  const currentQuestion = questions[currentQuestionIndex];
  const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;

  const handleSubmitAnswer = () => {
    if (!currentQuestion) {
      return;
    }

    if (!currentAnswer.trim()) {
      toast.error("Por favor, escreva uma resposta");
      return;
    }

    setAnswers({ ...answers, [currentQuestion.id]: currentAnswer });
    toast.success("Resposta salva!");
    setCurrentAnswer("");

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setIsSubmitted(true);
      toast.success("Quiz completo! Todas as respostas foram salvas.");
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0 && questions[currentQuestionIndex - 1]) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setCurrentAnswer(answers[questions[currentQuestionIndex - 1].id] || "");
    }
  };

  const handleRetry = () => {
    setCurrentQuestionIndex(0);
    setAnswers({});
    setCurrentAnswer("");
    setIsSubmitted(false);
  };

  const handleLoadNew = () => {
    if (onLoadNew) {
      onLoadNew();
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (loadError) {
    return (
      <Card className="w-full max-w-3xl mx-auto bg-white/95 backdrop-blur-sm border-jungle-accent/20 shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-jungle-dark">Erro ao carregar o quiz</CardTitle>
          <CardDescription className="text-jungle-medium">{loadError}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="jungle" onClick={handleLoadNew}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!questions.length) {
    return (
      <Card className="w-full max-w-3xl mx-auto bg-white/95 backdrop-blur-sm border-jungle-accent/20 shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-jungle-dark">Nenhuma pergunta encontrada</CardTitle>
          <CardDescription className="text-jungle-medium">
            Não conseguimos encontrar perguntas para este quiz. Tente gerar um novo material.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="jungle" onClick={handleLoadNew}>
            Carregar novo arquivo
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isSubmitted) {
    return (
      <QuizResults
        questions={questions}
        answers={answers}
        onRetry={handleRetry}
        onLoadNew={handleLoadNew}
      />
    );
  }

  return (
    <Card className="w-full max-w-3xl mx-auto bg-white/95 backdrop-blur-sm border-jungle-accent/20 shadow-xl">
      <CardHeader>
        <div className="flex justify-between items-center mb-2">
          <CardDescription className="text-jungle-medium">
            Pergunta {currentQuestionIndex + 1} de {questions.length}
          </CardDescription>
          <span className="text-sm font-medium text-jungle-dark">
            {Math.round(progress)}% completo
          </span>
        </div>
        <Progress value={progress} className="mb-4" />
        <CardTitle className="text-2xl font-bold text-jungle-dark">
          {currentQuestion?.pergunta}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-jungle-dark">
            Sua resposta:
          </label>
          <Textarea
            value={currentAnswer}
            onChange={(e) => setCurrentAnswer(e.target.value)}
            placeholder="Digite sua resposta aqui..."
            className="min-h-[150px] resize-none"
          />
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handlePrevious}
            variant="outline"
            disabled={currentQuestionIndex === 0}
            className="flex-1"
          >
            Anterior
          </Button>
          <Button
            onClick={handleSubmitAnswer}
            variant="jungle"
            className="flex-1"
          >
            {currentQuestionIndex === questions.length - 1 ? "Finalizar" : "Próxima"}
          </Button>
        </div>

        {Object.keys(answers).length > 0 && (
          <div className="text-sm text-jungle-medium text-center">
            {Object.keys(answers).length} de {questions.length} perguntas respondidas
          </div>
        )}
      </CardContent>
    </Card>
  );
};

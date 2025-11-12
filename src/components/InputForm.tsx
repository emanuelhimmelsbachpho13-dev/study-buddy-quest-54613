import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Upload, Link as LinkIcon, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface InputFormProps {
  onGenerate: (quizId: number) => void;
}

export const InputForm = ({ onGenerate }: InputFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({
          title: "Erro",
          description: "Por favor, envie apenas arquivos PDF",
          variant: "destructive"
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleGenerate = async () => {
    if (!selectedFile && !linkUrl) {
      toast({
        title: "Erro",
        description: "Por favor, selecione um arquivo ou adicione um link",
        variant: "destructive"
      });
      return;
    }

    if (!user) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado para gerar quizzes",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);

    try {
      // 1. Upload do arquivo para Supabase Storage
      const fileName = `${user.id}/${Date.now()}_${selectedFile?.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(fileName, selectedFile!);

      if (uploadError) {
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }

      // 2. Obter token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Sessão não encontrada');
      }

      // 3. Chamar a Vercel Function
      const apiUrl = import.meta.env.VITE_API_URL || '/api/generate';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          file_path: uploadData.path,
          material_title: selectedFile?.name || 'Quiz'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao gerar quiz');
      }

      const { quizId } = await response.json();
      
      toast({
        title: "Sucesso!",
        description: "Quiz gerado com sucesso",
      });

      onGenerate(quizId);

    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao gerar quiz",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto p-8 bg-card/95 backdrop-blur-sm shadow-2xl border-none">
      <div className="text-center mb-8">
        <h1 className="text-5xl font-bold mb-4 text-foreground leading-tight">
          Estudar não precisa ser um saco
        </h1>
        <p className="text-lg text-muted-foreground">
          Gere flashcards e questões de múltipla escolha em segundos.
        </p>
      </div>

      <Tabs defaultValue="file" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="file" className="gap-2">
            <Upload className="h-4 w-4" />
            Enviar Arquivo
          </TabsTrigger>
          <TabsTrigger value="link" className="gap-2">
            <LinkIcon className="h-4 w-4" />
            Link Externo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="file" className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-secondary transition-colors cursor-pointer">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".pdf,.ppt,.pptx,.txt,.doc,.docx"
              onChange={handleFileChange}
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                {selectedFile
                  ? selectedFile.name
                  : "Clique para fazer upload ou arraste arquivos aqui"}
              </p>
              <p className="text-xs text-muted-foreground">
                Suporta PDF, PPT, TXT, DOC
              </p>
            </label>
          </div>
        </TabsContent>

        <TabsContent value="link" className="space-y-4">
          <Input
            type="url"
            placeholder="ou adicione qualquer link (ou vídeo do YouTube)"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            className="h-12 text-base bg-muted/50"
          />
        </TabsContent>

        <Button
          variant="jungle"
          size="lg"
          className="w-full mt-6"
          onClick={handleGenerate}
          disabled={(!selectedFile && !linkUrl) || isUploading}
        >
          <Sparkles className="h-5 w-5" />
          {isUploading ? "Gerando quiz..." : "Faça o upload dos seus slides"}
        </Button>
      </Tabs>
    </Card>
  );
};

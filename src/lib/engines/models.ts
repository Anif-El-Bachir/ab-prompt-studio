import type { AppSettings, TargetModel } from "../types";

/* MÓDULO D — perfis de modelos de destino.
 * Não assumimos que todos os modelos têm as mesmas ferramentas ou permissões.
 */

export interface ModelProfile {
  id: TargetModel;
  label: string;
  vendor: string;
  format: "xml" | "markdown" | "plain";
  /** O modelo tem, tipicamente, acesso a ficheiros/terminal no ambiente onde é usado. */
  hasWorkspaceTools: boolean;
  /** Suporta normalmente um prompt de sistema separado. */
  systemPrompt: boolean;
  strengths: string[];
  limitations: string[];
  tips: string[];
}

export const MODEL_PROFILES: Record<TargetModel, ModelProfile> = {
  claude: {
    id: "claude",
    label: "Claude",
    vendor: "Anthropic",
    format: "xml",
    hasWorkspaceTools: false,
    systemPrompt: true,
    strengths: ["Segue bem estruturas com etiquetas XML", "Contextos longos", "Raciocínio cuidadoso e escrita"],
    limitations: ["Na app/chat não tem acesso aos teus ficheiros a não ser que os anexes", "Ferramentas dependem do ambiente (web search, artefactos, conectores)"],
    tips: ["Delimitar secções com etiquetas XML", "Colocar documentos longos antes da pergunta", "Pedir que pense antes de responder em tarefas complexas"],
  },
  "claude-code": {
    id: "claude-code",
    label: "Claude Code",
    vendor: "Anthropic",
    format: "markdown",
    hasWorkspaceTools: true,
    systemPrompt: false,
    strengths: ["Lê e edita ficheiros do projeto", "Executa comandos e testes no terminal", "Trabalha por planos e passos verificáveis"],
    limitations: ["Ações dependem das permissões configuradas pelo utilizador", "Não deve executar operações destrutivas sem aprovação"],
    tips: ["Pedir para analisar o repositório antes de alterar", "Definir comandos de teste e critérios de conclusão", "Indicar o que não pode ser tocado"],
  },
  chatgpt: {
    id: "chatgpt",
    label: "ChatGPT",
    vendor: "OpenAI",
    format: "markdown",
    hasWorkspaceTools: false,
    systemPrompt: false,
    strengths: ["Conversação e iteração rápida", "Formatação Markdown", "Ferramentas opcionais (pesquisa, análise de dados) conforme o plano"],
    limitations: ["Sem acesso ao teu sistema de ficheiros", "Ferramentas disponíveis variam por plano e configuração"],
    tips: ["Cabeçalhos Markdown claros", "Pedir perguntas de clarificação antes de começar", "Especificar formato exato da resposta"],
  },
  codex: {
    id: "codex",
    label: "OpenAI Codex",
    vendor: "OpenAI",
    format: "markdown",
    hasWorkspaceTools: true,
    systemPrompt: false,
    strengths: ["Tarefas de código num repositório", "Executa testes num ambiente isolado", "Produz alterações revisíveis (diffs/PRs)"],
    limitations: ["Acesso à rede pode estar desativado no ambiente", "Funciona melhor com tarefas bem delimitadas"],
    tips: ["Formato de tarefa: objetivo, contexto do repositório, critérios de aceitação", "Indicar comandos de teste e lint", "Referir AGENTS.md se existir"],
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    vendor: "Google",
    format: "markdown",
    hasWorkspaceTools: false,
    systemPrompt: true,
    strengths: ["Contextos muito longos", "Multimodal (imagens, PDF)", "Integração com serviços Google conforme o ambiente"],
    limitations: ["Sem acesso aos teus ficheiros locais", "Ferramentas variam entre app, AI Studio e API"],
    tips: ["Estrutura Persona · Tarefa · Contexto · Formato", "Instruções explícitas e positivas", "Exemplos do formato desejado"],
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    vendor: "Vários fornecedores",
    format: "markdown",
    hasWorkspaceTools: false,
    systemPrompt: true,
    strengths: ["Acesso a muitos modelos com a mesma API", "Permite comparar modelos"],
    limitations: ["Capacidades dependem do modelo escolhido", "Não assumir ferramentas, visão ou contexto longo"],
    tips: ["Prompt neutro e autossuficiente", "Formato Markdown simples", "Definir explicitamente o formato de saída"],
  },
  custom: {
    id: "custom",
    label: "Modelo personalizado",
    vendor: "Configurável",
    format: "markdown",
    hasWorkspaceTools: false,
    systemPrompt: true,
    strengths: ["Configurável nas definições (formato, ferramentas, tamanho máximo)"],
    limitations: ["Modelos locais pequenos seguem pior instruções longas"],
    tips: ["Preferir instruções curtas e diretas", "Ajustar o tamanho máximo do prompt nas definições"],
  },
};

export const TARGETS: TargetModel[] = ["claude", "claude-code", "chatgpt", "codex", "gemini", "openrouter", "custom"];

export function resolveProfile(target: TargetModel, custom?: AppSettings["customModel"]): ModelProfile {
  const base = MODEL_PROFILES[target];
  if (target !== "custom" || !custom) return base;
  return { ...base, label: custom.name || base.label, format: custom.format, hasWorkspaceTools: custom.supportsTools };
}

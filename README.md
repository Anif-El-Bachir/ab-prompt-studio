# AB Prompt Studio

Centro de inteligência para transformar ideias em projetos estruturados, arquiteturas técnicas e prompts profissionais para Claude, Claude Code, ChatGPT, Codex, Gemini, OpenRouter ou um modelo personalizado.

## Executar

```bash
npm install
npm run dev        # desenvolvimento em http://localhost:3000
npm test           # 33 testes (motores, dados/backup, rota de IA)
npm run build && npm start   # produção (PWA ativa só em produção)
```

## Usar no iPhone (mesmo Wi-Fi)

1. No computador, abre o atalho **AB Prompt Studio** no Ambiente de Trabalho (ou corre `iniciar-ab-studio.ps1`). A janela mostra o endereço, por exemplo `http://192.168.1.114:3100`.
2. No iPhone, ligado ao mesmo Wi-Fi, abre esse endereço no Safari.
3. Para ficar como app: botão Partilhar → **Adicionar ao ecrã principal**.

Notas: o computador tem de estar ligado com a janela aberta; os dados do iPhone são separados dos do computador (passa-os com Exportar/Importar backup em Settings); o modo offline (service worker) só funciona com HTTPS, por isso não está ativo neste acesso por rede local.

## Palavra-passe e acesso fora de casa

- `definir-palavra-passe.ps1` grava `APP_PASSWORD` no `.env.local`. A partir daí, todas as páginas e APIs exigem sessão (cookie httpOnly assinado, 30 dias), também na rede local. Sem `APP_PASSWORD`, o uso local continua aberto.
- Alojado no Vercel (`VERCEL=1`) ou com `REQUIRE_AUTH=1`, a falta de `APP_PASSWORD` **bloqueia** a aplicação (falha fechada).
- `publicar-vercel.ps1`: login no Vercel (feito pelo utilizador), copia só as variáveis necessárias como segredos do servidor e publica. O `.vercelignore` impede o envio de `.env.local` e dos scripts.
- Limite de 8 tentativas de login por 10 minutos por IP (em memória, por instância).

## Módulos

| Página | Módulo | O que faz |
|---|---|---|
| Dashboard | — | Contagens, projetos recentes, prompts, análises e atividade |
| New Project | Fluxo inteligente | 7 fases: Input → Interpretação → Clarificação → Validação → Arquitetura → Prompt → Revisão; gravação automática por fase |
| Idea Analyzer | A — Idea Intelligence | 8 dimensões 0–100, cada uma marcada como evidência / pressuposto / desconhecido; riscos com mitigação, tempo, recursos, alternativas |
| Prompt Architect | B + D | Prompt em 10 secções, adaptado ao modelo de destino (XML para Claude, PTCF para Gemini, AGENTS.md para Codex, etc.) |
| System Architect | C | Camadas, diagrama de dependências interativo, entidades, APIs, autenticação, segurança, pastas, fases |
| Prompt Evaluator | E | 7 critérios, sugestões, versão melhorada e comparação de pontuação |
| My Prompt Library | F | Pesquisa, filtros, coleções, favoritos, versões com diff e restauro, duplicar, exportar TXT/MD, copiar |
| Settings | — | Preferências, modelo personalizado, estado dos fornecedores, backup/importação JSON validada |

## Arquitetura

```
src/lib/engines/   motores locais determinísticos (funcionam sem API)
src/lib/data/      Repository (interface) + IndexedDbRepository (Dexie) + schemas Zod
src/lib/ai/        camada de fornecedores — só servidor ("server-only")
src/app/api/ai/    /status (sem chaves) e /generate (validação, rate limit, same-origin)
src/components/    UI reutilizável e vistas de domínio
```

Para passar a uma base de dados na nuvem, implementa a interface `Repository` (ex.: REST/Supabase) e devolve-a em `getRepository()`. As páginas não mudam.

## IA externa (opcional)

Copia `.env.example` para `.env.local`, preenche a chave de um fornecedor e reinicia. As chaves vivem só no servidor e nunca chegam ao browser. Nenhuma chamada é feita sem clicar num botão de IA. Sem chaves, a interface mostra "IA externa não configurada — motores locais ativos".

## Segurança

- Conteúdo submetido é limpo (caracteres invisíveis/controlo) e analisado para padrões de prompt injection.
- Frases suspeitas nunca entram nas secções do prompt; o texto original vai apenas dentro de `<user_data>` com instrução para ser tratado como dados.
- Erros dos fornecedores são reduzidos a mensagens genéricas (sem corpo bruto nem chaves).
- Cabeçalhos: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- Eliminações pedem confirmação; "apagar tudo" exige escrever APAGAR.

## Limitações conhecidas

- As pontuações e a interpretação são **heurísticas por regras**, não compreensão semântica. Mais detalhe no texto produz resultados melhores; a IA externa dá uma segunda opinião.
- Os dados ficam no IndexedDB deste browser — faz backups em Settings.
- A pasta está no OneDrive: se o build falhar com `EINVAL readlink .next`, apaga a pasta `.next` (é gerada) e volta a compilar. Ideal: excluir `node_modules` e `.next` da sincronização, ou mover o projeto para fora do OneDrive.
- Ícones da PWA em SVG (Chrome/Edge aceitam; iOS prefere PNG).

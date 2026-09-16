# Ferramentas de memória externa

Carregue este contexto somente ao configurar ou usar Obsidian, Graphify ou AI-Memory.

## Estado atual

- O MCP `obsidian` foi registrado no Codex globalmente para `Segundo-Cerebro-TCC`, em modo somente leitura. Reinicie o Codex e use `/mcp` ou `codex mcp list` para confirmar o servidor.
- Node.js 24, `uv` e Graphify estão instalados. O grafo local fica em `graphify-out/`, que é gerado e ignorado pelo Git.
- O Graphify foi integrado ao projeto em `.codex/skills/graphify` e registrou um hook de pré-ferramenta. Após reiniciar o Codex, revise e confie nele em `/hooks`.
- Docker Desktop usa WSL 2 e foi validado com o motor Linux ativo.
- O AI-Memory roda localmente em `127.0.0.1:49374`, com o volume `ai-memory-data` e reinicialização automática. O MCP `ai-memory` está habilitado e os hooks de ciclo de vida foram registrados; reinicie o Codex e confie neles em `/hooks` antes de usá-los.

## Obsidian

O cofre local é a memória humana do projeto: registre decisões, requisitos, reuniões e mudanças de escopo nele. O MCPVault não exige que o aplicativo Obsidian esteja aberto e restringe o acesso ao cofre configurado. O modo atual só expõe leitura; habilite escrita apenas quando houver uma decisão explícita para permitir que o agente altere notas pelo MCP.

## Graphify

Use o grafo quando uma pergunta exigir dependências ou relações entre arquivos, sem reler todo o código:

```powershell
graphify query "<pergunta sobre o código>"
graphify path "<símbolo-origem>" "<símbolo-destino>"
```

`graphifyy` tem dois `y`, enquanto o executável é `graphify`. Para atualizar o grafo depois de mudanças de código, execute `graphify update .`; a extração é local e não usa chave de API. Não copie `--no-label` para `extract`: essa opção pertence apenas a `graphify cluster-only`.

## AI-Memory

O comando do vídeo para `claude-code` não serve para Codex. Este Codex é um processo nativo do Windows e usa o wrapper Windows no mesmo ambiente. A instalação atual pode ser verificada e retomada assim:

```powershell
docker start ai-memory
ai-memory status
codex mcp list
```

Não habilite hooks sem revisá-los em `/hooks`: eles podem registrar prompts e uso de ferramentas. O wrapper do Docker no Windows usa scripts PowerShell de compatibilidade, que não aplicam a política local de captura; use um binário nativo do AI-Memory se for necessário aplicar exclusões estritas por repositório. O Codex atual oferece `SessionEnd`; `ai-memory finalize-session` continua disponível para criar um handoff manual quando necessário.

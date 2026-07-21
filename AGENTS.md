# Convenções de Git da Prolog App

Estas regras são obrigatórias para toda branch e todo commit criado neste repositório.

## Branches

O nome deve seguir o formato:

```text
<type>-<descrição-da-alteração>-<código-jira>
```

Types permitidos:

- `docs`: apenas documentação;
- `feat`: nova funcionalidade;
- `fix`: correção de bug;
- `perf`: melhoria de performance;
- `refactor`: mudança que não adiciona funcionalidade nem corrige bug;
- `style`: formatação ou estilo sem mudança de significado;
- `test`: adição ou correção de testes.

Exemplos:

```text
feat-cadastro-veiculos-PL-123
refactor-edicao-colaboradores-PL-355
fix-busca-checklists-PL-232
```

O código Jira é obrigatório. Nunca inventar nem omitir o código: solicitar ao usuário quando ele não estiver disponível.

## Commits

A mensagem deve seguir o formato:

```text
<type>(<scope>): <subject>

[body opcional]

<código-jira no footer>
```

- `type`: um dos mesmos types permitidos para branches;
- `scope`: área ou funcionalidade alterada;
- `subject`: resumo em português e no imperativo, como `faz`, `adiciona`, `altera` ou `muda`;
- `body`: detalhamento opcional;
- `footer`: código da tarefa Jira e, quando aplicável, a breaking change.

Exemplo sem body:

```text
refactor(veículo): altera inserção da placa para utilizar trim

PL-1234
```

Antes de criar branch ou commit, confirmar que o nome ou a mensagem segue estas convenções e que contém o código Jira correto.

## Destino final

Toda alteração deve ser integrada à branch `main` ao final do fluxo. Antes da integração, executar as validações aplicáveis do repositório e preservar o histórico conforme a estratégia adotada pelo projeto. Depois da integração e de uma verificação final, enviar a `main` ao repositório remoto com `git push origin main`.

## Fluxo de desenvolvimento

- Usar `npm` como gerenciador de pacotes. Manter `package-lock.json` como lockfile canônico e não recriar locks do Bun, Yarn ou pnpm sem pedido explícito.
- Para desenvolvimento local, `npm run dev` sobe frontend e API; `npm run dev:web` sobe apenas o Vite com proxy de `/api` para `http://localhost:3001`.
- Antes de commit/push, rodar as validações aplicáveis:
  - mudanças em frontend ou dependências: `npm run lint`, `npm test` e `npm run build`;
  - mudanças no parser do URÂNIA: `python server/parsers/test_urania_up.py`;
  - mudanças apenas em documentação: validação manual do diff é suficiente.
- Rodar `npm run lint` e `npm test` em comandos separados, não em paralelo, porque o Vitest cria arquivos temporários de config que podem ser lidos pelo ESLint.
- Evitar adicionar dependências, componentes `ui` ou wrappers globais sem uso real. Reutilizar os componentes existentes em `src/components/ui` e apagar scaffold que não estiver importado.

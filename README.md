# CIMOL - Sistema de Gerenciamento Escolar & Reorganização de Salas

Este projeto é um sistema desenvolvido para a escola técnica **CIMOL**. O sistema inclui um mapeamento interativo e um módulo específico para a **Reorganização de Salas** decorrente de necessidades físicas ou temporárias de acessibilidade de alunos.

O projeto foi construído focando em boas práticas de engenharia de software, incluindo **Segurança de API**, **Normalização de Banco de Dados (3FN)**, e **Documentação Interativa com Swagger**.

---

## 🚀 Funcionalidades Principais

* **Mapeamento Escolar:** Visualização interativa e gestão das dependências da escola.
* **Solicitação de Reorganização de Salas:**
  * Formulário inteligente com **padronização de entradas** (máscara automática para turma, limitação de anos letivos do 1º ao 3º e dropdown de cursos oficiais do CIMOL).
  * Upload de documentos comprobatórios (PDF, imagens, Word) gravados de forma segura como `LONGBLOB` no banco de dados.
* **Banco de Dados Relacional Normalizado:** Estrutura em conformidade com as Formas Normais (**1FN, 2FN e 3FN**), evitando duplicação de dados e garantindo a integridade referencial com chaves estrangeiras e deleção em cascata.
* **Segurança de API:** Restrição de acesso à API por meio de chaves secretas temporárias (`x-api-key`).
* **Documentação Viva (Swagger):** API 100% catalogada utilizando a especificação OpenAPI 3.0.

---

## 🛠️ Tecnologias Utilizadas

### Frontend
* **React** (com TypeScript)
* **Vite** (gerenciador de build rápido)
* **TailwindCSS** (estilização moderna)
* **Shadcn UI** & **Lucide React** (componentes visuais e ícones de alta qualidade)

### Backend
* **Node.js** com **Express**
* **Multer** (para processamento de upload de arquivos na memória)
* **MySQL2** (com pool de conexões otimizado e suporte a transações SQL)
* **Swagger UI Express** (para servir a documentação de API)
* **Concurrently** (para inicialização simultânea dos serviços de desenvolvimento)

### Banco de Dados
* **MySQL** (gerenciado localmente via MySQL Workbench)

---

## 📋 Pré-requisitos

Antes de iniciar, certifique-se de ter instalado em sua máquina:
1. [Node.js](https://nodejs.org/) (Versão recomendada: v18 ou superior)
2. [MySQL Server](https://dev.mysql.com/downloads/installer/)

---

## ⚙️ Configuração do Ambiente

### 1. Banco de Dados
1. Abra o **MySQL Workbench** (ou gerenciador de preferência).
2. Copie e execute as queries contidas no arquivo [server/schema.sql](file:///c:/Users/Administrator/Desktop/design-compass/server/schema.sql) para criar o banco de dados `cimol` e as tabelas normalizadas (`alunos`, `reorganizacoes` e `reorganizacao_salas_relacionadas`).

### 2. Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto (caso não exista) com as seguintes configurações:
```env
API_PORT=3001
DB_HOST=localhost
DB_PORT=3306
DB_USER=seu_usuario_do_mysql
DB_PASSWORD=sua_senha_do_mysql
DB_NAME=cimol
VITE_API_KEY=cimol_secure_token_abc123
```

---

## ⚡ Como Executar o Projeto

1. Instale todas as dependências necessárias rodando no terminal raiz:
   ```bash
   npm install
   ```

2. Inicie o frontend e o backend simultaneamente com um único comando:
   ```bash
   npm run dev
   ```

O console mostrará dois endereços:
* **Frontend:** Acesse `http://localhost:8080` para abrir o painel do site.
* **Documentação Swagger:** Acesse `http://localhost:3001/api-CIMOL/docs` ou apenas `http://localhost:3001` (redirecionamento automático) para visualizar e interagir com a documentação da API.

---

## 🌐 Acesso em Rede Local (Intranet da Escola)

O projeto está configurado para permitir acessos de outros aparelhos (como celulares ou tablets) conectados na mesma rede Wi-Fi da escola. 

Quando você rodar o comando `npm run dev`, o Vite exibirá o IP da rede local em **`Network`**:
```bash
  ➜  Local:   http://localhost:8080/
  ➜  Network: http://192.168.68.108:8080/
```
Qualquer dispositivo conectado ao mesmo Wi-Fi poderá acessar o sistema inserindo esse endereço IP no navegador!

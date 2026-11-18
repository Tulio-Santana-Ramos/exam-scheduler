# Agendamento de exames e laudos

Aplicação web para uma clínica agendar exames, cadastrar laudos e disponibilizá-los para consulta pelo paciente.

## Por que foi construído

Este projeto é a entrega do **desafio técnico "Agendamento de exames e acesso a laudos"**. O objetivo era um sistema simples, mas correto nos pontos que importam: regras de agendamento, controle de acesso feito pelo backend e consistência quando duas pessoas agem ao mesmo tempo.

Há dois perfis:

- **Equipe da clínica:** agenda exames, consulta e filtra agendamentos por data e paciente, cancela agendamentos, e cadastra, salva como rascunho e publica laudos.
- **Paciente:** vê apenas os próprios agendamentos e os laudos **publicados** dos seus exames.

## Versão publicada

- **Aplicação:** https://exam-scheduler-web.pages.dev
- **API:** https://exam-api-14477408456.us-central1.run.app (`/health` responde `{"status":"ok"}`)

> **A versão publicada contém dados fictícios** (pacientes, agendamentos e laudos de teste). Nada ali é real.

Na tela de entrada há botões de acesso rápido às contas de demonstração (senha de todas: `demo1234`):

| Perfil | E-mail |
|---|---|
| Equipe da clínica | `clinica@demo.test` |
| Paciente (Ana Souza) | `paciente1@demo.test` |
| Paciente (Bruno Lima) | `paciente2@demo.test` |

O que experimentar:

1. Entre como **clínica**, abra *Novo agendamento*, escolha paciente, exame e um horário livre.
2. Na lista, use *Escrever laudo*, salve como rascunho e depois publique.
3. Entre como **paciente** (Ana) e abra o laudo publicado. Entre como Bruno e confirme que ele não enxerga o laudo da Ana.

Observações: a hospedagem é gratuita e "dorme" quando ociosa, então o primeiro acesso após um tempo parado pode demorar alguns segundos. O login tem limite de 10 tentativas por minuto.

## Como o código funciona

```
apps/api       API (Node + TypeScript + Fastify + PostgreSQL)
apps/web       Interface (React + TypeScript + Vite), em português
compose.yaml   Banco, API e web para rodar localmente
deploy/        Scripts de publicação (Neon, Google Cloud Run, Cloudflare Pages)
docs/          Decisões técnicas (ADRs, em inglês)
```

**Backend.** Cada requisição passa por camadas com responsabilidades separadas: `Controller` (HTTP) → `UseCase` (um caso de uso) → `Service` (regras de negócio) → `Repository` (SQL). As regras ficam no domínio, sem depender de HTTP ou banco, o que permite testá-las com repositórios em memória.

**Autorização.** O backend valida o perfil em toda rota, mesmo que a interface esconda o botão. O paciente que pede um rascunho ou o laudo de outra pessoa recebe `404`, então ninguém descobre ids alheios.

**Consistência (acesso simultâneo).** O banco garante as regras, não só o código:

- Um índice único parcial impede dois agendamentos ativos no mesmo horário e libera o horário de um agendamento cancelado.
- Cancelar, salvar rascunho e publicar bloqueiam a linha do agendamento (`SELECT … FOR UPDATE`) dentro de uma transação.
- Restrições e um gatilho no banco impedem editar um laudo publicado.

**Horários e fuso.** Tudo é guardado e trafega em UTC. O fuso da clínica é **America/Sao_Paulo (UTC−3)**, sempre exibido no rodapé. Horários de 30 minutos, das **07:00 às 19:00** (último horário às 18:30). Não é possível agendar no passado nem cancelar um agendamento que já começou.

**Regras dos laudos.** Um laudo por agendamento. Rascunho: editável e visível só para a clínica. Publicado: imutável, visível ao paciente, com data de publicação registrada. Agendamento cancelado não recebe laudo, e agendamento com laudo publicado não pode ser cancelado.

**Frontend.** React com TanStack Query. As chamadas à API ficam em hooks (`apps/web/src/hooks`) e as telas são componentes pequenos. Funciona em celular e computador, com tema claro e escuro.

**Logs.** JSON estruturado (pino), com identificador de requisição, pronto para ferramentas como o Grafana Loki. Senhas, tokens e o texto dos laudos nunca são registrados.

## Como rodar localmente

Requisitos: Docker e Docker Compose.

```bash
docker compose up -d --build --wait
```

| Serviço | Endereço |
|---|---|
| Aplicação | http://localhost:5173 |
| API | http://localhost:3000 (`/health`) |
| PostgreSQL | `localhost:5433` (usuário e senha `exam`) |

O banco é preparado sozinho: as migrações rodam e os **dados fictícios** são carregados (3 usuários, 2 pacientes e 3 tipos de exame: Raio-X, Ultrassom e Ressonância magnética). As contas são as da tabela acima, com os mesmos botões na tela de entrada.

- Recomeçar do zero: `docker compose down -v`.
- Porta ocupada? Libere 3000, 5173 ou 5433. Para o banco, crie um arquivo `.env` ao lado do `compose.yaml` com `DB_HOST_PORT=5434` (e use essa porta no `TEST_DATABASE_URL`).
- As variáveis de ambiente estão documentadas em `.env.example`, sem segredos reais.

### Sem Docker para a aplicação (desenvolvimento)

```bash
cp .env.example .env
docker compose up -d --wait db      # apenas o banco
npm install

cd apps/api
export $(grep -v '^#' ../../.env | grep -v '^$' | xargs)
npm run db:migrate && npm run db:seed
npm run dev                         # API em :3000

cd ../web && npm run dev            # interface em :5173
```

## Testes

```bash
npm run typecheck && npm run lint   # os dois projetos

cd apps/api
npm run test:unit                   # sem banco (83 testes)
npm run test:integration            # PostgreSQL real, precisa do contêiner do banco (55 testes)

cd ../web && npm test               # 5 testes
```

Os testes de integração apagam as tabelas do banco de teste. Por segurança, `TEST_DATABASE_URL` precisa terminar em `_test`.

Cenários pedidos no desafio:

| Cenário | Onde |
|---|---|
| Duas tentativas simultâneas no mesmo horário: só uma é aceita | `concurrency.test.ts`, `http.test.ts` |
| Paciente consulta laudo de outro paciente: acesso negado | `patient-access.test.ts`, `http.test.ts` |
| Paciente tenta acessar um rascunho: conteúdo não é entregue | `patient-access.test.ts`, `http.test.ts` |
| Laudo publicado fica disponível para o paciente correto | `patient-access.test.ts`, `http.test.ts` |
| Agendamento no passado é rejeitado | `slot-start.test.ts`, `use-cases.test.ts`, `http.test.ts` |

## Decisões técnicas, limitações e pendências

Decisões detalhadas (em inglês): [camadas](docs/decisions/0001-layering.md), [consistência e fuso](docs/decisions/0002-consistency-and-time.md) e [logs](docs/decisions/0003-observability.md).

Limitações conhecidas:

- O token de sessão fica no `localStorage`. Um cookie `httpOnly` seria mais seguro, mas exigiria web e API no mesmo domínio.
- Sem paginação por cursor: a lista da clínica abre no dia de hoje e as listas têm limite de itens.
- Sem recuperação de senha nem cadastro de usuários (as contas vêm da carga de dados fictícios).
- Sem métricas e rastreamento; o envio de logs ao Grafana Cloud está implementado, mas não foi testado em uma conta real.
- O campo de data usa o formato do navegador (em um navegador em português aparece dia/mês/ano).
- Não há testes automatizados de navegador no repositório; a interface foi verificada com scripts de Chromium fora dele.

## Publicação

A versão publicada usa serviços gratuitos: **Neon** (PostgreSQL), **Google Cloud Run** (API em contêiner) e **Cloudflare Pages** (interface estática). Os scripts em `deploy/` fazem a publicação e leem as variáveis de arquivos `.env` fora do Git (ver `deploy/.env.example`); segredos ficam no Secret Manager.

## Tempo dedicado

Aproximadamente **8 horas**, somando:

- pesquisa;
- planejamento;
- desenvolvimento (API, banco e interface);
- revisão;
- testes;
- publicação;
- testes na versão em produção.

# 🏃‍♂️ Sistema de Monitoramento de Estoque de Eventos

Sistema automatizado para monitoramento de estoque de produtos relacionados a eventos de corrida, com alertas automáticos via email quando o estoque está baixo.

## 📋 Problema

A empresa Norte MKT gerencia eventos de corrida que possuem kits com produtos diversos (camisetas, acessórios, etc.). O principal desafio era:

- **Falta de visibilidade em tempo real** do estoque dos produtos relacionados aos eventos
- **Alertas manuais** demorados e sujeitos a erro humano
- **Risco de ruptura de estoque** sem aviso prévio
- **Dificuldade de monitorar múltiplos eventos** simultaneamente
- **Produtos patrocinadores e acessórios desnecessários** gerando ruído nos relatórios

## 💡 Solução

Sistema automatizado desenvolvido em Node.js que:

### 🔍 **Monitoramento Inteligente**
- Consulta automática ao banco de dados MySQL para obter eventos ativos
- Integração com GraphQL API para buscar informações detalhadas dos produtos
- Filtragem inteligente que exclui produtos irrelevantes (patrocinadores, baterias, etc.)
- Processamento concorrente para otimizar performance

### 📊 **Sistema de Alertas**
- Monitoramento contínuo com limite configurável de estoque (padrão: 50 unidades)
- Alertas automáticos quando o estoque fica abaixo do limite
- Relatórios detalhados por evento e produto
- Agrupamento por kits para melhor visualização

### 📧 **Notificações Automáticas**
- Envio de emails automáticos com planilhas Excel anexadas
- Relatórios formatados com informações completas
- Lista de destinatários configurável
- Templates personalizados para diferentes tipos de alerta

### ⏰ **Execução Programada**
- Execução automática a cada 2 horas durante horário comercial
- Funcionamento apenas em dias úteis (segunda a sexta)
- Github Actions para fazer o executar o código

## 🛠️ Tecnologias Utilizadas

- **Node.js** - Runtime JavaScript
- **MySQL2** - Conexão com banco de dados
- **GraphQL Request** - Consultas à API GraphQL
- **Nodemailer** - Envio de emails
- **XLSX** - Geração de planilhas Excel
- **Dotenv** - Gerenciamento de variáveis de ambiente

## 📁 Estrutura do Projeto

```
backend/
├── index.js        # Arquivo principal com lógica de monitoramento
├── database.js     # Configuração da conexão MySQL
├── queryBD.js      # Queries SQL para consulta de eventos
├── send.js         # Módulo de envio de emails
├── alertExcel.js   # Geração de planilhas Excel
└── package.json    # Dependências do projeto
```

## 🚀 Funcionalidades

### 🔄 **Processo Automatizado**
1. **Consulta de Eventos**: Busca eventos com data >= 2025-01-01 no banco
2. **Análise de Produtos**: Consulta GraphQL para obter detalhes dos produtos
3. **Verificação de Estoque**: Analisa estoque de produtos relacionados
4. **Filtragem Inteligente**: Remove produtos irrelevantes automaticamente
5. **Geração de Alertas**: Identifica produtos com estoque baixo
6. **Relatórios**: Cria planilhas Excel com dados detalhados
7. **Notificações**: Envia emails com relatórios anexados

### 📈 **Filtros Implementados**
- **Produtos Patrocinadores**: Excluídos automaticamente
- **Acessórios Específicos retirados da análise**: Bateria, distância, termo, aceite, jaqueta, boné, moletom
- **Status de Estoque**: Verificação de disponibilidade

### 📊 **Relatórios Gerados**
- **Resumo Executivo**: Total de eventos monitorados e alertas
- **Detalhamento por Evento**: Lista de produtos com estoque baixo
- **Planilha Excel**: Dados estruturados para análise

## ⚙️ Configuração

### 📋 **Variáveis de Ambiente (.env)**
```env
MYSQL_HOST=seu_host_mysql
MYSQL_USER=seu_usuario
MYSQL_PASSWORD=sua_senha
MYSQL_DATABASE=sua_database
EMAIL=seu_email@empresa.com
PASSWORDEMAIL=sua_senha_email
```

### 🎯 **Parâmetros Configuráveis**
```javascript
const LIMITE = 10;          // Limite de concorrência
const LIMITE_ESTOQUE = 50;  // Limite para alerta de estoque baixo
const endpoint = "https://runningland.com.br/graphql";
```

## 📈 Resultados

### ✅ **Benefícios Alcançados**
- **identificação** de problemas de estoque
- **Automatização completa** do processo de monitoramento
- **Alertas proativos** antes da ruptura de estoque
- **Relatórios padronizados** para tomada de decisão
- **Redução de erro humano** através da automação

### 📊 **Métricas de Performance**
- **Processamento concorrente** com limite configurável
- **Execução programada** garante monitoramento contínuo
- **Relatórios a cada 2H** com dados atualizados

### 🎯 **Impacto no Negócio**
- **Prevenção de rupturas** de estoque em eventos críticos
- **Melhoria na experiência** do cliente final
- **Otimização de recursos** da equipe de gestão
- **Visibilidade completa** do status dos eventos

## 🔧 Como Executar

1. **Instalação das dependências**:
```bash
npm install
```

2. **Configuração das variáveis de ambiente**:
```bash
cp .env.example .env
# Editar .env com suas credenciais
```

3. **Execução manual** (para testes):
```bash
node backend/index.js
```
4. **Execução automática**: O sistema roda automaticamente via GitHub Actions configurado no código.

## 📧 Destinatários dos Alertas

Para adicionar novos destinatários, edite o array `destinatarios` no arquivo `index.js`.

---

**Desenvolvido por**: Pedro Otavio Santos Da Silva - Norte MKT  
**Última atualização**: Agosto 2025

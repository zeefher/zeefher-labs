# Zeefher Labs + Órbita Estoque

Portfólio interativo e projeto demonstrativo de controle de estoque com Python, SQLite, HTML, CSS e JavaScript.

## Executar localmente

Requer Python 3.12 ou superior, sem dependências externas.

```sh
python3 dev.py
```

Acesse http://localhost:8000 e http://localhost:8000/estoque/.

## Funcionalidades

Cadastro de produtos e categorias, entrada/saída com validação de saldo, indicadores, filtro de estoque baixo, histórico e exportação CSV.

## Arquitetura e limites

A interface envia o snapshot individual para `/api/stock`. Python valida os dados e executa consultas parametrizadas e transações SQLite em memória. O saldo é calculado pelo histórico de movimentações, com `JOIN`, `SUM` e `GROUP BY`. Valores monetários usam centavos inteiros.

A demonstração salva o snapshot no localStorage do navegador. Não existe banco compartilhado ou autenticação. Não é um sistema de produção nem deve receber dados reais. Limites: 200 produtos e 2.000 movimentações. Limpar os dados do navegador apaga as alterações.

Para produção: banco persistente, autenticação, autorização por organização, migrações e auditoria no servidor seriam necessários.

## Verificar

```sh
python3 -m unittest discover -s tests
```

## Publicação

A raiz contém `vercel.json`; `api/stock.py` é uma função Python. Os arquivos estáticos não precisam de build.

## Créditos

Galáxia adaptada de Galaxy Generator, Alvaro Saburido (MIT, 2022), inspirado no Three.js Journey. Licença original preservada no HTML. Three.js r160 incluído sob MIT. Projeto desenvolvido com assistência de IA.

## Pulso — Análise de vendas

Acesse /pulso/ para importar CSV ou usar a amostra. API Python /api/pulso, sem dependências. Campos: pedido, data, produto, categoria, quantidade, preco_unitario. Datas ISO, valores não negativos, sem separador de milhar, quantidade inteira positiva.

Limites: 500 KB, 5.000 linhas, intervalo de até 10 anos. Duplicatas exatas nas seis colunas são excluídas; linhas inválidas são listadas. Ticket médio divide receita pelos pedidos distintos no filtro. Comparação usa o intervalo imediatamente anterior com o mesmo número de dias; variação fica sem base quando a receita anterior é zero. Não calcula lucro, descontos ou devoluções.

O CSV é enviado para análise em memória, sem persistência. Use dados fictícios. Exportação contém indicadores, ranking e problemas identificados. Desenvolvimento assistido por IA.

## Nexo SQL — Projeto 03

Acesse /nexo. Cinco perguntas de negócio com SQL exibido e executado em SQLite em memória: clientes por receita, evolução mensal, clientes sem compra, ranking de produtos e reposição de estoque. As consultas ficam em nexo/consultas.json; estrutura, índices e dados reproduzíveis em nexo/schema.sql.

Datas são parâmetros vinculados. A API aceita somente identificadores de consultas previamente definidas, sem SQL arbitrário. Os resultados podem ser exportados em CSV. Dados fictícios de julho a setembro de 2026. Pedidos cancelados são excluídos da receita. Estoque é um retrato independente das vendas. LAG compara o mês anterior presente no resultado, não preenche meses sem vendas. Preços em centavos; não calcula lucro. Projeto desenvolvido com assistência de IA.

Execute todos os testes com python -m unittest discover -s tests.

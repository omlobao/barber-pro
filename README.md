# 💈 BarberPro — Sistema de Gestão & Agendamento Inteligente

> Backend robusto desenvolvido em **Python** e **Django**, projetado para automatizar o fluxo operacional completo de barbearias e salões: catálogo de serviços e produtos, cálculo dinâmico de horários livres, agendamento atômico anti-concorrência, controle de comandas, comissões de profissionais e fluxo de caixa.

---

## 📌 Visão Geral da Arquitetura

O **BarberPro** foi estruturado em uma arquitetura modular orientada a domínios, com isolamento de responsabilidades e regras de negócio encapsuladas:

```
barber/
├── catalog/          # Catálogo de serviços, preços promocionais e estoque de produtos
├── clients/          # Cadastro de clientes, validação de WhatsApp, faltas e bloqueios
├── professionals/    # Barbeiros, expedientes, comissões e feriados (holidays)
├── scheduling/       # Motor de disponibilidade de slots e agendamento atômico
├── financial/        # Comandas (PDV), fluxo de caixa, repasse de comissões e estoque
├── setup/            # Configurações globais do Django (settings, URLs, WSGI/ASGI)
└── manage.py
```

---

## ⚙️ Funcionalidades & Módulos

### 1. ✂️ Catálogo (`catalog`)
* **Serviços**: categorização (Cabelo, Barba, Combos, Estética, Química), controle de duração mínima em minutos e property inteligente `effective_price` (aplica preço promocional quando ativo).
* **Produtos**: controle de preço de custo, preço de venda, margem, quantidade em estoque e alerta visual de estoque mínimo (`min_stock_alert`).
* **Slug e SKU Únicos**: geradores automáticos anti-colisão no `save()`.

### 2. 💈 Profissionais & Agenda (`professionals`)
* **Perfil do Barbeiro**: foto, taxas de comissão diferenciadas para serviços e produtos, intervalo de corte e tempo de buffer (limpeza da bancada entre atendimentos).
* **Expediente Semanal (`WorkingHours`)**: configuração por dia da semana (segunda a domingo), horários de início/fim e horário de almoço/pausa.
* **Exceções de Agenda (`ScheduleException`)**: bloqueios parciais ou de dia inteiro, férias, horários extras e integração com a biblioteca `holidays` para preenchimento e carga anual de feriados nacionais e estaduais (`populate_national_holidays`).

### 3. 👤 Clientes (`clients`)
* Sanitização e validação automática de telefone/WhatsApp com DDD.
* Métricas operacionais: total de visitas, histórico de faltas sem aviso (`no-show`) e trava preventiva para agendamentos online (`is_blocked`).

### 4. 📅 Motor de Agendamento (`scheduling`)
* **Cálculo de Slots Livres (`get_available_slots`)**:
  * Cruza a grade de trabalho semanal (`WorkingHours`) com turnos extras.
  * Desconta feriados, folgas e bloqueios parciais (`ScheduleException`).
  * Desconta agendamentos ativos + margem de limpeza da bancada (`buffer_time_minutes`).
  * Remove horários passados no mesmo dia com margem de antecedência mínima de 15 minutos.
* **Reserva Atômica Anti-Concorrência (`create_booking`)**:
  * Executado dentro de `transaction.atomic()` com lock pessimista (`select_for_update()`) para impedir que dois clientes reservem o mesmo slot no mesmo milissegundo.
  * Congelamento histórico de preços e durações no `AppointmentItem`.
  * Geração de `cancel_token` seguro para cancelamento/reagendamento via link do WhatsApp sem necessidade de login.

### 5. 💰 Financeiro & PDV (`financial`)
* **Comandas (`Order`)**: suporta abertura automática a partir de agendamento ou venda avulsa de balcão.
* **Múltiplos Meios de Pagamento**: Pix, Cartão de Crédito, Cartão de Débito, Dinheiro e Pagamento Misto.
* **Fechamento de Comanda (`close_order`)**:
  * Validação atômica e baixa imediata no estoque dos produtos vendidos.
  * Conclusão automática do agendamento vinculado e incremento no histórico de visitas do cliente.
  * Geração de registro de comissão do barbeiro (`ComissionRecord`), incluindo gorjetas/caixinhas.
  * Lançamento automático da receita no Fluxo de Caixa (`CashFlowTransaction`).

### 6. 🛡️ Django Admin Completo
* Inlines interativos (`OrderItemInline`, `AppointmentItemInline`, `WorkingHoursInline`, `ScheduleExceptionInline`).
* Ações em lote: confirmação de agendamentos, estornos e pagamento de comissões pendentes.
* Busca e filtros avançados com `autocomplete_fields` e `date_hierarchy`.

---

## 🛠️ Tecnologias Utilizadas

* **Linguagem**: Python 3.14+
* **Framework Web**: Django 6.x
* **API Toolkit**: Django REST Framework
* **Cálculo de Feriados**: `holidays` (Brasil / Estados)
* **Processamento de Imagens**: Pillow
* **Padronização de Código**: PEP 8 (100% validado)
* **Banco de Dados**: SQLite (Desenvolvimento) / PostgreSQL (Produção)

---

## 🚀 Como Executar o Projeto Localmente

### 1. Clonar o repositório
```bash
git clone https://github.com/omlobao/barber-pro.git
cd barber-pro
```

### 2. Criar e ativar o ambiente virtual
```bash
python3 -m venv venv
source venv/bin/activate  # No Windows: venv\Scripts\activate
```

### 3. Instalar as dependências
```bash
pip install -r requirements.txt
```

### 4. Executar as migrações
```bash
python manage.py migrate
```

### 5. Criar o superusuário para acessar o painel administrativo
```bash
python manage.py createsuperuser
```

### 6. Iniciar o servidor de desenvolvimento
```bash
python manage.py runserver
```

Acesse o painel administrativo em: `http://127.0.0.1:8000/admin/`

---

## 📄 Licença

Este projeto está sob a licença MIT. Consulte o arquivo [LICENSE](LICENSE) para obter mais detalhes.

---

Desenvolvido por **[Matheus Lobão](https://github.com/omlobao)**.

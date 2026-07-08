/**
 * WF Tasks – Tasks Module
 * CRUD, filtros, busca e estatísticas
 */
const WFTasks = {

  DAYS: ['segunda','terca','quarta','quinta','sexta','sabado','domingo'],

  DAY_LABELS: {
    segunda: 'Segunda-feira',
    terca:   'Terça-feira',
    quarta:  'Quarta-feira',
    quinta:  'Quinta-feira',
    sexta:   'Sexta-feira',
    sabado:  'Sábado',
    domingo: 'Domingo'
  },

  DAY_SHORT: {
    segunda:'Seg', terca:'Ter', quarta:'Qua', quinta:'Qui',
    sexta:'Sex', sabado:'Sáb', domingo:'Dom'
  },

  DAY_LABELS_PLURAL: {
    segunda: 'segundas-feiras', terca: 'terças-feiras', quarta: 'quartas-feiras',
    quinta: 'quintas-feiras', sexta: 'sextas-feiras', sabado: 'sábados', domingo: 'domingos'
  },

  PRIORITY_LABELS: { alta:'Alta', media:'Média', baixa:'Baixa' },
  STATUS_LABELS:   { pendente:'Pendente', andamento:'Em andamento', concluida:'Concluída' },

  // ---------- leitura ----------

  getAll()        { return WFStorage.getTasks(); },
  getByDay(day)   { return WFStorage.getTasks().filter(t => t.day === day); },

  getFiltered({ day = null, priority = null, status = null, search = '' } = {}) {
    let list = WFStorage.getTasks();
    if (day)      list = list.filter(t => t.day === day);
    if (priority) list = list.filter(t => t.priority === priority);
    if (status)   list = list.filter(t => t.status === status);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
      );
    }
    return list;
  },

  // ---------- criação ----------

  create({ title, description, day, date, recurring, priority, status }) {
    if (!title?.trim())
      return { success: false, error: 'Título é obrigatório.' };
    if (!this.DAYS.includes(day))
      return { success: false, error: 'Dia inválido.' };
    if (!recurring && !date)
      return { success: false, error: 'Selecione uma data específica ou marque para repetir toda semana.' };
    if (!['alta','media','baixa'].includes(priority))
      return { success: false, error: 'Prioridade inválida.' };
    if (!['pendente','andamento','concluida'].includes(status))
      return { success: false, error: 'Status inválido.' };

    const task = {
      id:          this._uid(),
      title:       title.trim(),
      description: description?.trim() || '',
      day, priority, status,
      date:        recurring ? null : date,
      recurring:   !!recurring,
      createdAt:   new Date().toISOString(),
      updatedAt:   new Date().toISOString()
    };
    WFStorage.addTask(task);
    return { success: true, task };
  },

  // ---------- atualização ----------

  update(id, updates) {
    if (updates.title !== undefined && !updates.title?.trim())
      return { success: false, error: 'Título é obrigatório.' };
    if (updates.recurring !== undefined) {
      if (!updates.recurring && !updates.date)
        return { success: false, error: 'Selecione uma data específica ou marque para repetir toda semana.' };
      updates = { ...updates, date: updates.recurring ? null : updates.date };
    }
    const task = WFStorage.updateTask(id, updates);
    if (!task) return { success: false, error: 'Tarefa não encontrada.' };
    return { success: true, task };
  },

  // ---------- exclusão ----------

  delete(id) {
    WFStorage.deleteTask(id);
    return { success: true };
  },

  // ---------- duplicar ----------

  duplicate(id) {
    const src = WFStorage.getTaskById(id);
    if (!src) return { success: false, error: 'Tarefa não encontrada.' };
    const copy = {
      ...src,
      id:        this._uid(),
      title:     src.title + ' (cópia)',
      status:    'pendente',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    WFStorage.addTask(copy);
    return { success: true, task: copy };
  },

  // ---------- mover ----------

  moveToDay(id, newDay) {
    if (!this.DAYS.includes(newDay))
      return { success: false, error: 'Dia inválido.' };
    const task = WFStorage.getTaskById(id);
    const updates = { day: newDay };
    if (task && task.recurring === false) {
      const ref = task.date ? this._parseDate(task.date) : new Date();
      updates.date = this.getDateForDay(newDay, ref);
      updates.recurring = false;
    }
    return this.update(id, updates);
  },

  complete(id) { return this.update(id, { status: 'concluida' }); },

  // ---------- estatísticas ----------

  getStats() {
    const all = WFStorage.getTasks();
    const total     = all.length;
    const concluidas = all.filter(t => t.status === 'concluida').length;
    const andamento  = all.filter(t => t.status === 'andamento').length;
    const pendentes  = all.filter(t => t.status === 'pendente').length;
    const percentual = total > 0 ? Math.round(concluidas / total * 100) : 0;

    const byDay = {};
    this.DAYS.forEach(d => {
      const dt = all.filter(t => t.day === d);
      byDay[d] = {
        total:     dt.length,
        concluidas: dt.filter(t => t.status === 'concluida').length,
        andamento:  dt.filter(t => t.status === 'andamento').length,
        pendentes:  dt.filter(t => t.status === 'pendente').length
      };
    });

    const byPriority = {
      alta:  all.filter(t => t.priority === 'alta').length,
      media: all.filter(t => t.priority === 'media').length,
      baixa: all.filter(t => t.priority === 'baixa').length
    };

    return { total, concluidas, andamento, pendentes, percentual, byDay, byPriority };
  },

  // retorna a chave do dia de hoje (seg-dom)
  getTodayKey() {
    return ['domingo','segunda','terca','quarta','quinta','sexta','sabado'][new Date().getDay()];
  },

  // ---------- datas ----------

  // formata uma Date local como 'YYYY-MM-DD' (sem deslocamento de fuso)
  formatDate(d) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  },

  // data (YYYY-MM-DD) da ocorrência de `day` na semana que contém `ref` (semana começa segunda)
  getDateForDay(day, ref = new Date()) {
    const targetIdx  = this.DAYS.indexOf(day);
    if (targetIdx === -1) return null;
    const mondayOffset = (ref.getDay() + 6) % 7;
    const monday = new Date(ref);
    monday.setDate(ref.getDate() - mondayOffset);
    monday.setDate(monday.getDate() + targetIdx);
    return this.formatDate(monday);
  },

  // chave do dia da semana (seg-dom) a partir de uma data 'YYYY-MM-DD'
  dayKeyFromDate(dateStr) {
    return ['domingo','segunda','terca','quarta','quinta','sexta','sabado'][this._parseDate(dateStr).getDay()];
  },

  // interpreta 'YYYY-MM-DD' como data local (evita deslocamento de fuso do Date.parse)
  _parseDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  },

  // formata 'YYYY-MM-DD' como 'DD/MM' para exibição
  formatDateShort(dateStr) {
    const [, m, d] = dateStr.split('-');
    return `${d}/${m}`;
  },

  _uid() {
    return 'task_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
  }
};

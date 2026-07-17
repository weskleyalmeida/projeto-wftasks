/**
 * WF Tasks – Dashboard Controller
 * Renderização, navegação, drag-drop, modais, filtros, relatórios, configurações
 */
const WFDashboard = {

  currentSection: 'dashboard',
  filter: { day: null, priority: null, status: null, search: '' },
  editingId:    null,
  calendarDate: new Date(),
  draggedId:    null,

  // ═══════════════════════════════════════════════════
  //  INICIALIZAÇÃO
  // ═══════════════════════════════════════════════════

  init() {
    if (!WFAuth.requireAuth()) return;
    this.initTheme();
    this.initSidebar();
    this.initUser();
    this.bindEvents();
    this.navigate('dashboard');
    document.body.classList.add('loaded');
  },

  // ─── Sidebar recolhida ──────────────────────────────

  initSidebar() {
    const collapsed = WFStorage.getSidebarCollapsed();
    if (collapsed) {
      document.querySelector('.app')?.classList.add('sidebar-collapsed');
      document.getElementById('sidebar')?.classList.add('collapsed');
    }
    this._updateCollapseBtn(collapsed);
  },

  toggleSidebar() {
    const collapsed = document.getElementById('sidebar')?.classList.toggle('collapsed');
    document.querySelector('.app')?.classList.toggle('sidebar-collapsed', collapsed);
    WFStorage.saveSidebarCollapsed(collapsed);
    this._updateCollapseBtn(collapsed);
  },

  _updateCollapseBtn(collapsed) {
    const btn = document.getElementById('sidebarCollapseBtn');
    if (btn) btn.title = collapsed ? 'Expandir menu' : 'Recolher menu';
  },

  // ─── Tema ───────────────────────────────────────────

  initTheme() {
    const t = WFStorage.getTheme();
    document.documentElement.setAttribute('data-theme', t);
    this._updateThemeBtn(t);
  },

  toggleTheme() {
    const curr = WFStorage.getTheme();
    const next = curr === 'light' ? 'dark' : 'light';
    WFStorage.saveTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    this._updateThemeBtn(next);
  },

  _updateThemeBtn(t) {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    btn.innerHTML = t === 'dark' ? ICONS.sun : ICONS.moon;
    btn.title = t === 'dark' ? 'Modo claro' : 'Modo escuro';
  },

  // ─── Usuário no header ──────────────────────────────

  initUser() {
    const u = WFAuth.getCurrentUser();
    if (!u) return;
    this._renderAvatar(document.getElementById('userAvatar'), u);
    const nm = document.getElementById('headerUserName');
    if (nm) nm.textContent = u.name;
  },

  // ─── Avatar (header + configurações) ────────────────

  _renderAvatar(el, user) {
    if (!el || !user) return;
    if (user.avatar) {
      el.innerHTML = `<img src="${user.avatar}" alt="Foto de perfil">`;
    } else {
      const initials = user.name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase();
      el.textContent = initials;
    }
  },

  onAvatarFileSelected(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.toast('Selecione um arquivo de imagem.', 'error');
      input.value = '';
      return;
    }

    const img = new Image();
    const reader = new FileReader();
    reader.onload = e => {
      img.onload = () => {
        const size = 160;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', .85);

        const r = WFAuth.updateAvatar(dataUrl);
        if (r.success) {
          this.initUser();
          this.loadSettings();
          this.toast('Foto de perfil atualizada!', 'success');
        } else this.toast(r.error, 'error');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    input.value = '';
  },

  removeAvatar() {
    const r = WFAuth.updateAvatar(null);
    if (r.success) {
      this.initUser();
      this.loadSettings();
      this.toast('Foto de perfil removida.', 'info');
    } else this.toast(r.error, 'error');
  },

  // ─── Eventos ────────────────────────────────────────

  bindEvents() {
    // Nav
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        this.navigate(el.dataset.section);
        if (window.innerWidth <= 768) {
          document.getElementById('sidebar').classList.remove('open');
          document.getElementById('sidebarOverlay').classList.remove('show');
        }
      });
    });

    // Hamburger
    document.getElementById('menuToggle')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
      document.getElementById('sidebarOverlay').classList.toggle('show');
    });

    document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebarOverlay').classList.remove('show');
    });

    // Recolher/expandir sidebar
    document.getElementById('sidebarCollapseBtn')?.addEventListener('click', () => this.toggleSidebar());

    // Tema
    document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());

    // Busca
    document.getElementById('searchInput')?.addEventListener('input', e => {
      this.filter.search = e.target.value;
      if (this.currentSection === 'dashboard') this.renderWeekly();
      else if (this.currentSection === 'tasks')  this.renderTaskList();
    });

    // Modal backdrop
    document.getElementById('taskModal')?.addEventListener('click', e => {
      if (e.target.id === 'taskModal') this.closeModal();
    });

    // Form submit
    document.getElementById('taskForm')?.addEventListener('submit', e => {
      e.preventDefault();
      this.saveTask();
    });

    // Sincronização dia da semana / data específica / repetição
    document.getElementById('fDay')?.addEventListener('change', e => {
      this._onFDayChange(e.target.value);
    });
    document.getElementById('fDate')?.addEventListener('change', e => {
      if (!e.target.value) return;
      document.getElementById('fDay').value = WFTasks.dayKeyFromDate(e.target.value);
    });
    document.getElementById('fRecurring')?.addEventListener('change', () => {
      this._updateDateGroupVisibility();
    });

    // Dropdown toggles
    document.getElementById('notifBtn')?.addEventListener('click', () => {
      this._toggleDropdown('notifDropdown');
    });
    document.getElementById('userAvatarBtn')?.addEventListener('click', () => {
      this._toggleDropdown('userDropdown');
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('.header-icon-btn') && !e.target.closest('.dropdown-menu'))
        document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.remove('show'));
    });
  },

  _toggleDropdown(id) {
    const el = document.getElementById(id);
    document.querySelectorAll('.dropdown-menu').forEach(d => {
      if (d.id !== id) d.classList.remove('show');
    });
    el?.classList.toggle('show');
  },

  // ═══════════════════════════════════════════════════
  //  NAVEGAÇÃO
  // ═══════════════════════════════════════════════════

  navigate(section) {
    document.querySelectorAll('.nav-item').forEach(el =>
      el.classList.toggle('active', el.dataset.section === section)
    );
    document.querySelectorAll('.app-section').forEach(s =>
      s.classList.toggle('active', s.dataset.section === section)
    );
    this.currentSection = section;
    const titles = {
      dashboard:'Dashboard', tasks:'Tarefas', calendar:'Calendário',
      priorities:'Prioridades', reports:'Relatórios', settings:'Configurações'
    };
    const el = document.getElementById('pageTitle');
    if (el) el.textContent = titles[section] || 'WF Tasks';
    this._renderSection(section);
  },

  _renderSection(s) {
    switch (s) {
      case 'dashboard':   this.updateCards(); this.renderWeekly(); this.renderUpcoming(); break;
      case 'tasks':       this.renderTaskList(); break;
      case 'calendar':    this.renderCalendar(); break;
      case 'priorities':  this.renderPriorities(); break;
      case 'reports':     this.renderReports(); break;
      case 'settings':    this.loadSettings(); break;
    }
  },

  // ═══════════════════════════════════════════════════
  //  SUMMARY CARDS
  // ═══════════════════════════════════════════════════

  updateCards() {
    const s = WFTasks.getStats();
    this._animateCount('cardTotal',     s.total);
    this._animateCount('cardConcluidas',s.concluidas);
    this._animateCount('cardAndamento', s.andamento);
    this._animateCount('cardPendentes', s.pendentes);
  },

  _animateCount(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = parseInt(el.textContent) || 0;
    const steps = 20;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      el.textContent = Math.round(start + (target - start) * (step / steps));
      if (step >= steps) { el.textContent = target; clearInterval(interval); }
    }, 20);
  },

  // ═══════════════════════════════════════════════════
  //  QUADRO SEMANAL
  // ═══════════════════════════════════════════════════

  renderWeekly() {
    const board = document.getElementById('weeklyBoard');
    if (!board) return;
    const today = WFTasks.getTodayKey();
    board.innerHTML = WFTasks.DAYS.map(day => this._dayColumn(day, today)).join('');
  },

  _dayColumn(day, today) {
    const dateForDay = WFTasks.getDateForDay(day);
    let tasks = WFTasks.getAll().filter(t =>
      t.recurring !== false ? t.day === day : t.date === dateForDay
    );
    if (this.filter.search.trim()) {
      const q = this.filter.search.toLowerCase();
      tasks = tasks.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
      );
    }
    tasks = [...tasks].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
    const isToday = day === today;
    return `
      <div class="day-col${isToday ? ' is-today' : ''}" data-day="${day}"
           ondragover="WFDashboard.onDragOver(event)"
           ondragenter="WFDashboard.onDragEnter(event)"
           ondragleave="WFDashboard.onDragLeave(event)"
           ondrop="WFDashboard.onDrop(event)">
        <div class="day-col-header">
          <div class="day-col-title">
            <span class="day-abbr">${WFTasks.DAY_SHORT[day]}</span>
            <span class="day-date">${WFTasks.formatDateShort(dateForDay)}</span>
            ${isToday ? '<span class="today-chip">Hoje</span>' : ''}
          </div>
          <span class="day-count">${tasks.length}</span>
        </div>
        <div class="day-col-body">
          ${tasks.length === 0
            ? '<div class="empty-col"><p>Sem tarefas</p></div>'
            : tasks.map(t => this._taskCard(t)).join('')}
        </div>
        <button class="btn-add-col" onclick="WFDashboard.openCreateModal('${day}')">
          ${ICONS.plus} Adicionar
        </button>
      </div>`;
  },

  _taskCard(task) {
    const pc = _priorityClass(task.priority);
    const sc = _statusClass(task.status);
    return `
      <div class="task-card ${task.status === 'concluida' ? 'done' : ''}"
           data-id="${task.id}" draggable="true"
           ondragstart="WFDashboard.onDragStart(event,'${task.id}')"
           ondragend="WFDashboard.onDragEnd(event)">
        <div class="card-stripe ${pc}"></div>
        <div class="card-body">
          <div class="card-top">
            <p class="card-title">${_esc(task.title)}</p>
            <div class="card-actions">
              <button class="icon-btn" title="Editar" onclick="WFDashboard.openEditModal('${task.id}')">${ICONS.edit}</button>
              <button class="icon-btn" title="Duplicar" onclick="WFDashboard.duplicateTask('${task.id}')">${ICONS.copy}</button>
              <button class="icon-btn danger" title="Excluir" onclick="WFDashboard.deleteTask('${task.id}')">${ICONS.trash}</button>
            </div>
          </div>
          ${task.description ? `<p class="card-desc">${_esc(task.description)}</p>` : ''}
          <div class="card-foot">
            ${task.time ? `<span class="badge badge-day">${_esc(task.time)}</span>` : ''}
            <span class="badge ${pc}">${WFTasks.PRIORITY_LABELS[task.priority]}</span>
            <span class="badge ${sc}">${WFTasks.STATUS_LABELS[task.status]}</span>
            ${task.recurring === false && task.date
              ? `<span class="badge badge-day" title="Data específica">${WFTasks.formatDateShort(task.date)}</span>`
              : ''}
            ${task.status !== 'concluida'
              ? `<button class="btn-check" title="Concluir" onclick="WFDashboard.completeTask('${task.id}')">${ICONS.check}</button>`
              : ''}
          </div>
        </div>
      </div>`;
  },

  // ═══════════════════════════════════════════════════
  //  PRÓXIMAS TAREFAS (a partir da próxima semana)
  // ═══════════════════════════════════════════════════

  renderUpcoming() {
    const wrap = document.getElementById('upcomingWrap');
    if (!wrap) return;
    const endOfWeek = WFTasks.getDateForDay('domingo');
    const upcoming = WFTasks.getAll()
      .filter(t => t.recurring === false && t.date && t.date > endOfWeek && t.status !== 'concluida')
      .sort((a, b) => (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99')))
      .slice(0, 8);

    wrap.innerHTML = upcoming.length === 0
      ? '<p class="no-tasks-msg">Nenhuma tarefa agendada para as próximas semanas.</p>'
      : `<div class="task-rows">${upcoming.map(t => this._taskRow(t)).join('')}</div>`;
  },

  // ═══════════════════════════════════════════════════
  //  DRAG & DROP
  // ═══════════════════════════════════════════════════

  onDragStart(e, id) {
    this.draggedId = id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    e.currentTarget.classList.add('dragging');
  },

  onDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.day-col').forEach(c => c.classList.remove('drag-over'));
  },

  onDragOver(e)  { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; },
  onDragEnter(e) { e.currentTarget.classList.add('drag-over'); },

  onDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget))
      e.currentTarget.classList.remove('drag-over');
  },

  onDrop(e) {
    e.preventDefault();
    const col = e.currentTarget;
    col.classList.remove('drag-over');
    const id     = this.draggedId || e.dataTransfer.getData('text/plain');
    const newDay = col.dataset.day;
    if (id && newDay) {
      const task = WFStorage.getTaskById(id);
      if (task && task.day !== newDay) {
        WFTasks.moveToDay(id, newDay);
        this.renderWeekly();
        this.updateCards();
        this.toast('Tarefa movida com sucesso!', 'success');
      }
    }
    this.draggedId = null;
  },

  // ═══════════════════════════════════════════════════
  //  AÇÕES DE TAREFA
  // ═══════════════════════════════════════════════════

  completeTask(id) {
    WFTasks.complete(id);
    this._renderSection(this.currentSection);
    this.updateCards();
    this.toast('Tarefa concluída! 🎉', 'success');
  },

  deleteTask(id) {
    if (!confirm('Deseja excluir esta tarefa?')) return;
    WFTasks.delete(id);
    this._renderSection(this.currentSection);
    this.updateCards();
    this.toast('Tarefa excluída.', 'info');
  },

  duplicateTask(id) {
    const r = WFTasks.duplicate(id);
    if (r.success) {
      this._renderSection(this.currentSection);
      this.updateCards();
      this.toast('Tarefa duplicada!', 'success');
    }
  },

  // ═══════════════════════════════════════════════════
  //  MODAL
  // ═══════════════════════════════════════════════════

  openCreateModal(day = null) {
    this.editingId = null;
    document.getElementById('modalTitle').textContent = 'Nova Tarefa';
    document.getElementById('taskForm').reset();
    day = day || WFTasks.getTodayKey();
    document.getElementById('fDay').value = day;
    document.getElementById('fDate').value = WFTasks.getDateForDay(day);
    document.getElementById('fTime').value = '';
    document.getElementById('fRecurring').checked = false;
    document.getElementById('fPriority').value = 'media';
    document.getElementById('fStatus').value   = 'pendente';
    this._updateDateGroupVisibility();
    this._showModal();
  },

  openCreateModalForDate(dateStr) {
    this.editingId = null;
    document.getElementById('modalTitle').textContent = 'Nova Tarefa';
    document.getElementById('taskForm').reset();
    document.getElementById('fDay').value = WFTasks.dayKeyFromDate(dateStr);
    document.getElementById('fDate').value = dateStr;
    document.getElementById('fTime').value = '';
    document.getElementById('fRecurring').checked = false;
    document.getElementById('fPriority').value = 'media';
    document.getElementById('fStatus').value   = 'pendente';
    this._updateDateGroupVisibility();
    this._showModal();
  },

  openEditModal(id) {
    const task = WFStorage.getTaskById(id);
    if (!task) return;
    this.editingId = id;
    document.getElementById('modalTitle').textContent   = 'Editar Tarefa';
    document.getElementById('fTitle').value            = task.title;
    document.getElementById('fDescription').value      = task.description || '';
    document.getElementById('fDay').value              = task.day;
    document.getElementById('fDate').value             = task.date || WFTasks.getDateForDay(task.day);
    document.getElementById('fTime').value              = task.time || '';
    document.getElementById('fRecurring').checked      = task.recurring !== false;
    document.getElementById('fPriority').value         = task.priority;
    document.getElementById('fStatus').value           = task.status;
    this._updateDateGroupVisibility();
    this._showModal();
  },

  _onFDayChange(day) {
    const dateEl = document.getElementById('fDate');
    if (day && dateEl && (!dateEl.value || WFTasks.dayKeyFromDate(dateEl.value) !== day)) {
      dateEl.value = WFTasks.getDateForDay(day);
    }
    this._updateDateGroupVisibility();
  },

  _updateDateGroupVisibility() {
    const recurring = document.getElementById('fRecurring')?.checked;
    const group      = document.getElementById('fDateGroup');
    const dateInput  = document.getElementById('fDate');
    const day        = document.getElementById('fDay')?.value;
    const label      = document.getElementById('fRecurringDayLabel');
    if (label) label.textContent = day ? `todas as ${WFTasks.DAY_LABELS_PLURAL[day]}` : 'toda semana';
    if (group)     group.style.display = recurring ? 'none' : '';
    if (dateInput) dateInput.required  = !recurring;
  },

  closeModal() {
    document.getElementById('taskModal').classList.remove('show');
    document.body.classList.remove('modal-open');
    this.editingId = null;
    const err = document.getElementById('formError');
    if (err) err.textContent = '';
  },

  _showModal() {
    document.getElementById('taskModal').classList.add('show');
    document.body.classList.add('modal-open');
    setTimeout(() => document.getElementById('fTitle')?.focus(), 80);
  },

  saveTask() {
    const data = {
      title:       document.getElementById('fTitle').value.trim(),
      description: document.getElementById('fDescription').value.trim(),
      day:         document.getElementById('fDay').value,
      date:        document.getElementById('fDate').value,
      time:        document.getElementById('fTime').value,
      recurring:   document.getElementById('fRecurring').checked,
      priority:    document.getElementById('fPriority').value,
      status:      document.getElementById('fStatus').value
    };
    const r = this.editingId
      ? WFTasks.update(this.editingId, data)
      : WFTasks.create(data);

    if (r.success) {
      this.closeModal();
      this._renderSection(this.currentSection);
      this.updateCards();
      this.toast(this.editingId ? 'Tarefa atualizada!' : 'Tarefa criada!', 'success');
    } else {
      const err = document.getElementById('formError');
      if (err) err.textContent = r.error;
    }
  },

  // ═══════════════════════════════════════════════════
  //  LISTA DE TAREFAS (seção Tasks)
  // ═══════════════════════════════════════════════════

  renderTaskList() {
    const wrap = document.getElementById('taskListWrap');
    if (!wrap) return;
    const tasks = WFTasks.getFiltered(this.filter);

    if (tasks.length === 0) {
      wrap.innerHTML = `
        <div class="empty-state">
          ${ICONS.emptyTasks}
          <h3>Nenhuma tarefa encontrada</h3>
          <p>Ajuste os filtros ou crie uma nova tarefa.</p>
          <button class="btn btn-primary mt-1" onclick="WFDashboard.openCreateModal()">+ Nova Tarefa</button>
        </div>`;
      return;
    }
    wrap.innerHTML = `<div class="task-rows">${tasks.map(t => this._taskRow(t)).join('')}</div>`;
  },

  _taskRow(task) {
    const pc = _priorityClass(task.priority);
    const sc = _statusClass(task.status);
    return `
      <div class="task-row ${task.status === 'concluida' ? 'done' : ''}">
        <div class="row-stripe ${pc}"></div>
        <div class="row-info">
          <span class="row-title">${_esc(task.title)}</span>
          ${task.description ? `<span class="row-desc">${_esc(task.description)}</span>` : ''}
        </div>
        <div class="row-meta">
          ${task.time ? `<span class="badge badge-day">${_esc(task.time)}</span>` : ''}
          <span class="badge ${pc}">${WFTasks.PRIORITY_LABELS[task.priority]}</span>
          <span class="badge ${sc}">${WFTasks.STATUS_LABELS[task.status]}</span>
          <span class="badge badge-day">${WFTasks.DAY_SHORT[task.day]}${task.recurring === false && task.date ? ' · ' + WFTasks.formatDateShort(task.date) : ''}</span>
        </div>
        <div class="row-actions">
          ${task.status !== 'concluida'
            ? `<button class="icon-btn success" title="Concluir" onclick="WFDashboard.completeTask('${task.id}')">${ICONS.check}</button>`
            : ''}
          <button class="icon-btn" title="Editar" onclick="WFDashboard.openEditModal('${task.id}')">${ICONS.edit}</button>
          <button class="icon-btn" title="Duplicar" onclick="WFDashboard.duplicateTask('${task.id}')">${ICONS.copy}</button>
          <button class="icon-btn danger" title="Excluir" onclick="WFDashboard.deleteTask('${task.id}')">${ICONS.trash}</button>
        </div>
      </div>`;
  },

  setFilter(type, value) {
    if (this.filter[type] === value) {
      this.filter[type] = null;
      document.querySelectorAll(`[data-ftype="${type}"]`).forEach(b => b.classList.remove('active'));
    } else {
      this.filter[type] = value;
      document.querySelectorAll(`[data-ftype="${type}"]`).forEach(b =>
        b.classList.toggle('active', b.dataset.fval === value)
      );
    }
    this.renderTaskList();
  },

  // ═══════════════════════════════════════════════════
  //  CALENDÁRIO
  // ═══════════════════════════════════════════════════

  renderCalendar() {
    const wrap = document.getElementById('calendarWrap');
    if (!wrap) return;

    const d = this.calendarDate;
    const year = d.getFullYear(), month = d.getMonth();
    const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
    const lastDate = new Date(year, month + 1, 0).getDate();
    const today = new Date(); today.setHours(0,0,0,0);
    const dayKeys = ['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
    const tasks = WFTasks.getAll();

    let html = `
      <div class="cal-nav">
        <button class="btn-icon" onclick="WFDashboard.shiftMonth(-1)">${ICONS.chevLeft}</button>
        <h2>${MONTHS[month]} ${year}</h2>
        <button class="btn-icon" onclick="WFDashboard.shiftMonth(1)">${ICONS.chevRight}</button>
      </div>
      <div class="cal-grid">
        ${'Seg Ter Qua Qui Sex Sáb Dom'.split(' ').map(h => `<div class="cal-head">${h}</div>`).join('')}
        ${Array(firstDay).fill('<div class="cal-cell empty"></div>').join('')}`;

    for (let n = 1; n <= lastDate; n++) {
      const dt = new Date(year, month, n);
      const key = dayKeys[dt.getDay()];
      const iso = WFTasks.formatDate(dt);
      const dayTasks = tasks.filter(t =>
        t.recurring !== false ? t.day === key : t.date === iso
      );
      const isToday  = dt.getTime() === today.getTime();
      html += `
        <div class="cal-cell${isToday ? ' cal-today' : ''}" title="Adicionar tarefa em ${n}/${month+1}"
             onclick="WFDashboard.openCreateModalForDate('${iso}')">
          <span class="cal-num">${n}</span>
          ${dayTasks.slice(0,3).map(t => {
            const prefix = t.time ? `${_esc(t.time)} ` : '';
            return `<div class="cal-dot ${_priorityClass(t.priority)}" title="${prefix}${_esc(t.title)}"
                         onclick="event.stopPropagation(); WFDashboard.openEditModal('${t.id}')">${prefix}${_esc(t.title.slice(0,18))}${t.title.length>18?'…':''}</div>`;
          }).join('')}
          ${dayTasks.length > 3 ? `<div class="cal-more">+${dayTasks.length-3}</div>` : ''}
        </div>`;
    }
    html += '</div>';
    wrap.innerHTML = html;
  },

  shiftMonth(delta) {
    this.calendarDate.setMonth(this.calendarDate.getMonth() + delta);
    this.renderCalendar();
  },

  // ═══════════════════════════════════════════════════
  //  PRIORIDADES
  // ═══════════════════════════════════════════════════

  renderPriorities() {
    const wrap = document.getElementById('prioritiesWrap');
    if (!wrap) return;
    const all = WFTasks.getAll();
    const sections = [
      { key:'alta',  label:'Alta Prioridade',  cls:'priority-high' },
      { key:'media', label:'Média Prioridade', cls:'priority-medium' },
      { key:'baixa', label:'Baixa Prioridade', cls:'priority-low' }
    ];
    wrap.innerHTML = sections.map(s => {
      const list = all.filter(t => t.priority === s.key);
      return `
        <div class="prio-section">
          <div class="prio-header ${s.cls}">
            <span>${s.label}</span>
            <span class="prio-count">${list.length}</span>
          </div>
          <div class="prio-body">
            ${list.length === 0
              ? '<p class="no-tasks-msg">Nenhuma tarefa nesta prioridade.</p>'
              : list.map(t => this._taskRow(t)).join('')}
          </div>
        </div>`;
    }).join('');
  },

  // ═══════════════════════════════════════════════════
  //  RELATÓRIOS
  // ═══════════════════════════════════════════════════

  renderReports() {
    const wrap = document.getElementById('reportsWrap');
    if (!wrap) return;
    const s = WFTasks.getStats();
    const tau = 2 * Math.PI * 40;

    wrap.innerHTML = `
      <div class="reports-grid">

        <div class="rep-card">
          <h3>Resumo Geral</h3>
          <div class="stat-list">
            <div class="stat-item"><span>Total</span><strong>${s.total}</strong></div>
            <div class="stat-item"><span>Concluídas</span><strong class="tc-success">${s.concluidas}</strong></div>
            <div class="stat-item"><span>Em andamento</span><strong class="tc-warning">${s.andamento}</strong></div>
            <div class="stat-item"><span>Pendentes</span><strong class="tc-danger">${s.pendentes}</strong></div>
          </div>
        </div>

        <div class="rep-card rep-donut">
          <h3>Taxa de Conclusão</h3>
          <div class="donut-wrap">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" class="ring-bg"/>
              <circle cx="50" cy="50" r="40" class="ring-fill"
                stroke-dasharray="${tau}"
                stroke-dashoffset="${tau * (1 - s.percentual/100)}"
                style="transition:stroke-dashoffset 1s ease"/>
            </svg>
            <div class="donut-label">
              <span class="donut-pct">${s.percentual}%</span>
              <span class="donut-sub">concluído</span>
            </div>
          </div>
        </div>

        <div class="rep-card">
          <h3>Por Prioridade</h3>
          ${[
            { l:'Alta',  v:s.byPriority.alta,  cls:'priority-high' },
            { l:'Média', v:s.byPriority.media, cls:'priority-medium' },
            { l:'Baixa', v:s.byPriority.baixa, cls:'priority-low' }
          ].map(r => `
            <div class="bar-row">
              <span class="bar-lbl">${r.l}</span>
              <div class="bar-track"><div class="bar-fill ${r.cls}" style="width:${s.total>0?Math.round(r.v/s.total*100):0}%"></div></div>
              <span class="bar-val">${r.v}</span>
            </div>`).join('')}
        </div>

        <div class="rep-card rep-wide">
          <h3>Produtividade por Dia</h3>
          <div class="week-chart">
            ${WFTasks.DAYS.map(day => {
              const d = s.byDay[day];
              const pct = d.total > 0 ? Math.round(d.concluidas/d.total*100) : 0;
              return `
                <div class="chart-col">
                  <div class="chart-bar-wrap">
                    <div class="chart-bar" style="height:${Math.max(pct,2)}%" title="${pct}%">
                      ${pct > 10 ? `<span>${pct}%</span>` : ''}
                    </div>
                  </div>
                  <span class="chart-lbl">${WFTasks.DAY_SHORT[day]}</span>
                  <span class="chart-sub">${d.total}t</span>
                </div>`;
            }).join('')}
          </div>
        </div>

      </div>`;
  },

  // ─── Exportar PDF ────────────────────────────────────

  exportReportPDF() {
    const current = document.documentElement.getAttribute('data-theme');
    if (current === 'dark') {
      document.documentElement.setAttribute('data-theme', 'light');
      const restore = () => {
        document.documentElement.setAttribute('data-theme', current);
        window.removeEventListener('afterprint', restore);
      };
      window.addEventListener('afterprint', restore);
    }
    window.print();
  },

  // ═══════════════════════════════════════════════════
  //  CONFIGURAÇÕES
  // ═══════════════════════════════════════════════════

  loadSettings() {
    const u = WFAuth.getCurrentUser();
    if (!u) return;
    const n = document.getElementById('setName');
    const e = document.getElementById('setEmail');
    const t = document.getElementById('setTheme');
    if (n) n.value = u.name;
    if (e) e.value = u.email;
    if (t) t.value = WFStorage.getTheme();
    this._renderAvatar(document.getElementById('settingsAvatar'), u);
    const removeBtn = document.getElementById('setAvatarRemoveBtn');
    if (removeBtn) removeBtn.style.display = u.avatar ? '' : 'none';
  },

  saveProfile() {
    const name = document.getElementById('setName')?.value?.trim();
    const r = WFAuth.updateProfile(name);
    if (r.success) { this.initUser(); this.toast('Perfil atualizado!', 'success'); }
    else this.toast(r.error, 'error');
  },

  savePassword() {
    const cur  = document.getElementById('setCurPwd')?.value;
    const next = document.getElementById('setNewPwd')?.value;
    const conf = document.getElementById('setConPwd')?.value;
    if (!cur || !next || !conf) { this.toast('Preencha todos os campos.', 'error'); return; }
    if (next !== conf)          { this.toast('As senhas não coincidem.', 'error'); return; }
    const r = WFAuth.updatePassword(cur, next);
    if (r.success) {
      ['setCurPwd','setNewPwd','setConPwd'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
      });
      this.toast('Senha alterada!', 'success');
    } else this.toast(r.error, 'error');
  },

  deleteAccount() {
    const pwd = document.getElementById('setDeletePwd')?.value;
    if (!pwd) { this.toast('Informe sua senha para confirmar.', 'error'); return; }
    if (!confirm('Tem certeza? Esta ação é permanente e não pode ser desfeita.')) return;

    const r = WFAuth.deleteAccount(pwd);
    if (r.success) {
      this.toast('Conta excluída. Até logo!', 'info');
      setTimeout(() => { window.location.href = 'login.html'; }, 1200);
    } else this.toast(r.error, 'error');
  },

  applyTheme() {
    const t = document.getElementById('setTheme')?.value;
    if (!t) return;
    WFStorage.saveTheme(t);
    document.documentElement.setAttribute('data-theme', t);
    this._updateThemeBtn(t);
    this.toast('Tema aplicado!', 'success');
  },

  // ═══════════════════════════════════════════════════
  //  TOAST
  // ═══════════════════════════════════════════════════

  toast(msg, type = 'info') {
    const box = document.getElementById('toastBox');
    if (!box) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `${ICONS.toastIcon[type] || ICONS.toastIcon.info}<span>${msg}</span>`;
    box.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350); }, 3000);
  }
};

// ── utilidades globais ──────────────────────────────
function _esc(s) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(s));
  return d.innerHTML;
}
function _priorityClass(p) {
  return { alta:'priority-high', media:'priority-medium', baixa:'priority-low' }[p] || '';
}
function _statusClass(s) {
  return { pendente:'status-pending', andamento:'status-progress', concluida:'status-done' }[s] || '';
}

// ── ícones SVG ─────────────────────────────────────
const ICONS = {
  plus:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  check:     `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  edit:      `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  copy:      `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  trash:     `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`,
  chevLeft:  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>`,
  chevRight: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`,
  sun:       `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
  moon:      `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  emptyTasks:`<svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.25"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  toastIcon: {
    success: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    info:    `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    warning: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>`
  }
};

document.addEventListener('DOMContentLoaded', () => WFDashboard.init());

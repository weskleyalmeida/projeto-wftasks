/**
 * WF Tasks – Auth Module
 * Login, cadastro, sessão e perfil de usuário
 */
const WFAuth = {

  // ---------- login ----------

  login(email, password) {
    if (!email || !password)
      return { success: false, error: 'Preencha todos os campos.' };

    const user = WFStorage.getUserByEmail(email);
    if (!user)
      return { success: false, error: 'E-mail não encontrado.' };

    if (user.password !== this._hash(password))
      return { success: false, error: 'Senha incorreta.' };

    if (user.status === 'pendente') {
      WFStorage.savePendingEmail(user.email);
      return { success: false, error: 'pending', email: user.email };
    }

    WFStorage.saveSession(user);
    return { success: true, user };
  },

  // ---------- cadastro ----------

  register(name, email, password, confirmPassword) {
    if (!name || !email || !password || !confirmPassword)
      return { success: false, error: 'Preencha todos os campos.' };

    if (!this._validEmail(email))
      return { success: false, error: 'E-mail inválido.' };

    if (password.length < 6)
      return { success: false, error: 'A senha deve ter no mínimo 6 caracteres.' };

    if (password !== confirmPassword)
      return { success: false, error: 'As senhas não coincidem.' };

    if (WFStorage.getUserByEmail(email))
      return { success: false, error: 'Este e-mail já está cadastrado.' };

    const code      = this._generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const user = {
      id:               this._uid(),
      name:             name.trim(),
      email:            email.toLowerCase().trim(),
      password:         this._hash(password),
      status:           'pendente',
      verificationCode: code,
      codeExpiresAt:    expiresAt,
      createdAt:        new Date().toISOString()
    };

    WFStorage.addUser(user);
    WFStorage.savePendingEmail(user.email);
    return { success: true };
  },

  // ---------- sessão ----------

  logout() {
    WFStorage.clearSession();
    window.location.href = 'login.html';
  },

  getCurrentUser()    { return WFStorage.getSession(); },

  requireAuth() {
    if (!WFStorage.isLoggedIn()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  },

  redirectIfLoggedIn() {
    if (WFStorage.isLoggedIn()) {
      window.location.href = 'index.html';
      return true;
    }
    return false;
  },

  // ---------- atualização de perfil ----------

  updateProfile(name) {
    if (!name || !name.trim())
      return { success: false, error: 'Nome é obrigatório.' };

    const session = WFStorage.getSession();
    if (!session) return { success: false, error: 'Sessão expirada.' };

    const updated = WFStorage.updateUser(session.email, { name: name.trim() });
    if (!updated) return { success: false, error: 'Erro ao atualizar.' };

    WFStorage.saveSession(updated);
    return { success: true, user: updated };
  },

  updatePassword(current, next) {
    const session = WFStorage.getSession();
    if (!session) return { success: false, error: 'Sessão expirada.' };

    const user = WFStorage.getUserByEmail(session.email);
    if (!user) return { success: false, error: 'Usuário não encontrado.' };

    if (user.password !== this._hash(current))
      return { success: false, error: 'Senha atual incorreta.' };

    if (next.length < 6)
      return { success: false, error: 'A nova senha deve ter no mínimo 6 caracteres.' };

    WFStorage.updateUser(session.email, { password: this._hash(next) });
    return { success: true };
  },

  // ---------- verificação de conta ----------

  verifyCode(email, code) {
    const user = WFStorage.getUserByEmail(email);
    if (!user)                return { success: false, error: 'not_found' };
    if (user.status === 'ativo') return { success: false, error: 'already_active' };
    if (new Date() > new Date(user.codeExpiresAt))
      return { success: false, error: 'expired' };
    if (user.verificationCode !== String(code))
      return { success: false, error: 'invalid' };

    WFStorage.updateUser(email, {
      status:           'ativo',
      verificationCode: null,
      codeExpiresAt:    null
    });
    WFStorage.clearPendingEmail();
    return { success: true };
  },

  resendCode(email) {
    const user = WFStorage.getUserByEmail(email);
    if (!user)                return { success: false, error: 'not_found' };
    if (user.status === 'ativo') return { success: false, error: 'already_active' };

    const code      = this._generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    WFStorage.updateUser(email, { verificationCode: code, codeExpiresAt: expiresAt });
    return { success: true, code };
  },

  sendVerificationEmail(toEmail, toName, code) {
    if (typeof emailjs === 'undefined') {
      console.warn('[WFAuth] EmailJS SDK não encontrado.');
      return Promise.reject(new Error('sdk_missing'));
    }
    return emailjs.send('service_s19b45r', 'template_j7lj3vq', {
      to_email:     toEmail,
      NOME_USUARIO: toName,
      CODIGO:       code,
      title:        'Código de Verificação WF Tasks'
    });
  },

  // ---------- helpers privados ----------

  _validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); },

  _generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  },

  _hash(pwd) {
    let h = 0;
    for (let i = 0; i < pwd.length; i++) {
      h = Math.imul(31, h) + pwd.charCodeAt(i) | 0;
    }
    return 'wf_' + Math.abs(h).toString(36) + pwd.length;
  },

  _uid() {
    return 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
  }
};

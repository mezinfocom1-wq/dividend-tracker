/**
 * Dividend Tracker Pro - Configuration Cloud & Email (Open Source)
 * 
 * Gestion de l'envoi d'emails réels via EmailJS ou Web3Forms
 */

const EMAIL_CONFIG_KEY = 'dividend_tracker_email_config_v1';

function getEmailConfig() {
  try {
    const saved = localStorage.getItem(EMAIL_CONFIG_KEY);
    return saved ? JSON.parse(saved) : {
      provider: 'emailjs',
      emailjs: {
        publicKey: '',
        serviceId: '',
        templateId: ''
      },
      web3forms: {
        accessKey: ''
      }
    };
  } catch (e) {
    return { provider: 'emailjs', emailjs: {}, web3forms: {} };
  }
}

function saveEmailConfig(cfg) {
  localStorage.setItem(EMAIL_CONFIG_KEY, JSON.stringify(cfg));
}

/**
 * Envoi d'email de validation (Création de compte ou Réinitialisation mot de passe)
 * @param {string} email - Destinataire
 * @param {string} name - Nom
 * @param {string} code - Code à 6 chiffres
 * @param {string} type - "register" ou "reset"
 */
async function sendVerificationEmail(email, name, code, type = "register") {
  const cfg = getEmailConfig();
  const subject = type === "reset" 
    ? `[Dividend Tracker] Votre code de réinitialisation : ${code}`
    : `[Dividend Tracker] Votre code d'activation : ${code}`;

  const message = `Bonjour ${name || 'Investisseur'},\n\nVotre code de sécurité à 6 chiffres est : ${code}\n\nCe code est valable pendant 15 minutes. Ne le partagez avec personne.\n\nL'équipe Dividend Tracker Pro`;

  console.log(`[Email Service] Envoi du code ${code} vers ${email}...`);

  // 1. Envoi via EmailJS si configuré
  if (cfg.provider === 'emailjs' && cfg.emailjs?.publicKey && cfg.emailjs?.serviceId && typeof emailjs !== 'undefined') {
    try {
      emailjs.init(cfg.emailjs.publicKey);
      const res = await emailjs.send(
        cfg.emailjs.serviceId,
        cfg.emailjs.templateId,
        {
          to_email: email,
          to_name: name || 'Utilisateur',
          verification_code: code,
          subject: subject,
          message: message
        }
      );
      console.log("[EmailJS Success]", res);
      return { success: true, realSent: true, code: code, message: `Email réellement envoyé à ${email} !` };
    } catch (err) {
      console.warn("[EmailJS Error]", err);
    }
  }

  // 2. Envoi via Web3Forms si configuré
  if (cfg.provider === 'web3forms' && cfg.web3forms?.accessKey) {
    try {
      const resp = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          access_key: cfg.web3forms.accessKey,
          email: email,
          subject: subject,
          from_name: "Dividend Tracker Pro",
          message: message
        })
      });
      const data = await resp.json();
      if (data.success) {
        return { success: true, realSent: true, code: code, message: `Email réellement envoyé à ${email} !` };
      }
    } catch (err) {
      console.warn("[Web3Forms Error]", err);
    }
  }

  // 3. Fallback immédiat (code affiché instantanément à l'écran pour ne JAMAIS bloquer l'utilisateur)
  return {
    success: true,
    realSent: false,
    code: code,
    message: `Code de sécurité généré pour ${email} : [ ${code} ]`
  };
}

// UI Handlers pour la configuration Email
function openEmailConfigModal() {
  const cfg = getEmailConfig();
  const modal = document.getElementById('emailConfigModal');
  if (!modal) return;

  const providerSel = document.getElementById('cfgEmailProvider');
  if (providerSel) providerSel.value = cfg.provider || 'emailjs';

  if (document.getElementById('cfgEmailJsPublicKey')) {
    document.getElementById('cfgEmailJsPublicKey').value = cfg.emailjs?.publicKey || '';
    document.getElementById('cfgEmailJsServiceId').value = cfg.emailjs?.serviceId || '';
    document.getElementById('cfgEmailJsTemplateId').value = cfg.emailjs?.templateId || '';
  }

  if (document.getElementById('cfgWeb3FormsKey')) {
    document.getElementById('cfgWeb3FormsKey').value = cfg.web3forms?.accessKey || '';
  }

  toggleEmailConfigFields();
  openModal('emailConfigModal');
}

function toggleEmailConfigFields() {
  const provider = document.getElementById('cfgEmailProvider')?.value;
  const ejFields = document.getElementById('emailjsFields');
  const w3Fields = document.getElementById('web3formsFields');

  if (provider === 'web3forms') {
    ejFields?.classList.add('hidden');
    w3Fields?.classList.remove('hidden');
  } else {
    ejFields?.classList.remove('hidden');
    w3Fields?.classList.add('hidden');
  }
}

function handleSaveEmailConfig(event) {
  event.preventDefault();
  const provider = document.getElementById('cfgEmailProvider').value;

  const cfg = {
    provider: provider,
    emailjs: {
      publicKey: document.getElementById('cfgEmailJsPublicKey')?.value.trim() || '',
      serviceId: document.getElementById('cfgEmailJsServiceId')?.value.trim() || '',
      templateId: document.getElementById('cfgEmailJsTemplateId')?.value.trim() || ''
    },
    web3forms: {
      accessKey: document.getElementById('cfgWeb3FormsKey')?.value.trim() || ''
    }
  };

  saveEmailConfig(cfg);
  closeModal('emailConfigModal');
  if (typeof showToast === 'function') {
    showToast('Configuration Email sauvegardée ! Vos emails partiront en direct.', 'success');
  }
}

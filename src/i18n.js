'use strict';

/* =========================================================================
 * Translations. All user-visible text lives here.
 *
 * To add a language: add a block below with the same keys, and add its code
 * to the language choice in index.html (and to resolve_language in lib.rs).
 * ========================================================================= */

const MESSAGES = {
  en: {
    // Accessible names of buttons (read by screen readers; no tooltips, the pen hover would show them)
    'color.black': 'black',
    'color.grey': 'grey',
    'color.brown': 'brown',
    'color.red': 'red',
    'color.orange': 'orange',
    'color.yellow': 'yellow',
    'color.green': 'green',
    'color.blue': 'blue',
    'color.purple': 'purple',
    'color.pink': 'pink',
    'page.teddy': 'Teddy bear',
    'page.guitar': 'Guitar',
    'page.shoe': 'Shoe',
    'tool.stop': 'Stop',
    'tool.eraser': 'Eraser',
    'tool.undo': 'Undo',
    'tool.clear': 'Clear',
    'tool.settings': 'Caregiver settings (hold for 3 seconds)',
    'nav.colors': 'Colours',
    'nav.tools': 'Tools',

    // File names of saved drawings: "<prefix> 2026-11-12 14-03-22.png"
    'file.prefix': 'Drawing',

    // Caregiver settings
    'settings.title': 'Caregiver settings',
    'settings.folder': 'Save folder',
    'settings.folder.change': 'Change…',
    'settings.folder.open': 'Open folder',
    'settings.folder.default': 'Default folder',
    'settings.folder.pick': 'Choose the folder for the drawings',
    'settings.drawing': 'Drawing',
    'settings.finger': 'Allow drawing with a finger',
    'settings.rightHanded': 'Right-handed',
    'settings.leftHanded': 'Left-handed',
    'settings.language': 'Language',
    'settings.language.auto': 'Automatic (Windows: {lang})',
    'settings.updates': 'Updates',
    'settings.version': 'Current version:',
    'settings.update.check': 'Check for updates',
    'settings.update.install': 'Install version {version}',
    'settings.update.checking': 'Checking…',
    'settings.update.available': 'New version available: {version}',
    'settings.update.none': 'You have the latest version.',
    'settings.update.checkFailed': 'Checking failed. Is there an internet connection?',
    'settings.update.downloading': 'Downloading… {percent}%',
    'settings.update.downloadingNoSize': 'Downloading…',
    'settings.update.installing': 'Installing…',
    'settings.update.installFailed': 'Installation failed.',
    'settings.update.desktopOnly': 'Updates only work in the Windows app.',
    'settings.close': 'Close',
    'settings.lastError': 'Last error – {error}',

    'browser.folderOnlyInApp': 'Only available in the Windows app.',
    'browser.closed': 'The Windows app would close now. (The drawing has been saved.)',
    'browser.saveDir': '(browser: downloads)',
    'browser.version': 'browser',

    // Where an error happened
    'where.saveDrawing': 'Saving drawing',
    'where.saveSession': 'Saving session',
    'where.loadSession': 'Loading previous drawing',
    'where.loadSettings': 'Loading settings',
    'where.saveSettings': 'Saving settings',
    'where.openFolder': 'Opening folder',
    'where.checkUpdate': 'Checking for updates',
    'where.installUpdate': 'Installing update',

    // Error codes coming from the native side (lib.rs)
    'error.io_error': 'Could not read or write a file',
    'error.invalid_file_name': 'Invalid file name',
    'error.missing_file_name': 'File name missing',
    'error.expected_binary': 'Invalid data',
    'error.image_failed': 'Could not create the image',
  },

  nl: {
    'color.black': 'zwart',
    'color.grey': 'grijs',
    'color.brown': 'bruin',
    'color.red': 'rood',
    'color.orange': 'oranje',
    'color.yellow': 'geel',
    'color.green': 'groen',
    'color.blue': 'blauw',
    'color.purple': 'paars',
    'color.pink': 'roze',
    'page.teddy': 'Teddybeer',
    'page.guitar': 'Gitaar',
    'page.shoe': 'Schoen',
    'tool.stop': 'Stoppen',
    'tool.eraser': 'Gom',
    'tool.undo': 'Ongedaan maken',
    'tool.clear': 'Leeg maken',
    'tool.settings': 'Instellingen begeleider (3 seconden ingedrukt houden)',
    'nav.colors': 'Kleuren',
    'nav.tools': 'Hulpmiddelen',

    'file.prefix': 'Tekening',

    'settings.title': 'Instellingen begeleider',
    'settings.folder': 'Opslagmap',
    'settings.folder.change': 'Wijzigen…',
    'settings.folder.open': 'Map openen',
    'settings.folder.default': 'Standaardmap',
    'settings.folder.pick': 'Kies de map voor de tekeningen',
    'settings.drawing': 'Tekenen',
    'settings.finger': 'Tekenen met de vinger toestaan',
    'settings.rightHanded': 'Rechtshandig',
    'settings.leftHanded': 'Linkshandig',
    'settings.language': 'Taal',
    'settings.language.auto': 'Automatisch (Windows: {lang})',
    'settings.updates': 'Updates',
    'settings.version': 'Huidige versie:',
    'settings.update.check': 'Zoek naar updates',
    'settings.update.install': 'Installeer versie {version}',
    'settings.update.checking': 'Bezig met zoeken…',
    'settings.update.available': 'Nieuwe versie beschikbaar: {version}',
    'settings.update.none': 'Je hebt de nieuwste versie.',
    'settings.update.checkFailed': 'Zoeken mislukt. Is er internet?',
    'settings.update.downloading': 'Downloaden… {percent}%',
    'settings.update.downloadingNoSize': 'Downloaden…',
    'settings.update.installing': 'Installeren…',
    'settings.update.installFailed': 'Installeren mislukt.',
    'settings.update.desktopOnly': 'Updates werken alleen in de Windows-app.',
    'settings.close': 'Sluiten',
    'settings.lastError': 'Laatste fout – {error}',

    'browser.folderOnlyInApp': 'Alleen beschikbaar in de Windows-app.',
    'browser.closed': 'In de Windows-app sluit het programma nu. (De tekening is bewaard.)',
    'browser.saveDir': '(browser: downloads)',
    'browser.version': 'browser',

    'where.saveDrawing': 'Tekening opslaan',
    'where.saveSession': 'Sessie bewaren',
    'where.loadSession': 'Vorige tekening laden',
    'where.loadSettings': 'Instellingen laden',
    'where.saveSettings': 'Instellingen bewaren',
    'where.openFolder': 'Map openen',
    'where.checkUpdate': 'Updates zoeken',
    'where.installUpdate': 'Update installeren',

    'error.io_error': 'Kon een bestand niet lezen of schrijven',
    'error.invalid_file_name': 'Ongeldige bestandsnaam',
    'error.missing_file_name': 'Bestandsnaam ontbreekt',
    'error.expected_binary': 'Ongeldige gegevens',
    'error.image_failed': 'Kon de afbeelding niet maken',
  },
};

/** Language names, always shown in their own language. */
const LANGUAGE_NAMES = { en: 'English', nl: 'Nederlands' };

const i18n = {
  lang: 'en',

  setLanguage(lang) {
    this.lang = MESSAGES[lang] ? lang : 'en';
    document.documentElement.lang = this.lang;
    this.applyToDocument();
  },

  /** Translate a key, filling in `{name}` placeholders. Falls back to English. */
  t(key, params = {}) {
    const text = MESSAGES[this.lang][key] ?? MESSAGES.en[key] ?? key;
    return text.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''));
  },

  /**
   * Translate an error from the native side. Format: `code` or `code: detail`.
   * Unknown codes are shown as-is.
   */
  error(raw) {
    const message = String(raw && raw.message ? raw.message : raw);
    const match = /^([a-z_]+)(?::\s*(.*))?$/s.exec(message);
    if (!match || !(`error.${match[1]}` in MESSAGES.en)) return message;
    const text = this.t(`error.${match[1]}`);
    return match[2] ? `${text} (${match[2]})` : text;
  },

  /** Fill elements marked with data-i18n (text) and data-i18n-aria (aria-label). */
  applyToDocument(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = this.t(el.dataset.i18n);
    });
    root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      el.setAttribute('aria-label', this.t(el.dataset.i18nAria));
    });
  },
};

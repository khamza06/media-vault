// Static offline shell only. Never reads account state or caches personalized HTML.
(() => {
  let locale = document.cookie.split('; ').find(row => row.startsWith('media-vault-locale='))?.split('=')[1]
  if (!locale) { try { locale = localStorage.getItem('media-vault-locale') } catch { /* English is the safe default. */ } }
  locale = locale === 'ru' ? 'ru' : 'en'
  document.documentElement.lang = locale
  document.title = locale === 'ru' ? 'Нет подключения | Media Vault' : 'Offline | Media Vault'
  document.querySelectorAll('[data-locale]').forEach(element => { element.hidden = element.dataset.locale !== locale })
})()

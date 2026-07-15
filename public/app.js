const form = document.querySelector('#donation-form')
const amountInput = document.querySelector('#amount')
const amountButtons = document.querySelectorAll('.amount')
const currencySelect = document.querySelector('#currency')
const messageInput = document.querySelector('#message')
const currencySymbol = document.querySelector('#currency-symbol')
const errorMessage = document.querySelector('#form-error')
const totalElement = document.querySelector('[data-campaign-total]')
const supporterCountElement = document.querySelector('[data-supporter-count]')
const progressFill = document.querySelector('[data-progress-fill]')
const markersElement = document.querySelector('[data-milestone-markers]')
const milestoneCopy = document.querySelector('[data-milestone-copy]')
const leaderboardElement = document.querySelector('[data-leaderboard]')

let selectedAmount = 5
let selectedCurrency = currencySelect?.value || 'usd'
const currencyExponent = {
  usd: 2,
  eur: 2,
  gbp: 2,
  aud: 2,
  cad: 2,
  cny: 2,
  jpy: 0,
  inr: 2,
  chf: 2,
  sgd: 2,
  hkd: 2,
  nzd: 2,
  brl: 2,
  mxn: 2,
}
const currencyScale = (currencyCode) => 10 ** currencyExponent[currencyCode]
const minimumDonationAmounts = {
  usd: 0.5,
  eur: 0.5,
  gbp: 0.3,
  aud: 0.5,
  cad: 0.5,
  cny: 2,
  jpy: 50,
  inr: 0.5,
  chf: 0.5,
  sgd: 0.5,
  hkd: 0.04,
  nzd: 0.5,
  brl: 0.5,
  mxn: 0.1,
}
const availableCurrencies = new Set(
  Array.from(currencySelect?.options || []).map((option) => option.value),
)

async function detectCurrencyByCountry() {
  try {
    const response = await fetch('/api/detect-currency', { cache: 'no-store' })
    if (!response.ok) return null
    const payload = await response.json()
    const detectedCurrency = payload?.currency
    if (!detectedCurrency || !availableCurrencies.has(detectedCurrency)) {
      return null
    }
    return detectedCurrency
  } catch {
    return null
  }
}

function initEntranceAnimations() {
  const revealTargets = [
    '.intro',
    '.donation-panel',
    '.campaign .section-label',
    '.milestone-board',
    '.leaderboard',
    '.impact .section-label',
    '.impact-heading',
    '.impact-list article',
    '.closing .eyebrow',
    '.closing h2',
    '.closing p',
    '.closing a',
  ]

  const elements = document.querySelectorAll(revealTargets.join(', '))
  if (!elements.length) return

  document.body.classList.add('has-motion')

  elements.forEach((element, index) => {
    element.classList.add('reveal-on-scroll')
    element.style.setProperty(
      '--reveal-delay',
      `${Math.min(index * 36, 360)}ms`,
    )
  })

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    elements.forEach((element) => element.classList.add('in-view'))
    return
  }

  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('in-view')
        currentObserver.unobserve(entry.target)
      })
    },
    {
      threshold: 0.16,
      rootMargin: '0px 0px -10% 0px',
    },
  )

  elements.forEach((element) => observer.observe(element))
}

function makeCurrencyFormatter(currencyCode) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode.toUpperCase(),
    maximumFractionDigits: currencyExponent[currencyCode],
  })
}

function currencySymbolFor(currencyCode) {
  const parts = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode.toUpperCase(),
    maximumFractionDigits: 0,
  }).formatToParts(0)
  return parts.find((part) => part.type === 'currency')?.value || '$'
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function updateCurrencyUI() {
  if (currencySelect && currencySelect.value !== selectedCurrency) {
    currencySelect.value = selectedCurrency
  }
  if (currencySymbol) {
    currencySymbol.textContent = currencySymbolFor(selectedCurrency)
  }
  if (amountInput) {
    amountInput.min = minimumDonationAmounts[selectedCurrency]
    amountInput.step = 1 / currencyScale(selectedCurrency)
  }
  amountButtons.forEach((button) => {
    button.textContent = currency.format(Number(button.dataset.amount))
  })
}

let currency = makeCurrencyFormatter(selectedCurrency)

function animateTotal(targetMinorUnits) {
  const startedAt = performance.now()
  const duration = 950
  const draw = (now) => {
    const progress = Math.min((now - startedAt) / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    totalElement.textContent = currency.format(
      (targetMinorUnits * eased) / currencyScale(selectedCurrency),
    )
    if (progress < 1) requestAnimationFrame(draw)
  }
  requestAnimationFrame(draw)
}

function renderCampaign(campaign) {
  if (campaign.currency) {
    selectedCurrency = campaign.currency
    currency = makeCurrencyFormatter(selectedCurrency)
  }

  const totalDollars = campaign.totalCents / currencyScale(selectedCurrency)
  const goal = campaign.milestones[campaign.milestones.length - 1]
  const achieved = campaign.milestones.filter(
    (milestone) => totalDollars >= milestone,
  ).length
  const milestoneMessages = [
    `First milestone: ${currency.format(campaign.milestones[0])} for an unreasonably calming month of noodles.`,
    'Momentum acquired: essentials now look slightly less threatening.',
    'Halfway there: housing stress has been reduced by at least 12%.',
    'Target reached: her indoor status is officially well defended.',
  ]

  animateTotal(campaign.totalCents)
  supporterCountElement.textContent = `${campaign.supporters} ${campaign.supporters === 1 ? 'supporter' : 'supporters'}`
  progressFill.style.width = `${Math.min((totalDollars / goal) * 100, 100)}%`
  markersElement.innerHTML = campaign.milestones
    .map(
      (milestone, index) => `
    <span class="milestone ${totalDollars >= milestone ? 'reached' : ''}" style="left:${(milestone / goal) * 100}%">
      <b>${currency.format(milestone)}</b><i></i>
    </span>
  `,
    )
    .join('')
  milestoneCopy.textContent =
    milestoneMessages[Math.min(achieved, milestoneMessages.length - 1)]
  document.querySelector('.milestone-board').dataset.stage = achieved
  updateCurrencyUI()

  leaderboardElement.innerHTML = campaign.leaderboard.length
    ? campaign.leaderboard
        .map(
          (supporter, index) =>
            `<li><span class="rank">${String(index + 1).padStart(2, '0')}</span><span class="supporter-info"><span class="supporter-name">${escapeHtml(supporter.name)}</span>${supporter.message ? `<span class="supporter-message">${escapeHtml(supporter.message)}</span>` : ''}</span><strong>${currency.format(supporter.amountCents / currencyScale(selectedCurrency))}</strong></li>`,
        )
        .join('')
    : '<li class="empty-leaderboard">Be the first person to earn a place on the board.</li>'
}

async function loadCampaign() {
  try {
    const response = await fetch(`/api/campaign?currency=${selectedCurrency}`)
    if (!response.ok) throw new Error('Campaign unavailable')
    renderCampaign(await response.json())
  } catch {
    milestoneCopy.textContent = 'Campaign telemetry is temporarily unavailable.'
  }
}

amountButtons.forEach((button) => {
  button.addEventListener('click', () => {
    selectedAmount = Number(button.dataset.amount)
    amountInput.value = ''
    amountButtons.forEach((option) =>
      option.classList.toggle('active', option === button),
    )
  })
})

amountInput.addEventListener('input', () => {
  if (amountInput.value)
    amountButtons.forEach((option) => option.classList.remove('active'))
})

if (currencySelect) {
  currencySelect.addEventListener('change', () => {
    selectedCurrency = currencySelect.value
    currency = makeCurrencyFormatter(selectedCurrency)
    updateCurrencyUI()
    loadCampaign()
  })
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const amount = Number(amountInput.value || selectedAmount)
  const submitButton = form.querySelector("button[type='submit']")

  errorMessage.textContent = ''
  submitButton.disabled = true
  submitButton.querySelector('span').textContent = 'Opening secure checkout...'

  try {
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        currency: selectedCurrency,
        message: messageInput.value.trim(),
      }),
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error)
    window.location.assign(payload.url)
  } catch (error) {
    errorMessage.textContent =
      error.message || 'Something went wrong. Please try again.'
    submitButton.disabled = false
    submitButton.querySelector('span').textContent = 'Keep Her Indoors'
  }
})

if (window.lucide) window.lucide.createIcons()
initEntranceAnimations()

async function initializePage() {
  const detectedCurrency = await detectCurrencyByCountry()
  if (detectedCurrency) {
    selectedCurrency = detectedCurrency
    currency = makeCurrencyFormatter(selectedCurrency)
  }
  updateCurrencyUI()
  loadCampaign()
}

initializePage()

const form = document.querySelector('#donation-form')
const amountInput = document.querySelector('#amount')
const amountButtons = document.querySelectorAll('.amount')
const currencySelect = document.querySelector('#currency')
const currencySymbol = document.querySelector('#currency-symbol')
const errorMessage = document.querySelector('#form-error')
const totalElement = document.querySelector('[data-campaign-total]')
const supporterCountElement = document.querySelector('[data-supporter-count]')
const progressFill = document.querySelector('[data-progress-fill]')
const markersElement = document.querySelector('[data-milestone-markers]')
const milestoneCopy = document.querySelector('[data-milestone-copy]')
const leaderboardElement = document.querySelector('[data-leaderboard]')

let selectedAmount = 20
let selectedCurrency = currencySelect?.value || 'usd'

function makeCurrencyFormatter(currencyCode) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode.toUpperCase(),
    maximumFractionDigits: 0,
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

function updateCurrencyUI() {
  if (currencySelect && currencySelect.value !== selectedCurrency) {
    currencySelect.value = selectedCurrency
  }
  if (currencySymbol) {
    currencySymbol.textContent = currencySymbolFor(selectedCurrency)
  }
}

let currency = makeCurrencyFormatter(selectedCurrency)

function animateTotal(targetCents) {
  const startedAt = performance.now()
  const duration = 950
  const draw = (now) => {
    const progress = Math.min((now - startedAt) / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    totalElement.textContent = currency.format((targetCents * eased) / 100)
    if (progress < 1) requestAnimationFrame(draw)
  }
  requestAnimationFrame(draw)
}

function renderCampaign(campaign) {
  if (campaign.currency) {
    selectedCurrency = campaign.currency
    currency = makeCurrencyFormatter(selectedCurrency)
  }

  const totalDollars = campaign.totalCents / 100
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
            `<li><span class="rank">${String(index + 1).padStart(2, '0')}</span><span class="supporter-name">${supporter.name}</span><strong>${currency.format(supporter.amountCents / 100)}</strong></li>`,
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
      body: JSON.stringify({ amount, currency: selectedCurrency }),
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
updateCurrencyUI()
loadCampaign()

import 'dotenv/config'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import express from 'express'
import Stripe from 'stripe'

const app = express()
const port = process.env.PORT || 3000
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null
const milestones = [100, 250, 500, 1000]
const supportedCurrencies = ['usd', 'eur', 'gbp', 'aud', 'cad', 'cny']
const countryToCurrency = {
  US: 'usd',
  AU: 'aud',
  CA: 'cad',
  CN: 'cny',
  GB: 'gbp',
  IE: 'eur',
  DE: 'eur',
  FR: 'eur',
  IT: 'eur',
  ES: 'eur',
  NL: 'eur',
  BE: 'eur',
  AT: 'eur',
  PT: 'eur',
  FI: 'eur',
  GR: 'eur',
  LU: 'eur',
  LT: 'eur',
  LV: 'eur',
  EE: 'eur',
  SK: 'eur',
  SI: 'eur',
  CY: 'eur',
  MT: 'eur',
  HR: 'eur',
}
const defaultDataDirectory = resolve('data')
const configuredDataDirectory = process.env.DATA_DIR
let dataDirectory = resolve(configuredDataDirectory || defaultDataDirectory)

try {
  mkdirSync(dataDirectory, { recursive: true })
} catch (error) {
  const permissionCodes = ['EACCES', 'EPERM', 'EROFS']
  if (
    configuredDataDirectory &&
    permissionCodes.includes(error?.code) &&
    dataDirectory !== defaultDataDirectory
  ) {
    dataDirectory = defaultDataDirectory
    mkdirSync(dataDirectory, { recursive: true })
    console.warn(
      `DATA_DIR=${configuredDataDirectory} is not writable (${error.code}); falling back to ${dataDirectory}.`,
    )
  } else {
    throw error
  }
}

const database = new DatabaseSync(resolve(dataDirectory, 'campaign.sqlite'))
database.exec(`
  CREATE TABLE IF NOT EXISTS donations (
    stripe_session_id TEXT PRIMARY KEY,
    donor_name TEXT NOT NULL,
    donor_message TEXT NOT NULL DEFAULT '',
    amount_cents INTEGER NOT NULL,
    amount_currency TEXT NOT NULL DEFAULT 'usd',
    completed_at TEXT NOT NULL
  )
`)

try {
  database.exec(
    "ALTER TABLE donations ADD COLUMN amount_currency TEXT NOT NULL DEFAULT 'usd'",
  )
} catch (error) {
  if (!error?.message?.includes('duplicate column name')) {
    throw error
  }
}

try {
  database.exec(
    "ALTER TABLE donations ADD COLUMN donor_message TEXT NOT NULL DEFAULT ''",
  )
} catch (error) {
  if (!error?.message?.includes('duplicate column name')) {
    throw error
  }
}

function normalizeCurrency(value) {
  const currency = Array.isArray(value) ? value[0] : value
  if (typeof currency !== 'string') return null
  const normalized = currency.trim().toLowerCase()
  return supportedCurrencies.includes(normalized) ? normalized : null
}

function currencyFromCountryCode(countryCode) {
  if (!countryCode || typeof countryCode !== 'string') return null
  const mapped = countryToCurrency[countryCode.trim().toUpperCase()]
  return normalizeCurrency(mapped)
}

function campaignSnapshot(currency) {
  const totalCents = database
    .prepare(
      'SELECT COALESCE(SUM(amount_cents), 0) AS total FROM donations WHERE amount_currency = ?',
    )
    .get(currency).total
  const supporters = database
    .prepare(
      'SELECT COUNT(*) AS count FROM donations WHERE amount_currency = ?',
    )
    .get(currency).count
  const leaderboard = database
    .prepare(
      `
    SELECT donor_name AS name, donor_message AS message, amount_cents AS amountCents, amount_currency AS currency
    FROM donations
    WHERE amount_currency = ?
    ORDER BY amount_cents DESC, completed_at ASC
    LIMIT 8
  `,
    )
    .all(currency)

  return { totalCents, supporters, milestones, leaderboard, currency }
}

app.post(
  '/api/stripe-webhook',
  express.raw({ type: 'application/json' }),
  (request, response) => {
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      return response.status(503).send('Stripe webhook is not configured.')
    }

    let event
    try {
      event = stripe.webhooks.constructEvent(
        request.body,
        request.headers['stripe-signature'],
        process.env.STRIPE_WEBHOOK_SECRET,
      )
    } catch (error) {
      return response
        .status(400)
        .send(`Webhook signature verification failed: ${error.message}`)
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      if (session.payment_status === 'paid' && session.amount_total) {
        const customName = session.custom_fields?.find(
          (field) => field.key === 'leaderboard_name',
        )?.text?.value
        const donorName =
          customName?.trim().slice(0, 32) || 'Anonymous supporter'
        const donorMessage = session.metadata?.donation_message || ''
        const donationCurrency =
          normalizeCurrency(session.currency) || supportedCurrencies[0]
        database
          .prepare(
            `
        INSERT OR IGNORE INTO donations (stripe_session_id, donor_name, donor_message, amount_cents, amount_currency, completed_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
          )
          .run(
            session.id,
            donorName,
            donorMessage,
            session.amount_total,
            donationCurrency,
            new Date().toISOString(),
          )
      }
    }

    return response.json({ received: true })
  },
)

app.use(express.json())
app.use(express.static('public'))

app.get('/api/detect-currency', async (request, response) => {
  const headerCountryCandidates = [
    request.headers['cf-ipcountry'],
    request.headers['x-country-code'],
    request.headers['x-vercel-ip-country'],
    request.headers['x-appengine-country'],
  ]

  for (const candidate of headerCountryCandidates) {
    const detected = currencyFromCountryCode(candidate)
    if (detected) {
      return response.json({ currency: detected, source: 'edge-header' })
    }
  }

  const forwardedFor = Array.isArray(request.headers['x-forwarded-for'])
    ? request.headers['x-forwarded-for'][0]
    : request.headers['x-forwarded-for']
  const visitorIp = forwardedFor?.split(',')[0]?.trim()

  if (visitorIp) {
    try {
      const geoResponse = await fetch(
        `https://ipapi.co/${encodeURIComponent(visitorIp)}/json/`,
        { cache: 'no-store' },
      )
      if (geoResponse.ok) {
        const payload = await geoResponse.json()
        const detected = currencyFromCountryCode(payload?.country_code)
        if (detected) {
          return response.json({ currency: detected, source: 'ipapi' })
        }
      }
    } catch {
      // Ignore lookup errors and fall through to default.
    }
  }

  return response.json({ currency: supportedCurrencies[0], source: 'default' })
})

app.get('/api/campaign', (request, response) => {
  const currency =
    normalizeCurrency(request.query.currency) || supportedCurrencies[0]
  response.json(campaignSnapshot(currency))
})

app.post('/api/create-checkout-session', async (request, response) => {
  if (!stripe) {
    return response.status(503).json({
      error: 'Payments are not configured yet. Add STRIPE_SECRET_KEY to .env.',
    })
  }

  const selectedCurrency = normalizeCurrency(request.body.currency)
  if (!selectedCurrency) {
    return response.status(400).json({
      error: `Choose a supported currency: ${supportedCurrencies.join(', ').toUpperCase()}`,
    })
  }

  const amountInCents = Math.round(Number(request.body.amount) * 100)
  if (
    !Number.isSafeInteger(amountInCents) ||
    amountInCents < 100 ||
    amountInCents > 100000
  ) {
    return response
      .status(400)
      .json({ error: 'Choose an amount between 1 and 1,000.' })
  }

  const donationMessage =
    typeof request.body.message === 'string'
      ? request.body.message.trim().slice(0, 200)
      : ''

  const baseUrl =
    process.env.BASE_URL || `${request.protocol}://${request.get('host')}`

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      custom_fields: [
        {
          key: 'leaderboard_name',
          label: { type: 'custom', custom: 'Leaderboard name (optional)' },
          type: 'text',
          optional: true,
          text: { maximum_length: 32, minimum_length: 1 },
        },
      ],
      metadata: { donation_message: donationMessage },
      line_items: [
        {
          price_data: {
            currency: selectedCurrency,
            product_data: { name: 'Keep Her Indoors contribution' },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/success.html`,
      cancel_url: `${baseUrl}/?cancelled=true`,
    })

    return response.json({ url: session.url })
  } catch (error) {
    console.error('Stripe Checkout session creation failed:', error.message)
    return response
      .status(500)
      .json({ error: 'Unable to open secure checkout. Please try again.' })
  }
})

app.listen(port, () => {
  console.log(`Keep Her Off the Streets is running at http://localhost:${port}`)
})

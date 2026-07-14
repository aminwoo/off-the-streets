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
const dataDirectory = resolve(process.env.DATA_DIR || 'data')

mkdirSync(dataDirectory, { recursive: true })
const database = new DatabaseSync(resolve(dataDirectory, 'campaign.sqlite'))
database.exec(`
  CREATE TABLE IF NOT EXISTS donations (
    stripe_session_id TEXT PRIMARY KEY,
    donor_name TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    completed_at TEXT NOT NULL
  )
`)

function campaignSnapshot() {
  const totalCents = database
    .prepare('SELECT COALESCE(SUM(amount_cents), 0) AS total FROM donations')
    .get().total
  const supporters = database
    .prepare('SELECT COUNT(*) AS count FROM donations')
    .get().count
  const leaderboard = database
    .prepare(
      `
    SELECT donor_name AS name, amount_cents AS amountCents
    FROM donations
    ORDER BY amount_cents DESC, completed_at ASC
    LIMIT 8
  `,
    )
    .all()

  return { totalCents, supporters, milestones, leaderboard }
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
        database
          .prepare(
            `
        INSERT OR IGNORE INTO donations (stripe_session_id, donor_name, amount_cents, completed_at)
        VALUES (?, ?, ?, ?)
      `,
          )
          .run(
            session.id,
            donorName,
            session.amount_total,
            new Date().toISOString(),
          )
      }
    }

    return response.json({ received: true })
  },
)

app.use(express.json())
app.use(express.static('public'))

app.get('/api/campaign', (_request, response) => {
  response.json(campaignSnapshot())
})

app.post('/api/create-checkout-session', async (request, response) => {
  if (!stripe) {
    return response.status(503).json({
      error: 'Payments are not configured yet. Add STRIPE_SECRET_KEY to .env.',
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
      .json({ error: 'Choose an amount between $1 and $1,000.' })
  }

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
      line_items: [
        {
          price_data: {
            currency: 'usd',
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

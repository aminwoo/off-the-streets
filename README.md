Hero section
🏠 Keep My Girlfriend Off the Streets

Life is expensive.

Every dollar you donate helps keep her safely housed and delays her transformation into a professional park bench enthusiast.

Help cover her essentials before she has to start relying on the local library's Wi-Fi.

Choose your damage:

[$____] [Keep Her Indoors]

More over-the-top
Emergency Housing Initiative

For less than the cost of one overpriced café coffee, you can help my girlfriend remain indoors and supported.

Side effects may include:

Graduating from university
Building cool software
Reduced noodle consumption
Increased likelihood of touching grass voluntarily
Donation messages
Amount Effect
$1 One more hour indoors
$5 Emergency Mi Goreng reserves
$10 Electricity stays on (probably)
$20 Housing stress becomes slightly less intimidating
$50 I can afford a textbook instead of "finding one"
$100 You have personally delayed homelessness DLC
Success page
🎉 Mission Accomplished

Thanks for helping keep her off the streets.

Your contribution has been successfully converted into rent, essentials, or food.

Mostly tuition.

Probably.

Tiny disclaimer

Disclaimer: She's not actually homeless. This page is a tongue-in-cheek way to help support her housing and essentials. Every contribution is optional, appreciated, and helps take pressure off bills.

## Deploy and accept payments

This is a Node.js app. It requires a persistent disk because the SQLite campaign ledger stores confirmed donations and leaderboard entries. Render Web Services support this through a Persistent Disk.

### 1. Put the project on GitHub

Create a private or public GitHub repository, commit this project, and push it. Do not commit `.env` or the `data` directory.

### 2. Deploy to Render

1. In the [Render Dashboard](https://dashboard.render.com/), choose **New** then **Web Service**, connect GitHub, and select this repository.
2. Configure the service:

   ```text
   Runtime: Node
   Build Command: npm install
   Start Command: npm start
   ```

3. In **Advanced**, add a Persistent Disk. Set its mount path to `/var/data`. Persistent Disks require a paid Render Web Service plan.
4. In **Environment**, add:

   ```text
   STRIPE_SECRET_KEY=sk_live_...
   DATA_DIR=/var/data
   ```

5. Deploy. Render provides a public HTTPS URL like `https://your-service.onrender.com`; you can also connect a custom domain.
6. Once the public URL works, add `BASE_URL` with that exact URL in **Environment** and redeploy:

   ```text
   BASE_URL=https://your-service.onrender.com
   ```

### 3. Configure Stripe live payments

1. Create or verify your Stripe account at [Stripe Dashboard](https://dashboard.stripe.com/), complete identity and bank-account verification, and switch the dashboard from **Test mode** to **Live mode**.
2. Copy the live secret key (`sk_live_...`) into the deployment variable `STRIPE_SECRET_KEY`. Never place this key in frontend files or GitHub.
3. In Stripe Dashboard, create a webhook endpoint at:

   ```text
   https://your-public-domain.com/api/stripe-webhook
   ```

4. Select the `checkout.session.completed` event and copy the endpoint signing secret (`whsec_...`) into Render as `STRIPE_WEBHOOK_SECRET`, then redeploy.
5. Make a small live payment with a real card. After Stripe marks it paid, the webhook records the donation and it appears in the total and leaderboard on page refresh.

### Before sharing

- Replace the copy with an accurate explanation of where contributions go and obtain your girlfriend's consent before publishing personal details.
- Complete any Stripe verification requirements and add a contact/refund policy. Personal contributions may have tax, benefit, and consumer-protection implications in your jurisdiction; check local guidance.
- Keep the webhook endpoint enabled. The payment is real immediately after Checkout, but the public total and leaderboard update only after Stripe delivers the verified webhook.

# Training reminder function

Deploy the function and set its secrets:

```bash
npx supabase functions deploy training-reminders --no-verify-jwt
npx supabase secrets set \
  RESEND_API_KEY=... \
  TRAINING_REMINDER_FROM_EMAIL="Sthenos <training@your-domain.com>" \
  TRAINING_REMINDER_APP_URL=https://your-app.example.com \
  TRAINING_REMINDER_CRON_SECRET=... \
  TRAINING_REMINDER_EMAILS_ENABLED=false
```

Create a Supabase Cron job that runs every 15 minutes and POSTs to:

```text
https://<project-ref>.supabase.co/functions/v1/training-reminders
```

Include `x-cron-secret` with the same value as `TRAINING_REMINDER_CRON_SECRET`.
Keep `TRAINING_REMINDER_EMAILS_ENABLED=false` through staging verification,
then change it to `true` to begin production delivery.

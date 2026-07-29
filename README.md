# sthenos-app

Workout management tool for fitness coaches

## Supabase Auth configuration

Production trainee invitations require the following Supabase project settings:

- Set the Auth Site URL to the production application URL.
- Add `<production-url>/auth/callback` to the allowed Redirect URLs.
- Configure custom SMTP before inviting email addresses that are not members of
  the Supabase organization. Supabase's default email service only delivers to
  pre-authorized organization addresses.
- Review both the **Invite user** and **Reset password** email templates. The
  initial trainee email uses the invite template; sending a setup email again
  uses the recovery template for the already-created Auth user.

Set `NEXT_PUBLIC_SITE_URL` in the production environment to the same application
origin, without a trailing slash. For example:

```text
NEXT_PUBLIC_SITE_URL=https://sthenos-app.vercel.app
```

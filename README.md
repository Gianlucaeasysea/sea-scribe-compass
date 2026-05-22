# Easysea Bridge

TanStack Start app deployed on Cloudflare Workers.

## Production secrets (Cloudflare)

Values in `.env` are only used by local `wrangler dev`. For production, set
them as Worker secrets:

```bash
# Supabase (required)
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_PUBLISHABLE_KEY
wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# Integration fallbacks (optional — primary flow stores creds in Supabase)
wrangler secret put SHOPIFY_CUSTOM_ADMIN_TOKEN
wrangler secret put KLAVIYO_API_KEY
wrangler secret put FACEBOOK_ADS_ACCESS_TOKEN
wrangler secret put FACEBOOK_AD_ACCOUNT_ID
wrangler secret put CIRCLE_API_TOKEN
wrangler secret put CIRCLE_COMMUNITY_ID
```

## Credential flow

1. User opens **Integrations** and enters API keys in the connection modal.
2. Credentials are saved to the `credentials_config` table in Supabase
   (service-role only, RLS enforced).
3. Sync server functions read from `credentials_config` first, then fall
   back to the Cloudflare secrets above for local/dev use.

This means new integrations can be onboarded entirely from the UI — no
redeploy or `wrangler secret put` required.

#!/bin/bash

# Set this to your GitHub repo in the format owner/repo
REPO="mml555/website"

gh secret set NEXTAUTH_URL -b"http://localhost:3000" -R $REPO
gh secret set NEXTAUTH_SECRET -b"u1cYCquJO5vgHYC2ss7S7Wj8aPjWR7zF3woPaejilQY=" -R $REPO
gh secret set DATABASE_URL -b"postgresql://postgres:Mendel09@localhost:5432/ecommerce" -R $REPO

gh secret set STRIPE_SECRET_KEY -b"sk_test_51RRkHEI5tzuoF5Im4OTMvkTvVL1W2LFqwkk6vIkKBDwMbO406E7ZUX297FmDIGGddH6rV9A0wJPhbgesc9ZccgCt00lcteL4sd" -R $REPO
gh secret set STRIPE_WEBHOOK_SECRET -b"whsec_fa4d01bbab3b3877aad4f0fea7c4dfaf0c9606b41f796ea550fbc33474aa63d4" -R $REPO
gh secret set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY -b"pk_test_51RRkHEI5tzuoF5ImpZAd6euUWZ4dhByXNXlb2aqB9BRqlywv2hflYHDcumghMcdnXuXkIGB5HPp3HmHcUtlANUjg00uVtSQvC9" -R $REPO

gh secret set SMTP_HOST -b"smtp.gmail.com" -R $REPO
gh secret set SMTP_PORT -b"587" -R $REPO
gh secret set SMTP_SECURE -b"false" -R $REPO
gh secret set SMTP_USER -b"Mendy@selleroptimization.net" -R $REPO
gh secret set SMTP_PASSWORD -b"wmkr lmud pxxh iler" -R $REPO
gh secret set SMTP_FROM -b"info@selleroptimization.net" -R $REPO

gh secret set RESEND_API_KEY -b"re_3FXFyEAf_KmLEUjzL2u8dMAqUKY7aL9bU" -R $REPO

gh secret set UPSTASH_REDIS_REST_URL -b"https://up-newt-40786.upstash.io" -R $REPO
gh secret set UPSTASH_REDIS_REST_TOKEN -b"AZ9SAAIjcDExMWFkNjcxNDg5NmQ0ZDM5Yjc1MGFlN2ZlODc4ZjQ5MHAxMA" -R $REPO

gh secret set NEXT_PUBLIC_APP_URL -b"http://localhost:3000" -R $REPO
gh secret set NEXT_PUBLIC_SITE_URL -b"http://localhost:3000" -R $REPO
gh secret set NEXT_PUBLIC_API_URL -b"http://localhost:3000" -R $REPO
gh secret set NEXT_PUBLIC_WS_URL -b"ws://localhost:3000" -R $REPO

gh secret set PORT -b"3000" -R $REPO

gh secret set RATE_LIMIT_MAX -b"100" -R $REPO
gh secret set RATE_LIMIT_WINDOW_MS -b"900000" -R $REPO

echo "All secrets set for $REPO" 
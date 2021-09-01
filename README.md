# Strapi Backend - Ecommerce

## User Auth

This particular app uses the strapi authentication service. Making requests to the 'strapi_url'/auth for login and register functions. As well as the 'auth/me' to persist any logged in user. On the frontend the jwt is saved and stored as an http-only cookie.

## Models

3 main models are demonstrated for this coffee shop. - Categories (for coffees/drinks) - Coffees (which include all beverages) - Orders

The most important of the three is the orders model. We store basic categories for our Stripe payment system. We have our paid or unpaid field, as well as user, total, and checkout session for stripe. Essentially the checkout session is the order number.

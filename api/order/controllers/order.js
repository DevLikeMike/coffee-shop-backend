"use strict";
const { sanitizeEntity } = require("strapi-utils");
const stripe = require("stripe")(process.env.STRIPE_SK);

const fromDecimalToInt = (number) => parseInt(number * 100);

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  // Get only orders that belong to user
  async find(ctx) {
    const user = ctx.state.user;

    let entities;
    if (ctx.query._q) {
      entities = await strapi.services.order.search({
        ...ctx.query,
        user: user.id,
      });
    } else {
      entities = await strapi.services.order.find({
        ...ctx.query,
        user: user.id,
      });
    }

    return entities.map((entity) =>
      sanitizeEntity(entity, { model: strapi.models.order })
    );
  },
  // Find one by id and by user only
  async findOne(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;

    const entity = await strapi.services.order.findOne({ id, user: user.id });
    if (!entity) {
      return ctx.badRequest(null, [
        { messages: [{ id: "User not authorized to make this request" }] },
      ]);
    }
    return sanitizeEntity(entity, { model: strapi.models.order });
  },
  // Post request to strapi/orders - PAY ATTENTION TO S on the end!!!
  async create(ctx) {
    /* TODO
     * Products should bring in, size, quanity, price, and id, name
     * Possibly request from strapi for each id passed in
     */
    const { products } = ctx.request.body;
    const { user } = ctx.state;
    const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

    // Map through all products from cart then make them a line item and put into array
    const lineItems = products.map((product) => {
      let item = {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${product.name} (${product.size})`,
          },
          unit_amount: fromDecimalToInt(product.price),
        },
        quantity: product.quantity,
      };
      return item;
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: user.email,
      mode: "payment",
      success_url: `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: BASE_URL,
      line_items: lineItems,
    });

    console.log(session);

    // Create Order
    const newOrder = await strapi.services.order.create({
      user: user.id,
      product: 3,
      total: (session.amount_total / 100).toFixed(2),
      status: "unpaid",
      checkout_session: session.id,
    });

    return { id: session.id };
  },

  async confirm(ctx) {
    // Retrieve session id from body
    const { checkout_session } = ctx.request.body;

    // Retrieve sesssion from stripe
    const session = await stripe.checkout.sessions.retrieve(checkout_session);

    // If paid then update status, else throw 400 error with message
    if (session.payment_status === "paid") {
      const updateOrder = await strapi.services.order.update(
        {
          checkout_session,
        },
        {
          status: "paid",
        }
      );

      return sanitizeEntity(updateOrder, { model: strapi.models.order });
    } else {
      ctx.throw(400, "Payment not successful, please contact support");
    }
  },
};

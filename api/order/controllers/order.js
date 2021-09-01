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
  async create(ctx) {
    const { product } = ctx.request.body;
    const { user } = ctx.state;
    const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

    if (!product) {
      return ctx.throw(400, "Please specify a product");
    }

    const realProduct = await strapi.services.coffees.findOne({
      id: product.id,
    });

    if (!realProduct) {
      return ctx.throw(404, "No product with such Id");
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: user.email,
      mode: "payment",
      success_url: `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: BASE_URL,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: realProduct.name,
            },
            unit_amount: fromDecimalToInt(realProduct.price),
          },
          quantity: 1,
        },
      ],
    });

    // Create Order
    const newOrder = await strapi.services.order.create({
      user: user.id,
      product: realProduct.id,
      total: realProduct.price,
      status: "unpaid",
      checkout_session: session.id,
    });

    return { id: session.id };
  },
};

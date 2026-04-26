# Backend Test Notes

`POST /billing/orders/{order_id}/simulate-paid` is a test helper only.

It is available only when `JFXZ_ENV` is `development` or `test`, and production must never expose it. Real payment completion must come from a verified payment-provider callback that checks the order number, amount, merchant identity, signature, and current order status before granting points or subscriptions.

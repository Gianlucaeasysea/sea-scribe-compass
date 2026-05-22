DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_shopify_id_key') THEN
    ALTER TABLE public.customers ADD CONSTRAINT customers_shopify_id_key UNIQUE (shopify_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_shopify_order_id_key') THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_shopify_order_id_key UNIQUE (shopify_order_id);
  END IF;
END $$;
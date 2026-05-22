
-- refresh_fleet(): rebuild customer aggregates, RFM scores, recommendations
-- and marketing actions from the real connector data (orders, email_events,
-- circle_activity).
create or replace function public.refresh_fleet()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customers int;
  v_rfm int;
  v_recs int;
  v_actions int;
begin
  -- 1) customer aggregates from real orders
  with agg as (
    select
      customer_id,
      sum(total)::numeric          as ltv,
      count(*)::int                as orders_n,
      min(created_at)              as first_at,
      max(created_at)              as last_at
    from orders
    group by customer_id
  )
  update customers c
     set lifetime_value = coalesce(a.ltv, 0),
         total_orders   = coalesce(a.orders_n, 0),
         first_order_at = a.first_at,
         last_order_at  = a.last_at
    from agg a
   where c.id = a.customer_id;

  -- zero out customers with no orders
  update customers
     set lifetime_value = 0, total_orders = 0
   where id not in (select customer_id from orders);

  -- 2) recompute RFM tiers
  delete from rfm_scores;

  with stats as (
    select
      c.id as customer_id,
      coalesce(extract(day from (now() - c.last_order_at))::int, 9999) as days_since,
      c.total_orders as f_raw,
      c.lifetime_value as m_raw
    from customers c
  ), scored as (
    select
      customer_id,
      case when days_since <= 30 then 5
           when days_since <= 90 then 4
           when days_since <= 180 then 3
           when days_since <= 365 then 2
           else 1 end as r,
      case when f_raw >= 10 then 5
           when f_raw >= 5 then 4
           when f_raw >= 3 then 3
           when f_raw >= 1 then 2
           else 1 end as f,
      case when m_raw >= 1000 then 5
           when m_raw >= 500 then 4
           when m_raw >= 200 then 3
           when m_raw >= 50 then 2
           else 1 end as m,
      days_since
    from stats
  )
  insert into rfm_scores (customer_id, recency_score, frequency_score, monetary_score, tier, churn_risk, trend)
  select
    customer_id, r, f, m,
    case
      when r >= 4 and f >= 4 and m >= 4 then 'Champion'
      when r >= 4 and f >= 3 then 'Loyal'
      when r >= 4 and f <= 2 then 'New'
      when r = 3 and f >= 2 then 'Potential'
      when r <= 2 and f >= 3 then 'At Risk'
      when r = 1 and f = 1 then 'Lost'
      else 'Potential'
    end as tier,
    least(100, greatest(0, days_since / 4))::int as churn_risk,
    case when r >= 4 then 'improving' when r <= 2 then 'declining' else 'stable' end as trend
  from scored;

  -- 3) recommendations from real top-selling products
  delete from recommendations;

  with line as (
    select customer_id, jsonb_array_elements(line_items) as li
    from orders
  ), prod as (
    select customer_id, (li->>'name') as name, count(*)::int as n
    from line
    where li ? 'name'
    group by customer_id, li->>'name'
  ), top_products as (
    select name, sum(n) as total
    from prod group by name order by total desc limit 8
  ), customer_top as (
    select p.customer_id, p.name,
           row_number() over (partition by p.customer_id order by p.n desc) as rk
    from prod p
  )
  insert into recommendations (customer_id, product_name, product_image, confidence, reason, channel, best_send, angle, status)
  select
    r.customer_id,
    tp.name,
    case
      when tp.name ilike '%cover%' then '🧰'
      when tp.name ilike '%winch%' then '⚓'
      when tp.name ilike '%fender%' then '🛟'
      when tp.name ilike '%kit%' then '🧳'
      else '⛵'
    end,
    case when r.tier in ('Champion','Loyal') then 88 when r.tier = 'At Risk' then 72 else 65 end,
    case when r.tier = 'At Risk' then 'Reactivation — best-seller in their cluster'
         when r.tier = 'Champion' then 'Cross-sell — pairs with prior purchases'
         else 'Next-best from fleet bestsellers' end,
    case when r.tier = 'At Risk' then 'Email' when r.tier = 'Champion' then 'Email + SMS' else 'Email' end,
    'Tue 10:00',
    case when r.tier = 'At Risk' then 'Win-back' when r.tier = 'Champion' then 'Upsell' else 'Discover' end,
    'pending'
  from rfm_scores r
  cross join lateral (
    select name from top_products
    where name not in (
      select coalesce(name,'') from customer_top ct where ct.customer_id = r.customer_id
    )
    limit 1
  ) tp
  where r.tier in ('Champion','Loyal','At Risk','Potential','New');

  -- 4) marketing actions derived from real tier counts
  delete from marketing_actions;

  insert into marketing_actions (title, segment_name, channel, objective, subject_line, expected_revenue, priority, status)
  select * from (values
    ('Champions — early access upsell',           'Champion', 'Email + SMS', 'Upsell',       'First dibs on new arrivals',         (select coalesce(sum(lifetime_value)*0.08,0) from customers c join rfm_scores r on r.customer_id=c.id where r.tier='Champion'), 90, 'todo'),
    ('At-Risk reactivation flow',                 'At Risk',  'Email',       'Reactivation', 'We miss you on the water ⛵',         (select coalesce(sum(lifetime_value)*0.05,0) from customers c join rfm_scores r on r.customer_id=c.id where r.tier='At Risk'),  92, 'todo'),
    ('Loyal cross-sell — bestseller pairing',     'Loyal',    'Email',       'Cross-sell',   'Pairs perfectly with your last order',(select coalesce(sum(lifetime_value)*0.06,0) from customers c join rfm_scores r on r.customer_id=c.id where r.tier='Loyal'),    80, 'todo'),
    ('New customers — onboarding sequence',       'New',      'Email',       'Onboarding',   'Welcome aboard, captain',            (select coalesce(count(*)*25,0) from rfm_scores where tier='New'),                                                                  60, 'scheduled'),
    ('Potential — nudge to second purchase',      'Potential','Email',       'Conversion',   'A second voyage awaits',             (select coalesce(count(*)*40,0) from rfm_scores where tier='Potential'),                                                            65, 'todo'),
    ('Circle members — community-only drop',      'Community','Email',       'Retention',    'Community exclusive: pre-season',    (select coalesce(count(*)*30,0) from customers where 'circle-member' = any(tags) or circle_id is not null),                       55, 'scheduled')
  ) as t(title, segment_name, channel, objective, subject_line, expected_revenue, priority, status);

  select count(*) into v_customers from customers;
  select count(*) into v_rfm from rfm_scores;
  select count(*) into v_recs from recommendations;
  select count(*) into v_actions from marketing_actions;

  return jsonb_build_object(
    'customers', v_customers,
    'rfm', v_rfm,
    'recommendations', v_recs,
    'actions', v_actions
  );
end;
$$;

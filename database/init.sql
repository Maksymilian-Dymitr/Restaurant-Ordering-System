CREATE TABLE products (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    price       INT NOT NULL,
    category    TEXT NOT NULL
);

CREATE TABLE orders (
    id          SERIAL PRIMARY KEY,
    customer_id TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_items (
    id         SERIAL PRIMARY KEY,
    order_id   INT REFERENCES orders(id),
    product_id INT REFERENCES products(id),
    quantity   INT NOT NULL DEFAULT 1
);

CREATE TABLE notifications (
    id          SERIAL PRIMARY KEY,
    customer_id TEXT NOT NULL,
    message     TEXT NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE service_errors (
    id          SERIAL PRIMARY KEY,
    service     TEXT NOT NULL,
    message     TEXT NOT NULL,
    stack       TEXT,
    severity    TEXT NOT NULL DEFAULT 'server',
    created_at  TIMESTAMP DEFAULT NOW()
);

INSERT INTO products (name, price, category) VALUES
    ('Cheeseburger',    89,  'Burger'),
    ('Double Burger',   119, 'Burger'),
    ('Chicken Nuggets', 69,  'Snack'),
    ('Veggie Wrap',     79,  'Wrap'),
    ('French Fries',    39,  'Side'),
    ('Cola',            29,  'Drink');

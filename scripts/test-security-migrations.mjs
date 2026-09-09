import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const migrationsDir = join(process.cwd(), 'supabase', 'migrations')
const migrationFiles = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort()

const migrations = new Map(
  migrationFiles.map((file) => [
    file,
    readFileSync(join(migrationsDir, file), 'utf8'),
  ]),
)

const allSql = [...migrations.values()].join('\n').toLowerCase()

function migration(name) {
  const entry = [...migrations.entries()].find(([file]) => file.includes(name))
  assert.ok(entry, `Missing migration containing: ${name}`)
  return entry[1].toLowerCase()
}

test('production security migrations remain versioned', () => {
  const required = [
    'add_secure_order_rpc_and_lock_push_trigger',
    'harden_public_configuration_tables',
    'lock_down_orders_and_order_items',
    'restrict_owns_restaurant_rpc',
    'optimize_rls_and_foreign_key_indexes',
    'block_anonymous_admin_and_storage_access',
    'optimize_permanent_user_policy_checks',
    'restore_authenticated_owns_restaurant_execute',
    'maintain_order_updated_at',
  ]

  for (const name of required) {
    assert.ok(
      migrationFiles.some((file) => file.includes(name)),
      `Required production migration is missing: ${name}`,
    )
  }
})

test('order updates maintain their audit timestamp', () => {
  const sql = migration('maintain_order_updated_at')

  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.set_orders_updated_at\(\)/)
  assert.match(sql, /new\.updated_at\s*:=\s*now\(\)/)
  assert.match(sql, /before\s+update\s+on\s+public\.orders/)
  assert.match(sql, /revoke\s+all[\s\S]*from\s+public\s*,\s*anon\s*,\s*authenticated/)
})

test('owner helper remains callable only by authenticated application users and service role', () => {
  const sql = migration('restore_authenticated_owns_restaurant_execute')

  assert.match(sql, /revoke\s+all[\s\S]*from\s+public/)
  assert.match(sql, /revoke\s+all[\s\S]*from\s+anon/)
  assert.match(sql, /grant\s+execute[\s\S]*to\s+authenticated/)
  assert.match(sql, /grant\s+execute[\s\S]*to\s+service_role/)
})

test('checkout remains server-authoritative and unavailable to anon role', () => {
  const sql = migration('add_secure_order_rpc_and_lock_push_trigger')

  assert.match(sql, /security\s+definer/)
  assert.match(sql, /revoke\s+all[\s\S]*from\s+public\s*,\s*anon/)
  assert.match(sql, /grant\s+execute[\s\S]*to\s+authenticated/)
  assert.match(sql, /from\s+public\.products/)
  assert.match(sql, /insert\s+into\s+public\.orders/)
  assert.match(sql, /insert\s+into\s+public\.order_items/)
})

test('orders and order items keep RLS with no direct anonymous inserts', () => {
  const sql = migration('lock_down_orders_and_order_items')

  for (const table of ['orders', 'order_items']) {
    assert.match(sql, new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`))
    assert.match(sql, new RegExp(`revoke\\s+all\\s+on\\s+table\\s+public\\.${table}\\s+from\\s+anon`))
  }
})

test('anonymous sessions cannot receive administrative write policies', () => {
  const sql = migration('optimize_permanent_user_policy_checks')
  const protectedTables = [
    'business_hours',
    'categories',
    'combo_items',
    'combos',
    'delivery_settings',
    'delivery_zones',
    'order_items',
    'orders',
    'product_addons',
    'products',
    'push_subscriptions',
    'restaurants',
  ]

  assert.match(sql, /select\s+auth\.jwt\(\)/)
  assert.match(sql, /is_anonymous/)
  assert.match(sql, /permanent owner can upload product images/)
  assert.match(sql, /permanent owner can delete product images/)

  for (const table of protectedTables) {
    assert.ok(sql.includes(`public.${table}`), `Missing anonymous-session protection for ${table}`)
  }
})

test('all exposed application tables have an RLS enable statement in history', () => {
  const tables = [
    'business_hours',
    'categories',
    'combo_items',
    'combos',
    'delivery_settings',
    'delivery_zones',
    'order_items',
    'orders',
    'product_addons',
    'products',
    'push_subscriptions',
    'restaurants',
  ]

  for (const table of tables) {
    assert.match(
      allSql,
      new RegExp(`alter\\s+table\\s+(?:public\\.)?${table}\\s+enable\\s+row\\s+level\\s+security`),
      `No RLS enable statement found for ${table}`,
    )
  }
})

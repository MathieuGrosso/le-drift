import { strict as assert } from 'node:assert'
import { afterEach, mock, test } from 'node:test'
import { createRateLimit } from '../src/rate'

afterEach(() => mock.timers.reset())

test('a rate limit forgets idle players and never holds more than its cap', () => {
  mock.timers.enable({ apis: ['Date'], now: 1_000_000 })
  const limit = createRateLimit(1, 1_000, 50)
  for (let i = 0; i < 200; i++) limit.allow(`p${i}`)
  assert.equal(limit.size, 50)
  assert.equal(limit.allow('p199'), false)
  mock.timers.tick(1_000)
  assert.equal(limit.allow('p199'), true)
  assert.equal(limit.size, 1)
})

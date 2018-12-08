const computed = require('mutant/computed')
const WatchHeads = require('tre-watch-heads')
const isObservable = require('mutant/is-observable')
const oll = require('observable-linked-list')
const merge = require('lodash.merge')
const {isMsgId} = require('ssb-ref')

module.exports = function(ssb) {
  const watchHeads = WatchHeads(ssb)

  return function watch_merged(revRoot_or_obv, opts) {
    opts = opts || {}
    const is_obv = isObservable(revRoot_or_obv) 
    console.warn('is_ob', is_obv)
    const head_kv = is_obv ? revRoot_or_obv : watchHeads(revRoot_or_obv)
    const chain_kv = oll(head_kv, proto, watchHeads)
    return computed(chain_kv, kvs => {
      const prototypes = kvs.slice(1).map(kv => revRoot(kv))
      if (!prototypes.length) return kvs[0]
      const merged = merge({}, ...kvs.slice().reverse(), {
        value: {
          content: {
            // do not inherit revisionRoot or revisionBranch
            revisionRoot: kvs[0].value.content.revisionRoot,
            revisionBranch: kvs[0].value.content.revisionBranch
          }
        }
      })
      if (opts.meta !== false) {
        merged.meta = Object.assign(merged.meta || {}, {"prototype-chain": kvs})
      }
      return merged
    })
  }
}

// -- utils

function content(kv) {
  return kv && kv.value && kv.value.content 
}

function proto(kv) {
  const c = content(kv)
  const p = c && c.prototype
  return isMsgId(p) ? p : null
}

function revRoot(kv) {
  const c = content(kv)
  return c && c.revisionRoot || kv && kv.key
}


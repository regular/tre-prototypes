const computed = require('mutant/computed')
const WatchHeads = require('tre-watch-heads')
const isObservable = require('mutant/is-observable')
const oll = require('observable-linked-list')
const merge = require('lodash.merge')
const ref = require('ssb-ref')

module.exports = function(ssb, deps) {
  deps = deps || {}  // fir testing
  const watchHeads = deps.watchHeads || WatchHeads(ssb)
  const isMsgId = deps.isMsgId || ref.isMsgId

  return function watch_merged(revRoot_or_obv, opts) {
    opts = opts || {}

    function getObs(revRoot) {
      return watchHeads(revRoot, {
        allowAllAuthors: opts.allowAllAuthors
      })
    }

    const is_obv = isObservable(revRoot_or_obv) 
    const head_kv = is_obv ? revRoot_or_obv : getObs(revRoot_or_obv)
    const chain_kv = oll(head_kv, proto(isMsgId), getObs)
    return computed(chain_kv, kvs => {
      if (kvs.includes(null)) {
        // suppress intermediate states
        return computed.NO_CHANGE
      }
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
        merged.meta = Object.assign({},
          mergeMeta(kvs.map(kvm => {
            return kvm && kvm.meta || {}
          })),
          {"prototype-chain": kvs}
        )
      } else {
        delete merged.meta
      }
      return merged
    })
  }
}

// -- utils

function mergeMeta(metas) {
  const result = {
    forked: false,
    incomplete: false,
    change_requests: 0
  }
  metas.forEach(meta => {
    if (meta.forked) result.forked = true
    if (meta.incomplete) result.incomplete = true
    result.change_requests += meta.change_requests || 0
  })
  return result
}

function content(kv) {
  return kv && kv.value && kv.value.content 
}

function proto(isMsgId) {
  return function(kv) {
    const c = content(kv)
    const p = c && c.prototype
    return isMsgId(p) ? p : null
  }
}

function revRoot(kv) {
  const c = content(kv)
  return c && c.revisionRoot || kv && kv.key
}


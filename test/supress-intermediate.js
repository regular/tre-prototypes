const test = require('tape')
const WatchMerged = require('..')
const Value = require('mutant/value')

const OBS = {}

const watchMerged = WatchMerged({}, {
  watchHeads: revRoot =>{
    console.log('Called watchHeads("'+revRoot+'")')
    const ret = OBS[revRoot]
    return ret
  },
  isMsgId: x=>true
})

test('supresses intermediate values', t=>{
  t.plan(1)

  OBS.a = Value()
  OBS.b = Value()

  const o = watchMerged('a', {suppressIntermediate: true})
  o( kv=>{
    console.log('observe', kv)
    t.equal(kv.value.content.name, 'bar', 'name is inherited')
  })

  OBS.a.set(msg('a', undefined, 'b'))
  OBS.b.set(msg('b', 'bar'))
})

function msg(key, name, prototype) {
  return {
    key,
    value: {
      content: {
        name,
        prototype
      }
    }
  }
}

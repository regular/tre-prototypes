const {client} = require('tre-client')
const Finder = require('tre-finder')
const Editor = require('tre-json-editor')
const h = require('mutant/html-element')
const Value = require('mutant/value')
const computed = require('mutant/computed')
const WatchHeads = require('tre-watch-heads')
const setStyle = require('module-styles')('tre-prototype-demo')
const {makePane, makeDivider, makeSplitPane} = require('tre-split-pane')
const oll = require('observable-linked-list')
const merge = require('lodash.merge')
require('brace/theme/solarized_dark')

setStyle(`
  body, html, .tre-prototypes-demo {
    height: 100%;
    margin: 0;
    padding: 0;
  }
  body {
    --tre-selection-color: green;
    --tre-secondary-selection-color: yellow;
    font-family: sans;
  }
  h1 {
    font-size: 18px;
  }
  .pane {
    background: #eee;
  }
  .tre-finder .summary select {
    font-size: 9pt;
    background: transparent;
    border: none;
    width: 50px;
  }
  .tre-finder summary {
    white-space: nowrap;
  }
`)

client( (err, ssb, config) => {
  if (err) return console.error(err)

  const watchHeads = WatchHeads(ssb)
  const primarySelection = Value()
  const realtime_kv = computed(primarySelection, kv => {
    const content = kv && kv.value && kv.value.content
    if (!content) return
    return watchHeads(kv.value.content.revisionRoot || kv.key)
  })

  function getProto(kv) {
    return kv && kv.value && kv.value.content && kv.value.content.prototype
  }
  const chain_kv = oll(realtime_kv, getProto, watchHeads)
  const merged_kv = computed(chain_kv, kvs => {
    const prototypes = kvs.slice(1).map(kv => kv && kv.value.content.revisionRoot || kv && kv.key)
    if (!prototypes.length) return kvs[0]
    const merged = merge({}, ...kvs.reverse())
    //delete merged.value.content.prototype
    Object.assign(merged.meta, {prototypes, "prototype-chain": kvs})
    return merged
  })
  
  const renderFinder = Finder(ssb, {
    primarySelection,
    skipFirstLevel: true,
    factory: {
      menu: ()=> [{label: 'Object', type: 'object'}],
      make: type => type == 'object' && {
        type: 'object',
        text: "Hi, I'm Elfo!"
      }
    }
  })

  const renderEditor = Editor(null, {
    ace: {
      theme: 'ace/theme/solarized_dark',
      tabSize: 2,
      useSoftTabs: true
    },
    save: (kv, cb) => {
      const content = kv.value.content
      content.revisionBranch = kv.key
      content.revisionRoot = content.revisionRoot || kv.key
      console.log('new content', content)
      ssb.publish(content, cb)
    }
  })

  document.body.appendChild(
    h('.tre-prototypes-demo', [
      makeSplitPane({horiz: false}, [
        makeSplitPane({horiz: true}, [
          makePane('25%', [
            h('h1', 'Finder'),
            renderFinder(config.tre.branches.root)
          ]),
          makeDivider(),
          makePane('70%', [
            h('h1', 'Editor'),
            h('span', computed(primarySelection, kv => `based on ${kv && kv.key}`)),
            h('span', computed([primarySelection, realtime_kv], (sel, real) => sel && real && sel.key !== real.key ? '(outdated)' : '(no conflict)' )),
            computed(primarySelection, kv => kv ? renderEditor(kv) : [])
          ])
        ]),
        makeDivider(),
        makeSplitPane({horiz: true}, [
          makePane('30%', [
            h('h1', 'Realtime Value'),
            h('pre.realtime', computed(realtime_kv, kv => JSON.stringify(kv, null, 2)))
          ]),
          makeDivider(),
          makePane('30%', [
            h('h1', 'Prototype Chain'),
            h('pre.chain', computed(chain_kv, kv => JSON.stringify(kv, null, 2)))
          ]),
          makeDivider(),
          makePane('30%', [
            h('h1', 'Merged'),
            h('pre.merged', computed(merged_kv, kv => JSON.stringify(kv, null, 2)))
          ])
        ])
      ])
    ])
  )
})

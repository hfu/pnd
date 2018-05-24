const config = require('config')
const { Pool, Query } = require('pg')
const tilebelt = require('@mapbox/tilebelt')
const turf = require('@turf/turf')
const wkx = require('wkx')
const fs = require('fs')
const cpq = require('childprocess-queue')
const data = config.get('data')

cpq.setMaxProcesses(1)
let pools = {}
for (let database of Object.keys(data)) {
  pools[database] = new Pool({
    host: config.get('host'), user: config.get('user'), 
    password: config.get('password'), database: database, max: 1000
  })
}

const pnd = async function (module) {
  const stream = fs.createWriteStream(`${module.join('-')}.ndjson`)
  const bbox = tilebelt.tileToBBOX([module[1], module[2], module[0]])
  let layer_count = 0
  for (const database of Object.keys(data)) {
    layer_count += data[database].length
    for(const t of data[database]) {
      const [layer, minzoom, maxzoom, text_key] = t
      const client = await pools[database].connect()
      const geom = config.get('geom')[database]
      let q = `SELECT * FROM ${layer}`
      q += ` WHERE ${geom} && ST_MakeBox2D(` +
        `ST_MakePoint(${bbox[0]}, ${bbox[1]}), ` +
        `ST_MakePoint(${bbox[2]}, ${bbox[3]}))`
      await client.query(new Query(q))
        .on('row', row => {
          let g = wkx.Geometry.parse(new Buffer(row[geom], 'hex')).toGeoJSON()
          if (g.type === 'Point' || g.coordinates.length === 0) {
          } else {
            g = turf.bboxClip(g, bbox).geometry
          }
          let f = {
            type: 'Feature',
            geometry: g,
            tippecanoe: {layer: g.type.toLowerCase().replace('multi', ''),
              minzoom: minzoom, maxzoom: maxzoom}
            //tippecanoe: {layer: layer, minzoom: minzoom, maxzoom: maxzoom}
          }
          delete row[geom]
          // f.properties = row
          f.properties = {}
          if (text_key) f.properties.text = row[text_key]
          f.properties.layer = layer
          // f.properties = {layer: layer}
          stream.write(JSON.stringify(f) + '\n')
        })
        .on('end', () => {
          layer_count -= 1
          client.end()
          if(layer_count === 0) stream.end()
        })
    }
  }
  stream.on('close', () => {
    cpq.spawn('nice', ['-19', 'tippecanoe', 
      '--read-parallel',
      '--simplify-only-low-zooms', '--simplification=4', '--minimum-zoom=5',
      '--maximum-zoom=16', '--base-zoom=16', '-f', 
      `--output=${module.join('-')}.mbtiles`, `${module.join('-')}.ndjson`], 
      {
        stdio: 'inherit',
        onCreate: (proc) => {
          proc.on('close', (code) => {
            console.log(`${proc.spawnargs[11]} finished. ` + 
              `${cpq.getCurrentProcessCount()} active, ` +
              `${cpq.getCurrentQueueSize()} in queue.`)
          })
        }
      })
    console.log(`pushed a tippecanoe process: ` + 
      `${cpq.getCurrentProcessCount()} of ${cpq.getMaxProcesses()} ` + 
      `active, ${cpq.getCurrentQueueSize()} in queue.`)
  })
}

async function main() {
  let ct = 0
  for (const module of config.get('modules')) {
    ct += 1
    console.log(`pushing #${ct} ${module.join('-')}`)
    await pnd(module) 
  }
}

main()

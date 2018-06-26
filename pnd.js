const config = require('config')
const { Pool, Query } = require('pg')
const tilebelt = require('@mapbox/tilebelt')
// const turf = require('@turf/turf')
const wkx = require('wkx')
const fs = require('fs')
const cpq = require('childprocess-queue')
const data = config.get('data')
let modify
if (fs.existsSync('./modify.js')) {
  modify = require('./modify.js')
} else {
  modify = f => {return f}
}

cpq.setMaxProcesses(1)
let pools = {}
for (let database of Object.keys(data)) {
  pools[database] = new Pool({
    host: config.get('host'),
    user: config.get('user'),
    password: config.get('password'),
    database: database,
    max: 8000
  })
}

const pnd = async function (module) {
  const startTime = new Date()
  const stream = fs.createWriteStream(`${module.join('-')}.ndjson`)
  const bbox = tilebelt.tileToBBOX([module[1], module[2], module[0]])
  let layerCount = 0
  for (const database of Object.keys(data)) {
    layerCount += data[database].length
    for (const layer of data[database]) {
      const client = await pools[database].connect()
      client.on('error', err => {
        console.error(`${module.join('-')} client caught an error: `, err.stack)
      })
      const geom = config.get('geom')[database]
      let q = `WITH envelope AS (` +
        `  SELECT ST_MakeEnvelope(${bbox.join(', ')}, 4326) as geom` +
        `)` + 
        `SELECT *, ` +
        `  ST_Intersection(${layer}.geom, envelope.geom) as geom ` +
        `FROM ${layer} ` +
        `JOIN envelope ` +
        `ON ${layer}.${geom} && envelope.geom `
      await client.query(new Query(q))
        .on('row', row => {
          let g = wkx.Geometry.parse(Buffer.from(row[geom], 'hex')).toGeoJSON()
          /* no longer necessary because this is done at PostGIS server
          if (g.type === 'Point' || g.coordinates.length === 0) {
          } else {
            g = turf.bboxClip(g, bbox).geometry
          } */
          delete row[geom]
          let properties = row
          properties._layer = layer
          let f = {
            type: 'Feature',
            geometry: g,
            tippecanoe: {
              layer: g.type.toLowerCase().replace('multi', '')
            },
            properties: properties
          }
          stream.write(JSON.stringify(modify(f)) + '\n')
        })
        .on('error', err => {
          console.error(`${layer}/${module.join('-')} query: ${err.stack}`)
        })
        .on('end', () => {
          layerCount -= 1
          client.end()
          if (layerCount === 0) stream.end()
        })
    }
  }
  stream.on('close', () => {
    cpq.spawn('nice', ['-19', 'tippecanoe',
      '--quiet', '--read-parallel',
      '--simplify-only-low-zooms', '--simplification=4', '--minimum-zoom=5',
      '--maximum-zoom=16', '--base-zoom=16', '-f',
      `--output=${module.join('-')}.mbtiles`, `${module.join('-')}.ndjson`],
    {
      stdio: 'inherit',
      onCreate: (proc) => {
        proc.on('close', (code) => {
          console.log(
            `${module.join('-')} took ` + 
            `${((new Date()).getTime() - startTime.getTime()) / 1000}s.`
          )
          console.log(`${module.join('-')} finished. ` +
              `${cpq.getCurrentProcessCount()} active, ` +
              `${cpq.getCurrentQueueSize()} in queue.`)
        })
      }
    })
    console.log(`started a tippecanoe process: ` +
      `${cpq.getCurrentProcessCount()} of ${cpq.getMaxProcesses()} ` +
      `active, ${cpq.getCurrentQueueSize()} in queue.`)
  })
}

async function main () {
  let ct = 0
  for (const module of config.get('modules').sort(() => {
      return Math.random() - .5 
    })) {
    ct += 1
    console.log(`importing #${ct} ${module.join('-')}`)
    await pnd(module)
  }
}

main()

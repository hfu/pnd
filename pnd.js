const config = require('config')
const { Pool, Query } = require('pg')
const tilebelt = require('@mapbox/tilebelt')
const wkx = require('wkx')
const fs = require('fs')
const { spawnSync } = require('child_process')
const data = config.get('data')
let modify
if (fs.existsSync('./modify.js')) {
  modify = require('./modify.js')
} else {
  modify = f => {return f}
}

let pools = {}
for (let database of Object.keys(data)) {
  pools[database] = new Pool({
    host: config.get('host'),
    user: config.get('user'),
    password: config.get('password'),
    database: database,
    max: 2
  })
  pools[database].on('error', (err, client) => {
    console.error(`unexpected error on idle client ${err} ${database} ${client}`)
  })
}

const pnd = async function (module) {
  const startTime = new Date()
  if (fs.existsSync(`${module.join('-')}.ndjson`)) return
  const stream = fs.createWriteStream(`${module.join('-')}.ndjson-part`)
  const bbox = tilebelt.tileToBBOX([module[1], module[2], module[0]])
  let layerCount = 0
  for (const database of Object.keys(data)) {
    layerCount += data[database].length
    for (const layer of data[database]) {
      const client = await pools[database].connect()
      /*
      client.on('error', err => {
        console.error(`${module.join('-')} client caught an error: `, err.stack)
      })
      */
      const geom = config.get('geom')[database]
      let q = `WITH envelope AS (` +
        `  SELECT ST_MakeEnvelope(${bbox.join(', ')}, 4326) as geom` +
        `)` + 
        `SELECT *, ` +
        `  ST_Intersection(ST_MakeValid(${layer}.geom), envelope.geom) as geom ` +
        `FROM ${layer} ` +
        `JOIN envelope ` +
        `ON ${layer}.${geom} && envelope.geom `
      await client.query(new Query(q))
        .on('row', row => {
          let g = null
          try {
            g = wkx.Geometry.parse(Buffer.from(row[geom], 'hex')).toGeoJSON()
          } catch (e) {
            if (e instanceof RangeError) {
              console.error(module.join('-') + ' buffer range error: ' + 
                e.stack)
              return
            }
            throw e
          }
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
          client.release()
        })
        .on('end', () => {
          layerCount -= 1
          client.release()
          if (layerCount === 0) stream.end()
        })
    }
  }
  stream.on('close', () => {
    fs.renameSync(
      `${module.join('-')}.ndjson-part`, 
      `${module.join('-')}.ndjson`
    )
    /*
    spawnSync('nice', ['-19', 'tippecanoe',
      '--quiet', '--read-parallel',
      '--simplify-only-low-zooms', '--simplification=4', '--minimum-zoom=5',
      '--maximum-zoom=16', '--base-zoom=16', '-f',
      `--output=${module.join('-')}.mbtiles`, `${module.join('-')}.ndjson`],
    {
      stdio: 'inherit',
      onCreate: (proc) => {
        proc.on('close', (code) => {
    */
          console.log(
            `${module.join('-')} took ` + 
            `${((new Date()).getTime() - startTime.getTime()) / 1000}s.`
          )
    /*
        })
      }
    })
    */
  })
}

async function main () {
  let ct = 0
  for (const module of config.get('modules').sort(() => {
      return Math.random() - .5 
    })) {
    for (let dx = 0; dx < 2; dx++) {
      for (let dy = 0; dy < 2; dy++) {
        let module_ = [module[0] + 1, module[1] * 2 + dx, module[2] * 2 + dy]
        ct += 1
        console.log(`importing #${ct} ${module_.join('-')}`)
        if (!fs.existsSync(`${module_.join('-')}.ndjson`)) {
          await pnd(module_)
        }
      }
    }
  }
}

main()

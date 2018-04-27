const config = require('config')
const { Pool, Query } = require('pg')
const tilebelt = require('@mapbox/tilebelt')
const turf = require('@turf/turf')
const wkx = require('wkx')
const z = config.get('z')
const x = config.get('x')
const y = config.get('y')
const geoms = config.get('geom')
const data = config.get('data')
let pools = {}
for (let database of Object.keys(data)) {
  pools[database] = new Pool({
    host: config.get('host'), user: config.get('user'), 
    password: config.get('password'), database: database, max: 50
  })
}
const bbox = tilebelt.tileToBBOX([x, y, z])

const pnd = async function (database, layer, minzoom, maxzoom, text_key) {
  const client = await pools[database].connect()
  const geom = geoms[database]
  let q = `SELECT * FROM ${layer}`
  q += ` WHERE ${geom} && ST_MakeBox2D(` +
    `ST_MakePoint(${bbox[0]}, ${bbox[1]}), ` +
    `ST_MakePoint(${bbox[2]}, ${bbox[3]}))`
  await client.query(new Query(q))
    .on('row', row => {
      let g = wkx.Geometry.parse(new Buffer(row[geom], 'hex')).toGeoJSON()
      if (g.type === 'Point') {
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
      console.log(JSON.stringify(f))
    })
    .on('end', () => {
      client.end()
    })
}

for (const database of Object.keys(data)) {
  for(const t of data[database]) {
    pnd(database, t[0], t[1], t[2], t[3])
  }
}

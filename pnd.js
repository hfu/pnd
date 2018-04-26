require('dotenv').config()
const { Pool, Query } = require('pg')
const tilebelt = require('@mapbox/tilebelt')
const turf = require('@turf/turf')
const wkx = require('wkx')
const z = parseInt(process.env.Z)
const x = parseInt(process.env.X)
const y = parseInt(process.env.Y)
const tables = JSON.parse(process.env.TABLES)
const geom = process.env.GEOM
const pool = new Pool({max: 50})
const bbox = tilebelt.tileToBBOX([x, y, z])

const pnd = async function (layer, minzoom, maxzoom, properties) {
  const client = await pool.connect()
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
      // f.properties.layer = layer
      f.properties = {layer: layer}
      console.log(JSON.stringify(f))
    })
    .on('end', () => {
      client.end()
    })
}

for (const t of tables) {
  pnd(t[0], t[1], t[2], t[3])
}

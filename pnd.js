require('dotenv').config()
const { Pool, Query } = require('pg')
const tilebelt = require('@mapbox/tilebelt')
const turf = require('@turf/turf')
const wkx = require('wkx')
const z = parseInt(process.env.Z)
const x = parseInt(process.env.X)
const y = parseInt(process.env.Y)
const tables = process.env.TABLES.split(' ')
const deletes = process.env.DELETES.split(' ')
const geom = process.env.GEOM
const pool = new Pool({max: 50})
const bbox = tilebelt.tileToBBOX([x, y, z])

const pnd = async function (layer) {
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
        //tippecanoe: {layer: row.g.type.toLowerCase().replace('multi', '')}
        tippecanoe: {layer: layer}
      }
      delete row.g
      delete row[geom]
      for(const k of deletes) {
        delete row[k]
      }
      f.properties = row
      f.properties.layer = layer //
      //f.properties = {layer: layer}
      console.log(JSON.stringify(f))
    })
    .on('end', () => {
      client.end()
    })
}

for (const layer of tables) {
  pnd(layer)
}

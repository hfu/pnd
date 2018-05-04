# pnd
PostGIS to NDJSON then to mbtiles, with pg, turf, wkx, tilebelt, node-config and tippecanoe.

## usage
```sh
$ vi config/default.hjson
$ node pnd.js
```
pnd.js spawns ../tippecanoe/tippecanoe now.

## config/default.hjson
```
{
  host: pghost.example.com
  user: pguser
  password: pgpassword
  modules: [[5, 18, 15], [5, 18, 14]]
  geom: {
    db1: geom
    db2: geomtype
  }
  data: {
    db1: [
      ['table_for_z_0_to_6', 0, 6, null]
      ['table_for_z_11_to_14', 11, 14, null]

      ['annotation_using_poiname', 6, 14, 'poiname']
      ['annotation_using_placename1', 8, 14, 'placename1']
    ]
    db2: [
      ['osm_planet_water', 10, 14, null]
      ['osm_planet_major_roads', 10, 14, null]
      ['osm_planet_pois_other', 13, 14, 'name']
    ]
  }
}
```

Happy tile-baking!


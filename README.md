# pnd
PostGIS to NDJSON, with pg, turf, wkx, tilebelt and node-config
## config/default.hjson
```
{
  host: pghost.example.com
  user: pguser
  password: pgpassword
  z: 5
  x: 18
  y: 15
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

# pnd
PostGIS to NDJSON then to mbtiles, with pg, turf, wkx, tilebelt, node-config and tippecanoe.

Now using [modify](https://github.com/hfu/modify-spec)

## usage
```sh
$ vi config/default.hjson
$ vi modify.js
$ node pnd.js
```
pnd.js spawns ../tippecanoe/tippecanoe automatically.

## example config/default.hjson
This config file contains PostGIS connection parameters and relations metadata.
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
      table1
      table2
    ]
    db2: [
      table3
      table4
    ]
  }
}
```

## example modify.js
This file contains a function to modify features; like adding minzoom and maxzoom, setting up layer name, or filtering properties.
```js
module.exports = (f) => {
  if (f.properties.text) {
    f.properties = {text: f.properties.text}
  } else {
    f.properties = {}
  }
  return f
}
```

Happy tile-baking!


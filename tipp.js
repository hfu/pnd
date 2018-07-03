// extra script to run tippecanoe
const fs = require('fs')
fs.readdir('.', (err, files) => {
  if (err) throw err
  let list = files.filter(file => {
    if(/.*\.ndjson$/.test(file)) {
      if (fs.existsSync(file.replace('ndjson', 'mbtiles-journal'))) {
        return true
      } else if (fs.existsSync(file.replace('ndjson', 'mbtiles'))) {
        // may be, timeStamp must be checked in future 
        return false
      }
      return true
    } else {
      return false
    }
  })
  for (file of list) {
    console.log(`tippecanoe --read-parallel --simplify-only-low-zooms ` +
      `--simplification=4 --minimum-zoom=6 --maximum-zoom=16 ` +
      `--base-zoom=16 -f --output=${file.replace('ndjson', 'mbtiles')} ` +
      `${file}`)
  }
})

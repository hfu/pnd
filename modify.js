module.exports = (f) => {
  if (f.properties.text) {
    f.properties = {text: f.properties.text}
  } else {
    f.properties = {}
  }
  return f
}

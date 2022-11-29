function deepCopy(obj) {
    let copy = {}

    for (let property in obj) {
      if (typeof obj[property] === 'object') {
        copy[property] = deepCopy(obj[property])
      } else {
        copy[property] = obj[property]
      }
    }

    return copy
}

module.exports = {deepCopy: deepCopy};